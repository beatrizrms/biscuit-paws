// Foto perfeita: o quintal na tela toda, um ou dois gatos do café andando e trocando de pose. O mouse é o visor; o
// clique fotografa (flash, a nota sobe). Pose fofa = sentado com brilho nos olhos, por um instante. Acabou o filme, vale
// a melhor foto. A regra (poses, tempo, nota) mora em src/core/photo.ts; aqui só se desenha.
import Phaser from 'phaser';
import { newPhoto, photoOutcome, shoot, stepPhoto, type PhotoCat, type PhotoParams, type PhotoState } from '../../core/photo';
import type { MiniGameResult } from '../../core/minigame';
import { paramsOf } from '../../core/minigame';
import { frameOf } from '../../core/tiles';
import { content, uiText } from '../content';
import { CatSprite, catTexture } from '../entities/Cat';
import { services } from '../services';
import { addTileImage } from '../tileArt';
import { loadCatVariants } from './assets';
import { MiniGameScene } from './MiniGameScene';

export const PHOTO_SCENE = 'MiniGame.photo';

/** PLACEHOLDER(arte): o brilho da pose fofa é desenhado por código (chave photo_sparkle). */
const SPARKLE_KEY = 'photo_sparkle';

/** Gatos em dobro (o visor é "de perto"): o quadro de 32 vira 64 px. */
const CAT_SCALE = 2;
/** Espera depois da última foto, para ver o flash e a nota antes do resultado. */
const END_MS = 900;

/** O quintal ao fundo: o que fica onde (tiles do catálogo, canto em células de 32). */
const DECOR: { tile: string; at: [number, number] }[] = [
  { tile: 'yard_topiaria', at: [1, 2] },
  { tile: 'yard_vaso_baixo_flores', at: [6, 3] },
  { tile: 'yard_vaso_arvore_a', at: [16, 1] },
  { tile: 'yard_dracena', at: [18, 9] },
  { tile: 'yard_vaso_baixo_b', at: [0, 9] },
];

const textStyle = (size: number, color = '#3b2a32', bold = false): Phaser.Types.GameObjects.Text.TextStyle => ({
  fontFamily: 'Trebuchet MS, sans-serif',
  fontSize: `${size}px`,
  fontStyle: bold ? 'bold' : 'normal',
  color,
  resolution: 4,
});

interface CatView {
  sprite: Phaser.GameObjects.Sprite;
  sparkles: Phaser.GameObjects.Image[];
  variant: string;
  anim: string;
}

export class PhotoScene extends MiniGameScene {
  private p!: PhotoParams;
  private s!: PhotoState;
  private views = new Map<string, CatView>();
  private names = new Map<string, string>();
  private finder!: Phaser.GameObjects.Graphics;
  private flash!: Phaser.GameObjects.Rectangle;
  private ended = false;

  constructor() {
    super('photo', PHOTO_SCENE);
  }

  preload(): void {
    loadCatVariants(this, this.catList().map((c) => c.variant));
  }

  /** Os gatos do café (params.contestCats); aberto pelo debug, alguns do abrigo da vila. */
  private catList(): { id: string; name: string; variant: string }[] {
    return this.launch.params.contestCats ?? content.adoption.cats.slice(0, 2).map((c) => ({ id: c.id, name: c.name, variant: c.variant }));
  }

  protected buildGame(): void {
    this.p = paramsOf<PhotoParams>(content.minigames, 'photo', this.launch.params.difficulty);
    const data = content.photo;
    // Quem aparece: sorteados entre os gatos do café (até p.cats).
    const pool = [...this.catList()];
    const chosen: { id: string; name: string; variant: string }[] = [];
    while (pool.length > 0 && chosen.length < this.p.cats) chosen.push(pool.splice(this.rng.int(0, pool.length - 1), 1)[0]!);
    this.s = newPhoto(data, this.p, this.rng, chosen.map((c) => c.id));
    this.views.clear();
    this.names = new Map(chosen.map((c) => [c.id, c.name]));
    this.ended = false;
    this.ensureArt();

    // O quintal: gramado e algumas peças de fundo (a arte do jogo).
    const grass = content.catalog.tiles.yard_grama_a;
    if (grass) for (let r = 0; r < 12; r++) for (let c = 0; c < 20; c++) addTileImage(this, c * 32, r * 32, grass.sheet, frameOf(content.catalog, grass, 0, 0));
    for (const d of DECOR) {
      const t = content.catalog.tiles[d.tile];
      if (!t) continue;
      for (let dy = 0; dy < t.h; dy++) for (let dx = 0; dx < t.w; dx++) addTileImage(this, (d.at[0] + dx) * 32, (d.at[1] + dy) * 32, t.sheet, frameOf(content.catalog, t, dx, dy)).setDepth((d.at[1] + t.h) * 32);
    }

    for (const c of chosen) {
      CatSprite.createAnimations(this, c.variant);
      const sprite = this.add.sprite(0, 0, catTexture(c.variant), 0).setScale(CAT_SCALE).setOrigin(0.5, 0.65);
      const sparkles = [0, 1].map(() => this.add.image(0, 0, SPARKLE_KEY).setVisible(false).setDepth(2000));
      this.views.set(c.id, { sprite, sparkles, variant: c.variant, anim: '' });
    }
    this.finder = this.add.graphics().setDepth(3000);
    this.flash = this.add.rectangle(320, 180, 640, 360, 0xffffff, 0).setDepth(4000);
    this.input.setDefaultCursor('none');
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.input.setDefaultCursor('default'));
    this.controls.onAction((world) => {
      if (this.phase !== 'playing') return;
      const at = world ?? this.controls.pointer();
      this.takePhoto(at.x, at.y);
    });
    this.syncCats();
    this.updateHud();
  }

  protected startGame(): void {
    this.startTimer(undefined, () => {});
  }

  protected updateGame(deltaMs: number): void {
    if (!this.ended) stepPhoto(content.photo, this.p, this.s, deltaMs / 1000, this.rng);
    this.syncCats();
    this.drawFinder();
  }

  protected resultText(r: MiniGameResult): string {
    if (r.skipped || !r.photo) return '';
    const t = uiText.minigames.photo;
    const pose = content.photo.poses[r.photo.pose as keyof typeof content.photo.poses]?.name ?? r.photo.pose;
    return t.result.replace('{score}', String(r.photo.score)).replace('{pose}', pose) + (r.photo.catIds.length >= 2 ? t.pair : '');
  }

  // ---------- Foto ----------

  private takePhoto(x: number, y: number): void {
    if (this.ended) return;
    const shot = shoot(content.photo, this.s, x, y);
    if (!shot) return;
    const t = uiText.minigames.photo;
    this.sfx(this.def.sounds?.shot);
    this.flash.setAlpha(0.85);
    this.tweens.add({ targets: this.flash, alpha: 0, duration: 260 });
    const label = shot.catIds.length === 0 ? t.empty : shot.pose === 'cute' ? `${t.cute} ${t.shot.replace('{score}', String(shot.score))}` : t.shot.replace('{score}', String(shot.score));
    this.floatText(x, y - 50, label, shot.pose === 'cute' ? '#3f7a4a' : '#5c3428');
    this.updateHud();
    if (this.s.shotsLeft > 0) return;
    // Acabou o filme: vale a melhor.
    this.ended = true;
    const best = this.s.best!;
    const outcome = photoOutcome(this.p, best);
    this.time.delayedCall(END_MS, () => {
      this.sfx(outcome === 'fail' ? this.def.sounds?.bad : this.def.sounds?.good);
      this.finish(outcome, best.score, false, { photo: { pose: best.pose, score: best.score, catIds: best.catIds } });
    });
  }

  // ---------- Desenho ----------

  /** Gatos: posição, profundidade pelo pé, animação da pose e o brilho da pose fofa. */
  private syncCats(): void {
    for (const c of this.s.cats) {
      const v = this.views.get(c.id);
      if (!v) continue;
      v.sprite.setPosition(c.x, c.y).setDepth(c.y);
      const anim = this.animFor(c);
      if (v.anim !== anim) {
        v.anim = anim;
        if (c.pose === 'cute') v.sprite.stop().setFrame(content.catSprites.animations.find((a) => a.name === 'sit')!.row * content.catSprites.columns);
        else v.sprite.play(`${catTexture(v.variant)}-${anim}`);
      }
      // Pose fofa: dois brilhinhos nos olhos, piscando (o sinal sutil).
      const cute = c.pose === 'cute';
      const blink = Math.floor(this.time.now / 120) % 2 === 0;
      v.sparkles.forEach((s, i) => s.setVisible(cute).setPosition(c.x + (i ? 11 : -12), c.y - 25 + (i ? 1 : 0)).setAlpha(blink ? 1 : 0.8).setScale(i ? 1 : 0.8));
    }
  }

  private animFor(c: PhotoCat): string {
    if (c.pose === 'walk') return `walk_${c.facing}`;
    if (c.pose === 'cute') return 'cute';
    return content.photo.poses[c.pose].anim;
  }

  /** O visor: escurece fora do quadro e marca os cantos e o centro. */
  private drawFinder(): void {
    const g = this.finder.clear();
    if (this.ended) return;
    const { x, y } = this.controls.pointer();
    const { w, h } = content.photo.frame;
    const l = x - w / 2;
    const t = y - h / 2;
    g.fillStyle(0x1e1418, 0.32);
    g.fillRect(0, 0, 640, Math.max(0, t)).fillRect(0, t + h, 640, 360).fillRect(0, t, Math.max(0, l), h).fillRect(l + w, t, 640, h);
    g.lineStyle(2, 0xfff4e0, 0.95);
    const k = 12;
    for (const [cx, cy, dx, dy] of [[l, t, 1, 1], [l + w, t, -1, 1], [l, t + h, 1, -1], [l + w, t + h, -1, -1]] as const) {
      g.lineBetween(cx, cy, cx + dx * k, cy).lineBetween(cx, cy, cx, cy + dy * k);
    }
    g.lineStyle(1, 0xfff4e0, 0.8).lineBetween(x - 5, y, x + 5, y).lineBetween(x, y - 5, x, y + 5);
  }

  private updateHud(): void {
    const t = uiText.minigames.photo;
    this.setHudInfo(t.hud.replace('{left}', String(this.s.shotsLeft)).replace('{total}', String(this.p.shots)).replace('{best}', this.s.best ? String(this.s.best.score) : t.none));
  }

  private floatText(x: number, y: number, text: string, color: string): void {
    const label = this.add.text(x, y, text, { ...textStyle(10, color, true), stroke: '#fff4e0', strokeThickness: 3 }).setOrigin(0.5, 1).setDepth(3500);
    this.tweens.add({ targets: label, y: y - 18, alpha: 0, delay: 500, duration: 600, onComplete: () => label.destroy() });
  }

  private sfx(id: string | undefined): void {
    if (id) services().audio.sfx(id);
  }

  private ensureArt(): void {
    if (this.textures.exists(SPARKLE_KEY)) return;
    // Brilho de quatro pontas, branco com miolo amarelo-claro e contorno marrom (aparece em pelo claro e escuro).
    const g = this.make.graphics({}, false);
    const star = (c: number, r: number) =>
      g.fillStyle(c, 1).fillTriangle(6, 6 - r, 5, 6, 7, 6).fillTriangle(6, 6 + r, 5, 6, 7, 6).fillTriangle(6 - r, 6, 6, 5, 6, 7).fillTriangle(6 + r, 6, 6, 5, 6, 7);
    star(0x5c3428, 6);
    g.fillStyle(0x5c3428, 1).fillRect(4, 4, 4, 4);
    star(0xffffff, 5);
    g.fillStyle(0xfff2a8, 1).fillRect(5, 5, 2, 2);
    g.generateTexture(SPARKLE_KEY, 12, 12);
    g.destroy();
  }
}
