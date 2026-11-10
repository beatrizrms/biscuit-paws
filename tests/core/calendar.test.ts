import { describe, expect, it } from 'vitest';
import { dayInSeason, daysUntil, firstDayOf, mapInSeason, seasonOf, validateSeasons, weatherOf, yearOf } from '../../src/core/calendar';
import { resolveMap } from '../../src/core/map';
import { GameSession } from '../../src/core/session';
import { newGameState } from '../../src/core/state';
import { loadContent } from './content';

const content = loadContent();
const S = content.seasons;
const exists = (t: string) => !!content.catalog.tiles[t];

describe('calendário (30 dias por estação)', () => {
  it('o jogo começa no inverno; a primavera chega no dia 31', () => {
    expect(S.daysPerSeason).toBe(30);
    expect(seasonOf(S, 1)).toBe('winter');
    expect(seasonOf(S, 30)).toBe('winter');
    expect(seasonOf(S, 31)).toBe('spring');
    expect(dayInSeason(S, 31)).toBe(1);
    expect(seasonOf(S, 121)).toBe('winter');
    expect(yearOf(S, 121)).toBe(2);
    expect(firstDayOf(S, 'spring')).toBe(31);
    expect(daysUntil(S, 10, 'spring')).toBe(21);
    expect(daysUntil(S, 40, 'spring')).toBe(0);
  });
});

describe('a rua muda com a estação', () => {
  const street = content.maps['map.street']!;

  it('na primavera: sem neve, sem abeto de Natal, tiles da primavera; o mapa continua válido', () => {
    const spring = mapInSeason(S, street, 'spring', exists);
    expect(Object.values(spring.legend).every((t) => !t.startsWith('snow_'))).toBe(true);
    expect(spring.objects.some((o) => o.tile.includes('abeto_natal'))).toBe(false);
    expect(spring.objects.every((o) => !o.overlay)).toBe(true);
    expect(spring.objects.find((o) => o.id === 'obj.bench')?.tile).toBe('spring_prop_banco');
    // Sem arte de primavera (a clínica): fica como está, em vez de sumir.
    expect(spring.objects.find((o) => o.id === 'obj.facade_vet')?.tile).toBe('facade_veterinaria');
    for (const season of S.order) expect(() => resolveMap(mapInSeason(S, street, season, exists), content.catalog)).not.toThrow();
  });

  it('no inverno fica como está', () => {
    expect(mapInSeason(S, street, 'winter', exists)).toBe(street);
  });

  it('a sessão desenha a rua da estação do dia e a fachada com a cor do reparo externo', () => {
    const state = newGameState(1000);
    state.flags['painter.available'] = true;
    const session = new GameSession(content, state);
    const facade = () => session.mapData('map.street').objects.find((o) => o.id === content.facade!.object)!;
    expect(facade().tile).toBe('facade_loja_velha');
    state.finishes['surface.facade'] = 'finish.facade_mint'; // o reparo externo (tests/core/construction.test.ts)
    expect(facade().tile).toBe('facade_loja_menta');
    state.day = 31;
    expect(facade().tile).toBe('spring_facade_loja_menta');
  });
});

describe('clima do dia', () => {
  it('o outono sorteia vento (folhas), chuva e sol; todo clima com partículas tem weatherFx válido', () => {
    const seasons = content.seasons;
    const autumn = seasons.order.indexOf('autumn') * seasons.daysPerSeason + 1;
    const days = Array.from({ length: seasons.daysPerSeason }, (_, i) => weatherOf(seasons, autumn + i));
    expect(days).toContain('wind');
    expect(new Set(days).size).toBeGreaterThan(1);
    expect(seasons.weatherFx?.wind?.particle).toBe('leaf');
    expect(validateSeasons({ ...seasons, weatherFx: { rain: { ...seasons.weatherFx!.rain!, particle: 'gota' as never } } }, { maps: new Set(), tiles: new Set() }).join()).toMatch(/partícula desconhecida/);
  });

  it('a sessão usa o clima do dia, e o debug pode trocar', () => {
    const session = new GameSession(content, newGameState(100));
    expect(session.weather()).toBe(weatherOf(content.seasons, 1));
    session.arrivals.debug.weather = 'rain';
    expect(session.weather()).toBe('rain');
  });
});
