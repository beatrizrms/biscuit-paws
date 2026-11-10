import { describe, expect, it } from 'vitest';
import { parseClock, validateDayNight } from '../../src/core/time';
import { GameSession } from '../../src/core/session';
import { newGameState } from '../../src/core/state';
import type { DayEndReason } from '../../src/core/events';
import { loadContent } from './content';

const content = loadContent();
const dn = content.dayNight;

describe('hora-limite da noite', () => {
  function cafe(openTomorrow: boolean) {
    const state = newGameState(500, 'map.cafe_main', 22 * 60);
    state.business = 'soft_open';
    state.story.completed.push(...content.story.beats.map((b) => b.id));
    const session = new GameSession(content, state);
    const tomorrow = session.service.weekday(state.day + 1);
    session.service.setSchedule({ days: Array.from({ length: 7 }, (_, i) => i !== tomorrow || openTomorrow), open: '09:00', close: '18:00' });
    const ended: DayEndReason[] = [];
    session.bus.on('day.ended', ({ reason }) => ended.push(reason));
    return { session, state, ended };
  }
  // Leva o relógio até `clock` (minutos) de minuto em minuto.
  const runUntil = (session: GameSession, clock: number) => {
    const day = session.state.day;
    while (session.state.day === day && session.state.time < clock) session.tickClock(1 / dn.minutesPerSecond);
  };

  it('amanhã tem expediente: meia-noite ela vai para casa e acorda no horário de sempre', () => {
    const { session, state, ended } = cafe(true);
    expect(session.curfew()).toBe(parseClock(dn.curfew));
    runUntil(session, parseClock(dn.curfew) - 1);
    expect(ended).toEqual([]);
    runUntil(session, parseClock(dn.passOut));
    expect(ended).toEqual(['curfew']);
    expect(state.time).toBe(parseClock(dn.dayStart));
  });

  it('véspera de folga: pode ficar até as 2h, e aí vai descansar', () => {
    const { session, state, ended } = cafe(false);
    expect(session.curfew()).toBe(parseClock(dn.curfewBeforeDayOff));
    runUntil(session, parseClock(dn.curfew) + 60);
    expect(ended).toEqual([]);
    runUntil(session, parseClock(dn.passOut) + 60);
    expect(ended).toEqual(['tired']);
    expect(state.time).toBe(parseClock(dn.dayStart));
  });

  it('dados: as horas precisam vir em ordem', () => {
    expect(validateDayNight(dn)).toEqual([]);
    expect(validateDayNight({ ...dn, curfew: '27:00' })).toContain('daynight: precisa de goHomeFrom <= curfew <= curfewBeforeDayOff <= passOut');
  });
});
