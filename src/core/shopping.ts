// Lista de compras (app Notas): quais ingredientes do cardápio acabaram ou estão acabando.
// Puro: sem Phaser, DOM ou window.
import type { RecipeDef } from './recipes';

/**
 * Ingredientes das receitas do quadro com menos de `below` doses (contando a troca premium, que também serve),
 * sem repetir, na ordem do cardápio. Anota o ingrediente simples (o mais barato).
 */
export function lowIngredients(menu: readonly RecipeDef[], doses: (itemId: string) => number, below: number): string[] {
  const out: string[] = [];
  for (const r of menu) {
    for (const item of Object.keys(r.ingredients)) {
      const sub = r.premium?.[item];
      const have = doses(item) + (sub ? doses(sub) : 0);
      if (have < below && !out.includes(item)) out.push(item);
    }
  }
  return out;
}
