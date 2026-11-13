// Quadro do cardápio: a jogadora escolhe as receitas dos slots. Esgotado mostra o motivo.
// Quem decide o que pode entrar é o núcleo (CafeService); aqui só desenha e chama.
import type { GameSession } from '../../core/session';
import type { RecipeDef, RecipeStatus } from '../../core/recipes';
import { content, serviceArt, uiText } from '../content';
import { iconHtml, listNames } from './ShopPanel';
import { seasonLabel } from './StatsApp';

/** Largura do quadro desenhado no painel (cabe no painel de 178 px). */
const BOARD_WIDTH = 176;
/** Por quantos dias uma receita aprendida leva o selo "nova" na lista. */
const NEW_DAYS = 7;
/** As abas da lista: pela louça (xícara = quentes, copo = geladas, prato = comidas). */
const TABS = ['cup', 'glass', 'plate'] as const;
type Tab = (typeof TABS)[number];

/** Moedas com uma casa só quando precisa (2,3; 12). */
const coins = (n: number) => n.toLocaleString('pt-BR', { maximumFractionDigits: 1 });
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

export class MenuBoardPanel {
  private el: HTMLElement;
  private body: HTMLElement;
  private open = false;
  /** A aba da lista (fica a última escolhida) e a receita aberta (os detalhes e o botão). */
  private tab: Tab = 'cup';
  private openId: string | null = null;

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
    this.openId = null;
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

  /** Nome do que falta (o equipamento, ou a vitrine dos doces). */
  private equipmentName(key: string | undefined): string {
    if (key === 'display') return uiText.menuBoard.display;
    return content.service.equipment[key ?? '']?.name ?? '';
  }

  private statusText(r: RecipeDef, status: RecipeStatus): string {
    const t = uiText.menuBoard;
    if (status === 'available') return t.available;
    if (status === 'season') return t.outOfSeason.replace('{when}', seasonLabel(r));
    if (status === 'equipment') return t.soldOut.replace('{why}', t.missingEquipment.replace('{name}', this.equipmentName(this.session.service.missingEquipment(r.id))));
    if (status === 'ingredients') return t.soldOut.replace('{why}', t.missingIngredients);
    if (status === 'vessel') return t.soldOut.replace('{why}', t.missingVessel.replace('{name}', content.service.vessels[r.vessel].name.toLowerCase()));
    return t.locked;
  }

  /** "Custo 2,3 · Venda 15 · Lucro 12,7" (por porção). */
  private moneyLine(r: RecipeDef): string {
    const cost = this.session.service.costOf(r.id);
    return uiText.menuBoard.money.replace('{cost}', coins(cost)).replace('{price}', coins(r.price)).replace('{profit}', coins(r.price - cost));
  }

  /** A bolinha da situação: disponível (verde), falta ingrediente ou louça (laranja), falta equipamento (cinza). */
  private dot(status: RecipeStatus): string {
    return status === 'available' ? 'ok' : status === 'equipment' ? 'eq' : 'ing';
  }

  /** Uma linha por receita (ícone, nome, "nova", preço); aberta, os detalhes e o botão de pôr ou tirar do quadro. */
  private line(r: RecipeDef, inMenu: boolean): string {
    const t = uiText.menuBoard;
    const status = this.session.service.recipeStatus(r.id);
    const learned = this.session.state.recipesOn[r.id];
    const isNew = learned !== undefined && this.session.state.day - learned < NEW_DAYS;
    const open = this.openId === r.id;
    return `<div class="m-row${open ? ' open' : ''}${inMenu ? ' in-menu' : ''}" data-open="${r.id}">
      <i class="m-dot ${this.dot(status)}"></i>${iconHtml(r.icon)}<span class="m-name">${esc(r.name)}</span>${isNew ? `<span class="m-new">${esc(t.isNew)}</span>` : ''}${inMenu ? `<span class="m-in">${esc(t.inMenu)}</span>` : ''}<b class="m-price">${r.price}</b><span class="m-chev">${open ? '▲' : '▼'}</span></div>${open ? this.row(r, inMenu) : ''}`;
  }

  private row(r: RecipeDef, inMenu: boolean): string {
    const status = this.session.service.recipeStatus(r.id);
    const ingredients = Object.keys(r.ingredients).map((id) => content.items[id]?.name ?? id).join(', ');
    const action = inMenu ? uiText.menuBoard.remove : uiText.menuBoard.add;
    return `<div class="recipe ${status === 'available' ? '' : 'sold-out'}">
      <span class="desc">${esc(ingredients)} · ${esc(content.service.vessels[r.vessel].name)}</span>
      <span class="desc m-money">${esc(this.moneyLine(r))}</span>
      ${r.steps.length > 1 ? `<span class="desc">${esc(uiText.menuBoard.steps.replace('{steps}', r.steps.map((s) => content.service.equipment[s.equipment]?.name ?? s.equipment).join(' → ')))}</span>` : ''}
      ${seasonLabel(r) ? `<span class="desc season">${esc(uiText.menuBoard.seasonal.replace('{when}', seasonLabel(r)))}</span>` : ''}
      ${r.batch ? `<span class="desc">${esc(uiText.menuBoard.batch.replace('{name}', r.batch.name).replace('{n}', String(r.batch.yields)))}</span>` : ''}
      ${r.premium || r.alternative ? `<span class="desc">${uiText.service.premium} ${esc(uiText.menuBoard.premiumPrice.replace('{price}', String(this.session.service.priceOf(r.id, 'premium'))))}${r.alternative ? ` ${esc(uiText.menuBoard.premiumAt.replace('{equipment}', (content.service.equipment[r.alternative.equipment]?.name ?? '').toLowerCase()))}` : ''}</span>` : ''}
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
    const t = uiText.menuBoard;
    // Só o que está na época (as do quadro também), separado em abas pela louça; o resto fica numa linha recolhida.
    const all = [...inMenu, ...sv.unlockedRecipes().filter((r) => !menu.includes(r.id))];
    const now = all.filter((r) => sv.recipeStatus(r.id) !== 'season');
    const off = all.filter((r) => sv.recipeStatus(r.id) === 'season');
    const byTab = (tab: Tab) => now.filter((r) => r.vessel === tab);
    const tabs = `<div class="m-tabs">${TABS.map((tab) => `<button data-tab="${tab}" class="${this.tab === tab ? 'on' : ''}">${esc(t.tabs[tab])} (${byTab(tab).length})</button>`).join('')}</div>`;
    const lines = byTab(this.tab).map((r) => this.line(r, menu.includes(r.id))).join('') || `<p class="empty">${esc(t.noneHere)}</p>`;
    const legend = `<p class="m-legend">${(['ok', 'ingredients', 'equipment'] as const).map((k) => `<span><i class="m-dot ${k === 'ok' ? 'ok' : k === 'equipment' ? 'eq' : 'ing'}"></i>${esc(t.legend[k])}</span>`).join('')}</p>`;
    // Fora de época: quantas por estação (ou janela), e abrindo, os nomes.
    const groups = new Map<string, number>();
    // Estações com letra maiúscula; as semanas especiais (Natal, Halloween...) juntas em "Eventos".
    const groupOf = (r: RecipeDef) => (r.window ? t.events : seasonLabel(r).replace(/^./, (c) => c.toUpperCase()));
    for (const r of off) groups.set(groupOf(r), (groups.get(groupOf(r)) ?? 0) + 1);
    const offSummary = [...groups].map(([when, n]) => t.offSeasonBy.replace('{when}', when).replace('{n}', String(n))).join(' · ');
    const scroll = this.body.scrollTop; // redesenhar não pode mexer na rolagem de quem está lendo
    this.body.innerHTML = `${this.boardHtml(inMenu)}
      ${this.capacityHtml()}
      <button class="shopping-add" data-shopping>${t.shoppingAdd}</button>
      <h3>${t.slots.replace('{n}', String(inMenu.length)).replace('{max}', String(slots))}</h3>
      ${tabs}<div class="m-list">${lines}</div>${legend}
      ${off.length ? `<details class="off-season"><summary>${esc(t.offSeason.replace('{n}', String(off.length)))} <span>${esc(offSummary)}</span></summary><ul>${off.map((r) => `<li>${iconHtml(r.icon)}${esc(r.name)} <span>(${esc(seasonLabel(r))})</span></li>`).join('')}</ul></details>` : ''}`;
    this.body.querySelectorAll<HTMLButtonElement>('[data-tab]').forEach((b) =>
      b.addEventListener('click', () => {
        this.tab = b.dataset.tab as Tab;
        this.openId = null;
        this.render();
      }),
    );
    this.body.querySelectorAll<HTMLElement>('[data-open]').forEach((row) =>
      row.addEventListener('click', () => {
        this.openId = this.openId === row.dataset.open ? null : row.dataset.open!;
        this.render();
      }),
    );
    this.body.querySelectorAll<HTMLButtonElement>('[data-recipe]').forEach((b) =>
      b.addEventListener('click', (e) => {
        e.stopPropagation();
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
