// npx tsx scripts/art/kitchen.ts [--preview <png>]
// Estilo novo, fase 2 (decisão 051): balcão de madeira, cafeteira, equipamentos, pia e louça.
// Mesmos tamanhos, quadros e ordem das folhas antigas (data/tilesets.json, data/service_art.json, data/icons.json).
import { Canvas, at, darker, lighter, preview, rng, writeWithBackup } from './lib';
import { P, type Ramp, type RGB } from './palette';
import { counter } from './parts';

const T = 32;
const steam = (c: Canvas, x: number, y: number, f: number) => {
  // fumaça que sobe e ondula (f = quadro)
  for (let k = 0; k < 3; k++) {
    const yy = y - k * 3 - (f % 2);
    c.px(x + ((k + f) % 2 ? 1 : -1), yy, at(P.porcelain, 4), 180 - k * 40);
  }
};
const sparkle = (c: Canvas, x: number, y: number) => {
  c.px(x, y - 1, at(P.butter, 5)); c.px(x, y + 1, at(P.butter, 5)); c.px(x - 1, y, at(P.butter, 5)); c.px(x + 1, y, at(P.butter, 5)); c.px(x, y, [255, 255, 255]);
};
const lamp = (c: Canvas, x: number, y: number, state: 'off' | 'on' | 'ready') =>
  c.rect(x, y, 2, 2, state === 'off' ? at(P.metal, 1) : state === 'on' ? at(P.butter, 4) : at(P.green, 4));

/** Folha de quadros: cada linha é um equipamento, cada coluna um quadro. */
function frames(cols: number, rows: number, draw: (c: Canvas, row: number, f: number) => void): Canvas {
  const out = new Canvas(cols * T, rows * T);
  for (let r = 0; r < rows; r++)
    for (let f = 0; f < cols; f++) {
      const c = new Canvas(T, T);
      draw(c, r, f);
      c.outline();
      out.blit(c, f * T, r * T);
    }
  return out;
}

// ---------- cafeteira (6 quadros: parada, preparando 1..4, pronta) ----------
function coffeeMaker(c: Canvas, f: number): void {
  const working = f >= 1 && f <= 4, ready = f === 5;
  c.rect(5, 5, 22, 24, at(P.metal, 3)); c.hline(5, 5, 22, at(P.metal, 5)); c.vline(5, 5, 24, at(P.metal, 4)); c.vline(26, 5, 24, at(P.metal, 1));
  c.rect(7, 2, 18, 3, at(P.metal, 2)); // bandeja de xícaras em cima
  for (const x of [9, 14, 19]) { c.rect(x, 0, 4, 2, at(P.porcelain, 3)); c.hline(x, 0, 4, at(P.porcelain, 4)); }
  c.rect(7, 7, 18, 5, at(P.rose, 3)); c.hline(7, 7, 18, at(P.rose, 4)); c.hline(7, 11, 18, at(P.rose, 2));
  c.ball(10, 9.5, 1.6, 1.6, P.metal); c.ball(14, 9.5, 1.6, 1.6, P.metal);
  lamp(c, 21, 9, ready ? 'ready' : working ? (f % 2 ? 'on' : 'off') : 'off');
  c.rect(12, 13, 8, 3, at(P.metal, 1)); c.rect(14, 16, 4, 2, at(P.metal, 2)); // grupo e porta-filtro
  c.line(24, 13, 26, 21, at(P.metal, 4)); // vaporizador
  c.rect(8, 26, 16, 2, at(P.metal, 2)); c.hline(8, 26, 16, at(P.metal, 4));
  if (f >= 1) {
    c.rect(12, 20, 8, 6, at(P.porcelain, 3)); c.vline(12, 20, 6, at(P.porcelain, 4)); c.vline(19, 20, 6, at(P.porcelain, 1));
    c.rect(20, 21, 2, 3, at(P.porcelain, 2));
    const level = ready ? 4 : f - 1;
    if (level > 0) c.rect(13, 25 - level, 6, level, at(P.coffee, 3));
    if (ready) { c.hline(13, 21, 6, at(P.cream, 5)); c.px(15, 21, at(P.coffee, 3)); }
    if (working) c.vline(16, 18, 2 + (f % 2), at(P.coffee, 2)); // fio de café
    if (working || ready) steam(c, 15 + (f % 2), 18, f);
  }
  if (ready) sparkle(c, 25, 3);
}

// ---------- equipamentos (5 linhas x 6 quadros) ----------
function kettle(c: Canvas, f: number): void {
  const working = f >= 1 && f <= 4, ready = f === 5;
  c.rect(4, 24, 24, 5, at(P.rose, 3)); c.hline(4, 24, 24, at(P.rose, 4)); c.hline(4, 28, 24, at(P.rose, 1));
  lamp(c, 23, 26, ready ? 'ready' : working ? 'on' : 'off');
  c.rect(7, 26, 4, 1, at(P.cream, 5));
  c.ball(15, 16, 9, 8, P.mint);
  c.line(6, 15, 3, 9, at(P.mint, 3)); c.line(5, 15, 2, 9, at(P.mint, 2));
  c.ellipse(24, 15, 3, 4.5, at(P.mint, 2)); for (const y of [13, 14, 15, 16, 17]) c.clear(24, y);
  c.ellipse(15, 9, 5, 1.6, at(P.mint, 4)); c.ball(15, 7, 1.8, 1.4, P.rose);
  c.hline(8, 17, 14, at(P.cream, 5));
  if (working) { c.ball(15, 16, 9, 8, P.mint, 0.06 * (f % 2)); c.hline(8, 17, 14, at(P.cream, 5)); steam(c, 3, 8, f); steam(c, 5, 6, f + 1); }
  if (ready) { steam(c, 3, 8, 1); sparkle(c, 27, 5); }
}

function blender(c: Canvas, f: number): void {
  const working = f >= 1 && f <= 4, ready = f === 5;
  c.rect(7, 21, 18, 8, at(P.rose, 3)); c.hline(7, 21, 18, at(P.rose, 4)); c.hline(7, 28, 18, at(P.rose, 1)); c.vline(24, 21, 8, at(P.rose, 2));
  for (const x of [10, 14]) c.rect(x, 24, 2, 2, at(P.cream, 5));
  lamp(c, 20, 24, ready ? 'ready' : working ? 'on' : 'off');
  c.rect(9, 4, 14, 17, at(P.sky, 5)); c.vline(9, 4, 17, at(P.porcelain, 4)); c.vline(22, 4, 17, at(P.sky, 3));
  c.rect(8, 2, 16, 3, at(P.metal, 2)); c.hline(8, 2, 16, at(P.metal, 4));
  c.rect(23, 7, 3, 9, at(P.metal, 2)); // alça
  if (f >= 1) {
    const top = ready ? 8 : 15 - f * 2;
    c.rect(10, top, 12, 20 - top, at(P.red, 3)); c.hline(10, top, 12, at(P.red, 4));
    if (working) for (let k = 0; k < 3; k++) c.px(12 + ((k * 3 + f * 2) % 9), top + 2 + k * 2, at(P.red, 4));
  }
  c.line(11, 6, 11, 18, at(P.porcelain, 4));
  if (working) { c.px(6, 10 + (f % 2) * 2, at(P.metal, 3)); c.px(26, 12 - (f % 2) * 2, at(P.metal, 3)); }
  if (ready) sparkle(c, 26, 4);
}

function juicer(c: Canvas, f: number): void {
  const working = f >= 1 && f <= 4, ready = f === 5;
  c.rect(5, 14, 22, 15, at(P.mint, 3)); c.hline(5, 14, 22, at(P.mint, 5)); c.vline(5, 14, 15, at(P.mint, 4)); c.vline(26, 14, 15, at(P.mint, 1));
  c.rect(9, 18, 14, 9, at(P.mint, 1)); // nicho do copo
  c.rect(12, 20, 8, 7, at(P.sky, 5)); c.vline(12, 20, 7, at(P.porcelain, 4)); c.vline(19, 20, 7, at(P.sky, 3));
  const juice = ready ? 6 : f;
  if (juice > 0) c.rect(13, 27 - juice, 6, juice, at(P.butter, 3));
  if (working) c.vline(16, 17, 3 + (f % 2), at(P.butter, 3));
  lamp(c, 22, 16, ready ? 'ready' : working ? 'on' : 'off');
  c.ellipse(16, 12, 10, 3, at(P.metal, 3)); c.ellipse(16, 11.5, 8, 2, at(P.metal, 4));
  const orange = Math.max(1.5, 5 - (ready ? 4 : f));
  c.ball(16, 10 - orange / 2, 5, orange, P.terracotta, 0.2);
  if (ready) sparkle(c, 27, 6);
}

function stove(c: Canvas, f: number): void {
  const working = f >= 1 && f <= 4, ready = f === 5;
  c.rect(2, 12, 28, 17, at(P.cream, 4)); c.hline(2, 12, 28, at(P.cream, 5)); c.vline(2, 12, 17, at(P.cream, 5)); c.vline(29, 12, 17, at(P.cream, 2)); c.hline(2, 28, 28, at(P.cream, 1));
  c.rect(4, 17, 24, 7, at(P.walnut, 2)); c.rect(6, 19, 12, 3, at(P.walnut, 1));
  for (const x of [21, 25]) c.ball(x, 20.5, 1.6, 1.6, P.metal);
  lamp(c, 19, 14, ready ? 'ready' : working ? 'on' : 'off');
  c.rect(2, 9, 28, 3, at(P.metal, 3)); c.hline(2, 9, 28, at(P.metal, 4)); // tampo do fogão
  // panela
  if (working) for (let x = 7; x < 21; x += 3) c.px(x + (f % 2), 9, at(P.butter, 4)); // chama
  c.rect(7, 3, 14, 6, at(P.red, 3)); c.hline(7, 3, 14, at(P.red, 4)); c.vline(20, 3, 6, at(P.red, 1)); c.hline(5, 4, 2, at(P.red, 2)); c.hline(21, 4, 2, at(P.red, 2));
  c.ellipse(14, 3, 7, 1.2, at(P.metal, 4));
  if (working || ready) steam(c, 12 + (f % 3), 1, f);
  if (ready) sparkle(c, 27, 4);
}

function oven(c: Canvas, f: number): void {
  const working = f >= 1 && f <= 4, ready = f === 5;
  c.rect(2, 2, 28, 27, at(P.metal, 3)); c.hline(2, 2, 28, at(P.metal, 5)); c.vline(2, 2, 27, at(P.metal, 4)); c.vline(29, 2, 27, at(P.metal, 1)); c.hline(2, 28, 28, at(P.metal, 1));
  c.rect(4, 4, 24, 4, at(P.metal, 2)); for (const x of [7, 12, 17]) c.ball(x, 6, 1.4, 1.4, P.cream);
  lamp(c, 24, 5, ready ? 'ready' : working ? 'on' : 'off');
  const glow: RGB = working ? (f % 2 ? at(P.butter, 3) : at(P.terracotta, 4)) : ready ? at(P.terracotta, 2) : at(P.metal, 0);
  c.rect(5, 10, 22, 14, at(P.metal, 1)); c.rect(7, 12, 18, 10, glow);
  c.hline(7, 12, 18, at(P.metal, 0));
  if (f >= 1) { const h = ready ? 5 : 2 + Math.floor(f / 2); c.ball(16, 21 - h / 2, 6, h / 2 + 1, ready ? P.butter : P.pine); }
  c.line(8, 21, 13, 13, at(P.porcelain, 3)); // reflexo no vidro
  c.rect(6, 9, 20, 1, at(P.metal, 4)); // puxador
  if (ready) sparkle(c, 27, 12);
}

// ---------- pia (7 quadros: vazia, com louça, lavando 1..4, limpa) ----------
function sink(c: Canvas, f: number): void {
  // gabinete com portas
  c.rect(1, 12, 30, 17, at(P.walnut, 3)); c.hline(1, 12, 30, at(P.walnut, 1)); c.hline(1, 28, 30, at(P.walnut, 1));
  for (const x of [3, 17]) { c.rect(x, 15, 12, 11, at(P.walnut, 4)); c.hline(x, 15, 12, at(P.walnut, 5)); c.vline(x + 11, 15, 11, at(P.walnut, 2)); }
  c.px(14, 20, at(P.gold, 4)); c.px(17, 20, at(P.gold, 4));
  // tampo com a cuba
  c.rect(0, 8, 32, 4, at(P.cream, 4)); c.hline(0, 8, 32, at(P.cream, 3)); c.hline(0, 11, 32, at(P.cream, 5));
  c.rect(6, 8, 20, 3, at(P.metal, 2)); c.hline(6, 8, 20, at(P.metal, 1));
  // torneira
  c.rect(15, 2, 2, 6, at(P.metal, 4)); c.rect(15, 2, 6, 2, at(P.metal, 4)); c.vline(20, 4, 2, at(P.metal, 3));
  c.ball(12, 6, 1.4, 1.4, P.red); c.ball(23, 6, 1.4, 1.4, P.sky);
  const washing = f >= 2 && f <= 5;
  if (washing) {
    c.vline(20, 6, 2, at(P.sky, 4));
    for (let k = 0; k < 5; k++) c.ball(8 + ((k * 4 + f * 3) % 16), 7 - ((k + f) % 2), 2, 1.6, P.porcelain);
  }
  if (f === 1) { // louça suja empilhada
    c.ellipse(10, 7, 4, 1.4, at(P.porcelain, 2)); c.ellipse(10, 6, 4, 1.4, at(P.porcelain, 3)); c.px(9, 6, at(P.coffee, 3)); c.px(11, 6, at(P.red, 3));
    c.rect(22, 3, 3, 5, at(P.porcelain, 3)); c.px(23, 5, at(P.coffee, 3));
  }
  if (f === 6) { // louça limpa no escorredor
    for (const x of [24, 26, 28]) { c.ellipse(x, 6, 1.2, 3, at(P.porcelain, 4)); }
    sparkle(c, 9, 4);
  }
}

// ---------- louça ----------
type DishKind = 'cup' | 'plate' | 'glass' | 'bowl' | 'tall' | 'mug';
type DishState = 'clean' | 'full' | 'dirty';
/** Louça desenhada numa grade de 16 (s=1) ou 32 (s=2) pixels, base na última linha. */
function dish(c: Canvas, kind: DishKind, state: DishState, s: 1 | 2): void {
  const k = (n: number) => n * s;
  const dirt = (x0: number, y0: number, w: number, h: number, seed: number) => { const rnd = rng(seed); for (let i = 0; i < 4 * s; i++) c.px(x0 + Math.floor(rnd() * w), y0 + Math.floor(rnd() * h), rnd() < 0.5 ? at(P.coffee, 3) : at(P.terracotta, 3)); };
  if (kind === 'cup' || kind === 'mug') {
    const r: Ramp = kind === 'mug' ? P.rose : P.porcelain;
    if (kind === 'cup') { c.ellipse(k(8), k(13.5), k(6.5), k(1.6), at(P.porcelain, 1)); c.ellipse(k(8), k(13), k(6.5), k(1.6), at(P.porcelain, 3)); }
    c.rect(k(4), k(6), k(8), k(7), at(r, 3)); c.vline(k(4), k(6), k(7), lighter(r, 2)); c.vline(k(12) - 1, k(6), k(7), darker(r, 1));
    c.ellipse(k(8), k(6), k(4), k(1.3), at(r, 4));
    c.ellipse(k(13), k(9), k(2), k(2.2), darker(r, 1)); c.ellipse(k(13), k(9), Math.max(0.6, k(0.9)), Math.max(0.6, k(1.1)), [0, 0, 0]);
    for (let y = k(8); y <= k(10); y++) for (let x = k(12); x <= k(14); x++) if ((x - k(13)) ** 2 / k(1) ** 2 + (y - k(9)) ** 2 / k(1.2) ** 2 < 1) c.clear(x, y);
    if (state === 'full') { c.ellipse(k(8), k(6), k(3), k(0.9), at(P.coffee, 3)); c.px(k(8), k(6), at(P.cream, 5)); }
    if (state === 'dirty') { c.ellipse(k(8), k(6), k(3), k(0.9), at(P.coffee, 1)); dirt(k(4), k(7), k(8), k(3), 31); }
  } else if (kind === 'plate') {
    c.ellipse(k(8), k(12), k(7), k(2.6), at(P.porcelain, 1));
    c.ellipse(k(8), k(11.4), k(7), k(2.4), at(P.porcelain, 3));
    c.ellipse(k(8), k(11.2), k(4.5), k(1.3), at(P.porcelain, 4));
    if (state === 'full') { c.rect(k(5), k(8), k(6), k(3), at(P.butter, 4)); c.hline(k(5), k(8), k(6), at(P.rose, 4)); c.vline(k(10) + s - 1, k(8), k(3), at(P.butter, 2)); c.px(k(6), k(7), at(P.red, 3)); }
    if (state === 'dirty') { dirt(k(3), k(10), k(10), k(2), 32); c.line(k(5), k(11), k(9), k(12), at(P.coffee, 2)); }
  } else if (kind === 'bowl') {
    c.ellipse(k(8), k(12), k(6), k(2.4), at(P.porcelain, 1));
    c.rect(k(2), k(8), k(12), k(4), at(P.porcelain, 3)); c.vline(k(2), k(8), k(4), at(P.porcelain, 4));
    c.ellipse(k(8), k(8), k(6), k(1.6), at(P.porcelain, 4)); c.ellipse(k(8), k(8), k(4.5), k(1), at(P.porcelain, 2));
    if (state === 'dirty') dirt(k(4), k(7), k(8), k(2), 33);
  } else {
    const tall = kind === 'tall';
    const top = tall ? k(1) : k(4);
    c.rect(k(5), top, k(6), k(13.5) - top, at(P.sky, 5)); c.vline(k(5), top, k(13.5) - top, at(P.porcelain, 4)); c.vline(k(11) - 1, top, k(13.5) - top, at(P.sky, 3));
    c.hline(k(5), k(13.5) - 1, k(6), at(P.sky, 3));
    if (state === 'full') { c.rect(k(5) + 1, k(7), k(6) - 2, k(6), at(P.butter, 3)); c.hline(k(5) + 1, k(7), k(6) - 2, at(P.butter, 4)); }
    if (state === 'dirty') { c.rect(k(5) + 1, k(11), k(6) - 2, k(2), at(P.butter, 2)); dirt(k(5), top, k(6), k(4), 34); }
  }
}

function stack(c: Canvas, n: number, dirty: boolean): void {
  for (let i = 0; i < n; i++) {
    const y = 26 - i * 4;
    c.ellipse(16, y + 1, 13, 4, at(P.porcelain, 1));
    c.ellipse(16, y, 13, 4, at(P.porcelain, 3));
    c.hline(4, y, 25, at(P.porcelain, 4));
  }
  c.ellipse(16, 26 - (n - 1) * 4 - 0.5, 8, 2, at(P.porcelain, 4));
  if (dirty) { const rnd = rng(40 + n); for (let i = 0; i < 10; i++) c.px(8 + Math.floor(rnd() * 16), 25 - (n - 1) * 4 + Math.floor(rnd() * 3) - 1, rnd() < 0.5 ? at(P.coffee, 3) : at(P.terracotta, 3)); }
}

// ---------- montagem ----------
const out: [string, Canvas][] = [];
{
  const c = new Canvas(96, 32);
  ([[true, false], [false, false], [false, true]] as const).forEach(([l, r], i) => { const p = new Canvas(32, 32); counter(p, l, r); p.outline(); c.blit(p, i * 32, 0); });
  out.push(['public/assets/objects/furniture/tile_counter_wood.png', c]);
}
out.push(['public/assets/objects/equipment/anim_coffee_maker.png', frames(6, 1, (c, _r, f) => coffeeMaker(c, f))]);
out.push(['public/assets/objects/equipment/anim_kitchen_equipment.png', frames(6, 5, (c, r, f) => [kettle, blender, juicer, stove, oven][r]!(c, f))]);
out.push(['public/assets/objects/equipment/anim_sink.png', frames(7, 1, (c, _r, f) => sink(c, f))]);
{
  const c = new Canvas(48, 48);
  (['cup', 'plate', 'glass'] as const).forEach((kind, row) =>
    (['clean', 'full', 'dirty'] as const).forEach((state, col) => { const p = new Canvas(16, 16); dish(p, kind, state, 1); p.outline(); c.blit(p, col * 16, row * 16); }),
  );
  out.push(['public/assets/objects/dishes/tile_dishes_16.png', c]);
}
{
  // ícones 32: mesma grade do pacote louça (data/icons.json, folha "louca")
  const c = new Canvas(256, 96);
  const cells: [number, number, (p: Canvas) => void][] = [
    [0, 0, (p) => dish(p, 'cup', 'clean', 2)], [1, 0, (p) => dish(p, 'cup', 'dirty', 2)],
    [2, 0, (p) => dish(p, 'plate', 'clean', 2)], [3, 0, (p) => dish(p, 'plate', 'dirty', 2)],
    [4, 0, (p) => dish(p, 'bowl', 'clean', 2)], [5, 0, (p) => dish(p, 'bowl', 'dirty', 2)],
    [6, 0, (p) => dish(p, 'glass', 'clean', 2)], [7, 0, (p) => dish(p, 'glass', 'dirty', 2)],
    [0, 1, (p) => dish(p, 'tall', 'clean', 2)], [1, 1, (p) => dish(p, 'tall', 'dirty', 2)],
    [2, 1, (p) => dish(p, 'mug', 'clean', 2)], [3, 1, (p) => dish(p, 'mug', 'dirty', 2)],
    [4, 1, (p) => stack(p, 2, false)], [5, 1, (p) => stack(p, 2, true)],
    [6, 1, (p) => stack(p, 3, false)], [7, 1, (p) => stack(p, 3, true)],
    [0, 2, (p) => stack(p, 5, false)], [1, 2, (p) => stack(p, 5, true)],
  ];
  for (const [col, row, draw] of cells) { const p = new Canvas(32, 32); draw(p); p.outline(); c.blit(p, col * 32, row * 32); }
  out.push(['public/assets/icons/sheets/icon_sheet_dishes.png', c]);
}

for (const [path, c] of out) writeWithBackup(c, path);
const i = process.argv.indexOf('--preview');
if (i > 0 && process.argv[i + 1]) {
  const W = Math.max(...out.map(([, c]) => c.w));
  const H = out.reduce((a, [, c]) => a + c.h + 4, 0);
  const all = new Canvas(W, H);
  let y = 0;
  for (const [, c] of out) { all.blit(c, 0, y); y += c.h + 4; }
  preview(all, 3, process.argv[i + 1]!);
}
console.log(`✓ fase 2: ${out.length} folhas no estilo novo`);
