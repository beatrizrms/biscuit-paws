import { describe, expect, it } from 'vitest';
import { upgradeCost, upgradeGroupOf, validateUpgrades } from '../../src/core/upgrades';
import { GameSession } from '../../src/core/session';
import { newGameState } from '../../src/core/state';
import { loadContent } from './content';

const content = loadContent();
const { upgrades, items, catalog } = content;

/** Café com um balcão de três peças (cafeteira em cima do meio) e uma cadeira. */
function cafe(money = 200) {
  const state = newGameState(money, 'map.cafe_main', 10 * 60);
  state.placed.push(
    { uid: 'p1', item: 'item.counter_left', at: [4, 5] },
    { uid: 'p2', item: 'item.counter_mid', at: [5, 5] },
    { uid: 'p3', item: 'item.counter_right', at: [6, 5] },
    { uid: 'p4', item: 'item.coffee_machine', at: [5, 5] },
    { uid: 'p5', item: 'item.chair_front', at: [8, 8] },
  );
  return { session: new GameSession(content, state), state };
}

describe('assistência técnica: upgrade de móvel no lugar', () => {
  it('dados: grupos válidos (mesmo tamanho e camada, cada item num grupo só)', () => {
    expect(validateUpgrades(upgrades, items, catalog)).toEqual([]);
    const broken = { fee: 5, groups: [{ id: 'upg.x', name: 'X', items: ['item.counter_left', 'item.sofa'] }] };
    expect(validateUpgrades(broken, items, catalog).join()).toMatch(/diferente do resto do grupo/);
    expect(validateUpgrades({ fee: 5, groups: [{ id: 'upg.y', name: 'Y', items: ['item.counter_left', 'item.coffee_machine'] }] }, items, catalog).join()).toMatch(/vai em outro lugar/);
  });

  it('preço: a diferença (só se a nova for mais cara) + a taxa do serviço', () => {
    expect(upgradeGroupOf(upgrades, 'item.counter_mid')?.id).toBe('upg.counter');
    expect(upgradeCost(upgrades, items, 'item.counter_mid', 'item.counter_left')).toBe(20 - 15 + upgrades.fee);
    expect(upgradeCost(upgrades, items, 'item.counter_left', 'item.counter_mid')).toBe(upgrades.fee);
    expect(upgradeCost(upgrades, items, 'item.counter_left', 'item.counter_right')).toBe(upgrades.fee);
  });

  it('a peça do meio vira a ponta, no mesmo lugar e com o mesmo uid; a cafeteira em cima fica', () => {
    const { session, state } = cafe();
    const events: string[] = [];
    session.bus.on('item.upgraded', ({ from, to }) => events.push(`${from}>${to}`));
    expect(session.upgradeOptions('p2').map((o) => o.itemId)).toContain('item.counter_a_mid');
    expect(session.upgradePlaced('p2', 'item.counter_right')).toEqual({ ok: true });
    expect(state.placed.find((p) => p.uid === 'p2')).toMatchObject({ item: 'item.counter_right', at: [5, 5] });
    expect(state.placed.find((p) => p.uid === 'p4')).toMatchObject({ item: 'item.coffee_machine', at: [5, 5] });
    expect(state.money).toBe(200 - (20 - 15 + upgrades.fee));
    expect(events).toEqual(['item.counter_mid>item.counter_right']);
    expect(state.inventory['item.counter_mid'] ?? 0).toBe(0); // a peça antiga não volta para a mochila
  });

  it('a cadeira vira para outro lado; sem dinheiro ou fora do grupo, não troca', () => {
    const { session } = cafe();
    expect(session.upgradeOptions('p5').map((o) => o.itemId).sort()).toEqual(['item.chair_back', 'item.chair_left', 'item.chair_right']);
    expect(session.upgradePlaced('p5', 'item.sofa')).toEqual({ ok: false, reason: 'no_upgrade' });
    expect(session.upgradePlaced('p4', 'item.teapot')).toEqual({ ok: false, reason: 'no_upgrade' }); // a cafeteira não tem grupo
    expect(cafe(2).session.upgradePlaced('p5', 'item.chair_left')).toEqual({ ok: false, reason: 'no_money' });
  });

  it('peça ainda não liberada não aparece nas opções', () => {
    const { session, state } = cafe();
    state.placed.push({ uid: 'p6', item: 'item.food_bowl', at: [3, 8] });
    expect(session.upgradeOptions('p6')).toEqual([]); // o pote automático pede o primeiro gato
    state.flags['has.cat'] = true;
    expect(session.upgradeOptions('p6')).toEqual([]); // e, como é upgrade, a inauguração
    state.business = 'inaugurated';
    expect(session.upgradeOptions('p6').map((o) => o.itemId)).toEqual(['item.auto_feeder']);
  });

  it('upgrades (tag "upgrade": pote e caixa de areia automáticos, lava-louças) só depois da inauguração', () => {
    const { session, state } = cafe();
    state.flags['has.cat'] = true;
    const upgrades = Object.values(content.items).filter((i) => i.tags.includes(content.business.upgradeTag!)).map((i) => i.id).sort();
    expect(upgrades).toEqual(['item.auto_feeder', 'item.auto_litter_box', 'item.dishwasher']);
    for (const stage of ['closed', 'soft_open'] as const) {
      state.business = stage;
      for (const id of upgrades) expect(session.itemUnlocked(id)).toBe(false);
      expect(session.buy('item.dishwasher')).toEqual({ ok: false, reason: 'locked' });
    }
    state.business = 'inaugurated';
    for (const id of upgrades) expect(session.itemUnlocked(id)).toBe(true);
    expect(session.itemUnlocked('item.food_bowl')).toBe(true); // o que não é upgrade não muda
  });
});
