import { describe, expect, it } from 'vitest';
import { latteOutcome, samplePolylines, scoreDrawing, starsFor, type LatteParams, type Pt } from '../../src/core/latte';
import { makeResult, paramsOf } from '../../src/core/minigame';
import { loadContent } from './content';

const content = loadContent();
const cfg = content.minigames;
const latte = cfg.games.latte!;
const pattern = (id: string) => latte.patterns!.find((p) => p.id === id)!;
const p = paramsOf<LatteParams>(cfg, 'latte', 'normal');

describe('Latte art: nota do desenho', () => {
  it('amostra os segmentos longos (a estrela tem só os vértices)', () => {
    const pts = samplePolylines(pattern('star').lines, 3);
    expect(pts.length).toBeGreaterThan(80);
  });

  it('traço igual ao contorno: nota máxima e 3 estrelas', () => {
    const s = scoreDrawing(pattern('heart'), pattern('heart').lines, p);
    expect(s.coverage).toBeCloseTo(1);
    expect(s.accuracy).toBeCloseTo(1);
    expect(starsFor(s.score, p.starAt)).toBe(3);
    expect(latteOutcome(3)).toBe('great');
  });

  it('meio contorno cobre a metade; rabisco longe da linha tem precisão baixa', () => {
    const half = pattern('heart').lines.map((l) => l.slice(0, Math.floor(l.length / 2)));
    const s = scoreDrawing(pattern('heart'), half, p);
    expect(s.coverage).toBeGreaterThan(0.35);
    expect(s.coverage).toBeLessThan(0.65);
    expect(s.accuracy).toBeCloseTo(1);
    // Um "X" atravessando o quadrado inteiro: passa pela linha só em poucos pontos.
    const scribble: Pt[][] = [[[0, 0], [128, 128]], [[128, 0], [0, 128]]];
    const w = scoreDrawing(pattern('heart'), scribble, p);
    expect(w.accuracy).toBeLessThan(0.3);
    expect(starsFor(w.score, p.starAt)).toBe(0);
    expect(latteOutcome(0)).toBe('fail');
  });

  it('sem traço: zero', () => {
    expect(scoreDrawing(pattern('paw'), [], p)).toEqual({ coverage: 0, accuracy: 0, score: 0 });
  });

  it('gorjeta por estrelas soma às moedas', () => {
    const r = makeResult(cfg, 'latte', 'normal', 'great', 3, false, { bonusCoins: p.tipPerStar[3] });
    expect(r.coinsEarned).toBe(latte.rewards.normal.great + p.tipPerStar[3]);
  });
});
