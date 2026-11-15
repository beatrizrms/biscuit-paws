// A ceia de Natal preparada: a meta do ano (árvore, enfeites, o quitute nas mesas), a mistura do mercado e a turma
// pegando o quitute na mesa durante a festa.
import { describe, expect, it } from 'vitest';
import { pairKey } from '../../src/core/relationships';
import { GameSession } from '../../src/core/session';
import { newGameState } from '../../src/core/state';
import { loadContent } from './content';

const content = loadContent();
const SS = content.festive.secretSanta;
const XMAS = SS.day;
const YEAR = content.seasons.daysPerSeason * content.seasons.order.length;
const MIX = 'item.hot_chocolate_mix';
const COCOA = 'recipe.hot_chocolate';

/** Café funcionando no primeiro ano; ela conhece a Gabi (e o Joca) e a Dona Neusa. */
function cafe(day: number, time = 10 * 60) {
  const state = newGameState(500, 'map.cafe_main', time);
  state.day = day;
  state.business = 'soft_open';
  const beats = content.story.beats.map((b) => b.id);
  state.story.completed.push(...beats.slice(0, beats.indexOf('story.first_customer') + 1));
  Object.assign(state.flags, { 'prologue.done': true, 'seen.scr.gabi_visit': true, 'met.old_neighbor': true });
  const session = new GameSession(content, state);
  session.setPlayerCell([10, 7]);
  return { session, state };
}

/** A ceia já depois da troca de presentes (a turma fica conversando). */
function party(cocoasOnTables: number) {
  const { session, state } = cafe(XMAS, 19 * 60);
  state.secretSanta = { year: 1, drawn: 'npc.neusa', stage: 'drawn' };
  session.checkSecretSanta();
  session.openSantaGiving();
  session.secretSantaExchange(null);
  for (let i = 0; i < cocoasOnTables; i++) state.surfaces.push({ at: [8 + i, 5], item: { kind: 'drink', recipe: COCOA, vessel: 'mug' } as never });
  return { session, state };
}

describe('ceia de Natal preparada', () => {
  it('o quitute do ano: a receita e a mistura só no dia da ceia; a lista recomeça a cada ano', () => {
    expect(cafe(XMAS - 1).session.itemUnlocked(MIX)).toBe(false);
    const { session } = cafe(XMAS);
    expect(session.itemUnlocked(MIX)).toBe(true);
    expect(session.service.recipeStatus(COCOA)).not.toBe('locked');
    expect(content.recipes[COCOA]!.alternative).toEqual({ equipment: 'teapot', ingredients: { [MIX]: 1 } });
    expect(session.santaTreat()).toMatchObject({ recipe: COCOA, name: 'chocolate quente', mix: MIX });
    expect(cafe(XMAS + 1).session.service.recipeStatus(COCOA)).toBe('locked');
    const years = SS.treat!.years;
    expect(cafe(XMAS + YEAR).session.santaTreat()!.recipe).toBe(years[1 % years.length]!.recipe);
  });

  it('a meta aparece depois do sorteio (todo ano), com os passos opcionais, e some quando a ceia acaba', () => {
    const before = cafe(SS.drawDay);
    expect(before.session.goals().some((g) => g.beatId === 'xmas.party_prep')).toBe(false);
    const { session, state } = cafe(SS.drawDay + 1);
    state.secretSanta = { year: 1, drawn: 'npc.neusa', stage: 'drawn' };
    const goal = session.goals().find((g) => g.beatId === 'xmas.party_prep')!;
    expect(goal.steps).toHaveLength(SS.prep!.steps.length);
    expect(goal.steps.every((s) => s.optional)).toBe(true);
    expect(goal.extrasTitle).toBe(SS.prep!.extrasTitle);
    state.secretSanta.stage = 'done';
    expect(session.goals().some((g) => g.beatId === 'xmas.party_prep')).toBe(false);
  });

  it('na festa, a turma pega o quitute da mesa aos poucos (sorteado); a louça fica suja ali; o Joca não pega', () => {
    const { session, state } = party(3);
    const taken: string[] = [];
    session.bus.on('xmas.treat_taken', ({ npc }) => taken.push(npc));
    const before = state.relationships[pairKey('player', 'npc.gabi')] ?? 0;
    for (let m = 0; m < 240 && taken.length < 3; m++) session.tickClock(1);
    expect(taken.length).toBeGreaterThan(0);
    expect(taken).not.toContain('npc.joca');
    expect(new Set(taken).size).toBe(taken.length); // cada um pega uma vez
    expect(state.secretSanta?.treatTaken).toEqual(taken);
    expect(state.surfaces.filter((x) => x.item.kind === 'dirty')).toHaveLength(taken.length);
    if (taken.includes('npc.gabi')) expect(state.relationships[pairKey('player', 'npc.gabi')]).toBeGreaterThanOrEqual(before + SS.treat!.points);
  });

  it('o passo da mesa conta o que está nas mesas e o que a turma já pegou; com tudo pronto, corações a mais no fim', () => {
    const { session, state } = party(3);
    state.placed.push(
      ...['item.christmas_tree', 'item.xmas_wreath', 'item.xmas_lights', 'item.xmas_stocking'].map((item, i) => ({ uid: `x${i}`, item, at: [2 + i * 2, 3] as [number, number] })),
    );
    expect(session.holds({ santaTreat: { gte: 3 } })).toBe(true);
    for (let m = 0; m < 60; m++) session.tickClock(1);
    expect(session.holds({ santaTreat: { gte: 3 } })).toBe(true); // pegar não desfaz o passo
    const before = state.relationships[pairKey('player', 'npc.neusa')] ?? 0;
    const bonus: number[] = [];
    session.bus.on('xmas.prep_bonus', ({ steps, points }) => bonus.push(steps, points));
    session.endFestiveParty();
    expect(bonus).toEqual([3, 3 * SS.prep!.pointsPerStep]);
    expect(state.relationships[pairKey('player', 'npc.neusa')]).toBeGreaterThanOrEqual(before + 3 * SS.prep!.pointsPerStep);
  });

  it('sem nada preparado, a ceia acontece igual (sem bônus) e a Gabi não fala do quitute', () => {
    const { session } = party(0);
    const gabi = SS.partyChat['npc.gabi']!.flatMap((l) => (typeof l === 'string' ? [l] : session.holds(l.when) ? [l.text] : []));
    expect(gabi.some((l) => l.includes('{treat}'))).toBe(false);
    const bonus: number[] = [];
    session.bus.on('xmas.prep_bonus', ({ steps }) => bonus.push(steps));
    session.endFestiveParty();
    expect(bonus).toEqual([]);
  });
});
