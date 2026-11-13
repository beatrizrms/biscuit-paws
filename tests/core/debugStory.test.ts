// Debug "próximo marco (com a cena)": marco por marco, cada um cumprido do jeito do jogo para a cena dele acontecer;
// o que pede algo que o debug não cumpre (móvel posicionado) é concluído sem a cena, e nunca trava.
import { describe, expect, it } from 'vitest';
import { GameSession } from '../../src/core/session';
import { newGameState } from '../../src/core/state';
import { loadContent } from './content';

const content = loadContent();

describe('debug: marco por marco com as cenas', () => {
  it('do fim do prólogo ao fim da história, sem travar; as visitas e a inauguração tocam a cena', () => {
    const session = new GameSession(content, newGameState(150, 'map.street', 7 * 60));
    const scenes: string[] = [];
    session.bus.on('script.requested', ({ scriptId }) => scenes.push(scriptId));
    session.bus.on('cutscene.requested', ({ cutsceneId }) => scenes.push(cutsceneId));
    session.debugCompleteStory('story.prologue_end');
    const seen: string[] = [];
    for (let i = 0; i < content.story.beats.length + 2; i++) {
      const r = session.debugPlayNextBeat();
      if (!r) break;
      expect(seen, `${r.id} repetiu (travou)`).not.toContain(r.id);
      seen.push(r.id);
    }
    expect(session.debugPlayNextBeat()).toBeNull(); // chegou ao fim
    for (const scene of ['scr.neusa_visit', 'cs.gabi_call', 'scr.gabi_visit', 'cs.inauguration', 'scr.secret_garden']) expect(scenes).toContain(scene);
  });
});
