// Respirar parado (guia de estilo, seção 7): ninguém fica congelado. Quem está em pé e sem animação tocando sobe o
// corpo 1 pixel do jogo e volta, num ciclo lento, cada um no seu tempo. Só visual: não mexe em regra do jogo.

/** Duração de um ciclo (inspira e expira), em ms. */
const BREATH_MS = 2800;
/** Parte do ciclo com o peito cheio. */
const HOLD = 0.4;

/** Uma fase sorteada para cada um: duas pessoas lado a lado não respiram juntas. Sorteio só visual. */
export const breathPhase = (): number => Math.random();

/** O fator da altura agora: 1 (solto) ou 1 + 1 pixel do jogo (peito cheio), para um desenho de `height` pixels do jogo. */
export function breathScale(time: number, phase: number, height: number): number {
  const t = (time / BREATH_MS + phase) % 1;
  return t < HOLD ? 1 + 1 / height : 1;
}
