// Save versionado com migrações. Puro: sem Phaser, DOM ou window.
// Regras em docs/DATA_CONTRACTS.md: só IDs e números; IDs que sumiram são ignorados com aviso.
import { newConstruction, type ConstructionState } from './construction';
import type { HandItem } from './carry';
import { HOTBAR_SIZE, newHotbar } from './hotbar';
import type { GameState, PlacedItem } from './state';
import { DEFAULT_PRONOUN, isPronoun } from './pronoun';
import { isBusinessStage } from './business';
import { cleanPlayerName, normalizeAppearance, type CharacterData } from './appearance';
import { normalizeRoomsState, type RoomsData } from './rooms';
import { WEEK, type Schedule } from './schedule';
import type { ArrivalsState } from './arrivals';
import type { CatDef } from './cats';
import { newFestivals, type ActivityResult, type FestivalsState } from './festival';
import type { ReputationState } from './reputation';
import { normalizeStats } from './stats';
import type { MilestonesState } from './milestones';

export const SAVE_SCHEMA_VERSION = 29;

export interface SaveV29 extends GameState {
  schemaVersion: 29;
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
  /** v8 -> v9: bandeja, pia como estação, etapas de preparo e preferências dos clientes. */
  8: (save) => {
    const service = (save.service ?? {}) as { preps?: Record<string, unknown>[]; customers?: Record<string, unknown>[] };
    return {
      ...save,
      schemaVersion: 9,
      tray: false,
      sink: { load: { cup: 0, glass: 0, plate: 0 }, washing: null },
      service: {
        ...service,
        preps: (service.preps ?? []).map((p) => ({ step: 0, quality: 'simple', ...p })),
        customers: (service.customers ?? []).map((c) => ({ favorite: null, wantsPremium: false, ...c })),
      },
    };
  },
  /** v9 -> v10: barra de itens. Começa vazia; a vassoura (e outras ferramentas) entra sozinha ao abrir o jogo. */
  9: (save) => ({ ...save, schemaVersion: 10, hotbar: newHotbar() }),
  /**
   * v10 -> v11: estágio do negócio. Saves antigos começam "fechado"; ao abrir, a sessão avança sozinha
   * para "funcionamento parcial" se o café já tem o mínimo (data/business.json). Inaugurar é um marco novo.
   */
  10: (save) => ({ ...save, schemaVersion: 11, business: 'closed' }),
  /** v11 -> v12: nome e aparência da protagonista. Saves antigos ficam sem nome e com a aparência padrão. */
  11: (save) => ({ ...save, schemaVersion: 12, player: { name: '', appearance: null } }),
  /**
   * v12 -> v13: o dia em que cada gato foi abrigado (app "Meus gatos": dias no café), a saúde e a doença, e o fiado.
   * Nos saves antigos o único gato abrigado é o do prólogo, que chega no dia 1, saudável (saúde 80 = health.start).
   */
  12: (save) => ({
    ...save,
    schemaVersion: 13,
    cats: Object.fromEntries(Object.entries((save.cats ?? {}) as Record<string, object>).map(([id, c]) => [id, { shelteredOn: 1, health: 80, sickness: null, ...c }])),
    debt: 0,
  }),
  /** v13 -> v14: cômodos e passagens. Saves antigos: tudo no estado inicial dos dados (o salão como estiver). */
  13: (save) => ({ ...save, schemaVersion: 14, rooms: {}, doors: {} }),
  /** v14 -> v15: horário de funcionamento escolhido pela jogadora. Saves antigos: o padrão dos dados. */
  14: (save) => ({ ...save, schemaVersion: 15, schedule: null }),
  /** v15 -> v16: reputação felina. Saves antigos começam no valor inicial dos dados (parseSave preenche). */
  15: (save) => ({ ...save, schemaVersion: 16, reputation: null }),
  /** v16 -> v17: feira de adoção. Saves antigos: nenhuma feira em andamento nem feita. */
  16: (save) => ({ ...save, schemaVersion: 17, fair: null }),
  /** v17 -> v18: chegadas de gatos e gatos gerados. Saves antigos: nenhuma chegada nem gato gerado. */
  17: (save) => ({ ...save, schemaVersion: 18, arrivals: null, catDefs: {} }),
  /** v18 -> v19: dicas "E" do tutorial (quantas vezes usou cada tipo de coisa). Saves antigos: o tutorial começa de novo. */
  18: (save) => ({ ...save, schemaVersion: 19, hintUses: {} }),
  /** v19 -> v20: felicidade e higiene dos gatos. Saves antigos: todo gato começa com 70 nos dois (o care.start de hoje). */
  19: (save) => ({
    ...save,
    schemaVersion: 20,
    cats: Object.fromEntries(Object.entries((save.cats ?? {}) as Record<string, object>).map(([id, c]) => [id, { happiness: 70, hygiene: 70, ...c }])),
  }),
  /** v20 -> v21: ela ou ele (escolha do criador). Saves antigos: ela (o jogo foi escrito assim até aqui). */
  20: (save) => ({ ...save, schemaVersion: 21, player: { ...((save.player ?? {}) as object), pronoun: DEFAULT_PRONOUN } }),
  /**
   * v21 -> v22: a feira de adoção vira um festival (fest.adoption_fair). Panfletos -> preparação; marcada -> marcada;
   * a estação da última feira vira o primeiro dia dela (30 dias por estação naquela época); o dia em que aconteceu fica.
   */
  21: (save) => {
    const { fair, ...rest } = save as RawSave & { fair?: { stage?: string; day?: number | null; done?: string[]; lastSeason?: number | null; heldOn?: number | null } | null };
    const id = 'fest.adoption_fair';
    const f = fair ?? {};
    const active =
      f.stage === 'flyers' ? { id, stage: 'prep', day: null, done: f.done ?? [], results: [] }
      : f.stage === 'scheduled' && typeof f.day === 'number' ? { id, stage: 'scheduled', day: f.day, done: f.done ?? [], results: [] }
      : null;
    const last = typeof f.lastSeason === 'number' ? { [id]: f.lastSeason * 30 + 1 } : {};
    const heldOn = typeof f.heldOn === 'number' ? { id, day: f.heldOn } : null;
    return { ...rest, schemaVersion: 22, festivals: { active, last, heldOn } };
  },
  /** v22 -> v23: a melhor foto (foto perfeita). Saves antigos: nenhuma foto ainda. */
  22: (save) => ({ ...save, schemaVersion: 23, bestPhoto: null }),
  /** v23 -> v24: lista de compras (app Notas). Saves antigos: lista vazia. */
  23: (save) => ({ ...save, schemaVersion: 24, shoppingList: [] }),
  /**
   * v24 -> v25: obras com o construtor (o pintor que deixava pronto na hora saiu). Saves antigos: o reparo interno
   * conta como feito se as 4 superfícies do café já tinham acabamento novo; o externo, se a fachada tinha. Nenhuma obra.
   */
  24: (save) => {
    const f = (save.finishes ?? {}) as Record<string, string>;
    const repaired = [
      ...(['surface.wallpaper', 'surface.wainscot', 'surface.hall_floor', 'surface.counter_floor'].every((s) => f[s]) ? ['inside'] : []),
      ...(f['surface.facade'] ? ['outside'] : []),
    ];
    return { ...save, schemaVersion: 25, construction: { repaired, quote: null, job: null, askPending: false, cells: {} } };
  },
  /**
   * v25 -> v26: despensa. Saves antigos: os ingredientes da mochila já estavam "no café" (as receitas usavam de
   * lá); a leitura (pantry null) passa todos para a despensa, para o café não parar.
   */
  25: (save) => ({ ...save, schemaVersion: 26, pantry: null }),
  /**
   * v26 -> v27: estatísticas do café (app Café em números e selos). Saves antigos começam do zero (o total de
   * atendidos já existia em service.served e os gatos já abrigados vêm de cats).
   */
  26: (save) => ({ ...save, schemaVersion: 27, stats: null }),
  /**
   * v27 -> v28: selos do café. Saves antigos: nenhum anotado; a leitura marca catchUp e a primeira conferida da sessão
   * anota os que já valem sem avisar nem dar presente (as receitas já estavam destrancadas por clientes atendidos).
   */
  27: (save) => ({ ...save, schemaVersion: 28, milestones: null }),
  /** v28 -> v29: baús do café (a caixa pet). Saves antigos não têm nenhum: começam vazios. */
  28: (save) => ({ ...save, schemaVersion: 29, petBoxes: {} }),
};

export function serializeSave(state: GameState, now: Date): string {
  const save: SaveV29 = { schemaVersion: 29, savedAt: now.toISOString(), ...state };
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
  /** Doenças de data/health.json (doença que sumiu: o gato fica saudável). */
  diseases: ReadonlySet<string>;
  /** Onde começar se o local salvo não existir mais. */
  startMap: string;
  /** Opções da aparência (escolha que sumiu volta ao padrão). */
  character: CharacterData;
  /** Cômodos e passagens (estado que sumiu volta ao inicial). */
  rooms: RoomsData;
  /** Reputação de quem não tem (saves antigos). */
  reputationStart?: number;
  /** Itens que não ficam na mochila (inBag false): num save antigo, saem dela e viram a marca received.<id>. */
  notInBag?: ReadonlySet<string>;
  /** Ingredientes (tag ingredient): na migração da despensa, saem da mochila. */
  ingredients?: ReadonlySet<string>;
  /** Chegadas de data/arrivals.json (a que sumiu sai da fila). */
  arrivals?: ReadonlySet<string>;
  /** Festivais de data/festivals.json (o em andamento que sumiu é esquecido). */
  festivals?: ReadonlySet<string>;
  /** Selos de data/milestones.json (o que sumiu é esquecido). */
  milestones?: ReadonlySet<string>;
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

  const migrated = (save as { pantry?: unknown }).pantry === null;
  const v2 = save as unknown as Partial<SaveV29>;
  // Gatos gerados pelas chegadas: a definição vem no próprio save e conta como gato conhecido.
  const catDefs = normalizeCatDefs(v2.catDefs);
  const knownCat = (id: string) => known.cats.has(id) || !!catDefs[id];
  // A chave da padaria e o presente da Gabi não ficam mais na mochila: viram a marca de que chegaram.
  for (const id of known.notInBag ?? []) {
    if (!v2.inventory?.[id]) continue;
    delete (v2.inventory as Record<string, number>)[id];
    v2.flags = { ...(v2.flags ?? {}), [`received.${id}`]: true };
  }
  // Migração da despensa (v26): os ingredientes saem da mochila e entram na despensa.
  const migratedPantry: Record<string, number> = {};
  if (migrated && v2.inventory) {
    for (const [id, n] of Object.entries(v2.inventory)) {
      if (!known.ingredients?.has(id)) continue;
      migratedPantry[id] = n;
      delete (v2.inventory as Record<string, number>)[id];
    }
  }
  const warnings: string[] = [];
  const knownItem = (id: string, where: string) => {
    if (known.items.has(id)) return true;
    warnings.push(`${where}: item "${id}" não existe mais; ignorado`);
    return false;
  };

  // Bebida de receita que sumiu ou item que sumiu: o objeto da mão/superfície é ignorado.
  const knownHand = (h: HandItem) =>
    h.kind === 'item' || h.kind === 'heavy' ? known.items.has(h.item) : h.kind === 'drink' || h.kind === 'wip' ? known.recipes.has(h.recipe) : h.kind === 'cat' ? knownCat(h.catId) : true;
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
    placed: (v2.placed ?? []).filter((p) => knownItem(p.item, `móvel ${p.uid}`)).map((p) => normalizePlaced(p, known)),
    nextUid: v2.nextUid ?? 1,
    story: { completed: [...(v2.story?.completed ?? [])], completedOn: { ...(v2.story?.completedOn ?? {}) } },
    cats: Object.fromEntries(
      Object.entries(v2.cats ?? {})
        .filter(([id]) => {
          if (knownCat(id)) return true;
          warnings.push(`gato "${id}" não existe mais; ignorado`);
          return false;
        })
        .map(([id, c]) => {
          const s = c.sickness;
          // Doença que sumiu dos dados: o gato fica saudável (com aviso).
          const sickness = s && known.diseases.has(s.disease) ? { ...s, treatment: s.treatment ? { ...s.treatment } : null } : null;
          if (s && !sickness) warnings.push(`doença "${s.disease}" não existe mais; ${id} ficou saudável`);
          // Felicidade e higiene fora de 0..100 (ou quebradas): somem, e a leitura usa o valor inicial (care.ts: careOf).
          const care = (v: unknown) => (typeof v === 'number' && v >= 0 && v <= 100 ? Math.round(v) : undefined);
          const { happiness: _h, hygiene: _g, ...rest } = c;
          const happiness = care(c.happiness);
          const hygiene = care(c.hygiene);
          return [
            id,
            {
              ...rest,
              shelteredOn: Number.isInteger(c.shelteredOn) && c.shelteredOn >= 1 ? c.shelteredOn : 1,
              health: typeof c.health === 'number' ? c.health : 80,
              sickness,
              ...(happiness !== undefined ? { happiness } : {}),
              ...(hygiene !== undefined ? { hygiene } : {}),
            },
          ];
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
    pantry: Object.fromEntries(
      Object.entries(v2.pantry ?? migratedPantry).filter((e): e is [string, number] => known.items.has(e[0]) && typeof e[1] === 'number' && e[1] > 0),
    ),
    // Baús: só os de móveis que continuam no café e itens que existem; quantidade positiva.
    petBoxes: Object.fromEntries(
      Object.entries(v2.petBoxes ?? {})
        .filter(([uid]) => (v2.placed ?? []).some((pl) => pl.uid === uid))
        .map(([uid, box]) => [uid, Object.fromEntries(Object.entries(box ?? {}).filter((e): e is [string, number] => knownItem(e[0], `caixa ${uid}`) && typeof e[1] === 'number' && Number.isInteger(e[1]) && e[1] > 0))]),
    ),
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
    tray: v2.tray === true,
    sink: {
      load: { cup: v2.sink?.load?.cup ?? 0, glass: v2.sink?.load?.glass ?? 0, plate: v2.sink?.load?.plate ?? 0 },
      washing: v2.sink?.washing ? { readyAt: v2.sink.washing.readyAt, load: { ...v2.sink.washing.load } } : null,
    },
    hotbar: {
      slots: Array.from({ length: HOTBAR_SIZE }, (_, i) => {
        const id = v2.hotbar?.slots?.[i] ?? null;
        return id && known.items.has(id) ? id : null;
      }),
      active: Number.isInteger(v2.hotbar?.active) && v2.hotbar!.active >= 0 && v2.hotbar!.active < HOTBAR_SIZE ? v2.hotbar!.active : 0,
    },
    business: isBusinessStage(v2.business) ? v2.business : 'closed',
    debt: typeof v2.debt === 'number' && v2.debt > 0 ? v2.debt : 0,
    player: {
      name: typeof v2.player?.name === 'string' ? cleanPlayerName(v2.player.name) : '',
      appearance: v2.player?.appearance ? normalizeAppearance(known.character, v2.player.appearance).appearance : null,
      pronoun: isPronoun(v2.player?.pronoun) ? v2.player.pronoun : DEFAULT_PRONOUN,
    },
    ...normalizeRoomsState(known.rooms, { rooms: v2.rooms, doors: v2.doors }),
    festivals: normalizeFestivals(v2.festivals, known.festivals, warnings),
    bestPhoto: normalizeBestPhoto(v2.bestPhoto, knownCat),
    construction: normalizeConstruction(v2.construction, known),
    shoppingList: [...new Set((Array.isArray(v2.shoppingList) ? v2.shoppingList : []).filter((id): id is string => typeof id === 'string' && known.items.has(id)))],
    arrivals: normalizeArrivals(v2.arrivals, known.arrivals, knownCat),
    catDefs,
    hintUses: Object.fromEntries(
      Object.entries(v2.hintUses ?? {}).filter((e): e is [string, number] => typeof e[1] === 'number' && Number.isInteger(e[1]) && e[1] > 0),
    ),
    reputation: normalizeReputation(v2.reputation, known.reputationStart ?? 0),
    stats: normalizeStats(v2.stats, (id) => known.items.has(id)),
    milestones: normalizeMilestones(v2.milestones, known.milestones),
    schedule: validSchedule(v2.schedule)
      ? {
          days: [...v2.schedule.days],
          open: v2.schedule.open,
          close: v2.schedule.close,
          // Almoço: campo opcional (sem ele, o do horário padrão); null = sem almoço.
          ...(v2.schedule.lunch === null || (typeof v2.schedule.lunch === 'string' && /^\d{1,2}:\d{2}$/.test(v2.schedule.lunch)) ? { lunch: v2.schedule.lunch } : {}),
        }
      : null,
    // Energia: campo opcional (sem ele, cheia); valor estranho é descartado.
    ...(typeof v2.energy === 'number' && Number.isFinite(v2.energy) && v2.energy >= 0 ? { energy: v2.energy } : {}),
    // Cortinas abertas: campo opcional (sem ele, fechadas); só ids em texto.
    ...(typeof v2.litterMissedDays === 'number' && Number.isInteger(v2.litterMissedDays) && v2.litterMissedDays > 0 ? { litterMissedDays: v2.litterMissedDays } : {}),
    // Poeira do dia em lugar sorteado: campo opcional (sem ele, o lugar do mapa); só células de números inteiros.
    ...(v2.dirtAt && typeof v2.dirtAt === 'object'
      ? {
          dirtAt: Object.fromEntries(
            Object.entries(v2.dirtAt as Record<string, unknown>).filter(
              (e): e is [string, [number, number]] => Array.isArray(e[1]) && e[1].length === 2 && e[1].every((n) => Number.isInteger(n)),
            ),
          ),
        }
      : {}),
    ...(Array.isArray(v2.openCurtains) ? { openCurtains: [...new Set(v2.openCurtains.filter((id: unknown): id is string => typeof id === 'string'))] } : {}),
  };
  if (v2.location && !known.maps.has(v2.location)) warnings.push(`local "${v2.location}" não existe mais; volta ao início`);
  return { state, warnings };
}

/** Selos: só ids com o dia (número inteiro); sem o campo (save antigo), catchUp. */
function normalizeMilestones(m: unknown, known?: ReadonlySet<string>): MilestonesState {
  if (!m || typeof m !== 'object') return { reached: {}, catchUp: true };
  const x = m as Partial<MilestonesState>;
  const reached = Object.fromEntries(Object.entries(x.reached ?? {}).filter((e): e is [string, number] => (!known || known.has(e[0])) && Number.isInteger(e[1]) && e[1] >= 1));
  return { reached, ...(x.catchUp === true ? { catchUp: true } : {}) };
}

/** Definições de gatos gerados (só as com o formato certo). */
function normalizeCatDefs(defs: unknown): Record<string, CatDef> {
  const out: Record<string, CatDef> = {};
  for (const [id, d] of Object.entries((defs ?? {}) as Record<string, Partial<CatDef>>)) {
    if (!d || typeof d.variant !== 'string' || typeof d.personality !== 'string') continue;
    out[id] = {
      id,
      variant: d.variant,
      personality: d.personality,
      nameSuggestions: Array.isArray(d.nameSuggestions) ? d.nameSuggestions.filter((n): n is string => typeof n === 'string') : [],
      ...(d.adoptionTraits ? { adoptionTraits: { ...d.adoptionTraits } } : {}),
      tags: Array.isArray(d.tags) ? d.tags.filter((t): t is string => typeof t === 'string') : [],
    };
  }
  return out;
}

/** Chegadas salvas (as que sumiram dos dados saem da fila; a em andamento que sumiu é cancelada). */
function normalizeArrivals(a: unknown, knownArrivals: ReadonlySet<string> | undefined, knownCat: (id: string) => boolean): ArrivalsState {
  const x = a as Partial<ArrivalsState> | null | undefined;
  const ok = (id: unknown): id is string => typeof id === 'string' && (!knownArrivals || knownArrivals.has(id));
  const act = x?.active;
  const active =
    act && ok(act.id) && typeof act.catId === 'string' && knownCat(act.catId)
      ? {
          id: act.id,
          catId: act.catId,
          condition: String(act.condition ?? 'healthy'),
          startedOn: Number(act.startedOn) || 1,
          step: Number(act.step) || 0,
          ...(typeof act.startedAt === 'number' ? { startedAt: act.startedAt } : {}),
          ...(typeof act.leaderId === 'string' && knownCat(act.leaderId) ? { leaderId: act.leaderId } : {}),
          ...(typeof act.tip === 'number' ? { tip: act.tip } : {}),
          ...(typeof act.fed === 'number' ? { fed: act.fed } : {}),
          ...(Array.isArray(act.needs) ? { needs: act.needs.filter((n): n is 'food' | 'vet' | 'warmth' => n === 'food' || n === 'vet' || n === 'warmth') } : {}),
          ...(act.treated ? { treated: true } : {}),
          ...(typeof act.fedOn === 'number' ? { fedOn: act.fedOn } : {}),
          ...(Array.isArray(act.extraCats) ? { extraCats: act.extraCats.filter((id): id is string => typeof id === 'string' && knownCat(id)) } : {}),
        }
      : null;
  return {
    active,
    queue: Array.isArray(x?.queue) ? x.queue.filter(ok) : [],
    last: Object.fromEntries(Object.entries(x?.last ?? {}).filter(([id, d]) => ok(id) && typeof d === 'number')),
    nextOn: typeof x?.nextOn === 'number' ? x.nextOn : null,
    seq: typeof x?.seq === 'number' && x.seq >= 0 ? x.seq : 0,
    shelterPool: Array.isArray(x?.shelterPool) ? x.shelterPool.filter((id): id is string => typeof id === 'string' && knownCat(id)) : [],
  };
}

/** Festivais salvos; o evento em andamento que sumiu dos dados é esquecido. */
function normalizeFestivals(f: unknown, known: ReadonlySet<string> | undefined, warnings: string[]): FestivalsState {
  const x = f as Partial<FestivalsState> | null | undefined;
  if (!x || typeof x !== 'object') return newFestivals();
  const num = (n: unknown) => (typeof n === 'number' && Number.isInteger(n) ? n : null);
  const ok = (id: unknown): id is string => typeof id === 'string' && (!known || known.has(id));
  const strings = (a: unknown) => (Array.isArray(a) ? a.filter((v): v is string => typeof v === 'string') : []);
  let active: FestivalsState['active'] = null;
  const a = x.active;
  if (a && ok(a.id) && (a.stage === 'prep' || (a.stage === 'scheduled' && num(a.day) !== null))) {
    const results = Array.isArray(a.results)
      ? a.results.filter((r): r is ActivityResult => !!r && typeof r.game === 'string' && ['fail', 'ok', 'great'].includes(r.outcome) && typeof r.coins === 'number')
      : [];
    active = {
      id: a.id,
      stage: a.stage,
      day: a.stage === 'scheduled' ? num(a.day) : null,
      done: strings(a.done),
      results: results.map(({ setup, contest, ...r }) => ({
        ...r,
        ...(contest && typeof contest.catId === 'string' && typeof contest.theme === 'string' && typeof contest.rank === 'number' ? { contest: { catId: contest.catId, theme: contest.theme, rank: contest.rank } } : {}),
        skipped: !!r.skipped,
        ...(setup && Array.isArray(setup.cats) && typeof setup.visitors === 'number' && typeof setup.extraFamilies === 'number'
          ? { setup: { cats: strings(setup.cats), visitors: setup.visitors, extraFamilies: setup.extraFamilies } }
          : {}),
      })),
    };
  } else if (a) warnings.push(`festival "${String(a.id)}" não existe mais; esquecido`);
  const last = Object.fromEntries(Object.entries(x.last ?? {}).filter((e): e is [string, number] => ok(e[0]) && num(e[1]) !== null));
  const h = x.heldOn;
  const heldOn = h && ok(h.id) && num(h.day) !== null ? { id: h.id, day: h.day } : null;
  return { active, last, heldOn };
}

/** A melhor foto salva (quebrada = nenhuma); gatos que sumiram saem da lista. */
/** Móvel posicionado: só os campos que existem; areia do dia e o estoque do automático (inteiros, item conhecido). */
function normalizePlaced(p: PlacedItem, known: KnownIds): PlacedItem {
  const out: PlacedItem = { uid: p.uid, item: p.item, at: [p.at[0], p.at[1]] };
  if (Number.isInteger(p.refilledOn)) out.refilledOn = p.refilledOn;
  if (Number.isInteger(p.stock) && p.stock! > 0 && p.stockItem && known.items.has(p.stockItem)) {
    out.stock = p.stock;
    out.stockItem = p.stockItem;
  }
  return out;
}

function normalizeBestPhoto(p: unknown, knownCat: (id: string) => boolean): GameState['bestPhoto'] {
  const x = p as Partial<NonNullable<GameState['bestPhoto']>> | null | undefined;
  if (!x || typeof x.pose !== 'string' || typeof x.score !== 'number' || typeof x.day !== 'number') return null;
  const catIds = Array.isArray(x.catIds) ? x.catIds.filter((id): id is string => typeof id === 'string' && knownCat(id)) : [];
  return { pose: x.pose, score: x.score, catIds, day: x.day };
}

/** Reputação salva (ou a inicial, em save antigo ou quebrado). */
function normalizeReputation(r: unknown, start: number): ReputationState {
  const x = r as Partial<ReputationState> | null | undefined;
  if (!x || typeof x.value !== 'number' || !Number.isFinite(x.value)) return { value: start, reached: [], log: [] };
  return {
    value: Math.max(0, x.value),
    reached: Array.isArray(x.reached) ? x.reached.filter((id): id is string => typeof id === 'string') : [],
    log: Array.isArray(x.log) ? x.log.filter((e) => e && typeof e.amount === 'number' && typeof e.reason === 'string' && typeof e.day === 'number') : [],
  };
}

/** Horário salvo com o formato certo (as regras de horas a sessão confere; inválido volta ao padrão). */
function validSchedule(s: unknown): s is Schedule {
  const x = s as Schedule | null | undefined;
  const clock = (t: unknown) => typeof t === 'string' && /^\d{1,2}:\d{2}$/.test(t);
  return !!x && Array.isArray(x.days) && x.days.length === WEEK && x.days.every((d) => typeof d === 'boolean') && clock(x.open) && clock(x.close);
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
  character: CharacterData;
  health: { diseases: { id: string }[] };
  rooms: RoomsData;
  facade?: { surface: { id: string } } | null;
  reputation?: { start: number };
  arrivals?: { arrivals: { id: string }[] };
  festivals?: { id: string }[];
  milestones?: { milestones: { id: string }[] };
}): KnownIds {
  return {
    items: new Set(Object.keys(content.items)),
    finishes: new Set(Object.keys(content.finishes)),
    surfaces: new Set([...(content.map.surfaces ?? []).map((s) => s.id), ...(content.facade ? [content.facade.surface.id] : [])]),
    maps: new Set(Object.keys(content.maps)),
    cats: new Set(Object.keys(content.cats)),
    jobs: new Set(Object.keys(content.jobs)),
    recipes: new Set(Object.keys(content.recipes)),
    diseases: new Set(content.health.diseases.map((d) => d.id)),
    startMap: content.world.startMap,
    character: content.character,
    rooms: content.rooms,
    reputationStart: content.reputation?.start ?? 0,
    ...(content.arrivals ? { arrivals: new Set(content.arrivals.arrivals.map((a) => a.id)) } : {}),
    ...(content.festivals ? { festivals: new Set(content.festivals.map((f) => f.id)) } : {}),
    ...(content.milestones ? { milestones: new Set(content.milestones.milestones.map((m) => m.id)) } : {}),
    notInBag: new Set(Object.entries(content.items).filter(([, i]) => (i as { inBag?: boolean }).inBag === false).map(([id]) => id)),
    ingredients: new Set(Object.entries(content.items).filter(([, i]) => (i as { tags?: string[] }).tags?.includes('ingredient')).map(([id]) => id)),
  };
}

/** Obras (v25): reparos, orçamento e obra só com acabamentos e superfícies que existem; células "col,row" válidas. */
function normalizeConstruction(c: unknown, known: KnownIds): ConstructionState {
  const x = (c ?? {}) as Partial<ConstructionState>;
  const out = newConstruction();
  out.repaired = (Array.isArray(x.repaired) ? x.repaired : []).filter((k): k is 'inside' | 'outside' => k === 'inside' || k === 'outside');
  const job = (j: unknown): ConstructionState['job'] => {
    const v = j as ConstructionState['job'];
    if (!v || !['inside', 'outside', 'finish', 'facade', 'room_open', 'room_clear', 'room_restore'].includes(v.kind)) return null;
    if (v.roomId && !known.rooms.rooms.some((r) => r.id === v.roomId)) return null;
    if (v.finishId && !known.finishes.has(v.finishId)) return null;
    if (v.surfaceId && !known.surfaces.has(v.surfaceId)) return null;
    return v;
  };
  out.quote = job(x.quote);
  out.job = job(x.job);
  out.askPending = x.askPending === true;
  for (const [key, finish] of Object.entries(x.cells ?? {})) if (/^\d+,\d+$/.test(key) && known.finishes.has(finish)) out.cells[key] = finish;
  return out;
}
