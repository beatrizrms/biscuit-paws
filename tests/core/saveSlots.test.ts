import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { knownIds, serializeSave } from '../../src/core/save';
import { inspectSave, mostRecent, readSave, type SlotStatus } from '../../src/core/saveSlots';
import { DEFAULT_SETTINGS, effectiveVolume, parseSettings, serializeSettings } from '../../src/core/settings';
import { newGameState } from '../../src/core/state';
import type { Storage } from '../../src/platform/storage';
import { SaveManager } from '../../src/game/SaveManager';
import { loadContent } from './content';

const content = loadContent();
const known = knownIds(content);
const save = (day: number, at: string) => {
  const s = newGameState(100);
  s.day = day;
  return serializeSave(s, new Date(at));
};

/** Armazenamento na memória, para testar o SaveManager sem navegador. */
class MemoryStorage implements Storage {
  data = new Map<string, string>();
  async load(k: string) {
    return this.data.get(k) ?? null;
  }
  async save(k: string, v: string) {
    this.data.set(k, v);
  }
  async remove(k: string) {
    this.data.delete(k);
  }
  async list() {
    return [...this.data.keys()];
  }
}

describe('slots de save', () => {
  it('vazio, ok (com resumo) ou corrompido, sem jogar erro', () => {
    expect(inspectSave(null, known)).toEqual({ kind: 'empty' });
    const ok = inspectSave(save(3, '2026-12-01T10:00:00Z'), known);
    expect(ok).toEqual({ kind: 'ok', summary: { day: 3, time: 7 * 60, money: 100, cats: 0, savedAt: '2026-12-01T10:00:00.000Z' } });
    expect(inspectSave('{ isso não é json', known).kind).toBe('corrupt');
    expect(inspectSave('{"schemaVersion": 999}', known).kind).toBe('corrupt');
    expect(inspectSave('[]', known).kind).toBe('corrupt');
  });

  it('todos os fixtures antigos passam pela validação de importação', () => {
    for (let v = 1; v <= 9; v++) {
      const r = readSave(readFileSync(`tests/fixtures/save_v${v}.json`, 'utf8'), known);
      expect(r.ok).toBe(true);
    }
  });

  it('importar recusa o que não é save do jogo', () => {
    expect(readSave('{"nome": "foto da Tekinha"}', known)).toEqual({ ok: false, error: 'sem schemaVersion' });
    expect(readSave('"texto"', known).ok).toBe(false);
  });

  it('"Continuar" pega o save ok mais recente (pula vazio e corrompido)', () => {
    const ok = (savedAt: string): SlotStatus => ({ kind: 'ok', summary: { day: 1, time: 0, money: 0, cats: 0, savedAt } });
    expect(mostRecent({ slot1: ok('2026-01-01T00:00:00Z'), slot2: ok('2026-02-01T00:00:00Z'), slot3: { kind: 'corrupt', error: 'x' }, auto: { kind: 'empty' } })).toBe('slot2');
    expect(mostRecent({ slot1: { kind: 'empty' } })).toBeNull();
  });
});

describe('SaveManager', () => {
  it('ao salvar, a versão anterior vira backup; restaurar troca os dois', async () => {
    const st = new MemoryStorage();
    const m = new SaveManager(st);
    const a = newGameState(100);
    await m.write('slot1', a, new Date('2026-01-01T00:00:00Z'));
    expect(await m.hasBackup('slot1')).toBe(false);
    const b = { ...a, day: 5 };
    await m.write('slot1', b, new Date('2026-01-02T00:00:00Z'));
    expect(await m.hasBackup('slot1')).toBe(true);
    expect(((await m.status('slot1')) as { summary: { day: number } }).summary.day).toBe(5);
    expect(await m.restoreBackup('slot1')).toBe(true);
    expect(((await m.status('slot1')) as { summary: { day: number } }).summary.day).toBe(1);
    // O que estava antes de restaurar vira o backup (dá para desfazer).
    expect(await m.restoreBackup('slot1')).toBe(true);
    expect(((await m.status('slot1')) as { summary: { day: number } }).summary.day).toBe(5);
  });

  it('save corrompido: aparece como corrompido, o backup salva o dia, apagar limpa tudo', async () => {
    const st = new MemoryStorage();
    const m = new SaveManager(st);
    await m.write('slot2', newGameState(100));
    await m.write('slot2', { ...newGameState(100), day: 2 }); // o primeiro vira backup
    await st.save('slot2', '{ quebrado');
    expect((await m.status('slot2')).kind).toBe('corrupt');
    expect((await m.read('slot2')).ok).toBe(false);
    expect(await m.restoreBackup('slot2')).toBe(true);
    expect((await m.status('slot2')).kind).toBe('ok');
    await m.remove('slot2');
    expect((await m.status('slot2')).kind).toBe('empty');
    expect(await m.hasBackup('slot2')).toBe(false);
  });

  it('importar só aceita save válido; o atual vira backup', async () => {
    const m = new SaveManager(new MemoryStorage());
    await m.write('slot3', newGameState(100));
    expect(await m.importJson('slot3', '{"oi":1}')).toEqual({ ok: false, error: 'sem schemaVersion' });
    expect(await m.importJson('slot3', readFileSync('tests/fixtures/save_v4.json', 'utf8'))).toEqual({ ok: true });
    expect(await m.hasBackup('slot3')).toBe(true);
    expect((await m.read('slot3')).ok).toBe(true);
  });

  it('autosave lembra o slot de origem; "Continuar" pega o mais recente', async () => {
    const m = new SaveManager(new MemoryStorage());
    await m.write('slot1', newGameState(100), new Date('2026-01-01T00:00:00Z'));
    await m.autosave(newGameState(100), 'slot2', new Date('2026-01-03T00:00:00Z'));
    expect(await m.mostRecent()).toBe('auto');
    expect(await m.autoOrigin()).toBe('slot2');
  });

  it('o modo debug tem slots próprios e herda o save antigo do debug', async () => {
    const st = new MemoryStorage();
    await st.save('slot-debug', save(7, '2026-01-01T00:00:00Z'));
    const debug = new SaveManager(st, 'debug-');
    await debug.migrateLegacy();
    expect(((await debug.status('slot1')) as { summary: { day: number } }).summary.day).toBe(7);
    expect((await new SaveManager(st).status('slot1')).kind).toBe('empty');
  });
});

describe('configurações de som', () => {
  it('lê, corrige valores estranhos e volta ao padrão se quebrar', () => {
    expect(parseSettings(null)).toEqual(DEFAULT_SETTINGS);
    expect(parseSettings('lixo')).toEqual(DEFAULT_SETTINGS);
    const s = parseSettings('{"music":{"on":false,"volume":3},"ambient":{"volume":-1}}');
    expect(s.music).toEqual({ on: false, volume: 1 });
    expect(s.ambient).toEqual({ on: true, volume: 0 });
    expect(parseSettings(serializeSettings(s))).toEqual(s);
  });

  it('desligado toca em volume 0', () => {
    expect(effectiveVolume({ on: false, volume: 0.8 })).toBe(0);
    expect(effectiveVolume({ on: true, volume: 0.8 })).toBe(0.8);
  });
});
