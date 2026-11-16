// Lista "hoje" do balão: a troca de areia de todo dia e o brincar numa linha só (com os brinquedos de menos).
import { describe, expect, it } from 'vitest';
import { GameSession } from '../../src/core/session';
import { newGameState } from '../../src/core/state';
import { loadContent } from './content';

const content = loadContent();

function cafe() {
  const state = newGameState(500, 'map.cafe_main', 9 * 60);
  state.flags['has.cat'] = true;
  state.flags['prologue.done'] = true;
  state.day = 10;
  state.cats['cat.first_stray'] = { sheltered: true, name: 'Botinhas', map: 'map.cafe_main', shelteredOn: 1, health: 80, sickness: null };
  const session = new GameSession(content, state);
  return { session, state };
}

describe('tarefas do dia', () => {
  it('troque a areia da caixa: até ela trocar hoje (a automática não entra)', () => {
    const { session, state } = cafe();
    expect(session.chores().some((c) => c.kind === 'litter')).toBe(false);
    expect(session.buy('item.litter_box')).toEqual({ ok: true });
    expect(session.place('item.litter_box', [12, 8])).toEqual({ ok: true });
    expect(session.chores().find((c) => c.kind === 'litter')).toMatchObject({ done: false, progress: [0, 1] });
    state.placed.find((p) => p.item === 'item.litter_box')!.refilledOn = state.day;
    expect(session.chores().find((c) => c.kind === 'litter')).toMatchObject({ done: true, progress: [1, 1] });
  });

  it('brinquedos de menos não são uma linha à parte: a linha do gato que quer brincar pede mais brinquedos', () => {
    const { session, state } = cafe();
    state.inventory['item.cat_wand'] = 1;
    state.cats['cat.first_stray']!.playedOn = 1;
    const play = session.chores().find((c) => c.kind === 'care' && c.need === 'play');
    expect(play).toMatchObject({ hasTool: true, toysShort: true });
    expect(session.chores().some((c) => (c.kind as string) === 'toys')).toBe(false);
  });
});

describe('gatos em recuperação', () => {
  it('um lembrete por dia, comida e remédio juntos; cada gato conta quando comeu e tomou o de hoje', () => {
    const { session, state } = cafe();
    const cat = state.cats['cat.first_stray']!;
    cat.clinic = { stage: 'isolation', until: state.day + 3, procedure: 'proc.neuter' };
    cat.aftercare = { days: 3, dosesGiven: 0, lastDoseDay: null };
    state.inventory[content.health.medicine.item] = 3;
    const line = () => session.chores().find((c) => c.kind === 'clinic' && c.clinic === 'pen_food');
    expect(line()).toMatchObject({ done: false, progress: [0, 1] });
    // O remédio está no lembrete: sem linha à parte (ela tem o remédio).
    expect(session.chores().some((c) => c.kind === 'care' && c.need === 'medicine')).toBe(false);
    cat.fedOn = state.day;
    expect(line()).toMatchObject({ done: false, progress: [0, 1] });
    cat.aftercare.lastDoseDay = state.day;
    expect(line()).toMatchObject({ done: true, progress: [1, 1] });
    // Sem o remédio na mochila: a linha de passar na clínica aparece.
    cat.aftercare.lastDoseDay = null;
    delete state.inventory[content.health.medicine.item];
    expect(session.chores().find((c) => c.kind === 'care' && c.need === 'medicine')).toMatchObject({ hasTool: false });
    // Fora da recuperação: some.
    delete cat.clinic;
    expect(line()).toBeUndefined();
  });
});

describe('gato doente sem consulta', () => {
  it('com a clínica aberta: "leve à clínica" até a consulta (depois, o remédio)', () => {
    const { session, state } = cafe();
    const line = () => session.chores().find((c) => c.kind === 'clinic' && c.clinic === 'sick');
    state.cats['cat.first_stray']!.sickness = { disease: content.health.diseases[0]!.id, since: state.day, treatment: null };
    expect(line()).toBeUndefined(); // sem a clínica ainda
    state.flags[content.health.randomIllness.requiresFlag] = true;
    expect(line()).toMatchObject({ catId: 'cat.first_stray', done: false });
    state.cats['cat.first_stray']!.sickness!.treatment = { days: 3, dosesGiven: 0, lastDoseDay: null };
    expect(line()).toBeUndefined();
  });
});
