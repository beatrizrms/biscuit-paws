// Robô aspirador no café: fica parado em cima da base (o item posicionado) e, na primeira vez que ela entra no café
// no dia, está terminando o serviço: volta andando até a base, deixando um brilho de pano molhado no chão que some.
// Só desenha: quem limpa a poeira é o núcleo (session.dirtComesBack, de manhã).
import Phaser from 'phaser';
import type { GameSession } from '../core/session';
import { DEPTH, ySortDepth, type Cell } from '../core/map';
import { findPath, pathCorners } from '../core/path';

/** A imagem do robô (80 x 80, carregada no BootScene) e a escala da arte nova (64 px de arte = uma célula de 32). */
export const ROBOT_KEY = 'robot_vacuum';
export const ROBOT_IMAGE = 'assets/objects/pixellab/robo_aspirador.png';
const ART_SCALE = 0.5;
/** Velocidade da volta (px do jogo por segundo) e o brilho do pano (a cada quantos ms, e quanto tempo até sumir). */
const SPEED = 40;
const SHINE_EVERY_MS = 70;
const SHINE_FADE_MS = 2600;
/** Quantos px atrás do robô o brilho do pano aparece. */
const SHINE_BEHIND = 9;
/** De onde ele volta: entre tantas células (andando) da frente da base. */
const START_MIN = 4;
const START_MAX = 7;
/** Estacionado: os pés do robô ficam tantos px abaixo da base da célula da base (encostado na frente dela). */
const DOCK_DROP = 14;

export class RobotVacuumView {
  private robot: Phaser.GameObjects.Image | null = null;
  private trail: Phaser.GameObjects.Ellipse[] = [];
  private tween: Phaser.Tweens.Tween | null = null;
  /** O dia em que ela já viu a volta (não fica no save: recarregar mostra de novo, sem mudar nada). */
  private shownOn = -1;
  /** O dia em que ela viu o café sem robô (comprou hoje: a volta só começa amanhã). */
  private noRobotOn = -1;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly session: GameSession,
  ) {}

  /** Mapa refeito (entrou no café, móvel mudou): redesenha o robô; na primeira entrada do dia, a volta para a base. */
  refresh(mapId: string, tileSize: number, solid: () => readonly (readonly boolean[])[] = () => []): void {
    this.clear();
    const inCafe = mapId === this.session.content.map.id;
    const dock = inCafe ? this.session.robotVacuum() : undefined;
    if (inCafe && !dock) this.noRobotOn = this.session.state.day;
    if (!dock) return;
    if (!this.scene.textures.exists(ROBOT_KEY)) return;
    const dockX = (dock.at[0] + 0.5) * tileSize;
    const dockY = (dock.at[1] + 1) * tileSize + DOCK_DROP;
    this.robot = this.scene.add.image(dockX, dockY, ROBOT_KEY).setOrigin(0.5, 1).setScale(ART_SCALE);
    this.robot.setDepth(ySortDepth((dock.at[1] + 1) * tileSize) + 1);
    const day = this.session.state.day;
    if (this.shownOn === day || this.noRobotOn === day || !this.session.state.flags['prologue.done']) return;
    this.shownOn = day;
    // A volta pelas células livres: desvia de todo móvel (até dos que os gatos atravessam, como potes e caixa de
    // areia) e não passa por cima da base. Ele chega de frente: vai até a célula logo abaixo da frente da base e sobe
    // reto até estacionar.
    const grid = this.robotGrid(mapId, solid());
    const free = ([c, r]: Cell) => grid[r]?.[c] === false;
    const front: Cell = [dock.at[0], dock.at[1] + 1];
    const approach: Cell = free([front[0], front[1] + 1]) ? [front[0], front[1] + 1] : front;
    // A frente da base só no fim (de baixo para cima): no caminho até a aproximação ela conta como ocupada.
    if (approach !== front) grid[front[1]]![front[0]] = true;
    const start = this.startCell(grid, approach);
    if (!start) return;
    const path = findPath(grid, start, approach);
    if (!path) return;
    const stops = (path ? pathCorners(path) : []).map(([c, r]): [number, number] => [(c + 0.5) * tileSize, (r + 1) * tileSize - 6]);
    this.returnHome((start[0] + 0.5) * tileSize, (start[1] + 1) * tileSize - 6, [...stops, [dockX, dockY]], (dock.at[1] + 1) * tileSize);
  }

  /** O chão por onde o robô anda: o mapa, sem nenhuma célula com móvel (a camada de objetos; tapete e piso, ele passa). */
  private robotGrid(mapId: string, solid: readonly (readonly boolean[])[]): boolean[][] {
    const grid = solid.map((row) => [...row]);
    const { catalog } = this.session.content;
    for (const o of this.session.mapData(mapId).objects) {
      const def = catalog.tiles[o.tile];
      if (!def || def.layer !== 'object') continue;
      for (let dy = 0; dy < def.h; dy++) for (let dx = 0; dx < def.w; dx++) if (grid[o.at[1] + dy]) grid[o.at[1] + dy]![o.at[0] + dx] = true;
    }
    return grid;
  }

  /**
   * Onde ele está quando ela chega: perto da base (de START_MIN a START_MAX células andando), no pedaço mais vazio do
   * salão (mais chão livre em volta), para a volta ser curta e longe dos móveis.
   */
  private startCell(grid: readonly (readonly boolean[])[], approach: Cell): Cell | null {
    const free = (c: number, r: number) => grid[r]?.[c] === false;
    let best: { at: Cell; score: number } | null = null;
    for (let r = approach[1] - START_MAX; r <= approach[1] + START_MAX; r++) {
      for (let c = approach[0] - START_MAX; c <= approach[0] + START_MAX; c++) {
        if (!free(c, r)) continue;
        const steps = findPath(grid, [c, r], approach)?.length;
        if (steps === undefined || steps - 1 < START_MIN || steps - 1 > START_MAX) continue;
        let open = 0;
        for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) if (free(c + dx, r + dy)) open++;
        // Mais vazio primeiro; empate: o mais perto da base.
        const score = open * 10 - steps;
        if (!best || score > best.score) best = { at: [c, r], score };
      }
    }
    return best?.at ?? null;
  }

  /** Anda de esquina em esquina até a base (a última parada). */
  private returnHome(x0: number, y0: number, stops: [number, number][], dockBase: number): void {
    const robot = this.robot!;
    robot.setPosition(x0, y0).setDepth(ySortDepth(y0));
    const [next, ...rest] = stops;
    if (!next) return;
    this.leg(next[0], next[1], rest, dockBase);
  }

  private leg(x1: number, y1: number, rest: [number, number][], dockBase: number): void {
    const robot = this.robot;
    if (!robot) return;
    const ms = Math.max(60, (Math.hypot(x1 - robot.x, y1 - robot.y) / SPEED) * 1000);
    let lastShine = 0;
    // O pano molhado fica para trás: o brilho nasce atrás dele, no sentido contrário ao que ele anda.
    const len = Math.hypot(x1 - robot.x, y1 - robot.y) || 1;
    const [bx, by] = [-(x1 - robot.x) / len, -(y1 - robot.y) / len];
    this.tween = this.scene.tweens.add({
      targets: robot,
      x: x1,
      y: y1,
      duration: ms,
      ease: rest.length ? 'Linear' : 'Sine.easeOut',
      onUpdate: () => {
        robot.setDepth(ySortDepth(robot.y));
        const now = this.scene.time.now;
        if (now - lastShine < SHINE_EVERY_MS) return;
        lastShine = now;
        this.shine(robot.x + bx * SHINE_BEHIND, robot.y - 3 + by * SHINE_BEHIND);
      },
      onComplete: () => {
        this.tween = null;
        const [next, ...more] = rest;
        if (next) return this.leg(next[0], next[1], more, dockBase);
        robot.setDepth(ySortDepth(dockBase) + 1);
      },
    });
  }

  /** Um pedacinho do chão molhado: claro, bem fraco, e some devagar. */
  private shine(x: number, y: number): void {
    const s = this.scene.add.ellipse(x, y, 15, 6, 0xffffff, 0.16).setDepth(DEPTH.floorDirt + 0.01);
    this.trail.push(s);
    this.scene.tweens.add({
      targets: s,
      alpha: 0,
      duration: SHINE_FADE_MS,
      ease: 'Quad.easeIn',
      onComplete: () => {
        s.destroy();
        this.trail = this.trail.filter((t) => t !== s);
      },
    });
  }

  private clear(): void {
    this.tween?.stop();
    this.tween = null;
    this.robot?.destroy();
    this.robot = null;
    this.trail.forEach((t) => t.destroy());
    this.trail = [];
  }
}
