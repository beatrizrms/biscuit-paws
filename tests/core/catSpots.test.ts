import { describe, expect, it } from 'vitest';
import { catSpots, nextCatGoal, SPOT_SECONDS, validateCats, type CatObjectSpot } from '../../src/core/cats';
import { createRng } from '../../src/core/rng';
import { loadContent } from './content';
import { readFileSync } from 'node:fs';

const content = loadContent();
const catsJson = JSON.parse(readFileSync('data/cats.json', 'utf8')) as { objectUses: Record<string, CatObjectSpot[]> };
const uses = catsJson.objectUses;
const tiles = { cat_bed: { w: 1, h: 1 }, scratch_post: { w: 1, h: 1 }, cat_tree: { w: 2, h: 3 }, ph_litter_box: { w: 1, h: 1 } };
/** 10x10 livre, com o arranhador (2,2) e a árvore (5..6, 1..3) sólidos. */
function grid(): boolean[][] {
  const g = Array.from({ length: 10 }, () => Array<boolean>(10).fill(false));
  g[2]![2] = true;
  for (let r = 1; r <= 3; r++) for (let c = 5; c <= 6; c++) g[r]![c] = true;
  return g;
}

describe('gatos e os objetos deles', () => {
  const objects = [
    { id: 'placed.p1', tile: 'cat_bed', at: [1, 6] as [number, number] },
    { id: 'placed.p2', tile: 'scratch_post', at: [2, 2] as [number, number] },
    { id: 'placed.p3', tile: 'cat_tree', at: [5, 1] as [number, number] },
    { id: 'placed.p4', tile: 'sofa', at: [8, 8] as [number, number] },
  ];

  it('caminha: dorme em cima; arranhador: brinca ao lado; árvore: em cima, chegando pela frente', () => {
    const spots = catSpots(objects, tiles, uses, grid(), 32);
    // Em cima da caminha: desenhado na frente dela (profundidade da base da caminha).
    expect(spots.find((s) => s.id === 'placed.p1#0')).toEqual({ id: 'placed.p1#0', action: 'sleep', cell: [1, 6], perch: { x: 48, y: 216, baseY: 224 } });
    expect(spots.filter((s) => s.id.startsWith('placed.p2')).map((s) => [s.action, s.cell])).toEqual([['play', [1, 2]], ['play', [3, 2]]]);
    const tree = spots.filter((s) => s.id.startsWith('placed.p3'));
    expect(tree.length).toBe(uses.cat_tree!.length);
    // Chega pela célula livre logo abaixo da árvore e é desenhado na frente da base dela.
    for (const t of tree) {
      expect(t.cell[1]).toBe(4);
      expect(t.perch!.baseY).toBe(4 * 32);
    }
    // O sofá não é dos gatos.
    expect(spots.some((s) => s.id.startsWith('placed.p4'))).toBe(false);
  });

  it('arranhador: encosta nele, virado para ele; caixa de areia: sobe e senta em cima', () => {
    const spots = catSpots([...objects, { id: 'placed.p5', tile: 'ph_litter_box', at: [8, 5] }], tiles, uses, grid(), 32);
    const lean = uses.scratch_post![0]!.toward!;
    const [left, right] = spots.filter((s) => s.id.startsWith('placed.p2'));
    expect(left).toMatchObject({ face: 'right', perch: { x: 1 * 32 + 16 + lean, y: 3 * 32 - 6 } });
    expect(right).toMatchObject({ face: 'left', perch: { x: 3 * 32 + 16 - lean, y: 3 * 32 - 6 } });
    // A caixa é sólida: ele chega pela célula da frente e fica sentado dentro dela, na frente da base.
    expect(spots.find((s) => s.id === 'placed.p5#0')).toMatchObject({ action: 'sit', cell: [8, 6], perch: { x: 8 * 32 + 16, y: 5 * 32 + 24, baseY: 6 * 32 } });
  });

  it('lugar que cai numa célula sólida fica de fora', () => {
    const g = grid();
    g[2]![1] = true; // o lado esquerdo do arranhador bloqueado
    const spots = catSpots(objects, tiles, uses, g, 32);
    expect(spots.filter((s) => s.id.startsWith('placed.p2')).map((s) => s.cell)).toEqual([[3, 2]]);
  });

  it('às vezes vai a um objeto perto e livre, pelo tempo da ação; nunca a um ocupado', () => {
    const spots = catSpots(objects, tiles, uses, grid(), 32);
    const goals = Array.from({ length: 60 }, (_, i) => nextCatGoal(createRng(100 + i), [2, 5], grid(), spots));
    const used = goals.filter((g) => g.kind === 'use');
    expect(used.length).toBeGreaterThan(10);
    for (const g of used) {
      if (g.kind !== 'use') continue;
      const [min, max] = SPOT_SECONDS[g.spot.action];
      expect(g.seconds).toBeGreaterThanOrEqual(min);
      expect(g.seconds).toBeLessThanOrEqual(max);
    }
    const taken = new Set(spots.map((s) => s.id));
    expect(Array.from({ length: 30 }, (_, i) => nextCatGoal(createRng(i), [2, 5], grid(), spots, taken)).some((g) => g.kind === 'use')).toBe(false);
  });

  it('objeto longe demais não conta', () => {
    const far = catSpots([{ id: 'placed.p1', tile: 'cat_bed', at: [9, 9] }], tiles, uses, Array.from({ length: 40 }, () => Array<boolean>(40).fill(false)), 32);
    const goals = Array.from({ length: 40 }, (_, i) => nextCatGoal(createRng(i), [0, 0], Array.from({ length: 40 }, () => Array<boolean>(40).fill(false)), far.map((s) => ({ ...s, cell: [30, 30] as [number, number] }))));
    expect(goals.some((g) => g.kind === 'use')).toBe(false);
  });

  it('dados: todo tile de objectUses existe no catálogo e as ações têm animação', () => {
    for (const tile of Object.keys(uses)) expect(content.catalog.tiles[tile], tile).toBeDefined();
    expect(validateCats({ schemaVersion: 1, objectUses: uses, cats: [] }, content.catSprites)).toEqual([]);
    expect(validateCats({ schemaVersion: 1, objectUses: { cat_bed: [{ action: 'dance' as 'sit', cell: [0, 0] }] }, cats: [] }, content.catSprites).length).toBeGreaterThan(0);
  });
});
