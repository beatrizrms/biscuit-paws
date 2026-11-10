// Remédio escondido: a tigela com o comprimido à esquerda, o gato à direita.
// Passo 1: segurar e arrastar a pasta por cima do comprimido até cobrir (a cobertura aparece em %).
// Passo 2: oferecer (E, Espaço ou o botão) quando ele estiver distraído (de costas); atento (de frente, "!"), ele
// desconfia. A regra (cobertura, humor, desconfiança) mora em src/core/pill.ts; aqui só se desenha.
import Phaser from 'phaser';
import type { MiniGameResult } from '../../core/minigame';
import { paramsOf } from '../../core/minigame';
import { coverage, FULL_SUSPICION, newPill, offer, pillOutcome, spread, startOffering, stepPill, warning, type PillParams, type PillState } from '../../core/pill';
import { content, uiText } from '../content';
import { CatSprite, catScale, catTexture } from '../entities/Cat';
import { services } from '../services';
import { loadSheets, PILL as PILL_ART } from './assets';
import { MiniGameScene } from './MiniGameScene';

export const PILL_SCENE = 'MiniGame.pill';

/**
 * Tigela, comprimido e tubo: arte do PixelLab (assets.ts: PILL). A pasta (bolinhas) é desenhada por código; sem os
 * arquivos, o resto também (o desenho só acontece se a chave não existir).
 */
export const PILL_KEYS = { bowl: 'pill_bowl', pill: 'pill_capsule', paste: 'pill_paste', tube: 'pill_tube' } as const;

/**
 * Onde fica o comprimido (px lógicos): a pasta conta só aqui. A arte vai em meia escala (ART: a densidade do mundo,
 * a tigela menor que o gato); dy: o meio da comida na tigela.
 */
const ART = 0.5;
const PILL = { x: 200, y: 210, w: 24, h: 12, dy: -4 };
const CAT = { x: 470, y: 250, scale: 4 };
const BAR_W = 120;

export class PillScene extends MiniGameScene {
  private p!: PillParams;
  private s!: PillState;
  private cat!: Phaser.GameObjects.Sprite;
  private catRows = { front: 0, back: 2 };
  private mark!: Phaser.GameObjects.Text;
  private pasteLayer!: Phaser.GameObjects.Container;
  private tube!: Phaser.GameObjects.Image;
  private bowl!: Phaser.GameObjects.Container;
  private bar!: Phaser.GameObjects.Graphics;
  private btn: HTMLButtonElement | null = null;
  private lastPaste = { x: -99, y: -99 };
  private ended = false;

  constructor() {
    super('pill', PILL_SCENE);
  }

  preload(): void {
    loadSheets(this, Object.values(PILL_ART));
  }

  protected buildGame(): void {
    this.p = paramsOf<PillParams>(content.minigames, 'pill', this.launch.params.difficulty);
    // O jeito do gato: desconfiado, a distração dura menos (cat_profiles.json: pillWindow).
    this.s = newPill(this.p, this.launch.pillWindow ?? 1);
    this.ended = false;
    this.lastPaste = { x: -99, y: -99 };
    this.ensureArt();
    this.cameras.main.setBackgroundColor('#f3e3cc');
    this.drawBackdrop();

    // Tigela (com o comprimido no meio) e a camada da pasta por cima.
    const bowlImg = this.add.image(0, 0, PILL_KEYS.bowl).setScale(ART);
    const pill = this.add.image(0, PILL.dy, PILL_KEYS.pill).setDisplaySize(PILL.w, PILL.h);
    this.pasteLayer = this.add.container(0, PILL.dy);
    this.bowl = this.add.container(PILL.x, PILL.y, [bowlImg, pill, this.pasteLayer]);

    // O gato grande: de frente (atento) ou de costas (distraído), pelos quadros parados das animações.
    const variant = this.launch.catVariant;
    CatSprite.createAnimations(this, variant);
    const anim = (name: string) => content.catSprites.animations.find((a) => a.name === name)?.row ?? 0;
    this.catRows = { front: anim('sit'), back: anim('walk_up') };
    this.cat = this.add.sprite(CAT.x, CAT.y, catTexture(variant), this.catRows.front * content.catSprites.columns).setOrigin(0.5, 28 / 32).setScale(CAT.scale * catScale(variant));
    this.mark = this.add
      .text(CAT.x + 34, CAT.y - 128, '', { fontFamily: 'Trebuchet MS, sans-serif', fontSize: '22px', fontStyle: 'bold', color: '#d9475d', stroke: '#fff4e0', strokeThickness: 4, resolution: 4 })
      .setOrigin(0.5);
    this.bar = this.add.graphics().setDepth(100);
    this.tube = this.add.image(0, 0, PILL_KEYS.tube).setScale(ART).setOrigin(0.15, 0.85).setDepth(200).setVisible(false);

    this.btn = this.hudButton(uiText.minigames.pill.ready, () => this.act());
    this.controls.onAction((world) => {
      // Teclado (E, Espaço): pronto / oferecer. O clique fica para espalhar a pasta.
      if (!world && this.phase === 'playing') this.act();
    });
    this.input.setDefaultCursor('none');
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.input.setDefaultCursor('default'));
    this.draw();
  }

  protected startGame(): void {
    // Sem cronômetro: o limite é a desconfiança.
    this.startTimer(undefined, () => {});
  }

  protected updateGame(delta: number): void {
    if (this.ended) return;
    const ptr = this.controls.pointer();
    const moved = ptr.x !== 0 || ptr.y !== 0;
    this.tube.setVisible(moved && this.s.phase === 'cover').setPosition(ptr.x, ptr.y);
    if (this.s.phase === 'cover' && ptr.down) this.paste(ptr.x, ptr.y);
    const ev = stepPill(this.s, this.p, delta, this.rng);
    if (ev.turned) this.sfx(this.def.sounds?.turn);
    this.draw();
  }

  protected resultText(r: MiniGameResult): string {
    if (r.skipped) return '';
    const t = uiText.minigames.pill;
    return r.outcome === 'fail' ? t.failed : t.result.replace('{offers}', String(this.s.offers));
  }

  // ---------- Ações ----------

  /** E / botão: no passo 1, pronto (começa a oferecer); no passo 2, oferece a tigela. */
  private act(): void {
    if (this.ended) return;
    const t = uiText.minigames.pill;
    if (this.s.phase === 'cover') {
      startOffering(this.s, this.p, this.rng);
      this.sfx(this.def.sounds?.ready);
      if (this.btn) this.btn.textContent = t.offer;
      this.tweens.add({ targets: this.bowl, x: PILL.x + 90, y: PILL.y + 60, scale: 0.75, duration: 300 });
      return;
    }
    const r = offer(this.s, this.p);
    if (!r) return;
    // A tigela vai até o gato e volta (se ele não comer).
    this.tweens.add({ targets: this.bowl, x: CAT.x - 70, duration: 180, yoyo: r === 'caught', ease: 'Quad.Out' });
    if (r === 'caught') {
      this.sfx(this.def.sounds?.caught);
      this.float(t.caught, '#d9475d');
      this.cameras.main.shake(120, 0.004);
    } else if (r === 'fled') {
      this.sfx(this.def.sounds?.fled);
      this.float(t.fled, '#d9475d');
      this.end();
    } else {
      this.sfx(this.def.sounds?.ate);
      this.float(t.ate, '#68ad8a');
      this.end();
    }
  }

  /** Pasta onde a ponta do tubo passa (a cada poucos pixels, para não empilhar): conta em cima do comprimido. */
  private paste(x: number, y: number): void {
    if (Math.hypot(x - this.lastPaste.x, y - this.lastPaste.y) < 3) return;
    this.lastPaste = { x, y };
    const u = (x - (PILL.x - PILL.w / 2)) / PILL.w;
    const v = (y - (PILL.y + PILL.dy - PILL.h / 2)) / PILL.h;
    const n = spread(this.s, this.p, u, v);
    if (u < -0.3 || u > 1.3 || v < -0.6 || v > 1.6) return;
    // O desenho da pasta acompanha o arraste (perto do comprimido), mesmo onde já estava coberto.
    this.pasteLayer.add(this.add.image(x - PILL.x, y - PILL.y - PILL.dy, PILL_KEYS.paste).setScale(ART).setFlip(Math.random() < 0.5, Math.random() < 0.5));
    if (n > 0 && this.pasteLayer.length % 6 === 0) this.sfx(this.def.sounds?.spread);
  }

  private end(): void {
    if (this.ended) return;
    this.ended = true;
    this.btn?.setAttribute('disabled', '');
    const out = pillOutcome(this.s) ?? 'fail';
    if (out === 'fail') {
      this.cat.setFrame(this.catRows.back * content.catSprites.columns);
      this.tweens.add({ targets: this.cat, x: 720, duration: 700, ease: 'Quad.In' }); // recusou e foi embora
    } else this.cat.play(`${catTexture(this.launch.catVariant)}-sit`);
    this.time.delayedCall(900, () => this.finish(out, Math.round(FULL_SUSPICION - this.s.suspicion)));
  }

  // ---------- Desenho ----------

  private draw(): void {
    const s = this.s;
    const t = uiText.minigames.pill;
    const cols = content.catSprites.columns;
    if (!this.ended) {
      if (s.phase === 'offer') {
        // Distraído: de costas (olhando outra coisa); atento: de frente, "!". No aviso, a orelha mexe ("?" tremendo).
        const warn = warning(s, this.p);
        this.cat.setFrame((s.mood === 'attentive' ? this.catRows.front : this.catRows.back) * cols);
        this.mark.setText(s.mood === 'attentive' ? '!' : warn ? '?' : '').setX(CAT.x + 34 + (warn ? Math.sin(s.elapsed / 40) * 2 : 0));
      } else this.mark.setText('');
    }
    // Desconfiança embaixo do gato (só no passo 2).
    this.bar.clear();
    if (s.phase !== 'cover') {
      const x = CAT.x - BAR_W / 2;
      const y = CAT.y + 20;
      const k = s.suspicion / FULL_SUSPICION;
      this.bar
        .fillStyle(0x3b2a32, 0.85)
        .fillRoundedRect(x - 2, y - 2, BAR_W + 4, 10, 4)
        .fillStyle(0xf3d9c2, 1)
        .fillRoundedRect(x, y, BAR_W, 6, 3)
        .fillStyle(k > 0.6 ? 0xd9475d : 0xe0a94e, 1)
        .fillRoundedRect(x, y, Math.max(0.01, BAR_W * k), 6, 3);
    }
    const cov = Math.round(coverage(s) * 100);
    this.setHudInfo(s.phase === 'cover' ? t.hudCover.replace('{n}', String(cov)) : t.hudOffer.replace('{n}', String(Math.round(s.suspicion))).replace('{cover}', String(cov)));
  }

  private float(text: string, color: string): void {
    const label = this.add
      .text(CAT.x, CAT.y - 150, text, { fontFamily: 'Trebuchet MS, sans-serif', fontSize: '11px', fontStyle: 'bold', color, stroke: '#fff4e0', strokeThickness: 3, resolution: 4 })
      .setOrigin(0.5, 1)
      .setDepth(1e5);
    this.tweens.add({ targets: label, y: label.y - 16, alpha: 0, delay: 400, duration: 700, onComplete: () => label.destroy() });
  }

  private sfx(id: string | undefined): void {
    if (id) services().audio.sfx(id);
  }

  /** Placeholders desenhados por código (PILL_KEYS). */
  private ensureArt(): void {
    const make = (key: string, w: number, h: number, draw: (g: Phaser.GameObjects.Graphics) => void) => {
      if (this.textures.exists(key)) return;
      const g = this.make.graphics({}, false);
      draw(g);
      g.generateTexture(key, w, h);
      g.destroy();
    };
    make(PILL_KEYS.bowl, 200, 120, (g) => {
      // Tigela vista de cima (elipse), com a comida (mancha marrom).
      g.fillStyle(0x86b0d8, 1).fillEllipse(100, 60, 196, 116);
      g.fillStyle(0xb8d6ee, 1).fillEllipse(100, 56, 170, 96);
      g.fillStyle(0x9a6440, 1).fillEllipse(100, 60, 150, 76);
      g.fillStyle(0xb8804e, 1);
      for (let i = 0; i < 26; i++) g.fillCircle(40 + ((i * 37) % 120), 34 + ((i * 23) % 52), 5);
    });
    make(PILL_KEYS.pill, 42, 18, (g) => {
      // Comprimido: cápsula metade vermelha, metade branca.
      g.fillStyle(0xd9475d, 1).fillRoundedRect(1, 1, 22, 16, 8);
      g.fillStyle(0xffffff, 1).fillRoundedRect(19, 1, 22, 16, 8);
      g.lineStyle(1, 0x3b2a32, 0.8).strokeRoundedRect(1, 1, 40, 16, 8);
    });
    make(PILL_KEYS.paste, 12, 10, (g) => {
      // Bolinha de pasta (patê) em pixel, sem contorno (as bolinhas se juntam numa camada só), com brilho e sombra.
      const rows = ['...mmmmmm...', '.mmhhmmmmmm.', 'mmhhmmmmmmmm', 'mhhmmmmmmmmd', 'mmmmmmmmmmdd', 'mmmmmmmmmddd', '.dmmmmmmddd.', '..dddddddd..', '............', '............'];
      const color: Record<string, number> = { o: 0x5a2e1c, m: 0xb07a52, h: 0xdcae86, d: 0x8e5a3a };
      rows.forEach((line, y) => [...line].forEach((ch, x) => color[ch] !== undefined && g.fillStyle(color[ch]!, 1).fillRect(x, y, 1, 1)));
    });
    make(PILL_KEYS.tube, 40, 40, (g) => {
      // Tubo de pasta inclinado (o bico na ponta de baixo, à esquerda).
      g.fillStyle(0xf6e8cc, 1).fillRoundedRect(10, 4, 26, 14, 4);
      g.fillStyle(0xd97890, 1).fillRect(14, 8, 18, 6);
      g.fillStyle(0x8a5a44, 1).fillTriangle(4, 34, 10, 14, 16, 18);
    });
  }
}
