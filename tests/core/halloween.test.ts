import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { firstDayOf } from '../../src/core/calendar';
import { pickFood } from '../../src/core/halloween';
import { hearts, PLAYER } from '../../src/core/relationships';
import { knownIds, parseSave } from '../../src/core/save';
import { GameSession } from '../../src/core/session';
import { newGameState } from '../../src/core/state';
import { loadContent } from './content';

const content = loadContent();
const HW = content.festive.halloween;
const S = content.seasons;
const dayOf = (d: number) => firstDayOf(S, HW.season) + d - 1;

/** Café com a turma conhecida, num dia do outono. */
function cafe(d: number, time = '10:00') {
  const state = newGameState(500, 'map.cafe_main', 9 * 60);
  const session = new GameSession(content, state);
  session.debugCompleteStory();
  Object.assign(state.flags, { 'prologue.done': true, 'seen.scr.gabi_visit': true, 'met.old_neighbor': true });
  state.day = dayOf(d);
  const [h, m] = time.split(':').map(Number);
  state.time = h! * 60 + m!;
  state.location = 'map.cafe_main';
  session.setPlayerCell([11, 7]);
  state.halloween = null;
  const scripts: string[] = [];
  session.bus.on('script.requested', ({ scriptId }) => scripts.push(scriptId));
  return { state, session, scripts };
}

describe('Noite das Abóboras', () => {
  it('o favorito, se ainda estiver posto; senão o que sobrou', () => {
    expect(pickFood(['recipe.ghost_cookies', 'recipe.web_cupcake'], 'recipe.web_cupcake')).toEqual({ recipe: 'recipe.web_cupcake', favorite: true });
    expect(pickFood(['recipe.ghost_cookies'], 'recipe.web_cupcake')).toEqual({ recipe: 'recipe.ghost_cookies', favorite: false });
    expect(pickFood([], 'recipe.web_cupcake')).toEqual({ recipe: null, favorite: false });
  });

  it('na Semana do Halloween, a Dona Neusa convida no salão e ela tira um amigo', () => {
    const before = cafe(HW.inviteDay - 1);
    before.session.checkHalloween();
    expect(before.state.halloween).toBeNull();
    const { state, session, scripts } = cafe(HW.inviteDay);
    session.checkHalloween();
    expect(state.halloween).toMatchObject({ stage: 'invited' });
    expect(session.halloweenGuests()).toContain(state.halloween!.drawn);
    expect(scripts).toEqual([HW.proposalScript]);
  });

  it('no dia, o café fecha mais cedo e a festa começa na hora', () => {
    const { session, scripts, state } = cafe(HW.day, '17:30');
    session.debugFestive('hw_party');
    state.location = 'map.cafe_main';
    session.setPlayerCell([11, 7]);
    state.time = 18 * 60 + 30;
    expect(session.service.isOpen()).toBe(false);
    state.time = 19 * 60;
    session.checkHalloween();
    expect(scripts).toContain(HW.partyScript);
  });

  it('cada convidado come uma comida posta (o favorito vale mais); sem comida, ninguém fica bravo', () => {
    const { session, state } = cafe(HW.day, '19:00');
    session.debugFestive('hw_party');
    const guests = session.halloweenGuests();
    const gabi = HW.friends.find((f) => f.npc === 'npc.gabi')!;
    state.surfaces.push({ at: [5, 5], item: { kind: 'cake', recipe: gabi.food, portions: 1 } });
    state.surfaces.push({ at: [6, 5], item: { kind: 'drink', recipe: 'recipe.ghost_cookies', vessel: 'plate' } });
    const before = hearts(state, content.relationships, PLAYER, 'npc.gabi');
    const ate = session.halloweenFeast();
    expect(ate.map((a) => a.npc)).toEqual(guests);
    expect(ate.find((a) => a.npc === 'npc.gabi')).toEqual({ npc: 'npc.gabi', recipe: gabi.food, favorite: true });
    expect(ate.filter((a) => a.recipe).length).toBe(2);
    expect(state.surfaces.find((s) => s.at[0] === 5)).toBeUndefined();
    expect(state.surfaces.find((s) => s.at[0] === 6)?.item).toEqual({ kind: 'dirty', vessel: 'plate' });
    expect(hearts(state, content.relationships, PLAYER, 'npc.gabi')).toBeGreaterThanOrEqual(before);
    // Já comeram: não comem de novo.
    expect(session.halloweenFeast()).toEqual([]);
  });

  it('o presente para quem ela tirou: o favorito, outro, ou nenhum (a turma ri)', () => {
    const { session, state, scripts } = cafe(HW.day, '19:00');
    session.debugFestive('hw_party');
    const friend = HW.friends.find((f) => f.npc === state.halloween!.drawn)!;
    state.inventory[friend.likes] = 1;
    session.openHalloweenGiving();
    expect(session.halloweenGivingNow()).toBe(true);
    expect(session.halloweenGiftOptions()).toContain(friend.likes);
    expect(session.halloweenExchange(friend.likes)).toEqual({ dialogue: friend.dialogues.loved });
    expect(state.halloween).toMatchObject({ stage: 'done', result: 'loved', gift: friend.likes });
    expect(state.inventory[friend.likes]).toBeUndefined();
    expect(scripts).toContain(HW.partyEndScript);
    const other = cafe(HW.day, '19:00');
    other.session.debugFestive('hw_party');
    other.session.openHalloweenGiving();
    expect(other.session.halloweenExchange(null)).toEqual({ dialogue: HW.noGiftDialogue });
  });

  it('se ela não vai, a festa passa sem castigo', () => {
    const { session, state } = cafe(HW.day, '21:00');
    session.debugFestive('hw_party');
    session.endDay('home');
    expect(state.halloween?.stage).toBe('missed');
  });

  it('save v39 guarda a festa; v38 chega sem festa', () => {
    const known = knownIds(content);
    expect(parseSave(readFileSync('tests/fixtures/save_v39.json', 'utf8'), known).state.halloween).toEqual({ year: 1, drawn: 'npc.neusa', stage: 'invited', ate: { 'npc.gabi': 'recipe.pumpkin_cake_slice' } });
    expect(parseSave(readFileSync('tests/fixtures/save_v38.json', 'utf8'), known).state.halloween).toBeNull();
  });
});
