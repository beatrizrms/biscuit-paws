import { describe, expect, it } from 'vitest';
import { chatOfDay, walkOfDay } from '../../src/core/neighborWalks';
import { pairKey } from '../../src/core/relationships';
import { GameSession } from '../../src/core/session';
import { newGameState } from '../../src/core/state';
import { evaluate } from '../../src/core/story';
import { loadContent } from './content';

const content = loadContent();
const jacque = content.npcWalks.find((w) => w.npc === 'npc.jacque')!;

function street(day: number, time: number, met = true) {
  const state = newGameState(500, 'map.street', time);
  state.day = day;
  state.story.completed.push(...content.story.beats.map((b) => b.id).filter((id) => id !== 'story.jacque_meet'));
  if (met) state.flags['met.jacque'] = true;
  return { session: new GameSession(content, state), state };
}

describe('passeios de vizinhos na rua', () => {
  it('a Jacque passeia com 1 ou 2 dos 6 gatos dela, sempre a mesma resposta para o mesmo dia', () => {
    expect(jacque.cats.map((c) => c.name)).toEqual(['Sabrina', 'Branquinho', 'Jojo', 'Amora', 'Feijão', 'Cacau']);
    let walked = 0;
    for (let day = 1; day <= 60; day++) {
      const w = walkOfDay(jacque, day);
      expect(walkOfDay(jacque, day)).toEqual(w);
      expect(w.cats.length).toBeGreaterThanOrEqual(1);
      expect(w.cats.length).toBeLessThanOrEqual(2);
      expect([w.from, w.to]).toEqual(expect.arrayContaining(jacque.path));
      if (w.walks) walked++;
    }
    expect(walked).toBeGreaterThan(15); // por volta da metade dos dias
    expect(walked).toBeLessThan(45);
  });

  it('só depois de conhecê-la, no horário, no dia sorteado e uma vez por dia', () => {
    const day = Array.from({ length: 60 }, (_, i) => i + 1).find((d) => walkOfDay(jacque, d).walks)!;
    const t = (clock: string) => Number(clock.slice(0, 2)) * 60 + Number(clock.slice(3));
    expect(street(day, t(jacque.hours[0]), false).session.neighborWalksNow()).toEqual([]); // ainda não conhece
    expect(street(day, t(jacque.hours[0]) - 1).session.neighborWalksNow()).toEqual([]); // cedo
    expect(street(day, t(jacque.hours[1])).session.neighborWalksNow()).toEqual([]); // tarde
    const { session } = street(day, t(jacque.hours[0]));
    expect(session.neighborWalksNow().map((w) => w.npc)).toEqual(['npc.jacque']);
    expect(session.neighborWalksNow('map.cafe_main')).toEqual([]); // é na rua
    session.markNeighborWalked('npc.jacque');
    expect(session.neighborWalksNow()).toEqual([]);
  });

  it('conversar: uma frase por dia (todas antes de repetir); de novo no mesmo dia, a mesma; corações uma vez por dia', () => {
    const { session, state } = street(3, 17 * 60);
    const key = pairKey('player', 'npc.jacque');
    const today = session.neighborChat('npc.jacque');
    expect(jacque.chat).toContain(today);
    expect(session.neighborChat('npc.jacque')).toBe(today); // de novo no mesmo dia: a mesma frase
    expect(state.relationships[key]).toBe(jacque.points);
    session.endDay('home');
    const tomorrow = session.neighborChat('npc.jacque');
    expect(tomorrow).not.toBe(today);
    expect(state.relationships[key]).toBe(jacque.points * 2);
    // Uma volta inteira: cada frase sai uma vez.
    const n = jacque.chat.length;
    const lap = Array.from({ length: n }, (_, i) => chatOfDay(jacque, 2 * n + i));
    expect(new Set(lap).size).toBe(n);
    expect(session.neighborChat('npc.ninguem')).toBeNull();
  });

  it('a Jacque aparece no dia da feira de adoção (condição festivalToday)', () => {
    const state = newGameState(500, 'map.cafe_main', 11 * 60);
    state.day = 40;
    const ctx = { items: content.items, dirt: [], requiredSurfaces: [], rooms: content.rooms, seasons: content.seasons };
    expect(evaluate({ festivalToday: 'fest.adoption_fair' }, state, ctx)).toBe(false);
    state.festivals.active = { id: 'fest.adoption_fair', stage: 'scheduled', day: 40, done: [], results: [] };
    expect(evaluate({ festivalToday: 'fest.adoption_fair' }, state, ctx)).toBe(true);
    expect(evaluate({ festivalToday: 'fest.cat_day' }, state, ctx)).toBe(false);
    state.festivals.active = null;
    state.festivals.heldOn = { id: 'fest.adoption_fair', day: 40 }; // a feira já acabou, mas foi hoje
    expect(evaluate({ festivalToday: 'fest.adoption_fair' }, state, ctx)).toBe(true);
    state.day = 41;
    expect(evaluate({ festivalToday: 'fest.adoption_fair' }, state, ctx)).toBe(false);
  });
});

describe('a Jacque chega na primeira feira de adoção', () => {
  it('no dia da feira, com ela no café: o roteiro de apresentação e a marca de que já se conhecem', () => {
    const state = newGameState(500, 'map.cafe_main', 11 * 60);
    state.day = 40;
    state.story.completed.push(...content.story.beats.map((b) => b.id).filter((id) => id !== 'story.jacque_meet'));
    const session = new GameSession(content, state);
    const scripts: string[] = [];
    session.bus.on('script.requested', ({ scriptId }) => scripts.push(scriptId));
    session.enter('map.cafe_main');
    expect(scripts).not.toContain('scr.jacque_meet'); // sem feira hoje
    state.festivals.active = { id: 'fest.adoption_fair', stage: 'scheduled', day: 40, done: [], results: [] };
    session.enter('map.cafe_main');
    expect(scripts).toContain('scr.jacque_meet');
    expect(state.flags['met.jacque']).toBe(true);
  });
});
