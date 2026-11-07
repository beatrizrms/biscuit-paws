// Slots de save: 3 manuais + autosave. Resumo de cada slot, saves corrompidos e validação de importação.
// Puro: sem Phaser, DOM ou window. Quem lê e grava é o SaveManager (src/game), pelo src/platform/storage.
import { parseSave, type KnownIds, type LoadResult } from './save';
import type { GameState } from './state';

export const MANUAL_SLOTS = ['slot1', 'slot2', 'slot3'] as const;
export const AUTO_SLOT = 'auto';
export type ManualSlot = (typeof MANUAL_SLOTS)[number];
export type SlotId = ManualSlot | typeof AUTO_SLOT;
export const ALL_SLOTS: readonly SlotId[] = [...MANUAL_SLOTS, AUTO_SLOT];

/** Chave do backup (a versão anterior) de um slot. */
export const backupKey = (slot: SlotId): string => `${slot}.bak`;

/** O que a tela de slots mostra de cada save. */
export interface SlotSummary {
  day: number;
  /** Minutos desde 00:00. */
  time: number;
  money: number;
  cats: number;
  /** Data em que foi salvo (ISO), ou null se o save não tiver. */
  savedAt: string | null;
}

export type SlotStatus =
  | { kind: 'empty' }
  | { kind: 'ok'; summary: SlotSummary }
  /** Não deu para ler: o jogo não trava, a tela oferece restaurar o backup ou apagar. */
  | { kind: 'corrupt'; error: string };

export function summaryOf(state: GameState, savedAt: string | null): SlotSummary {
  return {
    day: state.day,
    time: state.time,
    money: state.money,
    cats: Object.values(state.cats).filter((c) => c.sheltered).length,
    savedAt,
  };
}

/** Lê o save (qualquer versão conhecida) sem jogar erro: vazio, ok (com resumo) ou corrompido. */
export function inspectSave(json: string | null, known: KnownIds): SlotStatus {
  if (json === null || json === '') return { kind: 'empty' };
  const r = readSave(json, known);
  return r.ok ? { kind: 'ok', summary: summaryOf(r.state, r.savedAt) } : { kind: 'corrupt', error: r.error };
}

export type ReadResult = ({ ok: true; savedAt: string | null } & LoadResult) | { ok: false; error: string };

/**
 * Valida e carrega um save vindo de qualquer lugar (slot, backup ou arquivo importado).
 * Aceita só um objeto JSON com `schemaVersion` conhecida que passe pelas migrações.
 */
export function readSave(json: string, known: KnownIds): ReadResult {
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    return { ok: false, error: 'não é um JSON válido' };
  }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return { ok: false, error: 'não é um save do jogo' };
  const obj = raw as Record<string, unknown>;
  if (typeof obj.schemaVersion !== 'number') return { ok: false, error: 'sem schemaVersion' };
  try {
    const result = parseSave(json, known);
    if (!isPlausible(result.state)) return { ok: false, error: 'dados incompletos' };
    return { ok: true, savedAt: typeof obj.savedAt === 'string' ? obj.savedAt : null, ...result };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/** Confere o mínimo para o jogo não quebrar ao abrir. */
function isPlausible(s: GameState): boolean {
  return Number.isFinite(s.day) && s.day >= 1 && Number.isFinite(s.time) && Number.isFinite(s.money) && typeof s.location === 'string';
}

/** O slot salvo mais recentemente (só os que estão ok). */
export function mostRecent(statuses: Partial<Record<SlotId, SlotStatus>>): SlotId | null {
  let best: { slot: SlotId; at: number } | null = null;
  for (const slot of ALL_SLOTS) {
    const s = statuses[slot];
    if (s?.kind !== 'ok') continue;
    const at = s.summary.savedAt ? Date.parse(s.summary.savedAt) : 0;
    if (!best || at > best.at) best = { slot, at };
  }
  return best?.slot ?? null;
}
