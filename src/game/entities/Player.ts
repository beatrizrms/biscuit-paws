import Phaser from 'phaser';
import playerJson from '../../../data/player.json';
import { movementFromInput, type Direction, type InputState } from '../../core/movement';
import { ySortDepth } from '../../core/map';
import { TEXTURE } from '../scenes/BootScene';

const DIRECTIONS = playerJson.directions as Direction[];

/** A jogadora. A posição (x, y) é o meio da base dos pés. */
export class Player extends Phaser.Physics.Arcade.Sprite {
  private facing: Direction = 'down';

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, TEXTURE.player, 0);
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setOrigin(0.5, 1);

    // Colisão só nos pés, centrada na base do quadro.
    const { width, height } = playerJson.feet;
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setSize(width, height);
    body.setOffset((playerJson.frameWidth - width) / 2, playerJson.frameHeight - height);
    body.setCollideWorldBounds(true);

    Player.createAnimations(scene);
    this.idle();
  }

  static createAnimations(scene: Phaser.Scene): void {
    DIRECTIONS.forEach((dir, row) => {
      const key = `player-walk-${dir}`;
      if (scene.anims.exists(key)) return;
      const first = row * playerJson.walkFrames;
      scene.anims.create({
        key,
        frames: scene.anims.generateFrameNumbers(TEXTURE.player, { start: first, end: first + playerJson.walkFrames - 1 }),
        frameRate: playerJson.fps,
        repeat: -1,
      });
    });
  }

  move(input: InputState): void {
    const m = movementFromInput(input, playerJson.speed, this.facing);
    this.facing = m.facing;
    this.setVelocity(m.vx, m.vy);
    if (m.moving) this.anims.play(`player-walk-${m.facing}`, true);
    else this.idle();
  }

  /** Y-sort: a profundidade é a base dos pés. */
  updateDepth(): void {
    this.setDepth(ySortDepth(this.y));
  }

  private idle(): void {
    this.anims.stop();
    this.setFrame(DIRECTIONS.indexOf(this.facing) * playerJson.walkFrames);
  }
}
