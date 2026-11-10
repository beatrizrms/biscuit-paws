import { describe, expect, it } from 'vitest';
import { paramsOf } from '../../src/core/minigame';
import { FULL_EXCITEMENT, newWand, stepWand, wandOutcome, type WandParams } from '../../src/core/wand';
import { loadContent } from './content';

const content = loadContent();
const p = paramsOf<WandParams>(content.minigames, 'wand', 'normal');
const DT = 1000 / 60;

/** Roda `sec` segundos com a ponta seguindo `path(t)`; devolve os eventos que aconteceram. */
function run(s: ReturnType<typeof newWand>, sec: number, path: (t: number) => { x: number; y: number }) {
  const events: string[] = [];
  for (let t = 0; t < sec * 1000; t += DT) {
    const ev = stepWand(s, p, path(s.elapsed / 1000), DT);
    for (const [k, v] of Object.entries(ev)) if (v) events.push(k === 'bored' ? `bored:${v}` : k);
  }
  return events;
}

describe('varinha', () => {
  it('o gato persegue com aceleração limitada (sem teletransporte) e chega perto da ponta', () => {
    const s = newWand({ x: 100, y: 200 }, { x: 400, y: 200 });
    stepWand(s, p, { x: 400, y: 200 }, DT);
    expect(Math.hypot(s.catVel.x, s.catVel.y)).toBeLessThanOrEqual(p.catAccel * (DT / 1000) + 1e-6);
    run(s, 3, () => ({ x: 400, y: 200 }));
    expect(Math.hypot(400 - s.cat.x, 200 - s.cat.y)).toBeLessThan(p.pounceRange);
  });

  it('variar rumo e ritmo empolga; linha reta constante enjoa', () => {
    const lively = newWand({ x: 300, y: 200 }, { x: 300, y: 150 });
    // Zigue-zague com ritmo mudando: varia o tempo todo.
    const ev = run(lively, 4, (t) => ({ x: 300 + 120 * Math.sin(t * 3.1) * Math.cos(t * 0.7), y: 180 + 60 * Math.sin(t * 5.3) }));
    expect(lively.excitement).toBeGreaterThan(15);
    expect(ev.filter((e) => e.startsWith('bored'))).toHaveLength(0);

    const straight = newWand({ x: 0, y: 200 }, { x: 0, y: 150 });
    const ev2 = run(straight, p.boredAfterSec + 1.5, (t) => ({ x: 60 * t, y: 150 }));
    expect(ev2).toContain('bored:boring');
    expect(straight.bored).toBeGreaterThan(0);
  });

  it('rápido demais: ele desiste (conta como enjoo)', () => {
    const s = newWand({ x: 300, y: 200 }, { x: 300, y: 150 });
    const ev = run(s, p.giveUpAfterSec + 0.5, (t) => ({ x: 300 + 200 * Math.sin(t * 12), y: 150 + 200 * Math.cos(t * 12) }));
    expect(ev).toContain('bored:too_fast');
  });

  it('bote: ponta parada perto dele, agacha, balançar de leve dá bônus, e salta na ponta', () => {
    const s = newWand({ x: 300, y: 200 }, { x: 330, y: 200 });
    let ev = run(s, p.pounceDelaySec + 0.2, () => ({ x: 330, y: 200 }));
    expect(ev).toContain('crouched');
    expect(s.mode).toBe('crouch');
    // Balança de leve (~30-60 px/s) durante o agachar.
    ev = run(s, p.crouchSec + 0.5, (t) => ({ x: 330 + 6 * Math.sin(t * 8), y: 200 }));
    expect(ev).toContain('wiggle');
    expect(ev).toContain('pounced');
    expect(s.pounces).toBe(1);
    expect(s.wiggles).toBe(1);
  });

  it('varinha parada perto dele o jogo todo: um bote só, depois a presa parada dá tédio e ele enjoa; não completa', () => {
    const s = newWand({ x: 300, y: 200 }, { x: 330, y: 200 });
    const ev = run(s, p.timeSec, () => ({ x: 330, y: 200 }));
    expect(s.pounces).toBe(1);
    expect(ev).toContain('bored:still');
    expect(s.bored).toBeGreaterThanOrEqual(3);
    expect(wandOutcome(s, p, true)).toBe('fail');
  });

  it('a presa fugindo de novo recarrega o bote: mexer depois do bote, parar perto e ele salta outra vez', () => {
    const s = newWand({ x: 300, y: 200 }, { x: 330, y: 200 });
    run(s, p.pounceDelaySec + p.crouchSec + 1, () => ({ x: 330, y: 200 }));
    expect(s.pounces).toBe(1);
    expect(s.armed).toBe(false);
    // Foge em zigue-zague o bastante para recarregar...
    run(s, p.rearmSec + 0.6, (t) => ({ x: 330 + 50 * Math.sin(t * 4), y: 200 + 30 * Math.sin(t * 6.3) }));
    expect(s.armed).toBe(true);
    // ...e para perto dele: outro bote.
    const stop = { x: s.tip.x, y: s.tip.y };
    run(s, 3, () => stop);
    expect(s.pounces).toBe(2);
  });

  it('jogando bem (zigue-zague e paradas perto dele para o bote), completa a tempo nas três dificuldades', () => {
    for (const d of ['easy', 'normal', 'hard'] as const) {
      const q = paramsOf<WandParams>(content.minigames, 'wand', d);
      const s = newWand({ x: 300, y: 200 }, { x: 330, y: 200 });
      let stopAt: { x: number; y: number } | null = null;
      for (let t = 0; t < q.timeSec * 1000 && wandOutcome(s, q, false) === null; t += DT) {
        const sec = s.elapsed / 1000;
        // Ciclos de ~3 s: 2 s fugindo em zigue-zague, ~1 s parada (o gato chega, agacha e salta).
        const fleeing = sec % 3 < 2;
        if (fleeing) stopAt = null;
        const tip = fleeing ? { x: 300 + 110 * Math.sin(sec * 2.9) * Math.cos(sec * 0.8), y: 190 + 55 * Math.sin(sec * 4.7) } : (stopAt ??= { ...s.tip });
        stepWand(s, q, tip, DT);
      }
      expect(wandOutcome(s, q, true), d).not.toBe('fail');
      expect(s.excitement, d).toBeGreaterThanOrEqual(q.okAt);
    }
  });

  it('resultado: barra cheia sem enjoo = great; com enjoo = ok; no tempo, okAt decide', () => {
    const s = newWand({ x: 0, y: 0 }, { x: 0, y: 0 });
    expect(wandOutcome(s, p, false)).toBeNull();
    expect(wandOutcome(s, p, true)).toBe('fail');
    s.excitement = p.okAt;
    expect(wandOutcome(s, p, true)).toBe('ok');
    s.excitement = FULL_EXCITEMENT;
    expect(wandOutcome(s, p, false)).toBe('great');
    s.bored = 1;
    expect(wandOutcome(s, p, false)).toBe('ok');
  });

  it('dificuldades: mais difícil = menos tempo e enjoa mais rápido', () => {
    const easy = paramsOf<WandParams>(content.minigames, 'wand', 'easy');
    const hard = paramsOf<WandParams>(content.minigames, 'wand', 'hard');
    expect(hard.timeSec).toBeLessThan(easy.timeSec);
    expect(hard.boredAfterSec).toBeLessThan(easy.boredAfterSec);
    expect(easy.timeSec).toBeGreaterThanOrEqual(30);
    expect(easy.timeSec).toBeLessThanOrEqual(45);
  });
});
