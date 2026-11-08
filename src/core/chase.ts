// Gato em fuga: as decisões do gato e o resultado. Puro: a cena move os sprites e chama daqui.
import type { Outcome } from './minigame';
import type { Rng } from './rng';

/** Parâmetros por dificuldade (data/minigames.json: games.chase.difficulties). */
export interface ChaseParams {
  timeSec: number;
  catSpeed: number;
  turnEveryMs: [number, number];
  hideChance: number;
  hidingSpots: number;
  hideMs: [number, number];
  noticeRadius: number;
  catchRadius: number;
  greatTimeShare: number;
}

export interface Vec {
  x: number;
  y: number;
}

/**
 * Para onde o gato corre agora. Perto da jogadora (dentro de noticeRadius) ele foge dela, com um desvio
 * aleatório de até 50° para não correr sempre em linha reta (assim dá para encurralar); longe, passeia.
 */
export function fleeHeading(rng: Rng, cat: Vec, player: Vec, noticeRadius: number): { dir: Vec; noticed: boolean } {
  const dx = cat.x - player.x;
  const dy = cat.y - player.y;
  const dist = Math.hypot(dx, dy);
  const noticed = dist < noticeRadius;
  const base = noticed && dist > 0 ? Math.atan2(dy, dx) : rng.next() * Math.PI * 2;
  const spread = noticed ? (50 * Math.PI) / 180 : 0;
  const angle = base + (rng.next() * 2 - 1) * spread;
  return { dir: { x: Math.cos(angle), y: Math.sin(angle) }, noticed };
}

/** Bateu num obstáculo ou na borda: vira para o lado (gira entre 90° e 180°, sorteado). */
export function bounceHeading(rng: Rng, dir: Vec): Vec {
  const turn = ((90 + rng.next() * 90) * Math.PI) / 180 * (rng.chance(0.5) ? 1 : -1);
  const a = Math.atan2(dir.y, dir.x) + turn;
  return { x: Math.cos(a), y: Math.sin(a) };
}

/** Pegou antes do tempo = ok; com mais que greatTimeShare do tempo sobrando = great; não pegou = fail. */
export function chaseOutcome(caught: boolean, remainingShare: number, greatTimeShare: number): Outcome {
  if (!caught) return 'fail';
  return remainingShare > greatTimeShare ? 'great' : 'ok';
}

/** Sorteia um tempo entre [min, max] (ms). */
export function between(rng: Rng, [min, max]: [number, number]): number {
  return rng.int(min, max);
}
