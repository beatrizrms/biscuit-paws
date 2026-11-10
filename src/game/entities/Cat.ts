import Phaser from 'phaser';
import { nextCatGoal, type CatGoal, type CatSpot } from '../../core/cats';
import type { Cell } from '../../core/map';
import type { Rng } from '../../core/rng';
import { ySortDepth } from '../../core/map';
import { content } from '../content';

const SPEED = 40;
const ARRIVE_PX = 2;
const STUCK_MS = 1500;

/** Os objetos dos gatos no mapa (caminha, arranhador, árvore) e quais estão ocupados (um gato por lugar). */
export interface CatPlaces {
  spots(): CatSpot[];
  taken: Set<string>;
}

/** Textura do Cosy Cats para uma variante (carregada no BootScene). */
export const catTexture = (variant: string) => `cat.${variant}`;

/** Um gato no mapa. Decide o que fazer com nextCatGoal (núcleo) e só anima e se move aqui. */
export class CatSprite extends Phaser.Physics.Arcade.Sprite {
  private goal: CatGoal | null = null;
  private goalUntil = 0;
  private lastProgressAt = 0;
  private lastDistance = Infinity;
  private eatAfterWalk = false;
  /** Lugar de um objeto que ele está usando (ocupado em places.taken) e se subiu nele (sem colisão). */
  private using: CatSpot | null = null;
  private perched = false;

  constructor(
    scene: Phaser.Scene,
    readonly catId: string,
    private variant: string,
    x: number,
    y: number,
    private rng: Rng,
    private tileSize: number,
    private solid: () => boolean[][],
    private places?: CatPlaces,
  ) {
    super(scene, x, y, catTexture(variant), 0);
    scene.add.existing(this);
    scene.physics.add.existing(this);
    // Pés na linha de pixel 28 do quadro (README do Cosy Cats).
    this.setOrigin(0.5, 28 / 32);
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setSize(14, 6).setOffset(9, 23);
    body.setCollideWorldBounds(true);
    CatSprite.createAnimations(scene, variant);
    this.play(`${catTexture(variant)}-sit`);
  }

  static createAnimations(scene: Phaser.Scene, variant: string): void {
    const sprites = content.catSprites;
    for (const a of sprites.animations) {
      const key = `${catTexture(variant)}-${a.name}`;
      if (scene.anims.exists(key)) continue;
      const first = a.row * sprites.columns;
      scene.anims.create({
        key,
        frames: scene.anims.generateFrameNumbers(catTexture(variant), { start: first, end: first + a.frames - 1 }),
        frameRate: a.fps,
        repeat: -1,
      });
    }
  }

  /** Vai até a célula e senta lá por um tempo (ex.: comer na tigela). */
  goEat(cell: Cell, now: number): void {
    this.leaveSpot();
    this.goal = { kind: 'walk', to: cell };
    this.eatAfterWalk = true;
    this.lastDistance = Infinity;
    this.lastProgressAt = now;
  }

  /** Senta e fica parado por um tempo (ex.: enquanto o Joca fareja). */
  stay(ms: number, now: number): void {
    this.leaveSpot();
    this.setVelocity(0, 0);
    this.eatAfterWalk = false;
    this.goal = { kind: 'sit', seconds: ms / 1000 };
    this.goalUntil = now + ms;
    this.play(`${catTexture(this.variant)}-sit`, true);
  }

  /** Chamar todo quadro. */
  tick(now: number): void {
    if (!this.goal || (this.goal.kind !== 'walk' && !this.walkingToSpot() && now >= this.goalUntil)) this.pickGoal(now);
    const goal = this.goal!;
    const target = goal.kind === 'walk' ? goal.to : this.walkingToSpot() ? this.using!.cell : null;
    if (target) {
      const ts = this.tileSize;
      const tx = target[0] * ts + ts / 2;
      const ty = (target[1] + 1) * ts - 6;
      const dx = tx - this.x;
      const dy = ty - this.y;
      const dist = Math.hypot(dx, dy);
      if (dist <= ARRIVE_PX) {
        this.setVelocity(0, 0);
        if (goal.kind === 'use') this.arriveAtSpot(goal, now);
        else if (this.eatAfterWalk) {
          this.eatAfterWalk = false;
          this.goal = { kind: 'sit', seconds: 6 };
          this.goalUntil = now + 6000;
          this.play(`${catTexture(this.variant)}-sit`, true);
        } else this.pickGoal(now);
      } else {
        this.setVelocity((dx / dist) * SPEED, (dy / dist) * SPEED);
        const dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up';
        this.play(`${catTexture(this.variant)}-walk_${dir}`, true);
        // Sem progresso por um tempo (bateu em algo): escolhe outra coisa.
        if (dist < this.lastDistance - 0.5) {
          this.lastDistance = dist;
          this.lastProgressAt = now;
        } else if (now - this.lastProgressAt > STUCK_MS) this.pickGoal(now);
      }
    }
    // Em cima do objeto: na frente dele (a profundidade da base do objeto); no chão, pelos pés.
    this.setDepth(this.perched && this.using?.perch ? ySortDepth(this.using.perch.baseY) + 1 : ySortDepth(this.y));
  }

  /** Indo até o lugar do objeto (ainda não chegou). */
  private walkingToSpot(): boolean {
    return this.goal?.kind === 'use' && this.goalUntil === 0;
  }

  /** Chegou na célula do lugar: sobe no objeto (se for em cima) e faz a ação pelo tempo da meta. */
  private arriveAtSpot(goal: Extract<CatGoal, { kind: 'use' }>, now: number): void {
    const perch = goal.spot.perch;
    if (perch) {
      (this.body as Phaser.Physics.Arcade.Body).enable = false;
      this.setPosition(perch.x, perch.y);
      this.perched = true;
    }
    this.goalUntil = now + goal.seconds * 1000;
    this.play(`${catTexture(this.variant)}-${goal.spot.action}`, true);
  }

  /** Larga o lugar do objeto (e desce dele, de volta à célula da frente). */
  private leaveSpot(): void {
    if (!this.using) return;
    this.places?.taken.delete(this.using.id);
    if (this.perched) {
      const ts = this.tileSize;
      const [c, r] = this.using.cell;
      this.setPosition(c * ts + ts / 2, (r + 1) * ts - 6);
      (this.body as Phaser.Physics.Arcade.Body).enable = true;
      (this.body as Phaser.Physics.Arcade.Body).reset(this.x, this.y);
      this.perched = false;
    }
    this.using = null;
  }

  private pickGoal(now: number): void {
    this.leaveSpot();
    this.setVelocity(0, 0);
    this.goal = nextCatGoal(this.rng, this.cell(), this.solid(), this.places?.spots() ?? [], this.places?.taken ?? new Set());
    this.lastDistance = Infinity;
    this.lastProgressAt = now;
    if (this.goal.kind === 'use') {
      // Vai até lá (goalUntil 0 = andando); o lugar fica dele até largar.
      this.using = this.goal.spot;
      this.places?.taken.add(this.goal.spot.id);
      this.goalUntil = 0;
      return;
    }
    if (this.goal.kind === 'walk') return;
    this.goalUntil = now + this.goal.seconds * 1000;
    this.play(`${catTexture(this.variant)}-${this.goal.kind}`, true);
  }

  cell(): Cell {
    return [Math.floor(this.x / this.tileSize), Math.floor((this.y - 1) / this.tileSize)];
  }
}
