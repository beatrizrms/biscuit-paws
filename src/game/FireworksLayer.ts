// Fogos de artifício do Ano Novo, desenhados por código (data/festive.json: newYear.fireworks): um foguete sobe do
// pé da tela e estoura em faíscas coloridas no alto. Brilham por cima da cor da noite (blend ADD). Só desenha.
import Phaser from 'phaser';
import type { FireworksFx } from '../core/newYear';
import { hexToRgb, rgbToHex } from '../core/time';
import { services } from './services';

/** Acima da cor do dia/noite (150 000) e das luzes (150 001): à meia-noite, os fogos não escurecem. */
const DEPTH = 150_100;
const SPARK = 'firework-spark';
const FLASH = 'firework-flash';
/** Quanto o foguete leva para subir (ms). */
const RISE_MS = 650;

export class FireworksLayer {
  private timer?: Phaser.Time.TimerEvent;
  private parts = new Set<Phaser.GameObjects.GameObject>();

  constructor(private scene: Phaser.Scene) {
    if (scene.textures.exists(SPARK)) return;
    // A faísca: uma cruzinha de 3 px (o meio cheio, as pontas mais fracas).
    const g = scene.make.graphics({ x: 0, y: 0 }, false);
    g.fillStyle(0xffffff, 0.6).fillRect(1, 0, 1, 3).fillRect(0, 1, 3, 1);
    g.fillStyle(0xffffff, 1).fillRect(1, 1, 1, 1);
    g.generateTexture(SPARK, 3, 3);
    // O clarão do estouro: um disco em anéis, mais forte no meio.
    g.clear();
    for (const [r, a] of [[9, 0.15], [6, 0.3], [3, 0.6]] as const) g.fillStyle(0xffffff, a).fillCircle(9, 9, r);
    g.generateTexture(FLASH, 18, 18);
    g.destroy();
  }

  /** Estouros por `ms` (cada um a um intervalo sorteado de `fx.everyMs`), no céu da parte da rua que aparece. */
  play(ms: number, fx: FireworksFx): void {
    this.stop();
    const until = this.scene.time.now + ms;
    const next = () => {
      if (this.scene.time.now >= until) return;
      this.launch(fx);
      this.timer = this.scene.time.delayedCall(Phaser.Math.Between(fx.everyMs[0], fx.everyMs[1]), next);
    };
    next();
  }

  stop(): void {
    this.timer?.remove();
    this.timer = undefined;
    this.parts.forEach((p) => p.destroy());
    this.parts.clear();
  }

  private launch(fx: FireworksFx): void {
    const view = this.scene.cameras.main.worldView;
    // No alto da tela, longe do HUD (canto de cima à direita).
    const x = Math.round(view.x + view.width * Phaser.Math.FloatBetween(0.1, 0.72));
    const y = Math.round(view.y + view.height * Phaser.Math.FloatBetween(0.06, 0.3));
    const color = rgbToHex(hexToRgb(Phaser.Utils.Array.GetRandom(fx.colors)));
    // O foguete: uma faísca que sobe piscando do pé da tela até o ponto do estouro.
    const rocket = this.scene.add.image(x, view.bottom, SPARK).setTint(color).setDepth(DEPTH).setBlendMode(Phaser.BlendModes.ADD);
    // O rastro do foguete.
    const trail = this.scene.add
      .particles(0, 0, SPARK, { follow: rocket, lifespan: 260, frequency: 25, alpha: { start: 0.7, end: 0 }, tint: color, speedY: { min: 5, max: 20 } })
      .setDepth(DEPTH)
      .setBlendMode(Phaser.BlendModes.ADD);
    this.parts.add(rocket);
    this.parts.add(trail);
    this.scene.tweens.add({
      targets: rocket,
      y,
      alpha: { from: 1, to: 0.6 },
      duration: RISE_MS,
      ease: 'Quad.easeOut',
      onComplete: () => {
        this.parts.delete(rocket);
        rocket.destroy();
        trail.stop();
        this.scene.time.delayedCall(300, () => {
          this.parts.delete(trail);
          trail.destroy();
        });
        this.burst(x, y, color, fx);
      },
    });
  }

  /** O estouro: faíscas para todo lado, quase todas da cor sorteada e algumas brancas, caindo devagar e sumindo. */
  private burst(x: number, y: number, color: number, fx: FireworksFx): void {
    const emitter = this.scene.add
      .particles(x, y, SPARK, {
        speed: { min: fx.speed[0], max: fx.speed[1] },
        angle: { min: 0, max: 360 },
        lifespan: { min: fx.lifespan[0], max: fx.lifespan[1] },
        gravityY: 28,
        alpha: { start: 1, end: 0 },
        tint: [color, color, color, 0xffffff],
        emitting: false,
      })
      .setDepth(DEPTH)
      .setBlendMode(Phaser.BlendModes.ADD);
    emitter.explode(Phaser.Math.Between(fx.particles[0], fx.particles[1]));
    this.parts.add(emitter);
    // O estouro: o mesmo som com o tom variando um pouco (não soa repetido).
    services().audio.sfx('firework', { rate: Phaser.Math.FloatBetween(0.85, 1.15) });
    // O clarão: acende e some rápido.
    const flash = this.scene.add.image(x, y, FLASH).setTint(color).setDepth(DEPTH).setBlendMode(Phaser.BlendModes.ADD).setScale(0.6);
    this.parts.add(flash);
    this.scene.tweens.add({
      targets: flash,
      scale: 2,
      alpha: { from: 0.9, to: 0 },
      duration: 380,
      ease: 'Quad.easeOut',
      onComplete: () => {
        this.parts.delete(flash);
        flash.destroy();
      },
    });
    this.scene.time.delayedCall(fx.lifespan[1] + 100, () => {
      this.parts.delete(emitter);
      emitter.destroy();
    });
  }
}
