// Catálogo de tiles por nome, com várias folhas (café, rua, sujeira...). Puro: sem Phaser, DOM ou window.

export type TileLayer = 'floor' | 'wall' | 'object';

export interface TileDef {
  name: string;
  /** Folha de onde o tile vem (chave em catalog.sheets). */
  sheet: string;
  /** Coluna e linha da origem (canto superior esquerdo) na folha, em tiles. */
  col: number;
  row: number;
  /** Tamanho em tiles. */
  w: number;
  h: number;
  solid: boolean;
  layer: TileLayer;
  /** Quantas versões lado a lado o tile tem na folha (o mapa escolhe uma por célula). */
  variants?: number;
  /** Peso de cada versão (quantas vezes aparece). Sem pesos, todas valem igual. */
  variantWeights?: number[];
  /** Tile do pacote de onde este foi gerado (tiles "velhos"). */
  from?: string;
}

export interface SheetInfo {
  image: string;
  columns: number;
  rows: number;
  /** Pixels da arte por pixel do jogo: 1 = 32 px por tile, 2 = 64 px (decisão 052). Sem o campo, 1. */
  resolution?: number;
}

/** Resoluções aceitas para uma folha (arte em 32 ou 64 px por tile). */
export const SHEET_RESOLUTIONS: readonly number[] = [1, 2];

export interface TileCatalog {
  schemaVersion: 1;
  tileSize: number;
  sheets: Record<string, SheetInfo>;
  tiles: Record<string, TileDef>;
}

/** Folha principal (o pacote do café): tiles.csv + nossas decisões em tiles.meta.json. */
export interface TileMeta {
  schemaVersion: 1;
  sheet: SheetInfo & { tileSize: number };
  tiles: Record<string, { solid: boolean; layer: TileLayer }>;
}

export type WornStyle = 'wallpaper' | 'wainscot' | 'wood_floor' | 'tile_floor';

/** data/tiles.worn.json: tiles gerados a partir dos tiles do pacote. */
export interface WornTiles {
  schemaVersion: 1;
  image: string;
  seed: number;
  tiles: {
    name: string;
    from: string;
    style: WornStyle;
    /** Troca de cores antes do desgaste: "#rrggbb" de origem -> "#rrggbb" novo. */
    recolor?: Record<string, string>;
    variants: number;
    weights?: number[];
  }[];
}

/** JSON de peças dos pacotes novos (rua, sujeira): nome -> posição e tamanho na folha. */
export interface PiecesFile {
  tileSize: number;
  columns: number;
  rows: number;
  pieces: Record<string, { col: number; row: number; w_tiles: number; h_tiles: number }>;
}

/** Uma folha extra (data/tilesets.json), já com o JSON de peças lido. */
export interface ExtraSheet {
  id: string;
  image: string;
  /** Prefixo dos nomes no catálogo ("street_" + "calcada_a" = "street_calcada_a"). */
  prefix: string;
  layer: TileLayer;
  solid: boolean;
  /** Exceções por peça (nome sem prefixo). */
  overrides?: Record<string, { solid?: boolean; layer?: TileLayer }>;
  pieces: PiecesFile;
}

export const MAIN_SHEET = 'cafe';

const LAYERS: readonly TileLayer[] = ['floor', 'wall', 'object'];
const CSV_HEADER = ['name', 'col', 'row', 'width_tiles', 'height_tiles'];

/**
 * Monta o catálogo:
 * - folha do café: tiles.csv (do pacote) + tiles.meta.json (nossas decisões);
 * - tiles velhos (tiles.worn.json), em linhas novas abaixo da folha do café;
 * - folhas extras (tilesets.json): rua, neve, sujeira...
 */
export function buildCatalog(csvText: string, meta: TileMeta, worn?: WornTiles, extras: ExtraSheet[] = []): TileCatalog {
  const lines = csvText.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length > 0);
  const header = (lines.shift() ?? '').split(',');
  for (const [i, col] of CSV_HEADER.entries()) {
    if (header[i] !== col) throw new Error(`tiles.csv: coluna ${i} deveria ser "${col}", veio "${header[i]}"`);
  }

  const { columns, rows, tileSize, image } = meta.sheet;
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
    tiles[name] = { name, sheet: MAIN_SHEET, col, row, w, h, solid: decision.solid, layer: decision.layer };
  }
  for (const name of Object.keys(meta.tiles)) {
    if (!tiles[name]) throw new Error(`tiles.meta.json: "${name}" não existe no tiles.csv`);
  }

  const sheets: Record<string, SheetInfo> = { [MAIN_SHEET]: { image, columns, rows } };

  if (worn) {
    // Cada tile gerado ocupa "variants" células seguidas numa linha nova.
    let row = rows;
    let col = 0;
    for (const t of worn.tiles) {
      const source = tiles[t.from];
      if (!source) throw new Error(`tiles.worn.json: "${t.name}" vem de "${t.from}", que não existe`);
      if (source.w !== 1 || source.h !== 1) throw new Error(`tiles.worn.json: "${t.from}" precisa ser 1x1`);
      if (tiles[t.name]) throw new Error(`tiles.worn.json: nome repetido "${t.name}"`);
      if (!Number.isInteger(t.variants) || t.variants < 1 || t.variants > columns) {
        throw new Error(`tiles.worn.json: "${t.name}" tem variants inválido`);
      }
      if (t.weights && (t.weights.length !== t.variants || t.weights.some((w) => !Number.isInteger(w) || w < 1))) {
        throw new Error(`tiles.worn.json: "${t.name}" precisa de ${t.variants} pesos inteiros >= 1`);
      }
      if (col + t.variants > columns) {
        row++;
        col = 0;
      }
      tiles[t.name] = { ...source, name: t.name, col, row, variants: t.variants, from: t.from };
      if (t.weights) tiles[t.name]!.variantWeights = t.weights;
      col += t.variants;
    }
    const usedRows = col === 0 ? row - rows : row - rows + 1;
    sheets[MAIN_SHEET] = { image: worn.image, columns, rows: rows + usedRows };
  }

  for (const extra of extras) {
    if (sheets[extra.id]) throw new Error(`tilesets.json: folha repetida "${extra.id}"`);
    const resolution = extra.pieces.tileSize / tileSize;
    if (!SHEET_RESOLUTIONS.includes(resolution)) {
      const sizes = SHEET_RESOLUTIONS.map((r) => r * tileSize).join(' ou ');
      throw new Error(`tilesets.json: "${extra.id}" tem tiles de ${extra.pieces.tileSize} px; aceita ${sizes}`);
    }
    sheets[extra.id] = { image: extra.image, columns: extra.pieces.columns, rows: extra.pieces.rows, ...(resolution !== 1 ? { resolution } : {}) };
    for (const name of Object.keys(extra.overrides ?? {})) {
      if (!extra.pieces.pieces[name]) throw new Error(`tilesets.json: "${extra.id}" tem exceção para "${name}", que não existe`);
    }
    for (const [piece, p] of Object.entries(extra.pieces.pieces)) {
      const name = extra.prefix + piece;
      if (tiles[name]) throw new Error(`tilesets.json: nome repetido "${name}"`);
      if (p.col + p.w_tiles > extra.pieces.columns || p.row + p.h_tiles > extra.pieces.rows) {
        throw new Error(`tilesets.json: "${name}" sai da folha`);
      }
      const o = extra.overrides?.[piece] ?? {};
      const layer = o.layer ?? extra.layer;
      if (!LAYERS.includes(layer)) throw new Error(`tilesets.json: layer inválida em "${name}"`);
      tiles[name] = { name, sheet: extra.id, col: p.col, row: p.row, w: p.w_tiles, h: p.h_tiles, solid: o.solid ?? extra.solid, layer };
    }
  }

  return { schemaVersion: 1, tileSize, sheets, tiles };
}

export function getTile(catalog: TileCatalog, name: string): TileDef {
  const def = catalog.tiles[name];
  if (!def) throw new Error(`Tile desconhecido: "${name}"`);
  return def;
}

/** Resolução da folha (1 = 32 px por tile, 2 = 64 px). */
export function sheetResolution(catalog: TileCatalog, sheet: string): number {
  return catalog.sheets[sheet]?.resolution ?? 1;
}

/** Índice do quadro na folha do tile, para a célula (dx, dy) dentro da peça, na versão `variant`. */
export function frameOf(catalog: TileCatalog, def: TileDef, dx = 0, dy = 0, variant = 0): number {
  const columns = catalog.sheets[def.sheet]!.columns;
  return (def.row + dy) * columns + def.col + dx + variant * def.w;
}
