// Barra de itens: espaços fixos com itens da mochila e um espaço ativo (o que está "na mão" para agir).
// Puro: sem Phaser, DOM ou window. Os espaços guardam só IDs; item que acabou deixa o espaço vazio na tela.
import type { ItemDef } from './content';

export const HOTBAR_SIZE = 8;

export interface HotbarState {
  /** Item de cada espaço (null = vazio). Sempre HOTBAR_SIZE espaços. */
  slots: (string | null)[];
  /** Índice do espaço ativo. */
  active: number;
}

export function newHotbar(): HotbarState {
  return { slots: Array.from({ length: HOTBAR_SIZE }, () => null), active: 0 };
}

/** Itens que podem ir para a barra: tudo da mochila menos móveis e itens fixos. */
export function fitsHotbar(item: ItemDef | undefined): boolean {
  return !!item && (item.kind ?? 'furniture') !== 'furniture' && item.kind !== 'fixture';
}

const owned = (inventory: Record<string, number>, id: string | null) => !!id && (inventory[id] ?? 0) > 0;

/**
 * Ferramenta nova vai sozinha para o primeiro espaço livre (vazio ou com item que acabou).
 * Devolve se mudou algo.
 */
export function syncHotbar(bar: HotbarState, inventory: Record<string, number>, items: Record<string, ItemDef>): boolean {
  let changed = false;
  for (const id of Object.keys(inventory)) {
    if (!owned(inventory, id) || items[id]?.kind !== 'tool' || bar.slots.includes(id)) continue;
    const free = bar.slots.findIndex((s) => !owned(inventory, s));
    if (free < 0) break;
    bar.slots[free] = id;
    changed = true;
  }
  return changed;
}

/** Item no espaço ativo, se ela ainda tiver. */
export function activeItem(bar: HotbarState, inventory: Record<string, number>): string | null {
  const id = bar.slots[bar.active] ?? null;
  return owned(inventory, id) ? id : null;
}

/** Põe o item no espaço ativo. Se ele já estava em outro espaço, os dois trocam de lugar. */
export function assignToActive(bar: HotbarState, itemId: string): void {
  const from = bar.slots.indexOf(itemId);
  if (from >= 0) bar.slots[from] = bar.slots[bar.active] ?? null;
  bar.slots[bar.active] = itemId;
}
