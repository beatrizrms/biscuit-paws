// A feira de adoção se repete pelos panfletos do Market (data/festivals.json: repeatItem): a primeira vem sozinha pelas
// condições; ao terminar, o selo "Feira de adoção" libera os panfletos; quando eles chegam, começa a distribuição
// (o dia da feira já marcado), sem a fala da ideia e sem o intervalo entre edições.
import { describe, expect, it } from 'vitest';
import { finishFestival } from '../../src/core/festival';
import { knownIds, parseSave, serializeSave } from '../../src/core/save';
import { GameSession } from '../../src/core/session';
import { newGameState } from '../../src/core/state';
import { loadContent } from './content';

const content = loadContent();
const fair = content.festivals.find((f) => f.id === 'fest.adoption_fair')!;

function game() {
  const state = newGameState(500, 'map.cafe_main', 10 * 60);
  state.day = 40;
  state.business = 'soft_open';
  state.story.completed.push(...content.story.beats.map((b) => b.id));
  for (const r of content.rooms.rooms) state.rooms[r.id] = 'restored';
  const session = new GameSession(content, state);
  const events: { name: string; payload: unknown }[] = [];
  session.bus.onAny((name, payload) => events.push({ name, payload }));
  return { session, state, events };
}

describe('feira de adoção pelos panfletos', () => {
  it('a primeira vem sozinha; depois dela, o selo libera os panfletos e a feira só volta por eles', () => {
    const { session, state, events } = game();
    const buyProblem = (id: string) => (session as unknown as { buyProblem(id: string): string | null }).buyProblem(id);
    expect(fair.repeatItem).toBe('item.fair_flyers');
    expect(buyProblem('item.fair_flyers')).not.toBeNull(); // antes da primeira feira: trancado
    // A primeira feira acontece (até o fim).
    session.debugStartFestival(fair.id);
    finishFestival(state.festivals);
    expect(state.festivals.held?.[fair.id]).toBe(1);
    session.enter('map.cafe_main'); // a conferida dos selos
    expect(buyProblem('item.fair_flyers')).toBeNull(); // o selo liberou
    // Passado o intervalo, sem os panfletos: não volta sozinha.
    state.day += fair.cooldownDays + 5;
    session.enter('map.cafe_main');
    expect(state.festivals.active).toBeNull();
    // Os panfletos chegam (na mochila): começa a distribuição, com o dia marcado, sem a fala da ideia.
    const ideas = events.filter((e) => e.name === 'dialogue.requested' && (e.payload as { dialogueId: string }).dialogueId === fair.idea).length;
    state.inventory['item.fair_flyers'] = 1;
    session.enter('map.cafe_main');
    expect(state.festivals.active).toMatchObject({ id: fair.id, stage: 'prep', day: state.day + fair.prep!.daysAfter });
    expect(state.inventory['item.fair_flyers'] ?? 0).toBe(0);
    expect(events.filter((e) => e.name === 'dialogue.requested' && (e.payload as { dialogueId: string }).dialogueId === fair.idea).length).toBe(ideas);
    expect(events.some((e) => e.name === 'festival.started' && (e.payload as { fromItem?: boolean }).fromItem)).toBe(true);
  });

  it('pelos panfletos, não precisa esperar o intervalo entre edições', () => {
    const { session, state } = game();
    session.debugStartFestival(fair.id);
    finishFestival(state.festivals); // acabou hoje
    state.day += 2;
    state.inventory['item.fair_flyers'] = 1;
    session.enter('map.cafe_main');
    expect(state.festivals.active?.id).toBe(fair.id);
  });

  it('o save guarda o dia marcado na etapa dos panfletos e quantas feiras já aconteceram', () => {
    const { session, state } = game();
    session.debugStartFestival(fair.id);
    finishFestival(state.festivals);
    state.inventory['item.fair_flyers'] = 1;
    session.enter('map.cafe_main');
    const day = state.festivals.active!.day;
    const loaded = parseSave(serializeSave(state, new Date(0)), knownIds(content));
    if (!('state' in loaded)) throw new Error('save não carregou');
    expect(loaded.state.festivals.active).toMatchObject({ stage: 'prep', day });
    expect(loaded.state.festivals.held).toEqual({ [fair.id]: 1 });
  });
});
