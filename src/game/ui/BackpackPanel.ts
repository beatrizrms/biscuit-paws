// Mochila (tecla I): painel no centro com a barra (1 a 8) em cima e a grade da mochila embaixo, só ícones e quantidade.
// Selecionar um item mostra o nome, para que serve e as ações numa linha de detalhes. Para pôr na barra: arrastar
// até um espaço, clicar no espaço com o item selecionado ou apertar 1 a 8. Arrastar da barra para a grade tira da barra.
import type { HandItem } from '../../core/carry';
import type { ItemDef } from '../../core/content';
import { fitsHotbar } from '../../core/hotbar';
import type { GameSession } from '../../core/session';
import { premiumIn, VESSELS } from '../../core/recipes';
import { content, uiText } from '../content';
import { itemIconHtml } from './Hotbar';
import { iconHtml, listNames } from './ShopPanel';
import { tileThumbHtml } from '../icons';

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

/** Espaços da grade da mochila (cresce de 8 em 8 se ela tiver mais coisas). */
const BAG_SLOTS = 16;

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

const isFurniture = (item: ItemDef | undefined) => (item?.kind ?? 'furniture') === 'furniture';

/** Ordem na grade: ferramentas, itens de usar, o resto, ingredientes e, por último, móveis. */
function bagOrder(item: ItemDef): number {
  if (item.kind === 'tool') return 0;
  if (item.use) return 1;
  if (isFurniture(item)) return 4;
  return item.tags.includes('ingredient') ? 3 : 2;
}

/** Para que serve (linha de detalhes). */
function purpose(item: ItemDef): string {
  const d = uiText.backpack.purpose;
  if (item.description) return item.description;
  if (item.id === content.world.tools.sweep) return d.sweep;
  if (item.id === content.carry.tray.item) return d.tray;
  if (item.use === 'food_bowl') return d.food;
  if (item.use === 'cat') return d.treat;
  if (isFurniture(item)) return d.furniture;
  const premium = premiumIn(content.recipes, item.id);
  if (premium.length > 0) return d.premium.replace('{recipes}', listNames(premium.map((r) => r.name)));
  if (item.tags.includes('ingredient')) return d.ingredient;
  if (item.kind === 'key') return d.key;
  if (item.tags.includes('job')) return d.job;
  return d.other;
}

type Selection = { from: 'bag'; id: string } | { from: 'bar'; slot: number } | null;

export class BackpackPanel {
  private el: HTMLElement;
  private body: HTMLElement;
  private open = false;
  private selected: Selection = null;

  constructor(
    root: HTMLElement,
    private session: GameSession,
    private onChange: () => void,
    private onProblem: (reason: string) => void,
    private onPlace: (itemId: string) => void,
  ) {
    this.el = document.createElement('section');
    this.el.className = 'panel catalog backpack';
    this.el.innerHTML = `<header><h2>${uiText.backpack.title}</h2><button class="close">${uiText.backpack.close}</button></header><div class="list"></div>`;
    root.appendChild(this.el);
    this.body = this.el.querySelector('.list') as HTMLElement;
    (this.el.querySelector('.close') as HTMLElement).addEventListener('click', () => this.close());
    this.body.addEventListener('click', (e) => this.onClick(e));
    this.body.addEventListener('dragstart', (e) => this.onDragStart(e));
    this.body.addEventListener('dragover', (e) => {
      if ((e.target as HTMLElement).closest('[data-bar], .bp-bag')) e.preventDefault();
    });
    this.body.addEventListener('drop', (e) => this.onDrop(e));
    session.bus.onAny(() => this.render());
  }

  isOpen(): boolean {
    return this.open;
  }

  /** Aberta pelo armário da cozinha: a despensa aparece com o botão de guardar o que está na mochila. */
  private atPantry = false;

  show(atPantry = false): void {
    this.open = true;
    this.atPantry = atPantry;
    this.selected = null;
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

  /** Tecla 1 a 8 com a mochila aberta e um item selecionado: vai para aquele espaço. Devolve se usou a tecla. */
  numberKey(n: number): boolean {
    const id = this.selectedItem();
    if (!this.open || this.selected?.from !== 'bag' || !id || !fitsHotbar(content.items[id])) return false;
    this.assign(id, n - 1);
    return true;
  }

  /** Onde "pôr na barra" coloca: o primeiro espaço vazio (ou com item que acabou); sem nenhum, o ativo. */
  private freeSlot(): number {
    const { slots, active } = this.session.state.hotbar;
    const free = slots.findIndex((id) => !this.owned(id));
    return free >= 0 ? free : active;
  }

  private selectedItem(): string | null {
    const s = this.selected;
    if (!s) return null;
    return s.from === 'bag' ? s.id : this.session.state.hotbar.slots[s.slot] ?? null;
  }

  private owned(id: string | null): id is string {
    const st = this.session.state;
    return !!id && (st.inventory[id] ?? 0) > 0;
  }

  private assign(itemId: string, slot: number): void {
    const r = this.session.assignToHotbar(itemId, slot);
    if (!r.ok) return this.onProblem(r.reason);
    this.selected = { from: 'bar', slot };
    this.render();
  }

  private onClick(e: MouseEvent): void {
    const target = e.target as HTMLElement;
    const bar = target.closest<HTMLElement>('[data-bar]');
    const bag = target.closest<HTMLElement>('[data-bag]');
    const act = target.closest<HTMLButtonElement>('button[data-act]');
    const sv = this.session.service;
    if (act) {
      const id = this.selectedItem();
      const report = (r: { ok: boolean; reason?: string }) => !r.ok && r.reason && this.onProblem(r.reason);
      switch (act.dataset.act) {
        case 'pantry-store':
          report(sv.storeInPantry());
          return this.render();
        case 'to-bar':
          if (id) this.assign(id, this.freeSlot());
          return;
        case 'off-bar':
          if (this.selected?.from === 'bar') this.session.clearHotbarSlot(this.selected.slot);
          this.selected = id ? { from: 'bag', id } : null;
          return this.render();
        case 'place':
          if (!id) return;
          this.close();
          return this.onPlace(id);
        case 'hold':
          if (id) report(sv.hold(id));
          return;
        case 'tray': {
          // A bandeja vale quando está selecionada na barra: usar = selecionar (põe na barra se não estiver);
          // guardar = passar para o espaço seguinte.
          const tray = this.session.content.carry.tray.item;
          const st = this.session.state;
          if (st.tray) this.session.selectHotbarSlot((st.hotbar.active + 1) % st.hotbar.slots.length);
          else if (!this.session.selectHotbarItem(tray)) {
            const r = this.session.assignToHotbar(tray, this.freeSlot());
            if (!r.ok) return void report(r);
            this.session.selectHotbarItem(tray);
          }
          if (st.tray === (st.hotbar.slots[st.hotbar.active] !== tray)) report({ ok: false, reason: 'hands_full' });
          return this.render();
        }
        case 'stow':
          return void report(sv.stow());
      }
      return;
    }
    if (bar) {
      const slot = Number(bar.dataset.bar);
      // Com um item da mochila selecionado, clicar num espaço da barra põe ele ali.
      const picked = this.selected?.from === 'bag' ? this.selected.id : null;
      if (picked && fitsHotbar(content.items[picked])) return this.assign(picked, slot);
      this.session.selectHotbarSlot(slot);
      this.selected = { from: 'bar', slot };
      return this.render();
    }
    if (bag?.dataset.bag) {
      this.selected = { from: 'bag', id: bag.dataset.bag };
      this.render();
    }
  }

  private onDragStart(e: DragEvent): void {
    const el = (e.target as HTMLElement).closest<HTMLElement>('[data-bar], [data-bag]');
    if (!el || !e.dataTransfer) return;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', el.dataset.bar !== undefined ? `bar:${el.dataset.bar}` : `bag:${el.dataset.bag}`);
  }

  private onDrop(e: DragEvent): void {
    e.preventDefault();
    const data = e.dataTransfer?.getData('text/plain') ?? '';
    const [from, value] = [data.slice(0, 3), data.slice(4)];
    const bar = (e.target as HTMLElement).closest<HTMLElement>('[data-bar]');
    if (bar) {
      const slot = Number(bar.dataset.bar);
      if (from === 'bar') {
        this.session.moveHotbarSlot(Number(value), slot);
        this.selected = { from: 'bar', slot };
        return this.render();
      }
      if (from === 'bag' && fitsHotbar(content.items[value])) return this.assign(value, slot);
      return;
    }
    // Da barra de volta para a mochila: sai da barra (o item continua na mochila).
    if (from === 'bar' && (e.target as HTMLElement).closest('.bp-bag')) {
      const id = this.session.state.hotbar.slots[Number(value)];
      this.session.clearHotbarSlot(Number(value));
      this.selected = id ? { from: 'bag', id } : null;
      this.render();
    }
  }

  private slotHtml(id: string | null, attrs: string, active: boolean, key?: number): string {
    const st = this.session.state;
    const item = this.owned(id) ? content.items[id] : undefined;
    // Na mochila e na barra: pacotes (as doses ficam na despensa).
    const qty = !item ? 0 : st.inventory[item.id] ?? 0;
    const icon = !item ? '' : isFurniture(item) ? tileThumbHtml(item.tile, 18, item.hue) : itemIconHtml(item, 18);
    const sel = item && this.selectedItem() === item.id ? ' selected' : '';
    const label = item ? ` title="${esc(item.name)}" draggable="true"` : '';
    return `<button class="bp-slot${active ? ' active' : ''}${sel}${item ? '' : ' is-empty'}" ${attrs}${label}>${
      key !== undefined ? `<span class="key">${key}</span>` : ''
    }${icon}${qty > 1 ? `<span class="count">${qty}</span>` : ''}</button>`;
  }

  private detailHtml(): string {
    const t = uiText.backpack;
    const id = this.selectedItem();
    const item = this.owned(id) ? content.items[id] : undefined;
    if (!item) return `<p class="bp-hint">${t.gridHint}</p>`;
    const st = this.session.state;
    const amount = `x${st.inventory[item.id] ?? 0}`;
    const onBar = st.hotbar.slots.indexOf(item.id);
    const buttons: string[] = [];
    if (isFurniture(item)) {
      const why = this.session.missingHost(item.id);
      const away = !this.session.atHome();
      buttons.push(`<button data-act="place" ${why || away ? 'disabled' : ''}>${t.place}</button>`);
      if (why) buttons.push(`<span class="why">${t.needsCounter}</span>`);
      else if (away) buttons.push(`<span class="why">${t.placeAtHome}</span>`);
    } else if (fitsHotbar(item)) {
      if (onBar >= 0) buttons.push(`<button data-act="off-bar">${t.offBar}</button>`);
      else buttons.push(`<button data-act="to-bar">${t.toBar.replace('{n}', String(this.freeSlot() + 1))}</button>`);
    }
    if (item.tags.includes('treat')) buttons.push(`<button data-act="hold">${t.hold}</button>`);
    if (item.id === content.carry.tray.item) buttons.push(`<button data-act="tray">${st.tray ? t.stowTray : t.useTray}</button>`);
    return `<div class="bp-detail"><span class="bp-detail-icon">${isFurniture(item) ? tileThumbHtml(item.tile, 22, item.hue) : itemIconHtml(item, 22)}</span>
      <span class="bp-detail-text"><b>${esc(item.name)}</b> <span class="amount">${amount}</span><br /><span class="purpose">${esc(purpose(item))}</span></span>
      <span class="bp-detail-actions">${buttons.join('')}</span></div>`;
  }

  /**
   * A despensa (só ver): os ingredientes guardados no armário e as doses de cada um. No armário, o botão guarda o que
   * está na mochila; longe dele, a dica de onde guardar.
   */
  private pantryHtml(): string {
    const t = uiText.backpack;
    const st = this.session.state;
    const sv = this.session.service;
    const ids = [...new Set([...Object.keys(st.pantry), ...Object.keys(st.pantryOpen)])].filter((id) => content.items[id] && sv.doses(id) > 0);
    ids.sort((a, b) => bagOrder(content.items[a]!) - bagOrder(content.items[b]!));
    const slots = ids
      .map((id) => {
        const item = content.items[id]!;
        return `<span class="bp-slot bp-pantry-slot" title="${esc(item.name)} · ${esc(t.doses.replace('{n}', String(sv.doses(id))))}">${itemIconHtml(item, 18)}<span class="count">${sv.doses(id)}</span></span>`;
      })
      .join('');
    const inBag = sv.ingredientsInBag();
    const action = inBag === 0 ? '' : this.atPantry ? `<button data-act="pantry-store">${esc(t.pantryStore.replace('{n}', String(inBag)))}</button>` : `<span class="why">${esc(t.pantryWhere)}</span>`;
    return `<div class="bp-pantry"><h3>${t.pantry}${action ? ` ${action}` : ''}</h3>${slots ? `<div class="bp-row">${slots}</div>` : `<p class="bp-hint">${t.pantryEmpty}</p>`}</div>`;
  }

  private render(): void {
    if (!this.open) return;
    const t = uiText.backpack;
    const st = this.session.state;
    if (this.selected && !this.owned(this.selectedItem())) this.selected = null;
    // Faixa de cima: o que está nas mãos e a louça limpa.
    const hands = st.hands.length
      ? st.hands.map((h) => esc(handItemName(h, (id) => this.session.catName(id)))).join(', ') + (st.hands.some((h) => h.kind === 'item') ? ` <button data-act="stow">${t.stow}</button>` : '')
      : t.handsEmpty;
    const dishes = VESSELS.map((v) => `<span class="vessel" title="${esc(content.service.vessels[v].name)}">${iconHtml(content.service.vessels[v].icon, 12)}${st.dishes[v] ?? 0}</span>`).join('');
    // A barra (mesmos espaços da barra de baixo da tela).
    const bar = st.hotbar.slots.map((id, i) => this.slotHtml(id, `data-bar="${i}"`, i === st.hotbar.active, i + 1)).join('');
    // A mochila: tudo o que ela tem e não está na barra.
    const ids = Object.keys(st.inventory).filter((id) => this.owned(id) && !st.hotbar.slots.includes(id) && content.items[id] && content.items[id]!.kind !== 'fixture');
    ids.sort((a, b) => bagOrder(content.items[a]!) - bagOrder(content.items[b]!));
    const total = Math.max(BAG_SLOTS, Math.ceil(ids.length / 8) * 8);
    const bag = Array.from({ length: total }, (_, i) => (ids[i] ? this.slotHtml(ids[i]!, `data-bag="${ids[i]}"`, false) : `<span class="bp-slot is-empty"></span>`)).join('');
    this.body.innerHTML = `
      <div class="bp-strip"><span><b>${t.hands}:</b> ${hands}</span><span class="dishes"><b>${t.dishes}:</b> ${dishes}</span></div>
      <h3>${t.bar}</h3><div class="bp-row">${bar}</div>
      <h3>${t.bag}</h3><div class="bp-row bp-bag">${bag}</div>
      ${this.detailHtml()}
      ${this.pantryHtml()}`;
    if (this.atPantry) this.body.querySelector('.bp-pantry')?.scrollIntoView({ block: 'nearest' });
  }
}
