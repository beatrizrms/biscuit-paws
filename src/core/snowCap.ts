// Neve do inverno por cima das coisas ao ar livre (regra geral): o montinho segue o contorno de cima do desenho.
// Puro: recebe os pixels (RGBA) da peça e devolve só a neve, do mesmo tamanho; quem desenha é o jogo. É o mesmo
// desenho da neve grossa feita na importação da arte (scripts/import-pixellab.ts: snowTop).

const WHITE = [250, 252, 255] as const;
const SHADE = [204, 220, 238] as const;
const LINE = [150, 170, 196] as const;

/**
 * Em cada coluna, do primeiro pixel do desenho para baixo, `depth` px de neve (variando um pouco, semente fixa), só
 * sobre o desenho (para no primeiro buraco); uma linha a mais por cima arredonda o monte e a parte de baixo leva a
 * sombra azulada.
 */
export function snowCapPixels(src: ArrayLike<number>, width: number, height: number, depth: number, seed = 7): Uint8ClampedArray {
  const out = new Uint8ClampedArray(width * height * 4);
  let s = seed >>> 0 || 1;
  const rnd = () => (s = (s * 16807 + 11) % 2147483647) / 2147483647;
  const solid = (x: number, y: number) => y >= 0 && y < height && src[(y * width + x) * 4 + 3]! > 40;
  const plot = (x: number, y: number, c: readonly number[]) => {
    const i = (y * width + x) * 4;
    out[i] = c[0]!;
    out[i + 1] = c[1]!;
    out[i + 2] = c[2]!;
    out[i + 3] = 255;
  };
  let d = depth;
  for (let x = 0; x < width; x++) {
    let top = -1;
    for (let y = 0; y < height; y++) if (solid(x, y)) { top = y; break; }
    if (top < 0) continue;
    const r = rnd();
    d = Math.max(Math.max(2, depth - 2), Math.min(depth + 2, d + (r < 0.25 ? -1 : r > 0.75 ? 1 : 0)));
    if (top > 0 && rnd() < 0.7) plot(x, top - 1, WHITE);
    let y = top;
    for (; y < top + d && solid(x, y); y++) plot(x, y, y >= top + d - 2 ? SHADE : WHITE);
    if (solid(x, y)) plot(x, y, LINE);
  }
  return out;
}

/** A grossura da neve pela altura do desenho (px da folha): um pouco mais nas peças altas. */
export function snowCapDepth(heightPx: number, resolution: number): number {
  return Math.max(3 * resolution, Math.min(6 * resolution, Math.round(heightPx / 10)));
}
