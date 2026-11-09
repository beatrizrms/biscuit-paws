import { describe, expect, it } from 'vitest';
import { hslToRgb, lightRanges, recolor, REGION, rgbToHsl } from '../../src/core/recolor';

/** Imagem de N pixels (RGBA) a partir de cores [r, g, b, a]. */
const img = (...px: number[][]) => new Uint8ClampedArray(px.flat());
const mask = (...regions: number[]) => new Uint8ClampedArray(regions.flatMap((r) => [r, 0, 0, 255]));

describe('recolor', () => {
  it('HSL vai e volta', () => {
    const [h, s, l] = rgbToHsl(200, 40, 60);
    expect(hslToRgb(h, s, l)).toEqual([200, 40, 60]);
  });

  it('troca só a região com cor-alvo e mantém a ordem de luz (sombra continua mais escura)', () => {
    const data = img([120, 20, 20, 255], [220, 60, 60, 255], [240, 200, 170, 255]);
    recolor(data, mask(REGION.top, REGION.top, REGION.skin), { [REGION.top]: { hue: 120, sat: 0.5, light: [0.2, 0.6] } });
    const dark = rgbToHsl(data[0]!, data[1]!, data[2]!);
    const lit = rgbToHsl(data[4]!, data[5]!, data[6]!);
    expect(Math.round(dark[0])).toBe(120);
    expect(dark[2]).toBeCloseTo(0.2, 1);
    expect(lit[2]).toBeCloseTo(0.6, 1);
    expect([...data.slice(8, 11)]).toEqual([240, 200, 170]); // pele sem cor-alvo: igual
  });

  it('sem máscara, todo pixel visível é cabelo; transparente fica de fora', () => {
    const data = img([90, 50, 30, 255], [150, 100, 60, 255], [9, 9, 9, 0]);
    expect(lightRanges(data, null).get(REGION.hair)).toBeDefined();
    recolor(data, null, { [REGION.hair]: { hue: 45, sat: 0.7, light: [0.4, 0.8] } });
    expect(Math.round(rgbToHsl(data[0]!, data[1]!, data[2]!)[0])).toBe(45);
    expect([...data.slice(8, 12)]).toEqual([9, 9, 9, 0]);
  });

  it('faixa de luz dada de fora vale igual para outra folha da mesma peça', () => {
    const ranges = new Map<number, [number, number]>([[REGION.hair, [0, 1]]]);
    const data = img([128, 128, 128, 255]);
    recolor(data, null, { [REGION.hair]: { hue: 0, sat: 0, light: [0, 1] } }, ranges);
    expect(data[0]).toBeGreaterThan(120);
    expect(data[0]).toBeLessThan(136);
  });
});
