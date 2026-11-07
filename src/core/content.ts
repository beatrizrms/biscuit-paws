// Tipos do conteúdo em data/*.json e validação das referências entre eles.
// Puro: sem Phaser, DOM ou window.
import { validateCats, type CatDef, type CatsData, type CatSpritesData } from './cats';
import { cutsceneTexts, validateCutscenes, type CutsceneDef, type CutscenesData } from './cutscene';
import { validateScripts, type NpcDef, type NpcsData, type ScriptsData, type ScriptStep } from './script';
import { validateMap, type Cell, type MapData, type SurfaceKind } from './map';
import { validateDayNight, type DayNightConfig } from './time';
import type { RelationshipsConfig } from './relationships';
import type { TileCatalog } from './tiles';

/** furniture: vai para o café (catálogo). consumable: ração, remédio... key: chaves. */
export type ItemKind = 'furniture' | 'consumable' | 'key' | 'tool';

export interface ItemDef {
  id: string;
  name: string;
  price: number;
  /** Sem kind = furniture. */
  kind?: ItemKind;
  /** Tile do móvel no café (obrigatório para furniture). */
  tile?: string;
  /** Condição para poder comprar (ex.: itens de gato só depois de ter um gato). */
  requires?: Condition;
  /** Ícone (data/icons.json), para itens que não são móveis. */
  icon?: string;
  /** Imagem própria do ícone (ex.: a chave), quando não está na folha de ícones. */
  iconImage?: string;
  tags: string[];
  deprecated?: boolean;
}

/** Lojas (data/shops.json): o que cada uma vende. */
export interface ShopsData {
  schemaVersion: 1;
  shops: Record<string, { name: string; items: string[] }>;
}

/** Ícones dos itens (data/icons.json, do pacote catalogo_compras). */
export interface IconsData {
  schemaVersion: 1;
  image: string;
  tileSize: number;
  columns: number;
  icons: Record<string, { col: number; row: number }>;
}

export interface ItemsData {
  schemaVersion: 1;
  items: ItemDef[];
}

/** Acabamento que o pintor aplica numa superfície (piso, papel de parede, lambri). */
export interface FinishDef {
  id: string;
  name: string;
  tile: string;
  kind: SurfaceKind;
  price: number;
}

export interface FinishesData {
  schemaVersion: 1;
  /** Flag que libera o pintor (sem ela, a seção Reforma não aparece). */
  unlockFlag?: string;
  finishes: FinishDef[];
}

export interface EconomyData {
  schemaVersion: 1;
  startingMoney: number;
  currency: string;
  /** Fração do preço devolvida ao devolver um item da bolsa (0 a 1). */
  refundRate: number;
}

/** Condição de história, escrita em JSON. */
export type Condition =
  | { all: Condition[] }
  | { any: Condition[] }
  | { not: Condition }
  | { flag: string }
  | { beat: string }
  | { placed: string; gte?: number }
  /** Quantos móveis posicionados têm esta tag (ex.: "chair" conta cadeiras de qualquer tipo). */
  | { placedTag: string; gte?: number }
  | { owned: string; gte?: number }
  /** A personagem já entrou neste mapa. */
  | { visited: string }
  /** A jogadora já deu nome a este gato. */
  | { catNamed: string }
  /** Toda a sujeira do café com esta tag (das que saem com faxina) já foi limpa. */
  | { cleaned: string }
  | { money: { gte: number } };

export type Effect =
  | { dialogue: string }
  | { setFlag: string }
  | { addMoney: number }
  | { cutscene: string }
  | { giveItem: string }
  /** Abriga um gato no café (abre a caixa de nome). */
  | { shelterCat: string }
  /** Termina o dia (a protagonista vai para casa; amanhece no dia seguinte). */
  | { endDay: true }
  /** Roteiro no mundo (data/scripts.json): ex.: a corretora mostra a padaria. */
  | { script: string }
  /** Acerta o relógio (ex.: a chegada é às "08:00" do dia seguinte aos pensamentos). */
  | { setTime: string };

export interface GoalStep {
  /** Texto que a jogadora vê. */
  text: string;
  /** Nota de desenvolvimento: só aparece no modo debug. */
  devNote?: string;
  when: Condition;
}

export interface Beat {
  id: string;
  act: number;
  /** Marcos que precisam estar concluídos antes deste começar. */
  after?: string[];
  /** Condição extra para concluir. Se houver meta, todos os passos também precisam valer. */
  when?: Condition;
  /** Meta visível no diário enquanto o marco estiver ativo. */
  goal?: { title: string; steps: GoalStep[] };
  effects: Effect[];
}

export interface StoryData {
  schemaVersion: 1;
  beats: Beat[];
}

export interface DialogueLine {
  speaker: string;
  text: string;
  /** NPC que fala (mostra o retrato dele). */
  npc?: string;
}

export interface DialogueData {
  schemaVersion: 1;
  dialogues: Record<string, { lines: DialogueLine[] }>;
}

/** data/world.json: onde o jogo começa e qual mapa é o café (onde se decora e reforma). */
export interface WorldData {
  schemaVersion: 1;
  startMap: string;
  homeMap: string;
  /** Estação atual (dados de todas já existem; o prólogo é no inverno). */
  season: string;
  /** Onde ela aparece de manhã, vindo de casa. */
  morning: { map: string; spawn: Cell };
  /**
   * Onde ela dorme. null = em casa, fora do mapa (transição "Você foi para casa").
   * Ponto de extensão: quando o quartinho do café for destrancado, vira o id desse mapa.
   */
  sleepMap: string | null;
}

/** Todo o conteúdo que uma sessão de jogo precisa. */
export interface Content {
  catalog: TileCatalog;
  /** O mapa do café (onde se decora e reforma). */
  map: MapData;
  /** Todos os mapas, por id (inclui o café). */
  maps: Record<string, MapData>;
  world: WorldData;
  items: Record<string, ItemDef>;
  finishes: Record<string, FinishDef>;
  /** Flag que libera o pintor. */
  painterUnlockFlag?: string;
  economy: EconomyData;
  story: StoryData;
  dialogue: DialogueData;
  cats: Record<string, CatDef>;
  catSprites: CatSpritesData;
  cutscenes: Record<string, CutsceneDef>;
  relationships: RelationshipsConfig;
  shops: ShopsData['shops'];
  icons: IconsData;
  npcs: Record<string, NpcDef>;
  scripts: Record<string, { steps: ScriptStep[] }>;
  dayNight: DayNightConfig;
}

export interface RawContent {
  catalog: TileCatalog;
  maps: MapData[];
  world: WorldData;
  items: ItemsData;
  finishes: FinishesData;
  economy: EconomyData;
  story: StoryData;
  dialogue: DialogueData;
  cats: CatsData;
  catSprites: CatSpritesData;
  cutscenes: CutscenesData;
  relationships: RelationshipsConfig;
  shops: ShopsData;
  icons: IconsData;
  npcs: NpcsData;
  scripts: ScriptsData;
  dayNight: DayNightConfig;
}

export function buildContent(raw: RawContent): Content {
  const maps: Record<string, MapData> = {};
  for (const m of raw.maps) maps[m.id] = m;
  const home = maps[raw.world.homeMap];
  if (!home) throw new Error(`world.json: homeMap "${raw.world.homeMap}" não existe`);
  const items: Record<string, ItemDef> = {};
  for (const item of raw.items.items) items[item.id] = item;
  const finishes: Record<string, FinishDef> = {};
  for (const finish of raw.finishes.finishes) finishes[finish.id] = finish;
  return { catalog: raw.catalog, map: home, maps, world: raw.world, items, finishes, painterUnlockFlag: raw.finishes.unlockFlag, economy: raw.economy, story: raw.story, dialogue: raw.dialogue,
    cats: Object.fromEntries(raw.cats.cats.map((c) => [c.id, c])), catSprites: raw.catSprites, cutscenes: raw.cutscenes.cutscenes, relationships: raw.relationships,
    shops: raw.shops.shops, icons: raw.icons,
    npcs: Object.fromEntries(raw.npcs.npcs.map((n) => [n.id, n])), scripts: raw.scripts.scripts, dayNight: raw.dayNight };
}

/** Palavras de bastidor que não podem aparecer em textos da jogadora (use "devNote"). */
const DEV_WORDS = /\b(marcos?|debug|placeholder)\b/i;
const DEV_MARKERS = /\b(TODO|FIXME|WIP)\b/; // só em maiúsculas: "todo dia" é português comum

/** Confere IDs, prefixos e referências cruzadas. Lista vazia = tudo certo. */
export function validateContent(raw: RawContent): string[] {
  const errors = raw.maps.flatMap((m) => validateMap(m, raw.catalog));
  const err = (msg: string) => errors.push(msg);
  const playerText = (where: string, text: string) => {
    if (DEV_WORDS.test(text) || DEV_MARKERS.test(text)) err(`${where}: texto da jogadora parece nota de desenvolvimento ("${text}"); use "devNote"`);
  };

  // Mapas e portas
  const mapIds = new Set<string>();
  for (const m of raw.maps) {
    if (!m.id.startsWith('map.')) err(`mapa: id "${m.id}" deve começar com "map."`);
    if (mapIds.has(m.id)) err(`mapa: id repetido "${m.id}"`);
    mapIds.add(m.id);
  }
  if (!mapIds.has(raw.world.startMap)) err(`world: startMap "${raw.world.startMap}" não existe`);
  if (!mapIds.has(raw.world.homeMap)) err(`world: homeMap "${raw.world.homeMap}" não existe`);
  if (!mapIds.has(raw.world.morning.map)) err(`world: morning.map "${raw.world.morning.map}" não existe`);
  if (raw.world.sleepMap !== null && !mapIds.has(raw.world.sleepMap)) err(`world: sleepMap "${raw.world.sleepMap}" não existe`);
  errors.push(...validateDayNight(raw.dayNight));
  for (const m of raw.maps) {
    for (const door of m.doors ?? []) {
      const target = raw.maps.find((t) => t.id === door.to);
      if (!target) err(`${m.id}: porta "${door.id}" leva a "${door.to}", que não existe`);
      else {
        const [c, r] = door.spawn;
        if (c < 0 || r < 0 || c >= target.size.cols || r >= target.size.rows) err(`${m.id}: porta "${door.id}" chega fora de "${door.to}"`);
      }
    }
  }
  const home = raw.maps.find((m) => m.id === raw.world.homeMap);
  const doorChecks: { where: string; requires?: Condition; locked?: string; intercept?: { when: Condition; cutscene: string } }[] = raw.maps.flatMap((m) =>
    (m.doors ?? []).map((d) => ({
      where: `${m.id}: porta "${d.id}"`,
      requires: d.requires as Condition | undefined,
      locked: d.locked,
      intercept: d.intercept as { when: Condition; cutscene: string } | undefined,
    })),
  );

  // Gatos e cenas
  errors.push(...validateCats(raw.cats, raw.catSprites));
  const catIds = new Set(raw.cats.cats.map((c) => c.id));
  const animations = new Set(raw.catSprites.animations.map((a) => a.name));
  errors.push(...validateCutscenes(raw.cutscenes, catIds, animations));
  const cutsceneIds = new Set(Object.keys(raw.cutscenes.cutscenes));
  const npcIds = new Set(raw.npcs.npcs.map((n) => n.id));
  const scriptIds = new Set(Object.keys(raw.scripts.scripts));
  for (const n of raw.npcs.npcs) if (!n.id.startsWith('npc.')) err(`npc: id "${n.id}" deve começar com "npc."`);
  errors.push(
    ...validateScripts(raw.scripts, {
      npcs: npcIds,
      maps: new Set(raw.maps.map((m) => m.id)),
      dialogues: new Set(Object.keys(raw.dialogue.dialogues)),
      items: new Set(raw.items.items.map((i) => i.id)),
      npcAnims: (id) => new Set(Object.keys(raw.npcs.npcs.find((n) => n.id === id)?.extras ?? {})),
    }),
  );
  for (const [id, d] of Object.entries(raw.dialogue.dialogues)) {
    for (const l of d.lines) if (l.npc && !npcIds.has(l.npc)) err(`dialogue "${id}": NPC inexistente "${l.npc}"`);
  }

  const itemIds = new Set<string>();
  for (const item of raw.items.items) {
    if (!item.id.startsWith('item.')) err(`items: id "${item.id}" deve começar com "item."`);
    if (itemIds.has(item.id)) err(`items: id repetido "${item.id}"`);
    itemIds.add(item.id);
    const kind = item.kind ?? 'furniture';
    if (!['furniture', 'consumable', 'key', 'tool'].includes(kind)) err(`items: "${item.id}" tem kind inválido`);
    if (kind === 'furniture' && !item.tile) err(`items: "${item.id}" é móvel e precisa de tile`);
    if (item.tile && !raw.catalog.tiles[item.tile]) err(`items: "${item.id}" usa tile inexistente "${item.tile}"`);
    if (!Number.isInteger(item.price) || item.price < 0) err(`items: "${item.id}" tem preço inválido`);
  }

  const LAYER_OF: Record<SurfaceKind, string> = { floor: 'floor', wall: 'wall', wainscot: 'wall' };
  const finishIds = new Set<string>();
  for (const f of raw.finishes.finishes) {
    if (!f.id.startsWith('finish.')) err(`finishes: id "${f.id}" deve começar com "finish."`);
    if (finishIds.has(f.id)) err(`finishes: id repetido "${f.id}"`);
    finishIds.add(f.id);
    const tile = raw.catalog.tiles[f.tile];
    if (!tile) err(`finishes: "${f.id}" usa tile inexistente "${f.tile}"`);
    else if (tile.layer !== LAYER_OF[f.kind]) err(`finishes: "${f.id}" é ${f.kind}, mas o tile "${f.tile}" é da camada "${tile.layer}"`);
    if (!Number.isInteger(f.price) || f.price < 0) err(`finishes: "${f.id}" tem preço inválido`);
  }
  const surfaceIds = new Set<string>();
  for (const d of home?.dirt ?? []) {
    if (d.clearedBy && !(home?.surfaces ?? []).some((s) => s.id === d.clearedBy)) err(`mapa: sujeira "${d.id}" sai com "${d.clearedBy}", que não existe`);
  }
  for (const s of home?.surfaces ?? []) {
    if (!s.id.startsWith('surface.')) err(`mapa: superfície "${s.id}" deve começar com "surface."`);
    if (surfaceIds.has(s.id)) err(`mapa: superfície repetida "${s.id}"`);
    surfaceIds.add(s.id);
    if (!home!.legend[s.legend]) err(`mapa: superfície "${s.id}" usa a letra "${s.legend}", que não está na legenda`);
    if (!raw.finishes.finishes.some((f) => f.kind === s.kind)) err(`mapa: nenhum acabamento serve para "${s.id}" (${s.kind})`);
  }

  if (!Number.isInteger(raw.economy.startingMoney) || raw.economy.startingMoney < 0) {
    err('economy: startingMoney inválido');
  }
  if (!(raw.economy.refundRate >= 0 && raw.economy.refundRate <= 1)) err('economy: refundRate deve ficar entre 0 e 1');

  const itemTags = new Set(raw.items.items.flatMap((i) => i.tags));
  const dialogueIds = new Set(Object.keys(raw.dialogue.dialogues));
  for (const id of dialogueIds) {
    if (!id.startsWith('dlg.')) err(`dialogue: id "${id}" deve começar com "dlg."`);
    if ((raw.dialogue.dialogues[id]?.lines.length ?? 0) === 0) err(`dialogue: "${id}" não tem falas`);
  }

  const beatIds = new Set<string>();
  for (const beat of raw.story.beats) {
    if (!beat.id.startsWith('story.')) err(`story: id "${beat.id}" deve começar com "story."`);
    if (beatIds.has(beat.id)) err(`story: id repetido "${beat.id}"`);
    beatIds.add(beat.id);
  }

  const checkCondition = (where: string, c: Condition): void => {
    if ('all' in c) c.all.forEach((x) => checkCondition(where, x));
    else if ('any' in c) c.any.forEach((x) => checkCondition(where, x));
    else if ('not' in c) checkCondition(where, c.not);
    else if ('cleaned' in c) {
      if (!(home?.dirt ?? []).some((d) => !d.clearedBy && d.tags.includes(c.cleaned))) err(`${where}: nenhuma sujeira com a tag "${c.cleaned}"`);
    } else if ('catNamed' in c) {
      if (!catIds.has(c.catNamed)) err(`${where}: gato inexistente "${c.catNamed}"`);
    } else if ('visited' in c) {
      if (!mapIds.has(c.visited)) err(`${where}: mapa inexistente "${c.visited}"`);
    } else if ('beat' in c) {
      if (!beatIds.has(c.beat)) err(`${where}: marco inexistente "${c.beat}"`);
    } else if ('placedTag' in c) {
      if (!itemTags.has(c.placedTag)) err(`${where}: nenhum item tem a tag "${c.placedTag}"`);
    } else if ('placed' in c || 'owned' in c) {
      const id = 'placed' in c ? c.placed : c.owned;
      if (!itemIds.has(id)) err(`${where}: item inexistente "${id}"`);
    }
  };

  for (const item of raw.items.items) {
    if (item.requires) checkCondition(`items: "${item.id}"`, item.requires);
    if (item.icon && !raw.icons.icons[item.icon]) err(`items: "${item.id}" usa ícone inexistente "${item.icon}"`);
  }
  for (const [id, shop] of Object.entries(raw.shops.shops)) {
    if (!id.startsWith('shop.')) err(`shops: id "${id}" deve começar com "shop."`);
    playerText(`shop "${id}"`, shop.name);
    for (const item of shop.items) if (!itemIds.has(item)) err(`shops: "${id}" vende item inexistente "${item}"`);
  }
  for (const m of raw.maps) {
    for (const it of m.interactions ?? []) {
      if (!raw.shops.shops[it.action.shop]) err(`${m.id}: interação "${it.id}" abre loja inexistente "${it.action.shop}"`);
    }
  }
  for (const d of doorChecks) {
    if (d.intercept) {
      checkCondition(d.where, d.intercept.when);
      if (!cutsceneIds.has(d.intercept.cutscene)) err(`${d.where}: cena inexistente "${d.intercept.cutscene}"`);
    }
    if (d.requires) checkCondition(d.where, d.requires);
    if (d.locked && !dialogueIds.has(d.locked)) err(`${d.where}: fala de trancada inexistente "${d.locked}"`);
  }

  for (const beat of raw.story.beats) {
    const where = `story "${beat.id}"`;
    for (const dep of beat.after ?? []) if (!beatIds.has(dep)) err(`${where}: "after" aponta para "${dep}", que não existe`);
    if (beat.when) checkCondition(where, beat.when);
    beat.goal?.steps.forEach((s) => checkCondition(where, s.when));
    for (const effect of beat.effects) {
      if ('dialogue' in effect && !dialogueIds.has(effect.dialogue)) err(`${where}: fala inexistente "${effect.dialogue}"`);
      if ('cutscene' in effect && !cutsceneIds.has(effect.cutscene)) err(`${where}: cena inexistente "${effect.cutscene}"`);
      if ('giveItem' in effect && !itemIds.has(effect.giveItem)) err(`${where}: item inexistente "${effect.giveItem}"`);
      if ('setTime' in effect && !/^\d{1,2}:\d{2}$/.test(effect.setTime)) err(`${where}: hora inválida "${effect.setTime}"`);
      if ('script' in effect && !scriptIds.has(effect.script)) err(`${where}: roteiro inexistente "${effect.script}"`);
      if ('shelterCat' in effect && !catIds.has(effect.shelterCat)) err(`${where}: gato inexistente "${effect.shelterCat}"`);
    }
  }

  // Textos que a jogadora vê não podem ter notas de desenvolvimento (playerText, declarado no início).
  raw.items.items.forEach((i) => playerText(`item "${i.id}"`, i.name));
  raw.finishes.finishes.forEach((f) => playerText(`finish "${f.id}"`, f.name));
  (home?.surfaces ?? []).forEach((s) => playerText(`surface "${s.id}"`, s.name));
  for (const beat of raw.story.beats) {
    if (beat.goal) playerText(`story "${beat.id}"`, beat.goal.title);
    beat.goal?.steps.forEach((s) => playerText(`story "${beat.id}"`, s.text));
  }
  for (const [id, d] of Object.entries(raw.dialogue.dialogues)) d.lines.forEach((l) => playerText(`dialogue "${id}"`, l.text));
  for (const [id, cs] of Object.entries(raw.cutscenes.cutscenes)) cutsceneTexts(cs).forEach((t) => playerText(`cutscene "${id}"`, t));

  return errors;
}
