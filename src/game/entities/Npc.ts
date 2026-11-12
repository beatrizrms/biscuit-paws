import Phaser from 'phaser';
import type { Cell, Facing, NpcBusy, NpcIdle } from '../../core/map';
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
    // Arte em 64 px por tile (resolution 2): desenhada na metade, ocupa o mesmo espaço do mundo.
    this.setScale(1 / (def.resolution ?? 1));
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
    for (const [dir, row] of Object.entries(def.sit ?? {})) {
      const name = `${key}-sit_${dir}`;
      if (scene.anims.exists(name)) continue;
      const first = row * def.columns;
      // Sentado parado, respirando devagar (ida e volta).
      scene.anims.create({ key: name, frames: scene.anims.generateFrameNumbers(key, { start: first, end: first + (def.sitFrames ?? 3) - 1 }), frameRate: 2, repeat: -1, yoyo: true });
    }
    for (const [anim, frames] of Object.entries(def.extras)) {
      const name = `${key}-${anim}`;
      if (scene.anims.exists(name)) continue;
      scene.anims.create({ key: name, frames: frames.map((f) => ({ key, frame: f })), frameRate: def.extrasFps ?? 3, repeat: -1 });
    }
  }

  /** Parada, virada para uma direção (quadro 0 da caminhada). */
  face(dir: Facing): void {
    // A caminhada pode terminar depois de o mapa trocar (NPC já destruído): sem isso, o erro trava o relógio da cena.
    if (!this.active) return;
    this.anims.stop();
    this.setFrame(this.def.walk[dir] * this.def.columns);
  }

  /** Senta virado para `dir` (a cadeira do mapa fica por baixo). false = este NPC não tem a pose sentada. */
  sit(dir: Facing): boolean {
    if (!this.active || !this.def.sit) return false;
    this.play(`${npcTexture(this.def.id)}-sit_${dir}`, true);
    return true;
  }

  /** Anda até a célula (primeiro na horizontal, depois na vertical). */
  async walkTo([col, row]: Cell): Promise<void> {
    const ts = this.tileSize;
    const tx = col * ts + ts / 2;
    const ty = (row + 1) * ts - 4;
    if (Math.abs(tx - this.x) > 0.5) await this.leg(tx, this.y, tx > this.x ? 'right' : 'left');
    if (Math.abs(ty - this.y) > 0.5) await this.leg(this.x, ty, ty > this.y ? 'down' : 'up');
  }

  /** Direção do trecho que ele está andando (para retomar a caminhada depois de uma parada). */
  private legDir: Facing | null = null;

  /** Volta a andar na direção do trecho (depois de parar para conversar). */
  resumeWalk(): void {
    if (this.legDir) this.play(`${npcTexture(this.def.id)}-walk_${this.legDir}`, true);
  }

  private leg(x: number, y: number, dir: Facing): Promise<void> {
    const dist = Math.hypot(x - this.x, y - this.y);
    this.legDir = dir;
    this.play(`${npcTexture(this.def.id)}-walk_${dir}`, true);
    return new Promise((resolve) => {
      this.scene.tweens.add({
        targets: this,
        x,
        y,
        duration: (dist / SPEED) * 1000,
        onUpdate: () => this.updateDepth(),
        onComplete: () => {
          this.legDir = null;
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

  /** Fica repetindo uma animação extra (o construtor martelando na obra). */
  loop(anim: string): void {
    if (this.active) this.play(`${npcTexture(this.def.id)}-${anim}`, true);
  }

  /**
   * Parada no posto (a atendente no caixa): com `near()` verdadeiro, repete a animação de atender; senão, toca a
   * animação à toa uma vez e fica parada um tempo sorteado. Só visual (o sorteio não mexe em regra do jogo).
   */
  attend(idle: NpcIdle | undefined, busy: NpcBusy | undefined, near: () => boolean): void {
    const key = npcTexture(this.def.id);
    const rest = this.frame.name;
    let mode: 'busy' | 'idle' | 'pause' = 'pause';
    let pauseLeft = 0;
    const tick = (_: number, delta: number) => {
      if (!this.active) return;
      if (busy && near()) {
        if (mode !== 'busy') this.play(`${key}-${busy.anim}`, true);
        mode = 'busy';
        return;
      }
      if (mode === 'busy' || (mode === 'idle' && !this.anims.isPlaying)) {
        this.anims.stop();
        this.setFrame(rest);
        mode = 'pause';
        pauseLeft = idle ? Phaser.Math.Between(idle.pauseMs[0], idle.pauseMs[1]) : Infinity;
      }
      if (mode !== 'pause' || !idle) return;
      pauseLeft -= delta;
      if (pauseLeft > 0) return;
      this.play({ key: `${key}-${idle.anim}`, repeat: 0 });
      mode = 'idle';
    };
    this.scene.events.on(Phaser.Scenes.Events.UPDATE, tick);
    this.once(Phaser.GameObjects.Events.DESTROY, () => this.scene?.events.off(Phaser.Scenes.Events.UPDATE, tick));
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
