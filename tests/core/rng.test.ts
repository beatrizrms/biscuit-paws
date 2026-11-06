import { describe, expect, it } from 'vitest';
import { cellHash, createRng } from '../../src/core/rng';

describe('createRng', () => {
  it('a mesma semente gera a mesma sequência', () => {
    const a = createRng(42);
    const b = createRng(42);
    const seqA = Array.from({ length: 5 }, () => a.next());
    expect(Array.from({ length: 5 }, () => b.next())).toEqual(seqA);
    expect(createRng(43).next()).not.toBe(seqA[0]);
  });

  it('int fica dentro do intervalo e usa os dois extremos', () => {
    const rng = createRng(1);
    const values = new Set(Array.from({ length: 500 }, () => rng.int(2, 5)));
    expect([...values].sort()).toEqual([2, 3, 4, 5]);
  });
});

describe('cellHash', () => {
  it('é estável e espalha as variações', () => {
    expect(cellHash(3, 7)).toBe(cellHash(3, 7));
    const counts = [0, 0, 0, 0];
    for (let r = 0; r < 11; r++) for (let c = 0; c < 16; c++) counts[cellHash(c, r) % 4]!++;
    expect(Math.min(...counts)).toBeGreaterThan(20); // 176 células: nenhuma variação some
  });
});
