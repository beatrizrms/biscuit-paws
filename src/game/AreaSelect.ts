// Marcar a área de uma obra no café (troca de acabamento), como no The Sims: um retângulo escuro por cima das
// células da superfície. Mouse: arrastar; Ctrl + arrastar marca mais uma área (tudo vira uma obra só). Teclado: setas
// movem, Espaço fixa o canto, Ctrl + Espaço guarda a área e começa outra, Enter confirma, Esc cancela.
// Só desenha e lê a entrada: quem diz quais células contam e quanto custa é a sessão (finishQuote).
import Phaser from 'phaser';
import type { Cell } from '../core/map';

export interface AreaSelectOptions {
  tileSize: number;
  /** Célula de partida do cursor (os pés dela). */
  start: Cell;
  /** Limites do mapa (colunas, linhas). */
  cols: number;
  rows: number;
  /** Células que as áreas pegam e o orçamento (null = nada serve). Sempre pelo menos uma área. */
  quote(areas: [Cell, Cell][]): { cells: Cell[]; text: string } | null;
  onConfirm(areas: [Cell, Cell][]): void;
  /** Enter sem nenhuma área marcada. */
  onEmpty(): void;
  onCancel(): void;
}

const DEPTH = 1e6 - 10;

export class AreaSelect {
  private gfx: Phaser.GameObjects.Graphics;
  /** O aviso com as instruções e o orçamento ao vivo (HTML, por cima do jogo, como os outros avisos). */
  private label: HTMLElement;
  private anchor: Cell | null = null;
  /** Áreas já guardadas (Ctrl + arrastar, Ctrl + Espaço); a que está sendo marcada fica em anchor/cursor. */
  private kept: [Cell, Cell][] = [];
  private cursor: Cell;
  private dragging = false;
  private readonly offs: (() => void)[] = [];

  constructor(
    private scene: Phaser.Scene,
    private opt: AreaSelectOptions,
    hint: string,
  ) {
    this.cursor = [...opt.start];
    this.gfx = scene.add.graphics().setDepth(DEPTH);
    this.label = document.createElement('div');
    this.label.className = 'area-select-hint';
    document.body.appendChild(this.label);
    this.hint = hint;
    const cellAt = (p: Phaser.Input.Pointer): Cell => {
      const ts = opt.tileSize;
      return [Phaser.Math.Clamp(Math.floor(p.worldX / ts), 0, opt.cols - 1), Phaser.Math.Clamp(Math.floor(p.worldY / ts), 0, opt.rows - 1)];
    };
    const down = (p: Phaser.Input.Pointer) => {
      if (p.rightButtonDown()) return this.cancel();
      // Ctrl: a área de agora fica guardada e começa outra; sem Ctrl, recomeça do zero.
      const ctrl = (p.event as MouseEvent | undefined)?.ctrlKey || (p.event as MouseEvent | undefined)?.metaKey;
      if (ctrl) this.keep();
      else this.kept = [];
      this.anchor = cellAt(p);
      this.cursor = cellAt(p);
      this.dragging = true;
      this.draw();
    };
    const move = (p: Phaser.Input.Pointer) => {
      if (!this.dragging) return;
      this.cursor = cellAt(p);
      this.draw();
    };
    const up = () => (this.dragging = false);
    scene.input.on('pointerdown', down);
    scene.input.on('pointermove', move);
    scene.input.on('pointerup', up);
    this.offs.push(() => scene.input.off('pointerdown', down), () => scene.input.off('pointermove', move), () => scene.input.off('pointerup', up));
    const key = (e: KeyboardEvent) => {
      const step: Record<string, Cell> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1], a: [-1, 0], d: [1, 0], w: [0, -1], s: [0, 1] };
      const d = step[e.key];
      if (d) {
        this.cursor = [Phaser.Math.Clamp(this.cursor[0] + d[0], 0, opt.cols - 1), Phaser.Math.Clamp(this.cursor[1] + d[1], 0, opt.rows - 1)];
        this.draw();
      } else if (e.key === ' ' && (e.ctrlKey || e.metaKey)) this.keep();
      else if (e.key === ' ') this.anchor = this.anchor ? null : [...this.cursor];
      else if (e.key === 'Enter') this.confirm();
      else if (e.key === 'Escape') this.cancel();
      else return;
      e.preventDefault();
      this.draw();
    };
    window.addEventListener('keydown', key);
    this.offs.push(() => window.removeEventListener('keydown', key));
    this.draw();
  }

  private hint: string;

  /** Os dois cantos da seleção (sem âncora: só a célula do cursor). */
  private corners(): [Cell, Cell] {
    return [this.anchor ?? this.cursor, this.cursor];
  }

  /** Guarda a área que está sendo marcada (se tiver uma) e libera o cursor para a próxima. */
  private keep(): void {
    if (!this.anchor) return;
    this.kept.push(this.corners());
    this.anchor = null;
  }

  /** Todas as áreas: as guardadas e, se estiver marcando uma, ela também. */
  private areas(): [Cell, Cell][] {
    return this.anchor ? [...this.kept, this.corners()] : [...this.kept];
  }

  private draw(): void {
    const ts = this.opt.tileSize;
    // Orçamento só com área marcada (o cursor sozinho não conta: o Enter não confirmaria).
    const areas = this.areas();
    const q = areas.length > 0 ? this.opt.quote(areas) : null;
    this.gfx.clear();
    // As células que a obra pega: escuras. O retângulo marcado: contorno claro.
    this.gfx.fillStyle(0x2b1d1a, 0.5);
    for (const [c, r] of q?.cells ?? []) this.gfx.fillRect(c * ts, r * ts, ts, ts);
    // O contorno de cada área guardada e o da área de agora (ou o cursor, no teclado).
    const rects = this.anchor ? areas : [...areas, this.corners()];
    for (const [a, b] of rects) {
      const x0 = Math.min(a[0], b[0]) * ts;
      const y0 = Math.min(a[1], b[1]) * ts;
      this.gfx.lineStyle(1, 0xfff4e0, 0.95).strokeRect(x0 + 0.5, y0 + 0.5, (Math.abs(a[0] - b[0]) + 1) * ts - 1, (Math.abs(a[1] - b[1]) + 1) * ts - 1);
    }
    this.label.innerHTML = `<span>${this.hint}</span><b>${q?.text ?? ''}</b>`;
  }

  /** Enter: sem área marcada, não confirma nada (antes, pegava só a célula do cursor e já ligava para o Tião). */
  private confirm(): void {
    const areas = this.areas();
    if (areas.length === 0) return this.opt.onEmpty();
    this.destroy();
    this.opt.onConfirm(areas);
  }

  cancel(): void {
    this.destroy();
    this.opt.onCancel();
  }

  private destroy(): void {
    this.offs.forEach((off) => off());
    this.gfx.destroy();
    this.label.remove();
  }
}
