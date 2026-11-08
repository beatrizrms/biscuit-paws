// Interface em HTML por cima do canvas: dinheiro, diário de metas, falas, catálogo e avisos.
// Só mostra o estado da sessão e repassa os cliques; as regras ficam no core.
import type { GameSession } from '../../core/session';
import { formatClock } from '../../core/time';
import { content, uiText } from '../content';
import { CutsceneView } from './CutsceneView';
import { NamingBox } from './NamingBox';
import { iconHtml, ShopPanel } from './ShopPanel';
import { NewsPanel } from './NewsPanel';
import { MenuBoardPanel } from './MenuBoardPanel';
import { BackpackPanel, handItemName } from './BackpackPanel';
import { ConsultPanel } from './ConsultPanel';
import { Hotbar } from './Hotbar';
import { fillNames } from './text';
import { services } from '../services';

type HintMode = 'walk' | 'placing' | 'dialogue';

const TYPE_SPEED_MS = 22;

export interface UiHandlers {
  /** A jogadora escolheu um item que já está na bolsa: começar a posicionar. */
  onPlace(itemId: string): void;
  /** "Esperar": o relógio corre depressa até o momento `until` (absoluto). */
  onWait(until: number): void;
}

export class GameUi {
  private money: HTMLElement;
  private goals: HTMLElement;
  private hint: HTMLElement;
  private toastEl: HTMLElement;
  private dialogueLayer: HTMLElement;
  private dialogueBox: HTMLElement;
  private catalog: HTMLElement;
  private catalogList: HTMLElement;

  private dialogueQueue: { speaker: string; text: string; npc?: string }[] = [];
  private reveal: { el: HTMLElement; done: () => void } | null = null;
  private typing: { full: string; shown: number; timer: number } | null = null;
  private toastTimer = 0;
  private hintMode: HintMode = 'walk';
  private cutscene!: CutsceneView;
  private naming!: NamingBox;
  private shop!: ShopPanel;
  private news!: NewsPanel;
  private menuBoard!: MenuBoardPanel;
  private backpack!: BackpackPanel;
  private consult!: ConsultPanel;
  /** Tecla 1 a 8 com a mochila aberta e um item selecionado: põe ele naquele espaço da barra. */
  backpackNumberKey(n: number): boolean {
    return this.backpack.numberKey(n);
  }
  private hotbar!: Hotbar;
  /** Caixas que já chegaram mas a entregadora ainda está trazendo (a cena avisa). */
  private parcelsOnTheWay = 0;
  /** Cenas pedidas enquanto uma fala estava aberta: tocam quando a fala acabar. */
  private pendingCutscenes: string[] = [];
  /** Mudanças no HUD esperam a fala acabar (o dinheiro não sobe antes da fala que o explica). */
  private hudPending = false;
  /** Meta mostrada agora (para animar o pensamento quando ela muda). */
  private shownGoal: string | undefined;

  constructor(
    private root: HTMLElement,
    private session: GameSession,
    private handlers: UiHandlers,
    private debug = false,
  ) {
    root.innerHTML = `
      <div class="panel hud-goals"></div>
      <div class="panel hud-money"><span class="day"></span><span class="clock"></span><span class="coin"></span><span class="amount"></span></div>
      <div class="panel hud-cart" hidden></div>
      <div class="hint"></div>
      <div class="toast" role="status"></div>
      <section class="panel catalog" aria-label="${uiText.catalogTitle}">
        <header><h2>${uiText.catalogTitle}</h2><button class="close" title="Fechar (C)">fechar</button></header>
        <p class="online">${uiText.catalogOnline}</p>
        <div class="list"></div>
      </section>
      <div class="dialogue-layer">
        <div class="panel dialogue"><img class="portrait" alt="" /><span class="speaker"></span><span class="text"></span><span class="more">▼</span></div>
      </div>`;
    const $ = (sel: string) => root.querySelector(sel) as HTMLElement;
    this.money = $('.hud-money');
    // Carrinho no HUD: aparece enquanto tem algo nele (mesmo fora do mercado, para lembrar de pagar).
    const cartEl = $('.hud-cart');
    session.bus.on('cart.changed', ({ count, total }) => {
      cartEl.hidden = count === 0;
      cartEl.innerHTML = `<img src="assets/ui/hud/${count > 0 ? 'icon_cart_full' : 'icon_cart_empty'}.png" alt="${uiText.shop.cartTitle}" /><span>${count} · ${total}</span>`;
    });
    this.goals = $('.hud-goals');
    this.hint = $('.hint');
    this.toastEl = $('.toast');
    this.dialogueLayer = $('.dialogue-layer');
    this.dialogueBox = $('.dialogue');
    this.catalog = $('.catalog');
    this.catalogList = $('.catalog .list');

    $('.catalog .close').addEventListener('click', () => this.closeCatalog());
    this.dialogueLayer.addEventListener('click', () => this.advanceDialogue());
    window.addEventListener('keydown', (e) => {
      if (!this.dialogueLayer.classList.contains('open')) return; // só a caixa de fala (a cena tem a dela)
      if (e.code === 'Space' || e.code === 'Enter') {
        e.preventDefault();
        this.advanceDialogue();
      }
    });

    // Quando a cena ou a caixa de nome fecham, as falas que esperavam aparecem.
    const afterOverlay = () => {
      this.refresh();
      this.openDialogueIfFree();
    };
    this.cutscene = new CutsceneView(root, session, afterOverlay);
    this.cutscene.onSound = (id) => services().audio.jingle(id);
    this.naming = new NamingBox(root, session, afterOverlay, (reason) => this.problem(reason));
    this.shop = new ShopPanel(root, session, () => this.refresh(), () => this.toast(uiText.shop.paid), (reason) => this.problem(reason as keyof typeof uiText.problems));
    const problem = (reason: string) => this.problem(reason as keyof typeof uiText.problems);
    this.menuBoard = new MenuBoardPanel(root, session, () => this.refresh(), problem);
    this.backpack = new BackpackPanel(root, session, () => this.refresh(), problem, (id) => this.handlers.onPlace(id));
    this.hotbar = new Hotbar(root, session);
    this.consult = new ConsultPanel(root, session, () => this.refresh(), (reason) => this.problem(reason as keyof typeof uiText.problems), (text) => this.toast(text, 3500));
    this.news = new NewsPanel(root, session, () => this.refresh(), (title) => this.toast(`${uiText.news.accepted}: ${title}`), (reason) => this.problem(reason as keyof typeof uiText.problems));

    const bus = session.bus;
    bus.on('cutscene.requested', ({ cutsceneId }) => {
      if (this.dialogueLayer.classList.contains('open') || this.dialogueQueue.length > 0) this.pendingCutscenes.push(cutsceneId);
      else this.cutscene.request(cutsceneId);
    });
    bus.on('cat.affection_changed', ({ catId, to }) => {
      if (to > 0) this.toast(`${this.session.catName(catId)} ${'♥'.repeat(Math.min(to, 5))}`);
    });
    bus.on('dialogue.requested', ({ dialogueId }) => this.queueDialogue(dialogueId));
    const s = uiText.service;
    const recipeName = (id: string) => content.recipes[id]?.name ?? '';
    bus.on('prep.started', ({ recipeId }) => this.toast(s.prepStarted.replace('{name}', recipeName(recipeId))));
    bus.on('prep.ready', ({ recipeId, final }) => {
      if (final) return this.toast(s.prepReady.replace('{name}', recipeName(recipeId)));
      const wip = this.session.state.surfaces.find((x) => x.item.kind === 'wip' && x.item.recipe === recipeId)?.item;
      const eq = wip?.kind === 'wip' ? content.recipes[recipeId]?.steps[wip.step]?.equipment : undefined;
      this.toast(s.wipReady.replace('{equipment}', (eq && content.service.equipment[eq]?.name) || ''));
    });
    bus.on('sink.changed', ({ load }) => this.toast(load > 0 ? s.sinkLoaded.replace('{n}', String(load)) : s.washing));
    bus.on('heavy.stored', ({ itemId }) => {
      const to = content.items[itemId]?.storesAs;
      this.toast(s.stored.replace('{name}', content.items[to?.item ?? itemId]?.name ?? '').replace('{qty}', String(to?.qty ?? 1)));
    });
    bus.on('customer.served', ({ recipeId, price, tip, quality }) => {
      const name = recipeName(recipeId) + (quality === 'premium' ? ` ${s.premium}` : '');
      this.toast((tip > 0 ? s.servedTip : s.served).replace('{price}', String(price)).replace('{name}', name).replace('{tip}', String(tip)));
    });
    bus.on('customer.left', ({ happy }) => !happy && this.toast(s.left));
    bus.on('dish.washed', () => this.toast(s.washed));
    bus.on('delivery.picked_up', () => this.toast(uiText.delivery.pickedUp));
    // O café evoluiu: receita nova no caderno (o equipamento e os ingredientes já estão à venda).
    bus.on('recipe.unlocked', ({ recipeId }) => this.toast(uiText.recipeUnlocked.replace('{name}', content.recipes[recipeId]?.name ?? ''), 4000));
    // Saúde: um gato adoeceu à toa (a doença do dia 6 já tem fala), sarou, e o fiado sendo pago.
    bus.on('cat.sick', ({ catId, disease }) => {
      if (!session.state.story.completed.includes('story.cat_falls_ill') || session.state.story.completed.includes('story.vet_visit'))
        this.toast((session.state.flags[content.health.randomIllness.requiresFlag] ? uiText.health.sick : uiText.health.sickNoClinic).replace('{name}', session.catName(catId)).replace('{disease}', content.health.diseases.find((d) => d.id === disease)?.name ?? ''), 4000);
    });
    bus.on('cat.medicated', ({ catId, dosesGiven, days }) => {
      if (dosesGiven < days) this.toast(uiText.health.dose.replace('{name}', session.catName(catId)).replace('{n}', String(dosesGiven)).replace('{days}', String(days)));
    });
    bus.on('cat.infected', ({ catId, fromCatId, disease }) =>
      this.toast(uiText.health.infected.replace('{name}', session.catName(catId)).replace('{from}', session.catName(fromCatId)).replace('{disease}', content.health.diseases.find((d) => d.id === disease)?.name ?? ''), 4500),
    );
    bus.on('customers.away', ({ sickCats }) => this.toast(uiText.health.customersAway.replace('{n}', String(sickCats)), 5000));
    bus.on('cat.cured', ({ catId }) => this.toast(uiText.health.cured.replace('{name}', session.catName(catId)), 3500));
    bus.on('debt.paid', ({ amount, left }) => this.toast((left > 0 ? uiText.health.debtPaid : uiText.health.debtDone).replace('{amount}', String(amount)).replace('{left}', String(left)), 3000));
    bus.on('delivery.unpacked', ({ itemId }) => this.toast(uiText.delivery.unpacked.replace('{item}', content.items[itemId]?.name ?? '')));
    bus.on('job.completed', ({ jobId, reward }) => this.toast(`${uiText.news.done}: ${content.jobs[jobId]?.title ?? ''} (+${reward})`));
    bus.on('money.changed', () => this.refresh(true));
    bus.onAny(() => this.refresh());
    this.refresh();
  }

  /** Falas ou catálogo abertos: a personagem não anda. */
  isBusy(): boolean {
    return this.isDialogueOpen() || this.isCatalogOpen() || this.cutscene.isOpen() || this.naming.isOpen() || this.shop.isOpen() || this.news.isOpen() || this.menuBoard.isOpen() || this.backpack.isOpen() || this.consult.isOpen() || this.reveal !== null || this.paused;
  }

  /** Menu de pausa aberto (o mundo para e o relógio também). */
  paused = false;

  /** O relógio para só em falas, cenas, caixa de nome e transições (menus não param o tempo). */
  pausesClock(): boolean {
    return this.isDialogueOpen() || this.cutscene.isOpen() || this.naming.isOpen() || this.reveal !== null || this.paused;
  }

  isDialogueOpen(): boolean {
    return this.dialogueLayer.classList.contains('open') || this.cutscene?.isOpen() === true || this.naming?.isOpen() === true;
  }

  isCatalogOpen(): boolean {
    return this.catalog.classList.contains('open');
  }

  toggleCatalog(): void {
    if (this.isCatalogOpen()) this.closeCatalog();
    else if (!this.isDialogueOpen()) {
      this.renderCatalog();
      this.catalog.classList.add('open');
    }
  }

  closeCatalog(): void {
    this.catalog.classList.remove('open');
  }

  setHint(mode: HintMode): void {
    this.hintMode = mode;
    this.renderHint();
  }

  toast(text: string, ms = 1600): void {
    this.toastEl.textContent = text;
    this.toastEl.classList.add('show');
    window.clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => this.toastEl.classList.remove('show'), ms);
  }

  /** Aviso com um texto de data/ui_text.json. */
  toastText(key: 'notHome'): void {
    this.toast(uiText[key]);
  }

  problem(reason: keyof typeof uiText.problems): void {
    services().audio.sfx('error');
    this.toast(uiText.problems[reason] ?? reason);
  }

  private waitButton(until: number): string {
    return `<button class="wait" data-until="${until}" title="${uiText.waitTitle}">${uiText.wait}</button>`;
  }

  /** Hora de um momento absoluto, dizendo se é amanhã. */
  private clockOf(at: number): { time: string; tomorrow: boolean } {
    const t = at - this.session.state.day * 1440;
    return { time: formatClock(t >= 1440 ? t - 1440 : t, 5), tomorrow: t >= 1440 };
  }

  /** Rotina do dia, pedido em andamento e entregas, embaixo da meta no balão. */
  private extrasHtml(): string {
    const c = uiText.chores;
    const items = this.session.chores().map((ch) => {
      // Gatos doentes demais: o aviso do café vazio (sem contador).
      if (ch.kind === 'sick') return `<li class="warn"><span>${esc(c.sick)}</span></li>`;
      const text = ch.kind === 'feed' ? c.feed.replace('{cat}', this.session.catName(ch.catId!)) : c.sweep;
      const count = ch.progress && !ch.done ? ` <span class="count">${ch.progress[0]}/${ch.progress[1]}</span>` : '';
      return `<li class="${ch.done ? 'done' : ''}"><span>${esc(text)}${count}</span></li>`;
    });
    for (const job of this.session.activeJobs()) {
      const step = job.steps[this.session.jobStep(job.id)];
      const [done, total] = this.session.jobStepProgress(job.id);
      const count = total > 1 ? ` <span class="count">${done}/${total}</span>` : '';
      items.push(`<li class="job"><span><b>${c.job}:</b> ${esc(step?.text ?? job.title)}${count}</span></li>`);
    }
    const sv = this.session.service;
    if (sv.isOpen()) {
      items.push(`<li class="job"><span>${uiText.service.open.replace('{n}', String(this.session.state.service.customers.length)).replace('{cap}', String(sv.capacity()))}</span></li>`);
    }
    if (this.session.state.tray) items.push(`<li class="job"><span>${uiText.service.tray.replace('{n}', String(this.session.state.hands.length)).replace('{max}', String(sv.handsCapacity()))}</span></li>`);
    for (const h of this.session.state.hands) items.push(`<li class="job"><span>${esc(uiText.service.hands.replace('{name}', handItemName(h, (id) => this.session.catName(id))))}</span></li>`);
    if (this.session.state.sink.washing) items.push(`<li class="job"><span>${uiText.service.sinkWashing}</span></li>`);
    else if (sv.sinkLoad() > 0) items.push(`<li class="job"><span>${uiText.service.sinkLoad.replace('{n}', String(sv.sinkLoad()))}</span></li>`);
    const d = uiText.delivery;
    const next = this.session.nextArrival();
    if (next !== undefined) {
      const { time, tomorrow } = this.clockOf(next);
      items.push(`<li class="job"><span>${(tomorrow ? d.shippingTomorrow : d.shipping).replace('{time}', time)}${this.waitButton(next)}</span></li>`);
    }
    const n = (stage: 'door' | 'carried' | 'inside') => this.session.deliveriesAt(stage);
    const atDoor = n('door') - this.parcelsOnTheWay;
    if (atDoor > 0) items.push(`<li class="job"><span>${d.atDoor.replace('{n}', String(atDoor))}</span></li>`);
    if (n('carried')) items.push(`<li class="job"><span>${d.carried.replace('{n}', String(n('carried')))}</span></li>`);
    if (n('inside')) items.push(`<li class="job"><span>${d.inside.replace('{n}', String(n('inside')))}</span></li>`);
    return items.length ? `<h4>${c.title}</h4><ul class="chores">${items.join('')}</ul>` : '';
  }

  /** Mostra um item grande no centro da tela (ex.: a chave). Resolve quando a jogadora continuar. */
  showItem(itemId: string): Promise<void> {
    const item = content.items[itemId];
    const el = document.createElement('div');
    el.className = 'item-reveal';
    const img = item?.iconImage ? `<img src="${item.iconImage}" alt="" />` : iconHtml(item?.icon, 64);
    el.innerHTML = `<div class="rays"></div><div class="item-card">${img}<strong>${item?.name ?? ''}</strong></div><div class="hint">${uiText.itemReveal.continue}</div>`;
    this.root.appendChild(el);
    requestAnimationFrame(() => el.classList.add('open'));
    return new Promise((resolve) => {
      const done = () => {
        if (!this.reveal) return;
        this.reveal = null;
        window.removeEventListener('keydown', onKey);
        el.remove();
        this.refresh();
        resolve();
      };
      const onKey = (e: KeyboardEvent) => {
        if (e.code === 'Space' || e.code === 'Enter') {
          e.preventDefault();
          done();
        }
      };
      // Pequena espera: o mesmo Espaço que fechou a fala anterior não fecha a chave na hora.
      window.setTimeout(() => window.addEventListener('keydown', onKey), 250);
      el.addEventListener('click', done);
      this.reveal = { el, done };
    });
  }

  /**
   * O balão de pensamento e o painel do dinheiro ficam quase transparentes quando algum
   * destes pontos (em coordenadas da janela: mouse, personagem) está embaixo deles.
   */
  updateHudFade(points: readonly { x: number; y: number }[], feet: { x: number; y: number }): void {
    for (const el of [this.goals, this.money]) {
      const r = el.getBoundingClientRect();
      const under = points.some((p) => p.x >= r.left - 4 && p.x <= r.right + 4 && p.y >= r.top - 4 && p.y <= r.bottom + 12);
      el.classList.toggle('see-through', under);
    }
    const root = this.root.getBoundingClientRect();
    this.hotbar.followPlayer(((feet.y - root.top) / root.height) * 360);
  }

  /** Hora no HUD (só mexe no texto quando muda). */
  setClock(text: string): void {
    const el = this.money.querySelector('.clock') as HTMLElement;
    if (el.textContent !== text) el.textContent = text;
  }

  /** Fim do dia: "Você foi para casa." e o dia seguinte. Resolve sozinho ou com clique/tecla. */
  showDayTransition(day: number, summary?: { reason: 'home' | 'passOut' | 'story' | 'sleep'; earned: number; jobs: number }): Promise<void> {
    const el = document.createElement('div');
    el.className = 'day-transition';
    const t = uiText.dayTransition;
    const hearts = this.session
      .shelteredCats()
      .map((id) => `<li>${esc(this.session.catName(id))} <span class="hearts">${'♥'.repeat(this.session.catHearts(id)) || '♡'}</span></li>`)
      .join('');
    const report = summary && summary.reason !== 'story'
      ? `<ul class="summary"><li>${t.earned}: <b>${summary.earned}</b></li><li>${t.jobs}: <b>${summary.jobs}</b></li>${hearts}</ul>`
      : '';
    el.innerHTML = `<p class="home">${t[summary?.reason ?? 'home']}</p>${report}<p class="next">${uiText.day} ${day}</p>`;
    this.root.appendChild(el);
    requestAnimationFrame(() => el.classList.add('open'));
    this.reveal = { el, done: () => undefined };
    return new Promise((resolve) => {
      let finished = false;
      const done = () => {
        if (finished) return;
        finished = true;
        window.removeEventListener('keydown', done);
        el.classList.remove('open');
        window.setTimeout(() => {
          el.remove();
          this.reveal = null;
          this.refresh();
          resolve();
        }, 400);
      };
      window.setTimeout(() => window.addEventListener('keydown', done), 400);
      el.addEventListener('click', done);
      window.setTimeout(done, summary && summary.reason !== 'story' ? 4500 : 2600);
    });
  }

  /** Caixa do mercado: paga o carrinho. */
  openShop(shopId: string): void {
    this.closeCatalog();
    this.shop.openCheckout(shopId);
  }

  /** Prateleira: põe itens no carrinho. */
  openShelf(shopId: string, tags: string[]): void {
    this.closeCatalog();
    this.shop.openShelf(shopId, tags);
  }

  closeShop(): void {
    this.shop.close();
    this.news.close();
    this.menuBoard.close();
    this.backpack.close();
    this.consult.close();
  }

  /** Quadro do cardápio (M) e mochila (I): abre um, fecha os outros. */
  openMenuBoard(): void {
    this.closeCatalog();
    this.closeShop();
    this.menuBoard.show();
  }

  openBackpack(): void {
    this.closeCatalog();
    this.closeShop();
    this.backpack.show();
  }

  isPanelOpen(): boolean {
    return this.shop.isOpen() || this.news.isOpen() || this.menuBoard.isOpen() || this.backpack.isOpen() || this.consult.isOpen();
  }

  /** A entregadora ainda está trazendo estas caixas (o balão só conta as que já estão na porta). */
  setParcelsOnTheWay(n: number): void {
    if (n === this.parcelsOnTheWay) return;
    this.parcelsOnTheWay = n;
    this.refresh();
  }

  /** Celular ("Vila Hoje") ou mural do mercado. */
  /** Clínica: a ficha da consulta do gato que está no colo. */
  openConsult(): void {
    this.closeCatalog();
    this.closeShop();
    this.consult.open();
  }

  openNews(mode: 'phone' | 'board'): void {
    this.closeCatalog();
    this.shop.close();
    this.news.open(mode);
  }

  isNewsOpen(): boolean {
    return this.news.isOpen();
  }

  /** Pergunta sim/não (ex.: encerrar o dia). Enter = sim, Esc = não. */
  confirm(question: string, yes: string, no: string): Promise<boolean> {
    const el = document.createElement('div');
    el.className = 'confirm-layer';
    el.innerHTML = `<div class="panel confirm"><p>${esc(question)}</p><div class="buttons"><button class="no">${esc(no)}</button><button class="yes">${esc(yes)}</button></div></div>`;
    this.root.appendChild(el);
    this.reveal = { el, done: () => undefined };
    this.refresh();
    return new Promise((resolve) => {
      const finish = (answer: boolean) => {
        window.removeEventListener('keydown', onKey);
        el.remove();
        this.reveal = null;
        this.refresh();
        resolve(answer);
      };
      const onKey = (e: KeyboardEvent) => {
        if (e.code === 'Enter') finish(true);
        else if (e.code === 'Escape') finish(false);
      };
      window.setTimeout(() => window.addEventListener('keydown', onKey), 150);
      (el.querySelector('.yes') as HTMLElement).addEventListener('click', () => finish(true));
      (el.querySelector('.no') as HTMLElement).addEventListener('click', () => finish(false));
    });
  }

  isShopOpen(): boolean {
    return this.shop.isOpen();
  }

  /** Para testes e debug: confirma a caixa de nome com o nome sugerido. */
  confirmNaming(): void {
    this.naming.confirm();
  }

  /** Modo debug: fecha todas as falas de uma vez. */
  skipDialogue(): void {
    this.cutscene.skipAll();
    this.dialogueQueue = [];
    if (this.typing) window.clearInterval(this.typing.timer);
    this.typing = null;
    if (this.isDialogueOpen()) this.closeDialogue();
  }

  private refresh(bumpMoney = false): void {
    if (this.isDialogueOpen()) {
      this.hudPending = true;
      return;
    }
    const { state } = this.session;
    (this.money.querySelector('.amount') as HTMLElement).textContent = `${state.money} ${content.economy.currency}`;
    const sd = this.session.seasonDay();
    (this.money.querySelector('.day') as HTMLElement).textContent = uiText.seasonDay.replace('{season}', sd.name).replace('{day}', String(sd.day));
    if (bumpMoney) {
      this.money.classList.remove('bump');
      void this.money.offsetWidth; // reinicia a animação
      this.money.classList.add('bump');
    }

    const goal = this.session.goals()[0];
    const fill = (text: string) => this.fillNames(text);
    if (goal?.beatId !== this.shownGoal) {
      this.shownGoal = goal?.beatId;
      this.goals.classList.remove("new");
      void this.goals.offsetWidth; // reinicia a animação
      this.goals.classList.add("new");
    }
    const extra = this.extrasHtml();
    this.goals.classList.toggle('empty', !goal && !extra);
    this.goals.innerHTML = (goal
      ? `<h2>${uiText.goalsTitle}</h2><h3>${esc(fill(goal.title))}</h3><ul>${goal.steps
          .map((s) => {
            const note = this.debug && s.devNote ? `<span class="dev">${esc(s.devNote)}</span>` : '';
            const count = s.progress && !s.done ? ` <span class="count">${s.progress[0]}/${s.progress[1]}</span>` : '';
            const wait = s.waitUntil !== undefined && !s.done ? this.waitButton(s.waitUntil) : '';
            return `<li class="${s.done ? 'done' : ''}"><span>${esc(fill(s.text))}${count}${note}${wait}</span></li>`;
          })
          .join('')}</ul>`
      : extra ? `<h2>${uiText.goalsTitle}</h2>` : '') + extra;

    this.goals.querySelectorAll<HTMLButtonElement>('.wait').forEach((b) => b.addEventListener('click', () => this.handlers.onWait(Number(b.dataset.until))));
    if (this.isCatalogOpen()) this.renderCatalog();
    this.renderHint();
  }

  private renderHint(): void {
    const mode = this.isDialogueOpen() ? 'dialogue' : this.hintMode;
    this.hint.textContent = mode === 'dialogue' ? uiText.hintDialogue : mode === 'placing' ? uiText.hintPlacing : uiText.hintWalk;
  }

  private renderCatalog(): void {
    const { state } = this.session;
    const items = Object.values(content.items).filter((i) => !i.deprecated);
    this.catalogList.innerHTML = uiText.catalogSections
      .map((section) => {
        const rows = items
          .filter((i) => this.session.itemUnlocked(i.id))
          .filter((i) => i.tags.includes(section.tag))
          .filter((i) => uiText.catalogSections.find((s) => i.tags.includes(s.tag)) === section) // cada item numa seção só
          .map((i) => {
            const owned = state.inventory[i.id] ?? 0;
            const fixture = i.kind === 'fixture';
            const coming = state.deliveries.filter((d) => d.item === i.id).length;
            const disabled = (owned === 0 && state.money < i.price) || (fixture && (owned > 0 || coming > 0));
            const refund =
              owned > 0 && !fixture
                ? `<button class="refund" data-refund="${i.id}" title="${uiText.refund}">${uiText.refund} +${this.session.refundValue(i.id)}</button>`
                : '';
            return `<div class="item-row"><button class="row" data-item="${i.id}" ${disabled ? 'disabled' : ''}>
              <span>${esc(i.name)}</span><span class="price">${i.price}</span>
              ${owned > 0 ? `<span class="owned">${fixture ? uiText.installed : `${owned} ${uiText.inBag}`}</span>` : ''}
              ${coming > 0 ? `<span class="owned coming">${coming} ${uiText.delivery.onTheWay}</span>` : ''}
            </button>${refund}</div>`;
          })
          .join('');
        return rows ? `<h3>${esc(section.title)}</h3>${rows}` : '';
      })
      .join('') + this.renderRooms() + this.renderRenovation();
    this.catalogList.querySelectorAll<HTMLButtonElement>('.row[data-item]').forEach((btn) =>
      btn.addEventListener('click', () => this.pick(btn.dataset.item!)),
    );
    this.catalogList.querySelectorAll<HTMLButtonElement>('.refund[data-refund]').forEach((btn) =>
      btn.addEventListener('click', () => {
        const result = this.session.refund(btn.dataset.refund!);
        if (!result.ok) return this.problem(result.reason);
        this.toast(uiText.refunded);
      }),
    );
    this.catalogList.querySelectorAll<HTMLButtonElement>('.row[data-room]').forEach((btn) =>
      btn.addEventListener('click', () => {
        const id = btn.dataset.room!;
        const result = btn.dataset.work === 'open' ? this.session.openRoom(id) : this.session.restoreRoom(id);
        if (!result.ok) return this.problem(result.reason);
        this.closeCatalog();
      }),
    );
    this.catalogList.querySelectorAll<HTMLButtonElement>('.row[data-finish]').forEach((btn) =>
      btn.addEventListener('click', () => this.paint(btn.dataset.surface!, btn.dataset.finish!)),
    );
  }

  /** Obras dos cômodos (data/rooms.json): abrir os descobertos e terminar a reforma dos abertos. E quantos gatos cabem. */
  private renderRooms(): string {
    const r = uiText.rooms;
    const why: Record<string, string> = { needs_money: r.needsMoney, needs_beat: r.needsBeat, needs_cats: r.needsCats, needs_item: r.needsItem };
    const rows = this.session
      .rooms()
      .map((room) => {
        const s = this.session.roomState(room.id);
        if (s === 'discovered' && (room.unlock?.cost ?? 0) > 0) {
          const p = this.session.openRoomProblem(room.id);
          return `<button class="row" data-room="${room.id}" data-work="open" ${p ? 'disabled' : ''}>
            <span>${esc(room.unlock?.label ?? room.name)}</span><span class="price">${room.unlock?.cost}</span>
            ${p ? `<span class="owned">${esc(why[p] ?? '')}</span>` : ''}</button>`;
        }
        if (s === 'abandoned' && room.restore && !room.restore.when) {
          const p = this.session.restoreRoomProblem(room.id);
          const note = p === 'still_dirty' ? r.stillDirty.replace('{n}', String(this.session.roomDirtLeft(room.id))) : p === 'needs_money' ? r.needsMoney : '';
          return `<button class="row" data-room="${room.id}" data-work="restore" ${p ? 'disabled' : ''}>
            <span>${esc(room.restore.label ?? room.name)}</span><span class="price">${room.restore.cost ?? 0}</span>
            ${note ? `<span class="owned">${esc(note)}</span>` : ''}</button>`;
        }
        return '';
      })
      .join('');
    const cats = `<p class="note">${esc(r.cats.replace('{n}', String(this.session.shelteredCats().length)).replace('{max}', String(this.session.catCapacity())))}</p>`;
    return rows ? `<h3>${esc(r.title)}</h3><p class="note">${esc(r.hint)}</p>${rows}${cats}` : cats;
  }

  /** Seção do pintor: para cada superfície, os acabamentos que servem nela. */
  private renderRenovation(): string {
    if (!this.session.painterUnlocked()) return '';
    const { state } = this.session;
    const finishes = Object.values(content.finishes);
    const blocks = this.session
      .surfaces()
      .map((surface) => {
        const rows = finishes
          .filter((f) => f.kind === surface.kind)
          .map((f) => {
            const current = state.finishes[surface.id] === f.id;
            const disabled = current || state.money < f.price;
            return `<button class="row" data-surface="${surface.id}" data-finish="${f.id}" ${disabled ? 'disabled' : ''}>
              <span>${esc(f.name)}</span><span class="price">${current ? uiText.current : f.price}</span>
            </button>`;
          })
          .join('');
        return `<h4>${esc(surface.name)}</h4>${rows}`;
      })
      .join('');
    return blocks ? `<h3>${esc(uiText.renovationTitle)}</h3><p class="note">${esc(uiText.renovationHint)}</p>${blocks}` : '';
  }

  private paint(surfaceId: string, finishId: string): void {
    const result = this.session.paint(surfaceId, finishId);
    if (!result.ok) return this.problem(result.reason);
    this.closeCatalog();
    this.toast(uiText.painted);
  }

  /** Item da bolsa: posiciona. Senão: compra e posiciona. */
  private pick(itemId: string): void {
    // Já na bolsa (caixa aberta): posicionar. Senão, encomendar: chega pelo correio.
    if ((this.session.state.inventory[itemId] ?? 0) > 0 && content.items[itemId]?.kind !== 'fixture') {
      this.closeCatalog();
      this.handlers.onPlace(itemId);
      return;
    }
    const result = this.session.order(itemId);
    if (!result.ok) return this.problem(result.reason);
    const last = this.session.state.deliveries[this.session.state.deliveries.length - 1]!;
    const { time, tomorrow } = this.clockOf(last.arrivesAt);
    this.toast((tomorrow ? uiText.delivery.orderedTomorrow : uiText.delivery.ordered).replace('{time}', time));
    this.renderCatalog();
  }

  private queueDialogue(dialogueId: string): void {
    const lines = content.dialogue.dialogues[dialogueId]?.lines ?? [];
    this.dialogueQueue.push(...lines.map((l) => ({ speaker: this.fillNames(l.speaker), text: this.fillNames(l.text), npc: l.npc })));
    this.openDialogueIfFree();
  }

  /** Abre a caixa de fala se houver fala na fila e nada na frente (cena, caixa de nome). */
  /** {player}, {cat:cat.id} e {timer:id} nos textos (ui/text.ts). */
  private fillNames(text: string): string {
    return fillNames(this.session, text);
  }

  private openDialogueIfFree(): void {
    if (this.dialogueQueue.length === 0 || this.dialogueLayer.classList.contains('open')) return;
    if (this.cutscene?.isOpen() || this.naming?.isOpen()) return; // abre quando elas fecharem
    this.closeCatalog();
    this.dialogueLayer.classList.add('open');
    this.advanceDialogue();
  }

  /** Mostra a próxima fala; se a atual ainda está sendo escrita, completa. */
  private advanceDialogue(): void {
    const textEl = this.dialogueBox.querySelector('.text') as HTMLElement;
    if (this.typing) {
      window.clearInterval(this.typing.timer);
      textEl.textContent = this.typing.full;
      this.typing = null;
      return;
    }
    const line = this.dialogueQueue.shift();
    if (!line) return this.closeDialogue();
    (this.dialogueBox.querySelector('.speaker') as HTMLElement).textContent = line.speaker;
    const portrait = this.dialogueBox.querySelector('.portrait') as HTMLImageElement;
    const npcPortrait = line.npc ? content.npcs[line.npc]?.portrait : undefined;
    this.dialogueBox.classList.toggle('with-portrait', !!npcPortrait);
    if (npcPortrait) portrait.src = npcPortrait;
    this.dialogueBox.classList.toggle('narrator', line.speaker === uiText.narrator);
    textEl.textContent = '';
    const typing = { full: line.text, shown: 0, timer: 0 };
    typing.timer = window.setInterval(() => {
      typing.shown++;
      textEl.textContent = typing.full.slice(0, typing.shown);
      if (typing.shown >= typing.full.length) {
        window.clearInterval(typing.timer);
        this.typing = null;
      }
    }, TYPE_SPEED_MS);
    this.typing = typing;
    this.renderHint();
  }

  private closeDialogue(): void {
    this.dialogueLayer.classList.remove('open');
    // Cenas que esperavam esta fala acabar.
    for (const id of this.pendingCutscenes.splice(0)) this.cutscene.request(id);
    if (this.hudPending) {
      this.hudPending = false;
      this.refresh(true);
    }
    this.renderHint();
  }
}

function esc(text: string): string {
  return text.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
}
