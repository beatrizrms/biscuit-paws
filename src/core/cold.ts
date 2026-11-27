// Frio no inverno (decisão 310, jeito A): o gato de rua aceito no inverno entra gelado e se esquenta sozinho no café,
// desde que haja um cantinho quente (caminha ou almofada). Enquanto está com frio, a alegria cai um pouco por dia.
// O café em si não esfria. Puro: sem Phaser, DOM ou window.

/** cat_profiles.json: cold. */
export interface ColdConfig {
  /** Minutos de jogo no café, com cantinho quente, para o gato deixar de sentir frio. */
  warmMinutes: number;
  /** Tag dos móveis que contam como cantinho quente. */
  warmTag: string;
  /** Quanto a alegria cai em cada fim de dia com frio. */
  happinessPerDay: number;
  /** Estações em que o gato de rua chega com frio (além da condição "cold", que vale o ano todo). */
  seasons: string[];
}

/** Chega com frio? A condição "cold" sempre; os outros, nas estações frias. Antes do fim do prólogo, nunca. */
export function startsCold(condition: string | undefined, season: string, prologueDone: boolean, cfg: ColdConfig): boolean {
  if (!prologueDone) return false;
  return condition === 'cold' || cfg.seasons.includes(season);
}

/**
 * Um passo de `minutes` minutos para um gato com frio (`warmed`: quanto já se esquentou). Sem cantinho quente, nada
 * muda. Devolve o novo total e se acabou de esquentar.
 */
export function warmStep(warmed: number, minutes: number, hasWarmSpot: boolean, cfg: ColdConfig): { warmed: number; done: boolean } {
  if (!hasWarmSpot || minutes <= 0) return { warmed, done: false };
  const next = warmed + minutes;
  return { warmed: Math.min(next, cfg.warmMinutes), done: next >= cfg.warmMinutes };
}
