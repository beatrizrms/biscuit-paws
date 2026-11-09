import { describe, expect, it } from 'vitest';
import { groomingOutcome, groomingProgress, newGrooming, stepGrooming, zoneAt, type GroomingParams, type MatDef, type ZoneDef } from '../../src/core/grooming';
import { paramsOf } from '../../src/core/minigame';
import { loadContent } from './content';

const content = loadContent();
const def = content.minigames.games.grooming!;
const mats = def.mats as MatDef[];
const zones = def.zones as ZoneDef[];
const p = (d: 'easy' | 'normal' | 'hard') => paramsOf<GroomingParams>(content.minigames, 'grooming', d);

/** Escova de um lado para o outro em volta de `at` (±dx), até `strokes` vezes; com `until`, para quando esse ponto limpa. */
function scrub(s: ReturnType<typeof newGrooming>, prm: GroomingParams, at: [number, number], strokes: number, dx = 2, until?: string) {
  const events = [];
  for (let i = 0; i < strokes; i++) {
    if (until && s.left[until] === 0) break;
    events.push(stepGrooming(s, prm, mats, zones, { x: at[0] + (i % 2 ? dx : -dx), y: at[1], down: true }, 16));
  }
  stepGrooming(s, prm, mats, zones, { x: at[0], y: at[1], down: false }, 16);
  return events;
}

describe('escovação', () => {
  it('só o caminho arrastado conta: clicar e parar em cima não desembaraça', () => {
    const prm = p('easy');
    const s = newGrooming(mats, prm);
    const back = mats.find((m) => m.id === 'back')!;
    for (let i = 0; i < 30; i++) stepGrooming(s, prm, mats, zones, { x: back.at[0], y: back.at[1], down: true }, 16);
    expect(s.left.back).toBe(back.need * prm.needScale);
    // Soltar e apertar de novo noutro lugar não conta a "viagem" como escovada.
    stepGrooming(s, prm, mats, zones, { x: 0, y: 0, down: false }, 16);
    stepGrooming(s, prm, mats, zones, { x: back.at[0] + 2, y: back.at[1], down: true }, 16);
    expect(s.left.back).toBe(back.need * prm.needScale);
  });

  it('escovar o bastante limpa o ponto; nas costas a paciência até sobe', () => {
    const prm = p('easy');
    const s = newGrooming(mats, prm);
    s.patience = 60;
    const back = mats.find((m) => m.id === 'back')!;
    const ev = scrub(s, prm, back.at, 20);
    expect(s.left.back).toBe(0);
    expect(ev.some((e) => e.cleaned.includes('back'))).toBe(true);
    expect(ev.some((e) => e.comfort)).toBe(true);
    expect(s.patience).toBeGreaterThan(60);
  });

  it('zonas sensíveis drenam a paciência; zerou, ele foge (fail)', () => {
    const prm = p('hard');
    const s = newGrooming(mats, prm);
    expect(zoneAt(zones, 15, 22)?.kind).toBe('sensitive');
    scrub(s, prm, [15, 22], 400);
    expect(s.patience).toBe(0);
    expect(groomingOutcome(s, prm)).toBe('fail');
  });

  it('tudo limpo: great com paciência acima de greatAbove, ok abaixo', () => {
    const prm = p('normal');
    const s = newGrooming(mats, prm);
    expect(Object.keys(s.left)).toHaveLength(prm.mats);
    for (const id of Object.keys(s.left)) scrub(s, prm, mats.find((m) => m.id === id)!.at, 40, 2, id);
    expect(groomingProgress(s, mats, prm)).toBe(1);
    expect(s.patience).toBeGreaterThan(prm.greatAbove);
    expect(groomingOutcome(s, prm)).toBe('great');
    s.patience = prm.greatAbove - 1;
    expect(groomingOutcome(s, prm)).toBe('ok');
  });

  it('dificuldades: mais emaranhados e as zonas sensíveis entram no difícil', () => {
    expect(p('easy').mats).toBeLessThan(p('hard').mats);
    const hardIds = mats.slice(0, p('hard').mats);
    expect(hardIds.some((m) => zoneAt(zones, m.at[0], m.at[1])?.kind === 'sensitive')).toBe(true);
    const easyIds = mats.slice(0, p('easy').mats);
    expect(easyIds.every((m) => zoneAt(zones, m.at[0], m.at[1])?.kind !== 'sensitive')).toBe(true);
  });
});
