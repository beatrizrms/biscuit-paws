import { describe, expect, it } from 'vitest';
import { calendarEntries } from '../../src/core/calendar';
import { inLunch, isOpenAt, lunchEnd, lunchStart, nextOpening, scheduleProblem, weekdayOf, type Schedule } from '../../src/core/schedule';
import { knownIds, parseSave, serializeSave } from '../../src/core/save';
import { GameSession } from '../../src/core/session';
import { newGameState } from '../../src/core/state';
import { loadContent } from './content';

const content = loadContent();
const rules = content.service.schedule;
const weekdays: Schedule = { days: [true, true, true, true, true, false, false], open: '09:00', close: '18:00' };

describe('horário de funcionamento (puro)', () => {
  it('dia da semana a partir do dia do jogo', () => {
    expect(weekdayOf(1, 2)).toBe(2); // começa numa quarta
    expect(weekdayOf(6, 2)).toBe(0); // dia 6: segunda
    expect(weekdayOf(13, 2)).toBe(0);
  });

  it('aberto só nos dias marcados, de open até antes de close', () => {
    expect(isOpenAt(weekdays, 0, 9 * 60)).toBe(true);
    expect(isOpenAt(weekdays, 0, 18 * 60)).toBe(false);
    expect(isOpenAt(weekdays, 0, 8 * 60 + 59)).toBe(false);
    expect(isOpenAt(weekdays, 5, 12 * 60)).toBe(false); // sábado fechado
  });

  it('regras: pelo menos um dia, dentro do possível, em passos e com horas mínimas', () => {
    expect(scheduleProblem(weekdays, rules)).toBeNull();
    expect(scheduleProblem({ ...weekdays, days: Array(7).fill(false) }, rules)).toBe('no_days');
    expect(scheduleProblem({ ...weekdays, open: '05:00' }, rules)).toBe('out_of_range');
    expect(scheduleProblem({ ...weekdays, close: '23:00' }, rules)).toBe('out_of_range');
    expect(scheduleProblem({ ...weekdays, open: '09:15' }, rules)).toBe('bad_step');
    expect(scheduleProblem({ ...weekdays, open: '17:00' }, rules)).toBe('too_short');
  });

  it('próxima abertura: hoje mais tarde, ou o próximo dia aberto', () => {
    // Sexta (4) às 07:00: abre hoje às 09:00. Sexta às 19:00: só na segunda (3 dias depois).
    expect(nextOpening(weekdays, 10, 7 * 60, 2)).toEqual({ day: 10, open: '09:00' });
    expect(nextOpening(weekdays, 10, 19 * 60, 2)).toEqual({ day: 13, open: '09:00' });
  });
});

describe('calendário', () => {
  it('começos de estação, Natal todo ano e a inauguração até acontecer', () => {
    const s = content.seasons;
    const year = s.daysPerSeason * s.order.length;
    const all = calendarEntries(s, 1, year + 30);
    expect(all.filter((e) => e.id === 'cal.christmas').map((e) => e.day)).toEqual([25, year + 25]);
    expect(all.find((e) => e.id === 'cal.inauguration')?.day).toBe(s.daysPerSeason + 1);
    expect(all.find((e) => e.kind === 'season')).toEqual({ id: `season.spring.${s.daysPerSeason + 1}`, day: s.daysPerSeason + 1, title: 'Começa a primavera', kind: 'season' });
    const hidden = calendarEntries(s, 1, year, (e) => e.id === 'cal.inauguration');
    expect(hidden.some((e) => e.id === 'cal.inauguration')).toBe(false);
  });
});

describe('horário no atendimento', () => {
  function cafe() {
    const state = newGameState(500, 'map.cafe_main', 10 * 60);
    state.business = 'soft_open';
    state.story.completed.push(...content.story.beats.map((b) => b.id));
    const session = new GameSession(content, state);
    return { session, state, sv: session.service };
  }

  it('fora do horário escolhido o café não abre; o save guarda o horário', () => {
    const { sv, state } = cafe();
    expect(sv.isOpen()).toBe(true);
    const closedToday = { ...weekdays, days: weekdays.days.map((_, i) => i !== sv.weekday()) };
    expect(sv.setSchedule(closedToday)).toEqual({ ok: true });
    expect(state.schedule).toEqual(closedToday);
    expect(sv.isOpen()).toBe(false);
    expect(sv.setSchedule({ ...weekdays, days: Array(7).fill(false) })).toEqual({ ok: false, reason: 'no_days' });
  });

  it('ao fechar, a fila vai embora; ela só vai para casa depois do último cliente', () => {
    const { session, sv, state } = cafe();
    state.service.customers.push(
      { id: 'c1', look: 0, stage: 'queue', kind: 'standing', spot: [13, 5], dishAt: [13, 5], recipe: null, until: 99999, favorite: null, wantsPremium: false },
      { id: 'c2', look: 0, stage: 'drinking', kind: 'table', spot: [11, 8], dishAt: [10, 8], recipe: 'recipe.black_coffee', until: state.day * 1440 + 18 * 60 + 30, favorite: null, wantsPremium: false },
    );
    state.time = 18 * 60;
    sv.tick();
    expect(state.service.customers.map((c) => c.id)).toEqual(['c2']); // a fila foi embora; quem consome termina
    expect(session.goHomeProblem()).toBe('customers_inside');
    state.time = 18 * 60 + 30;
    sv.tick();
    expect(state.service.customers).toEqual([]);
    expect(session.canGoHome()).toBe(true);
  });
});

describe('horário de almoço', () => {
  function cafe() {
    const state = newGameState(500, 'map.cafe_main', 10 * 60);
    state.business = 'soft_open';
    state.story.completed.push(...content.story.beats.map((b) => b.id));
    const session = new GameSession(content, state);
    return { session, state, sv: session.service };
  }

  it('o padrão tem almoço às 12:00, por 1 h; sem o campo vale o padrão; null desliga', () => {
    expect(lunchStart(weekdays, rules)).toBe(rules.default.lunch);
    expect(lunchEnd('12:00', rules)).toBe('13:00');
    expect(inLunch({ ...weekdays, lunch: '12:00' }, rules, 12 * 60 + 30)).toBe(true);
    expect(inLunch({ ...weekdays, lunch: '12:00' }, rules, 13 * 60)).toBe(false);
    expect(inLunch({ ...weekdays, lunch: null }, rules, 12 * 60 + 30)).toBe(false);
    expect(scheduleProblem({ ...weekdays, lunch: '12:15' }, rules)).toBe('bad_step');
    expect(scheduleProblem({ ...weekdays, lunch: '13:30' }, rules)).toBeNull();
  });

  it('no almoço não chega cliente novo; a fila e quem já pediu continuam; o café segue aberto', () => {
    const { sv, state } = cafe();
    expect(sv.setSchedule({ ...weekdays, days: Array(7).fill(true), lunch: '12:00' })).toEqual({ ok: true });
    state.service.customers.push({ id: 'c1', look: 0, stage: 'queue', kind: 'standing', spot: [13, 5], dishAt: [13, 5], recipe: null, until: 99999, favorite: null, wantsPremium: false });
    state.time = 12 * 60 + 10;
    state.service.nextCustomerAt = 0;
    const before = state.service.customers.length;
    for (let i = 0; i < 30; i++) {
      state.time += 1;
      sv.tick();
    }
    expect(sv.isOpen()).toBe(true);
    expect(sv.lunchNow()).toBe(true);
    expect(state.service.customers.length).toBeLessThanOrEqual(before); // ninguém novo; c1 continua ou foi sentar
    expect(state.service.customers.some((c) => c.id === 'c1')).toBe(true);
    // Sem almoço: no mesmo horário, chega gente de novo.
    expect(sv.setSchedule({ ...weekdays, days: Array(7).fill(true), lunch: null })).toEqual({ ok: true });
    expect(sv.lunchNow()).toBe(false);
  });

  it('o save guarda o almoço escolhido (e o desligado)', () => {
    const { session, sv } = cafe();
    const known = knownIds(content);
    sv.setSchedule({ ...weekdays, lunch: '13:00' });
    expect(parseSave(serializeSave(session.state, new Date(0)), known).state.schedule?.lunch).toBe('13:00');
    sv.setSchedule({ ...weekdays, lunch: null });
    expect(parseSave(serializeSave(session.state, new Date(0)), known).state.schedule?.lunch).toBeNull();
  });
});

describe('save v15', () => {
  it('guarda o horário escolhido; save antigo (v14) fica com o padrão; formato quebrado volta ao padrão', async () => {
    const { readFileSync } = await import('node:fs');
    const { knownIds, parseSave } = await import('../../src/core/save');
    const known = knownIds(content);
    const raw = readFileSync('tests/fixtures/save_v15.json', 'utf8');
    expect(parseSave(raw, known).state.schedule).toEqual({ days: [true, true, true, true, true, true, false], open: '08:00', close: '17:30' });
    expect(parseSave(readFileSync('tests/fixtures/save_v14.json', 'utf8'), known).state.schedule).toBeNull();
    const broken = JSON.stringify({ ...JSON.parse(raw), schedule: { days: [true], open: 'oito', close: '17:30' } });
    expect(parseSave(broken, known).state.schedule).toBeNull();
  });
});
