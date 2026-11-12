// Corações entre quem quer que seja (gato e protagonista, vizinho e protagonista, NPC e gato).
// Puro: sem Phaser, DOM ou window. Os pontos ficam no save; os corações são calculados.
import type { GameState } from './state';

export const PLAYER = 'player';

export interface RelationshipsConfig {
  schemaVersion: 1;
  pointsPerHeart: number;
  maxHearts: number;
  /** Pontos que o gato ganha ao comer da tigela. */
  feedPoints: number;
  /** Pontos por petisco dado na mão. */
  treatPoints: number;
  /** Mini game de cuidado com o gato (escova, varinha, remédio): pontos pelo resultado (falhou: nada). */
  careGamePoints?: { ok: number; great: number };
  /** Descuido: saúde, alegria ou higiene em zero por `days` dias seguidos tira `hearts` coração(ões). */
  neglect?: { days: number; hearts: number };
}

/** Chave do par, sempre na mesma ordem em que foi pedida (quem sente -> por quem). */
export function pairKey(from: string, to: string): string {
  return `${from}|${to}`;
}

export function points(state: GameState, from: string, to: string): number {
  return state.relationships[pairKey(from, to)] ?? 0;
}

export function hearts(state: GameState, config: RelationshipsConfig, from: string, to: string): number {
  return Math.min(config.maxHearts, Math.floor(points(state, from, to) / config.pointsPerHeart));
}

/** Soma pontos (sem passar do máximo nem ficar negativo) e devolve [antes, depois] em corações. */
export function addPoints(state: GameState, config: RelationshipsConfig, from: string, to: string, delta: number): [number, number] {
  const before = hearts(state, config, from, to);
  const max = config.maxHearts * config.pointsPerHeart;
  state.relationships[pairKey(from, to)] = Math.max(0, Math.min(max, points(state, from, to) + delta));
  return [before, hearts(state, config, from, to)];
}
