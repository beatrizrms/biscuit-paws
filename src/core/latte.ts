// Latte art: a nota do desenho. Puro: a cena só junta os pontos do traço (já no espaço do contorno-guia,
// 0 a guideSize) e chama daqui. Cobertura = quanto do contorno o traço passou por cima; precisão = quanto do
// traço ficou perto do contorno (rabiscar a xícara inteira cobre tudo, mas tem precisão baixa).
import type { Outcome } from './minigame';

export type Pt = [number, number];

/** Um padrão (data/minigames.json: games.latte.patterns): linhas de pontos no espaço do contorno. */
export interface LattePattern {
  id: string;
  name: string;
  lines: Pt[][];
}

export interface LatteParams {
  timeSec: number;
  /** Padrões sorteados nesta dificuldade (ids). */
  patterns: string[];
  /** Distância (px do contorno) que ainda conta como "em cima da linha". */
  tolerance: number;
  /** Nota mínima para 1, 2 e 3 estrelas. */
  starAt: [number, number, number];
  /** Gorjeta por estrelas (0 a 3). */
  tipPerStar: [number, number, number, number];
  /** Peso da cobertura na nota (o resto é precisão). */
  coverageWeight: number;
}

/** Pontos ao longo das linhas, um a cada `spacing` px (segmentos longos, como na estrela, viram vários pontos). */
export function samplePolylines(lines: readonly Pt[][], spacing: number): Pt[] {
  const out: Pt[] = [];
  for (const line of lines) {
    if (line.length === 1) out.push(line[0]!);
    for (let i = 1; i < line.length; i++) {
      const [ax, ay] = line[i - 1]!;
      const [bx, by] = line[i]!;
      const steps = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay) / spacing));
      for (let k = i === 1 ? 0 : 1; k <= steps; k++) out.push([ax + ((bx - ax) * k) / steps, ay + ((by - ay) * k) / steps]);
    }
  }
  return out;
}

const near = (p: Pt, set: readonly Pt[], tol: number) => set.some((q) => (p[0] - q[0]) ** 2 + (p[1] - q[1]) ** 2 <= tol * tol);

export interface LatteScore {
  coverage: number;
  accuracy: number;
  /** 0 a 1. */
  score: number;
}

/** Nota do desenho: cobertura e precisão, misturadas por coverageWeight. Sem traço, tudo zero. */
export function scoreDrawing(pattern: LattePattern, strokes: readonly Pt[][], p: Pick<LatteParams, 'tolerance' | 'coverageWeight'>): LatteScore {
  const spacing = Math.max(1, p.tolerance / 2);
  const guide = samplePolylines(pattern.lines, spacing);
  const drawn = samplePolylines(strokes.filter((s) => s.length > 0), spacing);
  if (guide.length === 0 || drawn.length === 0) return { coverage: 0, accuracy: 0, score: 0 };
  const coverage = guide.filter((g) => near(g, drawn, p.tolerance)).length / guide.length;
  const accuracy = drawn.filter((d) => near(d, guide, p.tolerance)).length / drawn.length;
  return { coverage, accuracy, score: coverage * p.coverageWeight + accuracy * (1 - p.coverageWeight) };
}

/** Estrelas (0 a 3) pela nota. */
export function starsFor(score: number, starAt: readonly [number, number, number]): 0 | 1 | 2 | 3 {
  return score >= starAt[2] ? 3 : score >= starAt[1] ? 2 : score >= starAt[0] ? 1 : 0;
}

/** 0 estrelas = não deu; 3 = perfeito; 1 ou 2 = conseguiu. */
export function latteOutcome(stars: number): Outcome {
  return stars >= 3 ? 'great' : stars >= 1 ? 'ok' : 'fail';
}

export function validateLattePatterns(patterns: readonly LattePattern[], size: number, used: readonly string[]): string[] {
  const errors: string[] = [];
  const ids = new Set(patterns.map((p) => p.id));
  for (const p of patterns) {
    if (p.lines.length === 0) errors.push(`minigames: padrão "${p.id}" sem linhas`);
    for (const line of p.lines) for (const [x, y] of line) if (x < 0 || y < 0 || x > size || y > size) errors.push(`minigames: padrão "${p.id}" tem ponto fora do contorno (${x}, ${y})`);
  }
  for (const id of used) if (!ids.has(id)) errors.push(`minigames: latte usa um padrão inexistente "${id}"`);
  return errors;
}
