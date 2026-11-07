// Peças comuns dos menus (HTML por cima do jogo): camadas empilhadas com navegação por teclado
// (setas + Enter + Esc), mouse e toque; caixa de confirmação; texto do resumo de um slot.
import type { SlotId, SlotStatus } from '../../../core/saveSlots';
import { formatClock } from '../../../core/time';
import { t } from '../../i18n';

export const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

/** Uma camada de menu: um elemento com botões; Esc chama onBack. Só a camada de cima recebe teclas. */
export interface MenuLayer {
  el: HTMLElement;
  onBack?: () => void;
}

const stack: MenuLayer[] = [];
let listening = false;

function focusables(el: HTMLElement): HTMLElement[] {
  return [...el.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled])')].filter((b) => b.offsetParent !== null);
}

function onKey(e: KeyboardEvent): void {
  const top = stack[stack.length - 1];
  if (!top) return;
  const items = focusables(top.el);
  const i = items.indexOf(document.activeElement as HTMLElement);
  if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
    // Setas para os lados mexem no volume quando o foco está num controle deslizante.
    if (e.key === 'ArrowRight' && (document.activeElement as HTMLInputElement | null)?.type === 'range') return;
    e.preventDefault();
    items[(i + 1) % items.length]?.focus();
  } else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
    if (e.key === 'ArrowLeft' && (document.activeElement as HTMLInputElement | null)?.type === 'range') return;
    e.preventDefault();
    items[(i - 1 + items.length) % items.length]?.focus();
  } else if (e.key === 'Escape') {
    e.preventDefault();
    e.stopPropagation();
    top.onBack?.();
  } else if (e.key === 'Enter' && i < 0) {
    e.preventDefault();
    items[0]?.focus();
  }
}

/** Mostra a camada por cima das outras e põe o foco no primeiro botão (ou no `focus`). */
export function pushLayer(layer: MenuLayer, focus?: HTMLElement | null): void {
  stack.push(layer);
  if (!listening) {
    window.addEventListener('keydown', onKey, true);
    listening = true;
  }
  window.setTimeout(() => (focus ?? focusables(layer.el)[0])?.focus(), 0);
}

/** Tira a camada (e devolve o foco para a de baixo). */
export function popLayer(layer: MenuLayer): void {
  const i = stack.indexOf(layer);
  if (i >= 0) stack.splice(i, 1);
  layer.el.remove();
  const below = stack[stack.length - 1];
  if (below) window.setTimeout(() => focusables(below.el)[0]?.focus(), 0);
}

export function menuOpen(): boolean {
  return stack.length > 0;
}

/** Caixa de sim/não. Resolve true no "Sim". */
export function confirmBox(root: HTMLElement, question: string): Promise<boolean> {
  return new Promise((resolve) => {
    const el = document.createElement('div');
    el.className = 'menu-layer menu-confirm';
    el.innerHTML = `<div class="menu-panel"><p>${esc(question)}</p><div class="menu-row"><button class="menu-btn no">${t('confirm.no')}</button><button class="menu-btn yes">${t('confirm.yes')}</button></div></div>`;
    root.appendChild(el);
    const layer: MenuLayer = { el, onBack: () => finish(false) };
    const finish = (answer: boolean) => {
      popLayer(layer);
      resolve(answer);
    };
    (el.querySelector('.yes') as HTMLElement).addEventListener('click', () => finish(true));
    (el.querySelector('.no') as HTMLElement).addEventListener('click', () => finish(false));
    pushLayer(layer, el.querySelector('.no') as HTMLElement);
  });
}

/** Aviso rápido no menu. */
export function menuToast(root: HTMLElement, text: string): void {
  // Um aviso por vez: o novo substitui o anterior.
  root.querySelectorAll('.menu-toast').forEach((old) => old.remove());
  const el = document.createElement('div');
  el.className = 'menu-toast';
  el.textContent = text;
  root.appendChild(el);
  window.setTimeout(() => el.classList.add('show'), 10);
  window.setTimeout(() => {
    el.classList.remove('show');
    window.setTimeout(() => el.remove(), 300);
  }, 2200);
}

/** Nome do slot ("Slot 1", "Autosave"). */
export const slotName = (slot: SlotId) => t(`slot.${slot}`);

/** Resumo do slot em texto: dia, hora, dinheiro, gatos e a data do save (ou vazio/corrompido). */
export function slotText(status: SlotStatus): { line: string; date: string } {
  if (status.kind === 'empty') return { line: t('slot.empty'), date: '' };
  if (status.kind === 'corrupt') return { line: t('slot.corrupt'), date: '' };
  const s = status.summary;
  const date = s.savedAt ? new Date(s.savedAt).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '';
  return {
    line: t('slot.summary', { day: s.day, time: formatClock(s.time, 10), money: s.money, cats: s.cats }),
    date: date ? t('slot.savedAt', { date }) : '',
  };
}
