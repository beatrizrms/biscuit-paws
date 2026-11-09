import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { knownIds, parseSave, SAVE_SCHEMA_VERSION, serializeSave } from '../../src/core/save';
import { GameSession } from '../../src/core/session';
import { newGameState } from '../../src/core/state';
import { loadContent } from './content';

const content = loadContent();
const known = knownIds(content);

describe('save', () => {
  it('ida e volta preserva o estado', () => {
    const session = new GameSession(content, newGameState(500));
    session.start(true);
    session.finishCutscene('cs.prologue_thoughts');
    session.buy('item.cat_bed');
    session.place('item.cat_bed', [12, 9]);
    session.buy('item.cactus');
    session.state.finishes['surface.hall_floor'] = 'finish.wood_planks';

    const json = serializeSave(session.state, new Date('2026-12-01T10:00:00Z'));
    const saved = JSON.parse(json);
    expect(saved.schemaVersion).toBe(SAVE_SCHEMA_VERSION);
    expect(saved.savedAt).toBe('2026-12-01T10:00:00.000Z');

    const { state, warnings } = parseSave(json, known);
    expect(warnings).toEqual([]);
    expect(state).toEqual(session.state);
  });

  it('o save só tem números, textos, booleanos, listas e objetos simples', () => {
    const json = serializeSave(newGameState(150), new Date(0));
    const check = (v: unknown): boolean =>
      v === null ||
      ['number', 'string', 'boolean'].includes(typeof v) ||
      (Array.isArray(v) ? v.every(check) : typeof v === 'object' && Object.values(v as object).every(check));
    expect(check(JSON.parse(json))).toBe(true);
  });

  it('recusa save de versão mais nova que o jogo', () => {
    expect(() => parseSave(JSON.stringify({ schemaVersion: 999 }), known)).toThrow(/mais nova/);
  });

  it('recusa save sem versão', () => {
    expect(() => parseSave('{}', known)).toThrow(/schemaVersion/);
  });
});

describe('fixtures de saves antigos (todos precisam continuar carregando)', () => {
  const fixtures = readdirSync('tests/fixtures').filter((f) => f.startsWith('save_'));

  it('existe um fixture para cada versão até a atual', () => {
    for (let v = 1; v <= SAVE_SCHEMA_VERSION; v++) expect(fixtures).toContain(`save_v${v}.json`);
  });

  it.each(fixtures)('%s carrega', (file) => {
    const { state } = parseSave(readFileSync(`tests/fixtures/${file}`, 'utf8'), known);
    // E a sessão aceita o estado carregado.
    const session = new GameSession(content, state);
    expect(() => session.start(false)).not.toThrow();
    expect(() => session.mapData()).not.toThrow();
  });

  it('save_v1: migra para v2 sem reforma; itens que não existem mais são ignorados com aviso', () => {
    const { state, warnings } = parseSave(readFileSync('tests/fixtures/save_v1.json', 'utf8'), known);
    expect(state.money).toBe(76);
    expect(state.inventory).toEqual({ 'item.cushion_pink': 1 });
    expect(state.placed.map((p) => p.uid)).toEqual(['p1', 'p2']);
    expect(state.nextUid).toBe(4);
    expect(state.finishes).toEqual({});
    expect(warnings).toHaveLength(2);
  });

  it('save_v1 e v2 migram para v3 dentro do café, já limpo', () => {
    for (const file of ['save_v1.json', 'save_v2.json']) {
      const { state } = parseSave(readFileSync(`tests/fixtures/${file}`, 'utf8'), known);
      expect(state.location).toBe('map.cafe_main');
      expect(state.visited).toEqual(['map.street', 'map.cafe_main']);
      expect(state.cleaned).toEqual(['*']);
    }
  });

  it('save_v3: local que não existe mais volta para o início do jogo', () => {
    const { state, warnings } = parseSave(readFileSync('tests/fixtures/save_v3.json', 'utf8'), known);
    expect(state.location).toBe('map.street');
    expect(state.cleaned).toEqual(['dirt.web_window_left']);
    expect(warnings.join()).toMatch(/map.lighthouse_that_was_removed/);
  });

  it('save_v3 migra para v4 sem gatos e sem corações', () => {
    const { state } = parseSave(readFileSync('tests/fixtures/save_v3.json', 'utf8'), known);
    expect(state.cats).toEqual({});
    expect(state.relationships).toEqual({});
  });

  it('save_v4: guarda nome e corações; gato que sumiu dos dados é ignorado', () => {
    const { state, warnings } = parseSave(readFileSync('tests/fixtures/save_v4.json', 'utf8'), known);
    expect(state.cats).toEqual({ 'cat.first_stray': { sheltered: true, name: 'Pipoca', map: 'map.cafe_main', shelteredOn: 1, health: 80, sickness: null, happiness: 70, hygiene: 70 } });
    expect(state.relationships['player|cat.first_stray']).toBe(120);
    expect(warnings.join()).toMatch(/cat.lost_forever/);
  });

  it('save_v4 migra para v5 às 8h da manhã', () => {
    const { state } = parseSave(readFileSync('tests/fixtures/save_v4.json', 'utf8'), known);
    expect(state.time).toBe(8 * 60);
  });

  it('save_v5: guarda a hora do dia', () => {
    const { state, warnings } = parseSave(readFileSync('tests/fixtures/save_v5.json', 'utf8'), known);
    expect(warnings).toEqual([]);
    expect(state.day).toBe(2);
    expect(state.time).toBe(17 * 60 + 30);
  });

  it('save_v5 migra para v6 sem pedidos e sem relógios', () => {
    const { state } = parseSave(readFileSync('tests/fixtures/save_v5.json', 'utf8'), known);
    expect(state.timers).toEqual({});
    expect(state.today).toEqual({ earned: 0, jobs: 0 });
    expect(state.jobs).toEqual({ active: [], progress: {}, doneOn: {} });
    expect(state.story.completedOn).toEqual({});
  });

  it('save_v6: guarda pedidos, relógios e o resumo do dia; pedido que sumiu é ignorado', () => {
    const { state, warnings } = parseSave(readFileSync('tests/fixtures/save_v6.json', 'utf8'), known);
    expect(state.jobs.active).toEqual(['job.delivery']);
    expect(state.jobs.progress).toEqual({ 'job.delivery': ['pt.parcel_pickup'] });
    expect(state.timers['gabi.arrival']).toBe(3 * 1440 + 690);
    expect(state.today).toEqual({ earned: 25, jobs: 1 });
    expect(warnings.join()).toMatch(/job.removed_from_game/);
  });

  it('save_v6 migra para v7 sem entregas', () => {
    const { state } = parseSave(readFileSync('tests/fixtures/save_v6.json', 'utf8'), known);
    expect(state.deliveries).toEqual([]);
  });

  it('save_v7: guarda as entregas; item que sumiu é ignorado', () => {
    const { state, warnings } = parseSave(readFileSync('tests/fixtures/save_v7.json', 'utf8'), known);
    expect(state.deliveries.map((d) => [d.item, d.stage])).toEqual([['item.table_round', 'door'], ['item.cactus', 'shipping']]);
    expect(warnings.join()).toMatch(/item.lamp_removed_from_game/);
  });

  it('save_v7 migra para v8 sem cardápio, mãos vazias e atendimento zerado', () => {
    const { state } = parseSave(readFileSync('tests/fixtures/save_v7.json', 'utf8'), known);
    expect(state.menu).toEqual([]);
    expect(state.hands).toEqual([]);
    expect(state.dishes).toEqual({ cup: 0, glass: 0, plate: 0 });
    expect(state.service.customers).toEqual([]);
  });

  it('save_v8: guarda cardápio, doses, louça, mãos, superfícies e clientes; receita que sumiu é ignorada', () => {
    const { state, warnings } = parseSave(readFileSync('tests/fixtures/save_v8.json', 'utf8'), known);
    expect(state.menu).toEqual(['recipe.black_coffee']);
    expect(state.pantryOpen).toEqual({ 'item.coffee_ground': 7 });
    expect(state.dishes).toEqual({ cup: 1, glass: 2, plate: 2 });
    expect(state.hands).toEqual([{ kind: 'dirty', vessel: 'cup' }]);
    expect(state.surfaces).toHaveLength(1);
    expect(state.service.customers.map((c) => c.id)).toEqual(['c3']);
    expect(state.service.served).toBe(2);
    expect(warnings.join()).toMatch(/recipe.removed_from_game/);
  });

  it('save_v8 migra para v9 sem bandeja, pia vazia e preparos na primeira etapa', () => {
    const { state } = parseSave(readFileSync('tests/fixtures/save_v8.json', 'utf8'), known);
    expect(state.tray).toBe(false);
    expect(state.sink).toEqual({ load: { cup: 0, glass: 0, plate: 0 }, washing: null });
    expect(state.service.customers[0]).toMatchObject({ favorite: null, wantsPremium: false });
  });

  it('save_v9: guarda bandeja, pia, etapas e preferências', () => {
    const { state, warnings } = parseSave(readFileSync('tests/fixtures/save_v9.json', 'utf8'), known);
    expect(warnings.join()).not.toMatch(/sink|bandeja/);
    expect(state.tray).toBe(true);
    expect(state.hands[1]).toMatchObject({ kind: 'drink', quality: 'premium' });
    expect(state.sink.washing?.load.glass).toBe(1);
    expect(state.service.preps[0]).toMatchObject({ recipe: 'recipe.cheese_bread', step: 1 });
    expect(state.service.customers[0]).toMatchObject({ favorite: 'recipe.black_coffee', wantsPremium: true });
  });

  it('save_v9: migra para v10 com a barra vazia; a vassoura entra sozinha ao abrir', () => {
    const save = JSON.parse(readFileSync('tests/fixtures/save_v9.json', 'utf8'));
    save.inventory = { ...save.inventory, 'item.broom': 1 };
    const { state } = parseSave(JSON.stringify(save), known);
    expect(state.hotbar).toEqual({ slots: Array(8).fill(null), active: 0 });
    const session = new GameSession(content, state);
    expect(session.state.hotbar.slots[0]).toBe('item.broom');
    expect(session.activeItem()).toBe('item.broom');
  });

  it('save_v10: guarda a barra; item que sumiu deixa o espaço vazio', () => {
    const { state } = parseSave(readFileSync('tests/fixtures/save_v10.json', 'utf8'), known);
    expect(state.hotbar.slots.slice(0, 3)).toEqual(['item.broom', null, null]);
    expect(state.hotbar.active).toBe(1);
  });

  it('save_v11: guarda o estágio do negócio; valor estranho volta a "fechado"', () => {
    const raw = readFileSync('tests/fixtures/save_v11.json', 'utf8');
    expect(parseSave(raw, known).state.business).toBe('soft_open');
    const broken = JSON.stringify({ ...JSON.parse(raw), business: 'aberto_demais' });
    expect(parseSave(broken, known).state.business).toBe('closed');
  });

  it('save_v10 -> v11: começa fechado; com o mínimo no café, a sessão passa a funcionamento parcial', () => {
    const { state } = parseSave(readFileSync('tests/fixtures/save_v10.json', 'utf8'), known);
    expect(state.business).toBe('closed');
    const beats = content.story.beats.map((x) => x.id);
    state.story.completed = beats.slice(0, beats.indexOf('story.chairs') + 1);
    state.placed.push({ uid: 'p90', item: 'item.counter_single', at: [7, 5] }, { uid: 'p91', item: 'item.coffee_machine', at: [7, 5] }, { uid: 'p92', item: 'item.table_round', at: [10, 8] }, { uid: 'p93', item: 'item.chair_front', at: [11, 8] });
    const session = new GameSession(content, state);
    session.start(false);
    expect(session.state.business).toBe('soft_open');
  });

  it('save_v12: migra para v13; o gato do prólogo chegou no dia 1', () => {
    const { state } = parseSave(readFileSync('tests/fixtures/save_v12.json', 'utf8'), known);
    expect(state.cats['cat.first_stray']?.shelteredOn).toBe(1);
  });

  it('save_v13: guarda o dia em que o gato foi abrigado', () => {
    const { state } = parseSave(readFileSync('tests/fixtures/save_v13.json', 'utf8'), known);
    expect(state.cats['cat.first_stray']?.shelteredOn).toBe(2);
  });

  it('save_v2: mantém a reforma válida e descarta acabamento que sumiu', () => {
    const { state, warnings } = parseSave(readFileSync('tests/fixtures/save_v2.json', 'utf8'), known);
    expect(state.finishes).toEqual({ 'surface.hall_floor': 'finish.check_pink' });
    expect(warnings.join()).toMatch(/finish.wallpaper_that_was_removed/);
  });
});

describe('save v19: tutorial da dica "E"', () => {
  it('v19 guarda quantas vezes usou cada tipo; v18 começa o tutorial do zero; lixo é ignorado', () => {
    const v19 = parseSave(readFileSync('tests/fixtures/save_v19.json', 'utf8'), known).state;
    expect(v19.hintUses).toEqual({ dirt: 3, int_shelf: 1 });
    const v18 = parseSave(readFileSync('tests/fixtures/save_v18.json', 'utf8'), known).state;
    expect(v18.hintUses).toEqual({});
    const bad = JSON.parse(readFileSync('tests/fixtures/save_v19.json', 'utf8'));
    bad.hintUses = { dirt: 'muito', bowl: -1, cat_pickup: 2 };
    expect(parseSave(JSON.stringify(bad), known).state.hintUses).toEqual({ cat_pickup: 2 });
  });
});
