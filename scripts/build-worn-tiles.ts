// npm run art: gera as versões "velhas" de tiles do pacote (data/tiles.worn.json)
// e grava a folha estendida (original + linhas novas) em public/assets/tiles/.
// A licença do pacote permite modificar os assets; o resultado continua fora do Git.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { PNG } from 'pngjs';
import { createRng, type Rng } from '../src/core/rng';
import { buildCatalog, type TileMeta, type WornStyle, type WornTiles } from '../src/core/tiles';

type RGB = [number, number, number];

const meta = JSON.parse(readFileSync('data/tiles.meta.json', 'utf8')) as TileMeta;
const worn = JSON.parse(readFileSync('data/tiles.worn.json', 'utf8')) as WornTiles;
const catalog = buildCatalog(readFileSync('data/tiles.csv', 'utf8'), meta, worn);
const sourcePath = `public/${meta.sheet.image}`;
const outPath = `public/${worn.image}`;
const TS = meta.sheet.tileSize;

if (!existsSync(sourcePath)) {
  console.error(`✗ Falta a folha do pacote em ${sourcePath} (veja o README, seção "a arte").`);
  process.exit(1);
}

// Cores da paleta Cosy usadas no desgaste.
const C = {
  ink2: [90, 64, 72],
  cream: [255, 244, 224],
  cream2: [246, 226, 196],
  cream3: [227, 196, 158],
  wood3: [127, 75, 51],
  wood4: [92, 52, 40],
  choc1: [138, 90, 68],
  choc2: [95, 58, 46],
  grey1: [217, 212, 214],
  grey2: [169, 159, 166],
  grey3: [122, 110, 118],
} satisfies Record<string, RGB>;

/** Um tile 32 x 32 que dá para pintar pixel a pixel. */
class Tile {
  constructor(readonly px: RGB[]) {}
  static from(png: PNG, col: number, row: number): Tile {
    const px: RGB[] = [];
    for (let y = 0; y < TS; y++) {
      for (let x = 0; x < TS; x++) {
        const i = ((row * TS + y) * png.width + col * TS + x) * 4;
        px.push([png.data[i]!, png.data[i + 1]!, png.data[i + 2]!]);
      }
    }
    return new Tile(px);
  }
  get(x: number, y: number): RGB {
    return this.px[y * TS + x]!;
  }
  set(x: number, y: number, c: RGB): void {
    if (x >= 0 && y >= 0 && x < TS && y < TS) this.px[y * TS + x] = c;
  }
  map(fn: (c: RGB, x: number, y: number) => RGB): void {
    for (let y = 0; y < TS; y++) for (let x = 0; x < TS; x++) this.set(x, y, fn(this.get(x, y), x, y));
  }
  write(png: PNG, col: number, row: number): void {
    for (let y = 0; y < TS; y++) {
      for (let x = 0; x < TS; x++) {
        const i = ((row * TS + y) * png.width + col * TS + x) * 4;
        const [r, g, b] = this.get(x, y);
        png.data[i] = r;
        png.data[i + 1] = g;
        png.data[i + 2] = b;
        png.data[i + 3] = 255;
      }
    }
  }
}

// ---------- Cores ----------

const mix = (a: RGB, b: RGB, t: number): RGB => [0, 1, 2].map((i) => Math.round(a[i]! + (b[i]! - a[i]!) * t)) as RGB;
const darken = (c: RGB, k: number): RGB => c.map((v) => Math.round(v * k)) as RGB;
const desaturate = (c: RGB, t: number): RGB => {
  const l = 0.3 * c[0] + 0.59 * c[1] + 0.11 * c[2];
  return mix(c, [l, l, l], t);
};
/** Envelhece a cor: puxa para o tom de poeira, tira saturação e escurece um pouco. */
const age = (c: RGB, dust: RGB, amount: number): RGB => darken(desaturate(mix(c, dust, amount), 0.2), 0.95);

// ---------- Formas (sempre longe da borda, para não cortar na emenda entre tiles) ----------

const MARGIN = 3;
const spot = (rng: Rng, r = 0) => ({ x: rng.int(MARGIN + r, TS - 1 - MARGIN - r), y: rng.int(MARGIN + r, TS - 1 - MARGIN - r) });

/** Mancha irregular: pinta o miolo e a borda com funções diferentes. */
function blob(t: Tile, rng: Rng, radius: number, inner: (c: RGB) => RGB, edge: (c: RGB) => RGB): void {
  const { x: cx, y: cy } = spot(rng, radius);
  const wobble = Array.from({ length: 8 }, () => 0.7 + rng.next() * 0.5);
  const inside = (x: number, y: number) => {
    const angle = Math.atan2(y - cy, x - cx);
    const k = wobble[Math.floor(((angle + Math.PI) / (2 * Math.PI)) * 8) % 8]!;
    return Math.hypot((x - cx) / 1.0, (y - cy) / 0.8) <= radius * k;
  };
  const orig = t.px.slice();
  for (let y = 0; y < TS; y++) {
    for (let x = 0; x < TS; x++) {
      if (!inside(x, y)) continue;
      const border = !inside(x + 1, y) || !inside(x - 1, y) || !inside(x, y + 1) || !inside(x, y - 1);
      t.set(x, y, border ? edge(orig[y * TS + x]!) : inner(orig[y * TS + x]!));
    }
  }
}

/** Linha fina andando ao acaso (rachaduras, arranhões). */
function walk(t: Tile, rng: Rng, length: number, dir: [number, number], paint: (c: RGB) => RGB): void {
  let { x, y } = spot(rng, 4);
  for (let i = 0; i < length; i++) {
    t.set(x, y, paint(t.get(x, y)));
    x += dir[0] + (rng.chance(0.35) ? rng.int(-1, 1) : 0);
    y += dir[1] + (rng.chance(0.35) ? rng.int(-1, 1) : 0);
    x = Math.max(MARGIN, Math.min(TS - 1 - MARGIN, x));
    y = Math.max(MARGIN, Math.min(TS - 1 - MARGIN, y));
  }
}

/** Rachadura: desce em zigue-zague, com um galho saindo do meio (nunca do começo). */
function crack(t: Tile, rng: Rng, length: number, paint: (c: RGB) => RGB): void {
  let x = rng.int(MARGIN + 4, TS - 1 - MARGIN - 4);
  let y = MARGIN;
  const path: [number, number][] = [];
  for (let i = 0; i < length && y < TS - MARGIN; i++) {
    path.push([x, y]);
    if (rng.chance(0.55)) y++;
    else x += rng.chance(0.5) ? 1 : -1;
    x = Math.max(MARGIN, Math.min(TS - 1 - MARGIN, x));
  }
  path.forEach(([px, py]) => t.set(px, py, paint(t.get(px, py))));
  let [bx, by] = path[Math.floor(path.length * 0.6)] ?? [x, y];
  const side = rng.chance(0.5) ? 1 : -1;
  for (let i = 0; i < 4; i++) {
    bx += side;
    if (rng.chance(0.5)) by++;
    t.set(bx, by, paint(t.get(bx, by)));
  }
}

/** Escurece um trecho de uma emenda entre tábuas (linha onde a cor escurece de repente). */
function seamCrack(t: Tile, rng: Rng): void {
  const seams: number[] = [];
  for (let y = MARGIN; y < TS - MARGIN; y++) if (t.get(TS / 2, y)[0] < t.get(TS / 2, y - 1)[0] - 15) seams.push(y);
  const y = seams.length ? seams[rng.int(0, seams.length - 1)]! : rng.int(MARGIN, TS - MARGIN);
  const x0 = rng.int(MARGIN, TS / 2);
  const len = rng.int(8, 12);
  for (let x = x0; x < x0 + len && x < TS - MARGIN; x++) t.set(x, y, darken(t.get(x, y), 0.7));
}

function specks(t: Tile, rng: Rng, count: number, color: RGB, strength = 0.6): void {
  for (let i = 0; i < count; i++) {
    const { x, y } = spot(rng);
    t.set(x, y, mix(t.get(x, y), color, strength));
  }
}

// ---------- Estilos de desgaste (variação 0 é a mais leve, para não poluir) ----------

const STYLES: Record<WornStyle, (t: Tile, rng: Rng, variant: number) => void> = {
  wallpaper(t, rng, v) {
    t.map((c) => age(c, C.cream3, 0.28));
    specks(t, rng, 2, C.choc1, 0.3);
    if (v === 1) blob(t, rng, rng.int(5, 7), (c) => mix(c, C.choc1, 0.22), (c) => mix(c, C.choc1, 0.45)); // mancha de umidade
    if (v === 2) {
      // papel descascado: aparece o reboco, com sombra embaixo/direita
      blob(t, rng, rng.int(3, 5), () => C.grey1, () => C.cream2);
      const orig = t.px.slice();
      for (let y = 1; y < TS; y++) {
        for (let x = 1; x < TS; x++) {
          const isPlaster = (c: RGB) => c === C.grey1 || c === C.cream2;
          if (!isPlaster(orig[y * TS + x]!) && isPlaster(orig[(y - 1) * TS + x]!)) t.set(x, y, darken(orig[y * TS + x]!, 0.8));
        }
      }
    }
    if (v === 3) {
      crack(t, rng, rng.int(14, 20), (c) => darken(c, 0.72)); // rachadura comprida e fina
    }
  },
  wainscot(t, rng, v) {
    t.map((c) => age(c, [140, 112, 92], 0.25));
    if (v >= 1) walk(t, rng, rng.int(4, 6), [1, 1], (c) => mix(c, C.cream3, 0.45)); // arranhão
    if (v === 2) blob(t, rng, 2, () => C.wood4, () => C.choc2); // lasca
    if (v === 3) {
      for (let x = MARGIN; x < TS - MARGIN; x++) if (rng.chance(0.35)) t.set(x, rng.int(1, 3), mix(t.get(x, 2), C.grey2, 0.6)); // poeira no topo
      walk(t, rng, rng.int(3, 5), [1, 0], (c) => mix(c, C.cream3, 0.4));
    }
  },
  wood_floor(t, rng, v) {
    t.map((c) => age(c, [150, 118, 92], 0.3));
    specks(t, rng, 4 + v * 2, C.wood3, 0.55);
    if (v === 1) {
      specks(t, rng, 8, C.wood4, 0.5);
      specks(t, rng, 4, C.grey2, 0.6);
    }
    if (v === 2) blob(t, rng, rng.int(5, 7), (c) => darken(c, 0.88), (c) => darken(c, 0.82)); // mancha
    if (v === 3) {
      seamCrack(t, rng); // emenda entre tábuas mais funda
      walk(t, rng, rng.int(5, 8), [1, 0], (c) => mix(c, C.cream3, 0.3)); // arranhão claro
    }
  },
  tile_floor(t, rng, v) {
    t.map((c) => age(c, C.cream3, 0.35));
    specks(t, rng, 3 + v, C.choc1, 0.4);
    if (v === 1) {
      const qx = rng.int(0, 1) * 16;
      const qy = rng.int(0, 1) * 16;
      for (let y = qy; y < qy + 16; y++) for (let x = qx; x < qx + 16; x++) t.set(x, y, mix(t.get(x, y), C.choc1, 0.12)); // azulejo encardido
    }
    if (v === 2) crack(t, rng, rng.int(10, 14), (c) => darken(c, 0.75)); // azulejo rachado
    if (v === 3) blob(t, rng, 2, () => C.grey2, () => C.grey3); // canto lascado
  },
};

/** Troca cores exatas ("#rrggbb" -> "#rrggbb"), por exemplo o rosa do pacote por bege. */
function recolor(t: Tile, map: Record<string, string>): void {
  const hex = (c: RGB) => '#' + c.map((v) => v.toString(16).padStart(2, '0')).join('');
  const parse = (h: string): RGB => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)) as RGB;
  const table = new Map(Object.entries(map).map(([from, to]) => [from.toLowerCase(), parse(to)]));
  t.map((c) => table.get(hex(c)) ?? c);
}

// ---------- Monta a folha estendida ----------

const source = PNG.sync.read(readFileSync(sourcePath));
const out = new PNG({ width: catalog.sheet.columns * TS, height: catalog.sheet.rows * TS });
source.data.copy(out.data, 0, 0, source.data.length);

let count = 0;
for (const w of worn.tiles) {
  const def = catalog.tiles[w.name]!;
  const from = catalog.tiles[w.from]!;
  for (let v = 0; v < w.variants; v++) {
    const tile = Tile.from(source, from.col, from.row);
    if (w.recolor) recolor(tile, w.recolor);
    STYLES[w.style](tile, createRng(worn.seed + count * 101 + v), v);
    tile.write(out, def.col + v, def.row);
  }
  count++;
}
writeFileSync(outPath, PNG.sync.write(out));
console.log(`✓ ${outPath}: ${worn.tiles.length} tiles velhos × variações (${out.width}x${out.height})`);
