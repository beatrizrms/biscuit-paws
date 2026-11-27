import { describe, expect, it } from 'vitest';
import { startsCold, warmStep } from '../../src/core/cold';
import { GameSession } from '../../src/core/session';
import { newGameState } from '../../src/core/state';
import { loadContent } from './content';

const content = loadContent();
const cfg = content.catProfiles.cold!;

/** Inverno, prólogo feito, um gato de rua aceito agora. */
function winterCat(condition = 'healthy') {
  const state = newGameState(500, 'map.cafe_main', 9 * 60);
  state.flags['prologue.done'] = true;
  const session = new GameSession(content, state);
  expect(session.season()).toBe('winter');
  const id = 'cat.gen.1';
  state.catDefs[id] = { id, variant: 'tigrado', personality: 'curious', nameSuggestions: ['Neve'], tags: ['generated', `condition:${condition}`] };
  session.shelterCat(id, condition);
  state.cats[id]!.name = 'Neve';
  return { state, session, id };
}

describe('frio no inverno (decisão 310)', () => {
  it('regra: a condição cold sempre; os outros, só no inverno; antes do prólogo, ninguém', () => {
    expect(startsCold('healthy', 'winter', true, cfg)).toBe(true);
    expect(startsCold('healthy', 'spring', true, cfg)).toBe(false);
    expect(startsCold('cold', 'summer', true, cfg)).toBe(true);
    expect(startsCold('cold', 'winter', false, cfg)).toBe(false);
    expect(warmStep(0, 30, false, cfg)).toEqual({ warmed: 0, done: false });
    expect(warmStep(cfg.warmMinutes - 10, 30, true, cfg)).toEqual({ warmed: cfg.warmMinutes, done: true });
  });

  it('o gato de rua do inverno chega com frio; a meta pede um cantinho quente; com ele, esquenta e a meta some', () => {
    const { state, session, id } = winterCat();
    expect(state.cats[id]!.cold).toBe(0);
    expect(session.chores().find((c) => c.kind === 'cold')).toMatchObject({ catId: id, warm: false });
    // Sem cantinho quente, o tempo passa e ele continua gelado.
    session.tickClock(60 / content.dayNight.minutesPerSecond);
    expect(state.cats[id]!.cold).toBe(0);
    state.placed.push({ uid: 'bed1', item: 'item.cat_bed', at: [5, 8] });
    expect(session.chores().find((c) => c.kind === 'cold')).toMatchObject({ warm: true });
    for (let m = 0; m <= cfg.warmMinutes; m += 30) session.tickClock(30 / content.dayNight.minutesPerSecond);
    expect(state.cats[id]!.cold).toBeUndefined();
    expect(session.chores().some((c) => c.kind === 'cold')).toBe(false);
  });

  it('fim do dia com frio: a alegria cai um pouco', () => {
    const { state, session, id } = winterCat();
    const before = state.cats[id]!.happiness!;
    session.endDay('curfew');
    expect(state.cats[id]!.happiness).toBeLessThanOrEqual(before - cfg.happinessPerDay);
  });
});
