// Onde um móvel pode ser posicionado. Puro: sem Phaser, DOM ou window.
import type { ItemDef } from './content';
import { cellsOf, solidGrid, type Cell, type MapData } from './map';
import type { PlacedItem } from './state';
import type { TileCatalog, TileDef, TileLayer } from './tiles';

export type PlaceProblem = 'out_of_bounds' | 'occupied' | 'needs_floor' | 'needs_wall' | 'blocked' | 'needs_counter' | 'no_free_counter' | 'has_something_on_top' | 'room_closed' | 'wrong_room' | 'blocks_door';

export const PLACED_PREFIX = 'placed.';

/**
 * As células de um móvel posicionado (o tampo de um apoio de 2 células, como a cômoda, aceita uma peça em cada uma).
 * Sem o catálogo, só a célula de origem (apoios de 1 célula).
 */
export type Footprint = (p: PlacedItem) => Cell[];
const originOnly: Footprint = (p) => [p.at];

/** Footprint pelo catálogo (todas as células do tile do item). */
export function footprintOf(catalog: TileCatalog, items: Record<string, ItemDef>): Footprint {
  return (p) => {
    const def = catalog.tiles[items[p.item]?.tile ?? ''];
    return def ? cellsOf(p.at, def) : [p.at];
  };
}

const sameCell = (a: Cell, b: Cell) => a[0] === b[0] && a[1] === b[1];

/** Mapa base + móveis da jogadora, como objetos comuns. */
/**
 * `stocked`: a vitrine tem algo dentro (desenha a arte cheia, display.fullTile). `lift`: quanto o que vai em cima
 * sobe até o tampo (o apoio pode ter o próprio, `topLift`).
 */
export function withPlaced(map: MapData, placed: readonly PlacedItem[], items: Record<string, ItemDef>, lift = 0, stocked?: (uid: string) => boolean, footprint: Footprint = originOnly): MapData {
  const extra = placed.flatMap((p) => {
    const item = items[p.item];
    if (!item?.tile) return [];
    // Em cima de outro móvel (ex.: cafeteira no balcão, vaso na cômoda): sobe até o tampo. Solto no chão (orFloor), não.
    const host = item.placeOn ? hostAt(placed, items, item.placeOn, p.at, footprint) : undefined;
    const tile = item.display?.fullTile && stocked?.(p.uid) ? item.display.fullTile : item.tile;
    return [{ id: `${PLACED_PREFIX}${p.uid}`, tile, at: p.at, ...(host ? { lift: items[host.item]?.topLift ?? lift } : {}) }];
  });
  return { ...map, objects: [...map.objects, ...extra] };
}

/** O móvel com esta tag posicionado que cobre a célula (o "apoio" de quem vai em cima). */
export function hostAt(placed: readonly PlacedItem[], items: Record<string, ItemDef>, tag: string, at: Cell, footprint: Footprint = originOnly): PlacedItem | undefined {
  return placed.find((p) => !items[p.item]?.placeOn && items[p.item]?.tags.includes(tag) && footprint(p).some((c) => sameCell(c, at)));
}

/** O que está em cima deste móvel (em qualquer célula dele)? Não dá para recolher o balcão com a cafeteira em cima. */
export function itemOnTop(placed: readonly PlacedItem[], items: Record<string, ItemDef>, host: PlacedItem, footprint: Footprint = originOnly): PlacedItem | undefined {
  return ridersOf(placed, items, host, footprint)[0];
}

/** Tudo o que está em cima deste móvel (vai junto ao mover ou guardar). Um apoio não é rider de ninguém. */
export function ridersOf(placed: readonly PlacedItem[], items: Record<string, ItemDef>, host: PlacedItem, footprint: Footprint = originOnly): PlacedItem[] {
  if (items[host.item]?.placeOn) return [];
  const cells = footprint(host);
  return placed.filter((p) => p !== host && items[p.item]?.placeOn && cells.some((c) => sameCell(c, p.at)));
}

/** Onde um item que vai em cima pode ficar: num apoio com a tag, sem nada em cima naquela célula. */
export function placeOnProblem(placed: readonly PlacedItem[], items: Record<string, ItemDef>, tag: string, at: Cell, footprint: Footprint = originOnly): PlaceProblem | null {
  const host = hostAt(placed, items, tag, at, footprint);
  if (!host) return 'needs_counter';
  return placed.some((p) => p !== host && items[p.item]?.placeOn && sameCell(p.at, at)) ? 'occupied' : null;
}

/** Existe algum apoio com a tag com uma célula livre (sem nada em cima)? Se não, nem adianta pôr na mão. */
export function hasFreeHost(placed: readonly PlacedItem[], items: Record<string, ItemDef>, tag: string, footprint: Footprint = originOnly): boolean {
  return placed.some((h) => !items[h.item]?.placeOn && items[h.item]?.tags.includes(tag) && footprint(h).some((c) => !placed.some((p) => p !== h && items[p.item]?.placeOn && sameCell(p.at, c))));
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
    return [{ p, rank: order.indexOf(def.layer) - (items[p.item]?.placeOn ? 1 : 0) }];
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
