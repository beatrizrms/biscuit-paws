import { describe, expect, it } from 'vitest';
import { newGameState } from '../../src/core/state';
import { evaluate } from '../../src/core/story';
import { loadContent } from './content';

const content = loadContent();
const ctx = { items: content.items, dirt: [], requiredSurfaces: [], rooms: content.rooms, seasons: content.seasons };

describe('primeira visita à clínica (dia da inauguração)', () => {
  it('a condição carryingCat: com o gato no colo, a Fernanda examina na hora; sem ele, "já volto com ele"', () => {
    const state = newGameState(500, 'map.street', 10 * 60);
    expect(evaluate({ carryingCat: true }, state, ctx)).toBe(false);
    state.hands.push({ kind: 'cat', catId: 'cat.first_stray' });
    expect(evaluate({ carryingCat: true }, state, ctx)).toBe(true);
    const steps = content.scripts['scr.clinic_opening']!.steps.filter((s) => 'dialogue' in s);
    const shown = (carrying: boolean) => {
      const st = newGameState(500, 'map.street', 10 * 60);
      if (carrying) st.hands.push({ kind: 'cat', catId: 'cat.first_stray' });
      return steps.filter((s) => !s.when || evaluate(s.when, st, ctx)).map((s) => (s as { dialogue: string }).dialogue);
    };
    expect(shown(false)).toContain('dlg.clinic_first_visit');
    expect(shown(false)).not.toContain('dlg.clinic_first_visit_with_cat');
    expect(shown(true)).toContain('dlg.clinic_first_visit_with_cat');
    expect(shown(true)).not.toContain('dlg.clinic_first_visit');
    // Com o gato, ninguém fala em "trazer depois".
    const lines = content.dialogue.dialogues['dlg.clinic_first_visit_with_cat']!.lines.map((l) => l.text).join(' ');
    expect(lines).not.toMatch(/já volto|posso trazer|traga/i);
  });
});
