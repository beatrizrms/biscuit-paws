import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { arrivalsToQueue, canHappen, newArrivals, nextGap, triggerHolds, type ArrivalDef, type TriggerContext } from '../../src/core/arrivals';
import { weatherOf } from '../../src/core/calendar';
import { generateCat } from '../../src/core/catGen';
import { createRng } from '../../src/core/rng';
import { knownIds, parseSave, serializeSave } from '../../src/core/save';
import { GameSession } from '../../src/core/session';
import { newGameState } from '../../src/core/state';
import { loadContent } from './content';

const content = loadContent();
const profiles = content.catProfiles;

const ctx = (over: Partial<TriggerContext> = {}): TriggerContext => ({ day: 10, time: 8 * 60, season: 'winter', weather: 'snow', cats: 2, reputation: 0, evaluate: () => true, ...over });
const arrival = (over: Partial<ArrivalDef> = {}): ArrivalDef => ({
  id: 'arr.test',
  model: 'na_porta',
  kind: 'scripted',
  trigger: {},
  place: { kind: 'cafe_door' },
  clue: 'meow',
  cat: { generate: {} },
  steps: [],
  whenFull: 'provisional',
  ...over,
});

describe('chegadas (puro)', () => {
  it('gatilho: dias, horas, estação, clima, gatos, reputação e condição da história', () => {
    expect(triggerHolds({ days: [5, 12], hours: ['06:00', '09:00'], seasons: ['winter'], weather: ['snow'], cats: { gte: 1, lte: 3 }, reputation: { gte: 0 } }, ctx())).toBe(true);
    expect(triggerHolds({ days: [11] }, ctx())).toBe(false);
    expect(triggerHolds({ hours: ['09:00', '12:00'] }, ctx())).toBe(false);
    expect(triggerHolds({ weather: ['rain'] }, ctx())).toBe(false);
    expect(triggerHolds({ cats: { lte: 1 } }, ctx())).toBe(false);
    expect(triggerHolds({ reputation: { gte: 20 } }, ctx())).toBe(false);
    expect(triggerHolds({ when: { flag: 'x' } }, ctx({ evaluate: () => false }))).toBe(false);
  });

  it('repetição: uma vez, ou depois do intervalo mínimo', () => {
    const s = newArrivals();
    const once = arrival();
    const again = arrival({ id: 'arr.again', repeatable: true, minGapDays: 5 });
    expect(canHappen(once, s, 10)).toBe(true);
    s.last['arr.test'] = 3;
    s.last['arr.again'] = 3;
    expect(canHappen(once, s, 30)).toBe(false);
    expect(canHappen(again, s, 7)).toBe(false);
    expect(canHappen(again, s, 8)).toBe(true);
  });

  it('ritmo: mais seguidas nas primeiras semanas, depois mais espaçadas', () => {
    const early = Array.from({ length: 50 }, (_, i) => nextGap(content.arrivals, 5, createRng(i)));
    const late = Array.from({ length: 50 }, (_, i) => nextGap(content.arrivals, 60, createRng(i)));
    const [p0, p1] = content.arrivals.pacing.phases;
    expect(early.every((g) => g >= p0!.everyDays[0] && g <= p0!.everyDays[1])).toBe(true);
    expect(late.every((g) => g >= p1!.everyDays[0] && g <= p1!.everyDays[1])).toBe(true);
  });

  it('fila: as escritas à mão quando o gatilho vale; a sorteada só com o sorteio ligado e no dia', () => {
    const data = { ...content.arrivals, arrivals: [arrival({ id: 'arr.hand' }), arrival({ id: 'arr.rand', kind: 'random' })] };
    const s = newArrivals();
    expect(arrivalsToQueue(data, s, ctx(), createRng(1), false)).toEqual(['arr.hand']);
    s.nextOn = 11;
    expect(arrivalsToQueue(data, s, ctx(), createRng(1), true)).toEqual(['arr.hand']); // ainda não é o dia
    s.nextOn = 10;
    expect(arrivalsToQueue(data, s, ctx(), createRng(1), true)).toEqual(['arr.hand', 'arr.rand']);
  });

  it('clima: repetível pelo dia e só o que a estação tem (sem neve no verão)', () => {
    const s = content.seasons;
    expect(weatherOf(s, 7)).toBe(weatherOf(s, 7));
    const winter = new Set(Array.from({ length: 30 }, (_, i) => weatherOf(s, i + 1)));
    const summer = new Set(Array.from({ length: 30 }, (_, i) => weatherOf(s, 2 * s.daysPerSeason + i + 1)));
    expect(winter.has('snow')).toBe(true);
    expect(summer.has('snow')).toBe(false);
  });

  it('gato gerado: repetível pela semente, respeita o que vier fixo, idade pela condição', () => {
    const a = generateCat(createRng(9), profiles, {}, 1);
    expect(a).toEqual(generateCat(createRng(9), profiles, {}, 1));
    expect(a.def.id).toBe('cat.gen.1');
    expect(new Set(a.def.nameSuggestions).size).toBe(3);
    const kitten = generateCat(createRng(9), profiles, { personality: 'shy', condition: 'kitten', variant: 'misty' }, 2);
    expect(kitten.def).toMatchObject({ personality: 'shy', variant: 'misty', adoptionTraits: { age: 'kitten', coat: 'long' } });
    expect(kitten.condition).toBe('kitten');
  });
});

describe('chegadas na sessão', () => {
  /** Café depois da história toda (nenhum marco exclusivo segurando), com as chegadas de teste. */
  function cafe(arrivals: ArrivalDef[], opts: { story?: boolean } = {}) {
    const c = { ...content, arrivals: { ...content.arrivals, arrivals } };
    const state = newGameState(500, 'map.cafe_main', 8 * 60);
    if (opts.story !== false) state.story.completed.push(...content.story.beats.map((b) => b.id));
    const session = new GameSession(c, state);
    const events: { name: string; payload: unknown }[] = [];
    session.bus.onAny((name, payload) => events.push({ name, payload }));
    return { session, state, events };
  }
  const fillCafe = (state: ReturnType<typeof newGameState>, n: number) => {
    for (let i = 0; i < n; i++) state.cats[`cat.full${i}`] = { sheltered: true, name: `F${i}`, map: 'map.cafe_main', shelteredOn: 1, health: 80, sickness: null };
  };

  it('a escrita à mão começa quando o gatilho vale; espera um marco exclusivo acabar', () => {
    const waiting = cafe([arrival()], { story: false });
    waiting.session.arrivals.tick();
    expect(waiting.state.arrivals.queue).toEqual(['arr.test']); // o prólogo (exclusivo) segura
    expect(waiting.state.arrivals.active).toBeNull();
    const { session, state, events } = cafe([arrival()]);
    session.arrivals.tick();
    expect(state.arrivals.active).toMatchObject({ id: 'arr.test', catId: 'cat.gen.1', step: 0 });
    expect(state.catDefs['cat.gen.1']).toBeDefined();
    expect(events.map((e) => e.name)).toContain('arrival.started');
  });

  it('aceito com vaga: abrigado com a condição de chegada; resultado dá afeto, corações do vizinho e moedas', () => {
    const def = arrival({ cat: { generate: { condition: 'injured' } }, result: { startPoints: 50, npc: { id: 'npc.neusa', points: 30 }, money: -20 } });
    const { session, state } = cafe([def]);
    session.arrivals.tick();
    expect(session.arrivals.finish('accepted')).toBe('sheltered');
    const cat = state.cats['cat.gen.1']!;
    expect(cat.sickness).not.toBeNull(); // ferido chega doente (e a doença limita a saúde)
    expect(cat).toMatchObject({ sheltered: true, health: Math.min(profiles.conditions.injured!.health, content.health.sickHealth) });
    expect(state.relationships['player|cat.gen.1']).toBe(50);
    expect(state.relationships['player|npc.neusa']).toBe(30);
    expect(state.money).toBe(480);
    expect(session.catDef('cat.gen.1')?.variant).toBeTruthy();
    expect(session.shelteredCats()).toContain('cat.gen.1');
  });

  it('café cheio: provisório (com prazo), abrigo da vila (entra na feira) ou espera vaga', () => {
    const prov = cafe([arrival()]);
    fillCafe(prov.state, prov.session.catCapacity());
    prov.session.arrivals.tick();
    expect(prov.session.arrivals.finish('accepted')).toBe('provisional');
    expect(prov.state.cats['cat.gen.1']!.provisionalUntil).toBe(prov.state.day + content.arrivals.provisional.days);

    const pool = cafe([arrival({ whenFull: 'adoption' })]);
    fillCafe(pool.state, pool.session.catCapacity());
    pool.session.arrivals.tick();
    expect(pool.session.arrivals.finish('accepted')).toBe('shelter_pool');
    expect(pool.state.arrivals.shelterPool).toEqual(['cat.gen.1']);
    expect(pool.session.miniGameExtras(content.adoption.fair.table).adoptCats?.map((c) => c.id)).toContain('cat.gen.1');

    const later = cafe([arrival({ whenFull: 'postpone' })]);
    fillCafe(later.state, later.session.catCapacity());
    later.session.arrivals.tick();
    expect(later.state.arrivals.active).toBeNull();
    expect(later.state.arrivals.queue).toEqual(['arr.test']);
    delete later.state.cats['cat.full0']; // abriu vaga
    later.session.arrivals.tick();
    expect(later.state.arrivals.active?.id).toBe('arr.test');
  });

  it('provisório: fica de vez quando abre vaga; prazo vencido sem vaga vai para o abrigo da vila', () => {
    const a = cafe([arrival()]);
    fillCafe(a.state, a.session.catCapacity());
    a.session.arrivals.tick();
    a.session.arrivals.finish('accepted');
    delete a.state.cats['cat.full0'];
    a.session.endDay('home');
    expect(a.state.cats['cat.gen.1']!.provisionalUntil).toBeUndefined();

    const b = cafe([arrival()]);
    fillCafe(b.state, b.session.catCapacity());
    b.session.arrivals.tick();
    b.session.arrivals.finish('accepted');
    for (let i = 0; i <= content.arrivals.provisional.days; i++) b.session.endDay('home');
    expect(b.state.cats['cat.gen.1']!.sheltered).toBe(false);
    expect(b.state.arrivals.shelterPool).toContain('cat.gen.1');
  });

  it('recusado: o gato gerado some; a sorteada marca a próxima pelo ritmo', () => {
    const { session, state } = cafe([arrival({ kind: 'random' })]);
    fillCafe(state, 3); // sorteio ligado (autoStartWhen)
    state.arrivals.nextOn = state.day;
    session.arrivals.tick();
    expect(state.arrivals.active?.id).toBe('arr.test');
    session.arrivals.finish('declined');
    expect(state.catDefs['cat.gen.1']).toBeUndefined();
    expect(state.arrivals.nextOn).toBeGreaterThan(state.day);
  });

  it('o sorteio só liga depois dos gatos escritos à mão (autoStartWhen)', () => {
    const { session, state } = cafe([arrival({ kind: 'random' })]);
    session.arrivals.tick();
    expect(state.arrivals.nextOn).toBeNull(); // 0 gatos: ainda não
    fillCafe(state, 3);
    session.arrivals.tick();
    expect(state.arrivals.nextOn).not.toBeNull();
  });

  it('save v18: gato gerado, chegada em andamento e abrigo da vila voltam; v17 começa sem nada', () => {
    const { session, state } = cafe([arrival()]);
    session.arrivals.tick();
    session.arrivals.finish('accepted');
    state.arrivals.shelterPool.push('cat.gen.1');
    const known = { ...knownIds({ ...content, arrivals: { ...content.arrivals, arrivals: [arrival()] } }) };
    const back = parseSave(serializeSave(state, new Date(0)), known).state;
    expect(back.cats['cat.gen.1']?.sheltered).toBe(true);
    expect(back.catDefs['cat.gen.1']).toEqual(state.catDefs['cat.gen.1']);
    expect(back.arrivals.last).toEqual({ 'arr.test': state.day });
    expect(back.arrivals.shelterPool).toEqual(['cat.gen.1']);
    const v18 = parseSave(readFileSync('tests/fixtures/save_v18.json', 'utf8'), knownIds(content)).state;
    expect(v18.catDefs['cat.gen.1']?.variant).toBe('misty');
    expect(v18.cats['cat.gen.1']?.provisionalUntil).toBe(12);
    const v17 = parseSave(readFileSync('tests/fixtures/save_v17.json', 'utf8'), knownIds(content)).state;
    expect(v17.catDefs).toEqual({});
    expect(v17.arrivals).toEqual(newArrivals());
  });
});

describe('modelos de chegada (etapa b)', () => {
  function cafe() {
    const state = newGameState(500, 'map.street', 8 * 60);
    state.story.completed.push(...content.story.beats.map((b) => b.id));
    const session = new GameSession(content, state);
    const events: { name: string; payload: unknown }[] = [];
    session.bus.onAny((name, payload) => events.push({ name, payload }));
    const names = () => events.map((e) => e.name);
    return { session, state, events, names };
  }

  it('na_porta: o gato espera na calçada; E nele mostra a cena; deixar entrar abriga', () => {
    const { session, state, events, names } = cafe();
    expect(session.arrivals.queueNow('arr.door_meow')).toBe(true);
    const at = content.arrivals.arrivals.find((a) => a.id === 'arr.door_meow')!.place.at!;
    const point = session.pendingJobPoints('map.street').find((p) => p.id === 'arrival:arr.door_meow');
    expect(point?.at).toEqual(at);
    expect(session.doJobPoint('arrival:arr.door_meow')).toEqual({ ok: true });
    expect(events).toContainEqual({ name: 'cutscene.requested', payload: { cutsceneId: 'cs.arrival_door' } });
    session.finishCutscene('cs.arrival_door');
    expect(events).toContainEqual({ name: 'arrival.choice', payload: { arrivalId: 'arr.door_meow', key: 'take_in' } });
    session.answerArrival(true);
    const catId = 'cat.gen.1';
    expect(state.cats[catId]?.sheltered).toBe(true);
    expect(names()).toContain('cat.sheltered'); // a caixa de nome abre com este evento
    expect(state.relationships[`player|${catId}`]).toBe(40);
    expect(state.arrivals.active).toBeNull();
  });

  it('vizinho_traz: aceitar dá corações ao vizinho; recusar não abriga e o gato some', () => {
    const yes = cafe();
    yes.session.arrivals.queueNow('arr.neusa_brings');
    yes.session.doJobPoint('arrival:arr.neusa_brings');
    expect(yes.events).toContainEqual({ name: 'arrival.choice', payload: { arrivalId: 'arr.neusa_brings', key: 'neighbor_offer' } });
    yes.session.answerArrival(true);
    expect(yes.state.relationships['player|npc.neusa']).toBe(60);
    expect(yes.session.catDef('cat.gen.1')?.personality).toBe('needy');

    const no = cafe();
    no.session.arrivals.queueNow('arr.neusa_brings');
    no.session.doJobPoint('arrival:arr.neusa_brings');
    no.session.answerArrival(false);
    expect(no.state.cats['cat.gen.1']).toBeUndefined();
    expect(no.state.catDefs['cat.gen.1']).toBeUndefined();
    expect(no.state.relationships['player|npc.neusa']).toBeUndefined();
  });

  it('mural: o cartaz espera a resposta; acolher abriga sem precisar ir a lugar nenhum', () => {
    const { session, state } = cafe();
    session.arrivals.queueNow('arr.board_poster');
    expect(session.arrivals.currentStep()).toEqual({ poster: true });
    expect(session.pendingJobPoints('map.market')).toEqual([]);
    session.answerArrival(true);
    expect(state.cats['cat.gen.1']?.sheltered).toBe(true);
  });

  it('validação: modelo ainda sem etapas e encontro sem lugar não passam', async () => {
    const { validateContent } = await import('../../src/core/content');
    const { rawContent } = await import('./content');
    const raw = rawContent();
    raw.arrivals.arrivals.push({ ...raw.arrivals.arrivals[0]!, id: 'arr.x', model: 'preso' }, { ...raw.arrivals.arrivals[0]!, id: 'arr.y', place: { kind: 'street' } });
    const errors = validateContent(raw).join('\n');
    expect(errors).toMatch(/"arr.x": o modelo "preso" ainda não tem etapas/);
    expect(errors).toMatch(/"arr.y": a etapa meet precisa de place.map e place.at/);
  });
});
