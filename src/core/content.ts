// Tipos do conteúdo em data/*.json e validação das referências entre eles.
// Puro: sem Phaser, DOM ou window.
import { validateMap, type MapData, type SurfaceKind } from './map';
import type { TileCatalog } from './tiles';

export interface ItemDef {
  id: string;
  name: string;
  price: number;
  tile: string;
  tags: string[];
  deprecated?: boolean;
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
  | { money: { gte: number } };

export type Effect = { dialogue: string } | { setFlag: string } | { addMoney: number };

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
}

export interface DialogueData {
  schemaVersion: 1;
  dialogues: Record<string, { lines: DialogueLine[] }>;
}

/** Todo o conteúdo que uma sessão de jogo precisa. */
export interface Content {
  catalog: TileCatalog;
  map: MapData;
  items: Record<string, ItemDef>;
  finishes: Record<string, FinishDef>;
  /** Flag que libera o pintor. */
  painterUnlockFlag?: string;
  economy: EconomyData;
  story: StoryData;
  dialogue: DialogueData;
}

export interface RawContent {
  catalog: TileCatalog;
  map: MapData;
  items: ItemsData;
  finishes: FinishesData;
  economy: EconomyData;
  story: StoryData;
  dialogue: DialogueData;
}

export function buildContent(raw: RawContent): Content {
  const items: Record<string, ItemDef> = {};
  for (const item of raw.items.items) items[item.id] = item;
  const finishes: Record<string, FinishDef> = {};
  for (const finish of raw.finishes.finishes) finishes[finish.id] = finish;
  return { catalog: raw.catalog, map: raw.map, items, finishes, painterUnlockFlag: raw.finishes.unlockFlag, economy: raw.economy, story: raw.story, dialogue: raw.dialogue };
}

/** Palavras de bastidor que não podem aparecer em textos da jogadora (use "devNote"). */
const DEV_WORDS = /\b(marcos?|debug|placeholder)\b/i;
const DEV_MARKERS = /\b(TODO|FIXME|WIP)\b/; // só em maiúsculas: "todo dia" é português comum

/** Confere IDs, prefixos e referências cruzadas. Lista vazia = tudo certo. */
export function validateContent(raw: RawContent): string[] {
  const errors = validateMap(raw.map, raw.catalog);
  const err = (msg: string) => errors.push(msg);

  const itemIds = new Set<string>();
  for (const item of raw.items.items) {
    if (!item.id.startsWith('item.')) err(`items: id "${item.id}" deve começar com "item."`);
    if (itemIds.has(item.id)) err(`items: id repetido "${item.id}"`);
    itemIds.add(item.id);
    if (!raw.catalog.tiles[item.tile]) err(`items: "${item.id}" usa tile inexistente "${item.tile}"`);
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
  for (const s of raw.map.surfaces ?? []) {
    if (!s.id.startsWith('surface.')) err(`mapa: superfície "${s.id}" deve começar com "surface."`);
    if (surfaceIds.has(s.id)) err(`mapa: superfície repetida "${s.id}"`);
    surfaceIds.add(s.id);
    if (!raw.map.legend[s.legend]) err(`mapa: superfície "${s.id}" usa a letra "${s.legend}", que não está na legenda`);
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
    else if ('beat' in c) {
      if (!beatIds.has(c.beat)) err(`${where}: marco inexistente "${c.beat}"`);
    } else if ('placedTag' in c) {
      if (!itemTags.has(c.placedTag)) err(`${where}: nenhum item tem a tag "${c.placedTag}"`);
    } else if ('placed' in c || 'owned' in c) {
      const id = 'placed' in c ? c.placed : c.owned;
      if (!itemIds.has(id)) err(`${where}: item inexistente "${id}"`);
    }
  };

  for (const beat of raw.story.beats) {
    const where = `story "${beat.id}"`;
    for (const dep of beat.after ?? []) if (!beatIds.has(dep)) err(`${where}: "after" aponta para "${dep}", que não existe`);
    if (beat.when) checkCondition(where, beat.when);
    beat.goal?.steps.forEach((s) => checkCondition(where, s.when));
    for (const effect of beat.effects) {
      if ('dialogue' in effect && !dialogueIds.has(effect.dialogue)) err(`${where}: fala inexistente "${effect.dialogue}"`);
    }
  }

  // Textos que a jogadora vê não podem ter notas de desenvolvimento.
  const playerText = (where: string, text: string) => {
    if (DEV_WORDS.test(text) || DEV_MARKERS.test(text)) err(`${where}: texto da jogadora parece nota de desenvolvimento ("${text}"); use "devNote"`);
  };
  raw.items.items.forEach((i) => playerText(`item "${i.id}"`, i.name));
  raw.finishes.finishes.forEach((f) => playerText(`finish "${f.id}"`, f.name));
  (raw.map.surfaces ?? []).forEach((s) => playerText(`surface "${s.id}"`, s.name));
  for (const beat of raw.story.beats) {
    if (beat.goal) playerText(`story "${beat.id}"`, beat.goal.title);
    beat.goal?.steps.forEach((s) => playerText(`story "${beat.id}"`, s.text));
  }
  for (const [id, d] of Object.entries(raw.dialogue.dialogues)) d.lines.forEach((l) => playerText(`dialogue "${id}"`, l.text));

  return errors;
}
