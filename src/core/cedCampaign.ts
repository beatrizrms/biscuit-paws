// O dia da campanha da CED, no beco (data/ced.json: campaign; falas em data/dialogue.json e data/ced_text.json).
// Véspera: a Fernanda avisa. No dia, o café fica fechado; a Fernanda espera no beco, ela põe as caixas com ração
// perto de onde cada gato da colônia fica, se afasta e espera ele entrar (perto demais, ele foge e volta depois); com
// o gato dentro, E fecha a caixa. Às 17h (ou com todos pegos), a Fernanda leva para a clínica. Na manhã seguinte,
// no beco: com vaga no café, ela pergunta se fica com algum; os outros voltam para o lugar deles, com a orelha
// marcada (só falado), e a Fernanda posta para adoção. Depois, de tempos em tempos, alguém adota um.
// Puro: sem Phaser, DOM ou window. A sessão (session.ts) só delega para cá (pela CedFlow).
import type { CatDef } from './cats';
import { generateCat, type CatProfilesData } from './catGen';
import type { EventBus } from './events';
import type { Cell } from './map';
import type { CatSex } from './repro';
import { cellHash, createRng } from './rng';
import type { GameState } from './state';
import { parseClock } from './time';

export interface CampaignConfig {
  daysAfterReady: number;
  name: string;
  map: string;
  /** Até quando a captura vai (a Fernanda leva quem pegou para a clínica). */
  endAt: string;
  /** Onde a Fernanda espera (a esquina com o carro). */
  fernandaAt: Cell;
  /** Onde cada gato da colônia fica (e onde ele volta): a célula e o texto da soltura ("perto da caçamba"). */
  spots: { at: Cell; where: string }[];
  /** Nomes que a Fernanda dá aos gatos (para o post de adoção). */
  names: string[];
  trap: {
    /** Minutos de espera (sorteados) até o gato entrar, com ela longe. */
    wait: [number, number];
    /** Com ela a pelo menos tantas células da caixa, o gato chega mais perto. */
    awayCells: number;
    /** Ela a tantas células (ou menos) com o gato chegando: ele se assusta e foge. */
    scareCells: number;
    /** Minutos até o gato que fugiu voltar. */
    scareMinutes: number;
  };
  adoption: {
    /** Dias entre uma adoção e outra (sorteado). */
    everyDays: [number, number];
    /** Com a nota do café a partir disto, a página dela é mais vista: um dia a menos. */
    fastRating: number;
  };
  rewards: { hearts: number; reputation: number };
}

export type ColonyStatus = 'free' | 'waiting' | 'inside' | 'caught' | 'kept' | 'released' | 'adopted';

export interface ColonyCat {
  /** Id estável (cat.ced.<campanha>.<n>); vira o id do gato no café, se ela ficar com ele. */
  id: string;
  name: string;
  /** O gato inteiro (variante, jeito, sexo): vai para state.catDefs se ela ficar com ele. */
  def: CatDef;
  sex: CatSex;
  /** Índice em campaign.spots. */
  spot: number;
  status: ColonyStatus;
  /** Minutos de espera já contados e quantos precisa. */
  progress: number;
  need: number;
  /** Minuto absoluto (dia x 1440 + hora) em que o gato que fugiu volta. */
  scaredUntil: number | null;
}

/** eve: véspera; meet: o dia (falta encontrar a Fernanda); capture; clinic: noite na clínica; release; done. */
export type CampaignStage = 'eve' | 'meet' | 'capture' | 'clinic' | 'release' | 'done';

export interface CampaignState {
  /** Número da campanha (1 = a primeira). */
  n: number;
  stage: CampaignStage;
  /** Dia da captura (muda se ela faltou e a Fernanda remarcou). */
  day: number;
  rescheduled: boolean;
  cats: ColonyCat[];
  /** A conversa da soltura (com a pergunta da vaga) já aconteceu. */
  releaseTalked: boolean;
  /** Próximo dia em que alguém pode adotar (depois da soltura). */
  nextAdoption: number | null;
  /** Posts da Fernanda na SocialVilla (o id vai para o feed). */
  posts: { id: string; day: number; kind: 'adoption' | 'adopted'; cats: string[] }[];
}

export interface CampaignHost {
  state: GameState;
  bus: EventBus;
  cfg: CampaignConfig;
  profiles: CatProfilesData;
  /** Onde ela está (célula dos pés) no mapa atual, ou null. */
  playerCell(): Cell | null;
  sceneFree(): boolean;
  rating(): number | null;
  /** Quantos gatos ainda cabem no café. */
  freeSlots(): number;
  /** Abriga no café um gato da campanha (castrado, orelha marcada, sem consulta de entrada). */
  shelterColonyCat(def: CatDef): void;
  addHearts(npc: string, points: number): void;
  addReputation(amount: number, reason: string): void;
  /** Põe um post no feed da SocialVilla (o texto vem da campanha). */
  postSocial(postId: string): void;
}

const FERNANDA = 'npc.fernanda';
export const CAMPAIGN_SCRIPTS = { meet: 'scr.ced_meet', release: 'scr.ced_release' } as const;

const absMinute = (s: GameState) => s.day * 1440 + s.time;
const dist = (a: Cell, b: Cell) => Math.max(Math.abs(a[0] - b[0]), Math.abs(a[1] - b[1]));

export class CedCampaign {
  /** Uma cena pedida por vez (o roteiro só começa com ela livre). */
  private requested = false;

  constructor(private h: CampaignHost) {}

  private rng(salt: number) {
    return createRng(cellHash(this.h.state.day, salt) ^ 0x2ced);
  }

  get cfg(): CampaignConfig {
    return this.h.cfg;
  }

  /** A campanha (ou null: ainda não chegou a véspera). */
  get st(): CampaignState | null {
    return this.h.state.ced.campaign;
  }

  // ---------- Começo: a véspera ----------

  /** Véspera: a Fernanda avisa e os gatos da colônia aparecem no beco (um por kit, cada um num lugar). */
  startEve(campaignDay: number, cats: number, n: number): void {
    const rng = this.rng(77 + n);
    // Sem repetir o nome de um gato que já mora no café (nem de outra colônia).
    const taken = new Set([...Object.values(this.h.state.cats).map((x) => x.name), ...this.h.state.ced.pastCampaigns.flatMap((p) => p.cats.map((x) => x.name))]);
    const free = this.cfg.names.filter((x) => !taken.has(x));
    const names = free.length >= cats ? free : [...this.cfg.names];
    const spots = this.cfg.spots.map((_, i) => i);
    const count = Math.max(1, Math.min(cats, spots.length));
    const list: ColonyCat[] = [];
    for (let i = 0; i < count; i++) {
      const gen = generateCat(rng, this.h.profiles, { condition: 'healthy' }, 0);
      const name = names.splice(rng.int(0, names.length - 1), 1)[0] ?? `Gato ${i + 1}`;
      const sex: CatSex = rng.chance(0.5) ? 'male' : 'female';
      const id = `cat.ced.${n}.${i + 1}`;
      const def: CatDef = {
        ...gen.def,
        id,
        // O nome que a Fernanda deu vem primeiro na caixa de nome (ela pode trocar).
        nameSuggestions: [name, ...(gen.def.nameSuggestions ?? []).filter((x) => x !== name)].slice(0, 3),
        repro: { status: 'neutered', sex, ageMonths: rng.int(12, 60), known: true, earTipped: true },
        tags: [...gen.def.tags.filter((t) => !t.startsWith('condition:')), 'ced', 'condition:healthy'],
      };
      const spot = spots.splice(rng.int(0, spots.length - 1), 1)[0]!;
      list.push({ id, name, def, sex, spot, status: 'free', progress: 0, need: rng.int(this.cfg.trap.wait[0], this.cfg.trap.wait[1]), scaredUntil: null });
    }
    // A campanha anterior vai para o histórico (os posts de adoção dela continuam no feed).
    if (this.h.state.ced.campaign) this.h.state.ced.pastCampaigns.push(this.h.state.ced.campaign);
    this.h.state.ced.campaign = { n, stage: 'eve', day: campaignDay, rescheduled: false, cats: list, releaseTalked: false, nextAdoption: null, posts: [] };
    this.h.bus.emit('ced.campaign_eve', { day: campaignDay });
  }

  // ---------- O tempo ----------

  /** Manhã: o dia chegou, a Fernanda remarca (uma vez) se ela faltou, a noite na clínica acaba, alguém adota. */
  morning(): void {
    const c = this.st;
    if (!c) return;
    const day = this.h.state.day;
    if ((c.stage === 'eve' || c.stage === 'meet') && day === c.day) {
      c.stage = 'meet';
      this.h.bus.emit('ced.campaign_day', {});
    } else if (c.stage === 'meet' && day > c.day) {
      if (!c.rescheduled) {
        c.rescheduled = true;
        c.day = day;
        this.h.bus.emit('ced.campaign_rescheduled', {});
      } else {
        // Faltou duas vezes: a campanha fica para a próxima (os kits ficam guardados).
        c.stage = 'done';
        for (const cat of c.cats) cat.status = 'free';
        c.cats = [];
        this.h.bus.emit('ced.campaign_cancelled', {});
      }
    } else if (c.stage === 'capture' && day > c.day) {
      // O dia acabou no meio da captura: quem estava pego vai para a clínica.
      this.endCapture();
      c.stage = 'release';
    } else if (c.stage === 'clinic') c.stage = 'release';
    if (c.stage === 'release' && day > c.day) this.h.bus.emit('ced.release_day', {});
    if (c.stage === 'done') this.adoptionTick();
  }

  /** A cada minuto: a cena do encontro, as caixas (o gato chegando, fugindo, entrando) e o fim da captura. */
  tick(): void {
    const c = this.st;
    if (!c) return;
    const s = this.h.state;
    const inAlley = s.location === this.cfg.map;
    if (c.stage === 'meet' && s.day === c.day && inAlley && this.h.sceneFree() && !this.requested) {
      this.requested = true;
      this.h.bus.emit('script.requested', { scriptId: CAMPAIGN_SCRIPTS.meet });
    }
    if (c.stage === 'release' && s.day > c.day && inAlley && !c.releaseTalked && this.h.sceneFree() && !this.requested) {
      this.requested = true;
      this.h.bus.emit('script.requested', { scriptId: CAMPAIGN_SCRIPTS.release });
    }
    if (c.stage !== 'capture') return;
    const now = absMinute(s);
    const feet = inAlley ? this.h.playerCell() : null;
    for (const cat of c.cats) {
      if (cat.status !== 'waiting') continue;
      if (cat.scaredUntil !== null) {
        if (now < cat.scaredUntil) continue;
        cat.scaredUntil = null;
        this.h.bus.emit('ced.cat_back', { catId: cat.id });
      }
      const d = feet ? dist(feet, this.spotAt(cat)) : Infinity;
      if (cat.progress > 0 && d <= this.cfg.trap.scareCells) {
        // Ela chegou perto com ele vindo: ele foge e volta daqui a pouco (a caixa fica).
        cat.progress = 0;
        cat.scaredUntil = now + this.cfg.trap.scareMinutes;
        this.h.bus.emit('ced.cat_scared', { catId: cat.id });
        continue;
      }
      if (d < this.cfg.trap.awayCells) continue;
      cat.progress += 1;
      if (cat.progress >= cat.need) {
        cat.status = 'inside';
        this.h.bus.emit('ced.cat_inside', { catId: cat.id });
      }
    }
    if (s.time >= parseClock(this.cfg.endAt) || c.cats.every((x) => x.status === 'caught')) this.endCapture();
  }

  // ---------- As cenas ----------

  /** Acabou o roteiro do encontro: a captura começa. Acabou o da soltura: a pergunta da vaga (ou a soltura direto). */
  scriptFinished(scriptId: string): void {
    const c = this.st;
    this.requested = false;
    if (!c) return;
    if (scriptId === CAMPAIGN_SCRIPTS.meet && c.stage === 'meet') {
      c.stage = 'capture';
      this.h.bus.emit('ced.capture_started', { total: c.cats.length });
    } else if (scriptId === CAMPAIGN_SCRIPTS.release && c.stage === 'release') {
      c.releaseTalked = true;
      const caught = c.cats.filter((x) => x.status === 'caught');
      const slots = this.h.freeSlots();
      if (caught.length > 0 && slots > 0) this.h.bus.emit('ced.keep_ask', { max: Math.min(slots, caught.length), cats: caught.map((x) => x.id) });
      else this.afterKeep();
    }
  }

  /** Ela escolheu ficar com este gato (na pergunta da vaga, ou depois, no beco, com vaga aberta). */
  keep(catId: string): boolean {
    const cat = this.st?.cats.find((x) => x.id === catId);
    if (!cat || (cat.status !== 'caught' && cat.status !== 'released') || this.h.freeSlots() <= 0) return false;
    const fromAlley = cat.status === 'released';
    cat.status = 'kept';
    this.h.shelterColonyCat(cat.def);
    this.h.bus.emit('ced.cat_kept', { catId, name: cat.name, fromAlley });
    return true;
  }

  /** Acabou a pergunta da vaga: os que ficaram de fora esperam ser soltos (ou, sem ninguém, a campanha termina). */
  afterKeep(): void {
    const c = this.st;
    if (!c || c.stage !== 'release') return;
    const left = c.cats.filter((x) => x.status === 'caught');
    if (left.length === 0) return this.finish();
    this.h.bus.emit('ced.release_others', { count: left.length });
  }

  // ---------- Pontos no beco (E) ----------

  /** Onde fica o gato (a célula da caixa). */
  spotAt(cat: ColonyCat): Cell {
    return this.cfg.spots[cat.spot]!.at;
  }

  /** Os pontos de E no beco agora: pôr a caixa, fechar a caixa, abrir a caixa (soltura), levar para o café. */
  points(): { id: string; at: Cell; kind: 'trap' | 'close' | 'release' | 'take'; catId: string }[] {
    const c = this.st;
    if (!c || this.h.state.location !== this.cfg.map) return [];
    const out: ReturnType<CedCampaign['points']> = [];
    for (const cat of c.cats) {
      const at = this.spotAt(cat);
      const base = { at, catId: cat.id };
      if (c.stage === 'capture' && cat.status === 'free') out.push({ ...base, id: `pt.ced_trap.${cat.id}`, kind: 'trap' });
      if (c.stage === 'capture' && cat.status === 'inside') out.push({ ...base, id: `pt.ced_close.${cat.id}`, kind: 'close' });
      if (c.stage === 'release' && c.releaseTalked && cat.status === 'caught') out.push({ ...base, id: `pt.ced_release.${cat.id}`, kind: 'release' });
      if (c.stage === 'done' && cat.status === 'released' && this.h.freeSlots() > 0) out.push({ ...base, id: `pt.ced_take.${cat.id}`, kind: 'take' });
    }
    return out;
  }

  /** E num ponto da campanha. */
  interact(pointId: string): boolean {
    const p = this.points().find((x) => x.id === pointId);
    const cat = p && this.st!.cats.find((x) => x.id === p.catId);
    if (!p || !cat) return false;
    if (p.kind === 'trap') {
      cat.status = 'waiting';
      cat.progress = 0;
      this.h.bus.emit('ced.trap_set', { catId: cat.id });
    } else if (p.kind === 'close') {
      cat.status = 'caught';
      const c = this.st!;
      this.h.bus.emit('ced.cat_caught', { catId: cat.id, caught: c.cats.filter((x) => x.status === 'caught').length, total: c.cats.length });
    } else if (p.kind === 'release') {
      cat.status = 'released';
      this.h.bus.emit('ced.cat_released', { catId: cat.id, name: cat.name, where: this.cfg.spots[cat.spot]!.where });
      if (!this.st!.cats.some((x) => x.status === 'caught')) this.finish();
    } else if (p.kind === 'take') {
      this.h.bus.emit('ced.take_ask', { catId: cat.id, name: cat.name });
    }
    return true;
  }

  // ---------- Fim da captura, fim da campanha, adoções ----------

  private endCapture(): void {
    const c = this.st;
    if (!c || c.stage !== 'capture') return;
    // Caixa sem gato (ou com o gato chegando): volta vazia; quem não entrou continua no beco, como era.
    for (const cat of c.cats) if (cat.status !== 'caught') Object.assign(cat, { status: 'free', progress: 0, scaredUntil: null });
    const caught = c.cats.filter((x) => x.status === 'caught').length;
    c.stage = caught > 0 ? 'clinic' : 'done';
    this.h.bus.emit('ced.capture_ended', { caught, total: c.cats.length, inAlley: this.h.state.location === this.cfg.map });
  }

  private finish(): void {
    const c = this.st!;
    c.stage = 'done';
    this.h.addHearts(FERNANDA, this.cfg.rewards.hearts);
    this.h.addReputation(this.cfg.rewards.reputation, `ced:campaign:${c.n}`);
    const released = c.cats.filter((x) => x.status === 'released');
    if (released.length > 0) {
      const id = `ced.post.${c.n}.adoption`;
      c.posts.push({ id, day: this.h.state.day, kind: 'adoption', cats: released.map((x) => x.id) });
      this.h.postSocial(id);
      c.nextAdoption = this.h.state.day + this.adoptionGap();
    }
    this.h.state.flags['ced.campaign_done'] = true;
    const neutered = c.cats.filter((x) => x.status !== 'free').length;
    this.h.bus.emit('ced.campaign_done', { cats: neutered, kept: c.cats.filter((x) => x.status === 'kept').length });
  }

  private adoptionGap(): number {
    const [min, max] = this.cfg.adoption.everyDays;
    const fast = (this.h.rating() ?? 0) >= this.cfg.adoption.fastRating ? 1 : 0;
    return Math.max(1, this.rng(313).int(min, max) - fast);
  }

  /** Manhã: com algum gato esperando adoção e o dia chegado, alguém adota um (post da Fernanda). */
  private adoptionTick(): void {
    const c = this.st!;
    const waiting = c.cats.filter((x) => x.status === 'released');
    if (waiting.length === 0 || c.nextAdoption === null || this.h.state.day < c.nextAdoption) return;
    const cat = waiting[this.rng(919).int(0, waiting.length - 1)]!;
    cat.status = 'adopted';
    const id = `ced.post.${c.n}.adopted.${cat.id}`;
    c.posts.push({ id, day: this.h.state.day, kind: 'adopted', cats: [cat.id] });
    this.h.postSocial(id);
    c.nextAdoption = waiting.length > 1 ? this.h.state.day + this.adoptionGap() : null;
    this.h.bus.emit('ced.cat_adopted', { catId: cat.id, name: cat.name, sex: cat.sex });
  }

  /** O gato da colônia (pelo id). */
  cat(catId: string): ColonyCat | undefined {
    return this.st?.cats.find((x) => x.id === catId);
  }
}

export function validateCampaign(cfg: CampaignConfig, refs: { maps: ReadonlySet<string> }): string[] {
  const errors: string[] = [];
  const err = (m: string) => errors.push(`ced.campaign: ${m}`);
  if (!refs.maps.has(cfg.map)) err(`mapa inexistente "${cfg.map}"`);
  if (cfg.spots.length === 0) err('spots vazio');
  if (cfg.names.length < cfg.spots.length) err('names precisa de pelo menos um nome por spot');
  if (!(cfg.trap.wait[0] >= 1 && cfg.trap.wait[1] >= cfg.trap.wait[0])) err('trap.wait precisa de [mín, máx] com mín >= 1');
  if (!(cfg.trap.awayCells > cfg.trap.scareCells)) err('trap.awayCells precisa ser maior que scareCells');
  if (!(cfg.adoption.everyDays[0] >= 1 && cfg.adoption.everyDays[1] >= cfg.adoption.everyDays[0])) err('adoption.everyDays precisa de [mín, máx] com mín >= 1');
  return errors;
}
