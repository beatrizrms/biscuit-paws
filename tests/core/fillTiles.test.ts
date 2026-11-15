// Tigela de ração e caixa de areia: arte cheia no dia em que ela encheu (ou trocou a areia), vazia nos outros.
import { describe, expect, it } from 'vitest';
import { GameSession } from '../../src/core/session';
import { newGameState } from '../../src/core/state';
import { PLACED_PREFIX } from '../../src/core/placement';
import { loadContent } from './content';

const content = loadContent();

function cafe() {
  const state = newGameState(500, 'map.cafe_main', 9 * 60);
  state.flags['has.cat'] = true;
  const session = new GameSession(content, state);
  const put = (item: string, at: [number, number]) => {
    expect(session.buy(item)).toEqual({ ok: true });
    expect(session.place(item, at)).toEqual({ ok: true });
    return state.placed.find((p) => p.item === item)!;
  };
  return { session, state, put };
}

const tileOf = (session: GameSession, uid: string) => session.mapData('map.cafe_main').objects.find((o) => o.id === PLACED_PREFIX + uid)?.tile;

describe('arte cheia e vazia (fillTiles)', () => {
  it('tigela de ração: cheia só no dia em que ela encheu', () => {
    const { session, state, put } = cafe();
    const bowl = put('item.food_bowl', [10, 8]);
    expect(tileOf(session, bowl.uid)).toBe('food_bowl');
    bowl.refilledOn = state.day;
    expect(tileOf(session, bowl.uid)).toBe('food_bowl_cheia');
    state.day += 1;
    expect(tileOf(session, bowl.uid)).toBe('food_bowl');
  });

  it('caixa de areia: vazia até ela trocar a areia no dia', () => {
    const { session, state, put } = cafe();
    const box = put('item.litter_box', [12, 8]);
    expect(tileOf(session, box.uid)).toBe('litter_box_vazia');
    box.refilledOn = state.day;
    expect(tileOf(session, box.uid)).toBe('ph_litter_box');
  });

  it('a tigela de água fica sempre cheia', () => {
    expect(content.items['item.water_bowl']!.tile).toBe('water_bowl_cheia');
  });
});
