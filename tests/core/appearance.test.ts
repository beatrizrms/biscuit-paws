import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { cleanPlayerName, creatorOptions, CREATOR_KEYS, cycle, layerPieces, layerRamps, normalizeAppearance, POSES, randomAppearance, validateCharacter } from '../../src/core/appearance';
import { createRng } from '../../src/core/rng';
import { REGION } from '../../src/core/recolor';
import { knownIds, parseSave } from '../../src/core/save';
import { GameSession } from '../../src/core/session';
import { newGameState } from '../../src/core/state';
import { loadContent } from './content';

const content = loadContent();
const C = content.character;

describe('aparência: escolhas', () => {
  it('girar a opção dá a volta', () => {
    // As opções que o criador mostra (só as peles com cor).
    const skins = creatorOptions(C, 'skin');
    const last = skins.at(-1)!.id;
    expect(cycle(C, { ...C.default, skin: last }, 'skin', 1).skin).toBe(skins[0]!.id);
    expect(cycle(C, { ...C.default, skin: skins[0]!.id }, 'skin', -1).skin).toBe(last);
  });

  it('sorteio repetível com a mesma semente, sempre válido e só com opções do criador', () => {
    const a = randomAppearance(C, createRng(7));
    expect(randomAppearance(C, createRng(7))).toEqual(a);
    for (let s = 0; s < 50; s++) {
      const r = randomAppearance(C, createRng(s));
      expect(normalizeAppearance(C, r).fixed).toEqual([]);
      for (const key of CREATOR_KEYS) expect(creatorOptions(C, key).map((o) => o.id)).toContain(r[key]);
    }
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
    expect(state.player).toEqual({ name: '', appearance: null, pronoun: 'she' });
    expect(new GameSession(content, state).appearance()).toEqual(C.default);
  });

  it('jogo novo começa sem nome (o criador preenche)', () => {
    expect(newGameState(100).player).toEqual({ name: '', appearance: null, pronoun: 'she' });
  });
});

describe('aparência: dados do manequim', () => {
  const m = C.mannequin;

  it('os dados atuais são válidos e toda pose tem animação', () => {
    expect(validateCharacter(C)).toEqual([]);
    for (const pose of POSES) expect(m.anims).toContain(m.poseAnim[pose]);
  });

  it('acusa pose sem animação, quadro que não divide pela resolução e reserva sem animação', () => {
    const bad = { ...C, mannequin: { ...m, frameWidth: 81, poseAnim: { ...m.poseAnim, wash: 'dance' }, outfits: { ...m.outfits, [m.fallback.outfit]: false } } };
    const errors = validateCharacter(bad);
    expect(errors.some((e) => e.includes('"wash"'))).toBe(true);
    expect(errors.some((e) => e.includes('múltiplo de resolution'))).toBe(true);
    expect(errors.some((e) => e.includes('roupa de reserva'))).toBe(true);
  });

  it('padrão e exemplos usam só peças e cores do criador', () => {
    for (const a of [C.default, ...C.presets]) for (const key of CREATOR_KEYS) expect(creatorOptions(C, key).map((o) => o.id)).toContain(a[key]);
  });
});

describe('aparência: manequim em camadas', () => {
  const L = C.mannequin;

  it('peça só de frente: o criador mostra a escolhida e o jogo usa a de reserva', () => {
    // Exemplo próprio (hoje todas as peças têm animação): casaco e afro marcados como só de frente.
    const onlyFront = { ...L, outfits: { ...L.outfits, winter_coat: false }, hair: { ...L.hair, afro: false } };
    const p = layerPieces(onlyFront, { ...C.default, top: 'winter_coat', hairStyle: 'afro' });
    expect(p).toEqual({ outfit: 'winter_coat', outfitInGame: L.fallback.outfit, hair: 'afro', hairInGame: L.fallback.hair });
  });

  it('careca não tem cabelo; roupa sem arte (do criador antigo) vira a de reserva', () => {
    const p = layerPieces(L, { ...C.default, top: 'apron', hairStyle: 'none' });
    expect(p.outfit).toBe(L.fallback.outfit);
    expect(p.hair).toBeNull();
    expect(p.hairInGame).toBeNull();
  });

  it('cores: só pele e cabelo têm rampa; a roupa fica nas cores do desenho', () => {
    const r = layerRamps(L, { ...C.default, hairColor: 'blond', skin: 'dark', topColor: 'green' });
    expect(r[REGION.hair]?.hue).toBe(L.ramps.hair.blond![0]);
    expect(r[REGION.skin]?.light).toEqual([L.ramps.skin.dark![2], L.ramps.skin.dark![3]]);
    expect(r[REGION.top]).toBeUndefined();
    expect(r[REGION.bottom]).toBeUndefined();
  });

  it('o criador só oferece peças com arte e cores com rampa', () => {
    expect(creatorOptions(C, 'top').map((o) => o.id).sort()).toEqual(Object.keys(L.outfits).sort());
    expect(creatorOptions(C, 'hairStyle').map((o) => o.id)).toContain('none');
    for (const o of creatorOptions(C, 'hairColor')) expect(L.ramps.hair[o.id]).toBeDefined();
    const random = randomAppearance(C, createRng(7));
    expect(Object.keys(L.outfits)).toContain(random.top);
  });
});
