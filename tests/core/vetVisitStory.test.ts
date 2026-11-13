import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { knownIds, parseSave } from '../../src/core/save';
import { GameSession } from '../../src/core/session';
import { loadContent } from './content';

const content = loadContent();

describe('Gatinho doente: a consulta de entrada conta como a ida à clínica', () => {
  it('save real (dia 6): o passo de levar à clínica está feito e a história termina com as doses', () => {
    const json = readFileSync('tests/fixtures/save_real_dia6_remedio.json', 'utf8');
    const state = parseSave(json, knownIds(content)).state;
    const session = new GameSession(content, state);
    const goal = session.goals().find((g) => g.beatId === 'story.vet_visit')!;
    expect(goal.steps[1]!.done).toBe(true);
    expect(goal.steps[2]!.progress).toEqual([1, 7]);
    // A dose de hoje já foi: o remédio avisa, não conta de novo.
    expect(session.medicineProblem('cat.first_stray')).toBe('already_dosed');
    // As outras 6 doses, uma por dia: sarou, e a história segue.
    for (let d = 0; d < 6; d++) {
      state.day += 1;
      expect(session.medicateCat('cat.first_stray').ok).toBe(true);
    }
    expect(state.cats['cat.first_stray']!.sickness).toBeNull();
    expect(state.story.completed).toContain('story.vet_visit');
  });
});
