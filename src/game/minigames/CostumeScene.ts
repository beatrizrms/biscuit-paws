// Concurso de fantasia: à esquerda os gatos do café (quem desfila), no meio o palco com o gato grande vestido, à direita
// as peças de cada lugar (cabeça, pescoço, costas). O tema do dia fica no alto. "Desfilar" (ou o tempo acabar) chama o
// júri: a nota da fantasia contra a dos concorrentes, e o pódio aparece no palco antes do resultado.
// A regra (nota, concorrentes, colocação) mora em src/core/costume.ts; aqui só se desenha.
import Phaser from 'phaser';
import { COSTUME_SLOTS, contestOutcome, drawTheme, runContest, scoreOutfit, type ContestEntry, type CostumeParams, type CostumePiece, type CostumeSlot, type CostumeTheme, type Outfit } from '../../core/costume';
import type { MiniGameResult } from '../../core/minigame';
import { paramsOf } from '../../core/minigame';
import { frameOf } from '../../core/tiles';
import { content, uiText } from '../content';
import { catTexture } from '../entities/Cat';
import { services } from '../services';
import { addTileImage } from '../tileArt';
import { loadCatVariants } from './assets';
import { MiniGameScene } from './MiniGameScene';

export const COSTUME_SCENE = 'MiniGame.costume';

/**
 * PLACEHOLDER(arte): as peças de fantasia são desenhadas por código no tamanho do quadro do gato (32 px), uma textura
 * por peça com a chave costume_<id da peça sem "costume.">. Para trocar, carregue imagens com essas chaves.
 */
const pieceKey = (p: CostumePiece) => `costume_${p.id.replace('costume.', '')}`;

/** Escala do gato no palco: o quadro de 32 vira 128 px. */
const ZOOM = 4;
const CAT = { x: 236, y: 270 };
const CATS = { x: 8, y: 64, w: 112, row: 34 };
const SLOTS = { x: 362, y: 66, row: 84, btn: 40 };
const REVIEW_MS = 2400;

const C = { edge: 0x7f4b33, card: 0xfff7e6, pick: 0xe0a94e, on: 0xe4f2e8 };
const textStyle = (size: number, color = '#3b2a32', bold = false): Phaser.Types.GameObjects.Text.TextStyle => ({
  fontFamily: 'Trebuchet MS, sans-serif',
  fontSize: `${size}px`,
  fontStyle: bold ? 'bold' : 'normal',
  color,
  resolution: 4,
});

interface ContestCat {
  id: string;
  name: string;
  variant: string;
}

export class CostumeScene extends MiniGameScene {
  private p!: CostumeParams;
  private theme!: CostumeTheme;
  private cats: ContestCat[] = [];
  private pieces: CostumePiece[] = [];
  private catId: string | null = null;
  private outfit: Outfit = {};
  private view!: Phaser.GameObjects.Container;
  private ranking: ContestEntry[] = [];
  private ended = false;

  constructor() {
    super('costume', COSTUME_SCENE);
  }

  preload(): void {
    loadCatVariants(this, this.catList().map((c) => c.variant));
  }

  /** Os gatos do café (params.contestCats); aberto pelo debug, alguns do abrigo da vila. */
  private catList(): ContestCat[] {
    return this.launch.params.contestCats ?? content.adoption.cats.slice(0, 4).map((c) => ({ id: c.id, name: c.name, variant: c.variant }));
  }

  protected buildGame(): void {
    this.p = paramsOf<CostumeParams>(content.minigames, 'costume', this.launch.params.difficulty);
    const data = content.costume;
    this.theme = drawTheme(data, this.rng);
    this.cats = this.catList();
    const allowed = this.launch.params.costumePieces;
    this.pieces = data.pieces.filter((p) => !allowed || allowed.includes(p.id));
    this.catId = this.cats.length === 1 ? this.cats[0]!.id : null;
    this.outfit = {};
    this.ranking = [];
    this.ended = false;
    this.ensureArt();
    this.cameras.main.setBackgroundColor('#e9d3b4');

    const t = uiText.minigames.costume;
    this.add.text(CATS.x, CATS.y - 14, t.pickCat, textStyle(8, '#5c3428', true));
    this.add.text(SLOTS.x, SLOTS.y - 26, t.slots, textStyle(8, '#5c3428', true));
    this.buildStage();
    this.view = this.add.container(0, 0);
    this.input.on('pointerdown', this.onPointer, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.input.off('pointerdown', this.onPointer, this));
    this.hudButton(t.parade, () => this.parade());
    this.redraw();
  }

  protected startGame(): void {
    // Sem tempo na dificuldade: espera o "Desfilar". Com tempo: acabou, desfila com o que tem.
    this.startTimer(this.p.seconds || undefined, () => this.parade(true));
  }

  protected updateGame(): void {}

  protected resultText(r: MiniGameResult): string {
    if (r.skipped || !r.contest) return '';
    const t = uiText.minigames.costume;
    const place = r.contest.rank <= 3 ? t.place[String(r.contest.rank) as '1' | '2' | '3'] : t.place.out;
    const me = this.ranking.find((e) => e.player)!;
    const best = this.ranking[0]!;
    const text = t.result.replace('{theme}', this.theme.name).replace('{place}', place).replace('{cat}', me.cat).replace('{score}', String(me.score));
    return best.player ? text : text + t.winner.replace('{cat}', best.cat).replace('{owner}', best.owner).replace('{score}', String(best.score));
  }

  // ---------- Entrada ----------

  private onPointer(): void {
    if (this.phase !== 'playing' || this.ended) return;
    const { x, y } = this.controls.pointer();
    // Gatos (à esquerda).
    if (x >= CATS.x && x <= CATS.x + CATS.w && y >= CATS.y) {
      const cat = this.cats[Math.floor((y - CATS.y) / CATS.row)];
      if (cat) {
        this.catId = cat.id;
        this.sfx(this.def.sounds?.drop);
        this.redraw();
      }
      return;
    }
    // Peças (à direita): clicar na escolhida tira.
    const hit = this.pieceAt(x, y);
    if (hit) {
      this.outfit[hit.slot] = this.outfit[hit.slot] === hit.id ? undefined : hit.id;
      this.sfx(this.def.sounds?.drop);
      this.redraw();
    }
  }

  private pieceAt(x: number, y: number): CostumePiece | null {
    for (const [i, slot] of COSTUME_SLOTS.entries()) {
      const top = SLOTS.y + i * SLOTS.row;
      if (y < top || y > top + SLOTS.btn) continue;
      const k = Math.floor((x - SLOTS.x) / (SLOTS.btn + 4));
      const within = x - SLOTS.x - k * (SLOTS.btn + 4) <= SLOTS.btn;
      return within && k >= 0 ? this.slotPieces(slot)[k] ?? null : null;
    }
    return null;
  }

  private slotPieces(slot: CostumeSlot): CostumePiece[] {
    return this.pieces.filter((p) => p.slot === slot);
  }

  // ---------- Desfile ----------

  private parade(timeUp = false): void {
    if (this.phase !== 'playing' || this.ended) return;
    const t = uiText.minigames.costume;
    // Sem gato escolhido: com o tempo acabando, vai o primeiro; antes disso, avisa.
    if (!this.catId) {
      if (!timeUp || this.cats.length === 0) return this.float(t.noCat);
      this.catId = this.cats[0]!.id;
    }
    this.ended = true;
    const cat = this.cats.find((c) => c.id === this.catId)!;
    const { score } = scoreOutfit(content.costume, this.theme, this.outfit);
    this.ranking = runContest(content.costume, this.p, this.rng, { cat: cat.name, owner: '', score });
    const rank = this.ranking.findIndex((e) => e.player) + 1;
    const outcome = contestOutcome(rank);
    this.sfx(outcome === 'fail' ? this.def.sounds?.bad : this.def.sounds?.good);
    this.showPodium();
    const prize = rank <= 3 ? content.costume.prizes[String(rank) as '1' | '2' | '3'] : 0;
    this.time.delayedCall(REVIEW_MS, () => this.finish(outcome, score, false, { bonusCoins: prize, contest: { catId: cat.id, theme: this.theme.id, rank } }));
  }

  /** O ranking no palco (antes do resultado): a protagonista destacada. */
  private showPodium(): void {
    const t = uiText.minigames.costume;
    const g = this.add.graphics().setDepth(80);
    g.fillStyle(C.card, 0.96).fillRoundedRect(128, 84, 220, 26 + this.ranking.length * 18, 6).lineStyle(1, C.edge, 1).strokeRoundedRect(128, 84, 220, 26 + this.ranking.length * 18, 6);
    this.add.text(238, 90, t.theme.replace('{theme}', this.theme.name), textStyle(8, '#5c3428', true)).setOrigin(0.5, 0).setDepth(81);
    this.ranking.forEach((e, i) => {
      const label = `${i < 3 ? t.rank.replace('{n}', String(i + 1)) : '·'}  ${e.player ? t.you.replace('{cat}', e.cat) : e.cat}  ${e.score}`;
      this.add.text(138, 108 + i * 18, label, textStyle(8, e.player ? '#3f7a4a' : '#5a4048', e.player)).setDepth(81);
    });
  }

  // ---------- Desenho ----------

  /** O palco: gramado do quintal e bandeirinhas (a arte do jogo), fixo. */
  private buildStage(): void {
    const left = 132;
    const top = 70;
    const cols = 7;
    const rows = 7;
    const grass = content.catalog.tiles.yard_grama_a;
    if (grass) for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) addTileImage(this, left + c * 32, top + r * 32, grass.sheet, frameOf(content.catalog, grass, 0, 0));
    const bunting = content.catalog.tiles.ph_fair_bunting;
    if (bunting) for (let c = 0; c < cols; c++) addTileImage(this, left + c * 32, top - 6, bunting.sheet, frameOf(content.catalog, bunting, 0, 0));
    const g = this.add.graphics();
    g.lineStyle(2, C.edge, 1).strokeRect(left - 1, top - 1, cols * 32 + 2, rows * 32 + 2);
    g.fillStyle(0xf5d6dc, 1).fillEllipse(CAT.x, CAT.y - 4, 150, 34); // tapetinho do desfile
    g.lineStyle(1, 0xc98a98, 1).strokeEllipse(CAT.x, CAT.y - 4, 150, 34);
  }

  private redraw(): void {
    this.view.removeAll(true);
    const data = content.costume;
    const t = uiText.minigames.costume;
    const add = <T extends Phaser.GameObjects.GameObject>(o: T) => (this.view.add(o), o);

    // Tema (no alto do palco).
    add(this.add.text(CAT.x, 50, t.theme.replace('{theme}', this.theme.name), { ...textStyle(10, '#5c3428', true), stroke: '#fff4e0', strokeThickness: 3 }).setOrigin(0.5, 0.5));

    // Gatos.
    this.cats.forEach((c, i) => {
      const y = CATS.y + i * CATS.row;
      const on = this.catId === c.id;
      const g = add(this.add.graphics());
      g.fillStyle(on ? C.on : C.card, 1).fillRoundedRect(CATS.x, y, CATS.w, CATS.row - 4, 5);
      g.lineStyle(on ? 2 : 1, on ? C.pick : C.edge, 1).strokeRoundedRect(CATS.x, y, CATS.w, CATS.row - 4, 5);
      add(this.add.sprite(CATS.x + 15, y + 16, this.catTex(c.variant), 0).setScale(0.75));
      add(this.add.text(CATS.x + 30, y + 9, c.name, textStyle(8, '#5c3428', true)));
    });

    // O gato no palco, com as peças: costas atrás dele; cabeça e pescoço na frente.
    const cat = this.cats.find((c) => c.id === this.catId);
    if (cat) {
      const at = (slot: CostumeSlot) => {
        const [ax, ay] = data.slots[slot].anchor;
        return { x: CAT.x + (ax - 16) * ZOOM, y: CAT.y + (ay - 28) * ZOOM };
      };
      const wear = (slot: CostumeSlot) => {
        const piece = data.pieces.find((p) => p.id === this.outfit[slot]);
        if (!piece) return;
        const { x, y } = at(slot);
        add(this.add.image(x, y, pieceKey(piece)).setOrigin(0.5, slot === 'head' ? 1 : 0).setScale(ZOOM));
      };
      for (const s of COSTUME_SLOTS) if (data.slots[s].behind) wear(s);
      add(this.add.sprite(CAT.x, CAT.y, this.catTex(cat.variant), 0).setOrigin(0.5, 28 / 32).setScale(ZOOM));
      for (const s of COSTUME_SLOTS) if (!data.slots[s].behind) wear(s);
    }

    // Peças por lugar.
    COSTUME_SLOTS.forEach((slot, i) => {
      const top = SLOTS.y + i * SLOTS.row;
      add(this.add.text(SLOTS.x, top - 12, data.slots[slot].name, textStyle(8, '#5c3428', true)));
      this.slotPieces(slot).forEach((p, k) => {
        const x = SLOTS.x + k * (SLOTS.btn + 4);
        const on = this.outfit[slot] === p.id;
        const g = add(this.add.graphics());
        g.fillStyle(on ? C.on : C.card, 1).fillRoundedRect(x, top, SLOTS.btn, SLOTS.btn, 5);
        g.lineStyle(on ? 2 : 1, on ? C.pick : C.edge, 1).strokeRoundedRect(x, top, SLOTS.btn, SLOTS.btn, 5);
        const img = add(this.add.image(x + SLOTS.btn / 2, top + SLOTS.btn / 2, pieceKey(p)));
        img.setScale(Math.min(2, (SLOTS.btn - 8) / img.width, (SLOTS.btn - 8) / img.height));
      });
      // A escolhida: nome, cor e estilo.
      const chosen = data.pieces.find((p) => p.id === this.outfit[slot]);
      const info = chosen
        ? `${chosen.name} · ${t.colors.replace('{color}', data.colors[chosen.color]?.name ?? chosen.color).replace('{style}', t.styles[chosen.style as keyof typeof t.styles] ?? chosen.style)}`
        : t.none;
      add(this.add.text(SLOTS.x, top + SLOTS.btn + 4, info, { ...textStyle(7, chosen ? '#3b2a32' : '#8a7a80'), wordWrap: { width: 266 } }));
    });
    const n = COSTUME_SLOTS.filter((s) => this.outfit[s]).length;
    this.setHudInfo(t.hud.replace('{theme}', this.theme.name).replace('{n}', String(n)));
  }

  // ---------- Ajudantes ----------

  private catTex(variant: string): string {
    return this.textures.exists(catTexture(variant)) ? catTexture(variant) : catTexture(this.launch.catVariant);
  }

  private float(text: string): void {
    const label = this.add.text(CAT.x, 330, text, { ...textStyle(9, '#d9475d', true), stroke: '#fff4e0', strokeThickness: 3 }).setOrigin(0.5, 1).setDepth(100);
    this.tweens.add({ targets: label, y: label.y - 12, alpha: 0, delay: 700, duration: 500, onComplete: () => label.destroy() });
  }

  private sfx(id: string | undefined): void {
    if (id) services().audio.sfx(id);
  }

  /** As peças no tamanho do quadro do gato (1 px = 1 px do Cosy Cats), com contorno marrom como a arte do jogo. */
  private ensureArt(): void {
    const outline = 0x5c3428;
    for (const p of content.costume.pieces) {
      const key = pieceKey(p);
      if (this.textures.exists(key)) continue;
      const fill = Phaser.Display.Color.HexStringToColor(content.costume.colors[p.color]?.hex ?? '#ffffff').color;
      const light = Phaser.Display.Color.IntegerToColor(fill).lighten(18).color;
      const g = this.make.graphics({}, false);
      const [w, h] = SHAPES[p.shape]?.(g, fill, light, outline) ?? [8, 8];
      g.generateTexture(key, w, h);
      g.destroy();
    }
  }
}

type Draw = (g: Phaser.GameObjects.Graphics, fill: number, light: number, outline: number) => [number, number];

/** Cada forma desenha a peça e devolve o tamanho da textura (px do quadro do gato). */
const SHAPES: Record<string, Draw> = {
  bow: (g, f, l, o) => {
    g.fillStyle(o).fillTriangle(0, 0, 0, 7, 6, 3.5).fillTriangle(12, 0, 12, 7, 6, 3.5);
    g.fillStyle(f).fillTriangle(1, 1, 1, 6, 5, 3.5).fillTriangle(11, 1, 11, 6, 7, 3.5);
    g.fillStyle(o).fillRect(5, 2, 2, 3);
    g.fillStyle(l).fillRect(1, 1, 1, 1);
    return [12, 7];
  },
  flower_crown: (g, f, _l, o) => {
    g.fillStyle(o).fillRect(1, 4, 16, 2);
    g.fillStyle(f).fillRect(1, 4, 16, 1);
    for (const [x, c] of [[3, 0xe58fa4], [7, 0xfbf3e4], [11, 0xf2c45a], [15, 0xe58fa4]] as const) {
      g.fillStyle(o).fillCircle(x, 3, 2);
      g.fillStyle(c).fillCircle(x, 3, 1.4);
    }
    return [18, 6];
  },
  crown: (g, f, l, o) => {
    g.fillStyle(o).fillRect(0, 3, 12, 6).fillTriangle(0, 4, 2, 0, 4, 4).fillTriangle(4, 4, 6, 0, 8, 4).fillTriangle(8, 4, 10, 0, 12, 4);
    g.fillStyle(f).fillRect(1, 4, 10, 4).fillTriangle(1, 4, 2, 1, 3, 4).fillTriangle(5, 4, 6, 1, 7, 4).fillTriangle(9, 4, 10, 1, 11, 4);
    g.fillStyle(0xd0614f).fillRect(5, 5, 2, 2);
    g.fillStyle(l).fillRect(1, 4, 10, 1);
    return [12, 9];
  },
  sailor_hat: (g, f, l, o) => {
    g.fillStyle(o).fillEllipse(7, 6, 14, 4).fillEllipse(7, 4, 10, 6);
    g.fillStyle(f).fillEllipse(7, 6, 12, 2.5).fillEllipse(7, 4, 8.5, 4.5);
    g.fillStyle(0x6f9fd0).fillRect(3, 5, 8, 1);
    g.fillStyle(l).fillRect(5, 2, 2, 1);
    return [14, 8];
  },
  beret: (g, f, l, o) => {
    g.fillStyle(o).fillEllipse(8, 4, 15, 6).fillRect(7, 0, 2, 2);
    g.fillStyle(f).fillEllipse(8, 4, 13, 4.5);
    g.fillStyle(l).fillRect(4, 2, 4, 1);
    return [16, 7];
  },
  star_band: (g, f, l, o) => {
    g.fillStyle(o).fillRect(0, 6, 16, 2);
    g.fillStyle(f).fillRect(0, 6, 16, 1);
    const star = (cx: number, cy: number, r: number, c: number) => {
      const pts: Phaser.Types.Math.Vector2Like[] = [];
      for (let i = 0; i < 10; i++) {
        const a = -Math.PI / 2 + (i * Math.PI) / 5;
        const rr = i % 2 === 0 ? r : r * 0.45;
        pts.push({ x: cx + Math.cos(a) * rr, y: cy + Math.sin(a) * rr });
      }
      g.fillStyle(c).fillPoints(pts, true);
    };
    star(8, 4, 4.5, o);
    star(8, 4, 3.3, 0xf2c45a);
    g.fillStyle(l).fillRect(7, 2, 1, 1);
    return [16, 8];
  },
  scarf: (g, f, l, o) => {
    g.fillStyle(o).fillRoundedRect(0, 0, 14, 4, 2).fillRect(9, 2, 4, 7);
    g.fillStyle(f).fillRoundedRect(1, 1, 12, 2, 1).fillRect(10, 3, 2, 5);
    g.fillStyle(l).fillRect(2, 1, 3, 1);
    return [14, 9];
  },
  bowtie: (g, f, l, o) => {
    g.fillStyle(o).fillTriangle(0, 0, 0, 6, 5, 3).fillTriangle(10, 0, 10, 6, 5, 3);
    g.fillStyle(f).fillTriangle(1, 1, 1, 5, 4, 3).fillTriangle(9, 1, 9, 5, 6, 3);
    g.fillStyle(o).fillRect(4, 2, 2, 2);
    g.fillStyle(l).fillRect(1, 1, 1, 1);
    return [10, 6];
  },
  bell_collar: (g, f, l, o) => {
    g.fillStyle(o).fillRect(0, 0, 14, 3);
    g.fillStyle(0xd0614f).fillRect(0, 1, 14, 1);
    g.fillStyle(o).fillCircle(7, 4.5, 2.5);
    g.fillStyle(f).fillCircle(7, 4.5, 1.8);
    g.fillStyle(l).fillRect(6, 3, 1, 1);
    return [14, 8];
  },
  ruffle: (g, f, l, o) => {
    for (let x = 2; x <= 14; x += 3) {
      g.fillStyle(o).fillCircle(x, 2.5, 2.5);
      g.fillStyle(f).fillCircle(x, 2.5, 1.7);
    }
    g.fillStyle(l).fillRect(1, 1, 14, 1);
    return [16, 5];
  },
  cape: (g, f, l, o) => {
    // Sai dos ombros e abre embaixo, para aparecer dos dois lados do corpo.
    g.fillStyle(o).fillPoints([{ x: 7, y: 0 }, { x: 21, y: 0 }, { x: 28, y: 14 }, { x: 0, y: 14 }], true);
    g.fillStyle(f).fillPoints([{ x: 8, y: 1 }, { x: 20, y: 1 }, { x: 26.5, y: 13 }, { x: 1.5, y: 13 }], true);
    g.fillStyle(l).fillRect(8, 1, 12, 1);
    return [28, 14];
  },
  wings: (g, f, l, o) => {
    g.fillStyle(o).fillEllipse(6, 6, 12, 11).fillEllipse(20, 6, 12, 11);
    g.fillStyle(f).fillEllipse(6, 6, 10, 9).fillEllipse(20, 6, 10, 9);
    g.fillStyle(l).fillEllipse(5, 4, 5, 3).fillEllipse(21, 4, 5, 3);
    return [26, 12];
  },
  backpack: (g, f, l, o) => {
    g.fillStyle(o).fillRoundedRect(14, 0, 9, 9, 2).fillRect(2, 4, 20, 2);
    g.fillStyle(f).fillRoundedRect(15, 1, 7, 7, 1);
    g.fillStyle(0xfbf3e4).fillRect(15, 4, 7, 1).fillRect(18, 1, 1, 7);
    g.fillStyle(l).fillRect(15, 1, 2, 1);
    return [24, 10];
  },
  garland: (g, f, _l, o) => {
    for (let i = 0; i <= 6; i++) {
      const x = 2 + i * 3;
      const y = 2 + Math.sin((i / 6) * Math.PI) * 4;
      g.fillStyle(0x8fb87a).fillRect(x - 1, y + 1, 3, 1);
      g.fillStyle(o).fillCircle(x, y, 2);
      g.fillStyle(i % 2 ? 0xfbf3e4 : f).fillCircle(x, y, 1.3);
    }
    return [22, 9];
  },
};
