import { describe, expect, it, vi } from 'vitest';
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
function openCafe(opts: { counter?: boolean; coffee?: boolean; served?: number } = {}) {
  const state = newGameState(500, 'map.cafe_main', 9 * 60);
  state.flags['has.cat'] = true;
  // Clientes já atendidos: as receitas da evolução destrancam por aqui (o café novo só tem o café preto).
  state.service.served = opts.served ?? 0;
  state.story.completed.push(...untilChairs);
  const session = new GameSession(content, state);
  const events: { name: EventName; payload: unknown }[] = [];
  session.bus.onAny((name, payload) => events.push({ name, payload }));
  const put = (item: string, at: [number, number]) => {
    expect(session.buy(item)).toEqual({ ok: true });
    expect(session.place(item, at)).toEqual({ ok: true });
  };
  if (opts.counter !== false) put('item.counter_single', [4, 5]);
  // A cafeteira vai em cima de um balcão.
  put('item.counter_single', [7, 5]);
  put('item.coffee_machine', [7, 5]);
  put('item.table_round', [10, 8]);
  put('item.chair_front', [11, 8]);
  session.receiveItem('item.dishes_set');
  if (opts.coffee !== false) {
    session.buy('item.coffee_ground');
    session.buy('item.paper_filter');
    session.service.storeInPantry(); // da mochila para a despensa: só assim vale nas receitas
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
    // Sem balcão: nem dá para pôr a cafeteira na mão.
    expect(session.missingHost('item.coffee_machine')).toBe('no_free_counter');
    expect(session.missingHost('item.counter_single')).toBeNull();
    session.buy('item.counter_single');
    session.place('item.counter_single', [7, 5]);
    session.buy('item.coffee_machine');
    expect(session.place('item.coffee_machine', [8, 5])).toEqual({ ok: false, reason: 'needs_counter' });
    expect(session.missingHost('item.coffee_machine')).toBeNull();
    expect(session.place('item.coffee_machine', [7, 5])).toEqual({ ok: true });
    // Único balcão ocupado: o bule também não tem onde ir.
    expect(session.missingHost('item.teapot')).toBe('no_free_counter');
    expect(sv.recipeStatus('recipe.black_coffee')).toBe('ingredients');
    session.buy('item.coffee_ground');
    session.buy('item.paper_filter');
    // Comprado e ainda na mochila: não vale; guardado na despensa, vale.
    expect(sv.recipeStatus('recipe.black_coffee')).toBe('ingredients');
    expect(sv.storeInPantry()).toEqual({ ok: true });
    expect(sv.recipeStatus('recipe.black_coffee')).toBe('vessel');
    session.receiveItem('item.dishes_set');
    expect(sv.recipeStatus('recipe.black_coffee')).toBe('available');
    // Café novo: só o café preto. O chá destranca com clientes atendidos e aí pede o bule.
    expect(sv.recipeStatus('recipe.black_tea')).toBe('locked');
    session.state.service.served = 15;
    expect(sv.recipeStatus('recipe.black_tea')).toBe('equipment');
    expect(sv.recipeStatus('recipe.orange_juice')).toBe('equipment');
    // Receitas para depois ficam bloqueadas até a condição delas.
    expect(sv.recipeStatus('recipe.cafe_latte')).toBe('locked');
  });

  it('a louça da Gabi: 6 xícaras, 6 copos e 6 pratos', () => {
    const { state } = openCafe();
    expect(state.dishes).toEqual({ cup: 6, glass: 6, plate: 6 });
  });

  it('um pacote rende doses (pó de café: 10)', () => {
    const { sv } = openCafe();
    expect(sv.doses('item.coffee_ground')).toBe(10);
    expect(sv.doses('item.tea_black_bag')).toBe(0);
  });

  it('o quadro tem slots (dados) e só aceita receita desbloqueada', () => {
    const { sv, state } = openCafe({ served: 15 });
    expect(sv.toggleMenu('recipe.cafe_latte')).toEqual({ ok: false, reason: 'not_unlocked' });
    expect(sv.toggleMenu('recipe.black_coffee')).toEqual({ ok: true });
    expect(state.menu).toEqual(['recipe.black_coffee']);
    // Esgotado entra no quadro, mas não é pedido.
    expect(sv.toggleMenu('recipe.black_tea')).toEqual({ ok: true });
    expect(sv.orderable().map((r) => r.id)).toEqual(['recipe.black_coffee']);
    expect(sv.toggleMenu('recipe.orange_juice')).toEqual({ ok: true });
    state.service.served = 65;
    expect(sv.toggleMenu('recipe.green_tea')).toEqual({ ok: true });
    expect(sv.toggleMenu('recipe.lemonade')).toEqual({ ok: false, reason: 'menu_full' });
    expect(sv.toggleMenu('recipe.black_tea')).toEqual({ ok: true }); // tirar
    expect(state.menu).not.toContain('recipe.black_tea');
  });

  it('regra da casa nos dados: onde cada louça pode ser servida precisa ser válido', () => {
    const bad: RecipeDef = { ...content.recipes['recipe.black_coffee']! };
    const errors = validateRecipes(
      { schemaVersion: 3, recipes: [bad] },
      { ...content.service, servedAt: { ...content.service.servedAt, plate: [] } },
      content.carry,
      { items: new Set(Object.keys(content.items)), icons: new Set(['cafe_preto']), itemTags: new Set(Object.values(content.items).flatMap((i) => i.tags)) },
    );
    expect(errors.join()).toMatch(/servedAt "plate"/);
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
    expect(sv.surfaceAt([7, 5])?.item).toEqual({ kind: 'drink', recipe: 'recipe.black_coffee', vessel: 'cup', quality: 'simple' });
    expect(sv.doses('item.coffee_ground')).toBe(9);
    expect(state.dishes.cup).toBe(5);

    // Pega (uma coisa por vez) e entrega.
    expect(sv.pickUp([7, 5])).toEqual({ ok: true });
    expect(state.hands).toHaveLength(1);
    expect(sv.customerToServe([[4, 7]])).toBe(state.service.customers[0]);
    const money = state.money;
    c.wantsPremium = false;
    expect(sv.serve(c.id)).toEqual({ ok: true });
    // Atendido com paciência de sobra: paga 12 e deixa 20% de gorjeta.
    expect(state.money).toBe(money + 12 + 2);
    expect(state.service.served).toBe(1);
    expect(events.some((e) => e.name === 'customer.served')).toBe(true);

    // Consome e vai embora: a xícara suja fica no balcão.
    advance(session, content.service.consumeMinutes.standing + 1);
    expect(state.service.customers.some((x) => x.id === c.id)).toBe(false);
    expect(sv.surfaceAt([4, 5])?.item).toEqual({ kind: 'dirty', vessel: 'cup' });
    expect(sv.capacity().total).toBe(2); // 1 em pé + 1 sentado: os lugares limitam antes da louça

    // Recolhe, deixa na pia e lava (leva uns minutos): volta para o estoque limpo.
    sv.pickUp([4, 5]);
    expect(sv.sinkNear([[1, 3]])).toBe(true);
    expect(sv.sinkAction()).toBe('deposit');
    expect(sv.depositDirty()).toEqual({ ok: true });
    expect(sv.sinkAction()).toBe('wash');
    expect(sv.startWash()).toEqual({ ok: true });
    expect(state.dishes.cup).toBe(5);
    advance(session, content.service.washMinutesPerDish + 1);
    expect(state.dishes.cup).toBe(6);
  });

  it('sem pedido: ela escolhe uma receita do cardápio para adiantar, mas só 1 sem dono por equipamento', () => {
    const { session, sv, state } = openCafe();
    sv.toggleMenu('recipe.black_coffee');
    const machine = coffeeMachineUid(session);
    // Sem receita escolhida: diz que ninguém pediu (a cena abre a lista com as opções).
    expect(sv.prepare(machine)).toEqual({ ok: false, reason: 'nothing_to_prepare' });
    expect(sv.extraRecipes(machine)).toEqual(['recipe.black_coffee']);
    // Fora do cardápio, não.
    expect(sv.prepare(machine, 'recipe.cafe_latte')).toEqual({ ok: false, reason: 'nothing_to_prepare' });
    expect(sv.prepare(machine, 'recipe.black_coffee')).toEqual({ ok: true });
    expect(sv.extraCount('coffee_machine')).toBe(1);
    expect(sv.doses('item.coffee_ground')).toBe(9);
    // Pronto e levado para o balcão: continua sem dono, e a cafeteira não faz outro sem pedido.
    state.service.preps = [];
    state.surfaces.push({ at: [4, 5], item: { kind: 'drink', recipe: 'recipe.black_coffee', vessel: 'cup', quality: 'simple' } });
    expect(sv.extraRecipes(machine)).toEqual([]);
    expect(sv.prepare(machine)).toEqual({ ok: false, reason: 'extra_ready' });
    expect(sv.prepare(machine, 'recipe.black_coffee')).toEqual({ ok: false, reason: 'extra_ready' });
    // Um cliente pede café: o pronto é dele (nada a preparar para ele) e ela pode adiantar outro.
    state.service.customers.push({ id: 'c1', look: 0, stage: 'waiting', kind: 'standing', spot: [4, 6], dishAt: [4, 5], recipe: 'recipe.black_coffee', until: 99999, favorite: null, wantsPremium: false });
    expect(sv.extraCount('coffee_machine')).toBe(0);
    expect(sv.stationHasWork(machine)).toBe(false);
    expect(sv.prepare(machine)).toEqual({ ok: false, reason: 'nothing_to_prepare' });
    expect(sv.extraRecipes(machine)).toEqual(['recipe.black_coffee']);
    // Com pedido esperando e nada a caminho, o pedido vem antes da receita escolhida.
    state.surfaces = [];
    expect(sv.prepare(machine, 'recipe.black_coffee')).toEqual({ ok: true });
    expect(sv.extraCount('coffee_machine')).toBe(0);
  });

  it('sem ingrediente ou sem louça limpa, a receita fica esgotada e ninguém pede', () => {
    const { session, sv, state } = openCafe({ coffee: false });
    sv.toggleMenu('recipe.black_coffee');
    advance(session, 30);
    expect(state.service.customers).toHaveLength(0);
    expect(sv.recipeStatus('recipe.black_coffee')).toBe('ingredients');
  });

  it('avisa por que ninguém entra: quadro vazio, sem ingrediente, sem louça limpa', () => {
    const { session, sv, state } = openCafe({ coffee: false });
    expect(sv.arrivalsBlocked()).toBe('empty_menu');
    sv.toggleMenu('recipe.black_coffee');
    expect(sv.arrivalsBlocked()).toBe('ingredients');
    session.buy('item.coffee_ground');
    session.buy('item.paper_filter');
    sv.storeInPantry();
    expect(sv.arrivalsBlocked()).toBeNull();
    state.dishes = { cup: 0, glass: 0, plate: 0 };
    expect(sv.arrivalsBlocked()).toBe('vessel');
    state.time = 20 * 60; // fechado: sem aviso
    expect(sv.arrivalsBlocked()).toBeNull();
  });

  it('com 2 ou mais gatos doentes, nenhum cliente novo entra; sararam, voltam', () => {
    const { session, sv, state } = openCafe();
    sv.toggleMenu('recipe.black_coffee');
    const sick = { disease: content.health.diseases[0]!.id, since: state.day, treatment: null };
    const cat = (id: string) => ({ sheltered: true, name: id, map: 'map.cafe_main', shelteredOn: 1, health: 20, sickness: { ...sick } });
    state.cats['cat.first_stray'] = cat('A');
    state.cats['cat.second'] = cat('B');
    expect(session.customersAway()).toBe(true);
    expect(session.chores().some((c) => c.kind === 'sick')).toBe(false); // antes do prólogo a rotina não aparece
    advance(session, 60);
    expect(state.service.customers).toHaveLength(0);
    // Um só doente: o café volta a receber gente.
    state.cats['cat.second']!.sickness = null;
    expect(session.customersAway()).toBe(false);
    advance(session, 60);
    expect(state.service.customers.length).toBeGreaterThan(0);
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

  it('lotado, o cliente espera na fila e senta quando liberar', () => {
    const { session, sv, state } = openCafe();
    // Só o lugar em pé: tira a cadeira (o café continua em funcionamento parcial).
    const chair = state.placed.find((p) => content.items[p.item]?.tags.includes('chair'))!;
    session.pickUp(chair.uid);
    sv.toggleMenu('recipe.black_coffee');
    advance(session, 6);
    expect(sv.capacity().total).toBe(1);
    // Força o próximo a chegar já.
    state.service.nextCustomerAt = 0;
    advance(session, 1);
    const queued = state.service.customers.find((c) => c.stage === 'queue');
    expect(queued).toBeDefined();
    expect(content.service.queue).toContainEqual(queued!.spot);
  });

  it('capacidade: lugares e louça do cardápio; louça suja não conta', () => {
    const { sv, state } = openCafe();
    expect(state.dishes).toEqual({ cup: 6, glass: 6, plate: 6 }); // presente da Gabi
    // Quadro vazio: conta toda a louça (prato inclusive: a cadeira serve para comer).
    expect(sv.capacity()).toEqual({ total: 2, standing: 1, seated: 1, canEat: true });
    sv.toggleMenu('recipe.black_coffee');
    // 1 lugar em pé no balcão + 1 cadeira na mesa; café pode ser tomado nos dois.
    expect(sv.capacity()).toEqual({ total: 2, standing: 1, seated: 1, canEat: false });
    state.dishes.cup = 1;
    state.surfaces.push({ at: [4, 5], item: { kind: 'dirty', vessel: 'cup' } });
    expect(sv.capacity().total).toBe(1);
  });

  it('o atendimento abre no funcionamento parcial (cadeiras, cafeteira, mesa e cadeira), no horário', () => {
    const { sv, state } = openCafe();
    expect(state.business).toBe('soft_open');
    expect(sv.isOpen()).toBe(true);
    state.time = 19 * 60;
    expect(sv.isOpen()).toBe(false);
    state.time = 10 * 60;
    state.business = 'closed';
    expect(sv.isOpen()).toBe(false);
  });

  it('o negócio só avança: tirar a cadeira depois não fecha o café', () => {
    const { session, state } = openCafe();
    const chair = state.placed.find((p) => content.items[p.item]?.tags.includes('chair'))!;
    expect(session.pickUp(chair.uid)).toEqual({ ok: true });
    expect(state.business).toBe('soft_open');
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
    state.cats['cat.first_stray'] = { sheltered: true, name: 'Botinhas', map: 'map.cafe_main', shelteredOn: 1, health: 80, sickness: null };
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
    // Depois do primeiro cliente vem a inauguração (reforma completa + placa).
    // Depois do primeiro cliente vem a inauguração (os cômodos só bem depois).
    expect(session.goals().map((g) => g.title)).toEqual(['A inauguração']);
  });

  it('sem a mesa e a cadeira, a quest não aparece', () => {
    const state = newGameState(500, 'map.cafe_main', 9 * 60);
    state.story.completed.push(...untilChairs);
    const session = new GameSession(content, state);
    session.buy('item.counter_single');
    session.place('item.counter_single', [7, 5]);
    session.buy('item.coffee_machine');
    session.place('item.coffee_machine', [7, 5]);
    expect(session.goals()).toEqual([]);
  });
});

describe('fase 2: bandeja, pesados e gato no colo', () => {
  it('com a bandeja selecionada na barra, leva até 3 louças (só louça) e fica um pouco mais lenta', () => {
    const { session, sv, state } = openCafe();
    expect(sv.toggleTray()).toEqual({ ok: false, reason: 'no_tray' });
    expect(session.buy('item.tray')).toEqual({ ok: true });
    expect(session.buy('item.tray')).toEqual({ ok: false, reason: 'already_owned' });
    expect(session.selectHotbarItem('item.tray')).toBe(true);
    expect(state.tray).toBe(true);
    for (const at of [[4, 6], [5, 6], [6, 6], [6, 7]] as [number, number][]) state.surfaces.push({ at, item: { kind: 'dirty', vessel: 'cup' } });
    expect(sv.pickUp([4, 6])).toEqual({ ok: true });
    expect(sv.pickUp([5, 6])).toEqual({ ok: true });
    expect(sv.pickUp([6, 6])).toEqual({ ok: true });
    expect(sv.pickUp([6, 7])).toEqual({ ok: false, reason: 'hands_full' });
    expect(sv.speed()).toBeCloseTo(content.carry.tray.speedFactor - 3 * content.carry.speedPenaltyPerItem);
    session.buy('item.cat_treat_biscuit');
    expect(sv.hold('item.cat_treat_biscuit')).toEqual({ ok: false, reason: 'not_on_tray' });
    // Na pia, as três de uma vez.
    expect(sv.depositDirty()).toEqual({ ok: true });
    expect(sv.sinkLoad()).toBe(3);
    // Trocar de item na barra guarda a bandeja.
    session.selectHotbarSlot((state.hotbar.slots.indexOf('item.tray') + 1) % state.hotbar.slots.length);
    expect(state.tray).toBe(false);
  });

  it('sem a bandeja selecionada, uma louça por vez; com várias nas mãos, a bandeja só sai quando sobrar uma', () => {
    const { session, sv, state } = openCafe();
    session.buy('item.tray');
    const traySlot = state.hotbar.slots.indexOf('item.tray');
    const other = (traySlot + 1) % state.hotbar.slots.length;
    session.selectHotbarSlot(other);
    expect(state.tray).toBe(false);
    for (const at of [[4, 6], [5, 6], [6, 6]] as [number, number][]) state.surfaces.push({ at, item: { kind: 'dirty', vessel: 'cup' } });
    expect(sv.pickUp([4, 6])).toEqual({ ok: true });
    expect(sv.pickUp([5, 6])).toEqual({ ok: false, reason: 'hands_full' });
    // Com a bandeja, pega mais uma; trocando de item com duas nas mãos, a bandeja fica até sobrar uma.
    session.selectHotbarSlot(traySlot);
    expect(sv.pickUp([5, 6])).toEqual({ ok: true });
    session.selectHotbarSlot(other);
    expect(state.tray).toBe(true);
    expect(sv.pickUp([6, 6])).toEqual({ ok: true }); // ainda com a bandeja
    expect(sv.depositDirty()).toEqual({ ok: true });
    expect(state.tray).toBe(false);
  });

  it('com a bandeja selecionada e as mãos vazias, pegar o gato larga a bandeja', () => {
    const { session, sv, state } = openCafe();
    session.buy('item.tray');
    session.selectHotbarItem('item.tray');
    expect(state.tray).toBe(true);
    state.cats['cat.first_stray'] = { sheltered: true, name: 'Pipoca', map: 'map.cafe_main', shelteredOn: 1 } as (typeof state.cats)[string];
    expect(sv.pickUpCat('cat.first_stray')).toEqual({ ok: true });
    expect(state.tray).toBe(false);
  });

  it('saco: vai para a mochila e a barra; só na mão (e lenta) quando selecionado; no café, E guarda e vira porções', () => {
    const { session, sv, state } = openCafe();
    state.location = 'map.market';
    expect(session.buy('item.cat_food_sack')).toEqual({ ok: true });
    expect(state.inventory['item.cat_food_sack']).toBe(1);
    expect(state.hotbar.slots).toContain('item.cat_food_sack');
    // Outro item selecionado: nada na mão, velocidade normal.
    session.selectHotbarSlot((state.hotbar.slots.indexOf('item.cat_food_sack') + 1) % state.hotbar.slots.length);
    expect(state.hands).toEqual([]);
    expect(sv.speed()).toBe(1);
    // Selecionado: na mão e lenta.
    expect(session.selectHotbarItem('item.cat_food_sack')).toBe(true);
    expect(state.hands).toEqual([{ kind: 'heavy', item: 'item.cat_food_sack' }]);
    expect(sv.speed()).toBe(content.carry.heavy.speedFactor);
    expect(sv.storeHeavy()).toEqual({ ok: false, reason: 'not_at_home' });
    state.location = 'map.cafe_main';
    expect(sv.storeHeavy()).toEqual({ ok: true });
    expect(state.inventory['item.cat_food_basic']).toBe(5);
    expect(state.inventory['item.cat_food_sack']).toBeUndefined();
    expect(state.hands).toEqual([]);
  });

  it('gato no colo: mãos livres, mais lenta, só põe no chão dentro do café', () => {
    const { sv, state } = openCafe();
    state.cats['cat.first_stray'] = { sheltered: true, name: 'Botinhas', map: 'map.cafe_main', shelteredOn: 1, health: 80, sickness: null };
    expect(sv.pickUpCat('cat.first_stray')).toEqual({ ok: true });
    expect(sv.carriedCat()).toBe('cat.first_stray');
    expect(sv.speed()).toBe(content.carry.cat.speedFactor);
    state.location = 'map.street';
    expect(sv.putDownCat()).toEqual({ ok: false, reason: 'not_at_home' });
    state.location = 'map.cafe_main';
    expect(sv.putDownCat()).toEqual({ ok: true });
    expect(sv.carriedCat()).toBeUndefined();
  });

  it('fim do dia: o saco continua na mochila (não vira porções sozinho) e o gato volta para casa', () => {
    const { session, sv, state } = openCafe();
    session.buy('item.cat_food_sack');
    session.endDay('home');
    expect(state.inventory['item.cat_food_sack']).toBe(1);
    state.cats['cat.first_stray'] = { sheltered: true, name: 'Botinhas', map: 'map.cafe_main', shelteredOn: 1, health: 80, sickness: null };
    sv.pickUpCat('cat.first_stray');
    session.endDay('home');
    expect(state.hands).toEqual([]);
  });
});

describe('fase 2: forno e receitas em etapas', () => {
  /** Café com fogão, forno, mesa, cadeira e ingredientes do pão de queijo; o quadro só com ele. */
  const bakery = () => {
    const ctx = openCafe({ served: 35 });
    const { session, sv } = ctx;
    session.state.money += 1000;
    for (const [id, at] of [['item.counter_single', [2, 8]], ['item.counter_single', [4, 8]], ['item.stove', [2, 8]], ['item.oven', [4, 8]]] as const) {
      session.buy(id);
      session.place(id, [at[0], at[1]]);
    }
    for (const id of ['item.flour', 'item.eggs', 'item.milk']) session.buy(id);
    sv.storeInPantry();
    sv.toggleMenu('recipe.cheese_bread');
    return ctx;
  };
  const uid = (session: GameSession, item: string) => session.state.placed.find((p) => p.item === item)!.uid;

  it('pão de queijo: fogão, leva a massa ao forno, serve na mesa no prato', () => {
    const { session, sv, state } = bakery();
    expect(sv.recipeStatus('recipe.cheese_bread')).toBe('available');
    advance(session, 6);
    const c = state.service.customers[0]!;
    expect(c).toMatchObject({ kind: 'table', recipe: 'recipe.cheese_bread', spot: [11, 8], dishAt: [10, 8] });
    // Etapa 1: fogão. O forno ainda não tem o que fazer.
    expect(sv.prepare(uid(session, 'item.oven'))).toEqual({ ok: false, reason: 'nothing_to_prepare' });
    expect(sv.prepare(uid(session, 'item.stove'))).toEqual({ ok: true });
    advance(session, 7);
    expect(sv.surfaceAt([2, 8])?.item).toMatchObject({ kind: 'wip', recipe: 'recipe.cheese_bread', step: 1 });
    // Leva a massa ao forno: etapa 2.
    sv.pickUp([2, 8]);
    expect(sv.prepare(uid(session, 'item.oven'))).toEqual({ ok: true });
    expect(state.hands).toEqual([]);
    advance(session, 21);
    expect(sv.surfaceAt([4, 8])?.item).toMatchObject({ kind: 'drink', recipe: 'recipe.cheese_bread', vessel: 'plate' });
    sv.pickUp([4, 8]);
    expect(sv.serve(c.id)).toEqual({ ok: true });
    // Come na mesa e deixa o prato sujo na mesa.
    advance(session, content.service.consumeMinutes.table + 1);
    expect(sv.surfaceAt([10, 8])?.item).toEqual({ kind: 'dirty', vessel: 'plate' });
  });

  it('sem o forno, a receita fica esgotada dizendo o que falta', () => {
    const { session, sv } = openCafe({ served: 35 });
    session.state.money += 1000;
    session.buy('item.counter_single');
    session.place('item.counter_single', [2, 8]);
    session.buy('item.stove');
    session.place('item.stove', [2, 8]);
    expect(sv.recipeStatus('recipe.cheese_bread')).toBe('equipment');
    expect(sv.missingEquipment('recipe.cheese_bread')).toBe('oven');
  });
});

describe('fase 2: qualidade e preferências', () => {
  it('com café em grãos sai premium: mais caro; quem gosta de premium deixa gorjeta só assim', () => {
    const { session, sv, state, events } = openCafe();
    session.buy('item.coffee_beans_bag');
    sv.storeInPantry();
    sv.toggleMenu('recipe.black_coffee');
    advance(session, 6);
    const c = state.service.customers[0]!;
    c.wantsPremium = true;
    sv.prepare(coffeeMachineUid(session));
    advance(session, 11);
    expect(sv.surfaceAt([7, 5])?.item).toMatchObject({ quality: 'premium' });
    // Usou o grão (premium) e não o pó.
    expect(sv.doses('item.coffee_ground')).toBe(10);
    sv.pickUp([7, 5]);
    const money = state.money;
    sv.serve(c.id);
    const served = events.filter((e) => e.name === 'customer.served').at(-1)!.payload as { price: number; tip: number };
    expect(served.price).toBe(Math.round(12 * content.service.premiumPriceMultiplier));
    expect(served.tip).toBeGreaterThan(0);
    expect(state.money).toBe(money + served.price + served.tip);
  });

  it('quem gosta de premium e recebe o simples não dá gorjeta', () => {
    const { session, sv, state, events } = openCafe();
    sv.toggleMenu('recipe.black_coffee');
    advance(session, 6);
    const c = state.service.customers[0]!;
    c.wantsPremium = true;
    sv.prepare(coffeeMachineUid(session));
    advance(session, 11);
    sv.pickUp([7, 5]);
    sv.serve(c.id);
    expect((events.filter((e) => e.name === 'customer.served').at(-1)!.payload as { tip: number }).tip).toBe(0);
  });

  it('o favorito pesa no pedido (sorteio com semente: sempre o mesmo resultado)', () => {
    const a = openCafe();
    const b = openCafe();
    for (const { session, sv } of [a, b]) {
      sv.toggleMenu('recipe.black_coffee');
      advance(session, 6);
    }
    expect(a.state.service.customers.map((c) => [c.look, c.favorite, c.wantsPremium, c.recipe])).toEqual(
      b.state.service.customers.map((c) => [c.look, c.favorite, c.wantsPremium, c.recipe]),
    );
  });
});

describe('equipamentos em cima do balcão', () => {
  it('só vão em cima de um balcão livre; o balcão não sai com algo em cima; não vira lugar de cliente', () => {
    const { session, sv, state } = openCafe({ served: 6 });
    const machine = state.placed.find((p) => p.item === 'item.coffee_machine')!;
    const counter = state.placed.find((p) => p.item === 'item.counter_single' && p.at[0] === 7)!;
    // Já tem a cafeteira em cima: o bule não cabe no mesmo balcão.
    session.state.money += 100;
    session.buy('item.teapot');
    expect(session.place('item.teapot', [7, 5])).toEqual({ ok: false, reason: 'occupied' });
    // Recolher o balcão com a cafeteira em cima não pode; a cafeteira sai primeiro.
    expect(session.pickUp(counter.uid)).toEqual({ ok: false, reason: 'has_something_on_top' });
    expect(session.placedAt([7, 5])?.uid).toBe(machine.uid);
    // O balcão da cafeteira não é lugar de cliente em pé; o outro é.
    expect(sv.spots().filter((s) => s.kind === 'standing').map((s) => s.spot)).toEqual([[4, 6]]);
    // No mapa, a cafeteira fica em cima do tampo.
    expect(session.mapData().objects.find((o) => o.id === 'placed.' + machine.uid)?.lift).toBe(content.world.counterLift);
  });
});

describe('mudar móvel de lugar', () => {
  function counterWithMachine() {
    const state = newGameState(500, 'map.cafe_main', 9 * 60);
    const session = new GameSession(content, state);
    session.buy('item.counter_single');
    session.place('item.counter_single', [7, 5]);
    session.buy('item.coffee_machine');
    session.place('item.coffee_machine', [7, 5]);
    const counter = state.placed.find((p) => p.item === 'item.counter_single')!;
    const machine = state.placed.find((p) => p.item === 'item.coffee_machine')!;
    return { session, state, counter, machine };
  }

  it('o balcão leva junto a cafeteira e a louça de cima; não passa pela mochila', () => {
    const { session, state, counter, machine } = counterWithMachine();
    state.surfaces.push({ at: [7, 5], item: { kind: 'dirty', vessel: 'mug' } as never });
    expect(session.movingGroup(counter.uid).map((p) => p.item)).toEqual(['item.counter_single', 'item.coffee_machine']);
    expect(session.move(counter.uid, [9, 7])).toEqual({ ok: true });
    expect(counter.at).toEqual([9, 7]);
    expect(machine.at).toEqual([9, 7]);
    expect(state.surfaces[0]!.at).toEqual([9, 7]);
    expect(state.inventory['item.counter_single'] ?? 0).toBe(0);
    // A cafeteira continua no balcão (a mesma peça, o mesmo uid).
    expect(session.service.stationsFor('coffee_machine').map((s) => s.uid)).toContain(machine.uid);
  });

  it('o lugar novo é conferido sem contar a própria peça (pode ir para a célula do lado); parede não', () => {
    const { session, counter } = counterWithMachine();
    expect(session.moveProblem(counter.uid, [8, 5])).toBeNull();
    expect(session.moveProblem(counter.uid, [7, 0])).not.toBeNull();
    expect(session.move(counter.uid, [7, 0]).ok).toBe(false);
    expect(counter.at).toEqual([7, 5]);
  });

  it('só a de cima (cafeteira) vai para outro balcão livre; sem balcão, não', () => {
    const { session, machine } = counterWithMachine();
    expect(session.movingGroup(machine.uid).map((p) => p.item)).toEqual(['item.coffee_machine']);
    expect(session.move(machine.uid, [10, 6])).toEqual({ ok: false, reason: 'needs_counter' });
    session.buy('item.counter_single');
    session.place('item.counter_single', [10, 6]);
    expect(session.move(machine.uid, [10, 6])).toEqual({ ok: true });
  });

  it('guardar na mochila leva os dois; com louça em cima, primeiro tira a louça', () => {
    const { session, state, counter } = counterWithMachine();
    state.surfaces.push({ at: [7, 5], item: { kind: 'dirty', vessel: 'mug' } as never });
    expect(session.storePlaced(counter.uid)).toEqual({ ok: false, reason: 'has_something_on_top' });
    state.surfaces.length = 0;
    expect(session.storePlaced(counter.uid)).toEqual({ ok: true });
    expect(state.placed).toHaveLength(0);
    expect(state.inventory['item.counter_single']).toBe(1);
    expect(state.inventory['item.coffee_machine']).toBe(1);
  });
});

describe('avaliação dos clientes (estrelas)', () => {
  const left = (events: { name: EventName; payload: unknown }[]) =>
    events.filter((e) => e.name === 'customer.left').map((e) => e.payload as { happy: boolean; stars?: number; reputation?: number });

  /** Atende o primeiro cliente (café preto) depois de `waitMin` minutos sentado esperando. */
  function serveAfter(waitMin: number, clean: boolean) {
    const { session, sv, state, events } = openCafe();
    sv.toggleMenu('recipe.black_coffee');
    if (clean) for (const d of session.visibleDirt()) state.cleaned.push(d.id);
    advance(session, 6);
    const c = state.service.customers[0]!;
    c.wantsPremium = false;
    advance(session, waitMin);
    sv.prepare(coffeeMachineUid(session));
    advance(session, 11);
    sv.pickUp([7, 5]);
    expect(sv.serve(c.id)).toEqual({ ok: true });
    advance(session, content.service.consumeMinutes.standing + 1);
    return { session, state, events };
  }

  it('rápido e salão limpo: 5 estrelas e a reputação delas', () => {
    const { state, events, session } = serveAfter(0, true);
    // A xícara suja que ele deixou conta como sujeira só depois que ele saiu.
    expect(left(events)).toEqual([{ customerId: 'c1', happy: true, stars: 5, reputation: content.service.review.reputation['5'] }].map(({ customerId, ...r }) => ({ customerId, ...r })));
    expect(state.reputation.value).toBe(content.service.review.reputation['5']!);
    expect(session.hallDirt()).toBe(1);
    // Estatísticas do dia: um atendido e as doses do café preto.
    expect(state.stats.today).toMatchObject({ served: 1, gaveUp: 0, doses: content.recipes['recipe.black_coffee']!.ingredients });
  });

  it('esperou muito sentado: perde estrelas; salão sujo também', () => {
    // Metade da paciência esperando e mais o preparo: passa da primeira faixa sentado.
    const slow = left(serveAfter(content.service.patienceMinutes * 0.5, true).events)[0]!;
    expect(slow.stars).toBe(5 - 1);
    const dirty = serveAfter(0, false);
    expect(dirty.session.visibleDirt().length).toBeGreaterThan(0);
    expect(left(dirty.events)[0]!.stars).toBeLessThan(5);
  });

  it('desistiu sentado ou na fila: 1 estrela e a reputação cai', () => {
    const { session, sv, state, events } = openCafe();
    sv.toggleMenu('recipe.black_coffee');
    // Só o lugar em pé: o segundo cliente vai para a fila.
    const chair = state.placed.find((p) => content.items[p.item]?.tags.includes('chair'))!;
    session.pickUp(chair.uid);
    state.reputation.value = 10;
    advance(session, 6);
    state.service.nextCustomerAt = 0;
    advance(session, 1);
    expect(state.service.customers.map((c) => c.stage).sort()).toEqual(['queue', 'waiting']);
    // O sentado desiste; o da fila senta (paciência nova) e desiste depois.
    advance(session, 2 * content.service.patienceMinutes + 3);
    const gaveUp = left(events).filter((e) => !e.happy);
    expect(gaveUp.length).toBeGreaterThanOrEqual(2); // o sentado e o da fila
    expect(gaveUp.every((e) => e.stars === content.service.review.gaveUp)).toBe(true);
    expect(state.reputation.value).toBeLessThan(10);
    expect(state.stats.today.gaveUp).toBe(gaveUp.length);
  });
});

describe('vários equipamentos ao alcance', () => {
  it('o que tem trabalho é o que tem cliente esperando um pedido dele (o bule ao lado da cafeteira)', () => {
    const state = newGameState(500, 'map.cafe_main', 10 * 60);
    state.business = 'soft_open';
    state.story.completed.push(...content.story.beats.map((b) => b.id));
    const session = new GameSession(content, state);
    state.placed.push({ uid: 'cm', item: 'item.coffee_machine', at: [3, 4] }, { uid: 'tp', item: 'item.teapot', at: [4, 4] });
    const sv = session.service;
    expect(sv.stationHasWork('cm')).toBe(false);
    expect(sv.stationHasWork('tp')).toBe(false);
    state.service.customers.push({ id: 'c1', look: 0, stage: 'waiting', kind: 'standing', spot: [4, 5], dishAt: [4, 4], recipe: 'recipe.black_tea', until: 99999, favorite: null, wantsPremium: false });
    expect(sv.stationHasWork('tp')).toBe(true);
    expect(sv.stationHasWork('cm')).toBe(false);
  });

  it('sem pedido: diz se é porque nada foi liberado, se não está no cardápio ou se ninguém pediu', () => {
    const state = newGameState(500, 'map.cafe_main', 10 * 60);
    state.business = 'soft_open';
    state.story.completed.push(...content.story.beats.map((b) => b.id));
    const session = new GameSession(content, state);
    state.placed.push({ uid: 'tp', item: 'item.teapot', at: [4, 4] });
    const sv = session.service;
    const tea = content.recipes['recipe.black_tea']!;
    if (sv.recipeStatus(tea.id) === 'locked') expect(sv.prepare('tp')).toEqual({ ok: false, reason: 'equipment_locked' });
    vi.spyOn(sv, 'recipeStatus').mockReturnValue('available');
    state.menu = state.menu.filter((id) => content.recipes[id]?.steps[0]?.equipment !== 'teapot');
    expect(sv.prepare('tp')).toEqual({ ok: false, reason: 'equipment_off_menu' });
    state.menu.push(tea.id);
    expect(sv.prepare('tp')).toEqual({ ok: false, reason: 'nothing_to_prepare' });
  });
});

describe('soltar louça', () => {
  it('sem permitir o chão (o E), só solta em balcão, mesa ou equipamento', () => {
    const state = newGameState(500, 'map.cafe_main', 10 * 60);
    state.story.completed.push(...content.story.beats.map((b) => b.id));
    const session = new GameSession(content, state);
    const sv = session.service;
    state.hands.push({ kind: 'dirty', vessel: 'cup' });
    const feet: [number, number][] = [[8, 7]];
    expect(sv.canPutDown([8, 6], feet, false)).toBe(false); // chão livre
    expect(sv.putDown([8, 6], feet, false)).toEqual({ ok: false, reason: 'cannot_put_here' });
    expect(state.hands).toHaveLength(1);
    expect(sv.canPutDown([8, 6], feet)).toBe(true); // clicando, o chão vale
    state.placed.push({ uid: 't1', item: 'item.table_round', at: [8, 6] });
    expect(sv.canPutDown([8, 6], feet, false)).toBe(true); // mesa
  });
});

