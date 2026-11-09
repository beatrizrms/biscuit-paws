import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { RecipeDef } from '../../src/core/recipes';
import { knownIds, parseSave, serializeSave } from '../../src/core/save';
import { GameSession } from '../../src/core/session';
import { lowIngredients } from '../../src/core/shopping';
import { newGameState } from '../../src/core/state';
import { loadContent } from './content';

const content = loadContent();
const recipe = (id: string) => content.recipes[id]!;

describe('lista de compras: o que anotar', () => {
  it('anota o ingrediente com menos doses que o limite; a troca premium também conta', () => {
    const coffee = recipe('recipe.black_coffee');
    const doses: Record<string, number> = { 'item.coffee_ground': 2, 'item.paper_filter': 10 };
    expect(lowIngredients([coffee], (id) => doses[id] ?? 0, 5)).toEqual(['item.coffee_ground']);
    // Com café em grãos (premium) suficiente, o pó não falta.
    doses['item.coffee_beans_bag'] = 5;
    expect(lowIngredients([coffee], (id) => doses[id] ?? 0, 5)).toEqual([]);
  });

  it('não repete o ingrediente de duas receitas', () => {
    const menu: RecipeDef[] = [recipe('recipe.black_coffee'), recipe('recipe.cafe_latte')];
    expect(lowIngredients(menu, () => 0, 5)).toEqual(['item.coffee_ground', 'item.paper_filter', 'item.milk_powder']);
  });
});

describe('lista de compras na sessão', () => {
  const session = () => {
    const state = newGameState(500, 'map.market', 9 * 60);
    state.menu = ['recipe.black_coffee'];
    return new GameSession(content, state);
  };

  it('o botão anota o que falta (sem repetir) e comprar tira da lista', () => {
    const s = session();
    expect(s.addMissingToShoppingList()).toEqual(['item.coffee_ground', 'item.paper_filter']);
    expect(s.addMissingToShoppingList()).toEqual([]);
    expect(s.state.shoppingList).toEqual(['item.coffee_ground', 'item.paper_filter']);
    expect(s.buy('item.coffee_ground')).toEqual({ ok: true });
    expect(s.state.shoppingList).toEqual(['item.paper_filter']);
    s.removeFromShoppingList('item.paper_filter');
    expect(s.state.shoppingList).toEqual([]);
  });

  it('no caixa, tudo o que foi comprado sai da lista', () => {
    const s = session();
    s.addMissingToShoppingList();
    s.addToCart('item.coffee_ground');
    s.addToCart('item.paper_filter');
    expect(s.checkout()).toEqual({ ok: true });
    expect(s.state.shoppingList).toEqual([]);
  });

  it('a lista vai no save; save antigo (v23) começa com a lista vazia', () => {
    const known = knownIds(content);
    const s = session();
    s.addMissingToShoppingList();
    expect(parseSave(serializeSave(s.state, new Date(0)), known).state.shoppingList).toEqual(['item.coffee_ground', 'item.paper_filter']);
    expect(parseSave(readFileSync('tests/fixtures/save_v23.json', 'utf8'), known).state.shoppingList).toEqual([]);
    expect(parseSave(readFileSync('tests/fixtures/save_v24.json', 'utf8'), known).state.shoppingList).toEqual(['item.paper_filter', 'item.milk_powder']);
  });
});
