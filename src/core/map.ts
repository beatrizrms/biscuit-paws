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
  /** Inverno ao ar livre: o jogo desenha a neve por cima, pelo contorno do desenho (src/core/snowCap.ts). */
  snowCap?: boolean;
  /** Só aparece quando a condição vale (ex.: a lousa depois de comprada). */
  when?: DoorCondition;
  /** Desenhado tantos pixels acima (em cima de outro móvel). */
  lift?: number;
  /** Embutido na parede (a porta do jardim): pode ter a base na parede e fica atrás de quem passa na frente. */
  inWall?: boolean;
  /** Janela com cortina: o tile com a cortina aberta (a interação "curtain" troca; só a aberta joga luz no piso). */
  curtainOpen?: string;
  /**
   * A vista da janela aberta enquanto o cômodo `room` ainda tem o mato pesado (antes da limpeza do Tião): o tile
   * `tile` (galhos tapando a vista) no lugar de curtainOpen.
   */
  curtainOvergrown?: { room: string; tile: string };
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
  /** Pesada (mato alto): a vassoura não tira; sai na limpeza pesada do Tião (data/rooms.json clear). */
  heavy?: boolean;
  /** Embaixo dela tem um item (ex.: a chave do quintal): limpar entrega o item, com esta fala. */
  gives?: string;
  foundDialogue?: string;
  /** Pixels para cima (negativo = para baixo), para assentar a peça (ex.: buraco de rato no rodapé). */
  lift?: number;
  /** Só aparece a partir desta condição (ex.: o cocô do dia 2). Fica fora do "tudo limpo" dos saves antigos. */
  when?: unknown;
  /** Inverno ao ar livre: neve por cima (como MapObject.snowCap; o mato e o entulho do quintal). */
  snowCap?: boolean;
}

/** Ponto de interação (tecla E ou clique, de perto): ex.: o caixa do mercado abre a loja. */
export interface MapInteraction {
  id: string;
  at: Cell;
  /** Distância máxima (em células) entre os pés da personagem e `at`. */
  reach?: number;
  /** shop: o caixa (paga o carrinho); shelf: prateleira da loja (só os itens com estas tags vão para o carrinho); board: mural de pedidos; vet: a consulta na clínica; door: passagem entre cômodos; sleep: a cama do quartinho;
   * bus: o ponto de ônibus (os destinos em data/world.json: bus);
   * hours: a plaquinha de horário na fachada (id da porta do estabelecimento, no mesmo mapa; a do café mostra o horário do app Horário);
   * curtain: abre/fecha a cortina da janela (id do objeto, com curtainOpen); `dialogue`, a fala da primeira vez que abre (uma vez no jogo),
   * só se `dialogueWhen` valer (ex.: o quintal ainda fechado; aberto antes, ela já sabe o que é o terreno e não fala);
   * `dialogueAlt`: outra fala no lugar dela quando `when` valer (à noite, sem falar do sol). Uma vez no jogo, valendo qualquer das duas. */
  action: { shop: string } | { shelf: string; tags: string[] } | { board: true } | { vet: true } | { door: string } | { sleep: string } | { hours: string } | { bus: true } | { curtain: string; dialogue?: string; dialogueWhen?: DoorCondition; dialogueAlt?: { when: DoorCondition; dialogue: string } };
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
  /**
   * Em vez de atravessar, quando a condição vale: mostra uma cena (cutscene, ex.: o gatinho na porta) ou roda um
   * roteiro no mundo (script, ex.: a clínica que abriu; o roteiro pode levar para dentro com o passo "enter").
   */
  intercept?: { when: DoorCondition; cutscene?: string; script?: string };
  /**
   * Horário do estabelecimento (mercado, clínica): fora dele a porta não deixa entrar (nem roda o intercept) e avisa
   * quando abre. Quem já está dentro termina. `days`: segunda a domingo; `name`: como aparece no aviso.
   */
  hours?: DoorHours;
}

export interface DoorHours {
  name: string;
  days: boolean[];
  open: string;
  close: string;
}

/** Mesma forma das condições da história (content.ts); repetida aqui para o mapa não depender do conteúdo. */
export type DoorCondition = Record<string, unknown>;

/** NPC parado que se mexe à toa: toca a animação uma vez e fica parado um tempo sorteado entre pauseMs[0] e pauseMs[1]. */
export interface NpcIdle {
  anim: string;
  pauseMs: [number, number];
}

/** NPC atendendo: com ela ao alcance da interação (o caixa), repete a animação. */
export interface NpcBusy {
  anim: string;
  interaction: string;
}

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
  /** NPCs que ficam no mapa (ex.: a Fernanda no balcão da clínica). */
  /** NPCs parados no mapa; anim: animação extra em repetição (o construtor martelando). */
  npcs?: { npc: string; at: Cell; facing?: Facing; anim?: string; idle?: NpcIdle; busy?: NpcBusy }[];
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

export type SurfaceKind = 'floor' | 'wall' | 'wainscot' | 'facade';

/** Uma superfície do mapa: todas as células com a letra `legend` mudam juntas. */
export interface SurfaceDef {
  id: string;
  name: string;
  legend: string;
  kind: SurfaceKind;
}

/** Uma célula de 32 x 32 pronta para desenhar. */
export interface MapSprite {
  /** Id do objeto do mapa de onde veio (só objetos; piso e parede não têm). */
  obj?: string;
  /** Id da sujeira de onde veio (a neve do inverno junta os pedaços dela). */
  dirt?: string;
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
  /** Objetos e sujeiras com neve por cima (snowCap): o id, a origem da peça, a profundidade (logo acima dela) e quanto sobe. */
  snowCaps: { obj: string; col: number; row: number; depth: number; dy: number }[];
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
// floorCrack: estrago do piso (rachadura, sujeira de reforma): embaixo do tapete; a sujeira de varrer fica por cima.
export const DEPTH = { floor: 0, floorOverlay: 0.25, floorCrack: 0.4, floorObject: 0.5, floorDirt: 0.6, wall: 1, wallObject: 1.5, wallDirt: 1.6 } as const;

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
    if (def.solid && !obj.inWall) {
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
    const h = door.hours;
    if (h) {
      const clock = /^([01]\d|2[0-3]):[0-5]\d$/;
      if (h.days.length !== 7 || !h.days.some(Boolean)) err(`porta "${door.id}": hours.days precisa de 7 dias (segunda a domingo) com pelo menos um aberto`);
      if (!clock.test(h.open) || !clock.test(h.close) || h.open >= h.close) err(`porta "${door.id}": hours.open/close inválidos`);
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
  const snowCaps: ResolvedMap['snowCaps'] = [];

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
      def.layer === 'floor' ? DEPTH.floorObject : def.layer === 'wall' || obj.inWall ? DEPTH.wallObject : ySortDepth((r0 + def.h) * ts);
    const over = obj.overlay ? catalog.tiles[obj.overlay] : undefined;
    if (obj.snowCap) snowCaps.push({ obj: obj.id, col: c0, row: r0, depth: depth + OVERLAY_LIFT * 2, dy: obj.lift ?? 0 });
    // Arte que sobe acima da peça (rise): mesma profundidade, sem ocupar a célula de cima.
    for (let k = 1; k <= (def.rise ?? 0); k++) {
      for (let dx = 0; dx < def.w; dx++) {
        const frame = frameOf(catalog, def, dx, -k);
        sprites.push({ obj: obj.id, tile: obj.tile, sheet: def.sheet, frame, col: c0 + dx, row: r0 - k, depth: depth + (obj.lift ? 1 : 0), ...(obj.lift ? { dy: obj.lift } : {}) });
      }
    }
    for (const [col, row] of cellsOf(obj.at, def)) {
      const frame = frameOf(catalog, def, col - c0, row - r0, variantAt(def, c0, r0));
      sprites.push({ obj: obj.id, tile: obj.tile, sheet: def.sheet, frame, col, row, depth: depth + (obj.lift ? 1 : 0), ...(obj.lift ? { dy: obj.lift } : {}) });
      if (over) {
        const overFrame = frameOf(catalog, over, col - c0, row - r0);
        sprites.push({ obj: obj.id, tile: over.name, sheet: over.sheet, frame: overFrame, col, row, depth: depth + OVERLAY_LIFT });
      }
    }
  }

  for (const d of map.dirt ?? []) {
    const def = catalog.tiles[d.tile]!;
    const [c0, r0] = d.at;
    const depth = def.layer === 'floor' ? (d.tags?.includes('repair') ? DEPTH.floorCrack : DEPTH.floorDirt) : def.layer === 'wall' ? DEPTH.wallDirt : ySortDepth((r0 + def.h) * ts);
    for (const [col, row] of cellsOf(d.at, def)) {
      sprites.push({ tile: d.tile, sheet: def.sheet, frame: frameOf(catalog, def, col - c0, row - r0), col, row, depth, dirt: d.id, ...(d.lift ? { dy: d.lift } : {}) });
    }
    if (d.snowCap && def.layer !== 'wall') snowCaps.push({ obj: d.id, col: c0, row: r0, depth: depth + OVERLAY_LIFT * 2, dy: d.lift ?? 0 });
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
    snowCaps,
  };
}

/**
 * Grade de células sólidas: paredes e pisos sólidos (água) inteiros + a base
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

/** Retângulo em pixels do mundo. */
export interface PixelRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Corpos de colisão em pixels: paredes e pisos sólidos ocupam a célula inteira; a base de cada móvel sólido só a
 * parte de baixo da célula (`baseDepth`, fração da célula), onde o desenho encosta no chão. Assim ela chega mais
 * perto vindo de cima e passa por trás. A grade de células (solidGrid) continua inteira para caminhos e posicionar.
 */
export function solidBoxes(map: MapData, catalog: TileCatalog, baseDepth = 1): PixelRect[] {
  const ts = map.tileSize;
  const base = baseSolidGrid(map, catalog);
  const boxes: PixelRect[] = solidRects(base).map((r) => ({ x: r.col * ts, y: r.row * ts, w: r.w * ts, h: r.h * ts }));
  const depth = Math.min(1, Math.max(0.1, baseDepth));
  const done = new Set<string>();
  for (const obj of map.objects) {
    const def = catalog.tiles[obj.tile];
    if (!def?.solid) continue;
    // Objeto dentro da parede: a célula inteira (já é parede na prática).
    const d = obj.inWall ? 1 : depth;
    for (const [c, r] of footprintOf(obj.at, def)) {
      const key = `${c},${r}`;
      if (base[r]?.[c] || done.has(key) || c < 0 || c >= map.size.cols) continue;
      done.add(key);
      const h = Math.round(ts * d);
      boxes.push({ x: c * ts, y: (r + 1) * ts - h, w: ts, h });
    }
  }
  return boxes;
}

/**
 * Caixas que só a personagem não atravessa: peças não sólidas da lista (potes, caminhas), na parte de baixo da
 * célula (como a base dos móveis). Os gatos não colidem com elas, e a grade de caminhos não muda.
 */
export function playerBlockBoxes(map: MapData, catalog: TileCatalog, tiles: readonly string[], baseDepth = 1): PixelRect[] {
  const ts = map.tileSize;
  const h = Math.round(ts * Math.min(1, Math.max(0.1, baseDepth)));
  const boxes: PixelRect[] = [];
  for (const obj of map.objects) {
    const def = catalog.tiles[obj.tile];
    if (!def || def.solid || !tiles.includes(obj.tile)) continue;
    for (const [c, r] of footprintOf(obj.at, def)) boxes.push({ x: c * ts, y: (r + 1) * ts - h, w: ts, h });
  }
  return boxes;
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
/** `jumps`: portas do mapa que levam a outro ponto dele mesmo (salão -> jardim): chegar em `from` leva a `to`. */
export function reachableCells(solid: boolean[][], [sc, sr]: Cell, jumps: readonly { from: Cell; to: Cell }[] = []): boolean[][] {
  const seen = solid.map((line) => line.map(() => false));
  const free = (c: number, r: number) => solid[r]?.[c] === false && !seen[r]![c];
  if (!free(sc, sr)) return seen;
  const queue: Cell[] = [[sc, sr]];
  seen[sr]![sc] = true;
  while (queue.length > 0) {
    const [c, r] = queue.shift()!;
    const jumped = jumps.filter((j) => j.from[0] === c && j.from[1] === r).map((j) => j.to);
    for (const [nc, nr] of [[c + 1, r], [c - 1, r], [c, r + 1], [c, r - 1], ...jumped] as Cell[]) {
      if (!free(nc, nr)) continue;
      seen[nr]![nc] = true;
      queue.push([nc, nr]);
    }
  }
  return seen;
}

/** Células sólidas das grades: paredes sólidas e pisos sólidos (água). */
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
