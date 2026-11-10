// Ganhar a confiança do gato assustado: sem cronômetro. A jogadora segura para chegar perto, devagar. O gato
// fica tenso quando ela se mexe (mais quanto mais perto) e relaxa quando ela para. A tensão decide o humor:
// calmo -> alerta -> bufando. Bufando e ela continua andando = um susto (perde confiança e recua); no último susto,
// acabou. Calmo, com ela perto e parada (ou bem devagar), a confiança sobe. Um petisco acelera.
// O humor dele muda sozinho: o espaço pessoal (o mais perto que ele aceita agora) é sorteado de tempos em tempos e,
// mais perto que isso, ele fica tenso mesmo com ela parada (ela recua um pouco, espera e volta); de vez em quando
// um barulho o assusta do nada. Respeitando o espaço, quanto mais perto, mais rápido a confiança sobe.
// Puro: sem Phaser, DOM ou window. A cena chama stepTrust a cada quadro com o que está sendo apertado.
import type { Outcome } from './minigame';
import type { Rng } from './rng';

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
  /** Espaço pessoal (px): sorteado entre [min, max] a cada comfortEverySec [min, max] segundos. */
  comfortRange: [number, number];
  comfortEverySec: [number, number];
  /** Tensão por segundo com ela mais perto que o espaço pessoal, mesmo parada. */
  crowdRate: number;
  /** Respeitando o espaço, a confiança sobe até (1 + closeBonus) vezes mais rápido colada no gato. */
  closeBonus: number;
  /** Sustinho do nada (um barulho): a cada startleEverySec [min, max] segundos, a tensão sobe startleTension. */
  startleEverySec: [number, number];
  startleTension: number;
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
  /** O espaço pessoal de agora (px) e quando ele muda / quando vem o próximo sustinho (ms do jogo). */
  comfort: number;
  nextComfortAt: number;
  nextStartleAt: number;
}

export interface TrustInput {
  /** Segurando para chegar perto. */
  approach: boolean;
  /** Segurando para se afastar. */
  back: boolean;
}

const between = (rng: Rng, [a, b]: [number, number]) => a + rng.next() * (b - a);

export function newTrust(p: TrustParams, rng: Rng, extraTreats = 0): TrustState {
  return {
    distance: p.startDistance,
    tension: 0,
    trust: 0,
    scares: 0,
    mood: 'calm',
    treatsLeft: p.treats + extraTreats,
    treatUntil: 0,
    lastScareAt: -Infinity,
    elapsed: 0,
    comfort: between(rng, p.comfortRange),
    nextComfortAt: between(rng, p.comfortEverySec) * 1000,
    nextStartleAt: between(rng, p.startleEverySec) * 1000,
  };
}

/** Mais perto do que ele aceita agora (o espaço pessoal)? */
export function crowded(s: TrustState): boolean {
  return s.distance < s.comfort;
}

/** O humor pela tensão. */
export function moodFor(tension: number, p: Pick<TrustParams, 'alertAt' | 'hissAt'>): CatMood {
  return tension >= p.hissAt ? 'hissing' : tension >= p.alertAt ? 'alert' : 'calm';
}

/** Um passo do jogo (dtMs). Devolve se houve susto (bufou com ela andando) ou sustinho do nada neste passo. */
export function stepTrust(s: TrustState, p: TrustParams, input: TrustInput, dtMs: number, rng: Rng): { scared: boolean; startled: boolean } {
  const dt = dtMs / 1000;
  s.elapsed += dtMs;
  // O humor muda sozinho: outro espaço pessoal de tempos em tempos e, às vezes, um barulho.
  if (s.elapsed >= s.nextComfortAt) {
    s.comfort = between(rng, p.comfortRange);
    s.nextComfortAt = s.elapsed + between(rng, p.comfortEverySec) * 1000;
  }
  let startled = false;
  if (s.elapsed >= s.nextStartleAt) {
    startled = true;
    s.tension = Math.min(1, s.tension + p.startleTension);
    s.nextStartleAt = s.elapsed + between(rng, p.startleEverySec) * 1000;
  }
  const moving = input.approach && !input.back && s.distance > p.minDistance;
  if (moving) s.distance = Math.max(p.minDistance, s.distance - p.approachSpeed * dt);
  else if (input.back) s.distance = Math.min(p.startDistance, s.distance + p.backSpeed * dt);

  // Andar perto assusta mais que andar longe; parada (ou se afastando), ele relaxa.
  const closeness = 1 - (s.distance - p.minDistance) / (p.startDistance - p.minDistance);
  if (moving) s.tension = Math.min(1, s.tension + p.tensionRate * (p.farTension + (1 - p.farTension) * closeness) * dt);
  else if (!crowded(s)) s.tension = Math.max(0, s.tension - p.relaxRate * dt);
  // Perto demais para o humor de agora: tenso mesmo com ela parada.
  if (crowded(s)) s.tension = Math.min(1, s.tension + p.crowdRate * dt);
  s.mood = moodFor(s.tension, p);

  let scared = false;
  if (s.mood === 'hissing' && moving && s.elapsed - s.lastScareAt >= p.scareCooldownMs) {
    scared = true;
    s.scares++;
    s.lastScareAt = s.elapsed;
    s.trust = Math.max(0, s.trust - p.scareLoss);
    s.distance = Math.min(p.startDistance, s.distance + p.scarePushback);
  }

  // Calmo, perto e respeitando o espaço dele: a confiança sobe, mais rápido quanto mais perto.
  if (s.mood === 'calm' && s.distance <= p.nearDistance && !crowded(s)) {
    const treat = s.elapsed < s.treatUntil ? p.treatGain : 1;
    const near = 1 + p.closeBonus * Math.max(0, (p.nearDistance - s.distance) / (p.nearDistance - p.minDistance));
    s.trust = Math.min(FULL_TRUST, s.trust + p.gainPerSec * (moving ? p.movingGain : 1) * treat * near * dt);
  }
  return { scared, startled };
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
