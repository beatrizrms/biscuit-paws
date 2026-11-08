// Caça ao filhote escondido: esconderijos na tela, um filhote (ou uma ninhada, no difícil) em alguns deles.
// Cada clique gasta uma tentativa; errou, vem a dica "quente/frio" pela distância até o filhote mais perto.
// Puro: sem Phaser, DOM ou window. A cena só desenha e manda os cliques para cá.
import type { Outcome } from './minigame';
import type { Rng } from './rng';

/** Um lugar possível (data/minigames.json: games.kitten_hunt.hideouts), em células da arena. */
export interface Hideout {
  id: string;
  kind: string;
  at: [number, number];
}

export interface KittenHuntParams {
  /** Quantos esconderijos aparecem (sorteados entre os da arena). */
  hideouts: number;
  /** Quantas tentativas. */
  tries: number;
  /** Tempo total (opcional: sem ele, não há cronômetro). */
  timeSec?: number;
  /** Quantos filhotes (mínimo e máximo; o difícil tem ninhada). */
  kittens: [number, number];
  /** "Great": achar todos com no máximo tantas tentativas gastas. */
  greatTries: number;
}

/** Dica de calor (data: heat): a partir de `min` (0 = longe, 1 = em cima), o nome, a cor e o tom do som. */
export interface HeatLevel {
  min: number;
  label: string;
  color: string;
  /** Multiplicador da velocidade do som (mais rápido = mais agudo, mais perto). */
  rate: number;
}

export interface HuntState {
  /** Esconderijos desta partida. */
  spots: Hideout[];
  /** Onde estão os filhotes (ids de esconderijo). */
  kittens: string[];
  searched: string[];
  found: string[];
  triesLeft: number;
  triesUsed: number;
}

export type SearchResult =
  | { kind: 'found'; done: boolean }
  | { kind: 'empty'; heat: number }
  | { kind: 'already' }
  | { kind: 'no_tries' };

/** Sorteia os esconderijos da partida e onde ficam os filhotes. */
export function setupHunt(rng: Rng, pool: readonly Hideout[], p: KittenHuntParams): HuntState {
  const bag = [...pool];
  const spots: Hideout[] = [];
  for (let i = 0; i < p.hideouts && bag.length > 0; i++) spots.push(bag.splice(rng.int(0, bag.length - 1), 1)[0]!);
  const count = Math.min(spots.length, rng.int(p.kittens[0], p.kittens[1]));
  const free = spots.map((s) => s.id);
  const kittens: string[] = [];
  for (let i = 0; i < count; i++) kittens.push(free.splice(rng.int(0, free.length - 1), 1)[0]!);
  return { spots, kittens, searched: [], found: [], triesLeft: p.tries, triesUsed: 0 };
}

/**
 * Calor de 0 (longe) a 1 (do lado) a partir de um esconderijo, pelo filhote ainda escondido mais perto.
 * `range`: distância (em células) em que o calor chega a 0.
 */
export function heatAt(state: HuntState, spotId: string, range: number): number {
  const from = state.spots.find((s) => s.id === spotId);
  const hidden = state.kittens.filter((k) => !state.found.includes(k)).map((k) => state.spots.find((s) => s.id === k)!);
  if (!from || hidden.length === 0) return 0;
  const d = Math.min(...hidden.map((k) => Math.hypot(k.at[0] - from.at[0], k.at[1] - from.at[1])));
  return Math.max(0, Math.min(1, 1 - d / range));
}

/** O nível de dica para um calor (o maior `min` que o calor alcança; os níveis vêm dos dados). */
export function heatLevel(levels: readonly HeatLevel[], heat: number): HeatLevel {
  const sorted = [...levels].sort((a, b) => b.min - a.min);
  return sorted.find((l) => heat >= l.min) ?? sorted[sorted.length - 1]!;
}

/** Procura num esconderijo: gasta uma tentativa (o mesmo lugar duas vezes não gasta). */
export function search(state: HuntState, spotId: string, range: number): SearchResult {
  if (state.searched.includes(spotId)) return { kind: 'already' };
  if (state.triesLeft <= 0) return { kind: 'no_tries' };
  state.searched.push(spotId);
  state.triesLeft--;
  state.triesUsed++;
  if (state.kittens.includes(spotId)) {
    state.found.push(spotId);
    return { kind: 'found', done: state.found.length === state.kittens.length };
  }
  return { kind: 'empty', heat: heatAt(state, spotId, range) };
}

/** Como foi: achou todos (great com poucas tentativas) ou não (acabaram as tentativas ou o tempo). */
export function huntOutcome(state: HuntState, p: Pick<KittenHuntParams, 'greatTries'>): Outcome {
  if (state.found.length < state.kittens.length) return 'fail';
  return state.triesUsed <= p.greatTries ? 'great' : 'ok';
}

export function validateHideouts(pool: readonly Hideout[], kinds: ReadonlySet<string>, maxSpots: number): string[] {
  const errors: string[] = [];
  const ids = new Set<string>();
  for (const h of pool) {
    if (ids.has(h.id)) errors.push(`minigames: esconderijo repetido "${h.id}"`);
    ids.add(h.id);
    if (!kinds.has(h.kind)) errors.push(`minigames: esconderijo "${h.id}" de tipo sem arte "${h.kind}"`);
  }
  if (pool.length < maxSpots) errors.push(`minigames: kitten_hunt pede ${maxSpots} esconderijos e só há ${pool.length}`);
  return errors;
}
