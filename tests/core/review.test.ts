import { describe, expect, it } from 'vitest';
import { dailyReputation, reviewStars, validateReview, type ReviewConfig } from '../../src/core/review';
import { loadContent } from './content';

const cfg: ReviewConfig = loadContent().service.review;

describe('estrelas da avaliação', () => {
  it('começa em 5 e cada coisa tira a maior faixa alcançada; nunca menos de 1', () => {
    expect(reviewStars(cfg, { queue: 0, seated: 0 }, 0)).toBe(5);
    expect(reviewStars(cfg, { queue: 0.3, seated: 0 }, 0)).toBe(4);
    expect(reviewStars(cfg, { queue: 0.7, seated: 0 }, 0)).toBe(3);
    expect(reviewStars(cfg, { queue: 0, seated: 0.8 }, 0)).toBe(3);
    // Sujeira: até 2 à vista, nada; de 3 a 5, uma estrela; mais de 5, duas.
    expect(reviewStars(cfg, { queue: 0, seated: 0 }, 2)).toBe(5);
    expect(reviewStars(cfg, { queue: 0, seated: 0 }, 3)).toBe(4);
    expect(reviewStars(cfg, { queue: 0, seated: 0 }, 9)).toBe(3);
    expect(reviewStars(cfg, { queue: 1, seated: 1 }, 9)).toBe(1);
    expect(reviewStars(cfg, { queue: 0, seated: 0 }, 0, true)).toBe(cfg.gaveUp);
  });

  it('reputação do dia pela média das avaliações do dia; quem desiste conta 2 estrelas; dados válidos', () => {
    expect(cfg.gaveUp).toBe(2);
    expect(dailyReputation(cfg, [])).toBe(0);
    expect(dailyReputation(cfg, [5, 5, 5, 4])).toBe(2); // 4,75
    expect(dailyReputation(cfg, [5, 4, 4, 3])).toBe(1); // 4
    expect(dailyReputation(cfg, [3, 3])).toBe(0);
    expect(dailyReputation(cfg, [2, 2, 2])).toBe(-1);
    expect(dailyReputation(cfg, [1, 1])).toBe(-2);
    expect(validateReview(cfg)).toEqual([]);
    expect(validateReview({ ...cfg, daily: [] })).toContain('service: review: falta daily (reputação do dia pela média)');
  });
});
