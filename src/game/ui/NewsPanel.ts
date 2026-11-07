// Jornal do celular ("Vila Hoje") e mural de pedidos do mercado: o mesmo painel, com ou sem as notícias.
// Lista os pedidos da vila e aceita pela sessão; quem decide se pode é o núcleo.
import type { GameSession } from '../../core/session';
import { content, uiText } from '../content';

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

export class NewsPanel {
  private el: HTMLElement;
  private body: HTMLElement;
  private mode: 'phone' | 'board' | null = null;

  constructor(
    root: HTMLElement,
    private session: GameSession,
    private onChange: () => void,
    private onAccepted: (title: string) => void,
    private onProblem: (reason: string) => void,
  ) {
    this.el = document.createElement('section');
    this.el.className = 'panel catalog news';
    this.el.innerHTML = `<header><h2></h2><button class="close">${uiText.news.close}</button></header><div class="list"></div>`;
    root.appendChild(this.el);
    this.body = this.el.querySelector('.list') as HTMLElement;
    (this.el.querySelector('.close') as HTMLElement).addEventListener('click', () => this.close());
    for (const ev of ['job.accepted', 'job.progress', 'job.completed', 'day.started'] as const) session.bus.on(ev, () => this.render());
  }

  isOpen(): boolean {
    return this.mode !== null;
  }

  /** phone: o "Vila Hoje" (notícias + pedidos); board: o mural do mercado (só pedidos). */
  open(mode: 'phone' | 'board'): void {
    this.mode = mode;
    (this.el.querySelector('h2') as HTMLElement).textContent = mode === 'phone' ? content.news.app : uiText.news.boardTitle;
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
}
