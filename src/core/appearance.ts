// Aparência da personagem principal (decisões 077, 083 e 087): o manequim com roupa e cabelo em camadas, e só pele
// e cabelo mudando de cor. O que a jogadora escolhe no início do jogo, quais peças o jogo desenha e as cores.
// Puro: sem Phaser, DOM ou window.
import { REGION, type Ramp } from './recolor';
import type { Rng } from './rng';

export interface CharacterOption {
  id: string;
  /** Nome que a jogadora vê. */
  name: string;
}

export interface StyledPart {
  styles: CharacterOption[];
  colors: CharacterOption[];
}

export const POSES = ['tray', 'cat', 'sweep', 'wipe_table', 'operate', 'stir', 'wash', 'sit'] as const;
export type Pose = (typeof POSES)[number];

export interface PoseDef {
  /** Anda com a pose (bandeja, gato no colo). Senão é uma ação parada. */
  walks: boolean;
  fps: number;
  /** Ação parada: quanto dura a animação (ms). */
  actionMs?: number;
}

/**
 * O que a jogadora escolheu. Só IDs (vão para o save). O criador mostra pele, penteado, cor do cabelo e roupa
 * (CREATOR_KEYS); os outros campos vêm do criador antigo e ficam guardados sem efeito (o save não mudou).
 */
export interface Appearance {
  skin: string;
  eyes: string;
  hairStyle: string;
  hairColor: string;
  top: string;
  topColor: string;
  bottom: string;
  bottomColor: string;
  shoes: string;
  shoesColor: string;
  glasses: string;
  head: string;
}

export const APPEARANCE_KEYS = ['skin', 'eyes', 'hairStyle', 'hairColor', 'top', 'topColor', 'bottom', 'bottomColor', 'shoes', 'shoesColor', 'glasses', 'head'] as const satisfies readonly (keyof Appearance)[];

/** Escolhas que o criador mostra (as outras não têm arte nem cor). */
export const CREATOR_KEYS = ['skin', 'hairStyle', 'hairColor', 'top'] as const satisfies readonly (keyof Appearance)[];

/** [matiz, saturação, luz mínima, luz máxima] de um ID de cor. */
export type RampDef = [number, number, number, number];

/** O manequim e as peças em camadas (arte em 64 px por tile). */
export interface MannequinData {
  _comment?: string;
  /** Pasta das folhas (em public/). */
  basePath: string;
  /** Pixels da arte por pixel do jogo (2 = arte em 64 px por tile). */
  resolution: number;
  frameWidth: number;
  frameHeight: number;
  /** Animações de cada peça completa (outfit_<id>_<anim>.png...). */
  anims: string[];
  /** Animação de cada pose do jogo. */
  poseAnim: Record<Pose, string>;
  /** ID da roupa (top do criador) -> tem todas as animações (true) ou só a prévia de frente (false). */
  outfits: Record<string, boolean>;
  /** ID do penteado -> idem. "none" (careca) não precisa estar aqui. */
  hair: Record<string, boolean>;
  /** Peça completa usada no jogo no lugar de uma que só tem a prévia. */
  fallback: { outfit: string; hair: string };
  /** Só pele e cabelo mudam de cor; a roupa fica nas cores do desenho (decisão 083). */
  ramps: { skin: Record<string, RampDef>; hair: Record<string, RampDef> };
}

export interface CharacterData {
  schemaVersion: number;
  _comment?: string;
  /** Formato das folhas: colunas (quadros) e linhas (direções). */
  sheet: { columns: number; rows: string[] };
  mannequin: MannequinData;
  skins: CharacterOption[];
  eyes: CharacterOption[];
  hair: StyledPart;
  top: StyledPart;
  bottom: StyledPart;
  shoes: StyledPart;
  accessories: { glasses: CharacterOption[]; head: CharacterOption[] };
  poses: Record<Pose, PoseDef>;
  default: Appearance;
  presets: Appearance[];
}

/** As peças das camadas para uma aparência: a que o criador mostra e a que o jogo anima. */
export interface LayerPieces {
  outfit: string;
  /** Roupa animada no jogo (a própria, ou a de reserva). */
  outfitInGame: string;
  /** null = careca. */
  hair: string | null;
  hairInGame: string | null;
}

export function layerPieces(m: MannequinData, a: Appearance): LayerPieces {
  const outfit = a.top in m.outfits ? a.top : m.fallback.outfit;
  const hair = a.hairStyle === 'none' ? null : a.hairStyle in m.hair ? a.hairStyle : m.fallback.hair;
  return {
    outfit,
    outfitInGame: m.outfits[outfit] ? outfit : m.fallback.outfit,
    hair,
    hairInGame: hair === null ? null : m.hair[hair] ? hair : m.fallback.hair,
  };
}

const toRamp = (d: RampDef | undefined): Ramp | undefined => (d ? { hue: d[0], sat: d[1], light: [d[2], d[3]] } : undefined);

/** Cor-alvo de cada região (REGION) para a aparência. Cor sem rampa: a região fica como foi desenhada. */
export function layerRamps(m: MannequinData, a: Appearance): Partial<Record<number, Ramp>> {
  return {
    [REGION.skin]: toRamp(m.ramps.skin[a.skin]),
    [REGION.hair]: toRamp(m.ramps.hair[a.hairColor]),
  };
}

/** As opções de cada escolha (na ordem da tela), todas as que existem nos dados. */
export function optionsFor(data: CharacterData, key: keyof Appearance): CharacterOption[] {
  switch (key) {
    case 'skin':
      return data.skins;
    case 'eyes':
      return data.eyes;
    case 'hairStyle':
      return data.hair.styles;
    case 'hairColor':
      return data.hair.colors;
    case 'top':
      return data.top.styles;
    case 'topColor':
      return data.top.colors;
    case 'bottom':
      return data.bottom.styles;
    case 'bottomColor':
      return data.bottom.colors;
    case 'shoes':
      return data.shoes.styles;
    case 'shoesColor':
      return data.shoes.colors;
    case 'glasses':
      return data.accessories.glasses;
    case 'head':
      return data.accessories.head;
  }
}

/** Opções do criador: só as que têm arte (peças) ou cor (pele, cabelo). */
export function creatorOptions(data: CharacterData, key: keyof Appearance): CharacterOption[] {
  const m = data.mannequin;
  const keep: Partial<Record<keyof Appearance, (id: string) => boolean>> = {
    skin: (id) => id in m.ramps.skin,
    hairStyle: (id) => id === 'none' || id in m.hair,
    hairColor: (id) => id in m.ramps.hair,
    top: (id) => id in m.outfits,
  };
  const all = optionsFor(data, key);
  const f = keep[key];
  return f ? all.filter((o) => f(o.id)) : all;
}

const option = (data: CharacterData, key: keyof Appearance, id: string) => optionsFor(data, key).find((o) => o.id === id);

/** Sem cabelo: a cor do cabelo não importa. */
export const isBald = (a: Appearance) => a.hairStyle === 'none';

/** Corrige uma aparência: ID que não existe (save antigo, arquivo editado) volta ao padrão. */
export function normalizeAppearance(data: CharacterData, raw: Partial<Record<keyof Appearance, unknown>> | undefined): { appearance: Appearance; fixed: string[] } {
  const fixed: string[] = [];
  const out = { ...data.default };
  for (const key of APPEARANCE_KEYS) {
    const v = raw?.[key];
    if (typeof v === 'string' && option(data, key, v)) out[key] = v;
    else if (raw) fixed.push(key);
  }
  return { appearance: out, fixed };
}

/** Escolha seguinte (ou anterior) de uma opção do criador, dando a volta. */
export function cycle(data: CharacterData, a: Appearance, key: keyof Appearance, step: 1 | -1): Appearance {
  const opts = creatorOptions(data, key);
  const i = Math.max(0, opts.findIndex((o) => o.id === a[key]));
  return { ...a, [key]: opts[(i + step + opts.length) % opts.length]!.id };
}

/** Uma aparência sorteada entre as opções do criador (RNG injetado: repetível nos testes). */
export function randomAppearance(data: CharacterData, rng: Rng): Appearance {
  const a = { ...data.default };
  for (const key of CREATOR_KEYS) {
    const opts = creatorOptions(data, key);
    a[key] = opts[rng.int(0, opts.length - 1)]!.id;
  }
  // Careca é menos comum no sorteio (3 em 4 vezes, troca por um penteado).
  if (a.hairStyle === 'none' && rng.chance(0.75)) a.hairStyle = creatorOptions(data, 'hairStyle').find((s) => s.id !== 'none')!.id;
  return a;
}

/** Nome da protagonista: sem espaços sobrando, até `max` letras; vazio não vale. */
export function cleanPlayerName(raw: string, max = 14): string {
  return raw.replace(/\s+/g, ' ').trim().slice(0, max);
}

export function validateCharacter(data: CharacterData): string[] {
  const errors: string[] = [];
  const groups: [string, CharacterOption[]][] = [
    ['skins', data.skins],
    ['eyes', data.eyes],
    ['hair.styles', data.hair.styles],
    ['hair.colors', data.hair.colors],
    ['top.styles', data.top.styles],
    ['top.colors', data.top.colors],
    ['bottom.styles', data.bottom.styles],
    ['bottom.colors', data.bottom.colors],
    ['shoes.styles', data.shoes.styles],
    ['shoes.colors', data.shoes.colors],
    ['accessories.glasses', data.accessories.glasses],
    ['accessories.head', data.accessories.head],
  ];
  for (const [where, opts] of groups) {
    if (opts.length === 0) errors.push(`character: ${where} vazio`);
    const ids = new Set<string>();
    for (const o of opts) {
      if (!/^[a-z0-9_]+$/.test(o.id)) errors.push(`character: ${where}: id "${o.id}" (use letras minúsculas, números e _)`);
      if (ids.has(o.id)) errors.push(`character: ${where}: id repetido "${o.id}"`);
      ids.add(o.id);
      if (!o.name.trim()) errors.push(`character: ${where}: "${o.id}" sem nome`);
    }
  }
  for (const a of [data.default, ...data.presets]) {
    const { fixed } = normalizeAppearance(data, a);
    if (fixed.length > 0) errors.push(`character: combinação com escolhas inexistentes (${fixed.join(', ')})`);
    for (const key of CREATOR_KEYS) if (!creatorOptions(data, key).some((o) => o.id === a[key])) errors.push(`character: ${key} "${a[key]}" sem arte/cor no manequim (padrão ou exemplo)`);
  }
  for (const pose of POSES) if (!data.poses[pose]) errors.push(`character: falta a pose "${pose}"`);
  const m = data.mannequin;
  if (!Number.isInteger(m.resolution) || m.resolution < 1) errors.push(`character: mannequin.resolution "${m.resolution}" (inteiro, 1 ou mais)`);
  if (m.frameWidth % m.resolution !== 0 || m.frameHeight % m.resolution !== 0) errors.push('character: mannequin: quadro precisa ser múltiplo de resolution');
  for (const pose of POSES) if (!m.anims.includes(m.poseAnim[pose])) errors.push(`character: mannequin: pose "${pose}" sem animação em anims`);
  if (!m.anims.includes('walk') || !m.anims.includes('idle')) errors.push('character: mannequin.anims precisa de walk e idle');
  for (const id of Object.keys(m.outfits)) if (!option(data, 'top', id)) errors.push(`character: mannequin: roupa "${id}" não existe em top.styles`);
  for (const id of Object.keys(m.hair)) if (!option(data, 'hairStyle', id)) errors.push(`character: mannequin: cabelo "${id}" não existe em hair.styles`);
  if (!m.outfits[m.fallback.outfit]) errors.push(`character: mannequin: roupa de reserva "${m.fallback.outfit}" precisa ter todas as animações`);
  if (!m.hair[m.fallback.hair]) errors.push(`character: mannequin: cabelo de reserva "${m.fallback.hair}" precisa ter todas as animações`);
  const ramps: [keyof MannequinData['ramps'], keyof Appearance][] = [['skin', 'skin'], ['hair', 'hairColor']];
  for (const [g, key] of ramps) for (const id of Object.keys(m.ramps[g])) if (!option(data, key, id)) errors.push(`character: mannequin.ramps.${g}: cor "${id}" não existe`);
  return errors;
}
