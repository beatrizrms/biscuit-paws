// Banho e escovação: o gato grande, com pontos de pelo emaranhado. Arrastar a escova sobre um ponto desembaraça
// aos poucos: cada ponto pede uma distância escovada (não basta clicar). Escovar em zona sensível (barriga, cauda,
// patas) drena a paciência; em zona gostosa (costas, bochechas) recupera um pouco. Paciência zerada = ele foge.
// Puro: sem Phaser, DOM ou window. Coordenadas em pixels do sprite do gato (32x32, de lado); a cena amplia.
import type { Outcome } from './minigame';

export type ZoneKind = 'sensitive' | 'comfort';

/** Ponto de pelo emaranhado (dados): onde fica, o raio que a escova precisa alcançar e a distância a escovar. */
export interface MatDef {
  id: string;
  at: [number, number];
  radius: number;
  need: number;
}

/** Zona do corpo (dados): retângulo [x, y, largura, altura] em pixels do sprite. */
export interface ZoneDef {
  id: string;
  kind: ZoneKind;
  rect: [number, number, number, number];
}

export interface GroomingParams {
  /** Quantos emaranhados da lista (os primeiros) entram na partida, e quanto a distância pedida é multiplicada. */
  mats: number;
  needScale: number;
  /** Paciência (0 a 100) perdida por pixel escovado em zona sensível; recuperada por pixel em zona gostosa. */
  drainPerPx: number;
  recoverPerPx: number;
  /** Great: tudo limpo com a paciência acima disto. */
  greatAbove: number;
}

export const FULL_PATIENCE = 100;

export interface GroomingState {
  /** Quanto falta (distância) em cada emaranhado da partida; 0 = limpo. */
  left: Record<string, number>;
  patience: number;
  /** Último ponto da escova (enquanto arrasta), para medir a distância. */
  last: { x: number; y: number } | null;
  /** Em que zona a escova está agora (para a cena reagir). */
  zone: ZoneKind | null;
  elapsed: number;
}

export interface GroomingEvents {
  /** Emaranhados que ficaram limpos neste passo. */
  cleaned: string[];
  /** Escovou numa zona sensível / gostosa neste passo. */
  sensitive: boolean;
  comfort: boolean;
}

export function newGrooming(mats: readonly MatDef[], p: GroomingParams): GroomingState {
  const left: Record<string, number> = {};
  for (const m of mats.slice(0, p.mats)) left[m.id] = m.need * p.needScale;
  return { left, patience: FULL_PATIENCE, last: null, zone: null, elapsed: 0 };
}

export function zoneAt(zones: readonly ZoneDef[], x: number, y: number): ZoneDef | undefined {
  return zones.find(({ rect: [zx, zy, w, h] }) => x >= zx && x < zx + w && y >= zy && y < zy + h);
}

/**
 * Um passo (dtMs). `brush`: onde a escova está (pixels do sprite) e se está apertada (arrastando); solta,
 * nada acontece. Só o caminho percorrido conta: ficar parado em cima não limpa nem incomoda.
 */
export function stepGrooming(
  s: GroomingState,
  p: GroomingParams,
  mats: readonly MatDef[],
  zones: readonly ZoneDef[],
  brush: { x: number; y: number; down: boolean },
  dtMs: number,
): GroomingEvents {
  s.elapsed += dtMs;
  const ev: GroomingEvents = { cleaned: [], sensitive: false, comfort: false };
  const zone = zoneAt(zones, brush.x, brush.y);
  s.zone = brush.down ? (zone?.kind ?? null) : null;
  if (!brush.down) {
    s.last = null;
    return ev;
  }
  const from = s.last ?? brush;
  const d = Math.hypot(brush.x - from.x, brush.y - from.y);
  s.last = { x: brush.x, y: brush.y };
  if (d <= 0) return ev;

  for (const m of mats) {
    const rest = s.left[m.id];
    if (rest === undefined || rest <= 0) continue;
    if (Math.hypot(brush.x - m.at[0], brush.y - m.at[1]) > m.radius) continue;
    s.left[m.id] = Math.max(0, rest - d);
    if (s.left[m.id] === 0) ev.cleaned.push(m.id);
  }
  if (zone?.kind === 'sensitive') {
    s.patience = Math.max(0, s.patience - p.drainPerPx * d);
    ev.sensitive = true;
  } else if (zone?.kind === 'comfort') {
    s.patience = Math.min(FULL_PATIENCE, s.patience + p.recoverPerPx * d);
    ev.comfort = true;
  }
  return ev;
}

/** 0 a 1: quanto do pelo já foi desembaraçado (para a barra). */
export function groomingProgress(s: GroomingState, mats: readonly MatDef[], p: GroomingParams): number {
  const ids = Object.keys(s.left);
  const total = ids.reduce((sum, id) => sum + (mats.find((m) => m.id === id)?.need ?? 0) * p.needScale, 0);
  const left = ids.reduce((sum, id) => sum + (s.left[id] ?? 0), 0);
  return total > 0 ? 1 - left / total : 1;
}

/** Acabou? Paciência zerada (fail) ou tudo limpo (great com paciência acima de greatAbove). null = continua. */
export function groomingOutcome(s: GroomingState, p: GroomingParams): Outcome | null {
  if (s.patience <= 0) return 'fail';
  if (Object.values(s.left).every((v) => v <= 0)) return s.patience > p.greatAbove ? 'great' : 'ok';
  return null;
}

export function validateGrooming(mats: readonly MatDef[], zones: readonly ZoneDef[], counts: number[]): string[] {
  const errors: string[] = [];
  const err = (m: string) => errors.push(`minigames: grooming: ${m}`);
  const ids = new Set<string>();
  for (const m of mats) {
    if (ids.has(m.id)) err(`emaranhado repetido "${m.id}"`);
    ids.add(m.id);
    if (!(m.radius > 0) || !(m.need > 0)) err(`"${m.id}" precisa de radius e need maiores que 0`);
    if (m.at.some((v) => v < 0 || v > 32)) err(`"${m.id}" fora do sprite (0 a 32)`);
  }
  for (const z of zones) if (z.kind !== 'sensitive' && z.kind !== 'comfort') err(`zona "${z.id}" com kind inválido`);
  for (const n of counts) if (n > mats.length) err(`dificuldade pede ${n} emaranhados, mas só há ${mats.length}`);
  return errors;
}
