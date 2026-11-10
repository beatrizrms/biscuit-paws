import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { knownIds, parseSave } from '../../src/core/save';
import { GameSession } from '../../src/core/session';
import { newGameState } from '../../src/core/state';
import { loadContent } from './content';

const content = loadContent();

function cafe(at = 'map.cafe_main') {
  const state = newGameState(500, at, 9 * 60);
  state.flags['prologue.done'] = true;
  const session = new GameSession(content, state);
  const events: string[] = [];
  session.bus.onAny((name) => events.push(name));
  return { session, state, sv: session.service, events };
}

describe('despensa', () => {
  it('compra vai para a mochila; guardar no armário passa só os ingredientes para a despensa', () => {
    const { session, state, sv, events } = cafe();
    session.buy('item.coffee_ground');
    session.buy('item.cat_food_basic');
    expect(state.inventory['item.coffee_ground']).toBe(1);
    expect(sv.doses('item.coffee_ground')).toBe(0); // na mochila não conta
    expect(sv.ingredientsInBag()).toBe(1);
    expect(session.chores().some((c) => c.kind === 'pantry')).toBe(true);
    expect(sv.storeInPantry()).toEqual({ ok: true });
    expect(events).toContain('pantry.stored');
    expect(state.pantry).toEqual({ 'item.coffee_ground': 1 });
    expect(state.inventory['item.coffee_ground']).toBeUndefined();
    expect(state.inventory['item.cat_food_basic']).toBe(1); // ração não é ingrediente: fica na mochila
    expect(sv.doses('item.coffee_ground')).toBe(content.items['item.coffee_ground']!.servings);
    expect(session.chores().some((c) => c.kind === 'pantry')).toBe(false);
    expect(sv.storeInPantry()).toEqual({ ok: false, reason: 'nothing_here' });
  });

  it('só no café; o armário fica do lado da pia', () => {
    const { session, sv } = cafe('map.street');
    session.buy('item.coffee_ground');
    expect(sv.storeInPantry()).toEqual({ ok: false, reason: 'not_at_home' });
    const [c, r] = content.service.pantry;
    expect(sv.pantryNear([[c, r + 1]])).toBe(true);
    expect(sv.pantryNear([[c + 5, r + 1]])).toBe(false);
  });

  it('save v26 guarda a despensa; save antigo leva os ingredientes da mochila para a despensa', () => {
    const known = knownIds(content);
    expect(parseSave(readFileSync('tests/fixtures/save_v26.json', 'utf8'), known).state.pantry).toEqual({ 'item.coffee_ground': 2, 'item.paper_filter': 1 });
    const old = JSON.parse(readFileSync('tests/fixtures/save_v25.json', 'utf8'));
    old.inventory = { ...old.inventory, 'item.coffee_ground': 3, 'item.cat_food_basic': 2 };
    const { state } = parseSave(JSON.stringify(old), known);
    expect(state.pantry['item.coffee_ground']).toBe(3);
    expect(state.inventory['item.coffee_ground']).toBeUndefined();
    expect(state.inventory['item.cat_food_basic']).toBe(2);
  });
});

describe('presente da Gabi e chave da padaria (não ficam na mochila)', () => {
  it('o presente vira louça limpa; a chave só deixa a marca (e abre a porta do café)', () => {
    const { session, state } = cafe();
    session.receiveItem('item.dishes_set');
    expect(state.inventory['item.dishes_set']).toBeUndefined();
    expect(state.dishes).toEqual({ cup: 6, glass: 6, plate: 6 });
    session.receiveItem('item.key_bakery');
    expect(state.inventory['item.key_bakery']).toBeUndefined();
    const door = content.maps['map.street']!.doors!.find((d) => d.id === 'door.cafe')!;
    expect(session.canUseDoor(door)).toBe(true);
  });

  it('save antigo com a chave e o presente na mochila: saem dela e viram a marca', () => {
    const old = JSON.parse(readFileSync('tests/fixtures/save_v25.json', 'utf8'));
    old.inventory = { ...old.inventory, 'item.key_bakery': 1, 'item.dishes_set': 1 };
    const { state } = parseSave(JSON.stringify(old), knownIds(content));
    expect(state.inventory['item.key_bakery']).toBeUndefined();
    expect(state.inventory['item.dishes_set']).toBeUndefined();
    expect(state.flags['received.item.key_bakery']).toBe(true);
    expect(state.flags['received.item.dishes_set']).toBe(true);
  });
});
