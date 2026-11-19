// Quadro do cardápio: a jogadora escolhe as receitas dos slots. Esgotado mostra o motivo.
// Quem decide o que pode entrar é o núcleo (CafeService); aqui só desenha e chama.
import { NEW_BADGE_DAYS } from '../../core/session';
import type { GameSession } from '../../core/session';
import type { RecipeDef, RecipeStatus } from '../../core/recipes';
import { content, uiText } from '../content';
import { iconHtml, listNames } from './ShopPanel';
import { seasonLabel } from './StatsApp';

/** Por quantos dias uma receita aprendida leva o selo "nova" na lista. */
/** A etiqueta Novo das receitas: a mesma regra do Market (2 dias do jogo). */
const NEW_DAYS = NEW_BADGE_DAYS;
/** As abas da lista: pela louça (xícara = quentes, copo = geladas, prato = comidas). */
const TABS = ['cup', 'glass', 'plate'] as const;
type Tab = (typeof TABS)[number];

/** Moedas com uma casa só quando precisa (2,3; 12). */
const coins = (n: number) => n.toLocaleString('pt-BR', { maximumFractionDigits: 1 });
/** A moeda do HUD ao lado de todo preço. */
const COIN = '<img class="coin-img" src="assets/ui/hud/ui_coin_16.png" alt="" />';
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

  /** Preço com a moeda do lado. */
  private price(n: number): string {
    return `<span class="m-coins">${COIN}${coins(n)}</span>`;
  }

  /**
   * Um ingrediente da receita: o ícone e quanto ela pede. Sem o bastante na despensa, vermelho (o quanto tem não
   * aparece: a bolinha da linha já diz se dá para fazer). Tocar mostra o nome (data-name).
   */
  private chip(itemId: string, need: number, have: number): string {
    const item = content.items[itemId];
    return `<span class="m-chip${have < need ? ' none' : ''}" data-name="${esc(item?.name ?? itemId)}" title="${esc(item?.name ?? itemId)}">${iconHtml(item?.icon, 12)}${need}</span>`;
  }

  /** O que a receita pede de cada ingrediente; em cima, por quanto é: uma receita, ou uma fornada (N fatias). */
  private pantryCalc(r: RecipeDef): string {
    const sv = this.session.service;
    const t = uiText.menuBoard;
    const subs = r.premium ?? {};
    // O que tem conta a troca premium também (ela serve no lugar quando falta o comum).
    const have = (item: string) => sv.doses(item) + (subs[item] ? sv.doses(subs[item]!) : 0);
    const parts = Object.entries(r.ingredients)
      .map(([item, need]) => this.chip(item, need, have(item)))
      .join('<span class="m-op">+</span>');
    const per = r.batch ? t.perBatch.replace('{n}', String(r.batch.yields)) : t.perRecipe;
    return `<p class="m-per">${esc(per)}</p><div class="m-calc">${parts}</div>`;
  }

  /**
   * A faixa do premium: o preço premium e a troca (o ingrediente comum → o premium, com quantas a despensa rende). O
   * premium sai sozinho quando a despensa tem a troca; o jeito alternativo mostra o equipamento e os ingredientes dele.
   */
  private premiumStrip(r: RecipeDef): string {
    const p = this.session.service.premiumView(r.id);
    if (!p) return '';
    const t = uiText.menuBoard;
    const swaps = p.swaps
      .map((s) => `<span class="m-swap">${iconHtml(content.items[s.from]?.icon, 12)}<span class="m-op">→</span>${this.chip(s.to, r.ingredients[s.from] ?? 1, this.session.service.doses(s.to))}</span>`)
      .join('');
    const alt = p.alternative
      ? `<span class="m-swap"><span class="m-alt">${esc(t.premiumAlt.replace('{equipment}', this.equipmentName(p.alternative.equipment).toLowerCase()))}</span>${p.alternative.items.map((x) => this.chip(x.item, r.alternative?.ingredients[x.item] ?? 1, this.session.service.doses(x.item))).join('')}</span>`
      : '';
    return `<div class="m-prem"><span class="m-star">${uiText.service.premium}</span>${this.price(this.session.service.priceOf(r.id, 'premium'))}<span class="m-swaps">${swaps}${alt}</span></div>`;
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
    // Quantas porções a despensa rende (fora de época e bloqueada, não mostra: nem dá para pôr no quadro).
    const servings = status === 'season' || status === 'locked' ? null : this.session.service.servingsFromPantry(r.id).servings;
    const chip = servings === null ? '' : `<span class="m-servings${servings === 0 ? ' none' : ''}" title="${esc(t.servingsChipTitle)}">${esc(t.servingsChip.replace('{n}', String(servings)))}</span>`;
    return `<div class="m-row${open ? ' open' : ''}${inMenu ? ' in-menu' : ''}" data-open="${r.id}">
      <i class="m-dot ${this.dot(status)}"></i>${iconHtml(r.icon)}<span class="m-name">${esc(r.name)}</span>${isNew ? `<span class="m-new">${esc(t.isNew)}</span>` : ''}${inMenu ? `<span class="m-in">${esc(t.inMenu)}</span>` : ''}${chip}<b class="m-price">${this.price(r.price)}</b><span class="m-chev">${open ? '▲' : '▼'}</span></div>${open ? this.row(r, inMenu) : ''}`;
  }

  private row(r: RecipeDef, inMenu: boolean): string {
    const t = uiText.menuBoard;
    const status = this.session.service.recipeStatus(r.id);
    const action = inMenu ? t.remove : t.add;
    // Falta ingrediente: a conta em vermelho já diz. Os outros motivos (equipamento, louça) numa linha curta.
    const why = status === 'available' || status === 'ingredients' ? '' : `<span class="status">${esc(this.statusText(r, status))}</span>`;
    const steps = r.steps.length > 1 ? `<span class="m-tag">${esc(r.steps.map((s) => content.service.equipment[s.equipment]?.name ?? s.equipment).join(' → '))}</span>` : '';
    const season = seasonLabel(r) ? `<span class="m-tag season">${esc(seasonLabel(r))}</span>` : '';
    const profit = r.price - this.session.service.costOf(r.id);
    return `<div class="recipe ${status === 'available' ? '' : 'sold-out'}">
      ${this.pantryCalc(r)}
      ${this.premiumStrip(r)}
      ${steps || season ? `<div class="m-tags">${steps}${season}</div>` : ''}
      ${why}
      <div class="m-foot"><span class="m-profit">${esc(t.profit)} ${this.price(profit)}</span><button data-recipe="${r.id}">${action}</button></div></div>`;
  }

  /**
   * O quadro: uma lousa desenhada no código (decisão 243), com o título e um quadrado por slot (o ícone da receita e o
   * preço embaixo; esgotado, apagado com a faixa "esgotado"). Slot vazio fica tracejado.
   */
  private boardHtml(inMenu: RecipeDef[]): string {
    const slots = content.service.menuSlots;
    const cells = Array.from({ length: slots }, (_, i) => {
      const r = inMenu[i];
      if (!r) return '<span class="b-slot empty"></span>';
      const soldOut = this.session.service.recipeStatus(r.id) !== 'available';
      return `<span class="b-slot${soldOut ? ' sold-out' : ''}" title="${esc(r.name)}"><span class="b-icon">${iconHtml(r.icon, 20)}</span>${soldOut ? `<span class="b-mark">${esc(uiText.menuBoard.soldOutMark)}</span>` : ''}<span class="b-price">${COIN}${r.price}</span></span>`;
    });
    return `<div class="board" style="--slots:${slots}"><p class="b-title">${esc(uiText.menuBoard.boardTitle)}</p><div class="b-slots">${cells.join('')}</div></div>`;
  }

  /** Quantos clientes cabem agora: o total e quantos em pé e quantos sentados. */
  private capacityHtml(): string {
    const c = this.session.service.capacity();
    const t = uiText.menuBoard.capacity;
    const fill = (x: string) => x.replace('{total}', String(c.total)).replace('{standing}', String(c.standing)).replace('{seated}', String(c.seated));
    return `<p class="capacity"><b>${esc(fill(t.short))}</b> ${esc(fill(t.split))}</p>`;
  }

  /** A louça limpa no estoque (embaixo de tudo). */
  private dishesHtml(): string {
    const d = this.session.state.dishes;
    const t = uiText.menuBoard.capacity;
    return `<p class="m-dishes">${esc(t.dishes.replace('{cup}', String(d.cup)).replace('{glass}', String(d.glass)).replace('{plate}', String(d.plate)))}</p>`;
  }

  private render(): void {
    if (!this.open) return;
    const sv = this.session.service;
    const menu = this.session.state.menu;
    const slots = content.service.menuSlots;
    const inMenu = menu.map((id) => sv.recipe(id)).filter((r): r is RecipeDef => !!r);
    const t = uiText.menuBoard;
    // Só o que está na época (as do quadro também), separado em abas pela louça; o resto fica numa linha recolhida.
    const all = [...inMenu, ...sv.unlockedRecipes().filter((r) => !menu.includes(r.id) && !r.special)];
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
    // A lista de compras logo embaixo do quadro (o que está esgotado e o que está disponível); a capacidade numa linha.
    this.body.innerHTML = `${this.boardHtml(inMenu)}
      <button class="shopping-add" data-shopping>${iconHtml('caixa_bilhete', 10)}${esc(t.shoppingAdd)}</button>
      ${this.capacityHtml()}
      <h3>${t.slots.replace('{n}', String(inMenu.length)).replace('{max}', String(slots))}</h3>
      ${tabs}<div class="m-list">${lines}</div>${legend}
      ${off.length ? `<details class="off-season"><summary>${esc(t.offSeason.replace('{n}', String(off.length)))} <span>${esc(offSummary)}</span></summary><ul>${off.map((r) => `<li>${iconHtml(r.icon)}${esc(r.name)} <span>(${esc(seasonLabel(r))})</span></li>`).join('')}</ul></details>` : ''}
      ${this.dishesHtml()}`;
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
    this.body.querySelectorAll<HTMLElement>('[data-name]').forEach((el) =>
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        this.onToast(el.dataset.name!);
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
