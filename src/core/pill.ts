// Dar remédio escondido, em dois passos.
// 1) Cobrir: o comprimido no meio da comida; arrastar a pasta por cima cobre aos poucos (até 100%).
// 2) Oferecer: o gato alterna entre atento e distraído (com um aviso curto antes de virar atento). Oferecer distraído
//    = ele come (sucesso); oferecer atento = a desconfiança sobe muito; desconfiança cheia = ele recusa e foge.
//    Oferecer com a cobertura incompleta também sobe a desconfiança, um pouco (ele sente o cheiro).
// Puro: sem Phaser, DOM ou window. Sorteio pelo rng injetado (regra 7).
import type { Outcome } from './minigame';
import type { Rng } from './rng';

export interface PillParams {
  /** Grade do comprimido (colunas, linhas): cada célula conta para a cobertura. */
  grid: [number, number];
  /** Raio da pasta, em células (quanto um arraste cobre em volta). */
  brushRadius: number;
  /** Quanto tempo (ms) ele fica distraído e atento, sorteado entre [mín, máx]. */
  distractedMs: [number, number];
  attentiveMs: [number, number];
  /** Os últimos ms da distração são o aviso (orelha mexe): ainda vale oferecer, mas está acabando. */
  warnMs: number;
  /** Desconfiança (0 a 100) ao oferecer atento, e por 100% de cobertura que faltar ao oferecer. */
  attentivePenalty: number;
  incompletePenalty: number;
}

export const FULL_SUSPICION = 100;

export type PillPhase = 'cover' | 'offer' | 'done';
export type PillMood = 'distracted' | 'attentive';

export interface PillState {
  phase: PillPhase;
  /** Células cobertas (linha a linha). */
  covered: boolean[];
  mood: PillMood;
  /** Até quando (ms do jogo) o humor atual dura. */
  moodUntil: number;
  suspicion: number;
  offers: number;
  /** Comeu (sucesso) ou recusou e fugiu. */
  result: 'ate' | 'fled' | null;
  elapsed: number;
  /** A janela de distração do gato (1 = normal; gato desconfiado, menos). */
  windowScale: number;
}

export interface PillEvents {
  /** Mudou de humor neste passo. */
  turned?: PillMood;
}

export function newPill(p: PillParams, windowScale = 1): PillState {
  return { phase: 'cover', covered: Array(p.grid[0] * p.grid[1]).fill(false), mood: 'distracted', moodUntil: 0, suspicion: 0, offers: 0, result: null, elapsed: 0, windowScale };
}

/** 0 a 1: quanto do comprimido está coberto. */
export function coverage(s: PillState): number {
  return s.covered.filter(Boolean).length / s.covered.length;
}

/**
 * Passa a pasta em (u, v), de 0 a 1 em cima do comprimido (fora disso, nada). Cobre as células a até brushRadius.
 * Devolve quantas células cobriu agora.
 */
export function spread(s: PillState, p: PillParams, u: number, v: number): number {
  if (s.phase !== 'cover' || u < -0.2 || u > 1.2 || v < -0.2 || v > 1.2) return 0;
  const [cols, rows] = p.grid;
  const cu = u * cols - 0.5;
  const cv = v * rows - 0.5;
  let n = 0;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const i = r * cols + c;
      if (s.covered[i] || Math.hypot(c - cu, r - cv) > p.brushRadius) continue;
      s.covered[i] = true;
      n++;
    }
  }
  return n;
}

const between = (rng: Rng, [a, b]: [number, number]) => a + (b - a) * rng.next();

/** Pronto para oferecer: começa o vaivém do gato (começa distraído, comendo outra coisa com os olhos). */
export function startOffering(s: PillState, p: PillParams, rng: Rng): void {
  if (s.phase !== 'cover') return;
  s.phase = 'offer';
  s.mood = 'distracted';
  s.moodUntil = s.elapsed + between(rng, p.distractedMs) * s.windowScale;
}

/** Um passo (dtMs): o humor vira quando o tempo dele acaba. */
export function stepPill(s: PillState, p: PillParams, dtMs: number, rng: Rng): PillEvents {
  s.elapsed += dtMs;
  if (s.phase !== 'offer' || s.elapsed < s.moodUntil) return {};
  s.mood = s.mood === 'distracted' ? 'attentive' : 'distracted';
  s.moodUntil = s.elapsed + (s.mood === 'distracted' ? between(rng, p.distractedMs) * s.windowScale : between(rng, p.attentiveMs));
  return { turned: s.mood };
}

/** Está no aviso (os últimos warnMs da distração): a orelha mexe, vai olhar já já. */
export function warning(s: PillState, p: PillParams): boolean {
  return s.phase === 'offer' && s.mood === 'distracted' && s.moodUntil - s.elapsed <= p.warnMs;
}

/**
 * Oferece a tigela. Cobertura incompleta: a desconfiança sobe um pouco (o quanto falta). Atento: sobe muito e ele
 * empurra a tigela (dá para tentar de novo). Distraído e sem passar do limite: come. Desconfiança cheia: foge.
 */
export function offer(s: PillState, p: PillParams): 'ate' | 'caught' | 'fled' | null {
  if (s.phase !== 'offer') return null;
  s.offers++;
  s.suspicion = Math.min(FULL_SUSPICION, s.suspicion + (1 - coverage(s)) * p.incompletePenalty);
  if (s.mood === 'attentive') s.suspicion = Math.min(FULL_SUSPICION, s.suspicion + p.attentivePenalty);
  if (s.suspicion >= FULL_SUSPICION) {
    s.phase = 'done';
    s.result = 'fled';
    return 'fled';
  }
  if (s.mood === 'attentive') return 'caught';
  s.phase = 'done';
  s.result = 'ate';
  return 'ate';
}

/** Acabou? Comeu na primeira oferta = great; depois = ok; fugiu = fail. null = continua. */
export function pillOutcome(s: PillState): Outcome | null {
  if (s.result === 'fled') return 'fail';
  if (s.result === 'ate') return s.offers === 1 ? 'great' : 'ok';
  return null;
}
