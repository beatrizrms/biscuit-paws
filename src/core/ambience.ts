// Luz e sombra de ambiente (sem mudar a arte): onde vai sombra de contato embaixo dos objetos, o escurecido onde
// a parede encontra o chão (oclusão) e a luz das janelas no piso. Calcula só as formas, em pixels do mundo, a
// partir do mapa; quem desenha é src/game/AmbienceLayer.ts. Números em data/daynight.json: ambience.
// Puro: sem Phaser, DOM ou window.
import type { MapData } from './map';
import type { TileCatalog } from './tiles';

export interface AmbienceConfig {
  /** Sombra de contato: opacidade no centro, altura (px) e largura em relação à peça. */
  shadowAlpha: number;
  shadowHeight: number;
  shadowWidth: number;
  /** Sombra dos que andam (personagem, gatos, NPCs): largura em px. */
  actorShadow: { person: number; cat: number };
  /** Oclusão onde a parede encontra o chão: largura da faixa (px) e opacidade junto da parede. */
  edgeSize: number;
  edgeAlpha: number;
  /** Janelas (tiles) que jogam luz no piso nos interiores: até quantas células para baixo, quanto entorta, cor e opacidade de dia. */
  windowTiles: string[];
  windowLength: number;
  windowSkew: number;
  windowColor: string;
  windowAlpha: number;
  /** Escurecido macio nas bordas da tela (0 = sem). */
  vignetteAlpha: number;
}

/**
 * Sombra de contato: centro da base da célula (x, y) e largura. A arte nem sempre encosta no fundo da célula (pote,
 * caminha, arranhador): com `tile` e o canto da peça (`left`, `top`), quem desenha mede a base desenhada e põe a
 * sombra ali; x, y e w ficam para quando não dá para medir.
 */
export interface ContactShadow {
  x: number;
  y: number;
  w: number;
  tile: string;
  left: number;
  top: number;
}

/** Faixa de oclusão junto da parede: retângulo e de que lado está a parede (o lado escuro). */
export interface WallEdge {
  x: number;
  y: number;
  w: number;
  h: number;
  wall: 'up' | 'left' | 'right';
}

/** Luz de janela no piso: os quatro cantos (topo junto da parede, base mais para dentro e entortada). */
export interface WindowLight {
  points: [number, number][];
}

export interface Ambience {
  shadows: ContactShadow[];
  edges: WallEdge[];
  windows: WindowLight[];
}

const EMPTY = '.';

/**
 * As formas do mapa: sombra embaixo de cada objeto que fica no chão (não os de cima do balcão nem os de parede/piso),
 * faixas onde a parede encontra o piso (em cima e dos lados de paredes verticais) e, nos interiores, a luz das janelas.
 */
export function ambienceOf(map: MapData, catalog: TileCatalog, cfg: AmbienceConfig, indoor: boolean): Ambience {
  const ts = map.tileSize;
  const walls = map.layers.walls ?? [];
  const rows = map.size.rows;
  const cols = map.size.cols;
  const isWall = (c: number, r: number) => r >= 0 && r < rows && c >= 0 && c < cols && (walls[r]?.[c] ?? EMPTY) !== EMPTY;
  const isOpen = (c: number, r: number) => r >= 0 && r < rows && c >= 0 && c < cols && !isWall(c, r);

  const shadows: ContactShadow[] = [];
  for (const obj of map.objects) {
    const def = catalog.tiles[obj.tile];
    // Só o que fica no chão: objeto em cima de outro (lift: cafeteira no balcão) já tem a sombra do de baixo.
    if (!def || def.layer !== 'object' || obj.lift) continue;
    const [c0, r0] = obj.at;
    shadows.push({ x: (c0 + def.w / 2) * ts, y: (r0 + def.h) * ts - 2, w: def.w * ts * cfg.shadowWidth, tile: obj.tile, left: c0 * ts, top: r0 * ts });
  }

  const edges: WallEdge[] = [];
  const e = cfg.edgeSize;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (!isWall(c, r)) continue;
      // Parede com piso embaixo: a faixa no topo do piso.
      if (isOpen(c, r + 1)) edges.push({ x: c * ts, y: (r + 1) * ts, w: ts, h: e, wall: 'up' });
      // Parede vertical (piso dos lados): faixa ao lado, só onde há piso também em cima ou embaixo (não no meio do muro de cima).
      const vertical = isWall(c, r - 1) || isWall(c, r + 1);
      if (vertical && isOpen(c - 1, r) && (isOpen(c - 1, r - 1) || isOpen(c - 1, r + 1))) edges.push({ x: c * ts - e, y: r * ts, w: e, h: ts, wall: 'right' });
      if (vertical && isOpen(c + 1, r) && (isOpen(c + 1, r - 1) || isOpen(c + 1, r + 1))) edges.push({ x: (c + 1) * ts, y: r * ts, w: e, h: ts, wall: 'left' });
    }
  }

  const windows: WindowLight[] = [];
  if (indoor) {
    for (const obj of map.objects) {
      if (!cfg.windowTiles.includes(obj.tile)) continue;
      const def = catalog.tiles[obj.tile];
      if (!def) continue;
      const [c0, r0] = obj.at;
      // O piso começa na primeira linha aberta embaixo da janela.
      let floorRow = r0 + def.h;
      while (floorRow < rows && isWall(c0, floorRow)) floorRow++;
      if (floorRow >= rows) continue;
      const x0 = c0 * ts;
      const x1 = (c0 + def.w) * ts;
      const y0 = floorRow * ts;
      const y1 = Math.min(rows, floorRow + cfg.windowLength) * ts;
      const k = cfg.windowSkew;
      // Um pouco mais larga embaixo (a luz abre) e entortada para o lado (o sol vem de cima e de lado).
      windows.push({ points: [[x0, y0], [x1, y0], [x1 + k + ts * 0.25, y1], [x0 + k - ts * 0.25, y1]] });
    }
  }
  return { shadows, edges, windows };
}
