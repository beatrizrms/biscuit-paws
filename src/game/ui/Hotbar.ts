// Barra de itens embaixo da tela: espaços com itens da mochila; o ativo (moldura) é o que ela usa para agir.
// Teclas 1 a 8, roda do mouse ou clique escolhem o espaço. A regra (o que vai, o que vale) está em src/core/hotbar.ts.
import type { ItemDef } from '../../core/content';
import type { GameSession } from '../../core/session';
import { content, uiText } from '../content';
import { iconHtml } from './ShopPanel';

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

/** Ícone de um item: imagem própria (vassoura) ou recorte da folha de ícones. */
export function itemIconHtml(item: ItemDef | undefined, px: number): string {
  if (item?.iconImage) return `<img class="icon" src="${item.iconImage}" alt="" style="width:${px}px;height:${px}px" />`;
  return iconHtml(item?.icon, px);
}

/** Pés da personagem abaixo desta altura (pixels do jogo, de 360): a barra sobe para o topo. Volta com folga, sem piscar. */
const GO_UP_BELOW = 270;
const GO_DOWN_ABOVE = 250;

export class Hotbar {
  private el: HTMLElement;
  private atTop = false;

  constructor(root: HTMLElement, private session: GameSession) {
    this.el = document.createElement('div');
    this.el.className = 'hotbar';
    this.el.setAttribute('aria-label', uiText.hotbar.label);
    root.appendChild(this.el);
    this.el.addEventListener('click', (e) => {
      const slot = (e.target as HTMLElement).closest<HTMLElement>('[data-slot]');
      if (slot) session.selectHotbarSlot(Number(slot.dataset.slot));
    });
    session.bus.onAny(() => this.render());
    this.render();
  }

  /** Perto da beira de baixo da tela a barra tamparia o chão (neve, sujeira): sobe para o topo. */
  followPlayer(feetY: number): void {
    const top = this.atTop ? feetY > GO_DOWN_ABOVE : feetY > GO_UP_BELOW;
    if (top === this.atTop) return;
    this.atTop = top;
    this.el.classList.toggle('top', top);
  }

  private render(): void {
    const { slots, active } = this.session.state.hotbar;
    const inv = this.session.state.inventory;
    this.el.innerHTML = slots
      .map((id, i) => {
        const qty = id ? inv[id] ?? 0 : 0;
        const item = qty > 0 ? content.items[id!] : undefined;
        const count = item && qty > 1 ? `<span class="count">${qty}</span>` : '';
        const title = item ? ` title="${esc(item.name)}"` : '';
        return `<button class="slot${i === active ? ' active' : ''}" data-slot="${i}"${title}><span class="key">${i + 1}</span>${itemIconHtml(item, 16)}${count}</button>`;
      })
      .join('');
  }
}
