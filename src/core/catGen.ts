// Perfis de gato (data/cat_profiles.json) e gatos gerados por semente para as chegadas: aparência (variante do
// Cosy Cats), personalidade e condição sorteadas, com nomes sugeridos. Puro: sem Phaser, DOM ou window.
// O gato gerado vira uma definição igual às de data/cats.json, guardada no save (state.catDefs).
import type { CatDef } from './cats';
import { pickWeighted, type Rng } from './rng';

export type TrustLevel = 'easy' | 'normal' | 'hard';
/** O que o gato precisa para entrar bem (a etapa da chegada cuida disso). */
export type CatNeed = 'food' | 'vet' | 'warmth';
export const CAT_NEEDS: readonly CatNeed[] = ['food', 'vet', 'warmth'];

export interface PersonalityProfile {
  /** Dificuldade do mini game de confiança com este gato. */
  trust: TrustLevel;
  /** Corações para ele confiar (meta depois de entrar). */
  heartsToTrust: number;
}

export interface ConditionProfile {
  /** Saúde ao chegar (0 a health.max). */
  health: number;
  /** Chega doente (doença sorteada de data/health.json). */
  sick?: boolean;
  /** Chega com fome (a etapa pede ração antes de entrar). */
  hungry?: boolean;
  needs: CatNeed[];
  /** Idade, para a adoção (sem ela: adulto). */
  age?: 'kitten' | 'senior';
}

export interface CatProfilesData {
  schemaVersion: 1;
  personalities: Record<string, PersonalityProfile>;
  conditions: Record<string, ConditionProfile>;
  generated: {
    variants: string[];
    names: string[];
    personalityWeights: Record<string, number>;
    conditionWeights: Record<string, number>;
    /** Pelo de cada variante (para a adoção); sem ela, curto. */
    coat: Record<string, 'short' | 'long'>;
  };
}

/** O que a chegada pede do gato gerado: o que vier fixo nos dados; o resto é sorteado. */
export interface GenerateSpec {
  personality?: string;
  condition?: string;
  variant?: string;
}

/** Quantos nomes sugeridos o gato gerado traz para a caixa de nome. */
const SUGGESTIONS = 3;

/**
 * Gera um gato: id estável pela sequência (cat.gen.<n>), variante, personalidade e condição (fixas ou sorteadas),
 * nomes sugeridos sem repetir e os traços de adoção (idade pela condição, pelo pela variante).
 */
export function generateCat(rng: Rng, profiles: CatProfilesData, spec: GenerateSpec, seq: number): { def: CatDef; condition: string } {
  const g = profiles.generated;
  const variant = spec.variant ?? g.variants[rng.int(0, g.variants.length - 1)]!;
  const personality = spec.personality ?? pickWeighted(rng, g.personalityWeights);
  const condition = spec.condition ?? pickWeighted(rng, g.conditionWeights);
  const pool = [...g.names];
  const nameSuggestions: string[] = [];
  for (let i = 0; i < SUGGESTIONS && pool.length > 0; i++) nameSuggestions.push(pool.splice(rng.int(0, pool.length - 1), 1)[0]!);
  const age = profiles.conditions[condition]?.age ?? 'adult';
  const def: CatDef = {
    id: `cat.gen.${seq}`,
    variant,
    personality,
    nameSuggestions,
    adoptionTraits: { age, coat: g.coat[variant] ?? 'short' },
    tags: ['generated', `condition:${condition}`],
  };
  return { def, condition };
}

export function validateCatProfiles(data: CatProfilesData, refs: { variants: ReadonlySet<string>; catPersonalities: readonly string[] }): string[] {
  const errors: string[] = [];
  const err = (m: string) => errors.push(`cat_profiles: ${m}`);
  for (const [id, p] of Object.entries(data.personalities)) {
    if (!['easy', 'normal', 'hard'].includes(p.trust)) err(`personalidade "${id}" com trust inválido "${p.trust}"`);
    if (!(p.heartsToTrust >= 0)) err(`personalidade "${id}" com heartsToTrust inválido`);
  }
  for (const [id, c] of Object.entries(data.conditions)) {
    if (!(c.health > 0)) err(`condição "${id}" com saúde inválida`);
    for (const n of c.needs) if (!CAT_NEEDS.includes(n)) err(`condição "${id}" com necessidade desconhecida "${n}"`);
  }
  for (const p of refs.catPersonalities) if (!data.personalities[p]) err(`personalidade "${p}" (data/cats.json) sem perfil`);
  const g = data.generated;
  if (g.variants.length === 0 || g.names.length === 0) err('generated precisa de variantes e nomes');
  for (const v of [...g.variants, ...Object.keys(g.coat)]) if (!refs.variants.has(v)) err(`variante inexistente "${v}"`);
  for (const k of Object.keys(g.personalityWeights)) if (!data.personalities[k]) err(`personalityWeights com personalidade inexistente "${k}"`);
  for (const k of Object.keys(g.conditionWeights)) if (!data.conditions[k]) err(`conditionWeights com condição inexistente "${k}"`);
  return errors;
}
