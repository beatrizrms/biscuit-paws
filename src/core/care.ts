// Cuidados dos gatos do café: felicidade e higiene (0 a max), além da saúde (health.ts).
// Puro: sem Phaser, DOM ou window. Números em data/health.json: care.
import type { CatState } from './state';

export type CareStat = 'happiness' | 'hygiene';

export interface CareConfig {
  max: number;
  /** Valor de um gato novo (e de quem veio de um save antigo, v19 ou antes). */
  start: Record<CareStat, number>;
  /** Quanto cai a cada fim de dia. */
  daily: Record<CareStat, number>;
  /** Abaixo disto, o balão em cima do gato avisa (por enquanto, a única consequência). */
  low: Record<CareStat, number>;
  /** O balão de cada necessidade, na arte do jogo: ícone (dentro do balão de pedido) ou emote (balão pronto). */
  bubbles: Record<CareNeed, { icon?: string; emote?: string }>;
  /** Ganho de cada mini game de cuidado, por resultado (ok, great). */
  gains: Record<string, Partial<Record<CareStat, { ok: number; great: number }>>>;
}

/** O que o gato está precisando agora (o balão mostra o primeiro). */
export type CareNeed = 'medicine' | 'dirty' | 'sad';

const clamp = (cfg: CareConfig, v: number) => Math.max(0, Math.min(cfg.max, Math.round(v)));

/** Felicidade e higiene do gato (quem não tem o campo ainda fica com o valor inicial). */
export function careOf(cat: CatState, cfg: CareConfig): Record<CareStat, number> {
  return { happiness: cat.happiness ?? cfg.start.happiness, hygiene: cat.hygiene ?? cfg.start.hygiene };
}

export function addCare(cat: CatState, stat: CareStat, delta: number, cfg: CareConfig): void {
  cat[stat] = clamp(cfg, careOf(cat, cfg)[stat] + delta);
}

/** Fim do dia: felicidade e higiene caem um pouco (cuidar todo dia segura os dois em cima). */
export function careAtDayEnd(cat: CatState, cfg: CareConfig): void {
  addCare(cat, 'happiness', -cfg.daily.happiness, cfg);
  addCare(cat, 'hygiene', -cfg.daily.hygiene, cfg);
}

/**
 * Precisa de remédio: doente, com receita, e a dose de hoje ainda não foi. Não é um campo à parte no save
 * (seria uma segunda verdade ao lado de sickness.treatment).
 */
export function needsMedicine(cat: CatState, day: number): boolean {
  const t = cat.sickness?.treatment;
  return !!t && t.lastDoseDay !== day;
}

/** O que falta, na ordem de urgência: remédio, banho, carinho. */
export function careNeeds(cat: CatState, day: number, cfg: CareConfig): CareNeed[] {
  const c = careOf(cat, cfg);
  const out: CareNeed[] = [];
  if (needsMedicine(cat, day)) out.push('medicine');
  if (c.hygiene < cfg.low.hygiene) out.push('dirty');
  if (c.happiness < cfg.low.happiness) out.push('sad');
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
  return errors;
}
