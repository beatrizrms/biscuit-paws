// Mapa: validação, expansão de peças de várias células, células sólidas e profundidade.
// Puro: sem Phaser, DOM ou window.
import { cellHash } from './rng';
import { frameOf, type TileCatalog, type TileDef, type TileLayer } from './tiles';

export type Cell = [col: number, row: number];

export type Facing = 'down' | 'left' | 'right' | 'up';

/** Luz do mapa (acende com ADD quando escurece). */
export interface MapLight {
  at: [number, number];
  /** Raio em pixels (padrão 48). */
  radius?: number;
  /** Cor da luz (padrão quente). */
  color?: string;
}

export interface MapObject {
  id: string;
  tile: string;
  /** Origem da peça (canto superior esquerdo), em células. */
  at: Cell;
  /** Tile desenhado por cima, do mesmo tamanho (ex.: neve sobre o banco). */
  overlay?: string;
  /** Só aparece quando a condição vale (ex.: a lousa depois de comprada). */
  when?: DoorCondition;
  /** Desenhado tantos pixels acima (em cima de outro móvel). */
  lift?: number;
}

/**
 * Sujeira do lugar abandonado. Sem `clearedBy`: sai com faxina (clique). Com `clearedBy`:
 * só some quando o pintor reforma aquela superfície (manchas, rachaduras).
 */
export interface DirtSpot {
  id: string;
  tile: string;
  at: Cell;
  tags: string[];
  clearedBy?: string;
}

/** Ponto de interação (tecla E ou clique, de perto): ex.: o caixa do mercado abre a loja. */
export interface MapInteraction {
  id: string;
  at: Cell;
  /** Distância máxima (em células) entre os pés da personagem e `at`. */
  reach?: number;
  /** shop: abre a loja; board: abre o mural de pedidos da vila. */
  action: { shop: string } | { board: true };
}

/** Porta: andar para cima na célula `at` leva ao mapa `to`, na célula `spawn`. */
export interface MapDoor {
  id: string;
  at: Cell;
  to: string;
  spawn: Cell;
  /** Para onde a personagem olha ao chegar. */
  facing?: Facing;
  /** Para onde é preciso andar para atravessar (padrão: up). Ex.: a entrada do mercado é embaixo. */
  direction?: Facing;
  /** Condição para passar (ex.: { "owned": "item.key_bakery" }). Sem ela, a porta está sempre aberta. */
  requires?: DoorCondition;
  /** Fala mostrada quando está trancada. */
  locked?: string;
  /** Em vez de atravessar, mostra uma cena quando a condição vale (ex.: o gatinho na porta). */
  intercept?: { when: DoorCondition; cutscene: string };
}

/** Mesma forma das condições da história (content.ts); repetida aqui para o mapa não depender do conteúdo. */
export type DoorCondition = Record<string, unknown>;

export interface MapData {
  schemaVersion: 1;
  id: string;
  tileSize: number;
  size: { cols: number; rows: number };
  legend: Record<string, string>;
  /** floor: piso; walls: paredes; overlay (opcional): por cima do piso, como neve na calçada. */
  layers: { floor: string[]; walls: string[]; overlay?: string[] };
  objects: MapObject[];
  spawn: { player: Cell };
  doors?: MapDoor[];
  interactions?: MapInteraction[];
  /** Sujeira desenhada por cima (a sessão tira o que já foi limpo). */
  dirt?: DirtSpot[];
  /** Cor de fundo atrás do mapa (ex.: céu na rua). */
  background?: string;
  /** Dia/noite: "outdoor" (padrão) recebe a cor inteira; "indoor", uma versão mais fraca. */
  lighting?: 'outdoor' | 'indoor';
  /** Luzes que acendem quando escurece (posição em células; pode ter fração). */
  lights?: MapLight[];
  /** Superfícies que o pintor pode reformar (opcional). */
  surfaces?: SurfaceDef[];
}

export type SurfaceKind = 'floor' | 'wall' | 'wainscot';

/** Uma superfície do mapa: todas as células com a letra `legend` mudam juntas. */
export interface SurfaceDef {
  id: string;
  name: string;
  legend: string;
  kind: SurfaceKind;
}

/** Uma célula de 32 x 32 pronta para desenhar. */
export interface MapSprite {
  /** Pixels para cima (objeto em cima de outro, ex.: cafeteira no balcão). */
  dy?: number;
  tile: string;
  /** Folha (textura) do tile. */
  sheet: string;
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
  doors: MapDoor[];
  interactions: MapInteraction[];
  background?: string;
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
export const DEPTH = { floor: 0, floorOverlay: 0.25, floorObject: 0.5, floorDirt: 0.6, wall: 1, wallObject: 1.5, wallDirt: 1.6 } as const;

/** Quanto acima do objeto fica o que é desenhado por cima dele (overlay). */
const OVERLAY_LIFT = 0.01;

export function ySortDepth(baseY: number): number {
  return baseY;
}

const EMPTY = '.';
const GRID_LAYER: Record<keyof MapData['layers'], TileLayer> = { floor: 'floor', walls: 'wall', overlay: 'floor' };

/** Devolve a lista de problemas do mapa (vazia = mapa válido). */
export function validateMap(map: MapData, catalog: TileCatalog): string[] {
  const errors: string[] = [];
  const err = (msg: string) => errors.push(`${map.id ?? 'mapa'}: ${msg}`);

  if (map.schemaVersion !== 1) err(`schemaVersion ${map.schemaVersion} não suportada`);
  if (map.tileSize !== catalog.tileSize) err(`tileSize ${map.tileSize} difere do catálogo (${catalog.tileSize})`);
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
    if (grid === undefined && layerName === 'overlay') continue; // opcional
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
  const wallSolid = baseSolidGrid(map, catalog);
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
      // Quem está em cima de outro móvel (lift: cafeteira no balcão) divide a célula com ele.
      const key = `${obj.lift ? 'top' : def.layer}:${c},${r}`;
      const other = occupied.get(key);
      if (other) err(`objeto "${obj.id}" se sobrepõe a "${other}" em (${c},${r})`);
      else occupied.set(key, obj.id);
    }
    if (def.solid) {
      for (const [c, r] of footprintOf(obj.at, def)) {
        if (wallSolid[r]?.[c]) err(`objeto "${obj.id}": base em (${c},${r}) está dentro de uma parede`);
      }
    }
    if (obj.overlay) {
      const over = catalog.tiles[obj.overlay];
      if (!over) err(`objeto "${obj.id}": overlay inexistente "${obj.overlay}"`);
      else if (over.w !== def.w || over.h !== def.h) err(`objeto "${obj.id}": overlay "${obj.overlay}" tem outro tamanho`);
    }
  }

  // Sujeira
  const dirtIds = new Set<string>();
  for (const d of map.dirt ?? []) {
    if (!d.id.startsWith('dirt.')) err(`sujeira "${d.id}" deve começar com "dirt."`);
    if (dirtIds.has(d.id)) err(`sujeira "${d.id}" repetida`);
    dirtIds.add(d.id);
    const def = catalog.tiles[d.tile];
    if (!def) err(`sujeira "${d.id}": tile inexistente "${d.tile}"`);
    else if (!inBounds(...d.at) || !inBounds(d.at[0] + def.w - 1, d.at[1] + def.h - 1)) err(`sujeira "${d.id}" sai do mapa`);
  }

  // Interações
  for (const it of map.interactions ?? []) if (!inBounds(...it.at)) err(`interação "${it.id}" fora do mapa`);

  // Portas
  const doorIds = new Set<string>();
  for (const door of map.doors ?? []) {
    if (doorIds.has(door.id)) err(`porta "${door.id}" repetida`);
    doorIds.add(door.id);
    if (!inBounds(...door.at)) err(`porta "${door.id}" fora do mapa`);
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

  const gridDepth = { floor: DEPTH.floor, overlay: DEPTH.floorOverlay, walls: DEPTH.wall } as const;
  (['floor', 'overlay', 'walls'] as const).forEach((layerName) => {
    (map.layers[layerName] ?? []).forEach((line, row) => {
      [...line].forEach((char, col) => {
        if (char === EMPTY) return;
        const tile = map.legend[char]!;
        const def = catalog.tiles[tile]!;
        const frame = frameOf(catalog, def, 0, 0, variantAt(def, col, row));
        sprites.push({ tile, sheet: def.sheet, frame, col, row, depth: gridDepth[layerName] });
      });
    });
  });

  for (const obj of map.objects) {
    const def = catalog.tiles[obj.tile]!;
    const [c0, r0] = obj.at;
    // Todas as células da peça usam a base da peça inteira.
    const depth =
      def.layer === 'floor' ? DEPTH.floorObject : def.layer === 'wall' ? DEPTH.wallObject : ySortDepth((r0 + def.h) * ts);
    const over = obj.overlay ? catalog.tiles[obj.overlay] : undefined;
    for (const [col, row] of cellsOf(obj.at, def)) {
      const frame = frameOf(catalog, def, col - c0, row - r0, variantAt(def, c0, r0));
      sprites.push({ tile: obj.tile, sheet: def.sheet, frame, col, row, depth: depth + (obj.lift ? 1 : 0), ...(obj.lift ? { dy: obj.lift } : {}) });
      if (over) {
        const overFrame = frameOf(catalog, over, col - c0, row - r0);
        sprites.push({ tile: over.name, sheet: over.sheet, frame: overFrame, col, row, depth: depth + OVERLAY_LIFT });
      }
    }
  }

  for (const d of map.dirt ?? []) {
    const def = catalog.tiles[d.tile]!;
    const [c0, r0] = d.at;
    const depth = def.layer === 'floor' ? DEPTH.floorDirt : def.layer === 'wall' ? DEPTH.wallDirt : ySortDepth((r0 + def.h) * ts);
    for (const [col, row] of cellsOf(d.at, def)) {
      sprites.push({ tile: d.tile, sheet: def.sheet, frame: frameOf(catalog, def, col - c0, row - r0), col, row, depth });
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
    doors: map.doors ?? [],
    interactions: map.interactions ?? [],
    background: map.background,
  };
}

/**
 * Grade de células sólidas: paredes e pisos sólidos (asfalto, água) inteiros + a base
 * (última linha) de cada objeto sólido (decisão 010).
 */
export function solidGrid(map: MapData, catalog: TileCatalog): boolean[][] {
  const grid = baseSolidGrid(map, catalog);
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

/** Células livres alcançáveis a pé a partir de `start` (passos em 4 direções; diagonal entre dois sólidos não passa). */
export function reachableCells(solid: boolean[][], [sc, sr]: Cell): boolean[][] {
  const seen = solid.map((line) => line.map(() => false));
  const free = (c: number, r: number) => solid[r]?.[c] === false && !seen[r]![c];
  if (!free(sc, sr)) return seen;
  const queue: Cell[] = [[sc, sr]];
  seen[sr]![sc] = true;
  while (queue.length > 0) {
    const [c, r] = queue.shift()!;
    for (const [nc, nr] of [[c + 1, r], [c - 1, r], [c, r + 1], [c, r - 1]] as Cell[]) {
      if (!free(nc, nr)) continue;
      seen[nr]![nc] = true;
      queue.push([nc, nr]);
    }
  }
  return seen;
}

/** Células sólidas das grades: paredes sólidas e pisos sólidos (asfalto, água). */
function baseSolidGrid(map: MapData, catalog: TileCatalog): boolean[][] {
  const { cols, rows } = map.size;
  const solidAt = (grid: string[] | undefined, r: number, c: number) => {
    const char = grid?.[r]?.[c] ?? EMPTY;
    const name = map.legend[char];
    return char !== EMPTY && !!name && catalog.tiles[name]?.solid === true;
  };
  return Array.from({ length: rows }, (_, r) =>
    Array.from({ length: cols }, (_, c) => solidAt(map.layers.walls, r, c) || solidAt(map.layers.floor, r, c)),
  );
}

/** Porta que a personagem ativa ao andar na direção da porta, na célula dos pés (ou undefined). */
export function doorAt(map: Pick<ResolvedMap, 'doors'>, [col, row]: Cell, moving: Facing | null): MapDoor | undefined {
  if (!moving) return undefined;
  return map.doors.find((d) => d.at[0] === col && d.at[1] === row && (d.direction ?? 'up') === moving);
}

/** Interação ao alcance dos pés (a mais perto), ou undefined. `target`: só esta célula (clique). */
export function interactionNear(
  map: Pick<ResolvedMap, 'interactions'>,
  feet: readonly Cell[],
  target?: Cell,
): MapInteraction | undefined {
  const dist = (a: Cell, b: Cell) => Math.max(Math.abs(a[0] - b[0]), Math.abs(a[1] - b[1]));
  return map.interactions
    .filter((i) => !target || (i.at[0] === target[0] && i.at[1] === target[1]))
    .map((i) => ({ i, d: Math.min(...feet.map((f) => dist(f, i.at))) }))
    .filter(({ i, d }) => d <= (i.reach ?? 1))
    .sort((a, b) => a.d - b.d)[0]?.i;
}

/** Tiles com várias versões: cada célula usa uma, sempre a mesma (sem guardar nada no save). */
export function variantAt(def: TileDef, col: number, row: number): number {
  if (!def.variants || def.variants < 2) return 0;
  const weights = def.variantWeights ?? Array.from({ length: def.variants }, () => 1);
  let pick = cellHash(col, row) % weights.reduce((a, b) => a + b, 0);
  for (let v = 0; v < weights.length; v++) {
    pick -= weights[v]!;
    if (pick < 0) return v;
  }
  return 0;
}

/** Todas as células que a peça ocupa. */
export function cellsOf([c0, r0]: Cell, def: TileDef): Cell[] {
  const cells: Cell[] = [];
  for (let dy = 0; dy < def.h; dy++) for (let dx = 0; dx < def.w; dx++) cells.push([c0 + dx, r0 + dy]);
  return cells;
}

/** Células que a peça ocupa no chão: só a última linha. */
function footprintOf([c0, r0]: Cell, def: TileDef): Cell[] {
  return cellsOf([c0, r0], def).filter(([, r]) => r === r0 + def.h - 1);
}
