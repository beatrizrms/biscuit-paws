// Aparência da personagem principal: o que a jogadora escolhe no início do jogo e quais camadas
// (arquivos do pacote personagem_principal) desenhar, normal ou numa pose. Puro: sem Phaser, DOM ou window.
import { REGION, type Ramp } from './recolor';
import type { Rng } from './rng';

export interface CharacterOption {
  id: string;
  /** Nome que a jogadora vê. */
  name: string;
  /** Nome no arquivo do pacote ("" = não desenha). */
  asset: string;
  /** Roupa que cobre as pernas (vestido): não desenha a parte de baixo. */
  coversLegs?: boolean;
}

export interface StyledPart {
  styles: CharacterOption[];
  colors: CharacterOption[];
}

export const POSES = ['tray', 'cat', 'sweep', 'wipe_table', 'operate', 'stir', 'wash'] as const;
export type Pose = (typeof POSES)[number];

export interface PoseDef {
  asset: string;
  /** Anda com a pose (bandeja, gato no colo). Senão ela fica parada e só os braços e o objeto animam. */
  walks: boolean;
  fps: number;
  /** Objeto atrás e na frente dela (nome no arquivo: prop_atras_<back>.png). */
  back?: string;
  front?: string;
  /** O objeto é o gato (prop_atras_gato_<cor>.png), na cor do gato no colo. */
  catProp?: boolean;
  /** Ação parada: quanto dura a animação (ms). */
  actionMs?: number;
}

/** O que a jogadora escolheu. Só IDs (vão para o save). */
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

export interface MannequinData {
  _comment?: string;
  /** Pasta das folhas (em public/). */
  basePath: string;
  /** Pixels da arte por pixel do jogo (2 = arte em 64 px por tile). */
  resolution: number;
  frameWidth: number;
  frameHeight: number;
  /** Folha da caminhada (mesmo formato da folha das camadas: 4 colunas, linhas baixo, esquerda, direita, cima). */
  walk: string;
  /** Folha de cada pose. */
  poses: Record<Pose, string>;
  /** Folha da pose parada (em pé, pernas juntas; mesmo formato da caminhada). Sem ela, parada = 1º quadro da caminhada. */
  idle?: string;
  /** Roupa e cabelo em camadas, nas cores escolhidas (decisão 077). Sem isso, o jogo usa as folhas acima. */
  layers?: MannequinLayers;
}

/** [matiz, saturação, luz mínima, luz máxima] de um ID de cor. */
export type RampDef = [number, number, number, number];

export interface MannequinLayers {
  _comment?: string;
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

/** As peças das camadas para uma aparência: a que o criador mostra e a que o jogo anima. */
export interface LayerPieces {
  outfit: string;
  /** Roupa animada no jogo (a própria, ou a de reserva). */
  outfitInGame: string;
  /** null = careca. */
  hair: string | null;
  hairInGame: string | null;
}

export function layerPieces(L: MannequinLayers, a: Appearance): LayerPieces {
  const outfit = a.top in L.outfits ? a.top : L.fallback.outfit;
  const hair = a.hairStyle === 'none' ? null : a.hairStyle in L.hair ? a.hairStyle : L.fallback.hair;
  return {
    outfit,
    outfitInGame: L.outfits[outfit] ? outfit : L.fallback.outfit,
    hair,
    hairInGame: hair === null ? null : L.hair[hair] ? hair : L.fallback.hair,
  };
}

const toRamp = (d: RampDef | undefined): Ramp | undefined => (d ? { hue: d[0], sat: d[1], light: [d[2], d[3]] } : undefined);

/** Cor-alvo de cada região (REGION) para a aparência. Cor sem rampa: a região fica como foi desenhada. */
export function layerRamps(L: MannequinLayers, a: Appearance): Partial<Record<number, Ramp>> {
  return {
    [REGION.skin]: toRamp(L.ramps.skin[a.skin]),
    [REGION.hair]: toRamp(L.ramps.hair[a.hairColor]),
  };
}

/** Escolhas que o criador mostra no modo de camadas (as outras não têm arte nem cor). */
export const LAYER_KEYS = ['skin', 'hairStyle', 'hairColor', 'top'] as const satisfies readonly (keyof Appearance)[];

/** Opções do criador: com as camadas do manequim, só as que têm arte ou cor; senão, todas. */
export function creatorOptions(data: CharacterData, key: keyof Appearance): CharacterOption[] {
  const L = data.mannequin?.layers;
  const all = optionsFor(data, key);
  if (!L) return all;
  const keep: Partial<Record<keyof Appearance, (id: string) => boolean>> = {
    skin: (id) => id in L.ramps.skin,
    hairStyle: (id) => id === 'none' || id in L.hair,
    hairColor: (id) => id in L.ramps.hair,
    top: (id) => id in L.outfits,
  };
  const f = keep[key];
  return f ? all.filter((o) => f(o.id)) : all;
}

export interface CharacterData {
  schemaVersion: number;
  _comment?: string;
  sheet: { frameWidth: number; frameHeight: number; columns: number; rows: string[] };
  /** Pasta das camadas (em public/). */
  basePath: string;
  /** Folhas prontas do manequim (arte em 64 px): enquanto existir, substituem as camadas no jogo. */
  mannequin?: MannequinData;
  layerOrder: string[];
  skins: CharacterOption[];
  eyes: CharacterOption[];
  hair: StyledPart;
  top: StyledPart;
  bottom: StyledPart;
  shoes: StyledPart;
  accessories: { glasses: CharacterOption[]; head: CharacterOption[] };
  poses: Record<Pose, PoseDef>;
  catProp: { colors: string[]; byVariant: Record<string, string>; fallback: string };
  default: Appearance;
  presets: Appearance[];
}

/** As opções de cada escolha (na ordem da tela). */
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

const option = (data: CharacterData, key: keyof Appearance, id: string) => optionsFor(data, key).find((o) => o.id === id);

/** A roupa cobre as pernas (vestido)? Aí a parte de baixo não aparece nem pode ser escolhida. */
export function hidesBottom(data: CharacterData, a: Appearance): boolean {
  return option(data, 'top', a.top)?.coversLegs === true;
}

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

/** Escolha seguinte (ou anterior) de uma opção, dando a volta. */
export function cycle(data: CharacterData, a: Appearance, key: keyof Appearance, step: 1 | -1): Appearance {
  const opts = creatorOptions(data, key);
  const i = Math.max(0, opts.findIndex((o) => o.id === a[key]));
  return { ...a, [key]: opts[(i + step + opts.length) % opts.length]!.id };
}

/** Uma aparência sorteada (RNG injetado: repetível nos testes). */
export function randomAppearance(data: CharacterData, rng: Rng): Appearance {
  const pick = (key: keyof Appearance) => {
    const opts = creatorOptions(data, key);
    return opts[rng.int(0, opts.length - 1)]!.id;
  };
  const a = { ...data.default };
  for (const key of APPEARANCE_KEYS) a[key] = pick(key);
  // Acessório na cabeça e sem cabelo são menos comuns no sorteio (metade das vezes fica sem nada / com cabelo).
  if (rng.chance(0.5)) a.head = 'none';
  if (rng.chance(0.5)) a.glasses = 'none';
  if (a.hairStyle === 'none' && rng.chance(0.75)) a.hairStyle = data.hair.styles.find((s) => s.id !== 'none')!.id;
  return a;
}

/** Uma camada a desenhar: o arquivo (relativo a basePath) e se ela fica parada no quadro 0 da direção. */
export interface LayerFile {
  layer: string;
  file: string;
  /** Pose parada: as camadas que não são da pose usam o quadro 0 de cada direção. */
  still: boolean;
}

/**
 * Camadas a desenhar, de trás para a frente. Sem pose: a caminhada (corpo, olhos, calçado, parte de baixo,
 * roupa, cabelo, acessórios). Com pose: objeto de trás, corpo e roupa da pose, objeto da frente.
 * `catColor`: cor do gato no colo (pose "cat").
 */
export function layerFiles(data: CharacterData, a: Appearance, pose?: Pose, catColor?: string): LayerFile[] {
  const asset = (key: keyof Appearance) => option(data, key, a[key])?.asset ?? '';
  const p = pose ? data.poses[pose] : undefined;
  const still = !!p && !p.walks;
  const out: LayerFile[] = [];
  const add = (layer: string, file: string, isStill = still) => out.push({ layer, file, still: isStill });
  const propColor = catColor && data.catProp.colors.includes(catColor) ? catColor : data.catProp.fallback;
  if (p?.back) add('prop_back', `poses/${p.asset}/prop/prop_atras_${p.back}.png`, false);
  if (p?.catProp) add('prop_back', `poses/${p.asset}/prop/prop_atras_gato_${propColor}.png`, false);
  add('body', p ? `poses/${p.asset}/corpo/corpo_${p.asset}_${asset('skin')}.png` : `corpo/corpo_${asset('skin')}.png`, false);
  add('eyes', `olhos/olhos_${asset('eyes')}.png`);
  add('shoes', `calcado/calcado_${asset('shoes')}_${asset('shoesColor')}.png`);
  if (!hidesBottom(data, a)) add('bottom', `calca/calca_${asset('bottom')}_${asset('bottomColor')}.png`);
  const top = `${asset('top')}_${asset('topColor')}`;
  add('top', p ? `poses/${p.asset}/camisa/camisa_${p.asset}_${top}.png` : `camisa/camisa_${top}.png`, false);
  if (p?.front) add('prop_front', `poses/${p.asset}/prop/prop_frente_${p.front}.png`, false);
  if (p?.catProp) add('prop_front', `poses/${p.asset}/prop/prop_frente_gato_${propColor}.png`, false);
  if (!isBald(a)) add('hair', `cabelo/cabelo_${asset('hairStyle')}_${asset('hairColor')}.png`);
  if (asset('glasses')) add('accessory', `acessorio/acessorio_${asset('glasses')}.png`);
  if (asset('head')) add('accessory', `acessorio/acessorio_${asset('head')}.png`);
  return out;
}

/** Todos os arquivos que uma combinação usa (caminhada + todas as poses, com todas as cores de gato). */
export function allFilesFor(data: CharacterData, a: Appearance): string[] {
  const files = new Set(layerFiles(data, a).map((l) => l.file));
  for (const pose of POSES) {
    const colors = data.poses[pose].catProp ? data.catProp.colors : [undefined];
    for (const c of colors) for (const l of layerFiles(data, a, pose, c)) files.add(l.file);
  }
  return [...files];
}

/** Todos os arquivos de caminhada de qualquer combinação (o criador precisa de todos para a prévia). */
export function allWalkFiles(data: CharacterData): string[] {
  const files = new Set<string>();
  const s = (o: CharacterOption[]) => o.filter((x) => x.asset).map((x) => x.asset);
  for (const k of s(data.skins)) files.add(`corpo/corpo_${k}.png`);
  for (const k of s(data.eyes)) files.add(`olhos/olhos_${k}.png`);
  for (const [dir, part] of [['calcado', data.shoes], ['calca', data.bottom], ['camisa', data.top], ['cabelo', data.hair]] as const) {
    for (const st of s(part.styles)) for (const c of s(part.colors)) files.add(`${dir}/${dir}_${st}_${c}.png`);
  }
  for (const k of [...s(data.accessories.glasses), ...s(data.accessories.head)]) files.add(`acessorio/acessorio_${k}.png`);
  return [...files];
}

/** Cor do gato no colo, pela variante do gato. */
export function catPropColor(data: CharacterData, variant: string | undefined): string {
  return (variant && data.catProp.byVariant[variant]) || data.catProp.fallback;
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
  }
  for (const pose of POSES) if (!data.poses[pose]) errors.push(`character: falta a pose "${pose}"`);
  if (!data.catProp.colors.includes(data.catProp.fallback)) errors.push(`character: catProp.fallback "${data.catProp.fallback}" não está em colors`);
  for (const [v, c] of Object.entries(data.catProp.byVariant)) if (!data.catProp.colors.includes(c)) errors.push(`character: gato "${v}" com cor inexistente "${c}"`);
  const m = data.mannequin;
  if (m) {
    if (!Number.isInteger(m.resolution) || m.resolution < 1) errors.push(`character: mannequin.resolution "${m.resolution}" (inteiro, 1 ou mais)`);
    if (m.frameWidth % m.resolution !== 0 || m.frameHeight % m.resolution !== 0) errors.push('character: mannequin: quadro precisa ser múltiplo de resolution');
    if (!m.walk) errors.push('character: mannequin sem folha de caminhada');
    for (const pose of POSES) if (!m.poses[pose]) errors.push(`character: mannequin sem folha da pose "${pose}"`);
    const L = m.layers;
    if (L) {
      for (const pose of POSES) if (!L.anims.includes(L.poseAnim[pose])) errors.push(`character: mannequin.layers: pose "${pose}" sem animação em anims`);
      for (const id of Object.keys(L.outfits)) if (!optionsFor(data, 'top').some((o) => o.id === id)) errors.push(`character: mannequin.layers: roupa "${id}" não existe em top.styles`);
      for (const id of Object.keys(L.hair)) if (!optionsFor(data, 'hairStyle').some((o) => o.id === id)) errors.push(`character: mannequin.layers: cabelo "${id}" não existe em hair.styles`);
      if (!L.outfits[L.fallback.outfit]) errors.push(`character: mannequin.layers: roupa de reserva "${L.fallback.outfit}" precisa ter todas as animações`);
      if (!L.hair[L.fallback.hair]) errors.push(`character: mannequin.layers: cabelo de reserva "${L.fallback.hair}" precisa ter todas as animações`);
      const groups: [keyof MannequinLayers['ramps'], keyof Appearance][] = [['skin', 'skin'], ['hair', 'hairColor']];
      for (const [g, key] of groups) for (const id of Object.keys(L.ramps[g])) if (!optionsFor(data, key).some((o) => o.id === id)) errors.push(`character: mannequin.layers.ramps.${g}: cor "${id}" não existe`);
      for (const key of LAYER_KEYS) if (!creatorOptions(data, key).some((o) => o.id === data.default[key])) errors.push(`character: default.${key} "${data.default[key]}" sem arte/cor nas camadas`);
    }
  }
  return errors;
}
