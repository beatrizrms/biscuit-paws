import { describe, expect, it } from 'vitest';
import { inSeason } from '../../src/core/recipes';
import { GameSession } from '../../src/core/session';
import { newGameState } from '../../src/core/state';
import { loadContent } from './content';

const content = loadContent();
const S = content.seasons;
/** Primeiro dia (do jogo) da estação, no primeiro ano. */
const firstDay = (season: string) => S.order.indexOf(season) * S.daysPerSeason + 1;

function cafe(day: number, served = 300) {
  const state = newGameState(5000, 'map.cafe_main', 9 * 60);
  state.day = day;
  state.flags['has.cat'] = true;
  state.service.served = served;
  const session = new GameSession(content, state);
  return { session, state, sv: session.service };
}

describe('cardápio das estações', () => {
  it('receitas sazonais só na estação delas; janelas só nos dias delas; o resto, o ano todo', () => {
    const r = content.recipes;
    expect(inSeason(r['recipe.hot_chocolate']!, S, firstDay('winter'))).toBe(true);
    expect(inSeason(r['recipe.hot_chocolate']!, S, firstDay('summer'))).toBe(false);
    expect(inSeason(r['recipe.black_coffee']!, S, firstDay('summer'))).toBe(true);
    const natal = firstDay('winter') + 1; // dia 2 do inverno
    expect(inSeason(r['recipe.panettone_slice']!, S, natal)).toBe(true);
    expect(inSeason(r['recipe.panettone_slice']!, S, firstDay('winter') + 9)).toBe(false);
    expect(inSeason(r['recipe.rabanada']!, S, firstDay('winter') + 8)).toBe(true);
    expect(inSeason(r['recipe.macaron_tower']!, S, firstDay('summer') + 7)).toBe(true);
    expect(inSeason(r['recipe.macaron_tower']!, S, firstDay('summer') + 20)).toBe(false);
  });

  it('fora de época: status próprio, não entra no quadro', () => {
    const { sv } = cafe(firstDay('summer'));
    expect(sv.recipeStatus('recipe.hot_chocolate')).toBe('season');
    expect(sv.toggleMenu('recipe.hot_chocolate')).toEqual({ ok: false, reason: 'out_of_season' });
  });

  it('a fruta fresca e a abóbora só aparecem na época; ingrediente só de receita fora de época sai da prateleira', () => {
    const winter = cafe(firstDay('winter')).session;
    expect(winter.itemUnlocked('item.orange')).toBe(true);
    expect(winter.itemUnlocked('item.strawberry')).toBe(false);
    expect(winter.itemUnlocked('item.pumpkin')).toBe(false);
    const autumn = cafe(firstDay('autumn')).session;
    expect(autumn.itemUnlocked('item.pumpkin')).toBe(true);
    // A camomila só serve ao chá de camomila (inverno): no verão some.
    expect(winter.itemUnlocked('item.tea_chamomile_box')).toBe(true);
    expect(cafe(firstDay('summer')).session.itemUnlocked('item.tea_chamomile_box')).toBe(false);
  });

  it('a virada de estação tira do quadro o que saiu de época e anuncia o que chegou', () => {
    const { session, state, sv } = cafe(firstDay('spring') - 1);
    sv.toggleMenu('recipe.hot_chocolate');
    sv.toggleMenu('recipe.black_coffee');
    const events: { arrived: string[]; left: string[] }[] = [];
    session.bus.on('menu.season', (e) => events.push(e));
    session.endDay('home');
    expect(state.menu).toEqual(['recipe.black_coffee']);
    expect(events).toHaveLength(1);
    expect(events[0]!.left).toEqual(['recipe.hot_chocolate']);
    expect(events[0]!.arrived).toEqual(expect.arrayContaining(['recipe.strawberry_tart_slice', 'recipe.iced_berry_tea', 'recipe.chicken_croissant']));
    expect(events[0]!.arrived).not.toContain('recipe.black_coffee');
  });

  it('a procura: no inverno e na chuva pesa o quente; no verão, o gelado', () => {
    const r = content.recipes;
    const winter = cafe(firstDay('winter')).sv;
    expect(winter.demandWeight(r['recipe.black_coffee']!)).toBeGreaterThan(winter.demandWeight(r['recipe.orange_juice']!));
    const summer = cafe(firstDay('summer'));
    expect(summer.sv.demandWeight(r['recipe.orange_juice']!)).toBeGreaterThan(summer.sv.demandWeight(r['recipe.black_coffee']!));
    expect(summer.sv.demandWeight(r['recipe.cookie']!)).toBe(1);
    summer.session.arrivals.debug.weather = 'rain';
    expect(summer.sv.demandWeight(r['recipe.black_coffee']!)).toBeCloseTo((content.service.demand?.seasons?.summer?.hot ?? 1) * (content.service.demand?.weather?.rain?.hot ?? 1));
  });
});
