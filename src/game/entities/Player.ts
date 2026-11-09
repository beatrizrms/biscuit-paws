import Phaser from 'phaser';
import playerJson from '../../../data/player.json';
import { movementFromInput, type Direction, type InputState } from '../../core/movement';
import { ySortDepth } from '../../core/map';
import type { Pose } from '../../core/appearance';
import { content } from '../content';
import { allPoseTextures, PLAYER_IDLE_TEXTURE, PLAYER_TEXTURE, playerFrame, poseTexture } from '../playerLook';

const DIRECTIONS = playerJson.directions as Direction[];
const C = content.character;

/** A jogadora. A posição (x, y) é o meio da base dos pés. Desenho: playerLook.ts (camadas do criador). */
export class Player extends Phaser.Physics.Arcade.Sprite {
  private facing: Direction = 'down';
  /** Multiplica a velocidade (ex.: carregando coisas). */
  speedFactor = 1;
  /** Textura de andar: a normal ou uma pose que anda (bandeja, gato no colo). */
  private look = PLAYER_TEXTURE;
  /** Ação parada em andamento (varrer, lavar...): a animação dela manda até acabar. */
  private acting = false;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, PLAYER_TEXTURE, 0);
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setOrigin(0.5, 1);
    // Arte em 64 px (manequim): o quadro tem `resolution` pixels por pixel do jogo.
    const frame = playerFrame();
    this.setScale(1 / frame.resolution);

    // Colisão só nos pés, centrada na base do quadro (em pixels do quadro: a escala do sprite reduz).
    const width = playerJson.feet.width * frame.resolution;
    const height = playerJson.feet.height * frame.resolution;
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setSize(width, height);
    body.setOffset((frame.width - width) / 2, frame.height - height);
    body.setCollideWorldBounds(true);

    Player.createAnimations(scene);
    this.idle();
  }

  /** Uma animação por textura (normal e poses) e direção: "<textura>-<direção>". */
  static createAnimations(scene: Phaser.Scene): void {
    const sheets = [{ key: PLAYER_TEXTURE, fps: playerJson.fps }, ...allPoseTextures().map(({ key, pose }) => ({ key, fps: C.poses[pose].fps }))];
    for (const { key: texture, fps } of sheets) {
      if (!scene.textures.exists(texture)) continue;
      DIRECTIONS.forEach((dir, row) => {
        const key = `${texture}-${dir}`;
        if (scene.anims.exists(key)) return;
        const first = row * playerJson.walkFrames;
        scene.anims.create({
          key,
          frames: scene.anims.generateFrameNumbers(texture, { start: first, end: first + playerJson.walkFrames - 1 }),
          frameRate: fps,
          repeat: -1,
        });
      });
    }
  }

  move(input: InputState): void {
    if (this.acting) return;
    const m = movementFromInput(input, playerJson.speed * this.speedFactor, this.facing);
    this.facing = m.facing;
    this.setVelocity(m.vx, m.vy);
    if (m.moving) this.anims.play(`${this.look}-${m.facing}`, true);
    else this.idle();
  }

  /** Para onde ela está olhando. */
  facingDirection(): Direction {
    return this.facing;
  }

  /** Vira para uma direção (parada). */
  face(direction: Direction): void {
    this.facing = direction;
    this.setVelocity(0, 0);
    if (!this.acting) this.idle();
  }

  /** Pose de carregar, que anda junto: bandeja, gato no colo (na cor do gato) ou nenhuma. */
  setCarryPose(pose: Extract<Pose, 'tray' | 'cat'> | null, catColor?: string): void {
    const look = pose ? poseTexture(pose, catColor) : PLAYER_TEXTURE;
    if (look === this.look || !this.scene.textures.exists(look)) return;
    this.look = look;
    if (this.acting) return;
    if (this.anims.isPlaying) this.anims.play(`${this.look}-${this.facing}`, true);
    else this.idle();
  }

  /** Ação parada (varrer, lavar, operar, mexer, limpar a mesa): anima por `ms` e volta. */
  async playAction(pose: Pose, ms: number): Promise<void> {
    const key = poseTexture(pose);
    if (!this.scene.textures.exists(key)) return;
    this.acting = true;
    this.setVelocity(0, 0);
    this.anims.play(`${key}-${this.facing}`, true);
    await new Promise<void>((resolve) => this.scene.time.delayedCall(ms, resolve));
    this.acting = false;
    this.idle();
  }

  isActing(): boolean {
    return this.acting;
  }

  /** Y-sort: a profundidade é a base dos pés. */
  updateDepth(): void {
    this.setDepth(ySortDepth(this.y));
  }

  private idle(): void {
    this.anims.stop();
    // Andando normal e com a folha parada (manequim): em pé, pernas juntas. Nas poses (bandeja, gato), o 1º quadro delas.
    const still = this.look === PLAYER_TEXTURE && this.scene.textures.exists(PLAYER_IDLE_TEXTURE) ? PLAYER_IDLE_TEXTURE : this.look;
    this.setTexture(still, DIRECTIONS.indexOf(this.facing) * playerJson.walkFrames);
  }
}
