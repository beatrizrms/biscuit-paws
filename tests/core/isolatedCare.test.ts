import { describe, expect, it } from 'vitest';
import { GameSession } from '../../src/core/session';
import { newGameState } from '../../src/core/state';
import { loadContent } from './content';

const content = loadContent();

describe('gato isolado: repouso no cercadinho limpo', () => {
  it('não pede banho nem brincadeira, e a alegria e a higiene não caem; só o remédio conta', () => {
    const state = newGameState(500, 'map.cafe_main', 10 * 60);
    const session = new GameSession(content, state);
    session.debugCompleteStory();
    const id = Object.keys(state.cats).find((k) => state.cats[k]!.sheltered)!;
    const cat = state.cats[id]!;
    cat.hygiene = 10;
    cat.happiness = 10;
    cat.playedOn = state.day - 20;
    // Com os outros: pede banho e carinho.
    expect(session.catCare(id)!.needs).toEqual(expect.arrayContaining(['dirty', 'sad']));
    // No cercadinho, castrado com o remédio do pós-cirurgia.
    cat.clinic = { stage: 'isolation', until: state.day + 3, procedure: 'neuter' };
    cat.aftercare = { days: 3, dosesGiven: 0, lastDoseDay: null };
    expect(session.catCare(id)!.needs).toEqual(['medicine']);
    session.endDay('home');
    expect(cat.hygiene).toBe(10);
    expect(cat.happiness).toBe(10);
    expect(session.chores().filter((c) => c.kind === 'care' && c.catId === id).map((c) => (c as { need: string }).need)).toEqual(['medicine']);
  });
});
