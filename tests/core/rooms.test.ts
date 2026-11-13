import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { EventName } from '../../src/core/events';
import { catCapacity, resolvedLook, visibleArea } from '../../src/core/rooms';
import { knownIds, parseSave, serializeSave } from '../../src/core/save';
import { GameSession } from '../../src/core/session';
import { newGameState, type GameState } from '../../src/core/state';
import { parseClock } from '../../src/core/time';
import { resolveMap } from '../../src/core/map';
import { loadContent } from './content';

const content = loadContent();
const beats = content.story.beats.map((b) => b.id);
const until = (id: string) => beats.slice(0, beats.indexOf(id) + 1);

/** No café, já inaugurado e com movimento (o quartinho já pode ser descoberto: 40 clientes, dia 6). */
function afterFirstCustomer(money = 1000, progress: { served?: number; day?: number } = {}) {
  const state = newGameState(money, 'map.cafe_main', 10 * 60);
  state.flags['has.cat'] = true;
  state.cats['cat.first_stray'] = { sheltered: true, name: 'Botinhas', map: 'map.cafe_main', shelteredOn: 1, health: 80, sickness: null };
  state.inventory['item.broom'] = 1;
  // Os marcos dos cômodos ficam antes da inauguração no arquivo: não entram como concluídos.
  state.story.completed.push(...until('story.inauguration').filter((b) => b !== 'story.back_room' && b !== 'story.backyard'));
  state.business = 'inaugurated';
  state.service.served = progress.served ?? 40;
  state.day = progress.day ?? 6;
  const session = new GameSession(content, state);
  const events: { name: EventName; payload: unknown }[] = [];
  session.bus.onAny((name, payload) => events.push({ name, payload }));
  session.start(false);
  return { session, state, events };
}

const dialogues = (events: { name: EventName; payload: unknown }[]) =>
  events.filter((e) => e.name === 'dialogue.requested').map((e) => (e.payload as { dialogueId: string }).dialogueId);

/**
 * A cena do jardim secreto: um mês depois de abrir o porão, no café de dia, o marco roda o roteiro; o roteiro (no jogo)
 * faz a porta aparecer (discoverRoom) e abre com a chave (openDoor). Aqui: o marco e a descoberta.
 */
function secretGarden(ctx: { session: GameSession; state: GameState }): void {
  ctx.state.day += 31;
  ctx.state.time = 10 * 60;
  ctx.state.location = 'map.cafe_main';
  ctx.session.tickClock(1 / content.dayNight.minutesPerSecond);
  expect(ctx.state.story.completed).toContain('story.secret_garden');
  ctx.session.discoverRoom('room.backyard');
}

/** Limpa com a vassoura toda a sujeira visível com esta tag (de pé ao lado); `heavy`: a pesada também sai (como na limpeza do Tião). */
function cleanTag(session: GameSession, tag: string, heavy = false) {
  for (const d of session.visibleDirt().filter((x) => x.tags.includes(tag))) {
    if (d.heavy) {
      if (heavy) session.state.cleaned.push(d.id);
      continue;
    }
    expect(session.clean(d.id, [d.at])).toEqual({ ok: true });
  }
}

describe('cômodos: dados e regras', () => {
  it('começo: só o salão aberto; 4 gatos de capacidade; a câmera vê só o salão', () => {
    const state = newGameState(100);
    expect(catCapacity(content.rooms, state)).toBe(4);
    expect(visibleArea(content.rooms, state)).toEqual({ from: [0, 0], to: [15, 10] });
  });

  it('o visual muda com o estado e a variante (quintal: sebe por padrão)', () => {
    const yard = content.rooms.rooms.find((r) => r.id === 'room.backyard')!;
    expect(resolvedLook(yard, 'abandoned').legend.g).toBeUndefined(); // grama do mapa (seca)
    expect(resolvedLook(yard, 'restored').legend.g).toBe('yard_grama_a');
    expect(Object.keys(yard.variants!)).toEqual(['hedge']); // a variante de tijolo saiu na arte nova (decisão 065)
    // Reformado, o quintal começa só com a grama e o caminho; as árvores antigas vêm posicionadas (dá para remover).
    expect(resolvedLook(yard, 'restored').objects.filter((o) => o.tile.startsWith('yard_') && o.tile !== 'yard_fundo_ceu_telhados')).toEqual([]);
    expect(yard.placeItems?.filter((p) => content.items[p.item]?.tags.includes('tree')).length).toBeGreaterThan(4);
  });

  it('todas as variantes do quintal, em todos os estados, dão um mapa válido', () => {
    for (const variant of Object.keys(content.rooms.rooms.find((r) => r.id === 'room.backyard')!.variants!)) {
      for (const st of ['locked', 'discovered', 'abandoned', 'restored'] as const) {
        const c = structuredClone(content);
        c.rooms.rooms.find((r) => r.id === 'room.backyard')!.variant = variant;
        const s = new GameSession(c, newGameState(100, 'map.cafe_main'));
        s.state.rooms['room.backyard'] = st;
        expect(() => resolveMap(s.mapData(), c.catalog)).not.toThrow();
      }
    }
  });

  it('a sujeira de cômodo fechado não aparece nem se limpa', () => {
    const s = new GameSession(content, newGameState(100, 'map.cafe_main'));
    expect(s.visibleDirt().some((d) => d.tags.includes('back_room'))).toBe(false);
    expect(s.clean('dirt.back_room_junk')).toEqual({ ok: false, reason: 'not_found' });
  });
});

describe('quartinho: descoberta, obra, limpeza, reforma, dormir', () => {
  it('a vizinha conta: depois do primeiro cliente ele é descoberto (fala + porta destacada)', () => {
    const { session, events } = afterFirstCustomer();
    expect(session.roomState('room.back_room')).toBe('discovered');
    expect(session.doorState('door.back_room')).toBe('locked');
    expect(dialogues(events)).toContain('dlg.room_back_found');
    expect(events.find((e) => e.name === 'room.discovered')?.payload).toEqual({ roomId: 'room.back_room', trigger: 'neighbor_tells', highlight: 'door.back_room' });
    expect(session.goals().map((g) => g.title)).toContain('O porão');
  });

  it('reformado sem limpar (save antigo): a sujeira do porão não aparece', () => {
    const { session, state } = afterFirstCustomer();
    state.rooms['room.back_room'] = 'abandoned';
    expect(session.visibleDirt().some((d) => d.id === 'dirt.back_room_junk')).toBe(true);
    state.rooms['room.back_room'] = 'restored';
    expect(session.visibleDirt().some((d) => d.tags.includes('back_room'))).toBe(false);
  });

  it('a porta de obra não abre com E: avisa e pede a obra no catálogo', () => {
    const { session, events } = afterFirstCustomer();
    expect(session.useRoomDoor('door.back_room')).toMatchObject({ ok: false, problem: 'needs_money' });
    expect(dialogues(events)).toContain('dlg.door_back_room_locked');
  });

  it('o ritmo: sem a inauguração e 40 clientes, o quartinho continua oculto', () => {
    expect(afterFirstCustomer(1000, { served: 39 }).session.roomState('room.back_room')).toBe('locked');
  });

  it('obra: sem dinheiro não abre; pagando, abre sujo e a capacidade sobe (o quintal ainda não)', () => {
    const poor = afterFirstCustomer(50);
    expect(poor.session.openRoom('room.back_room')).toMatchObject({ ok: false, problem: 'needs_money' });
    const { session, state, events } = afterFirstCustomer(1000);
    expect(session.openRoom('room.back_room')).toEqual({ ok: true });
    expect(state.money).toBe(1000 - 200);
    expect(session.roomState('room.back_room')).toBe('abandoned');
    expect(session.doorState('door.back_room')).toBe('open');
    expect(session.catCapacity()).toBe(4 + 3);
    expect(session.roomState('room.backyard')).toBe('locked');
    void events;
    // A passagem aberta não é mais sólida.
    expect(resolveMap(session.mapData(), content.catalog).solid[7]![16]).toBe(false);
  });

  it('reforma: só depois de limpar; com a obra paga, ela dorme no café e acorda no quartinho', () => {
    const { session, state } = afterFirstCustomer();
    session.openRoom('room.back_room');
    expect(session.restoreRoom('room.back_room')).toMatchObject({ ok: false, problem: 'still_dirty' });
    cleanTag(session, 'back_room');
    expect(session.restoreRoom('room.back_room')).toEqual({ ok: true });
    expect(session.roomState('room.back_room')).toBe('restored');
    expect(session.mapData().legend.f).toBe('floor_wood_b');
    expect(session.sleepInCafe()).toEqual({ ok: false, reason: 'too_early' });
    state.time = parseClock(content.dayNight.goHomeFrom);
    const day = state.day;
    expect(session.sleepInCafe()).toEqual({ ok: true });
    expect(state.day).toBe(day + 1);
    expect(state.location).toBe('map.cafe_main');
    expect(session.morningSpawn()).toEqual([20, 6]);
  });

  it('não dá para pôr móvel em cômodo fechado nem na frente da passagem', () => {
    const { session, state } = afterFirstCustomer();
    state.inventory['item.cat_bed'] = 1;
    expect(session.checkPlacement('item.cat_bed', [20, 8])).toBe('room_closed');
    expect(session.checkPlacement('item.cat_bed', [15, 7])).toBe('blocks_door');
    session.openRoom('room.back_room');
    expect(session.checkPlacement('item.cat_bed', [20, 8])).toBeNull();
  });
});

describe('quintal secreto: chave, porta com cadeado, playground', () => {
  /** Porão aberto e limpo (a chave achada); 30 dias depois, no café de dia: a cena do jardim secreto acha a porta. */
  function withBackRoomOpen() {
    const ctx = afterFirstCustomer(1000, { served: 100, day: 12 });
    ctx.session.openRoom('room.back_room');
    cleanTag(ctx.session, 'back_room');
    secretGarden(ctx);
    return ctx;
  }

  it('jardim secreto: 30 dias depois de abrir o porão, com a chave, a cena acha a porta; a chave abre e é usada', () => {
    const ctx = afterFirstCustomer(1000, { served: 100, day: 12 });
    const { session, state, events } = ctx;
    ctx.session.openRoom('room.back_room');
    cleanTag(session, 'back_room');
    expect(state.inventory['item.key_backyard']).toBe(1);
    expect(dialogues(events)).toContain('dlg.key_backyard_found');
    const scripts = () => events.filter((e) => e.name === 'script.requested').map((e) => (e.payload as { scriptId: string }).scriptId);
    state.day += 29;
    session.tickClock(1 / content.dayNight.minutesPerSecond);
    expect(scripts()).not.toContain('scr.secret_garden'); // ainda não fez um mês
    expect(session.roomState('room.backyard')).toBe('locked');
    secretGarden(ctx);
    expect(scripts()).toContain('scr.secret_garden');
    expect(session.roomState('room.backyard')).toBe('discovered');
    expect(events.find((e) => e.name === 'room.discovered' && (e.payload as { roomId: string }).roomId === 'room.backyard')?.payload).toMatchObject({ trigger: 'renovation', highlight: 'door.backyard' });
    delete state.inventory['item.key_backyard'];
    expect(session.useRoomDoor('door.backyard')).toMatchObject({ ok: false, problem: 'needs_item' });
    expect(dialogues(events)).toContain('dlg.door_backyard_locked');
    state.inventory['item.key_backyard'] = 1;
    expect(session.useRoomDoor('door.backyard')).toEqual({ ok: true });
    expect(state.inventory['item.key_backyard']).toBeUndefined();
    expect(session.roomState('room.backyard')).toBe('abandoned');
    expect(session.catCapacity()).toBe(4 + 3 + 6);
  });

  it('playground: módulo só com o quintal reformado e 10 gatos; só no quintal; dá afeto por dia', () => {
    const { session, state } = withBackRoomOpen();
    session.useRoomDoor('door.backyard');
    expect(session.itemUnlocked('item.playground_tunnel')).toBe(false);
    cleanTag(session, 'backyard', true);
    session.restoreRoom('room.backyard');
    expect(session.itemUnlocked('item.playground_tunnel')).toBe(false); // ainda 1 gato
    for (let i = 0; i < 9; i++) state.cats[`cat.test_${i}`] = { sheltered: true, name: `G${i}`, map: 'map.cafe_main', shelteredOn: 1, health: 80, sickness: null };
    expect(session.itemUnlocked('item.playground_tunnel')).toBe(true);
    state.inventory['item.playground_tunnel'] = 1;
    expect(session.checkPlacement('item.playground_tunnel', [10, 8])).toBe('wrong_room');
    expect(session.place('item.playground_tunnel', [34, 8])).toEqual({ ok: true });
    const before = state.relationships['player|cat.first_stray'] ?? 0;
    session.endDay('home');
    expect(state.relationships['player|cat.first_stray']).toBe(before + content.rooms.playground.pointsPerModulePerDay);
  });
});

describe('salão e save', () => {
  it('o salão fica "reformado" sozinho quando a reforma da inauguração termina', () => {
    const { session, state } = afterFirstCustomer();
    state.construction.repaired = ['inside', 'outside'];
    session.buy('item.cushion_pink'); // qualquer ação reavalia a história
    expect(session.roomState('room.hall')).toBe('restored');
  });

  it('save_v14 guarda cômodos e passagens; estado inválido volta ao inicial', () => {
    const known = knownIds(content);
    const raw = readFileSync('tests/fixtures/save_v14.json', 'utf8');
    const { state } = parseSave(raw, known);
    expect(state.rooms).toEqual({ 'room.back_room': 'restored' });
    expect(state.doors).toEqual({ 'door.back_room': 'open' });
    const broken = JSON.stringify({ ...JSON.parse(raw), rooms: { 'room.back_room': 'pintado', 'room.sotao': 'restored' } });
    expect(parseSave(broken, known).state.rooms).toEqual({});
  });

  it('save antigo (v13): cômodos no estado inicial', () => {
    const { state } = parseSave(readFileSync('tests/fixtures/save_v13.json', 'utf8'), knownIds(content));
    expect(state.rooms).toEqual({});
    expect(state.doors).toEqual({});
  });
});

describe('saves antigos ("*" = salão todo limpo)', () => {
  it('a virada do dia não marca como limpa a sujeira dos cômodos novos', () => {
    const { session, state } = afterFirstCustomer();
    state.cleaned = ['*'];
    session.endDay('home');
    expect(state.cleaned.some((id) => id.startsWith('dirt.back_room') || id.startsWith('dirt.backyard'))).toBe(false);
  });
});

describe('obras dos cômodos pelo Tião (data/rooms.json builder)', () => {
  /** Café inaugurado, com os dois reparos feitos e o Tião conhecido. */
  function withBuilder(money = 1000) {
    const ctx = afterFirstCustomer(money);
    ctx.state.flags['painter.available'] = true;
    ctx.state.construction.repaired = ['inside', 'outside'];
    return ctx;
  }
  /** Aceita o orçamento e passa os dias até a obra terminar. */
  function acceptAndWait(session: GameSession, onWorkDay?: () => void): void {
    expect(session.answerQuote(true)).toEqual({ ok: true });
    const end = session.state.construction.job!.endDay!;
    while (session.state.day <= end) {
      session.endDay('home');
      if (session.state.day <= end) onWorkDay?.();
    }
  }

  it('abrir o porão: ligação, paga adiantado, ele trabalha 1 dia ao lado da passagem; no dia seguinte a porta abre', () => {
    const { session, state, events } = withBuilder();
    expect(session.roomWorks('room.back_room')).toMatchObject([{ kind: 'room_open', cost: 200, days: 1 }]);
    expect(session.quoteRoom('room.back_room')).toEqual({ ok: true });
    expect(events.some((e) => e.name === 'construction.call')).toBe(true);
    expect(state.money).toBe(1000); // só paga ao aceitar
    const spots: unknown[] = [];
    acceptAndWait(session, () => {
      session.state.time = 10 * 60; // no expediente dele
      spots.push(session.builderAt('map.cafe_main'));
    });
    expect(spots).toEqual([{ at: [15, 7], facing: 'right' }]);
    expect(state.money).toBe(1000 - 200);
    expect(session.roomState('room.back_room')).toBe('abandoned');
    expect(session.doorState('door.back_room')).toBe('open');
    expect(dialogues(events)).toContain('dlg.room_back_opened');
    expect(state.construction.job).toBeNull();
  });

  it('reforma: só depois de limpar; 2 dias dentro do porão; termina reformado', () => {
    const { session, state } = withBuilder();
    session.openRoom('room.back_room');
    expect(session.quoteRoom('room.back_room')).toEqual({ ok: false, reason: 'room_not_ready' });
    cleanTag(session, 'back_room');
    expect(session.quoteRoom('room.back_room')).toEqual({ ok: true });
    const spots: unknown[] = [];
    acceptAndWait(session, () => {
      session.state.time = 10 * 60; // no expediente dele
      spots.push(session.builderAt('map.cafe_main'));
    });
    expect(spots).toEqual([{ at: [24, 4], facing: 'right' }, { at: [24, 4], facing: 'right' }]);
    expect(session.roomState('room.back_room')).toBe('restored');
    expect(state.money).toBe(1000 - 200 - 150);
  });

  it('uma obra por vez; antes dos reparos não dá; sem dinheiro, avisa', () => {
    const { session } = withBuilder();
    expect(session.quoteRoom('room.back_room')).toEqual({ ok: true });
    expect(session.answerQuote(true)).toEqual({ ok: true });
    expect(session.quoteRepair('inside')).toEqual({ ok: false, reason: 'busy' });
    const early = withBuilder();
    early.state.construction.repaired = ['inside'];
    expect(early.session.quoteRoom('room.back_room')).toEqual({ ok: false, reason: 'repair_first' });
    expect(withBuilder(50).session.quoteRoom('room.back_room')).toEqual({ ok: false, reason: 'no_money' });
  });

  it('o lugar dele em cada obra é piso livre do mapa', () => {
    const s = new GameSession(content, newGameState(100, 'map.cafe_main'));
    for (const id of ['room.back_room', 'room.backyard']) s.state.rooms[id] = 'abandoned';
    const map = resolveMap(s.mapData(), content.catalog);
    for (const room of content.rooms.rooms) {
      for (const b of [room.unlock?.builder, room.restore?.builder]) {
        if (!b) continue;
        const [c, r] = b.site.at;
        expect(map.solid[r]![c], `${room.id} ${b.site.at}`).toBe(false);
      }
    }
  });

  it('a obra do cômodo volta do save', () => {
    const { session } = withBuilder();
    session.quoteRoom('room.back_room');
    session.answerQuote(true);
    const back = parseSave(serializeSave(session.state, new Date(0)), knownIds(content));
    expect(back.state.construction.job).toMatchObject({ kind: 'room_open', roomId: 'room.back_room', site: { at: [15, 7] } });
  });
});

describe('quintal: limpeza pesada do Tião e os itens dos cômodos no Market', () => {
  /** Quintal aberto (com a chave), Tião conhecido e os reparos feitos. */
  function yardOpen(money = 2000) {
    const ctx = afterFirstCustomer(money, { served: 100, day: 12 });
    ctx.state.flags['painter.available'] = true;
    ctx.state.construction.repaired = ['inside', 'outside'];
    ctx.session.openRoom('room.back_room');
    cleanTag(ctx.session, 'back_room');
    ctx.session.restoreRoom('room.back_room');
    secretGarden(ctx);
    ctx.session.useRoomDoor('door.backyard');
    return ctx;
  }
  const finishJob = (session: GameSession) => {
    expect(session.answerQuote(true)).toEqual({ ok: true });
    const end = session.state.construction.job!.endDay!;
    while (session.state.day <= end) session.endDay('home');
  };

  it('primeira olhada no quintal sujo: o susto e a ligação para o Tião (uma vez); com ele em obra, só o aviso', () => {
    const { session, state } = yardOpen();
    const scripts: string[] = [];
    session.bus.on('script.requested', ({ scriptId }) => scripts.push(scriptId));
    session.setPlayerCell([10, 6]); // no salão: nada
    expect(scripts).toEqual([]);
    session.setPlayerCell([34, 8]); // no quintal
    session.setPlayerCell([35, 8]);
    expect(scripts).toEqual(['scr.yard_first_look']);
    // O passo do roteiro: a obra de limpeza; com o Tião em outra obra, "busy" (a fala de esperar; nada fica pendente).
    expect(session.quoteRoom('room.backyard', 'room_clear')).toEqual({ ok: true });
    expect(session.quoteRoom('room.backyard', 'room_clear')).toEqual({ ok: false, reason: 'busy' });
    expect(state.flags['seen.firstlook.room.backyard']).toBe(true);
  });

  it('aberto (sujo): árvores espalhadas, dá para remover (some de vez); a muda cresce até virar árvore', () => {
    const { session, state } = yardOpen();
    const trees = () => state.placed.filter((p) => p.item === 'item.yard_big_tree');
    expect(trees()).toHaveLength(1); // já no quintal sujo, com as outras espalhadas
    expect(state.placed.filter((p) => content.items[p.item]?.tags.includes('tree')).length).toBeGreaterThan(4);
    cleanTag(session, 'backyard', true);
    expect(session.restoreRoom('room.backyard')).toEqual({ ok: true });
    expect(trees()).toHaveLength(1); // a reforma não traz outras
    expect(session.removeTree(trees()[0]!.uid)).toEqual({ ok: true });
    expect(trees()).toHaveLength(0);
    expect(state.inventory['item.yard_big_tree']).toBeUndefined(); // não vai para a mochila
    // Recarregar não traz a árvore de volta.
    const back = new GameSession(content, parseSave(serializeSave(state, new Date(0)), knownIds(content)).state);
    expect(back.state.placed.filter((p) => p.item === 'item.yard_big_tree')).toHaveLength(0);
    // A muda: plantada, cresce em dias.
    state.inventory['item.yard_sapling'] = 1;
    expect(session.place('item.yard_sapling', [33, 6])).toEqual({ ok: true });
    const sapling = state.placed.find((p) => p.item === 'item.yard_sapling')!;
    expect(sapling.plantedOn).toBe(state.day);
    for (let i = 0; i < 3; i++) session.endDay('home');
    expect(sapling.item).toBe('item.yard_tree_young');
    for (let i = 0; i < 4; i++) session.endDay('home');
    expect(sapling.item).toBe('item.yard_tree_thin');
    expect(sapling.at).toEqual([33, 4]); // a árvore fina (1x3) sobe pela base
    expect(session.removeTree(sapling.uid)).toEqual({ ok: true });
    // Grama: sem colisão.
    expect(content.catalog.tiles[content.items['item.yard_tall_grass']!.tile!]!.solid).toBe(false);
    expect(content.catalog.tiles[content.items['item.yard_short_grass']!.tile!]!.solid).toBe(false);
  });

  it('o mato alto não sai com a vassoura; as folhas sim', () => {
    const { session } = yardOpen();
    const heavy = session.visibleDirt().filter((d) => d.heavy);
    expect(heavy.length).toBeGreaterThan(5); // mato, galhos, toras e grama alta
    expect(session.cleanProblem(heavy[0]!.id, [heavy[0]!.at])).toBe('heavy_dirt');
    expect(session.dirtNear([heavy[0]!.at], 0)).toBeUndefined();
    cleanTag(session, 'backyard'); // as folhas
    expect(session.roomDirtLeft('room.backyard')).toBe(heavy.length);
  });

  it('a reforma espera a limpeza pesada: o Tião tira o mato num dia e depois reforma', () => {
    const { session, state } = yardOpen();
    cleanTag(session, 'backyard');
    const money = state.money;
    expect(session.roomWorks('room.backyard').map((w) => w.kind)).toEqual(['room_clear', 'room_restore']);
    expect(session.quoteRoom('room.backyard', 'room_restore')).toEqual({ ok: false, reason: 'room_not_ready' });
    expect(session.quoteRoom('room.backyard', 'room_clear')).toEqual({ ok: true });
    finishJob(session);
    expect(session.roomHeavyDirtLeft('room.backyard')).toBe(0);
    expect(session.roomWorks('room.backyard').map((w) => w.kind)).toEqual(['room_restore']);
    expect(session.quoteRoom('room.backyard')).toEqual({ ok: true });
    finishJob(session);
    expect(session.roomState('room.backyard')).toBe('restored');
    expect(state.money).toBe(money - 80 - 120);
  });

  it('os itens do quintal só aparecem depois da reforma; os de quintal só ficam no quintal', () => {
    const { session, state } = yardOpen();
    const yardItems = Object.values(content.items).filter((i) => i.tile?.startsWith('yard_'));
    expect(yardItems.length).toBeGreaterThan(10);
    expect(yardItems.some((i) => session.itemUnlocked(i.id))).toBe(false);
    cleanTag(session, 'backyard', true);
    expect(session.restoreRoom('room.backyard')).toEqual({ ok: true });
    expect(yardItems.every((i) => session.itemUnlocked(i.id))).toBe(true);
    state.inventory['item.yard_garden_bench'] = 1;
    expect(session.checkPlacement('item.yard_garden_bench', [10, 8])).toBe('wrong_room');
    state.inventory['item.yard_topiary'] = 1;
    expect(session.checkPlacement('item.yard_topiary', [10, 8])).toBeNull();
    // As de parede vão na sebe do fundo; a pérgola cabe onde ficava antes.
    state.inventory['item.yard_hedge_lamp'] = 1;
    expect(session.checkPlacement('item.yard_hedge_lamp', [30, 2])).toBeNull();
    state.inventory['item.yard_pergola_oven'] = 1;
    expect(session.checkPlacement('item.yard_pergola_oven', [26, 4])).toBeNull();
  });

  it('toda peça de "área" tem uma seção na aba Decor do Market', () => {
    const ui = JSON.parse(readFileSync('data/ui_text.json', 'utf8')) as { market: { tabs: { id: string; groups: { tag: string }[] }[] } };
    const tags = new Set(ui.market.tabs.find((t) => t.id === 'decor')!.groups.map((g) => g.tag));
    for (const i of Object.values(content.items)) for (const t of i.tags) if (t.startsWith('area:')) expect(tags.has(t), `${i.id} ${t}`).toBe(true);
  });
});

describe('quarto: decorações no Market depois do porão reformado', () => {
  it('só aparecem com o porão reformado; as de quarto só no porão; as de parede na parede', () => {
    const { session, state } = afterFirstCustomer(2000);
    const bedroom = Object.values(content.items).filter((i) => i.tile?.startsWith('quarto_'));
    expect(bedroom.length).toBe(22);
    expect(bedroom.some((i) => session.itemUnlocked(i.id))).toBe(false);
    session.openRoom('room.back_room');
    cleanTag(session, 'back_room');
    expect(session.restoreRoom('room.back_room')).toEqual({ ok: true });
    expect(bedroom.every((i) => session.itemUnlocked(i.id))).toBe(true);
    for (const id of ['item.bedroom_wardrobe', 'item.bedroom_mirror', 'item.bedroom_pouf_pink']) state.inventory[id] = 1;
    expect(session.checkPlacement('item.bedroom_wardrobe', [10, 7])).toBe('wrong_room');
    expect(session.checkPlacement('item.bedroom_wardrobe', [21, 5])).toBeNull();
    expect(session.checkPlacement('item.bedroom_mirror', [21, 1])).toBeNull();
    expect(session.checkPlacement('item.bedroom_pouf_pink', [10, 7])).toBeNull();
  });
});
