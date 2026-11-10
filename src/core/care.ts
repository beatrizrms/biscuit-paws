// Cuidados dos gatos do café: felicidade e higiene (0 a max), além da saúde (health.ts).
// Puro: sem Phaser, DOM ou window. Números em data/health.json: care.
import type { CatState } from './state';

export type CareStat = 'happiness' | 'hygiene';

export interface CareConfig {
  max: number;
  /** Valor de um gato novo (e de quem veio de um save antigo, v19 ou antes). */
  start: Record<CareStat, number>;
  /** Quanto cai a cada fim de dia (felicidade: 0; quem manda nela é o pedido de brincar, em `play`). */
  daily: Record<CareStat, number>;
  /** Abaixo disto, o balão em cima do gato avisa (por enquanto, a única consequência). */
  low: Record<CareStat, number>;
  /** Fim de um dia sem areia limpa (nenhuma caixa trocada nem automática com areia): a higiene cai mais isto. */
  litterMissed: number;
  /**
   * Areia suja por `afterDays` dias seguidos: no fim do dia, cada gato do café deixa `perCat` cocô no chão (lugar livre
   * sorteado), até `maxOnFloor` no chão. Os cocôs são as sujeiras do mapa com `tag` (escondidas até a `flag` valer).
   */
  litterPoop?: { afterDays: number; perCat: number; maxOnFloor: number; tag: string; flag: string };
  /** O balão de cada necessidade, na arte do jogo: ícone (dentro do balão de pedido), o ícone de um item ou emote (balão pronto). */
  bubbles: Record<CareNeed, { icon?: string; item?: string; emote?: string }>;
  /**
   * Pedido de brincar: com brinquedo suficiente (1 a cada `catsPerToy` gatos do café, itens posicionados com `toyTag`),
   * o gato pede a cada `everyDays` dias, +1 dia por brinquedo além do mínimo e por outro gato, até `maxDays`; ignorar
   * o pedido só deixa o balão. Sem brinquedo suficiente, pede todo dia, e cada dia sem brincar tira `missedHappiness`.
   */
  play: { everyDays: number; maxDays: number; catsPerToy: number; toyTag: string; missedHappiness: number };
  /** Ganho de cada mini game de cuidado, por resultado (ok, great). */
  gains: Record<string, Partial<Record<CareStat, { ok: number; great: number }>>>;
}

/** O que o gato está precisando agora (o balão mostra o primeiro). */
export type CareNeed = 'medicine' | 'dirty' | 'sad' | 'play';

const clamp = (cfg: CareConfig, v: number) => Math.max(0, Math.min(cfg.max, Math.round(v)));

/** Felicidade e higiene do gato (quem não tem o campo ainda fica com o valor inicial). */
export function careOf(cat: CatState, cfg: CareConfig): Record<CareStat, number> {
  return { happiness: cat.happiness ?? cfg.start.happiness, hygiene: cat.hygiene ?? cfg.start.hygiene };
}

export function addCare(cat: CatState, stat: CareStat, delta: number, cfg: CareConfig): void {
  cat[stat] = clamp(cfg, careOf(cat, cfg)[stat] + delta);
}

/** O café para o pedido de brincar: brinquedos posicionados e gatos que moram lá. */
export interface PlayRoom {
  toys: number;
  cats: number;
}

/** Brinquedos que faltam para o mínimo (1 a cada catsPerToy gatos; sem gato, nenhum). */
export function toysMissing(cfg: CareConfig, room: PlayRoom): number {
  return Math.max(0, Math.ceil(room.cats / cfg.play.catsPerToy) - room.toys);
}

/** De quantos em quantos dias o gato pede para brincar: 1 sem brinquedo suficiente; senão everyDays + extras, até maxDays. */
export function playInterval(cfg: CareConfig, room: PlayRoom): number {
  if (room.toys === 0 || toysMissing(cfg, room) > 0) return 1;
  const extraToys = room.toys - Math.ceil(room.cats / cfg.play.catsPerToy);
  const otherCats = Math.max(0, room.cats - 1);
  return Math.min(cfg.play.maxDays, cfg.play.everyDays + extraToys + otherCats);
}

/** Está pedindo para brincar: já faz `interval` dias que ninguém brincou com ele (desde que chegou, se nunca). */
export function wantsPlay(cat: CatState, day: number, interval: number): boolean {
  return day - (cat.playedOn ?? cat.shelteredOn) >= interval;
}

/**
 * Fim do dia: a higiene cai um pouco; a felicidade só cai sem brinquedo suficiente, se ele pediu e ninguém brincou
 * hoje (com brinquedo, ele se distrai sozinho e o pedido fica só no balão).
 */
export function careAtDayEnd(cat: CatState, cfg: CareConfig, day: number, room: PlayRoom): void {
  addCare(cat, 'happiness', -cfg.daily.happiness, cfg);
  addCare(cat, 'hygiene', -cfg.daily.hygiene, cfg);
  const interval = playInterval(cfg, room);
  if (interval === 1 && cat.playedOn !== day && wantsPlay(cat, day, interval)) addCare(cat, 'happiness', -cfg.play.missedHappiness, cfg);
}

/**
 * Precisa de remédio: doente, com receita, e a dose de hoje ainda não foi. Não é um campo à parte no save
 * (seria uma segunda verdade ao lado de sickness.treatment).
 */
export function needsMedicine(cat: CatState, day: number): boolean {
  const t = cat.sickness?.treatment;
  return !!t && t.lastDoseDay !== day;
}

/** O que falta, na ordem de urgência: remédio, banho, carinho, brincar (o pedido, ainda sem tristeza). */
export function careNeeds(cat: CatState, day: number, cfg: CareConfig, room: PlayRoom): CareNeed[] {
  const c = careOf(cat, cfg);
  const out: CareNeed[] = [];
  if (needsMedicine(cat, day)) out.push('medicine');
  if (c.hygiene < cfg.low.hygiene) out.push('dirty');
  if (c.happiness < cfg.low.happiness) out.push('sad');
  else if (wantsPlay(cat, day, playInterval(cfg, room))) out.push('play');
  return out;
}

/** Ganho de um mini game de cuidado para o gato (nada se não deu certo ou o jogo não cuida). */
export function careGain(cfg: CareConfig, gameId: string, outcome: 'fail' | 'ok' | 'great'): Partial<Record<CareStat, number>> {
  const g = cfg.gains[gameId];
  if (!g || outcome === 'fail') return {};
  const out: Partial<Record<CareStat, number>> = {};
  for (const stat of ['happiness', 'hygiene'] as const) {
    const v = g[stat];
    if (v) out[stat] = v[outcome];
  }
  return out;
}

export function validateCare(cfg: CareConfig): string[] {
  const errors: string[] = [];
  for (const stat of ['happiness', 'hygiene'] as const) {
    for (const k of ['start', 'daily', 'low'] as const) {
      const v = cfg[k][stat];
      if (!(v >= 0 && v <= cfg.max)) errors.push(`health.care.${k}.${stat} precisa estar entre 0 e ${cfg.max}`);
    }
  }
  const lp = cfg.litterPoop;
  if (lp && !(Number.isInteger(lp.afterDays) && lp.afterDays >= 1 && lp.perCat >= 1 && lp.maxOnFloor >= 1)) errors.push('health.care.litterPoop: afterDays, perCat e maxOnFloor precisam ser 1 ou mais');
  const p = cfg.play;
  if (!(p && Number.isInteger(p.everyDays) && p.everyDays >= 1 && Number.isInteger(p.maxDays) && p.maxDays >= p.everyDays)) errors.push('health.care.play: everyDays >= 1 e maxDays >= everyDays (inteiros)');
  if (p && !(Number.isInteger(p.catsPerToy) && p.catsPerToy >= 1)) errors.push('health.care.play.catsPerToy precisa ser inteiro >= 1');
  if (p && !(p.missedHappiness >= 0 && p.missedHappiness <= cfg.max)) errors.push(`health.care.play.missedHappiness precisa estar entre 0 e ${cfg.max}`);
  return errors;
}
