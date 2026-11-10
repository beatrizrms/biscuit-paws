// Interface em HTML por cima do canvas: dinheiro, diário de metas, falas, catálogo e avisos.
// Só mostra o estado da sessão e repassa os cliques; as regras ficam no core.
import type { GameSession } from '../../core/session';
import type { DayEndReason } from '../../core/events';
import type { GoalView } from '../../core/story';
import { dayInSeason, seasonOf } from '../../core/calendar';
import { formatClock } from '../../core/time';
import { content, serviceArt, uiText } from '../content';
import { CutsceneView } from './CutsceneView';
import { NamingBox } from './NamingBox';
import { iconHtml, listNames, ShopPanel } from './ShopPanel';
import { NewsPanel } from './NewsPanel';
import { openingText } from './ScheduleApp';
import { MenuBoardPanel } from './MenuBoardPanel';
import { BackpackPanel, handItemName } from './BackpackPanel';
import { ConsultPanel } from './ConsultPanel';
import { Hotbar } from './Hotbar';
import { fillNames } from './text';
import { services } from '../services';
import { daysText, workName } from './constructionText';
import { rewardText } from './StatsApp';
import { weatherIconSvg } from './weatherIcons';

/** A partir de quanto tempo o aviso é "longo" (espera a vez em vez de apagar outro longo). */
const LONG_TOAST_MS = 4000;

/** A ligação para o construtor (data/cutscenes.json). */
const CALL_CUTSCENE = 'cs.builder_call';
/** A ligação das vezes seguintes (ela e o Tião já se conhecem): sem a apresentação. */
const CALL_AGAIN_CUTSCENE = 'cs.builder_call_again';

type HintMode = 'walk' | 'placing' | 'moving' | 'upgradePick' | 'dialogue';

const TYPE_SPEED_MS = 22;

export interface UiHandlers {
  /** A jogadora escolheu um item que já está na bolsa: começar a posicionar. */
  onPlace(itemId: string): void;
  /** "Esperar": o relógio corre depressa até o momento `until` (absoluto). */
  onWait(until: number): void;
  /** Obra: marcar a área da troca de acabamento no café. */
  onSelectArea(surfaceId: string, finishId: string): void;
  /** Assistência técnica: escolher no café o móvel para trocar. */
  onPickUpgrade(): void;
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
  /** Avisos longos esperando a vez, e até quando o longo da tela fica. */
  private toastQueue: { text: string; ms: number }[] = [];
  private longToastUntil = 0;
  /** Último aviso de energia dado (para não repetir a cada tarefa). */
  private energyWarned: 'low' | 'empty' | null = null;
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
      <div class="panel hud-rep"><span class="label">${uiText.reputation.label}</span><span class="stars" style="--star:url(${serviceArt.review.star})"><span class="fill"></span></span><span class="value"></span></div>
      <div class="panel hud-weather"><span class="weather"></span><span class="label"></span></div>
      <div class="panel hud-energy"><span class="label">${uiText.energy.label}</span><span class="bar"><span class="fill"></span></span><span class="value"></span></div>
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
    this.menuBoard = new MenuBoardPanel(root, session, () => this.refresh(), problem, (text) => this.toast(text, 3500));
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
      selectArea: (surfaceId, finishId) => {
        this.news.close();
        this.handlers.onSelectArea(surfaceId, finishId);
      },
      pickUpgrade: () => {
        this.news.close();
        this.handlers.onPickUpgrade();
      },
      upgrade: (uid, to) => void this.confirmUpgrade(uid, to),
      ordered: (arrivesAt) => {
        const { time, tomorrow } = this.clockOf(arrivesAt);
        this.toast((tomorrow ? uiText.delivery.orderedTomorrow : uiText.delivery.ordered).replace('{time}', time));
      },
    });

    const bus = session.bus;
    // Obras com o Tião: pediu a obra -> a ligação -> o orçamento (sim/não).
    bus.on('construction.call', ({ first }) => this.cutscene.request(first ? CALL_CUTSCENE : CALL_AGAIN_CUTSCENE));
    bus.on('cutscene.finished', ({ cutsceneId }) => {
      const q = session.state.construction.quote;
      if ((cutsceneId !== CALL_CUTSCENE && cutsceneId !== CALL_AGAIN_CUTSCENE) || !q) return;
      const t = uiText.construction;
      const text = (q.kind === 'finish' ? t.callFinish : t.callRepair).replace('{work}', workName(q)).replace('{labor}', String(q.labor)).replace('{days}', daysText(q.days));
      void this.confirm(text, t.yes, t.no).then((yes) => {
        const r = session.answerQuote(yes);
        if (!r.ok) return this.problem(r.reason as keyof typeof uiText.problems);
        if (yes) this.toast(t.accepted);
        else if (q.material > 0) this.toast(t.declined);
      });
    });
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
    bus.on('sink.paused', ({ paused }) => paused && this.toast(s.sinkLeft, 2500));
    const equipName = (id: string) => content.items[id]?.name ?? '';
    bus.on('equipment.broke', ({ itemId }) => this.toast(s.broke.replace('{name}', equipName(itemId)), 4000));
    bus.on('equipment.repaired', ({ itemId }) => this.toast(s.repaired.replace('{name}', equipName(itemId)), 3000));
    bus.on('washer.changed', ({ load, washing }) => {
      if (washing && load === 0) this.toast(s.washerOn);
      else if (load > 0) this.toast(s.washerLoaded.replace('{n}', String(load)));
    });
    bus.on('pantry.stored', ({ count }) => this.toast(uiText.backpack.pantryStored.replace('{n}', String(count)), 3000));
    bus.on('storage.changed', ({ count }) => count > 0 && this.toast(uiText.backpack.boxStored.replace('{n}', String(count)), 2500));
    bus.on('heavy.stored', ({ itemId }) => {
      const to = content.items[itemId]?.storesAs;
      this.toast(s.stored.replace('{name}', content.items[to?.item ?? itemId]?.name ?? '').replace('{qty}', String(to?.qty ?? 1)));
    });
    bus.on('customer.served', ({ recipeId, price, tip, quality }) => {
      const name = recipeName(recipeId) + (quality === 'premium' ? ` ${s.premium}` : '');
      this.toast((tip > 0 ? s.servedTip : s.served).replace('{price}', String(price)).replace('{name}', name).replace('{tip}', String(tip)));
    });
    bus.on('customer.left', ({ happy }) => !happy && this.toast(s.left));
    // Estabelecimento fechado: o aviso da porta, com quando abre (hoje, amanhã ou o dia da semana).
    // Trocou de lugar: o aviso de antes (ex.: a porta fechada) não acompanha.
    bus.on('map.entered', () => {
      window.clearTimeout(this.toastTimer);
      this.toastEl.classList.remove('show');
    });
    bus.on('door.closed', ({ name, opensDay, opensAt }) => {
      const when = opensDay === null || opensAt === null ? '' : this.whenText({ day: opensDay, open: opensAt });
      this.toast((when ? uiText.doorClosed.text : uiText.doorClosed.noTime).replace('{name}', name).replace('{when}', when), 4000);
    });
    bus.on('dish.washed', () => this.toast(s.washed));
    bus.on('delivery.picked_up', () => this.toast(uiText.delivery.pickedUp));
    // O café evoluiu: receita nova no caderno (o equipamento e os ingredientes já estão à venda).
    // A receita que vem de um selo já sai no aviso do selo (o último aviso apagaria o outro).
    bus.on('recipe.unlocked', ({ recipeId }) => {
      if (content.milestones.milestones.some((m) => m.reward.kind === 'recipe' && m.reward.ids.includes(recipeId))) return;
      this.toast(uiText.recipeUnlocked.replace('{name}', content.recipes[recipeId]?.name ?? ''), 4000);
    });
    // Caixa de Natal: guardou os enfeites; abriu e saiu um.
    bus.on('xmas.packed', ({ count }) => this.toast(uiText.xmasBox.packed.replace('{n}', String(count)), 6000));
    bus.on('xmas.box_opened', ({ itemId, left }) => this.toast((left > 0 ? uiText.xmasBox.opened : uiText.xmasBox.lastOne).replace('{name}', content.items[itemId]?.name ?? '').replace('{n}', String(left))));
    // Natal: o aviso da manhã (o café fecha mais cedo; a ceia), as meias e a ceia perdida.
    bus.on('xmas.day', ({ closeAt, partyAt, party, stockingCats }) => {
      const t = uiText.secretSanta;
      this.toast((party ? t.dayParty : t.day).replace('{close}', closeAt).replace('{time}', partyAt), 6000);
      if (stockingCats > 0) this.toast(t.stockings, 5000);
    });
    bus.on('newyear.eve', () => this.toast(uiText.newYear.eve, 6000));
    bus.on('xmas.santa_missed', () => this.toast(uiText.secretSanta.missed, 6000));
    // Cardápio da estação: o que chegou (e o que saiu do quadro por sair de época).
    bus.on('menu.season', ({ arrived, left }) => {
      const names = (ids: string[]) => listNames(ids.map((id) => content.recipes[id]?.name ?? id));
      const parts = [arrived.length ? uiText.seasonMenu.arrived.replace('{items}', names(arrived)) : '', left.length ? uiText.seasonMenu.left.replace('{items}', names(left)) : ''];
      this.toast(parts.filter(Boolean).join(' '), 6000);
    });
    // Selo do café: o nome e o que ele deu (app Café em números, aba Selos).
    bus.on('milestone.reached', ({ milestoneId }) => {
      const m = content.milestones.milestones.find((x) => x.id === milestoneId);
      if (!m) return;
      const hint = m.reward.kind === 'recipe' ? uiText.statsApp.toastRecipeHint : '';
      this.toast(uiText.statsApp.toast.replace('{name}', m.name).replace('{reward}', rewardText(m)) + hint, 5000);
    });
    // Saúde: um gato adoeceu à toa (a doença do dia 6 já tem fala), sarou, e o fiado sendo pago.
    bus.on('cat.sick', ({ catId, disease }) => {
      if (!session.state.story.completed.includes('story.cat_falls_ill') || session.state.story.completed.includes('story.vet_visit'))
        this.toast((session.state.flags[content.health.randomIllness.requiresFlag] ? uiText.health.sick : uiText.health.sickNoClinic).replace('{name}', session.catName(catId)).replace('{disease}', content.health.diseases.find((d) => d.id === disease)?.name ?? ''), 4000);
    });
    // Tigela, areia e automáticos: abasteceu, está acabando, faltou areia.
    const pet = uiText.pet;
    const itemName = (id: string) => content.items[id]?.name ?? '';
    bus.on('pet.loaded', ({ itemId, days }) => this.toast(pet.loaded.replace('{name}', itemName(itemId)).replace('{days}', String(days)), 3500));
    bus.on('pet.low', ({ itemId, days }) => this.toast((days > 0 ? pet.low : pet.empty).replace('{name}', itemName(itemId)).replace('{days}', String(days)), 4500));
    bus.on('litter.missed', () => this.toast(pet.litterMissed, 4500));
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
    bus.on('photo.best', () => this.toast(uiText.minigames.photo.record, 3500));
    bus.on('customer.left', ({ stars }) => stars !== undefined && this.renderReputation());
    bus.on('reputation.changed', () => {
      const el = this.root.querySelector<HTMLElement>('.hud-rep');
      el?.classList.remove('bump');
      void el?.offsetWidth; // reinicia a animação
      el?.classList.add('bump');
    });
    // Energia: a barrinha acompanha; avisa uma vez ao ficar cansada e ao zerar.
    bus.on('energy.changed', ({ level }) => {
      this.renderEnergy();
      if (level !== 'ok' && level !== this.energyWarned) this.toast(uiText.energy[level], 4000);
      this.energyWarned = level === 'ok' ? null : level;
    });
    bus.on('curfew.soon', () => this.toast(uiText.energy.curfewSoon, 4500));
    bus.on('energy.recovered', ({ source, amount }) => this.toast(uiText.energy[source].replace('{n}', String(amount)), 3000));
    bus.on('rest.changed', ({ uid }) => {
      if (uid) this.toast(uiText.energy.sofa, 3500);
    });
    bus.on('rest.full', () => this.toast(uiText.energy.rested, 3000));
    bus.on('reputation.threshold_reached', ({ thresholdId }) => {
      const t = content.reputation.thresholds.find((x) => x.id === thresholdId);
      if (t) this.toast(uiText.reputation.reached.replace('{name}', t.name), 4000);
    });
    // Gato novo: entra assustado (precisa da confiança) e, depois dela, fica de boa.
    // (Depois do nome: o gato gerado chega sem nome e a caixa de nome abre primeiro.)
    bus.on('cat.named', ({ catId, name }) => session.catSettling(catId) && this.toast(uiText.cats.arrivedScared.replace('{cat}', name), 5000));
    bus.on('cat.settled', ({ catId }) => this.toast(uiText.cats.settled.replace('{cat}', session.catName(catId)), 4000));
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

  /** Assistência: o Market aberto com as trocas do móvel escolhido no café. */
  openUpgrade(uid: string): void {
    this.closeShop();
    this.news.open('phone', 'market');
    this.news.showUpgrade(uid);
  }

  /** "Trocar X por Y? N moedas (diferença + serviço)": sim troca no lugar e fecha o celular para ver. */
  private async confirmUpgrade(uid: string, to: string): Promise<void> {
    const t = uiText.upgrade;
    const p = this.session.state.placed.find((x) => x.uid === uid);
    const option = this.session.upgradeOptions(uid).find((o) => o.itemId === to);
    if (!p || !option) return this.problem('no_upgrade');
    const fee = content.upgrades.fee;
    const text = t.confirm
      .replace('{from}', content.items[p.item]!.name)
      .replace('{to}', content.items[to]!.name)
      .replace('{cost}', String(option.cost))
      .replace('{diff}', String(option.cost - fee))
      .replace('{fee}', String(fee));
    if (!(await this.confirm(text, t.yes, t.no))) return;
    const r = this.session.upgradePlaced(uid, to);
    if (!r.ok) return this.problem(r.reason as keyof typeof uiText.problems);
    this.news.close();
    this.toast(t.done);
  }

  /** O Market aberto na aba Construção (o Tião perguntou se ela quer mais algum serviço). */
  openConstruction(): void {
    this.closeShop();
    this.news.open('phone', 'market');
    this.news.marketTab(uiText.market.tabs.find((t) => 'renovation' in t && t.renovation)?.id ?? '');
  }

  /** "hoje às 07:00", "amanhã às 07:00" ou "seg às 07:00". */
  private whenText(next: { day: number; open: string }): string {
    const t = uiText.scheduleApp;
    const ahead = next.day - this.session.state.day;
    return (ahead === 0 ? t.today : ahead === 1 ? t.tomorrow : t.onDay.replace('{weekday}', uiText.weekdays[this.session.service.weekday(next.day)] ?? '')).replace('{time}', next.open);
  }

  /**
   * Plaquinha de horário na fachada: um quadro no centro da tela (como um mural), com o status de agora, a semana dia
   * por dia (hoje em destaque, dias fechados escritos) e, no café, o almoço. Um por vez; E, Esc ou clique fecham, e o
   * relógio para enquanto ele está aberto (como a caixa de confirmação).
   */
  showHours(doorId: string): void {
    const h = this.session.placeHours(doorId);
    if (!h || this.reveal) return;
    const t = uiText.hoursSign;
    const name = h.cafe ? t.cafe : h.name;
    const [status, tone] = !h.enabled
      ? [t.notYet, 'closed']
      : h.lunch?.now
        ? [t.lunchNow.replace('{back}', h.lunch.to), 'lunch']
        : h.openNow
          ? [t.open.replace('{close}', h.close), 'open']
          : [h.next ? t.closed.replace('{when}', this.whenText(h.next)) : t.closedNoTime, 'closed'];
    const today = this.session.service.weekday();
    const hours = t.hours.replace('{open}', h.open).replace('{close}', h.close);
    const rows = t.weekdays
      .map((day, i) => {
        const label = i === today ? `${day} · ${t.today}` : day;
        return `<tr class="${i === today ? 'today' : ''}${h.days[i] ? '' : ' off'}"><td>${esc(label)}</td><td>${esc(h.days[i] ? hours : t.closedDay)}</td></tr>`;
      })
      .join('');
    const lunch = h.lunch ? `<p class="hb-lunch">${esc(t.lunch)}: ${esc(t.hours.replace('{open}', h.lunch.from).replace('{close}', h.lunch.to))}</p>` : '';
    const el = document.createElement('div');
    el.className = 'confirm-layer hours-layer';
    el.innerHTML = `<div class="hours-board"><div class="hb-paper">
        <h2>${esc(name)}</h2>
        <p class="hb-status ${tone}">${esc(status)}</p>
        <table>${rows}</table>${lunch}
        <p class="hb-close">${esc(t.close)}</p>
      </div></div>`;
    this.root.appendChild(el);
    const close = () => {
      window.removeEventListener('keydown', onKey);
      el.remove();
      this.reveal = null;
      this.refresh();
    };
    const onKey = (e: KeyboardEvent) => {
      if (['KeyE', 'Escape', 'Enter', 'Space'].includes(e.code)) {
        e.preventDefault();
        e.stopPropagation();
        close();
      }
    };
    this.reveal = { el, done: close };
    this.refresh();
    // Espera um instante: o mesmo E que abriu não fecha.
    window.setTimeout(() => window.addEventListener('keydown', onKey), 200);
    el.addEventListener('click', close);
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

  /**
   * Aviso no alto da tela. Os longos (4 s ou mais: selo, cardápio da estação, receita nova) esperam a vez em fila em
   * vez de apagar outro longo que ainda está na tela; os curtos aparecem na hora.
   */
  toast(text: string, ms = 1600): void {
    if (ms >= LONG_TOAST_MS && Date.now() < this.longToastUntil) {
      this.toastQueue.push({ text, ms });
      return;
    }
    this.showToast(text, ms);
  }

  private showToast(text: string, ms: number): void {
    this.toastEl.textContent = text;
    this.toastEl.classList.add('show');
    if (ms >= LONG_TOAST_MS) this.longToastUntil = Date.now() + ms;
    window.clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => {
      this.toastEl.classList.remove('show');
      const next = this.toastQueue.shift();
      if (next) this.toastTimer = window.setTimeout(() => this.showToast(next.text, next.ms), 250);
    }, ms);
  }

  /** Aviso com um texto de data/ui_text.json. */
  toastText(key: 'notHome'): void {
    this.toast(uiText[key]);
  }

  problem(reason: keyof typeof uiText.problems, vars: Record<string, string> = {}): void {
    services().audio.sfx('error');
    this.toast(Object.entries(vars).reduce((t, [k, v]) => t.replaceAll(`{${k}}`, v), uiText.problems[reason] ?? reason));
  }

  private waitButton(until: number): string {
    return `<button class="wait" data-until="${until}" title="${uiText.waitTitle}">${uiText.wait}</button>`;
  }

  /** Hora de um momento absoluto, dizendo se é amanhã. */
  private clockOf(at: number): { time: string; tomorrow: boolean } {
    const t = at - this.session.state.day * 1440;
    return { time: formatClock(t >= 1440 ? t - 1440 : t, 5), tomorrow: t >= 1440 };
  }

  /** Bolinhas de progresso (até 8; mais que isso, o número). */
  private pips(done: number, total: number): string {
    if (total > 8 || total === 0) return `<span class="count">${done}/${total}</span>`;
    return `<span class="pips">${Array.from({ length: total }, (_, k) => `<i class="${k < done ? 'on' : ''}"></i>`).join('')}</span>`;
  }

  /** Uma linha do balão: ícone (opcional), texto e o que vai à direita (contador, bolinhas, botão). */
  private row(text: string, opts: { icon?: string; cls?: string; right?: string; html?: boolean } = {}): string {
    const icon = opts.icon ? iconHtml(opts.icon, 10) : '';
    const body = opts.html ? text : esc(text);
    return `<li class="${opts.cls ?? ''}">${icon}<span class="t">${body}</span>${opts.right ?? ''}</li>`;
  }

  /**
   * Embaixo da meta: "hoje" (rotina, pedidos, chegada, festival; as já feitas viram uma linha), "café" (atendimento,
   * bandeja, pia, entregas) e os alertas numa faixa no fim (café vazio, gatos doentes).
   */
  private extrasHtml(): string {
    const c = uiText.chores;
    const g = uiText.goals;
    const today: string[] = [];
    const cafe: string[] = [];
    const alerts: string[] = [];
    let doneToday = 0;
    for (const ch of this.session.chores()) {
      // Gatos doentes demais: o aviso do café vazio.
      if (ch.kind === 'sick') {
        alerts.push(c.sick);
        continue;
      }
      if (ch.done) {
        doneToday++;
        continue;
      }
      if (ch.kind === 'care') {
        // O mesmo ícone do balão em cima do gato; sem a escova/varinha, diz onde comprar.
        const t = c.care[ch.need!];
        const line = (ch.hasTool ? t.do : t.buy).replace('{cat}', this.session.catName(ch.catId!));
        const art = content.health.care.bubbles[ch.need!];
        const icon = art?.icon ?? (art?.item ? content.items[art.item]?.icon : undefined);
        today.push(this.row(line, { icon }));
        continue;
      }
      if (ch.kind === 'poop') {
        today.push(this.row(c.poop, { icon: 'areia' }));
        continue;
      }
      if (ch.kind === 'toys') {
        today.push(this.row(c.toys, { right: ch.progress ? this.pips(ch.progress[0], ch.progress[1]) : '' }));
        continue;
      }
      // Gato que acabou de chegar: a confiança.
      if (ch.kind === 'settle') {
        today.push(this.row(c.settle.replace('{cat}', this.session.catName(ch.catId!)), { icon: 'petisco_biscoito' }));
        continue;
      }
      // Comida: com um gato, o nome dele; com mais, "Ração para os gatos" (com quantos já comeram).
      const feedText = ch.catId ? c.feed.replace('{cat}', this.session.catName(ch.catId)) : c.feedAll;
      const text = ch.kind === 'feed' ? feedText : ch.kind === 'pantry' ? c.pantry : c.sweep;
      const icon = ch.kind === 'feed' ? 'racao_simples' : ch.kind === 'pantry' ? 'caixas_empilhadas' : 'vassoura';
      today.push(this.row(text, { icon, right: ch.progress ? this.pips(ch.progress[0], ch.progress[1]) : '' }));
    }
    for (const job of this.session.activeJobs()) {
      const step = job.steps[this.session.jobStep(job.id)];
      const [done, total] = this.session.jobStepProgress(job.id);
      today.push(this.row(`<b>${esc(c.job)}:</b> ${esc(step?.text ?? job.title)}`, { icon: 'caixa_bilhete', html: true, right: total > 1 ? this.pips(done, total) : '' }));
    }
    // Chegada de gato e festival em andamento: o que fazer agora.
    const arrival = this.arrivalLine();
    if (arrival) today.push(arrival);
    const fest = this.festivalLine();
    if (fest) today.push(fest);
    const santa = this.santaLine();
    if (santa) today.push(santa);
    if (doneToday > 0) today.push(`<li class="done-sum">${esc(g.doneToday.replace('{n}', String(doneToday)))}</li>`);

    const sv = this.session.service;
    // Fora do horário (app Horário): quando abre de novo. Só durante o dia e com o café já atendendo.
    if (sv.enabled() && !sv.isOpen() && this.session.state.time < 22 * 60) cafe.push(this.row(uiText.service.closed.replace('{when}', openingText(this.session)), { icon: 'xicara_limpa' }));
    if (sv.isOpen()) {
      const cap = sv.capacity().total;
      cafe.push(this.row(g.service, { icon: 'xicara_limpa', right: this.pips(this.session.state.service.customers.length, cap) }));
      const blocked = sv.arrivalsBlocked();
      if (blocked) alerts.push(uiText.service.blocked[blocked]);
    }
    // Equipamento quebrado (sem o Tião consertando): o aviso fica no balão até chamar.
    for (const uid of sv.brokenEquipment()) {
      if (sv.isRepairing(uid)) continue;
      const item = this.session.state.placed.find((pl) => pl.uid === uid)?.item ?? '';
      alerts.push(uiText.service.brokenAlert.replace('{name}', content.items[item]?.name ?? '').replace('{price}', String(content.service.breakdown?.repairPrice ?? 0)));
    }
    if (this.session.state.tray) cafe.push(this.row(uiText.service.tray.replace('{n}', String(this.session.state.hands.length)).replace('{max}', String(sv.handsCapacity())), { icon: 'bandeja_vazia' }));
    for (const h of this.session.state.hands) cafe.push(this.row(uiText.service.hands.replace('{name}', handItemName(h, (id) => this.session.catName(id)))));
    if (this.session.state.sink.washing) cafe.push(this.row(sv.sinkPaused() ? uiText.service.sinkPaused : uiText.service.sinkWashing, { icon: 'xicara_suja' }));
    else if (sv.sinkLoad() > 0) cafe.push(this.row(uiText.service.sinkLoad.replace('{n}', String(sv.sinkLoad())), { icon: 'xicara_suja' }));
    for (const uid of Object.keys(this.session.state.washers)) {
      if (sv.washerProgress(uid) !== undefined) cafe.push(this.row(uiText.service.washerWashing, { icon: 'xicara_suja' }));
      else if (sv.washerLoad(uid) > 0) cafe.push(this.row(uiText.service.washerLoad.replace('{n}', String(sv.washerLoad(uid))), { icon: 'xicara_suja' }));
    }
    const d = uiText.delivery;
    const next = this.session.nextArrival();
    if (next !== undefined) {
      const { time, tomorrow } = this.clockOf(next);
      cafe.push(this.row((tomorrow ? d.shippingTomorrow : d.shipping).replace('{time}', time), { icon: 'caixa_entrega_fechada', right: this.waitButton(next) }));
    }
    const n = (stage: 'door' | 'carried' | 'inside') => this.session.deliveriesAt(stage);
    const atDoor = n('door') - this.parcelsOnTheWay;
    if (atDoor > 0) cafe.push(this.row(d.atDoor.replace('{n}', String(atDoor)), { icon: 'caixa_entrega_fechada' }));
    if (n('carried')) cafe.push(this.row(d.carried.replace('{n}', String(n('carried'))), { icon: 'caixa_entrega_fechada' }));
    if (n('inside')) cafe.push(this.row(d.inside.replace('{n}', String(n('inside'))), { icon: 'caixa_entrega_aberta' }));

    const section = (title: string, items: string[]) => (items.length ? `<h4>${esc(title)}</h4><ul class="chores">${items.join('')}</ul>` : '');
    // O alerta: a primeira frase vira o título (até o ":"), o resto é o que fazer.
    const alert = alerts
      .map((a) => {
        const k = a.indexOf(':');
        const [head, rest] = k > 0 ? [a.slice(0, k), a.slice(k + 1).trim()] : [a, ''];
        const tail = rest.charAt(0).toUpperCase() + rest.slice(1);
        return `<div class="g-alert"><b>! ${esc(head)}</b>${tail ? `<span>${esc(tail)}</span>` : ''}</div>`;
      })
      .join('');
    return section(c.title, today) + section(g.cafe, cafe) + alert;
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
  /** Amigo secreto: para quem é o presente (e se já está na mochila); no Natal, a hora da ceia. */
  private santaLine(): string {
    const s = this.session.secretSanta();
    if (!s || s.record.stage !== 'drawn') return '';
    const t = uiText.secretSanta;
    const ss = content.festive.secretSanta;
    const goal = t.goal.replace('{name}', s.friend.name);
    const parts = [goal];
    if (s.christmas) parts.push(t.party.replace('{time}', ss.partyAt));
    const text = `<b>${esc(t.title)}:</b> ${esc(parts.join('; '))}`;
    const right = s.hasGift ? `<span class="count">${esc(s.lovedGift ? t.readyLoved : t.ready)}</span>` : '';
    // A dica do gosto fica no título (passar o mouse).
    return `<li class="job" title="${esc(s.friend.hint)}"><span>${text} ${right}</span></li>`;
  }

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
  private festivalSummary(e: { festivalId: string; results: { game: string; outcome: 'fail' | 'ok' | 'great'; skipped: boolean; setup?: { visitors: number }; contest?: { rank: number }; photo?: { score: number } }[]; coins: number; reputation: number; adopted: number }): Promise<void> {
    const t = uiText.festival.summary;
    const name = content.festivals.find((f) => f.id === e.festivalId)?.name ?? '';
    const rows = e.results.map((r) => {
      const game = content.minigames.games[r.game]?.name ?? r.game;
      const visitors = r.setup ? t.visitors.replace('{n}', String(r.setup.visitors)) : r.contest ? t.rank.replace('{n}', String(r.contest.rank)) : r.photo ? t.photo.replace('{n}', String(r.photo.score)) : '';
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

  /** Energia no HUD: barrinha e número (embaixo da reputação); cansada, a barra fica laranja. */
  private renderEnergy(): void {
    const el = this.root.querySelector<HTMLElement>('.hud-energy');
    if (!el) return;
    const max = content.dayNight.energy.max;
    const value = this.session.energy();
    (el.querySelector('.fill') as HTMLElement).style.width = `${Math.round((value / max) * 100)}%`;
    (el.querySelector('.value') as HTMLElement).textContent = String(Math.round(value));
    el.classList.toggle('low', this.session.energyLevel() !== 'ok');
    el.title = uiText.energy.title.replace('{value}', String(Math.round(value))).replace('{max}', String(max));
  }

  /**
   * Nota do café no HUD (embaixo do dinheiro): 5 estrelas preenchidas até a média das últimas avaliações e o número
   * (0,0 sem nenhuma). A reputação felina (0 a max) continua por trás: aparece no texto de ajuda.
   */
  private renderReputation(): void {
    const el = this.root.querySelector<HTMLElement>('.hud-rep');
    if (!el) return;
    const { average, count } = this.session.rating();
    const avg = average ?? 0;
    (el.querySelector('.fill') as HTMLElement).style.width = `${(avg / 5) * 100}%`;
    (el.querySelector('.value') as HTMLElement).textContent = avg.toFixed(1).replace('.', ',');
    const rating = count ? uiText.reputation.rating.replace('{value}', avg.toFixed(1).replace('.', ',')).replace('{n}', String(count)) : uiText.reputation.noRating;
    const rep = uiText.reputation.title.replace('{value}', String(Math.round(this.session.reputation()))).replace('{max}', String(content.reputation.max));
    el.title = `${rating}
${rep}`;
  }

  /** Hora no HUD (só mexe no texto quando muda). */
  setClock(text: string): void {
    const el = this.money.querySelector('.clock') as HTMLElement;
    if (el.textContent !== text) el.textContent = text;
  }

  /** Fim do dia: "Você foi para casa." e o dia seguinte. Resolve sozinho ou com clique/tecla. */
  showDayTransition(day: number, summary?: { reason: DayEndReason; earned: number; jobs: number }): Promise<void> {
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
    el.innerHTML = `<p class="home">${esc(this.fillNames(t[summary?.reason ?? 'home']))}</p>${report}<p class="next">${uiText.day} ${day}</p>`;
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

  /** O armário da cozinha: a mochila aberta na despensa, com o botão de guardar as compras. */
  openPantry(): void {
    this.closeCatalog();
    this.closeShop();
    this.backpack.show('pantry');
  }

  /** A caixa pet (móvel `uid`): a mochila aberta com o baú dela embaixo. */
  openPetBox(uid: string): void {
    this.closeCatalog();
    this.closeShop();
    this.backpack.show({ box: uid });
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
    this.renderEnergy();
    const sd = this.session.seasonDay();
    // Clima do dia (o ícone muda junto com o que cai lá fora).
    const weather = this.session.weather();
    const weatherEl = this.root.querySelector<HTMLElement>('.hud-weather');
    if (weatherEl && weatherEl.dataset.weather !== weather) {
      weatherEl.dataset.weather = weather;
      (weatherEl.querySelector('.weather') as HTMLElement).innerHTML = weatherIconSvg(weather);
      (weatherEl.querySelector('.label') as HTMLElement).textContent = (uiText.weather as Record<string, string>)[weather] ?? '';
    }
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
      ? `<h2>${uiText.goalsTitle}<span class="toggle"></span></h2>${this.storyHtml(goal, fill)}`
      : extra ? `<h2>${uiText.goalsTitle}<span class="toggle"></span></h2><p class="peek">${uiText.goalsPeek}</p>` : '') + extra;
    this.goals.title = this.goals.classList.contains('open') ? uiText.goalsHide : uiText.goalsShow;

    this.goals.querySelectorAll<HTMLButtonElement>('.wait').forEach((b) => b.addEventListener('click', () => this.handlers.onWait(Number(b.dataset.until))));
    if (this.news?.isOpen()) this.news.render();
    this.renderHint();
  }

  /**
   * A meta da história: o título com "✓ 2 de 3" (os passos feitos ficam resumidos), o passo da vez em destaque (ícone,
   * texto curto, a linha de detalhe, as bolinhas e "hoje já foi") e os outros passos abertos, menores. No debug, tudo.
   */
  private storyHtml(goal: GoalView, fill: (t: string) => string): string {
    const g = uiText.goals;
    const done = goal.steps.filter((s) => s.done).length;
    const open = goal.steps.filter((s) => !s.done);
    const sum = done > 0 ? `<span class="g-sum">${esc(g.stepsDone.replace('{n}', String(done)).replace('{total}', String(goal.steps.length)))}</span>` : '';
    const note = (s: GoalView['steps'][number]) => (this.debug && s.devNote ? `<span class="dev">${esc(s.devNote)}</span>` : '');
    const [now, ...rest] = open;
    const nowHtml = now
      ? `<div class="g-now">${now.icon ? iconHtml(now.icon, 12) : ''}<span class="t">${esc(fill(now.text))}</span></div>` +
        (now.detail ? `<p class="g-detail">${esc(fill(now.detail))}</p>` : '') +
        (now.progress || now.doneToday || now.waitUntil !== undefined
          ? `<div class="g-progress">${now.progress ? this.pips(now.progress[0], now.progress[1]) : ''}${now.doneToday ? `<span class="g-tag">${esc(g.doneToday1)}</span>` : ''}${now.waitUntil !== undefined ? this.waitButton(now.waitUntil) : ''}</div>`
          : '') +
        note(now)
      : '';
    const others = rest.map((s) => this.row(fill(s.text), { icon: s.icon, right: (s.progress ? this.pips(s.progress[0], s.progress[1]) : '') + note(s) })).join('');
    // No debug, os passos feitos também (para conferir a história).
    const doneList = this.debug ? goal.steps.filter((s) => s.done).map((s) => this.row(fill(s.text), { cls: 'done', right: note(s) })).join('') : '';
    return `<h4>${esc(g.story)}</h4><div class="g-card"><div class="g-head"><h3>${esc(fill(goal.title))}</h3>${sum}</div>${nowHtml}${others || doneList ? `<ul>${others}${doneList}</ul>` : ''}</div>`;
  }

  private renderHint(): void {
    const mode = this.isDialogueOpen() ? 'dialogue' : this.hintMode;
    this.hint.textContent =
      mode === 'dialogue' ? uiText.hintDialogue : mode === 'placing' ? uiText.hintPlacing : mode === 'moving' ? uiText.hintMoving : mode === 'upgradePick' ? uiText.hintUpgradePick : uiText.hintWalk;
  }

  /** Uma fala avulsa de um NPC (com o retrato dele), montada na hora (ex.: o Tião dizendo quantos dias faltam). */
  npcSay(npcId: string, text: string): Promise<void> {
    this.dialogueQueue.push({ speaker: content.npcs[npcId]?.name ?? '', text, npc: npcId });
    this.openDialogueIfFree();
    return this.afterDialogue();
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
