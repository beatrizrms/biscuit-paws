// Celular (tecla P; C abre direto no Market) e mural de pedidos do mercado.
// O celular tem a moldura do pacote (data/phone.json) e uma tela de início com os apps:
// "Vila Hoje" (notícias + pedidos da vila), "Meus gatos" (os gatos abrigados), "Market" (compras online, MarketApp),
// "Horário" (dias e horas de funcionamento, ScheduleApp), "Calendário" (dias importantes, CalendarApp) e
// "Café em números" (o raio X do café, StatsApp) e, depois que a Fernanda chama para a CED, "CatPay" (a vaquinha, CatPayApp).
// O mural é um painel simples, só com os pedidos. Quem decide se um pedido pode ser aceito é o núcleo.
import type { CatProfile, GameSession } from '../../core/session';
import { formatClock } from '../../core/time';
import { content, phone, uiText } from '../content';
import { catSexText } from './vetText';
import { CalendarApp } from './CalendarApp';
import { CatPayApp } from './CatPayApp';
import { MarketApp, type MarketHost } from './MarketApp';
import { fillNames } from './text';
import { ScheduleApp } from './ScheduleApp';
import { StatsApp } from './StatsApp';
import { iconHtml } from './ShopPanel';
import { healthLow } from '../../core/health';

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

export type PhoneApp = 'home' | 'news' | 'cats' | 'market' | 'schedule' | 'calendar' | 'notes' | 'stats' | 'catpay';

export class NewsPanel {
  /** Mural do mercado. */
  private board: HTMLElement;
  private boardBody: HTMLElement;
  /** Celular. */
  private phoneEl: HTMLElement;
  private phoneBody: HTMLElement;
  private mode: 'phone' | 'board' | null = null;
  /** App aberto no celular. */
  private app: PhoneApp = 'home';
  private market: MarketApp;
  private scheduleApp: ScheduleApp;
  private calendarApp: CalendarApp;
  private statsApp: StatsApp;
  private catPayApp: CatPayApp;

  constructor(
    root: HTMLElement,
    private session: GameSession,
    private onChange: () => void,
    private onAccepted: (title: string) => void,
    private onProblem: (reason: string) => void,
    marketHost: MarketHost,
  ) {
    this.board = document.createElement('section');
    this.board.className = 'panel catalog news';
    this.board.innerHTML = `<header><h2>${uiText.news.boardTitle}</h2><button class="close">${uiText.news.close}</button></header><div class="list"></div>`;
    root.appendChild(this.board);
    this.boardBody = this.board.querySelector('.list') as HTMLElement;
    (this.board.querySelector('.close') as HTMLElement).addEventListener('click', () => this.close());

    // A moldura do pacote é esticada pelas bordas (border-image): a tela fica maior que no pacote, sem borrar.
    const [fw, fh] = phone.size;
    const s = phone.screen;
    const slice = [s.y, fw - s.x - s.w, fh - s.y - s.h, s.x];
    this.phoneEl = document.createElement('section');
    this.phoneEl.className = 'phone-ui news';
    this.phoneEl.setAttribute('aria-label', uiText.phone.title);
    this.phoneEl.style.borderImage = `url(${phone.frame}) ${slice.join(' ')} / ${slice.map((n) => `${n}px`).join(' ')} stretch`;
    this.phoneEl.style.borderWidth = slice.map((n) => `${n}px`).join(' ');
    this.phoneEl.innerHTML = `<div class="phone-screen">
        <div class="phone-status"><span class="p-clock"></span><span class="p-money" title="${uiText.phoneApp.balance}"><img src="assets/ui/hud/ui_coin_16.png" alt="" /><b></b></span><img class="p-signal" src="${phone.status}" alt="" /></div>
        <header class="phone-bar"><button class="p-back" title="${uiText.phoneApp.back}">‹</button><h2></h2><button class="p-close" title="${uiText.phoneApp.close}">✕</button></header>
        <div class="phone-body"></div>
      </div>`;
    root.appendChild(this.phoneEl);
    this.phoneBody = this.phoneEl.querySelector('.phone-body') as HTMLElement;
    (this.phoneEl.querySelector('.p-close') as HTMLElement).addEventListener('click', () => this.close());
    (this.phoneEl.querySelector('.p-back') as HTMLElement).addEventListener('click', () => this.show('home'));
    this.phoneBody.addEventListener('click', (e) => {
      // Só os ícones da tela de início (o próprio celular também tem data-app: o app aberto).
      const b = (e.target as HTMLElement).closest<HTMLButtonElement>('button[data-app]');
      if (b) return this.show(b.dataset.app as PhoneApp);
      // Meus gatos: tocar no gato mostra onde ele está na cena.
      const card = (e.target as HTMLElement).closest<HTMLElement>('[data-cat]');
      if (card && this.app === 'cats') marketHost.locateCat(card.dataset.cat!);
    });
    this.market = new MarketApp(session, marketHost);
    this.scheduleApp = new ScheduleApp(session, onProblem);
    this.calendarApp = new CalendarApp(session);
    this.statsApp = new StatsApp(session);
    this.catPayApp = new CatPayApp(session);

    for (const ev of ['arrival.started', 'arrival.finished', 'arrival.step', 'job.accepted', 'job.progress', 'job.completed', 'day.started', 'cat.fed', 'cat.affection_changed', 'cat.named', 'cat.sheltered', 'cat.sick', 'cat.diagnosed', 'cat.medicated', 'cat.cured'] as const)
      session.bus.on(ev, () => this.render());
    // Café em números aberto: os números andam junto com o atendimento.
    for (const ev of ['customer.served', 'customer.left', 'reputation.changed', 'stats.day_closed', 'milestone.reached'] as const)
      session.bus.on(ev, () => {
        if (this.mode === 'phone' && this.app === 'stats') this.render();
      });
    // CatPay aberto: cada doação aparece na hora.
    for (const ev of ['crowdfund.donated', 'crowdfund.completed', 'crowdfund.spent', 'ced.ready'] as const)
      session.bus.on(ev, () => {
        if (this.mode === 'phone' && this.app === 'catpay') this.render();
      });
    // Saldo na barra do celular (ele cobre as moedas do HUD): só o número muda, o app aberto fica como está.
    session.bus.on('money.changed', () => this.showMoney());
  }

  private showMoney(): void {
    const el = this.phoneEl?.querySelector('.p-money b');
    if (el) el.textContent = String(this.session.state.money);
  }

  isOpen(): boolean {
    return this.mode !== null;
  }

  /** Assistência: o Market na aba de upgrade, com as trocas deste móvel. */
  showUpgrade(uid: string): void {
    this.market.showUpgrade(uid);
    this.render();
  }

  /** Muda a aba do Market (e redesenha, se ele estiver aberto). */
  marketTab(tabId: string): void {
    this.market.setTab(tabId);
    this.render();
  }

  /** O Market está na tela (a tecla C abre e fecha ele). */
  isMarketOpen(): boolean {
    return this.mode === 'phone' && this.app === 'market';
  }

  /** phone: o celular (na tela de início ou num app); board: o mural do mercado (só pedidos). */
  /** Conta as aberturas (quem abriu por um motivo sabe se ainda é a mesma aberta). */
  opens = 0;

  open(mode: 'phone' | 'board', app: PhoneApp = 'home'): void {
    this.close();
    this.opens++;
    this.mode = mode;
    this.app = app;
    (mode === 'phone' ? this.phoneEl : this.board).classList.add('open');
    this.render();
    this.onChange();
  }

  close(): void {
    if (!this.mode) return;
    this.mode = null;
    this.board.classList.remove('open');
    this.phoneEl.classList.remove('open');
    this.onChange();
  }

  /** Redesenha (dinheiro, entregas, a hora...). */
  render(): void {
    if (this.mode === 'board') {
      this.boardBody.innerHTML = this.jobsHtml(false);
      this.bindJobs(this.boardBody);
      return;
    }
    if (this.mode !== 'phone') return;
    const titles: Record<PhoneApp, string> = {
      home: '',
      news: content.news.app,
      cats: uiText.cats.app,
      market: uiText.market.app,
      schedule: uiText.scheduleApp.app,
      calendar: uiText.calendarApp.app,
      notes: uiText.notesApp.app,
      stats: uiText.statsApp.app,
      catpay: uiText.catPayApp.app,
    };
    this.phoneEl.dataset.app = this.app;
    (this.phoneEl.querySelector('h2') as HTMLElement).textContent = titles[this.app];
    (this.phoneEl.querySelector('.p-clock') as HTMLElement).textContent = formatClock(this.session.state.time, 10);
    this.showMoney();
    const body = this.phoneBody;
    if (this.app === 'market') return this.market.render(body);
    if (this.app === 'schedule') return this.scheduleApp.render(body);
    if (this.app === 'calendar') return this.calendarApp.render(body);
    if (this.app === 'notes') return this.renderNotes(body);
    if (this.app === 'stats') return this.statsApp.render(body);
    if (this.app === 'catpay') return this.catPayApp.render(body);
    if (this.app === 'cats') body.innerHTML = this.catsHtml();
    else if (this.app === 'news') {
      body.innerHTML = this.jobsHtml(true);
      this.bindJobs(body);
    } else body.innerHTML = this.homeHtml();
  }

  private show(app: PhoneApp): void {
    if (app === 'calendar') this.calendarApp.reset();
    this.app = app;
    this.render();
    this.phoneBody.scrollTop = 0;
    this.onChange();
  }

  /** Notas: a lista de compras, como um bloco de notas (data, título grande, lista com bolinhas para marcar). */
  private renderNotes(body: HTMLElement): void {
    const t = uiText.notesApp;
    const st = this.session.state;
    const list = st.shoppingList;
    const items = list
      .map((id) => {
        const item = content.items[id];
        return `<li><button class="n-check" data-strike="${id}" aria-label="${esc(t.remove)}"></button><span class="n-item">${item ? iconHtml(item.icon) : ''}${esc(item?.name ?? id)}</span></li>`;
      })
      .join('');
    body.innerHTML = `<div class="notes-app">
      <p class="n-date">${uiText.day} ${st.day} · ${formatClock(st.time, 10)}</p>
      <h3 class="n-title">${esc(t.title)}</h3>
      ${list.length ? `<ul>${items}</ul><p class="n-hint">${esc(t.hint)}</p>` : `<p class="n-empty">${esc(t.empty)}</p>`}
    </div>`;
    // Marcar a bolinha risca o item (some da lista logo depois).
    body.querySelectorAll<HTMLButtonElement>('[data-strike]').forEach((b) =>
      b.addEventListener('click', () => {
        b.closest('li')?.classList.add('done');
        window.setTimeout(() => {
          this.session.removeFromShoppingList(b.dataset.strike!);
          this.render();
        }, 350);
      }),
    );
  }

  /** Tela de início: os ícones dos apps. */
  private homeHtml(): string {
    const sprites = content.catSprites;
    const firstCat = this.session.catProfiles()[0];
    const catSheet = sprites.variants[firstCat?.variant ?? Object.keys(sprites.variants)[0]!];
    const catIcon = catSheet
      ? `<span class="cat-face" style="background-image:url(${catSheet});background-size:${sprites.columns * sprites.frameSize}px auto"></span>`
      : '';
    const pending = this.session.availableJobs().length;
    const apps: { id: PhoneApp; name: string; icon: string; badge?: boolean }[] = [
      { id: 'news', name: content.news.app, icon: `<img src="${phone.apps.classificados}" alt="" />`, badge: pending > 0 },
      { id: 'cats', name: uiText.cats.app, icon: catIcon },
      { id: 'market', name: uiText.market.app, icon: '<img class="cart" src="assets/ui/hud/icon_cart_full.png" alt="" />' },
      { id: 'schedule', name: uiText.scheduleApp.app, icon: '<span class="clock-face"></span>' },
      { id: 'calendar', name: uiText.calendarApp.app, icon: `<span class="cal-face"><b></b>${this.session.seasonDay().day}</span>` },
      { id: 'notes', name: uiText.notesApp.app, icon: '<span class="notes-face"><i></i><i></i><i></i></span>', badge: this.session.state.shoppingList.length > 0 },
      { id: 'stats', name: uiText.statsApp.app, icon: '<span class="stats-face"><i></i><i></i><i></i></span>' },
    ];
    // PLACEHOLDER(arte): ícone do CatPay desenhado por CSS (pata + moeda) até a arte nova.
    if (this.session.ced.appVisible()) apps.push({ id: 'catpay', name: uiText.catPayApp.app, icon: '<span class="catpay-face">₵</span>' });
    return `<p class="p-date">${uiText.day} ${this.session.state.day}</p><div class="p-apps">${apps
      .map(
        (a) => `<button class="p-app" data-app="${a.id}"><span class="p-icon ${a.id}">${a.icon}${
          a.badge ? `<img class="p-badge" src="${phone.notification}" alt="" />` : ''
        }</span><span class="p-name">${esc(a.name)}</span></button>`,
      )
      .join('')}</div>`;
  }

  /** Vila Hoje (notícias + pedidos) ou o mural (só pedidos). */
  /** Cartaz de gato precisando de lar (chegada modelo mural): o gato, como ele está e os botões. */
  private posterHtml(): string {
    const s = this.session;
    const a = s.arrivals.active();
    const step = s.arrivals.currentStep();
    if (!a || !step || !('poster' in step)) return '';
    const def = s.catDef(a.catId);
    const sprites = content.catSprites;
    const sheet = def ? sprites.variants[def.variant] : undefined;
    const t = uiText.arrivals.poster;
    const pic = sheet ? `<span class="cat-sprite" style="background-image:url(${sheet});background-size:${sprites.columns * sprites.frameSize}px auto;--frames:4;--end:${-4 * sprites.frameSize}px"></span>` : '';
    return `<div class="cat-card poster">${pic}<div class="cat-info"><strong>${esc(t.title)}</strong><span class="routine">${esc(fillNames(s, t.text))}</span>
      <span class="poster-buttons"><button data-poster="yes">${esc(t.yes)}</button><button data-poster="no">${esc(t.no)}</button></span></div></div>`;
  }

  /** A Cartilha do gato: a dica de hoje, num quadrinho embaixo das notícias. */
  private tipHtml(): string {
    const tip = this.session.catTip();
    if (!tip) return '';
    return `<article class="cat-tip"><span class="tip-label">${esc(content.news.tipsTitle ?? '')}</span><h3>${esc(tip.title)}</h3><p>${esc(tip.text)}</p></article>`;
  }

  private jobsHtml(withNews: boolean): string {
    const s = this.session;
    const news = withNews
      ? `<p class="date">${uiText.day} ${s.state.day}</p>` + s.news().map((n) => `<article><h3>${esc(fillNames(s, n.headline))}</h3><p>${esc(fillNames(s, n.text))}</p></article>`).join('') + this.tipHtml()
      : '';
    const active = s.activeJobs().map((j) => {
      const step = j.steps[s.jobStep(j.id)];
      const [done, total] = s.jobStepProgress(j.id);
      return `<div class="job active"><strong>${esc(j.title)}</strong><span class="giver">${esc(j.giver)} · ${j.reward} ${content.economy.currency}</span>
        <span class="step">${esc(step?.text ?? '')} ${total > 1 ? `<b>${done}/${total}</b>` : ''}</span><span class="tag">${uiText.news.inProgress}</span></div>`;
    });
    const full = s.activeJobs().length >= content.maxActiveJobs;
    const open = s.availableJobs().map(
      (j) => `<div class="job"><strong>${esc(j.title)}</strong><span class="giver">${esc(j.giver)} · ${j.reward} ${content.economy.currency}</span>
        <span class="desc">${esc(j.description)}</span>
        <button data-job="${j.id}" ${full ? `disabled title="${uiText.news.oneAtATime}"` : ''}>${uiText.news.accept}</button></div>`,
    );
    const jobs = [...active, ...open].join('') || `<p class="empty">${uiText.news.noJobs}</p>`;
    return `${news}${this.posterHtml()}<h3 class="jobs-title">${uiText.news.jobsTitle}</h3>${jobs}`;
  }

  private bindJobs(body: HTMLElement): void {
    body.querySelectorAll<HTMLButtonElement>('[data-poster]').forEach((btn) => btn.addEventListener('click', () => this.session.answerArrival(btn.dataset.poster === 'yes')));
    body.querySelectorAll<HTMLButtonElement>('[data-job]').forEach((btn) =>
      btn.addEventListener('click', () => {
        const id = btn.dataset.job!;
        const result = this.session.acceptJob(id);
        if (!result.ok) return this.onProblem(result.reason);
        this.onAccepted(content.jobs[id]!.title);
      }),
    );
  }

  /** Uma linha da ficha com um ícone na frente (a bolinha com um símbolo ou um ícone do jogo). */
  private row(cls: string, icon: string, text: string): string {
    return `<span class="c-row ${cls}"><i class="c-ic">${icon}</i><span>${esc(text)}</span></span>`;
  }

  /** "Doente: Febre do Bigode · remédio 2/5" e, embaixo, a dose de hoje (verde: tomou; laranja: falta). */
  private sickHtml(s: NonNullable<CatProfile['sickness']>): string {
    const t = uiText.cats;
    const name = content.health.diseases.find((d) => d.id === s.disease)?.name ?? s.disease;
    if (!s.treatment) return this.row('sick-badge', '!', t.sickUntreated.replace('{disease}', name));
    const text = t.sickTreated.replace('{disease}', name).replace('{n}', String(s.treatment.dosesGiven)).replace('{days}', String(s.treatment.days));
    return this.row('sick-badge', iconHtml(content.health.care.bubbles.medicine.icon ?? '', 10), text) + this.doseHtml(s.treatment.dosedToday);
  }

  /** A dose do dia: "Já tomou o remédio hoje" (✓ verde) ou "Falta o remédio de hoje" (! laranja). */
  private doseHtml(dosedToday: boolean): string {
    const t = uiText.cats;
    return dosedToday ? this.row('dose ok', '✓', t.dosedToday) : this.row('dose due', '!', t.doseDue);
  }

  /** Felicidade e higiene (core/care.ts), do mesmo jeito da barra de saúde; abaixo do "baixo", fica amarela. */
  private careBars(catId: string): string {
    const care = this.session.catCare(catId);
    if (!care) return '';
    const t = uiText.cats;
    const cfg = content.health.care;
    const bar = (label: string, title: string, v: number, low: number) =>
      `<span class="health" title="${title.replace('{n}', String(v)).replace('{max}', String(cfg.max))}"><span class="label">${label}</span><span class="bar"><span class="fill${v < low ? ' low' : ''}" style="width:${Math.round((v / cfg.max) * 100)}%"></span></span></span>`;
    return bar(t.happiness, t.happinessTitle, care.happiness, cfg.low.happiness) + bar(t.hygiene, t.hygieneTitle, care.hygiene, cfg.low.hygiene);
  }

  /** Ficha do gato: castração (castrado, não castrado ou "não sei ainda"), clínica/cercadinho, remédio e adoção. */
  private clinicLines(p: CatProfile): string {
    const t = uiText.cats;
    const sexed = (text: string) => catSexText(this.session, text, p.id);
    const repro = sexed(t.repro[p.repro.known]) + (p.repro.sex ? ` · ${t.sex[p.repro.sex]}` : '') + (p.repro.earTipped ? ` · ${t.earTipped}` : '');
    // Consulta de entrada: feita ou não (quem está esperando por ela aparece no cuidado, logo abaixo).
    const lines: string[] = [];
    if (p.intake === 'done') lines.push(this.row('exam ok', '✚', t.intake.done));
    else if (p.intake === 'due' && !p.care) lines.push(this.row('exam due', '✚', t.intake.due));
    if (p.care) {
      const text = p.care.complication ? t.care.complication : t.care[p.care.stage].replace('{day}', String(p.care.until ?? ''));
      lines.push(this.row('clinic-badge', '✚', text));
    }
    lines.push(this.row(`repro ${p.repro.known}`, '✂', repro));
    if (p.aftercare) lines.push(this.row('clinic-badge', iconHtml(content.health.care.bubbles.medicine.icon ?? '', 10), t.aftercare.replace('{given}', String(p.aftercare.dosesGiven)).replace('{days}', String(p.aftercare.days))) + this.doseHtml(p.aftercare.dosedToday));
    if (p.adoption && p.adoption.reason !== 'in_care') lines.push(this.row('adoption', '⌂', sexed(t.adoption[p.adoption.reason]).replace('{day}', String(p.adoption.readyDay ?? ''))));
    return lines.join('');
  }

  /** App "Meus gatos": uma ficha por gato abrigado, com o gato sentado (animado), corações e a rotina. */
  private catsHtml(): string {
    const t = uiText.cats;
    const sprites = content.catSprites;
    const sit = sprites.animations.find((a) => a.name === 'sit');
    const cards = this.session.catProfiles().map((p) => {
      const sheet = sprites.variants[p.variant];
      const frames = sit?.frames ?? 1;
      const sprite = sheet
        ? `<span class="cat-sprite" style="background-image:url(${sheet});background-size:${sprites.columns * sprites.frameSize}px auto;--frames:${frames};--end:${-frames * sprites.frameSize}px;animation-duration:${(frames / (sit?.fps ?? 4)).toFixed(2)}s"></span>`
        : '';
      const hearts = Array.from({ length: p.maxHearts }, (_, i) => `<span class="heart${i < p.hearts ? ' on' : ''}">♥</span>`).join('');
      const personality = t.personalities[p.personality as keyof typeof t.personalities] ?? p.personality;
      const days = p.daysInCafe === 1 ? t.firstDay : t.days.replace('{n}', String(p.daysInCafe));
      return `<div class="cat-card" data-cat="${p.id}" title="${esc(t.locate)}">${sprite}<div class="cat-info">
          <strong>${esc(p.name)}</strong><span class="personality">${esc(personality)}</span>
          <span class="hearts" title="${t.heartsTitle.replace('{n}', String(p.hearts)).replace('{max}', String(p.maxHearts))}">${hearts} <b class="n">${p.hearts}/${p.maxHearts}</b></span>
          <span class="health" title="${t.healthTitle.replace('{n}', String(p.health)).replace('{max}', String(p.maxHealth))}"><span class="label">${t.health}</span><span class="bar"><span class="fill${p.sickness ? ' sick' : healthLow(content.health, p.health) ? ' low' : ''}" style="width:${Math.round((p.health / p.maxHealth) * 100)}%"></span></span></span>
          ${this.careBars(p.id)}
          ${p.sickness ? this.sickHtml(p.sickness) : ''}
          ${this.clinicLines(p)}
          <span class="routine"><span class="${p.fedToday ? 'fed' : 'hungry'}">${p.fedToday ? t.fed : t.hungry}</span> · ${esc(days)}</span>
        </div></div>`;
    });
    return cards.join('') || `<p class="empty">${t.none}</p>`;
  }
}
