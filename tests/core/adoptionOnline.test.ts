import { describe, expect, it } from 'vitest';
import { knownIds, parseSave, serializeSave } from '../../src/core/save';
import { GameSession } from '../../src/core/session';
import { newGameState } from '../../src/core/state';
import { loadContent } from './content';

const content = loadContent();
const cfg = content.adoption.online!;

/** Café com `n` gatos gerados (castrados, sem doença, junto da turma) e, se pedido, um filhote sem castrar. */
function cafe(n: number, opts: { kitten?: boolean; intactAdult?: boolean } = {}) {
  const state = newGameState(500, 'map.cafe_main');
  state.flags['prologue.done'] = true;
  const session = new GameSession(content, state);
  const add = (id: string, cond: 'healthy' | 'kitten', neutered: boolean) => {
    state.catDefs[id] = { id, variant: 'tigrado', personality: 'curious', nameSuggestions: [id], tags: ['generated', `condition:${cond}`] };
    session.shelterCat(id, cond, undefined, false, true, { neutered });
    state.cats[id]!.name = id.replace('cat.gen.', 'Gato ');
    state.cats[id]!.repro!.known = neutered ? 'neutered' : 'intact';
  };
  for (let i = 1; i <= n; i++) add(`cat.gen.${i}`, 'healthy', true);
  if (opts.kitten) add('cat.gen.kit', 'kitten', false);
  if (opts.intactAdult) add('cat.gen.intact', 'healthy', false);
  return { state, session };
}

// Passa o dia com todos alimentados (sem fome, ninguém adoece no meio do teste).
const nextDay = (session: GameSession) => {
  for (const c of Object.values(session.state.cats)) if (c.sheltered) c.fedOn = session.state.day;
  session.endDay('curfew');
};

describe('adoção on-line (decisão 291)', () => {
  it('quem pode ir: castrado, ou filhote antes da idade de castrar; adulto sem castrar e gato da história, não', () => {
    const { state, session } = cafe(1, { kitten: true, intactAdult: true });
    expect(session.adoptableCats()).toEqual(['cat.gen.1', 'cat.gen.kit']);
    expect(session.kittenNeuterInDays('cat.gen.kit')).toBeGreaterThan(0);
    expect(session.kittenNeuterInDays('cat.gen.1')).toBeNull();
    // Doente não vai.
    state.cats['cat.gen.1']!.sickness = { disease: content.health.diseases[0]!.id, since: state.day, treatment: null };
    expect(session.adoptableCats()).toEqual(['cat.gen.kit']);
  });

  it('a feira: o filhote sem castrar não trava mais (catsReady); o adulto sem castrar, sim', () => {
    const ok = cafe(2, { kitten: true });
    expect(ok.session.fairCatIds()).toContain('cat.gen.kit');
    expect(ok.session.adoptionReady('cat.gen.kit')).toBe(true);
    const blocked = cafe(2, { intactAdult: true });
    expect(blocked.session.adoptionReady('cat.gen.intact')).toBe(false);
  });

  it('com 3 gatos que podem ir: a ideia, o anúncio, o interessado, a adoção e a notícia da família', () => {
    const { state, session } = cafe(2);
    nextDay(session);
    expect(state.adoptionOnline.stage).toBe('off'); // só 2
    cafeAddOne(state, session, 'cat.gen.3');
    nextDay(session);
    expect(state.adoptionOnline.stage).toBe('idea');
    session.adoptionOnline!.ideaShown();
    expect(state.adoptionOnline.stage).toBe('on');
    const listing = session.socialFeed().find((p) => p.text.includes('Procurando um lar'));
    expect(listing?.text).toContain('Gato 1');
    expect(listing?.npc).toBe('player');
    // Um interessado chega em até visitEveryDays[1] dias.
    let visit = session.adoptionOnline!.pendingVisit();
    for (let i = 0; i < cfg.visitEveryDays[1] + 1 && !visit; i++) {
      nextDay(session);
      visit = session.adoptionOnline!.pendingVisit();
    }
    expect(visit).not.toBeNull();
    expect(visit!.cats.length).toBeGreaterThanOrEqual(1);
    const gone = session.adoptionOnline!.visitDone();
    expect(gone).toEqual(visit!.cats);
    for (const id of gone) expect(state.cats[id]!.sheltered).toBe(false);
    expect(session.socialFeed().some((p) => /adotad/.test(p.text))).toBe(true);
    // O próximo interessado fica marcado; a notícia da família chega dias depois, com o nome do gato.
    expect(state.adoptionOnline.nextVisit).toBeGreaterThan(state.day);
    for (let i = 0; i < cfg.newsAfterDays[1] + 1; i++) nextDay(session);
    const news = session.socialFeed().find((p) => p.handle.includes(session.adoptionOnline!.nameOf(gone[0]!)));
    expect(news).toBeDefined();
    expect(news!.npc).not.toBe('player');
  });

  it('o filhote vai sem castrar; o interessado desiste se o gato adoeceu', () => {
    const { state, session } = cafe(2, { kitten: true });
    nextDay(session);
    session.adoptionOnline!.ideaShown();
    state.adoptionOnline.visit = { cats: ['cat.gen.kit'], look: 0, day: state.day };
    expect(session.adoptionOnline!.visitDone()).toEqual(['cat.gen.kit']);
    expect(state.cats['cat.gen.kit']!.sheltered).toBe(false);
    // Interessado num gato que adoeceu: some na manhã seguinte e outro é marcado.
    state.adoptionOnline.visit = { cats: ['cat.gen.1'], look: 0, day: state.day };
    state.cats['cat.gen.1']!.sickness = { disease: content.health.diseases[0]!.id, since: state.day, treatment: null };
    nextDay(session);
    expect(state.adoptionOnline.visit).toBeNull();
    expect(state.adoptionOnline.nextVisit).toBeGreaterThan(state.day);
  });

  it('dois gatos adotados juntos: um post de adotados e uma notícia só da família, com os dois nomes', () => {
    const { state, session } = cafe(3);
    nextDay(session);
    session.adoptionOnline!.ideaShown();
    state.adoptionOnline.visit = { cats: ['cat.gen.1', 'cat.gen.2'], look: 2, day: state.day };
    expect(session.adoptionOnline!.visitDone()).toEqual(['cat.gen.1', 'cat.gen.2']);
    expect(state.adoptionOnline.news).toHaveLength(1);
    for (let i = 0; i < cfg.newsAfterDays[1] + 1; i++) nextDay(session);
    const news = session.socialFeed().filter((p) => p.npc !== 'player');
    expect(news).toHaveLength(1);
    expect(news[0]!.text).toContain('Gato 1 e Gato 2');
    expect(news[0]!.npc).toBe(content.service.customerLooks[2]);
  });

  it('o interessado espera outro dia em dia de evento e no dia da campanha da CED', () => {
    const { state, session } = cafe(3);
    expect(session.adoptionVisitHeld()).toBe(false);
    state.ced.campaign = { day: state.day, stage: 'capture' } as unknown as typeof state.ced.campaign;
    expect(session.adoptionVisitHeld()).toBe(true);
    state.ced.campaign = { day: state.day, stage: 'done' } as unknown as typeof state.ced.campaign;
    expect(session.adoptionVisitHeld()).toBe(false);
    state.festivals.heldOn = { day: state.day } as unknown as typeof state.festivals.heldOn;
    expect(session.adoptionVisitHeld()).toBe(true);
  });

  it('o save guarda a adoção on-line (e o save antigo começa sem a ideia)', () => {
    const { state, session } = cafe(3);
    nextDay(session);
    session.adoptionOnline!.ideaShown();
    const known = knownIds(content);
    const back = parseSave(serializeSave(state, new Date(0)), known).state;
    expect(back.adoptionOnline.stage).toBe('on');
    expect(back.adoptionOnline.posts.length).toBe(state.adoptionOnline.posts.length);
    expect(back.adoptionOnline.nextVisit).toBe(state.adoptionOnline.nextVisit);
  });
});

function cafeAddOne(state: ReturnType<typeof newGameState>, session: GameSession, id: string) {
  state.catDefs[id] = { id, variant: 'tigrado', personality: 'curious', nameSuggestions: [id], tags: ['generated', 'condition:healthy'] };
  session.shelterCat(id, 'healthy', undefined, false, true, { neutered: true });
  state.cats[id]!.name = id.replace('cat.gen.', 'Gato ');
  state.cats[id]!.repro!.known = 'neutered';
}
