import { describe, expect, it } from 'vitest';
import { itemSize, packBoxes } from '../../src/core/parcels';

describe('caixas do correio', () => {
  const size: Record<string, number> = { mini: 1, vaso: 2, mesa: 4, tapete: 6 };
  const sizeOf = (id: string) => size[id]!;

  it('tamanho: a área da peça em tiles; sem peça, 1', () => {
    expect(itemSize({ w: 2, h: 3 })).toBe(6);
    expect(itemSize(undefined)).toBe(1);
  });

  it('itens pequenos dividem caixa; o grande vai sozinho; o maior primeiro', () => {
    expect(packBoxes(['mini', 'mini', 'mini', 'mini'], sizeOf, 4)).toEqual([['mini', 'mini', 'mini', 'mini']]);
    expect(packBoxes(['mini', 'tapete', 'vaso', 'mini', 'mini'], sizeOf, 4)).toEqual([['tapete'], ['vaso', 'mini', 'mini'], ['mini']]);
    expect(packBoxes(['mesa', 'mini'], sizeOf, 4)).toEqual([['mesa'], ['mini']]);
    expect(packBoxes([], sizeOf, 4)).toEqual([]);
  });
});
