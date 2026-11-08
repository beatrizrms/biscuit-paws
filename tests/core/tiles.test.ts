import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { buildCatalog, frameOf, getTile, sheetResolution, type ExtraSheet, type TileMeta } from '../../src/core/tiles';

const csv = readFileSync('data/tiles.csv', 'utf8');
const meta = JSON.parse(readFileSync('data/tiles.meta.json', 'utf8')) as TileMeta;

describe('buildCatalog', () => {
  const catalog = buildCatalog(csv, meta);

  it('lê todos os tiles do pacote com as nossas decisões', () => {
    expect(Object.keys(catalog.tiles)).toHaveLength(60);
    expect(getTile(catalog, 'cat_tree')).toMatchObject({ col: 6, row: 6, w: 2, h: 3, solid: true, layer: 'object' });
    expect(getTile(catalog, 'floor_rug')).toMatchObject({ w: 3, h: 2, solid: false, layer: 'floor' });
  });

  it('calcula o quadro na folha (linha * 8 + coluna)', () => {
    const window = getTile(catalog, 'window');
    expect(frameOf(catalog, window)).toBe(16);
    expect(frameOf(catalog, window, 1, 1)).toBe(25);
    expect(frameOf(catalog, getTile(catalog, 'counter_left'))).toBe(23);
  });

  it('falha com nome desconhecido', () => {
    expect(() => getTile(catalog, 'nao_existe')).toThrow(/desconhecido/);
  });

  it('exige uma decisão para cada tile do CSV', () => {
    const { floor_wood_a: _, ...rest } = meta.tiles;
    expect(() => buildCatalog(csv, { ...meta, tiles: rest })).toThrow(/floor_wood_a/);
  });

  it('recusa decisão para tile que não existe no CSV', () => {
    const tiles = { ...meta.tiles, sofa_gigante: { solid: true, layer: 'object' as const } };
    expect(() => buildCatalog(csv, { ...meta, tiles })).toThrow(/sofa_gigante/);
  });
});

describe('resolução por folha', () => {
  const extra = (id: string, tileSize: number): ExtraSheet => ({
    id,
    image: `${id}.png`,
    prefix: `${id}_`,
    layer: 'object',
    solid: true,
    pieces: { tileSize, columns: 2, rows: 2, pieces: { door: { col: 0, row: 0, w_tiles: 1, h_tiles: 2 } } },
  });

  it('folha de 32 px tem resolução 1; de 64 px, 2', () => {
    const catalog = buildCatalog(csv, meta, undefined, [extra('old', 32), extra('hd', 64)]);
    expect(sheetResolution(catalog, 'cafe')).toBe(1);
    expect(sheetResolution(catalog, 'old')).toBe(1);
    expect(catalog.sheets.old).not.toHaveProperty('resolution');
    expect(sheetResolution(catalog, 'hd')).toBe(2);
    // Posições e tamanhos continuam em tiles: a folha de 64 px não muda o mapa.
    expect(getTile(catalog, 'hd_door')).toMatchObject({ w: 1, h: 2 });
    expect(frameOf(catalog, getTile(catalog, 'hd_door'), 0, 1)).toBe(2);
  });

  it('recusa tamanho de tile que não é 32 nem 64', () => {
    expect(() => buildCatalog(csv, meta, undefined, [extra('torta', 48)])).toThrow(/48 px/);
  });
});
