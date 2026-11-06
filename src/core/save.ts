// Save versionado com migrações. Puro: sem Phaser, DOM ou window.
// Regras em docs/DATA_CONTRACTS.md: só IDs e números; IDs que sumiram são ignorados com aviso.
import type { GameState } from './state';

export const SAVE_SCHEMA_VERSION = 1;

export interface SaveV1 extends GameState {
  schemaVersion: 1;
  savedAt: string;
}

/**
 * Migradores: MIGRATIONS[n] transforma um save da versão n na versão n + 1.
 * Ao mudar o formato: suba SAVE_SCHEMA_VERSION, escreva o migrador e guarde
 * um fixture da versão antiga em tests/fixtures/.
 */
const MIGRATIONS: Record<number, (save: Record<string, unknown>) => Record<string, unknown>> = {};

export function serializeSave(state: GameState, now: Date): string {
  const save: SaveV1 = { schemaVersion: 1, savedAt: now.toISOString(), ...state };
  return JSON.stringify(save);
}

export interface LoadResult {
  state: GameState;
  warnings: string[];
}

/** Lê um save de qualquer versão conhecida e devolve o estado atual. */
export function parseSave(json: string, knownItems: ReadonlySet<string>): LoadResult {
  let save = JSON.parse(json) as Record<string, unknown>;
  let version = Number(save.schemaVersion);
  if (!Number.isInteger(version) || version < 1) throw new Error('Save sem schemaVersion válida');
  if (version > SAVE_SCHEMA_VERSION) throw new Error(`Save da versão ${version}, mais nova que este jogo (${SAVE_SCHEMA_VERSION})`);
  while (version < SAVE_SCHEMA_VERSION) {
    const migrate = MIGRATIONS[version];
    if (!migrate) throw new Error(`Falta o migrador da versão ${version}`);
    save = migrate(save);
    version++;
  }

  const v1 = save as unknown as Partial<SaveV1>;
  const warnings: string[] = [];
  const known = (id: string, where: string) => {
    if (knownItems.has(id)) return true;
    warnings.push(`${where}: item "${id}" não existe mais; ignorado`);
    return false;
  };

  const inventory: Record<string, number> = {};
  for (const [id, qty] of Object.entries(v1.inventory ?? {})) {
    if (known(id, 'inventário') && qty > 0) inventory[id] = qty;
  }

  const state: GameState = {
    day: v1.day ?? 1,
    money: v1.money ?? 0,
    flags: { ...(v1.flags ?? {}) },
    inventory,
    placed: (v1.placed ?? []).filter((p) => known(p.item, `móvel ${p.uid}`)).map((p) => ({ ...p, at: [p.at[0], p.at[1]] })),
    nextUid: v1.nextUid ?? 1,
    story: { completed: [...(v1.story?.completed ?? [])] },
    cats: { ...(v1.cats ?? {}) },
  };
  return { state, warnings };
}
