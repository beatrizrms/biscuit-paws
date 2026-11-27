// O bem-estar dos gatos pesa no atendimento (decisão 310): gato feliz perto do cliente deixa a espera mais leve e a
// gorjeta maior; gato mal cuidado perto incomoda. Puro: sem Phaser, DOM ou window.

/** service.json: catBonus. */
export interface CatBonusConfig {
  /** Até quantas células (em qualquer direção) do lugar do cliente o gato conta; e no mesmo cômodo. */
  reach: number;
  /** Bem-estar a partir do qual o gato é "feliz" (conta a favor). */
  happyAt: number;
  /** Bem-estar abaixo do qual o gato é "mal cuidado" (conta contra). */
  sadBelow: number;
  /** Paciência a mais por gato feliz (0,15 = dura 15% mais) e o teto. */
  patiencePerCat: number;
  patienceMax: number;
  /** Paciência com algum gato mal cuidado perto (−0,1 = dura 10% menos; não soma por gato). */
  sadPatience: number;
  /** Gorjeta a mais por gato feliz (0,25 = +25%) e o teto. */
  tipPerCat: number;
  tipMax: number;
}

export interface CatWell {
  hearts: number;
  maxHearts: number;
  health: number;
  maxHealth: number;
  happiness: number;
  hygiene: number;
  careMax: number;
}

/** 0 a 100: metade dos corações, metade da média das barras (saúde, alegria e higiene). */
export function catWellbeing(c: CatWell): number {
  const hearts = c.maxHearts > 0 ? Math.min(1, c.hearts / c.maxHearts) : 0;
  const bars = ((c.maxHealth > 0 ? c.health / c.maxHealth : 0) + (c.careMax > 0 ? c.happiness / c.careMax : 0) + (c.careMax > 0 ? c.hygiene / c.careMax : 0)) / 3;
  return Math.round(50 * hearts + 50 * Math.max(0, Math.min(1, bars)));
}

/**
 * O efeito dos gatos perto de um cliente: `patience` muda quanto a espera dura (0,3 = 30% mais; −0,1 = 10% menos) e
 * `tip` multiplica a gorjeta (0,5 = +50%). Felizes somam até o teto; um mal cuidado perto tira paciência (só se nenhum
 * feliz compensar: o feliz ganha).
 */
export function catEffect(wellbeings: readonly number[], cfg: CatBonusConfig): { patience: number; tip: number; happy: number; sad: number } {
  const happy = wellbeings.filter((w) => w >= cfg.happyAt).length;
  const sad = wellbeings.filter((w) => w < cfg.sadBelow).length;
  if (happy > 0) return { patience: Math.min(cfg.patienceMax, happy * cfg.patiencePerCat), tip: Math.min(cfg.tipMax, happy * cfg.tipPerCat), happy, sad };
  if (sad > 0) return { patience: cfg.sadPatience, tip: 0, happy, sad };
  return { patience: 0, tip: 0, happy, sad };
}

/**
 * Quanto o fim da paciência anda num intervalo, com o efeito: dura (1 + patience) vezes o normal, então a cada
 * `passed` minutos o prazo se move `passed × (1 − 1 / (1 + patience))` (para frente com bônus, para trás com castigo).
 */
export function patienceShift(passed: number, patience: number): number {
  if (passed <= 0 || patience === 0) return 0;
  return passed * (1 - 1 / (1 + patience));
}
