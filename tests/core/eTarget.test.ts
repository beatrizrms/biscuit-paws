// O alvo do E (src/core/eTarget.ts): uma regra só para sujeira, equipamentos, gatos, potes, janelas e pontos de pedido.
import { describe, expect, it } from 'vitest';
import { facingScore, pickETarget, type ECandidate } from '../../src/core/eTarget';
import type { Cell } from '../../src/core/map';

// Ela em pé na célula (5,5), os pés nela; olhando para cima, a célula da frente é (5,4).
const at: Cell = [5, 5];
const feet: Cell[] = [[5, 5]];
const c = (name: string, cells: Cell[], tier: number, extra: Partial<ECandidate<string>> = {}): ECandidate<string> => ({ cells, tier, value: name, ...extra });

describe('a frente dela', () => {
  it('bem na frente (ou nos pés) = 0; na diagonal da frente ou uma mais adiante = 1; do lado ou atrás = 2', () => {
    expect(facingScore([[5, 4]], feet, at, 'up')).toBe(0);
    expect(facingScore([[5, 5]], feet, at, 'up')).toBe(0);
    expect(facingScore([[4, 4]], feet, at, 'up')).toBe(1);
    expect(facingScore([[5, 3]], feet, at, 'up')).toBe(1);
    expect(facingScore([[4, 5]], feet, at, 'up')).toBe(2);
    expect(facingScore([[5, 6]], feet, at, 'up')).toBe(2);
    expect(facingScore([[6, 5]], feet, at, 'right')).toBe(0);
    expect(facingScore([[7, 6]], feet, at, 'right')).toBe(1);
  });
});

describe('conflitos com sujeira perto dos itens', () => {
  it('vassoura na mão, pó na diagonal e a cafeteira bem na frente: a cafeteira', () => {
    const pick = pickETarget([c('pó', [[4, 4]], 5, { tool: true }), c('cafeteira', [[5, 4]], 3)], feet, at, 'up');
    expect(pick).toBe('cafeteira');
  });

  it('vassoura na mão, pó bem na frente e a cafeteira do lado: o pó', () => {
    const pick = pickETarget([c('cafeteira', [[4, 5]], 3), c('pó', [[5, 4]], 5, { tool: true })], feet, at, 'up');
    expect(pick).toBe('pó');
  });

  it('pó embaixo do pote, os dois bem na frente: com a vassoura, o pó; com a ração, o pote', () => {
    expect(pickETarget([c('pote', [[5, 4]], 5), c('pó', [[5, 4]], 5, { tool: true })], feet, at, 'up')).toBe('pó');
    expect(pickETarget([c('pote', [[5, 4]], 5, { tool: true }), c('pó', [[5, 4]], 5)], feet, at, 'up')).toBe('pote');
  });

  it('nada na frente: o tipo desempata (equipamento antes do ponto de pedido), depois o mais perto da frente', () => {
    expect(pickETarget([c('ponto', [[4, 5]], 5), c('pia', [[6, 5]], 3)], feet, at, 'up')).toBe('pia');
    expect(pickETarget([c('pó longe', [[7, 6]], 5, { tool: true }), c('pó perto', [[4, 4]], 5, { tool: true })], feet, at, 'up')).toBe('pó perto');
  });

  it('o que é estado vence tudo: entregar ao cliente, mesmo com a vassoura e o pó bem na frente', () => {
    const pick = pickETarget([c('pó', [[5, 4]], 5, { tool: true }), c('cliente', [[6, 5]], 3, { sticky: true })], feet, at, 'up');
    expect(pick).toBe('cliente');
  });

  it('girar o corpo troca o alvo, sem ela sair do lugar (a dica segue a frente)', () => {
    const cands = [c('cafeteira', [[5, 4]], 3), c('pó', [[6, 5]], 5, { tool: true }), c('gato', [[4, 5]], 4)];
    expect(pickETarget(cands, feet, at, 'up')).toBe('cafeteira');
    expect(pickETarget(cands, feet, at, 'right')).toBe('pó');
    expect(pickETarget(cands, feet, at, 'left')).toBe('gato');
  });

  it('o que só explica (a caixa de areia sem a areia na mão) perde da sujeira do lado, com a vassoura', () => {
    const pick = pickETarget([c('caixa de areia', [[5, 4]], 8, { weak: true }), c('cocô', [[6, 5]], 5, { tool: true })], feet, at, 'up');
    expect(pick).toBe('cocô');
    // Sozinho, ele ainda responde (diz o que falta).
    expect(pickETarget([c('caixa de areia', [[5, 4]], 8, { weak: true })], feet, at, 'up')).toBe('caixa de areia');
  });

  it('nenhum candidato: nada', () => {
    expect(pickETarget([], feet, at, 'down')).toBeNull();
  });
});
