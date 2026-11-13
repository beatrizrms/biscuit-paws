import { describe, expect, it } from 'vitest';
import { crowdLayout, crowdStays, type CrowdDef } from '../../src/core/festivalCrowd';
import { createRng } from '../../src/core/rng';
import { GameSession } from '../../src/core/session';
import { newGameState } from '../../src/core/state';
import { loadContent } from './content';

const content = loadContent();
const def: CrowdDef = { npcs: ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i'], people: [7, 9], walkers: 2, until: '20:00', lines: ['oi'] };
const area = { from: [0, 0] as [number, number], to: [19, 9] as [number, number] };

describe('plateia dos eventos (puro)', () => {
  it('grupinhos de 2 ou 3 virados uns para os outros, sem encostar, fora dos pontos do evento; o resto passeia', () => {
    const avoid: [number, number][] = [[10, 5]];
    const layout = crowdLayout(def, area, () => true, avoid, createRng(3));
    const standing = layout.groups.flat();
    const people = standing.length + layout.walkers.length;
    expect(people).toBeGreaterThanOrEqual(7);
    expect(people).toBeLessThanOrEqual(9);
    expect(layout.walkers).toHaveLength(2);
    for (const g of layout.groups) {
      expect([2, 3]).toContain(g.length);
      // Os dois da frente se olham (um para a direita, o outro para a esquerda, na mesma linha).
      const [a, b] = g;
      expect(a!.facing).toBe('right');
      expect(b!.facing).toBe('left');
      expect(a!.at[1]).toBe(b!.at[1]);
      expect(b!.at[0]).toBeGreaterThan(a!.at[0]);
    }
    // Ninguém repetido, ninguém em cima de outro, nem em cima do ponto do evento.
    const ids = [...standing.map((m) => m.npc), ...layout.walkers.map((w) => w.npc)];
    expect(new Set(ids).size).toBe(ids.length);
    const cells = standing.map((m) => m.at.join(','));
    expect(new Set(cells).size).toBe(cells.length);
    for (const m of standing) expect(m.at).not.toEqual([10, 5]);
    // Grupos diferentes não se encostam.
    layout.groups.forEach((g, i) =>
      layout.groups.forEach((h, j) => {
        if (i >= j) return;
        for (const m of g) for (const n of h) expect(Math.max(Math.abs(m.at[0] - n.at[0]), Math.abs(m.at[1] - n.at[1]))).toBeGreaterThan(1);
      }),
    );
    // Mesma semente, mesma plateia.
    expect(crowdLayout(def, area, () => true, avoid, createRng(3))).toEqual(layout);
  });

  it('só em células livres; sem lugar, sem grupo', () => {
    const layout = crowdLayout(def, area, (c) => c < 2, [], createRng(5));
    for (const m of layout.groups.flat()) expect(m.at[0]).toBeLessThan(2);
    expect(crowdLayout(def, area, () => false, [], createRng(5))).toEqual({ groups: [], walkers: [] });
  });

  it('os amigos vêm sempre e ficam nos grupinhos (não passeiam)', () => {
    const friends = ['gabi', 'neusa', 'jacque'];
    const layout = crowdLayout({ ...def, npcs: [...def.npcs, ...friends] }, area, () => true, [], createRng(9), friends);
    const standing = layout.groups.flat().map((m) => m.npc);
    for (const id of friends) expect(standing).toContain(id);
    for (const w of layout.walkers) expect(friends).not.toContain(w.npc);
  });

  it('vai embora na hora de until', () => {
    expect(crowdStays(def, 19 * 60 + 59)).toBe(true);
    expect(crowdStays(def, 20 * 60)).toBe(false);
  });
});

describe('plateia na sessão', () => {
  it('aparece no quintal no dia do evento só depois de tudo montado: placa e decoração (e não na rua)', () => {
    const state = newGameState(500, 'map.street', 10 * 60);
    state.business = 'soft_open';
    state.story.completed.push(...content.story.beats.map((b) => b.id));
    const session = new GameSession(content, state);
    const catDay = content.festivals.find((f) => f.id === 'fest.cat_day')!;
    session.debugStartFestival(catDay.id);
    state.day = state.festivals.active!.day!;
    state.time = 9 * 60;
    expect(session.festivalCrowd(content.map.id)).toBeNull(); // sem placa ainda
    expect(session.doJobPoint(catDay.closePoint!.point)).toEqual({ ok: true });
    expect(session.festivalCrowd(content.map.id)).toBeNull(); // falta a decoração
    for (const d of catDay.decorations!) expect(session.doJobPoint(d.point)).toEqual({ ok: true });
    const layout = session.festivalCrowd(content.map.id)!;
    expect(layout.groups.length).toBeGreaterThan(0);
    const yard = content.rooms.rooms.find((r) => r.id === 'room.backyard')!.area;
    for (const m of layout.groups.flat()) {
      expect(m.at[0]).toBeGreaterThanOrEqual(yard.from[0]);
      expect(m.at[0]).toBeLessThanOrEqual(yard.to[0]);
    }
    expect(layout.groups.flat().map((m) => m.npc)).not.toContain('npc.jacque'); // ainda não a conheceu
    expect(session.festivalCrowd('map.street')).toBeNull();
    state.time = 20 * 60;
    expect(session.festivalCrowd(content.map.id)).toBeNull(); // foram embora
  });
});
