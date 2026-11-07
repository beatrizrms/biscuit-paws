import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { allFilesFor, cleanPlayerName, cycle, hidesBottom, layerFiles, normalizeAppearance, randomAppearance, catPropColor } from '../../src/core/appearance';
import { createRng } from '../../src/core/rng';
import { knownIds, parseSave } from '../../src/core/save';
import { GameSession } from '../../src/core/session';
import { newGameState } from '../../src/core/state';
import { loadContent } from './content';

const content = loadContent();
const C = content.character;

describe('aparência: camadas', () => {
  it('caminhada na ordem do pacote: corpo, olhos, calçado, calça, roupa, cabelo, acessórios', () => {
    const a = { ...C.default, glasses: 'round', head: 'bow_pink' };
    expect(layerFiles(C, a).map((l) => l.file)).toEqual([
      'corpo/corpo_clara.png',
      'olhos/olhos_castanho.png',
      'calcado/calcado_tenis_branco.png',
      'calca/calca_calca_jeans.png',
      'camisa/camisa_moletom_vermelho.png',
      'cabelo/cabelo_longo_castanho.png',
      'acessorio/acessorio_oculos_redondo.png',
      'acessorio/acessorio_laco_rosa.png',
    ]);
  });

  it('vestido não desenha a parte de baixo; sem cabelo não desenha cabelo', () => {
    const a = { ...C.default, top: 'dress', hairStyle: 'none' };
    expect(hidesBottom(C, a)).toBe(true);
    const files = layerFiles(C, a).map((l) => l.layer);
    expect(files).not.toContain('bottom');
    expect(files).not.toContain('hair');
  });

  it('pose: troca corpo e roupa, objeto atrás e na frente; parada usa o quadro 0 nas outras camadas', () => {
    const layers = layerFiles(C, C.default, 'sweep');
    expect(layers[0]).toEqual({ layer: 'prop_back', file: 'poses/varrer/prop/prop_atras_varrer.png', still: false });
    expect(layers.find((l) => l.layer === 'body')).toEqual({ layer: 'body', file: 'poses/varrer/corpo/corpo_varrer_clara.png', still: false });
    expect(layers.find((l) => l.layer === 'top')!.file).toBe('poses/varrer/camisa/camisa_varrer_moletom_vermelho.png');
    expect(layers.find((l) => l.layer === 'hair')!.still).toBe(true);
    // Bandeja anda: nada fica parado.
    expect(layerFiles(C, C.default, 'tray').every((l) => !l.still)).toBe(true);
  });

  it('gato no colo na cor do gato (pela variante)', () => {
    expect(catPropColor(C, 'pebble')).toBe('cinza');
    expect(catPropColor(C, 'marmalade')).toBe('laranja');
    expect(catPropColor(C, 'desconhecido')).toBe(C.catProp.fallback);
    expect(layerFiles(C, C.default, 'cat', 'cinza').map((l) => l.file)).toContain('poses/gato/prop/prop_frente_gato_cinza.png');
  });

  it('uma combinação usa a caminhada e as 7 poses (gato nas 4 cores)', () => {
    const files = allFilesFor(C, C.default);
    expect(files).toContain('poses/lavar/prop/prop_frente_lavar.png');
    expect(files.filter((f) => f.startsWith('poses/gato/prop/prop_atras_gato_'))).toHaveLength(4);
  });
});

describe('aparência: escolhas', () => {
  it('girar a opção dá a volta', () => {
    const last = C.skins.at(-1)!.id;
    expect(cycle(C, { ...C.default, skin: last }, 'skin', 1).skin).toBe(C.skins[0]!.id);
    expect(cycle(C, { ...C.default, skin: C.skins[0]!.id }, 'skin', -1).skin).toBe(last);
  });

  it('sorteio repetível com a mesma semente e sempre válido', () => {
    const a = randomAppearance(C, createRng(7));
    expect(randomAppearance(C, createRng(7))).toEqual(a);
    for (let s = 0; s < 50; s++) expect(normalizeAppearance(C, randomAppearance(C, createRng(s))).fixed).toEqual([]);
  });

  it('escolha que não existe volta ao padrão', () => {
    const { appearance, fixed } = normalizeAppearance(C, { ...C.default, hairStyle: 'moicano', skin: 42 });
    expect(appearance.hairStyle).toBe(C.default.hairStyle);
    expect(fixed).toEqual(['skin', 'hairStyle']);
  });

  it('nome: sem espaços sobrando e com limite', () => {
    expect(cleanPlayerName('  Ana   Lu  ')).toBe('Ana Lu');
    expect(cleanPlayerName('   ')).toBe('');
    expect(cleanPlayerName('a'.repeat(30))).toHaveLength(14);
  });
});

describe('aparência no save', () => {
  const known = knownIds(content);

  it('save_v12 guarda nome e aparência; escolha que sumiu volta ao padrão', () => {
    const raw = readFileSync('tests/fixtures/save_v12.json', 'utf8');
    const { state } = parseSave(raw, known);
    expect(state.player.name).toBe('Bia');
    expect(state.player.appearance?.hairStyle).toBe('curly');
    const broken = JSON.parse(raw);
    broken.player.appearance.top = 'armadura';
    expect(parseSave(JSON.stringify(broken), known).state.player.appearance?.top).toBe(C.default.top);
  });

  it('save antigo (v11): sem nome e com a aparência padrão', () => {
    const { state } = parseSave(readFileSync('tests/fixtures/save_v11.json', 'utf8'), known);
    expect(state.player).toEqual({ name: '', appearance: null });
    expect(new GameSession(content, state).appearance()).toEqual(C.default);
  });

  it('jogo novo começa sem nome (o criador preenche)', () => {
    expect(newGameState(100).player).toEqual({ name: '', appearance: null });
  });
});
