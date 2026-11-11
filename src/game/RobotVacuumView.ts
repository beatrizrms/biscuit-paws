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
    const start = this.startCell(dock.at);
    if (!start) return;
    // A volta pelas células livres (desvia dos móveis); sem caminho, vai direto.
    const path = findPath(solid(), start, dock.at);
    const stops = (path ? pathCorners(path).slice(0, -1) : []).map(([c, r]): [number, number] => [(c + 0.5) * tileSize, (r + 1) * tileSize - 6]);
    this.returnHome((start[0] + 0.5) * tileSize, (start[1] + 1) * tileSize - 6, [...stops, [dockX, dockY]], (dock.at[1] + 1) * tileSize);
  }

  /** Onde ele está quando ela chega: o lugar da poeira do dia mais longe da base (ele vinha limpando por lá). */
  private startCell(dock: Cell): Cell | null {
    const { state, content } = this.session;
    const spots = (content.map.dirt ?? []).filter((d) => d.tags.includes('daily')).map((d): Cell => state.dirtAt?.[d.id] ?? d.at);
    const far = spots.sort((a, b) => Math.hypot(b[0] - dock[0], b[1] - dock[1]) - Math.hypot(a[0] - dock[0], a[1] - dock[1]))[0];
    return far && (far[0] !== dock[0] || far[1] !== dock[1]) ? far : null;
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
        this.shine(robot.x, robot.y - 3);
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
