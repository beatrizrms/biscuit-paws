// Famílias de móveis: girar a cadeira e o balcão que se completa (src/core/variants.ts, items.json: variants).
import { describe, expect, it } from 'vitest';
import { GameSession } from '../../src/core/session';
import { newGameState } from '../../src/core/state';
import { PLACED_PREFIX } from '../../src/core/placement';
import { autotilePiece, hiddenVariant, mainVariant, nextRotation } from '../../src/core/variants';
import { loadContent } from './content';

const content = loadContent();
const v = content.variants;

function cafe() {
  const state = newGameState(5000, 'map.cafe_main', 9 * 60);
  state.flags['has.cat'] = true;
  const session = new GameSession(content, state);
  return { session, state };
}

const tileOf = (session: GameSession, uid: string) => session.mapData('map.cafe_main').objects.find((o) => o.id === PLACED_PREFIX + uid)?.tile;

describe('famílias de móveis', () => {
  it('girar: a cadeira dá a volta pelas 4 direções; a principal é a de frente', () => {
    const seen = ['item.chair_front'];
    for (let i = 0; i < 4; i++) seen.push(nextRotation(v, seen.at(-1)!)!);
    expect(seen).toEqual(['item.chair_front', 'item.chair_right', 'item.chair_back', 'item.chair_left', 'item.chair_front']);
    expect(mainVariant(v, 'item.chair_left')).toBe('item.chair_front');
    expect(hiddenVariant(v, 'item.chair_left')).toBe(true);
    expect(hiddenVariant(v, 'item.chair_front')).toBe(false);
    expect(nextRotation(v, 'item.table_round')).toBeNull();
  });

  it('balcão: só o módulo único é o principal; o registrador fica de fora', () => {
    expect(mainVariant(v, 'item.counter_mid')).toBe('item.counter_single');
    expect(hiddenVariant(v, 'item.counter_a_left')).toBe(true);
    expect(hiddenVariant(v, 'item.counter_register')).toBe(false);
    expect(autotilePiece(v, [], 'item.counter_register', [0, 0])).toBeNull();
  });

  it('balcão: o desenho sai dos vizinhos da mesma cor na mesma linha; cores diferentes não se juntam', () => {
    const row = (items: string[]) => items.map((item, i) => ({ item, at: [i, 5] as [number, number] }));
    const three = row(['item.counter_single', 'item.counter_single', 'item.counter_single']);
    expect(three.map((p) => autotilePiece(v, three, p.item, p.at))).toEqual(['item.counter_left', 'item.counter_mid', 'item.counter_right']);
    const mixed = row(['item.counter_single', 'item.counter_a_single']);
    expect(mixed.map((p) => autotilePiece(v, mixed, p.item, p.at))).toEqual(['item.counter_single', 'item.counter_a_single']);
    // Linha de baixo não conta.
    const stacked = [{ item: 'item.counter_single', at: [0, 5] as [number, number] }, { item: 'item.counter_single', at: [0, 6] as [number, number] }];
    expect(autotilePiece(v, stacked, 'item.counter_single', [0, 5])).toBe('item.counter_single');
  });

  it('no café: posicionar e mover girado; guardar volta a cadeira de frente para a mochila', () => {
    const { session, state } = cafe();
    expect(session.buy('item.chair_front')).toEqual({ ok: true });
    expect(session.place('item.chair_front', [10, 8], [], 'item.chair_left')).toEqual({ ok: true });
    const chair = state.placed.find((p) => p.at[0] === 10 && p.at[1] === 8)!;
    expect(chair.item).toBe('item.chair_left');
    expect(state.inventory['item.chair_front'] ?? 0).toBe(0);
    expect(session.move(chair.uid, [11, 8], [], 'item.chair_back')).toEqual({ ok: true });
    expect(chair.item).toBe('item.chair_back');
    // Peça de outra família não vale: fica a de sempre.
    expect(session.move(chair.uid, [12, 8], [], 'item.table_round')).toEqual({ ok: true });
    expect(chair.item).toBe('item.chair_back');
    expect(session.pickUp(chair.uid)).toEqual({ ok: true });
    expect(state.inventory['item.chair_front']).toBe(1);
    expect(state.inventory['item.chair_back'] ?? 0).toBe(0);
  });

  it('no café: dois balcões lado a lado viram as pontas; tirar um fecha o outro (save antigo com o meio também)', () => {
    const { session, state } = cafe();
    for (const at of [[4, 5], [5, 5]] as [number, number][]) {
      expect(session.buy('item.counter_single')).toEqual({ ok: true });
      expect(session.place('item.counter_single', at)).toEqual({ ok: true });
    }
    const [a, b] = state.placed.filter((p) => p.item === 'item.counter_single');
    expect([tileOf(session, a!.uid), tileOf(session, b!.uid)]).toEqual([content.items['item.counter_left']!.tile, content.items['item.counter_right']!.tile]);
    expect(session.pickUp(b!.uid)).toEqual({ ok: true });
    expect(tileOf(session, a!.uid)).toBe(content.items['item.counter_single']!.tile);
    // Save antigo: um "meio" sozinho é desenhado como o único; guardado, volta como o único.
    state.placed.push({ uid: 'old1', item: 'item.counter_mid', at: [8, 5] });
    expect(tileOf(session, 'old1')).toBe(content.items['item.counter_single']!.tile);
    expect(session.pickUp('old1')).toEqual({ ok: true });
    expect(state.inventory['item.counter_single']).toBe(2);
  });
});
