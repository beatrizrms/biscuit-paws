// Carrinho do mercado: a jogadora pega itens nas prateleiras e só paga no caixa.
// Puro: sem Phaser, DOM ou window. Não vai para o save (nada foi pago ainda); esvazia ao dormir.

export interface CartLine {
  itemId: string;
  qty: number;
}

/** Quantidade máxima de um mesmo item no carrinho. */
export const MAX_QTY_PER_ITEM = 99;

export class Cart {
  /** Ordem de entrada (o primeiro item pego aparece primeiro). */
  private items = new Map<string, number>();

  /** Quantos de `itemId` estão no carrinho. */
  qty(itemId: string): number {
    return this.items.get(itemId) ?? 0;
  }

  /** Muda a quantidade (0 ou menos tira o item). Respeita `max` (ex.: 1 para ferramenta). */
  set(itemId: string, qty: number, max = MAX_QTY_PER_ITEM): void {
    const n = Math.min(Math.max(0, Math.floor(qty)), max);
    if (n === 0) this.items.delete(itemId);
    else this.items.set(itemId, n);
  }

  add(itemId: string, n = 1, max = MAX_QTY_PER_ITEM): void {
    this.set(itemId, this.qty(itemId) + n, max);
  }

  remove(itemId: string, n = 1): void {
    this.set(itemId, this.qty(itemId) - n);
  }

  clear(): void {
    this.items.clear();
  }

  lines(): CartLine[] {
    return [...this.items].map(([itemId, qty]) => ({ itemId, qty }));
  }

  isEmpty(): boolean {
    return this.items.size === 0;
  }

  /** Total de unidades (3 laranjas + 1 açúcar = 4). */
  count(): number {
    let n = 0;
    for (const q of this.items.values()) n += q;
    return n;
  }

  /** Valor total, com o preço de cada item. */
  total(priceOf: (itemId: string) => number): number {
    let sum = 0;
    for (const [id, q] of this.items) sum += priceOf(id) * q;
    return sum;
  }

  /** Unidades dos itens que batem com `pred` (ex.: os pesados, que vão nas mãos). */
  countWhere(pred: (itemId: string) => boolean): number {
    let n = 0;
    for (const [id, q] of this.items) if (pred(id)) n += q;
    return n;
  }
}
