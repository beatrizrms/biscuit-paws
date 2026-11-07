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
    session.paint('surface.hall_floor', 'finish.wood_planks');

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
    expect(state.cats).toEqual({ 'cat.first_stray': { sheltered: true, name: 'Pipoca', map: 'map.cafe_main' } });
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

  it('save_v2: mantém a reforma válida e descarta acabamento que sumiu', () => {
    const { state, warnings } = parseSave(readFileSync('tests/fixtures/save_v2.json', 'utf8'), known);
    expect(state.finishes).toEqual({ 'surface.hall_floor': 'finish.check_pink' });
    expect(warnings.join()).toMatch(/finish.wallpaper_that_was_removed/);
  });
});
