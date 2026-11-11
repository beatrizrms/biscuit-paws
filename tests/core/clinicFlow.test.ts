import { describe, expect, it } from 'vitest';
import { GameSession } from '../../src/core/session';
import { newGameState } from '../../src/core/state';
import { parseSave, knownIds } from '../../src/core/save';
import { loadContent } from './content';
import fs from 'node:fs';

const content = loadContent();
const CLINIC = content.health.clinic.map;
const neuter = content.clinic.procedures.find((p) => p.id === 'proc.neuter')!;

/** Café com a clínica aberta e um gato recém-abrigado (esperando a consulta). */
function setup(opts: { neutered?: boolean; earTipped?: boolean; ageBand?: 'kitten' | 'adult'; money?: number } = {}) {
  const state = newGameState(opts.money ?? 1000, 'map.cafe_main');
  state.flags['clinic.open'] = true;
  state.flags['prologue.done'] = true;
  const session = new GameSession(content, state);
  const id = 'cat.gen.1';
  state.catDefs[id] = { id, variant: 'tigrado', personality: 'curious', nameSuggestions: ['Teste'], tags: ['generated', `condition:${opts.ageBand === 'kitten' ? 'kitten' : 'healthy'}`] };
  session.shelterCat(id, opts.ageBand === 'kitten' ? 'kitten' : 'healthy', undefined, false, true, {
    ...(opts.neutered !== undefined ? { neutered: opts.neutered } : {}),
    ...(opts.earTipped ? { earTipped: true } : {}),
  });
  state.cats[id]!.name = 'Teste';
  return { state, session, id };
}

/** Leva o gato no colo até a clínica. */
function toClinic(session: GameSession, state: ReturnType<typeof newGameState>, id: string) {
  expect(session.service.pickUpCat(id).ok).toBe(true);
  state.location = CLINIC;
}

/** Passa o dia (fim do dia + manhã). */
function nextDay(session: GameSession, state: ReturnType<typeof newGameState>) {
  session.endDay('curfew');
  state.location = 'map.cafe_main';
}

describe('consulta de entrada e castração (clinicFlow)', () => {
  it('gato abrigado com a clínica aberta espera a consulta isolado; não se sabe se é castrado', () => {
    const { session, id } = setup({ neutered: false });
    expect(session.catPlace(id)).toBe('isolated');
    const p = session.catProfiles().find((c) => c.id === id)!;
    expect(p.repro.known).toBe('unknown');
    expect(p.care?.stage).toBe('intake');
    expect(session.chores().some((c) => c.kind === 'clinic' && c.clinic === 'intake' && c.catId === id)).toBe(true);
  });

  it('antes da clínica abrir, o gato entra direto (o do prólogo) e o Botinhas já é castrado', () => {
    const state = newGameState(100, 'map.cafe_main');
    const session = new GameSession(content, state);
    session.shelterCat('cat.first_stray');
    expect(session.catPlace('cat.first_stray')).toBe('with_others');
    expect(state.cats['cat.first_stray']!.repro).toMatchObject({ status: 'neutered', known: 'neutered' });
  });

  it('gato elegível: consulta (testes negativos) -> castra -> de manhã a Fernanda traz ao cercadinho com remédio e latinhas', () => {
    const { state, session, id } = setup({ neutered: false });
    const events: string[] = [];
    for (const e of ['cat.examined', 'procedure.booked', 'cat.neutered', 'clinic.delivered', 'clinic.released'] as const) session.bus.on(e, () => events.push(e));
    toClinic(session, state, id);
    const money0 = state.money;
    const intake = session.clinicIntake(id);
    expect(intake.ok).toBe(true);
    if (!intake.ok) return;
    expect(Object.values(intake.exam.tests).every((t) => t === 'negative')).toBe(true);
    expect(intake.exam.status).toBe('intact');
    expect(intake.exam.neuter).toBeNull();
    expect(state.money).toBe(money0 - content.health.prices.consult);
    expect(session.clinicBookNeuter(id).ok).toBe(true);
    expect(state.money).toBe(money0 - content.health.prices.consult - neuter.price);
    expect(session.service.carriedCat()).toBeUndefined();
    expect(session.catPlace(id)).toBe('ward');
    nextDay(session, state);
    const cat = state.cats[id]!;
    expect(cat.repro).toMatchObject({ status: 'neutered', known: 'neutered' });
    expect(cat.clinic).toMatchObject({ stage: 'isolation', until: state.day + neuter.isolationDays });
    expect(cat.aftercare).toEqual({ days: neuter.aftercareDays, dosesGiven: 0, lastDoseDay: null });
    expect(state.inventory[content.health.medicine.item]).toBe(neuter.aftercareDays);
    expect(state.inventory[content.clinic.pen.food]).toBe(neuter.recoveryCans);
    expect(session.catPlace(id)).toBe('isolated');
    expect(events).toEqual(['cat.examined', 'procedure.booked', 'cat.neutered', 'clinic.delivered']);
  });

  it('novo demais: não opera e a ficha mostra "aguardando idade" com o dia', () => {
    const { state, session, id } = setup({ ageBand: 'kitten' });
    toClinic(session, state, id);
    const r = session.clinicIntake(id);
    expect(r.ok && r.exam.neuter?.block).toBe('too_young');
    const readyDay = r.ok ? r.exam.neuter!.readyDay! : 0;
    expect(readyDay).toBeGreaterThan(state.day);
    expect(session.clinicBookNeuter(id)).toEqual({ ok: false, reason: 'too_young' });
    state.location = 'map.cafe_main';
    expect(session.service.putDownCat().ok).toBe(true);
    const p = session.catProfiles().find((c) => c.id === id)!;
    expect(p.adoption).toEqual({ reason: 'waiting_age', readyDay });
    expect(session.catPlace(id)).toBe('with_others');
  });

  it('já castrado: a Fernanda avisa e não opera nem cobra', () => {
    const { state, session, id } = setup({ neutered: true });
    toClinic(session, state, id);
    const r = session.clinicIntake(id);
    expect(r.ok && r.exam.status).toBe('neutered');
    const money = state.money;
    expect(session.clinicBookNeuter(id)).toEqual({ ok: false, reason: 'already_neutered' });
    expect(state.money).toBe(money);
    expect(state.cats[id]!.repro!.known).toBe('neutered');
  });

  it('marca na orelha: chega castrado e já se sabe', () => {
    const { session, id } = setup({ neutered: false, earTipped: true });
    const p = session.catProfiles().find((c) => c.id === id)!;
    expect(p.repro).toMatchObject({ known: 'neutered', earTipped: true });
  });

  it('clínica cheia: sem vaga de cirurgia no dia, não opera', () => {
    const { state, session, id } = setup({ neutered: false });
    session.debugFillClinic();
    toClinic(session, state, id);
    const r = session.clinicIntake(id);
    expect(r.ok && r.exam.neuter?.block).toBe('no_slots');
    expect(session.clinicBookNeuter(id)).toEqual({ ok: false, reason: 'no_slots' });
  });

  it('deixar até amanhã: ela busca no dia seguinte e ele vai para a turma', () => {
    const { state, session, id } = setup({ neutered: true });
    toClinic(session, state, id);
    expect(session.clinicIntake(id).ok).toBe(true);
    expect(session.clinicLeaveOvernight(id).ok).toBe(true);
    expect(session.clinicPickUp(id)).toEqual({ ok: false, reason: 'not_ready' });
    nextDay(session, state);
    expect(session.chores().some((c) => c.kind === 'clinic' && c.clinic === 'pickup')).toBe(true);
    state.location = CLINIC;
    expect(session.clinicPickUp(id).ok).toBe(true);
    expect(session.service.carriedCat()).toBe(id);
    expect(session.catPlace(id)).toBe('with_others');
  });

  it('recuperação sem complicação: comendo a latinha, sai do cercadinho depois dos dias e pode ser adotado', () => {
    const { state, session, id } = setup({ neutered: false });
    session.debugBookNeuter(id);
    session.debugClinicMorning();
    // Ela não pode ser adotada no cercadinho.
    expect(session.catProfiles().find((c) => c.id === id)!.adoption?.reason).toBe('in_care');
    let complications = 0;
    session.bus.on('clinic.complication', () => complications++);
    for (let d = 0; d < neuter.isolationDays; d++) {
      state.hotbar.slots[0] = content.clinic.pen.food;
      state.hotbar.active = 0;
      state.inventory[content.clinic.pen.food] = 5;
      const fed = session.feedIsolated('box');
      expect(fed.ok).toBe(true);
      nextDay(session, state);
    }
    expect(complications).toBe(0);
    expect(session.catPlace(id)).toBe('with_others');
    expect(session.catProfiles().find((c) => c.id === id)!.adoption).toBeNull();
  });

  it('complicação: precisa voltar à clínica; a Fernanda resolve de graça e ele volta ao cercadinho', () => {
    const { state, session, id } = setup({ neutered: false });
    session.debugBookNeuter(id);
    session.debugClinicMorning();
    session.debugComplication(id);
    expect(session.chores().some((c) => c.kind === 'clinic' && c.clinic === 'recheck')).toBe(true);
    toClinic(session, state, id);
    const money = state.money;
    expect(session.clinicRecheck(id).ok).toBe(true);
    expect(state.money).toBe(money);
    expect(state.cats[id]!.clinic).toMatchObject({ stage: 'isolation' });
    expect((state.cats[id]!.clinic as { complication?: boolean }).complication).toBeUndefined();
  });

  it('sem comer no cercadinho, a complicação pode vir (com chance), sem castigo pesado', () => {
    const { state, session, id } = setup({ neutered: false });
    session.debugBookNeuter(id);
    session.debugClinicMorning();
    let n = 0;
    session.bus.on('clinic.complication', (e) => e.missedFeed && n++);
    // Muitos dias sem comer (sem a latinha): em algum momento, a complicação (a chance é por dia, com semente).
    for (let d = 0; d < 30 && n === 0; d++) {
      session.debugAdvanceRecovery(id);
      state.cats[id]!.clinic = { stage: 'isolation', until: state.day + 5, procedure: 'proc.neuter' };
      nextDay(session, state);
    }
    expect(n).toBeGreaterThan(0);
  });

  it('remédio do pós-cirurgia: usa o mesmo remédio e some quando acaba', () => {
    const { state, session, id } = setup({ neutered: false });
    session.debugBookNeuter(id);
    session.debugClinicMorning();
    state.hotbar.slots[0] = content.health.medicine.item;
    state.hotbar.active = 0;
    expect(session.medicineProblem(id)).toBeNull();
    for (let d = 0; d < neuter.aftercareDays; d++) {
      expect(session.medicateCat(id).ok).toBe(true);
      state.day++;
    }
    expect(state.cats[id]!.aftercare).toBeUndefined();
    expect(state.cats[id]!.sickness).toBeNull();
  });

  it('desconto de amiga a partir da 5ª consulta (e a Fernanda comenta uma vez)', () => {
    const { state, session, id } = setup({ neutered: true });
    state.clinic.consults = content.clinic.discount.fromConsult - 1;
    let said = 0;
    session.bus.on('clinic.friend_discount', () => said++);
    toClinic(session, state, id);
    const q = session.clinicIntakeQuote(id);
    expect('total' in q && q.friend).toBe(true);
    const money = state.money;
    expect(session.clinicIntake(id).ok).toBe(true);
    const price = content.health.prices.consult;
    expect(state.money).toBe(money - (price - Math.round(price * content.clinic.discount.share)));
    expect(said).toBe(1);
  });

  it('fiado: sem dinheiro e sem dívida, castra no fiado; a próxima castração paga a dívida junto (retroativa)', () => {
    const { state, session, id } = setup({ neutered: false, money: content.health.prices.consult });
    toClinic(session, state, id);
    expect(session.clinicIntake(id).ok).toBe(true);
    expect(state.money).toBe(0);
    const exam = session.clinicExam(id)!;
    expect(exam.neuterPay).toBe('credit');
    expect(session.clinicBookNeuter(id).ok).toBe(true);
    expect(state.clinic.debt).toBe(neuter.price);
    // Outro gato: com dívida e sem dinheiro, não há outro fiado.
    const id2 = 'cat.gen.2';
    state.catDefs[id2] = { id: id2, variant: 'preto', personality: 'sweet', nameSuggestions: ['B'], tags: ['generated', 'condition:healthy'] };
    session.shelterCat(id2, 'healthy', undefined, false, true, { neutered: false });
    state.location = 'map.cafe_main';
    toClinic(session, state, id2);
    expect(session.clinicIntakeQuote(id2)).toEqual({ problem: 'no_money' });
    // Com dinheiro: a consulta é à vista; a castração cobra a dívida junto.
    state.money = 1000;
    expect(session.clinicIntake(id2).ok).toBe(true);
    const money = state.money;
    expect(session.clinicBookNeuter(id2).ok).toBe(true);
    expect(state.money).toBe(money - neuter.price * 2);
    expect(state.clinic.debt).toBe(0);
  });

  it('consulta de doença de quem nunca fez os testes (o Botinhas): a Fernanda aproveita e faz o checkup', () => {
    const state = newGameState(1000, 'map.cafe_main');
    state.flags['clinic.open'] = true;
    const session = new GameSession(content, state);
    session.shelterCat('cat.first_stray');
    session.makeSick('cat.first_stray');
    let checkups = 0;
    session.bus.on('clinic.checkup', () => checkups++);
    toClinic(session, state, 'cat.first_stray');
    expect(session.consult('cat.first_stray').ok).toBe(true);
    expect(checkups).toBe(1);
    expect(Object.values(state.cats['cat.first_stray']!.tests ?? {}).every((t) => t === 'negative')).toBe(true);
    expect(session.clinicExam('cat.first_stray')?.status).toBe('neutered');
  });

  it('sem cercadinho, volta na caixinha: no colo continua caixinha e só sai dela no cercadinho', () => {
    const { state, session, id } = setup({ neutered: false });
    session.debugBookNeuter(id);
    session.debugClinicMorning();
    expect(session.catBoxed(id)).toBe(true);
    expect(session.penAssignments().box).toEqual([id]);
    // Pega e põe no chão: continua na caixinha.
    expect(session.service.pickUpCat(id).ok).toBe(true);
    expect(session.service.putDownCat().ok).toBe(true);
    expect(session.catBoxed(id)).toBe(true);
    // Comprou o cercadinho: ele não pula sozinho para lá.
    state.placed.push({ uid: 'p.pen', item: content.clinic.pen.item, at: [3, 6] });
    expect(session.penAssignments()).toEqual({ pen: { 'p.pen': [] }, box: [id] });
    // Sem a caixinha no colo, não há o que soltar; com ela, solta no cercadinho.
    expect(session.releaseIntoPen('p.pen')).toEqual({ ok: false, reason: 'not_pending' });
    expect(session.service.pickUpCat(id).ok).toBe(true);
    expect(session.releaseIntoPen('p.nope')).toEqual({ ok: false, reason: 'needs_pen' });
    expect(session.releaseIntoPen('p.pen').ok).toBe(true);
    expect(session.service.carriedCat()).toBeUndefined();
    expect(session.catBoxed(id)).toBe(false);
    expect(session.penAssignments()).toEqual({ pen: { 'p.pen': [id] }, box: [] });
  });

  it('com cercadinho, a Fernanda já devolve lá (sem caixinha)', () => {
    const { state, session, id } = setup({ neutered: false });
    state.placed.push({ uid: 'p.pen', item: content.clinic.pen.item, at: [3, 6] });
    const delivered: boolean[] = [];
    session.bus.on('clinic.delivered', ({ inPen }) => delivered.push(inPen));
    session.debugBookNeuter(id);
    session.debugClinicMorning();
    expect(delivered).toEqual([true]);
    expect(session.catBoxed(id)).toBe(false);
    expect(session.penAssignments().pen['p.pen']).toEqual([id]);
  });

  it('a latinha vem da mochila (não precisa estar na barra) e não vai sozinha para a barra', () => {
    const { state, session, id } = setup({ neutered: false });
    session.debugBookNeuter(id);
    session.debugClinicMorning();
    expect(state.hotbar.slots.includes(content.clinic.pen.food)).toBe(false);
    expect(session.canFeedIsolated('box')).toBe(true);
    expect(session.feedIsolated('box').ok).toBe(true);
    expect(session.canFeedIsolated('box')).toBe(false);
  });

  it('save antigo (v35): os gatos ganham estado reprodutivo (sempre o mesmo) e ficam com os outros', () => {
    const raw = fs.readFileSync('tests/fixtures/save_v35.json', 'utf8');
    const load = () => new GameSession(content, parseSave(raw, knownIds(content)).state);
    const a = load();
    const b = load();
    expect(a.state.cats['cat.gen.1']!.repro).toEqual(b.state.cats['cat.gen.1']!.repro);
    expect(a.state.cats['cat.first_stray']!.repro).toMatchObject({ status: 'neutered', known: 'neutered' });
    expect(a.catPlace('cat.gen.1')).toBe('with_others');
    expect(a.state.clinic.consults).toBe(0);
  });

  it('save v36: o gato internado continua internado e volta na manhã', () => {
    const raw = fs.readFileSync('tests/fixtures/save_v36.json', 'utf8');
    const state = parseSave(raw, knownIds(content)).state;
    const session = new GameSession(content, state);
    expect(session.catPlace('cat.gen.1')).toBe('ward');
    expect(state.clinic.surgeries['12']).toBe(1);
    nextDay(session, state);
    expect(session.catPlace('cat.gen.1')).toBe('isolated');
    expect(state.cats['cat.gen.1']!.repro!.status).toBe('neutered');
  });
});
