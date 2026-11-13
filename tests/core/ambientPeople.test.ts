// Movimento na praça e na rua (src/core/ambientPeople.ts; data/npcs.json: ambient).
import { describe, expect, it } from 'vitest';
import { ambientLayout, ambientPasses } from '../../src/core/ambientPeople';
import { solidGrid } from '../../src/core/map';
import { AMBIENT_CROSS_MINUTES, GameSession } from '../../src/core/session';
import { newGameState } from '../../src/core/state';
import { loadContent } from './content';

const content = loadContent();
const def = content.ambient!;

function sessionAt(time: number, day = 40): GameSession {
  const state = newGameState(0, 'map.praca', time);
  state.day = day;
  return new GameSession(content, state);
}

const people = (l: NonNullable<ReturnType<typeof ambientLayout>>) => [...l.spots.map((s) => s.npc), ...l.groups.flat().map((m) => m.npc), ...l.walkers.map((w) => w.npc)];

describe('praça', () => {
  it('das 9h às 21h tem gente sentada, nas barracas, conversando e passeando; antes e depois, ninguém', () => {
    expect(sessionAt(8 * 60 + 59).ambientPeople('map.praca')).toBeNull();
    expect(sessionAt(21 * 60).ambientPeople('map.praca')).toBeNull();
    let sitting = 0, standing = 0, groups = 0, walkers = 0;
    for (let day = 1; day <= 20; day++) {
      const session = sessionAt(10 * 60, day);
      const l = session.ambientPeople('map.praca');
      expect(l, `dia ${day}`).not.toBeNull();
      const ids = people(l!);
      expect(new Set(ids).size, `dia ${day}: alguém em dois lugares`).toBe(ids.length);
      for (const id of ids) expect(def.npcs).toContain(id);
      sitting += l!.spots.filter((s) => s.pose === 'sit').length;
      standing += l!.spots.filter((s) => s.pose === 'stand').length;
      groups += l!.groups.length;
      walkers += l!.walkers.length;
      // Grupinhos e passeio só em célula livre (os lugares fixos ficam nos bancos, que são sólidos).
      const solid = solidGrid(session.mapData('map.praca'), content.catalog);
      for (const m of l!.groups.flat()) expect(solid[m.at[1]]?.[m.at[0]], `dia ${day}: ${m.npc} em ${m.at}`).toBe(false);
      for (const w of l!.walkers) for (const c of w.path) expect(solid[c[1]]?.[c[0]]).toBe(false);
      for (const s of l!.spots.filter((x) => x.pose === 'stand')) expect(solid[s.at[1]]?.[s.at[0]], `${s.at}`).toBe(false);
    }
    expect(sitting).toBeGreaterThan(0);
    expect(standing).toBeGreaterThan(0);
    expect(groups).toBeGreaterThan(0);
    expect(walkers).toBeGreaterThan(0);
  });

  it('a turma é a mesma no bloco inteiro e troca no seguinte', () => {
    const a = sessionAt(10 * 60).ambientPeople('map.praca')!;
    const b = sessionAt(10 * 60 + 40).ambientPeople('map.praca')!;
    expect(b).toEqual(a);
    const later = sessionAt(16 * 60).ambientPeople('map.praca')!;
    expect(later.block).not.toBe(a.block);
  });

  it('com chuva vem menos gente', () => {
    let sun = 0, rain = 0;
    const solid = solidGrid(sessionAt(600).mapData('map.praca'), content.catalog);
    const free = (c: number, r: number) => solid[r]?.[c] === false;
    for (let day = 1; day <= 30; day++) {
      sun += people(ambientLayout(def, 'map.praca', day, 600, 'sun', free) ?? { spots: [], groups: [], walkers: [], block: 0 }).length;
      rain += people(ambientLayout(def, 'map.praca', day, 600, 'rain', free) ?? { spots: [], groups: [], walkers: [], block: 0 }).length;
    }
    expect(rain).toBeLessThan(sun * 0.7);
  });
});

describe('rua', () => {
  it('gente passando o dia todo, das 9h às 21h, de uma ponta à outra; ninguém começa outra travessia antes de terminar', () => {
    const passes = ambientPasses(def, 'map.street', 40, 'sun', AMBIENT_CROSS_MINUTES);
    expect(passes.length).toBeGreaterThan(20);
    for (const p of passes) {
      expect(p.at).toBeGreaterThanOrEqual(9 * 60);
      expect(p.at).toBeLessThan(21 * 60);
      expect(Math.abs(p.from[0] - p.to[0])).toBeGreaterThanOrEqual(8);
    }
    const byNpc: Record<string, number[]> = {};
    for (const p of passes) (byNpc[p.npc] ??= []).push(p.at);
    for (const times of Object.values(byNpc)) for (let i = 1; i < times.length; i++) expect(times[i]! - times[i - 1]!).toBeGreaterThanOrEqual(AMBIENT_CROSS_MINUTES);
    expect(ambientPasses(def, 'map.street', 40, 'rain', AMBIENT_CROSS_MINUTES).length).toBeLessThan(passes.length);
    expect(ambientPasses(def, 'map.praca', 40, 'sun', AMBIENT_CROSS_MINUTES)).toEqual([]);
  });

  it('na sessão: às 11h alguém atravessa a rua em algum momento; às 22h, ninguém', () => {
    let seen = 0;
    for (let t = 9 * 60; t < 21 * 60; t += 10) seen += sessionAt(t).ambientPassersNow('map.street').length;
    expect(seen).toBeGreaterThan(0);
    expect(sessionAt(22 * 60).ambientPassersNow('map.street')).toEqual([]);
  });
});
