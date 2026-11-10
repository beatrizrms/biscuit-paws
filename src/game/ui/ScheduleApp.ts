// App "Horário" do celular: em quais dias da semana o café abre e de que horas a que horas (como um agendador).
// Muda na hora; quem decide se o horário vale (passos, mínimo de horas, limites) é o núcleo (src/core/schedule.ts).
import { WEEK, type Schedule } from '../../core/schedule';
import type { GameSession } from '../../core/session';
import { formatClock, parseClock } from '../../core/time';
import { content, uiText } from '../content';

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

/** "hoje às 09:00", "amanhã às 09:00" ou "seg às 09:00": quando o café abre de novo. */
export function openingText(session: GameSession): string {
  const next = session.service.nextOpening();
  if (!next) return '';
  const t = uiText.scheduleApp;
  const ahead = next.day - session.state.day;
  const text = ahead === 0 ? t.today : ahead === 1 ? t.tomorrow : t.onDay.replace('{weekday}', uiText.weekdays[session.service.weekday(next.day)]!);
  return text.replace('{time}', next.open);
}

/** "de seg a sex" / "todos os dias" / "seg, qua, sex". */
export function daysText(days: boolean[]): string {
  if (days.every(Boolean)) return uiText.scheduleApp.everyDay;
  return uiText.weekdays.filter((_, i) => days[i]).join(', ');
}

export class ScheduleApp {
  constructor(
    private session: GameSession,
    private problem: (reason: string) => void,
  ) {}

  render(body: HTMLElement): void {
    const t = uiText.scheduleApp;
    const sv = this.session.service;
    const s = sv.schedule();
    const status = !sv.enabled()
      ? t.status.disabled
      : sv.isOpen()
        ? t.status.open.replace('{close}', s.close)
        : t.status.closed.replace('{when}', openingText(this.session));
    const today = sv.weekday();
    const days = uiText.weekdays
      .map((d, i) => `<button class="s-day${s.days[i] ? ' on' : ''}${i === today ? ' today' : ''}" data-day="${i}" aria-pressed="${s.days[i]}">${esc(d)}</button>`)
      .join('');
    const time = (key: 'open' | 'close', label: string) => `<div class="s-time"><span class="s-label">${esc(label)}</span>
        <button data-time="${key}" data-step="-1" title="${t.earlier}">−</button><b>${s[key]}</b><button data-time="${key}" data-step="1" title="${t.later}">+</button></div>`;
    body.innerHTML = `<p class="s-status ${sv.isOpen() ? 'open' : 'closed'}">${esc(status)}</p>
      <h3>${esc(t.days)}</h3><div class="s-days">${days}</div>
      <h3>${esc(t.hours)}</h3>${time('open', t.opens)}${time('close', t.closes)}
      <p class="s-summary">${esc(t.summary.replace('{days}', daysText(s.days)).replace('{open}', s.open).replace('{close}', s.close))}</p>
      <p class="m-hint">${esc(t.hint)}</p>`;
    body.querySelectorAll<HTMLButtonElement>('[data-day]').forEach((b) =>
      b.addEventListener('click', () => {
        const i = Number(b.dataset.day);
        this.apply({ ...s, days: s.days.map((on, k) => (k === i ? !on : on)) }, body);
      }),
    );
    body.querySelectorAll<HTMLButtonElement>('[data-time]').forEach((b) =>
      b.addEventListener('click', () => {
        const rules = content.service.schedule;
        const key = b.dataset.time as 'open' | 'close';
        const next = parseClock(s[key]) + Number(b.dataset.step) * rules.stepMinutes;
        const clamped = Math.max(parseClock(rules.earliest), Math.min(parseClock(rules.latest), next));
        this.apply({ ...s, [key]: formatClock(clamped, rules.stepMinutes) }, body);
      }),
    );
  }

  private apply(s: Schedule, body: HTMLElement): void {
    if (s.days.length !== WEEK) return;
    const r = this.session.service.setSchedule(s);
    if (!r.ok) this.problem(r.reason);
    this.render(body);
  }
}
