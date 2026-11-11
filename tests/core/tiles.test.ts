import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { buildCatalog, frameOf, getTile, sheetResolution, type ExtraSheet, type TileMeta } from '../../src/core/tiles';

const csv = readFileSync('data/tiles.csv', 'utf8');
const meta = JSON.parse(readFileSync('data/tiles.meta.json', 'utf8')) as TileMeta;

describe('buildCatalog', () => {
  const catalog = buildCatalog(csv, meta);

  it('lê todos os tiles do CSV com as nossas decisões (os 14 sem uso saíram com o pacote antigo)', () => {
    expect(Object.keys(catalog.tiles)).toHaveLength(46);
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

describe('folha que troca a arte de tiles existentes (replaces)', () => {
  const troca = (pieces: ExtraSheet['pieces']['pieces'], overrides?: ExtraSheet['overrides']): ExtraSheet => ({
    id: 'nova',
    image: 'nova.png',
    prefix: '',
    layer: 'object',
    solid: false,
    replaces: true,
    ...(overrides ? { overrides } : {}),
    pieces: { tileSize: 64, columns: 4, rows: 2, pieces },
  });

  it('aponta o tile antigo para a folha nova e mantém solid/layer', () => {
    const antes = getTile(buildCatalog(csv, meta), 'sofa');
    const catalog = buildCatalog(csv, meta, undefined, [troca({ sofa: { col: 1, row: 1, w_tiles: antes.w, h_tiles: antes.h } })]);
    const sofa = getTile(catalog, 'sofa');
    expect(sofa).toMatchObject({ sheet: 'nova', col: 1, row: 1, w: antes.w, h: antes.h, solid: antes.solid, layer: antes.layer });
    expect(sheetResolution(catalog, 'nova')).toBe(2);
  });

  it('aceita exceção de solid/layer', () => {
    const antes = getTile(buildCatalog(csv, meta), 'sofa');
    const catalog = buildCatalog(csv, meta, undefined, [
      troca({ sofa: { col: 0, row: 0, w_tiles: antes.w, h_tiles: antes.h } }, { sofa: { solid: !antes.solid } }),
    ]);
    expect(getTile(catalog, 'sofa').solid).toBe(!antes.solid);
  });

  it('a peça nova pode trazer variações (células seguidas na linha)', () => {
    const catalog = buildCatalog(csv, meta, undefined, [troca({ cactus: { col: 0, row: 0, w_tiles: 1, h_tiles: 1, variants: 3 } })]);
    const cactus = getTile(catalog, 'cactus');
    expect(cactus.variants).toBe(3);
    expect(frameOf(catalog, cactus, 0, 0, 2)).toBe(2);
  });

  it('rise: a arte sobe acima da peça sem mudar o tamanho dela', () => {
    const catalog = buildCatalog(csv, meta, undefined, [troca({ cactus: { col: 2, row: 0, w_tiles: 1, h_tiles: 1, rise: 1 } })]);
    const cactus = getTile(catalog, 'cactus');
    expect(cactus).toMatchObject({ row: 1, h: 1, rise: 1 });
    expect(frameOf(catalog, cactus, 0, -1)).toBe(2);
    expect(() => buildCatalog(csv, meta, undefined, [troca({ cactus: { col: 0, row: 1, w_tiles: 1, h_tiles: 1, rise: 1 } })])).toThrow(/sai da folha/);
  });

  it('folha que ficou sem nenhum tile (toda a arte trocada) sai do catálogo', () => {
    const extra = (id: string, replaces: boolean, pieces: ExtraSheet['pieces']['pieces']): ExtraSheet => ({
      id, image: `${id}.png`, prefix: '', layer: 'object', solid: true, ...(replaces ? { replaces } : {}),
      pieces: { tileSize: 64, columns: 4, rows: 2, pieces },
    });
    const catalog = buildCatalog(csv, meta, undefined, [
      extra('velha', false, { banquinho: { col: 0, row: 0, w_tiles: 1, h_tiles: 1 } }),
      extra('nova', true, { banquinho: { col: 1, row: 0, w_tiles: 1, h_tiles: 1 } }),
    ]);
    expect(getTile(catalog, 'banquinho').sheet).toBe('nova');
    expect(catalog.sheets.velha).toBeUndefined();
    expect(catalog.sheets.nova).toBeDefined();
  });

  it('recusa trocar um tile que não existe ou com outro tamanho', () => {
    expect(() => buildCatalog(csv, meta, undefined, [troca({ sofa_gigante: { col: 0, row: 0, w_tiles: 1, h_tiles: 1 } })])).toThrow(/não existe/);
    expect(() => buildCatalog(csv, meta, undefined, [troca({ sofa: { col: 0, row: 0, w_tiles: 3, h_tiles: 2 } })])).toThrow(/tamanho|tiles/);
  });
});
