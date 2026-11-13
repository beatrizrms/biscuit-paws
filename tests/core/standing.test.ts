import { describe, expect, it } from 'vitest';
import type { Cell } from '../../src/core/map';
import { GameSession } from '../../src/core/session';
import { newGameState } from '../../src/core/state';
import { loadContent } from './content';

const content = loadContent();

/** Café pronto (história concluída) e um item posto no primeiro lugar livre. */
function cafe() {
  const state = newGameState(5000, 'map.cafe_main', 10 * 60);
  const session = new GameSession(content, state);
  session.debugCompleteStory();
  return { state, session };
}

function placeSomewhere(session: GameSession, itemId: string): Cell {
  session.state.inventory[itemId] = (session.state.inventory[itemId] ?? 0) + 1;
  for (let r = 4; r < 12; r++) for (let c = 3; c < 18; c++) if (session.place(itemId, [c, r]).ok) return [c, r];
  throw new Error(`não coube: ${itemId}`);
}

describe('clientes em pé', () => {
  it('mesa alta: os lugares ficam dos lados e na frente da base, virados para ela; o balcão deixa de valer', () => {
    const { session } = cafe();
    const counterSpots = session.service.spots().filter((s) => s.kind === 'standing');
    const at = placeSomewhere(session, 'item.table_tall_round');
    const base: Cell = [at[0], at[1] + 1];
    const spots = session.service.spots().filter((s) => s.kind === 'standing');
    expect(spots.length).toBeGreaterThan(0);
    expect(spots.length).toBeLessThanOrEqual(3);
    for (const s of spots) {
      expect(s.dishAt).toEqual(base);
      expect(Math.abs(s.spot[0] - base[0]) + Math.abs(s.spot[1] - base[1])).toBe(1);
      expect(s.spot[1]).toBeGreaterThanOrEqual(base[1]); // nunca atrás (em cima) da mesa
    }
    // Os lugares do balcão (os de antes) não contam mais.
    for (const s of counterSpots) expect(spots.some((x) => x.dishAt[0] === s.dishAt[0] && x.dishAt[1] === s.dishAt[1])).toBe(false);
  });

  it('bancada da parede da esquerda: os clientes ficam à direita dela, nas duas células', () => {
    const { session } = cafe();
    const at = placeSomewhere(session, 'item.bar_ledge_left');
    const spots = session.service.spots().filter((s) => s.kind === 'standing');
    for (const s of spots) {
      expect(s.spot[0]).toBe(at[0] + 1);
      expect(s.dishAt[0]).toBe(at[0]);
    }
    expect(spots.length).toBeGreaterThan(0);
  });

  it('mesa quadrada grande: cadeiras encostadas viram lugares sentados', () => {
    const { session } = cafe();
    const before = session.service.spots().filter((s) => s.kind === 'table').length;
    const at = placeSomewhere(session, 'item.table_square_big');
    session.state.inventory['item.chair_right'] = 1;
    expect(session.place('item.chair_right', [at[0] - 1, at[1] + 1]).ok).toBe(true);
    expect(session.service.spots().filter((s) => s.kind === 'table').length).toBe(before + 1);
  });
});
