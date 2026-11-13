import { describe, expect, it } from 'vitest';
import { firstDayOf } from '../../src/core/calendar';
import { knownIds, parseSave, serializeSave } from '../../src/core/save';
import { GameSession } from '../../src/core/session';
import { newGameState } from '../../src/core/state';
import { loadContent } from './content';

const content = loadContent();
const S = content.seasons;
const picnic = content.festive.gatherings!.find((g) => g.id === 'gath.spring_picnic')!;
const icecream = content.festive.gatherings!.find((g) => g.id === 'gath.icecream_night')!;

/** Café com a turma conhecida, num dia da estação, ela no salão. */
function cafe(season: string, d: number, time = '10:00') {
  const state = newGameState(500, 'map.cafe_main', 9 * 60);
  const session = new GameSession(content, state);
  session.debugCompleteStory();
  Object.assign(state.flags, { 'prologue.done': true, 'seen.scr.gabi_visit': true, 'met.old_neighbor': true });
  state.day = firstDayOf(S, season) + d - 1;
  const [h, m] = time.split(':').map(Number);
  state.time = h! * 60 + m!;
  state.location = 'map.cafe_main';
  session.setPlayerCell([11, 7]);
  const scripts: string[] = [];
  const events: string[] = [];
  session.bus.on('script.requested', ({ scriptId }) => scripts.push(scriptId));
  session.bus.onAny((n) => events.push(n));
  return { state, session, scripts, events };
}

describe('encontros da estação', () => {
  it('piquenique: a Gabi chama na semana antes (não antes), com ela no salão', () => {
    const before = cafe('spring', picnic.proposeDay - 1);
    before.session.checkGatherings();
    expect(before.scripts).toEqual([]);
    const { session, state, scripts } = cafe('spring', picnic.proposeDay);
    session.checkGatherings();
    expect(state.gatherings[picnic.id]?.stage).toBe('invited');
    expect(scripts).toEqual([picnic.proposalScript]);
    expect(session.gatheringsView().map((v) => v.def.id)).toEqual([picnic.id]);
  });

  it('no dia: o café fecha mais cedo; na hora, o encontro na praça; enfeitado, vale mais reputação, corações e o presente', () => {
    const { session, state, scripts, events } = cafe('spring', picnic.day, '15:00');
    state.gatherings[picnic.id] = { year: 1, stage: 'invited' };
    state.flags['service.ready'] = true;
    // Três plantas no café: o preparo.
    for (const [i, at] of ([[3, 7], [5, 7], [7, 8]] as [number, number][]).entries()) {
      const id = ['item.cactus', 'item.succulent_pot', 'item.vase_tulips'][i]!;
      session.receiveItem(id);
      expect(session.place(id, at)).toEqual({ ok: true });
    }
    expect(session.gatheringPrep(picnic)).toEqual([3, 3]);
    state.time = 16 * 60 + 5;
    expect(session.service.isOpen()).toBe(false);
    const rep = session.reputation();
    state.time = 17 * 60;
    session.checkGatherings();
    expect(scripts).not.toContain(picnic.partyScript); // ainda no café: o encontro é na praça
    state.location = 'map.praca';
    session.checkGatherings();
    expect(scripts).toContain(picnic.partyScript);
    session.finishScript(picnic.partyScript);
    expect(state.gatherings[picnic.id]?.stage).toBe('done');
    expect(events).toContain('gathering.done');
    expect(session.reputation()).toBe(rep + picnic.reward.reputation + picnic.reward.prepReputation!);
    expect(state.relationships['player|npc.gabi']).toBeGreaterThanOrEqual(picnic.reward.points);
    expect(state.inventory[picnic.reward.item!]).toBe(1);
  });

  it('convidado e não foi: no fim do dia, perdido', () => {
    const { session, state, events } = cafe('spring', picnic.day, '20:00');
    state.gatherings[picnic.id] = { year: 1, stage: 'invited' };
    session.endDay('home');
    expect(state.gatherings[picnic.id]?.stage).toBe('missed');
    expect(events).toContain('gathering.missed');
  });

  it('noite do sorvete: no dia, os gelados valem o dobro na procura; depois, o sorvete de morango entra no cardápio', () => {
    const { session, state } = cafe('summer', icecream.day, '10:00');
    const cold = content.recipes['recipe.iced_lemon_tea']!;
    const before = session.service.demandWeight(cold);
    state.gatherings[icecream.id] = { year: 1, stage: 'invited' };
    expect(session.service.demandWeight(cold)).toBe(before * 2);
    expect(session.service.unlockedRecipes().some((r) => r.id === 'recipe.strawberry_ice_cream')).toBe(state.milestones.reached['milestone.customers_50'] !== undefined);
    state.time = 19 * 60;
    state.location = 'map.praca';
    session.checkGatherings();
    session.finishScript(icecream.partyScript);
    expect(state.flags['gathering.icecream_night']).toBe(true);
    expect(session.service.unlockedRecipes().some((r) => r.id === 'recipe.strawberry_ice_cream')).toBe(true);
  });

  it('o save guarda o encontro do ano', () => {
    const { state } = cafe('spring', 10);
    state.gatherings[picnic.id] = { year: 1, stage: 'invited' };
    expect(parseSave(serializeSave(state, new Date(0)), knownIds(content)).state.gatherings).toEqual(state.gatherings);
  });
});

describe('a praça no encontro', () => {
  it('de uma hora antes até acabar, a praça fica sem figurantes nem passeios (só os amigos)', () => {
    const { session, state } = cafe('spring', picnic.day, '15:00');
    state.gatherings[picnic.id] = { year: 1, stage: 'invited' };
    expect(session.gatheringHere('map.praca')).toBe(false);
    state.time = 16 * 60 + 10;
    expect(session.gatheringHere('map.praca')).toBe(true);
    expect(session.ambientPeople('map.praca')).toBeNull();
    expect(session.ambientPassersNow('map.praca')).toEqual([]);
    expect(session.neighborWalksNow('map.praca')).toEqual([]);
    expect(session.gatheringHere('map.street')).toBe(false);
    // Acabou: a praça volta ao normal.
    state.time = 17 * 60;
    state.location = 'map.praca';
    session.checkGatherings();
    session.finishScript(picnic.partyScript);
    expect(session.gatheringHere('map.praca')).toBe(false);
  });
});
