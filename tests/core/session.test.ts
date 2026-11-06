import { describe, expect, it } from 'vitest';
import type { EventName } from '../../src/core/events';
import { GameSession } from '../../src/core/session';
import { newGameState } from '../../src/core/state';
import { loadContent } from './content';

const content = loadContent();

function newSession() {
  const session = new GameSession(content, newGameState(content.economy.startingMoney));
  const events: { name: EventName; payload: unknown }[] = [];
  session.bus.onAny((name, payload) => events.push({ name, payload }));
  return { session, events, dialogues: () => events.filter((e) => e.name === 'dialogue.requested').map((e) => e.payload) };
}

/** Compra e posiciona; falha o teste se algo der errado. */
function buyAndPlace(session: GameSession, itemId: string, at: [number, number]) {
  expect(session.buy(itemId)).toEqual({ ok: true });
  expect(session.place(itemId, at)).toEqual({ ok: true });
}

describe('começo da história', () => {
  it('um jogo novo começa com pouco dinheiro, a abertura e a primeira meta', () => {
    const { session, dialogues } = newSession();
    session.start(true);
    expect(session.state.money).toBe(150);
    expect(dialogues()).toEqual([{ dialogueId: 'dlg.intro' }]);
    expect(session.state.flags['bought.old_bakery']).toBe(true);
    expect(session.goals().map((g) => g.title)).toEqual(['Um cantinho quente']);
  });

  it('o primeiro ato inteiro dá para fazer com o dinheiro inicial', () => {
    const { session, dialogues } = newSession();
    session.start(true);

    buyAndPlace(session, 'item.cat_bed', [12, 9]);
    buyAndPlace(session, 'item.water_bowl', [13, 9]);
    expect(session.goals()[0]!.steps.map((s) => s.done)).toEqual([true, true, false]);
    buyAndPlace(session, 'item.food_bowl', [14, 9]);
    expect(session.goals().map((g) => g.title)).toEqual(['Um lugar para sentar']);

    buyAndPlace(session, 'item.table_round', [4, 7]);
    buyAndPlace(session, 'item.chair_front', [3, 7]);
    const moneyBeforeNeighbor = session.state.money;
    buyAndPlace(session, 'item.chair_back', [5, 7]);

    expect(session.state.flags['met.old_neighbor']).toBe(true);
    expect(session.state.money).toBe(moneyBeforeNeighbor - 15 + 50);
    expect(dialogues().map((d) => (d as { dialogueId: string }).dialogueId)).toEqual([
      'dlg.intro',
      'dlg.warm_corner_done',
      'dlg.neighbor_visit',
    ]);
    expect(session.goals().map((g) => g.title)).toEqual(['Um miado lá fora']);
  });

  it('recolher um móvel não desfaz um marco concluído', () => {
    const { session } = newSession();
    session.start(true);
    buyAndPlace(session, 'item.cat_bed', [12, 9]);
    buyAndPlace(session, 'item.water_bowl', [13, 9]);
    buyAndPlace(session, 'item.food_bowl', [14, 9]);
    const bed = session.state.placed.find((p) => p.item === 'item.cat_bed')!;
    expect(session.pickUp(bed.uid)).toEqual({ ok: true });
    expect(session.state.story.completed).toContain('story.warm_corner');
  });
});

describe('dinheiro e inventário', () => {
  it('comprar desconta o preço e vai para o inventário', () => {
    const { session, events } = newSession();
    session.start(true);
    events.length = 0;
    expect(session.buy('item.cat_bed')).toEqual({ ok: true });
    expect(session.state.money).toBe(125);
    expect(session.state.inventory).toEqual({ 'item.cat_bed': 1 });
    expect(events.map((e) => e.name)).toEqual(['money.changed', 'item.bought']);
  });

  it('não compra sem dinheiro suficiente', () => {
    const { session } = newSession();
    expect(session.buy('item.cat_tree')).toEqual({ ok: false, reason: 'no_money' });
    expect(session.state.money).toBe(150);
  });

  it('não compra item desconhecido', () => {
    expect(newSession().session.buy('item.dragon')).toEqual({ ok: false, reason: 'unknown_item' });
  });

  it('só posiciona o que está no inventário', () => {
    const { session } = newSession();
    expect(session.place('item.cat_bed', [12, 9])).toEqual({ ok: false, reason: 'not_in_inventory' });
  });

  it('recolher devolve ao inventário e o uid não é reaproveitado', () => {
    const { session } = newSession();
    buyAndPlace(session, 'item.cactus', [10, 8]);
    expect(session.state.placed[0]!.uid).toBe('p1');
    expect(session.pickUp('p1')).toEqual({ ok: true });
    expect(session.state.inventory).toEqual({ 'item.cactus': 1 });
    expect(session.place('item.cactus', [10, 8])).toEqual({ ok: true });
    expect(session.state.placed[0]!.uid).toBe('p2');
  });

  it('acha o móvel da jogadora pela célula, inclusive nas células de cima de peças altas', () => {
    const { session } = newSession();
    session.state.money = 1000;
    buyAndPlace(session, 'item.cat_tree', [12, 6]); // ocupa (12..13, 6..8)
    expect(session.placedAt([13, 6])?.item).toBe('item.cat_tree');
    expect(session.placedAt([11, 6])).toBeUndefined();
    expect(session.pickUp('nao-existe')).toEqual({ ok: false, reason: 'not_found' });
  });
});
