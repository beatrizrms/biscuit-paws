// Save versionado com migrações. Puro: sem Phaser, DOM ou window.
// Regras em docs/DATA_CONTRACTS.md: só IDs e números; IDs que sumiram são ignorados com aviso.
import type { GameState } from './state';

export const SAVE_SCHEMA_VERSION = 2;

export interface SaveV2 extends GameState {
  schemaVersion: 2;
  savedAt: string;
}

type RawSave = Record<string, unknown>;

/**
 * Migradores: MIGRATIONS[n] transforma um save da versão n na versão n + 1.
 * Ao mudar o formato: suba SAVE_SCHEMA_VERSION, escreva o migrador e guarde
 * um fixture da versão antiga em tests/fixtures/.
 */
const MIGRATIONS: Record<number, (save: RawSave) => RawSave> = {
  /** v1 -> v2: entra a reforma do pintor (superfície -> acabamento). Saves antigos começam sem reforma. */
  1: (save) => ({ ...save, schemaVersion: 2, finishes: {} }),
};

export function serializeSave(state: GameState, now: Date): string {
  const save: SaveV2 = { schemaVersion: 2, savedAt: now.toISOString(), ...state };
  return JSON.stringify(save);
}

export interface LoadResult {
  state: GameState;
  warnings: string[];
}

/** IDs que existem no conteúdo atual (o resto é ignorado ao carregar). */
export interface KnownIds {
  items: ReadonlySet<string>;
  finishes: ReadonlySet<string>;
  surfaces: ReadonlySet<string>;
}

/** Lê um save de qualquer versão conhecida e devolve o estado atual. */
export function parseSave(json: string, known: KnownIds): LoadResult {
  let save = JSON.parse(json) as RawSave;
  let version = Number(save.schemaVersion);
  if (!Number.isInteger(version) || version < 1) throw new Error('Save sem schemaVersion válida');
  if (version > SAVE_SCHEMA_VERSION) throw new Error(`Save da versão ${version}, mais nova que este jogo (${SAVE_SCHEMA_VERSION})`);
  while (version < SAVE_SCHEMA_VERSION) {
    const migrate = MIGRATIONS[version];
    if (!migrate) throw new Error(`Falta o migrador da versão ${version}`);
    save = migrate(save);
    version++;
  }

  const v2 = save as unknown as Partial<SaveV2>;
  const warnings: string[] = [];
  const knownItem = (id: string, where: string) => {
    if (known.items.has(id)) return true;
    warnings.push(`${where}: item "${id}" não existe mais; ignorado`);
    return false;
  };

  const inventory: Record<string, number> = {};
  for (const [id, qty] of Object.entries(v2.inventory ?? {})) {
    if (knownItem(id, 'inventário') && qty > 0) inventory[id] = qty;
  }

  const finishes: Record<string, string> = {};
  for (const [surface, finish] of Object.entries(v2.finishes ?? {})) {
    if (known.surfaces.has(surface) && known.finishes.has(finish)) finishes[surface] = finish;
    else warnings.push(`reforma: "${surface}" -> "${finish}" não existe mais; volta ao original`);
  }

  const state: GameState = {
    day: v2.day ?? 1,
    money: v2.money ?? 0,
    flags: { ...(v2.flags ?? {}) },
    inventory,
    placed: (v2.placed ?? []).filter((p) => knownItem(p.item, `móvel ${p.uid}`)).map((p) => ({ ...p, at: [p.at[0], p.at[1]] })),
    nextUid: v2.nextUid ?? 1,
    story: { completed: [...(v2.story?.completed ?? [])] },
    cats: { ...(v2.cats ?? {}) },
    finishes,
  };
  return { state, warnings };
}

/** Os IDs conhecidos a partir do conteúdo. */
export function knownIds(content: {
  items: Record<string, unknown>;
  finishes: Record<string, unknown>;
  map: { surfaces?: { id: string }[] };
}): KnownIds {
  return {
    items: new Set(Object.keys(content.items)),
    finishes: new Set(Object.keys(content.finishes)),
    surfaces: new Set((content.map.surfaces ?? []).map((s) => s.id)),
  };
}
