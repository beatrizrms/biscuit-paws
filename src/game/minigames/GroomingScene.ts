// Banho e escovação: o gato do café de lado, bem grande (o sprite ampliado), com os nós de pelo por cima.
// Segurar o botão e arrastar a escova sobre um nó desembaraça aos poucos. A regra (distância escovada, zonas
// sensíveis e gostosas, paciência) mora em src/core/grooming.ts; aqui só se desenha e se lê o mouse.
import Phaser from 'phaser';
import { FULL_PATIENCE, groomingOutcome, groomingProgress, newGrooming, stepGrooming, type GroomingEvents, type GroomingParams, type GroomingState, type MatDef, type ZoneDef } from '../../core/grooming';
import type { MiniGameResult } from '../../core/minigame';
import { paramsOf } from '../../core/minigame';
import { content, uiText } from '../content';
import { CatSprite, catFrameSize, catScale, catTexture } from '../entities/Cat';
import { services } from '../services';
import { GROOMING, loadSheets } from './assets';
import { MiniGameScene } from './MiniGameScene';

export const GROOMING_SCENE = 'MiniGame.grooming';

/**
 * Nó de pelo, escova e toalha: arte do PixelLab (assets.ts: GROOMING). Sem os arquivos, são desenhados por código
 * (o desenho só acontece se a chave não existir).
 */
export const GROOMING_KEYS = { mat: 'grooming_mat', brush: 'grooming_brush', towel: 'grooming_towel' } as const;

/** Quadro do gato de lado (walk_right, primeiro quadro): as zonas e os nós dos dados são nesses pixels. */
const SIDE_ANIM = 'walk_right';
const BAR_W = 160;
/** As reações (balão, som) não repetem mais rápido que isto. */
const REACT_MS = 650;
/** Pelo arrepiado (o gato ficou bravo): quanto dura e a cada quanto os tufos tremem (ms). */
const FUZZ_MS = 520;
const FUZZ_STEP_MS = 65;
/** Os tufos só nas costas e no rabo: a parte de trás do contorno (o gato olha para a direita). */
const FUZZ_BACK_SHARE = 0.62;

export class GroomingScene extends MiniGameScene {
  private p!: GroomingParams;
  private s!: GroomingState;
  private mats!: MatDef[];
  private zones!: ZoneDef[];
  private zoom = 8;
  private origin = { x: 0, y: 0 };
  private cat!: Phaser.GameObjects.Sprite;
  private matImgs = new Map<string, Phaser.GameObjects.Image>();
  private brush!: Phaser.GameObjects.Image;
  private bar!: Phaser.GameObjects.Graphics;
  private reactAt = { sensitive: -Infinity, comfort: -Infinity };
  private ended = false;
  /** O contorno de cima do gato (por coluna do quadro: a linha do primeiro pixel e a cor do pelo ali). */
  private furTop: { x: number; y: number; color: number; fur: number }[] = [];
  private fuzzing = false;
  /** Pixels da folha por pixel do jogo (2 na arte em 64 px): o tufo tem o mesmo tamanho na tela. */
  private furRes = 1;

  constructor() {
    super('grooming', GROOMING_SCENE);
  }

  preload(): void {
    loadSheets(this, Object.values(GROOMING));
  }

  protected buildGame(): void {
    this.p = paramsOf<GroomingParams>(content.minigames, 'grooming', this.launch.params.difficulty);
    // O gato da arte nova (64 px) tem o corpo noutro lugar do quadro: nós e zonas próprios.
    const art = catScale(this.launch.catVariant) < 1 && this.def.art64 ? this.def.art64 : this.def;
    this.mats = art.mats ?? [];
    this.zones = art.zones ?? [];
    this.zoom = (art === this.def.art64 ? this.def.art64.bodyScale : undefined) ?? this.def.bodyScale ?? 8;
    this.s = newGrooming(this.mats, this.p);
    this.ended = false;
    this.reactAt = { sensitive: -Infinity, comfort: -Infinity };
    this.matImgs.clear();
    this.ensureArt();

    this.cameras.main.setBackgroundColor('#cfe3ea');
    this.drawBackdrop();
    const size = 32 * this.zoom;
    this.origin = { x: Math.round(320 - size / 2), y: Math.round(180 - size / 2) + 6 };
    const towel = this.add.image(320, this.origin.y + size - 40, GROOMING_KEYS.towel);
    if (towel.width === GROOMING.towel.frameWidth) towel.setScale(3);
    else towel.setDisplaySize(size + 80, 90);

    // O gato parado de lado: o primeiro quadro da caminhada para a direita, ampliado (pixel art, sem suavizar).
    const variant = this.launch.catVariant;
    CatSprite.createAnimations(this, variant);
    const sprites = content.catSprites;
    const row = sprites.animations.find((a) => a.name === SIDE_ANIM)?.row ?? 3;
    this.cat = this.add.sprite(this.origin.x, this.origin.y, catTexture(variant), row * sprites.columns).setOrigin(0, 0).setScale(this.zoom * catScale(variant));
    this.furTop = this.topContour(catTexture(variant), row * sprites.columns, catFrameSize(variant));
    this.fuzzing = false;
    this.furRes = Math.max(1, Math.round(catFrameSize(variant) / 32));

    // Os nós da partida (os primeiros da lista, pela dificuldade).
    for (const m of this.mats) {
      if (this.s.left[m.id] === undefined) continue;
      const img = this.add
        .image(this.toScreen(m.at[0]), this.toScreen(m.at[1], true), GROOMING_KEYS.mat)
        // Arte do PixelLab no tamanho natural (menor que a escova); a desenhada por código, do tamanho da área.
        .setDisplaySize(...((this.textures.get(GROOMING_KEYS.mat).getSourceImage().width === GROOMING.mat.frameWidth ? [GROOMING.mat.frameWidth, GROOMING.mat.frameHeight] : [m.radius * 2 * this.zoom, m.radius * 2 * this.zoom]) as [number, number]))
        .setDepth(10);
      this.matImgs.set(m.id, img);
    }
    this.brush = this.add.image(0, 0, GROOMING_KEYS.brush).setOrigin(0.2, 0.15).setDepth(100).setVisible(false);
    // A escova do PixelLab em 2x, com as cerdas (embaixo da cabeça, à esquerda) na ponta do mouse.
    if (this.brush.width === GROOMING.brush.frameWidth) this.brush.setScale(2).setOrigin(0.3, 0.85);
    this.bar = this.add.graphics().setDepth(100);
    this.input.setDefaultCursor('none');
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.input.setDefaultCursor('default'));
    this.draw();
  }

  protected startGame(): void {
    // Sem cronômetro: escovar não tem pressa (a paciência é o limite).
    this.startTimer(undefined, () => {});
  }

  protected updateGame(delta: number): void {
    if (this.ended) return;
    // Pelo controls.pointer(): o worldX do Phaser vem em pixels do canvas quando a cena abre por cima de outra.
    const raw = this.input.activePointer;
    const ptr = this.controls.pointer();
    const at = { x: (ptr.x - this.origin.x) / this.zoom, y: (ptr.y - this.origin.y) / this.zoom };
    const ev = stepGrooming(this.s, this.p, this.mats, this.zones, { ...at, down: ptr.down }, delta);
    // Antes do mouse se mexer, a posição é (0, 0): a escova só aparece depois.
    this.brush.setVisible(!!(raw.x || raw.y)).setPosition(ptr.x, ptr.y).setAngle(ptr.down ? Math.sin(this.time.now / 60) * 10 : -15);
    this.onEvents(ev);
    this.draw();
    const out = groomingOutcome(this.s, this.p);
    if (out) this.end(out);
  }

  protected resultText(r: MiniGameResult): string {
    if (r.skipped) return '';
    const t = uiText.minigames.grooming;
    return r.outcome === 'fail' ? t.failed : t.result.replace('{patience}', String(Math.round(this.s.patience)));
  }

  // ---------- Desenho ----------

  private toScreen(v: number, y = false): number {
    return (y ? this.origin.y : this.origin.x) + v * this.zoom;
  }

  private draw(): void {
    // Nós: diminuem conforme desembaraçam.
    for (const m of this.mats) {
      const img = this.matImgs.get(m.id);
      const left = this.s.left[m.id];
      if (!img || left === undefined) continue;
      const share = left / (m.need * this.p.needScale);
      img.setAlpha(0.35 + 0.65 * share).setScale((m.radius * 2 * this.zoom * (0.5 + 0.5 * share)) / img.width);
    }
    // Barra de paciência embaixo (verde; baixa, amarela; quase no fim, vermelha).
    const pat = this.s.patience / FULL_PATIENCE;
    const color = pat > 0.5 ? 0x68ad8a : pat > 0.25 ? 0xe0a94e : 0xd9475d;
    const x = 320 - BAR_W / 2;
    const y = 342;
    this.bar
      .clear()
      .fillStyle(0x3b2a32, 0.85)
      .fillRoundedRect(x - 2, y - 2, BAR_W + 4, 10, 4)
      .fillStyle(0xf3d9c2, 1)
      .fillRoundedRect(x, y, BAR_W, 6, 3)
      .fillStyle(color, 1)
      .fillRoundedRect(x, y, Math.max(0.01, BAR_W * pat), 6, 3);
    const t = uiText.minigames.grooming;
    this.setHudInfo(t.hud.replace('{patience}', String(Math.round(this.s.patience))).replace('{done}', String(Math.round(groomingProgress(this.s, this.mats, this.p) * 100))));
  }

  private onEvents(ev: GroomingEvents): void {
    const t = uiText.minigames.grooming;
    const snd = this.def.sounds ?? {};
    const now = this.time.now;
    for (const id of ev.cleaned) {
      const img = this.matImgs.get(id);
      if (img) this.tweens.add({ targets: img, alpha: 0, scale: img.scale * 1.6, duration: 250, onComplete: () => img.setVisible(false) });
      this.float(t.clean, '#68ad8a', img?.x ?? 320, img?.y ?? 180);
      this.sfx(snd.clean);
    }
    if (ev.sensitive && now - this.reactAt.sensitive > REACT_MS) {
      this.reactAt.sensitive = now;
      this.float(t.sensitive, '#d9475d', this.brush.x, this.brush.y - 20);
      this.sfx(snd.sensitive);
      this.cat.setTint(0xffb0b0);
      this.time.delayedCall(180, () => !this.ended && this.cat.clearTint());
      this.tweens.add({ targets: this.cat, x: this.origin.x + 3, duration: 50, yoyo: true, repeat: 1 });
      this.fuzz();
    }
    if (ev.comfort && now - this.reactAt.comfort > REACT_MS * 1.5) {
      this.reactAt.comfort = now;
      this.float('♥', '#d97890', this.brush.x, this.brush.y - 20);
      this.sfx(snd.comfort);
    }
  }

  private end(outcome: 'fail' | 'ok' | 'great'): void {
    if (this.ended) return;
    this.ended = true;
    this.brush.setVisible(false);
    if (outcome === 'fail') {
      // Perdeu a paciência: sai correndo pela direita.
      this.sfx(this.def.sounds?.fled);
      this.cat.play(`${catTexture(this.launch.catVariant)}-${SIDE_ANIM}`);
      this.tweens.add({ targets: this.cat, x: 700, duration: 700, ease: 'Quad.In' });
    } else {
      this.sfx(this.def.sounds?.done);
      this.float(uiText.minigames.grooming.allClean, '#68ad8a', 320, this.origin.y);
    }
    this.time.delayedCall(800, () => this.finish(outcome, Math.round(this.s.patience)));
  }

  /** Primeiro pixel de cima de cada coluna do quadro do gato (onde nascem os tufos do pelo arrepiado). */
  private topContour(key: string, frame: number, size: number): { x: number; y: number; color: number; fur: number }[] {
    const out: { x: number; y: number; color: number; fur: number }[] = [];
    for (let x = 0; x < size; x++) {
      for (let y = 0; y < size; y++) {
        const c = this.textures.getPixel(x, y, key, frame);
        if (c && c.alpha > 0) {
          // A cor do contorno (a ponta do tufo) e a do pelo logo abaixo dela (o corpo do tufo).
          const below = this.textures.getPixel(x, y + 1, key, frame);
          out.push({ x, y, color: c.color, fur: below && below.alpha > 0 ? below.color : c.color });
          break;
        }
      }
    }
    // Só as costas e o rabo (a cabeça fica à direita): a parte de trás do contorno.
    if (out.length === 0) return out;
    const from = out[0]!.x;
    const to = out[out.length - 1]!.x;
    return out.filter((p) => p.x <= from + (to - from) * FUZZ_BACK_SHARE);
  }

  /**
   * Pelo arrepiado (ele ficou bravo com a escova): tufos de 2 a 3 pixels sobem das costas e do rabo, na cor do pelo,
   * tremendo um pouco, e baixam. Desenhado por código: a folha do gato não tem esse quadro.
   */
  private fuzz(): void {
    if (this.fuzzing || this.furTop.length === 0) return;
    this.fuzzing = true;
    const g = this.add.graphics().setDepth(5);
    // Um pixel da folha na tela (a arte em 64 px é desenhada na metade).
    const z = this.cat.scaleX;
    let step = 0;
    const draw = () => {
      g.clear();
      this.furTop.forEach((p, i) => {
        // Um tufo por coluna: o pelo (2 ou 3 pixels, alternando a cada passo: treme) com a ponta escura do contorno.
        const h = (2 + ((Math.floor(i / this.furRes) + step) % 2)) * this.furRes;
        const x = this.cat.x + p.x * z;
        g.fillStyle(p.fur, 1).fillRect(x, this.cat.y + (p.y - h + this.furRes) * z, z, (h - this.furRes) * z);
        g.fillStyle(p.color, 1).fillRect(x, this.cat.y + (p.y - h) * z, z, z * this.furRes);
      });
      step++;
    };
    draw();
    this.time.addEvent({ delay: FUZZ_STEP_MS, repeat: Math.round(FUZZ_MS / FUZZ_STEP_MS) - 1, callback: draw });
    this.time.delayedCall(FUZZ_MS, () =>
      this.tweens.add({ targets: g, alpha: 0, duration: 160, onComplete: () => (g.destroy(), (this.fuzzing = false)) }),
    );
  }

  private float(text: string, color: string, x: number, y: number): void {
    const label = this.add
      .text(x, y, text, { fontFamily: 'Trebuchet MS, sans-serif', fontSize: '10px', fontStyle: 'bold', color, stroke: '#fff4e0', strokeThickness: 3, resolution: 4 })
      .setOrigin(0.5, 1)
      .setDepth(1e5);
    this.tweens.add({ targets: label, y: label.y - 16, alpha: 0, delay: 250, duration: 650, onComplete: () => label.destroy() });
  }

  private sfx(id: string | undefined): void {
    if (id) services().audio.sfx(id);
  }

  /** Placeholders desenhados por código (GROOMING_KEYS). */
  private ensureArt(): void {
    if (!this.textures.exists(GROOMING_KEYS.mat)) {
      // Nó de pelo: tufo bagunçado (riscos marrons cruzados sobre uma mancha).
      const g = this.make.graphics({}, false);
      g.fillStyle(0x8a6a4a, 0.55).fillCircle(16, 16, 13);
      g.lineStyle(2, 0x5a3a24, 0.9);
      for (let i = 0; i < 9; i++) {
        const a = (i / 9) * Math.PI * 2;
        g.lineBetween(16 + Math.cos(a) * 4, 16 + Math.sin(a) * 4, 16 + Math.cos(a + 2.2) * 12, 16 + Math.sin(a + 2.2) * 12);
      }
      g.generateTexture(GROOMING_KEYS.mat, 32, 32);
      g.destroy();
    }
    if (!this.textures.exists(GROOMING_KEYS.brush)) {
      // Escova: corpo de madeira, cerdas claras embaixo e o cabo para a direita.
      const g = this.make.graphics({}, false);
      g.fillStyle(0xa8663e, 1).fillRoundedRect(2, 4, 26, 10, 3);
      g.fillStyle(0x8a4e32, 1).fillRect(26, 7, 16, 5);
      g.fillStyle(0xf6e8cc, 1);
      for (let x = 4; x < 28; x += 3) g.fillRect(x, 14, 2, 6);
      g.lineStyle(1, 0x3b2a32, 0.8).strokeRoundedRect(2, 4, 26, 10, 3);
      g.generateTexture(GROOMING_KEYS.brush, 44, 22);
      g.destroy();
    }
    if (!this.textures.exists(GROOMING_KEYS.towel)) {
      // Toalha listrada embaixo do gato.
      const g = this.make.graphics({}, false);
      g.fillStyle(0xf6f0e8, 1).fillRoundedRect(0, 0, 120, 40, 8);
      g.fillStyle(0x86b0d8, 1).fillRect(0, 8, 120, 4).fillRect(0, 28, 120, 4);
      g.generateTexture(GROOMING_KEYS.towel, 120, 40);
      g.destroy();
    }
  }
}
