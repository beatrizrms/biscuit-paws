// npx tsx scripts/art/icon-variants.ts
// Variações de cor por código dos ícones da barra: a ração (saco aberto verde) e a areia (balde azul) em cores bem
// diferentes por item, para distinguir de longe na barra. Só a embalagem muda de cor (a faixa de matiz dela); a ração
// e a areia de dentro ficam como estão. Folha: data/icons.json "variants" (as entradas racao_* e areia_* apontam aqui).
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { PNG } from 'pngjs';

const SRC = 'public/assets/icons/sheets/icon_sheet_pixellab_barra.png';
const OUT = 'public/assets/icons/sheets/icon_sheet_variants.png';
const TS = 64;
const COLUMNS = 4;

/** De onde sai (coluna da folha da barra), a faixa de matiz da embalagem, o matiz novo e quanto a saturação sobe. */
interface Variant { col: number; from: [number, number]; hue: number | null; sat: number }
const BAG: [number, number] = [70, 160]; // o saco verde
const BUCKET: [number, number] = [160, 235]; // o balde azul
/** Na ordem da folha (da esquerda para a direita, 4 por linha); data/icons.json usa estas posições. */
const VARIANTS: Variant[] = [
  { col: 0, from: BAG, hue: null, sat: 1 }, // ração simples (o verde original)
  { col: 0, from: BAG, hue: 210, sat: 1.5 }, // saco de 5 porções: azul
  { col: 0, from: BAG, hue: 5, sat: 2.2 }, // 10 kg: vermelho
  { col: 0, from: BAG, hue: 45, sat: 2.6 }, // premium: dourado
  { col: 1, from: BUCKET, hue: null, sat: 1 }, // areia (o azul original)
  { col: 1, from: BUCKET, hue: 330, sat: 1.4 }, // saco de 4 trocas: rosa
  { col: 1, from: BUCKET, hue: 35, sat: 1.8 }, // 10 kg: laranja
];

function toHsl(r: number, g: number, b: number): [number, number, number] {
  const [R, G, B] = [r / 255, g / 255, b / 255];
  const mx = Math.max(R, G, B), mn = Math.min(R, G, B);
  const l = (mx + mn) / 2;
  if (mx === mn) return [0, 0, l];
  const d = mx - mn;
  const s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
  const h = mx === R ? (G - B) / d + (G < B ? 6 : 0) : mx === G ? (B - R) / d + 2 : (R - G) / d + 4;
  return [h * 60, s, l];
}

function toRgb(h: number, s: number, l: number): [number, number, number] {
  if (!s) return [l, l, l].map((v) => Math.round(v * 255)) as [number, number, number];
  const f = (p: number, q: number, t: number) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const H = h / 360;
  return [f(p, q, H + 1 / 3), f(p, q, H), f(p, q, H - 1 / 3)].map((v) => Math.round(v * 255)) as [number, number, number];
}

const src = PNG.sync.read(readFileSync(SRC));
const rows = Math.ceil(VARIANTS.length / COLUMNS);
const out = new PNG({ width: COLUMNS * TS, height: rows * TS });
VARIANTS.forEach((v, n) => {
  const ox = (n % COLUMNS) * TS;
  const oy = Math.floor(n / COLUMNS) * TS;
  for (let y = 0; y < TS; y++)
    for (let x = 0; x < TS; x++) {
      const si = (y * src.width + v.col * TS + x) * 4;
      const di = ((oy + y) * out.width + ox + x) * 4;
      let [r, g, b] = [src.data[si]!, src.data[si + 1]!, src.data[si + 2]!];
      const a = src.data[si + 3]!;
      if (a && v.hue !== null) {
        const [h, s, l] = toHsl(r, g, b);
        if (h >= v.from[0] && h <= v.from[1] && s > 0.08) [r, g, b] = toRgb(v.hue, Math.min(1, s * v.sat), l);
      }
      out.data[di] = r;
      out.data[di + 1] = g;
      out.data[di + 2] = b;
      out.data[di + 3] = a;
    }
});
mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, PNG.sync.write(out));
console.log(`icon-variants: ${OUT} (${VARIANTS.length} ícones: ração e areia)`);
