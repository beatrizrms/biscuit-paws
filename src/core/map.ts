// Mapa: validação, expansão de peças de várias células, células sólidas e profundidade.
// Puro: sem Phaser, DOM ou window.
import { frameOf, type TileCatalog, type TileDef, type TileLayer } from './tiles';

export type Cell = [col: number, row: number];

export interface MapObject {
  id: string;
  tile: string;
  /** Origem da peça (canto superior esquerdo), em células. */
  at: Cell;
}

export interface MapData {
  schemaVersion: 1;
  id: string;
  tileSize: number;
  size: { cols: number; rows: number };
  legend: Record<string, string>;
  layers: { floor: string[]; walls: string[] };
  objects: MapObject[];
  spawn: { player: Cell };
}

/** Uma célula de 32 x 32 pronta para desenhar. */
export interface MapSprite {
  tile: string;
  frame: number;
  col: number;
  row: number;
  depth: number;
}

export interface ResolvedMap {
  id: string;
  cols: number;
  rows: number;
  tileSize: number;
  sprites: MapSprite[];
  /** solid[row][col] */
  solid: boolean[][];
  spawn: Cell;
}

export interface Rect {
  col: number;
  row: number;
  w: number;
  h: number;
}

/**
 * Profundidade (ordem de desenho). Pisos e paredes ficam no fundo; objetos e
 * personagens usam a coordenada Y da base em pixels (y-sort), sempre >= 32.
 */
export const DEPTH = { floor: 0, floorObject: 0.5, wall: 1, wallObject: 1.5 } as const;

export function ySortDepth(baseY: number): number {
  return baseY;
}

const EMPTY = '.';
const GRID_LAYER: Record<keyof MapData['layers'], TileLayer> = { floor: 'floor', walls: 'wall' };

/** Devolve a lista de problemas do mapa (vazia = mapa válido). */
export function validateMap(map: MapData, catalog: TileCatalog): string[] {
  const errors: string[] = [];
  const err = (msg: string) => errors.push(`${map.id ?? 'mapa'}: ${msg}`);

  if (map.schemaVersion !== 1) err(`schemaVersion ${map.schemaVersion} não suportada`);
  if (map.tileSize !== catalog.sheet.tileSize) err(`tileSize ${map.tileSize} difere do catálogo (${catalog.sheet.tileSize})`);
  const { cols, rows } = map.size;
  const inBounds = (c: number, r: number) => c >= 0 && r >= 0 && c < cols && r < rows;

  // Legenda
  for (const [char, name] of Object.entries(map.legend)) {
    if (char.length !== 1 || char === EMPTY) err(`legenda: chave "${char}" deve ser um único caractere diferente de "${EMPTY}"`);
    const def = catalog.tiles[name];
    if (!def) err(`legenda: "${char}" aponta para tile inexistente "${name}"`);
    else if (def.w !== 1 || def.h !== 1) err(`legenda: "${name}" ocupa ${def.w}x${def.h}; peças grandes vão em "objects"`);
  }

  // Camadas de grade
  for (const layerName of Object.keys(GRID_LAYER) as (keyof MapData['layers'])[]) {
    const grid = map.layers[layerName];
    if (!Array.isArray(grid)) {
      err(`camada "${layerName}" ausente`);
      continue;
    }
    if (grid.length !== rows) err(`camada "${layerName}" tem ${grid.length} linhas, esperado ${rows}`);
    grid.forEach((line, r) => {
      if (line.length !== cols) err(`camada "${layerName}" linha ${r} tem ${line.length} caracteres, esperado ${cols}`);
      [...line].forEach((char, c) => {
        if (char === EMPTY) return;
        const name = map.legend[char];
        if (!name) return err(`camada "${layerName}" (${c},${r}): "${char}" não está na legenda`);
        const def = catalog.tiles[name];
        if (def && def.layer !== GRID_LAYER[layerName]) {
          err(`camada "${layerName}" (${c},${r}): "${name}" é da camada "${def.layer}"`);
        }
      });
    });
  }

  // Objetos
  const ids = new Set<string>();
  const occupied = new Map<string, string>(); // "layer:c,r" -> id
  const wallSolid = wallSolidGrid(map, catalog);
  for (const obj of map.objects) {
    if (ids.has(obj.id)) err(`objeto "${obj.id}" repetido`);
    ids.add(obj.id);
    const def = catalog.tiles[obj.tile];
    if (!def) {
      err(`objeto "${obj.id}": tile inexistente "${obj.tile}"`);
      continue;
    }
    const [c0, r0] = obj.at;
    if (!inBounds(c0, r0) || !inBounds(c0 + def.w - 1, r0 + def.h - 1)) {
      err(`objeto "${obj.id}" (${def.w}x${def.h} em ${c0},${r0}) sai do mapa ${cols}x${rows}`);
      continue;
    }
    for (const [c, r] of cellsOf(obj.at, def)) {
      const key = `${def.layer}:${c},${r}`;
      const other = occupied.get(key);
      if (other) err(`objeto "${obj.id}" se sobrepõe a "${other}" em (${c},${r})`);
      else occupied.set(key, obj.id);
    }
    if (def.solid) {
      for (const [c, r] of footprintOf(obj.at, def)) {
        if (wallSolid[r]?.[c]) err(`objeto "${obj.id}": base em (${c},${r}) está dentro de uma parede`);
      }
    }
  }

  // Ponto de partida
  const [sc, sr] = map.spawn?.player ?? [-1, -1];
  if (!inBounds(sc, sr)) err(`spawn (${sc},${sr}) fora do mapa`);
  else if (errors.length === 0 && solidGrid(map, catalog)[sr]?.[sc]) err(`spawn (${sc},${sr}) está numa célula sólida`);

  return errors;
}

/** Valida e transforma o mapa em células prontas para desenhar e colidir. */
export function resolveMap(map: MapData, catalog: TileCatalog): ResolvedMap {
  const errors = validateMap(map, catalog);
  if (errors.length > 0) throw new Error(`Mapa inválido:\n${errors.join('\n')}`);

  const ts = map.tileSize;
  const sprites: MapSprite[] = [];

  (['floor', 'walls'] as const).forEach((layerName) => {
    const depth = layerName === 'floor' ? DEPTH.floor : DEPTH.wall;
    map.layers[layerName].forEach((line, row) => {
      [...line].forEach((char, col) => {
        if (char === EMPTY) return;
        const tile = map.legend[char]!;
        const def = catalog.tiles[tile]!;
        sprites.push({ tile, frame: frameOf(catalog, def), col, row, depth });
      });
    });
  });

  for (const obj of map.objects) {
    const def = catalog.tiles[obj.tile]!;
    const [c0, r0] = obj.at;
    // Todas as células da peça usam a base da peça inteira.
    const depth =
      def.layer === 'floor' ? DEPTH.floorObject : def.layer === 'wall' ? DEPTH.wallObject : ySortDepth((r0 + def.h) * ts);
    for (const [col, row] of cellsOf(obj.at, def)) {
      sprites.push({ tile: obj.tile, frame: frameOf(catalog, def, col - c0, row - r0), col, row, depth });
    }
  }

  return {
    id: map.id,
    cols: map.size.cols,
    rows: map.size.rows,
    tileSize: ts,
    sprites,
    solid: solidGrid(map, catalog),
    spawn: map.spawn.player,
  };
}

/**
 * Grade de células sólidas: paredes sólidas inteiras + a base (última linha)
 * de cada objeto sólido (decisão 010).
 */
export function solidGrid(map: MapData, catalog: TileCatalog): boolean[][] {
  const grid = wallSolidGrid(map, catalog);
  for (const obj of map.objects) {
    const def = catalog.tiles[obj.tile];
    if (!def?.solid) continue;
    for (const [c, r] of footprintOf(obj.at, def)) {
      if (grid[r] && c >= 0 && c < map.size.cols) grid[r][c] = true;
    }
  }
  return grid;
}

/** Junta células sólidas em retângulos (faixas horizontais), para criar menos corpos de colisão. */
export function solidRects(solid: boolean[][]): Rect[] {
  const rects: Rect[] = [];
  solid.forEach((line, row) => {
    let start = -1;
    for (let col = 0; col <= line.length; col++) {
      const isSolid = line[col] === true;
      if (isSolid && start < 0) start = col;
      if (!isSolid && start >= 0) {
        rects.push({ col: start, row, w: col - start, h: 1 });
        start = -1;
      }
    }
  });
  return rects;
}

function wallSolidGrid(map: MapData, catalog: TileCatalog): boolean[][] {
  const { cols, rows } = map.size;
  return Array.from({ length: rows }, (_, r) =>
    Array.from({ length: cols }, (_, c) => {
      const char = map.layers.walls?.[r]?.[c] ?? EMPTY;
      const name = map.legend[char];
      return char !== EMPTY && !!name && catalog.tiles[name]?.solid === true;
    }),
  );
}

function cellsOf([c0, r0]: Cell, def: TileDef): Cell[] {
  const cells: Cell[] = [];
  for (let dy = 0; dy < def.h; dy++) for (let dx = 0; dx < def.w; dx++) cells.push([c0 + dx, r0 + dy]);
  return cells;
}

/** Células que a peça ocupa no chão: só a última linha. */
function footprintOf([c0, r0]: Cell, def: TileDef): Cell[] {
  return cellsOf([c0, r0], def).filter(([, r]) => r === r0 + def.h - 1);
}
