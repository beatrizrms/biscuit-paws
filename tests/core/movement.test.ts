import { describe, expect, it } from 'vitest';
import { movementFromInput, runFactor } from '../../src/core/movement';
import player from '../../data/player.json';

const none = { left: false, right: false, up: false, down: false };

describe('movementFromInput', () => {
  it('parado mantém a direção atual', () => {
    expect(movementFromInput(none, 80, 'left')).toEqual({ vx: 0, vy: 0, moving: false, facing: 'left' });
  });

  it('anda numa direção', () => {
    expect(movementFromInput({ ...none, up: true }, 80, 'down')).toEqual({ vx: 0, vy: -80, moving: true, facing: 'up' });
  });

  it('normaliza a diagonal', () => {
    const m = movementFromInput({ ...none, right: true, down: true }, 80, 'down');
    expect(Math.hypot(m.vx, m.vy)).toBeCloseTo(80);
    expect(m.facing).toBe('down'); // a direção atual continua válida
  });

  it('na diagonal sem direção válida, prefere a horizontal', () => {
    expect(movementFromInput({ ...none, left: true, up: true }, 80, 'down').facing).toBe('left');
  });

  it('teclas opostas se anulam', () => {
    expect(movementFromInput({ ...none, left: true, right: true }, 80, 'up').moving).toBe(false);
  });
});

describe('correr (R)', () => {
  const cfg = { factor: 1.6, carryingFactor: 1.3 };
  it('andando, 1; correndo, mais rápido; carregando, corre um pouco menos (mas ainda mais que andar)', () => {
    expect(runFactor(false, false, cfg)).toBe(1);
    expect(runFactor(false, true, cfg)).toBe(1);
    expect(runFactor(true, false, cfg)).toBe(1.6);
    expect(runFactor(true, true, cfg)).toBe(1.3);
  });

  it('os números de data/player.json seguem a regra: correr carregando fica entre andar e correr livre', () => {
    expect(player.run.carryingFactor).toBeGreaterThan(1);
    expect(player.run.carryingFactor).toBeLessThan(player.run.factor);
  });
});
