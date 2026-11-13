import { describe, expect, it } from 'vitest';
import { GameSession } from '../../src/core/session';
import { newGameState } from '../../src/core/state';
import { loadContent } from './content';

const content = loadContent();

describe('custo e lucro das receitas (quadro do cardápio)', () => {
  it('o custo é o preço do pacote dividido pelas doses; a fornada divide pelas fatias; toda receita dá lucro', () => {
    const session = new GameSession(content, newGameState(500, 'map.cafe_main', 10 * 60));
    const sv = session.service;
    // Café com leite: pó de café + filtro + leite em pó, uma dose de cada.
    const latte = content.recipes['recipe.cafe_latte']!;
    const expected = Object.entries(latte.ingredients).reduce((sum, [id, n]) => sum + (content.items[id]!.price / (content.items[id]!.servings ?? 1)) * n, 0);
    expect(sv.costOf('recipe.cafe_latte')).toBeCloseTo(expected, 1);
    const report: string[] = [];
    for (const r of Object.values(content.recipes)) {
      const cost = sv.costOf(r.id);
      report.push(`${r.name}: custo ${cost} venda ${r.price} lucro ${Math.round((r.price - cost) * 10) / 10}`);
      expect(cost, r.id).toBeGreaterThan(0);
      expect(r.price - cost, `${r.id} dá prejuízo`).toBeGreaterThan(0);
    }
    if (process.env.CUSTOS) console.log(report.join('\n'));
  });
});
