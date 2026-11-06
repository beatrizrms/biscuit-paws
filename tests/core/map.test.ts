import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { resolveMap, solidRects, validateMap, type MapData } from '../../src/core/map';
import { getTile } from '../../src/core/tiles';
import { variantAt } from '../../src/core/map';
import { loadContent } from './content';

const { catalog } = loadContent();
const cafe = JSON.parse(readFileSync('data/maps/cafe_main.json', 'utf8')) as MapData;

/** Mapa mínimo 4x4: parede em cima, madeira embaixo. */
function tinyMap(objects: MapData['objects'] = []): MapData {
  return {
    schemaVersion: 1,
    id: 'map.test',
    tileSize: 32,
    size: { cols: 4, rows: 4 },
    legend: { P: 'wall_stripe_pink', M: 'floor_wood_a' },
    layers: { floor: ['....', 'MMMM', 'MMMM', 'MMMM'], walls: ['PPPP', '....', '....', '....'] },
    objects,
    spawn: { player: [0, 3] },
  };
}

describe('cafe_main.json', () => {
  it('é válido e tem 16 x 11', () => {
    expect(validateMap(cafe, catalog)).toEqual([]);
    expect(cafe.size).toEqual({ cols: 16, rows: 11 });
  });

  it('é a loja velha e vazia: só paredes sólidas, nenhum móvel nem balcão', () => {
    const { solid } = resolveMap(cafe, catalog);
    for (let r = 0; r <= 2; r++) expect(solid[r]!.every(Boolean)).toBe(true);
    for (let r = 3; r < 11; r++) expect(solid[r]!.some(Boolean)).toBe(false);
    expect(new Set(cafe.objects.map((o) => o.tile))).toEqual(new Set(['window', 'door', 'doormat']));
    expect(Object.values(cafe.legend).every((name) => name.endsWith('_old'))).toBe(true);
  });

  it('pisos e paredes velhos usam variações, sempre as mesmas por célula', () => {
    const map = resolveMap(cafe, catalog);
    const floor = getTile(catalog, 'floor_check_old');
    const frames = new Set(map.sprites.filter((s) => s.tile === 'floor_check_old').map((s) => s.frame));
    expect(frames.size).toBeGreaterThan(1);
    expect(variantAt(floor, 5, 6)).toBe(variantAt(floor, 5, 6));
    expect(resolveMap(cafe, catalog).sprites).toEqual(map.sprites);
  });
});

describe('resolveMap', () => {
  it('expande uma peça de várias células em todas as suas células, com a mesma profundidade', () => {
    const map = resolveMap(tinyMap([{ id: 'obj.tree', tile: 'cat_tree', at: [1, 1] }]), catalog);
    const tree = map.sprites.filter((s) => s.tile === 'cat_tree');
    expect(tree).toHaveLength(6);
    expect(tree.map((s) => s.frame).sort((a, b) => a - b)).toEqual([54, 55, 62, 63, 70, 71]);
    expect(new Set(tree.map((s) => s.depth))).toEqual(new Set([(1 + 3) * 32])); // base da árvore inteira
  });

  it('peça sólida bloqueia só a linha de baixo (decisão 010)', () => {
    const { solid } = resolveMap(tinyMap([{ id: 'obj.tree', tile: 'cat_tree', at: [1, 1] }]), catalog);
    expect(solid[1]).toEqual([false, false, false, false]);
    expect(solid[2]).toEqual([false, false, false, false]);
    expect(solid[3]).toEqual([false, true, true, false]);
  });

  it('paredes são sólidas inteiras; peças não sólidas não bloqueiam', () => {
    const { solid } = resolveMap(tinyMap([{ id: 'obj.chair', tile: 'chair_front', at: [2, 2] }]), catalog);
    expect(solid[0]).toEqual([true, true, true, true]);
    expect(solid[2]![2]).toBe(false);
  });

  it('pisos, paredes e tapete ficam fora do y-sort', () => {
    const map = resolveMap(tinyMap([{ id: 'obj.rug', tile: 'floor_rug', at: [0, 1] }]), catalog);
    const depthOf = (tile: string) => map.sprites.find((s) => s.tile === tile)!.depth;
    expect(depthOf('floor_wood_a')).toBe(0);
    expect(depthOf('floor_rug')).toBe(0.5);
    expect(depthOf('wall_stripe_pink')).toBe(1);
  });

  it('lança erro com mapa inválido', () => {
    expect(() => resolveMap(tinyMap([{ id: 'obj.x', tile: 'nope', at: [0, 1] }]), catalog)).toThrow(/inexistente/);
  });
});

describe('validateMap', () => {
  it('acusa linha com comprimento errado e letra fora da legenda', () => {
    const map = tinyMap();
    map.layers.floor[1] = 'MMM';
    map.layers.floor[2] = 'MMZM';
    const errors = validateMap(map, catalog).join('\n');
    expect(errors).toMatch(/linha 1 tem 3 caracteres/);
    expect(errors).toMatch(/"Z" não está na legenda/);
  });

  it('acusa objeto fora dos limites', () => {
    const errors = validateMap(tinyMap([{ id: 'obj.sofa', tile: 'sofa', at: [3, 2] }]), catalog);
    expect(errors.join()).toMatch(/sai do mapa/);
  });

  it('acusa objetos sobrepostos e ids repetidos', () => {
    const errors = validateMap(
      tinyMap([
        { id: 'obj.a', tile: 'sofa', at: [0, 2] },
        { id: 'obj.a', tile: 'table_round', at: [1, 2] },
      ]),
      catalog,
    ).join('\n');
    expect(errors).toMatch(/repetido/);
    expect(errors).toMatch(/se sobrepõe/);
  });

  it('permite tapete (piso) embaixo de móvel (objeto)', () => {
    const errors = validateMap(
      tinyMap([
        { id: 'obj.rug', tile: 'floor_rug', at: [0, 2] },
        { id: 'obj.table', tile: 'table_round', at: [1, 2] },
      ]),
      catalog,
    );
    expect(errors).toEqual([]);
  });

  it('acusa base sólida dentro da parede', () => {
    const errors = validateMap(tinyMap([{ id: 'obj.pot', tile: 'plant_pot', at: [1, 0] }]), catalog);
    expect(errors.join()).toMatch(/dentro de uma parede/);
  });

  it('acusa spawn em célula sólida', () => {
    const map = tinyMap([{ id: 'obj.pot', tile: 'plant_pot', at: [0, 3] }]);
    expect(validateMap(map, catalog).join()).toMatch(/spawn .* sólida/);
  });

  it('acusa tile de camada errada na grade', () => {
    const map = tinyMap();
    map.legend.M = 'wall_mint';
    expect(validateMap(map, catalog).join()).toMatch(/é da camada "wall"/);
  });
});

describe('solidRects', () => {
  it('junta células vizinhas da mesma linha', () => {
    expect(
      solidRects([
        [true, true, false, true],
        [false, false, false, false],
      ]),
    ).toEqual([
      { col: 0, row: 0, w: 2, h: 1 },
      { col: 3, row: 0, w: 1, h: 1 },
    ]);
  });
});
