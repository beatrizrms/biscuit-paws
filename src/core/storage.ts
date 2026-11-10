// Baús do café (a caixa pet): móveis com espaço para guardar itens da mochila. Tudo chega na mochila primeiro e ela
// passa para o baú; o "empilhar" (como no Stardew Valley) leva da mochila só o que já tem no baú, para repor.
// Puro: sem Phaser, DOM ou window.
import type { ItemDef } from './content';

/** O baú de um móvel (data/items.json: storage). */
export interface StorageDef {
  /** Espaços: cada um guarda um tipo de item, em qualquer quantidade. */
  slots: number;
  /** Tags aceitas (basta uma). */
  accepts: string[];
}

/** Conteúdo de um baú: item -> quantidade. */
export type StorageContents = Record<string, number>;

export type StorageProblem = 'not_accepted' | 'storage_full' | 'nothing_here' | 'in_hands';

/** O baú aceita este item (uma das tags; móveis nunca)? */
export function storageAccepts(def: StorageDef, item: ItemDef | undefined): boolean {
  if (!item || (item.kind ?? 'furniture') === 'furniture') return false;
  return def.accepts.some((tag) => item.tags.includes(tag));
}

/** Por que não dá para guardar `itemId` (aceita? tem espaço? já tem dele lá?), ou null. */
export function storeProblem(def: StorageDef, box: StorageContents, item: ItemDef | undefined): StorageProblem | null {
  if (!item || !storageAccepts(def, item)) return 'not_accepted';
  if ((box[item.id] ?? 0) > 0) return null;
  return Object.values(box).filter((q) => q > 0).length >= def.slots ? 'storage_full' : null;
}

/** Passa `qty` (padrão: tudo) de `itemId` de um lado para o outro. Devolve quanto passou. */
export function moveBetween(from: StorageContents, to: StorageContents, itemId: string, qty = Infinity): number {
  const n = Math.min(from[itemId] ?? 0, qty);
  if (n <= 0) return 0;
  const left = (from[itemId] ?? 0) - n;
  if (left > 0) from[itemId] = left;
  else delete from[itemId];
  to[itemId] = (to[itemId] ?? 0) + n;
  return n;
}

/** Empilhar: da mochila para o baú, só o que o baú já tem (repor). Devolve os itens e quantidades que passaram. */
export function stackInto(bag: StorageContents, box: StorageContents, skip: (itemId: string) => boolean = () => false): [string, number][] {
  const moved: [string, number][] = [];
  for (const id of Object.keys(box)) {
    if ((box[id] ?? 0) <= 0 || skip(id)) continue;
    const n = moveBetween(bag, box, id);
    if (n > 0) moved.push([id, n]);
  }
  return moved;
}

export function validateStorage(itemId: string, def: StorageDef): string[] {
  const errors: string[] = [];
  if (!Number.isInteger(def.slots) || def.slots < 1) errors.push(`${itemId}: storage.slots precisa ser um inteiro, 1 ou mais`);
  if (!Array.isArray(def.accepts) || def.accepts.length === 0) errors.push(`${itemId}: storage.accepts precisa de pelo menos uma tag`);
  return errors;
}
