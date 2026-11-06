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

/** Começa um jogo novo (na rua) e entra no café. */
function startInCafe(session: GameSession) {
  session.start(true);
  session.enter('map.cafe_main');
}

/** Compra e posiciona; falha o teste se algo der errado. */
function buyAndPlace(session: GameSession, itemId: string, at: [number, number]) {
  expect(session.buy(itemId)).toEqual({ ok: true });
  expect(session.place(itemId, at)).toEqual({ ok: true });
}

describe('começo da história', () => {
  it('um jogo novo começa na rua, com pouco dinheiro, a abertura e o pensamento de entrar', () => {
    const { session, dialogues } = newSession();
    session.start(true);
    expect(session.location()).toBe('map.street');
    expect(session.atHome()).toBe(false);
    expect(session.state.money).toBe(150);
    expect(dialogues()).toEqual([{ dialogueId: 'dlg.intro' }]);
    expect(session.state.flags['bought.old_bakery']).toBe(true);
    expect(session.goals().map((g) => g.title)).toEqual(['A velha padaria']);
  });

  it('entrar no café pela primeira vez mostra o interior e a próxima meta', () => {
    const { session, dialogues, events } = newSession();
    session.start(true);
    session.enter('map.cafe_main');
    expect(session.atHome()).toBe(true);
    expect(session.state.visited).toEqual(['map.street', 'map.cafe_main']);
    expect(events.some((e) => e.name === 'map.entered')).toBe(true);
    expect(dialogues()).toEqual([{ dialogueId: 'dlg.intro' }, { dialogueId: 'dlg.inside' }]);
    expect(session.goals().map((g) => g.title)).toEqual(['Um cantinho quente']);
    // Sair e voltar não repete a fala.
    session.enter('map.street');
    session.enter('map.cafe_main');
    expect(dialogues()).toHaveLength(2);
  });

  it('cada mapa tem os seus dados; só o café leva móveis e reforma', () => {
    const { session } = newSession();
    startInCafe(session);
    buyAndPlace(session, 'item.cat_bed', [12, 9]);
    expect(session.mapData('map.street').objects.some((o) => o.tile === 'cat_bed')).toBe(false);
    expect(session.mapData().objects.some((o) => o.tile === 'cat_bed')).toBe(true);
    expect(() => session.enter('map.lua')).toThrow(/desconhecido/);
  });

  it('o primeiro ato inteiro dá para fazer com o dinheiro inicial', () => {
    const { session, dialogues } = newSession();
    startInCafe(session);

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
      'dlg.inside',
      'dlg.warm_corner_done',
      'dlg.neighbor_visit',
    ]);
    expect(session.goals().map((g) => g.title)).toEqual(['Esse miado...']);
  });

  it('recolher um móvel não desfaz um marco concluído', () => {
    const { session } = newSession();
    startInCafe(session);
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

describe('pintor (reforma)', () => {
  /** Sessão com o pintor já apresentado pela Dona Lurdes. */
  function painterSession() {
    const s = newSession();
    s.session.state.flags['painter.available'] = true;
    return s;
  }

  it('fica bloqueado até a Dona Lurdes indicar o pintor', () => {
    const { session } = newSession();
    expect(session.painterUnlocked()).toBe(false);
    expect(session.paint('surface.hall_floor', 'finish.wood_planks')).toEqual({ ok: false, reason: 'locked' });
    expect(session.state.money).toBe(150);
  });

  it('a visita da Dona Lurdes libera o pintor', () => {
    const { session } = newSession();
    startInCafe(session);
    for (const [id, at] of [['item.cat_bed', [12, 9]], ['item.water_bowl', [13, 9]], ['item.food_bowl', [14, 9]], ['item.table_round', [4, 7]], ['item.chair_front', [3, 7]], ['item.chair_back', [5, 7]]] as const) {
      buyAndPlace(session, id, [at[0], at[1]]);
    }
    expect(session.painterUnlocked()).toBe(true);
  });

  it('troca o piso do salão: cobra, guarda no estado e muda o mapa', () => {
    const { session, events } = painterSession();
    session.start(true);
    events.length = 0;
    expect(session.mapData().legend.M).toBe('floor_check_old');

    expect(session.paint('surface.hall_floor', 'finish.wood_planks')).toEqual({ ok: true });
    expect(session.state.money).toBe(150 - 60);
    expect(session.state.finishes).toEqual({ 'surface.hall_floor': 'finish.wood_planks' });
    expect(session.mapData().legend.M).toBe('floor_wood_b');
    expect(session.mapData().legend.X).toBe('floor_wood_old'); // outra superfície não muda
    expect(events.map((e) => e.name)).toEqual(['money.changed', 'surface.painted']);
  });

  it('recusa acabamento que não serve, repetido, sem dinheiro ou desconhecido', () => {
    const { session } = painterSession();
    expect(session.paint('surface.hall_floor', 'finish.wallpaper_mint')).toEqual({ ok: false, reason: 'wrong_surface' });
    expect(session.paint('surface.roof', 'finish.wood_planks')).toEqual({ ok: false, reason: 'unknown_surface' });
    expect(session.paint('surface.hall_floor', 'finish.gold')).toEqual({ ok: false, reason: 'unknown_finish' });
    session.paint('surface.hall_floor', 'finish.wood_planks');
    expect(session.paint('surface.hall_floor', 'finish.wood_planks')).toEqual({ ok: false, reason: 'already_painted' });
    session.state.money = 10;
    expect(session.paint('surface.wallpaper', 'finish.wallpaper_mint')).toEqual({ ok: false, reason: 'no_money' });
  });

  it('móveis continuam no lugar depois da reforma', () => {
    const { session } = painterSession();
    buyAndPlace(session, 'item.cat_bed', [12, 9]);
    session.paint('surface.hall_floor', 'finish.tile_mint');
    expect(session.mapData().objects.some((o) => o.tile === 'cat_bed')).toBe(true);
  });
});

describe('devolução', () => {
  it('devolve item da bolsa com reembolso total (refundRate 1)', () => {
    const { session, events } = newSession();
    session.buy('item.sofa');
    events.length = 0;
    expect(session.state.money).toBe(30);
    expect(session.refund('item.sofa')).toEqual({ ok: true });
    expect(session.state.money).toBe(150);
    expect(session.state.inventory).toEqual({});
    expect(events.map((e) => e.name)).toEqual(['money.changed', 'item.refunded']);
  });

  it('só devolve o que está na bolsa (móvel posicionado precisa ser recolhido antes)', () => {
    const { session } = newSession();
    buyAndPlace(session, 'item.cactus', [10, 8]);
    expect(session.refund('item.cactus')).toEqual({ ok: false, reason: 'not_in_inventory' });
    session.pickUp(session.state.placed[0]!.uid);
    expect(session.refund('item.cactus')).toEqual({ ok: true });
    expect(session.state.money).toBe(150);
  });
});
