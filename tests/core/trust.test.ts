import { describe, expect, it } from 'vitest';
import { paramsOf, type Difficulty } from '../../src/core/minigame';
import { FULL_TRUST, moodFor, newTrust, stepTrust, trustOutcome, useTreat, type TrustParams, type TrustState } from '../../src/core/trust';
import { loadContent } from './content';

const content = loadContent();
const params = (d: Difficulty) => paramsOf<TrustParams>(content.minigames, 'trust', d);
const DT = 50;

/** Joga até acabar (ou 3 min) com uma estratégia; devolve o estado e quantos segundos levou. */
function play(p: TrustParams, decide: (s: TrustState) => { approach: boolean; back: boolean }): { s: TrustState; sec: number } {
  const s = newTrust(p);
  while (trustOutcome(s, p) === null && s.elapsed < 180_000) stepTrust(s, p, decide(s), DT);
  return { s, sec: s.elapsed / 1000 };
}

/** Paciente: anda só com ele calmo e bem relaxado; parada quando ele fica alerta. */
const patient = (p: TrustParams) => {
  let waiting = false;
  return (s: TrustState) => {
    if (s.mood !== 'calm') waiting = true;
    if (waiting && s.tension < p.alertAt / 3) waiting = false;
    return { approach: !waiting && s.distance > p.nearDistance - 20, back: false };
  };
};

describe('confiança do gato', () => {
  it('humor pela tensão', () => {
    const p = params('normal');
    expect(moodFor(0, p)).toBe('calm');
    expect(moodFor(p.alertAt, p)).toBe('alert');
    expect(moodFor(p.hissAt, p)).toBe('hissing');
  });

  it('com paciência, completa sem susto em 30 a 60 s nas três dificuldades', () => {
    for (const d of ['easy', 'normal', 'hard'] as const) {
      const p = params(d);
      const { s, sec } = play(p, patient(p));
      expect(trustOutcome(s, p), d).toBe('great');
      expect(sec, d).toBeGreaterThanOrEqual(30);
      expect(sec, d).toBeLessThanOrEqual(60);
    }
  });

  it('segurando sem parar, ele bufa e assusta até falhar', () => {
    const p = params('normal');
    const { s } = play(p, () => ({ approach: true, back: false }));
    expect(s.scares).toBe(p.maxScares);
    expect(trustOutcome(s, p)).toBe('fail');
  });

  it('susto: perde confiança, recua e não conta dois seguidos', () => {
    const p = params('normal');
    const s = newTrust(p);
    s.distance = p.nearDistance;
    s.trust = 50;
    s.tension = p.hissAt;
    expect(stepTrust(s, p, { approach: true, back: false }, DT).scared).toBe(true);
    expect(s.trust).toBe(50 - p.scareLoss);
    expect(s.distance).toBeGreaterThan(p.nearDistance);
    expect(stepTrust(s, p, { approach: true, back: false }, DT).scared).toBe(false); // ainda no intervalo
  });

  it('petisco: acelera a confiança e acalma; acaba', () => {
    const p = params('easy');
    const fast = newTrust(p);
    const slow = newTrust(p);
    for (const s of [fast, slow]) s.distance = p.minDistance;
    expect(useTreat(fast, p)).toBe(true);
    for (let i = 0; i < 40; i++) {
      stepTrust(fast, p, { approach: false, back: false }, DT);
      stepTrust(slow, p, { approach: false, back: false }, DT);
    }
    expect(fast.trust).toBeGreaterThan(slow.trust);
    expect(useTreat(fast, p)).toBe(true);
    expect(useTreat(fast, p)).toBe(false); // o fácil tem 2
    expect(fast.trust).toBeLessThanOrEqual(FULL_TRUST);
  });
});
