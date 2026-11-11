import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { knownIds, parseSave } from '../../src/core/save';
import { GameSession } from '../../src/core/session';
import { newGameState } from '../../src/core/state';
import { loadContent } from './content';

const content = loadContent();
const S = content.seasons;
const BOX = content.festive.boxes[0]!.item;
/** Último dia do inverno do primeiro ano. */
const lastWinterDay = S.daysPerSeason;

function cafe(day: number) {
  const state = newGameState(500, 'map.cafe_main', 9 * 60);
  state.day = day;
  state.flags['has.cat'] = true;
  const session = new GameSession(content, state);
  const events: string[] = [];
  session.bus.onAny((name) => events.push(name));
  return { session, state, events };
}

describe('caixa de enfeites de Natal', () => {
  it('no fim do inverno, os enfeites (posicionados ou na mochila) vão para a caixa; o resto fica', () => {
    const { session, state, events } = cafe(lastWinterDay);
    state.placed.push(
      { uid: 'p1', item: 'item.christmas_tree', at: [3, 6] },
      { uid: 'p2', item: 'item.xmas_wreath', at: [5, 1] },
      { uid: 'p3', item: 'item.cactus', at: [8, 8] },
    );
    state.inventory['item.xmas_stocking'] = 2;
    state.inventory['item.knit_scarf'] = 1; // presente, não é enfeite
    session.endDay('home');
    expect(state.placed.map((p) => p.item)).toEqual(['item.cactus']);
    expect(state.xmasBox).toEqual({ 'item.christmas_tree': 1, 'item.xmas_wreath': 1, 'item.xmas_stocking': 2 });
    expect(state.inventory[BOX]).toBe(1);
    expect(state.inventory['item.xmas_stocking']).toBeUndefined();
    expect(state.inventory['item.knit_scarf']).toBe(1);
    expect(events).toContain('xmas.packed');
  });

  it('sem enfeites, nada de caixa', () => {
    const { session, state } = cafe(lastWinterDay);
    session.endDay('home');
    expect(state.inventory[BOX]).toBeUndefined();
  });

  it('a caixa só abre no inverno; sai um enfeite por vez e, vazia, some da mochila', () => {
    const spring = cafe(S.daysPerSeason + 5);
    spring.state.xmasBox = { 'item.xmas_lights': 1 };
    spring.state.inventory[BOX] = 1;
    expect(spring.session.openXmasBox()).toEqual({ ok: false, reason: 'box_closed' });

    const { session, state, events } = cafe(S.daysPerSeason * S.order.length + 3); // inverno do ano 2
    state.xmasBox = { 'item.xmas_lights': 1, 'item.xmas_stocking': 2 };
    state.inventory[BOX] = 1;
    expect(session.openXmasBox()).toEqual({ ok: true, itemId: 'item.xmas_lights' });
    expect(state.inventory['item.xmas_lights']).toBe(1);
    expect(session.xmasBoxCount()).toBe(2);
    expect(events).toContain('xmas.box_opened');
    session.openXmasBox();
    expect(session.openXmasBox()).toEqual({ ok: true, itemId: 'item.xmas_stocking' });
    expect(state.inventory['item.xmas_stocking']).toBe(2);
    expect(state.inventory[BOX]).toBeUndefined();
  });

  it('os enfeites custam pouco (são comprados uma vez e voltam todo inverno)', () => {
    for (const id of ['item.christmas_tree', 'item.xmas_wreath', 'item.xmas_lights', 'item.xmas_stocking']) expect(content.items[id]!.price).toBeLessThanOrEqual(25);
  });
});

describe('a guirlanda da Dona Neusa', () => {
  it('no inverno, depois de conhecê-la e no café, ela traz a guirlanda (uma vez)', () => {
    const { session, state, events } = cafe(10);
    // O prólogo já passou (ela conhece a Dona Neusa depois da cafeteira).
    state.story.completed = content.story.beats.map((b) => b.id).filter((id) => id !== 'story.xmas_wreath_gift');
    state.flags['met.old_neighbor'] = true;
    session.start(false);
    expect(state.story.completed).toContain('story.xmas_wreath_gift');
    expect(state.inventory['item.xmas_wreath']).toBe(1);
    expect(events).toContain('dialogue.requested');
  });

  it('fora do inverno ela espera o próximo', () => {
    const { session, state } = cafe(S.daysPerSeason + 10);
    state.story.completed = content.story.beats.map((b) => b.id).filter((id) => id !== 'story.xmas_wreath_gift');
    state.flags['met.old_neighbor'] = true;
    session.start(false);
    expect(state.story.completed).not.toContain('story.xmas_wreath_gift');
  });
});

describe('caixa de Natal no save', () => {
  it('save_v33 guarda a caixa; item que sumiu dos dados é esquecido', () => {
    const { state } = parseSave(readFileSync('tests/fixtures/save_v33.json', 'utf8'), knownIds(content));
    expect(state.xmasBox).toEqual({ 'item.christmas_tree': 1, 'item.xmas_stocking': 3 });
    expect(state.inventory[BOX]).toBe(1);
  });

  it('save antigo (v32) começa com a caixa vazia', () => {
    expect(parseSave(readFileSync('tests/fixtures/save_v32.json', 'utf8'), knownIds(content)).state.xmasBox).toEqual({});
  });
});

describe('caixa de enfeites de Halloween', () => {
  const HW = content.festive.boxes.find((b) => b.tag === 'halloween')!.item;
  const lastAutumnDay = S.daysPerSeason * (S.order.indexOf('autumn') + 1);

  it('no fim do outono, os enfeites de Halloween vão para a caixa deles; os de Natal ficam fora', () => {
    const { session, state } = cafe(lastAutumnDay);
    state.placed.push({ uid: 'p1', item: 'item.hw_pumpkin', at: [3, 6] }, { uid: 'p2', item: 'item.hw_bats', at: [5, 1] });
    state.inventory['item.hw_ghost'] = 1;
    state.inventory['item.xmas_stocking'] = 1;
    session.endDay('home');
    expect(state.placed).toEqual([]);
    expect(state.xmasBox).toEqual({ 'item.hw_pumpkin': 1, 'item.hw_bats': 1, 'item.hw_ghost': 1 });
    expect(state.inventory[HW]).toBe(1);
    expect(state.inventory[BOX]).toBeUndefined();
    expect(state.inventory['item.xmas_stocking']).toBe(1);
    expect(session.xmasBoxCount(HW)).toBe(3);
    expect(session.xmasBoxCount()).toBe(0);
  });

  it('só abre no outono, e cada caixa tira só os seus enfeites', () => {
    const { session, state } = cafe(lastAutumnDay - 3);
    state.xmasBox = { 'item.xmas_lights': 1, 'item.hw_web': 1 };
    state.inventory[HW] = 1;
    state.inventory[BOX] = 1;
    expect(session.openXmasBox()).toEqual({ ok: false, reason: 'box_closed' });
    expect(session.openXmasBox(HW)).toEqual({ ok: true, itemId: 'item.hw_web' });
    expect(state.inventory[HW]).toBeUndefined();
    expect(state.xmasBox).toEqual({ 'item.xmas_lights': 1 });
    expect(state.inventory[BOX]).toBe(1);
  });
});

describe('enfeite fora de época', () => {
  it('pulando do Natal direto para o Halloween (debug), os enfeites de Natal vão para a caixa', () => {
    const { session, state } = cafe(10);
    state.placed.push({ uid: 'p1', item: 'item.christmas_tree', at: [3, 6] });
    state.inventory['item.xmas_wreath'] = 1;
    session.debugFestive('hw_party');
    expect(state.placed.some((p) => p.item === 'item.christmas_tree')).toBe(false);
    expect(state.xmasBox).toMatchObject({ 'item.christmas_tree': 1, 'item.xmas_wreath': 1 });
    expect(state.inventory[BOX]).toBe(1);
  });

  it('save carregado fora do inverno com enfeite de Natal: vai para a caixa ao abrir o jogo', () => {
    const state = newGameState(500, 'map.cafe_main', 9 * 60);
    state.day = S.daysPerSeason + 3;
    state.placed.push({ uid: 'p1', item: 'item.xmas_lights', at: [5, 1] });
    new GameSession(content, state);
    expect(state.placed).toEqual([]);
    expect(state.xmasBox).toEqual({ 'item.xmas_lights': 1 });
  });

  it('na estação da caixa, nada sai do lugar', () => {
    const { session, state } = cafe(10);
    state.placed.push({ uid: 'p1', item: 'item.christmas_tree', at: [3, 6] });
    session.packOutOfSeason();
    expect(state.placed.map((p) => p.item)).toEqual(['item.christmas_tree']);
  });
});
