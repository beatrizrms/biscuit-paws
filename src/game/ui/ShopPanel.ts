// Painel de uma loja (o caixa do mercado). Lista o que a loja vende e compra pela sessão.
import type { GameSession } from '../../core/session';
import { content, uiText } from '../content';

const ICON_PX = 16;

export class ShopPanel {
  private el: HTMLElement;
  private list: HTMLElement;
  private shopId: string | null = null;

  constructor(
    root: HTMLElement,
    private session: GameSession,
    private onChange: () => void,
    private onBought: () => void,
    private onProblem: (reason: string) => void,
  ) {
    this.el = document.createElement('section');
    this.el.className = 'panel catalog shop';
    this.el.innerHTML = `<header><h2></h2><button class="close">${uiText.shop.close}</button></header><div class="list"></div>`;
    root.appendChild(this.el);
    this.list = this.el.querySelector('.list') as HTMLElement;
    (this.el.querySelector('.close') as HTMLElement).addEventListener('click', () => this.close());
    session.bus.on('money.changed', () => this.render());
    session.bus.on('item.bought', () => this.render());
  }

  isOpen(): boolean {
    return this.shopId !== null;
  }

  open(shopId: string): void {
    this.shopId = shopId;
    (this.el.querySelector('h2') as HTMLElement).textContent = content.shops[shopId]?.name ?? '';
    this.render();
    this.el.classList.add('open');
    this.onChange();
  }

  close(): void {
    if (!this.shopId) return;
    this.shopId = null;
    this.el.classList.remove('open');
    this.onChange();
  }

  private render(): void {
    if (!this.shopId) return;
    const { state } = this.session;
    const ids = this.session.shopItems(this.shopId);
    const row = (id: string) => {
      const item = content.items[id]!;
      const owned = state.inventory[id] ?? 0;
      return `<button class="row" data-buy="${id}" ${state.money < item.price ? 'disabled' : ''}>
          <span class="name">${iconHtml(item.icon)}${item.name}</span><span class="price">${item.price}</span>
          ${owned > 0 ? `<span class="owned">${owned} ${uiText.shop.inBag}</span>` : ''}
        </button>`;
    };
    // Seções pela primeira tag que bate (ui_text: shop.sections); o resto vai no fim, sem título.
    const sectionOf = (id: string) => uiText.shop.sections.find((s) => content.items[id]!.tags.includes(s.tag));
    this.list.innerHTML =
      uiText.shop.sections
        .map((s) => {
          const rows = ids.filter((id) => sectionOf(id) === s).map(row).join('');
          return rows ? `<h3>${s.title}</h3>${rows}` : '';
        })
        .join('') + ids.filter((id) => !sectionOf(id)).map(row).join('');
    this.list.querySelectorAll<HTMLButtonElement>('[data-buy]').forEach((btn) =>
      btn.addEventListener('click', () => {
        const result = this.session.buy(btn.dataset.buy!);
        if (!result.ok) return this.onProblem(result.reason);
        this.onBought();
      }),
    );
  }
}

/** Ícone do item, recortado da folha de ícones (CSS, sem suavizar). */
export function iconHtml(icon: string | undefined, px = ICON_PX): string {
  const icons = content.icons;
  const pos = icon ? icons.icons[icon] : undefined;
  if (!pos) return '';
  const sheet = pos.sheet ? icons.sheets?.[pos.sheet] : undefined;
  const image = sheet?.image ?? icons.image;
  const columns = sheet?.columns ?? icons.columns;
  const scale = px / icons.tileSize;
  return `<span class="icon" style="width:${px}px;height:${px}px;background-image:url(${image});background-size:${columns * px}px auto;background-position:${
    -pos.col * icons.tileSize * scale
  }px ${-pos.row * icons.tileSize * scale}px"></span>`;
}
