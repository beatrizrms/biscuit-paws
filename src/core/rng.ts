// Aleatoriedade com semente: a mesma semente sempre gera a mesma sequência.
// Puro: sem Phaser, DOM ou window. Nada de Math.random() no core.

export interface Rng {
  /** Número em [0, 1). */
  next(): number;
  /** Inteiro em [min, max]. */
  int(min: number, max: number): number;
  /** Verdadeiro com probabilidade p. */
  chance(p: number): boolean;
}

/** Gerador mulberry32: pequeno, rápido e bom o bastante para jogo. */
export function createRng(seed: number): Rng {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    int: (min, max) => min + Math.floor(next() * (max - min + 1)),
    chance: (p) => next() < p,
  };
}

/** Hash estável de uma célula, para escolher variações de tile sem guardar nada. */
export function cellHash(col: number, row: number): number {
  let h = Math.imul(col, 73856093) ^ Math.imul(row, 19349663);
  h = Math.imul(h ^ (h >>> 13), 0x5bd1e995);
  return (h ^ (h >>> 15)) >>> 0;
}
