// Ponto de ônibus da rua (data/world.json: bus; interação bus em data/maps/street.json).
import { describe, expect, it } from 'vitest';
import { cellsOf, solidGrid } from '../../src/core/map';
import { GameSession } from '../../src/core/session';
import { newGameState } from '../../src/core/state';
import { loadContent } from './content';

const content = loadContent();

describe('ponto de ônibus', () => {
  it('fica entre o beco e a praça, sem tapar nenhuma das entradas, e dá para chegar nele pela calçada', () => {
    const street = content.maps['map.street']!;
    const stop = street.interactions!.find((i) => 'bus' in i.action)!;
    const sign = street.objects.find((o) => o.tile === 'ph_bus_stop')!;
    const alley = (street.doors ?? []).filter((d) => d.to === 'map.alley').map((d) => d.at[0]);
    const praca = (street.doors ?? []).filter((d) => d.to === 'map.praca').map((d) => d.at[0]);
    expect(sign.at[0]).toBeGreaterThan(Math.max(...alley));
    expect(sign.at[0]).toBeLessThan(Math.min(...praca));
    const cells = cellsOf(sign.at, content.catalog.tiles[sign.tile]!);
    for (const d of street.doors ?? []) expect(cells.some(([c, r]) => c === d.at[0] && r === d.at[1]), d.id).toBe(false);
    const s = new GameSession(content, newGameState(0, 'map.street', 600));
    const solid = solidGrid(s.mapData('map.street'), content.catalog);
    // As portas continuam com a calçada livre embaixo, e o ponto tem célula livre ao alcance.
    for (const d of street.doors ?? []) expect(solid[d.at[1] + 1]?.[d.at[0]] ?? false, d.id).toBe(false);
    expect([[0, 1], [1, 0], [-1, 0]].some(([dc, dr]) => solid[stop.at[1] + dr!]?.[stop.at[0] + dc!] === false)).toBe(true);
  });

  it('ir para casa antes das 17h encerra o dia (o atalho); ficar não faz nada', () => {
    const state = newGameState(0, 'map.street', 11 * 60);
    state.day = 20;
    const s = new GameSession(content, state);
    expect(s.canGoHome()).toBe(false); // na porta do café ainda é cedo
    const ended: string[] = [];
    s.bus.on('day.ended', ({ reason }) => ended.push(reason));
    expect(s.takeBus('bus.home')).toEqual({ ok: true });
    expect(ended).toEqual(['home']);
    expect(s.takeBus('bus.lua')).toEqual({ ok: false, reason: 'not_found' });
  });

  it('com cliente no café, ela espera o último sair (como na porta)', () => {
    const state = newGameState(0, 'map.street', 11 * 60);
    state.service.customers.push({} as never);
    const s = new GameSession(content, state);
    let ended = false;
    s.bus.on('day.ended', () => (ended = true));
    expect(s.takeBus('bus.home')).toEqual({ ok: false, reason: 'customers_inside' });
    expect(ended).toBe(false);
  });
});
