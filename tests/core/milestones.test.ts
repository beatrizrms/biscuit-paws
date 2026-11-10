import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { EventName } from '../../src/core/events';
import { milestoneRefs, validateMilestones, type MilestonesData } from '../../src/core/milestones';
import { knownIds, parseSave } from '../../src/core/save';
import { GameSession } from '../../src/core/session';
import { newGameState } from '../../src/core/state';
import { loadContent } from './content';

const content = loadContent();
const known = knownIds(content);

function cafe() {
  const state = newGameState(500, 'map.cafe_main', 9 * 60);
  state.flags['has.cat'] = true;
  const session = new GameSession(content, state);
  const events: { name: EventName; payload: unknown }[] = [];
  session.bus.onAny((name, payload) => events.push({ name, payload }));
  const reached = () => events.filter((e) => e.name === 'milestone.reached').map((e) => (e.payload as { milestoneId: string }).milestoneId);
  return { session, state, events, reached };
}

describe('selos: dados', () => {
  const data: MilestonesData = {
    schemaVersion: 1,
    tracks: [
      { id: 'customers', name: 'Clientes', kind: 'count', stat: 'served' },
      { id: 'care', name: 'Cuidado', kind: 'streak', stat: 'streak.cats_cared' },
    ],
    milestones: [
      { id: 'milestone.a', track: 'customers', name: 'A', at: 5, reward: { kind: 'recipe', ids: ['recipe.x'] } },
      { id: 'milestone.b', track: 'care', name: 'B', at: 3, reward: { kind: 'room', ids: ['room.y'] } },
    ],
  };
  const exists = () => true;

  it('os dados do jogo passam na validação', () => {
    const refs = milestoneRefs([content.story, content.rooms, content.festivals, content.business]);
    expect(validateMilestones(content.milestones, exists, refs)).toEqual([]);
    expect(refs).toContain('milestone.customers_40');
  });

  it('sequência só dá presente ou receita bônus, e não segura a história', () => {
    const errors = validateMilestones(data, exists, ['milestone.b', 'milestone.c']);
    expect(errors.join('\n')).toMatch(/milestone.b" é de sequência: só presentes/);
    expect(errors.join('\n')).toMatch(/"milestone.b" é de sequência e não pode segurar/);
    expect(errors.join('\n')).toMatch(/selo que não existe "milestone.c"/);
  });

  it('acusa recompensa que não existe', () => {
    expect(validateMilestones(data, (kind) => kind !== 'recipe', []).join()).toMatch(/dá recipe que não existe "recipe.x"/);
  });

  it('acha os selos citados dentro de all/any/not', () => {
    expect(milestoneRefs({ all: [{ beat: 'x' }, { not: { milestone: 'milestone.a' } }, { any: [{ milestone: 'milestone.b' }] }] })).toEqual(['milestone.a', 'milestone.b']);
  });
});

describe('selos na sessão', () => {
  it('6 clientes: o selo sai uma vez e o chá preto destranca', () => {
    const { session, state, reached } = cafe();
    expect(session.service.recipeStatus('recipe.black_tea')).toBe('locked');
    state.service.served = 6;
    session.start(false);
    expect(reached()).toEqual(['milestone.customers_6']);
    expect(state.milestones.reached['milestone.customers_6']).toBe(state.day);
    expect(session.service.recipeStatus('recipe.black_tea')).not.toBe('locked');
    session.addReputation(1, 'teste');
    expect(reached()).toEqual(['milestone.customers_6']);
  });

  it('o porão espera a inauguração: 40 clientes sem inaugurar, o selo fica bloqueado', () => {
    const { session, state, reached } = cafe();
    state.service.served = 40;
    session.start(false);
    expect(reached()).not.toContain('milestone.customers_40');
    const track = session.milestoneTracks().find((t) => t.track.id === 'customers')!;
    expect(track.next).toMatchObject({ def: { id: 'milestone.customers_40' }, value: 40, blocked: true });
    expect(track.reached.map((m) => m.id)).toEqual(['milestone.customers_6', 'milestone.customers_15', 'milestone.customers_25', 'milestone.customers_35']);
    // Depois do porão, todos os outros selos de clientes (contados pelos dados).
    expect(track.hidden).toBe(content.milestones.milestones.filter((m) => m.track === 'customers' && m.at > 40).length);
  });

  it('a reputação que cai não tira o selo', () => {
    const { session, state, reached } = cafe();
    session.addReputation(25, 'teste');
    expect(reached()).toContain('milestone.reputation_20');
    session.addReputation(-20, 'teste');
    expect(state.milestones.reached['milestone.reputation_20']).toBeDefined();
    const rep = session.milestoneTracks().find((t) => t.track.id === 'reputation')!;
    expect(rep.reached.map((m) => m.id)).toEqual(['milestone.reputation_20']);
    expect(rep.next?.value).toBe(5);
  });

  it('a árvore de gato só aparece no Market com 3 gatos já abrigados (adotado conta)', () => {
    const { session, state } = cafe();
    expect(session.itemUnlocked('item.cat_tree')).toBe(false);
    for (const id of ['cat.a', 'cat.b', 'cat.c']) state.cats[id] = { sheltered: id !== 'cat.c', name: id, map: 'map.cafe_main', shelteredOn: 1, health: 80, sickness: null };
    expect(session.itemUnlocked('item.cat_tree')).toBe(true);
    expect(session.itemUnlocked('item.cat_condo')).toBe(false);
  });

  it('sequência de 3 dias sem desistência: o vaso de flores vai para a mochila', () => {
    const { session, state, reached } = cafe();
    state.stats.streaks.no_gave_up = { current: 3, best: 3 };
    session.start(false);
    expect(reached()).toEqual(['milestone.no_gave_up_3']);
    expect(state.inventory['item.flower_vase']).toBe(1);
  });

  it('3 dias de bigodes bem cuidados: três petiscos', () => {
    const { session, state } = cafe();
    state.stats.streaks.cats_cared = { current: 0, best: 3 };
    session.start(false);
    expect(state.inventory['item.cat_treat_biscuit']).toBe(3);
  });

  it('7 dias de bigodes bem cuidados: a receita bônus do biscoito de patinha', () => {
    const { session, state } = cafe();
    expect(session.service.recipeStatus('recipe.paw_cookie')).toBe('locked');
    state.stats.streaks.cats_cared = { current: 7, best: 7 };
    session.start(false);
    expect(session.service.recipeStatus('recipe.paw_cookie')).not.toBe('locked');
  });
});

describe('selos no save', () => {
  it('save_v28 guarda os selos; selo que sumiu dos dados é esquecido', () => {
    const { state } = parseSave(readFileSync('tests/fixtures/save_v28.json', 'utf8'), known);
    expect(state.milestones).toEqual({ reached: { 'milestone.customers_6': 4, 'milestone.customers_15': 7, 'milestone.customers_25': 11 } });
  });

  it('save antigo (v27): a primeira conferida anota os selos que já valem, sem avisar nem dar presente', () => {
    const old = JSON.parse(readFileSync('tests/fixtures/save_v27.json', 'utf8'));
    old.service = { ...old.service, served: 30 };
    old.stats.streaks.no_gave_up = { current: 4, best: 4 };
    const { state } = parseSave(JSON.stringify(old), known);
    expect(state.milestones.catchUp).toBe(true);
    const session = new GameSession(content, state);
    const events: string[] = [];
    session.bus.onAny((name) => events.push(name));
    session.start(false);
    expect(Object.keys(state.milestones.reached).sort()).toEqual([
      'milestone.cats_cared_3', // o fixture tem 11 dias de bigodes bem cuidados
      'milestone.cats_cared_7',
      'milestone.customers_15',
      'milestone.customers_25',
      'milestone.customers_6',
      'milestone.no_gave_up_3',
    ]);
    expect(state.milestones.catchUp).toBeUndefined();
    expect(events).not.toContain('milestone.reached');
    expect(state.inventory['item.flower_vase']).toBeUndefined();
    expect(state.inventory['item.cat_treat_biscuit']).toBeUndefined();
  });
});
