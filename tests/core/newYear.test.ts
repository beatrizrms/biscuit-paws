import { describe, expect, it } from 'vitest';
import { pairKey } from '../../src/core/relationships';
import { GameSession } from '../../src/core/session';
import { newGameState } from '../../src/core/state';
import { parseClock } from '../../src/core/time';
import { loadContent } from './content';

const content = loadContent();
const NY = content.festive.newYear;
const S = content.seasons;
const YEAR = S.daysPerSeason * S.order.length;
const EVE = NY.day; // inverno 30 do primeiro ano
const HALL: [number, number] = [10, 7];

function cafe(day: number, time: number) {
  const state = newGameState(500, 'map.cafe_main', time);
  state.day = day;
  state.business = 'soft_open';
  state.story.completed.push(...content.story.beats.map((b) => b.id));
  Object.assign(state.flags, { 'prologue.done': true, 'seen.scr.gabi_visit': true, 'met.old_neighbor': true });
  const session = new GameSession(content, state);
  session.setPlayerCell(HALL); // no salão
  const events: { name: string; payload: unknown }[] = [];
  session.bus.onAny((name, payload) => events.push({ name, payload }));
  return { session, state, events };
}
const named = (events: { name: string; payload: unknown }[], name: string) => events.filter((e) => e.name === name).map((e) => e.payload);

describe('Ano Novo: fogos à meia-noite na rua', () => {
  it('na véspera, a hora-limite vai além da meia-noite; ir para casa antes não é proibido', () => {
    const eve = cafe(EVE, 22 * 60);
    expect(eve.session.curfew()).toBe(parseClock(NY.curfew));
    expect(eve.session.goHomeProblem()).toBeNull();
    const before = cafe(EVE - 1, 22 * 60);
    expect(before.session.curfew()).toBeLessThan(parseClock(NY.curfew));
    expect(before.session.goHomeProblem()).toBeNull();
  });

  it('na hora de juntar, o roteiro dos fogos (uma vez); os amigos que ela conhece ganham coração', () => {
    const { session, state, events } = cafe(EVE, parseClock(NY.gatherAt) - 1);
    session.checkNewYear();
    expect(named(events, 'script.requested')).toEqual([]);
    state.time = parseClock(NY.gatherAt);
    session.checkNewYear();
    session.checkNewYear();
    expect(named(events, 'script.requested')).toEqual([{ scriptId: NY.script }]);
    expect(named(events, 'newyear.started')).toEqual([{ friends: ['npc.gabi', 'npc.joca', 'npc.neusa', 'npc.realtor'] }]);
    expect(state.relationships[pairKey('player', 'npc.neusa')]).toBe(NY.points);
    expect(session.goHomeProblem()).toBeNull();
  });

  it('com ela no porão, os fogos esperam ela voltar para o salão', () => {
    const { session, events } = cafe(EVE, parseClock(NY.gatherAt));
    session.setPlayerCell([20, 5]);
    session.checkNewYear();
    expect(named(events, 'script.requested')).toEqual([]);
    session.setPlayerCell(HALL);
    session.checkNewYear();
    expect(named(events, 'script.requested')).toEqual([{ scriptId: NY.script }]);
  });

  it('antes do fim do prólogo, não tem fogos; no ano seguinte, tem de novo', () => {
    const early = cafe(EVE, parseClock(NY.gatherAt));
    delete early.state.flags['prologue.done'];
    early.session.checkNewYear();
    expect(named(early.events, 'script.requested')).toEqual([]);

    const { session, state, events } = cafe(YEAR + EVE, parseClock(NY.gatherAt));
    state.flags['newyear.seen.1'] = true;
    session.checkNewYear();
    expect(named(events, 'script.requested')).toEqual([{ scriptId: NY.script }]);
    expect(state.flags['newyear.seen.2']).toBe(true);
  });

  it('debug: pula para o sorteio, a ceia e os fogos, um minuto antes', () => {
    const { session, state } = cafe(3, 10 * 60);
    session.debugFestive('draw');
    expect([state.day, state.time, state.secretSanta]).toEqual([content.festive.secretSanta.drawDay, 9 * 60 + 59, null]);
    session.debugFestive('party');
    expect([state.day, state.time, state.secretSanta?.stage]).toEqual([content.festive.secretSanta.day, 18 * 60 + 59, 'drawn']);
    state.flags['newyear.seen.1'] = true;
    session.debugFestive('newyear');
    expect([state.day, state.time, session.newYearPending()]).toEqual([EVE, 23 * 60 + 29, true]);
    session.debugFestive('draw'); // já passou: o do ano que vem
    expect(state.day).toBe(YEAR + content.festive.secretSanta.drawDay);
  });

  it('fogos: o aviso de que começaram; a cena só com ela na rua ou no salão; perdeu, só um aviso', () => {
    const { session, state, events } = cafe(EVE, parseClock(NY.gatherAt));
    session.setPlayerCell([20, 5]); // no porão
    session.checkNewYear();
    session.checkNewYear();
    expect(named(events, 'event.starting')).toEqual([{ id: 'new_year' }]);
    expect(named(events, 'script.requested')).toEqual([]);
    state.location = 'map.street';
    session.checkNewYear();
    expect(named(events, 'script.requested')).toEqual([{ scriptId: NY.script }]);
    const missed = cafe(EVE, 21 * 60);
    missed.session.endDay('home');
    expect(named(missed.events, 'newyear.missed')).toEqual([{}]);
  });

  it('a manhã do último dia do ano avisa dos fogos', () => {
    const { session, events } = cafe(EVE - 1, 20 * 60);
    session.endDay('home');
    expect(named(events, 'newyear.eve')).toEqual([{ gatherAt: NY.gatherAt }]);
  });
});
