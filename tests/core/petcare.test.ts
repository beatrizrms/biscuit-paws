import { describe, expect, it } from 'vitest';
import { knownIds, parseSave, serializeSave } from '../../src/core/save';
import { GameSession } from '../../src/core/session';
import { newGameState } from '../../src/core/state';
import { loadContent } from './content';

const content = loadContent();
const care = content.health.care;

/** Café com dois gatos, a tigela e a caixa de areia (comuns ou automáticas) e o item na barra. */
function cafe(opts: { auto?: boolean } = {}) {
  const state = newGameState(500, 'map.cafe_main', 10 * 60);
  state.story.completed.push(...content.story.beats.map((b) => b.id));
  const session = new GameSession(content, state);
  session.shelterCat('cat.first_stray');
  state.cats['cat.second'] = { sheltered: true, name: 'Nuvem', map: 'map.cafe_main', shelteredOn: 1 } as (typeof state.cats)[string];
  state.placed.push({ uid: 'p90', item: opts.auto ? 'item.auto_feeder' : 'item.food_bowl', at: [3, 8] });
  state.placed.push({ uid: 'p91', item: opts.auto ? 'item.auto_litter_box' : 'item.litter_box', at: [5, 8] });
  const hold = (itemId: string) => {
    state.hotbar.slots[0] = itemId;
    state.hotbar.active = 0;
  };
  return { session, state, hold };
}

describe('tigela e caixa de areia comuns', () => {
  it('uma porção de ração serve todos os gatos do café no dia', () => {
    const { session, state, hold } = cafe();
    state.inventory['item.cat_food_basic'] = 2;
    hold('item.cat_food_basic');
    expect(session.feedFromBowl('p90')).toEqual({ ok: true });
    expect(state.inventory['item.cat_food_basic']).toBe(1);
    expect(state.cats['cat.first_stray']!.fedOn).toBe(state.day);
    expect(state.cats['cat.second']!.fedOn).toBe(state.day);
    expect(session.feedProblem('p90')).toBe('already_fed');
  });

  it('areia: precisa estar na barra; uma troca por dia; sem areia limpa, a higiene cai mais', () => {
    const { session, state, hold } = cafe();
    expect(session.litterProblem('p91')).toBe('no_litter');
    state.inventory['item.cat_litter'] = 2;
    expect(session.litterProblem('p91')).toBe('needs_litter');
    hold('item.cat_litter');
    expect(session.refillLitter('p91')).toEqual({ ok: true });
    expect(state.inventory['item.cat_litter']).toBe(1);
    expect(session.litterProblem('p91')).toBe('already_clean');
    const before = state.cats['cat.first_stray']!.hygiene ?? care.start.hygiene;
    session.endDay('home');
    expect(state.cats['cat.first_stray']!.hygiene).toBe(before - care.daily.hygiene);
    // No dia seguinte, sem trocar: cai o diário e mais litterMissed.
    const day2 = state.cats['cat.first_stray']!.hygiene!;
    session.endDay('home');
    expect(state.cats['cat.first_stray']!.hygiene).toBe(day2 - care.daily.hygiene - care.litterMissed);
  });
});

describe('automáticos', () => {
  it('o pote guarda até 10 dias (o saco de 10 kg enche de uma vez) e serve sozinho, avisando quando acaba', () => {
    const { session, state, hold } = cafe({ auto: true });
    state.inventory['item.cat_food_basic'] = 12; // saco de 10 kg + 2
    hold('item.cat_food_basic');
    const events: { name: string; payload: unknown }[] = [];
    session.bus.onAny((name, payload) => events.push({ name, payload }));
    expect(session.feedFromBowl('p90')).toEqual({ ok: true });
    expect(state.inventory['item.cat_food_basic']).toBe(2);
    expect(session.stationStock('p90')).toBe(10);
    expect(session.feedProblem('p90')).toBe('full');
    for (let d = 0; d < 8; d++) session.endDay('home');
    expect(session.stationStock('p90')).toBe(2);
    expect(state.cats['cat.second']!.fedOn).toBe(state.day - 1);
    expect(events.some((e) => e.name === 'pet.low')).toBe(true);
  });

  it('com a tigela cheia no dia, o pote automático não gasta', () => {
    const { session, state, hold } = cafe({ auto: true });
    state.placed.push({ uid: 'p92', item: 'item.food_bowl', at: [7, 8] });
    state.inventory['item.cat_food_basic'] = 6;
    hold('item.cat_food_basic');
    session.feedFromBowl('p90');
    session.feedFromBowl('p92');
    session.endDay('home');
    expect(session.stationStock('p90')).toBe(5);
  });

  it('a caixa automática troca a areia sozinha; outra ração não entra enquanto houver a de antes', () => {
    const { session, state, hold } = cafe({ auto: true });
    state.inventory['item.cat_litter'] = 3;
    hold('item.cat_litter');
    expect(session.refillLitter('p91')).toEqual({ ok: true });
    expect(session.stationStock('p91')).toBe(3);
    const before = state.cats['cat.first_stray']!.hygiene ?? care.start.hygiene;
    session.endDay('home');
    expect(state.cats['cat.first_stray']!.hygiene).toBe(before - care.daily.hygiene);
    expect(session.stationStock('p91')).toBe(2);
    state.inventory['item.cat_food_basic'] = 1;
    state.inventory['item.cat_food_premium'] = 1;
    hold('item.cat_food_basic');
    session.feedFromBowl('p90');
    hold('item.cat_food_premium');
    expect(session.feedProblem('p90')).toBe('other_item');
  });

  it('comprar o automático do zero: posiciona em qualquer lugar e ela fica com a tigela e o pote', () => {
    const { session, state } = cafe();
    state.inventory['item.auto_feeder'] = 1;
    expect(session.place('item.auto_feeder', [9, 9])).toEqual({ ok: true });
    expect(state.placed.filter((p) => p.item === 'item.food_bowl' || p.item === 'item.auto_feeder').length).toBe(2);
  });

  it('pela assistência técnica: a tigela vira o pote no mesmo lugar (diferença + serviço) e a ração guardada volta', () => {
    const { session, state } = cafe({ auto: true });
    state.flags['has.cat'] = true; // os itens de gato só depois do primeiro gato
    const options = session.upgradeOptions('p90');
    expect(options).toEqual([{ itemId: 'item.food_bowl', cost: content.upgrades.fee }]); // mais barata: só o serviço
    state.placed.find((p) => p.uid === 'p90')!.stock = 3;
    state.placed.find((p) => p.uid === 'p90')!.stockItem = 'item.cat_food_basic';
    const money = state.money;
    expect(session.upgradePlaced('p90', 'item.food_bowl')).toEqual({ ok: true });
    expect(state.money).toBe(money - content.upgrades.fee);
    expect(state.inventory['item.cat_food_basic']).toBe(3);
    expect(session.upgradeOptions('p91')).toEqual([
      { itemId: 'item.litter_box', cost: content.upgrades.fee },
      { itemId: 'item.litter_box_green', cost: content.upgrades.fee },
    ]);
    const back = cafe();
    back.state.flags['has.cat'] = true;
    const price = content.items['item.auto_feeder']!.price - content.items['item.food_bowl']!.price + content.upgrades.fee;
    expect(back.session.upgradeOptions('p90')).toEqual([{ itemId: 'item.auto_feeder', cost: price }]);
    expect(back.session.upgradePlaced('p90', 'item.auto_feeder')).toEqual({ ok: true });
    expect(back.state.placed.find((p) => p.uid === 'p90')!.item).toBe('item.auto_feeder');
    expect(back.state.inventory['item.auto_feeder'] ?? 0).toBe(0);
  });

  it('o estoque dos automáticos e a areia do dia vão no save', () => {
    const { session, state, hold } = cafe({ auto: true });
    state.inventory['item.cat_litter'] = 4;
    hold('item.cat_litter');
    session.refillLitter('p91');
    const back = parseSave(serializeSave(state, new Date(0)), knownIds(content)).state;
    expect(back.placed.find((p) => p.uid === 'p91')).toMatchObject({ stock: 4, stockItem: 'item.cat_litter' });
  });
});
