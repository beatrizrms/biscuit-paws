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
    const kitten = generateCat(createRng(9), profiles, { personality: 'shy', condition: 'kitten', variant: 'cinza' }, 2);
    expect(kitten.def).toMatchObject({ personality: 'shy', variant: 'cinza', adoptionTraits: { age: 'kitten', coat: 'long' } });
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
    pool.session.debugStartFestival('fest.adoption_fair');
    expect(pool.session.miniGameExtras('pt.fair_table').adoptCats?.map((c) => c.id)).toContain('cat.gen.1');

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
    expect(v18.catDefs['cat.gen.1']?.variant).toBe('cinza'); // v38: a cor antiga vira a nova;
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

  it('validação: modelo desconhecido e encontro sem lugar não passam', async () => {
    const { validateContent } = await import('../../src/core/content');
    const { rawContent } = await import('./content');
    const raw = rawContent();
    raw.arrivals.arrivals.push({ ...raw.arrivals.arrivals[0]!, id: 'arr.x', model: 'voando' as never }, { ...raw.arrivals.arrivals[0]!, id: 'arr.y', place: { kind: 'street' } });
    const errors = validateContent(raw).join('\n');
    expect(errors).toMatch(/"arr.x": modelo desconhecido "voando"/);
    expect(errors).toMatch(/"arr.y": a etapa meet precisa de place.map e place.at/);
  });
});

describe('modelos de chegada (etapa c)', () => {
  function cafe() {
    const state = newGameState(500, 'map.street', 8 * 60);
    state.story.completed.push(...content.story.beats.map((b) => b.id));
    const session = new GameSession(content, state);
    const events: { name: string; payload: unknown }[] = [];
    session.bus.onAny((name, payload) => events.push({ name, payload }));
    return { session, state, events };
  }

  it('pegadas somem do começo para o fim com o tempo (seguir cedo é mais fácil)', async () => {
    const { visibleTrail } = await import('../../src/core/arrivals');
    const trail: [number, number][] = [[0, 0], [1, 0], [2, 0], [3, 0]];
    expect(visibleTrail(trail, 100, 0)).toEqual(trail);
    expect(visibleTrail(trail, 100, 50)).toEqual([[2, 0], [3, 0]]);
    expect(visibleTrail(trail, 100, 500)).toEqual([]);
    expect(visibleTrail(trail, undefined, 500)).toEqual(trail);
  });

  it('pegadas: o encontro é no esconderijo; a neve cobre conforme o relógio anda', () => {
    const { session, state } = cafe();
    session.arrivals.queueNow('arr.snow_trail');
    const def = content.arrivals.arrivals.find((a) => a.id === 'arr.snow_trail')!;
    expect(session.pendingJobPoints('map.street').find((p) => p.id === 'arrival:arr.snow_trail')?.at).toEqual(def.place.at);
    expect(session.arrivals.trailNow()).toHaveLength(def.place.trail!.length);
    state.time += def.place.fadeMinutes! / 2;
    expect(session.arrivals.trailNow().length).toBeLessThan(def.place.trail!.length);
    session.doJobPoint('arrival:arr.snow_trail');
    session.answerArrival(true);
    expect(state.cats['cat.gen.1']?.sheltered).toBe(true);
  });

  it('gato_leva: precisa de um gato do café para guiar; segue o caminho até o gato novo', () => {
    const none = cafe();
    none.session.arrivals.queueNow('arr.cat_leads');
    expect(none.state.arrivals.active).toBeNull(); // nenhum gato para guiar: espera na fila

    const { session, state } = cafe();
    state.cats['cat.first_stray'] = { sheltered: true, name: 'Botinhas', map: 'map.cafe_main', shelteredOn: 1, health: 80, sickness: null };
    session.arrivals.queueNow('arr.cat_leads');
    expect(state.arrivals.active?.leaderId).toBe('cat.first_stray');
    session.doJobPoint('arrival:arr.cat_leads');
    expect(session.arrivals.currentStep()).toEqual({ lead: true });
    const route = content.arrivals.arrivals.find((a) => a.id === 'arr.cat_leads')!.place.route!;
    expect(session.pendingJobPoints('map.street').find((p) => p.id === 'arrival:arr.cat_leads:dest')?.at).toEqual(route[route.length - 1]);
    session.doJobPoint('arrival:arr.cat_leads:dest');
    session.answerArrival(true);
    expect(state.cats['cat.gen.1']?.sheltered).toBe(true);
  });
});

describe('modelos de chegada com mini game (etapa d)', () => {
  function cafe() {
    const state = newGameState(500, 'map.street', 10 * 60);
    state.story.completed.push(...content.story.beats.map((b) => b.id));
    state.flags['clinic.open'] = true;
    const session = new GameSession(content, state);
    const events: { name: string; payload: unknown }[] = [];
    session.bus.onAny((name, payload) => events.push({ name, payload }));
    return { session, state, events };
  }
  const result = (gameId: string, outcome: 'fail' | 'ok') => ({ gameId, outcome, score: 0, coinsEarned: 0, skipped: false });
  const mgPoint = (s: GameSession, map: string) => s.pendingJobPoints(map).find((p) => p.action === 'minigame')!;

  it('preso: o mini game da confiança tem a dificuldade do jeito do gato; não deu, tenta de novo; deu, segue', () => {
    // As etapas padrão do modelo preso (sem as dicas dos vizinhos do exemplo).
    const pole = { ...content.arrivals.arrivals.find((a) => a.id === 'arr.cat_on_pole')!, steps: [] };
    const state = newGameState(500, 'map.street', 10 * 60);
    state.story.completed.push(...content.story.beats.map((b) => b.id));
    const session = new GameSession({ ...content, arrivals: { ...content.arrivals, arrivals: [pole] } }, state);
    session.arrivals.queueNow('arr.cat_on_pole');
    const p = mgPoint(session, 'map.street');
    const shy = content.catProfiles.personalities[session.catDef('cat.gen.1')!.personality]!.trust;
    expect(p.minigame).toEqual({ id: 'trust', difficulty: shy });
    expect(session.miniGameExtras(p.id).catId).toBe('cat.gen.1'); // o mini game mostra o gato da chegada
    session.finishMiniGame(result('trust', 'fail'), { difficulty: shy, jobPoint: p.id });
    expect(mgPoint(session, 'map.street').id).toBe(p.id); // ainda no mini game
    session.finishMiniGame(result('trust', 'ok'), { difficulty: shy, jobPoint: p.id });
    expect(session.arrivals.currentStep()).toEqual({ choice: 'take_in' });
    session.answerArrival(true);
    expect(state.cats['cat.gen.1']?.sheltered).toBe(true);
  });

  it('ninhada: a mãe e os filhotes entram juntos (cada um pela vaga)', () => {
    const { session, state } = cafe();
    session.arrivals.queueNow('arr.litter_crates');
    expect(state.arrivals.active?.extraCats).toHaveLength(3);
    session.doJobPoint('arrival:arr.litter_crates');
    const p = mgPoint(session, 'map.street');
    expect(p.minigame?.id).toBe('kitten_hunt');
    session.finishMiniGame(result('kitten_hunt', 'ok'), { difficulty: 'hard', jobPoint: p.id });
    session.answerArrival(true);
    const capacity = session.catCapacity();
    const inCafe = ['cat.gen.1', 'cat.gen.2', 'cat.gen.3', 'cat.gen.4'].filter((id) => state.cats[id]?.sheltered).length;
    const pool = state.arrivals.shelterPool.length;
    expect(inCafe + pool).toBe(4); // ninguém se perde: o que não coube foi para o abrigo da vila
    expect(inCafe).toBeLessThanOrEqual(Math.max(capacity, 0) + 4);
  });

  it('entrega: caixa na porta, cena, perguntar no mercado e na clínica, e decidir', () => {
    const { session, events, state } = cafe();
    session.arrivals.queueNow('arr.delivery_box');
    session.doJobPoint('arrival:arr.delivery_box');
    session.finishCutscene('cs.arrival_box');
    expect(session.pendingJobPoints('map.market').map((p) => p.id)).toContain('pt.arrival_ask_market');
    session.doJobPoint('pt.arrival_ask_market');
    session.doJobPoint('pt.arrival_ask_clinic');
    expect(events).toContainEqual({ name: 'arrival.choice', payload: { arrivalId: 'arr.delivery_box', key: 'keep_box_cat' } });
    session.answerArrival(true);
    expect(state.cats['cat.gen.1']?.sheltered).toBe(true);
  });

  it('em perigo: fura a fila e o marco exclusivo; pegar e correr até a clínica; o vet cuida (e cobra) na hora', () => {
    const { session, state } = cafe();
    state.story.completed = []; // o prólogo (exclusivo) ativo: as outras esperam
    session.arrivals.queueNow('arr.door_meow');
    expect(state.arrivals.active).toBeNull();
    session.arrivals.queueNow('arr.hurt_cat');
    expect(state.arrivals.active?.id).toBe('arr.hurt_cat');
    const chase = mgPoint(session, 'map.street');
    expect(chase.minigame?.id).toBe('chase');
    session.finishMiniGame(result('chase', 'ok'), { difficulty: 'easy', jobPoint: chase.id });
    const run = mgPoint(session, 'map.street');
    expect(run.minigame).toEqual({ id: 'delivery', difficulty: 'normal', itemId: 'hurt_cat' });
    session.finishMiniGame(result('delivery', 'ok'), { difficulty: 'normal', jobPoint: run.id });
    expect(state.cats['cat.gen.1']).toMatchObject({ sheltered: true, sickness: null }); // a corrida até a clínica já conta como o vet
    expect(state.money).toBe(500 - content.catProfiles.rescueVetCost);
  });
});

describe('eventos de exemplo e debug (etapa e)', () => {
  function cafe(day = 20) {
    const state = newGameState(500, 'map.street', 10 * 60);
    state.day = day;
    state.story.completed.push(...content.story.beats.map((b) => b.id));
    state.flags['met.old_neighbor'] = true;
    const session = new GameSession(content, state);
    const events: { name: string; payload: unknown }[] = [];
    session.bus.onAny((name, payload) => events.push({ name, payload }));
    return { session, state, events };
  }
  const shelter = (state: ReturnType<typeof newGameState>, ids: string[]) => {
    for (const id of ids) state.cats[id] = { sheltered: true, name: id, map: 'map.cafe_main', shelteredOn: 1, health: 80, sickness: null };
  };

  it('gato no poste: quem ela ouve muda a dificuldade e ganha corações; a vila ganha reputação', () => {
    const { session, state, events } = cafe();
    session.arrivals.queueNow('arr.cat_on_pole');
    const ask = events.find((e) => e.name === 'arrival.ask')!.payload as { options: { npc: string }[] };
    expect(ask.options.map((o) => o.npc)).toEqual(['npc.neusa', 'npc.gabi', 'npc.mail_carrier']);
    session.answerArrivalAsk(2); // a escada: difícil
    const p = session.pendingJobPoints('map.street').find((x) => x.action === 'minigame')!;
    expect(p.minigame?.difficulty).toBe('hard');
    session.finishMiniGame({ gameId: 'trust', outcome: 'ok', score: 0, coinsEarned: 0, skipped: false }, { difficulty: 'hard', jobPoint: p.id });
    session.answerArrival(true);
    expect(state.relationships['player|npc.mail_carrier']).toBe(10);
    // +2 da chegada (a vila) e o que o próprio mini game da confiança vale.
    expect(state.reputation.value).toBe(content.reputation.start + 2 + content.minigames.games.trust!.reputation!.ok!);
  });

  it('2º gato: a Dona Neusa no dia 8, só com 1 gato; 3º: pegadas no dia 12, só com 2', () => {
    const early = cafe(7);
    shelter(early.state, ['cat.first_stray']);
    early.session.arrivals.tick();
    expect(early.state.arrivals.active).toBeNull();
    const second = cafe(8);
    shelter(second.state, ['cat.first_stray']);
    second.session.arrivals.tick();
    expect(second.state.arrivals.active?.id).toBe('arr.second_cat');
    second.session.doJobPoint('arrival:arr.second_cat');
    expect(second.events).toContainEqual({ name: 'dialogue.requested', payload: { dialogueId: 'dlg.arrival_second_cat' } });
    second.session.answerArrival(true);
    // Com fome, mas a ração fica para dentro (needsInside): aceitou, ele já entra e come do pote no café.
    const catId = [...second.session.shelteredCats()].find((id) => id !== 'cat.first_stray');
    expect(catId).toBeTruthy();
    expect(second.state.arrivals.active).toBeNull();
    expect(second.events.map((e) => e.name)).not.toContain('arrival.needs');
    expect(second.state.relationships['player|npc.neusa']).toBe(80);
    const third = cafe(12);
    shelter(third.state, ['cat.first_stray', 'cat.gen.1']);
    third.session.arrivals.tick();
    expect(third.state.arrivals.active?.id).toBe('arr.third_cat');
    expect(third.session.catDef(third.state.arrivals.active!.catId)).toMatchObject({ personality: 'shy', variant: 'cinza' });
  });

  it('vizinho cético: aceitar dá corações à corretora e reputação', () => {
    const { session, state } = cafe();
    session.arrivals.queueNow('arr.skeptic_realtor');
    session.doJobPoint('arrival:arr.skeptic_realtor');
    session.answerArrival(true);
    expect(state.relationships['player|npc.realtor']).toBe(80);
    expect(state.reputation.value).toBe(content.reputation.start + 3);
  });

  it('debug: clima forçado liga o gatilho; café cheio força o provisório; gerar gato escolhido', () => {
    const { session, state } = cafe(5); // inverno
    session.arrivals.debug.weather = 'sun';
    expect(session.arrivals.triggerReport().find((r) => r.id === 'arr.snow_trail')?.holds).toBe(false);
    session.arrivals.debug.weather = 'snow';
    state.time = 8 * 60;
    expect(session.arrivals.triggerReport().find((r) => r.id === 'arr.snow_trail')?.holds).toBe(true);
    session.arrivals.debug.cafeFull = true;
    const id = session.arrivals.debugGenerate('grumpy', 'senior');
    expect(session.catDef(id)).toMatchObject({ personality: 'grumpy', adoptionTraits: { age: 'senior' } });
    expect(state.cats[id]?.provisionalUntil).toBeDefined();
  });
});

describe('gato carteiro (etapa f)', () => {
  it('aparece no horário; com ração, come e chega mais perto a cada dia; depois de 3, a pergunta', () => {
    const state = newGameState(500, 'map.street', 12 * 60);
    state.story.completed.push(...content.story.beats.map((b) => b.id));
    const session = new GameSession(content, state);
    const fed: unknown[] = [];
    session.bus.on('arrival.fed', (e) => fed.push(e));
    session.arrivals.queueNow('arr.mail_cat');
    const def = content.arrivals.arrivals.find((a) => a.id === 'arr.mail_cat')!;
    const route = def.place.route!;
    const feedPoint = () => session.pendingJobPoints('map.street').find((p) => p.id === 'arrival:arr.mail_cat:feed');
    expect(feedPoint()).toBeUndefined(); // meio-dia: ainda não é a hora dele
    for (let day = 0; day < 3; day++) {
      state.time = 17 * 60;
      expect(feedPoint()?.at).toEqual(route[day]); // cada dia uma célula mais perto
      expect(session.doJobPoint('arrival:arr.mail_cat:feed')).toEqual({ ok: false, reason: 'missing_item' }); // sem ração
      state.inventory['item.cat_food_basic'] = 1;
      expect(session.doJobPoint('arrival:arr.mail_cat:feed')).toEqual({ ok: true });
      expect(state.inventory['item.cat_food_basic'] ?? 0).toBe(0);
      if (day < 2) {
        expect(feedPoint()).toBeUndefined(); // já comeu hoje
        session.endDay('home');
      }
    }
    expect(fed).toHaveLength(3);
    expect(session.arrivals.currentStep()).toEqual({ choice: 'take_in' });
    session.answerArrival(true);
    expect(state.cats['cat.gen.1']?.sheltered).toBe(true);
    expect(state.relationships['player|cat.gen.1']).toBe(120);
  });
});

describe('o gato aceito entra no café na hora e chega assustado (confiança)', () => {
  function accept(condition: string, steps: ArrivalDef['steps'] = [{ choice: 'take_in' }]) {
    const state = newGameState(500, 'map.street', 10 * 60);
    state.story.completed.push(...content.story.beats.map((b) => b.id));
    const def = arrival({ cat: { generate: { condition } }, place: { kind: 'cafe_door', map: 'map.street', at: [15, 9] }, steps, result: { startPoints: 30 } });
    const session = new GameSession({ ...content, arrivals: { ...content.arrivals, arrivals: [def] } }, state);
    const events: string[] = [];
    session.bus.onAny((name) => events.push(name));
    session.arrivals.tick();
    session.answerArrival(true);
    return { session, state, events };
  }
  const trust = (session: GameSession, outcome: 'fail' | 'ok') =>
    session.finishMiniGame({ gameId: 'trust', outcome, coinsEarned: 0, skipped: false } as Parameters<GameSession['finishMiniGame']>[0], { difficulty: 'easy', catId: 'cat.gen.1' });

  it('com fome, com frio ou saudável: aceitou, já está no café (sem esperar ração nem cobertor na porta)', () => {
    for (const condition of ['healthy', 'hungry', 'cold', 'kitten']) {
      const { state } = accept(condition);
      expect(state.arrivals.active).toBeNull();
      expect(state.cats['cat.gen.1']).toMatchObject({ sheltered: true, map: content.map.id, settling: true });
      expect(state.relationships['player|cat.gen.1']).toBe(30);
    }
  });

  it('ferido: entra doente (vai à clínica como qualquer gato do café)', () => {
    const { state } = accept('injured');
    expect(state.cats['cat.gen.1']?.sickness).not.toBeNull();
    expect(state.money).toBe(500);
  });

  it('a confiança (mini game trust) deixa ele de boa; se não der, continua assustado e dá para tentar de novo', () => {
    const { session, state } = accept('healthy');
    expect(session.catSettling('cat.gen.1')).toBe(true);
    expect(session.settleDifficulty('cat.gen.1')).toBe(content.catProfiles.personalities[session.catDef('cat.gen.1')!.personality]!.trust);
    trust(session, 'fail');
    expect(session.catSettling('cat.gen.1')).toBe(true);
    trust(session, 'ok');
    expect(session.catSettling('cat.gen.1')).toBe(false);
    expect(state.cats['cat.gen.1']?.settling).toBeUndefined();
  });

  it('quem já ganhou a confiança na chegada (o do poste) entra tranquilo', () => {
    const { session, state } = accept('healthy', [{ minigame: { id: 'trust', difficulty: 'easy' } }, { choice: 'take_in' }]);
    const mg = session.pendingJobPoints('map.street').find((pt) => pt.minigame?.id === 'trust')!;
    session.finishMiniGame({ gameId: 'trust', outcome: 'ok', coinsEarned: 0, skipped: false } as Parameters<GameSession['finishMiniGame']>[0], { difficulty: 'easy', jobPoint: mg.id });
    session.answerArrival(true);
    expect(state.cats['cat.gen.1']).toMatchObject({ sheltered: true });
    expect(session.catSettling('cat.gen.1')).toBe(false);
  });

  it('save antigo com o gato esperando na porta (ração, cobertor): entra no café no próximo minuto', () => {
    const { session, state } = accept('healthy', [{ choice: 'take_in' }]);
    // Como um save de antes da regra: a chegada parada depois da última etapa.
    state.arrivals.active = { id: 'arr.test', catId: 'cat.gen.2', condition: 'cold', startedOn: state.day, step: 1 } as typeof state.arrivals.active;
    state.catDefs['cat.gen.2'] = { ...state.catDefs['cat.gen.1']!, id: 'cat.gen.2' };
    session.arrivals.tick();
    expect(state.arrivals.active).toBeNull();
    expect(state.cats['cat.gen.2']).toMatchObject({ sheltered: true, settling: true });
  });

  it('save_v35 guarda o gato que chegou; save v34 (antigo) carrega todos de boa', () => {
    const v35 = parseSave(readFileSync('tests/fixtures/save_v35.json', 'utf8'), knownIds(content)).state;
    expect(v35.cats['cat.gen.1']?.settling).toBe(true);
    expect(v35.cats['cat.first_stray']?.settling).toBeUndefined();
    const v34 = parseSave(readFileSync('tests/fixtures/save_v34.json', 'utf8'), knownIds(content)).state;
    expect(Object.values(v34.cats).some((c) => c.settling)).toBe(false);
  });

  it('save: o gato que chegou continua precisando da confiança', () => {
    const { state } = accept('healthy');
    const back = parseSave(serializeSave(state, new Date(0)), knownIds({ ...content, arrivals: { ...content.arrivals, arrivals: [arrival()] } })).state;
    expect(back.cats['cat.gen.1']?.settling).toBe(true);
  });
});
