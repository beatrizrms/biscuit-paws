import { describe, expect, it } from 'vitest';
import { capacityOf, type CapacityInput } from '../../src/core/capacity';
import type { Vessel } from '../../src/core/recipes';
import { loadContent } from './content';

const { servedAt } = loadContent().service;
const ALL = new Set<Vessel>(['cup', 'glass', 'plate']);
const input = (over: Partial<CapacityInput>): CapacityInput => ({
  vessels: { cup: 6, glass: 6, plate: 6 },
  standingSpots: 0,
  seats: 0,
  servedAt,
  menuVessels: ALL,
  ...over,
});

describe('capacidade (regras de data/service.json)', () => {
  it('beber: em pé ou sentado; comer: só sentado e com prato', () => {
    expect(servedAt).toEqual({ cup: ['standing', 'table'], glass: ['standing', 'table'], plate: ['table'] });
  });

  it('presente da Gabi (6 de cada) com 6 lugares: 6 clientes', () => {
    expect(capacityOf(input({ standingSpots: 4, seats: 2 })).total).toBe(6);
    expect(capacityOf(input({ standingSpots: 10, seats: 10 })).total).toBe(18);
  });

  it('o mínimo inicial: 1 lugar no balcão e 1 cadeira = 2 clientes; dá para comer na mesa', () => {
    expect(capacityOf(input({ standingSpots: 1, seats: 1 }))).toEqual({ total: 2, standing: 1, seated: 1, canEat: true });
  });

  it('sem assento ninguém come; prato sozinho não serve em pé', () => {
    const v = capacityOf(input({ vessels: { cup: 0, glass: 0, plate: 6 }, standingSpots: 3 }));
    expect(v).toEqual({ total: 0, standing: 0, seated: 0, canEat: false });
  });

  it('a louça limita: 2 xícaras para 5 lugares em pé = 2 clientes', () => {
    expect(capacityOf(input({ vessels: { cup: 2, glass: 0, plate: 0 }, standingSpots: 5 })).total).toBe(2);
  });

  it('pratos deixam a xícara livre para quem está em pé', () => {
    // 1 xícara, 1 prato, 1 lugar em pé, 1 cadeira: um bebe em pé, o outro come sentado.
    expect(capacityOf(input({ vessels: { cup: 1, glass: 0, plate: 1 }, standingSpots: 1, seats: 1 })).total).toBe(2);
  });

  it('só conta a louça que o cardápio usa', () => {
    const v = capacityOf(input({ standingSpots: 2, seats: 2, menuVessels: new Set<Vessel>(['cup']) }));
    expect(v.total).toBe(4);
    expect(v.canEat).toBe(false);
  });
});
