import { describe, expect, it } from 'vitest';
import { chatOfDay } from '../../src/core/neighborWalks';
import { GameSession } from '../../src/core/session';
import { newGameState } from '../../src/core/state';
import { parseClock } from '../../src/core/time';
import { loadContent } from './content';

const content = loadContent();
const dayStart = parseClock(content.dayNight.dayStart);

/** Rua, depois do prólogo, com uma chegada em andamento (começou em startedOn, no minuto startClock). */
function withArrival(arrival: string, opts: { day?: number; startedOn?: number; startClock?: number; step?: number; metJacque?: boolean } = {}) {
  const day = opts.day ?? 10;
  const state = newGameState(500, 'map.street', 17 * 60);
  state.day = day;
  state.story.completed.push(...content.story.beats.map((b) => b.id));
  state.flags['prologue.done'] = true;
  state.flags['met.old_neighbor'] = true;
  if (opts.metJacque ?? true) state.flags['met.jacque'] = true;
  const startedOn = opts.startedOn ?? day;
  state.arrivals.active = { id: arrival, catId: 'cat.test', condition: 'healthy', startedOn, startedAt: startedOn * 1440 + (opts.startClock ?? dayStart), step: opts.step ?? 0 };
  return { session: new GameSession(content, state), state };
}

describe('gato à vista no Vila Hoje', () => {
  it('toda notinha é de uma chegada que existe e nenhuma diz onde está', () => {
    const notes = content.news.catNotes!.notes;
    expect(notes.length).toBeGreaterThan(0);
    for (const n of notes) expect(content.arrivals.arrivals.some((a) => a.id === n.arrival)).toBe(true);
    // As que um vizinho traz, a de dentro do café, a caixa e o cartaz não têm notinha.
    for (const id of ['arr.second_cat', 'arr.neusa_brings', 'arr.cat_inside', 'arr.delivery_box', 'arr.board_poster']) expect(notes.some((n) => n.arrival === id)).toBe(false);
    for (const n of notes) expect(`${n.headline} ${n.text}`).not.toMatch(/praça|banco|poste|beco|mercado|clínica|porta/i);
  });

  it('sai enquanto o gato não foi achado (primeira etapa); começou depois da manhã, só no dia seguinte', () => {
    expect(withArrival('arr.bench_cat').session.catNote()?.headline).toBe('Um ruivo muito manso');
    expect(withArrival('arr.bench_cat', { startClock: dayStart + 60 }).session.catNote()).toBeNull(); // o jornal de hoje já saiu
    expect(withArrival('arr.bench_cat', { startedOn: 9, startClock: dayStart + 60 }).session.catNote()).not.toBeNull(); // no dia seguinte
    expect(withArrival('arr.bench_cat', { step: 1 }).session.catNote()).toBeNull(); // já achou
    expect(withArrival('arr.cat_inside').session.catNote()).toBeNull(); // sem notinha
  });

  it('a bolinha some quando abre o jornal; a próxima chegada tem a sua', () => {
    const { session, state } = withArrival('arr.hurt_cat');
    expect(session.catNoteUnread()).toBe(true);
    session.markCatNoteRead();
    expect(session.catNoteUnread()).toBe(false);
    state.arrivals.active = { ...state.arrivals.active!, id: 'arr.mail_cat', startedOn: 11, startedAt: 11 * 1440 };
    state.day = 11;
    expect(session.catNoteUnread()).toBe(true);
  });

  it('na primeira notinha, a Jacque avisa no passeio no lugar da fala do dia, uma vez só', () => {
    const { session, state } = withArrival('arr.cat_leads');
    const tip = content.news.catNotes!.firstTip.find((t) => t.npc === 'npc.jacque')!.text;
    expect(session.neighborChat('npc.neusa')).not.toBe(tip); // não é a vez da Dona Neusa
    expect(session.neighborChat('npc.jacque')).toBe(tip);
    expect(state.flags['catnote.tipped']).toBe(true);
    const jacque = content.npcWalks.find((w) => w.npc === 'npc.jacque')!;
    expect(session.neighborChat('npc.jacque')).toBe(chatOfDay(jacque, state.day)); // de novo: a fala de sempre
  });

  it('sem conhecer a Jacque, quem avisa é a Dona Neusa; sem notinha, ninguém avisa', () => {
    const { session } = withArrival('arr.cat_leads', { metJacque: false });
    const neusaTip = content.news.catNotes!.firstTip.find((t) => t.npc === 'npc.neusa')!.text;
    expect(session.neighborChat('npc.neusa')).toBe(neusaTip);
    const none = withArrival('arr.cat_inside');
    expect(none.session.neighborChat('npc.jacque')).not.toBe(content.news.catNotes!.firstTip[0]!.text);
    expect(none.state.flags['catnote.tipped']).toBeUndefined();
  });
});
