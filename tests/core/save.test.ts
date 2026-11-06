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

  it('save_v2: mantém a reforma válida e descarta acabamento que sumiu', () => {
    const { state, warnings } = parseSave(readFileSync('tests/fixtures/save_v2.json', 'utf8'), known);
    expect(state.finishes).toEqual({ 'surface.hall_floor': 'finish.check_pink' });
    expect(warnings.join()).toMatch(/finish.wallpaper_that_was_removed/);
  });
});
