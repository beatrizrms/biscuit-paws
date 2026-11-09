import Phaser from 'phaser';
import type { Cell, Facing } from '../../core/map';
import type { NpcDef } from '../../core/script';
import { ySortDepth } from '../../core/map';

const SPEED = 70;

/** Textura da folha de um NPC (carregada no BootScene). */
export const npcTexture = (npcId: string) => `npc:${npcId}`;

/** Um personagem que segue roteiros: anda pela grade, vira, acena. A posição (x, y) é a base dos pés. */
export class NpcSprite extends Phaser.GameObjects.Sprite {
  constructor(
    scene: Phaser.Scene,
    readonly def: NpcDef,
    x: number,
    y: number,
    private tileSize: number,
  ) {
    super(scene, x, y, npcTexture(def.id), 0);
    scene.add.existing(this);
    this.setOrigin(0.5, 1);
    NpcSprite.createAnimations(scene, def);
    this.updateDepth();
  }

  static createAnimations(scene: Phaser.Scene, def: NpcDef): void {
    const key = npcTexture(def.id);
    for (const [dir, row] of Object.entries(def.walk)) {
      const name = `${key}-walk_${dir}`;
      if (scene.anims.exists(name)) continue;
      const first = row * def.columns;
      scene.anims.create({ key: name, frames: scene.anims.generateFrameNumbers(key, { start: first, end: first + 3 }), frameRate: def.fps, repeat: -1 });
    }
    for (const [anim, frames] of Object.entries(def.extras)) {
      const name = `${key}-${anim}`;
      if (scene.anims.exists(name)) continue;
      scene.anims.create({ key: name, frames: frames.map((f) => ({ key, frame: f })), frameRate: 3, repeat: -1 });
    }
  }

  /** Parada, virada para uma direção (quadro 0 da caminhada). */
  face(dir: Facing): void {
    // A caminhada pode terminar depois de o mapa trocar (NPC já destruído): sem isso, o erro trava o relógio da cena.
    if (!this.active) return;
    this.anims.stop();
    this.setFrame(this.def.walk[dir] * this.def.columns);
  }

  /** Anda até a célula (primeiro na horizontal, depois na vertical). */
  async walkTo([col, row]: Cell): Promise<void> {
    const ts = this.tileSize;
    const tx = col * ts + ts / 2;
    const ty = (row + 1) * ts - 4;
    if (Math.abs(tx - this.x) > 0.5) await this.leg(tx, this.y, tx > this.x ? 'right' : 'left');
    if (Math.abs(ty - this.y) > 0.5) await this.leg(this.x, ty, ty > this.y ? 'down' : 'up');
  }

  private leg(x: number, y: number, dir: Facing): Promise<void> {
    const dist = Math.hypot(x - this.x, y - this.y);
    this.play(`${npcTexture(this.def.id)}-walk_${dir}`, true);
    return new Promise((resolve) => {
      this.scene.tweens.add({
        targets: this,
        x,
        y,
        duration: (dist / SPEED) * 1000,
        onUpdate: () => this.updateDepth(),
        onComplete: () => {
          this.face(dir);
          resolve();
        },
      });
    });
  }

  /** Toca uma animação extra (acenar, segurar as chaves...) por um tempo. */
  async act(anim: string, ms: number): Promise<void> {
    this.play(`${npcTexture(this.def.id)}-${anim}`, true);
    await new Promise((r) => this.scene.time.delayedCall(ms, r));
  }

  /** Sai de cena (some devagar). */
  leave(): Promise<void> {
    return new Promise((resolve) => {
      this.scene.tweens.add({ targets: this, alpha: 0, duration: 400, onComplete: () => (this.destroy(), resolve()) });
    });
  }

  updateDepth(): void {
    this.setDepth(ySortDepth(this.y));
  }
}
