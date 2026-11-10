import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { weatherOf } from '../../src/core/calendar';
import { pairKey } from '../../src/core/relationships';
import { knownIds, parseSave } from '../../src/core/save';
import { GameSession } from '../../src/core/session';
import { newGameState } from '../../src/core/state';
import { loadContent } from './content';

const content = loadContent();
const SS = content.festive.secretSanta;
const S = content.seasons;
const YEAR = S.daysPerSeason * S.order.length;
const XMAS = SS.day; // inverno 25 do primeiro ano

/** Café funcionando, depois do prólogo; ela conhece a Gabi (e o Joca) e a Dona Neusa. */
function cafe(day: number, time = 10 * 60) {
  const state = newGameState(500, 'map.cafe_main', time);
  state.day = day;
  state.business = 'soft_open';
  state.story.completed.push(...content.story.beats.map((b) => b.id));
  Object.assign(state.flags, { 'prologue.done': true, 'seen.scr.gabi_visit': true, 'met.old_neighbor': true });
  const session = new GameSession(content, state);
  const events: { name: string; payload: unknown }[] = [];
  session.bus.onAny((name, payload) => events.push({ name, payload }));
  return { session, state, events };
}
const named = (events: { name: string; payload: unknown }[], name: string) => events.filter((e) => e.name === name).map((e) => e.payload);

describe('amigo secreto: o sorteio', () => {
  it('no dia do sorteio, no café, a Gabi propõe e ela tira um dos amigos que conhece', () => {
    const { session, state, events } = cafe(SS.drawDay);
    expect(session.santaGuests()).toEqual(['npc.gabi', 'npc.joca', 'npc.neusa', 'npc.realtor']);
    session.checkSecretSanta();
    expect(state.secretSanta).toMatchObject({ year: 1, stage: 'drawn' });
    expect(session.santaGuests()).toContain(state.secretSanta!.drawn);
    expect(named(events, 'script.requested')).toEqual([{ scriptId: SS.proposalScript }]);
    // Uma vez só.
    session.checkSecretSanta();
    expect(named(events, 'script.requested')).toHaveLength(1);
  });

  it('quem ela ainda não conhece fica de fora (o Tião só depois da primeira ligação; a Fernanda, da clínica)', () => {
    const { session, state } = cafe(SS.drawDay);
    state.flags['builder.called'] = true;
    state.visited.push('map.vet_clinic');
    expect(session.santaGuests()).toEqual(['npc.gabi', 'npc.joca', 'npc.neusa', 'npc.builder', 'npc.fernanda', 'npc.realtor']);
  });

  it('sem conhecer a Gabi, fora do período, fora do café ou de noite: nada de sorteio', () => {
    const noGabi = cafe(SS.drawDay);
    delete noGabi.state.flags['seen.scr.gabi_visit'];
    noGabi.session.checkSecretSanta();
    expect(noGabi.state.secretSanta).toBeNull();
    for (const day of [SS.drawDay - 1, SS.day]) {
      const { session, state } = cafe(day);
      session.checkSecretSanta();
      expect(state.secretSanta).toBeNull();
    }
    const street = cafe(SS.drawDay);
    street.state.location = 'map.street';
    street.session.checkSecretSanta();
    expect(street.state.secretSanta).toBeNull();
    const night = cafe(SS.drawDay, 20 * 60);
    night.session.checkSecretSanta();
    expect(night.state.secretSanta).toBeNull();
  });

  it('o sorteio do ano passado não vale: no inverno seguinte, sorteia de novo', () => {
    const { session, state } = cafe(YEAR + SS.drawDay);
    state.secretSanta = { year: 1, drawn: 'npc.neusa', stage: 'done', result: 'loved' };
    expect(session.santaRecord()).toBeNull();
    session.checkSecretSanta();
    expect(state.secretSanta).toMatchObject({ year: 2, stage: 'drawn' });
  });
});

describe('amigo secreto: o Natal', () => {
  it('neve garantida na véspera e no Natal', () => {
    expect(weatherOf(S, XMAS - 1)).toBe('snow');
    expect(weatherOf(S, XMAS)).toBe('snow');
    expect(weatherOf(S, YEAR + XMAS)).toBe('snow');
  });

  it('o café fecha ao meio-dia no Natal (no dia de antes, não)', () => {
    const before = cafe(XMAS - 1, 13 * 60);
    expect(before.session.service.isOpen()).toBe(true);
    const morning = cafe(XMAS, 11 * 60);
    expect(morning.session.service.isOpen()).toBe(true);
    const noon = cafe(XMAS, 12 * 60);
    expect(noon.session.service.isOpen()).toBe(false);
  });

  it('com o amigo secreto marcado, ela só vai para casa depois da ceia; às 19h, o roteiro da ceia', () => {
    const { session, state, events } = cafe(XMAS, 18 * 60);
    state.secretSanta = { year: 1, drawn: 'npc.neusa', stage: 'drawn' };
    expect(session.goHomeProblem()).toBe('xmas_party');
    session.checkSecretSanta();
    expect(named(events, 'script.requested')).toEqual([]);
    state.time = 19 * 60;
    session.checkSecretSanta();
    session.checkSecretSanta();
    expect(named(events, 'script.requested')).toEqual([{ scriptId: SS.partyScript }]);
    session.secretSantaExchange();
    expect(session.goHomeProblem()).toBeNull();
  });

  it('o presente que a pessoa gosta vale mais; os convidados ganham um pouco pela noite', () => {
    const { session, state, events } = cafe(XMAS, 19 * 60);
    state.secretSanta = { year: 1, drawn: 'npc.neusa', stage: 'drawn' };
    state.inventory['item.xmas_mug'] = 1;
    state.inventory['item.poinsettia'] = 1;
    expect(session.secretSanta()).toMatchObject({ hasGift: true, lovedGift: true });
    expect(session.secretSantaExchange()).toEqual({ dialogue: 'dlg.santa_loved_neusa' });
    expect(state.inventory['item.poinsettia']).toBeUndefined();
    expect(state.inventory['item.xmas_mug']).toBe(1);
    expect(state.relationships[pairKey('player', 'npc.neusa')]).toBe(SS.points.loved + SS.points.party);
    expect(state.relationships[pairKey('player', 'npc.gabi')]).toBe(SS.points.party);
    expect(state.secretSanta).toMatchObject({ stage: 'done', result: 'loved', gift: 'item.poinsettia' });
    expect(named(events, 'xmas.santa_exchanged')).toEqual([{ npc: 'npc.neusa', result: 'loved', itemId: 'item.poinsettia' }]);
    // Não troca duas vezes.
    expect(session.secretSantaExchange()).toBeNull();
  });

  it('outro presente de Natal agrada menos; sem presente, a fala de quem esqueceu', () => {
    const liked = cafe(XMAS, 19 * 60);
    liked.state.secretSanta = { year: 1, drawn: 'npc.gabi', stage: 'drawn' };
    liked.state.inventory['item.xmas_candle'] = 1;
    expect(liked.session.secretSantaExchange()).toEqual({ dialogue: 'dlg.santa_liked_gabi' });
    expect(liked.state.relationships[pairKey('player', 'npc.gabi')]).toBe(SS.points.liked + SS.points.party);

    const none = cafe(XMAS, 19 * 60);
    none.state.secretSanta = { year: 1, drawn: 'npc.gabi', stage: 'drawn' };
    expect(none.session.secretSanta()).toMatchObject({ hasGift: false });
    expect(none.session.secretSantaExchange()).toEqual({ dialogue: SS.noGiftDialogue });
    expect(none.state.secretSanta!.result).toBe('none');
  });

  it('ela ganha o globo de neve do café no primeiro amigo secreto; nos outros anos, outro presente', () => {
    const first = cafe(XMAS, 19 * 60);
    first.state.secretSanta = { year: 1, drawn: 'npc.neusa', stage: 'done' };
    expect(first.session.secretSantaReceive()).toEqual({ dialogue: SS.receiveDialogue, itemId: SS.playerGifts.first });
    expect(first.state.inventory[SS.playerGifts.first]).toBe(1);
    expect(first.session.santaGuests()).toContain(first.state.secretSanta!.giver);
    expect(first.state.secretSanta!.giver).not.toBe('npc.neusa');
    expect(first.session.secretSantaReceive()).toBeNull();

    const later = cafe(YEAR + XMAS, 19 * 60);
    later.state.flags['xmas.santa_received'] = true;
    later.state.secretSanta = { year: 2, drawn: 'npc.neusa', stage: 'done' };
    expect(SS.playerGifts.later).toContain(later.session.secretSantaReceive()!.itemId);
  });

  it('manhã de Natal: com meia posicionada, os gatos ganham petisco; o aviso do dia diz da ceia', () => {
    const { session, state, events } = cafe(XMAS - 1, 20 * 60);
    state.secretSanta = { year: 1, drawn: 'npc.neusa', stage: 'drawn' };
    state.cats['cat.first_stray'] = { sheltered: true, name: 'Botinhas', map: 'map.cafe_main', shelteredOn: 1, health: 80, sickness: null, happiness: 50, hygiene: 70 };
    state.placed.push({ uid: 'm1', item: SS.stockings.item, at: [5, 1] });
    session.endDay('home');
    expect(state.day).toBe(XMAS);
    expect(state.cats['cat.first_stray']!.happiness).toBeGreaterThan(50);
    expect(named(events, 'xmas.day')).toEqual([{ closeAt: SS.closeAt, partyAt: SS.partyAt, party: true, stockingCats: 1 }]);
  });

  it('sem meia, sem petisco', () => {
    const { session, state, events } = cafe(XMAS - 1, 20 * 60);
    state.cats['cat.first_stray'] = { sheltered: true, name: 'Botinhas', map: 'map.cafe_main', shelteredOn: 1, health: 80, sickness: null, happiness: 90, hygiene: 70 };
    session.endDay('home');
    expect(named(events, 'xmas.day')).toEqual([{ closeAt: SS.closeAt, partyAt: SS.partyAt, party: false, stockingCats: 0 }]);
  });

  it('o Natal acabou sem a ceia: fica como perdida', () => {
    const { session, state, events } = cafe(XMAS, 23 * 60);
    state.secretSanta = { year: 1, drawn: 'npc.neusa', stage: 'drawn' };
    session.endDay('curfew');
    expect(state.secretSanta!.stage).toBe('missed');
    expect(named(events, 'xmas.santa_missed')).toEqual([{ npc: 'npc.neusa' }]);
  });
});

describe('amigo secreto no save', () => {
  it('save_v34 guarda o amigo secreto do ano', () => {
    const { state } = parseSave(readFileSync('tests/fixtures/save_v34.json', 'utf8'), knownIds(content));
    expect(state.secretSanta).toEqual({ year: 1, drawn: 'npc.neusa', stage: 'drawn' });
  });

  it('save antigo (v33) começa sem amigo secreto', () => {
    expect(parseSave(readFileSync('tests/fixtures/save_v33.json', 'utf8'), knownIds(content)).state.secretSanta).toBeNull();
  });
});
