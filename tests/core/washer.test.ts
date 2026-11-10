import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { knownIds, parseSave, serializeSave } from '../../src/core/save';
import { GameSession } from '../../src/core/session';
import { newGameState } from '../../src/core/state';
import { loadContent } from './content';

const content = loadContent();
const known = knownIds(content);
const advance = (session: GameSession, m: number) => {
  for (let i = 0; i < m; i++) session.tickClock(1 / content.dayNight.minutesPerSecond);
};

/** No café, com a lava-louças posicionada e louça suja nas mãos (pela bandeja, para levar várias). */
function cafe(dirty = 0) {
  const state = newGameState(2000, 'map.cafe_main', 9 * 60);
  state.flags['prologue.done'] = true;
  const session = new GameSession(content, state);
  expect(session.buy('item.dishwasher')).toEqual({ ok: true });
  expect(session.place('item.dishwasher', [5, 8])).toEqual({ ok: true });
  const uid = state.placed.find((p) => p.item === 'item.dishwasher')!.uid;
  state.hands = Array.from({ length: dirty }, () => ({ kind: 'dirty' as const, vessel: 'cup' as const }));
  const events: string[] = [];
  session.bus.onAny((name) => events.push(name));
  return { session, state, sv: session.service, uid, events };
}

describe('lava-louças', () => {
  it('dados: 12 peças, ciclo de 20 min; na aba Eletro (tag equipment), de piso', () => {
    const item = content.items['item.dishwasher']!;
    expect(item.washer).toEqual({ capacity: 12, cycleMinutes: 20 });
    expect(item.tags).toContain('equipment');
    expect(item.placeOn).toBeUndefined();
    expect(content.catalog.tiles[item.tile!]).toMatchObject({ w: 1, h: 1, solid: true });
  });

  it('como a pia: E com louça suja deposita; de mãos livres, liga; em 20 min tudo volta limpo', () => {
    const { session, state, sv, uid, events } = cafe(3);
    expect(sv.washerNear([[5, 9]])).toBe(uid);
    expect(sv.washerNear([[9, 9]])).toBeUndefined();
    expect(sv.washerAction(uid)).toBe('deposit');
    const clean = state.dishes.cup;
    expect(sv.depositInWasher(uid)).toEqual({ ok: true });
    expect(state.hands).toEqual([]);
    expect(sv.washerLoad(uid)).toBe(3);
    expect(sv.dirtyCount()).toBe(3);
    expect(sv.washerAction(uid)).toBe('wash');
    expect(sv.startWasher(uid)).toEqual({ ok: true });
    expect(events).toContain('washer.changed');
    expect(sv.startWasher(uid)).toEqual({ ok: false, reason: 'nothing_here' });
    advance(session, 10);
    expect(sv.washerProgress(uid)).toBeCloseTo(0.5, 1);
    advance(session, 11);
    expect(sv.washerProgress(uid)).toBeUndefined();
    expect(state.dishes.cup).toBe(clean + 3);
    expect(sv.dirtyCount()).toBe(0);
    expect(events).toContain('dish.washed');
  });

  it('ciclo fixo: 12 peças levam os mesmos 20 min (a pia levaria 3 min cada)', () => {
    const { session, state, sv, uid } = cafe();
    for (let i = 0; i < 4; i++) {
      state.hands = Array.from({ length: 3 }, () => ({ kind: 'dirty' as const, vessel: 'plate' as const }));
      expect(sv.depositInWasher(uid)).toEqual({ ok: true });
    }
    expect(sv.washerLoad(uid)).toBe(12);
    state.hands = [{ kind: 'dirty', vessel: 'cup' }];
    expect(sv.depositInWasher(uid)).toEqual({ ok: false, reason: 'washer_full' });
    state.hands = [];
    const plates = state.dishes.plate;
    sv.startWasher(uid);
    advance(session, 21);
    expect(state.dishes.plate).toBe(plates + 12);
  });

  it('não vai para a mochila com louça dentro', () => {
    const { session, sv, uid } = cafe(1);
    sv.depositInWasher(uid);
    expect(session.pickUp(uid)).toEqual({ ok: false, reason: 'washer_busy' });
    sv.startWasher(uid);
    expect(session.pickUp(uid)).toEqual({ ok: false, reason: 'washer_busy' });
    advance(session, 21);
    expect(session.pickUp(uid)).toEqual({ ok: true });
  });

  it('o save guarda a louça dela; save_v31 e o v30 (sem lava-louças) carregam', () => {
    const { state, sv, uid } = cafe(2);
    sv.depositInWasher(uid);
    const back = parseSave(serializeSave(state, new Date()), known).state;
    expect(back.washers[uid]?.load.cup).toBe(2);
    expect(new GameSession(content, back).service.washerLoad(uid)).toBe(2);
    expect(parseSave(readFileSync('tests/fixtures/save_v31.json', 'utf8'), known).state.washers).toEqual({ p2: { load: { cup: 2, glass: 0, plate: 1 }, washing: null } });
    expect(parseSave(readFileSync('tests/fixtures/save_v30.json', 'utf8'), known).state.washers).toEqual({});
  });
});
