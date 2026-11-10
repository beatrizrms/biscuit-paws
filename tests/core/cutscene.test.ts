import { describe, expect, it } from 'vitest';
import { validateCutscenes, type CutscenesData } from '../../src/core/cutscene';

const cats = new Set(['cat.tekinha']);
const animations = new Set(['play', 'sit', 'sleep']);
const scene = (step: object) => ({ schemaVersion: 1, cutscenes: { 'cs.teste': { background: '#000', steps: [step] } } }) as unknown as CutscenesData;

describe('cenas: gato com ciclo de poses', () => {
  it('loop com poses que existem e segundos positivos é válido', () => {
    const data = scene({ type: 'cat', cat: 'cat.tekinha', animation: 'play', loop: [{ animation: 'play', seconds: 1.5 }, { animation: 'sit', seconds: 2.5 }, { animation: 'sleep', seconds: 3.5 }] });
    expect(validateCutscenes(data, cats, animations)).toEqual([]);
  });

  it('pose inexistente ou sem tempo no loop é erro', () => {
    const data = scene({ type: 'cat', cat: 'cat.tekinha', animation: 'play', loop: [{ animation: 'dance', seconds: 1 }, { animation: 'sit', seconds: 0 }] });
    const errors = validateCutscenes(data, cats, animations);
    expect(errors.some((e) => e.includes('"dance"'))).toBe(true);
    expect(errors.some((e) => e.includes('"sit" precisa de seconds'))).toBe(true);
  });
});
