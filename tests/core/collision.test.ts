import { describe, expect, it } from 'vitest';
import { solidBoxes, solidGrid } from '../../src/core/map';
import { loadContent } from './content';

const content = loadContent();
const cafe = content.map;
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
