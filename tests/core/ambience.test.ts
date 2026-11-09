import { describe, expect, it } from 'vitest';
import { ambienceOf } from '../../src/core/ambience';
import type { MapData } from '../../src/core/map';
import { loadContent } from './content';

const content = loadContent();
const cfg = content.dayNight.ambience;
const ts = content.map.tileSize;

/** Um quartinho de teste: parede em cima (2 linhas), uma parede vertical no meio, uma janela e uns objetos. */
function room(over: Partial<MapData> = {}): MapData {
  const base = content.map;
  return {
    ...base,
    size: { cols: 6, rows: 5 },
    layers: { floor: ['......', '......', 'ffffff', 'ffffff', 'ffffff'].map((l) => l.replace(/\./g, 'f')), walls: ['WWWWWW', 'WWWWWW', '...W..', '...W..', '......'] },
    legend: { ...base.legend, f: base.legend[Object.keys(base.legend).find((k) => content.catalog.tiles[base.legend[k]!]?.layer === 'floor')!]!, W: base.legend[Object.keys(base.legend).find((k) => content.catalog.tiles[base.legend[k]!]?.layer === 'wall')!]! },
    objects: [],
    dirt: [],
    ...over,
  } as MapData;
}

describe('luz e sombra de ambiente', () => {
  it('sombra de contato embaixo do que fica no chão; nada para o que vai em cima de outro (lift) nem para a parede', () => {
    const table = Object.entries(content.catalog.tiles).find(([, d]) => d.layer === 'object' && d.w === 1 && d.h === 1)![0];
    const a = ambienceOf(room({ objects: [{ id: 'o1', tile: table, at: [1, 3] }, { id: 'o2', tile: table, at: [4, 3], lift: 8 }, { id: 'w', tile: 'window', at: [1, 0] }] }), content.catalog, cfg, true);
    expect(a.shadows).toHaveLength(1);
    expect(a.shadows[0]).toMatchObject({ x: 1.5 * ts, y: 4 * ts - 2 });
  });

  it('parede encontra o piso: faixa em cima do piso embaixo da parede e dos lados da parede vertical', () => {
    const a = ambienceOf(room(), content.catalog, cfg, false);
    const up = a.edges.filter((e) => e.wall === 'up' && e.y === 2 * ts);
    // Embaixo da parede de cima (linha 1), nas colunas abertas da linha 2 (a 3 é a parede vertical).
    expect(up.map((e) => e.x / ts).sort()).toEqual([0, 1, 2, 4, 5]);
    // A parede vertical (coluna 3, linhas 2 e 3) tem piso dos dois lados e embaixo.
    expect(a.edges.filter((e) => e.wall === 'right').map((e) => e.y / ts)).toEqual([2, 3]);
    expect(a.edges.filter((e) => e.wall === 'left').map((e) => e.y / ts)).toEqual([2, 3]);
    expect(a.edges.some((e) => e.wall === 'up' && e.x === 3 * ts && e.y === 4 * ts)).toBe(true); // ponta da parede vertical
  });

  it('janela: luz no piso só nos interiores, a partir da primeira linha aberta, inclinada para o lado', () => {
    const map = room({ objects: [{ id: 'w', tile: 'window', at: [1, 0] }] });
    expect(ambienceOf(map, content.catalog, cfg, false).windows).toHaveLength(0);
    const [w] = ambienceOf(map, content.catalog, cfg, true).windows;
    expect(w).toBeDefined();
    const [x0, y0] = w!.points[0]!;
    const [x2, y2] = w!.points[2]!;
    expect(y0).toBe(2 * ts);
    expect(y2).toBe(Math.min(5, 2 + cfg.windowLength) * ts);
    expect(x2).toBeGreaterThan(x0 + ts); // a base vai mais para o lado
  });

  it('o café de verdade: tem sombras, faixas e as duas janelas', () => {
    const a = ambienceOf(content.map, content.catalog, cfg, true);
    expect(a.edges.length).toBeGreaterThan(10);
    expect(a.windows).toHaveLength(2);
  });
});
