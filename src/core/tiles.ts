// Catálogo de tiles por nome. Puro: sem Phaser, DOM ou window.

export type TileLayer = 'floor' | 'wall' | 'object';

export interface TileDef {
  name: string;
  /** Coluna e linha da origem (canto superior esquerdo) na folha, em tiles. */
  col: number;
  row: number;
  /** Tamanho em tiles. */
  w: number;
  h: number;
  solid: boolean;
  layer: TileLayer;
}

export interface SheetInfo {
  image: string;
  tileSize: number;
  columns: number;
  rows: number;
}

export interface TileCatalog {
  schemaVersion: 1;
  sheet: SheetInfo;
  tiles: Record<string, TileDef>;
}

export interface TileMeta {
  schemaVersion: 1;
  sheet: SheetInfo;
  tiles: Record<string, { solid: boolean; layer: TileLayer }>;
}

const LAYERS: readonly TileLayer[] = ['floor', 'wall', 'object'];
const CSV_HEADER = ['name', 'col', 'row', 'width_tiles', 'height_tiles'];

/** Junta o tiles.csv do pacote com as nossas decisões (tiles.meta.json). */
export function buildCatalog(csvText: string, meta: TileMeta): TileCatalog {
  const lines = csvText.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length > 0);
  const header = (lines.shift() ?? '').split(',');
  for (const [i, col] of CSV_HEADER.entries()) {
    if (header[i] !== col) throw new Error(`tiles.csv: coluna ${i} deveria ser "${col}", veio "${header[i]}"`);
  }

  const { columns, rows } = meta.sheet;
  const tiles: Record<string, TileDef> = {};
  for (const line of lines) {
    const [name = '', ...nums] = line.split(',');
    const [col, row, w, h] = nums.slice(0, 4).map(Number) as [number, number, number, number];
    if (tiles[name]) throw new Error(`tiles.csv: nome repetido "${name}"`);
    if (![col, row, w, h].every(Number.isInteger) || w < 1 || h < 1) {
      throw new Error(`tiles.csv: números inválidos em "${line}"`);
    }
    if (col + w > columns || row + h > rows) throw new Error(`tiles.csv: "${name}" sai da folha`);
    const decision = meta.tiles[name];
    if (!decision) throw new Error(`tiles.meta.json: falta a decisão (solid/layer) de "${name}"`);
    if (!LAYERS.includes(decision.layer)) throw new Error(`tiles.meta.json: layer inválida em "${name}"`);
    tiles[name] = { name, col, row, w, h, solid: decision.solid, layer: decision.layer };
  }
  for (const name of Object.keys(meta.tiles)) {
    if (!tiles[name]) throw new Error(`tiles.meta.json: "${name}" não existe no tiles.csv`);
  }
  return { schemaVersion: 1, sheet: meta.sheet, tiles };
}

export function getTile(catalog: TileCatalog, name: string): TileDef {
  const def = catalog.tiles[name];
  if (!def) throw new Error(`Tile desconhecido: "${name}"`);
  return def;
}

/** Índice do quadro na folha para a célula (dx, dy) dentro da peça. */
export function frameOf(catalog: TileCatalog, def: TileDef, dx = 0, dy = 0): number {
  return (def.row + dy) * catalog.sheet.columns + def.col + dx;
}
