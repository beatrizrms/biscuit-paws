import { describe, expect, it } from 'vitest';
import { countRequest, maybeNewRequest, newRequests, type RequestsData } from '../../src/core/requests';
import { createRng } from '../../src/core/rng';
import { knownIds, parseSave, serializeSave } from '../../src/core/save';
import { GameSession } from '../../src/core/session';
import { newGameState } from '../../src/core/state';
import { loadContent } from './content';

const content = loadContent();
const data: RequestsData = {
  schemaVersion: 1,
  everyDays: [4, 4],
  maxActive: 2,
  requests: [
    { id: 'req.a', npc: 'npc.gabi', kind: 'serve', recipe: 'recipe.black_coffee', count: 2, text: 't', intro: 'i', thanks: 'o', reward: { points: 1 } },
    { id: 'req.b', npc: 'npc.gabi', kind: 'care', count: 1, text: 't', intro: 'i', thanks: 'o', reward: { points: 1 } },
    { id: 'req.c', npc: 'npc.joca', kind: 'care', game: 'wand', count: 1, text: 't', intro: 'i', thanks: 'o', reward: { points: 1 } },
    { id: 'req.d', npc: 'npc.neusa', kind: 'care', count: 1, text: 't', intro: 'i', thanks: 'o', reward: { points: 1 } },
  ],
};

describe('pedidos dos amigos (puro)', () => {
  it('no intervalo, sem meta da história, até maxActive e um por amigo', () => {
    const s = newRequests();
    const rng = createRng(1);
    expect(maybeNewRequest(data, s, 10, rng, false, () => true)).toBeNull(); // marca o primeiro: dia 14
    expect(s.nextOn).toBe(14);
    expect(maybeNewRequest(data, s, 14, rng, true, () => true)).toBeNull(); // a história tem meta
    const first = maybeNewRequest(data, s, 14, rng, false, () => true)!;
    const second = maybeNewRequest(data, s, 18, rng, false, () => true)!;
    expect(first.npc).not.toBe(second.npc);
    expect(maybeNewRequest(data, s, 22, rng, false, () => true)).toBeNull(); // dois abertos: cheio
    expect(s.active).toHaveLength(2);
  });

  it('conta só o que bate e completa no total', () => {
    const s = newRequests();
    s.active.push({ id: 'req.a', since: 1, progress: 0 }, { id: 'req.c', since: 1, progress: 0 });
    expect(countRequest(data, s, (r) => r.kind === 'serve' && r.recipe === 'recipe.black_coffee')).toEqual([]);
    expect(countRequest(data, s, (r) => r.kind === 'serve' && r.recipe === 'recipe.black_coffee').map((r) => r.id)).toEqual(['req.a']);
    expect(countRequest(data, s, (r) => r.kind === 'care' && (!r.game || r.game === 'grooming'))).toEqual([]);
  });
});

describe('pedidos dos amigos na sessão', () => {
  function friends() {
    const state = newGameState(500, 'map.cafe_main', 10 * 60);
    state.story.completed.push(...content.story.beats.map((b) => b.id));
    Object.assign(state.flags, { 'prologue.done': true, 'met.old_neighbor': true, 'seen.scr.gabi_visit': true });
    const session = new GameSession(content, state);
    const events: string[] = [];
    session.bus.onAny((name) => events.push(name));
    return { session, state, events };
  }

  it('um amigo pede de tempos em tempos; o pedido não expira', () => {
    const { session, state, events } = friends();
    for (let d = 0; d < 10 && state.requests.active.length === 0; d++) session.endDay('home');
    expect(state.requests.active.length).toBe(1);
    expect(events).toContain('request.new');
    const id = state.requests.active[0]!.id;
    // Três estações depois, o pedido continua lá (podem abrir outros, até o máximo).
    for (let d = 0; d < 90; d++) session.endDay('home');
    expect(state.requests.active.some((a) => a.id === id)).toBe(true);
    expect(state.requests.active.length).toBeLessThanOrEqual(content.requests.maxActive);
  });

  it('trazer do mercado: com o item na mochila, entrega sozinho e dá corações, moedas e o presente', () => {
    const { session, state, events } = friends();
    state.requests.active.push({ id: 'req.neusa_honey', since: state.day, progress: 0 });
    const money = state.money;
    expect(session.friendRequests()[0]).toMatchObject({ done: 0, total: 1 });
    session.receiveItem('item.honey');
    expect(state.requests.active).toEqual([]);
    expect(state.requests.done['req.neusa_honey']).toBe(1);
    expect(state.inventory['item.honey'] ?? 0).toBe(0);
    expect(state.money).toBe(money + 25);
    expect(state.relationships['player|npc.neusa']).toBe(20);
    expect(events).toContain('request.done');
  });

  it('pôr no café: conta o que está posicionado', () => {
    const { session, state } = friends();
    state.requests.active.push({ id: 'req.neusa_tulips', since: state.day, progress: 0 });
    session.receiveItem('item.vase_tulips');
    expect(session.place('item.vase_tulips', [8, 7])).toEqual({ ok: true });
    expect(state.requests.done['req.neusa_tulips']).toBe(1);
  });

  it('o save guarda os pedidos abertos e os feitos', () => {
    const { session, state } = friends();
    state.requests.active.push({ id: 'req.gabi_latte', since: 3, progress: 2 });
    state.requests.done['req.joca_brush'] = 1;
    state.requests.nextOn = 9;
    const back = parseSave(serializeSave(state, new Date(0)), knownIds(content)).state;
    expect(back.requests).toEqual(state.requests);
    expect(session).toBeDefined();
  });
});
