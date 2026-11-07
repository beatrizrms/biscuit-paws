import { describe, expect, it } from 'vitest';
import { darkness, formatClock, hexToRgb, parseClock, rgbToHex, tintAt, validateDayNight, type DayNightConfig } from '../../src/core/time';
import { loadContent } from './content';

const config = loadContent().dayNight;

describe('relógio', () => {
  it('lê e escreve horas', () => {
    expect(parseClock('07:30')).toBe(450);
    expect(parseClock('26:00')).toBe(1560);
    expect(formatClock(459)).toBe('07:30'); // anda de 10 em 10 minutos
    expect(formatClock(1500)).toBe('01:00');
  });

  it('cores em hex', () => {
    expect(hexToRgb('#ffe8d0')).toEqual([255, 232, 208]);
    expect(rgbToHex([255, 232, 208])).toBe(0xffe8d0);
  });
});

describe('cor do momento', () => {
  it('bate com as cores pedidas nas horas-chave (sem estação)', () => {
    expect(tintAt(parseClock('07:00'), config, 'spring')).toEqual(hexToRgb('#ffe8d0'));
    expect(tintAt(parseClock('12:00'), config, 'spring')).toEqual(hexToRgb('#ffffff'));
    expect(tintAt(parseClock('16:30'), config, 'spring')).toEqual(hexToRgb('#ffd9a8'));
    expect(tintAt(parseClock('18:30'), config, 'spring')).toEqual(hexToRgb('#c9a0c8'));
    expect(tintAt(parseClock('22:00'), config, 'spring')).toEqual(hexToRgb('#4a5a9a'));
  });

  it('a noite nunca é preto puro', () => {
    for (let t = 0; t < 26 * 60; t += 15) {
      const [r, g, b] = tintAt(t, config, 'winter');
      expect(r + g + b).toBeGreaterThan(150);
    }
  });

  it('no inverno escurece mais cedo e a noite é mais fria (mais azul)', () => {
    const t = parseClock('18:45');
    const winter = tintAt(t, config, 'winter');
    const spring = tintAt(t, config, 'spring');
    expect(darkness(winter)).toBeGreaterThan(darkness(spring));
    const night = tintAt(parseClock('23:00'), config, 'winter');
    expect(night[2] - night[0]).toBeGreaterThan(hexToRgb('#4a5a9a')[2] - hexToRgb('#4a5a9a')[0]);
  });

  it('interpola entre as horas-chave', () => {
    const mid = tintAt(parseClock('09:30'), config, 'spring');
    expect(mid[1]).toBeGreaterThan(232);
    expect(mid[1]).toBeLessThan(255);
  });

  it('dentro de casa a cor é mais fraca', () => {
    const t = parseClock('23:00');
    expect(darkness(tintAt(t, config, 'winter', true))).toBeLessThan(darkness(tintAt(t, config, 'winter')));
  });

  it('as luzes só acendem quando escurece', () => {
    expect(darkness(hexToRgb('#ffffff'))).toBe(0);
    expect(darkness(hexToRgb('#4a5a9a'))).toBeGreaterThan(0.8);
  });

  it('valida a configuração', () => {
    expect(validateDayNight(config)).toEqual([]);
    const bad = { ...config, keyframes: [{ time: '12:00', color: 'azul' }] } as DayNightConfig;
    expect(validateDayNight(bad).length).toBeGreaterThan(0);
  });
});
