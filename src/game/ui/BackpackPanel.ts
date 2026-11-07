// Mochila: o inventário abstrato (ingredientes em doses, coisas de gato, chaves, presentes) em grade de ícones,
// a louça limpa e o que está nas mãos. Clicar num item põe no espaço ativo da barra. Petisco: "segurar" põe na mão.
import type { HandItem } from '../../core/carry';
import type { GameSession } from '../../core/session';
import { VESSELS } from '../../core/recipes';
import { content, uiText } from '../content';
import { itemIconHtml } from './Hotbar';
import { iconHtml } from './ShopPanel';

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

/** Nome de um objeto da mão (bebida, louça suja, item). */
export function handItemName(h: HandItem, catName: (id: string) => string = (id) => content.cats[id]?.name ?? ''): string {
  if (h.kind === 'drink') return (content.recipes[h.recipe]?.name ?? '') + (h.quality === 'premium' ? ` ${uiText.service.premium}` : '');
  if (h.kind === 'dirty') return content.service.vessels[h.vessel].dirtyName;
  if (h.kind === 'wip') {
    const eq = content.recipes[h.recipe]?.steps[h.step]?.equipment;
    return uiText.backpack.wip.replace('{name}', content.recipes[h.recipe]?.name ?? '').replace('{equipment}', (eq && content.service.equipment[eq]?.name) || '');
  }
  if (h.kind === 'cat') return uiText.backpack.cat.replace('{name}', catName(h.catId));
  return content.items[h.item]?.name ?? '';
}

export class BackpackPanel {
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
    this.el.className = 'panel catalog backpack';
    this.el.innerHTML = `<header><h2>${uiText.backpack.title}</h2><button class="close">${uiText.backpack.close}</button></header><div class="list"></div>`;
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

  private render(): void {
    if (!this.open) return;
    const t = uiText.backpack;
    const st = this.session.state;
    const sv = this.session.service;
    const ids = new Set([...Object.keys(st.inventory), ...Object.keys(st.pantryOpen)]);
    const abstract = [...ids].map((id) => content.items[id]).filter((i) => i && (i.kind ?? 'furniture') !== 'furniture' && i.kind !== 'fixture');
    const active = this.session.activeItem();
    const tile = (id: string) => {
      const item = content.items[id]!;
      const packs = st.inventory[id] ?? 0;
      const servings = item.servings ?? 1;
      const amount = servings > 1 ? t.doses.replace('{n}', String(sv.doses(id))) : `x${packs}`;
      const onBar = st.hotbar.slots.indexOf(id);
      const hold = item.tags.includes('treat') && packs > 0
        ? `<button data-hold="${id}">${t.hold}</button>`
        : id === content.carry.tray.item && packs > 0
          ? `<button data-tray>${st.tray ? t.stowTray : t.useTray}</button>`
          : '';
      const slot = onBar >= 0 ? `<span class="slot-no">${onBar + 1}</span>` : '';
      return `<div class="bp-item${id === active ? ' active' : ''}"><button data-assign="${id}" title="${esc(item.name)}" ${packs > 0 ? '' : 'disabled'}>${slot}${itemIconHtml(item, 20)}<span class="bp-name">${esc(item.name)}</span><span class="bp-amount">${amount}</span></button>${hold}</div>`;
    };
    // Ferramentas primeiro, depois o resto, e os ingredientes no fim.
    const order = (i: (typeof abstract)[number]) => (i!.kind === 'tool' ? 0 : i!.tags.includes('ingredient') ? 2 : 1);
    const sorted = [...abstract].sort((a, b) => order(a) - order(b));
    const furniture = Object.entries(st.inventory).filter(([id]) => (content.items[id]?.kind ?? 'furniture') === 'furniture').reduce((n, [, q]) => n + q, 0);
    const dishes = VESSELS.map((v) => `<span class="vessel">${iconHtml(content.service.vessels[v].icon)}${content.service.vessels[v].name}: <b>${st.dishes[v] ?? 0}</b></span>`).join('');
    const hands = st.hands.length
      ? st.hands.map((h) => `<div class="recipe"><span class="name"><b>${esc(handItemName(h, (id) => this.session.catName(id)))}</b></span>${h.kind === 'item' ? `<button data-stow>${t.stow}</button>` : ''}</div>`).join('')
      : `<p class="empty">${t.handsEmpty}</p>`;
    this.body.innerHTML = `
      <h3>${t.hands}</h3>${hands}
      <h3>${t.dishes}</h3><p class="dishes">${dishes}</p>
      <h3>${t.items}</h3><p class="empty">${t.gridHint.replace('{n}', String(st.hotbar.active + 1))}</p>
      <div class="bp-grid">${sorted.map((i) => tile(i!.id)).join('') || `<p class="empty">${t.none}</p>`}</div>
      ${furniture ? `<p class="empty">${t.furniture.replace('{n}', String(furniture))}</p>` : ''}`;
    this.body.querySelectorAll<HTMLButtonElement>('[data-assign]').forEach((b) =>
      b.addEventListener('click', () => {
        const r = this.session.assignToHotbar(b.dataset.assign!);
        if (!r.ok) this.onProblem(r.reason);
      }),
    );
    this.body.querySelectorAll<HTMLButtonElement>('[data-hold]').forEach((b) =>
      b.addEventListener('click', () => {
        const r = sv.hold(b.dataset.hold!);
        if (!r.ok) this.onProblem(r.reason);
      }),
    );
    this.body.querySelectorAll<HTMLButtonElement>('[data-tray]').forEach((b) =>
      b.addEventListener('click', () => {
        const r = sv.toggleTray();
        if (!r.ok) this.onProblem(r.reason);
      }),
    );
    this.body.querySelectorAll<HTMLButtonElement>('[data-stow]').forEach((b) =>
      b.addEventListener('click', () => {
        const r = sv.stow();
        if (!r.ok) this.onProblem(r.reason);
      }),
    );
  }
}
