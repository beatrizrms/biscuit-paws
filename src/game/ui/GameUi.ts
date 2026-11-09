// Interface em HTML por cima do canvas: dinheiro, diário de metas, falas, catálogo e avisos.
// Só mostra o estado da sessão e repassa os cliques; as regras ficam no core.
import type { GameSession } from '../../core/session';
import { dayInSeason, seasonOf } from '../../core/calendar';
import { formatClock } from '../../core/time';
import { content, uiText } from '../content';
import { CutsceneView } from './CutsceneView';
import { NamingBox } from './NamingBox';
import { iconHtml, ShopPanel } from './ShopPanel';
import { NewsPanel } from './NewsPanel';
import { openingText } from './ScheduleApp';
import { MenuBoardPanel } from './MenuBoardPanel';
import { BackpackPanel, handItemName } from './BackpackPanel';
import { ConsultPanel } from './ConsultPanel';
import { Hotbar } from './Hotbar';
import { fillNames } from './text';
import { services } from '../services';

type HintMode = 'walk' | 'placing' | 'moving' | 'dialogue';

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
      <div class="panel hud-rep"><span class="label">${uiText.reputation.label}</span><span class="bar"><span class="fill"></span></span><span class="value"></span></div>
      <div class="hint"></div>
      <div class="toast" role="status"></div>
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
    // O balão fica recolhido (só o título da meta): um clique abre os detalhes, outro recolhe.
    this.goals.addEventListener('click', (e) => {
      if ((e.target as HTMLElement).closest('.wait')) return;
      this.goals.classList.toggle('open');
    });
    this.hint = $('.hint');
    this.toastEl = $('.toast');
    this.dialogueLayer = $('.dialogue-layer');
    this.dialogueBox = $('.dialogue');
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
    this.news = new NewsPanel(root, session, () => this.refresh(), (title) => this.toast(`${uiText.news.accepted}: ${title}`), (reason) => this.problem(reason as keyof typeof uiText.problems), {
      toast: (text) => this.toast(text),
      problem,
      place: (id) => {
        this.news.close();
        this.handlers.onPlace(id);
      },
      done: (text) => {
        this.news.close();
        if (text) this.toast(text);
      },
      ordered: (arrivesAt) => {
        const { time, tomorrow } = this.clockOf(arrivesAt);
        this.toast((tomorrow ? uiText.delivery.orderedTomorrow : uiText.delivery.ordered).replace('{time}', time));
      },
    });

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
    // Chegada de gatos: a pista, a pergunta (sim/não) e onde o gato foi parar.
    const at = uiText.arrivals;
    bus.on('arrival.started', ({ arrivalId }) => {
      const clue = this.session.arrivals.def(arrivalId)?.clue ?? 'none';
      const text = at.clue[clue];
      if (text) this.toast(this.fillNames(text), 4500);
    });
    bus.on('arrival.choice', ({ key }) => {
      const c = at.choices[key as keyof typeof at.choices];
      if (!c) return this.session.answerArrival(true);
      // A pergunta espera a fala da chegada (a do vizinho, por exemplo) acabar.
      void this.afterDialogue()
        .then(() => this.confirm(this.fillNames(c.question), c.yes, c.no))
        .then((yes) => this.session.answerArrival(yes));
    });
    // Dicas dos vizinhos: ela escolhe quem ouvir (a escolha muda a dificuldade e dá corações a quem ajudou).
    bus.on('arrival.ask', ({ options }) => {
      const list = options.map((o) =>
        at.ask.option.replace('{npc}', content.npcs[o.npc]?.name ?? '').replace('{tip}', at.tips[o.tip as keyof typeof at.tips] ?? ''),
      );
      void this.afterDialogue()
        .then(() => this.choose(at.ask.question, list))
        .then((i) => this.session.answerArrivalAsk(i));
    });
    bus.on('arrival.needs', () => this.toast(at.needsStart, 3500));
    bus.on('arrival.need_met', ({ need }) => this.toast(at.needMet[need], 3500));
    bus.on('arrival.fed', ({ fed, times }) => this.toast(fed >= times ? at.fedLast : at.fed, 4000));
    bus.on('arrival.finished', ({ outcome, placement }) => {
      const text = outcome !== 'accepted' ? at.finished.declined : placement ? at.finished[placement] : '';
      if (text) this.toast(text.replace('{days}', String(content.arrivals.provisional.days)), 4500);
    });
    bus.on('arrival.provisional_settled', () => this.toast(at.settled, 4000));
    bus.on('arrival.provisional_expired', () => this.toast(at.expired, 4500));
    const ft = uiText.festival;
    const festName = (id: string) => content.festivals.find((f) => f.id === id)?.name ?? '';
    bus.on('festival.progress', ({ step }) => this.toast(ft[step], step === 'prep' || step === 'decor' ? 2500 : 3500));
    bus.on('festival.scheduled', ({ festivalId, day }) => this.toast(ft.scheduled.replace('{name}', festName(festivalId)).replace('{date}', this.festivalDate(day)), 4500));
    bus.on('festival.missed', ({ festivalId }) => this.toast(ft.missed.replace('{name}', festName(festivalId)), 4500));
    bus.on('festival.finished', (e) => void this.festivalSummary(e));
    bus.on('reputation.changed', () => {
      const el = this.root.querySelector<HTMLElement>('.hud-rep');
      el?.classList.remove('bump');
      void el?.offsetWidth; // reinicia a animação
      el?.classList.add('bump');
    });
    bus.on('reputation.threshold_reached', ({ thresholdId }) => {
      const t = content.reputation.thresholds.find((x) => x.id === thresholdId);
      if (t) this.toast(uiText.reputation.reached.replace('{name}', t.name), 4000);
    });
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

  /** O Market (app do celular) está aberto: a tecla C abre e fecha ele. */
  isCatalogOpen(): boolean {
    return this.news.isMarketOpen();
  }

  toggleCatalog(): void {
    if (this.isCatalogOpen()) this.closeCatalog();
    else if (!this.isDialogueOpen()) {
      this.closeShop();
      this.news.open('phone', 'market');
    }
  }

  closeCatalog(): void {
    if (this.isCatalogOpen()) this.news.close();
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
    // Chegada de gato em andamento: o que fazer agora.
    const arrival = this.arrivalLine();
    if (arrival) items.push(arrival);
    // Festival em andamento: a etapa da vez (src/core/festival.ts).
    const fest = this.festivalLine();
    if (fest) items.push(fest);
    const sv = this.session.service;
    // Fora do horário (app Horário): quando abre de novo. Só durante o dia e com o café já atendendo.
    if (sv.enabled() && !sv.isOpen() && this.session.state.time < 22 * 60) items.push(`<li class="job"><span>${esc(uiText.service.closed.replace('{when}', openingText(this.session)))}</span></li>`);
    if (sv.isOpen()) {
      items.push(`<li class="job"><span>${uiText.service.open.replace('{n}', String(this.session.state.service.customers.length)).replace('{cap}', String(sv.capacity().total))}</span></li>`);
      const blocked = sv.arrivalsBlocked();
      if (blocked) items.push(`<li class="job warn"><span>${esc(uiText.service.blocked[blocked])}</span></li>`);
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
      // O balão é clicável: só a personagem embaixo dele (não o mouse) deixa ele transparente.
      const near = el === this.goals ? points.slice(0, 2) : points;
      const under = near.some((p) => p.x >= r.left - 4 && p.x <= r.right + 4 && p.y >= r.top - 4 && p.y <= r.bottom + 12);
      el.classList.toggle('see-through', under);
    }
    const root = this.root.getBoundingClientRect();
    this.hotbar.followPlayer(((feet.y - root.top) / root.height) * 360);
  }

  /** Linha da chegada de gato no balão (ou vazio). */
  private arrivalLine(): string {
    const a = this.session.arrivals.active();
    const g = uiText.arrivals.goal;
    // Aceito, esperando as necessidades: a próxima delas (ração antes do cobertor, vet por último).
    const needs = this.session.arrivals.pendingNeeds();
    const need = needs && (['food', 'warmth', 'vet'] as const).find((n) => needs.includes(n));
    if (a && need) {
      const text = need === 'vet' ? g.need_vet.replace('{cost}', String(this.session.content.catProfiles.needs.vet.cost)) : need === 'food' ? g.need_food : g.need_warmth;
      return `<li class="job"><span><b>${esc(uiText.arrivals.title)}:</b> ${esc(text)}</span></li>`;
    }
    const step = this.session.arrivals.currentStep();
    if (!a || !step) return '';
    const meet = a.def.model === 'vizinho_traz' ? g.meet_neighbor : a.def.model === 'pegadas' ? g.trail : a.def.model === 'gato_leva' ? g.meet_leader : g.meet;
    const mg = { preso: g.rescue, ninhada: g.litter, dentro_do_cafe: g.inside, em_perigo: g.danger } as Record<string, string>;
    const meetText = a.def.model === 'entrega' ? g.box : meet;
    const clueText = a.def.model === 'entrega' ? g.ask : g.clue;
    if ('feed' in step) {
      const done = this.session.state.arrivals.active?.fed ?? 0;
      const f = g.feed.replace('{n}', String(done)).replace('{total}', String(step.feed.times)).replace('{from}', step.feed.hours[0]).replace('{to}', step.feed.hours[1]);
      return `<li class="job"><span><b>${esc(uiText.arrivals.title)}:</b> ${esc(f)}</span></li>`;
    }
    const text = 'ask' in step ? g.ask : 'meet' in step ? meetText : 'lead' in step ? g.lead : 'minigame' in step ? (mg[a.def.model] ?? g.minigame) : 'poster' in step ? g.poster : 'choice' in step ? g.choice : 'clue' in step ? clueText : '';
    return text ? `<li class="job"><span><b>${esc(uiText.arrivals.title)}:</b> ${esc(this.fillNames(text))}</span></li>` : '';
  }

  /** Linha do festival no balão (ou vazio, sem evento em andamento). Os textos vêm do festival (festivals.json: texts). */
  private festivalLine(): string {
    const f = this.session.festivalStatus();
    if (!f) return '';
    const t = f.def.texts;
    const count = f.total > 1 && f.left > 0 ? ` <span class="count">${f.total - f.left}/${f.total}</span>` : '';
    let text = '';
    if (f.stage === 'prep') text = t.prep ?? '';
    else if (f.stage === 'waiting') {
      const n = (f.day ?? 0) - this.session.state.day;
      const when = n === 1 ? uiText.calendarApp.tomorrow : uiText.calendarApp.inDays.replace('{n}', String(n));
      text = uiText.festival.waiting.replace('{name}', f.def.name).replace('{date}', this.festivalDate(f.day ?? 0)).replace('{when}', when);
    } else if (f.next === 'close') text = t.close ?? '';
    else if (f.next === 'decor') text = t.decor ?? '';
    else if (f.game) text = t.activities[f.game] ?? '';
    return text ? `<li class="job"><span><b>${esc(f.def.name)}:</b> ${esc(text)}${count}</span></li>` : '';
  }

  /** "Inverno 15 (sex)". */
  private festivalDate(day: number): string {
    const s = content.seasons;
    return uiText.festival.date
      .replace('{season}', s.names[seasonOf(s, day)] ?? '')
      .replace('{day}', String(dayInSeason(s, day)))
      .replace('{weekday}', uiText.weekdays[this.session.service.weekday(day)] ?? '');
  }

  /** Fim do festival: o resumo (cada atividade com o resultado, moedas, reputação e adoções). Enter ou o botão fecha. */
  private festivalSummary(e: { festivalId: string; results: { game: string; outcome: 'fail' | 'ok' | 'great'; skipped: boolean; setup?: { visitors: number } }[]; coins: number; reputation: number; adopted: number }): Promise<void> {
    const t = uiText.festival.summary;
    const name = content.festivals.find((f) => f.id === e.festivalId)?.name ?? '';
    const rows = e.results.map((r) => {
      const game = content.minigames.games[r.game]?.name ?? r.game;
      const visitors = r.setup ? t.visitors.replace('{n}', String(r.setup.visitors)) : '';
      return `<li>${esc(t.activity.replace('{game}', game).replace('{outcome}', r.skipped ? t.outcomes.skipped : t.outcomes[r.outcome]) + visitors)}</li>`;
    });
    if (e.adopted > 0) rows.push(`<li>${esc(t.adopted.replace('{n}', String(e.adopted)))}</li>`);
    if (e.coins > 0) rows.push(`<li class="gain">${esc(t.coins.replace('{n}', String(e.coins)))}</li>`);
    if (e.reputation > 0) rows.push(`<li class="gain">${esc(t.reputation.replace('{n}', String(e.reputation)))}</li>`);
    const el = document.createElement('div');
    el.className = 'confirm-layer';
    el.innerHTML = `<div class="panel confirm festival-summary"><p class="title">${esc(t.title.replace('{name}', name))}</p><ul>${rows.join('')}</ul><div class="buttons"><button class="yes">${esc(t.close)}</button></div></div>`;
    this.root.appendChild(el);
    this.reveal = { el, done: () => undefined };
    this.refresh();
    return new Promise((resolve) => {
      const finish = () => {
        window.removeEventListener('keydown', onKey);
        el.remove();
        this.reveal = null;
        this.refresh();
        resolve();
      };
      const onKey = (k: KeyboardEvent) => {
        if (k.code === 'Enter' || k.code === 'Escape') finish();
      };
      window.setTimeout(() => window.addEventListener('keydown', onKey), 150);
      (el.querySelector('.yes') as HTMLElement).addEventListener('click', finish);
    });
  }

  /** Reputação felina no HUD: barrinha e número (embaixo do dinheiro). */
  private renderReputation(): void {
    const el = this.root.querySelector<HTMLElement>('.hud-rep');
    if (!el) return;
    const max = content.reputation.max;
    const value = this.session.reputation();
    (el.querySelector('.fill') as HTMLElement).style.width = `${Math.round((value / max) * 100)}%`;
    (el.querySelector('.value') as HTMLElement).textContent = String(Math.round(value));
    el.title = uiText.reputation.title.replace('{value}', String(Math.round(value))).replace('{max}', String(max));
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

  /** Resolve quando não há fala, cena nem caixa de nome na tela (as perguntas das chegadas esperam). */
  private afterDialogue(): Promise<void> {
    return new Promise((resolve) => {
      const check = () => (this.isDialogueOpen() || this.dialogueQueue.length > 0 ? window.setTimeout(check, 120) : resolve());
      check();
    });
  }

  /** Escolha entre várias opções (ex.: as dicas dos vizinhos). Clique ou 1 a 9. Devolve o índice. */
  choose(question: string, options: string[]): Promise<number> {
    const el = document.createElement('div');
    el.className = 'confirm-layer';
    el.innerHTML = `<div class="panel confirm choose"><p>${esc(question)}</p><div class="options">${options
      .map((o, i) => `<button data-i="${i}"><b>${i + 1}</b> ${esc(o)}</button>`)
      .join('')}</div></div>`;
    this.root.appendChild(el);
    this.reveal = { el, done: () => undefined };
    this.refresh();
    return new Promise((resolve) => {
      const finish = (i: number) => {
        window.removeEventListener('keydown', onKey);
        el.remove();
        this.reveal = null;
        this.refresh();
        resolve(i);
      };
      const onKey = (e: KeyboardEvent) => {
        const n = Number(e.key) - 1;
        if (Number.isInteger(n) && n >= 0 && n < options.length) finish(n);
      };
      window.setTimeout(() => window.addEventListener('keydown', onKey), 150);
      el.querySelectorAll<HTMLButtonElement>('[data-i]').forEach((b) => b.addEventListener('click', () => finish(Number(b.dataset.i))));
    });
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
    this.renderReputation();
    const sd = this.session.seasonDay();
    (this.money.querySelector('.day') as HTMLElement).textContent = uiText.seasonDay.replace('{season}', sd.name).replace('{day}', String(sd.day)).replace('{weekday}', uiText.weekdays[this.session.service.weekday()] ?? '');
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
      ? `<h2>${uiText.goalsTitle}<span class="toggle"></span></h2><h3>${esc(fill(goal.title))}</h3><ul>${goal.steps
          .map((s) => {
            const note = this.debug && s.devNote ? `<span class="dev">${esc(s.devNote)}</span>` : '';
            const count = s.progress && !s.done ? ` <span class="count">${s.progress[0]}/${s.progress[1]}</span>` : '';
            const wait = s.waitUntil !== undefined && !s.done ? this.waitButton(s.waitUntil) : '';
            return `<li class="${s.done ? 'done' : ''}"><span>${esc(fill(s.text))}${count}${note}${wait}</span></li>`;
          })
          .join('')}</ul>`
      : extra ? `<h2>${uiText.goalsTitle}<span class="toggle"></span></h2><p class="peek">${uiText.goalsPeek}</p>` : '') + extra;
    this.goals.title = this.goals.classList.contains('open') ? uiText.goalsHide : uiText.goalsShow;

    this.goals.querySelectorAll<HTMLButtonElement>('.wait').forEach((b) => b.addEventListener('click', () => this.handlers.onWait(Number(b.dataset.until))));
    if (this.news?.isOpen()) this.news.render();
    this.renderHint();
  }

  private renderHint(): void {
    const mode = this.isDialogueOpen() ? 'dialogue' : this.hintMode;
    this.hint.textContent = mode === 'dialogue' ? uiText.hintDialogue : mode === 'placing' ? uiText.hintPlacing : mode === 'moving' ? uiText.hintMoving : uiText.hintWalk;
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
