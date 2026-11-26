import { describe, expect, it } from 'vitest';
import { resolveMap } from '../../src/core/map';
import { clearLine, findPath, pathCorners, reachable, smoothPath } from '../../src/core/path';
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

  it('linha reta: só por células livres, com folga para o corpo; as pontas podem ser sólidas', () => {
    const open = grid(['.....', '.....', '.....']);
    expect(clearLine(open, [0, 0], [4, 2])).toBe(true);
    const pillar = grid(['.....', '..#..', '.....']);
    expect(clearLine(pillar, [0, 1], [4, 1])).toBe(false);
    expect(clearLine(pillar, [0, 0], [4, 0])).toBe(true);
    // A diagonal que raspa na quina do pilar não vale.
    expect(clearLine(pillar, [1, 0], [3, 2])).toBe(false);
    expect(clearLine(grid(['..#']), [0, 0], [2, 0])).toBe(true);
  });

  it('caminho suave: em campo aberto, direto ao fim (na diagonal); com obstáculo, contorna pelo menor número de pontos', () => {
    const open = grid(['.....', '.....', '.....']);
    expect(smoothPath(open, findPath(open, [0, 0], [4, 2])!)).toEqual([[4, 2]]);
    const wall = grid(['.....', '.###.', '.....']);
    const path = findPath(wall, [0, 1], [4, 1])!;
    const smooth = smoothPath(wall, path);
    expect(smooth.at(-1)).toEqual([4, 1]);
    expect(smooth.length).toBeLessThan(pathCorners(path).length + 1);
    // Cada trecho é uma linha livre.
    let from: [number, number] = [0, 1];
    for (const p of smooth) {
      expect(clearLine(wall, from, p)).toBe(true);
      from = p;
    }
    expect(smoothPath(open, [[1, 1]])).toEqual([]);
  });

  it('no café: do lugar do Tião até a porta da rua', () => {
    const map = resolveMap(content.map, content.catalog);
    const door = map.doors.find((d) => content.world.goHomeDoors.includes(d.id))!;
    expect(findPath(map.solid, [8, 3], door.at)).not.toBeNull();
  });

  it('alcançável: livre ligada à porta, ou sólida (cadeira) encostada numa livre ligada; o fechado não', () => {
    // Porta na parede (0, 0); um cercadinho fechado à direita com uma célula livre dentro (3, 1).
    const solid = grid(['#.###', '..#.#', '..###']);
    const can = reachable(solid, [0, 0]);
    expect(can([1, 2])).toBe(true);
    expect(can([2, 1])).toBe(true); // sólida, encostada em (1, 1)
    expect(can([3, 1])).toBe(false); // livre, mas fechada
    expect(can([4, 1])).toBe(false); // sólida, sem vizinha livre alcançável
    expect(can([9, 9])).toBe(false);
  });
});
