// App "Calendário" do celular: a estação em grade (semana de segunda a domingo), hoje marcado, os dias
// importantes (começo de estação, Natal, a inauguração...) e os dias em que o café fica fechado pelo horário.
// Embaixo, os próximos dias marcados. As marcações vêm de data/seasons.json (session.calendar).
import { dayInSeason, seasonOf } from '../../core/calendar';
import type { GameSession } from '../../core/session';
import { content, uiText } from '../content';

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

/** Quantos dias à frente a lista "Próximos dias" olha. */
const AHEAD = 60;

export class CalendarApp {
  /** Estação vista: quantas estações a partir de hoje (0 = a de agora). */
  private offset = 0;

  constructor(private session: GameSession) {}

  /** Ao abrir o app, volta para a estação de hoje. */
  reset(): void {
    this.offset = 0;
  }

  render(body: HTMLElement): void {
    const t = uiText.calendarApp;
    const seasons = content.seasons;
    const per = seasons.daysPerSeason;
    const today = this.session.state.day;
    const sv = this.session.service;
    const schedule = sv.schedule();
    // Primeiro dia (do jogo) da estação vista.
    const first = Math.max(1, Math.floor((today - 1) / per) * per + 1 + this.offset * per);
    const last = first + per - 1;
    const season = seasonOf(seasons, first);
    const year = Math.floor((first - 1) / (per * seasons.order.length)) + 1;
    const marks = this.session.calendar(first, last);
    const lead = sv.weekday(first);
    const cells: string[] = Array.from({ length: lead }, () => '<span class="c-cell blank"></span>');
    for (let d = first; d <= last; d++) {
      const here = marks.filter((m) => m.day === d);
      const closed = sv.enabled() && d >= today && !schedule.days[sv.weekday(d)];
      const cls = ['c-cell', d === today ? 'today' : '', d < today ? 'past' : '', here.length ? `mark ${here[0]!.kind}` : '', closed ? 'closed' : ''].filter(Boolean).join(' ');
      const title = [...here.map((m) => m.title), closed ? t.closed : ''].filter(Boolean).join(' · ');
      cells.push(`<span class="${cls}"${title ? ` title="${esc(title)}"` : ''}>${dayInSeason(seasons, d)}</span>`);
    }
    const head = uiText.weekdays.map((w) => `<span class="c-wd">${esc(w)}</span>`).join('');
    const upcoming = this.session.calendar(today, today + AHEAD)
      .map((m) => {
        const n = m.day - today;
        const when = n === 0 ? t.today : n === 1 ? t.tomorrow : t.inDays.replace('{n}', String(n));
        const date = t.entryDay
          .replace('{season}', seasons.names[seasonOf(seasons, m.day)] ?? '')
          .replace('{day}', String(dayInSeason(seasons, m.day)))
          .replace('{weekday}', uiText.weekdays[sv.weekday(m.day)]!);
        return `<li class="${m.kind}"><b>${esc(m.title)}</b><span>${esc(date)} · ${esc(when)}</span></li>`;
      })
      .join('');
    body.innerHTML = `<div class="c-head"><button data-move="-1" title="${t.prev}" ${first <= 1 ? 'disabled' : ''}>‹</button>
        <strong>${esc(seasons.names[season] ?? season)}</strong><span class="c-year">${esc(t.year.replace('{n}', String(year)))}</span>
        <button data-move="1" title="${t.next}">›</button></div>
      <div class="c-grid">${head}${cells.join('')}</div>
      <h3>${esc(t.upcoming)}</h3>${upcoming ? `<ul class="c-list">${upcoming}</ul>` : `<p class="empty">${esc(t.none)}</p>`}`;
    body.querySelectorAll<HTMLButtonElement>('[data-move]').forEach((b) =>
      b.addEventListener('click', () => {
        this.offset += Number(b.dataset.move);
        this.render(body);
      }),
    );
  }
}
