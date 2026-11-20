// O losango de atalhos (Tab no teclado, Y no controle, Menu no toque): celular, mochila, cardápio e metas num lugar
// só, em quatro pontas (data/controls.json: quickMenu). Direção escolhe (setas, analógico, direcional) e Enter, E,
// Espaço ou A abrem; o toque e o clique abrem direto. Esc, B ou o mesmo botão fecham. Só desenho e entrada: o que
// cada ponta abre é o mundo quem faz (WorldScene).
import type { QuickSlot } from '../../core/controls';
import { controls, uiText } from '../content';
import { byInput } from '../touch';
import { actionIconSvg, type ActionIcon } from './actionIcons';

export type QuickOpens = (typeof controls.quickMenu)[QuickSlot]['opens'];

const SLOTS: QuickSlot[] = ['up', 'left', 'right', 'down'];
/** A arte de cada atalho (PixelLab, 32 x 32: assets/_pixellab/atalhos). O Market não tem: o carrinho desenhado por código. */
const ART: Partial<Record<QuickOpens, string>> = { phone: 'assets/ui/quick/phone.png', backpack: 'assets/ui/quick/backpack.png', menuBoard: 'assets/ui/quick/menuBoard.png', goals: 'assets/ui/quick/goals.png' };
/** PLACEHOLDER(arte): o carrinho do Market, se ele for para o losango. */
const ICON: Partial<Record<QuickOpens, ActionIcon>> = { market: 'cart' };
const KEY_DIR: Record<string, QuickSlot> = {
  ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down', ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right',
};

export class QuickMenu {
  private el: HTMLElement | null = null;
  private selected: QuickSlot | null = null;
  private onPick: ((opens: QuickOpens) => void) | null = null;
  private readonly onKey = (e: KeyboardEvent) => this.key(e);

  constructor(private readonly root: HTMLElement) {}

  isOpen(): boolean {
    return this.el !== null;
  }

  open(onPick: (opens: QuickOpens) => void): void {
    if (this.el) return;
    this.onPick = onPick;
    this.selected = null;
    const el = document.createElement('div');
    el.className = 'quick-layer';
    const t = uiText.quickMenu;
    el.innerHTML = `<div class="qm-diamond">${SLOTS.map((slot) => {
      const q = controls.quickMenu[slot];
      return `<button class="qm-slot qm-${slot} qm-${q.opens}" data-slot="${slot}" aria-label="${q.label}"><span class="qm-face">${ART[q.opens] ? `<img class="qm-art" src="${ART[q.opens]}" alt="" />` : actionIconSvg(ICON[q.opens] ?? 'cart', 24)}<b>${q.label}</b></span></button>`;
    }).join('')}</div><p class="qm-hint">${byInput(t.hint, t.hintTouch, t.hintPad)}</p>`;
    el.querySelectorAll<HTMLElement>('[data-slot]').forEach((b) => {
      b.addEventListener('pointerenter', () => this.select(b.dataset.slot as QuickSlot));
      b.addEventListener('click', (e) => {
        e.stopPropagation();
        this.pick(b.dataset.slot as QuickSlot);
      });
    });
    // Toque ou clique fora do losango: fecha.
    el.addEventListener('click', () => this.close());
    this.root.appendChild(el);
    this.el = el;
    // Na captura, antes do Phaser: o Enter que abre não usa o que está perto, e o Esc que fecha não abre a pausa.
    window.addEventListener('keydown', this.onKey, true);
    requestAnimationFrame(() => el.classList.add('open'));
  }

  close(): void {
    if (!this.el) return;
    window.removeEventListener('keydown', this.onKey, true);
    this.el.remove();
    this.el = null;
    this.onPick = null;
  }

  private key(e: KeyboardEvent): void {
    const dir = KEY_DIR[e.code];
    const done = () => {
      e.preventDefault();
      e.stopPropagation();
    };
    if (dir) {
      done();
      return this.select(dir);
    }
    if (e.code === 'Enter' || e.code === 'Space' || e.code === 'KeyE') {
      done();
      if (this.selected) this.pick(this.selected);
      return;
    }
    if (e.code === 'Escape' || e.code === 'Tab') {
      done();
      this.close();
    }
  }

  private select(slot: QuickSlot): void {
    this.selected = slot;
    this.el?.querySelectorAll<HTMLElement>('[data-slot]').forEach((b) => b.classList.toggle('on', b.dataset.slot === slot));
  }

  private pick(slot: QuickSlot): void {
    const pick = this.onPick;
    this.close();
    pick?.(controls.quickMenu[slot].opens);
  }
}
