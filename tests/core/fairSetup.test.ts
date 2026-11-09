import { describe, expect, it } from 'vitest';
import {
  accessibleItems,
  fairItemAt,
  fairSetupOutcome,
  houseCat,
  newFairBoard,
  placeFairItem,
  placeProblem,
  removeFairItem,
  scoreFair,
  stockLeft,
  validateFairSetup,
  type FairSetupData,
  type FairSetupParams,
} from '../../src/core/fairSetup';
import { loadContent } from './content';

const content = loadContent();

// Tabuleiro pequeno e previsível (os testes não dependem do desenho do quintal em data/).
const data: FairSetupData = {
  ...content.fairSetup,
  board: { ...content.fairSetup.board, cols: 6, rows: 4, gate: [[2, 3]], blocked: [[5, 0]], decor: [] },
  // A mesa 2x1 aqui (no jogo ela é 1x1): os casos de sobrepor e fechar caminho contam com ela larga.
  items: content.fairSetup.items.map((i) => (i.kind === 'table' ? { ...i, size: [2, 1] as [number, number] } : i)),
  // Cartaz só conta encostado no portão (o tabuleiro é pequeno).
  scoring: { ...content.fairSetup.scoring, signNear: 0, treatsNear: 1 },
};
const p: FairSetupParams = { cats: 2, stock: { table: 1, carrier: 1, pen: 1, sign: 1, treats: 1 }, okAt: 50, greatAt: 85 };

describe('montar a feira', () => {
  it('pôr peças: fora, em cima do portão, do que já está no quintal, de outra peça ou sem estoque não dá', () => {
    const b = newFairBoard();
    expect(placeProblem(data, p, b, 'fair.pen', [5, 3])).toBe('out'); // 2x2 passa da borda
    expect(placeProblem(data, p, b, 'fair.sign', [2, 3])).toBe('gate');
    expect(placeProblem(data, p, b, 'fair.sign', [5, 0])).toBe('blocked');
    expect(placeFairItem(data, p, b, 'fair.table', [0, 0])).toBe(1);
    expect(placeProblem(data, p, b, 'fair.sign', [1, 0])).toBe('overlap');
    expect(placeProblem(data, p, b, 'fair.table', [3, 0])).toBe('stock');
    expect(stockLeft(data, p, b, 'table')).toBe(0);
    // Mudar de lugar não gasta estoque, e a própria peça não atrapalha.
    expect(placeFairItem(data, p, b, 'fair.table', [1, 0], 1)).toBe(1);
    expect(fairItemAt(data, b, [2, 0])?.uid).toBe(1);
    expect(b.placed).toHaveLength(1);
  });

  it('gatos: só em caixa ou cercadinho, até caber e até o limite; tirar a peça tira os gatos', () => {
    const b = newFairBoard();
    const carrier = placeFairItem(data, p, b, 'fair.carrier', [0, 0]) as number;
    const sign = placeFairItem(data, p, b, 'fair.sign', [2, 0]) as number;
    expect(houseCat(data, p, b, 'cat.a', sign)).toBe('not_holder');
    expect(houseCat(data, p, b, 'cat.a', carrier)).toBeNull();
    expect(houseCat(data, p, b, 'cat.b', carrier)).toBe('full');
    const pen = placeFairItem(data, p, b, 'fair.pen', [3, 1]) as number;
    expect(houseCat(data, p, b, 'cat.b', pen)).toBeNull();
    expect(houseCat(data, p, b, 'cat.c', pen)).toBe('limit'); // p.cats = 2
    expect(houseCat(data, p, b, 'cat.a', pen)).toBeNull(); // troca de lugar não conta como mais um
    removeFairItem(b, pen);
    expect(b.housed).toEqual({});
  });

  it('caminho: peça cercada (sem vizinha alcançável do portão) fica sem caminho', () => {
    const b = newFairBoard();
    // Mesa no canto de cima, fechada por baixo pelo cercadinho e pelo cartaz; o resto aberto.
    const table = placeFairItem(data, p, b, 'fair.table', [0, 0]) as number;
    placeFairItem(data, p, b, 'fair.pen', [0, 1]);
    expect(accessibleItems(data, b).has(table)).toBe(true); // ainda tem a vizinha (2,0)
    placeFairItem(data, p, b, 'fair.sign', [2, 0]);
    const reach = accessibleItems(data, b);
    expect(reach.has(table)).toBe(false);
    expect(scoreFair(data, p, b, 2)).toMatchObject({ hasTable: false, score: 0, visitors: 0 });
  });

  it('pontuação: tudo certo dá 100 e perfeito; sem cartaz perto e sem petiscos perto, menos', () => {
    const b = newFairBoard();
    placeFairItem(data, p, b, 'fair.table', [0, 0]);
    const pen = placeFairItem(data, p, b, 'fair.pen', [3, 0]) as number;
    placeFairItem(data, p, b, 'fair.treats', [5, 2]); // encostada no cercadinho (na diagonal)
    placeFairItem(data, p, b, 'fair.sign', [1, 3]); // ao lado do portão
    houseCat(data, p, b, 'cat.a', pen);
    houseCat(data, p, b, 'cat.b', pen);
    const best = scoreFair(data, p, b, 2);
    expect(best).toMatchObject({ housed: 1, access: 1, sign: 1, treats: 1, hasTable: true, score: 100, visitors: data.visitors.max, extraFamilies: 2 });
    expect(fairSetupOutcome(p, best)).toBe('great');
    // Cartaz longe do portão e um gato a menos: perde as duas partes.
    const sign = b.placed.find((x) => x.item === 'fair.sign')!.uid;
    placeFairItem(data, p, b, 'fair.sign', [0, 1], sign);
    delete b.housed['cat.b'];
    const worse = scoreFair(data, p, b, 2);
    expect(worse).toMatchObject({ housed: 0.5, sign: 0, score: 100 - data.scoring.sign - data.scoring.housed / 2 });
    expect(fairSetupOutcome(p, worse)).toBe('ok');
    // Café com um gato só: levar ele já é 100% acomodado.
    expect(scoreFair(data, p, b, 1).housed).toBe(1);
  });

  it('os dados do jogo são válidos e cada dificuldade cabe os gatos que pede', () => {
    expect(validateFairSetup(content.fairSetup, content.minigames.games.fair_setup!.difficulties as unknown as Record<string, FairSetupParams>)).toEqual([]);
    expect(validateFairSetup({ ...content.fairSetup, scoring: { ...content.fairSetup.scoring, sign: 1 } }, {})).toContain('fair_setup: os pesos de scoring precisam somar 100');
    expect(validateFairSetup(content.fairSetup, { x: { ...p, cats: 9 } })).toContain('fair_setup: x: caixas e cercadinhos não cabem 9 gatos');
  });
});
