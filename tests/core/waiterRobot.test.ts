// Robô garçom (item.waiter_robot): leva a louça suja das mesas e do balcão para a pia ou a lava-louças.
import { describe, expect, it } from 'vitest';
import { GameSession } from '../../src/core/session';
import { newGameState } from '../../src/core/state';
import { loadContent } from './content';

const content = loadContent();
const advance = (session: GameSession, m: number) => {
  for (let i = 0; i < m; i++) session.tickClock(1 / content.dayNight.minutesPerSecond);
};

/** Café inaugurado, com a conquista do robô, louça suja em `dirty` células e (se `robot`) a base posicionada. */
function cafe(opts: { robot?: boolean; washer?: boolean; dirty?: [number, number][] } = {}) {
  const state = newGameState(5000, 'map.cafe_main', 9 * 60);
  state.flags['prologue.done'] = true;
  state.business = 'inaugurated';
  state.milestones.reached['milestone.machine_waiter'] = 1;
  state.milestones.reached['milestone.machine_dishwasher'] = 1;
  const session = new GameSession(content, state);
  const events: { name: string; payload: unknown }[] = [];
  session.bus.onAny((name, payload) => events.push({ name, payload }));
  if (opts.robot !== false) {
    expect(session.buy('item.waiter_robot')).toEqual({ ok: true });
    expect(session.place('item.waiter_robot', [3, 9])).toEqual({ ok: true });
  }
  if (opts.washer) {
    expect(session.buy('item.dishwasher')).toEqual({ ok: true });
    expect(session.place('item.dishwasher', [5, 8])).toEqual({ ok: true });
  }
  for (const at of opts.dirty ?? []) state.surfaces.push({ at, item: { kind: 'dirty', vessel: 'cup' } });
  return { session, state, events, sv: session.service };
}

describe('robô garçom', () => {
  it('só aparece no Market com a conquista Bandeja cheia (100 clientes desde a inauguração)', () => {
    const state = newGameState(5000, 'map.cafe_main', 9 * 60);
    state.business = 'inaugurated';
    const session = new GameSession(content, state);
    expect(session.buy('item.waiter_robot')).toEqual({ ok: false, reason: 'locked' });
    expect(content.milestones.milestones.find((m) => m.id === 'milestone.machine_waiter')).toMatchObject({ at: 100, track: 'customers_open' });
  });

  it('busca a louça suja, uma por viagem, e deixa na pia; sem o robô, ela fica na mesa', () => {
    const { session, state, events, sv } = cafe({ dirty: [[10, 8], [12, 8]] });
    advance(session, 60);
    expect(state.surfaces.filter((s) => s.item.kind === 'dirty')).toHaveLength(0);
    expect(sv.sinkLoad()).toBe(2);
    expect(events.filter((e) => e.name === 'waiter.going')).toHaveLength(2);
    expect(events.filter((e) => e.name === 'waiter.picked')).toHaveLength(2);
    // A viagem leva tempo (pela distância): não pega na hora.
    const without = cafe({ robot: false, dirty: [[10, 8]] });
    advance(without.session, 30);
    expect(without.state.surfaces).toHaveLength(1);
  });

  it('com a lava-louças, leva para ela; com tudo cheio, espera', () => {
    const { session, state, sv } = cafe({ washer: true, dirty: [[10, 8]] });
    advance(session, 30);
    const washer = state.placed.find((p) => p.item === 'item.dishwasher')!.uid;
    expect(sv.washerLoad(washer)).toBe(1);
    expect(sv.sinkLoad()).toBe(0);
    // Pia cheia e sem lava-louças: a louça fica na mesa até ela lavar.
    const full = cafe({ dirty: [[10, 8]] });
    full.state.sink.load = { cup: content.service.sinkCapacity, glass: 0, plate: 0 };
    advance(full.session, 20);
    expect(full.state.surfaces).toHaveLength(1);
  });

  it('se ela pegar a louça antes, ele volta de mãos vazias (nada some nem duplica)', () => {
    const { session, state, events, sv } = cafe({ dirty: [[20, 12]] });
    advance(session, 1);
    expect(events.some((e) => e.name === 'waiter.going')).toBe(true);
    state.surfaces = []; // ela pegou
    advance(session, 30);
    expect(sv.sinkLoad()).toBe(0);
    expect(events.some((e) => e.name === 'waiter.picked')).toBe(false);
  });
});
