import { describe, expect, it } from 'vitest';
import { paramsOf, type Difficulty } from '../../src/core/minigame';
import { createRng, type Rng } from '../../src/core/rng';
import { crowded, FULL_TRUST, moodFor, newTrust, stepTrust, trustOutcome, useTreat, type TrustParams, type TrustState } from '../../src/core/trust';
import { loadContent } from './content';

const content = loadContent();
const params = (d: Difficulty) => paramsOf<TrustParams>(content.minigames, 'trust', d);
const DT = 50;

/** Joga até acabar (ou 3 min) com uma estratégia; devolve o estado e quantos segundos levou. */
function play(p: TrustParams, decide: (s: TrustState) => { approach: boolean; back: boolean }, seed = 7): { s: TrustState; sec: number } {
  const rng = createRng(seed);
  const s = newTrust(p, rng);
  while (trustOutcome(s, p) === null && s.elapsed < 180_000) stepTrust(s, p, decide(s), DT, rng);
  return { s, sec: s.elapsed / 1000 };
}

/**
 * Atenta ao gato, como a jogadora vê na tela: "Ele quer espaço" -> recua até sair do espaço dele e espera um pouco
 * ali; "!" -> para e espera ele relaxar; calmo -> chega perto de novo, devagar.
 */
const attentive = (p: TrustParams) => {
  let waiting = false;
  let holdUntil = 0;
  return (s: TrustState) => {
    if (crowded(s)) {
      holdUntil = s.elapsed + 3000;
      return { approach: false, back: true };
    }
    if (s.mood !== 'calm') waiting = true;
    if (waiting && s.tension < p.alertAt / 3) waiting = false;
    return { approach: !waiting && s.elapsed >= holdUntil && s.distance > p.minDistance, back: false };
  };
};

describe('confiança do gato', () => {
  it('humor pela tensão', () => {
    const p = params('normal');
    expect(moodFor(0, p)).toBe('calm');
    expect(moodFor(p.alertAt, p)).toBe('alert');
    expect(moodFor(p.hissAt, p)).toBe('hissing');
  });

  it('atenta ao humor dele, completa em 25 a 75 s; no fácil e no normal sem susto (no difícil, um sustinho na hora errada pode custar um)', () => {
    for (const d of ['easy', 'normal', 'hard'] as const) {
      const p = params(d);
      for (const seed of [1, 2, 7, 42]) {
        const { s, sec } = play(p, attentive(p), seed);
        const out = trustOutcome(s, p);
        if (d === 'hard') expect(['great', 'ok'], `${d} semente ${seed}`).toContain(out);
        else expect(out, `${d} semente ${seed}`).toBe('great');
        expect(s.scares, `${d} semente ${seed}`).toBeLessThanOrEqual(1);
        expect(sec, `${d} semente ${seed}`).toBeGreaterThanOrEqual(25);
        expect(sec, `${d} semente ${seed}`).toBeLessThanOrEqual(75);
      }
    }
  });

  it('chegar colada e ficar parada não basta: perto demais para o humor dele, a confiança quase não sobe', () => {
    for (const d of ['normal', 'hard'] as const) {
      const p = params(d);
      // Chega devagar (parando no "!") até encostar e fica ali, sem recuar nunca.
      let waiting = false;
      const glued = (s: TrustState) => {
        if (s.mood !== 'calm') waiting = true;
        if (waiting && s.tension < p.alertAt / 3) waiting = false;
        return { approach: !waiting && s.distance > p.minDistance, back: false };
      };
      const { s } = play(p, glued);
      expect(trustOutcome(s, p), d).not.toBe('great');
    }
  });

  it('segurando sem parar, ele bufa e assusta até falhar', () => {
    const p = params('normal');
    const { s } = play(p, () => ({ approach: true, back: false }));
    expect(s.scares).toBe(p.maxScares);
    expect(trustOutcome(s, p)).toBe('fail');
  });

  it('o espaço pessoal muda de tempos em tempos, sempre na faixa; perto demais, a tensão sobe mesmo parada', () => {
    const p = params('normal');
    const rng: Rng = createRng(3);
    const s = newTrust(p, rng);
    const seen = new Set<number>();
    for (let i = 0; i < 1200; i++) {
      stepTrust(s, p, { approach: false, back: false }, DT, rng);
      seen.add(Math.round(s.comfort));
      expect(s.comfort).toBeGreaterThanOrEqual(p.comfortRange[0]);
      expect(s.comfort).toBeLessThanOrEqual(p.comfortRange[1]);
    }
    expect(seen.size).toBeGreaterThan(3); // 60 s: mudou várias vezes
    // Parada, mas dentro do espaço dele: fica tenso e a confiança não sobe.
    s.comfort = p.nearDistance;
    s.nextComfortAt = s.elapsed + 60_000;
    s.nextStartleAt = s.elapsed + 60_000;
    s.distance = p.minDistance;
    s.tension = 0;
    const trust = s.trust;
    for (let i = 0; i < 40; i++) stepTrust(s, p, { approach: false, back: false }, DT, rng);
    expect(s.tension).toBeGreaterThan(p.alertAt);
    expect(s.trust).toBe(trust);
  });

  it('respeitando o espaço, quanto mais perto, mais rápido a confiança sobe', () => {
    const p = params('normal');
    const gain = (distance: number) => {
      const rng = createRng(5);
      const s = newTrust(p, rng);
      s.comfort = p.minDistance;
      s.nextComfortAt = s.nextStartleAt = 1e9;
      s.distance = distance;
      for (let i = 0; i < 40; i++) stepTrust(s, p, { approach: false, back: false }, DT, rng);
      return s.trust;
    };
    expect(gain(p.minDistance)).toBeGreaterThan(gain(p.nearDistance) * 1.5);
  });

  it('sustinho do nada: de tempos em tempos a tensão pula (ele fica alerta)', () => {
    const p = params('hard');
    const rng = createRng(9);
    const s = newTrust(p, rng);
    s.comfort = p.minDistance;
    s.nextComfortAt = 1e9;
    let startles = 0;
    for (let i = 0; i < 1200; i++) if (stepTrust(s, p, { approach: false, back: false }, DT, rng).startled) startles++;
    // 60 s com um sustinho a cada 7 a 12 s
    expect(startles).toBeGreaterThanOrEqual(4);
    expect(startles).toBeLessThanOrEqual(9);
  });

  it('susto: perde confiança, recua e não conta dois seguidos', () => {
    const p = params('normal');
    const rng = createRng(1);
    const s = newTrust(p, rng);
    s.distance = p.nearDistance;
    s.comfort = p.minDistance;
    s.trust = 50;
    s.tension = p.hissAt;
    expect(stepTrust(s, p, { approach: true, back: false }, DT, rng).scared).toBe(true);
    expect(s.trust).toBe(50 - p.scareLoss);
    expect(s.distance).toBeGreaterThan(p.nearDistance);
    expect(stepTrust(s, p, { approach: true, back: false }, DT, rng).scared).toBe(false); // ainda no intervalo
  });

  it('petisco: acelera a confiança e acalma; acaba', () => {
    const p = params('easy');
    const rng = createRng(2);
    const fast = newTrust(p, rng);
    const slow = newTrust(p, rng);
    for (const s of [fast, slow]) {
      s.distance = p.minDistance;
      s.comfort = p.minDistance;
      s.nextComfortAt = s.nextStartleAt = 1e9;
    }
    expect(useTreat(fast, p)).toBe(true);
    for (let i = 0; i < 40; i++) {
      stepTrust(fast, p, { approach: false, back: false }, DT, rng);
      stepTrust(slow, p, { approach: false, back: false }, DT, rng);
    }
    expect(fast.trust).toBeGreaterThan(slow.trust);
    expect(useTreat(fast, p)).toBe(true);
    expect(useTreat(fast, p)).toBe(false); // o fácil tem 2
    expect(fast.trust).toBeLessThanOrEqual(FULL_TRUST);
  });
});
