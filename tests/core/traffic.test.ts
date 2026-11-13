// Carros passando na rua (src/core/traffic.ts; data/world.json: traffic).
import { describe, expect, it } from 'vitest';
import { trafficOfDay, trafficStarting } from '../../src/core/traffic';
import { GameSession } from '../../src/core/session';
import { newGameState } from '../../src/core/state';
import { parseClock } from '../../src/core/time';
import { loadContent } from './content';

const content = loadContent();
const def = content.world.traffic!;

describe('carros na rua', () => {
  it('passam de vez em quando, dentro do horário, nos dois sentidos, com os carros, o ônibus e o furgão', () => {
    const seen = new Set<string>();
    const dirs = new Set<string>();
    for (let day = 1; day <= 20; day++) {
      const passes = trafficOfDay(def, day);
      expect(passes.length, `dia ${day}`).toBeGreaterThan(30);
      for (const p of passes) {
        expect(p.at).toBeGreaterThanOrEqual(parseClock(def.hours[0]));
        expect(p.at).toBeLessThan(parseClock(def.hours[1]));
        seen.add(p.vehicle);
        dirs.add(p.dir);
      }
      expect(trafficOfDay(def, day)).toEqual(passes); // o mesmo dia, a mesma agenda
    }
    expect([...seen].sort()).toEqual(def.vehicles.map((v) => v.id).sort());
    expect([...dirs].sort()).toEqual(['left', 'right']);
  });

  it('na sessão: só na rua, e cada passagem sai uma vez (minuto a minuto)', () => {
    const s = new GameSession(content, newGameState(0, 'map.street', 600));
    const all = trafficOfDay(def, s.state.day);
    let count = 0;
    for (let m = 0; m < 24 * 60; m++) count += s.trafficBetween('map.street', m, m + 1).length;
    expect(count).toBe(all.length);
    expect(s.trafficBetween('map.praca', 0, 24 * 60)).toEqual([]);
    expect(trafficStarting(all, 0, parseClock(def.hours[0]))).toEqual([]);
  });
});
