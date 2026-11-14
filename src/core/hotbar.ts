// Barra de itens: espaços fixos com itens da mochila e um espaço ativo (o que está "na mão" para agir).
// Puro: sem Phaser, DOM ou window. Os espaços guardam só IDs; item que acabou deixa o espaço vazio na tela.
import type { ItemDef } from './content';

export const HOTBAR_SIZE = 8;

/** O espaço fixo "mão" (antes do 1, fora dos HOTBAR_SIZE): ativo, nada na mão (mãos livres). */
export const HAND = -1;

export interface HotbarState {
  /** Item de cada espaço (null = vazio). Sempre HOTBAR_SIZE espaços. */
  slots: (string | null)[];
  /** Índice do espaço ativo (HAND = a mão livre). */
  active: number;
}

export function newHotbar(): HotbarState {
  return { slots: Array.from({ length: HOTBAR_SIZE }, () => null), active: 0 };
}

/** Itens que podem ir para a barra: tudo da mochila menos móveis e itens fixos. */
export function fitsHotbar(item: ItemDef | undefined): boolean {
  return !!item && (item.kind ?? 'furniture') !== 'furniture' && item.kind !== 'fixture';
}

/** Entra sozinho na barra: ferramentas (vassoura), itens com uso (ração, petisco) e sacos (storesAs: selecionado, vai na mão). */
// A bebida ou o doce "para viagem" também: guardado para dar de presente, vai direto para a mão (a barra).
const autoSlotted = (item: ItemDef | undefined) => item?.kind === 'tool' || !!item?.use || !!item?.storesAs || !!item?.tags.includes('togo');

const owned = (inventory: Record<string, number>, id: string | null) => !!id && (inventory[id] ?? 0) > 0;

/**
 * Ferramenta, item com uso ou "para viagem" novo vai sozinho para o primeiro espaço livre (vazio ou com item que acabou).
 * Devolve se mudou algo.
 */
export function syncHotbar(
  bar: HotbarState,
  inventory: Record<string, number>,
  items: Record<string, ItemDef>,
  /** Só estes (os que acabaram de chegar); sem lista, todos os que ela tem. */
  only?: Iterable<string>,
): boolean {
  let changed = false;
  for (const id of only ?? Object.keys(inventory)) {
    if (!owned(inventory, id) || !autoSlotted(items[id]) || bar.slots.includes(id)) continue;
    const free = bar.slots.findIndex((s) => !owned(inventory, s));
    if (free < 0) break;
    bar.slots[free] = id;
    changed = true;
  }
  return changed;
}

/** Item no espaço ativo, se ela ainda tiver. */
export function activeItem(bar: HotbarState, inventory: Record<string, number>): string | null {
  if (bar.active === HAND) return null;
  const id = bar.slots[bar.active] ?? null;
  return owned(inventory, id) ? id : null;
}

/** Põe o item num espaço. Se ele já estava em outro espaço, os dois trocam de lugar. */
export function assignToSlot(bar: HotbarState, slot: number, itemId: string): void {
  const from = bar.slots.indexOf(itemId);
  if (from >= 0) bar.slots[from] = bar.slots[slot] ?? null;
  bar.slots[slot] = itemId;
}

/** Troca o conteúdo de dois espaços (arrastar dentro da barra). */
export function swapSlots(bar: HotbarState, a: number, b: number): void {
  [bar.slots[a], bar.slots[b]] = [bar.slots[b] ?? null, bar.slots[a] ?? null];
}

export const isSlot = (slot: number) => Number.isInteger(slot) && slot >= 0 && slot < HOTBAR_SIZE;
