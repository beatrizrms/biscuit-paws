import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { knownIds, parseSave } from '../../src/core/save';
import { GameSession } from '../../src/core/session';
import { newGameState } from '../../src/core/state';
import { loadContent } from './content';

const content = loadContent();
const untilChairs = content.story.beats.slice(0, content.story.beats.findIndex((b) => b.id === 'story.chairs') + 1).map((b) => b.id);
const advance = (session: GameSession, m: number) => {
  for (let i = 0; i < m; i++) session.tickClock(1 / content.dayNight.minutesPerSecond);
};

/** Café com 80 clientes (bolo de chocolate destrancado), liquidificador, forno, louça e os ingredientes do bolo. */
function bakery(withDisplay = true) {
  const state = newGameState(5000, 'map.cafe_main', 9 * 60);
  state.flags['has.cat'] = true;
  state.service.served = 80;
  state.story.completed.push(...untilChairs);
  state.placed.push({ uid: 'b1', item: 'item.blender', at: [7, 5] }, { uid: 'o1', item: 'item.oven', at: [8, 5] });
  if (withDisplay) state.placed.push({ uid: 'v1', item: 'item.display_case', at: [10, 5] });
  for (const id of ['item.flour', 'item.eggs', 'item.butter', 'item.chocolate', 'item.sugar']) state.pantry[id] = 3;
  const session = new GameSession(content, state);
  session.receiveItem('item.dishes_set');
  const sv = session.service;
  sv.toggleMenu('recipe.cake_slice');
  /** Assa um bolo de chocolate inteiro e deixa ele na mão. */
  const bakeCake = () => {
    expect(sv.prepare('b1', 'recipe.cake_slice')).toEqual({ ok: true });
    advance(session, 6);
    expect(sv.pickUp([7, 5])).toEqual({ ok: true });
    expect(sv.prepare('o1')).toEqual({ ok: true });
    advance(session, 31);
    expect(sv.pickUp([8, 5])).toEqual({ ok: true });
  };
  return { session, state, sv, bakeCake };
}

describe('vitrine e fornada', () => {
  it('os doces só entram no cardápio com uma vitrine; o quadro diz que falta a vitrine', () => {
    const { sv } = bakery(false);
    expect(sv.recipeStatus('recipe.cake_slice')).toBe('equipment');
    expect(sv.missingEquipment('recipe.cake_slice')).toBe('display');
    expect(bakery().sv.recipeStatus('recipe.cake_slice')).toBe('available');
  });

  it('a fornada rende o bolo inteiro (6 fatias) sem usar prato; ele vai para a vitrine', () => {
    const { state, sv, bakeCake } = bakery();
    const plates = sv.cleanFree('plate');
    bakeCake();
    expect(state.hands).toEqual([{ kind: 'cake', recipe: 'recipe.cake_slice', portions: 6, quality: 'simple' }]);
    expect(sv.cleanFree('plate')).toBe(plates);
    expect(sv.storeInDisplay('v1')).toEqual({ ok: true });
    expect(state.hands).toEqual([]);
    expect(sv.displayStock('v1')).toEqual([{ recipe: 'recipe.cake_slice', portions: 6 }]);
    expect(sv.displayPortions('recipe.cake_slice')).toBe(6);
  });

  it('tirar uma fatia usa um prato limpo e diminui o bolo; a última fatia libera o espaço', () => {
    const { state, sv } = bakery();
    state.displays.v1 = [{ recipe: 'recipe.cake_slice', portions: 2 }];
    const plates = state.dishes.plate;
    expect(sv.takeFromDisplay('v1', 0)).toEqual({ ok: true });
    expect(state.hands).toEqual([{ kind: 'drink', recipe: 'recipe.cake_slice', vessel: 'plate' }]);
    expect(state.dishes.plate).toBe(plates - 1);
    expect(sv.displayStock('v1')).toEqual([{ recipe: 'recipe.cake_slice', portions: 1 }]);
    state.hands = [];
    expect(sv.takeFromDisplay('v1', 0)).toEqual({ ok: true });
    expect(state.displays.v1).toBeUndefined();
    expect(sv.takeFromDisplay('v1', 0)).toEqual({ ok: false, reason: 'display_empty' });
  });

  it('um doce pronto guardado devolve o prato limpo; café não vai para a vitrine', () => {
    const { state, sv } = bakery();
    state.hands = [{ kind: 'drink', recipe: 'recipe.paw_cookie', vessel: 'plate' }];
    const plates = state.dishes.plate;
    expect(sv.storeInDisplay('v1')).toEqual({ ok: true });
    expect(state.dishes.plate).toBe(plates + 1);
    state.hands = [{ kind: 'drink', recipe: 'recipe.black_coffee', vessel: 'cup' }];
    expect(sv.storeInDisplay('v1')).toEqual({ ok: false, reason: 'nothing_to_store' });
  });

  it('vitrine cheia (6 espaços) não guarda mais', () => {
    const { state, sv } = bakery();
    state.displays.v1 = Array.from({ length: 6 }, () => ({ recipe: 'recipe.paw_cookie', portions: 1 }));
    state.hands = [{ kind: 'drink', recipe: 'recipe.paw_cookie', vessel: 'plate' }];
    expect(sv.storeInDisplay('v1')).toEqual({ ok: false, reason: 'display_full' });
  });

  it('com fatias na vitrine dá para servir mesmo sem ingredientes, e não assa outro bolo à toa', () => {
    const { state, sv } = bakery();
    state.pantry = {};
    state.pantryOpen = {};
    expect(sv.recipeStatus('recipe.cake_slice')).toBe('ingredients');
    state.displays.v1 = [{ recipe: 'recipe.cake_slice', portions: 3 }];
    expect(sv.recipeStatus('recipe.cake_slice')).toBe('available');
    expect(sv.extraRecipes('b1')).toEqual([]);
  });

  it('com doces dentro, a vitrine não pode ser recolhida, e desenha a arte cheia', () => {
    const { session, state } = bakery();
    const tileOf = () => session.mapData().objects.find((o) => o.id.endsWith('v1'))?.tile;
    expect(tileOf()).toBe('decor_vitrine_vazia');
    state.displays.v1 = [{ recipe: 'recipe.paw_cookie', portions: 1 }];
    expect(tileOf()).toBe('display_case');
    expect(session.pickUp('v1')).toEqual({ ok: false, reason: 'display_not_empty' });
  });

  it('o bolo inteiro só pode ser solto num balcão, nunca no chão', () => {
    const { state, sv } = bakery();
    state.hands = [{ kind: 'cake', recipe: 'recipe.cake_slice', portions: 6 }];
    expect(sv.canPutDown([7, 5], [[7, 6]])).toBe(true);
    expect(sv.putDown([7, 7], [[7, 6]])).toEqual({ ok: false, reason: 'cannot_put_here' });
  });
});

describe('vitrine no save', () => {
  it('save_v30 guarda as vitrines; receita que sumiu e vitrine que não está posicionada são esquecidas', () => {
    const { state } = parseSave(readFileSync('tests/fixtures/save_v30.json', 'utf8'), knownIds(content));
    expect(state.displays).toEqual({
      p21: [{ recipe: 'recipe.cake_slice', portions: 4 }, { recipe: 'recipe.paw_cookie', portions: 1, quality: 'premium' }],
    });
    expect(state.hands).toEqual([{ kind: 'cake', recipe: 'recipe.cake_slice', portions: 6 }]);
  });

  it('save antigo (v29) começa sem nada nas vitrines', () => {
    expect(parseSave(readFileSync('tests/fixtures/save_v29.json', 'utf8'), knownIds(content)).state.displays).toEqual({});
  });
});
