// Celular (tecla P) e mural de pedidos do mercado: o mesmo painel. No celular há dois apps: "Vila Hoje"
// (notícias + pedidos da vila) e "Meus gatos" (os gatos abrigados e a relação com cada um).
// Quem decide se um pedido pode ser aceito é o núcleo.
import type { CatProfile, GameSession } from '../../core/session';
import { content, uiText } from '../content';

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

export class NewsPanel {
  private el: HTMLElement;
  private body: HTMLElement;
  private mode: 'phone' | 'board' | null = null;
  /** App aberto no celular. */
  private app: 'news' | 'cats' = 'news';

  constructor(
    root: HTMLElement,
    private session: GameSession,
    private onChange: () => void,
    private onAccepted: (title: string) => void,
    private onProblem: (reason: string) => void,
  ) {
    this.el = document.createElement('section');
    this.el.className = 'panel catalog news';
    this.el.innerHTML = `<header><h2></h2><button class="close">${uiText.news.close}</button></header>
      <nav class="apps"><button data-app="news">${esc(content.news.app)}</button><button data-app="cats">${uiText.cats.app}</button></nav><div class="list"></div>`;
    root.appendChild(this.el);
    this.body = this.el.querySelector('.list') as HTMLElement;
    (this.el.querySelector('.close') as HTMLElement).addEventListener('click', () => this.close());
    this.el.querySelectorAll<HTMLButtonElement>('[data-app]').forEach((b) =>
      b.addEventListener('click', () => {
        this.app = b.dataset.app === 'cats' ? 'cats' : 'news';
        this.render();
      }),
    );
    for (const ev of ['job.accepted', 'job.progress', 'job.completed', 'day.started', 'cat.fed', 'cat.affection_changed', 'cat.named', 'cat.sheltered', 'cat.sick', 'cat.diagnosed', 'cat.medicated', 'cat.cured'] as const) session.bus.on(ev, () => this.render());
  }

  isOpen(): boolean {
    return this.mode !== null;
  }

  /** phone: o "Vila Hoje" (notícias + pedidos); board: o mural do mercado (só pedidos). */
  open(mode: 'phone' | 'board'): void {
    this.mode = mode;
    if (mode === 'board') this.app = 'news';
    this.el.classList.toggle('phone', mode === 'phone');
    this.render();
    this.el.classList.add('open');
    this.onChange();
  }

  close(): void {
    if (!this.mode) return;
    this.mode = null;
    this.el.classList.remove('open');
    this.onChange();
  }

  private render(): void {
    if (!this.mode) return;
    const phone = this.mode === 'phone';
    (this.el.querySelector('h2') as HTMLElement).textContent = !phone ? uiText.news.boardTitle : this.app === 'cats' ? uiText.cats.app : content.news.app;
    this.el.querySelectorAll<HTMLButtonElement>('[data-app]').forEach((b) => b.classList.toggle('on', b.dataset.app === this.app));
    if (phone && this.app === 'cats') return this.renderCats();
    const s = this.session;
    const news =
      this.mode === 'phone'
        ? `<p class="date">${uiText.day} ${s.state.day}</p>` +
          s.news().map((n) => `<article><h3>${esc(n.headline)}</h3><p>${esc(n.text)}</p></article>`).join('')
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
    this.body.innerHTML = `${news}<h3 class="jobs-title">${uiText.news.jobsTitle}</h3>${jobs}`;
    this.body.querySelectorAll<HTMLButtonElement>('[data-job]').forEach((btn) =>
      btn.addEventListener('click', () => {
        const id = btn.dataset.job!;
        const result = s.acceptJob(id);
        if (!result.ok) return this.onProblem(result.reason);
        this.onAccepted(content.jobs[id]!.title);
      }),
    );
  }

  /** "Doente: Febre do Bigode · remédio 2/5 (hoje: ok)". */
  private sickText(s: NonNullable<CatProfile['sickness']>): string {
    const t = uiText.cats;
    const name = content.health.diseases.find((d) => d.id === s.disease)?.name ?? s.disease;
    if (!s.treatment) return t.sickUntreated.replace('{disease}', name);
    return t.sickTreated
      .replace('{disease}', name)
      .replace('{n}', String(s.treatment.dosesGiven))
      .replace('{days}', String(s.treatment.days))
      .replace('{today}', s.treatment.dosedToday ? t.dosedToday : t.doseDue);
  }

  /** App "Meus gatos": uma ficha por gato abrigado, com o gato sentado (animado), corações e a rotina. */
  private renderCats(): void {
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
      return `<div class="cat-card">${sprite}<div class="cat-info">
          <strong>${esc(p.name)}</strong><span class="personality">${esc(personality)}</span>
          <span class="hearts" title="${t.heartsTitle.replace('{n}', String(p.hearts)).replace('{max}', String(p.maxHearts))}">${hearts} <b class="n">${p.hearts}/${p.maxHearts}</b></span>
          <span class="health" title="${t.healthTitle.replace('{n}', String(p.health)).replace('{max}', String(p.maxHealth))}"><span class="label">${t.health}</span><span class="bar"><span class="fill${p.sickness ? ' sick' : p.health < content.health.sickBelow + 20 ? ' low' : ''}" style="width:${Math.round((p.health / p.maxHealth) * 100)}%"></span></span></span>
          ${p.sickness ? `<span class="sick-badge">${esc(this.sickText(p.sickness))}</span>` : ''}
          <span class="routine"><span class="${p.fedToday ? 'fed' : 'hungry'}">${p.fedToday ? t.fed : t.hungry}</span> · ${esc(days)}</span>
        </div></div>`;
    });
    this.body.innerHTML = cards.join('') || `<p class="empty">${t.none}</p>`;
  }
}
