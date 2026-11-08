import { describe, expect, it } from 'vitest';
import { heatAt, heatLevel, huntOutcome, search, setupHunt, type Hideout, type HuntState, type KittenHuntParams } from '../../src/core/kittenHunt';
import { paramsOf } from '../../src/core/minigame';
import { createRng } from '../../src/core/rng';
import { loadContent } from './content';

const content = loadContent();
const def = content.minigames.games.kitten_hunt!;
const line: Hideout[] = [0, 2, 4, 6, 8, 10].map((x, i) => ({ id: `h${i}`, kind: 'box', at: [x, 0] }));
const fixed = (kittens: string[], tries = 5): HuntState => ({ spots: line, kittens, searched: [], found: [], triesLeft: tries, triesUsed: 0 });

describe('caça ao filhote', () => {
  it('sorteio repetível: os esconderijos da dificuldade e a ninhada do difícil', () => {
    const hard = paramsOf<KittenHuntParams>(content.minigames, 'kitten_hunt', 'hard');
    const a = setupHunt(createRng(7), def.hideouts!, hard);
    const b = setupHunt(createRng(7), def.hideouts!, hard);
    expect(a).toEqual(b);
    expect(a.spots).toHaveLength(hard.hideouts);
    expect(a.kittens.length).toBeGreaterThanOrEqual(2);
    expect(new Set(a.kittens).size).toBe(a.kittens.length); // cada filhote num esconderijo
    const easy = setupHunt(createRng(7), def.hideouts!, paramsOf<KittenHuntParams>(content.minigames, 'kitten_hunt', 'easy'));
    expect(easy.kittens).toHaveLength(1);
  });

  it('quente/frio: mais perto do filhote, mais calor', () => {
    const s = fixed(['h5']);
    expect(heatAt(s, 'h4', 12)).toBeGreaterThan(heatAt(s, 'h0', 12));
    expect(heatLevel(def.heat!, heatAt(s, 'h4', 12)).label).not.toBe(heatLevel(def.heat!, heatAt(s, 'h0', 12)).label);
    expect(heatLevel(def.heat!, 0).label).toBe('Gelado');
  });

  it('cada clique gasta uma tentativa; o mesmo lugar não gasta de novo', () => {
    const s = fixed(['h5']);
    expect(search(s, 'h0', 12)).toMatchObject({ kind: 'empty' });
    expect(search(s, 'h0', 12)).toEqual({ kind: 'already' });
    expect(s.triesLeft).toBe(4);
    expect(search(s, 'h5', 12)).toEqual({ kind: 'found', done: true });
    expect(huntOutcome(s, { greatTries: 3 })).toBe('great');
  });

  it('ninhada: só acaba quando acha todos; muitas tentativas = ok; sem tentativas = não deu', () => {
    const s = fixed(['h1', 'h5'], 6);
    for (const id of ['h0', 'h2', 'h3']) search(s, id, 12);
    expect(search(s, 'h1', 12)).toEqual({ kind: 'found', done: false });
    expect(search(s, 'h5', 12)).toEqual({ kind: 'found', done: true });
    expect(huntOutcome(s, { greatTries: 3 })).toBe('ok');
    const lost = fixed(['h5'], 2);
    search(lost, 'h0', 12);
    search(lost, 'h1', 12);
    expect(search(lost, 'h2', 12)).toEqual({ kind: 'no_tries' });
    expect(huntOutcome(lost, { greatTries: 3 })).toBe('fail');
  });
});
