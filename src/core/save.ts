// Save versionado com migrações. Puro: sem Phaser, DOM ou window.
// Regras em docs/DATA_CONTRACTS.md: só IDs e números; IDs que sumiram são ignorados com aviso.
import type { HandItem } from './carry';
import type { GameState } from './state';

export const SAVE_SCHEMA_VERSION = 8;

export interface SaveV8 extends GameState {
  schemaVersion: 8;
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
  /** v2 -> v3: entram a rua e a sujeira. Saves antigos estavam dentro do café, que fica sem sujeira (já arrumado). */
  2: (save) => ({ ...save, schemaVersion: 3, location: 'map.cafe_main', visited: ['map.street', 'map.cafe_main'], cleaned: ['*'] }),
  /** v3 -> v4: gatos com nome e mapa; corações entre pares. Saves antigos não tinham gatos. */
  3: (save) => ({ ...save, schemaVersion: 4, cats: {}, relationships: {} }),
  /** v4 -> v5: hora do dia (ciclo dia/noite). Saves antigos ficam às 8h. */
  4: (save) => ({ ...save, schemaVersion: 5, time: 8 * 60 }),
  /** v5 -> v6: dia em que cada marco terminou, relógios da história, resumo do dia e pedidos da vila. */
  5: (save) => ({
    ...save,
    schemaVersion: 6,
    story: { ...(save.story as object), completedOn: {} },
    timers: {},
    today: { earned: 0, jobs: 0 },
    jobs: { active: [], progress: {}, doneOn: {} },
  }),
  /** v6 -> v7: compras do catálogo chegam pelo correio. Saves antigos não têm entregas. */
  6: (save) => ({ ...save, schemaVersion: 7, deliveries: [] }),
  /** v7 -> v8: cardápio, doses abertas, louça, mãos, superfícies e atendimento. A louça da Gabi entra no estoque ao abrir o jogo. */
  7: (save) => ({
    ...save,
    schemaVersion: 8,
    menu: [],
    pantryOpen: {},
    dishes: { cup: 0, glass: 0, plate: 0 },
    hands: [],
    surfaces: [],
    service: { customers: [], preps: [], nextCustomerAt: null, nextCustomerId: 1, served: 0 },
  }),
};

export function serializeSave(state: GameState, now: Date): string {
  const save: SaveV8 = { schemaVersion: 8, savedAt: now.toISOString(), ...state };
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
  maps: ReadonlySet<string>;
  cats: ReadonlySet<string>;
  jobs: ReadonlySet<string>;
  recipes: ReadonlySet<string>;
  /** Onde começar se o local salvo não existir mais. */
  startMap: string;
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

  const v2 = save as unknown as Partial<SaveV8>;
  const warnings: string[] = [];
  const knownItem = (id: string, where: string) => {
    if (known.items.has(id)) return true;
    warnings.push(`${where}: item "${id}" não existe mais; ignorado`);
    return false;
  };

  // Bebida de receita que sumiu ou item que sumiu: o objeto da mão/superfície é ignorado.
  const knownHand = (h: HandItem) =>
    h.kind === 'item' ? known.items.has(h.item) : h.kind === 'drink' ? known.recipes.has(h.recipe) : true;
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
    time: typeof v2.time === 'number' && v2.time >= 0 ? v2.time : 8 * 60,
    money: v2.money ?? 0,
    flags: { ...(v2.flags ?? {}) },
    inventory,
    placed: (v2.placed ?? []).filter((p) => knownItem(p.item, `móvel ${p.uid}`)).map((p) => ({ ...p, at: [p.at[0], p.at[1]] })),
    nextUid: v2.nextUid ?? 1,
    story: { completed: [...(v2.story?.completed ?? [])], completedOn: { ...(v2.story?.completedOn ?? {}) } },
    cats: Object.fromEntries(
      Object.entries(v2.cats ?? {}).filter(([id]) => {
        if (known.cats.has(id)) return true;
        warnings.push(`gato "${id}" não existe mais; ignorado`);
        return false;
      }),
    ),
    relationships: { ...(v2.relationships ?? {}) },
    finishes,
    location: v2.location && known.maps.has(v2.location) ? v2.location : known.startMap,
    visited: (v2.visited ?? []).filter((m) => known.maps.has(m)),
    cleaned: [...(v2.cleaned ?? [])],
    timers: { ...(v2.timers ?? {}) },
    today: { earned: v2.today?.earned ?? 0, jobs: v2.today?.jobs ?? 0 },
    jobs: {
      active: (v2.jobs?.active ?? []).filter((id) => {
        if (known.jobs.has(id)) return true;
        warnings.push(`pedido "${id}" não existe mais; ignorado`);
        return false;
      }),
      progress: Object.fromEntries(Object.entries(v2.jobs?.progress ?? {}).filter(([id]) => known.jobs.has(id))),
      doneOn: Object.fromEntries(Object.entries(v2.jobs?.doneOn ?? {}).filter(([id]) => known.jobs.has(id))),
    },
    deliveries: (v2.deliveries ?? []).filter((d) => knownItem(d.item, `entrega ${d.uid}`)).map((d) => ({ ...d })),
    menu: (v2.menu ?? []).filter((id) => {
      if (known.recipes.has(id)) return true;
      warnings.push(`cardápio: receita "${id}" não existe mais; saiu do quadro`);
      return false;
    }),
    pantryOpen: Object.fromEntries(Object.entries(v2.pantryOpen ?? {}).filter(([id]) => known.items.has(id))),
    dishes: { cup: v2.dishes?.cup ?? 0, glass: v2.dishes?.glass ?? 0, plate: v2.dishes?.plate ?? 0 },
    hands: (v2.hands ?? []).filter((h) => knownHand(h)),
    surfaces: (v2.surfaces ?? []).filter((s) => knownHand(s.item)).map((s) => ({ at: [s.at[0], s.at[1]] as [number, number], item: s.item })),
    service: {
      customers: (v2.service?.customers ?? []).filter((c) => !c.recipe || known.recipes.has(c.recipe)),
      preps: (v2.service?.preps ?? []).filter((p) => known.recipes.has(p.recipe)),
      nextCustomerAt: v2.service?.nextCustomerAt ?? null,
      nextCustomerId: v2.service?.nextCustomerId ?? 1,
      served: v2.service?.served ?? 0,
    },
  };
  if (v2.location && !known.maps.has(v2.location)) warnings.push(`local "${v2.location}" não existe mais; volta ao início`);
  return { state, warnings };
}

/** Os IDs conhecidos a partir do conteúdo. */
export function knownIds(content: {
  items: Record<string, unknown>;
  finishes: Record<string, unknown>;
  map: { surfaces?: { id: string }[] };
  maps: Record<string, unknown>;
  cats: Record<string, unknown>;
  jobs: Record<string, unknown>;
  recipes: Record<string, unknown>;
  world: { startMap: string };
}): KnownIds {
  return {
    items: new Set(Object.keys(content.items)),
    finishes: new Set(Object.keys(content.finishes)),
    surfaces: new Set((content.map.surfaces ?? []).map((s) => s.id)),
    maps: new Set(Object.keys(content.maps)),
    cats: new Set(Object.keys(content.cats)),
    jobs: new Set(Object.keys(content.jobs)),
    recipes: new Set(Object.keys(content.recipes)),
    startMap: content.world.startMap,
  };
}
