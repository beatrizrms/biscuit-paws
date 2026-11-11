import { describe, expect, it } from 'vitest';
import type { Condition } from '../../src/core/content';
import { GameSession } from '../../src/core/session';
import { newGameState } from '../../src/core/state';
import { loadContent } from './content';

const content = loadContent();

/** Jogo novo, sem nada feito. */
function fresh() {
  const state = newGameState(150, 'map.cafe_main', 9 * 60);
  return { state, session: new GameSession(content, state) };
}

describe('atalhos de evento do debug cumprem os pré-requisitos', () => {
  for (const def of content.festivals) {
    it(`${def.name}: começa num jogo novo com tudo o que pede`, () => {
      const { state, session } = fresh();
      session.debugStartFestival(def.id);
      expect(state.festivals.active?.id).toBe(def.id);
      if (def.when) expect(session.holds(def.when as Condition)).toBe(true);
      if (def.unlockReputation) {
        const t = content.reputation.thresholds.find((x) => x.id === def.unlockReputation)!;
        expect(session.reputation()).toBeGreaterThanOrEqual(t.at);
      }
      // Gatos gerados: com nome e já com a turma (sem consulta de entrada pendente).
      for (const id of session.shelteredCats()) {
        expect(state.cats[id]!.name).not.toBe('');
        expect(state.cats[id]!.clinic).toBeUndefined();
      }
    });
  }

  it('Feira de adoção: os 9 gatos que ela pede entram no save', () => {
    const { session } = fresh();
    expect(session.shelteredCats().length).toBeLessThan(9);
    session.debugStartFestival('fest.adoption_fair');
    expect(session.shelteredCats().length).toBeGreaterThanOrEqual(9);
  });

  it('Natal e Halloween: a turma toda conhecida (todos vêm)', () => {
    const xmas = fresh();
    xmas.session.debugFestive('party');
    expect(xmas.session.santaGuests().sort()).toEqual(content.festive.secretSanta.friends.map((f) => f.npc).sort());
    const hw = fresh();
    hw.session.debugFestive('hw_party');
    expect(hw.session.halloweenGuests().sort()).toEqual(content.festive.halloween.friends.map((f) => f.npc).sort());
  });
});

describe('atalho da inauguração', () => {
  it('num jogo novo: reforma, placa e primavera cumpridas, e a inauguração acontece', () => {
    const { state, session } = fresh();
    session.debugReachBeat('story.inauguration');
    expect(state.story.completed).toContain('story.inauguration');
    expect(state.flags['cafe.inaugurated']).toBe(true);
    expect(session.seasonDay().season).toBe('spring');
  });
});

describe('gatos gerados pelo debug', () => {
  it('não repetem nome', () => {
    const { session, state } = fresh();
    session.debugStartFestival('fest.adoption_fair');
    const names = session.shelteredCats().map((id) => state.cats[id]!.name);
    expect(new Set(names).size).toBe(names.length);
  });
});
