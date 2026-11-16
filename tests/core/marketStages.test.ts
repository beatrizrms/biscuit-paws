// Market aos poucos (items.json: marketStages): os itens entram à venda pelas etapas da história; equipamento e
// ingrediente seguem as receitas liberadas; a etiqueta Novo fica 2 dias.
import { describe, expect, it } from 'vitest';
import { GameSession, NEW_BADGE_DAYS } from '../../src/core/session';
import { newGameState } from '../../src/core/state';
import { loadContent } from './content';
import { learnRecipes } from './learn';

const content = loadContent({ marketStages: true });

function game() {
  const state = newGameState(5000, 'map.cafe_main', 9 * 60);
  const session = new GameSession(content, state);
  learnRecipes(session);
  const events: string[] = [];
  session.bus.onAny((name) => events.push(name));
  return { session, state, events };
}

describe('Market aos poucos', () => {
  it('cada etapa libera os itens dela, na ordem da história', () => {
    const { session, state } = game();
    expect(session.itemUnlocked('item.water_bowl')).toBe(false);
    expect(session.itemUnlocked('item.table_round')).toBe(false);
    state.flags['has.cat'] = true;
    expect(session.itemUnlocked('item.water_bowl')).toBe(true);
    expect(session.itemUnlocked('item.litter_box')).toBe(false);
    state.story.completed.push('story.litter_surprise');
    expect(session.itemUnlocked('item.litter_box')).toBe(true);
    expect(session.itemUnlocked('item.counter_single')).toBe(false);
    state.story.completed.push('story.warm_corner');
    expect(session.itemUnlocked('item.counter_single')).toBe(true);
    expect(session.itemUnlocked('item.table_round')).toBe(false);
    state.story.completed.push('story.coffee_machine');
    expect(session.itemUnlocked('item.table_round')).toBe(true);
    expect(session.itemUnlocked('item.table_square')).toBe(false);
    state.flags['cafe.open'] = true;
    expect(session.itemUnlocked('item.table_square')).toBe(true);
    expect(session.itemUnlocked('item.sofa')).toBe(false);
    state.business = 'inaugurated';
    expect(session.itemUnlocked('item.sofa')).toBe(true);
    // Comprar segue a mesma regra.
    expect(game().session.buy('item.table_round')).toEqual({ ok: false, reason: 'locked' });
  });

  it('equipamento e ingrediente vêm com a receita, antes da etapa (o chá preto traz o bule)', () => {
    const { session, state } = game();
    state.flags['has.cat'] = true;
    const tea = content.recipes['recipe.black_tea']!;
    const teapot = Object.values(content.items).find((i) => i.tags.includes(content.service.equipment.teapot!.tag))!;
    const teaBags = Object.keys(tea.ingredients);
    const unlocked = () => session.service.recipeStatus(tea.id) !== 'locked';
    // Com a receita liberada, o bule e o chá aparecem, mesmo com o café ainda fechado.
    if (!unlocked()) {
      state.service.served = 999;
      learnRecipes(session);
    }
    expect(unlocked()).toBe(true);
    expect(state.flags['cafe.open']).toBeUndefined();
    expect(session.itemUnlocked(teapot.id)).toBe(true);
    for (const id of teaBags) expect(session.itemUnlocked(id)).toBe(true);
  });

  it('a etapa que abre avisa uma vez e os itens dela ficam Novo por 2 dias', () => {
    const { session, state, events } = game();
    session.start(false);
    state.flags['has.cat'] = true;
    session.tickClock(1 / content.dayNight.minutesPerSecond);
    expect(events.filter((e) => e === 'market.stage_opened')).toHaveLength(1);
    expect(state.marketStagesOn?.['market.cat']).toBe(state.day);
    expect(session.marketNew('item.water_bowl')).toBe(true);
    state.day += NEW_BADGE_DAYS;
    expect(session.marketNew('item.water_bowl')).toBe(false);
    session.tickClock(1 / content.dayNight.minutesPerSecond);
    expect(events.filter((e) => e === 'market.stage_opened')).toHaveLength(1);
  });

  it('save antigo, já adiante na história: marca as etapas sem avisar e sem a etiqueta Novo', () => {
    const { session, state, events } = game();
    state.flags['has.cat'] = true;
    state.flags['cafe.open'] = true;
    state.business = 'inaugurated';
    session.start(false);
    expect(events).not.toContain('market.stage_opened');
    expect(state.marketStagesOn?.['market.inauguration']).toBe(state.day - NEW_BADGE_DAYS);
    expect(session.marketNew('item.sofa')).toBe(false);
  });
});
