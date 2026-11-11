// App "Market" do celular: as compras online (chegam pela entregadora na porta do café), em abas
// Pet, Móveis, Eletro, Natal (só quando tem itens da estação), Decor e Construção (data/ui_text.json: market.tabs). Cada item é um cartão com a miniatura do móvel.
// Construção também tem as obras dos cômodos e o pintor. Quem decide (preço, limites, entrega) é a sessão.
// Como no mercado, nada é comprado no toque: o item vai para o pedido (session.orderCart) e só sai ao confirmar.
import { daysText, workName } from './constructionText';
import type { GameSession, RoomWork } from '../../core/session';
import { content, uiText } from '../content';
import { hoverTips } from './hoverTip';
import { itemTip } from './ShopPanel';
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
  /** Troca de acabamento: fecha o celular e ela marca a área no café (retângulo). */
  selectArea(surfaceId: string, finishId: string): void;
  /** Assistência: fecha o celular e ela escolhe o móvel no café. */
  pickUpgrade(): void;
  /** Assistência: confirma e troca o móvel pela peça escolhida. */
  upgrade(uid: string, to: string): void;
  /** "Pedido feito: chega às 15:00" (ou amanhã). */
  ordered(arrivesAt: number): void;
}

type Tab = (typeof uiText.market.tabs)[number];

export class MarketApp {
  private tab: string = uiText.market.tabs[0]!.id;
  /** Assistência: o móvel escolhido no café (uid), cujas trocas a aba mostra. */
  private upgradeTarget: string | null = null;

  constructor(
    private session: GameSession,
    private host: MarketHost,
  ) {}

  /** Abre numa aba (id de data/ui_text.json market.tabs); id que não existe fica onde está. */
  setTab(tabId: string): void {
    if (uiText.market.tabs.some((t) => t.id === tabId)) this.tab = tabId;
  }

  /** Assistência: abre a aba com as trocas deste móvel. */
  showUpgrade(uid: string): void {
    this.upgradeTarget = uid;
    const tab = uiText.market.tabs.find((t) => 'upgrade' in t && t.upgrade);
    if (tab) this.tab = tab.id;
  }

  /** Desenha o app dentro de `body` (a tela do celular) e liga os botões. */
  render(body: HTMLElement): void {
    const m = uiText.market;
    // Aba da estação (seasonal: a de Natal) só aparece quando tem algo à venda.
    const visible = m.tabs.filter((t) => !('seasonal' in t && t.seasonal) || this.tabHtml(t) !== '');
    const tab = visible.find((t) => t.id === this.tab) ?? visible[0]!;
    const tabs = visible.map((t) => `<button class="m-tab${t.id === tab.id ? ' on' : ''}" data-tab="${t.id}">${esc(t.title)}</button>`).join('');
    const content = this.tabHtml(tab);
    // A tela é redesenhada a cada mudança (dinheiro, entregas): mantém a rolagem se a aba é a mesma.
    const old = body.querySelector<HTMLElement>('.m-scroll');
    const keep = old && body.dataset.marketTab === tab.id ? old.scrollTop : 0;
    body.dataset.marketTab = tab.id;
    body.innerHTML = `<nav class="m-tabs">${tabs}</nav><div class="m-scroll"><p class="m-online">${esc(m.online)}</p>${content || `<p class="empty">${esc(m.empty)}</p>`}</div>${this.orderBarHtml()}`;
    (body.querySelector('.m-scroll') as HTMLElement).scrollTop = keep;
    hoverTips(body);
    body.querySelectorAll<HTMLButtonElement>('[data-tab]').forEach((b) =>
      b.addEventListener('click', () => {
        this.tab = b.dataset.tab!;
        this.render(body);
      }),
    );
    body.querySelectorAll<HTMLButtonElement>('.m-card[data-item]').forEach((b) => b.addEventListener('click', () => this.pick(b.dataset.item!, body)));
    body.querySelectorAll<HTMLButtonElement>('[data-less]').forEach((b) =>
      b.addEventListener('click', () => {
        this.session.removeFromOrder(b.dataset.less!);
        this.render(body);
      }),
    );
    body.querySelector<HTMLButtonElement>('[data-order="clear"]')?.addEventListener('click', () => {
      this.session.orderCart.clear();
      this.render(body);
    });
    body.querySelector<HTMLButtonElement>('[data-order="confirm"]')?.addEventListener('click', () => {
      const r = this.session.checkoutOrder();
      if (r.ok) this.host.ordered(r.arrivesAt);
      else this.host.problem(r.reason);
      this.render(body);
    });
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
        // Com o Tião (builder nos dados): a ligação com o orçamento; sem, a obra paga na hora.
        const kind = b.dataset.kind as RoomWork['kind'] | undefined;
        const r = kind ? this.session.quoteRoom(id, kind) : b.dataset.work === 'open' ? this.session.openRoom(id) : this.session.restoreRoom(id);
        if (!r.ok) return this.host.problem(r.reason);
        this.host.done();
      }),
    );
    // Obras do Tião: o reparo (e a fachada) vai direto para a ligação; a troca de acabamento pede a área antes.
    body.querySelectorAll<HTMLButtonElement>('[data-repair]').forEach((b) =>
      b.addEventListener('click', () => {
        const r = this.session.quoteRepair(b.dataset.repair as 'inside' | 'outside', b.dataset.finish);
        if (!r.ok) return this.host.problem(r.reason);
        this.host.done();
      }),
    );
    body.querySelectorAll<HTMLButtonElement>('[data-facade]').forEach((b) =>
      b.addEventListener('click', () => {
        const r = this.session.quoteFacade(b.dataset.facade!);
        if (!r.ok) return this.host.problem(r.reason);
        this.host.done();
      }),
    );
    body.querySelector<HTMLButtonElement>('[data-upgrade-pick]')?.addEventListener('click', () => this.host.pickUpgrade());
    body.querySelectorAll<HTMLButtonElement>('[data-upgrade-to]').forEach((b) =>
      b.addEventListener('click', () => this.upgradeTarget && this.host.upgrade(this.upgradeTarget, b.dataset.upgradeTo!)),
    );
    body.querySelectorAll<HTMLButtonElement>('[data-surface][data-finish]').forEach((b) =>
      b.addEventListener('click', () => this.host.selectArea(b.dataset.surface!, b.dataset.finish!)),
    );
  }

  private tabHtml(tab: Tab): string {
    // Cada item fica numa aba e num grupo só: o primeiro que bate (tag, sem as de except), na ordem das abas. As abas da
    // estação (Halloween, Natal) vêm por último na lista, mas têm a vez primeiro: o enfeite (que também é "decor") fica nelas.
    const seasonalFirst = [...uiText.market.tabs].sort((a, b) => Number('seasonal' in b && !!b.seasonal) - Number('seasonal' in a && !!a.seasonal));
    const groups: { tag: string; title: string; except?: string[] }[] = seasonalFirst.flatMap((t) => t.groups);
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
    if ('upgrade' in tab && tab.upgrade) blocks.push(this.upgradeHtml());
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
    const inOrder = this.session.orderCart.qty(id);
    const refund =
      owned > 0 && !fixture ? `<button class="m-refund" data-refund="${id}" title="${uiText.refund}">${uiText.refund} +${this.session.refundValue(id)}</button>` : '';
    // No pedido: quantos e o "−" (tocar no cartão de novo põe mais um).
    const order =
      inOrder > 0 ? `<div class="m-qty"><button class="m-less" data-less="${id}">−</button><span>${esc(uiText.market.orderCount.replace('{n}', String(inOrder)))}</span></div>` : '';
    // Para que serve: no balão de hover (data-tip), não embaixo do nome.
    const tip = itemTip(i);
    return `<div class="m-cell"${tip ? ` data-tip="${esc(tip)}"` : ''}><button class="m-card${owned > 0 ? ' has' : ''}${inOrder > 0 ? ' in-order' : ''}" data-item="${id}" ${disabled ? 'disabled' : ''}>
        <span class="m-thumb">${itemThumbHtml(i, THUMB)}</span>
        <span class="m-name">${esc(i.name)}</span>
        <span class="m-price">${COIN}${i.price}</span>${status}
      </button>${order}${refund}</div>`;
  }

  /** Barra do pedido, embaixo da tela: quantos itens, o total e o botão de confirmar (só com itens no pedido). */
  private orderBarHtml(): string {
    const cart = this.session.orderCart;
    if (cart.isEmpty()) return '';
    const m = uiText.market;
    const total = this.session.orderTotal();
    const short = total - this.session.state.money;
    return `<div class="m-order">
        <div class="m-order-sum"><span>${esc(m.items.replace('{n}', String(cart.count())))}</span><span class="m-price${short > 0 ? ' short' : ''}">${COIN}${total}</span>
        ${short > 0 ? `<span class="m-short">${esc(m.notEnough.replace('{n}', String(short)))}</span>` : ''}</div>
        <button class="m-order-clear" data-order="clear">${esc(m.clear)}</button>
        <button class="m-order-confirm" data-order="confirm" ${short > 0 ? 'disabled' : ''}>${esc(m.confirm)}</button>
      </div>`;
  }

  /** Item da bolsa: posicionar (só dentro do café). Senão, vai para o pedido (só compra ao confirmar). */
  private pick(itemId: string, body: HTMLElement): void {
    if ((this.session.state.inventory[itemId] ?? 0) > 0 && content.items[itemId]?.kind !== 'fixture') {
      if (!this.session.atHome()) return this.host.toast(uiText.market.placeOnlyHome);
      return this.host.place(itemId);
    }
    const r = this.session.addToOrder(itemId);
    if (!r.ok) return this.host.problem(r.reason);
    this.render(body);
  }

  /** Obras dos cômodos (data/rooms.json): abrir os descobertos e terminar a reforma dos abertos. E quantos gatos cabem. */
  private roomsHtml(): string {
    const r = uiText.rooms;
    const cs = this.session.state.construction;
    // Pelo Tião: uma obra por vez (com as outras), os dias no aviso e "em obra" na que ele está fazendo.
    const builder = (id: string, kind: RoomWork['kind'], note: string, disabled: boolean) => {
      const work = this.session.roomWorks(id).find((w) => w.kind === kind);
      if (!work) return null;
      if ([cs.job, cs.quote].some((j) => j?.roomId === id && j.kind === kind)) return { work, note: r.inWork, disabled: true };
      return { work, note: [note, daysText(work.days)].filter(Boolean).join(' · '), disabled: disabled || !!(cs.job || cs.quote) };
    };
    const why: Record<string, string> = { needs_money: r.needsMoney, needs_beat: r.needsBeat, needs_cats: r.needsCats, needs_item: r.needsItem };
    const row = (id: string, work: string, label: string, price: number, note: string, disabled: boolean, kind?: string) =>
      `<button class="m-row" data-room="${id}" data-work="${work}"${kind ? ` data-kind="${kind}"` : ''} ${disabled ? 'disabled' : ''}>
        <span class="m-name">${esc(label)}</span><span class="m-price">${COIN}${price}</span>${note ? `<span class="m-note">${esc(note)}</span>` : ''}</button>`;
    const money = this.session.state.money;
    const rows = this.session
      .rooms()
      .map((room) => {
        const s = this.session.roomState(room.id);
        if (s === 'discovered' && (room.unlock?.cost ?? 0) > 0) {
          const p = this.session.openRoomProblem(room.id);
          const note = p ? (why[p] ?? '') : '';
          const b = builder(room.id, 'room_open', note, !!p);
          return row(room.id, 'open', room.unlock?.label ?? room.name, room.unlock?.cost ?? 0, b?.note ?? note, b?.disabled ?? !!p, b ? 'room_open' : undefined);
        }
        if (s === 'abandoned' && room.restore && !room.restore.when) {
          // A limpeza pesada (se ainda houver mato alto) vem antes da reforma, numa linha própria.
          const heavy = this.session.roomHeavyDirtLeft(room.id);
          const clear = heavy > 0 ? builder(room.id, 'room_clear', money < (room.clear?.cost ?? 0) ? r.needsMoney : '', money < (room.clear?.cost ?? 0)) : null;
          const clearRow = clear ? row(room.id, 'clear', clear.work.label, clear.work.cost, clear.note, clear.disabled, 'room_clear') : '';
          const p = this.session.restoreRoomProblem(room.id);
          const note = heavy > 0 ? r.needsHeavy : p === 'still_dirty' ? r.stillDirty.replace('{n}', String(this.session.roomDirtLeft(room.id))) : p === 'needs_money' ? r.needsMoney : '';
          const b = builder(room.id, 'room_restore', note, !!p);
          return clearRow + row(room.id, 'restore', room.restore.label ?? room.name, room.restore.cost ?? 0, b?.note ?? note, b?.disabled ?? !!p, b ? 'room_restore' : undefined);
        }
        return '';
      })
      .join('');
    const cats = `<p class="m-hint">${esc(r.cats.replace('{n}', String(this.session.shelteredCats().length)).replace('{max}', String(this.session.catCapacity())))}</p>`;
    return rows ? `<h3>${esc(r.title)}</h3><p class="m-hint">${esc(r.hint)}</p>${rows}${cats}` : cats;
  }

  /**
   * Obras do Tião (src/core/construction.ts): uma por vez. Primeiro os reparos (interno e da fachada, com a cor);
   * depois, trocar o acabamento de uma área (o material é por tile) e pintar a fachada de outra cor.
   */
  private renovationHtml(): string {
    if (!this.session.painterUnlocked()) return '';
    const t = uiText.construction;
    const { state } = this.session;
    const c = content.construction;
    const s = state.construction;
    const busy = !!(s.job || s.quote);
    const coin = (n: number) => `${COIN}${n}`;
    let status = '';
    if (s.job) status = `<p class="m-hint m-busy">${esc(t.working.replace('{work}', workName(s.job)).replace('{day}', this.dayText(s.job.endDay!)))}</p>`;
    const facadeFinishes = Object.values(content.finishes).filter((f) => f.kind === 'facade');
    const card = (attrs: string, tile: string, name: string, price: string, disabled: boolean, has = false) =>
      `<div class="m-cell"><button class="m-card${has ? ' has' : ''}" ${attrs} ${disabled ? 'disabled' : ''}><span class="m-thumb">${tileThumbHtml(tile, THUMB)}</span><span class="m-name">${esc(name)}</span><span class="m-price">${price}</span></button></div>`;
    // Reparos.
    const repairs: string[] = [];
    if (!s.repaired.includes('inside')) {
      const r = c.repairs.inside;
      repairs.push(`<button class="m-row" data-repair="inside" ${busy || state.money < r.price ? 'disabled' : ''}><span class="m-name">${esc(r.name)}</span><span class="m-price">${coin(r.price)}</span><span class="m-note">${esc(t.insideNote + ' · ' + daysText(r.days))}</span></button>`);
    }
    if (!s.repaired.includes('outside')) {
      const r = c.repairs.outside;
      const cards = facadeFinishes.map((f) => card(`data-repair="outside" data-finish="${f.id}"`, f.tile, f.name, coin(r.price), busy || state.money < r.price)).join('');
      repairs.push(`<h4>${esc(r.name)}</h4><p class="m-hint">${esc(t.outsideNote + ' · ' + daysText(r.days))}</p><div class="m-grid">${cards}</div>`);
    }
    // Troca de acabamento (depois do reparo interno): cada superfície do café, os acabamentos que servem.
    const inside = s.repaired.includes('inside');
    const finishes = Object.values(content.finishes);
    const areas = (content.map.surfaces ?? [])
      .map((surface) => {
        const per = c.materialPerTile[surface.kind as 'floor' | 'wall' | 'wainscot'] ?? 0;
        const cards = finishes
          .filter((f) => f.kind === surface.kind)
          .map((f) => card(`data-surface="${surface.id}" data-finish="${f.id}"`, f.tile, f.name, `${coin(per + c.laborPerTile)}${esc(t.perTile)}`, busy || !inside))
          .join('');
        return `<h4>${esc(surface.name)}</h4><div class="m-grid">${cards}</div>`;
      })
      .join('');
    const facade = s.repaired.includes('outside')
      ? `<h4>${esc(t.facadeTitle)}</h4><div class="m-grid">${facadeFinishes
          .map((f) => {
            const current = state.finishes[content.facade?.surface.id ?? ''] === f.id;
            return card(`data-facade="${f.id}"`, f.tile, f.name, current ? uiText.current : coin(f.price), busy || current || state.money < f.price, current);
          })
          .join('')}</div>`
      : '';
    return `<h3>${esc(t.title)}</h3><p class="m-hint">${esc(t.hint)}</p>${status}${repairs.join('')}<h3>${esc(t.areaTitle)}</h3><p class="m-hint">${esc(inside ? t.areaHint : t.areaLocked)}</p>${areas}${facade}`;
  }

  /** Assistência técnica: escolher o móvel no café; com ele escolhido, as peças em que ele pode virar e o preço. */
  private upgradeHtml(): string {
    const t = uiText.upgrade;
    const fee = String(content.upgrades.fee);
    const pick = `<button class="m-row" data-upgrade-pick><span class="m-name">${esc(t.pick)}</span><span class="m-note">${esc(t.pickNote)}</span></button>`;
    const head = `<h3>${esc(t.title)}</h3><p class="m-hint">${esc(t.hint.replace('{fee}', fee))}</p>${pick}`;
    const target = this.session.state.placed.find((p) => p.uid === this.upgradeTarget);
    if (!target) return head;
    const options = this.session.upgradeOptions(target.uid);
    const current = content.items[target.item]!;
    const now = `<h4>${esc(t.current)}: ${esc(current.name)}</h4>`;
    if (options.length === 0) return `${head}${now}<p class="m-hint">${esc(t.none)}</p>`;
    const cards = options
      .map(({ itemId, cost }) => {
        const i = content.items[itemId]!;
        return `<div class="m-cell"><button class="m-card" data-upgrade-to="${itemId}" ${this.session.state.money < cost ? 'disabled' : ''}><span class="m-thumb">${itemThumbHtml(i, THUMB)}</span><span class="m-name">${esc(i.name)}</span><span class="m-price">${COIN}${cost}</span></button></div>`;
      })
      .join('');
    return `${head}${now}<div class="m-grid">${cards}</div>`;
  }

  /** "amanhã", "dia 14". */
  private dayText(day: number): string {
    return day === this.session.state.day + 1 ? uiText.construction.tomorrow : uiText.construction.dayN.replace('{n}', String(day));
  }
}
