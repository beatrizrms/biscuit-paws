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
    expect(session.energy()).toBe(cfg.max - 50 + cfg.restore.coffee.amount);
    expect(state.hands).toEqual([{ kind: 'dirty', vessel: 'cup' }]);
    state.hands = [{ kind: 'drink', recipe: 'recipe.orange_juice', vessel: 'glass' }];
    expect(session.holdingCoffee()).toBe(false);
  });

  it('sofá: senta, recompõe a cada minuto e levanta sozinha quando enche', () => {
    const { session, state } = cafe();
    state.placed.push({ uid: 's1', item: cfg.restore.sofa.items[0]!, at: [5, 6] });
    expect(session.sofaNear([[5, 7]])).toBe('s1');
    expect(session.startRest('s1')).toEqual({ ok: false, reason: 'energy_full' });
    session.spendEnergy(10);
    const changes: (string | null)[] = [];
    session.bus.on('rest.changed', ({ uid }) => changes.push(uid));
    expect(session.startRest('s1')).toEqual({ ok: true });
    session.tickClock(1 / content.dayNight.minutesPerSecond);
    expect(session.energy()).toBe(cfg.max - 10 + cfg.restore.sofa.perMinute);
    for (let i = 0; i < 10; i++) session.tickClock(1 / content.dayNight.minutesPerSecond);
    expect(session.energy()).toBe(cfg.max);
    expect(session.resting()).toBeNull();
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
});
