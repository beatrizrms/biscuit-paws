import { describe, expect, it } from 'vitest';
import { premiumIn } from '../../src/core/recipes';
import { loadContent } from './content';

describe('ingredientes premium', () => {
  it('café em grãos (saco) é premium no café preto e no café com leite; pó de café não é premium', () => {
    const recipes = loadContent().recipes;
    expect(premiumIn(recipes, 'item.coffee_beans_bag').map((r) => r.id)).toEqual(expect.arrayContaining(['recipe.black_coffee', 'recipe.cafe_latte']));
    expect(premiumIn(recipes, 'item.coffee_ground')).toEqual([]);
  });

});
