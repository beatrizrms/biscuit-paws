// O sistema de chegadas na sessão (como o CafeService): põe chegadas na fila, começa a da vez quando não há outro
// evento exclusivo, cria o gato (fixo ou gerado), e no fim abriga o gato conforme a vaga: no café, provisório
// (café cheio, com prazo) ou no abrigo da vila (entra na feira de adoção). As etapas de cada modelo (seguir a pista,
// mini game, escolha) vêm a partir da etapa (b); aqui ficam o ciclo e as regras de vaga e ritmo.
// Puro: sem Phaser, DOM ou window.
import { stepsOf } from './arrivalModels';
import { arrivalsToQueue, nextGap, triggerHolds, visibleTrail, type ArrivalDef, type ArrivalStep } from './arrivals';
import type { JobPoint } from './jobs';
import { generateCat, type CatNeed } from './catGen';
import { parseClock } from './time';
import { seasonOf, weatherOf } from './calendar';
import type { Content } from './content';
import type { EventBus } from './events';
import { createRng, type Rng } from './rng';
import type { GameState } from './state';

/** Id do ponto do encontro (não é um ponto de data/jobs.json: existe só durante a chegada). */
export const meetPointId = (arrivalId: string) => `arrival:${arrivalId}`;
/** Id do ponto do mini game da etapa `step`. */
export const minigamePointId = (arrivalId: string, step: number) => `arrival:${arrivalId}:mg${step}`;

/** Id do ponto onde ela deixa a comida (etapa feed). */
export const feedPointId = (arrivalId: string) => `arrival:${arrivalId}:feed`;
/** Id do ponto do gato esperando as necessidades (ração, cobertor). */
export const needPointId = (arrivalId: string) => `arrival:${arrivalId}:need`;

/** Id do destino do guia (gato_leva). */
export const destPointId = (arrivalId: string) => `arrival:${arrivalId}:dest`;

/** Onde o gato foi parar no fim da chegada. */
export type Placement = 'sheltered' | 'provisional' | 'shelter_pool' | null;

export interface ArrivalHost {
  state: GameState;
  content: Content;
  bus: EventBus;
  evaluate(condition: unknown): boolean;
  /** Gatos do café que podem guiar (gato_leva): abrigados de vez. */
  guideCats(): string[];
  /** Minuto absoluto agora (dia * 1440 + hora). */
  now(): number;
  /** Gatos que ocupam vaga no café (abrigados, inclusive os provisórios) e a capacidade dos cômodos abertos. */
  shelteredCount(): number;
  capacity(): number;
  /** Algum evento exclusivo da história em andamento (a chegada espera). */
  exclusiveActive(): boolean;
  reputation(): number;
  /** Tira 1 do item da mochila (a ração do gato carteiro). Devolve se tinha. */
  takeItem(itemId: string): boolean;
  /** Personalidade do gato (data/cats.json ou o gerado). */
  catPersonality(catId: string): string;
  /** Abriga o gato no café com a condição de chegada (saúde, doença, fome); treated: o vet já cuidou (sem doença). */
  shelterCat(catId: string, condition: string, provisionalUntil?: number, treated?: boolean): void;
  money(): number;
  addMoney(delta: number, reason: string): void;
  addReputation(amount: number, reason: string): void;
  /** Pontos de relação (corações) de `from` por `to`. */
  addPoints(from: string, to: string, delta: number): void;
}

/** Debug (não vai para o save): forçar o clima e o café cheio para testar os gatilhos e a capacidade. */
export interface ArrivalDebug {
  weather?: string;
  cafeFull?: boolean;
}

export class ArrivalSystem {
  private rngCalls = 0;
  /** Painel de debug: clima forçado e café cheio. */
  debug: ArrivalDebug = {};

  constructor(private h: ArrivalHost) {}

  private get st() {
    return this.h.state.arrivals;
  }
  private get data() {
    return this.h.content.arrivals;
  }
  /** Sorteio com semente do dia e de quantas vezes já sorteou (repetível nos testes). */
  private rng(): Rng {
    return createRng(this.h.state.day * 7907 + this.st.seq * 131 + this.rngCalls++);
  }

  def(id: string): ArrivalDef | undefined {
    return this.data.arrivals.find((a) => a.id === id);
  }

  /** A chegada em andamento, com a definição. */
  active(): { def: ArrivalDef; catId: string; condition: string; step: number; leaderId?: string; startedAt: number } | null {
    const a = this.st.active;
    const def = a ? this.def(a.id) : undefined;
    return a && def ? { def, catId: a.catId, condition: a.condition, step: a.step, startedAt: a.startedAt ?? this.h.now(), ...(a.leaderId ? { leaderId: a.leaderId } : {}) } : null;
  }

  /** Pegadas visíveis agora (a neve cobre com o tempo: seguir cedo é mais fácil). */
  trailNow(): [number, number][] {
    const a = this.active();
    if (!a?.def.place.trail) return [];
    return visibleTrail(a.def.place.trail, a.def.place.fadeMinutes, this.h.now() - a.startedAt);
  }

  /** O sorteio automático já vale (depois dos gatos escritos à mão)? */
  autoOn(): boolean {
    return this.data.autoStartWhen === undefined || this.h.evaluate(this.data.autoStartWhen);
  }

  /** O que os gatilhos olham agora. */
  private context() {
    const s = this.h.state;
    const seasons = this.h.content.seasons;
    return {
      day: s.day,
      time: s.time,
      season: seasonOf(seasons, s.day),
      weather: this.debug.weather ?? weatherOf(seasons, s.day),
      cats: this.h.shelteredCount(),
      reputation: this.h.reputation(),
      evaluate: (c: unknown) => this.h.evaluate(c),
    };
  }

  /** A cada mudança (a sessão chama junto da história): enfileira o que valer e começa a da vez. */
  tick(): void {
    const auto = this.autoOn();
    if (auto && this.st.nextOn === null) this.st.nextOn = this.h.state.day + nextGap(this.data, this.h.state.day, this.rng());
    for (const id of arrivalsToQueue(this.data, this.st, this.context(), this.rng(), auto)) {
      if (this.def(id)?.priority) this.st.queue.unshift(id);
      else this.st.queue.push(id);
      this.h.bus.emit('arrival.queued', { arrivalId: id });
    }
    this.tryStart();
  }

  /** Vagas do café (o debug pode forçar "cheio"). */
  private capacity(): number {
    return this.debug.cafeFull ? 0 : this.h.capacity();
  }

  /** Começa a primeira da fila, se nada exclusivo está acontecendo (e, se ela adia com o café cheio, se há vaga). */
  private tryStart(): void {
    if (this.st.active) return;
    // Urgente (em_perigo) não espera os marcos exclusivos da história.
    const exclusive = this.h.exclusiveActive();
    const full = this.h.shelteredCount() >= this.capacity();
    // gato_leva precisa de um gato do café para guiar.
    const i = this.st.queue.findIndex((id) => {
      const def = this.def(id);
      return def && (!exclusive || def.priority) && !(def.whenFull === 'postpone' && full) && !(def.model === 'gato_leva' && this.h.guideCats().length === 0);
    });
    if (i < 0) return;
    const [id] = this.st.queue.splice(i, 1);
    this.start(this.def(id!)!);
  }

  /** Cria o gato (fixo ou gerado) e marca a chegada como em andamento. */
  private start(def: ArrivalDef): void {
    const s = this.h.state;
    let catId: string;
    let condition = def.condition ?? 'healthy';
    if ('id' in def.cat) catId = def.cat.id;
    else {
      this.st.seq++;
      const gen = generateCat(this.rng(), this.h.content.catProfiles, def.cat.generate, this.st.seq);
      s.catDefs[gen.def.id] = gen.def;
      catId = gen.def.id;
      condition = def.condition ?? gen.condition;
    }
    // Ninhada: os filhotes vêm junto (gerados, condição kitten).
    const extraCats: string[] = [];
    for (let i = 0; i < (def.litter ?? 0); i++) {
      this.st.seq++;
      const kit = generateCat(this.rng(), this.h.content.catProfiles, { condition: 'kitten' }, this.st.seq);
      s.catDefs[kit.def.id] = kit.def;
      extraCats.push(kit.def.id);
    }
    const guides = def.model === 'gato_leva' ? this.h.guideCats() : [];
    const leaderId = guides.length > 0 ? guides[this.rng().int(0, guides.length - 1)] : undefined;
    this.st.active = { id: def.id, catId, condition, startedOn: s.day, startedAt: this.h.now(), step: 0, ...(leaderId ? { leaderId } : {}), ...(extraCats.length ? { extraCats } : {}) };
    this.st.last[def.id] = s.day;
    this.h.bus.emit('arrival.started', { arrivalId: def.id, catId, model: def.model });
    this.enterStep();
  }

  // ---------- Etapas (os modelos dão as padrão: arrivalModels.ts) ----------

  /** A etapa da vez (ou null: acabaram). */
  currentStep(): ArrivalStep | null {
    const a = this.active();
    return a ? (stepsOf(a.def)[a.step] ?? null) : null;
  }

  /**
   * Entra na etapa da vez: fala segue sozinha; cena, roteiro e pergunta pedem à interface e esperam; ir até o
   * lugar, pista e cartaz esperam a protagonista. Sem mais etapas: o gato foi aceito.
   */
  private enterStep(): void {
    for (let guard = 0; guard < 100; guard++) {
      const a = this.st.active;
      if (!a) return;
      const step = this.currentStep();
      if (!step) {
        this.startNeeds();
        return;
      }
      this.h.bus.emit('arrival.step', { arrivalId: a.id, step: a.step });
      if ('dialogue' in step) {
        this.h.bus.emit('dialogue.requested', { dialogueId: step.dialogue });
        a.step++;
        continue;
      }
      if ('cutscene' in step) this.h.bus.emit('cutscene.requested', { cutsceneId: step.cutscene });
      else if ('script' in step) this.h.bus.emit('script.requested', { scriptId: step.script });
      else if ('choice' in step) this.h.bus.emit('arrival.choice', { arrivalId: a.id, key: step.choice });
      else if ('ask' in step) this.h.bus.emit('arrival.ask', { arrivalId: a.id, options: step.ask.map((o) => ({ npc: o.npc, tip: o.tip })) });
      return;
    }
  }

  /**
   * Aceito: antes de entrar, as necessidades da condição (cat_profiles.json: conditions[].needs). Sem nenhuma, entra.
   * O em_perigo já chegou à clínica correndo: o vet conta (e cobra) sozinho. A etapa feed conta como a ração.
   */
  private startNeeds(): void {
    const a = this.active();
    const st = this.st.active;
    if (!a || !st) return;
    if (!st.needs) {
      const needs = [...(this.h.content.catProfiles.conditions[a.condition]?.needs ?? [])];
      if (a.def.model === 'em_perigo' && needs.includes('vet')) {
        needs.splice(needs.indexOf('vet'), 1);
        this.payVet();
      }
      // O que fica para dentro do café (needsInside: o gato que a vizinha traz come do pote lá dentro).
      for (const n of a.def.needsInside ?? []) if (needs.includes(n)) needs.splice(needs.indexOf(n), 1);
      // Quem já comeu na etapa feed (gato carteiro) não precisa de mais ração.
      if (a.def.steps.some((s) => 'feed' in s) && needs.includes('food')) needs.splice(needs.indexOf('food'), 1);
      st.needs = needs;
      if (needs.length > 0) this.h.bus.emit('arrival.needs', { arrivalId: a.def.id, needs: [...needs] });
    }
    if (st.needs.length === 0) this.finish('accepted');
  }

  private payVet(): void {
    const st = this.st.active;
    if (!st) return;
    const cost = this.h.content.catProfiles.needs.vet.cost;
    if (cost) this.h.addMoney(-cost, `arrival:vet`);
    st.treated = true;
  }

  /** As necessidades que ainda faltam (null: não está nessa fase). */
  pendingNeeds(): CatNeed[] | null {
    const st = this.st.active;
    return st && st.needs && !this.currentStep() ? st.needs : null;
  }

  /** Onde o gato espera as necessidades: o fim do caminho, o lugar da chegada ou o lugar padrão (mural). */
  needsSpot(): { map: string; at: [number, number] } {
    const a = this.active();
    const p = a?.def.place;
    const route = p?.route;
    if (p?.map && route?.length) return { map: p.map, at: route[route.length - 1]! };
    if (p?.map && p.at) return { map: p.map, at: p.at };
    return this.h.content.catProfiles.needsPlace;
  }

  /** Passa para a próxima etapa. */
  private advance(): void {
    const a = this.st.active;
    if (!a) return;
    a.step++;
    this.enterStep();
  }

  /** Pontos no mapa que esta chegada pede agora (ir até o lugar, ou a pista). */
  pendingPoints(mapId: string): JobPoint[] {
    const a = this.active();
    const needs = this.pendingNeeds();
    if (a && needs && needs.length > 0) {
      const out: JobPoint[] = [];
      const spot = this.needsSpot();
      if ((needs.includes('food') || needs.includes('warmth')) && spot.map === mapId) out.push({ id: needPointId(a.def.id), map: mapId, at: spot.at, action: 'press' });
      const vet = this.h.content.jobPoints[this.h.content.catProfiles.needs.vet.point];
      if (needs.includes('vet') && vet && vet.map === mapId) out.push(vet);
      return out;
    }
    const step = this.currentStep();
    if (!a || !step) return [];
    if ('meet' in step && a.def.place.map === mapId && a.def.place.at) return [{ id: meetPointId(a.def.id), map: mapId, at: a.def.place.at, action: 'press' }];
    if ('minigame' in step && a.def.place.map === mapId && a.def.place.at) {
      const m = step.minigame;
      const difficulty = m.difficulty === 'auto' ? this.autoDifficulty(a.catId) : m.difficulty;
      return [{ id: minigamePointId(a.def.id, a.step), map: mapId, at: a.def.place.at, action: 'minigame', minigame: { id: m.id, difficulty, ...(m.itemId ? { itemId: m.itemId } : {}) } }];
    }
    const feed = this.feedSpot();
    if (feed && a.def.place.map === mapId) return [{ id: feedPointId(a.def.id), map: mapId, at: feed, action: 'press' }];
    const route = a.def.place.route;
    if ('lead' in step && a.def.place.map === mapId && route && route.length > 0) return [{ id: destPointId(a.def.id), map: mapId, at: route[route.length - 1]!, action: 'press' }];
    if ('clue' in step) {
      const p = this.h.content.jobPoints[step.clue];
      return p && p.map === mapId ? [p] : [];
    }
    return [];
  }

  /**
   * Etapa feed: onde o gato está agora (place.route, uma célula mais perto a cada refeição; sem rota, place.at),
   * ou null fora do horário ou se ele já comeu hoje.
   */
  feedSpot(): [number, number] | null {
    const a = this.active();
    const step = this.currentStep();
    const st = this.st.active;
    if (!a || !st || !step || !('feed' in step)) return null;
    const now = this.h.state.time;
    const [from, to] = step.feed.hours;
    if (now < parseClock(from) || now >= parseClock(to) || st.fedOn === this.h.state.day) return null;
    const route = a.def.place.route;
    if (route?.length) return route[Math.min(st.fed ?? 0, route.length - 1)]!;
    return a.def.place.at ?? null;
  }

  /** Ela apertou E num ponto: é desta chegada? (o lugar do encontro ou a pista da vez). Sem a ração: "missing_item". */
  interact(pointId: string): boolean | 'missing_item' | 'need_food' | 'need_warmth' | 'no_money' {
    const a = this.active();
    const needs = this.pendingNeeds();
    if (a && needs && needs.length > 0) return this.meetNeed(pointId);
    const step = this.currentStep();
    if (!a || !step) return false;
    if ('feed' in step && pointId === feedPointId(a.def.id) && this.feedSpot()) {
      if (!this.h.takeItem(step.feed.item)) return 'missing_item';
      const st = this.st.active!;
      st.fed = (st.fed ?? 0) + 1;
      st.fedOn = this.h.state.day;
      this.h.bus.emit('arrival.fed', { arrivalId: a.def.id, fed: st.fed, times: step.feed.times });
      if (st.fed >= step.feed.times) this.advance();
      return true;
    }
    if (('meet' in step && pointId === meetPointId(a.def.id)) || ('lead' in step && pointId === destPointId(a.def.id)) || ('clue' in step && step.clue === pointId)) {
      this.advance();
      return true;
    }
    return false;
  }

  /** A dica escolhida na etapa ask (se houve). */
  private chosenTip() {
    const a = this.active();
    if (!a || this.st.active?.tip === undefined) return undefined;
    const ask = stepsOf(a.def).find((s): s is Extract<ArrivalStep, { ask: unknown }> => 'ask' in s);
    return ask?.ask[this.st.active.tip];
  }

  /** Ela escolheu ouvir a dica de um vizinho (etapa ask). */
  answerAsk(index: number): void {
    const step = this.currentStep();
    const a = this.st.active;
    if (!a || !step || !('ask' in step) || !step.ask[index]) return;
    a.tip = index;
    this.advance();
  }

  /** Dificuldade "auto": a da dica escolhida (etapa ask) ou a da confiança da personalidade do gato (tímido = difícil). */
  private autoDifficulty(catId: string): 'easy' | 'normal' | 'hard' {
    const tip = this.chosenTip();
    if (tip) return tip.difficulty;
    const p = this.h.catPersonality(catId);
    return this.h.content.catProfiles.personalities[p]?.trust ?? 'normal';
  }

  /** O ponto é o mini game da etapa da vez desta chegada? */
  ownsMinigame(pointId: string): boolean {
    const a = this.st.active;
    return !!a && pointId === minigamePointId(a.id, a.step);
  }

  /** Terminou o mini game da etapa: deu certo, segue; não deu, fica na etapa (tenta de novo). */
  minigameResult(pointId: string, success: boolean): void {
    if (!this.ownsMinigame(pointId) || !success) return;
    this.advance();
  }

  /** E no gato (ração, cobertor) ou na Fernanda (vet): atende uma necessidade. Todas atendidas: o gato entra. */
  private meetNeed(pointId: string): boolean | 'need_food' | 'need_warmth' | 'no_money' {
    const a = this.active()!;
    const st = this.st.active!;
    const cfg = this.h.content.catProfiles.needs;
    let met: CatNeed | null = null;
    if (pointId === needPointId(a.def.id)) {
      // Ração antes do cobertor (quem está com fome come primeiro).
      const want = (['food', 'warmth'] as const).find((n) => st.needs!.includes(n));
      if (!want) return false;
      const item = cfg[want].items.find((id) => this.h.takeItem(id));
      if (!item) return want === 'food' ? 'need_food' : 'need_warmth';
      met = want;
    } else if (pointId === cfg.vet.point && st.needs!.includes('vet')) {
      if (this.h.money() < cfg.vet.cost) return 'no_money';
      this.payVet();
      met = 'vet';
    } else return false;
    st.needs = st.needs!.filter((n) => n !== met);
    this.h.bus.emit('arrival.need_met', { arrivalId: a.def.id, need: met, left: [...st.needs] });
    if (st.needs.length === 0) this.finish('accepted');
    return true;
  }

  /** Uma cena ou roteiro terminou: se era a etapa da vez, segue. */
  stepFinished(what: { cutscene?: string; script?: string }): void {
    const step = this.currentStep();
    if (!step) return;
    if (('cutscene' in step && step.cutscene === what.cutscene) || ('script' in step && step.script === what.script)) this.advance();
  }

  /** Resposta da pergunta (ou do cartaz): sim segue; não, a chegada acaba recusada. */
  answer(yes: boolean): void {
    const step = this.currentStep();
    if (!step || !('choice' in step || 'poster' in step)) return;
    if (yes) this.advance();
    else this.finish('declined');
  }

  /**
   * Fim da chegada. Aceito: o gato entra no café (se houver vaga), fica provisório ou vai para o abrigo da vila,
   * conforme whenFull; o resultado (afeto, vizinho, moedas) vale. Recusado ou não deu: o gato gerado some.
   */
  finish(outcome: 'accepted' | 'declined' | 'failed'): Placement {
    const a = this.st.active;
    const def = a ? this.def(a.id) : undefined;
    if (!a || !def) return null;
    const s = this.h.state;
    this.st.active = null;
    let placement: Placement = null;
    if (outcome === 'accepted') {
      // Cada gato (o principal e os filhotes da ninhada) pela vaga: no café, provisório ou abrigo da vila.
      const place = (catId: string, condition: string): Placement => {
        const full = this.h.shelteredCount() >= this.capacity();
        const where: Placement = !full ? 'sheltered' : def.whenFull === 'adoption' ? 'shelter_pool' : 'provisional';
        if (where === 'shelter_pool') this.st.shelterPool.push(catId);
        else this.h.shelterCat(catId, condition, where === 'provisional' ? s.day + this.data.provisional.days : undefined, a.treated);
        return where;
      };
      placement = place(a.catId, a.condition);
      for (const kit of a.extraCats ?? []) place(kit, 'kitten');
      const r = def.result ?? {};
      if (r.startPoints) this.h.addPoints('player', a.catId, r.startPoints);
      if (r.npc) this.h.addPoints('player', r.npc.id, r.npc.points);
      if (r.money) this.h.addMoney(r.money, `arrival:${def.id}`);
      if (r.reputation) this.h.addReputation(r.reputation, `arrival:${def.id}`);
      // Quem deu a dica que ela ouviu ganha corações.
      const tip = a.tip !== undefined ? stepsOf(def).find((st): st is Extract<ArrivalStep, { ask: unknown }> => 'ask' in st)?.ask[a.tip] : undefined;
      if (tip?.points) this.h.addPoints('player', tip.npc, tip.points);
    } else for (const id of [a.catId, ...(a.extraCats ?? [])]) if (s.catDefs[id] && !s.cats[id]) delete s.catDefs[id];
    if (def.kind === 'random') this.st.nextOn = s.day + nextGap(this.data, s.day, this.rng());
    this.h.bus.emit('arrival.finished', { arrivalId: def.id, catId: a.catId, outcome, placement });
    this.tryStart();
    return placement;
  }

  /**
   * Virada do dia: provisório vira de casa quando abre vaga; o prazo vencido sem vaga leva o gato para o abrigo da
   * vila (entra na próxima feira de adoção).
   */
  dayEnded(newDay: number): void {
    const s = this.h.state;
    const provisional = Object.entries(s.cats).filter(([, c]) => c.sheltered && c.provisionalUntil !== undefined);
    for (const [id, cat] of provisional) {
      const permanent = Object.values(s.cats).filter((c) => c.sheltered && c.provisionalUntil === undefined).length;
      if (permanent < this.capacity()) {
        delete cat.provisionalUntil;
        this.h.bus.emit('arrival.provisional_settled', { catId: id });
      } else if (newDay > cat.provisionalUntil!) {
        cat.sheltered = false;
        delete cat.provisionalUntil;
        this.st.shelterPool.push(id);
        this.h.bus.emit('arrival.provisional_expired', { catId: id });
      }
    }
  }

  /** Debug e testes: põe uma chegada na fila agora (ignora o gatilho, respeita a vez). */
  queueNow(arrivalId: string): boolean {
    const def = this.def(arrivalId);
    if (!def || this.st.queue.includes(arrivalId) || this.st.active?.id === arrivalId) return false;
    this.st.queue.push(arrivalId);
    this.tryStart();
    return true;
  }

  /** Debug: gera um gato com personalidade e condição escolhidas e abriga (pela vaga, como uma chegada aceita). */
  debugGenerate(personality: string, condition: string): string {
    this.st.seq++;
    const gen = generateCat(this.rng(), this.h.content.catProfiles, { personality, condition }, this.st.seq);
    this.h.state.catDefs[gen.def.id] = gen.def;
    const full = this.h.shelteredCount() >= this.capacity();
    if (full) this.h.shelterCat(gen.def.id, condition, this.h.state.day + this.data.provisional.days);
    else this.h.shelterCat(gen.def.id, condition);
    return gen.def.id;
  }

  /** Debug: quais chegadas valem agora pelo gatilho (com o clima e o café cheio forçados). */
  triggerReport(): { id: string; holds: boolean }[] {
    const ctx = this.context();
    return this.data.arrivals.map((d) => ({ id: d.id, holds: triggerHolds(d.trigger, ctx) }));
  }

  /** O gatilho desta chegada vale agora? (debug) */
  triggerNow(arrivalId: string): boolean {
    const def = this.def(arrivalId);
    return !!def && triggerHolds(def.trigger, this.context());
  }
}
