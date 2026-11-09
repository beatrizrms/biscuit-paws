// Troca de cor por região (personagem em camadas sobre o manequim, decisão 077): cada pixel de uma região
// ganha a cor-alvo mantendo a luz relativa (sombras e brilhos continuam no lugar). Puro: só números e arrays.

/** Regiões gravadas no canal vermelho das máscaras (0 = não muda: contorno, olhos, detalhes). */
export const REGION = { skin: 1, top: 2, bottom: 3, shoes: 4, hair: 5 } as const;
export type RegionName = keyof typeof REGION;

/** Cor-alvo: matiz (graus), saturação (0..1) e a faixa de luz (0..1) para onde vai a faixa original. */
export interface Ramp {
  hue: number;
  sat: number;
  light: [number, number];
}

export function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  const R = r / 255, G = g / 255, B = b / 255;
  const max = Math.max(R, G, B), min = Math.min(R, G, B);
  const l = (max + min) / 2;
  const d = max - min;
  if (d === 0) return [0, 0, l];
  const s = d / (1 - Math.abs(2 * l - 1));
  let h = max === R ? ((G - B) / d) % 6 : max === G ? (B - R) / d + 2 : (R - G) / d + 4;
  h *= 60;
  if (h < 0) h += 360;
  return [h, s, l];
}

export function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return [r, g, b].map((v) => Math.round(Math.max(0, Math.min(255, (v + m) * 255)))) as [number, number, number];
}

/** Região de um pixel: pela máscara (canal vermelho) ou, sem máscara, `whole` para todo pixel visível. */
const regionAt = (data: Uint8ClampedArray, mask: Uint8ClampedArray | null, i: number, whole: number): number =>
  data[i + 3]! === 0 ? 0 : mask ? mask[i]! : whole;

/** Faixa de luz (mínima, máxima) de cada região, para recolorir várias folhas da mesma peça igual. */
export function lightRanges(data: Uint8ClampedArray, mask: Uint8ClampedArray | null, whole = REGION.hair): Map<number, [number, number]> {
  const out = new Map<number, [number, number]>();
  for (let i = 0; i < data.length; i += 4) {
    const r = regionAt(data, mask, i, whole);
    if (!r) continue;
    const l = rgbToHsl(data[i]!, data[i + 1]!, data[i + 2]!)[2];
    const cur = out.get(r);
    if (!cur) out.set(r, [l, l]);
    else {
      cur[0] = Math.min(cur[0], l);
      cur[1] = Math.max(cur[1], l);
    }
  }
  return out;
}

/**
 * Recolore no lugar. `ramps[região]` ausente = região fica como está. `ranges` (de lightRanges) diz a faixa
 * de luz original; sem ela, usa a desta imagem. Sem máscara, todo pixel visível é da região `whole` (cabelo).
 */
export function recolor(
  data: Uint8ClampedArray,
  mask: Uint8ClampedArray | null,
  ramps: Partial<Record<number, Ramp>>,
  ranges = lightRanges(data, mask),
  whole: number = REGION.hair,
): void {
  for (let i = 0; i < data.length; i += 4) {
    const r = regionAt(data, mask, i, whole);
    const ramp = r ? ramps[r] : undefined;
    if (!ramp) continue;
    const [lo, hi] = ranges.get(r) ?? [0, 1];
    const l = rgbToHsl(data[i]!, data[i + 1]!, data[i + 2]!)[2];
    const t = hi > lo ? Math.max(0, Math.min(1, (l - lo) / (hi - lo))) : 0.5;
    const [nr, ng, nb] = hslToRgb(ramp.hue, ramp.sat, ramp.light[0] + t * (ramp.light[1] - ramp.light[0]));
    data[i] = nr;
    data[i + 1] = ng;
    data[i + 2] = nb;
  }
}
