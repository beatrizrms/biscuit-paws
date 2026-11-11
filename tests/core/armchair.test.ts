import { describe, expect, it } from 'vitest';
import { GameSession } from '../../src/core/session';
import { newGameState } from '../../src/core/state';
import { loadContent } from './content';

const content = loadContent();

describe('poltronas do salão', () => {
  it('ela senta em cada uma das 4 poltronas para descansar, como no sofá', () => {
    for (const id of ['item.armchair_mint', 'item.armchair_pink', 'item.armchair_lilac', 'item.armchair_cream']) {
      const state = newGameState(500, 'map.cafe_main', 10 * 60);
      state.flags['prologue.done'] = true;
      const session = new GameSession(content, state);
      state.placed.push({ uid: 'p1', item: id, at: [4, 9] });
      expect(session.startRest('p1'), id).toEqual({ ok: true });
    }
  });
});
