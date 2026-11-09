// Match de adoção: gatos do abrigo da vila e famílias com perfil; a jogadora leva cada gato para uma família.
// Ao confirmar, cada par ganha um veredito (boa, ok, ruim) e um porquê, pelas regras de data/adoption.json.
// Puro: sem Phaser, DOM ou window.
import type { Outcome } from './minigame';
import type { Rng } from './rng';

export type Verdict = 'good' | 'ok' | 'bad';

export interface AdoptCat {
  id: string;
  name: string;
  /** Variante do Cosy Cats (cor). */
  variant: string;
  /** Um valor por traço (personality, age, coat...). */
  traits: Record<string, string>;
}

export interface FamilyProfile {
  id: string;
  name: string;
  description: string;
  /** "grupo.valor" -> pontos (positivo combina; o que não está aqui vale 0). */
  scores: Record<string, number>;
  /** "grupo.valor" -> o porquê, em uma linha. */
  notes: Record<string, string>;
}

export interface AdoptionData {
  schemaVersion: 1;
  traits: Record<string, Record<string, string>>;
  verdicts: { goodAt: number; badAt: number };
  /** Reputação por adoção (boa vale mais que ok). */
  reputation: Record<Verdict, number>;
  /** Gatos do café que nunca saem por adoção (os da história). */
  protectedCats: string[];
  cats: AdoptCat[];
  families: FamilyProfile[];
  /** Gatos do café na feira (eventos de data/festivals.json): o jeito pela personalidade e os traços padrão. */
  fair: CafeTraitsConfig;
}

export interface CafeTraitsConfig {
  /** Personalidade do gato do café -> jeito na adoção (calm, playful, shy). */
  personalityFrom: Record<string, string>;
  /** Traços de quem não tem adoptionTraits nem tradução. */
  defaultTraits: Record<string, string>;
}

export function validateCafeTraits(cfg: CafeTraitsConfig, traits: Record<string, Record<string, string>>): string[] {
  const errors: string[] = [];
  for (const [from, to] of Object.entries(cfg.personalityFrom)) if (!traits.personality?.[to]) errors.push(`adoption: fair: personalityFrom "${from}" -> jeito inexistente "${to}"`);
  for (const [g, v] of Object.entries(cfg.defaultTraits)) if (!traits[g]?.[v]) errors.push(`adoption: fair: defaultTraits com traço inexistente "${g}.${v}"`);
  return errors;
}

export interface AdoptionParams {
  /** Quantos gatos (e famílias) na partida: 3 a 5. */
  pairs: number;
  /** Fração mínima dos pontos (boa 2, ok 1, ruim 0) para "conseguiu"; todas boas = perfeito. */
  okAt: number;
}

export interface Judgement {
  catId: string;
  familyId: string;
  verdict: Verdict;
  score: number;
  /** O traço que mais pesou para o veredito ("personality.calm") e a nota dele, se houver. */
  trait?: string;
  note?: string;
}

const traitKeys = (cat: AdoptCat) => Object.entries(cat.traits).map(([group, value]) => `${group}.${value}`);

/** O veredito de um par e o porquê. */
export function judge(data: Pick<AdoptionData, 'verdicts'>, cat: AdoptCat, family: FamilyProfile): Judgement {
  const keys = traitKeys(cat);
  const score = keys.reduce((n, k) => n + (family.scores[k] ?? 0), 0);
  const verdict: Verdict = score >= data.verdicts.goodAt ? 'good' : score <= data.verdicts.badAt ? 'bad' : 'ok';
  // O motivo: boa -> o traço que mais ajudou; ruim -> o que mais atrapalhou; ok -> o que mais pesou para qualquer lado.
  const weigh = (k: string) => {
    const s = family.scores[k] ?? 0;
    return verdict === 'good' ? s : verdict === 'bad' ? -s : Math.abs(s);
  };
  const best = keys.filter((k) => family.notes[k] && (family.scores[k] ?? 0) !== 0).sort((a, b) => weigh(b) - weigh(a))[0];
  return { catId: cat.id, familyId: family.id, verdict, score, ...(best ? { trait: best, note: family.notes[best] } : {}) };
}

/** Dá para casar todos os gatos com famílias, cada par "boa"? (emparelhamento perfeito, algoritmo de Kuhn) */
export function hasPerfectMatch(data: Pick<AdoptionData, 'verdicts'>, cats: readonly AdoptCat[], families: readonly FamilyProfile[]): boolean {
  const good = cats.map((c) => families.map((f) => judge(data, c, f).verdict === 'good'));
  const owner: number[] = families.map(() => -1);
  const tryCat = (ci: number, seen: boolean[]): boolean => {
    for (let fi = 0; fi < families.length; fi++) {
      if (!good[ci]![fi] || seen[fi]) continue;
      seen[fi] = true;
      if (owner[fi] === -1 || tryCat(owner[fi]!, seen)) {
        owner[fi] = ci;
        return true;
      }
    }
    return false;
  };
  return cats.every((_, ci) => tryCat(ci, families.map(() => false)));
}

/** O que a adoção precisa saber de um gato do café (cats.json + o nome que a jogadora deu). */
export interface CafeCatInfo {
  id: string;
  name: string;
  variant: string;
  personality: string;
  adoptionTraits?: Record<string, string>;
}

/**
 * Gatos do café como gatos de adoção (feira): os traços de adoptionTraits ou, sem eles, o jeito traduzido da
 * personalidade (fair.personalityFrom) e o resto de fair.defaultTraits.
 */
export function cafeAdoptCats(data: Pick<AdoptionData, 'fair' | 'traits'>, cats: readonly CafeCatInfo[]): AdoptCat[] {
  const f = data.fair;
  return cats.map((c) => {
    const traits: Record<string, string> = { ...f.defaultTraits };
    const mapped = f.personalityFrom[c.personality];
    if (mapped) traits.personality = mapped;
    Object.assign(traits, c.adoptionTraits ?? {});
    return { id: c.id, name: c.name, variant: c.variant, traits };
  });
}

/**
 * Sorteia os gatos e as famílias da partida, sempre com uma resposta toda "boa" possível (senão o perfeito seria sorte).
 * `fixed`: gatos que precisam estar (os do café, na feira); o resto vem do abrigo da vila. Se com eles não houver
 * resposta toda boa, fica a melhor tentativa (os gatos do café não são trocados). `extraFamilies`: famílias a mais
 * que gatos (os visitantes da feira montada): mais escolha, mesmo número de adoções.
 */
export function setupMatch(rng: Rng, data: AdoptionData, pairs: number, fixed: readonly AdoptCat[] = [], extraFamilies = 0): { cats: AdoptCat[]; families: FamilyProfile[] } {
  const draw = <T>(pool: readonly T[], n: number): T[] => {
    const bag = [...pool];
    const out: T[] = [];
    for (let i = 0; i < n && bag.length > 0; i++) out.push(bag.splice(rng.int(0, bag.length - 1), 1)[0]!);
    return out;
  };
  const mine = fixed.slice(0, pairs);
  const pool = data.cats.filter((c) => !mine.some((m) => m.id === c.id));
  const roll = () => ({ cats: [...mine, ...draw(pool, pairs - mine.length)], families: draw(data.families, pairs + extraFamilies) });
  let last = roll();
  for (let tries = 0; tries < 500 && !hasPerfectMatch(data, last.cats, last.families); tries++) last = roll();
  return last;
}

/** Como foi: todas boas = perfeito; pontos (boa 2, ok 1, ruim 0) acima de okAt = conseguiu; senão, não deu. */
export function adoptionOutcome(judgements: readonly Judgement[], p: Pick<AdoptionParams, 'okAt'>): Outcome {
  if (judgements.length === 0) return 'fail';
  if (judgements.every((j) => j.verdict === 'good')) return 'great';
  const points = judgements.reduce((n, j) => n + (j.verdict === 'good' ? 2 : j.verdict === 'ok' ? 1 : 0), 0);
  return points / (2 * judgements.length) >= p.okAt ? 'ok' : 'fail';
}

export function validateAdoption(data: AdoptionData, refs: { variants: ReadonlySet<string>; maxPairs: number }): string[] {
  const errors: string[] = [];
  const err = (m: string) => errors.push(`adoption: ${m}`);
  const known = new Set(Object.entries(data.traits).flatMap(([g, values]) => Object.keys(values).map((v) => `${g}.${v}`)));
  const ids = new Set<string>();
  for (const c of data.cats) {
    if (!c.id.startsWith('adopt.')) err(`gato "${c.id}" deve começar com "adopt."`);
    if (ids.has(c.id)) err(`gato repetido "${c.id}"`);
    ids.add(c.id);
    if (!refs.variants.has(c.variant)) err(`gato "${c.id}" com variante inexistente "${c.variant}"`);
    for (const g of Object.keys(data.traits)) if (!c.traits[g]) err(`gato "${c.id}" sem o traço "${g}"`);
    for (const k of traitKeys(c)) if (!known.has(k)) err(`gato "${c.id}" com traço desconhecido "${k}"`);
  }
  for (const f of data.families) {
    if (!f.id.startsWith('fam.')) err(`família "${f.id}" deve começar com "fam."`);
    if (ids.has(f.id)) err(`id repetido "${f.id}"`);
    ids.add(f.id);
    for (const k of [...Object.keys(f.scores), ...Object.keys(f.notes)]) if (!known.has(k)) err(`família "${f.id}" usa traço desconhecido "${k}"`);
    for (const k of Object.keys(f.scores)) if (!f.notes[k]) err(`família "${f.id}" sem nota para "${k}"`);
  }
  if (data.cats.length < refs.maxPairs || data.families.length < refs.maxPairs) err(`a partida pede ${refs.maxPairs} pares e há ${data.cats.length} gatos e ${data.families.length} famílias`);
  if (!(data.verdicts.goodAt > data.verdicts.badAt)) err('verdicts.goodAt precisa ser maior que badAt');
  if (!(data.reputation.good > data.reputation.ok)) err('reputation: adoção boa precisa valer mais que ok');
  return errors;
}
