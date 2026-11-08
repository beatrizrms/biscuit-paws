// App "Market" do celular: as compras online (chegam pela entregadora na porta do café), em abas
// Pet, Móveis, Decor e Construção (data/ui_text.json: market.tabs). Cada item é um cartão com a miniatura do móvel.
// Construção também tem as obras dos cômodos e o pintor. Quem decide (preço, limites, entrega) é a sessão.
import type { GameSession } from '../../core/session';
import { content, uiText } from '../content';
import { itemThumbHtml, tileThumbHtml } from './thumbs';

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

/** Lado da miniatura nos cartões (pixels do jogo). */
const THUMB = 32;
const COIN = '<img class="coin" src="assets/ui/hud/ui_coin_16.png" alt="" />';

export interface MarketHost {
  toast(text: string): void;
  problem(reason: string): void;
  /** Item da bolsa: fecha o celular e começa a posicionar. */
  place(itemId: string): void;
  /** Obra começou ou parede pintada: fecha o celular para ver. */
  done(text?: string): void;
  /** "Pedido feito: chega às 15:00" (ou amanhã). */
  ordered(arrivesAt: number): void;
}

type Tab = (typeof uiText.market.tabs)[number];

export class MarketApp {
  private tab: string = uiText.market.tabs[0]!.id;

  constructor(
    private session: GameSession,
    private host: MarketHost,
  ) {}

  /** Desenha o app dentro de `body` (a tela do celular) e liga os botões. */
  render(body: HTMLElement): void {
    const m = uiText.market;
    const tab = m.tabs.find((t) => t.id === this.tab) ?? m.tabs[0]!;
    const tabs = m.tabs.map((t) => `<button class="m-tab${t.id === tab.id ? ' on' : ''}" data-tab="${t.id}">${esc(t.title)}</button>`).join('');
    const content = this.tabHtml(tab);
    // A tela é redesenhada a cada mudança (dinheiro, entregas): mantém a rolagem se a aba é a mesma.
    const old = body.querySelector<HTMLElement>('.m-scroll');
    const keep = old && body.dataset.marketTab === tab.id ? old.scrollTop : 0;
    body.dataset.marketTab = tab.id;
    body.innerHTML = `<nav class="m-tabs">${tabs}</nav><div class="m-scroll"><p class="m-online">${esc(m.online)}</p>${content || `<p class="empty">${esc(m.empty)}</p>`}</div>`;
    (body.querySelector('.m-scroll') as HTMLElement).scrollTop = keep;
    body.querySelectorAll<HTMLButtonElement>('[data-tab]').forEach((b) =>
      b.addEventListener('click', () => {
        this.tab = b.dataset.tab!;
        this.render(body);
      }),
    );
    body.querySelectorAll<HTMLButtonElement>('.m-card[data-item]').forEach((b) => b.addEventListener('click', () => this.pick(b.dataset.item!)));
    body.querySelectorAll<HTMLButtonElement>('[data-refund]').forEach((b) =>
      b.addEventListener('click', () => {
        const r = this.session.refund(b.dataset.refund!);
        if (!r.ok) return this.host.problem(r.reason);
        this.host.toast(uiText.refunded);
      }),
    );
    body.querySelectorAll<HTMLButtonElement>('[data-room]').forEach((b) =>
      b.addEventListener('click', () => {
        const id = b.dataset.room!;
        const r = b.dataset.work === 'open' ? this.session.openRoom(id) : this.session.restoreRoom(id);
        if (!r.ok) return this.host.problem(r.reason);
        this.host.done();
      }),
    );
    body.querySelectorAll<HTMLButtonElement>('[data-finish]').forEach((b) =>
      b.addEventListener('click', () => {
        const r = this.session.paint(b.dataset.surface!, b.dataset.finish!);
        if (!r.ok) return this.host.problem(r.reason);
        this.host.done(uiText.painted);
      }),
    );
  }

  private tabHtml(tab: Tab): string {
    // Cada item fica numa aba e num grupo só: o primeiro que bate (tag, sem as de except), na ordem das abas.
    const groups: { tag: string; title: string; except?: string[] }[] = uiText.market.tabs.flatMap((t) => t.groups);
    const groupOf = (tags: readonly string[]) => groups.find((g) => tags.includes(g.tag) && !g.except?.some((x) => tags.includes(x)));
    const items = Object.values(content.items).filter((i) => !i.deprecated && this.session.itemUnlocked(i.id));
    const blocks = tab.groups.map((g) => {
      const cards = items
        .filter((i) => groupOf(i.tags) === g)
        .map((i) => this.cardHtml(i.id))
        .join('');
      return cards ? `<h3>${esc(g.title)}</h3><div class="m-grid">${cards}</div>` : '';
    });
    if ('rooms' in tab && tab.rooms) blocks.push(this.roomsHtml());
    if ('renovation' in tab && tab.renovation) blocks.push(this.renovationHtml());
    return blocks.join('');
  }

  private cardHtml(id: string): string {
    const { state } = this.session;
    const i = content.items[id]!;
    const owned = state.inventory[id] ?? 0;
    const fixture = i.kind === 'fixture';
    const coming = state.deliveries.filter((d) => d.item === id).length;
    const disabled = (owned === 0 && state.money < i.price) || (fixture && (owned > 0 || coming > 0));
    const status = [
      owned > 0 ? `<span class="m-owned">${fixture ? uiText.installed : `${owned} ${uiText.inBag} · ${uiText.market.tapToPlace}`}</span>` : '',
      coming > 0 ? `<span class="m-owned coming">${coming} ${uiText.delivery.onTheWay}</span>` : '',
    ].join('');
    const refund =
      owned > 0 && !fixture ? `<button class="m-refund" data-refund="${id}" title="${uiText.refund}">${uiText.refund} +${this.session.refundValue(id)}</button>` : '';
    return `<div class="m-cell"><button class="m-card${owned > 0 ? ' has' : ''}" data-item="${id}" ${disabled ? 'disabled' : ''}>
        <span class="m-thumb">${itemThumbHtml(i, THUMB)}</span>
        <span class="m-name">${esc(i.name)}</span>
        <span class="m-price">${COIN}${i.price}</span>${status}
      </button>${refund}</div>`;
  }

  /** Item da bolsa: posicionar (só dentro do café). Senão, encomendar: chega pelo correio. */
  private pick(itemId: string): void {
    if ((this.session.state.inventory[itemId] ?? 0) > 0 && content.items[itemId]?.kind !== 'fixture') {
      if (!this.session.atHome()) return this.host.toast(uiText.market.placeOnlyHome);
      return this.host.place(itemId);
    }
    const r = this.session.order(itemId);
    if (!r.ok) return this.host.problem(r.reason);
    this.host.ordered(this.session.state.deliveries[this.session.state.deliveries.length - 1]!.arrivesAt);
  }

  /** Obras dos cômodos (data/rooms.json): abrir os descobertos e terminar a reforma dos abertos. E quantos gatos cabem. */
  private roomsHtml(): string {
    const r = uiText.rooms;
    const why: Record<string, string> = { needs_money: r.needsMoney, needs_beat: r.needsBeat, needs_cats: r.needsCats, needs_item: r.needsItem };
    const row = (id: string, work: string, label: string, price: number, note: string, disabled: boolean) =>
      `<button class="m-row" data-room="${id}" data-work="${work}" ${disabled ? 'disabled' : ''}>
        <span class="m-name">${esc(label)}</span><span class="m-price">${COIN}${price}</span>${note ? `<span class="m-note">${esc(note)}</span>` : ''}</button>`;
    const rows = this.session
      .rooms()
      .map((room) => {
        const s = this.session.roomState(room.id);
        if (s === 'discovered' && (room.unlock?.cost ?? 0) > 0) {
          const p = this.session.openRoomProblem(room.id);
          return row(room.id, 'open', room.unlock?.label ?? room.name, room.unlock?.cost ?? 0, p ? (why[p] ?? '') : '', !!p);
        }
        if (s === 'abandoned' && room.restore && !room.restore.when) {
          const p = this.session.restoreRoomProblem(room.id);
          const note = p === 'still_dirty' ? r.stillDirty.replace('{n}', String(this.session.roomDirtLeft(room.id))) : p === 'needs_money' ? r.needsMoney : '';
          return row(room.id, 'restore', room.restore.label ?? room.name, room.restore.cost ?? 0, note, !!p);
        }
        return '';
      })
      .join('');
    const cats = `<p class="m-hint">${esc(r.cats.replace('{n}', String(this.session.shelteredCats().length)).replace('{max}', String(this.session.catCapacity())))}</p>`;
    return rows ? `<h3>${esc(r.title)}</h3><p class="m-hint">${esc(r.hint)}</p>${rows}${cats}` : cats;
  }

  /** Pintor: para cada superfície, os acabamentos que servem nela (com a amostra do piso/parede). */
  private renovationHtml(): string {
    if (!this.session.painterUnlocked()) return '';
    const { state } = this.session;
    const finishes = Object.values(content.finishes);
    const blocks = this.session
      .surfaces()
      .map((surface) => {
        const cards = finishes
          .filter((f) => f.kind === surface.kind)
          .map((f) => {
            const current = state.finishes[surface.id] === f.id;
            return `<div class="m-cell"><button class="m-card${current ? ' has' : ''}" data-surface="${surface.id}" data-finish="${f.id}" ${current || state.money < f.price ? 'disabled' : ''}>
                <span class="m-thumb">${tileThumbHtml(f.tile, THUMB)}</span><span class="m-name">${esc(f.name)}</span>
                <span class="m-price">${current ? uiText.current : `${COIN}${f.price}`}</span></button></div>`;
          })
          .join('');
        return `<h4>${esc(surface.name)}</h4><div class="m-grid">${cards}</div>`;
      })
      .join('');
    return blocks ? `<h3>${esc(uiText.renovationTitle)}</h3><p class="m-hint">${esc(uiText.renovationHint)}</p>${blocks}` : '';
  }
}
