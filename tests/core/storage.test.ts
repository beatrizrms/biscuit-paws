import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { knownIds, parseSave, SAVE_SCHEMA_VERSION, serializeSave } from '../../src/core/save';
import { GameSession } from '../../src/core/session';
import { newGameState } from '../../src/core/state';
import { stackInto, storageAccepts, storeProblem } from '../../src/core/storage';
import { loadContent } from './content';

const content = loadContent();
const known = knownIds(content);
const box = content.items['item.pet_box']!;

/** No café, com gato (a caixa pet pede has.cat) e a caixa posicionada. */
function cafe() {
  const state = newGameState(2000, 'map.cafe_main', 9 * 60);
  state.flags['prologue.done'] = true;
  state.flags['has.cat'] = true;
  const session = new GameSession(content, state);
  expect(session.buy('item.pet_box')).toEqual({ ok: true });
  expect(session.place('item.pet_box', [3, 8])).toEqual({ ok: true });
  const uid = state.placed.find((p) => p.item === 'item.pet_box')!.uid;
  const events: { name: string; payload: unknown }[] = [];
  session.bus.onAny((name, payload) => events.push({ name, payload }));
  return { session, state, uid, events };
}

describe('caixa pet: dados', () => {
  it('8 espaços; aceita os itens dos gatos (ração, areia, brinquedo, cuidado), não ingrediente nem móvel', () => {
    expect(box.storage).toEqual({ slots: 8, accepts: ['pet'] });
    for (const id of ['item.cat_food_basic', 'item.cat_litter', 'item.cat_wand', 'item.cat_brush', 'item.cat_treat_biscuit', 'item.cat_food_sack']) {
      expect(storageAccepts(box.storage!, content.items[id])).toBe(true);
    }
    for (const id of ['item.coffee_ground', 'item.food_bowl', 'item.pet_box']) expect(storageAccepts(box.storage!, content.items[id])).toBe(false);
  });

  it('no Market, aba Pet, grupo Organização (tag pet_storage), depois de ter gato', () => {
    expect(box.tags).toContain('pet_storage');
    expect(box.requires).toEqual({ flag: 'has.cat' });
    expect(content.catalog.tiles[box.tile!]).toMatchObject({ w: 1, h: 1, solid: true });
  });

  it('cheia: um tipo novo não cabe; mais do mesmo tipo cabe sempre', () => {
    const contents = Object.fromEntries(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'].map((x) => [`item.${x}`, 1]));
    expect(storeProblem(box.storage!, contents, content.items['item.cat_litter'])).toBe('storage_full');
    contents['item.cat_litter'] = 2;
    delete contents['item.a'];
    expect(storeProblem(box.storage!, contents, content.items['item.cat_litter'])).toBeNull();
  });

  it('empilhar (puro): só o que o baú já tem sai da mochila', () => {
    const bag = { 'item.x': 3, 'item.y': 2 };
    const chest = { 'item.x': 1 };
    expect(stackInto(bag, chest)).toEqual([['item.x', 3]]);
    expect(bag).toEqual({ 'item.y': 2 });
    expect(chest).toEqual({ 'item.x': 4 });
  });
});

describe('caixa pet: guardar, pegar e empilhar', () => {
  it('tudo chega na mochila; guardar passa todas as unidades para a caixa, pegar devolve', () => {
    const { session, state, uid, events } = cafe();
    session.buy('item.cat_litter');
    session.buy('item.cat_litter');
    expect(state.inventory['item.cat_litter']).toBe(2); // a compra vai para a mochila
    expect(session.storeInStorage(uid, 'item.cat_litter')).toEqual({ ok: true });
    expect(state.inventory['item.cat_litter']).toBeUndefined();
    expect(session.storageContents(uid)).toEqual({ 'item.cat_litter': 2 });
    expect(events.some((e) => e.name === 'storage.changed')).toBe(true);
    expect(session.storeInStorage(uid, 'item.cat_litter')).toEqual({ ok: false, reason: 'nothing_here' }); // a mochila não tem mais
    expect(session.takeFromStorage(uid, 'item.cat_litter')).toEqual({ ok: true });
    expect(state.inventory['item.cat_litter']).toBe(2);
    expect(session.storageContents(uid)).toEqual({});
    expect(session.takeFromStorage(uid, 'item.cat_litter')).toEqual({ ok: false, reason: 'nothing_here' });
  });

  it('não aceita ingrediente nem móvel; 8 tipos no máximo', () => {
    const { session, state, uid } = cafe();
    session.buy('item.coffee_ground');
    expect(session.storeInStorage(uid, 'item.coffee_ground')).toEqual({ ok: false, reason: 'not_accepted' });
    session.buy('item.food_bowl');
    expect(session.storeInStorage(uid, 'item.food_bowl')).toEqual({ ok: false, reason: 'not_accepted' });
    const pets = Object.values(content.items).filter((i) => storageAccepts(box.storage!, i) && !i.deprecated).map((i) => i.id);
    expect(pets.length).toBeGreaterThan(8);
    for (const id of pets) state.inventory[id] = 1;
    for (const id of pets.slice(0, 8)) expect(session.storeInStorage(uid, id)).toEqual({ ok: true });
    expect(session.storeInStorage(uid, pets[8]!)).toEqual({ ok: false, reason: 'storage_full' });
  });

  it('empilhar: repõe da mochila só o que já está na caixa', () => {
    const { session, state, uid } = cafe();
    state.inventory['item.cat_litter'] = 1;
    state.inventory['item.cat_wand'] = 1;
    session.storeInStorage(uid, 'item.cat_litter');
    expect(session.storageStackable(uid)).toBe(0);
    expect(session.stackIntoStorage(uid)).toEqual({ ok: false, reason: 'nothing_here' });
    session.buy('item.cat_litter');
    session.buy('item.cat_litter');
    expect(session.storageStackable(uid)).toBe(2);
    expect(session.stackIntoStorage(uid)).toEqual({ ok: true });
    expect(session.storageContents(uid)).toEqual({ 'item.cat_litter': 3 });
    expect(state.inventory['item.cat_wand']).toBe(1); // não estava na caixa: fica na mochila
  });

  it('o saco que está nas mãos não vai para a caixa', () => {
    const { session, state, uid } = cafe();
    state.inventory['item.cat_food_sack'] = 1;
    state.hands = [{ kind: 'heavy', item: 'item.cat_food_sack' }];
    expect(session.storeInStorage(uid, 'item.cat_food_sack')).toEqual({ ok: false, reason: 'in_hands' });
  });

  it('só perto da caixa, no café', () => {
    const { session, uid } = cafe();
    expect(session.storageNear([[3, 9]])).toBe(uid);
    expect(session.storageNear([[8, 9]])).toBeUndefined();
  });

  it('recolher a caixa para a mochila devolve o que estava dentro', () => {
    const { session, state, uid } = cafe();
    state.inventory['item.cat_litter'] = 3;
    session.storeInStorage(uid, 'item.cat_litter');
    expect(session.pickUp(uid)).toEqual({ ok: true });
    expect(state.inventory['item.cat_litter']).toBe(3);
    expect(state.inventory['item.pet_box']).toBe(1);
    expect(state.petBoxes[uid]).toBeUndefined();
  });
});

describe('despensa: empilhar', () => {
  it('repõe só os ingredientes que a despensa já tem; o resto fica na mochila', () => {
    const { session, state } = cafe();
    const sv = session.service;
    session.buy('item.coffee_ground');
    sv.storeInPantry();
    session.buy('item.coffee_ground');
    session.buy('item.paper_filter');
    expect(sv.pantryStackable()).toBe(1);
    expect(sv.stackInPantry()).toEqual({ ok: true });
    expect(state.pantry['item.coffee_ground']).toBe(2);
    expect(state.inventory['item.paper_filter']).toBe(1);
    expect(sv.stackInPantry()).toEqual({ ok: false, reason: 'nothing_here' });
  });
});

describe('caixa pet: save', () => {
  it('o save guarda o conteúdo das caixas; caixa que não está mais no café e item que sumiu são esquecidos', () => {
    const { session, state, uid } = cafe();
    state.inventory['item.cat_litter'] = 2;
    session.storeInStorage(uid, 'item.cat_litter');
    const raw = JSON.parse(serializeSave(state, new Date()));
    expect(raw.schemaVersion).toBe(SAVE_SCHEMA_VERSION);
    raw.petBoxes[uid]['item.gone'] = 3;
    raw.petBoxes['p999'] = { 'item.cat_litter': 1 };
    const back = parseSave(JSON.stringify(raw), known).state;
    expect(back.petBoxes).toEqual({ [uid]: { 'item.cat_litter': 2 } });
  });

  it('save_v29 traz a caixa pet com o que está dentro', () => {
    const { state } = parseSave(readFileSync('tests/fixtures/save_v29.json', 'utf8'), known);
    expect(state.petBoxes).toEqual({ p1: { 'item.cat_food_basic': 3, 'item.cat_litter': 2 } });
    expect(new GameSession(content, state).storageContents('p1')['item.cat_litter']).toBe(2);
  });

  it('v28 -> v29: saves antigos começam sem nada nas caixas', () => {
    const { state } = parseSave(readFileSync('tests/fixtures/save_v28.json', 'utf8'), known);
    expect(state.petBoxes).toEqual({});
  });
});
