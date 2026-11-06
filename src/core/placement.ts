// Onde um móvel pode ser posicionado. Puro: sem Phaser, DOM ou window.
import type { ItemDef } from './content';
import { cellsOf, solidGrid, type Cell, type MapData } from './map';
import type { PlacedItem } from './state';
import type { TileCatalog, TileDef, TileLayer } from './tiles';

export type PlaceProblem = 'out_of_bounds' | 'occupied' | 'needs_floor' | 'needs_wall' | 'blocked';

export const PLACED_PREFIX = 'placed.';

/** Mapa base + móveis da jogadora, como objetos comuns. */
export function withPlaced(map: MapData, placed: readonly PlacedItem[], items: Record<string, ItemDef>): MapData {
  const extra = placed.flatMap((p) => {
    const item = items[p.item];
    return item ? [{ id: `${PLACED_PREFIX}${p.uid}`, tile: item.tile, at: p.at }] : [];
  });
  return { ...map, objects: [...map.objects, ...extra] };
}

/**
 * Por que a peça não pode ficar em `at` (ou null se pode).
 * `map` já deve incluir os móveis posicionados (use withPlaced).
 * `reserved`: células onde nada sólido pode ficar (pés da personagem, ponto de partida).
 *
 * Regras por camada:
 * - object: a base (última linha) fica no piso, livre; a parte de cima pode cobrir a parede.
 * - floor (tapete): todas as células no piso.
 * - wall (quadro, relógio): todas as células na parede.
 */
export function placementProblem(
  map: MapData,
  catalog: TileCatalog,
  def: TileDef,
  at: Cell,
  reserved: readonly Cell[] = [],
): PlaceProblem | null {
  const { cols, rows } = map.size;
  const cells = cellsOf(at, def);
  if (cells.some(([c, r]) => c < 0 || r < 0 || c >= cols || r >= rows)) return 'out_of_bounds';

  const isFloor = ([c, r]: Cell) => (map.layers.floor[r]?.[c] ?? '.') !== '.' && (map.layers.walls[r]?.[c] ?? '.') === '.';
  const isWall = ([c, r]: Cell) => (map.layers.walls[r]?.[c] ?? '.') !== '.';
  const footprint = cells.filter(([, r]) => r === at[1] + def.h - 1);

  if (def.layer === 'wall') {
    if (!cells.every(isWall)) return 'needs_wall';
  } else if (def.layer === 'floor') {
    if (!cells.every(isFloor)) return 'needs_floor';
  } else if (!footprint.every(isFloor)) {
    return 'needs_floor';
  }

  const taken = occupiedCells(map, catalog, def.layer);
  if (cells.some(([c, r]) => taken.has(key(c, r)))) return 'occupied';

  if (def.layer === 'object') {
    const solid = solidGrid(map, catalog);
    if (footprint.some(([c, r]) => solid[r]?.[c])) return 'occupied';
    if (def.solid && footprint.some(([c, r]) => reserved.some(([rc, rr]) => rc === c && rr === r))) return 'blocked';
  }
  return null;
}

/** Móvel da jogadora numa célula (prefere objeto, depois parede, depois piso). */
export function placedItemAt(
  catalog: TileCatalog,
  placed: readonly PlacedItem[],
  items: Record<string, ItemDef>,
  [col, row]: Cell,
): PlacedItem | undefined {
  const order: TileLayer[] = ['object', 'wall', 'floor'];
  const hits = placed.flatMap((p) => {
    const def = catalog.tiles[items[p.item]?.tile ?? ''];
    if (!def || !cellsOf(p.at, def).some(([c, r]) => c === col && r === row)) return [];
    return [{ p, rank: order.indexOf(def.layer) }];
  });
  return hits.sort((a, b) => a.rank - b.rank)[0]?.p;
}

function occupiedCells(map: MapData, catalog: TileCatalog, layer: TileLayer): Set<string> {
  const set = new Set<string>();
  for (const obj of map.objects) {
    const def = catalog.tiles[obj.tile];
    if (def?.layer === layer) for (const [c, r] of cellsOf(obj.at, def)) set.add(key(c, r));
  }
  return set;
}

const key = (c: number, r: number) => `${c},${r}`;
