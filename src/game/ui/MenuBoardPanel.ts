// Quadro do cardápio: a jogadora escolhe as receitas dos slots. Esgotado mostra o motivo.
// Quem decide o que pode entrar é o núcleo (CafeService); aqui só desenha e chama.
import type { GameSession } from '../../core/session';
import type { RecipeDef, RecipeStatus } from '../../core/recipes';
import { content, serviceArt, uiText } from '../content';
import { iconHtml, listNames } from './ShopPanel';

/** Largura do quadro desenhado no painel (cabe no painel de 178 px). */
const BOARD_WIDTH = 176;

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

export class MenuBoardPanel {
  private el: HTMLElement;
  private body: HTMLElement;
  private open = false;

  constructor(
    root: HTMLElement,
    private session: GameSession,
    private onChange: () => void,
    private onProblem: (reason: string) => void,
    private onToast: (text: string) => void = () => {},
  ) {
    this.el = document.createElement('section');
    this.el.className = 'panel catalog menu-board';
    this.el.innerHTML = `<header><h2>${uiText.menuBoard.title}</h2><button class="close">${uiText.menuBoard.close}</button></header><div class="list"></div>`;
    root.appendChild(this.el);
    this.body = this.el.querySelector('.list') as HTMLElement;
    (this.el.querySelector('.close') as HTMLElement).addEventListener('click', () => this.close());
    session.bus.onAny(() => this.render());
  }

  isOpen(): boolean {
    return this.open;
  }

  show(): void {
    this.open = true;
    this.render();
    this.el.classList.add('open');
    this.body.scrollTop = 0; // abre sempre no quadro, em cima (depois de visível: escondido, o navegador ignora)
    this.onChange();
  }

  close(): void {
    if (!this.open) return;
    this.open = false;
    this.el.classList.remove('open');
    this.onChange();
  }

  private statusText(r: RecipeDef, status: RecipeStatus): string {
    const t = uiText.menuBoard;
    if (status === 'available') return t.available;
    if (status === 'equipment') return t.soldOut.replace('{why}', t.missingEquipment.replace('{name}', content.service.equipment[this.session.service.missingEquipment(r.id) ?? '']?.name ?? ''));
    if (status === 'ingredients') return t.soldOut.replace('{why}', t.missingIngredients);
    if (status === 'vessel') return t.soldOut.replace('{why}', t.missingVessel.replace('{name}', content.service.vessels[r.vessel].name.toLowerCase()));
    return t.locked;
  }

  private row(r: RecipeDef, inMenu: boolean): string {
    const status = this.session.service.recipeStatus(r.id);
    const ingredients = Object.keys(r.ingredients).map((id) => content.items[id]?.name ?? id).join(', ');
    const action = inMenu ? uiText.menuBoard.remove : uiText.menuBoard.add;
    return `<div class="recipe ${status === 'available' ? '' : 'sold-out'}">
      <span class="name">${iconHtml(r.icon)}<b>${esc(r.name)}</b> <span class="price">${r.price}</span></span>
      <span class="desc">${esc(ingredients)} · ${esc(content.service.vessels[r.vessel].name)}</span>
      ${r.steps.length > 1 ? `<span class="desc">${esc(uiText.menuBoard.steps.replace('{steps}', r.steps.map((s) => content.service.equipment[s.equipment]?.name ?? s.equipment).join(' → ')))}</span>` : ''}
      ${r.premium ? `<span class="desc">${uiText.service.premium} ${esc(uiText.menuBoard.premiumPrice.replace('{price}', String(this.session.service.priceOf(r.id, 'premium'))))}</span>` : ''}
      <span class="status">${esc(this.statusText(r, status))}</span>
      <button data-recipe="${r.id}">${action}</button></div>`;
  }

  /** O quadro de verdade: ícones nos slots, preço embaixo e o véu de esgotado (largura fixa, posições dos dados). */
  private boardHtml(inMenu: RecipeDef[]): string {
    const slots = content.service.menuSlots;
    const sizes = Object.keys(serviceArt.boards).map(Number).sort((a, b) => a - b);
    const board = serviceArt.boards[String(sizes.find((n) => n >= slots) ?? sizes[sizes.length - 1])]!;
    const [W, H] = board.size;
    const k = Math.min(1, BOARD_WIDTH / W);
    const px = (v: number) => `${Math.round(v * k)}px`;
    const cells = board.slots.slice(0, slots).map((s, i) => {
      const r = inMenu[i];
      if (!r) return '';
      const [ix, iy, iw, ih] = s.icon;
      const [qx, qy, qw, qh] = s.price;
      const soldOut = this.session.service.recipeStatus(r.id) !== 'available';
      return `<span class="slot-icon" style="left:${px(ix)};top:${px(iy)};width:${px(iw)};height:${px(ih)}">${iconHtml(r.icon, Math.round(iw * k))}${
        soldOut ? `<img class="veil" src="${serviceArt.soldOut.veil}" alt="" /><img class="mark" src="${serviceArt.soldOut.mark}" alt="" />` : ''
      }</span><span class="slot-price" style="left:${px(qx)};top:${px(qy)};width:${px(qw)};height:${px(qh)}">${r.price}</span>`;
    });
    return `<div class="board" style="width:${px(W)};height:${px(H)};background-image:url(${board.image})">${cells.join('')}</div>`;
  }

  /** Quantos clientes cabem agora e como (lugares e louça; regras em service.json). */
  private capacityHtml(): string {
    const c = this.session.service.capacity();
    const t = uiText.menuBoard.capacity;
    const fill = (x: string) => x.replace('{total}', String(c.total)).replace('{standing}', String(c.standing)).replace('{seated}', String(c.seated));
    const d = this.session.state.dishes;
    const dishes = t.dishes.replace('{cup}', String(d.cup)).replace('{glass}', String(d.glass)).replace('{plate}', String(d.plate));
    return `<p class="capacity"><b>${esc(fill(t.line))}</b> ${esc(fill(t.detail))}<br />${esc(c.canEat ? t.canEat : t.cannotEat)} · ${esc(dishes)}</p>`;
  }

  private render(): void {
    if (!this.open) return;
    const sv = this.session.service;
    const menu = this.session.state.menu;
    const slots = content.service.menuSlots;
    const inMenu = menu.map((id) => sv.recipe(id)).filter((r): r is RecipeDef => !!r);
    const rest = sv.unlockedRecipes().filter((r) => !menu.includes(r.id));
    const empty = Array.from({ length: Math.max(0, slots - inMenu.length) }, () => `<div class="recipe slot-empty">${uiText.menuBoard.emptySlot}</div>`);
    const scroll = this.body.scrollTop; // redesenhar não pode mexer na rolagem de quem está lendo
    this.body.innerHTML = `${this.boardHtml(inMenu)}
      ${this.capacityHtml()}
      <button class="shopping-add" data-shopping>${uiText.menuBoard.shoppingAdd}</button>
      <h3>${uiText.menuBoard.slots.replace('{n}', String(inMenu.length)).replace('{max}', String(slots))}</h3>
      ${inMenu.map((r) => this.row(r, true)).join('')}${empty.join('')}
      <h3>${uiText.menuBoard.recipes}</h3>
      ${rest.map((r) => this.row(r, false)).join('') || `<p class="empty">${uiText.menuBoard.noRecipes}</p>`}`;
    this.body.querySelectorAll<HTMLButtonElement>('[data-recipe]').forEach((b) =>
      b.addEventListener('click', () => {
        const result = sv.toggleMenu(b.dataset.recipe!);
        if (!result.ok) this.onProblem(result.reason);
      }),
    );
    // Lista de compras: anota nas Notas (celular) o que acabou ou está acabando.
    this.body.querySelector('[data-shopping]')?.addEventListener('click', () => {
      const added = this.session.addMissingToShoppingList();
      const t = uiText.menuBoard;
      this.onToast(added.length ? t.shoppingAdded.replace('{items}', listNames(added.map((id) => content.items[id]?.name ?? id))) : t.shoppingNothing);
    });
    this.body.scrollTop = scroll;
  }
}
