import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { newPhoto, photoOutcome, scoreShot, shoot, stepPhoto, validatePhoto, type PhotoParams, type PhotoState } from '../../src/core/photo';
import { makeResult } from '../../src/core/minigame';
import { createRng } from '../../src/core/rng';
import { knownIds, parseSave } from '../../src/core/save';
import { GameSession } from '../../src/core/session';
import { newGameState } from '../../src/core/state';
import { loadContent } from './content';

const content = loadContent();
const data = content.photo;
const p: PhotoParams = { cats: 2, shots: 3, cuteWindow: 0.6, speed: 40, okAt: 50, greatAt: 80 };

/** Dois gatos parados num lugar conhecido, na pose pedida. */
function still(pose: 'sit' | 'cute', at: [number, number][] = [[200, 200], [230, 200]]): PhotoState {
  const s = newPhoto(data, p, createRng(1), ['cat.a', 'cat.b']);
  s.cats.forEach((c, i) => Object.assign(c, { x: at[i]![0], y: at[i]![1], pose, left: 99 }));
  return s;
}

describe('foto perfeita', () => {
  it('nota: pose fofa no centro com os dois = 100; pose comum vale pouco; fora do visor = 0', () => {
    expect(scoreShot(data, still('cute', [[200, 200], [200, 200]]), 200, 200)).toMatchObject({ score: 100, pose: 'cute', catIds: ['cat.a', 'cat.b'] });
    const sit = scoreShot(data, still('sit', [[200, 200], [200, 200]]), 200, 200);
    expect(sit.score).toBe(Math.round(data.scoring.moment * data.poses.sit.moment + data.scoring.framing + data.scoring.pair));
    expect(scoreShot(data, still('cute'), 500, 100)).toMatchObject({ score: 0, catIds: [] });
    // Um gato na borda do visor: enquadramento perto de zero, sem dupla.
    const edge = scoreShot(data, still('cute', [[200, 200], [600, 100]]), 200 + data.frame.w / 2 - 1, 200);
    expect(edge.catIds).toEqual(['cat.a']);
    expect(edge.score).toBeLessThan(data.scoring.moment + 3);
  });

  it('o filme acaba; vale a melhor foto; resultado pelos limiares', () => {
    const s = still('cute', [[200, 200], [200, 200]]);
    expect(shoot(data, s, 500, 100)!.score).toBe(0);
    expect(shoot(data, s, 200, 200)!.score).toBe(100);
    expect(shoot(data, s, 500, 100)!.score).toBe(0);
    expect(shoot(data, s, 200, 200)).toBeNull(); // sem filme
    expect(s.best!.score).toBe(100);
    expect(photoOutcome(p, s.best)).toBe('great');
    expect(photoOutcome(p, { score: 60, pose: 'sit', catIds: [] })).toBe('ok');
    expect(photoOutcome(p, null)).toBe('fail');
  });

  it('poses: a fofa só vem do sentar e dura a janela; andando, o gato vai até o ponto e para', () => {
    const s = newPhoto(data, p, createRng(9), ['cat.a', 'cat.b']);
    const rng = createRng(9);
    const seen: string[] = [];
    let cuteFromSit = true;
    for (let i = 0; i < 4000; i++) {
      const before = s.cats.map((c) => c.pose);
      stepPhoto(data, p, s, 0.05, rng);
      s.cats.forEach((c, k) => {
        if (c.pose !== before[k]) {
          seen.push(c.pose);
          if (c.pose === 'cute' && before[k] !== 'sit') cuteFromSit = false;
          if (c.pose === 'cute') expect(c.left).toBeCloseTo(p.cuteWindow);
        }
      });
      // Sempre dentro do quintal.
      const [ax, ay, aw, ah] = data.arena;
      for (const c of s.cats) {
        expect(c.x).toBeGreaterThanOrEqual(ax - 0.01);
        expect(c.x).toBeLessThanOrEqual(ax + aw + 0.01);
        expect(c.y).toBeGreaterThanOrEqual(ay - 0.01);
        expect(c.y).toBeLessThanOrEqual(ay + ah + 0.01);
      }
    }
    expect(cuteFromSit).toBe(true);
    for (const pose of ['walk', 'sit', 'play', 'loaf', 'cute']) expect(seen).toContain(pose);
  });

  it('dados válidos; perfeito impossível com um gato é acusado', () => {
    const anims = new Set(content.catSprites.animations.map((a) => a.name));
    expect(validatePhoto(data, anims, content.minigames.games.photo!.difficulties as unknown as Record<string, PhotoParams>)).toEqual([]);
    expect(validatePhoto(data, anims, { x: { ...p, cats: 1, greatAt: 99 } })).toContain('photo: x: greatAt 99 impossível com um gato');
  });
});

describe('a melhor foto no save', () => {
  it('fica a melhor de sempre; uma pior não troca', () => {
    const state = newGameState(500, 'map.street', 600);
    const session = new GameSession(content, state);
    const events: string[] = [];
    session.bus.onAny((n) => events.push(n));
    const photo = (score: number) => makeResult(content.minigames, 'photo', 'normal', 'ok', score, false, { photo: { pose: 'sit', score, catIds: [] } });
    session.finishMiniGame(photo(60), { difficulty: 'normal' });
    session.finishMiniGame(photo(40), { difficulty: 'normal' });
    expect(state.bestPhoto).toMatchObject({ score: 60 });
    expect(events.filter((e) => e === 'photo.best')).toHaveLength(1);
  });

  it('save v23 guarda a melhor foto (gato que sumiu sai); saves antigos começam sem foto', () => {
    const known = knownIds(content);
    expect(parseSave(readFileSync('tests/fixtures/save_v23.json', 'utf8'), known).state.bestPhoto).toEqual({ pose: 'cute', score: 91, catIds: ['cat.first_stray'], day: 5 });
    expect(parseSave(readFileSync('tests/fixtures/save_v22.json', 'utf8'), known).state.bestPhoto).toBeNull();
  });
});
