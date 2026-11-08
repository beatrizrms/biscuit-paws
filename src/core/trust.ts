// Ganhar a confiança do gato assustado: sem cronômetro. A jogadora segura para chegar perto, devagar. O gato
// fica tenso quando ela se mexe (mais quanto mais perto) e relaxa quando ela para. A tensão decide o humor:
// calmo -> alerta -> bufando. Bufando e ela continua andando = um susto (perde confiança e recua); no último susto,
// acabou. Calmo, com ela perto e parada (ou bem devagar), a confiança sobe. Um petisco acelera.
// Puro: sem Phaser, DOM ou window. A cena chama stepTrust a cada quadro com o que está sendo apertado.
import type { Outcome } from './minigame';

export type CatMood = 'calm' | 'alert' | 'hissing';

export interface TrustParams {
  /** Distâncias (px lógicos) do gato: onde ela começa, de onde a confiança sobe e o mais perto que dá para chegar. */
  startDistance: number;
  nearDistance: number;
  minDistance: number;
  /** Velocidade de chegar perto e de se afastar (px/s). */
  approachSpeed: number;
  backSpeed: number;
  /** Tensão (0 a 1): quanto sobe por segundo andando (colada no gato; longe, sobe farTension disso) e quanto cai parada. */
  tensionRate: number;
  farTension: number;
  relaxRate: number;
  /** A partir de quanta tensão ele fica alerta e bufa. */
  alertAt: number;
  hissAt: number;
  /** Confiança (0 a 100) por segundo, calmo, com ela perto; andando, ganha só movingGain disso. */
  gainPerSec: number;
  movingGain: number;
  /** Susto: confiança perdida, quanto ela recua (px), quantos acabam o jogo e o intervalo mínimo entre dois. */
  scareLoss: number;
  scarePushback: number;
  maxScares: number;
  scareCooldownMs: number;
  /** Petiscos da dificuldade, quanto aceleram a confiança, por quanto tempo e quanto acalmam na hora. */
  treats: number;
  treatGain: number;
  treatSec: number;
  treatCalm: number;
}

export const FULL_TRUST = 100;

export interface TrustState {
  distance: number;
  tension: number;
  trust: number;
  scares: number;
  mood: CatMood;
  treatsLeft: number;
  /** Até quando (ms do jogo) o petisco vale. */
  treatUntil: number;
  lastScareAt: number;
  elapsed: number;
}

export interface TrustInput {
  /** Segurando para chegar perto. */
  approach: boolean;
  /** Segurando para se afastar. */
  back: boolean;
}

export function newTrust(p: TrustParams, extraTreats = 0): TrustState {
  return { distance: p.startDistance, tension: 0, trust: 0, scares: 0, mood: 'calm', treatsLeft: p.treats + extraTreats, treatUntil: 0, lastScareAt: -Infinity, elapsed: 0 };
}

/** O humor pela tensão. */
export function moodFor(tension: number, p: Pick<TrustParams, 'alertAt' | 'hissAt'>): CatMood {
  return tension >= p.hissAt ? 'hissing' : tension >= p.alertAt ? 'alert' : 'calm';
}

/** Um passo do jogo (dtMs). Devolve se houve susto neste passo. */
export function stepTrust(s: TrustState, p: TrustParams, input: TrustInput, dtMs: number): { scared: boolean } {
  const dt = dtMs / 1000;
  s.elapsed += dtMs;
  const moving = input.approach && !input.back && s.distance > p.minDistance;
  if (moving) s.distance = Math.max(p.minDistance, s.distance - p.approachSpeed * dt);
  else if (input.back) s.distance = Math.min(p.startDistance, s.distance + p.backSpeed * dt);

  // Andar perto assusta mais que andar longe; parada (ou se afastando), ele relaxa.
  const closeness = 1 - (s.distance - p.minDistance) / (p.startDistance - p.minDistance);
  if (moving) s.tension = Math.min(1, s.tension + p.tensionRate * (p.farTension + (1 - p.farTension) * closeness) * dt);
  else s.tension = Math.max(0, s.tension - p.relaxRate * dt);
  s.mood = moodFor(s.tension, p);

  let scared = false;
  if (s.mood === 'hissing' && moving && s.elapsed - s.lastScareAt >= p.scareCooldownMs) {
    scared = true;
    s.scares++;
    s.lastScareAt = s.elapsed;
    s.trust = Math.max(0, s.trust - p.scareLoss);
    s.distance = Math.min(p.startDistance, s.distance + p.scarePushback);
  }

  if (s.mood === 'calm' && s.distance <= p.nearDistance) {
    const treat = s.elapsed < s.treatUntil ? p.treatGain : 1;
    s.trust = Math.min(FULL_TRUST, s.trust + p.gainPerSec * (moving ? p.movingGain : 1) * treat * dt);
  }
  return { scared };
}

/** Dá um petisco (se ainda tem): acelera a confiança por treatSec e acalma na hora. */
export function useTreat(s: TrustState, p: TrustParams): boolean {
  if (s.treatsLeft <= 0) return false;
  s.treatsLeft--;
  s.treatUntil = s.elapsed + p.treatSec * 1000;
  s.tension = Math.max(0, s.tension - p.treatCalm);
  s.mood = moodFor(s.tension, p);
  return true;
}

/** Acabou? Confiança cheia (perfeito sem nenhum susto) ou sustos demais. null = continua. */
export function trustOutcome(s: TrustState, p: Pick<TrustParams, 'maxScares'>): Outcome | null {
  if (s.scares >= p.maxScares) return 'fail';
  if (s.trust >= FULL_TRUST) return s.scares === 0 ? 'great' : 'ok';
  return null;
}
