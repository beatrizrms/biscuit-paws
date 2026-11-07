import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { EventName } from '../../src/core/events';
import { catCapacity, resolvedLook, visibleArea } from '../../src/core/rooms';
import { knownIds, parseSave } from '../../src/core/save';
import { GameSession } from '../../src/core/session';
import { newGameState } from '../../src/core/state';
import { parseClock } from '../../src/core/time';
import { resolveMap } from '../../src/core/map';
import { loadContent } from './content';

const content = loadContent();
const beats = content.story.beats.map((b) => b.id);
const until = (id: string) => beats.slice(0, beats.indexOf(id) + 1);

/** No café, depois do primeiro cliente (o quartinho já pode ser descoberto). */
function afterFirstCustomer(money = 1000) {
  const state = newGameState(money, 'map.cafe_main', 10 * 60);
  state.flags['has.cat'] = true;
  state.cats['cat.first_stray'] = { sheltered: true, name: 'Botinhas', map: 'map.cafe_main', shelteredOn: 1, health: 80, sickness: null };
  state.inventory['item.broom'] = 1;
  state.story.completed.push(...until('story.first_customer'));
  const session = new GameSession(content, state);
  const events: { name: EventName; payload: unknown }[] = [];
  session.bus.onAny((name, payload) => events.push({ name, payload }));
  session.start(false);
  return { session, state, events };
}

const dialogues = (events: { name: EventName; payload: unknown }[]) =>
  events.filter((e) => e.name === 'dialogue.requested').map((e) => (e.payload as { dialogueId: string }).dialogueId);

/** Limpa toda a sujeira visível com esta tag (de pé ao lado). */
function cleanTag(session: GameSession, tag: string) {
  for (const d of session.visibleDirt().filter((x) => x.tags.includes(tag))) expect(session.clean(d.id, [d.at])).toEqual({ ok: true });
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
    expect(resolvedLook({ ...yard, variant: 'brick' }, 'restored').legend.g).toBe('brick_grama_a');
    expect(resolvedLook(yard, 'restored').objects.some((o) => o.id === 'obj.yard_lights')).toBe(true);
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
    expect(session.goals().map((g) => g.title)).toContain('O quartinho dos fundos');
  });

  it('a porta de obra não abre com E: avisa e pede a obra no catálogo', () => {
    const { session, events } = afterFirstCustomer();
    expect(session.useRoomDoor('door.back_room')).toMatchObject({ ok: false, problem: 'needs_money' });
    expect(dialogues(events)).toContain('dlg.door_back_room_locked');
  });

  it('obra: sem dinheiro não abre; pagando, abre sujo, a capacidade sobe e o quintal aparece (o gato leva)', () => {
    const poor = afterFirstCustomer(50);
    expect(poor.session.openRoom('room.back_room')).toMatchObject({ ok: false, problem: 'needs_money' });
    const { session, state, events } = afterFirstCustomer(1000);
    expect(session.openRoom('room.back_room')).toEqual({ ok: true });
    expect(state.money).toBe(1000 - 200);
    expect(session.roomState('room.back_room')).toBe('abandoned');
    expect(session.doorState('door.back_room')).toBe('open');
    expect(session.catCapacity()).toBe(4 + 3);
    expect(session.roomState('room.backyard')).toBe('discovered');
    expect(events.find((e) => e.name === 'room.discovered' && (e.payload as { roomId: string }).roomId === 'room.backyard')?.payload).toMatchObject({ trigger: 'cat_leads', highlight: 'door.backyard' });
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
  function withBackRoomOpen() {
    const ctx = afterFirstCustomer();
    ctx.session.openRoom('room.back_room');
    return ctx;
  }

  it('a chave estava embaixo do lençol; com ela, a porta abre (e a chave é usada)', () => {
    const { session, state, events } = withBackRoomOpen();
    expect(session.useRoomDoor('door.backyard')).toMatchObject({ ok: false, problem: 'needs_item' });
    expect(dialogues(events)).toContain('dlg.door_backyard_locked');
    session.clean('dirt.back_room_junk', [[19, 5]]);
    expect(state.inventory['item.key_backyard']).toBe(1);
    expect(dialogues(events)).toContain('dlg.key_backyard_found');
    expect(session.useRoomDoor('door.backyard')).toEqual({ ok: true });
    expect(state.inventory['item.key_backyard']).toBeUndefined();
    expect(session.roomState('room.backyard')).toBe('abandoned');
    expect(session.catCapacity()).toBe(4 + 3 + 6);
  });

  it('playground: módulo só com o quintal reformado e 10 gatos; só no quintal; dá afeto por dia', () => {
    const { session, state } = withBackRoomOpen();
    session.clean('dirt.back_room_junk', [[19, 5]]);
    session.useRoomDoor('door.backyard');
    expect(session.itemUnlocked('item.playground_tunnel')).toBe(false);
    cleanTag(session, 'backyard');
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
    for (const s of content.business.requiredSurfaces) state.finishes[s] = 'finish.test';
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
