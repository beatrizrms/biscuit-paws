import { describe, expect, it } from 'vitest';
import type { EventName } from '../../src/core/events';
import { GameSession } from '../../src/core/session';
import { newGameState } from '../../src/core/state';
import { validateRecipes, type RecipeDef } from '../../src/core/recipes';
import { loadContent } from './content';

const content = loadContent();
/** Avança o relógio minuto a minuto (como o jogo, quadro a quadro). */
const advance = (session: GameSession, m: number) => {
  for (let i = 0; i < m; i++) session.tickClock(1 / content.dayNight.minutesPerSecond);
};
/** Todos os marcos até as cadeiras concluídos (a quest do primeiro cliente vem depois). */
const untilChairs = content.story.beats.slice(0, content.story.beats.findIndex((b) => b.id === 'story.chairs') + 1).map((b) => b.id);

/** Café pronto para o primeiro cliente: depois das cadeiras, com balcão, cafeteira, mesa, cadeira, louça da Gabi e café. */
function openCafe(opts: { counter?: boolean; coffee?: boolean } = {}) {
  const state = newGameState(500, 'map.cafe_main', 9 * 60);
  state.flags['has.cat'] = true;
  state.story.completed.push(...untilChairs);
  const session = new GameSession(content, state);
  const events: { name: EventName; payload: unknown }[] = [];
  session.bus.onAny((name, payload) => events.push({ name, payload }));
  const put = (item: string, at: [number, number]) => {
    expect(session.buy(item)).toEqual({ ok: true });
    expect(session.place(item, at)).toEqual({ ok: true });
  };
  if (opts.counter !== false) put('item.counter_single', [4, 5]);
  put('item.coffee_machine', [7, 5]);
  put('item.table_round', [10, 8]);
  put('item.chair_front', [11, 8]);
  session.receiveItem('item.dishes_set');
  if (opts.coffee !== false) {
    session.buy('item.coffee_ground');
    session.buy('item.paper_filter');
  }
  return { session, events, sv: session.service, state };
}

const coffeeMachineUid = (session: GameSession) => session.state.placed.find((p) => p.item === 'item.coffee_machine')!.uid;

describe('receitas e cardápio', () => {
  it('esgotado por falta de equipamento, ingrediente ou louça limpa', () => {
    const state = newGameState(500, 'map.cafe_main', 9 * 60);
    const session = new GameSession(content, state);
    const sv = session.service;
    expect(sv.recipeStatus('recipe.black_coffee')).toBe('equipment');
    session.buy('item.coffee_machine');
    session.place('item.coffee_machine', [7, 5]);
    expect(sv.recipeStatus('recipe.black_coffee')).toBe('ingredients');
    session.buy('item.coffee_ground');
    session.buy('item.paper_filter');
    expect(sv.recipeStatus('recipe.black_coffee')).toBe('vessel');
    session.receiveItem('item.dishes_set');
    expect(sv.recipeStatus('recipe.black_coffee')).toBe('available');
    // O chá precisa do bule; o suco, do liquidificador.
    expect(sv.recipeStatus('recipe.black_tea')).toBe('equipment');
    expect(sv.recipeStatus('recipe.orange_juice')).toBe('equipment');
    // Receitas para depois ficam bloqueadas até a condição delas.
    expect(sv.recipeStatus('recipe.cafe_latte')).toBe('locked');
  });

  it('a louça da Gabi são 6 peças no total', () => {
    const { state } = openCafe();
    expect(state.dishes.cup + state.dishes.glass + state.dishes.plate).toBe(6);
  });

  it('um pacote rende doses (pó de café: 10)', () => {
    const { sv } = openCafe();
    expect(sv.doses('item.coffee_ground')).toBe(10);
    expect(sv.doses('item.tea_black_bag')).toBe(0);
  });

  it('o quadro tem slots (dados) e só aceita receita desbloqueada', () => {
    const { sv, state } = openCafe();
    expect(sv.toggleMenu('recipe.cafe_latte')).toEqual({ ok: false, reason: 'not_unlocked' });
    expect(sv.toggleMenu('recipe.black_coffee')).toEqual({ ok: true });
    expect(state.menu).toEqual(['recipe.black_coffee']);
    // Esgotado entra no quadro, mas não é pedido.
    expect(sv.toggleMenu('recipe.black_tea')).toEqual({ ok: true });
    expect(sv.orderable().map((r) => r.id)).toEqual(['recipe.black_coffee']);
    expect(sv.toggleMenu('recipe.orange_juice')).toEqual({ ok: true });
    state.flags['recipe.green_tea'] = true;
    expect(sv.toggleMenu('recipe.green_tea')).toEqual({ ok: true });
    state.flags['recipe.lemonade'] = true;
    expect(sv.toggleMenu('recipe.lemonade')).toEqual({ ok: false, reason: 'menu_full' });
    expect(sv.toggleMenu('recipe.black_tea')).toEqual({ ok: true }); // tirar
    expect(state.menu).not.toContain('recipe.black_tea');
  });

  it('regra da casa: em pé não usa prato; prato só na mesa', () => {
    const bad: RecipeDef = { ...content.recipes['recipe.black_coffee']!, id: 'recipe.bad', vessel: 'plate' };
    const errors = validateRecipes(
      { schemaVersion: 2, recipes: [bad] },
      content.service,
      content.carry,
      { items: new Set(Object.keys(content.items)), icons: new Set(['cafe_preto']), itemTags: new Set(Object.values(content.items).flatMap((i) => i.tags)) },
    );
    expect(errors.join()).toMatch(/em pé não usa prato/);
  });
});

describe('ciclo do pedido', () => {
  it('cliente pede -> prepara -> pega -> entrega -> paga -> deixa a louça suja -> lava', () => {
    const { session, sv, state, events } = openCafe();
    sv.toggleMenu('recipe.black_coffee');
    advance(session, 6);
    expect(state.service.customers).toHaveLength(1);
    const c = state.service.customers[0]!;
    expect(c).toMatchObject({ stage: 'waiting', recipe: 'recipe.black_coffee', spot: [4, 6], dishAt: [4, 5] });

    // Prepara na cafeteira: barra de progresso e, depois, a bebida no equipamento.
    const machine = coffeeMachineUid(session);
    expect(sv.prepare(machine)).toEqual({ ok: true });
    expect(sv.prepare(machine)).toEqual({ ok: false, reason: 'station_busy' });
    advance(session, 5);
    expect(sv.prepProgress(machine)).toBeCloseTo(0.5, 1);
    advance(session, 6);
    expect(sv.surfaceAt([7, 5])?.item).toEqual({ kind: 'drink', recipe: 'recipe.black_coffee', vessel: 'cup' });
    expect(sv.doses('item.coffee_ground')).toBe(9);
    expect(state.dishes.cup).toBe(1);

    // Pega (uma coisa por vez) e entrega.
    expect(sv.pickUp([7, 5])).toEqual({ ok: true });
    expect(state.hands).toHaveLength(1);
    expect(sv.customerToServe([[4, 7]])).toBe(state.service.customers[0]);
    const money = state.money;
    expect(sv.serve(c.id)).toEqual({ ok: true });
    expect(state.money).toBe(money + 12);
    expect(state.service.served).toBe(1);
    expect(events.some((e) => e.name === 'customer.served')).toBe(true);

    // Consome e vai embora: a xícara suja fica no balcão.
    advance(session, content.service.consumeMinutes.standing + 1);
    expect(state.service.customers).toHaveLength(0);
    expect(sv.surfaceAt([4, 5])?.item).toEqual({ kind: 'dirty', vessel: 'cup' });
    expect(sv.capacity()).toBe(5);

    // Recolhe e lava na pia: volta para o estoque limpo.
    sv.pickUp([4, 5]);
    expect(sv.sinkNear([[1, 3]])).toBe(true);
    expect(sv.wash()).toEqual({ ok: true });
    expect(state.dishes.cup).toBe(2);
    expect(sv.capacity()).toBe(6);
  });

  it('só prepara o que foi pedido; sem pedido, nada', () => {
    const { session, sv } = openCafe();
    sv.toggleMenu('recipe.black_coffee');
    expect(sv.prepare(coffeeMachineUid(session))).toEqual({ ok: false, reason: 'nothing_to_prepare' });
  });

  it('sem ingrediente ou sem louça limpa, a receita fica esgotada e ninguém pede', () => {
    const { session, sv, state } = openCafe({ coffee: false });
    sv.toggleMenu('recipe.black_coffee');
    advance(session, 30);
    expect(state.service.customers).toHaveLength(0);
    expect(sv.recipeStatus('recipe.black_coffee')).toBe('ingredients');
  });

  it('cliente sem atendimento perde a paciência e vai embora sem pagar', () => {
    const { session, sv, state, events } = openCafe();
    sv.toggleMenu('recipe.black_coffee');
    advance(session, 6);
    const money = state.money;
    advance(session, content.service.patienceMinutes + 1);
    expect(events.some((e) => e.name === 'customer.left' && (e.payload as { happy: boolean }).happy === false)).toBe(true);
    expect(state.money).toBe(money);
  });

  it('sem lugar livre, o cliente espera na fila e senta quando liberar', () => {
    const { session, sv, state } = openCafe();
    sv.toggleMenu('recipe.black_coffee');
    advance(session, 6);
    // Força o próximo a chegar já.
    state.service.nextCustomerAt = 0;
    advance(session, 1);
    const queued = state.service.customers.find((c) => c.stage === 'queue');
    expect(queued).toBeDefined();
    expect(content.service.queue).toContainEqual(queued!.spot);
  });

  it('louça suja reduz a capacidade; o teto vem dos dados', () => {
    const { sv, state } = openCafe();
    expect(sv.capacity()).toBe(Math.min(content.service.maxCustomers, 6));
    state.dishes.cup -= 1;
    state.surfaces.push({ at: [4, 5], item: { kind: 'dirty', vessel: 'cup' } });
    expect(sv.capacity()).toBe(5);
  });

  it('o atendimento só abre depois das cadeiras, com cafeteira, mesa e cadeira, no horário', () => {
    const { sv, state } = openCafe();
    expect(sv.isOpen()).toBe(true);
    state.time = 19 * 60;
    expect(sv.isOpen()).toBe(false);
    state.time = 10 * 60;
    state.story.completed = state.story.completed.filter((b) => b !== 'story.chairs');
    expect(sv.isOpen()).toBe(false);
  });

  it('pedido de mesa senta na cadeira ao lado da mesa e deixa o prato na mesa', () => {
    const { sv } = openCafe();
    expect(sv.spots().filter((s) => s.kind === 'table')).toEqual([{ kind: 'table', spot: [11, 8], dishAt: [10, 8] }]);
    expect(sv.spots().filter((s) => s.kind === 'standing').map((s) => s.spot)).toEqual([[4, 6]]);
  });
});

describe('mãos', () => {
  it('soltar só ao lado dela, numa superfície ou no chão livre; uma coisa por célula', () => {
    const { session, sv, state } = openCafe();
    state.hands.push({ kind: 'dirty', vessel: 'cup' });
    expect(sv.putDown([9, 9], [[3, 9]])).toEqual({ ok: false, reason: 'cannot_put_here' }); // longe
    expect(sv.putDown([4, 5], [[4, 6]])).toEqual({ ok: true }); // no balcão
    state.hands.push({ kind: 'dirty', vessel: 'glass' });
    expect(sv.putDown([4, 5], [[4, 6]])).toEqual({ ok: false, reason: 'cannot_put_here' }); // já tem algo
    expect(sv.putDown([5, 6], [[4, 6]])).toEqual({ ok: true }); // no chão
    expect(session.service.surfaceAt([5, 6])).toBeDefined();
  });

  it('carregar deixa mais lenta; petisco na mão vai para o gato', () => {
    const { session, sv, state } = openCafe();
    state.cats['cat.first_stray'] = { sheltered: true, name: 'Botinhas', map: 'map.cafe_main' };
    expect(sv.speed()).toBe(1);
    session.buy('item.cat_treat_biscuit');
    expect(sv.hold('item.cat_treat_biscuit')).toEqual({ ok: true });
    expect(sv.speed()).toBeCloseTo(1 - content.carry.speedPenaltyPerItem);
    expect(sv.hold('item.cat_treat_biscuit')).toEqual({ ok: false, reason: 'hands_full' });
    const before = state.relationships['player|cat.first_stray'] ?? 0;
    expect(sv.giveToCat('cat.first_stray')).toEqual({ ok: true });
    expect(state.relationships['player|cat.first_stray']).toBe(before + content.relationships.treatPoints);
    expect(state.hands).toEqual([]);
  });

  it('guardar na mochila o item da mão', () => {
    const { session, sv, state } = openCafe();
    session.buy('item.cat_treat_biscuit');
    sv.hold('item.cat_treat_biscuit');
    expect(state.inventory['item.cat_treat_biscuit']).toBeUndefined();
    expect(sv.stow()).toEqual({ ok: true });
    expect(state.inventory['item.cat_treat_biscuit']).toBe(1);
  });
});

describe('quest: o primeiro cliente', () => {
  it('só começa com cafeteira, mesa e cadeira; termina ao atender e abre o café', () => {
    const { session, sv, state } = openCafe();
    expect(session.goals().map((g) => g.title)).toEqual(['O primeiro cliente']);
    sv.toggleMenu('recipe.black_coffee');
    advance(session, 6);
    sv.prepare(coffeeMachineUid(session));
    advance(session, 11);
    sv.pickUp([7, 5]);
    sv.serve(state.service.customers[0]!.id);
    expect(state.flags['cafe.open']).toBe(true);
    expect(session.goals()).toEqual([]);
  });

  it('sem a mesa e a cadeira, a quest não aparece', () => {
    const state = newGameState(500, 'map.cafe_main', 9 * 60);
    state.story.completed.push(...untilChairs);
    const session = new GameSession(content, state);
    session.buy('item.coffee_machine');
    session.place('item.coffee_machine', [7, 5]);
    expect(session.goals()).toEqual([]);
  });
});
