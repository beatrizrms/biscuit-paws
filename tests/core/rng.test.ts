import { describe, expect, it } from 'vitest';
import { nextCatGoal } from '../../src/core/cats';
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

describe('nextCatGoal', () => {
  const open = Array.from({ length: 6 }, () => Array.from({ length: 8 }, () => false));

  it('é repetível com a mesma semente e só anda para célula livre', () => {
    const a = Array.from({ length: 20 }, (_, i) => nextCatGoal(createRng(7 + i), [4, 3], open));
    const b = Array.from({ length: 20 }, (_, i) => nextCatGoal(createRng(7 + i), [4, 3], open));
    expect(a).toEqual(b);
    const kinds = new Set(a.map((g) => g.kind));
    expect(kinds).toContain('walk');
    for (const g of a) if (g.kind === 'walk') expect(open[g.to[1]]![g.to[0]]).toBe(false);
  });

  it('cercado por paredes, senta', () => {
    const walls = Array.from({ length: 6 }, () => Array.from({ length: 8 }, () => true));
    walls[3]![4] = false;
    for (let i = 0; i < 20; i++) expect(nextCatGoal(createRng(i), [4, 3], walls).kind).not.toBe('walk');
  });
});
