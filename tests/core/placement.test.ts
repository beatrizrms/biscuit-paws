import { describe, expect, it } from 'vitest';
import { resolveMap } from '../../src/core/map';
import { GameSession } from '../../src/core/session';
import { newGameState } from '../../src/core/state';
import { loadContent } from './content';

const content = loadContent();

function richSession() {
  const state = newGameState(10_000);
  state.flags['has.cat'] = true; // itens de gato liberados
  state.milestones.reached['milestone.cats_3'] = 1; // a árvore de gato vem com o selo de 3 gatos
  return new GameSession(content, state);
}

function put(session: GameSession, itemId: string, at: [number, number]) {
  session.buy(itemId);
  return session.place(itemId, at);
}

describe('regras de posicionamento', () => {
  it('móvel comum vai no piso livre', () => {
    expect(put(richSession(), 'item.table_round', [4, 7])).toEqual({ ok: true });
  });

  it('não sai do café', () => {
    const s = richSession();
    expect(put(s, 'item.sofa', [15, 7])).toEqual({ ok: false, reason: 'out_of_bounds' });
    expect(put(s, 'item.cat_bed', [-1, 7])).toEqual({ ok: false, reason: 'out_of_bounds' });
  });

  it('não fica em cima de outro móvel nem do balcão', () => {
    const s = richSession();
    put(s, 'item.table_round', [4, 7]);
    expect(put(s, 'item.counter_mid', [3, 4])).toEqual({ ok: true });
    expect(put(s, 'item.cushion_pink', [4, 7])).toEqual({ ok: false, reason: 'occupied' });
    expect(put(s, 'item.plant_pot', [3, 4])).toEqual({ ok: false, reason: 'occupied' }); // balcão
  });

  it('a base precisa ficar no piso, mas peça alta pode encostar na parede', () => {
    const s = richSession();
    expect(put(s, 'item.cat_bed', [5, 2])).toEqual({ ok: false, reason: 'needs_floor' });
    expect(put(s, 'item.bookshelf', [9, 2])).toEqual({ ok: true }); // topo sobre o rodapé, base na linha 3
  });

  it('enfeite de parede só vai na parede', () => {
    const s = richSession();
    expect(put(s, 'item.wall_clock', [5, 7])).toEqual({ ok: false, reason: 'needs_wall' });
    expect(put(s, 'item.wall_clock', [5, 0])).toEqual({ ok: true });
    expect(put(s, 'item.picture_paw', [1, 0])).toEqual({ ok: false, reason: 'occupied' }); // janela
  });

  it('tapete fica embaixo de móveis, mas não em cima de outro tapete', () => {
    const s = richSession();
    expect(put(s, 'item.paw_rug', [9, 7])).toEqual({ ok: true });
    expect(put(s, 'item.table_round', [10, 7])).toEqual({ ok: true });
    expect(put(s, 'item.paw_rug', [10, 8])).toEqual({ ok: false, reason: 'occupied' });
  });

  it('nada sólido no ponto de partida nem em cima da personagem', () => {
    const s = richSession();
    const [sc, sr] = content.map.spawn.player;
    expect(put(s, 'item.plant_pot', [sc, sr])).toEqual({ ok: false, reason: 'blocked' });
    expect(put(s, 'item.plant_pot', [2, 9])).toEqual({ ok: true });
    s.buy('item.cactus');
    expect(s.place('item.cactus', [3, 9], [[3, 9]])).toEqual({ ok: false, reason: 'blocked' });
    expect(put(s, 'item.cushion_mint', [sc, sr])).toEqual({ ok: true }); // almofada não é sólida
  });

  it('móveis posicionados entram no mapa: desenho, colisão e y-sort', () => {
    const s = richSession();
    put(s, 'item.cat_tree', [12, 6]);
    const map = resolveMap(s.mapData(), content.catalog);
    expect(map.solid[8]![12]).toBe(true); // base
    expect(map.solid[7]![12]).toBe(false); // parte de cima
    const tree = map.sprites.filter((sp) => sp.tile === 'cat_tree');
    expect(tree).toHaveLength(6);
    expect(new Set(tree.map((sp) => sp.depth))).toEqual(new Set([9 * 32]));
  });
});
