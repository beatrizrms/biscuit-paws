// Centraliza as cores da interface (decisão 243): troca cada cor solta (#rgb, #rrggbb, #rrggbbaa) dos CSS da
// interface pela variável mais parecida de src/game/ui/theme.css, depois de passar pela regra da paleta "oliva e café"
// (rosa → oliva, lilás → café, vermelho forte → terracota, menta → oliva, lousa verde → lousa café). Cor com
// transparência vira color-mix com a variável. Roda uma vez por mudança de paleta; o check acusa cor solta que sobrar.
//   npx tsx scripts/theme-css.ts
import { readFileSync, writeFileSync } from 'node:fs';

type Rgb = [number, number, number];
const THEME = 'src/game/ui/theme.css';
export const THEMED_CSS = ['src/game/ui/ui.css', 'src/game/ui/skin.css', 'src/game/ui/menu/menu.css', 'src/game/touch.css'];

function toHsl([r, g, b]: Rgb): [number, number, number] {
  const R = r / 255, G = g / 255, B = b / 255;
  const max = Math.max(R, G, B), min = Math.min(R, G, B);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h = max === R ? ((G - B) / d + (G < B ? 6 : 0)) * 60 : max === G ? ((B - R) / d + 2) * 60 : ((R - G) / d + 4) * 60;
  return [h, s, l];
}
function toRgb([h, s, l]: [number, number, number]): Rgb {
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const a = s * Math.min(l, 1 - l);
    return Math.round(255 * (l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))));
  };
  return [f(0), f(8), f(4)];
}

/** A regra da paleta (a cor de antes, já no tom da paleta nova; depois vai para a variável mais perto). */
function retone(rgb: Rgb): Rgb {
  const [h, s, l] = toHsl(rgb);
  const pinkish = h >= 300 || h < 12;
  const purple = h >= 235 && h < 300;
  const mint = h >= 125 && h < 190;
  if (pinkish && s > 0.5 && l < 0.6) return toRgb([14, Math.min(s, 0.55), l]);
  if (pinkish && s > 0.25) return toRgb([72, s * 0.45, l]);
  if ((pinkish || purple) && s <= 0.25) return toRgb([30, s, l]);
  if (purple) return toRgb([28, s * 0.45, l]);
  if (mint && l < 0.35) return toRgb([28, Math.min(s, 0.22), l]);
  if (mint) return toRgb([78, s * 0.6, l]);
  return rgb;
}

/** As variáveis de cor da paleta (--c-*) com os valores de theme.css. */
function palette(): [string, Rgb][] {
  const css = readFileSync(THEME, 'utf8');
  return [...css.matchAll(/(--c-[\w-]+):\s*#([0-9a-fA-F]{6});/g)].map((m) => [m[1]!, [parseInt(m[2]!.slice(0, 2), 16), parseInt(m[2]!.slice(2, 4), 16), parseInt(m[2]!.slice(4, 6), 16)] as Rgb]);
}

/** Distância "de olho" (pesos do vermelho médio). */
function dist(a: Rgb, b: Rgb): number {
  const rm = (a[0] + b[0]) / 2;
  const [dr, dg, db] = [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  return Math.sqrt((2 + rm / 256) * dr * dr + 4 * dg * dg + (2 + (255 - rm) / 256) * db * db);
}

export function themeCss(css: string, pal: [string, Rgb][]): string {
  return css.replace(/#([0-9a-fA-F]{3,8})\b/g, (m, body: string) => {
    if (![3, 4, 6, 8].includes(body.length)) return m;
    const full = body.length <= 4 ? body.split('').map((c) => c + c).join('') : body;
    const rgb: Rgb = [parseInt(full.slice(0, 2), 16), parseInt(full.slice(2, 4), 16), parseInt(full.slice(4, 6), 16)];
    const target = retone(rgb);
    const [name] = pal.reduce((best, p) => (dist(target, p[1]) < dist(target, best[1]) ? p : best));
    const alpha = full.length === 8 ? parseInt(full.slice(6), 16) / 255 : 1;
    return alpha >= 0.999 ? `var(${name})` : `color-mix(in srgb, var(${name}) ${Math.round(alpha * 100)}%, transparent)`;
  });
}

if (process.argv[1]?.endsWith('theme-css.ts')) {
  const pal = palette();
  for (const f of THEMED_CSS) {
    // O :root antigo de ui.css (as cores Cosy) saiu: os nomes agora estão em theme.css.
    let css = readFileSync(f, 'utf8').replace(/:root \{\n  --ink: #[\s\S]*?\n\}\n\n/, '');
    css = themeCss(css, pal);
    writeFileSync(f, css);
  }
  console.log(`cores centralizadas em ${THEME} (${pal.length} cores)`);
}
