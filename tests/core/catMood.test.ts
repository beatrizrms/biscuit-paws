import { describe, expect, it } from 'vitest';
import { catEffect, catWellbeing, patienceShift, type CatBonusConfig } from '../../src/core/catMood';

const cfg: CatBonusConfig = { reach: 3, happyAt: 70, sadBelow: 40, patiencePerCat: 0.15, patienceMax: 0.3, sadPatience: -0.1, tipPerCat: 0.25, tipMax: 0.5 };

describe('bem-estar dos gatos no atendimento', () => {
  it('bem-estar: 8 corações e barras 90/70/50 = 75', () => {
    expect(catWellbeing({ hearts: 8, maxHearts: 10, health: 90, maxHealth: 100, happiness: 70, hygiene: 50, careMax: 100 })).toBe(75);
  });

  it('felizes somam até o teto; mal cuidado só tira se não houver feliz', () => {
    expect(catEffect([], cfg)).toMatchObject({ patience: 0, tip: 0 });
    expect(catEffect([80], cfg)).toMatchObject({ patience: 0.15, tip: 0.25 });
    expect(catEffect([80, 90, 95], cfg)).toMatchObject({ patience: 0.3, tip: 0.5 });
    expect(catEffect([20], cfg)).toMatchObject({ patience: -0.1, tip: 0 });
    expect(catEffect([20, 80], cfg)).toMatchObject({ patience: 0.15 });
    expect(catEffect([55], cfg)).toMatchObject({ patience: 0, tip: 0 });
  });

  it('a espera dura (1 + paciência) vezes: com +30%, 13 minutos rendem 10 de espera', () => {
    expect(13 - patienceShift(13, 0.3)).toBeCloseTo(10);
    expect(patienceShift(10, 0)).toBe(0);
    expect(patienceShift(9, -0.1)).toBeCloseTo(-1);
  });
});
