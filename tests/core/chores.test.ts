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
    state.flags['litter.refilled'] = true; // não é a primeira caixa do jogo (essa vem com a areia do dia)
    expect(session.buy('item.litter_box')).toEqual({ ok: true });
    expect(session.place('item.litter_box', [12, 8])).toEqual({ ok: true });
    expect(session.chores().find((c) => c.kind === 'litter')).toMatchObject({ done: false, progress: [0, 1] });
    state.placed.find((p) => p.item === 'item.litter_box')!.refilledOn = state.day;
    expect(session.chores().find((c) => c.kind === 'litter')).toMatchObject({ done: true, progress: [1, 1] });
  });

  it('pote e caixa automáticos abastecidos: ração e areia do dia já feitas, com os dias guardados; vazios, voltam a pedir', () => {
    const { session, state } = cafe();
    state.placed.push({ uid: 'af', item: 'item.auto_feeder', at: [3, 8], stock: 7 }, { uid: 'al', item: 'item.auto_litter_box', at: [5, 8], stock: 1 });
    const feed = () => session.chores().find((c) => c.kind === 'feed');
    const litter = () => session.chores().find((c) => c.kind === 'litter');
    expect(feed()).toMatchObject({ done: true, auto: 7 });
    expect(litter()).toMatchObject({ done: true, auto: 1 });
    state.placed.find((p) => p.uid === 'af')!.stock = 0;
    expect(feed()).toMatchObject({ done: false, progress: [0, 1] });
    expect(feed()!.auto).toBeUndefined();
  });

  it('a varinha guardada na caixa pet conta: a linha só pede para brincar (sem "compre uma varinha")', () => {
    const { session, state } = cafe();
    state.cats['cat.first_stray']!.playedOn = 1;
    const play = () => session.chores().find((c) => c.kind === 'care' && c.need === 'play');
    expect(play()).toMatchObject({ hasTool: false });
    state.petBoxes = { box1: { 'item.cat_wand': 1 } };
    expect(play()).toMatchObject({ hasTool: true });
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

  it('isolado só esperando a consulta de entrada: a linha pede só a comida (não é recuperação)', () => {
    const { session, state } = cafe();
    const cat = state.cats['cat.first_stray']!;
    cat.clinic = { stage: 'intake' };
    const pen = () => session.chores().find((c) => c.kind === 'clinic' && (c.clinic === 'pen_food' || c.clinic === 'pen_wait'));
    expect(pen()).toMatchObject({ clinic: 'pen_wait', done: false, progress: [0, 1] });
    cat.fedOn = state.day;
    expect(pen()).toMatchObject({ clinic: 'pen_wait', done: true, progress: [1, 1] });
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

describe('começo mais leve', () => {
  it('a primeira caixa de areia do jogo vem com a areia do dia; a segunda, vazia', () => {
    const { session, state } = cafe();
    expect(session.buy('item.litter_box')).toEqual({ ok: true });
    expect(session.place('item.litter_box', [12, 8])).toEqual({ ok: true });
    expect(state.placed.find((p) => p.item === 'item.litter_box')!.refilledOn).toBe(state.day);
    expect(session.chores().find((c) => c.kind === 'litter')).toMatchObject({ done: true });
    expect(session.buy('item.litter_box')).toEqual({ ok: true });
    expect(session.place('item.litter_box', [10, 8])).toEqual({ ok: true });
    expect(state.placed.filter((p) => p.item === 'item.litter_box')[1]!.refilledOn).toBeUndefined();
  });

  it('pedidos da vila: os de todo dia saem pelo sorteio do dia (offersPerDay), a mesma lista o dia inteiro e outra no dia seguinte', () => {
    const offers = loadContent({ jobOffers: true });
    const state = newGameState(500, 'map.cafe_main', 9 * 60);
    state.flags['has.cat'] = true;
    state.flags['prologue.done'] = true;
    state.day = 2;
    state.story.completed.push('story.prologue_end');
    const session = new GameSession(offers, state);
    const daily = () => session.availableJobs().filter((j) => j.repeat === 'daily');
    const today = daily().map((j) => j.id);
    expect(today).toHaveLength(offers.jobOffersPerDay!);
    // Quem tem um pedido só (a Loja de Móveis) entra sempre: no máximo 2 da mesma pessoa antes de completar com o resto.
    expect(daily().some((j) => j.giver !== 'Seu Ademir, do mercado')).toBe(true);
    expect(daily().map((j) => j.id)).toEqual(today);
    // Fora do sorteio do dia, não dá para aceitar.
    const out = Object.values(offers.jobs).find((j) => j.repeat === 'daily' && !today.includes(j.id))!;
    expect(session.acceptJob(out.id)).toEqual({ ok: false, reason: 'job_unavailable' });
    const lists = new Set<string>();
    for (let d = 2; d < 12; d++) {
      state.day = d;
      lists.add(daily().map((j) => j.id).sort().join());
    }
    expect(lists.size).toBeGreaterThan(3);
  });
});

describe('o que ainda não existe para ela não vira tarefa nem aviso', () => {
  // O começo do jogo: o primeiro gato já entrou, mas a história ainda não abriu a caixa de areia nem a varinha no Market.
  const staged = loadContent({ marketStages: true });
  function early() {
    const state = newGameState(500, 'map.cafe_main', 9 * 60);
    state.flags['has.cat'] = true;
    state.flags['prologue.done'] = true;
    state.day = 2;
    state.cats['cat.first_stray'] = { sheltered: true, name: 'Botinhas', map: 'map.cafe_main', shelteredOn: 1, health: 80, sickness: null };
    const session = new GameSession(staged, state);
    return { session, state };
  }

  it('varinha ainda fora do Market: sem a linha "compre uma varinha"; à venda, a linha aparece', () => {
    const { session, state } = early();
    state.cats['cat.first_stray']!.playedOn = -10;
    expect(session.itemUnlocked('item.cat_wand')).toBe(false);
    expect(session.chores().some((c) => c.kind === 'care' && c.need === 'play')).toBe(false);
    state.story.completed.push('story.warm_corner');
    expect(session.itemUnlocked('item.cat_wand')).toBe(true);
    expect(session.chores().find((c) => c.kind === 'care' && c.need === 'play')).toMatchObject({ hasTool: false });
  });

  it('fim do dia sem areia: o aviso só sai quando a caixa de areia já está à venda (ou no café)', () => {
    const { session, state } = early();
    const missed: number[] = [];
    session.bus.on('litter.missed', ({ day }) => missed.push(day));
    expect(session.itemUnlocked('item.litter_box')).toBe(false);
    session.endDay();
    expect(missed).toEqual([]);
    state.story.completed.push('story.litter_surprise');
    session.endDay();
    expect(missed).toHaveLength(1);
  });
});
