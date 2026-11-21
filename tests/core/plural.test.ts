import { describe, expect, it } from 'vitest';
import { plural } from '../../src/core/plural';

describe('plural', () => {
  it('um fica no singular, o resto no plural', () => {
    expect(plural('Achou 2 de 2 com 1 tentativa(s).')).toBe('Achou 2 de 2 com 1 tentativa.');
    expect(plural('Remédio por 3 dia(s).')).toBe('Remédio por 3 dias.');
    expect(plural('0 susto(s)')).toBe('0 sustos');
  });
  it('vale para todas as palavras depois do número', () => {
    expect(plural('1 visitante(s) interessado(s)')).toBe('1 visitante interessado');
    expect(plural('Dia 1: 4 cliente(s)')).toBe('Dia 1: 4 clientes');
  });
  it('texto sem marcador não muda', () => {
    expect(plural('Pedido concluído (+15)')).toBe('Pedido concluído (+15)');
  });
});
