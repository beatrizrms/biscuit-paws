import { describe, expect, it } from 'vitest';
import { lightsFloor, mapLights } from '../../src/core/lights';
import { GameSession } from '../../src/core/session';
import { newGameState } from '../../src/core/state';
import { loadContent } from './content';

const content = loadContent();

describe('luzes das lâmpadas', () => {
  it('cada lâmpada ganha uma luz em cima dela; a luz feita à mão perto (o poste da rua) não duplica', () => {
    const lightTiles = { yard_lampada_chao: [{ at: [0.5, 0.25] as [number, number], radius: 44 }] };
    const objects = [
      { id: 'a', tile: 'yard_lampada_chao', at: [10, 4] as [number, number] },
      { id: 'b', tile: 'yard_lampada_chao', at: [2, 2] as [number, number] },
      { id: 'c', tile: 'plant_pot', at: [5, 5] as [number, number] },
    ];
    const lights = mapLights({ objects, lights: [{ at: [2.5, 2.3] }] }, content.catalog, lightTiles);
    expect(lights).toEqual([{ at: [2.5, 2.3] }, { at: [10.5, 4.25], radius: 44 }]);
  });

  it('a partir das 18h as lâmpadas acendem (até o alpha, em fadeMinutes)', () => {
    const cfg = { from: '18:00', alpha: 0.6, fadeMinutes: 40 };
    expect(lightsFloor(cfg, 17 * 60 + 59)).toBe(0);
    expect(lightsFloor(cfg, 18 * 60 + 20)).toBeCloseTo(0.3);
    expect(lightsFloor(cfg, 21 * 60)).toBeCloseTo(0.6);
  });

  it('o abajur que ela posiciona no café leva a luz junto', () => {
    const state = newGameState(500, 'map.cafe_main');
    const session = new GameSession(content, state);
    const lamp = Object.values(content.items).find((i) => i.tile === 'yard_lampada_chao' || i.tile === 'quarto_luminaria' || i.tile === 'decor_lampiao');
    expect(lamp).toBeDefined();
    state.placed.push({ uid: 'p.lamp', item: lamp!.id, at: [5, 8] });
    const spot = content.dayNight.lightTiles![lamp!.tile!]![0]!;
    expect(session.mapLights('map.cafe_main')).toContainEqual(expect.objectContaining({ at: [5 + spot.at[0], 8 + spot.at[1]] }));
  });
});
