import { describe, expect, it } from 'vitest';
import { resolveMap } from '../../src/core/map';
import { findPath, pathCorners } from '../../src/core/path';
import { loadContent } from './content';

const content = loadContent();
const grid = (rows: string[]) => rows.map((r) => [...r].map((ch) => ch === '#'));

describe('caminho pelas células livres', () => {
  it('desvia das paredes, anda em 4 direções e devolve do começo ao fim', () => {
    const solid = grid(['.....', '.###.', '.....']);
    const path = findPath(solid, [0, 1], [4, 1])!;
    expect(path[0]).toEqual([0, 1]);
    expect(path.at(-1)).toEqual([4, 1]);
    expect(path).toHaveLength(7); // contorna o muro por cima ou por baixo
    for (let i = 1; i < path.length; i++) expect(Math.abs(path[i]![0] - path[i - 1]![0]) + Math.abs(path[i]![1] - path[i - 1]![1])).toBe(1);
    expect(path.every(([c, r]) => !solid[r]![c] || (c === 0 && r === 1))).toBe(true);
  });

  it('sem caminho: null; o destino pode ser sólido (a porta na parede)', () => {
    expect(findPath(grid(['.#.', '.#.', '.#.']), [0, 0], [2, 0])).toBeNull();
    expect(findPath(grid(['..#']), [0, 0], [2, 0])).toEqual([[0, 0], [1, 0], [2, 0]]);
  });

  it('esquinas: só onde muda de direção, e o fim', () => {
    expect(pathCorners([[0, 0], [1, 0], [2, 0], [2, 1], [2, 2]])).toEqual([[2, 0], [2, 2]]);
  });

  it('no café: do lugar do Tião até a porta da rua', () => {
    const map = resolveMap(content.map, content.catalog);
    const door = map.doors.find((d) => content.world.goHomeDoors.includes(d.id))!;
    expect(findPath(map.solid, [8, 3], door.at)).not.toBeNull();
  });
});
