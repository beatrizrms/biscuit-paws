import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { cafeAdoptCats, setupMatch } from '../../src/core/adoption';
import {
  doFestivalPoint,
  festivalCanStart,
  festivalClosesCafe,
  festivalDayEnded,
  finishFestival,
  newFestivals,
  pendingFestivalPoints,
  recordActivity,
  startFestival,
  type FestivalContext,
  type FestivalDef,
} from '../../src/core/festival';
import { makeResult } from '../../src/core/minigame';
import { createRng } from '../../src/core/rng';
import { knownIds, parseSave } from '../../src/core/save';
import { GameSession } from '../../src/core/session';
import { newGameState } from '../../src/core/state';
import { loadContent } from './content';

const content = loadContent();
const fair = content.festivals.find((f) => f.id === 'fest.adoption_fair')!;
const catDay = content.festivals.find((f) => f.id === 'fest.cat_day')!;
const traits = content.adoption.fair;
const ctx = (over: Partial<FestivalContext> = {}): FestivalContext => ({ day: 10, season: 'winter', dayOfSeason: 10, reached: [], evaluate: () => true, ...over });
const result = (game: string, outcome: 'fail' | 'ok' | 'great' = 'ok') => ({ game, outcome, coins: 0, skipped: false });

describe('festivais (puro)', () => {
  it('preparação -> marcado daysAfter depois -> no dia: placa, decorações e as atividades, nessa ordem', () => {
    const s = newFestivals();
    startFestival(s, fair, { day: 3, dayOfSeason: 3 });
    const [setup, table] = fair.activities.map((a) => a.point) as [string, string];
    expect(pendingFestivalPoints(s, fair, 3)).toEqual(fair.prep!.points);
    expect(doFestivalPoint(s, fair, table, 3)).toBeNull(); // fora de hora
    fair.prep!.points.slice(0, -1).forEach((id) => expect(doFestivalPoint(s, fair, id, 3)).toBe('prep'));
    expect(doFestivalPoint(s, fair, fair.prep!.points.at(-1)!, 3)).toBe('scheduled');
    const day = 3 + fair.prep!.daysAfter;
    expect(s.active!.day).toBe(day);
    expect(pendingFestivalPoints(s, fair, 4)).toEqual([]); // ainda não é o dia
    expect(pendingFestivalPoints(s, fair, day)).toEqual([fair.closePoint!.point]);
    expect(doFestivalPoint(s, fair, fair.decorations![0]!.point, day)).toBeNull(); // placa primeiro
    expect(festivalClosesCafe(s, content.festivals, day)).toBe(false);
    expect(doFestivalPoint(s, fair, fair.closePoint!.point, day)).toBe('close');
    expect(festivalClosesCafe(s, content.festivals, day)).toBe(true);
    fair.decorations!.slice(0, -1).forEach((d) => expect(doFestivalPoint(s, fair, d.point, day)).toBe('decor'));
    expect(doFestivalPoint(s, fair, fair.decorations!.at(-1)!.point, day)).toBe('ready');
    expect(pendingFestivalPoints(s, fair, day)).toEqual([setup]); // montar a feira, depois a mesa
    expect(doFestivalPoint(s, fair, setup, day)).toBeNull(); // atividade é mini game
    expect(recordActivity(s, fair, table, result('adoption'), day)).toBeNull(); // fora de ordem
    expect(recordActivity(s, fair, setup, result('fair_setup', 'great'), day)).toBe('next');
    expect(pendingFestivalPoints(s, fair, day)).toEqual([table]);
    expect(recordActivity(s, fair, table, result('adoption', 'fail'), day)).toBe('finished'); // qualquer resultado conta
    expect(finishFestival(s)).toEqual({ id: fair.id, results: [result('fair_setup', 'great'), result('adoption', 'fail')] });
    expect(s).toEqual({ active: null, last: { [fair.id]: day }, heldOn: { id: fair.id, day } });
    expect(festivalClosesCafe(s, content.festivals, day)).toBe(true); // até o fim do dia
    expect(festivalClosesCafe(s, content.festivals, day + 1)).toBe(false);
  });

  it('várias atividades: uma de cada vez, e o evento só acaba na última', () => {
    const def: FestivalDef = { ...catDay, decorations: [], closePoint: undefined, activities: [{ point: 'a', game: 'adoption' }, { point: 'b', game: 'latte' }] };
    const s = newFestivals();
    startFestival(s, { ...def, date: undefined }, { day: 5, dayOfSeason: 5 });
    expect(pendingFestivalPoints(s, def, 5)).toEqual(['a']);
    expect(recordActivity(s, def, 'b', result('latte'), 5)).toBeNull();
    expect(recordActivity(s, def, 'a', result('adoption'), 5)).toBe('next');
    expect(pendingFestivalPoints(s, def, 5)).toEqual(['b']);
    expect(recordActivity(s, def, 'b', result('latte', 'great'), 5)).toBe('finished');
  });

  it('o dia passou sem acabar: volta ao começo; um evento por vez e o intervalo entre edições', () => {
    const s = newFestivals();
    startFestival(s, { ...fair, prep: undefined }, { day: 5, dayOfSeason: 5 });
    expect(festivalCanStart(s, catDay, ctx({ reached: ['rep.noticed'], season: 'summer', dayOfSeason: 8 }))).toBe(false); // já tem um
    expect(festivalDayEnded(s, 5)).toBeNull();
    expect(festivalDayEnded(s, 6)).toBe(fair.id);
    expect(s.active).toBeNull();
    expect(festivalCanStart(s, fair, ctx({ day: 6 }))).toBe(true);
    expect(festivalCanStart(s, fair, ctx({ day: 6, evaluate: () => false }))).toBe(false); // condição
    s.last[fair.id] = 6;
    expect(festivalCanStart(s, fair, ctx({ day: 6 + fair.cooldownDays - 1 }))).toBe(false);
    expect(festivalCanStart(s, fair, ctx({ day: 6 + fair.cooldownDays }))).toBe(true);
  });

  it('data fixa e reputação: a ideia vem noticeDays antes, marcada para o dia da data', () => {
    const s = newFestivals();
    const at = (dayOfSeason: number, reached = ['rep.noticed']) => ctx({ season: 'summer', dayOfSeason, reached });
    const { day, noticeDays } = catDay.date!;
    expect(festivalCanStart(s, catDay, at(day, []))).toBe(false); // sem a reputação
    expect(festivalCanStart(s, catDay, at(day - noticeDays! - 1))).toBe(false); // cedo demais
    expect(festivalCanStart(s, catDay, at(day + 1))).toBe(false); // já passou
    expect(festivalCanStart(s, catDay, ctx({ season: 'winter', dayOfSeason: day, reached: ['rep.noticed'] }))).toBe(false);
    expect(festivalCanStart(s, catDay, at(day - noticeDays!))).toBe(true);
    startFestival(s, catDay, { day: 100, dayOfSeason: day - noticeDays! });
    expect(s.active).toMatchObject({ stage: 'scheduled', day: 100 + noticeDays! });
  });

  it('gatos do café entram na partida (jeito pela personalidade) e o resto vem do abrigo', () => {
    const mine = cafeAdoptCats(content.adoption, [{ id: 'cat.x', name: 'Xodó', variant: 'pebble', personality: 'brave' }, { id: 'cat.y', name: 'Yuki', variant: 'misty', personality: 'outra', adoptionTraits: { coat: 'long' } }]);
    expect(mine[0]!.traits).toEqual({ ...traits.defaultTraits, personality: traits.personalityFrom.brave });
    expect(mine[1]!.traits).toEqual({ ...traits.defaultTraits, coat: 'long' });
    const m = setupMatch(createRng(3), content.adoption, 4, mine);
    expect(m.cats.slice(0, 2).map((c) => c.id)).toEqual(['cat.x', 'cat.y']);
    expect(m.cats).toHaveLength(4);
  });
});

describe('festivais na sessão', () => {
  function cafe() {
    const state = newGameState(500, 'map.street', 10 * 60);
    state.business = 'soft_open';
    state.story.completed.push(...content.story.beats.map((b) => b.id));
    const session = new GameSession(content, state);
    const events: { name: string; payload: unknown }[] = [];
    session.bus.onAny((name, payload) => events.push({ name, payload }));
    return { session, state, events };
  }
  const names = (events: { name: string }[]) => events.map((e) => e.name);

  it('feira do começo ao fim: panfletos, o dia no calendário, café fechado, decoração e o match encerra com o resumo', () => {
    const { session, state, events } = cafe();
    for (const id of ['cat.gen.a', 'cat.gen.b']) {
      state.catDefs[id] = { id, variant: 'pebble', personality: 'brave', tags: [] };
      state.cats[id] = { sheltered: true, name: id, map: 'map.cafe_main', shelteredOn: 1, health: 80, sickness: null, happiness: 70, hygiene: 70 };
    }
    session.debugStartFestival(fair.id);
    expect(names(events)).toContain('festival.started');
    expect(events.find((e) => e.name === 'dialogue.requested')?.payload).toEqual({ dialogueId: fair.idea });
    expect(session.festivalStatus()).toMatchObject({ stage: 'prep', left: fair.prep!.points.length });
    for (const id of fair.prep!.points) expect(session.doJobPoint(id)).toEqual({ ok: true });
    expect(names(events)).toContain('festival.scheduled');
    const day = state.festivals.active!.day!;
    expect(session.calendar(day, day)).toContainEqual({ id: `cal.${fair.id}`, day, title: fair.name, kind: 'event' });
    session.endDay('home');
    state.day = day;
    state.time = 10 * 60;
    expect(session.service.isOpen()).toBe(true);
    expect(session.festivalStatus()).toMatchObject({ stage: 'today', next: 'close' });
    expect(session.doJobPoint(fair.closePoint!.point)).toEqual({ ok: true });
    expect(session.service.isOpen()).toBe(false); // placa na porta: fechado hoje
    for (const d of fair.decorations!) expect(session.doJobPoint(d.point)).toEqual({ ok: true });
    const pieces = () => session.mapData().objects.filter((o) => o.id.startsWith('fest.'));
    expect(pieces()).toHaveLength(1 + fair.decorations!.length);
    const [setup, table] = fair.activities.map((a) => a.point) as [string, string];
    expect(session.pendingJobPoints('map.cafe_main').map((p) => p.id)).toEqual([setup]);
    expect(session.festivalStatus()).toMatchObject({ next: 'activity', game: 'fair_setup' });
    // Montar a feira: os gatos do café que podem ir (o da história nunca vai).
    expect(session.miniGameExtras(setup).adoptCats?.map((c) => c.id)).toEqual(['cat.gen.a', 'cat.gen.b']);
    const fairSetup = { cats: ['cat.gen.b'], visitors: 7, extraFamilies: 2 };
    session.finishMiniGame(makeResult(content.minigames, 'fair_setup', 'normal', 'great', 90, false, { fairSetup }), { difficulty: 'normal', jobPoint: setup });
    expect(state.festivals.active!.results[0]).toMatchObject({ game: 'fair_setup', setup: fairSetup });
    expect(session.pendingJobPoints('map.cafe_main').map((p) => p.id)).toEqual([table]);
    expect(session.festivalStatus()).toMatchObject({ next: 'activity', game: 'adoption' });
    // A mesa: só os gatos escolhidos e as famílias a mais (até caber: maxFamilies - pares da dificuldade).
    const pairs = Number(content.minigames.games.adoption!.difficulties[content.jobPoints[table]!.minigame!.difficulty].pairs);
    const extras = session.miniGameExtras(table);
    expect(extras.adoptCats?.map((c) => c.id)).toEqual(['cat.gen.b']);
    expect(extras.extraFamilies).toBe(Math.min(2, content.fairSetup.maxFamilies - pairs));
    const money = state.money;
    const rep = state.reputation.value;
    const adoptions = [{ catId: 'adopt.mingau', verdict: 'good' as const }];
    session.finishMiniGame(makeResult(content.minigames, 'adoption', 'normal', 'fail', 1, false, { adoptions }), { difficulty: 'normal', jobPoint: table });
    const finished = events.find((e) => e.name === 'festival.finished')!.payload as { results: unknown[]; adopted: number; reputation: number };
    expect(finished).toMatchObject({ festivalId: fair.id, adopted: 1, reputation: fair.rewards!.reputation, results: [{ game: 'fair_setup', outcome: 'great', setup: { visitors: 7 } }, { game: 'adoption', outcome: 'fail' }] });
    expect(state.festivals).toMatchObject({ active: null, last: { [fair.id]: day }, heldOn: { id: fair.id, day } });
    expect(state.money).toBe(money + (fair.rewards?.coins ?? 0));
    expect(state.reputation.value).toBeGreaterThanOrEqual(rep + (fair.rewards?.reputation ?? 0));
    // Até o fim do dia: placa e decoração e o café fechado; no dia seguinte, tudo volta.
    expect(pieces()).toHaveLength(1 + fair.decorations!.length);
    expect(session.service.isOpen()).toBe(false);
    session.endDay('home');
    state.time = 10 * 60;
    expect(pieces()).toHaveLength(0);
    expect(session.service.isOpen()).toBe(true);
  });

  it('a feira começa sozinha com 9 gatos abrigados e uma semana depois do quintal pronto (ideia dela)', () => {
    const { session, state, events } = cafe();
    for (let i = 0; i < 9; i++) state.cats[`cat.t${i}`] = { sheltered: true, name: `T${i}`, map: 'map.cafe_main', shelteredOn: 1, health: 80, sickness: null, happiness: 70, hygiene: 70 };
    state.day = 40;
    state.story.completedOn['story.backyard'] = 35; // quintal pronto há 5 dias: ainda não
    session.enter('map.cafe_main');
    expect(state.festivals.active).toBeNull();
    state.day = 42;
    session.enter('map.street');
    expect(names(events)).toContain('festival.started');
    expect(state.festivals.active).toMatchObject({ id: fair.id, stage: 'prep' });
  });

  it('Dia do Gato: com a reputação e o quintal pronto, a ideia vem dias antes e o dia fica marcado na data', () => {
    const { session, state } = cafe();
    const per = content.seasons.daysPerSeason;
    const summer = content.seasons.order.indexOf('summer');
    const { day, noticeDays } = catDay.date!;
    state.day = summer * per + day - noticeDays!;
    for (const id of content.rooms.rooms.map((r) => r.id)) state.rooms[id] = 'restored';
    session.enter('map.street');
    expect(state.festivals.active).toBeNull(); // sem a reputação ainda
    const need = content.reputation.thresholds.find((t) => t.id === 'rep.noticed')!.at;
    session.addReputation(need, 'teste');
    expect(state.festivals.active).toMatchObject({ id: catDay.id, stage: 'scheduled', day: summer * per + day });
  });

  it('a decoração e a mesa ficam no quintal; a placa, na porta do café', () => {
    const backyard = content.rooms.rooms.find((r) => r.id === 'room.backyard')!.area;
    const inYard = ([c, r]: [number, number]) => c >= backyard.from[0] && c <= backyard.to[0] && r >= backyard.from[1] && r <= backyard.to[1];
    for (const def of content.festivals) {
      for (const id of [...(def.decorations ?? []).map((d) => d.point), ...def.activities.map((a) => a.point)]) expect(inYard(content.jobPoints[id]!.at), id).toBe(true);
      if (def.closePoint) expect(inYard(content.jobPoints[def.closePoint.point]!.at)).toBe(false);
    }
  });

  it('save v22 guarda os festivais; a feira de saves antigos (v17 a v21) vira a feira de adoção', () => {
    const known = knownIds(content);
    const load = (v: number) => parseSave(readFileSync(`tests/fixtures/save_v${v}.json`, 'utf8'), known).state.festivals;
    expect(load(22)).toEqual({ active: { id: 'fest.cat_day', stage: 'scheduled', day: 6, done: ['pt.fair_sign'], results: [result('adoption')].map((r) => ({ ...r, coins: 5 })) }, last: { 'fest.adoption_fair': 1 }, heldOn: null });
    expect(load(21)).toEqual({ active: { id: fair.id, stage: 'scheduled', day: 6, done: ['pt.fair_sign'], results: [] }, last: {}, heldOn: null });
    expect(load(16)).toEqual(newFestivals());
    const old = JSON.parse(readFileSync('tests/fixtures/save_v21.json', 'utf8'));
    old.fair = { stage: 'flyers', day: null, done: ['pt.fair_flyer_1'], lastSeason: 2, heldOn: 50 };
    expect(parseSave(JSON.stringify(old), known).state.festivals).toEqual({ active: { id: fair.id, stage: 'prep', day: null, done: ['pt.fair_flyer_1'], results: [] }, last: { [fair.id]: 61 }, heldOn: { id: fair.id, day: 50 } });
    const gone = JSON.parse(readFileSync('tests/fixtures/save_v22.json', 'utf8'));
    gone.festivals.active.id = 'fest.sumiu';
    const r = parseSave(JSON.stringify(gone), known);
    expect(r.state.festivals.active).toBeNull();
    expect(r.warnings.some((w) => w.includes('fest.sumiu'))).toBe(true);
  });
});
