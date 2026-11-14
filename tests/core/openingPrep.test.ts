// Preparativos da inauguração (data/business.json: openingPrep; passos optional de story.inauguration).
import { describe, expect, it } from 'vitest';
import { knownIds, parseSave, serializeSave } from '../../src/core/save';
import { GameSession } from '../../src/core/session';
import { newGameState } from '../../src/core/state';
import { loadContent } from './content';

const content = loadContent();
const cfg = content.business.openingPrep!;

/** Café já atendendo (primeiro cliente feito), ainda sem inaugurar. */
function cafe() {
  const state = newGameState(500, 'map.street', 10 * 60);
  state.story.completed.push('story.first_customer');
  state.business = 'soft_open';
  const session = new GameSession(content, state);
  const events: string[] = [];
  session.bus.onAny((n) => events.push(n));
  return { state, session, events };
}

describe('preparativos da inauguração', () => {
  it('a Fernanda na clínica conversa como os outros: a fala do dia, os corações e o convite', () => {
    const { session, state } = cafe();
    expect(session.neighborHasChat('npc.fernanda')).toBe(true);
    const line = session.neighborChat('npc.fernanda');
    expect(content.npcTalks.find((t) => t.npc === 'npc.fernanda')!.chat).toContain(line);
    expect(state.openingPrep?.invited).toEqual(['npc.fernanda']);
    expect(state.relationships['player|npc.fernanda'] ?? 0).toBeGreaterThan(0);
  });

  it('o Tião volta para casa pela rua no fim da tarde (com ou sem obra) e a conversa conta o convite', () => {
    const { session, state } = cafe();
    state.flags['builder.called'] = true;
    const def = content.npcWalks.find((w) => w.npc === 'npc.builder')!;
    expect(def.map).toBe('map.street');
    // Algum dia da semana ele passa (sorteio pelo dia), entre 17h e 19h.
    state.time = 17 * 60 + 30;
    let day = 0;
    for (let d = 1; d <= 30 && !day; d++) {
      state.day = d;
      if (session.neighborWalksNow('map.street').some((w) => w.npc === 'npc.builder')) day = d;
    }
    expect(day).toBeGreaterThan(0);
    state.time = 12 * 60;
    expect(session.neighborWalksNow('map.street').some((w) => w.npc === 'npc.builder')).toBe(false);
    expect(session.neighborChat('npc.builder')).toBeTruthy();
    expect(state.openingPrep?.invited).toEqual(['npc.builder']);
  });

  it('os cartazes: a loja de móveis e o ponto de ônibus (rua) e um poste da praça; colado, o cartaz aparece no lugar', () => {
    const { session, state, events } = cafe();
    const pending = () => [...session.pendingJobPoints('map.street'), ...session.pendingJobPoints('map.praca')].map((p) => p.id);
    expect(pending()).toEqual(expect.arrayContaining(cfg.posters));
    // Um por dia: o segundo no mesmo dia não vale (e o "!" some até amanhã).
    expect(session.doJobPoint(cfg.posters[0]!)).toEqual({ ok: true });
    expect(session.doJobPoint(cfg.posters[1]!).ok).toBe(false);
    expect(pending().some((id) => cfg.posters.includes(id))).toBe(false);
    for (const id of cfg.posters.slice(1)) {
      state.day += 1;
      expect(session.doJobPoint(id)).toEqual({ ok: true });
    }
    expect(state.openingPrep?.posters).toEqual(cfg.posters);
    expect(events.filter((e) => e === 'opening.poster')).toHaveLength(3);
    expect(pending().some((id) => cfg.posters.includes(id))).toBe(false);
    const drawn = [...session.mapData('map.street').objects, ...session.mapData('map.praca').objects].filter((o) => o.id.startsWith('obj.pt.opening_poster'));
    expect(drawn).toHaveLength(3);
    // Na parede, o tile e a altura de sempre; nos postes, o tile de objeto (ordenado com o poste), com a altura e o deslocamento do ponto.
    expect(drawn.find((o) => o.id === 'obj.' + cfg.posters[0])).toMatchObject({ tile: cfg.posterTile, lift: cfg.posterLift });
    expect(drawn.find((o) => o.id === 'obj.pt.opening_poster_3')).toMatchObject({ tile: 'ph_opening_poster_post', shiftX: 16 });
  });

  it('antes do primeiro cliente ou depois de inaugurar, não há cartazes nem convites', () => {
    const state = newGameState(500, 'map.street', 10 * 60);
    const session = new GameSession(content, state);
    expect(session.openingPrepActive()).toBe(false);
    expect(session.pendingJobPoints('map.street').some((p) => cfg.posters.includes(p.id))).toBe(false);
  });

  it('convidar: conversar com amigos durante os preparativos conta (cada um uma vez)', () => {
    const { session, state } = cafe();
    session.noteFriendChat('npc.gabi');
    session.noteFriendChat('npc.neusa'); // mesmo dia: um convite por dia
    expect(state.openingPrep?.invited).toEqual(['npc.gabi']);
    state.day += 1;
    session.noteFriendChat('npc.gabi');
    session.noteFriendChat('npc.neusa');
    expect(state.openingPrep?.invited).toEqual(['npc.gabi', 'npc.neusa']);
  });

  it('os passos extras não seguram a inauguração; feitos, dão reputação e mais clientes no dia', () => {
    const { session, state } = cafe();
    const beat = content.story.beats.find((b) => b.id === 'story.inauguration')!;
    expect(beat.goal!.steps.filter((s) => s.optional)).toHaveLength(4);
    expect(beat.effects?.some((e) => 'openingBonus' in e)).toBe(true);
    for (const id of cfg.posters) {
      session.doJobPoint(id);
      state.day += 1;
    }
    for (const npc of ['npc.gabi', 'npc.neusa', 'npc.joca']) {
      session.noteFriendChat(npc);
      state.day += 1;
    }
    const rep = session.reputation();
    (session as unknown as { applyEffect(e: unknown): void }).applyEffect({ openingBonus: true });
    expect(state.openingPrep?.steps).toBe(2);
    expect(session.reputation()).toBe(rep + 2 * cfg.reputationPerStep);
    expect(session.openingArrivalFactor()).toBeCloseTo(1 - 2 * cfg.arrivalFactorPerStep, 5);
    state.day += 1;
    expect(session.openingArrivalFactor()).toBe(1);
  });

  it('o save guarda os preparativos', () => {
    const { session, state } = cafe();
    session.doJobPoint(cfg.posters[0]!);
    session.noteFriendChat('npc.gabi');
    expect(parseSave(serializeSave(state, new Date(0)), knownIds(content)).state.openingPrep).toEqual(state.openingPrep);
  });
});
