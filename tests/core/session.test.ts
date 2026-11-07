import { describe, expect, it } from 'vitest';
import type { EventName } from '../../src/core/events';
import { GameSession } from '../../src/core/session';
import { newGameState } from '../../src/core/state';
import { doorAt } from '../../src/core/map';
import { loadContent } from './content';

const content = loadContent();

function newSession(withCat = true) {
  const state = newGameState(content.economy.startingMoney);
  // A maioria dos testes compra itens de gato: libera direto (o fluxo do gato tem testes próprios).
  if (withCat) state.flags['has.cat'] = true;
  // A vassoura da corretora (o roteiro não roda nos testes): já entra ativa no primeiro espaço da barra.
  state.inventory['item.broom'] = 1;
  const session = new GameSession(content, state);
  const events: { name: EventName; payload: unknown }[] = [];
  session.bus.onAny((name, payload) => events.push({ name, payload }));
  return { session, events, dialogues: () => events.filter((e) => e.name === 'dialogue.requested').map((e) => e.payload) };
}

/** Limpa toda a sujeira que sai com faxina (sem checar distância). */
function cleanAll(session: GameSession) {
  for (const d of session.visibleDirt().filter((x) => !x.clearedBy)) expect(session.clean(d.id)).toEqual({ ok: true });
}

/** Começa um jogo novo: a cena dos pensamentos e depois a rua. */
function startOnStreet(session: GameSession) {
  session.start(true);
  session.finishCutscene('cs.prologue_thoughts');
}

/** O que o roteiro da corretora faz na sessão: entra no café, entrega a chave e termina. */
function realtorTour(session: GameSession) {
  session.enter('map.cafe_main');
  session.receiveItem('item.key_bakery');
  session.finishScript('scr.realtor_tour');
}

/** Começa um jogo novo (na rua), a corretora mostra o café, faxina e o gatinho (com nome). */
function startInCafe(session: GameSession) {
  startOnStreet(session);
  realtorTour(session);
  cleanAll(session);
  session.finishCutscene('cs.meow_door');
  expect(session.nameCat('cat.first_stray', 'Botinhas')).toEqual({ ok: true });
}

/** Do gatinho com nome até o fim do prólogo: tigelas, ração, alimentar, cartão final (dia 2). */
function finishPrologue(session: GameSession) {
  buyAndPlace(session, 'item.water_bowl', [13, 9]);
  expect(session.buy('item.cat_food_basic')).toEqual({ ok: true });
  buyAndPlace(session, 'item.food_bowl', [14, 9]);
  const bowl = session.bowlNear([[14, 8]])!;
  expect(session.selectHotbarItem('item.cat_food_basic')).toBe(true);
  expect(session.feedFromBowl(bowl)).toEqual({ ok: true });
  session.selectHotbarItem('item.broom'); // de volta à vassoura (varrer e pedidos)
  session.finishCutscene('cs.prologue_end');
}

/** Aceita um pedido da vila e faz todos os pontos, passo a passo. */
function doJob(session: GameSession, jobId: string) {
  expect(session.acceptJob(jobId)).toEqual({ ok: true });
  const job = content.jobs[jobId]!;
  for (const step of job.steps) for (const p of step.points) expect(session.doJobPoint(p)).toEqual({ ok: true });
  expect(session.activeJobs()).toEqual([]);
}

/** Compra e posiciona; falha o teste se algo der errado. */
function buyAndPlace(session: GameSession, itemId: string, at: [number, number]) {
  expect(session.buy(itemId)).toEqual({ ok: true });
  expect(session.place(itemId, at)).toEqual({ ok: true });
}

describe('começo da história', () => {
  it('um jogo novo abre com a cena dos pensamentos; a rua e a fala vêm depois dela', () => {
    const { session, dialogues, events } = newSession();
    session.start(true);
    expect(events.filter((e) => e.name === 'cutscene.requested').map((e) => e.payload)).toEqual([{ cutsceneId: 'cs.prologue_thoughts' }]);
    expect(dialogues()).toEqual([]);
    expect(session.goals()).toEqual([]);
    session.finishCutscene('cs.prologue_thoughts');
    expect(session.state.flags['seen.cs.prologue_thoughts']).toBe(true);
    expect(dialogues()).toEqual([{ dialogueId: 'dlg.intro' }]);
  });

  it('um jogo novo começa na rua: a fala de chegada e, em seguida, o roteiro da corretora', () => {
    const { session, dialogues, events } = newSession();
    startOnStreet(session);
    expect(session.location()).toBe('map.street');
    expect(session.atHome()).toBe(false);
    expect(session.state.money).toBe(150);
    expect(dialogues()).toEqual([{ dialogueId: 'dlg.intro' }]);
    expect(events.filter((e) => e.name === 'script.requested').map((e) => e.payload)).toEqual([{ scriptId: 'scr.realtor_tour' }]);
    expect(session.state.flags['bought.old_bakery']).toBeUndefined(); // só compra lá dentro
    expect(session.state.inventory['item.key_bakery']).toBeUndefined();
  });

  it('a corretora leva para dentro e entrega a chave; depois vem o interior e a faxina', () => {
    const { session, dialogues, events } = newSession();
    startOnStreet(session);
    realtorTour(session);
    expect(session.atHome()).toBe(true);
    expect(session.state.visited).toEqual(['map.street', 'map.cafe_main']);
    expect(events.some((e) => e.name === 'map.entered')).toBe(true);
    expect(session.state.inventory['item.key_bakery']).toBe(1);
    expect(session.state.flags['bought.old_bakery']).toBe(true);
    expect(session.state.flags['seen.scr.realtor_tour']).toBe(true);
    expect(dialogues()).toEqual([{ dialogueId: 'dlg.intro' }, { dialogueId: 'dlg.inside' }]);
    expect(session.goals().map((g) => g.title)).toEqual(['Uma boa faxina']);
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

  it('o prólogo inteiro dá para fazer com o dinheiro inicial', () => {
    const { session, dialogues } = newSession();
    startInCafe(session);

    // Água e comida: tigela de água, ração do mercado, tigela de ração.
    buyAndPlace(session, 'item.water_bowl', [13, 9]);
    expect(session.goals()[0]!.steps.map((s) => s.done)).toEqual([true, false, false]);
    expect(session.buy('item.cat_food_basic')).toEqual({ ok: true });
    buyAndPlace(session, 'item.food_bowl', [14, 9]);
    expect(session.goals().map((g) => g.title)).toEqual(['Hora de comer']);
    // Alimentar: a ração entrou sozinha na barra; ela escolhe e enche a tigela. Primeiro coração, cartão final e fim do dia.
    expect(session.feedFromBowl(session.bowlNear([[14, 8]])!)).toEqual({ ok: false, reason: 'needs_food' });
    expect(session.selectHotbarItem('item.cat_food_basic')).toBe(true);
    expect(session.feedFromBowl(session.bowlNear([[14, 8]])!)).toEqual({ ok: true });
    expect(session.catHearts('cat.first_stray')).toBe(1);
    session.finishCutscene('cs.prologue_end');
    expect(session.state.day).toBe(2);
    expect(session.state.flags['prologue.done']).toBe(true);
    expect(dialogues().map((d) => (d as { dialogueId: string }).dialogueId)).toEqual([
      'dlg.intro',
      'dlg.inside',
      'dlg.cleaned',
      'dlg.cat_named',
      'dlg.ready_to_feed',
      'dlg.first_meal',
    ]);
  });

  it('os primeiros dias: uma quest por vez, dinheiro com pedidos, Dona Neusa pela cafeteira, Gabi pelas mesas', () => {
    const { session, events } = newSession();
    startInCafe(session);
    finishPrologue(session);
    const titles = () => session.goals().map((g) => g.title);
    const scripts = () => events.filter((e) => e.name === 'script.requested').map((e) => (e.payload as { scriptId: string }).scriptId);
    const cutscenes = () => events.filter((e) => e.name === 'cutscene.requested').map((e) => (e.payload as { cutsceneId: string }).cutsceneId);

    // Dia 2: só a caminha (sem almofada), e só uma quest aparece.
    expect(titles()).toEqual(['Um cantinho quente']);
    buyAndPlace(session, 'item.cat_bed', [12, 9]);
    expect(titles()).toEqual(['Uma cafeteira']);
    // A cafeteira não cabe no dinheiro: precisa dos pedidos da vila.
    expect(session.state.money).toBeLessThan(180);
    expect(session.buy('item.coffee_machine')).toEqual({ ok: false, reason: 'no_money' });
    for (const job of ['job.market_shelves', 'job.clear_snow', 'job.delivery', 'job.flyers']) doJob(session, job);
    expect(session.state.money).toBeGreaterThanOrEqual(180);
    expect(session.goals()[0]!.steps.map((s) => s.done)).toEqual([true, false]);
    expect(scripts()).not.toContain('scr.neusa_visit');
    // Comprar a cafeteira traz a Dona Neusa (e o pintor).
    expect(session.buy('item.coffee_machine')).toEqual({ ok: true });
    expect(scripts()).toContain('scr.neusa_visit');
    expect(session.painterUnlocked()).toBe(true);
    // As mesas só no dia seguinte.
    expect(titles()).toEqual([]);
    session.endDay('home');
    expect(titles()).toEqual(['Mesas para o salão']);
    // Dia 3: comprar as mesas faz a Gabi ligar (ela já está com dinheiro dos pedidos).
    for (const job of ['job.market_shelves', 'job.clear_snow', 'job.delivery', 'job.flyers']) doJob(session, job);
    session.state.time = 9 * 60;
    expect(session.buy('item.table_round')).toEqual({ ok: true });
    expect(cutscenes()).not.toContain('cs.gabi_call');
    expect(session.buy('item.table_round')).toEqual({ ok: true });
    expect(cutscenes()).toContain('cs.gabi_call');
    session.finishCutscene('cs.gabi_call');
    // Espera com hora marcada: a meta diz a hora e conclui sozinha pelo relógio, em qualquer lugar.
    expect(titles()).toEqual(['A visita da Gabi']);
    expect(session.timerClock('gabi.arrival')).toBe(9 * 60 + 90);
    expect(session.waitTarget()).toBeDefined();
    session.enter('map.market');
    session.tickClock(89 / content.dayNight.minutesPerSecond);
    expect(scripts()).not.toContain('scr.gabi_visit');
    session.tickClock(2 / content.dayNight.minutesPerSecond);
    expect(scripts()).toContain('scr.gabi_visit');
    expect(session.waitTarget()).toBeUndefined();
    // Durante a visita, nada novo aparece: as cadeiras só depois que a Gabi vai embora.
    expect(titles()).toEqual([]);
    session.finishScript('scr.gabi_visit');
    // Cadeiras: quest à parte, sem evento.
    expect(titles()).toEqual(['Cadeiras']);
    const before = events.length;
    buyAndPlace(session, 'item.chair_front', [3, 7]);
    buyAndPlace(session, 'item.chair_back', [5, 7]);
    expect(titles()).toEqual([]);
    expect(events.slice(before).some((e) => e.name === 'script.requested' || e.name === 'cutscene.requested')).toBe(false);
  });

  it('a Gabi não liga de noite: se as mesas forem compradas tarde, liga na manhã seguinte', () => {
    const { session, events } = newSession();
    startInCafe(session);
    finishPrologue(session);
    buyAndPlace(session, 'item.cat_bed', [12, 9]);
    session.addMoney(1000, 'test');
    session.buy('item.coffee_machine');
    session.endDay('home');
    session.state.time = 20 * 60;
    session.buy('item.table_round');
    session.buy('item.table_round');
    const called = () => events.some((e) => e.name === 'cutscene.requested' && (e.payload as { cutsceneId: string }).cutsceneId === 'cs.gabi_call');
    expect(called()).toBe(false);
    session.endDay('home');
    session.tickClock(16 / content.dayNight.minutesPerSecond);
    expect(called()).toBe(true);
  });

  it('recolher um móvel não desfaz um marco concluído', () => {
    const { session } = newSession();
    startInCafe(session);
    finishPrologue(session);
    buyAndPlace(session, 'item.cat_bed', [12, 9]);
    buyAndPlace(session, 'item.cushion_pink', [11, 9]);
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
    expect(session.state.inventory).toEqual({ 'item.broom': 1, 'item.cat_bed': 1 });
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
    expect(session.state.inventory).toEqual({ 'item.broom': 1, 'item.cactus': 1 });
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

  it('a visita da Dona Neusa (pela cafeteira) libera o pintor', () => {
    const { session } = newSession();
    startInCafe(session);
    finishPrologue(session);
    buyAndPlace(session, 'item.cat_bed', [12, 9]);
    expect(session.painterUnlocked()).toBe(false);
    session.addMoney(500, 'test');
    session.buy('item.coffee_machine');
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
    expect(session.state.inventory).toEqual({ 'item.broom': 1 });
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

describe('faxina', () => {
  it('limpar as teias e o chão conclui a faxina e libera o cantinho quente', () => {
    const { session, dialogues } = newSession();
    startOnStreet(session);
    realtorTour(session);
    const webs = session.visibleDirt().filter((d) => d.tags.includes('web'));
    webs.forEach((d) => session.clean(d.id));
    expect(session.goals()[0]!.steps.map((s) => s.done)).toEqual([true, false]);
    cleanAll(session);
    expect(dialogues().at(-1)).toEqual({ dialogueId: 'dlg.cleaned' });
    expect(session.goals().map((g) => g.title)).toEqual(['Esse miado...']);
  });

  it('precisa estar perto (até 2 células) e não limpa duas vezes', () => {
    const { session } = newSession();
    const bucket = 'dirt.leak_bucket'; // em (8, 5)
    expect(session.clean(bucket, [[8, 9]])).toEqual({ ok: false, reason: 'too_far' });
    expect(session.clean(bucket, [[9, 7]])).toEqual({ ok: true });
    expect(session.clean(bucket, [[9, 7]])).toEqual({ ok: false, reason: 'not_found' });
    expect(session.dirtAt([8, 5])).toBeUndefined();
  });

  it('manchas e rachaduras não saem com faxina; somem com a reforma', () => {
    const { session } = newSession();
    expect(session.clean('dirt.stain_water')).toEqual({ ok: false, reason: 'needs_repair' });
    expect(session.dirtAt([4, 1])?.id).toBe('dirt.stain_water');
    session.state.flags['painter.available'] = true;
    session.paint('surface.wallpaper', 'finish.wallpaper_mint');
    expect(session.visibleDirt().some((d) => d.clearedBy === 'surface.wallpaper')).toBe(false);
    expect(session.visibleDirt().some((d) => d.clearedBy === 'surface.hall_floor')).toBe(true);
  });

  it('a sujeira limpa some do mapa desenhado', () => {
    const { session } = newSession();
    const before = session.mapData().dirt!.length;
    session.clean('dirt.papers');
    expect(session.mapData().dirt!.length).toBe(before - 1);
  });

  it('saves antigos ("*") já vêm com a faxina feita, mas as manchas continuam', () => {
    const { session } = newSession();
    session.state.cleaned = ['*'];
    expect(session.visibleDirt().every((d) => d.clearedBy)).toBe(true);
  });
});

describe('chave e portas', () => {
  const streetDoor = () => content.maps['map.street']!.doors!.find((d) => d.id === 'door.cafe')!;

  it('a porta da padaria fica trancada até a corretora entregar a chave', () => {
    const { session, dialogues } = newSession();
    session.start(true);
    expect(session.canUseDoor(streetDoor())).toBe(false);
    session.doorLocked(streetDoor());
    expect(dialogues()).toEqual([{ dialogueId: 'dlg.door_locked_bakery' }]);

    session.finishCutscene('cs.prologue_thoughts'); // chegada
    expect(session.state.inventory['item.key_bakery']).toBeUndefined();
    realtorTour(session); // a corretora entrega a chave
    expect(session.state.inventory['item.key_bakery']).toBe(1);
    expect(session.canUseDoor(streetDoor())).toBe(true);
  });

  it('a chave não se compra nem se devolve', () => {
    const { session } = newSession();
    startOnStreet(session);
    expect(session.buy('item.key_bakery')).toEqual({ ok: false, reason: 'unknown_item' });
    expect(session.refund('item.key_bakery')).toEqual({ ok: false, reason: 'unknown_item' });
    expect(session.state.money).toBe(150);
  });

  it('porta sem requisito está sempre aberta', () => {
    const { session } = newSession();
    const inside = content.map.doors!.find((d) => d.id === 'door.street')!;
    expect(session.canUseDoor(inside)).toBe(true);
  });
});

describe('o gatinho na porta', () => {
  function cleanedCafe() {
    const s = newSession(false);
    s.session.start(true);
    s.session.finishCutscene('cs.prologue_thoughts');
    realtorTour(s.session);
    cleanAll(s.session);
    return s;
  }
  const insideDoor = () => content.map.doors!.find((d) => d.id === 'door.street')!;

  it('antes do gato, as coisas de gato estão travadas', () => {
    const { session } = newSession(false);
    expect(session.itemUnlocked('item.cat_bed')).toBe(false);
    expect(session.buy('item.cat_bed')).toEqual({ ok: false, reason: 'locked' });
    expect(session.itemUnlocked('item.table_round')).toBe(true);
    expect(session.itemUnlocked('item.honey')).toBe(false); // nenhuma receita usa mel ainda
  });

  it('depois da faxina, a porta de dentro mostra o gatinho em vez de sair', () => {
    const { session, events } = cleanedCafe();
    expect(session.doorIntercept(insideDoor())).toBe('cs.meow_door');
    expect(events.at(-1)).toEqual({ name: 'cutscene.requested', payload: { cutsceneId: 'cs.meow_door' } });
  });

  it('a porta só intercepta uma vez, e não antes da faxina', () => {
    const { session } = newSession(false);
    session.start(true);
    expect(session.doorIntercept(insideDoor())).toBeUndefined();
    const s2 = cleanedCafe();
    s2.session.finishCutscene('cs.meow_door');
    expect(s2.session.doorIntercept(insideDoor())).toBeUndefined();
  });

  it('a cena abriga o gato; a caixa de nome valida e o nome destrava a próxima meta', () => {
    const { session, events, dialogues } = cleanedCafe();
    session.finishCutscene('cs.meow_door');
    expect(session.shelteredCats()).toEqual(['cat.first_stray']);
    expect(events.some((e) => e.name === 'cat.sheltered')).toBe(true);
    expect(session.itemUnlocked('item.cat_bed')).toBe(true);
    expect(session.goals()).toEqual([]); // espera o nome

    expect(session.suggestCatName('cat.first_stray', 0)).toBe('Botinhas');
    expect(session.suggestCatName('cat.first_stray', 1)).toBe('Pão de Mel');
    expect(session.nameCat('cat.first_stray', '   ')).toEqual({ ok: false, reason: 'invalid_name' });
    expect(session.nameCat('cat.first_stray', 'Um nome comprido demais')).toEqual({ ok: false, reason: 'invalid_name' });
    expect(session.nameCat('cat.first_stray', '  Pipoca  ')).toEqual({ ok: true });
    expect(session.catName('cat.first_stray')).toBe('Pipoca');
    expect(dialogues().at(-1)).toEqual({ dialogueId: 'dlg.cat_named' });
    expect(session.goals().map((g) => g.title)).toEqual(['Água e comida']);
  });

  it('não dá nome a gato que não mora aqui; a Tekinha tem nome fixo', () => {
    const { session } = newSession(false);
    expect(session.nameCat('cat.first_stray', 'Pipoca')).toEqual({ ok: false, reason: 'not_sheltered' });
    expect(session.catName('cat.tekinha')).toBe('Tekinha');
  });
});

describe('corações', () => {
  it('pontos viram corações, com evento quando muda', () => {
    const { session, events } = newSession();
    session.state.cats['cat.first_stray'] = { sheltered: true, name: 'Pipoca', map: 'map.cafe_main' };
    session.addCatAffection('cat.first_stray', 60);
    expect(session.catHearts('cat.first_stray')).toBe(0);
    session.addCatAffection('cat.first_stray', 60);
    expect(session.catHearts('cat.first_stray')).toBe(1);
    expect(events.filter((e) => e.name === 'cat.affection_changed').map((e) => e.payload)).toEqual([
      { catId: 'cat.first_stray', from: 0, to: 1 },
    ]);
    session.addCatAffection('cat.first_stray', 99_999);
    expect(session.catHearts('cat.first_stray')).toBe(10);
    session.addCatAffection('cat.first_stray', -99_999);
    expect(session.catHearts('cat.first_stray')).toBe(0);
  });
});

describe('mercado', () => {
  it('a porta do mercado leva para dentro; a saída é andando para baixo', () => {
    const street = content.maps['map.street']!;
    const market = content.maps['map.market']!;
    const resolved = (m: typeof street) => ({ doors: m.doors ?? [] });
    expect(doorAt(resolved(street), [24, 8], 'up')?.to).toBe('map.market');
    expect(doorAt(resolved(market), [10, 11], 'up')).toBeUndefined();
    expect(doorAt(resolved(market), [10, 11], 'down')?.to).toBe('map.street');
  });

  it('o caixa abre a loja de perto (E) ou clicando nele de perto', () => {
    const { session } = newSession();
    session.enter('map.market');
    expect(session.interactionAt([[13, 11]])?.action).toEqual({ shop: 'shop.market' });
    expect(session.interactionAt([[13, 11]], [13, 9])?.id).toBe('int.market_cashier');
    expect(session.interactionAt([[3, 11]])).toBeUndefined(); // longe
    expect(session.interactionAt([[13, 11]], [12, 5])).toBeUndefined(); // clicou em outra coisa
  });

  it('compra ração no caixa: vai para a bolsa e marca o passo da meta', () => {
    const { session } = newSession(false);
    startInCafe(session);
    expect(session.goals()[0]!.title).toBe('Água e comida');
    expect(session.shopItems('shop.market')).toContain('item.cat_food_basic');
    expect(session.buy('item.cat_food_basic')).toEqual({ ok: true });
    expect(session.state.inventory['item.cat_food_basic']).toBe(1);
    expect(session.goals()[0]!.steps.map((s) => s.done)).toEqual([false, true, false]);
  });
});

describe('alimentar e fim do dia', () => {
  it('sem ração na bolsa ou sem gato, a tigela não serve', () => {
    const { session } = newSession();
    startInCafe(session);
    buyAndPlace(session, 'item.food_bowl', [14, 9]);
    const bowl = session.bowlNear([[14, 8]])!;
    expect(session.feedFromBowl(bowl)).toEqual({ ok: false, reason: 'no_food' });
    expect(session.feedFromBowl('p999')).toEqual({ ok: false, reason: 'not_found' });

    const noCat = newSession();
    noCat.session.enter('map.cafe_main');
    noCat.session.buy('item.cat_food_basic');
    buyAndPlace(noCat.session, 'item.food_bowl', [14, 9]);
    expect(noCat.session.feedFromBowl(noCat.session.bowlNear([[14, 8]])!)).toEqual({ ok: false, reason: 'no_cat' });
  });

  it('a tigela só é achada de perto, dentro do café', () => {
    const { session } = newSession();
    startInCafe(session);
    buyAndPlace(session, 'item.food_bowl', [14, 9]);
    expect(session.bowlNear([[14, 6]])).toBeUndefined();
    expect(session.bowlNear([[13, 8]])).toBeDefined();
    expect(session.bowlNear([[13, 8]], [2, 2])).toBeUndefined(); // clicou em outro lugar
    session.enter('map.street');
    expect(session.bowlNear([[13, 8]])).toBeUndefined();
  });

  it('comer gasta uma ração e dá um coração', () => {
    const { session, events } = newSession();
    startInCafe(session);
    session.buy('item.cat_food_basic');
    session.buy('item.cat_food_basic');
    buyAndPlace(session, 'item.food_bowl', [14, 9]);
    session.selectHotbarItem('item.cat_food_basic');
    session.feedFromBowl(session.bowlNear([[14, 8]])!);
    expect(session.state.inventory['item.cat_food_basic']).toBe(1);
    expect(events.some((e) => e.name === 'cat.fed')).toBe(true);
    expect(session.catHearts('cat.first_stray')).toBe(1);
  });

  it('o fim do dia passa para o dia seguinte e avisa', () => {
    const { session, events } = newSession();
    session.endDay();
    expect(session.state.day).toBe(2);
    expect(events.find((e) => e.name === 'day.ended')?.payload).toEqual({ day: 1, reason: 'story', earned: 0, jobs: 0 });
  });
});

describe('relógio', () => {
  const { minutesPerSecond } = content.dayNight;

  it('a chegada na rua é às 8h', () => {
    const { session } = newSession();
    startOnStreet(session);
    expect(session.state.time).toBe(8 * 60);
  });

  it('o relógio anda conforme os segundos reais', () => {
    const { session } = newSession();
    session.state.time = 600;
    session.tickClock(10);
    expect(session.state.time).toBeCloseTo(600 + 10 * minutesPerSecond);
  });

  it('o fim do dia leva para a rua, de manhã, no dia seguinte', () => {
    const { session, events } = newSession();
    session.state.location = 'map.cafe_main';
    session.state.time = 22 * 60;
    session.endDay();
    expect(session.state.day).toBe(2);
    expect(session.state.time).toBe(7 * 60);
    expect(session.location()).toBe(content.world.morning.map);
    expect(session.morningSpawn()).toEqual(content.world.morning.spawn);
    const names = events.map((e) => e.name);
    expect(names.indexOf('day.ended')).toBeLessThan(names.indexOf('day.started'));
    expect(events.find((e) => e.name === 'day.started')?.payload).toEqual({ day: 2 });
  });

  it('às 2h da madrugada ela desmaia de sono: o dia acaba sozinho', () => {
    const { session } = newSession();
    session.state.time = 26 * 60 - 1;
    session.tickClock(5);
    expect(session.state.day).toBe(2);
    // Desmaiou: acorda tarde.
    expect(session.state.time).toBe(10 * 60);
  });
});

describe('lousa da porta (peça fixa)', () => {
  const chalkboardOnStreet = (session: GameSession) => session.mapData('map.street').objects.some((o) => o.id === 'obj.chalkboard');

  /** Reforma completa: acabamento em toda superfície obrigatória (data/business.json). */
  const renovate = (session: GameSession) => {
    for (const s of content.business.requiredSurfaces) session.state.finishes[s] = 'finish.test';
  };

  it('só dá para comprar a placa depois da reforma completa', () => {
    const { session } = newSession();
    expect(session.buy('item.cafe_sign')).toEqual({ ok: false, reason: 'locked' });
    renovate(session);
    const money = session.state.money;
    expect(session.buy('item.cafe_sign')).toEqual({ ok: true });
    expect(session.state.money).toBe(money - content.items['item.cafe_sign']!.price);
  });

  it('a rua só mostra a placa depois da inauguração (com a placa recebida)', () => {
    const { session } = newSession();
    renovate(session);
    session.buy('item.cafe_sign');
    expect(chalkboardOnStreet(session)).toBe(false); // funcionamento parcial: sem placa
    session.state.business = 'inaugurated';
    expect(chalkboardOnStreet(session)).toBe(true);
  });

  it('a inauguração: depois do primeiro cliente, reforma completa + placa; o negócio passa a inaugurado', () => {
    const state = newGameState(500, 'map.cafe_main', 10 * 60);
    const beats = content.story.beats.map((x) => x.id);
    state.story.completed.push(...beats.slice(0, beats.indexOf('story.first_customer') + 1));
    state.business = 'soft_open';
    const session = new GameSession(content, state);
    const events: EventName[] = [];
    session.bus.onAny((name) => events.push(name));
    expect(session.goals().map((g) => g.title)).toEqual(['A inauguração']);
    renovate(session);
    session.buy('item.cafe_sign');
    expect(session.state.business).toBe('inaugurated');
    expect(events).toContain('business.changed');
    expect(chalkboardOnStreet(session)).toBe(true);
  });

  it('compra uma vez só e não tem devolução', () => {
    const { session } = newSession();
    renovate(session);
    session.buy('item.cafe_sign');
    expect(session.buy('item.cafe_sign')).toEqual({ ok: false, reason: 'already_owned' });
    expect(session.refund('item.cafe_sign').ok).toBe(false);
  });
});

describe('progresso da faxina na meta', () => {
  it('conta as teias limpas', () => {
    const { session } = newSession();
    startOnStreet(session);
    realtorTour(session);
    const webs = () => session.goals()[0]!.steps[0]!;
    const total = webs().progress![1];
    expect(webs().progress).toEqual([0, total]);
    session.clean('dirt.web_spider');
    expect(webs().progress).toEqual([1, total]);
  });
});

describe('dia 2: a Gabi', () => {
  const requested = (events: { name: EventName; payload: unknown }[], name: EventName, key: string) =>
    events.filter((e) => e.name === name).map((e) => (e.payload as Record<string, string>)[key]);

  it('o presente não se compra nem se devolve', () => {
    const { session } = newSession();
    expect(session.buy('item.dishes_set').ok).toBe(false);
    session.receiveItem('item.dishes_set');
    expect(session.refund('item.dishes_set').ok).toBe(false);
  });
});

describe('mercado: matéria-prima', () => {
  it('vende a matéria-prima (café, chá, frutas, despensa) e as receitas usam só itens do mercado', () => {
    const { session } = newSession();
    const sold = new Set(session.shopItems('shop.market'));
    const ingredients = Object.values(content.items).filter((i) => i.tags.includes('ingredient'));
    expect(ingredients.length).toBe(24); // 19 de bebidas + 5 da padaria
    for (const i of ingredients) expect(sold.has(i.id)).toBe(true);
    for (const r of Object.values(content.recipes)) for (const id of Object.keys(r.ingredients)) expect(sold.has(id)).toBe(true);
    expect(session.buy('item.coffee_ground')).toEqual({ ok: true });
    expect(session.state.inventory['item.coffee_ground']).toBe(1);
  });
});

describe('pedidos da vila', () => {
  const afterPrologue = () => {
    const ctx = newSession();
    startInCafe(ctx.session);
    finishPrologue(ctx.session);
    return ctx;
  };

  it('só aparecem depois do prólogo', () => {
    const { session } = newSession();
    expect(session.availableJobs()).toEqual([]);
    expect(afterPrologue().session.availableJobs().length).toBe(8);
  });

  it('um de cada vez; paga ao concluir e conta no resumo do dia', () => {
    const { session, events } = afterPrologue();
    const money = session.state.money;
    expect(session.acceptJob('job.market_shelves')).toEqual({ ok: true });
    expect(session.acceptJob('job.flyers')).toEqual({ ok: false, reason: 'job_full' });
    expect(session.pendingJobPoints('map.market').map((p) => p.id)).toEqual(['pt.shelf_1', 'pt.shelf_2', 'pt.shelf_3']);
    session.doJobPoint('pt.shelf_1');
    expect(session.jobStepProgress('job.market_shelves')).toEqual([1, 3]);
    session.doJobPoint('pt.shelf_2');
    session.doJobPoint('pt.shelf_3');
    expect(session.state.money).toBe(money + 25);
    expect(session.state.today).toEqual({ earned: 25, jobs: 1 });
    expect(events.some((e) => e.name === 'job.completed')).toBe(true);
    // Uma vez por dia.
    expect(session.acceptJob('job.market_shelves')).toEqual({ ok: false, reason: 'job_unavailable' });
    session.endDay('home');
    expect(session.acceptJob('job.market_shelves')).toEqual({ ok: true });
  });

  it('a entrega: pega a caixa no mercado e entrega na loja; os passos vão em ordem', () => {
    const { session } = afterPrologue();
    session.acceptJob('job.delivery');
    expect(session.pendingJobPoints('map.street')).toEqual([]);
    expect(session.doJobPoint('pt.parcel_dropoff')).toEqual({ ok: false, reason: 'not_found' });
    session.doJobPoint('pt.parcel_pickup');
    expect(session.state.inventory['item.parcel']).toBe(1);
    expect(session.pendingJobPoints('map.street').map((p) => p.id)).toEqual(['pt.parcel_dropoff']);
    session.doJobPoint('pt.parcel_dropoff');
    expect(session.state.inventory['item.parcel']).toBeUndefined();
  });

  it('pedido pela metade não passa para o dia seguinte (e a caixa volta)', () => {
    const { session } = afterPrologue();
    session.acceptJob('job.delivery');
    session.doJobPoint('pt.parcel_pickup');
    session.endDay('home');
    expect(session.activeJobs()).toEqual([]);
    expect(session.state.inventory['item.parcel']).toBeUndefined();
  });

  it('a neve aparece no mapa só enquanto o pedido está aceito', () => {
    const { session } = afterPrologue();
    const snow = () => session.mapData('map.street').objects.filter((o) => o.id.startsWith('marker.')).length;
    expect(snow()).toBe(0);
    session.acceptJob('job.clear_snow');
    expect(snow()).toBe(3);
    session.doJobPoint('pt.snow_1');
    expect(snow()).toBe(2);
  });

  it('varrer a neve exige a vassoura ativa; o ponto é achado mesmo de longe', () => {
    const { session } = afterPrologue();
    session.acceptJob('job.clear_snow');
    expect(session.jobPointAt([7, 9])?.id).toBe('pt.snow_2');
    expect(session.jobPointNear([[15, 9]], [7, 9])).toBeUndefined();
    session.selectHotbarSlot(5);
    expect(session.jobPointProblem('pt.snow_2')).toBe('needs_broom');
    expect(session.doJobPoint('pt.snow_2')).toEqual({ ok: false, reason: 'needs_broom' });
    session.selectHotbarSlot(0);
    expect(session.doJobPoint('pt.snow_2')).toEqual({ ok: true });
  });

  it('as entregas: a caixa vai da coleta no mercado até a porta da casa', () => {
    const { session } = afterPrologue();
    for (const [job, pickup, dropoff] of [
      ['job.parcel_house_a', 'pt.parcel_pickup_house_a', 'pt.parcel_dropoff_house_a'],
      ['job.parcel_house_c', 'pt.parcel_pickup_house_c', 'pt.parcel_dropoff_house_c'],
    ] as const) {
      expect(session.acceptJob(job)).toEqual({ ok: true });
      expect(session.doJobPoint(dropoff)).toEqual({ ok: false, reason: 'not_found' });
      expect(session.doJobPoint(pickup)).toEqual({ ok: true });
      expect(session.state.inventory['item.parcel']).toBe(1);
      expect(content.items['item.parcel']!.carrySprite).toBe('parcel');
      expect(session.doJobPoint(dropoff)).toEqual({ ok: true });
      expect(session.state.inventory['item.parcel'] ?? 0).toBe(0);
      expect(session.activeJobs()).toEqual([]);
    }
  });

  it('a cafeteira (com o balcão) cabe em um dia de pedidos, mesmo sem fazer todos', () => {
    const { session } = afterPrologue();
    buyAndPlace(session, 'item.cat_bed', [12, 9]);
    const total = Object.values(content.jobs).reduce((n, j) => n + j.reward, 0);
    const needed = content.items['item.coffee_machine']!.price + content.items['item.counter_single']!.price;
    // Folga: dá para pular dois pedidos do dia (ou comprar mais ração) e ainda chegar lá.
    expect(session.state.money + total).toBeGreaterThanOrEqual(needed + 50);
  });

  it('o jornal tem notícias marcadas para o dia e um sorteio estável depois', () => {
    const { session } = afterPrologue();
    expect(session.news().map((n) => n.id)).toEqual(['news.coldest_night', 'news.bakery_sold']);
    session.state.day = 9;
    const a = session.news();
    expect(a).toHaveLength(1);
    expect(session.news()).toEqual(a);
  });
});

describe('passagem dos dias e rotina', () => {
  it('só dá para ir para casa a partir das 17h; o resumo vai no fim do dia', () => {
    const { session, events } = newSession();
    session.state.time = 16 * 60;
    expect(session.canGoHome()).toBe(false);
    session.goHome();
    expect(session.state.day).toBe(1);
    session.state.time = 17 * 60;
    session.addMoney(30, 'job:test');
    session.goHome();
    expect(session.state.day).toBe(2);
    expect(session.state.time).toBe(7 * 60);
    expect(events.find((e) => e.name === 'day.ended')?.payload).toEqual({ day: 1, reason: 'home', earned: 30, jobs: 0 });
    expect(session.state.today).toEqual({ earned: 0, jobs: 0 });
  });

  it('devolver item não conta como dinheiro ganho', () => {
    const { session } = newSession();
    session.buy('item.cactus');
    session.refund('item.cactus');
    expect(session.state.today.earned).toBe(0);
  });

  it('o gato come uma vez por dia; a rotina mostra comida e poeira', () => {
    const { session } = newSession();
    startInCafe(session);
    finishPrologue(session);
    session.enter('map.cafe_main');
    const bowl = session.bowlNear([[14, 8]])!;
    session.buy('item.cat_food_basic');
    session.selectHotbarItem('item.cat_food_basic');
    expect(session.chores().find((c) => c.kind === 'feed')?.done).toBe(false);
    expect(session.feedFromBowl(bowl)).toEqual({ ok: true });
    expect(session.feedFromBowl(bowl)).toEqual({ ok: false, reason: 'already_fed' });
    expect(session.chores().find((c) => c.kind === 'feed')?.done).toBe(true);
  });

  it('de manhã volta um pouco de poeira (depois do prólogo)', () => {
    const { session } = newSession();
    startInCafe(session);
    finishPrologue(session);
    const dust = () => session.visibleDirt().filter((d) => d.tags.includes('daily')).length;
    expect(dust()).toBe(content.world.dailyDirt);
    for (const d of session.visibleDirt().filter((x) => x.tags.includes('daily'))) session.clean(d.id);
    expect(dust()).toBe(0);
    session.endDay('home');
    expect(dust()).toBe(content.world.dailyDirt);
  });
});

describe('correio: compras do catálogo chegam na porta', () => {
  const minutes = (m: number) => m / content.dayNight.minutesPerSecond;
  const inCafe = () => {
    const ctx = newSession();
    startInCafe(ctx.session);
    ctx.session.state.time = 10 * 60;
    return ctx;
  };

  it('encomendar desconta na hora e a caixa chega 1h depois na porta', () => {
    const { session, events } = inCafe();
    const money = session.state.money;
    expect(session.order('item.cactus')).toEqual({ ok: true });
    expect(session.state.money).toBe(money - content.items['item.cactus']!.price);
    expect(session.state.inventory['item.cactus']).toBeUndefined();
    expect(session.nextArrival()).toBe(session.state.day * 1440 + 11 * 60);
    session.tickClock(minutes(59));
    expect(session.deliveriesAt('door')).toBe(0);
    session.tickClock(minutes(2));
    expect(session.deliveriesAt('door')).toBe(1);
    expect(events.some((e) => e.name === 'delivery.arrived')).toBe(true);
  });

  it('fora do horário do correio, chega no dia seguinte às 9h', () => {
    const { session } = inCafe();
    session.state.time = 17 * 60 + 30;
    session.order('item.cactus');
    expect(session.nextArrival()).toBe((session.state.day + 1) * 1440 + 9 * 60);
  });

  it('no máximo 3 caixas a caminho ou na porta; depois de retirar, pode comprar de novo', () => {
    const { session } = inCafe();
    session.addMoney(500, 'test');
    for (let i = 0; i < 3; i++) expect(session.order('item.cactus')).toEqual({ ok: true });
    expect(session.order('item.cactus')).toEqual({ ok: false, reason: 'door_full' });
    session.tickClock(minutes(61));
    session.enter('map.street');
    session.pickUpParcels();
    expect(session.order('item.cactus')).toEqual({ ok: true });
  });

  it('pega na porta, leva para dentro e abre uma de cada vez: o item vai para a bolsa', () => {
    const { session } = inCafe();
    session.addMoney(500, 'test');
    session.order('item.cactus');
    session.order('item.plant_pot');
    session.tickClock(minutes(61));
    session.enter('map.street');
    const door = content.delivery.door.at;
    expect(session.parcelsNear([[door[0], door[1] + 1]])).toBe('door');
    expect(session.pickUpParcels()).toEqual({ ok: true });
    expect(session.deliveriesAt('carried')).toBe(2);
    session.enter('map.cafe_main');
    expect(session.deliveriesAt('inside')).toBe(2);
    const inside = content.delivery.inside.at;
    expect(session.parcelsNear([[inside[0], inside[1] + 1]])).toBe('inside');
    expect(session.unpackParcel()).toEqual({ ok: true, itemId: 'item.cactus' });
    expect(session.state.inventory['item.cactus']).toBe(1);
    expect(session.unpackParcel()).toEqual({ ok: true, itemId: 'item.plant_pot' });
    expect(session.unpackParcel()).toEqual({ ok: false, reason: 'nothing_here' });
  });

  it('a lousa (peça fixa) também vem pelo correio e só uma vez', () => {
    const { session } = inCafe();
    for (const s of content.business.requiredSurfaces) session.state.finishes[s] = 'finish.test';
    session.state.business = 'inaugurated';
    session.order('item.cafe_sign');
    expect(session.order('item.cafe_sign')).toEqual({ ok: false, reason: 'already_owned' });
    expect(session.mapData('map.street').objects.some((o) => o.id === 'obj.chalkboard')).toBe(false);
    session.tickClock(minutes(61));
    session.enter('map.street');
    session.pickUpParcels();
    session.enter('map.cafe_main');
    session.unpackParcel();
    expect(session.mapData('map.street').objects.some((o) => o.id === 'obj.chalkboard')).toBe(true);
  });

  it('Dona Neusa vem quando a cafeteira entra no café; a Gabi liga quando as mesas chegam na porta', () => {
    const { session, events } = newSession();
    startInCafe(session);
    finishPrologue(session);
    session.enter('map.cafe_main');
    buyAndPlace(session, 'item.cat_bed', [12, 9]);
    session.addMoney(1000, 'test');
    const scripts = () => events.filter((e) => e.name === 'script.requested').map((e) => (e.payload as { scriptId: string }).scriptId);
    const called = () => events.some((e) => e.name === 'cutscene.requested' && (e.payload as { cutsceneId: string }).cutsceneId === 'cs.gabi_call');
    session.state.time = 10 * 60;
    session.order('item.coffee_machine');
    // Encomendou: o passo "encomendar" vale, mas a Dona Neusa espera a caixa entrar.
    expect(session.goals()[0]!.steps.every((s) => s.done)).toBe(true);
    session.tickClock(minutes(61));
    expect(scripts()).not.toContain('scr.neusa_visit');
    session.enter('map.street');
    session.pickUpParcels();
    session.enter('map.cafe_main');
    expect(scripts()).toContain('scr.neusa_visit');
    // Dia seguinte: mesas pelo correio.
    session.endDay('home');
    session.state.time = 10 * 60;
    session.order('item.table_round');
    session.order('item.table_round');
    expect(called()).toBe(false);
    session.tickClock(minutes(61));
    expect(called()).toBe(true);
  });
});

describe('barra de itens', () => {
  it('a vassoura entra sozinha no primeiro espaço e fica ativa', () => {
    const { session } = newSession();
    expect(session.state.hotbar.slots[0]).toBe('item.broom');
    expect(session.activeItem()).toBe('item.broom');
  });

  it('varrer sujeira exige a vassoura ativa', () => {
    const { session } = newSession();
    startOnStreet(session);
    realtorTour(session);
    const dirt = session.visibleDirt().find((d) => !d.clearedBy)!;
    session.selectHotbarSlot(3);
    expect(session.activeItem()).toBeNull();
    expect(session.clean(dirt.id)).toEqual({ ok: false, reason: 'needs_broom' });
    session.selectHotbarSlot(0);
    expect(session.clean(dirt.id)).toEqual({ ok: true });
  });

  it('pôr um item no espaço ativo troca de lugar com o que já estava na barra', () => {
    const { session, events } = newSession();
    expect(session.buy('item.cat_food_basic')).toEqual({ ok: true });
    session.selectHotbarSlot(2);
    expect(session.assignToHotbar('item.cat_food_basic')).toEqual({ ok: true });
    expect(session.assignToHotbar('item.broom')).toEqual({ ok: true });
    expect(session.state.hotbar.slots.slice(0, 3)).toEqual(['item.cat_food_basic', null, 'item.broom']);
    expect(session.activeItem()).toBe('item.broom');
    expect(events.some((e) => e.name === 'hotbar.changed')).toBe(true);
  });

  it('móvel e item que ela não tem não vão para a barra', () => {
    const { session } = newSession();
    expect(session.buy('item.cactus')).toEqual({ ok: true });
    expect(session.assignToHotbar('item.cactus')).toEqual({ ok: false, reason: 'unknown_item' });
    expect(session.assignToHotbar('item.cat_food_basic')).toEqual({ ok: false, reason: 'not_in_inventory' });
  });
});

describe('usar itens da barra', () => {
  it('ração e petisco entram sozinhos na barra; a vassoura continua ativa', () => {
    const { session } = newSession();
    session.buy('item.cat_food_basic');
    session.buy('item.cat_treat_biscuit');
    expect(session.state.hotbar.slots.slice(0, 3)).toEqual(['item.broom', 'item.cat_food_basic', 'item.cat_treat_biscuit']);
    expect(session.activeItem()).toBe('item.broom');
  });

  it('a ração escolhida é a que vai para a tigela (simples ou premium)', () => {
    const { session, events } = newSession();
    startInCafe(session);
    session.buy('item.cat_food_basic');
    session.buy('item.cat_food_premium');
    buyAndPlace(session, 'item.food_bowl', [14, 9]);
    session.selectHotbarItem('item.cat_food_premium');
    expect(session.feedFromBowl(session.bowlNear([[14, 8]])!)).toEqual({ ok: true });
    expect(session.state.inventory['item.cat_food_premium'] ?? 0).toBe(0);
    expect(session.state.inventory['item.cat_food_basic']).toBe(1);
    expect(events.find((e) => e.name === 'cat.fed')?.payload).toMatchObject({ itemId: 'item.cat_food_premium' });
  });

  it('petisco ativo: dá ao gato direto da mochila e ganha pontos', () => {
    const { session } = newSession();
    startInCafe(session);
    session.buy('item.cat_treat_biscuit');
    expect(session.holdingTreat()).toBe(false);
    expect(session.treatCat('cat.first_stray')).toEqual({ ok: false, reason: 'needs_treat' });
    session.selectHotbarItem('item.cat_treat_biscuit');
    expect(session.holdingTreat()).toBe(true);
    const before = session.state.relationships['player|cat.first_stray'] ?? 0;
    expect(session.treatCat('cat.first_stray')).toEqual({ ok: true });
    expect(session.state.relationships['player|cat.first_stray']).toBe(before + content.relationships.treatPoints);
    expect(session.state.inventory['item.cat_treat_biscuit'] ?? 0).toBe(0);
  });
});

describe('evolução das receitas', () => {
  it('o café começa só com o café preto; as outras destrancam com clientes atendidos, com aviso', () => {
    const { session, events } = newSession();
    session.start(true);
    const unlocked = () => session.service.unlockedRecipes().map((r) => r.id);
    expect(unlocked()).toEqual(['recipe.black_coffee']);
    session.state.service.served = 6;
    session.service.toggleMenu('recipe.black_coffee'); // qualquer ação avança a história
    expect(unlocked()).toContain('recipe.black_tea');
    expect(events.filter((e) => e.name === 'recipe.unlocked').map((e) => e.payload)).toEqual([{ recipeId: 'recipe.black_tea' }]);
    // Avisa uma vez só.
    session.service.toggleMenu('recipe.black_coffee');
    expect(events.filter((e) => e.name === 'recipe.unlocked')).toHaveLength(1);
  });

  it('o equipamento e os ingredientes só aparecem quando alguma receita destrancada usa eles', () => {
    const { session } = newSession();
    expect(session.itemUnlocked('item.coffee_machine')).toBe(true);
    expect(session.itemUnlocked('item.coffee_ground')).toBe(true);
    expect(session.itemUnlocked('item.teapot')).toBe(false);
    expect(session.itemUnlocked('item.tea_black_bag')).toBe(false);
    expect(session.buy('item.teapot')).toEqual({ ok: false, reason: 'locked' });
    session.state.service.served = 6;
    expect(session.itemUnlocked('item.teapot')).toBe(true);
    expect(session.itemUnlocked('item.tea_black_bag')).toBe(true);
    // O forno só com o pão de queijo; móveis e coisas de gato não mudam.
    expect(session.itemUnlocked('item.oven')).toBe(false);
    expect(session.itemUnlocked('item.table_round')).toBe(true);
    expect(session.itemUnlocked('item.honey')).toBe(false); // nenhuma receita usa mel ainda
  });

  it('save antigo: receitas já destrancadas não avisam de novo ao abrir', () => {
    const { session, events } = newSession();
    session.state.service.served = 20;
    session.start(false);
    expect(events.some((e) => e.name === 'recipe.unlocked')).toBe(false);
  });
});
