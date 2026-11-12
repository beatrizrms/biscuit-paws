import { describe, expect, it } from 'vitest';
import type { EventName } from '../../src/core/events';
import { isContagious, pickDisease, prescriptionDays, rollsIllness, validateHealth } from '../../src/core/health';
import { GameSession } from '../../src/core/session';
import { newGameState } from '../../src/core/state';
import { weekdayOf } from '../../src/core/schedule';
import { knownIds, parseSave, serializeSave } from '../../src/core/save';
import { loadContent } from './content';

const content = loadContent();
const cfg = content.health;
const CAT = 'cat.first_stray';

/** Café com o gato do prólogo abrigado (sem passar pela história). */
function withCat(money = 200) {
  const state = newGameState(money, 'map.cafe_main', 9 * 60);
  state.flags['has.cat'] = true;
  state.inventory['item.broom'] = 1; // a vassoura fica no espaço 1 da barra, como no jogo
  state.cats[CAT] = { sheltered: true, name: 'Botinhas', map: 'map.cafe_main', shelteredOn: 1, health: cfg.start, sickness: null };
  const session = new GameSession(content, state);
  const events: { name: EventName; payload: unknown }[] = [];
  session.bus.onAny((name, payload) => events.push({ name, payload }));
  return { session, state, events, cat: () => state.cats[CAT]! };
}

/** Leva o gato no colo até a clínica. */
function atClinicWithCat(session: GameSession) {
  expect(session.service.pickUpCat(CAT)).toEqual({ ok: true });
  session.enter(cfg.clinic.map);
}

describe('sorteios da saúde', () => {
  it('doença e dias de receita repetem com a mesma semente e ficam dentro dos limites', () => {
    expect(pickDisease(cfg, 6, CAT)).toBe(pickDisease(cfg, 6, CAT));
    expect(cfg.diseases.map((d) => d.id)).toContain(pickDisease(cfg, 6, CAT));
    for (let day = 1; day < 60; day++) {
      const n = prescriptionDays(cfg, day, CAT);
      expect(n).toBeGreaterThanOrEqual(cfg.prescription.minDays);
      expect(n).toBeLessThanOrEqual(7);
    }
    // Dias diferentes sorteiam doenças diferentes (não é sempre a mesma).
    expect(new Set(Array.from({ length: 30 }, (_, d) => pickDisease(cfg, d, CAT))).size).toBeGreaterThan(1);
    expect(rollsIllness(cfg, 10, CAT)).toBe(rollsIllness(cfg, 10, CAT));
  });

  it('os dados da saúde são válidos', () => {
    expect(validateHealth(cfg, { items: new Set(Object.keys(content.items)), maps: new Set(Object.keys(content.maps)), npcs: new Set(Object.keys(content.npcs)) })).toEqual([]);
  });
});

describe('saúde no dia a dia', () => {
  it('comer sobe; descuido (dia sem comer) desce; baixa demais, adoece', () => {
    const { session, cat, events } = withCat();
    cat().fedOn = 1;
    session.endDay('home');
    expect(cat().health).toBe(cfg.start + cfg.daily.fed);
    for (let i = 0; i < 6 && !cat().sickness; i++) session.endDay('home');
    expect(cat().sickness).not.toBeNull();
    expect(cat().health).toBeLessThanOrEqual(cfg.sickHealth);
    expect(events.some((e) => e.name === 'cat.sick')).toBe(true);
  });

  it('a ração premium (healthMultiplier) dá mais saúde que a simples', () => {
    const premium = Object.values(content.items).find((i) => i.use === 'food_bowl' && i.healthMultiplier)!;
    expect(premium.healthMultiplier).toBe(1.5);
    const simple = withCat();
    simple.cat().fedOn = 1;
    simple.cat().fedWith = 'item.cat_food_basic';
    simple.session.endDay('home');
    const rich = withCat();
    rich.cat().fedOn = 1;
    rich.cat().fedWith = premium.id;
    rich.session.endDay('home');
    expect(simple.cat().health).toBe(cfg.start + cfg.daily.fed);
    expect(rich.cat().health).toBe(cfg.start + Math.round(cfg.daily.fed * 1.5));
  });

  it('adoecer à toa só depois que a clínica abre', () => {
    const { session, state, cat } = withCat();
    // Sem a clínica, nenhum dia sorteia doença (ela come todo dia).
    for (let d = 0; d < 40; d++) {
      cat().fedOn = state.day;
      session.endDay('home');
    }
    expect(cat().sickness).toBeNull();
    state.flags[cfg.randomIllness.requiresFlag] = true;
    for (let d = 0; d < 200 && !cat().sickness; d++) {
      cat().fedOn = state.day;
      session.endDay('home');
    }
    expect(cat().sickness).not.toBeNull();
  });

  it('gato com arrivesSick já chega doente', () => {
    const c = { ...content, cats: { ...content.cats, [CAT]: { ...content.cats[CAT]!, arrivesSick: true } } };
    const session = new GameSession(c, newGameState(100, 'map.cafe_main'));
    session.finishCutscene('cs.meow_door'); // não abriga: o marco do miado precisa da faxina
    // Abriga direto pelo efeito do marco.
    (session as unknown as { applyEffect(e: unknown): void }).applyEffect({ shelterCat: CAT });
    expect(session.state.cats[CAT]?.sickness).not.toBeNull();
  });
});

describe('a clínica', () => {
  it('consulta: precisa estar na clínica, com o gato no colo e doente', () => {
    const { session } = withCat();
    expect(session.consult(CAT)).toEqual({ ok: false, reason: 'not_at_clinic' });
    session.enter(cfg.clinic.map);
    expect(session.consult(CAT)).toEqual({ ok: false, reason: 'bring_cat' });
    session.enter('map.cafe_main');
    atClinicWithCat(session);
    expect(session.consult(CAT)).toEqual({ ok: false, reason: 'not_sick' });
  });

  it('paga consulta + remédio, recebe o remédio da receita e o tratamento começa', () => {
    const { session, state, cat, events } = withCat(500);
    session.makeSick(CAT);
    atClinicWithCat(session);
    const q = session.consultQuote(CAT);
    if ('problem' in q) throw new Error(q.problem);
    expect(q.total).toBe(cfg.prices.consult + q.days * cfg.prices.medicinePerDay);
    expect(q.onCredit).toBe(false);
    expect(session.consult(CAT)).toEqual({ ok: true });
    expect(state.money).toBe(500 - q.total);
    expect(state.inventory[cfg.medicine.item]).toBe(q.days);
    expect(cat().sickness?.treatment).toEqual({ days: q.days, dosesGiven: 0, lastDoseDay: null });
    expect(events.some((e) => e.name === 'cat.diagnosed')).toBe(true);
    expect(session.consult(CAT)).toEqual({ ok: false, reason: 'already_treated' });
  });

  it('primeira consulta sem dinheiro fica fiado; metade de cada ganho paga a dívida', () => {
    const { session, state, events } = withCat(0);
    session.makeSick(CAT);
    atClinicWithCat(session);
    expect(session.consult(CAT)).toEqual({ ok: true });
    expect(state.money).toBe(0);
    const debt = state.debt;
    expect(debt).toBeGreaterThan(0);
    session.addMoney(20, 'job:test');
    expect(state.money).toBe(10);
    expect(state.debt).toBe(debt - 10);
    expect(events.some((e) => e.name === 'debt.paid')).toBe(true);
    // A segunda consulta sem dinheiro não fica fiado.
    state.cats[CAT]!.sickness = null;
    session.makeSick(CAT);
    state.money = 0;
    expect(session.consult(CAT)).toEqual({ ok: false, reason: 'no_money' });
  });

  it('remédio: uma dose por dia, com o remédio ativo; tomou tudo, sara', () => {
    const { session, state, cat, events } = withCat(500);
    session.makeSick(CAT);
    atClinicWithCat(session);
    session.consult(CAT);
    session.enter('map.cafe_main');
    session.service.putDownCat();
    const days = cat().sickness!.treatment!.days;
    expect(session.medicateCat(CAT)).toEqual({ ok: false, reason: 'needs_medicine' });
    session.selectHotbarItem(cfg.medicine.item);
    for (let d = 0; d < days; d++) {
      expect(session.medicateCat(CAT)).toEqual({ ok: true });
      if (d < days - 1) {
        expect(session.medicateCat(CAT)).toEqual({ ok: false, reason: 'already_dosed' });
        cat().fedOn = state.day;
        session.endDay('home');
        session.enter('map.cafe_main');
        session.selectHotbarItem(cfg.medicine.item);
      }
    }
    expect(cat().sickness).toBeNull();
    expect(cat().health).toBeGreaterThanOrEqual(cfg.sickBelow);
    expect(state.flags['vet.cured']).toBe(true);
    expect(events.some((e) => e.name === 'cat.cured')).toBe(true);
    expect(state.inventory[cfg.medicine.item] ?? 0).toBe(0);
  });
});

describe('o dia 6', () => {
  it('a partir do dia 6, no café, o gato adoece e a clínica abre; a meta segura as outras', () => {
    const { session, state, events } = withCat(500);
    state.story.completed.push(...content.story.beats.slice(0, content.story.beats.findIndex((b) => b.id === 'story.prologue_end') + 1).map((b) => b.id));
    state.day = 5;
    session.enter('map.cafe_main');
    expect(state.flags['clinic.open']).toBeUndefined();
    state.day = 6;
    session.enter('map.street');
    expect(state.flags['clinic.open']).toBeUndefined(); // só dentro do café
    session.enter('map.cafe_main');
    expect(state.flags['clinic.open']).toBe(true);
    expect(state.cats[CAT]!.sickness).not.toBeNull();
    expect(events.filter((e) => e.name === 'dialogue.requested').map((e) => (e.payload as { dialogueId: string }).dialogueId)).toContain('dlg.cat_sick');
    expect(session.goals().map((g) => g.title)).toEqual(['Gatinho doente']);
  });

  it('na porta da clínica ela vê que abriu e entra (roteiro); depois a porta volta a ser só porta', () => {
    const { session, state, events } = withCat(500);
    state.story.completed.push(...content.story.beats.slice(0, content.story.beats.findIndex((b) => b.id === 'story.prologue_end') + 1).map((b) => b.id));
    state.day = 6;
    session.enter('map.cafe_main');
    session.enter('map.street');
    const door = session.mapData('map.street').doors!.find((d) => d.to === 'map.vet_clinic')!;
    expect(session.doorIntercept(door)).toBe('scr.clinic_opening');
    expect(events.filter((e) => e.name === 'script.requested').map((e) => (e.payload as { scriptId: string }).scriptId)).toContain('scr.clinic_opening');
    const step = () => session.goals()[0]!.steps.find((x) => !x.done)!.text;
    expect(step()).toContain('obra no fim da rua');
    session.finishScript('scr.clinic_opening');
    expect(session.doorIntercept(door)).toBeUndefined();
    expect(session.canUseDoor(door)).toBe(true);
    expect(step()).toContain('levar no colo');
  });
});

describe('contágio e prejuízo', () => {
  const TWO = 'cat.second';
  const SNIFFLES = cfg.diseases.find((d) => d.contagious)!.id;
  /** Dois gatos no café; contágio certeiro (chance 1) para o teste não depender do sorteio. */
  function twoCats(chance = 1) {
    const c = { ...content, health: { ...cfg, contagion: { ...cfg.contagion, chancePerDay: chance } }, cats: { ...content.cats, [TWO]: { ...content.cats[CAT]!, id: TWO } } };
    const state = newGameState(500, 'map.cafe_main', 9 * 60);
    state.flags['prologue.done'] = true;
    for (const id of [CAT, TWO]) state.cats[id] = { sheltered: true, name: id, map: 'map.cafe_main', shelteredOn: 1, health: cfg.start, sickness: null };
    const session = new GameSession(c, state);
    const events: { name: EventName; payload: unknown }[] = [];
    session.bus.onAny((name, payload) => events.push({ name, payload }));
    const endDay = () => {
      for (const id of [CAT, TWO]) state.cats[id]!.fedOn = state.day;
      session.endDay('home');
    };
    return { session, state, events, endDay };
  }

  it('só a doença que passa (a Fungadinha) transmite: depois de mais de 2 dias doente, mesmo em tratamento (isolar é que segura)', () => {
    const s = { disease: SNIFFLES, since: 6, treatment: null };
    expect([6, 7, 8].map((d) => isContagious(cfg, s, d))).toEqual([false, false, true]);
    expect(isContagious(cfg, { ...s, treatment: { days: 3, dosesGiven: 0, lastDoseDay: null } }, 9)).toBe(true);
    // As outras não passam para ninguém.
    for (const d of cfg.diseases.filter((x) => x.id !== SNIFFLES)) expect(isContagious(cfg, { ...s, disease: d.id }, 9)).toBe(false);
  });

  it('Fungadinha: solta com a turma, passa (mesmo em tratamento); isolada (cercadinho/caixinha), não; sarou, volta', () => {
    const { session, state, endDay } = twoCats();
    session.makeSick(CAT, SNIFFLES);
    state.cats[CAT]!.sickness!.treatment = { days: 9, dosesGiven: 0, lastDoseDay: null };
    expect(session.catContagious(CAT)).toBe(true);
    expect(session.catPlace(CAT)).toBe('with_others'); // ela escolhe: solto por enquanto
    // Isolou: pega no colo e põe no cercadinho/caixinha.
    expect(session.service.pickUpCat(CAT).ok).toBe(true);
    expect(session.putDownSick(true).ok).toBe(true);
    expect(session.catPlace(CAT)).toBe('isolated');
    expect(session.penAssignments().box).toContain(CAT);
    for (let d = 0; d < 4; d++) endDay();
    expect(state.cats[TWO]!.sickness).toBeNull();
    // Soltou mesmo assim (de volta ao café de manhã): passa para o outro.
    state.location = 'map.cafe_main';
    expect(session.service.pickUpCat(CAT).ok).toBe(true);
    expect(session.putDownSick(false).ok).toBe(true);
    expect(session.catPlace(CAT)).toBe('with_others');
    endDay();
    expect(state.cats[TWO]!.sickness?.disease).toBe(SNIFFLES);
    // Outra doença: não pede isolamento.
    expect(session.catContagious(TWO)).toBe(true);
    state.cats[TWO]!.sickness = { disease: cfg.diseases.find((d) => !d.contagious)!.id, since: state.day, treatment: null };
    expect(session.catContagious(TWO)).toBe(false);
  });

  it('o save guarda o isolamento (quarantine) e ele sai quando o gato sara', () => {
    const { session, state } = twoCats();
    session.makeSick(CAT, SNIFFLES);
    state.cats[CAT]!.sickness!.treatment = { days: 1, dosesGiven: 0, lastDoseDay: null };
    session.service.pickUpCat(CAT);
    session.putDownSick(true);
    const loaded = parseSave(serializeSave(state, new Date(0)), knownIds(content));
    expect(loaded.state.cats[CAT]!.quarantine).toBe(true);
    state.inventory[cfg.medicine.item] = 1;
    (session as unknown as { applyDose(id: string, item: string): void }).applyDose(CAT, cfg.medicine.item);
    expect(state.cats[CAT]!.sickness).toBeNull();
    expect(state.cats[CAT]!.quarantine).toBeUndefined();
    expect(session.catPlace(CAT)).toBe('with_others');
  });

  it('o doente sem remédio passa a mesma doença para o outro gato no 3º dia', () => {
    const { session, state, events, endDay } = twoCats();
    session.makeSick(CAT, SNIFFLES);
    const disease = state.cats[CAT]!.sickness!.disease;
    endDay(); // 1º dia doente
    endDay(); // 2º
    expect(state.cats[TWO]!.sickness).toBeNull();
    endDay(); // 3º: passa
    expect(state.cats[TWO]!.sickness?.disease).toBe(disease);
    expect(events.some((e) => e.name === 'cat.infected')).toBe(true);
    // Dois doentes: os clientes somem e a rotina avisa.
    expect(session.customersAway()).toBe(true);
    expect(session.chores().some((c) => c.kind === 'sick')).toBe(true);
    expect(events.some((e) => e.name === 'customers.away')).toBe(true);
  });

  it('com a receita em andamento, não passa para ninguém', () => {
    const { session, state, endDay } = twoCats();
    session.makeSick(CAT);
    state.cats[CAT]!.sickness!.treatment = { days: 7, dosesGiven: 0, lastDoseDay: null };
    for (let d = 0; d < 6; d++) endDay();
    expect(state.cats[TWO]!.sickness).toBeNull();
  });
});

describe('gato de lembrança', () => {
  it('a Tekinha nunca conta como gato abrigado: nem doente, nem no café vazio, nem no "Meus gatos"', () => {
    const { session, state } = withCat();
    session.makeSick(CAT);
    // Mesmo que um save traga a Tekinha como abrigada e doente:
    state.cats['cat.tekinha'] = { sheltered: true, name: 'Tekinha', map: 'map.cafe_main', shelteredOn: 1, health: 10, sickness: { disease: cfg.diseases[0]!.id, since: 1, treatment: null } };
    expect(session.shelteredCats()).toEqual([CAT]);
    expect(session.sickCats()).toEqual([CAT]);
    expect(session.customersAway()).toBe(false);
    expect(session.catProfiles().map((p) => p.id)).toEqual([CAT]);
  });
});

describe('lembretes de cuidado no subconsciente', () => {
  it('gato sujo vira lembrete de escovar, dizendo se falta a escova', () => {
    const { session, state, cat } = withCat();
    state.flags['prologue.done'] = true;
    expect(session.chores().some((c) => c.kind === 'care')).toBe(false);
    cat().hygiene = cfg.care.low.hygiene - 1;
    expect(session.chores().find((c) => c.kind === 'care')).toMatchObject({ catId: CAT, need: 'dirty', hasTool: false });
    state.inventory['item.cat_brush'] = 1;
    expect(session.chores().find((c) => c.kind === 'care')).toMatchObject({ need: 'dirty', hasTool: true });
    cat().hygiene = cfg.care.max;
    expect(session.chores().some((c) => c.kind === 'care')).toBe(false);
  });

  it('comida: com um gato, "Comida para Botinhas"; com mais, uma tarefa só (a ração no pote serve todos)', () => {
    const { session, state } = withCat();
    state.flags['prologue.done'] = true;
    expect(session.chores().filter((c) => c.kind === 'feed')).toEqual([{ kind: 'feed', catId: CAT, done: false }]);
    state.catDefs['cat.gen.1'] = { id: 'cat.gen.1', variant: 'escaminha', personality: 'needy', tags: [] };
    state.cats['cat.gen.1'] = { sheltered: true, name: 'Pipoca', map: 'map.cafe_main', shelteredOn: 1, health: 80, sickness: null, settling: true };
    state.cats[CAT]!.fedOn = state.day;
    expect(session.chores().filter((c) => c.kind === 'feed')).toEqual([{ kind: 'feed', done: false, progress: [1, 2] }]);
    // O gato que acabou de chegar: a confiança vira lembrete.
    expect(session.chores().find((c) => c.kind === 'settle')).toEqual({ kind: 'settle', catId: 'cat.gen.1', done: false });
  });
});


describe('nenhum gato adoece em dia de clínica fechada', () => {
  const sunday = [1, 2, 3, 4, 5, 6, 7].find((d) => weekdayOf(d, content.seasons.startWeekday) === 6)! + 7;

  it('a clínica fecha no domingo (o horário da porta dela na rua)', () => {
    const { session } = withCat();
    expect(session.clinicOpensOn(sunday)).toBe(false);
    expect(session.clinicOpensOn(sunday + 1)).toBe(true);
  });

  it('saúde baixa na véspera do domingo: a doença fica para domingo à noite (amanhece na segunda)', () => {
    const { session, state, cat } = withCat();
    state.day = sunday - 1;
    cat().health = cfg.sickBelow; // sem comer, cai abaixo do limite hoje
    session.endDay('home');
    expect(state.day).toBe(sunday);
    expect(cat().sickness).toBeNull();
    session.endDay('home');
    expect(cat().sickness).not.toBeNull();
    expect(session.clinicOpensOn(state.day)).toBe(true);
  });

  it('o sorteio da manhã não adoece ninguém no domingo', () => {
    const c = { ...content, health: { ...cfg, randomIllness: { ...cfg.randomIllness, chancePerDay: 1, fromDay: 1 } } };
    const state = newGameState(500, 'map.cafe_main', 9 * 60);
    state.flags[cfg.randomIllness.requiresFlag] = true;
    state.cats[CAT] = { sheltered: true, name: 'Botinhas', map: 'map.cafe_main', shelteredOn: 1, health: cfg.max, sickness: null };
    state.day = sunday - 1;
    const session = new GameSession(c, state);
    state.cats[CAT]!.fedOn = state.day;
    session.endDay('home');
    expect(state.cats[CAT]!.sickness).toBeNull();
    state.cats[CAT]!.fedOn = state.day;
    session.endDay('home');
    expect(state.cats[CAT]!.sickness).not.toBeNull();
  });
});

describe('areia suja há dias: cocô no chão', () => {
  it('no 2º dia seguido sem areia limpa, cada gato faz cocô no chão (lugar livre sorteado); varrer tira; trocar a areia zera', () => {
    const { session, state } = withCat();
    state.flags['prologue.done'] = true;
    const lp = cfg.care.litterPoop!;
    const poops = () => session.visibleDirt().filter((d) => d.tags.includes(lp.tag));
    session.endDay('home'); // 1º dia sem areia
    expect(state.litterMissedDays).toBe(1);
    expect(poops()).toHaveLength(0);
    session.endDay('home'); // 2º dia: cocô
    expect(state.litterMissedDays).toBe(2);
    expect(poops()).toHaveLength(lp.perCat * session.shelteredCats().length); // o gato do teste mora no café
    expect(session.chores().some((c) => c.kind === 'poop')).toBe(true);
    // O cocô do dia 2 da história (tag poop) não conta como estes.
    expect(poops().every((d) => !d.tags.includes('poop'))).toBe(true);
    for (let i = 0; i < 5; i++) session.endDay('home');
    expect(poops().length).toBeLessThanOrEqual(lp.maxOnFloor);
    for (const d of poops()) session.clean(d.id);
    expect(poops()).toHaveLength(0);
    expect(session.chores().some((c) => c.kind === 'poop')).toBe(false);
    // Areia trocada hoje: a contagem zera.
    state.placed.push({ uid: 'box', item: 'item.litter_box', at: [3, 9], refilledOn: state.day });
    session.endDay('home');
    expect(state.litterMissedDays).toBe(0);
  });
});

