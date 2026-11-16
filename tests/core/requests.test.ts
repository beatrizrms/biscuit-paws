import { describe, expect, it, vi } from 'vitest';
import { acceptVisit, countRequest, maybeNewRequest, newRequests, type RequestsData } from '../../src/core/requests';
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
  visitHours: ['09:00', '12:00'],
  requests: [
    { id: 'req.a', npc: 'npc.gabi', kind: 'serve', recipe: 'recipe.black_coffee', count: 2, text: 't', intro: 'i', thanks: 'o', reward: { points: 1 } },
    { id: 'req.b', npc: 'npc.gabi', kind: 'care', count: 1, text: 't', intro: 'i', thanks: 'o', reward: { points: 1 } },
    { id: 'req.c', npc: 'npc.joca', kind: 'care', game: 'wand', count: 1, text: 't', intro: 'i', thanks: 'o', reward: { points: 1 } },
    { id: 'req.d', npc: 'npc.neusa', kind: 'care', count: 1, text: 't', intro: 'i', thanks: 'o', reward: { points: 1 } },
  ],
};

describe('pedidos dos amigos (puro)', () => {
  it('no intervalo, sem meta da história, até maxActive e um por amigo; o pedido só abre depois da visita', () => {
    const s = newRequests();
    const rng = createRng(1);
    const at = () => 600;
    expect(maybeNewRequest(data, s, 10, rng, false, () => true, at)).toBeNull(); // marca o primeiro: dia 14
    expect(s.nextOn).toBe(14);
    expect(maybeNewRequest(data, s, 14, rng, true, () => true, at)).toBeNull(); // a história tem meta
    const first = maybeNewRequest(data, s, 14, rng, false, () => true, at)!;
    expect(s.visit).toEqual({ id: first.id, on: 14, at: 600 });
    expect(s.active).toEqual([]);
    // A visita não aconteceu (ela fora do café): no dia seguinte, o amigo volta (o mesmo pedido).
    expect(maybeNewRequest(data, s, 15, rng, false, () => true, () => 630)).toBeNull();
    expect(s.visit).toEqual({ id: first.id, on: 15, at: 630 });
    expect(acceptVisit(data, s, 15)!.id).toBe(first.id);
    expect(s.visit).toBeNull();
    expect(s.active).toEqual([{ id: first.id, since: 15, progress: 0 }]);
    const second = maybeNewRequest(data, s, 18, rng, false, () => true, at)!;
    expect(first.npc).not.toBe(second.npc);
    acceptVisit(data, s, 18);
    expect(maybeNewRequest(data, s, 22, rng, false, () => true, at)).toBeNull(); // dois abertos: cheio
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

  /** Passa os dias até um amigo marcar a visita; ele vem na hora (com ela no café) e o roteiro da visita roda. */
  function visit(session: GameSession, state: ReturnType<typeof friends>['state'], events: string[]): void {
    for (let d = 0; d < 15 && !state.requests.visit; d++) session.endDay('home');
    const v = state.requests.visit!;
    expect(v.at).toBeGreaterThanOrEqual(9 * 60);
    expect(v.at).toBeLessThanOrEqual(12 * 60);
    state.location = 'map.cafe_main';
    state.time = v.at - 2;
    session.tickClock(1);
    expect(events).not.toContain('script.requested');
    while (!events.includes('script.requested') && state.time < v.at + 5) session.tickClock(0.5);
    expect(events).toContain('script.requested');
    expect(state.requests.active.some((a) => a.id === v.id)).toBe(false); // ainda não pediu
    session.finishScript('scr.request_visit');
  }

  it('um amigo vem ao café pedir (entre 9h e 12h); o pedido abre depois da visita e não expira', () => {
    const { session, state, events } = friends();
    visit(session, state, events);
    expect(state.requests.active.length).toBe(1);
    expect(events).toContain('request.new');
    const id = state.requests.active[0]!.id;
    // Três estações depois, o pedido continua lá (podem abrir outros, até o máximo).
    for (let d = 0; d < 90; d++) session.endDay('home');
    expect(state.requests.active.some((a) => a.id === id)).toBe(true);
    expect(state.requests.active.length).toBeLessThanOrEqual(content.requests.maxActive);
  });

  it('fora do café na hora da visita: o amigo volta no dia seguinte', () => {
    const { session, state, events } = friends();
    for (let d = 0; d < 15 && !state.requests.visit; d++) session.endDay('home');
    const v = state.requests.visit!;
    state.location = 'map.market';
    state.time = 12 * 60 + 30;
    session.tickClock(1);
    expect(events).not.toContain('script.requested');
    session.endDay('home');
    expect(state.requests.visit).toMatchObject({ id: v.id, on: state.day });
  });

  it('pôr no café: só pede o que já está à venda (as tulipas, depois da inauguração)', () => {
    const { session, state } = friends();
    // As tulipas ainda não à venda (o resto, sim).
    const real = session.itemUnlocked.bind(session);
    vi.spyOn(session, 'itemUnlocked').mockImplementation((id) => id !== 'item.vase_tulips' && real(id));
    const seen = new Set<string>();
    for (let d = 0; d < 80; d++) {
      session.endDay('home');
      if (state.requests.visit) {
        seen.add(state.requests.visit.id);
        session.finishScript('scr.request_visit');
        state.requests.active = [];
      }
    }
    expect(seen.has('req.neusa_tulips')).toBe(false);
    expect(seen.size).toBeGreaterThan(0);
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
    state.requests.visit = { id: 'req.joca_picture', on: 4, at: 610 };
    const back = parseSave(serializeSave(state, new Date(0)), knownIds(content)).state;
    expect(back.requests).toEqual(state.requests);
    expect(session).toBeDefined();
  });
});
