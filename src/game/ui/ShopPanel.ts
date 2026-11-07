// Mercado com carrinho: as prateleiras põem itens no carrinho (com quantidade); o caixa mostra o
// total e cobra. A regra (preço, limites, tudo ou nada) mora na sessão (src/core/cart.ts + session.checkout).
import type { GameSession } from '../../core/session';
import { content, uiText } from '../content';

const ICON_PX = 16;

type Mode = { kind: 'shelf'; shopId: string; tags: string[] } | { kind: 'checkout'; shopId: string };

const fill = (text: string, vars: Record<string, string | number>) => text.replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? ''));

export class ShopPanel {
  private el: HTMLElement;
  private list: HTMLElement;
  private bar: HTMLElement;
  private mode: Mode | null = null;

  constructor(
    root: HTMLElement,
    private session: GameSession,
    private onChange: () => void,
    private onPaid: () => void,
    private onProblem: (reason: string) => void,
  ) {
    this.el = document.createElement('section');
    this.el.className = 'panel catalog shop';
    this.el.innerHTML = `<header><h2></h2><button class="close">${uiText.shop.close}</button></header><div class="list"></div><footer class="cart-bar"></footer>`;
    root.appendChild(this.el);
    this.list = this.el.querySelector('.list') as HTMLElement;
    this.bar = this.el.querySelector('.cart-bar') as HTMLElement;
    (this.el.querySelector('.close') as HTMLElement).addEventListener('click', () => this.close());
    // Um só ouvinte para os botões (a lista é redesenhada a cada mudança).
    this.el.addEventListener('click', (e) => this.onClick(e));
    session.bus.on('money.changed', () => this.render());
    session.bus.on('cart.changed', () => this.render());
  }

  isOpen(): boolean {
    return this.mode !== null;
  }

  /** Prateleira: os itens da loja com estas tags, para pôr no carrinho. */
  openShelf(shopId: string, tags: string[]): void {
    this.open({ kind: 'shelf', shopId, tags });
  }

  /** Caixa: o carrinho, o total e o botão de pagar. */
  openCheckout(shopId: string): void {
    this.open({ kind: 'checkout', shopId });
  }

  private open(mode: Mode): void {
    this.mode = mode;
    const shopName = content.shops[mode.shopId]?.name ?? '';
    (this.el.querySelector('h2') as HTMLElement).textContent = mode.kind === 'checkout' ? `${uiText.shop.cashierTitle} · ${shopName}` : shopName;
    this.el.classList.toggle('checkout', mode.kind === 'checkout');
    this.render();
    this.list.scrollTop = 0;
    this.el.classList.add('open');
    this.onChange();
  }

  close(): void {
    if (!this.mode) return;
    this.mode = null;
    this.el.classList.remove('open');
    this.onChange();
  }

  private onClick(e: MouseEvent): void {
    const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('button[data-act]');
    if (!btn || btn.disabled) return;
    const id = btn.dataset.item ?? '';
    const act = btn.dataset.act;
    if (act === 'add') {
      const r = this.session.addToCart(id);
      if (!r.ok) this.onProblem(r.reason);
    } else if (act === 'sub') this.session.removeFromCart(id);
    else if (act === 'drop') this.session.removeFromCart(id, true);
    else if (act === 'pay') {
      const r = this.session.checkout();
      if (!r.ok) return this.onProblem(r.reason);
      this.onPaid();
      this.close();
    }
  }

  /** "3 itens · 25 moedas". */
  private cartLine(): string {
    const count = this.session.cart.count();
    return fill(uiText.shop.cartLine, { count, items: count === 1 ? uiText.shop.itemOne : uiText.shop.itemMany, total: this.session.cartTotal() });
  }

  private qtyControls(id: string): string {
    const qty = this.session.cart.qty(id);
    return `<span class="qty">
        <button data-act="sub" data-item="${id}" ${qty === 0 ? 'disabled' : ''} aria-label="menos">−</button>
        <span class="n">${qty}</span>
        <button data-act="add" data-item="${id}" aria-label="${uiText.shop.add}">+</button>
      </span>`;
  }

  private render(): void {
    if (!this.mode) return;
    if (this.mode.kind === 'shelf') this.renderShelf(this.mode.shopId, this.mode.tags);
    else this.renderCheckout();
  }

  private renderShelf(shopId: string, tags: string[]): void {
    const { state } = this.session;
    // Só o que já serve: ingredientes e equipamentos aparecem com a receita que usa eles.
    const ids = this.session
      .shopItems(shopId)
      .filter((id) => content.items[id]!.tags.some((t) => tags.includes(t)) && this.session.itemUnlocked(id));
    const row = (id: string) => {
      const item = content.items[id]!;
      const owned = state.inventory[id] ?? 0;
      return `<div class="row cart-row${this.session.cart.qty(id) > 0 ? ' in-cart' : ''}" data-row="${id}">
          <span class="name">${iconHtml(item.icon)}${item.name}</span><span class="price">${item.price}</span>${this.qtyControls(id)}
          ${owned > 0 ? `<span class="owned">${owned} ${uiText.shop.inBag}</span>` : ''}
        </div>`;
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
    this.bar.innerHTML = `<span class="total">${this.cartLine()}</span><span class="cart-hint">${uiText.shop.payAtCashier}</span>`;
  }

  private renderCheckout(): void {
    const { cart, state } = this.session;
    if (cart.isEmpty()) {
      this.list.innerHTML = `<p class="empty">${uiText.shop.emptyCart}</p>`;
      this.bar.innerHTML = '';
      return;
    }
    this.list.innerHTML = cart
      .lines()
      .map(({ itemId, qty }) => {
        const item = content.items[itemId]!;
        return `<div class="row cart-row in-cart" data-row="${itemId}">
            <span class="name">${iconHtml(item.icon)}${item.name}</span><span class="price">${item.price * qty}</span>${this.qtyControls(itemId)}
            <button class="drop" data-act="drop" data-item="${itemId}">${uiText.shop.removeAll}</button>
          </div>`;
      })
      .join('');
    const missing = this.session.cartShortfall();
    this.bar.innerHTML = `<span class="total">${this.cartLine()}</span>
      <span class="have">${fill(uiText.shop.youHave, { money: state.money })}</span>
      ${missing > 0 ? `<span class="missing">${fill(uiText.shop.missing, { missing })}</span>` : ''}
      <button class="pay" data-act="pay" ${missing > 0 ? 'disabled' : ''}>${fill(uiText.shop.pay, { total: this.session.cartTotal() })}</button>`;
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
