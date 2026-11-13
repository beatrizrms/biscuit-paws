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
  it('antes da limpeza pesada do quintal, a vista é de galhos; depois, a janela limpa', () => {
    const { session } = cafe();
    session.toggleCurtain(WIN);
    expect(session.roomOvergrown('room.backyard')).toBe(true);
    expect(tileOf(session, WIN)).toBe('ph_window_branches');
    for (const d of content.map.dirt ?? []) if (d.heavy) session.state.cleaned.push(d.id);
    expect(session.roomOvergrown('room.backyard')).toBe(false);
    expect(tileOf(session, WIN)).toBe('ph_window_open');
    expect(light(session)).toBe(1);
  });

  it('fechadas, nenhuma luz no piso; abrir troca o tile e a luz entra só por aquela janela', () => {
    const { session } = cafe();
    expect(light(session)).toBe(0);
    session.toggleCurtain(WIN, 'dlg.curtain_view');
    expect(session.curtainOpen(WIN)).toBe(true);
    expect(tileOf(session, WIN)).toBe('ph_window_branches'); // o quintal ainda tem o mato pesado
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

  it('à noite, a primeira vez fala do escuro, não do sol (e conta como a fala da vista)', () => {
    const { session, events } = cafe();
    session.state.time = 19 * 60;
    const it = content.map.interactions!.find((i) => i.id === 'int.curtain_left')!.action as { curtain: string; dialogue: string; dialogueWhen: Record<string, unknown>; dialogueAlt: { when: Record<string, unknown>; dialogue: string } };
    session.toggleCurtain(it.curtain, it.dialogue, it.dialogueWhen, it.dialogueAlt);
    const said = events.filter((e) => e.name === 'dialogue.requested').map((e) => (e.payload as { dialogueId: string }).dialogueId);
    expect(said).toEqual(['dlg.curtain_view_night']);
    // De dia, depois: não fala de novo.
    session.state.time = 10 * 60;
    session.toggleCurtain(it.curtain, it.dialogue, it.dialogueWhen, it.dialogueAlt);
    session.toggleCurtain(it.curtain, it.dialogue, it.dialogueWhen, it.dialogueAlt);
    expect(events.filter((e) => e.name === 'dialogue.requested')).toHaveLength(1);
  });

  it('jardim aberto antes da primeira cortina: ela não fala dos galhos (já sabe de quem é o terreno)', () => {
    const { session, events } = cafe();
    session.state.rooms['room.backyard'] = 'abandoned';
    const it = content.map.interactions!.find((i) => i.id === 'int.curtain_left')!.action as { curtain: string; dialogue: string; dialogueWhen: Record<string, unknown> };
    session.toggleCurtain(it.curtain, it.dialogue, it.dialogueWhen);
    expect(events.some((e) => e.name === 'dialogue.requested')).toBe(false);
    expect(session.curtainOpen(it.curtain)).toBe(true);
  });

  it('o save guarda as cortinas abertas (save antigo: fechadas)', () => {
    const { session } = cafe();
    session.toggleCurtain(WIN);
    const known = knownIds(content);
    expect(parseSave(serializeSave(session.state, new Date(0)), known).state.openCurtains).toEqual([WIN]);
    const old = JSON.parse(serializeSave(session.state, new Date(0)));
    delete old.openCurtains;
    expect(parseSave(JSON.stringify(old), known).state.openCurtains).toBeUndefined();
  });
});
