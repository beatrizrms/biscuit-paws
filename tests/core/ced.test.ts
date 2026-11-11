import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import { donate, kitPrice, kitsAffordable, newCrowdfund, remaining, remoteChance, spend, stalled, topUpRoom } from '../../src/core/crowdfund';
import { CED_SCENES } from '../../src/core/ced';
import type { EventName, GameEvents } from '../../src/core/events';
import { knownIds, parseSave } from '../../src/core/save';
import { GameSession } from '../../src/core/session';
import { newGameState } from '../../src/core/state';
import { loadContent } from './content';

const content = loadContent();
const cfg = content.ced;
const KIT = cfg.vaquinha.kit;

describe('vaquinha (crowdfund.ts)', () => {
  it('doações somam, batem a meta e o saldo só compra os itens de destino (extrato)', () => {
    const c = newCrowdfund('v.1', 'ced.1', 70, KIT, 1, null);
    expect(donate(c, { donor: 'a', amount: 30, day: 1, source: 'remote' })).toBe(true);
    expect(remaining(c)).toBe(40);
    expect(donate(c, { donor: 'b', amount: 0, day: 1, source: 'counter' })).toBe(false);
    donate(c, { donor: 'b', amount: 45, day: 2, source: 'counter' });
    expect(c.status).toBe('done');
    expect(donate(c, { donor: 'c', amount: 5, day: 2, source: 'counter' })).toBe(false);
    expect(kitsAffordable(c)).toBe(Math.floor(75 / kitPrice(KIT)));
    expect(spend(c, 'mat.nao_existe', 1, 2, 'x')).toBe(false);
    expect(spend(c, 'mat.carrier', 2, 2, 'campanha 1 (2 gatos)')).toBe(true);
    expect(c.balance).toBe(75 - 24);
    expect(c.spends).toEqual([{ item: 'mat.carrier', amount: 24, day: 2, usedFor: 'campanha 1 (2 gatos)' }]);
    expect(spend(c, 'mat.carrier', 100, 2, 'x')).toBe(false);
  });

  it('o caixa completa só até o teto, e nunca passa da meta', () => {
    const c = newCrowdfund('v.1', 'ced.1', 100, KIT, 1, null);
    expect(topUpRoom(c, 0.3)).toBe(30);
    c.toppedUp = 25;
    expect(topUpRoom(c, 0.3)).toBe(5);
    donate(c, { donor: 'a', amount: 98, day: 1, source: 'remote' });
    expect(topUpRoom(c, 0.3)).toBe(2);
  });

  it('a chance pelo app cresce com a nota e os corações, com teto', () => {
    const r = cfg.remote;
    expect(remoteChance(r, 5, 0)).toBeGreaterThan(remoteChance(r, 1, 0));
    expect(remoteChance(r, 3, 4)).toBeGreaterThan(remoteChance(r, 3, 0));
    expect(remoteChance({ ...r, base: 10 }, 5, 10)).toBe(r.maxChance);
  });

  it('parada: só depois de alguns dias e abaixo do mínimo por dia', () => {
    const a = cfg.antiStall;
    const c = newCrowdfund('v.1', 'ced.1', 500, KIT, 1, null);
    expect(stalled(c, 1 + a.afterDays - 1, a)).toBe(false);
    expect(stalled(c, 1 + a.afterDays, a)).toBe(true);
    for (let d = 2; d <= 1 + a.afterDays; d++) donate(c, { donor: 'x', amount: a.minPerDay, day: d, source: 'remote' });
    expect(stalled(c, 1 + a.afterDays, a)).toBe(false);
  });
});

/** Café com a primeira castração feita (a condição da Fernanda). */
function setup(time = '10:00') {
  const state = newGameState(500, 'map.cafe_main');
  state.flags['prologue.done'] = true;
  state.flags['vet.neutered_once'] = true;
  const [h, m] = time.split(':').map(Number);
  state.time = h! * 60 + m!;
  const session = new GameSession(content, state);
  // História toda concluída: as cenas do prólogo não entram no meio.
  session.debugCompleteStory();
  state.time = h! * 60 + m!;
  // Na rua: cena livre (no café, só no salão).
  state.location = 'map.street';
  state.ced = { ...state.ced, stage: 'off', crowdfund: null, scheduled: [], pendingScene: null };
  const events: { name: EventName; payload: unknown }[] = [];
  session.bus.onAny((name, payload) => events.push({ name, payload }));
  const scenes = () => events.filter((e) => e.name === 'cutscene.requested').map((e) => (e.payload as GameEvents['cutscene.requested']).cutsceneId);
  return { state, session, events, scenes };
}

describe('CED: a vaquinha pelo CatPay (ced.ts)', () => {
  it('sem a primeira castração, a Fernanda não chama e o app não aparece', () => {
    const { state, session } = setup();
    state.flags['vet.neutered_once'] = false;
    session.tickClock(1);
    expect(state.ced.stage).toBe('off');
    expect(session.ced.appVisible()).toBe(false);
  });

  it('a Fernanda chama de dia: a vaquinha começa (meta = gatos x kit), com a plaquinha na mochila', () => {
    const { state, session, scenes } = setup();
    session.tickClock(1);
    expect(state.ced.stage).toBe('collecting');
    expect(scenes()).toEqual([CED_SCENES.intro]);
    expect(state.ced.crowdfund!.target).toBe(cfg.vaquinha.cats * kitPrice(KIT));
    expect(state.inventory[cfg.counter.signItem]).toBe(1);
    expect(session.ced.appVisible()).toBe(true);
    // Já começou: não chama de novo.
    session.tickClock(1);
    expect(scenes()).toHaveLength(1);
  });

  it('de noite ela espera até o dia seguinte', () => {
    const { state, session } = setup('19:00');
    session.tickClock(1);
    expect(state.ced.stage).toBe('off');
  });

  it('uma doação por pessoa por dia; o caixa dela não conta para isso', () => {
    const { state, session } = setup();
    session.ced.debugStart();
    const money = state.money;
    expect(session.ced.receive('npc.builder', 5, 'remote')).toBe(true);
    expect(session.ced.receive('npc.builder', 5, 'counter')).toBe(false);
    session.endDay('curfew');
    expect(session.ced.receive('npc.builder', 5, 'counter')).toBe(true);
    expect(session.ced.topUp(3)).toEqual({ ok: true, amount: 3 });
    expect(session.ced.topUp(3)).toEqual({ ok: true, amount: 3 });
    expect(state.ced.crowdfund!.raised).toBe(16);
    expect(state.money).toBe(money - 6);
  });

  it('o caixa tem teto e precisa de moedas', () => {
    const { state, session } = setup();
    session.ced.debugStart();
    const cap = Math.floor(state.ced.crowdfund!.target * cfg.topUp.maxShare);
    expect(session.ced.topUp(9999)).toEqual({ ok: true, amount: cap });
    expect(session.ced.topUp(1)).toEqual({ ok: false, reason: 'top_up_limit' });
    const other = setup();
    other.session.ced.debugStart();
    other.state.money = 0;
    expect(other.session.ced.topUp(5)).toEqual({ ok: false, reason: 'no_money' });
  });

  it('no balcão: com a plaquinha posicionada doam bem mais do que sem ela', () => {
    const count = (withSign: boolean) => {
      const { state, session } = setup();
      session.ced.debugStart();
      state.ced.crowdfund!.target = 100_000;
      if (withSign) state.placed.push({ uid: 'p999', item: cfg.counter.signItem, at: [1, 1] });
      let n = 0;
      for (let i = 0; i < 200; i++) {
        state.ced.donatedOn = {};
        const before = state.ced.crowdfund!.donations.length;
        session.ced.customerPaid('npc.customer_01', `c${i}`);
        n += state.ced.crowdfund!.donations.length - before;
      }
      return n;
    };
    const withSign = count(true);
    const without = count(false);
    expect(withSign).toBeGreaterThan(40);
    expect(without).toBeLessThan(25);
  });

  it('pelo app: doações marcadas na manhã chegam na hora, mesmo longe do café', () => {
    const { state, session, events } = setup();
    session.ced.debugStart();
    state.ced.scheduled = [{ at: state.time + 2, donor: 'npc.neusa', amount: 7 }];
    state.location = 'map.market';
    session.tickClock(1);
    session.tickClock(1);
    session.tickClock(1);
    const d = events.find((e) => e.name === 'crowdfund.donated')?.payload as GameEvents['crowdfund.donated'];
    expect(d).toMatchObject({ donor: 'npc.neusa', amount: 7, source: 'remote' });
    expect(state.ced.scheduled).toHaveLength(0);
  });

  it('parada há dias: a Dona Neusa dá uma força no fim do dia', () => {
    const { state, session } = setup();
    session.ced.debugStart();
    state.ced.crowdfund!.startedOn = state.day - cfg.antiStall.afterDays;
    state.ced.scheduled = [];
    const before = state.ced.crowdfund!.raised;
    session.ced.dayEnded(state.day);
    const boost = state.ced.crowdfund!.donations.at(-1)!;
    expect(boost).toMatchObject({ donor: cfg.antiStall.npc, source: 'boost' });
    expect(state.ced.crowdfund!.raised - before).toBeGreaterThanOrEqual(cfg.antiStall.minBoost);
  });

  it('meta batida: fornecedor (compra no extrato), depois a ligação para a Gabi e a campanha pronta', () => {
    const { state, session, scenes, events } = setup();
    session.ced.debugStart();
    session.finishCutscene(CED_SCENES.intro);
    session.ced.debugComplete();
    expect(state.ced.stage).toBe('funded');
    expect(state.ced.campaignCats).toBe(cfg.vaquinha.cats);
    expect(scenes().at(-1)).toBe(CED_SCENES.supplier);
    session.finishCutscene(CED_SCENES.supplier);
    const c = state.ced.crowdfund!;
    expect(c.spends).toHaveLength(KIT.length);
    expect(c.balance).toBe(c.raised - cfg.vaquinha.cats * kitPrice(KIT));
    expect(scenes().at(-1)).toBe(CED_SCENES.callGabi);
    session.finishCutscene(CED_SCENES.callGabi);
    expect(state.ced.stage).toBe('ready');
    expect(state.ced.crowdfund).toBeNull();
    expect(state.ced.history).toHaveLength(1);
    expect(state.flags['ced.campaign_ready']).toBe(true);
    expect(events.some((e) => e.name === 'ced.ready')).toBe(true);
    // Sem vaquinha ativa: o app continua, com "nenhuma vaquinha ativa".
    expect(session.ced.appVisible()).toBe(true);
    expect(session.ced.active()).toBeNull();
  });

  it('cena da CED com ela num cômodo de fora espera a vez', () => {
    const { state, session, scenes } = setup();
    session.ced.debugStart();
    session.finishCutscene(CED_SCENES.intro);
    const spy = session.exclusiveActive;
    session.exclusiveActive = () => true;
    session.ced.debugComplete();
    expect(state.ced.pendingScene).toBe(CED_SCENES.supplier);
    session.exclusiveActive = spy;
    session.tickClock(1);
    expect(state.ced.pendingScene).toBeNull();
    expect(scenes().at(-1)).toBe(CED_SCENES.supplier);
  });

  it('save v37: a vaquinha do meio continua de onde parou; v36 chega com a CED desligada', () => {
    const v37 = parseSave(fs.readFileSync('tests/fixtures/save_v37.json', 'utf8'), knownIds(content)).state;
    expect(v37.ced.stage).toBe('collecting');
    expect(v37.ced.crowdfund).toMatchObject({ raised: 37, toppedUp: 12, status: 'active' });
    expect(v37.ced.scheduled).toHaveLength(1);
    const v36 = parseSave(fs.readFileSync('tests/fixtures/save_v36.json', 'utf8'), knownIds(content)).state;
    expect(v36.ced.stage).toBe('off');
    expect(v36.ced.crowdfund).toBeNull();
  });
});
