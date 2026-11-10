import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { knownIds, parseSave } from '../../src/core/save';
import { GameSession } from '../../src/core/session';
import { newGameState } from '../../src/core/state';
import { closeDay, newStats, normalizeStats, recordDoses, recordGaveUp, recordReview, recordServed, reviewAverage, REVIEWS_KEPT, statsView, STATS_HISTORY_DAYS } from '../../src/core/stats';
import { loadContent } from './content';

const content = loadContent();
const known = knownIds(content);

const day = (n: number, extra: Partial<{ open: boolean; earned: number; cats: number; untreated: number }> = {}) => ({
  day: n,
  open: true,
  earned: 0,
  cats: 1,
  untreated: 0,
  ...extra,
});
const ctx = (d: number) => ({ day: d, servedTotal: 0, reputation: 0, catsNow: 0, catsEver: 0 });

describe('estatísticas: o dia', () => {
  it('fechar o dia guarda o registro, soma o dia aberto e zera o dia em andamento', () => {
    const s = newStats();
    recordServed(s);
    recordServed(s);
    recordGaveUp(s);
    recordDoses(s, 'item.coffee_ground', 2);
    const { record } = closeDay(s, day(3, { earned: 40 }));
    expect(record).toEqual({ day: 3, open: true, served: 2, gaveUp: 1, earned: 40, doses: { 'item.coffee_ground': 2 }, cats: 1, untreated: 0 });
    expect(s.totals).toEqual({ openDays: 1, gaveUp: 1, doses: { 'item.coffee_ground': 2 } });
    expect(s.today).toEqual({ served: 0, gaveUp: 0, doses: {}, sickAtStart: [] });
    closeDay(s, day(4, { open: false }));
    expect(s.totals.openDays).toBe(1);
  });

  it(`guarda só os últimos ${STATS_HISTORY_DAYS} dias`, () => {
    const s = newStats();
    for (let d = 1; d <= STATS_HISTORY_DAYS + 5; d++) closeDay(s, day(d));
    expect(s.days).toHaveLength(STATS_HISTORY_DAYS);
    expect(s.days[0]!.day).toBe(6);
    expect(s.totals.openDays).toBe(STATS_HISTORY_DAYS + 5);
  });
});

describe('estatísticas: sequências sem recaída', () => {
  it('ninguém sai de mãos vazias: conta o dia com cliente; um desistente zera; dia sem cliente não conta nem quebra', () => {
    const s = newStats();
    const run = (served: number, gaveUp: number) => {
      for (let i = 0; i < served; i++) recordServed(s);
      for (let i = 0; i < gaveUp; i++) recordGaveUp(s);
      return closeDay(s, day(1)).broken;
    };
    run(3, 0);
    run(2, 0);
    run(0, 0); // folga: nada muda
    expect(s.streaks.no_gave_up).toEqual({ current: 2, best: 2 });
    expect(run(4, 1)).toEqual(['no_gave_up']);
    expect(s.streaks.no_gave_up).toEqual({ current: 0, best: 2 });
    expect(run(0, 1)).toEqual([]); // já estava em zero: não "quebra" de novo
    run(1, 0);
    expect(s.streaks.no_gave_up).toEqual({ current: 1, best: 2 });
  });

  it('bigodes bem cuidados: conta o dia com gato; um doente sem remédio zera; sem gato não conta', () => {
    const s = newStats();
    closeDay(s, day(1, { cats: 2 }));
    closeDay(s, day(2, { cats: 0 }));
    closeDay(s, day(3, { cats: 2 }));
    expect(s.streaks.cats_cared).toEqual({ current: 2, best: 2 });
    expect(closeDay(s, day(4, { cats: 2, untreated: 1 })).broken).toEqual(['cats_cared']);
    expect(s.streaks.cats_cared).toEqual({ current: 0, best: 2 });
  });
});

describe('estatísticas: a visão do app', () => {
  it('médias da semana: os últimos 7 dias fechados, divididas só pelos dias abertos', () => {
    const s = newStats();
    // Dia 1 fica fora da semana vista do dia 9 (os dias 2 a 8).
    for (let d = 1; d <= 8; d++) {
      const open = d !== 4 && d !== 5;
      for (let i = 0; i < (d === 1 ? 50 : open ? 6 : 0); i++) recordServed(s);
      if (open) recordDoses(s, 'item.coffee_ground', d === 1 ? 50 : 3);
      if (d === 8) recordDoses(s, 'item.tea_black_bag', 5);
      closeDay(s, day(d, { open, earned: open ? 60 : 10 }));
    }
    recordServed(s); // hoje (dia 9) não entra na média
    const v = statsView(s, ctx(9));
    expect(v.weekOpenDays).toBe(5);
    expect(v.weekServedPerDay).toBe(6);
    expect(v.weekEarnedPerDay).toBe(60);
    expect(v.weekDosesPerDay).toEqual([
      { itemId: 'item.coffee_ground', perDay: 3 },
      { itemId: 'item.tea_black_bag', perDay: 1 },
    ]);
    expect(v.servedToday).toBe(1);
    expect(v.chart).toHaveLength(8);
  });

  it('sem nenhum dia aberto na semana, as médias ficam vazias', () => {
    const s = newStats();
    closeDay(s, day(1, { open: false }));
    const v = statsView(s, ctx(2));
    expect(v.weekServedPerDay).toBeNull();
    expect(v.weekEarnedPerDay).toBeNull();
    expect(v.weekDosesPerDay).toEqual([]);
  });

  it('a leitura do save conserta valores quebrados e esquece ingredientes que sumiram', () => {
    const s = normalizeStats(
      {
        today: { served: -3, doses: { 'item.coffee_ground': 2, 'item.gone': 1 } },
        days: [{ day: 0 }, { day: 2, open: true, served: 'x', doses: { 'item.gone': 4 } }],
        streaks: { no_gave_up: { current: 5, best: 2 } },
      },
      (id) => id !== 'item.gone',
    );
    expect(s.today).toEqual({ served: 0, gaveUp: 0, doses: { 'item.coffee_ground': 2 }, sickAtStart: [] });
    expect(s.days).toEqual([{ day: 2, open: true, served: 0, gaveUp: 0, earned: 0, doses: {}, cats: 0, untreated: 0 }]);
    expect(s.streaks.no_gave_up).toEqual({ current: 5, best: 5 });
    expect(s.streaks.cats_cared).toEqual({ current: 0, best: 0 });
    expect(normalizeStats(null, () => true)).toEqual(newStats());
  });
});

describe('estatísticas na sessão', () => {
  const CAT = 'cat.first_stray';

  function withCat() {
    const state = newGameState(500, 'map.cafe_main', 9 * 60);
    state.flags['has.cat'] = true;
    state.cats[CAT] = { sheltered: true, name: 'Botinhas', map: 'map.cafe_main', shelteredOn: 1, health: content.health.start, sickness: null };
    const session = new GameSession(content, state);
    const events: string[] = [];
    session.bus.onAny((name) => events.push(name));
    /** Dorme com o gato alimentado (com fome a saúde cai e ele pode adoecer sozinho). */
    const sleep = () => {
      state.cats[CAT]!.fedOn = state.day;
      session.endDay('home');
    };
    return { session, state, events, sleep };
  }

  it('gato que amanhece doente e fica sem remédio quebra a sequência; adoecer no meio do dia só conta amanhã', () => {
    const { session, state, events, sleep } = withCat();
    sleep();
    sleep();
    expect(state.stats.streaks.cats_cared.current).toBe(2);
    // Adoeceu no meio do dia: hoje não conta.
    session.makeSick(CAT);
    sleep();
    expect(state.stats.streaks.cats_cared.current).toBe(3);
    expect(state.stats.today.sickAtStart).toEqual([CAT]);
    // Amanheceu doente e terminou o dia sem a dose: quebrou.
    sleep();
    expect(state.stats.streaks.cats_cared).toEqual({ current: 0, best: 3 });
    expect(state.stats.days.at(-1)!.untreated).toBe(1);
    expect(events).toContain('stats.streak_broken');
  });

  it('com a receita e a dose do dia, o gato doente não quebra a sequência', () => {
    const { session, state, sleep } = withCat();
    session.makeSick(CAT);
    sleep();
    state.cats[CAT]!.sickness!.treatment = { days: 5, dosesGiven: 1, lastDoseDay: state.day };
    sleep();
    expect(state.stats.days.at(-1)!.untreated).toBe(0);
    expect(state.stats.streaks.cats_cared.current).toBe(2);
  });

  it('a visão junta o total de atendidos, a reputação e os gatos já abrigados (adotado continua contando)', () => {
    const { session, state } = withCat();
    state.service.served = 12;
    state.cats['cat.adopted_one'] = { sheltered: false, name: 'Fubá', map: 'map.cafe_main', shelteredOn: 1, health: 80, sickness: null };
    const v = session.stats();
    expect(v.servedTotal).toBe(12);
    expect(v.catsNow).toBe(1);
    expect(v.catsEver).toBe(2);
    expect(v.reputation).toBe(state.reputation.value);
  });
});

describe('nota do café (média das avaliações)', () => {
  it('começa zerada e faz a média só das últimas', () => {
    const s = newStats();
    expect(reviewAverage(s, 3)).toEqual({ average: null, count: 0 });
    for (const n of [1, 5, 4, 3]) recordReview(s, n);
    expect(reviewAverage(s, 3)).toEqual({ average: 4, count: 3 });
    expect(reviewAverage(s, 50).average).toBeCloseTo(13 / 4);
  });

  it('guarda no máximo REVIEWS_KEPT; o save descarta nota fora de 1 a 5', () => {
    const s = newStats();
    for (let i = 0; i < REVIEWS_KEPT + 10; i++) recordReview(s, 5);
    expect(s.reviews).toHaveLength(REVIEWS_KEPT);
    expect(normalizeStats({ ...s, reviews: [5, 0, 2.5, 'x', 3, 6] }, () => true).reviews).toEqual([5, 3]);
  });
});

describe('estatísticas no save', () => {
  it('save_v27 guarda o registro; ingrediente que sumiu é esquecido', () => {
    const { state } = parseSave(readFileSync('tests/fixtures/save_v27.json', 'utf8'), known);
    expect(state.stats.days.map((d) => d.day)).toEqual([9, 10, 11]);
    expect(state.stats.days[2]!.doses).toEqual({ 'item.coffee_ground': 6, 'item.paper_filter': 6 });
    expect(state.stats.streaks.cats_cared).toEqual({ current: 11, best: 11 });
    expect(state.stats.totals.openDays).toBe(5);
  });

  it('save antigo (v26) começa com as estatísticas zeradas', () => {
    const { state } = parseSave(readFileSync('tests/fixtures/save_v26.json', 'utf8'), known);
    expect(state.stats).toEqual(newStats());
  });
});
