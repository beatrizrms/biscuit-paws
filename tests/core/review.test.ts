import { describe, expect, it } from 'vitest';
import { reviewReputation, reviewStars, validateReview, type ReviewConfig } from '../../src/core/review';
import { loadContent } from './content';

const cfg: ReviewConfig = loadContent().service.review;

describe('estrelas da avaliação', () => {
  it('começa em 5 e cada coisa tira a maior faixa alcançada; nunca menos de 1', () => {
    expect(reviewStars(cfg, { queue: 0, seated: 0 }, 0)).toBe(5);
    expect(reviewStars(cfg, { queue: 0.3, seated: 0 }, 0)).toBe(4);
    expect(reviewStars(cfg, { queue: 0.7, seated: 0 }, 0)).toBe(3);
    expect(reviewStars(cfg, { queue: 0, seated: 0.8 }, 0)).toBe(3);
    expect(reviewStars(cfg, { queue: 0, seated: 0 }, 1)).toBe(4);
    expect(reviewStars(cfg, { queue: 0, seated: 0 }, 9)).toBe(3);
    expect(reviewStars(cfg, { queue: 1, seated: 1 }, 9)).toBe(1);
    expect(reviewStars(cfg, { queue: 0, seated: 0 }, 0, true)).toBe(cfg.gaveUp);
  });

  it('reputação por nota; dados válidos', () => {
    expect([1, 2, 3, 4, 5].map((s) => reviewReputation(cfg, s))).toEqual([-2, -1, 0, 1, 2]);
    expect(validateReview(cfg)).toEqual([]);
    expect(validateReview({ ...cfg, reputation: { 1: 0 } })).toContain('service: review: falta a reputação de 2 estrela(s)');
  });
});
