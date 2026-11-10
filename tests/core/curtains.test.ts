import { describe, expect, it } from 'vitest';
import { ambienceOf } from '../../src/core/ambience';
import { knownIds, parseSave, serializeSave } from '../../src/core/save';
import { GameSession } from '../../src/core/session';
import { newGameState } from '../../src/core/state';
import { loadContent } from './content';

const content = loadContent();
const WIN = 'obj.window_left';

function cafe() {
  const session = new GameSession(content, newGameState(100, 'map.cafe_main', 9 * 60));
  const events: { name: string; payload: unknown }[] = [];
  session.bus.onAny((name, payload) => events.push({ name, payload }));
  return { session, events };
}
const light = (s: GameSession) => ambienceOf(s.mapData(), content.catalog, content.dayNight.ambience, true).windows.length;
const tileOf = (s: GameSession, id: string) => s.mapData().objects.find((o) => o.id === id)?.tile;

describe('cortinas do café', () => {
  it('fechadas, nenhuma luz no piso; abrir troca o tile e a luz entra só por aquela janela', () => {
    const { session } = cafe();
    expect(light(session)).toBe(0);
    session.toggleCurtain(WIN, 'dlg.curtain_view');
    expect(session.curtainOpen(WIN)).toBe(true);
    expect(tileOf(session, WIN)).toBe('ph_window_open');
    expect(light(session)).toBe(1);
    session.toggleCurtain(WIN);
    expect(tileOf(session, WIN)).toBe('window');
    expect(light(session)).toBe(0);
  });

  it('a fala da vista sai só na primeira vez que alguma cortina abre no jogo', () => {
    const { session, events } = cafe();
    const said = () => events.filter((e) => e.name === 'dialogue.requested').length;
    session.toggleCurtain(WIN, 'dlg.curtain_view');
    expect(said()).toBe(1);
    session.toggleCurtain(WIN, 'dlg.curtain_view'); // fecha
    session.toggleCurtain(WIN, 'dlg.curtain_view'); // abre de novo
    session.toggleCurtain('obj.window_right', 'dlg.curtain_view');
    expect(said()).toBe(1);
  });

  it('a dica "E" da cortina aparece uma vez só; o save guarda as abertas (save antigo: fechadas)', () => {
    const { session } = cafe();
    expect(session.hintWanted('int_curtain')).toBe(true);
    session.noteHintUse('int_curtain');
    expect(session.hintWanted('int_curtain')).toBe(false);
    session.toggleCurtain(WIN);
    const known = knownIds(content);
    expect(parseSave(serializeSave(session.state, new Date(0)), known).state.openCurtains).toEqual([WIN]);
    const old = JSON.parse(serializeSave(session.state, new Date(0)));
    delete old.openCurtains;
    expect(parseSave(JSON.stringify(old), known).state.openCurtains).toBeUndefined();
  });
});
