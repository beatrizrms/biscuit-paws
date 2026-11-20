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
  /** Estrelas a menos de quem recebeu outra coisa (pedido errado). */
  wrongOrder?: number;
  /** Estrelas a mais de quem recebeu o pedido premium (0,5: meia estrela), até 5. */
  premium?: number;
  /** Reputação do atendimento, uma vez por dia pela nota média do dia: a primeira faixa com atLeast <= média. */
  daily: { atLeast: number; reputation: number }[];
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
export function reviewStars(cfg: ReviewConfig, waits: Waits, dirt: number, gaveUp = false, wrongOrder = false, premium = false): number {
  if (gaveUp) return cfg.gaveUp;
  const stars = cfg.start - minusOf(cfg.queue, waits.queue) - minusOf(cfg.seated, waits.seated) - minusOf(cfg.dirt, dirt) - (wrongOrder ? (cfg.wrongOrder ?? 0) : 0);
  // Premium: meia estrela a mais (review.premium) sobre a nota inteira, sem passar de 5.
  return Math.min(5, Math.max(1, Math.min(5, Math.round(stars))) + (premium ? cfg.premium ?? 0 : 0));
}

/** Reputação do dia pela média das avaliações do dia (sem avaliação: 0). */
export function dailyReputation(cfg: ReviewConfig, stars: readonly number[]): number {
  if (stars.length === 0) return 0;
  const avg = stars.reduce((a, b) => a + b, 0) / stars.length;
  return [...cfg.daily].sort((a, b) => b.atLeast - a.atLeast).find((b) => avg >= b.atLeast)?.reputation ?? 0;
}

export function validateReview(cfg: ReviewConfig | undefined): string[] {
  if (!cfg) return ['service: falta review (avaliação dos clientes)'];
  const errors: string[] = [];
  const err = (m: string) => errors.push(`service: review: ${m}`);
  if (!(cfg.start >= 1 && cfg.start <= 5)) err('start precisa ser de 1 a 5');
  if (!(cfg.gaveUp >= 1 && cfg.gaveUp <= 5)) err('gaveUp precisa ser de 1 a 5');
  if (!(Number.isInteger(cfg.averageOf) && cfg.averageOf >= 1)) err('averageOf precisa ser um inteiro maior que 0');
  if (cfg.premium !== undefined && !(cfg.premium >= 0 && cfg.premium <= 1 && Number.isInteger(cfg.premium * 2))) err('premium precisa ser 0, 0,5 ou 1');
  if (!Array.isArray(cfg.daily) || cfg.daily.length === 0) err('falta daily (reputação do dia pela média)');
  else if (!cfg.daily.some((b) => b.atLeast <= 1)) err('daily precisa de uma faixa que cubra a média mínima (atLeast <= 1)');
  for (const [name, bands] of [['queue', cfg.queue], ['seated', cfg.seated], ['dirt', cfg.dirt]] as const) {
    for (const b of bands) if (!(b.minus > 0)) err(`${name}: minus precisa ser maior que 0`);
  }
  return errors;
}
