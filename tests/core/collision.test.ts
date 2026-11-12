import { describe, expect, it } from 'vitest';
import { playerBlockBoxes, solidBoxes, solidGrid } from '../../src/core/map';
import { loadContent } from './content';
import { GameSession } from '../../src/core/session';
import { newGameState } from '../../src/core/state';

const content = loadContent();
// O café com os móveis de sempre (a pia e o armário da despensa são móveis dela).
const cafe = new GameSession(content, newGameState(0, 'map.cafe_main')).mapData('map.cafe_main');
const ts = cafe.tileSize;

describe('colisão em pixels', () => {
  it('a base dos móveis só bloqueia a parte de baixo da célula; a grade de células continua inteira', () => {
    const boxes = solidBoxes(cafe, content.catalog, 0.5);
    const grid = solidGrid(cafe, content.catalog);
    const obj = cafe.objects.find((o) => content.catalog.tiles[o.tile]?.solid && !o.inWall)!;
    const def = content.catalog.tiles[obj.tile]!;
    const [c, r] = [obj.at[0], obj.at[1] + def.h - 1]; // célula da base (canto esquerdo)
    expect(grid[r]![c]).toBe(true);
    const box = boxes.find((b) => b.x === c * ts && b.y + b.h === (r + 1) * ts && b.w === ts);
    expect(box).toBeDefined();
    expect(box!.h).toBe(ts / 2);
  });

  it('com 1, a base bloqueia a célula inteira (como antes)', () => {
    const half = solidBoxes(cafe, content.catalog, 0.5);
    const full = solidBoxes(cafe, content.catalog, 1);
    expect(full.length).toBe(half.length);
    const area = (bs: typeof full) => bs.reduce((n, b) => n + b.w * b.h, 0);
    expect(area(full)).toBeGreaterThan(area(half));
  });
});

describe('potes e caminhas: só a personagem não atravessa', () => {
  it('peça não sólida da lista vira caixa na base da célula; fora da lista, nada; e não entra na colisão comum', () => {
    const map = { ...cafe, objects: [{ id: 'placed.b', tile: 'food_bowl', at: [5, 6] as [number, number] }, { id: 'placed.r', tile: 'floor_rug', at: [8, 6] as [number, number] }] };
    const boxes = playerBlockBoxes(map, content.catalog, content.world.playerBlockTiles ?? [], 0.5);
    expect(boxes).toEqual([{ x: 5 * ts, y: 7 * ts - ts / 2, w: ts, h: ts / 2 }]);
    expect(solidBoxes(map, content.catalog, 0.5).some((b) => b.x === 5 * ts && b.y >= 6 * ts && b.y < 7 * ts)).toBe(false);
  });
});

