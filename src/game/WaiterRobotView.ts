// Robô garçom no café: fica parado na frente da base e, quando o núcleo manda (waiter.going), anda até a louça suja,
// pega (waiter.picked: ela já está na pia ou na lava-louças, para o núcleo) e leva até lá, e volta para a base.
// Só desenha: quem decide a viagem e mexe na louça é o núcleo (service.waiterTick).
import Phaser from 'phaser';
import type { GameSession } from '../core/session';
import { ySortDepth, type Cell } from '../core/map';
import { findPath, pathCorners } from '../core/path';

/** PLACEHOLDER(arte): o robô desenhado por código (scripts/art/placeholders.ts), 32 x 48. */
export const WAITER_KEY = 'waiter_robot';
export const WAITER_IMAGE = 'assets/objects/placeholders/waiter_robot.png';
/** Velocidade (px do jogo por segundo) e quanto ele fica parado pegando ou soltando a louça. */
const SPEED = 55;
const PAUSE_MS = 350;

export class WaiterRobotView {
  private robot: Phaser.GameObjects.Image | null = null;
  private dish: Phaser.GameObjects.Image | null = null;
  private tileSize = 32;
  private grid: () => readonly (readonly boolean[])[] = () => [];
  /** As viagens na fila (uma de cada vez) e o "turno" do desenho: refazer o mapa invalida as viagens em andamento. */
  private queue: Promise<void> = Promise.resolve();
  private generation = 0;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly session: GameSession,
    private readonly dishImage: (vessel: string) => Phaser.GameObjects.Image | undefined,
  ) {
    session.bus.on('waiter.going', ({ at }) => this.enqueue(() => this.goTo(at)));
    session.bus.on('waiter.picked', ({ vessel, to }) => this.enqueue(() => this.carry(vessel, to)));
  }

  /** Mapa refeito (entrou no café, móvel mudou): o robô parado na base (no café com a base posicionada). */
  refresh(mapId: string, tileSize: number, solid: () => readonly (readonly boolean[])[]): void {
    this.clear();
    this.generation++;
    this.queue = Promise.resolve();
    this.tileSize = tileSize;
    this.grid = solid;
    const dock = mapId === this.session.content.map.id ? this.session.service.waiterRobot() : undefined;
    if (!dock || !this.scene.textures.exists(WAITER_KEY)) return;
    const home = this.homeCell();
    if (!home) return;
    const [x, y] = this.pos(home);
    this.robot = this.scene.add.image(x, y, WAITER_KEY).setOrigin(0.5, 1).setDepth(ySortDepth(y));
  }

  clear(): void {
    this.robot?.destroy();
    this.dish?.destroy();
    this.robot = null;
    this.dish = null;
  }

  private enqueue(step: () => Promise<void>): void {
    const gen = this.generation;
    this.queue = this.queue.then(() => (gen === this.generation && this.robot ? step() : undefined));
  }

  /** A célula livre logo abaixo da base (onde ele estaciona); sem, a de um dos lados. */
  private homeCell(): Cell | null {
    const dock = this.session.service.waiterRobot();
    return dock ? this.freeNear(dock.at) : null;
  }

  /** Uma célula livre colada a `at` (embaixo, dos lados, em cima), para ele parar do lado da mesa ou da pia. */
  private freeNear([c, r]: Cell): Cell | null {
    const g = this.grid();
    for (const [dc, dr] of [[0, 1], [-1, 0], [1, 0], [0, -1], [-1, 1], [1, 1]] as const) if (g[r + dr]?.[c + dc] === false) return [c + dc, r + dr];
    return null;
  }

  private pos([c, r]: Cell): [number, number] {
    return [(c + 0.5) * this.tileSize, (r + 1) * this.tileSize - 4];
  }

  /** Vai até a louça (do lado da mesa ou do balcão). */
  private async goTo(at: [number, number]): Promise<void> {
    const stop = this.freeNear(at);
    if (stop) await this.walk(stop);
  }

  /** Pegou a louça: ela vai na bandeja até a pia (ou a lava-louças), sai de lá e ele volta para a base. */
  private async carry(vessel: string, to: [number, number]): Promise<void> {
    const robot = this.robot;
    if (!robot) return;
    await this.wait(PAUSE_MS);
    this.dish?.destroy();
    this.dish = this.dishImage(vessel) ?? null;
    this.dish?.setOrigin(0.5, 1);
    this.follow();
    const stop = this.freeNear(to);
    if (stop) await this.walk(stop);
    await this.wait(PAUSE_MS);
    this.dish?.destroy();
    this.dish = null;
    const home = this.homeCell();
    if (home) await this.walk(home);
  }

  /** Anda de esquina em esquina pelas células livres (sem caminho, vai direto). */
  private async walk(to: Cell): Promise<void> {
    const robot = this.robot;
    if (!robot) return;
    const ts = this.tileSize;
    const from: Cell = [Math.floor(robot.x / ts), Math.floor((robot.y - 1) / ts)];
    const path = findPath(this.grid().map((row) => [...row]), from, to);
    const corners = path ? pathCorners(path) : [to];
    for (const cell of corners) {
      if (!robot.active) return;
      const [x, y] = this.pos(cell);
      await new Promise<void>((done) =>
        this.scene.tweens.add({
          targets: robot,
          x,
          y,
          duration: Math.max(60, (Math.hypot(x - robot.x, y - robot.y) / SPEED) * 1000),
          onUpdate: () => {
            robot.setDepth(ySortDepth(robot.y));
            this.follow();
          },
          onComplete: () => done(),
        }),
      );
    }
  }

  /** A louça na bandeja, em cima dele. */
  private follow(): void {
    if (this.robot && this.dish) this.dish.setPosition(this.robot.x, this.robot.y - 34).setDepth(this.robot.depth + 1);
  }

  private wait(ms: number): Promise<void> {
    return new Promise((done) => this.scene.time.delayedCall(ms, done));
  }
}
