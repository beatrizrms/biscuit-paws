// Montar a feira: o quintal visto de cima. Embaixo, as peças (mesa, caixa, cercadinho, cartaz, petiscos) com o que
// sobra de cada; à esquerda, os gatos do café; à direita, as regras com o que já vale. Clique numa peça e no gramado
// para pôr; clique numa peça posta para mudar de lugar; botão direito tira. Clique num gato e numa caixa ou
// cercadinho para levar o gato. A regra (lugar, caminho, pontuação) mora em src/core/fairSetup.ts; aqui só se desenha.
import Phaser from 'phaser';
import {
  fairItemAt,
  fairSetupOutcome,
  houseCat,
  itemCells,
  newFairBoard,
  placeFairItem,
  placeProblem,
  removeFairItem,
  scoreFair,
  stockLeft,
  unhouseCat,
  type FairBoard,
  type FairItemDef,
  type FairItemKind,
  type FairScore,
  type FairSetupParams,
} from '../../core/fairSetup';
import type { AdoptCat } from '../../core/adoption';
import type { Cell } from '../../core/map';
import type { MiniGameResult } from '../../core/minigame';
import { paramsOf } from '../../core/minigame';
import { content, uiText } from '../content';
import { catTexScale, catTexture } from '../entities/Cat';
import { frameOf } from '../../core/tiles';
import { addTileImage } from '../tileArt';
import { services } from '../services';
import { loadCatVariants } from './assets';
import { MiniGameScene } from './MiniGameScene';

export const FAIR_SETUP_SCENE = 'MiniGame.fair_setup';

/**
 * Peça sem `tile` em data/fair_setup.json (uma peça nova antes da arte) aparece como um quadrado de madeira, com a
 * chave fair_setup_<tipo>. Hoje todas têm arte do catálogo.
 */
const placeholderKey = (kind: FairItemKind) => `fair_setup_${kind}`;

const CELL = 32;
/** Canto do tabuleiro (px lógicos, tela de 640 x 360). */
const BOARD = { x: 124, y: 40 };
const CATS = { x: 8, y: 52, w: 108, row: 34 };
const PALETTE = { y: 284, w: 76, h: 66, gap: 4 };
const RULES = { x: 516, y: 52 };

const C = { ok: 0x68ad8a, bad: 0xd9475d, edge: 0x7f4b33, card: 0xfff7e6, pick: 0xe0a94e };
const textStyle = (size: number, color = '#3b2a32', bold = false): Phaser.Types.GameObjects.Text.TextStyle => ({
  fontFamily: 'Trebuchet MS, sans-serif',
  fontSize: `${size}px`,
  fontStyle: bold ? 'bold' : 'normal',
  color,
  resolution: 4,
});

export class FairSetupScene extends MiniGameScene {
  private p!: FairSetupParams;
  private board!: FairBoard;
  private cats: AdoptCat[] = [];
  /** Peça escolhida na paleta (ou a que está sendo mudada de lugar: `moving`). */
  private picked: string | null = null;
  private moving: number | null = null;
  private pickedCat: string | null = null;
  private view!: Phaser.GameObjects.Container;
  private ghost!: Phaser.GameObjects.Graphics;
  private ended = false;

  constructor() {
    super('fair_setup', FAIR_SETUP_SCENE);
  }

  preload(): void {
    loadCatVariants(this, this.catList().map((c) => c.variant));
  }

  /** Os gatos que podem ir: os do café (params.adoptCats); aberto pelo debug, alguns do abrigo da vila. */
  private catList(): AdoptCat[] {
    return this.launch.params.adoptCats ?? content.adoption.cats.slice(0, 5);
  }

  protected buildGame(): void {
    this.p = paramsOf<FairSetupParams>(content.minigames, 'fair_setup', this.launch.params.difficulty);
    this.board = newFairBoard();
    this.cats = this.catList();
    this.picked = null;
    this.moving = null;
    this.pickedCat = null;
    this.ended = false;
    this.ensureArt();
    this.cameras.main.setBackgroundColor('#e9d3b4');
    this.input.mouse?.disableContextMenu();

    const t = uiText.minigames.fair_setup;
    this.add.text(CATS.x, CATS.y - 14, t.cats.replace('{n}', String(Math.min(this.p.cats, this.cats.length))), textStyle(8, '#5c3428', true));
    this.add.text(RULES.x, RULES.y - 14, t.rules, textStyle(8, '#5c3428', true));
    this.view = this.add.container(0, 0);
    this.ghost = this.add.graphics().setDepth(50);

    this.input.on('pointerdown', this.onPointer, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.input.off('pointerdown', this.onPointer, this));
    this.hudButton(t.done, () => this.confirm());
    this.redraw();
  }

  protected startGame(): void {
    this.startTimer(undefined, () => {}); // sem tempo: é um quebra-cabeça
  }

  protected updateGame(): void {
    this.drawGhost();
  }

  protected resultText(r: MiniGameResult): string {
    if (r.skipped || !r.fairSetup) return '';
    const t = uiText.minigames.fair_setup;
    return [t.result.replace('{score}', String(r.score)).replace('{visitors}', String(r.fairSetup.visitors)), r.fairSetup.extraFamilies > 0 ? t.families.replace('{n}', String(r.fairSetup.extraFamilies)) : ''].filter(Boolean).join('\n');
  }

  // ---------- Entrada ----------

  private onPointer(p: Phaser.Input.Pointer): void {
    if (this.phase !== 'playing' || this.ended) return;
    const { x, y } = this.controls.pointer();
    const right = p.rightButtonDown();
    const cell = this.cellAt(x, y);
    if (right) {
      const item = cell && fairItemAt(content.fairSetup, this.board, cell);
      if (item && !this.moving) {
        removeFairItem(this.board, item.uid);
        this.sfx(this.def.sounds?.drop);
      }
      this.clearPick();
      return this.redraw();
    }
    const kind = this.paletteAt(x, y);
    if (kind) return this.pickItem(kind);
    const cat = this.catAt(x, y);
    if (cat) return this.pickCat(cat);
    if (cell) this.clickBoard(cell);
  }

  private pickItem(kind: FairItemKind): void {
    const def = this.itemOf(kind);
    if (this.moving) this.moving = null;
    if (stockLeft(content.fairSetup, this.p, this.board, kind) <= 0) return this.float(uiText.minigames.fair_setup.problem.stock);
    this.pickedCat = null;
    this.picked = this.picked === def.id ? null : def.id;
    this.redraw();
  }

  private pickCat(cat: AdoptCat): void {
    this.picked = null;
    this.moving = null;
    // Gato já na feira: clicar de novo tira ele.
    if (this.board.housed[cat.id] !== undefined) {
      unhouseCat(this.board, cat.id);
      this.pickedCat = null;
    } else this.pickedCat = this.pickedCat === cat.id ? null : cat.id;
    this.redraw();
  }

  private clickBoard(cell: Cell): void {
    const t = uiText.minigames.fair_setup;
    const data = content.fairSetup;
    if (this.pickedCat) {
      const item = fairItemAt(data, this.board, cell);
      const problem = item ? houseCat(data, this.p, this.board, this.pickedCat, item.uid) : 'not_holder';
      if (problem) return this.float(t.problem[problem]);
      this.pickedCat = null;
      this.sfx(this.def.sounds?.drop);
      return this.redraw();
    }
    if (this.picked) {
      const at = this.anchor(cell, this.picked);
      const r = placeFairItem(data, this.p, this.board, this.picked, at, this.moving ?? undefined);
      if (typeof r === 'string') return this.float(t.problem[r]);
      this.sfx(this.def.sounds?.drop);
      // Mudando de lugar: solta. Pondo do estoque: continua com a peça, se ainda sobra.
      const kind = data.items.find((i) => i.id === this.picked)!.kind;
      if (this.moving || stockLeft(data, this.p, this.board, kind) <= 0) this.clearPick();
      return this.redraw();
    }
    const item = fairItemAt(data, this.board, cell);
    if (item) {
      this.picked = item.item;
      this.moving = item.uid;
      this.redraw();
    }
  }

  private clearPick(): void {
    this.picked = null;
    this.moving = null;
    this.pickedCat = null;
  }

  // ---------- Pronto ----------

  private confirm(): void {
    if (this.phase !== 'playing' || this.ended) return;
    const r = this.score();
    if (!r.hasTable) return this.float(uiText.minigames.fair_setup.needTable);
    this.ended = true;
    const outcome = fairSetupOutcome(this.p, r);
    this.sfx(outcome === 'fail' ? this.def.sounds?.bad : this.def.sounds?.good);
    const cats = this.cats.filter((c) => this.board.housed[c.id] !== undefined).map((c) => c.id);
    this.finish(outcome, r.score, false, { fairSetup: { cats, visitors: r.visitors, extraFamilies: r.extraFamilies } });
  }

  private score(): FairScore {
    return scoreFair(content.fairSetup, this.p, this.board, this.cats.length);
  }

  // ---------- Desenho ----------

  private redraw(): void {
    this.view.removeAll(true);
    const data = content.fairSetup;
    const t = uiText.minigames.fair_setup;
    const { cols, rows } = data.board;
    const add = <T extends Phaser.GameObjects.GameObject>(o: T) => (this.view.add(o), o);
    const { floor, gateFloor } = data.board;
    // Gramado sorteado por célula, mas sempre igual (a conta não usa o rng: a tela não muda a cada redesenho).
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) this.tileImages(floor[(c * 7 + r * 13) % floor.length]!, BOARD.x + c * CELL, BOARD.y + (r + 1) * CELL).forEach(add);
    for (const [c, r] of data.board.gate) this.tileImages(gateFloor, BOARD.x + c * CELL, BOARD.y + (r + 1) * CELL).forEach(add);
    const [gc, gr] = data.board.gate[0]!;
    add(this.add.text(BOARD.x + (gc + data.board.gate.length / 2) * CELL, BOARD.y + (gr + 1) * CELL + 1, t.gate, textStyle(7, '#5c3428', true)).setOrigin(0.5, 0));
    for (const d of data.board.decor) {
      const t = content.catalog.tiles[d.tile]!;
      this.tileImages(d.tile, BOARD.x + d.at[0] * CELL, BOARD.y + (d.at[1] + t.h) * CELL).forEach(add);
    }
    const frame = add(this.add.graphics());
    frame.lineStyle(2, C.edge, 1).strokeRect(BOARD.x - 1, BOARD.y - 1, cols * CELL + 2, rows * CELL + 2);

    // Peças postas; sem caminho, contorno vermelho. A que está sendo mudada fica meio apagada.
    const r = this.score();
    for (const x of this.board.placed) {
      const def = data.items.find((i) => i.id === x.item)!;
      const imgs = this.pieceImages(def, BOARD.x + x.at[0] * CELL, BOARD.y + x.at[1] * CELL);
      imgs.forEach(add);
      if (x.uid === this.moving) imgs.forEach((i) => i.setAlpha(0.4));
      if (r.blockedItems.includes(x.uid)) {
        const g = add(this.add.graphics());
        g.lineStyle(2, C.bad, 1).strokeRect(BOARD.x + x.at[0] * CELL + 1, BOARD.y + x.at[1] * CELL + 1, def.size[0] * CELL - 2, def.size[1] * CELL - 2);
      }
      // Os gatos dentro (lado a lado).
      const inside = this.cats.filter((c) => this.board.housed[c.id] === x.uid);
      inside.forEach((c, i) => {
        const cx = BOARD.x + x.at[0] * CELL + (def.size[0] * CELL * (i + 1)) / (inside.length + 1);
        // Na caixa (1x1) o gato fica pequeno, sentado na frente da portinha, para a caixa continuar aparecendo.
        const small = def.size[0] === 1;
        const cy = BOARD.y + x.at[1] * CELL + def.size[1] * CELL * (small ? 0.82 : 0.5);
        add(this.add.sprite(cx + (small ? 8 : 0), cy, this.catTex(c), 0).setScale((small ? 0.55 : 0.9) * catTexScale(this.catTex(c))));
      });
    }

    // Gatos (à esquerda).
    this.cats.forEach((c, i) => {
      const y = CATS.y + i * CATS.row;
      const housed = this.board.housed[c.id] !== undefined;
      const picked = this.pickedCat === c.id;
      const g = add(this.add.graphics());
      g.fillStyle(housed ? 0xe4f2e8 : C.card, 1).fillRoundedRect(CATS.x, y, CATS.w, CATS.row - 4, 5);
      g.lineStyle(picked ? 2 : 1, picked ? C.pick : C.edge, 1).strokeRoundedRect(CATS.x, y, CATS.w, CATS.row - 4, 5);
      add(this.add.sprite(CATS.x + 15, y + 16, this.catTex(c), 0).setScale(0.75 * catTexScale(this.catTex(c))));
      add(this.add.text(CATS.x + 30, y + 5, c.name, textStyle(8, '#5c3428', true)));
      add(this.add.text(CATS.x + 30, y + 17, housed ? t.catIn : t.catOut, textStyle(7, housed ? '#3f7a4a' : '#8a7a80')));
    });

    // Paleta (embaixo): ícone, nome e quantas sobram.
    const kinds = data.items;
    kinds.forEach((def, i) => {
      const x = BOARD.x + i * (PALETTE.w + PALETTE.gap);
      const left = stockLeft(data, this.p, this.board, def.kind);
      const picked = this.picked === def.id && this.moving === null;
      const g = add(this.add.graphics());
      g.fillStyle(left > 0 ? C.card : 0xe6dccd, 1).fillRoundedRect(x, PALETTE.y, PALETTE.w, PALETTE.h, 5);
      g.lineStyle(picked ? 2 : 1, picked ? C.pick : C.edge, 1).strokeRoundedRect(x, PALETTE.y, PALETTE.w, PALETTE.h, 5);
      // O ícone é a própria peça, encolhida para caber (o cercadinho 2x2 fica na metade).
      const [pw, ph] = [def.size[0] * CELL, def.size[1] * CELL];
      const k = Math.min(1, 30 / ph, (PALETTE.w - 12) / pw);
      const icon = add(this.add.container(x + PALETTE.w / 2 - (pw * k) / 2, PALETTE.y + 5, this.pieceImages(def, 0, 0)).setScale(k));
      if (left <= 0) icon.setAlpha(0.4);
      add(this.add.text(x + PALETTE.w / 2, PALETTE.y + 38, def.name, { ...textStyle(7, '#5c3428', true), align: 'center', wordWrap: { width: PALETTE.w - 6 } }).setOrigin(0.5, 0));
      add(this.add.text(x + PALETTE.w - 4, PALETTE.y + 3, `x${left}`, textStyle(7, left > 0 ? '#3b2a32' : '#a99fa6', true)).setOrigin(1, 0));
    });

    // Regras (à direita): cada uma com o que já vale, e os visitantes.
    const rule = (i: number, label: string, value: number) => {
      const y = RULES.y + i * 26;
      const color = value >= 1 ? '#3f7a4a' : value > 0 ? '#b0782a' : '#a0525e';
      add(this.add.text(RULES.x, y, `${value >= 1 ? '✓' : value > 0 ? '~' : '✗'} ${label}`, { ...textStyle(7.5, color, true), wordWrap: { width: 118 } }));
    };
    rule(0, t.rule.housed, r.housed);
    rule(1, t.rule.access, r.access);
    rule(2, t.rule.sign, r.sign);
    rule(3, t.rule.treats, r.treats);
    rule(4, t.rule.table, r.hasTable ? 1 : 0);
    add(this.add.text(RULES.x, RULES.y + 5 * 26 + 6, t.score.replace('{score}', String(r.score)), textStyle(9, '#5c3428', true)));
    add(this.add.text(RULES.x, RULES.y + 5 * 26 + 22, t.visitors.replace('{n}', String(r.visitors)), textStyle(8, '#5c3428')));
    if (r.extraFamilies > 0) add(this.add.text(RULES.x, RULES.y + 5 * 26 + 36, t.families.replace('{n}', String(r.extraFamilies)), { ...textStyle(7, '#3f7a4a'), wordWrap: { width: 118 } }));
    this.setHudInfo(t.hud.replace('{placed}', String(this.board.placed.length)).replace('{cats}', String(Object.keys(this.board.housed).length)).replace('{want}', String(Math.min(this.p.cats, this.cats.length))));
  }

  /** A peça escolhida seguindo o mouse: verde onde cabe, vermelha onde não. */
  private drawGhost(): void {
    this.ghost.clear();
    if (!this.picked || this.ended) return;
    const { x, y } = this.controls.pointer();
    const cell = this.cellAt(x, y);
    if (!cell) return;
    const def = content.fairSetup.items.find((i) => i.id === this.picked)!;
    const at = this.anchor(cell, def.id);
    const ok = !placeProblem(content.fairSetup, this.p, this.board, def.id, at, this.moving ?? undefined);
    for (const [c, r] of itemCells(def, at)) this.ghost.fillStyle(ok ? C.ok : C.bad, 0.4).fillRect(BOARD.x + c * CELL, BOARD.y + r * CELL, CELL, CELL);
  }

  // ---------- Ajudantes ----------

  /** A arte da peça no canto (x, y): os tiles do catálogo com a base embaixo da área dela, ou o provisório. */
  private pieceImages(def: FairItemDef, x: number, y: number): Phaser.GameObjects.Image[] {
    if (!def.tile) return [this.add.image(x, y, placeholderKey(def.kind)).setOrigin(0)];
    const bottom = y + def.size[1] * CELL;
    return [def.tile, def.topTile].flatMap((t) => (t ? this.tileImages(t, x, bottom) : []));
  }

  /** Um tile do catálogo (todos os quadros dele), com a esquerda em `left` e a base em `bottom`. */
  private tileImages(name: string, left: number, bottom: number): Phaser.GameObjects.Image[] {
    const t = content.catalog.tiles[name]!;
    const out: Phaser.GameObjects.Image[] = [];
    for (let dy = 0; dy < t.h; dy++) for (let dx = 0; dx < t.w; dx++) out.push(addTileImage(this, left + dx * CELL, bottom - (t.h - dy) * CELL, t.sheet, frameOf(content.catalog, t, dx, dy)));
    return out;
  }

  private itemOf(kind: FairItemKind): FairItemDef {
    return content.fairSetup.items.find((i) => i.kind === kind)!;
  }

  /** O mouse fica no meio da peça (peças grandes): o canto é a célula menos a metade do tamanho. */
  private anchor([c, r]: Cell, itemId: string): Cell {
    const def = content.fairSetup.items.find((i) => i.id === itemId)!;
    return [c - Math.floor((def.size[0] - 1) / 2), r - Math.floor((def.size[1] - 1) / 2)];
  }

  private cellAt(x: number, y: number): Cell | null {
    const { cols, rows } = content.fairSetup.board;
    const c = Math.floor((x - BOARD.x) / CELL);
    const r = Math.floor((y - BOARD.y) / CELL);
    return c >= 0 && r >= 0 && c < cols && r < rows ? [c, r] : null;
  }

  private paletteAt(x: number, y: number): FairItemKind | null {
    if (y < PALETTE.y || y > PALETTE.y + PALETTE.h) return null;
    const i = Math.floor((x - BOARD.x) / (PALETTE.w + PALETTE.gap));
    const within = x - BOARD.x - i * (PALETTE.w + PALETTE.gap) <= PALETTE.w;
    return within ? content.fairSetup.items[i]?.kind ?? null : null;
  }

  private catAt(x: number, y: number): AdoptCat | null {
    if (x < CATS.x || x > CATS.x + CATS.w || y < CATS.y) return null;
    return this.cats[Math.floor((y - CATS.y) / CATS.row)] ?? null;
  }

  private catTex(c: AdoptCat): string {
    return this.textures.exists(catTexture(c.variant)) ? catTexture(c.variant) : catTexture(this.launch.catVariant);
  }

  private float(text: string): void {
    const label = this.add.text(320, 278, text, { ...textStyle(9, '#d9475d', true), stroke: '#fff4e0', strokeThickness: 3 }).setOrigin(0.5, 1).setDepth(100);
    this.tweens.add({ targets: label, y: label.y - 12, alpha: 0, delay: 700, duration: 500, onComplete: () => label.destroy() });
  }

  private sfx(id: string | undefined): void {
    if (id) services().audio.sfx(id);
  }

  private ensureArt(): void {
    const make = (key: string, w: number, h: number, draw: (g: Phaser.GameObjects.Graphics) => void) => {
      if (this.textures.exists(key)) return;
      const g = this.make.graphics({}, false);
      draw(g);
      g.generateTexture(key, w, h);
      g.destroy();
    };
    const size = (kind: FairItemKind) => this.itemOf(kind).size.map((n) => n * CELL) as [number, number];
    for (const def of content.fairSetup.items.filter((d) => !d.tile)) {
      const [w, h] = size(def.kind);
      make(placeholderKey(def.kind), w, h, (g) => g.fillStyle(0xd8b083, 1).fillRoundedRect(2, 2, w - 4, h - 4, 4));
    }
  }
}
