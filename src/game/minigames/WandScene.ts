// Brincar com a varinha: tela fixa (um tapete), o gato do café em tamanho 2x e a varinha seguindo o mouse.
// A regra (perseguição, empolgação, enjoo, bote) mora em src/core/wand.ts; aqui só se desenha e se lê o mouse.
import Phaser from 'phaser';
import type { MiniGameResult } from '../../core/minigame';
import { paramsOf } from '../../core/minigame';
import { FULL_EXCITEMENT, newWand, stepWand, wandOutcome, type WandEvents, type WandParams, type WandState } from '../../core/wand';
import { content, uiText } from '../content';
import { CatSprite, catTexture } from '../entities/Cat';
import { services } from '../services';
import { loadSheets, WAND } from './assets';
import { MiniGameScene } from './MiniGameScene';

export const WAND_SCENE = 'MiniGame.wand';

/**
 * A ponta da varinha (pompom com penas) é do PixelLab (assets.ts: WAND) e o tapete é o do café (data/minigames.json:
 * backdrop). Sem eles, os dois são desenhados por código.
 * Para trocar, carregue imagens com estas chaves (o desenho só acontece se a chave não existir).
 */
export const WAND_KEYS = { toy: 'wand_toy', rug: 'wand_rug' } as const;

/** O gato em 2x: dá para ver as patas e o agachar. */
const CAT_SCALE = 2;
const BAR_W = 160;

export class WandScene extends MiniGameScene {
  private p!: WandParams;
  private s!: WandState;
  private arena!: Phaser.Geom.Rectangle;
  private cat!: Phaser.GameObjects.Sprite;
  private stick!: Phaser.GameObjects.Graphics;
  private toy!: Phaser.GameObjects.Image;
  private bar!: Phaser.GameObjects.Graphics;
  private ended = false;
  private lastAnim = '';

  constructor() {
    super('wand', WAND_SCENE);
  }

  preload(): void {
    loadSheets(this, Object.values(WAND));
  }

  protected buildGame(): void {
    this.p = paramsOf<WandParams>(content.minigames, 'wand', this.launch.params.difficulty);
    this.ended = false;
    this.lastAnim = '';
    const [ax, ay, aw, ah] = this.def.arena ?? [80, 40, 480, 280];
    this.arena = new Phaser.Geom.Rectangle(ax, ay, aw, ah);
    this.ensureArt();

    this.cameras.main.setBackgroundColor('#e9d3b4');
    // O tapete do café (backdrop); sem ele, o desenhado por código, do tamanho da arena.
    if (this.def.backdrop?.rug) this.drawBackdrop();
    else this.add.image(this.arena.centerX, this.arena.centerY, WAND_KEYS.rug).setDisplaySize(aw, ah);

    const start = { x: this.arena.centerX - 120, y: this.arena.centerY + 40 };
    const tip = { x: this.arena.centerX + 80, y: this.arena.centerY - 30 };
    this.s = newWand(start, tip);
    CatSprite.createAnimations(this, this.launch.catVariant);
    this.cat = this.add.sprite(start.x, start.y, catTexture(this.launch.catVariant), 0).setOrigin(0.5, 28 / 32).setScale(CAT_SCALE);
    this.stick = this.add.graphics().setDepth(1e4);
    this.toy = this.add.image(tip.x, tip.y, WAND_KEYS.toy).setDepth(1e4 + 1);
    if (this.toy.width < WAND.toy.frameWidth) this.toy.setScale(1.5); // o desenhado por código é menor
    this.bar = this.add.graphics().setDepth(1e5);
    // A ponta segue o mouse: o cursor some dentro do jogo (a varinha é o cursor).
    this.input.setDefaultCursor('none');
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.input.setDefaultCursor('default'));
    this.draw();
  }

  protected startGame(): void {
    this.startTimer(this.p.timeSec, () => this.end(wandOutcome(this.s, this.p, true) ?? 'fail'));
  }

  protected updateGame(delta: number): void {
    if (this.ended) return;
    // Pelo controls.pointer(): o worldX do Phaser vem em pixels do canvas quando a cena abre por cima de outra.
    const raw = this.input.activePointer;
    const ptr = this.controls.pointer();
    // Antes de mexer o mouse a primeira vez, a ponta fica onde começou.
    const tip = raw.x || raw.y ? { x: Phaser.Math.Clamp(ptr.x, this.arena.left, this.arena.right), y: Phaser.Math.Clamp(ptr.y, this.arena.top, this.arena.bottom) } : this.s.tip;
    const ev = stepWand(this.s, this.p, tip, delta);
    this.onEvents(ev);
    this.draw();
    const out = wandOutcome(this.s, this.p, false);
    if (out) this.end(out);
  }

  protected resultText(r: MiniGameResult): string {
    if (r.skipped) return '';
    const t = uiText.minigames.wand;
    return r.outcome === 'fail' ? t.failed : t.result.replace('{bored}', String(this.s.bored)).replace('{pounces}', String(this.s.pounces));
  }

  // ---------- Desenho ----------

  private draw(): void {
    const s = this.s;
    // Gato: anda na direção em que vai; devagar, senta; agachado, sentado achatado; no salto, brincando.
    const v = s.catVel;
    const speed = Math.hypot(v.x, v.y);
    let anim = 'sit';
    if (s.mode === 'leap') anim = 'play';
    else if (s.mode === 'chase' && speed > 18) anim = Math.abs(v.x) >= Math.abs(v.y) ? (v.x < 0 ? 'walk_left' : 'walk_right') : v.y < 0 ? 'walk_up' : 'walk_down';
    if (anim !== this.lastAnim) {
      this.cat.play(`${catTexture(this.launch.catVariant)}-${anim}`);
      this.lastAnim = anim;
    }
    // Agachado: achata e balança o traseiro (sinal de que o bote vem aí).
    const crouch = s.mode === 'crouch';
    this.cat.setScale(CAT_SCALE * (crouch ? 1.12 : 1), CAT_SCALE * (crouch ? 0.82 : 1));
    this.cat.setPosition(s.cat.x + (crouch ? Math.sin(s.elapsed / 45) * 1.5 : 0), s.cat.y).setDepth(s.cat.y);

    // Varinha: da mão (fora da tela, embaixo à direita) até a ponta, com uma barriguinha (linha mole).
    const hand = { x: this.arena.right + 40, y: this.arena.bottom + 50 };
    const mid = { x: (hand.x + s.tip.x) / 2, y: (hand.y + s.tip.y) / 2 + 28 };
    const curve = new Phaser.Curves.QuadraticBezier(new Phaser.Math.Vector2(hand.x, hand.y), new Phaser.Math.Vector2(mid.x, mid.y), new Phaser.Math.Vector2(s.tip.x, s.tip.y));
    this.stick.clear().lineStyle(2, 0x8a5a44, 1);
    curve.draw(this.stick, 24);
    this.toy.setPosition(s.tip.x, s.tip.y).setAngle(Math.max(-30, Math.min(30, s.tipVel.x / 20)));

    // Barra de empolgação embaixo do tapete (no alto ficaria atrás do relógio do HUD).
    const x = this.arena.centerX - BAR_W / 2;
    const y = this.arena.bottom + 10;
    this.bar
      .clear()
      .fillStyle(0x3b2a32, 0.85)
      .fillRoundedRect(x - 2, y - 2, BAR_W + 4, 10, 4)
      .fillStyle(0xf3d9c2, 1)
      .fillRoundedRect(x, y, BAR_W, 6, 3)
      .fillStyle(0xd97890, 1)
      .fillRoundedRect(x, y, Math.max(0.01, (BAR_W * s.excitement) / FULL_EXCITEMENT), 6, 3);
    const t = uiText.minigames.wand;
    this.setHudInfo(t.hud.replace('{n}', String(Math.floor(s.excitement))).replace('{bored}', String(s.bored)));
  }

  private onEvents(ev: WandEvents): void {
    const t = uiText.minigames.wand;
    const snd = this.def.sounds ?? {};
    if (ev.bored) {
      this.float(ev.bored === 'too_fast' ? t.tooFast : ev.bored === 'still' ? t.still : t.bored, '#8a7a80');
      this.sfx(snd.bored);
      this.tweens.add({ targets: this.cat, alpha: 0.6, duration: 150, yoyo: true, repeat: 1 });
    }
    if (ev.crouched) this.sfx(snd.crouch);
    if (ev.wiggle) {
      this.float(t.wiggle, '#e0a94e');
      this.sfx(snd.wiggle);
    }
    if (ev.pounced) {
      this.float(t.pounce, '#d97890');
      this.sfx(snd.pounce);
    }
  }

  private end(outcome: 'fail' | 'ok' | 'great'): void {
    if (this.ended) return;
    this.ended = true;
    if (outcome !== 'fail') {
      this.sfx(this.def.sounds?.done);
      this.cat.setScale(CAT_SCALE).play(`${catTexture(this.launch.catVariant)}-play`);
    } else this.cat.setScale(CAT_SCALE).play(`${catTexture(this.launch.catVariant)}-sleep`); // perdeu a graça e deitou
    this.time.delayedCall(700, () => this.finish(outcome, Math.round(this.s.excitement)));
  }

  private float(text: string, color: string): void {
    const label = this.add
      .text(this.cat.x, this.cat.y - 60, text, { fontFamily: 'Trebuchet MS, sans-serif', fontSize: '10px', fontStyle: 'bold', color, stroke: '#fff4e0', strokeThickness: 3, resolution: 4 })
      .setOrigin(0.5, 1)
      .setDepth(1e5);
    this.tweens.add({ targets: label, y: label.y - 16, alpha: 0, delay: 300, duration: 700, onComplete: () => label.destroy() });
  }

  private sfx(id: string | undefined): void {
    if (id) services().audio.sfx(id);
  }

  /** Placeholders desenhados por código (WAND_KEYS). */
  private ensureArt(): void {
    if (!this.textures.exists(WAND_KEYS.toy)) {
      const g = this.make.graphics({}, false);
      // Penas (3, em leque) e o pompom.
      g.fillStyle(0x6fb3e0, 1).fillEllipse(8, 4, 5, 10);
      g.fillStyle(0xe0a94e, 1).fillEllipse(4, 6, 4, 9);
      g.fillStyle(0xd97890, 1).fillEllipse(12, 6, 4, 9);
      g.fillStyle(0xd9475d, 1).fillCircle(8, 12, 4);
      g.fillStyle(0xffffff, 0.6).fillCircle(7, 11, 1.2);
      g.generateTexture(WAND_KEYS.toy, 16, 17);
      g.destroy();
    }
    if (!this.textures.exists(WAND_KEYS.rug)) {
      const g = this.make.graphics({}, false);
      g.fillStyle(0xc98f7a, 1).fillRoundedRect(0, 0, 120, 70, 10);
      g.lineStyle(3, 0xf3d9c2, 1).strokeRoundedRect(6, 6, 108, 58, 7);
      g.lineStyle(1, 0xa86e5c, 1).strokeRoundedRect(12, 12, 96, 46, 5);
      g.generateTexture(WAND_KEYS.rug, 120, 70);
      g.destroy();
    }
  }
}
