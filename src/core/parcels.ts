// Caixas do correio: os itens de um pedido dividem caixas pelo tamanho (data/delivery.json: box.capacity). Item que não
// é móvel (ração, petisco, ingrediente) ou móvel de 1 tile ocupa 1 espaço; móvel maior ocupa a área dele em tiles; o
// que passa da caixa vai sozinho numa. O limite do correio conta caixas, não itens. Puro: sem Phaser, DOM ou window.

/** Espaço que o item ocupa na caixa: a área da peça (largura x altura em tiles) ou 1 sem peça. */
export function itemSize(tile: { w: number; h: number } | undefined): number {
  return tile ? Math.max(1, tile.w * tile.h) : 1;
}

/**
 * Empacota (maior primeiro, cada um na primeira caixa onde cabe): devolve as caixas, cada uma com os ids dos itens,
 * na ordem em que entraram. Item maior que a caixa vai sozinho.
 */
export function packBoxes(itemIds: readonly string[], sizeOf: (id: string) => number, capacity: number): string[][] {
  const sorted = itemIds.map((id, i) => ({ id, i, size: sizeOf(id) })).sort((a, b) => b.size - a.size || a.i - b.i);
  const boxes: { items: string[]; free: number }[] = [];
  for (const it of sorted) {
    const box = it.size <= capacity ? boxes.find((b) => b.free >= it.size) : undefined;
    if (box) {
      box.items.push(it.id);
      box.free -= it.size;
    } else boxes.push({ items: [it.id], free: capacity - it.size });
  }
  return boxes.map((b) => b.items);
}
