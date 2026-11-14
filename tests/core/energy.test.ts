import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { energyLevel, energySpeed, validateEnergy } from '../../src/core/energy';
import { knownIds, parseSave } from '../../src/core/save';
import { GameSession } from '../../src/core/session';
import { newGameState } from '../../src/core/state';
import { parseClock } from '../../src/core/time';
import { loadContent } from './content';

const content = loadContent();
const cfg = content.dayNight.energy;

describe('energia (puro)', () => {
  it('cansada com lowAt ou menos; vazia em 0; a velocidade acompanha', () => {
    expect(energyLevel(cfg.lowAt + 1, cfg)).toBe('ok');
    expect(energyLevel(cfg.lowAt, cfg)).toBe('low');
    expect(energyLevel(0, cfg)).toBe('empty');
    expect(energySpeed(cfg.max, cfg)).toBe(1);
    expect(energySpeed(cfg.lowAt, cfg)).toBe(cfg.tiredSpeed);
    expect(energySpeed(0, cfg)).toBe(cfg.emptySpeed);
  });

  it('dados válidos; evento que não gasta energia é recusado', () => {
    expect(validateEnergy(cfg)).toEqual([]);
    expect(validateEnergy({ ...cfg, costs: { 'money.changed': 1 } })[0]).toContain('money.changed');
  });
});

describe('energia na sessão', () => {
  function cafe() {
    const state = newGameState(500, 'map.cafe_main', 10 * 60);
    state.story.completed.push(...content.story.beats.map((b) => b.id));
    const session = new GameSession(content, state);
    return { session, state };
  }

  it('começa cheia; tarefas gastam (louça por peça; mini game pulado não); não passa de 0', () => {
    const { session } = cafe();
    expect(session.energy()).toBe(cfg.max);
    session.bus.emit('dirt.cleaned', { dirtId: 'x' });
    expect(session.energy()).toBe(cfg.max - cfg.costs['dirt.cleaned']!);
    session.bus.emit('dish.washed', { count: 3 });
    expect(session.energy()).toBe(cfg.max - cfg.costs['dirt.cleaned']! - 3 * cfg.costs['dish.washed']!);
    const before = session.energy();
    session.bus.emit('minigame.finished', { gameId: 'wand', outcome: 'ok', coins: 0, skipped: true });
    expect(session.energy()).toBe(before);
    for (let i = 0; i < 200; i++) session.bus.emit('minigame.finished', { gameId: 'grooming', outcome: 'ok', coins: 0, skipped: false });
    expect(session.energy()).toBe(0);
    expect(session.canRun()).toBe(false);
    expect(session.energySpeed()).toBe(cfg.emptySpeed);
  });

  it('acorda cheia; se o dia acabou depois da meia-noite, com menos', () => {
    const { session, state } = cafe();
    session.spendEnergy(90);
    session.endDay('home');
    expect(session.energy()).toBe(cfg.max);
    session.spendEnergy(90);
    state.time = 25 * 60;
    session.endDay('tired');
    expect(session.energy()).toBe(cfg.wakeAfterLateNight);
  });

  it('lembra da hora-limite uma vez, curfewReminder minutos antes', () => {
    const { session, state } = cafe();
    const soon: number[] = [];
    session.bus.on('curfew.soon', ({ minutes }) => soon.push(minutes));
    state.time = session.curfew() - content.dayNight.curfewReminder - 2;
    for (let i = 0; i < 30; i++) session.tickClock(1 / content.dayNight.minutesPerSecond);
    expect(soon).toEqual([content.dayNight.curfewReminder]);
    expect(state.time).toBeLessThan(session.curfew());
    expect(parseClock(content.dayNight.curfew)).toBeGreaterThan(0);
  });

  it('o save guarda a energia; sem o campo, cheia; valor estranho, cheia', () => {
    const known = knownIds(content);
    const { session, state } = cafe();
    session.spendEnergy(40);
    const raw = JSON.parse(readFileSync('tests/fixtures/save_v20.json', 'utf8'));
    expect(new GameSession(content, parseSave(JSON.stringify(raw), known).state).energy()).toBe(cfg.max);
    expect(parseSave(JSON.stringify({ ...raw, energy: state.energy }), known).state.energy).toBe(cfg.max - 40);
    expect(parseSave(JSON.stringify({ ...raw, energy: 'muita' }), known).state.energy).toBeUndefined();
  });

  it('café pronto na mão: toma, recompõe e a xícara fica suja na mão; cheia, não toma', () => {
    const { session, state } = cafe();
    state.hands.push({ kind: 'drink', recipe: 'recipe.black_coffee', vessel: 'cup' });
    expect(session.drinkCoffee()).toEqual({ ok: false, reason: 'energy_full' });
    session.spendEnergy(50);
    expect(session.drinkCoffee()).toEqual({ ok: true });
    expect(session.energy()).toBe(cfg.max - 50 + cfg.restore.coffee.tiers[0]!.amount);
    expect(state.hands).toEqual([{ kind: 'dirty', vessel: 'cup' }]);
    // Suco (copo) e pão de queijo (prato) também: tudo que está pronto se come ou bebe.
    state.hands = [{ kind: 'drink', recipe: 'recipe.orange_juice', vessel: 'glass' }];
    expect(session.holdingCoffee()).toBe(true);
    state.hands = [{ kind: 'drink', recipe: 'recipe.cheese_bread', vessel: 'plate' }];
    expect(session.snackInHands()).toEqual({ recipe: 'recipe.cheese_bread', food: true });
  });

  it('três níveis pela composição: cafeína (café, chá preto) > açúcar (açúcar, mel, chocolate) > o resto', () => {
    const { session } = cafe();
    const [caf, sugar] = cfg.restore.coffee.tiers.map((t) => t.amount);
    expect(caf).toBeGreaterThan(sugar!);
    expect(sugar).toBeGreaterThan(cfg.restore.coffee.otherAmount);
    for (const id of ['recipe.black_coffee', 'recipe.cafe_latte', 'recipe.black_tea', 'recipe.iced_lemon_tea']) expect(session.snackEnergy(id)).toBe(caf);
    for (const id of ['recipe.orange_juice', 'recipe.cake_slice', 'recipe.hot_chocolate', 'recipe.chamomile_honey']) expect(session.snackEnergy(id)).toBe(sugar);
    for (const id of ['recipe.green_tea', 'recipe.bread', 'recipe.cheese_bread', 'recipe.coconut_water']) expect(session.snackEnergy(id)).toBe(cfg.restore.coffee.otherAmount);
  });

  it('comer: o pronto da mão que mais recompõe vai primeiro; a louça fica suja na mão', () => {
    const { session, state } = cafe();
    session.spendEnergy(60);
    const before = session.energy();
    state.hands.push({ kind: 'drink', recipe: 'recipe.bread', vessel: 'plate' }, { kind: 'drink', recipe: 'recipe.cookie', vessel: 'plate' });
    expect(session.drinkCoffee()).toEqual({ ok: true });
    expect(session.energy()).toBeCloseTo(before + cfg.restore.coffee.tiers[1]!.amount, 5);
    expect(state.hands).toEqual([{ kind: 'drink', recipe: 'recipe.bread', vessel: 'plate' }, { kind: 'dirty', vessel: 'plate' }]);
  });

  it('café: um por hora do jogo; o save lembra a hora do último', () => {
    const { session, state } = cafe();
    const every = cfg.restore.coffee.everyMinutes;
    session.spendEnergy(80);
    state.hands.push({ kind: 'drink', recipe: 'recipe.black_coffee', vessel: 'cup' });
    expect(session.drinkCoffee()).toEqual({ ok: true });
    state.hands = [{ kind: 'drink', recipe: 'recipe.black_coffee', vessel: 'cup' }];
    expect(session.drinkCoffee()).toEqual({ ok: false, reason: 'coffee_too_soon' });
    expect(session.coffeeWait()).toBe(every);
    state.time += every - 1;
    expect(session.drinkCoffee()).toEqual({ ok: false, reason: 'coffee_too_soon' });
    expect(session.coffeeWait()).toBe(1);
    const known = knownIds(content);
    const raw = JSON.parse(readFileSync('tests/fixtures/save_v20.json', 'utf8'));
    expect(parseSave(JSON.stringify({ ...raw, lastCoffeeAt: state.lastCoffeeAt }), known).state.lastCoffeeAt).toBe(state.lastCoffeeAt);
    state.time += 1;
    expect(session.drinkCoffee()).toEqual({ ok: true });
    expect(session.energy()).toBe(cfg.max - 80 + 2 * cfg.restore.coffee.tiers[0]!.amount);
  });

  it('sofá: senta (até cheia), recompõe a cada minuto e, ao encher, avisa e continua sentada', () => {
    const { session, state } = cafe();
    state.placed.push({ uid: 's1', item: 'item.sofa', at: [5, 6] });
    expect(session.seatNear([[5, 7]])).toBe('s1');
    expect(session.startRest('s1')).toEqual({ ok: true }); // cheia também senta
    session.stopRest();
    session.spendEnergy(10);
    let full = 0;
    session.bus.on('rest.full', () => full++);
    const changes: (string | null)[] = [];
    session.bus.on('rest.changed', ({ uid }) => changes.push(uid));
    expect(session.startRest('s1')).toEqual({ ok: true });
    session.tickClock(1 / content.dayNight.minutesPerSecond);
    expect(session.energy()).toBe(cfg.max - 10 + cfg.restore.seat.perMinute);
    for (let i = 0; i < 10; i++) session.tickClock(1 / content.dayNight.minutesPerSecond);
    expect(session.energy()).toBe(cfg.max);
    expect(session.resting()).toBe('s1');
    expect(full).toBe(1);
    session.stopRest();
    expect(changes).toEqual(['s1', null]);
  });

  it('brincar com o gato (varinha) recompõe em vez de gastar; outro mini game gasta', () => {
    const { session } = cafe();
    session.spendEnergy(50);
    session.bus.emit('minigame.finished', { gameId: 'wand', outcome: 'ok', coins: 0, skipped: false });
    session.bus.emit('cat.cared', { catId: 'cat.first_stray', gameId: 'wand', happiness: 80, hygiene: 70 });
    expect(session.energy()).toBe(cfg.max - 50 + cfg.restore.play.amount);
    session.bus.emit('minigame.finished', { gameId: 'grooming', outcome: 'ok', coins: 0, skipped: false });
    expect(session.energy()).toBe(cfg.max - 50 + cfg.restore.play.amount - cfg.costs['minigame.finished']!);
  });

  it('cadeira: senta virada para o lado da cadeira; com cliente nela, não; a dela sai dos lugares dos clientes', () => {
    const { session, state } = cafe();
    state.business = 'soft_open';
    state.placed.push({ uid: 'c1', item: 'item.chair_left', at: [8, 6] }, { uid: 't1', item: 'item.table_round', at: [7, 6] });
    session.spendEnergy(30);
    expect(session.seatDef('item.chair_left')?.facing).toBe('left');
    expect(session.seatDef('item.chair_back')).toBeUndefined(); // sem pose de costas ainda
    expect(session.seatNear([[8, 7]])).toBe('c1');
    const spot = (cells: { spot: [number, number] }[]) => cells.some((s) => s.spot[0] === 8 && s.spot[1] === 6);
    expect(spot(session.service.spots())).toBe(true);
    expect(session.startRest('c1')).toEqual({ ok: true });
    expect(spot((session.service as unknown as { freeSpots(): { spot: [number, number] }[] }).freeSpots())).toBe(false);
    session.stopRest();
    state.service.customers.push({ id: 'x', look: 0, stage: 'waiting', kind: 'table', spot: [8, 6], dishAt: [7, 6], recipe: null, until: 99999, favorite: null, wantsPremium: false });
    expect(session.startRest('c1')).toEqual({ ok: false, reason: 'seat_taken' });
  });
});

describe('ingredientes que se comem puros', () => {
  it('fruta, leite, chocolate, amêndoas e mel: come da mochila; pó de café, farinha, açúcar e polpa, não', () => {
    const content = loadContent();
    const edible = (id: string) => content.items[id]?.edible === true;
    for (const id of ['item.orange', 'item.strawberry', 'item.apple', 'item.coconut', 'item.milk', 'item.chocolate', 'item.almond', 'item.honey']) expect(edible(id)).toBe(true);
    for (const id of ['item.coffee_ground', 'item.coffee_beans_bag', 'item.flour', 'item.sugar', 'item.pulp_orange', 'item.tea_black_bag', 'item.eggs']) expect(edible(id)).toBe(false);
    const session = new GameSession(content, newGameState(100, 'map.cafe_main'));
    const cfgE = content.dayNight.energy;
    session.spendEnergy(50);
    session.receiveItem('item.chocolate');
    session.receiveItem('item.flour');
    const before = session.energy();
    expect(session.eatItem('item.flour')).toEqual({ ok: false, reason: 'not_edible' });
    expect(session.eatItem('item.chocolate')).toEqual({ ok: true });
    expect(session.energy()).toBeCloseTo(before + cfgE.restore.coffee.tiers[1]!.amount, 5); // chocolate: açúcar
    expect(session.state.inventory['item.chocolate'] ?? 0).toBe(0);
    session.receiveItem('item.apple');
    expect(session.eatItem('item.apple')).toEqual({ ok: false, reason: 'coffee_too_soon' }); // a pausa é uma por hora
    expect(session.itemEnergy('item.apple')).toBe(cfgE.restore.coffee.otherAmount);
  });
});
