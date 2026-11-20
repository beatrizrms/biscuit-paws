import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { controlText, fillControls, howToRows, padNameForKey, validateControls, type ControlsConfig } from '../../src/core/controls';

const cfg = JSON.parse(readFileSync('data/controls.json', 'utf8')) as ControlsConfig;

describe('controles (data/controls.json)', () => {
  it('o arquivo é válido', () => {
    expect(validateControls(cfg)).toEqual([]);
  });

  it('acusa botão e ação desconhecidos', () => {
    const bad = structuredClone(cfg);
    (bad.pad.world as Record<string, string>).Z = 'interact';
    bad.pad.world.A = 'nada';
    const errors = validateControls(bad);
    expect(errors.some((e) => e.includes('botão desconhecido "Z"'))).toBe(true);
    expect(errors.some((e) => e.includes('ação desconhecida "nada"'))).toBe(true);
  });

  it('cada modo mostra o seu controle', () => {
    expect(controlText(cfg, 'interact', 'keys')).toBe('E');
    expect(controlText(cfg, 'interact', 'pad')).toBe('A');
    expect(controlText(cfg, 'quickMenu', 'keys')).toBe('Tab');
    expect(controlText(cfg, 'quickMenu', 'pad')).toBe('Y');
    expect(controlText(cfg, 'quickMenu', 'touch')).toBe('Menu');
    // Posicionando, o A solta e o Y guarda.
    expect(controlText(cfg, 'drop', 'pad', ['placing'])).toBe('A');
    expect(controlText(cfg, 'store', 'pad', ['placing'])).toBe('Y');
  });

  it('as dicas trocam {ação} e tiram o que o modo não tem', () => {
    const text = '{interact}: Usar · {market}: Market · {cancel}: Cancelar';
    expect(fillControls(cfg, text, 'keys')).toBe('E: Usar · C: Market · Esc: Cancelar');
    // No controle, o Market é pelo celular (losango): o trecho sai.
    expect(fillControls(cfg, text, 'pad')).toBe('A: Usar · B: Cancelar');
  });

  it('tecla entre parênteses vira o botão do momento', () => {
    expect(padNameForKey(cfg, 'E', ['world'])).toBe('A');
    expect(padNameForKey(cfg, 'P', ['minigame'])).toBe('Y');
    expect(padNameForKey(cfg, 'P', ['world'])).toBe('Select');
    // A mochila e o cardápio estão no losango: o botão dele.
    expect(padNameForKey(cfg, 'M', ['world'])).toBe('Y');
  });

  it('o Como jogar só lista o que o modo tem', () => {
    const pad = howToRows(cfg, 'windows', 'pad').map((r) => r.what);
    expect(pad).toContain('Atalhos (celular, mochila, cardápio, metas)');
    expect(pad).not.toContain('Market');
    expect(howToRows(cfg, 'windows', 'keys').map((r) => r.controls.join(' / '))).toContain('C');
  });
});
