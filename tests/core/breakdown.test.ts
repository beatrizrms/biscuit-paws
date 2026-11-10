import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { knownIds, parseSave, serializeSave } from '../../src/core/save';
import { GameSession } from '../../src/core/session';
import { newGameState } from '../../src/core/state';
import { loadContent } from './content';

const content = loadContent();
const known = knownIds(content);
const cfg = content.service.breakdown!;
const advance = (session: GameSession, m: number) => {
  for (let i = 0; i < m; i++) session.tickClock(1 / content.dayNight.minutesPerSecond);
};

/** Café inaugurado com a cafeteira (no balcão), a lava-louças e um cliente esperando café. */
function cafe() {
  const state = newGameState(500, 'map.cafe_main', 9 * 60);
  state.flags['prologue.done'] = true;
  state.business = 'inaugurated';
  const session = new GameSession(content, state);
  const put = (item: string, at: [number, number]) => {
    expect(session.buy(item)).toEqual({ ok: true });
    expect(session.place(item, at)).toEqual({ ok: true });
    return state.placed.find((p) => p.item === item)!.uid;
  };
  put('item.counter_single', [7, 5]);
  const machine = put('item.coffee_machine', [7, 5]);
  const washer = put('item.dishwasher', [5, 8]);
  session.receiveItem('item.dishes_set');
  session.service.toggleMenu('recipe.black_coffee');
  const events: { name: string; payload: unknown }[] = [];
  session.bus.onAny((name, payload) => events.push({ name, payload }));
  return { session, state, sv: session.service, machine, washer, events };
}

describe('quebra de equipamento', () => {
  it('dados: entre 300 e 500 usos; o conserto do Tião custa 20 e leva 15 minutos', () => {
    expect(cfg).toEqual({ minUses: 300, maxUses: 500, repairPrice: 20, repairMinutes: 15 });
  });

  it('cada preparo conta um uso; no limite sorteado (300 a 500) quebra e não prepara mais', () => {
    const { state, sv, machine, events } = cafe();
    // Um uso de verdade sorteia o limite.
    state.inventory = {};
    sv.prepare(machine, 'recipe.black_coffee'); // sem ingrediente: não conta
    expect(state.wear[machine]).toBeUndefined();
    state.pantry['item.coffee_ground'] = 99;
    state.pantry['item.paper_filter'] = 99;
    expect(sv.prepare(machine, 'recipe.black_coffee')).toEqual({ ok: true });
    const w = state.wear[machine]!;
    expect(w.uses).toBe(1);
    expect(w.breaksAt).toBeGreaterThanOrEqual(300);
    expect(w.breaksAt).toBeLessThanOrEqual(500);
    // Pula para o último uso antes de quebrar.
    state.service.preps = [];
    state.surfaces = [];
    w.uses = w.breaksAt - 1;
    expect(sv.prepare(machine, 'recipe.black_coffee')).toEqual({ ok: true });
    expect(sv.isBroken(machine)).toBe(true);
    expect(events.some((e) => e.name === 'equipment.broke')).toBe(true);
    state.service.preps = [];
    state.surfaces = [];
    expect(sv.prepare(machine, 'recipe.black_coffee')).toEqual({ ok: false, reason: 'broken' });
    expect(sv.brokenEquipment()).toEqual([machine]);
    expect(sv.stationHasWork(machine)).toBe(true); // o E vai nela (para chamar o Tião)
  });

  it('o limite sorteado (RNG do jogo) fica sempre entre 300 e 500', () => {
    const limits = new Set<number>();
    for (let i = 0; i < 6; i++) {
      const { state, sv, machine } = cafe();
      state.day = i + 1; // outro dia, outra semente
      state.pantry['item.coffee_ground'] = 9;
      state.pantry['item.paper_filter'] = 9;
      sv.prepare(machine, 'recipe.black_coffee');
      limits.add(state.wear[machine]!.breaksAt);
    }
    for (const n of limits) expect(n >= 300 && n <= 500).toBe(true);
  });

  it('o Tião conserta: 20 moedas, 15 minutos; volta a funcionar com o contador do zero', () => {
    const { session, state, sv, machine, events } = cafe();
    state.wear[machine] = { uses: 400, breaksAt: 400, broken: true };
    expect(sv.callRepair('p999')).toEqual({ ok: false, reason: 'nothing_here' });
    state.money = 10;
    expect(sv.callRepair(machine)).toEqual({ ok: false, reason: 'no_money' });
    state.money = 100;
    expect(sv.callRepair(machine)).toEqual({ ok: true });
    expect(state.money).toBe(80);
    expect(events.some((e) => e.name === 'equipment.repair_started')).toBe(true);
    expect(sv.isRepairing(machine)).toBe(true);
    expect(sv.callRepair(machine)).toEqual({ ok: false, reason: 'station_busy' });
    expect(sv.prepare(machine, 'recipe.black_coffee')).toEqual({ ok: false, reason: 'broken' }); // ainda consertando
    advance(session, 8);
    expect(sv.repairProgress(machine)).toBeCloseTo(0.5, 0);
    advance(session, 8);
    expect(sv.isBroken(machine)).toBe(false);
    expect(state.wear[machine]!.uses).toBe(0);
    expect(state.wear[machine]!.breaksAt).toBeGreaterThanOrEqual(300);
    expect(events.some((e) => e.name === 'equipment.repaired')).toBe(true);
  });

  it('a lava-louças também: cada ciclo é um uso; quebrada, não liga', () => {
    const { state, sv, washer } = cafe();
    state.hands = [{ kind: 'dirty', vessel: 'cup' }];
    sv.depositInWasher(washer);
    expect(sv.startWasher(washer)).toEqual({ ok: true });
    expect(state.wear[washer]!.uses).toBe(1);
    state.washers[washer] = { load: { cup: 1, glass: 0, plate: 0 }, washing: null };
    state.wear[washer] = { uses: 300, breaksAt: 300, broken: true };
    expect(sv.startWasher(washer)).toEqual({ ok: false, reason: 'broken' });
  });

  it('quebrado não vai para a mochila (guardar e pôr de novo não conserta)', () => {
    const { session, state, washer } = cafe();
    state.wear[washer] = { uses: 300, breaksAt: 300, broken: true };
    expect(session.pickUp(washer)).toEqual({ ok: false, reason: 'equipment_broken' });
  });

  it('save v32 guarda o desgaste; save_v32 traz a lava-louças quebrada; v31 começa sem desgaste', () => {
    const { state, machine } = cafe();
    state.wear[machine] = { uses: 12, breaksAt: 345 };
    const back = parseSave(serializeSave(state, new Date()), known).state;
    expect(back.wear[machine]).toEqual({ uses: 12, breaksAt: 345 });
    expect(parseSave(readFileSync('tests/fixtures/save_v32.json', 'utf8'), known).state.wear).toEqual({ p2: { uses: 410, breaksAt: 410, broken: true } });
    expect(parseSave(readFileSync('tests/fixtures/save_v31.json', 'utf8'), known).state.wear).toEqual({});
  });
});
