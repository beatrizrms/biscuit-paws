// Lista "hoje" do balão: a troca de areia de todo dia e o brincar numa linha só (com os brinquedos de menos).
import { describe, expect, it } from 'vitest';
import { GameSession } from '../../src/core/session';
import { newGameState } from '../../src/core/state';
import { loadContent } from './content';

const content = loadContent();

function cafe() {
  const state = newGameState(500, 'map.cafe_main', 9 * 60);
  state.flags['has.cat'] = true;
  state.flags['prologue.done'] = true;
  state.day = 10;
  state.cats['cat.first_stray'] = { sheltered: true, name: 'Botinhas', map: 'map.cafe_main', shelteredOn: 1, health: 80, sickness: null };
  const session = new GameSession(content, state);
  return { session, state };
}

describe('tarefas do dia', () => {
  it('troque a areia da caixa: até ela trocar hoje (a automática não entra)', () => {
    const { session, state } = cafe();
    expect(session.chores().some((c) => c.kind === 'litter')).toBe(false);
    expect(session.buy('item.litter_box')).toEqual({ ok: true });
    expect(session.place('item.litter_box', [12, 8])).toEqual({ ok: true });
    expect(session.chores().find((c) => c.kind === 'litter')).toMatchObject({ done: false, progress: [0, 1] });
    state.placed.find((p) => p.item === 'item.litter_box')!.refilledOn = state.day;
    expect(session.chores().find((c) => c.kind === 'litter')).toMatchObject({ done: true, progress: [1, 1] });
  });

  it('brinquedos de menos não são uma linha à parte: a linha do gato que quer brincar pede mais brinquedos', () => {
    const { session, state } = cafe();
    state.inventory['item.cat_wand'] = 1;
    state.cats['cat.first_stray']!.playedOn = 1;
    const play = session.chores().find((c) => c.kind === 'care' && c.need === 'play');
    expect(play).toMatchObject({ hasTool: true, toysShort: true });
    expect(session.chores().some((c) => (c.kind as string) === 'toys')).toBe(false);
  });
});
