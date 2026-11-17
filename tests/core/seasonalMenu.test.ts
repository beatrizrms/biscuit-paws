import { describe, expect, it } from 'vitest';
import { inSeason } from '../../src/core/recipes';
import { GameSession } from '../../src/core/session';
import { newGameState } from '../../src/core/state';
import { loadContent } from './content';
import { learnRecipes } from './learn';

const content = loadContent();
const S = content.seasons;
/** Primeiro dia (do jogo) da estação, no primeiro ano. */
const firstDay = (season: string) => S.order.indexOf(season) * S.daysPerSeason + 1;

function cafe(day: number, served = 700) {
  const state = newGameState(5000, 'map.cafe_main', 9 * 60);
  state.day = day;
  state.flags['has.cat'] = true;
  state.service.served = served;
  state.business = 'inaugurated'; // as receitas da estação contam desde a inauguração
  const session = new GameSession(content, state);
  learnRecipes(session);
  return { session, state, sv: session.service };
}

describe('cardápio das estações', () => {
  it('receitas sazonais só na estação delas; janelas só nos dias delas; o resto, o ano todo', () => {
    const r = content.recipes;
    expect(inSeason(r['recipe.hot_chocolate']!, S, firstDay('winter'))).toBe(true);
    expect(inSeason(r['recipe.hot_chocolate']!, S, firstDay('summer'))).toBe(false);
    expect(inSeason(r['recipe.black_coffee']!, S, firstDay('summer'))).toBe(true);
    const natal = firstDay('winter') + 24; // dia 25 do inverno
    expect(inSeason(r['recipe.panettone_slice']!, S, natal)).toBe(true);
    expect(inSeason(r['recipe.panettone_slice']!, S, firstDay('winter') + 9)).toBe(false);
    expect(inSeason(r['recipe.rabanada']!, S, firstDay('winter') + 28)).toBe(true);
    expect(inSeason(r['recipe.macaron_tower']!, S, firstDay('summer') + 7)).toBe(true);
    expect(inSeason(r['recipe.macaron_tower']!, S, firstDay('summer') + 20)).toBe(false);
  });

  it('fora de época: a que ela ainda não aprendeu fica trancada; a que já conhece tem status próprio e não entra no quadro', () => {
    const { sv, state } = cafe(firstDay('summer'));
    expect(sv.recipeStatus('recipe.hot_chocolate')).toBe('locked');
    state.flags['recipe.known.recipe.hot_chocolate'] = true;
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

  it('a virada de estação tira do quadro o que saiu de época; a que volta é avisada, a que chega pela primeira vez é receita nova', () => {
    const { session, state, sv } = cafe(firstDay('spring') - 1);
    sv.toggleMenu('recipe.hot_chocolate');
    sv.toggleMenu('recipe.black_coffee');
    // A torta de morango ela já conhecia (do ano passado); o chá gelado de frutas vermelhas, não.
    state.flags['recipe.known.recipe.strawberry_tart_slice'] = true;
    const events: { arrived: string[]; left: string[] }[] = [];
    const learned: string[] = [];
    session.bus.on('menu.season', (e) => events.push(e));
    session.bus.on('recipe.unlocked', (e) => learned.push(e.recipeId));
    session.endDay('home');
    expect(state.menu).toEqual(['recipe.black_coffee']);
    expect(events).toHaveLength(1);
    expect(events[0]!.left).toEqual(['recipe.hot_chocolate']);
    expect(events[0]!.arrived).toEqual(['recipe.strawberry_tart_slice']);
    // Várias de primavera chegam juntas: no máximo recipesPerDay hoje; as outras, nos próximos dias.
    expect(learned).toHaveLength(content.milestones.recipesPerDay!);
    expect(learned).not.toContain('recipe.strawberry_tart_slice');
    expect(learned).not.toContain('recipe.hot_chocolate');
  });

  it('a conquista do cardápio da estação ensina só as receitas da estação de agora', () => {
    const { session, state } = cafe(firstDay('spring') + 3, 60);
    session.start(false);
    // As conquistas de antes já vieram há tempo (o intervalo entre as de receita, recipeGap, já passou).
    for (const id of ['milestone.customers_35', 'milestone.customers_45']) state.milestones.reached[id] = state.day - 10;
    const learned: string[] = [];
    session.bus.on('recipe.unlocked', (e) => learned.push(e.recipeId));
    state.service.served = 90;
    session.tickClock(1 / content.dayNight.minutesPerSecond);
    expect(state.milestones.reached['milestone.customers_50']).toBeDefined();
    expect(learned).toEqual(expect.arrayContaining(['recipe.strawberry_tart_slice', 'recipe.iced_berry_tea']));
    for (const id of ['recipe.hot_chocolate', 'recipe.panettone_slice', 'recipe.web_cupcake', 'recipe.iced_lemon_tea']) expect(learned).not.toContain(id);
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

describe('itens de Natal', () => {
  it('à venda só no inverno; o globo de neve do café (o presente exclusivo) nunca está à venda', () => {
    const winter = cafe(firstDay('winter')).session;
    const spring = cafe(firstDay('spring')).session;
    for (const id of ['item.christmas_tree', 'item.xmas_wreath', 'item.poinsettia', 'item.knit_scarf', 'item.bone_biscuits']) {
      expect(winter.itemUnlocked(id)).toBe(true);
      expect(spring.itemUnlocked(id)).toBe(false);
    }
    expect(content.items['item.snow_globe_cafe']!.tags).not.toContain('decor');
    expect(content.items['item.snow_globe_cafe']!.tags).not.toContain('xmas');
  });
});

describe('fila das receitas novas', () => {
  it('no máximo recipesPerDay por dia; as outras chegam nos dias seguintes, na ordem', () => {
    const perDay = content.milestones.recipesPerDay!;
    const { session, state } = cafe(firstDay('spring') + 3, 0);
    session.start(false);
    const learned: string[][] = [[]];
    session.bus.on('recipe.unlocked', (e) => learned[learned.length - 1]!.push(e.recipeId));
    state.service.served = 700;
    session.tickClock(1 / content.dayNight.minutesPerSecond);
    expect(learned[0]).toHaveLength(perDay);
    // A fila não anda no mesmo dia.
    session.tickClock(5 / content.dayNight.minutesPerSecond);
    expect(learned[0]).toHaveLength(perDay);
    const waiting = session.service.recipesToLearn().length;
    expect(waiting).toBeGreaterThan(0);
    for (let d = 0; d < 3; d++) {
      learned.push([]);
      session.endDay('home');
      session.tickClock(1 / content.dayNight.minutesPerSecond);
      expect(learned[d + 1]!.length).toBeLessThanOrEqual(perDay);
    }
    expect(learned.flat()).toHaveLength(new Set(learned.flat()).size);
  });
});
