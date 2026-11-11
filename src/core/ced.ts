// CED (captura, esterilização e devolução): a Fernanda chama para a campanha, a vaquinha pelo CatPay arrecada os
// materiais e, com a meta batida, ela compra do fornecedor e a protagonista liga para a Gabi (data/ced.json; falas e
// cenas em data/ced_text.json). Etapa A: a vaquinha. As regiões, a campanha e o gato escolhido vêm depois.
// Puro: sem Phaser, DOM ou window. A sessão (session.ts) só delega para cá.
import type { Condition } from './content';
import type { CutsceneDef } from './cutscene';
import { createRng, cellHash } from './rng';
import { donate, donationAmount, kitPrice, kitsAffordable, newCrowdfund, remaining, remoteChance, spend, stalled, topUpRoom, type Crowdfund, type PurposeItem } from './crowdfund';
import type { EventBus } from './events';
import type { GameState } from './state';
import { parseClock } from './time';

export interface CedConfig {
  schemaVersion: 1;
  intro: { when: Condition };
  vaquinha: { cats: number; kit: PurposeItem[]; deadlineDays: number | null };
  counter: { signItem: string; chanceWithSign: number; chanceWithoutSign: number; amount: [number, number]; perHeart: number };
  remote: { donors: string[]; base: number; ratingMin: number; heartWeight: number; reach: number; maxChance: number; hours: [string, string] };
  antiStall: { afterDays: number; windowDays: number; minPerDay: number; npc: string; boostShare: number; minBoost: number };
  topUp: { maxShare: number };
}

/** Onde a CED está: desligada, arrecadando, meta batida (falta a ligação do fornecedor), pronta para a campanha. */
export type CedStage = 'off' | 'collecting' | 'funded' | 'ready';

export interface CedState {
  stage: CedStage;
  /** A vaquinha em andamento (ou a que acabou de bater a meta, até a compra); null = nenhuma vaquinha ativa. */
  crowdfund: Crowdfund | null;
  /** Vaquinhas encerradas (o extrato continua no app: prestação de contas). */
  history: Crowdfund[];
  /** Quem doou e em que dia (uma doação por pessoa por dia, no balcão ou pelo app). */
  donatedOn: Record<string, number>;
  /** Doações pelo app marcadas para hoje (minuto do dia). */
  scheduled: { at: number; donor: string; amount: number }[];
  /** Gatos que a campanha vai conseguir pegar (os kits comprados). */
  campaignCats: number;
  /** Cena da CED esperando a vez (a cena só começa com ela livre). */
  pendingScene: string | null;
}

export function newCed(): CedState {
  return { stage: 'off', crowdfund: null, history: [], donatedOn: {}, scheduled: [], campaignCats: 0, pendingScene: null };
}

export const CED_SCENES = { intro: 'cs.ced_intro', supplier: 'cs.ced_supplier', callGabi: 'cs.ced_call_gabi' } as const;

export interface CedHost {
  state: GameState;
  bus: EventBus;
  ced: CedConfig;
  /** Condição da história (data). */
  holds(c: Condition): boolean;
  /** Dá para começar uma cena agora (ela livre, sem evento exclusivo da história)? */
  sceneFree(): boolean;
  /** Nota do café (0 a 5) ou null. */
  rating(): number | null;
  /** Corações dela com alguém. */
  hearts(npc: string): number;
  addMoney(delta: number, reason: string): void;
  /** Nome de quem doou (NPC). */
  npcName(npc: string): string;
}

export class CedFlow {
  constructor(private h: CedHost) {}

  private get st(): CedState {
    return this.h.state.ced;
  }

  private rng(salt: number) {
    return createRng(cellHash(this.h.state.day, salt) ^ (this.st.history.length * 7919));
  }

  /** A vaquinha ativa (ou null: "nenhuma vaquinha ativa"). */
  active(): Crowdfund | null {
    return this.st.crowdfund?.status === 'active' ? this.st.crowdfund : null;
  }

  /** O app CatPay já apareceu (a Fernanda chamou para a CED)? */
  appVisible(): boolean {
    return this.st.stage !== 'off';
  }

  // ---------- O tempo ----------

  /** A cada minuto: a chamada da Fernanda, as doações do app marcadas para agora e as cenas esperando a vez. */
  tick(): void {
    const s = this.h.state;
    if (this.st.stage === 'off' && this.h.holds(this.h.ced.intro.when) && this.h.sceneFree()) this.start();
    // Doações pelo app que já chegaram na hora (notificação, sem pausar o jogo).
    const due = this.st.scheduled.filter((d) => d.at <= s.time);
    if (due.length > 0) {
      this.st.scheduled = this.st.scheduled.filter((d) => d.at > s.time);
      for (const d of due) this.receive(d.donor, d.amount, 'remote');
    }
    if (this.st.pendingScene && this.h.sceneFree()) {
      const id = this.st.pendingScene;
      this.st.pendingScene = null;
      this.h.bus.emit('cutscene.requested', { cutsceneId: id });
    }
  }

  /** A Fernanda chama: a vaquinha começa (meta = gatos x kit) e ela manda a plaquinha do CatPay. */
  start(): void {
    const s = this.h.state;
    const v = this.h.ced.vaquinha;
    const n = this.st.history.length + 1;
    const deadline = v.deadlineDays === null ? null : s.day + v.deadlineDays;
    this.st.crowdfund = newCrowdfund(`vaquinha.ced.${n}`, `ced.${n}`, v.cats * kitPrice(v.kit), v.kit, s.day, deadline);
    this.st.stage = 'collecting';
    s.flags['ced.intro'] = true;
    const sign = this.h.ced.counter.signItem;
    s.inventory[sign] = (s.inventory[sign] ?? 0) + 1;
    this.scheduleRemote();
    this.h.bus.emit('ced.started', { crowdfundId: this.st.crowdfund.id, target: this.st.crowdfund.target });
    this.h.bus.emit('cutscene.requested', { cutsceneId: CED_SCENES.intro });
  }

  /** Manhã: sorteia quem vai doar pelo app hoje, e a que horas. */
  morning(): void {
    this.st.scheduled = [];
    this.scheduleRemote();
  }

  private scheduleRemote(): void {
    if (!this.active()) return;
    const r = this.h.ced.remote;
    const [from, to] = [parseClock(r.hours[0]), parseClock(r.hours[1])];
    const day = this.h.state.day;
    const rating = this.h.rating();
    r.donors.forEach((donor, i) => {
      if (this.st.donatedOn[donor] === day) return;
      const rng = this.rng(101 + i);
      const hearts = this.h.hearts(donor);
      if (!rng.chance(remoteChance(r, rating, hearts))) return;
      const amount = donationAmount(rng, this.h.ced.counter.amount, this.h.ced.counter.perHeart, hearts);
      // Antes da hora atual (começou a vaquinha no meio do dia): chega daqui a pouco.
      this.st.scheduled.push({ at: Math.max(this.h.state.time + 5 + i, rng.int(from, to)), donor, amount });
    });
  }

  /** Fim do dia: vaquinha parada demais, um vizinho dá uma força (a jogadora nunca fica presa). */
  dayEnded(day: number): void {
    const c = this.active();
    const a = this.h.ced.antiStall;
    if (!c || !stalled(c, day, a)) return;
    const amount = Math.max(a.minBoost, Math.round(remaining(c) * a.boostShare));
    this.receive(a.npc, Math.min(amount, remaining(c)), 'boost', true);
  }

  // ---------- Doações ----------

  /** Um cliente pagou no balcão: com a plaquinha, chance boa de doar pelo CatPay; sem ela, bem pequena. */
  customerPaid(npc: string, customerId: string): void {
    if (!this.active() || this.st.donatedOn[npc] === this.h.state.day) return;
    const cfg = this.h.ced.counter;
    const sign = this.h.state.placed.some((p) => p.item === cfg.signItem);
    const rng = this.rng(cellHash(customerId.length, Number(customerId.replace(/\D/g, '')) || 1));
    if (!rng.chance(sign ? cfg.chanceWithSign : cfg.chanceWithoutSign)) return;
    this.receive(npc, donationAmount(rng, cfg.amount, cfg.perHeart, this.h.hearts(npc)), 'counter', false, customerId);
  }

  /** Recebe uma doação (uma por pessoa por dia; a ajuda do vizinho não conta para isso). */
  receive(donor: string, amount: number, source: 'counter' | 'remote' | 'boost' | 'player', force = false, customerId?: string): boolean {
    const c = this.active();
    const day = this.h.state.day;
    if (!c || (!force && source !== 'player' && this.st.donatedOn[donor] === day)) return false;
    if (!donate(c, { donor, amount, day, source })) return false;
    if (source !== 'player' && source !== 'boost') this.st.donatedOn[donor] = day;
    this.h.bus.emit('crowdfund.donated', { donor, donorName: this.h.npcName(donor), amount: Math.round(amount), source, raised: c.raised, target: c.target, ...(customerId ? { customerId } : {}) });
    if (c.status === 'done') this.funded();
    return true;
  }

  /** Ela completa com o próprio caixa (até o teto por vaquinha). */
  topUp(amount: number): { ok: true; amount: number } | { ok: false; reason: 'no_crowdfund' | 'no_money' | 'top_up_limit' } {
    const c = this.active();
    if (!c) return { ok: false, reason: 'no_crowdfund' };
    const room = topUpRoom(c, this.h.ced.topUp.maxShare);
    const value = Math.min(Math.round(amount), room);
    if (value <= 0) return { ok: false, reason: 'top_up_limit' };
    if (this.h.state.money < value) return { ok: false, reason: 'no_money' };
    this.h.addMoney(-value, 'ced:top_up');
    c.toppedUp += value;
    this.receive('player', value, 'player');
    return { ok: true, amount: value };
  }

  /** Quanto ela ainda pode completar do caixa. */
  topUpRoom(): number {
    const c = this.active();
    return c ? topUpRoom(c, this.h.ced.topUp.maxShare) : 0;
  }

  // ---------- Meta batida: fornecedor e a ligação para a Gabi ----------

  private funded(): void {
    const c = this.st.crowdfund!;
    this.st.stage = 'funded';
    this.st.scheduled = [];
    // Os gatos que a campanha vai conseguir pegar: os kits que o saldo compra (no mínimo a meta da vaquinha).
    this.st.campaignCats = Math.max(1, kitsAffordable(c));
    this.h.bus.emit('crowdfund.completed', { crowdfundId: c.id, raised: c.raised, target: c.target });
    this.queueScene(CED_SCENES.supplier);
  }

  /** Uma cena da CED terminou: o fornecedor pago (compra dos kits, no extrato) e, depois, a ligação para a Gabi. */
  sceneFinished(cutsceneId: string): void {
    if (cutsceneId === CED_SCENES.supplier && this.st.stage === 'funded') {
      const c = this.st.crowdfund!;
      const usedFor = `campanha ${this.st.history.length + 1} (${this.st.campaignCats} gatos)`;
      for (const item of c.items) spend(c, item.id, this.st.campaignCats, this.h.state.day, usedFor);
      this.h.bus.emit('crowdfund.spent', { crowdfundId: c.id, cats: this.st.campaignCats, balance: c.balance });
      this.queueScene(CED_SCENES.callGabi);
    } else if (cutsceneId === CED_SCENES.callGabi && this.st.stage === 'funded') {
      this.st.stage = 'ready';
      this.st.history.push(this.st.crowdfund!);
      this.st.crowdfund = null;
      this.h.state.flags['ced.campaign_ready'] = true;
      // Gancho da etapa C: a campanha está liberada.
      this.h.bus.emit('ced.ready', { cats: this.st.campaignCats });
    }
  }

  private queueScene(id: string): void {
    if (this.h.sceneFree()) this.h.bus.emit('cutscene.requested', { cutsceneId: id });
    else this.st.pendingScene = id;
  }

  // ---------- Debug ----------

  /** Debug: começa a vaquinha agora (sem esperar a condição; a cena da Fernanda toca). */
  debugStart(): void {
    if (this.st.stage === 'off') this.start();
  }

  /** Debug: completa a vaquinha (uma doação de um vizinho com o que falta). */
  debugComplete(): void {
    const c = this.active();
    if (c) this.receive(this.h.ced.antiStall.npc, remaining(c), 'boost', true);
  }

  /** Debug: uma doação no balcão (cliente sorteado) ou pelo app (morador sorteado), ignorando a chance. */
  debugDonate(source: 'counter' | 'remote'): void {
    const c = this.active();
    if (!c) return;
    const donors = this.h.ced.remote.donors;
    const free = donors.filter((d) => this.st.donatedOn[d] !== this.h.state.day);
    const donor = free[this.rng(997 + c.donations.length).int(0, Math.max(0, free.length - 1))] ?? donors[0]!;
    this.receive(donor, donationAmount(this.rng(991), this.h.ced.counter.amount, this.h.ced.counter.perHeart, this.h.hearts(donor)), source, true);
  }

  /** Debug: a ajuda do vizinho (anti-travamento) agora. */
  debugStallBoost(): void {
    const c = this.active();
    const a = this.h.ced.antiStall;
    if (c) this.receive(a.npc, Math.min(Math.max(a.minBoost, Math.round(remaining(c) * a.boostShare)), remaining(c)), 'boost', true);
  }
}

/** Falas da CED (avisos) e as cenas dela (mesmo formato de data/cutscenes.json). */
export interface CedText {
  schemaVersion: 1;
  lines: Record<string, string>;
  cutscenes: Record<string, CutsceneDef>;
}

/** As falas e cenas que o jogo chama precisam existir. */
export function validateCedText(t: CedText): string[] {
  const errors: string[] = [];
  for (const k of ['donationRemote', 'donationCounter', 'stallBoost', 'goal', 'topUp']) if (typeof t.lines?.[k] !== 'string') errors.push(`ced_text: falta lines.${k}`);
  for (const id of Object.values(CED_SCENES)) if (!t.cutscenes?.[id]) errors.push(`ced_text: falta a cena "${id}"`);
  return errors;
}

export function validateCed(cfg: CedConfig, refs: { items: ReadonlySet<string>; npcs: ReadonlySet<string> }): string[] {
  const errors: string[] = [];
  const err = (m: string) => errors.push(`ced: ${m}`);
  const p = (v: number) => v >= 0 && v <= 1;
  if (!(Number.isInteger(cfg.vaquinha.cats) && cfg.vaquinha.cats >= 1)) err('vaquinha.cats precisa ser 1 ou mais');
  if (cfg.vaquinha.kit.length === 0) err('vaquinha.kit vazio');
  for (const k of cfg.vaquinha.kit) if (!k.id.startsWith('mat.') || !(k.price > 0)) err(`kit "${k.id}": id mat.* e preço maior que 0`);
  if (!refs.items.has(cfg.counter.signItem)) err(`counter.signItem inexistente "${cfg.counter.signItem}"`);
  if (!p(cfg.counter.chanceWithSign) || !p(cfg.counter.chanceWithoutSign)) err('counter: chances entre 0 e 1');
  if (cfg.counter.amount[0] < 1 || cfg.counter.amount[1] < cfg.counter.amount[0]) err('counter.amount precisa de [mín, máx] com mín >= 1');
  for (const d of cfg.remote.donors) if (!refs.npcs.has(d)) err(`remote.donors: NPC inexistente "${d}"`);
  if (!p(cfg.remote.maxChance) || !p(cfg.remote.ratingMin)) err('remote: maxChance e ratingMin entre 0 e 1');
  if (!refs.npcs.has(cfg.antiStall.npc)) err(`antiStall.npc inexistente "${cfg.antiStall.npc}"`);
  if (!p(cfg.antiStall.boostShare)) err('antiStall.boostShare entre 0 e 1');
  if (!p(cfg.topUp.maxShare)) err('topUp.maxShare entre 0 e 1');
  return errors;
}
