import { describe, expect, it } from 'vitest';
import { GameSession } from '../../src/core/session';
import { newGameState } from '../../src/core/state';
import { loadContent } from './content';

const content = loadContent();

describe('receitas nas conquistas', () => {
  it('a receita destrancada guarda o dia e aparece nas conquistas, a mais nova primeiro', () => {
    const state = newGameState(500, 'map.cafe_main', 10 * 60);
    const session = new GameSession(content, state);
    session.debugCompleteStory();
    const learned = session.learnedRecipes();
    expect(learned.total).toBe(Object.keys(content.recipes).length);
    expect(learned.recipes.length).toBeGreaterThan(0);
    // Cada receita conhecida tem o dia em que entrou (a de hoje, numa sessão nova).
    for (const r of learned.recipes) expect(r.day).not.toBeNull();
    // Save antigo (sem o dia): ainda aparece, no fim.
    const oldId = learned.recipes[0]!.id;
    delete state.recipesOn[oldId];
    if (learned.recipes[1]) state.recipesOn[learned.recipes[1].id] = 99;
    const again = session.learnedRecipes().recipes;
    expect(again[again.length - 1]!.id).toBe(oldId);
    expect(again[again.length - 1]!.day).toBeNull();
  });
});
