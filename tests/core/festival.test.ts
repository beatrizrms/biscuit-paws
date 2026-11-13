import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { cafeAdoptCats, setupMatch } from '../../src/core/adoption';
import {
  doFestivalPoint,
  festivalCanStart,
  festivalCloseDeadline,
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
import { resolveMap } from '../../src/core/map';
import { evaluate } from '../../src/core/story';
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
    expect(s).toEqual({ active: null, last: { [fair.id]: day }, heldOn: { id: fair.id, day }, held: { [fair.id]: 1 } });
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

  it('a placa tem prazo (closePoint.by): lembrete remind minutos antes; passou sem ela, o evento é perdido', () => {
    const s = newFestivals();
    startFestival(s, catDay, { day: 10, dayOfSeason: 8 }); // sem preparação: marcado para hoje
    const by = 12 * 60;
    expect(catDay.closePoint).toMatchObject({ by: '12:00', remind: 60 });
    expect(festivalCloseDeadline(s, catDay, 10, by - 61)).toBeNull();
    expect(festivalCloseDeadline(s, catDay, 10, by - 60)).toBe('soon');
    expect(festivalCloseDeadline(s, catDay, 9, by)).toBeNull(); // não é o dia
    expect(s.active).not.toBeNull();
    expect(festivalCloseDeadline(s, catDay, 10, by)).toBe('missed');
    expect(s.active).toBeNull(); // volta ao começo
    // Com a placa na porta a tempo, o prazo não importa mais.
    const t = newFestivals();
    startFestival(t, catDay, { day: 10, dayOfSeason: 8 });
    expect(doFestivalPoint(t, catDay, catDay.closePoint!.point, 10)).toBe('close');
    expect(festivalCloseDeadline(t, catDay, 10, by + 300)).toBeNull();
    expect(t.active).not.toBeNull();
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
    const mine = cafeAdoptCats(content.adoption, [{ id: 'cat.x', name: 'Xodó', variant: 'lynx_point', personality: 'brave' }, { id: 'cat.y', name: 'Yuki', variant: 'cinza', personality: 'outra', adoptionTraits: { coat: 'long' } }]);
    expect(mine[0]!.traits).toEqual({ ...traits.defaultTraits, personality: traits.personalityFrom.brave });
    expect(mine[1]!.traits).toEqual({ ...traits.defaultTraits, coat: 'long' });
    const m = setupMatch(createRng(3), content.adoption, 4, mine);
    expect(m.cats.slice(0, 2).map((c) => c.id)).toEqual(['cat.x', 'cat.y']);
    expect(m.cats).toHaveLength(4);
  });

  it('na feira (só os do café), o match tem só os gatos do café e as famílias acompanham', () => {
    const mine = cafeAdoptCats(content.adoption, [{ id: 'cat.x', name: 'Xodó', variant: 'lynx_point', personality: 'brave' }, { id: 'cat.y', name: 'Yuki', variant: 'cinza', personality: 'sweet' }]);
    const m = setupMatch(createRng(3), content.adoption, 4, mine, 1, true);
    expect(m.cats.map((c) => c.id)).toEqual(['cat.x', 'cat.y']);
    expect(m.families).toHaveLength(3);
  });
});

describe('feira de adoção e as datas fixas', () => {
  it('a feira (5 dias de preparo) não fica marcada para o Natal, o Ano Novo, o Halloween nem o sorteio; depois da data, começa', () => {
    const fair = content.festivals.find((f) => f.id === 'fest.adoption_fair')!;
    const seasons = content.seasons;
    const fx = content.festive;
    const fixedDates = [
      { season: fx.secretSanta.season, day: fx.secretSanta.drawDay },
      { season: fx.secretSanta.season, day: fx.secretSanta.day },
      { season: fx.newYear.season, day: fx.newYear.day },
      { season: fx.halloween.season, day: fx.halloween.inviteDay },
      { season: fx.halloween.season, day: fx.halloween.day },
    ];
    const canStart = (season: string, dayOfSeason: number) => {
      const year = seasons.order.length * seasons.daysPerSeason;
      const now = seasons.order.indexOf(season) * seasons.daysPerSeason + dayOfSeason;
      const daysUntil = (s: string, d: number) => (((seasons.order.indexOf(s) * seasons.daysPerSeason + d - now) % year) + year) % year;
      const ctx: FestivalContext = { day: 100, season, dayOfSeason, reached: ['rep.noticed'], evaluate: () => true, others: content.festivals, daysUntil, fixedDates };
      return festivalCanStart(newFestivals(), fair, ctx);
    };
    const prep = fair.prep!.daysAfter;
    for (const d of fixedDates) expect(canStart(d.season, d.day - prep), `${d.season} ${d.day}`).toBe(false);
    // Primavera 10: nenhuma data perto, começa.
    expect(canStart('spring', 10)).toBe(true);
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

  it('no dia, o relógio passa do prazo sem a placa: lembrete uma vez, depois o evento é perdido e não recomeça no mesmo dia', () => {
    const { session, state, events } = cafe();
    session.debugStartFestival(catDay.id);
    const day = state.festivals.active!.day!;
    state.day = day;
    state.time = 10 * 60 + 30;
    session.tickClock(31 / session.content.dayNight.minutesPerSecond); // 11:01
    expect(events.filter((e) => e.name === 'festival.closeSoon')).toEqual([{ name: 'festival.closeSoon', payload: { festivalId: catDay.id, by: '12:00' } }]);
    session.tickClock(30 / session.content.dayNight.minutesPerSecond); // 11:31: o lembrete não repete
    expect(events.filter((e) => e.name === 'festival.closeSoon')).toHaveLength(1);
    session.tickClock(30 / session.content.dayNight.minutesPerSecond); // 12:01
    expect(events.find((e) => e.name === 'festival.missed')?.payload).toEqual({ festivalId: catDay.id, day, late: true });
    expect(state.festivals.active).toBeNull();
    expect(session.doJobPoint(catDay.closePoint!.point)).not.toEqual({ ok: true }); // tarde demais para a placa
    expect(session.service.isOpen()).toBe(true);
  });

  it('feira do começo ao fim: panfletos, o dia no calendário, café fechado, decoração e o match encerra com o resumo', () => {
    const { session, state, events } = cafe();
    for (const id of ['cat.gen.a', 'cat.gen.b']) {
      state.catDefs[id] = { id, variant: 'lynx_point', personality: 'brave', tags: [] };
      // Castrados (a feira só leva gato castrado).
      state.cats[id] = { sheltered: true, name: id, map: 'map.cafe_main', shelteredOn: 1, health: 80, sickness: null, happiness: 70, hygiene: 70, repro: { status: 'neutered', known: 'neutered', sex: 'female', birthDay: -400, weightFactor: 1, earTipped: false, origin: 'shelter' } };
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
    // (o atalho do debug completou os 9 gatos, já castrados: a feira pede todos castrados e saudáveis)
    expect(session.miniGameExtras(setup).adoptCats?.map((c) => c.id).slice(0, 2)).toEqual(['cat.gen.a', 'cat.gen.b']);
    // Sem castração (ou sem saber que é castrado), não vai para a feira.
    state.cats['cat.gen.a']!.repro = { ...state.cats['cat.gen.a']!.repro!, status: 'neutered', known: 'unknown' };
    expect(session.miniGameExtras(setup).adoptCats?.map((c) => c.id)).not.toContain('cat.gen.a');
    state.cats['cat.gen.a']!.repro = { ...state.cats['cat.gen.a']!.repro!, known: 'neutered' };
    // Nenhum castrado: a montagem avisa em vez de abrir (não vem gato de fora: o abrigo é o café).
    const all = Object.keys(state.cats).filter((id) => state.cats[id]!.repro);
    const keep = Object.fromEntries(all.map((id) => [id, state.cats[id]!.repro!]));
    for (const id of all) state.cats[id]!.repro = { ...keep[id]!, known: 'unknown' };
    expect(session.jobPointProblem(setup)).toBe('no_fair_cats');
    for (const id of all) state.cats[id]!.repro = keep[id]!;
    expect(session.jobPointProblem(setup)).toBeNull();
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
    // O gato do café que deu match vai com a família: sai dos abrigados.
    const adoptions = [{ catId: 'cat.gen.b', verdict: 'good' as const }];
    session.finishMiniGame(makeResult(content.minigames, 'adoption', 'normal', 'fail', 1, false, { adoptions }), { difficulty: 'normal', jobPoint: table });
    expect(state.cats['cat.gen.b']!.sheltered).toBe(false);
    expect(session.shelteredCats()).not.toContain('cat.gen.b');
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
    const repro = { status: 'neutered', known: 'neutered', sex: 'female', birthDay: -400, weightFactor: 1, earTipped: false, origin: 'shelter' } as const;
    for (let i = 0; i < 9; i++) state.cats[`cat.t${i}`] = { sheltered: true, name: `T${i}`, map: 'map.cafe_main', shelteredOn: 1, health: 80, sickness: null, happiness: 70, hygiene: 70, repro: { ...repro } };
    state.day = 50; // primavera 20: longe do piquenique (15)
    state.story.completedOn['story.backyard'] = 45; // quintal pronto há 5 dias: ainda não
    state.rooms['room.backyard'] = 'restored';
    session.enter('map.cafe_main');
    expect(state.festivals.active).toBeNull();
    state.day = 52;
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
    session.addReputation(need, 'teste'); // sem feira de adoção no Dia do Gato: não precisa de gato para adotar
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

describe('decorações do festival no mapa', () => {
  it('ponto de decoração ocupado por um móvel dela: a decoração vai para a célula livre do lado (o mapa não quebra)', () => {
    const state = newGameState(500, 'map.cafe_main');
    const session = new GameSession(content, state);
    session.debugStartFestival('fest.adoption_fair');
    const def = content.festivals.find((f) => f.id === 'fest.adoption_fair')!;
    const decor = def.decorations![1]!;
    const at = content.jobPoints[decor.point]!.at;
    state.festivals.active = { id: def.id, stage: 'scheduled', day: state.day, done: [decor.point], results: [] };
    // Um vaso dela bem em cima do ponto da decoração.
    const pot = Object.values(content.items).find((i) => i.tags.includes('furniture') && content.catalog.tiles[i.tile ?? '']?.w === 1 && content.catalog.tiles[i.tile ?? '']?.h === 1 && content.catalog.tiles[i.tile ?? '']?.layer === 'object')!;
    state.placed.push({ uid: 'p.x', item: pot.id, at: [...at] as [number, number] });
    const map = session.mapData('map.cafe_main');
    expect(() => resolveMap(map, content.catalog)).not.toThrow();
    const placedDecor = map.objects.find((o) => o.id === `fest.${decor.point}`);
    expect(placedDecor).toBeDefined();
    expect(placedDecor!.at).not.toEqual(at);
  });
});

describe('feira de adoção: só com todos os gatos castrados e saudáveis', () => {
  it('um gato sem castrar (ou doente) segura a feira; todos prontos, ela pode começar', () => {
    const state = newGameState(500, 'map.cafe_main');
    const session = new GameSession(content, state);
    const def = content.festivals.find((f) => f.id === 'fest.adoption_fair')!;
    session.debugSatisfy(def.when as never);
    const ready = () => evaluate(def.when as never, state, (session as unknown as { storyContext(): never }).storyContext());
    expect(ready()).toBe(true);
    const id = session.shelteredCats()[0]!;
    state.cats[id]!.repro = { ...state.cats[id]!.repro!, status: 'intact', known: 'intact' };
    expect(ready()).toBe(false);
    state.cats[id]!.repro = { ...state.cats[id]!.repro!, status: 'neutered', known: 'neutered' };
    state.cats[id]!.sickness = { disease: content.health.diseases[0]!.id, since: state.day, treatment: null };
    expect(ready()).toBe(false);
  });
});

describe('ponto com marcador em cima de um móvel dela', () => {
  it('Dia do Gato com uma poltrona no lugar do palco: o palco (e o ponto do E) vai para o lado, e o mapa não quebra', () => {
    const state = newGameState(500, 'map.cafe_main');
    const session = new GameSession(content, state);
    const def = content.festivals.find((f) => f.id === 'fest.cat_day')!;
    const stage = def.activities.find((a) => content.jobPoints[a.point]?.marker)!.point;
    const at = content.jobPoints[stage]!.at;
    session.debugStartFestival(def.id);
    state.festivals.active = { id: def.id, stage: 'scheduled', day: state.day, done: [def.closePoint!.point, ...(def.decorations ?? []).map((d) => d.point)], results: [] };
    const chair = Object.values(content.items).find((i) => i.tags.includes('furniture') && content.catalog.tiles[i.tile ?? '']?.w === 1 && content.catalog.tiles[i.tile ?? '']?.h === 1 && content.catalog.tiles[i.tile ?? '']?.layer === 'object')!;
    state.placed.push({ uid: 'p.x', item: chair.id, at: [...at] as [number, number] });
    const pending = session.pendingJobPoints('map.cafe_main');
    const moved = pending.find((p) => p.id === stage);
    expect(moved).toBeDefined();
    expect(moved!.at).not.toEqual(at);
    expect(() => resolveMap(session.mapData('map.cafe_main'), content.catalog)).not.toThrow();
    expect(session.mapData('map.cafe_main').objects.find((o) => o.id === `marker.${stage}`)!.at).toEqual(moved!.at);
  });
});
