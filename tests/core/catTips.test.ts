import { describe, expect, it } from 'vitest';
import { tipForDay } from '../../src/core/jobs';
import { loadContent } from './content';

const content = loadContent();
const tips = content.news.tips ?? [];

describe('Cartilha do gato', () => {
  it('uma dica diferente por dia, em ordem; depois da última, recomeça', () => {
    expect(tips.length).toBeGreaterThan(7);
    const week = [1, 2, 3, 4, 5, 6, 7].map((d) => tipForDay(content.news, d)!.id);
    expect(new Set(week).size).toBe(7);
    expect(tipForDay(content.news, 1)!.id).toBe(tips[0]!.id);
    expect(tipForDay(content.news, tips.length + 1)!.id).toBe(tips[0]!.id);
    expect(tipForDay({ ...content.news, tips: [] }, 3)).toBeNull();
  });

  it('a dica dos brinquedos fala da regra que está nos dados (1 a cada catsPerToy gatos)', () => {
    const toys = tips.find((t) => t.id === 'tip.toys')!;
    expect(toys.text).toContain(`cada ${content.health.care.play.catsPerToy} gatos`);
  });
});
