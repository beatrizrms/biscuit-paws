import { describe, expect, it } from 'vitest';
import { validateScripts, type ScriptStep } from '../../src/core/script';
import { loadContent } from './content';

const content = loadContent();
const none = new Set<string>();
const refs = { npcs: none, maps: none, dialogues: none, items: none, cats: none, balloons: none, npcAnims: () => none, rooms: none, doors: none };

describe('a cena da inauguração', () => {
  it('a fita na porta, o corte e todo mundo entrando no salão (sem fogos)', () => {
    const steps = content.scripts['scr.inauguration']!.steps;
    const at = (f: (s: ScriptStep) => boolean) => steps.findIndex(f);
    const show = at((s) => 'ribbon' in s && s.ribbon === 'show');
    const cut = at((s) => 'ribbon' in s && s.ribbon === 'cut');
    const inside = at((s) => 'enter' in s && s.enter === content.map.id);
    expect(show).toBeGreaterThanOrEqual(0);
    expect(cut).toBeGreaterThan(show);
    expect(inside).toBeGreaterThan(cut);
    expect(steps.some((s) => 'fireworks' in s)).toBe(false);
    // Os votos de sucesso são no salão, depois de entrar.
    expect(at((s) => 'dialogue' in s && s.dialogue === 'dlg.inauguration')).toBeGreaterThan(inside);
  });

  it('a fita estendida precisa da célula', () => {
    const bad = validateScripts({ schemaVersion: 1, scripts: { 'scr.x': { steps: [{ ribbon: 'show' }] } } }, refs);
    expect(bad.join()).toContain('ribbon show precisa de at');
    const ok = validateScripts({ schemaVersion: 1, scripts: { 'scr.x': { steps: [{ ribbon: 'show', at: [1, 1] }, { ribbon: 'cut' }] } } }, refs);
    expect(ok).toEqual([]);
  });
});
