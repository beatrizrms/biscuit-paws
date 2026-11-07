// Quadro do cardápio: a jogadora escolhe as receitas dos slots. Esgotado mostra o motivo.
// Quem decide o que pode entrar é o núcleo (CafeService); aqui só desenha e chama.
import type { GameSession } from '../../core/session';
import type { RecipeDef, RecipeStatus } from '../../core/recipes';
import { content, uiText } from '../content';
import { iconHtml } from './ShopPanel';

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
    if (status === 'equipment') return t.soldOut.replace('{why}', t.missingEquipment.replace('{name}', content.service.equipment[r.equipment]?.name ?? ''));
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
      <span class="status">${esc(this.statusText(r, status))}</span>
      <button data-recipe="${r.id}">${action}</button></div>`;
  }

  private render(): void {
    if (!this.open) return;
    const sv = this.session.service;
    const menu = this.session.state.menu;
    const slots = content.service.menuSlots;
    const inMenu = menu.map((id) => sv.recipe(id)).filter((r): r is RecipeDef => !!r);
    const rest = sv.unlockedRecipes().filter((r) => !menu.includes(r.id));
    const empty = Array.from({ length: Math.max(0, slots - inMenu.length) }, () => `<div class="recipe slot-empty">${uiText.menuBoard.emptySlot}</div>`);
    this.body.innerHTML = `
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
  }
}
