import { describe, expect, it } from 'vitest';
import { spreadBoxes, type AnchoredBox } from '../../src/core/spread';

const box = (x: number, y: number): AnchoredBox => ({ x, y, w: 40, h: 44 });
const overlaps = (a: AnchoredBox, b: AnchoredBox, oa: [number, number], ob: [number, number]) =>
  Math.abs(a.x + oa[0] - (b.x + ob[0])) < (a.w + b.w) / 2 && Math.abs(a.y + oa[1] - (b.y + ob[1])) < (a.h + b.h) / 2;

describe('espalhar balões', () => {
  it('caixas longe uma da outra não saem do lugar', () => {
    expect(spreadBoxes([box(0, 0), box(100, 0)])).toEqual([
      [0, 0],
      [0, 0],
    ]);
  });

  it('lado a lado: as duas saem meio a meio até não encostar', () => {
    const boxes = [box(0, 0), box(32, 0)];
    const off = spreadBoxes(boxes);
    expect(off[0]![0]).toBeLessThan(0);
    expect(off[1]![0]).toBeGreaterThan(0);
    expect(off[0]![0]).toBeCloseTo(-off[1]![0]);
    expect(overlaps(boxes[0]!, boxes[1]!, off[0]!, off[1]!)).toBe(false);
  });

  it('uma em cima da outra: só a de cima sobe', () => {
    const boxes = [box(0, 0), box(4, 32)];
    const off = spreadBoxes(boxes);
    expect(off[1]).toEqual([0, 0]);
    expect(off[0]![1]).toBeLessThan(0);
  });

  it('mesa cheia (4 lugares em volta de uma mesa de 32 px): nenhum balão encosta no outro', () => {
    // pés: em cima (220), à esquerda e à direita (252), embaixo (284); balão 60 px acima dos pés
    const boxes = [box(208, 160), box(176, 192), box(240, 192), box(208, 224)];
    const off = spreadBoxes(boxes);
    for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) expect(overlaps(boxes[i]!, boxes[j]!, off[i]!, off[j]!)).toBe(false);
    for (const [dx, dy] of off) expect(Math.max(Math.abs(dx), Math.abs(dy))).toBeLessThanOrEqual(28);
  });

  it('não sai mais que o limite, mesmo com muitas caixas no mesmo lugar', () => {
    const off = spreadBoxes([box(0, 0), box(0, 0), box(0, 0), box(0, 0)], 2, 20);
    for (const [dx, dy] of off) expect(Math.max(Math.abs(dx), Math.abs(dy))).toBeLessThanOrEqual(20);
  });
});
