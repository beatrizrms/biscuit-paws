// Avaliação do cliente ao sair (1 a 5 estrelas): começa em 5 e perde pela espera em pé (fila), pela espera sentado
// (até ser atendido) e pela sujeira do salão. Quem desiste (a paciência acaba) dá a nota de desistência. As estrelas
// viram reputação (data/service.json: review). Puro: sem Phaser, DOM ou window.

/** Faixa de desconto: passando de `over`, tira `minus` estrelas (vale a maior faixa alcançada). */
export interface ReviewBand {
  over: number;
  minus: number;
}

export interface ReviewConfig {
  /** De onde a nota começa (5). */
  start: number;
  /** Espera em pé (fila) e sentado: fração da paciência gasta (0 a 1). */
  queue: ReviewBand[];
  seated: ReviewBand[];
  /** Sujeira do salão: quantas sujeiras visíveis e louças sujas nas mesas. */
  dirt: ReviewBand[];
  /** Nota de quem desiste (a paciência acabou). */
  gaveUp: number;
  /** Reputação por nota ("1" a "5"). */
  reputation: Record<string, number>;
  /** A nota do café (HUD) é a média das últimas tantas avaliações. */
  averageOf: number;
}

/** O quanto da paciência ele já gastou (0 a 1). */
export interface Waits {
  queue: number;
  seated: number;
}

const minusOf = (bands: readonly ReviewBand[], value: number) => Math.max(0, ...bands.filter((b) => value > b.over).map((b) => b.minus));

/** Estrelas de 1 a 5 (inteiras). */
export function reviewStars(cfg: ReviewConfig, waits: Waits, dirt: number, gaveUp = false): number {
  if (gaveUp) return cfg.gaveUp;
  const stars = cfg.start - minusOf(cfg.queue, waits.queue) - minusOf(cfg.seated, waits.seated) - minusOf(cfg.dirt, dirt);
  return Math.max(1, Math.min(5, Math.round(stars)));
}

export function reviewReputation(cfg: ReviewConfig, stars: number): number {
  return cfg.reputation[String(stars)] ?? 0;
}

export function validateReview(cfg: ReviewConfig | undefined): string[] {
  if (!cfg) return ['service: falta review (avaliação dos clientes)'];
  const errors: string[] = [];
  const err = (m: string) => errors.push(`service: review: ${m}`);
  if (!(cfg.start >= 1 && cfg.start <= 5)) err('start precisa ser de 1 a 5');
  if (!(cfg.gaveUp >= 1 && cfg.gaveUp <= 5)) err('gaveUp precisa ser de 1 a 5');
  if (!(Number.isInteger(cfg.averageOf) && cfg.averageOf >= 1)) err('averageOf precisa ser um inteiro maior que 0');
  for (let s = 1; s <= 5; s++) if (typeof cfg.reputation[String(s)] !== 'number') err(`falta a reputação de ${s} estrela(s)`);
  for (const [name, bands] of [['queue', cfg.queue], ['seated', cfg.seated], ['dirt', cfg.dirt]] as const) {
    for (const b of bands) if (!(b.minus > 0)) err(`${name}: minus precisa ser maior que 0`);
  }
  return errors;
}
