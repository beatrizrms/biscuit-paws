// Robô garçom (item.waiter_robot): leva a louça suja das mesas e do balcão para a pia ou a lava-louças.
import { describe, expect, it } from 'vitest';
import { GameSession } from '../../src/core/session';
import { newGameState, nowAbs } from '../../src/core/state';
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
  state.milestones.reached['milestone.machine_waiter_server'] = 1;
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
  it('só aparece no Market com a conquista Bandeja cheia (120 clientes desde a inauguração, depois da lava-louças)', () => {
    const state = newGameState(5000, 'map.cafe_main', 9 * 60);
    state.business = 'inaugurated';
    const session = new GameSession(content, state);
    expect(session.buy('item.waiter_robot')).toEqual({ ok: false, reason: 'locked' });
    expect(content.milestones.milestones.find((m) => m.id === 'milestone.machine_waiter')).toMatchObject({ at: 120, track: 'customers_open' });
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

describe('robô garçom que serve (upgrade)', () => {
  /** Cliente esperando um café preto em pé no balcão, e o café pronto em `at` (no balcão). */
  function withOrder(opts: { server: boolean; drinkAt?: [number, number] }) {
    const r = cafe();
    const robot = r.state.placed.find((p) => p.item === 'item.waiter_robot')!;
    if (opts.server) {
      const up = r.session.upgradeOptions(robot.uid).find((o) => o.itemId === 'item.waiter_robot_server');
      expect(up?.cost).toBe(650);
      expect(r.session.upgradePlaced(robot.uid, 'item.waiter_robot_server')).toEqual({ ok: true });
    }
    r.state.service.customers.push({
      id: 'c1', look: 0, stage: 'waiting', kind: 'standing', spot: [6, 9], dishAt: [6, 8], recipe: 'recipe.black_coffee',
      until: nowAbs(r.state) + 90, favorite: null, wantsPremium: false,
    } as never);
    r.state.surfaces.push({ at: opts.drinkAt ?? [8, 8], item: { kind: 'drink', recipe: 'recipe.black_coffee', vessel: 'cup' } });
    return r;
  }

  it('só com a conquista Garçom de primeira (180 clientes) aparece na Assistência', () => {
    const r = cafe();
    delete r.state.milestones.reached['milestone.machine_waiter_server'];
    const robot = r.state.placed.find((p) => p.item === 'item.waiter_robot')!;
    expect(r.session.upgradeOptions(robot.uid)).toEqual([]);
    expect(content.milestones.milestones.find((m) => m.id === 'milestone.machine_waiter_server')).toMatchObject({ at: 180, track: 'customers_open' });
  });

  it('vem pela Assistência (650) e leva o pedido pronto para quem pediu: preço e aviso como se ela servisse', () => {
    const { session, state, events } = withOrder({ server: true });
    const money = state.money;
    advance(session, 30);
    // Servido (e, em 30 minutos, já tomou e foi embora): o aviso de servido é o de sempre.
    expect(events.find((e) => e.name === 'customer.served')?.payload).toMatchObject({ customerId: 'c1', recipeId: 'recipe.black_coffee' });
    expect(state.money).toBeGreaterThan(money);
    expect(state.surfaces.some((s) => s.item.kind === 'drink')).toBe(false);
    expect(events.some((e) => e.name === 'customer.served')).toBe(true);
    expect(events.find((e) => e.name === 'waiter.served')?.payload).toMatchObject({ ok: true });
  });

  it('o robô sem o upgrade não serve (só a louça)', () => {
    const { session, state } = withOrder({ server: false });
    advance(session, 30);
    expect(state.service.customers.find((x) => x.id === 'c1')!.stage).toBe('waiting');
    expect(state.surfaces.some((s) => s.item.kind === 'drink')).toBe(true);
  });

  it('se ela pegar o pedido antes de ele chegar, ele desiste e o cliente continua esperando', () => {
    const { session, state, events } = withOrder({ server: true, drinkAt: [20, 12] });
    advance(session, 1);
    expect(events.some((e) => e.name === 'waiter.going')).toBe(true);
    state.surfaces = state.surfaces.filter((s) => s.item.kind !== 'drink'); // ela pegou
    advance(session, 30);
    expect(state.service.customers.find((x) => x.id === 'c1')!.stage).toBe('waiting');
    expect(events.find((e) => e.name === 'waiter.served')?.payload).toMatchObject({ ok: false });
  });

  it('só leva o pedido certo: pronto de outra receita fica no balcão', () => {
    const { session, state } = withOrder({ server: true });
    state.surfaces = state.surfaces.map((s) => (s.item.kind === 'drink' ? { ...s, item: { ...s.item, recipe: 'recipe.black_tea' } } : s));
    advance(session, 30);
    expect(state.service.customers.find((x) => x.id === 'c1')!.stage).toBe('waiting');
  });
});
