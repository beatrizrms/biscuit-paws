// npx tsx scripts/art/cafe.ts [--preview <png>]
// Redesenha a folha do café (public/assets/interiors/cafe/tile_cafe.png) no estilo novo (decisão 047):
// mesmas peças, mesmas posições e tamanhos do catálogo (data/tiles.csv), então mapas e dados não mudam.
// A folha antiga fica em assets/_estilo_antigo/. Depois rode `npm run art` para regerar as versões gastas.
import { Canvas, Sheet, at, darker, lighter, mid, preview, readCatalog, rng, writeWithBackup } from './lib';
import { P, hex, type Ramp, type RGB } from './palette';

type Draw = (c: Canvas) => void;
const OUT = 'public/assets/interiors/cafe/tile_cafe.png';

// ---------- ajudantes ----------
/** Tábuas horizontais que emendam sem costura (duas juntas por fileira, a cada 16 px). */
function planks(c: Canvas, r: Ramp, rowH: number, joints: number[], seed: number): void {
  const rnd = rng(seed);
  for (let row = 0; row * rowH < 32; row++) {
    const y = row * rowH;
    const j = joints[row % joints.length]!;
    for (let x = 0; x < 32; x++) {
      const inPlank = (x - j + 32) % 32 < 16;
      const base = inPlank ? at(r, 3) : at(r, 2);
      for (let k = 0; k < rowH; k++) c.px(x, y + k, base);
      c.px(x, y, inPlank ? at(r, 4) : at(r, 3)); // quina de cima clara
      c.px(x, y + rowH - 1, at(r, 0)); // fresta entre fileiras
    }
    for (const jx of [j, (j + 16) % 32]) {
      c.vline(jx, y, rowH - 1, at(r, 0));
      c.vline((jx + 1) % 32, y + 1, rowH - 2, at(r, 4));
    }
    // veios
    for (let n = 0; n < 3; n++) {
      const gx = Math.floor(rnd() * 28), gy = y + 2 + Math.floor(rnd() * (rowH - 4)), len = 3 + Math.floor(rnd() * 5);
      for (let i = 0; i < len; i++) {
        const x = (gx + i) % 32;
        const cur = c.get(x, gy);
        if (cur && cur !== at(r, 0)) c.px(x, gy, darker(r, 1));
      }
    }
  }
}

function plate(c: Canvas, cx: number, cy: number, rx: number): void {
  c.ellipse(cx, cy + 1, rx, 3, at(P.porcelain, 1));
  c.ellipse(cx, cy, rx, 3, at(P.porcelain, 3));
  c.ellipse(cx, cy - 0.5, rx - 3, 1.6, at(P.porcelain, 4));
}

function sisal(c: Canvas, x: number, y: number, w: number, h: number): void {
  for (let j = 0; j < h; j++) {
    const band = Math.floor(j / 2) % 2 ? at(P.pine, 3) : at(P.pine, 2);
    c.hline(x, y + j, w, band);
  }
  c.vline(x, y, h, at(P.pine, 4));
  c.vline(x + w - 1, y, h, at(P.pine, 1));
}

function leaves(c: Canvas, cx: number, cy: number, sx: number, sy: number, n: number, seed: number, r: Ramp = P.green): void {
  const rnd = rng(seed);
  const pts = Array.from({ length: n }, () => [cx + (rnd() - 0.5) * 2 * sx, cy + (rnd() - 0.5) * 2 * sy] as const).sort((a, b) => a[1] - b[1]);
  for (const [x, y] of pts) c.ball(x, y, 3.2, 2.4, r);
}

/** Lombadas de livros apoiadas numa base (com pilha deitada e vasinho de vez em quando). */
const BOOKS: Ramp[] = [P.red, P.navy, P.butter, P.teal, P.cream, P.lilac, P.terracotta];
function books(c: Canvas, x0: number, x1: number, floor: number, seed: number): void {
  const rnd = rng(seed);
  let x = x0;
  while (x < x1) {
    const roll = rnd();
    if (roll < 0.1 && x < x1 - 5) {
      c.rect(x, floor - 3, 4, 4, at(P.terracotta, 3));
      c.hline(x, floor - 3, 4, at(P.terracotta, 4));
      c.vline(x + 3, floor - 3, 4, at(P.terracotta, 1));
      c.ball(x + 1.5, floor - 5, 2.4, 1.8, P.green);
      x += 5;
      continue;
    }
    if (roll < 0.2 && x < x1 - 6) {
      for (let k = 0; k < 3; k++) {
        const b = BOOKS[Math.floor(rnd() * BOOKS.length)]!;
        const w = 6 - (k % 2);
        c.rect(x, floor - 2 * k - 1, w, 2, mid(b));
        c.hline(x, floor - 2 * k - 1, w, lighter(b, 1));
      }
      x += 7;
      continue;
    }
    const b = BOOKS[Math.floor(rnd() * BOOKS.length)]!;
    const w = 2 + Math.floor(rnd() * 2), h = 7 + Math.floor(rnd() * 4);
    if (x + w > x1) break;
    const top = floor - h + 1;
    c.rect(x, top, w, h, mid(b));
    c.vline(x, top, h, lighter(b, 1));
    if (w > 2) c.vline(x + w - 1, top, h, darker(b, 1));
    c.px(x + (w > 2 ? 1 : 0), top + 2, lighter(b, 2));
    c.px(x + (w > 2 ? 1 : 0), top + h - 3, darker(b, 1));
    x += w + (rnd() < 0.2 ? 1 : 0);
  }
}

/** Balcão: tampo de mármore creme e frente de madeira escura com painéis. ends: lados com acabamento. */
function counter(c: Canvas, left: boolean, right: boolean): void {
  const x0 = left ? 1 : 0, x1 = right ? 30 : 31;
  const w = x1 - x0 + 1;
  // tampo
  c.rect(x0, 8, w, 5, at(P.cream, 4));
  c.hline(x0, 8, w, at(P.cream, 3));
  c.hline(x0, 12, w, at(P.cream, 5));
  const rnd = rng(left ? 3 : right ? 5 : 7);
  for (let i = 0; i < 4; i++) { const vx = x0 + Math.floor(rnd() * (w - 4)); c.line(vx, 9, vx + 3, 11, at(P.cream, 3)); }
  // frente
  c.rect(x0, 13, w, 16, at(P.walnut, 3));
  c.hline(x0, 13, w, at(P.walnut, 1)); // sombra sob o tampo
  for (const px of [x0 + (left ? 2 : 1), 17]) {
    const pw = px === 17 ? (right ? 11 : 13) : 13;
    c.rect(px, 16, pw, 10, at(P.walnut, 3));
    c.hline(px, 16, pw, at(P.walnut, 1));
    c.vline(px, 16, 10, at(P.walnut, 1));
    c.hline(px, 25, pw, at(P.walnut, 5));
    c.vline(px + pw - 1, 16, 10, at(P.walnut, 4));
    c.speckle(px + 1, 17, pw - 2, 8, at(P.walnut, 2), 0.08, rnd);
  }
  c.rect(x0, 28, w, 3, at(P.walnut, 1)); // rodapé
  c.hline(x0, 28, w, at(P.walnut, 2));
  if (left) { c.vline(x0, 8, 23, at(P.walnut, 5)); c.vline(x0, 8, 5, at(P.cream, 5)); }
  if (right) { c.vline(x1, 13, 18, at(P.walnut, 0)); c.vline(x1, 8, 5, at(P.cream, 2)); }
}

/** Cadeira de perfil, virada para a esquerda (encosto à direita). */
function chairSide(c: Canvas): void {
  c.rect(20, 3, 3, 27, at(P.walnut, 3)); c.vline(20, 3, 27, at(P.walnut, 4)); c.vline(22, 3, 27, at(P.walnut, 1));
  c.rect(18, 3, 5, 2, at(P.walnut, 4)); c.hline(18, 3, 5, at(P.walnut, 5));
  c.rect(17, 6, 3, 10, at(P.rose, 3)); c.vline(17, 6, 10, at(P.rose, 4)); c.hline(17, 15, 3, at(P.rose, 2));
  c.ball(14, 17, 8, 2.6, P.rose);
  c.rect(6, 19, 17, 2, at(P.walnut, 3)); c.hline(6, 20, 17, at(P.walnut, 1));
  c.rect(7, 21, 2, 9, at(P.walnut, 3)); c.vline(7, 21, 9, at(P.walnut, 4));
  c.line(10, 21, 19, 21, at(P.walnut, 2));
}

function cushion(r: Ramp): Draw {
  return (c) => {
    c.ellipse(16, 23, 13, 6, at(r, 1)); // lateral (espessura)
    c.ball(16, 20, 13, 6, r, 0.15); // tampo fofo
    c.ellipse(16, 20, 8, 3, lighter(r, 1));
    c.ellipse(13, 18.5, 4, 1.2, lighter(r, 2));
    c.px(16, 20, at(r, 1)); c.px(15, 20, darker(r, 1)); // botão do capitonê
  };
}

function bowl(c: Canvas, inner: Ramp, outer: Ramp, kibble: boolean): void {
  c.ellipse(16, 25, 10, 4, at(outer, 1));
  c.rect(6, 21, 21, 4, at(outer, 3));
  c.vline(6, 21, 4, at(outer, 4));
  c.vline(26, 21, 4, at(outer, 1));
  c.ellipse(16, 21, 10, 3, at(outer, 4));
  c.ellipse(16, 21, 8, 2, at(inner, 2));
  if (kibble) {
    const rnd = rng(9);
    for (let i = 0; i < 12; i++) c.px(10 + Math.floor(rnd() * 12), 20 + Math.floor(rnd() * 2), rnd() < 0.5 ? at(P.pine, 3) : at(P.coffee, 3));
  } else {
    c.hline(12, 20, 4, at(inner, 4));
    c.px(19, 21, at(inner, 5));
  }
}

// ---------- peças ----------
const pieces: Record<string, Draw> = {
  // pisos (sem contorno, emendam nos 4 lados)
  floor_wood_a: (c) => planks(c, P.oak, 8, [10, 2, 6, 14], 1),
  floor_wood_b: (c) => {
    planks(c, P.walnut, 16, [5, 13], 2);
    c.ellipse(22, 7, 2, 1.2, at(P.walnut, 1)); c.px(22, 7, at(P.walnut, 0));
    c.ellipse(9, 24, 2, 1.2, at(P.walnut, 1));
  },
  floor_check_pink: (c) => {
    // ladrilho pequeno (8 px) e de pouco contraste: lê como textura de piso, não como tabuleiro
    const rose: RGB = [222, 168, 160], creamy: RGB = [238, 214, 186];
    for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) {
      const odd = ((x >> 3) + (y >> 3)) & 1;
      const lx = x % 8, ly = y % 8;
      const base = odd ? rose : creamy;
      const col: RGB = lx === 7 || ly === 7 ? [base[0] - 26, base[1] - 30, base[2] - 28] : lx === 0 || ly === 0 ? [Math.min(255, base[0] + 10), Math.min(255, base[1] + 10), Math.min(255, base[2] + 10)] : base;
      c.px(x, y, col);
    }
    c.speckle(0, 0, 32, 32, at(P.cream, 3), 0.02, rng(4));
  },
  floor_tile_mint: (c) => {
    for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) {
      const lx = x % 16, ly = y % 16;
      c.px(x, y, lx === 0 || ly === 0 ? at(P.mint, 2) : lx === 1 || ly === 1 ? at(P.mint, 5) : lx === 15 || ly === 15 ? at(P.mint, 3) : at(P.mint, 4));
    }
    c.speckle(0, 0, 32, 32, at(P.mint, 3), 0.03, rng(5));
  },
  floor_rug: (c) => {
    // fio da franja nas pontas
    for (let y = 6; y < 58; y += 2) { c.hline(0, y, 3, at(P.cream, 4)); c.hline(93, y, 3, at(P.cream, 4)); }
    c.rect(3, 4, 90, 56, at(P.wine, 2));
    c.rect(3, 4, 90, 4, at(P.rose, 3)); c.rect(3, 56, 90, 4, at(P.rose, 2));
    c.rect(3, 4, 4, 56, at(P.rose, 3)); c.rect(89, 4, 4, 56, at(P.rose, 2));
    c.rect(9, 10, 78, 44, at(P.wine, 3));
    for (let x = 9; x < 87; x += 6) { c.px(x + 2, 6, at(P.cream, 4)); c.px(x + 2, 57, at(P.cream, 3)); }
    for (let y = 8; y < 56; y += 6) { c.px(5, y + 2, at(P.cream, 4)); c.px(90, y + 2, at(P.cream, 3)); }
    c.rect(9, 10, 78, 1, at(P.wine, 1)); c.rect(9, 10, 1, 44, at(P.wine, 1));
    // losangos e a pata no meio
    for (const [dx, dy] of [[22, 22], [74, 22], [22, 42], [74, 42]] as const) {
      for (let k = 0; k < 4; k++) { c.px(dx - k, dy - 3 + k, at(P.rose, 4)); c.px(dx + k, dy - 3 + k, at(P.rose, 4)); c.px(dx - k, dy + 3 - k, at(P.rose, 3)); c.px(dx + k, dy + 3 - k, at(P.rose, 3)); }
    }
    c.ellipse(48, 35, 7, 5, at(P.rose, 4));
    for (const [tx, ty] of [[40, 26], [45, 23], [51, 23], [56, 26]] as const) c.ellipse(tx, ty, 2.4, 2, at(P.rose, 4));
    c.speckle(9, 10, 78, 44, at(P.wine, 4), 0.02, rng(6));
  },
  doormat: (c) => {
    c.rect(3, 15, 26, 13, at(P.pine, 3));
    c.rect(3, 15, 26, 1, at(P.pine, 4));
    c.rect(5, 17, 22, 9, at(P.pine, 2));
    c.speckle(5, 17, 22, 9, at(P.pine, 1), 0.25, rng(8));
    c.ellipse(16, 22, 3, 2, at(P.wine, 3));
    for (const tx of [12, 15, 18, 21]) c.px(tx - (tx > 16 ? 1 : 0), 19, at(P.wine, 3));
  },
  // paredes (sem contorno)
  wall_stripe_pink: (c) => {
    for (let x = 0; x < 32; x++) {
      const k = x % 8;
      const col = k < 5 ? at(P.rose, 3) : k === 5 ? at(P.rose, 2) : at(P.rose, 4);
      c.vline(x, 0, 32, col);
    }
    c.speckle(0, 0, 32, 32, at(P.rose, 2), 0.015, rng(10));
  },
  wall_dots_cream: (c) => {
    c.rect(0, 0, 32, 32, at(P.cream, 4));
    c.speckle(0, 0, 32, 32, at(P.cream, 3), 0.05, rng(11));
    for (const [x, y] of [[8, 8], [24, 24]] as const) {
      c.px(x, y - 1, at(P.rose, 3)); c.px(x, y + 1, at(P.rose, 3)); c.px(x - 1, y, at(P.rose, 3)); c.px(x + 1, y, at(P.rose, 3)); c.px(x, y, at(P.butter, 3));
    }
    for (const [x, y] of [[24, 8], [8, 24]] as const) { c.px(x, y, at(P.mint, 3)); c.px(x + 1, y + 1, at(P.mint, 2)); }
  },
  wall_mint: (c) => {
    c.rect(0, 0, 32, 32, at(P.mint, 4));
    for (const x of [0, 16]) c.vline(x, 0, 32, at(P.mint, 3));
    for (const x of [1, 17]) c.vline(x, 0, 32, at(P.mint, 5));
    for (const [x, y] of [[8, 6], [24, 22]] as const) { c.px(x, y, at(P.mint, 2)); c.px(x - 1, y + 1, at(P.mint, 2)); c.px(x + 1, y + 1, at(P.mint, 2)); c.px(x, y + 2, at(P.mint, 3)); }
    c.speckle(0, 0, 32, 32, at(P.mint, 3), 0.03, rng(12));
  },
  wall_wainscot: (c) => {
    c.rect(0, 0, 32, 32, at(P.walnut, 3));
    c.rect(0, 0, 32, 3, at(P.walnut, 4)); c.hline(0, 0, 32, at(P.walnut, 5)); c.hline(0, 3, 32, at(P.walnut, 1));
    c.rect(3, 7, 26, 17, at(P.walnut, 3));
    c.hline(3, 7, 26, at(P.walnut, 1)); c.vline(3, 7, 17, at(P.walnut, 1));
    c.hline(3, 23, 26, at(P.walnut, 5)); c.vline(28, 7, 17, at(P.walnut, 4));
    c.rect(5, 9, 22, 13, at(P.walnut, 4)); c.hline(5, 9, 22, at(P.walnut, 5));
    c.speckle(5, 10, 22, 12, at(P.walnut, 3), 0.05, rng(13));
    c.rect(0, 27, 32, 5, at(P.walnut, 2)); c.hline(0, 27, 32, at(P.walnut, 4)); c.hline(0, 31, 32, at(P.walnut, 0));
  },
  wall_top_trim: (c) => {
    c.rect(0, 0, 32, 7, at(P.walnut, 3));
    c.hline(0, 0, 32, at(P.walnut, 5)); c.hline(0, 2, 32, at(P.walnut, 2)); c.hline(0, 3, 32, at(P.walnut, 4)); c.hline(0, 6, 32, at(P.walnut, 1));
  },
  // parede: decoração
  window: (c) => {
    c.rect(7, 6, 50, 46, at(P.walnut, 3));
    c.rect(10, 9, 44, 40, at(P.sky, 3));
    for (let y = 9; y < 49; y++) c.hline(10, y, 44, y < 22 ? at(P.sky, 3) : y < 36 ? at(P.sky, 4) : at(P.sky, 5));
    c.ellipse(20, 16, 5, 2, at(P.sky, 5)); c.ellipse(24, 15, 4, 2.4, at(P.sky, 5)); c.ellipse(44, 26, 4, 1.6, at(P.sky, 5));
    for (let k = 0; k < 9; k++) { c.px(38 + k, 46 - k * 2, at(P.sky, 5)); c.px(42 + k, 46 - k * 2, at(P.sky, 5)); }
    c.rect(31, 9, 2, 40, at(P.walnut, 3)); c.vline(31, 9, 40, at(P.walnut, 4));
    c.rect(10, 28, 44, 2, at(P.walnut, 3)); c.hline(10, 28, 44, at(P.walnut, 4));
    c.hline(10, 9, 44, at(P.walnut, 1)); c.vline(10, 9, 40, at(P.walnut, 1));
    c.rect(3, 50, 58, 5, at(P.cream, 4)); c.hline(3, 50, 58, at(P.cream, 5)); c.hline(3, 54, 58, at(P.cream, 2));
    // cortinas presas no meio, sanefa em cima
    for (const side of [0, 1]) {
      for (let y = 6; y < 50; y++) {
        const tie = y > 30 && y < 34;
        const wid = y < 30 ? 12 - Math.floor((y - 6) / 6) : y < 34 ? 6 : 6 + Math.floor((y - 34) / 3);
        for (let i = 0; i < wid; i++) {
          const x = side ? 60 - i : 3 + i;
          const fold = (i + (side ? 1 : 0)) % 4;
          c.px(x, y, tie ? at(P.butter, 3) : fold === 0 ? at(P.rose, 2) : fold === 1 ? at(P.rose, 4) : at(P.rose, 3));
        }
      }
    }
    c.rect(1, 1, 62, 6, at(P.rose, 3)); c.hline(1, 1, 62, at(P.rose, 4));
    for (let x = 1; x < 63; x += 6) c.ellipse(x + 3, 7, 3, 1.5, at(P.rose, 2));
    c.hline(0, 0, 64, at(P.walnut, 2));
  },
  door: (c) => {
    c.rect(2, 4, 28, 60, at(P.walnut, 2)); c.vline(2, 4, 60, at(P.walnut, 4)); c.hline(2, 4, 28, at(P.walnut, 4));
    c.rect(5, 7, 22, 57, at(P.mint, 2)); c.vline(5, 7, 57, at(P.mint, 3)); c.vline(26, 7, 57, at(P.mint, 1));
    c.rect(9, 11, 14, 16, at(P.sky, 4)); c.hline(9, 11, 14, at(P.mint, 0)); c.vline(9, 11, 16, at(P.mint, 0));
    c.vline(15, 11, 16, at(P.mint, 2)); c.hline(9, 18, 14, at(P.mint, 2));
    c.line(18, 25, 22, 13, at(P.sky, 5));
    for (const py of [32, 47]) {
      c.rect(9, py, 14, 12, at(P.mint, 2)); c.hline(9, py, 14, at(P.mint, 1)); c.vline(9, py, 12, at(P.mint, 1));
      c.hline(9, py + 11, 14, at(P.mint, 4)); c.vline(22, py, 12, at(P.mint, 3));
    }
    c.ball(23, 41, 1.6, 1.6, P.gold);
    c.line(12, 27, 16, 25, at(P.cream, 2)); c.line(20, 27, 16, 25, at(P.cream, 2));
    c.rect(11, 27, 10, 5, at(P.cream, 4)); c.hline(11, 27, 10, at(P.cream, 5)); c.hline(13, 29, 6, at(P.wine, 3));
  },
  menu_board: (c) => {
    c.rect(2, 2, 60, 26, at(P.walnut, 3)); c.hline(2, 2, 60, at(P.walnut, 5)); c.hline(2, 27, 60, at(P.walnut, 1));
    c.rect(5, 5, 54, 20, at(P.chalk, 2)); c.hline(5, 5, 54, at(P.chalk, 0)); c.vline(5, 5, 20, at(P.chalk, 0));
    const rnd = rng(14);
    for (const ly of [8, 12, 16, 20]) {
      let x = 8;
      while (x < 36) { const len = 2 + Math.floor(rnd() * 4); c.hline(x, ly, len, at(P.cream, 4)); x += len + 1; }
      c.hline(40, ly, 3, at(P.butter, 4));
    }
    c.rect(47, 13, 7, 6, at(P.rose, 4)); c.vline(54, 14, 3, at(P.rose, 4)); c.hline(46, 19, 9, at(P.cream, 4));
    c.px(49, 10, at(P.cream, 3)); c.px(51, 9, at(P.cream, 3));
    c.rect(8, 28, 48, 2, at(P.walnut, 2)); c.rect(12, 27, 3, 1, at(P.cream, 5)); c.rect(18, 27, 2, 1, at(P.rose, 4));
  },
  wall_clock: (c) => {
    for (let k = 0; k < 5; k++) { c.hline(7 + k, 4 + k, 5 - k, at(P.rose, 3)); c.hline(20, 4 + k, 5 - k, at(P.rose, 3)); }
    c.ball(16, 17, 11, 11, P.walnut);
    c.ellipse(16, 17, 8.5, 8.5, at(P.cream, 5));
    c.ellipse(16, 17.5, 8.5, 8, at(P.cream, 4));
    for (const [x, y] of [[16, 10], [23, 17], [16, 24], [9, 17]] as const) c.px(x, y, at(P.walnut, 2));
    c.line(16, 17, 16, 12, at(P.walnut, 0)); c.line(16, 17, 20, 19, at(P.walnut, 0)); c.px(16, 17, at(P.wine, 3));
  },
  picture_paw: (c) => {
    c.rect(6, 5, 20, 22, at(P.gold, 2)); c.hline(6, 5, 20, at(P.gold, 4)); c.vline(6, 5, 22, at(P.gold, 3)); c.hline(6, 26, 20, at(P.gold, 0));
    c.rect(9, 8, 14, 16, at(P.cream, 4));
    c.rect(10, 9, 12, 14, at(P.sky, 4));
    c.ellipse(16, 18, 4, 3.2, at(P.navy, 3));
    for (const [tx, ty] of [[12, 13], [14.5, 11.5], [17.5, 11.5], [20, 13]] as const) c.ellipse(tx, ty, 1.4, 1.4, at(P.navy, 3));
  },
  wall_shelf: (c) => {
    // objetos em cima da prábua
    c.rect(6, 9, 6, 9, at(P.sky, 4)); c.rect(6, 12, 6, 6, at(P.butter, 3)); c.rect(6, 7, 6, 2, at(P.walnut, 3)); c.vline(6, 9, 9, at(P.sky, 5));
    c.rect(14, 11, 5, 7, at(P.porcelain, 3)); c.rect(14, 14, 5, 4, at(P.wine, 3)); c.rect(14, 9, 5, 2, at(P.rose, 3));
    books(c, 24, 38, 17, 15);
    c.ellipse(45, 15, 4, 3, at(P.porcelain, 3)); c.vline(49, 13, 3, at(P.porcelain, 2)); c.hline(43, 13, 4, at(P.coffee, 3));
    c.rect(53, 12, 6, 6, at(P.terracotta, 3)); c.hline(53, 12, 6, at(P.terracotta, 4)); c.ball(55.5, 9, 3.4, 2.6, P.green);
    c.rect(2, 18, 60, 3, at(P.walnut, 3)); c.hline(2, 18, 60, at(P.walnut, 5)); c.hline(2, 20, 60, at(P.walnut, 1));
    for (const bx of [9, 53]) for (let k = 0; k < 6; k++) c.hline(bx, 21 + k, 6 - k, at(P.walnut, 2));
  },
  // balcão
  counter_left: (c) => counter(c, true, false),
  counter_mid: (c) => counter(c, false, false),
  counter_right: (c) => counter(c, false, true),
  counter_single: (c) => counter(c, true, true),
  counter_register: (c) => {
    counter(c, false, false);
    c.rect(8, 6, 17, 7, at(P.metal, 3)); c.hline(8, 6, 17, at(P.metal, 4)); c.vline(24, 6, 7, at(P.metal, 1));
    for (let ky = 0; ky < 2; ky++) for (let kx = 0; kx < 4; kx++) c.px(10 + kx * 3, 8 + ky * 2, at(P.cream, 5));
    c.rect(20, 7, 3, 4, at(P.wine, 3));
    c.rect(10, 1, 11, 5, at(P.teal, 2)); c.rect(11, 2, 9, 3, at(P.mint, 4)); c.hline(12, 3, 4, at(P.teal, 1));
  },
  coffee_machine: (c) => {
    c.rect(7, 6, 18, 21, at(P.metal, 3)); c.hline(7, 6, 18, at(P.metal, 5)); c.vline(7, 6, 21, at(P.metal, 4)); c.vline(24, 6, 21, at(P.metal, 1));
    c.rect(9, 3, 14, 3, at(P.porcelain, 3)); // xícaras em cima
    c.rect(9, 9, 14, 4, at(P.wine, 3)); c.hline(9, 9, 14, at(P.wine, 4)); c.ball(20, 11, 1.2, 1.2, P.butter);
    c.rect(13, 14, 6, 2, at(P.metal, 1)); c.rect(14, 16, 4, 2, at(P.metal, 2));
    c.rect(13, 20, 6, 4, at(P.porcelain, 3)); c.hline(13, 20, 6, at(P.coffee, 2));
    c.rect(8, 25, 16, 2, at(P.metal, 2)); c.line(23, 14, 25, 20, at(P.metal, 4));
  },
  display_case: (c) => {
    c.rect(1, 19, 62, 12, at(P.walnut, 3)); c.hline(1, 19, 62, at(P.walnut, 5)); c.hline(1, 30, 62, at(P.walnut, 1));
    for (const px of [4, 33]) { c.rect(px, 22, 27, 6, at(P.walnut, 2)); c.hline(px, 27, 27, at(P.walnut, 4)); }
    c.rect(2, 3, 60, 16, at(P.sky, 5)); c.rect(3, 4, 58, 14, at(P.cream, 5));
    c.hline(2, 3, 60, at(P.walnut, 4)); c.vline(2, 3, 16, at(P.walnut, 3)); c.vline(61, 3, 16, at(P.walnut, 2));
    c.hline(3, 11, 58, at(P.porcelain, 2));
    const cakes: Ramp[] = [P.rose, P.butter, P.coffee, P.mint, P.lilac, P.red, P.cream];
    for (let i = 0; i < 7; i++) { c.ball(8 + i * 8, 9, 3, 2, cakes[i % cakes.length]!); c.ball(8 + i * 8, 16, 3, 2, cakes[(i + 3) % cakes.length]!); }
    for (let k = 0; k < 8; k++) { c.px(12 + k, 17 - k * 2, at(P.porcelain, 4), 160); c.px(44 + k, 17 - k * 2, at(P.porcelain, 4), 160); }
  },
  // comidas e bebidas (centradas, fundo transparente)
  cake_whole: (c) => {
    plate(c, 16, 26, 12);
    c.rect(7, 15, 18, 10, at(P.rose, 4)); c.hline(7, 19, 18, at(P.cream, 5)); c.hline(7, 22, 18, at(P.rose, 3)); c.vline(24, 15, 10, at(P.rose, 2)); c.vline(7, 15, 10, at(P.rose, 5));
    c.ellipse(16, 15, 9, 3, at(P.cream, 5));
    for (const x of [11, 16, 21]) c.ball(x, 13, 1.8, 1.8, P.red);
  },
  cake_slice: (c) => {
    plate(c, 16, 26, 11);
    for (let i = 0; i < 12; i++) c.vline(9 + i, 15 + Math.floor(i / 3), 9 - Math.floor(i / 3), i < 6 ? at(P.butter, 4) : at(P.butter, 3));
    c.hline(9, 19, 12, at(P.rose, 3));
    for (let i = 0; i < 12; i++) c.px(9 + i, 14 + Math.floor(i / 3), at(P.cream, 5));
    c.ball(11, 12, 2, 2, P.red);
  },
  cupcake: (c) => {
    for (let y = 19; y < 28; y++) { const inset = Math.floor((y - 19) / 3); for (let x = 10 + inset; x < 22 - inset; x++) c.px(x, y, (x % 3 === 0) ? at(P.butter, 2) : at(P.butter, 3)); }
    c.ball(16, 17, 7, 4, P.rose); c.ball(16, 13, 5, 3.4, P.rose); c.ball(16, 10, 3, 2.2, P.rose);
    c.ball(16, 6, 1.8, 1.8, P.red);
  },
  macarons: (c) => {
    plate(c, 16, 26, 12);
    const m = (x: number, y: number, r: Ramp) => { c.ball(x, y - 2, 4, 1.8, r); c.hline(x - 3, y, 7, at(P.cream, 5)); c.ball(x, y + 1.5, 4, 1.6, r); };
    m(11, 23, P.rose); m(21, 23, P.mint); m(16, 17, P.lilac);
  },
  cookie_jar: (c) => {
    c.rect(8, 10, 16, 18, at(P.sky, 5)); c.rect(8, 10, 1, 18, at(P.porcelain, 4)); c.vline(23, 10, 18, at(P.sky, 3)); c.hline(8, 27, 16, at(P.sky, 3));
    const rnd = rng(16);
    for (let i = 0; i < 6; i++) c.ball(11 + rnd() * 10, 16 + rnd() * 9, 2.4, 2, P.pine);
    c.rect(7, 6, 18, 4, at(P.rose, 3)); c.hline(7, 6, 18, at(P.rose, 4)); c.rect(14, 3, 4, 3, at(P.rose, 2));
    c.line(10, 12, 10, 24, at(P.porcelain, 4));
  },
  latte: (c) => {
    plate(c, 16, 26, 10);
    c.rect(10, 15, 12, 10, at(P.porcelain, 3)); c.vline(10, 15, 10, at(P.porcelain, 4)); c.vline(21, 15, 10, at(P.porcelain, 1));
    c.ellipse(16, 15, 6, 2, at(P.coffee, 4)); c.px(15, 15, at(P.cream, 5)); c.px(17, 15, at(P.cream, 5)); c.px(16, 16, at(P.cream, 5));
    c.rect(22, 17, 3, 5, at(P.porcelain, 2)); c.rect(23, 18, 1, 3, at(P.porcelain, 0), 0); c.clear(23, 18); c.clear(23, 19); c.clear(23, 20);
    for (const [x, y] of [[14, 11], [15, 9], [14, 7], [18, 10], [19, 8]] as const) c.px(x, y, at(P.porcelain, 4), 170);
  },
  tea_cup: (c) => {
    plate(c, 16, 25, 11);
    c.ellipse(15, 21, 7, 3, at(P.rose, 4)); c.rect(8, 18, 14, 3, at(P.rose, 4)); c.ellipse(15, 18, 7, 2, at(P.porcelain, 4));
    c.ellipse(15, 18, 5.5, 1.4, at(P.butter, 2));
    c.ellipse(23, 19, 2, 2, at(P.rose, 3)); c.px(23, 19, at(P.rose, 4)); c.clear(23, 19);
  },
  teapot: (c) => {
    c.ball(15, 20, 9, 7, P.mint);
    c.line(6, 19, 3, 14, at(P.mint, 3)); c.line(5, 19, 2, 14, at(P.mint, 2));
    c.ellipse(24, 19, 3, 4, at(P.mint, 2)); c.ellipse(24, 19, 1.5, 2.5, at(P.mint, 0)); c.clear(24, 19); c.clear(24, 18); c.clear(24, 20);
    c.ellipse(15, 13, 5, 1.6, at(P.mint, 4)); c.ball(15, 11, 1.6, 1.4, P.rose);
    c.hline(9, 21, 12, at(P.rose, 4));
  },
  milkshake: (c) => {
    c.rect(11, 12, 10, 15, at(P.rose, 4)); c.vline(11, 12, 15, at(P.porcelain, 4)); c.vline(20, 12, 15, at(P.rose, 3)); c.rect(10, 27, 12, 2, at(P.porcelain, 2));
    c.ball(16, 10, 6, 3, P.cream); c.ball(15, 7, 3.6, 2.2, P.cream); c.ball(16, 4, 1.8, 1.8, P.red);
    c.line(19, 9, 23, 1, at(P.sky, 3)); c.line(20, 9, 24, 1, at(P.sky, 4));
  },
  croissant: (c) => {
    plate(c, 16, 26, 12);
    c.ball(16, 19, 5, 4, P.butter); c.ball(10, 21, 4, 3, P.butter); c.ball(22, 21, 4, 3, P.butter); c.ball(6, 23, 2.4, 2, P.butter); c.ball(26, 23, 2.4, 2, P.butter);
    for (const x of [13, 19]) c.vline(x, 16, 7, at(P.butter, 1));
  },
  fish_biscuits: (c) => {
    plate(c, 16, 26, 12);
    const fish = (x: number, y: number) => { c.ball(x, y, 3.4, 2, P.pine); c.px(x + 4, y - 1, at(P.pine, 2)); c.px(x + 4, y + 1, at(P.pine, 2)); c.px(x - 1, y - 1, at(P.coffee, 1)); };
    fish(10, 23); fish(18, 24); fish(14, 20); fish(21, 20);
  },
  cake_stand: (c) => {
    c.vline(16, 6, 22, at(P.gold, 3));
    plate(c, 16, 27, 12); plate(c, 16, 15, 8);
    c.ball(10, 24, 2.4, 2, P.rose); c.ball(16, 23.5, 2.4, 2, P.butter); c.ball(22, 24, 2.4, 2, P.mint);
    c.ball(13, 12.5, 2, 1.8, P.lilac); c.ball(19, 12.5, 2, 1.8, P.red);
    c.ball(16, 5, 1.6, 1.6, P.gold);
  },
  // móveis
  table_round: (c) => {
    c.ellipse(16, 15, 14, 7, at(P.oak, 1));
    c.ball(16, 13, 14, 7, P.oak, 0.15);
    c.ellipse(16, 12.5, 9, 4, at(P.oak, 4));
    c.rect(14, 20, 4, 8, at(P.walnut, 3)); c.vline(14, 20, 8, at(P.walnut, 4)); c.vline(17, 20, 8, at(P.walnut, 1));
    c.ellipse(16, 28, 7, 2, at(P.walnut, 2));
  },
  chair_front: (c) => {
    c.rect(8, 3, 16, 13, at(P.walnut, 3)); c.hline(8, 3, 16, at(P.walnut, 5));
    c.rect(10, 5, 12, 9, at(P.rose, 3)); c.hline(10, 5, 12, at(P.rose, 4)); c.px(16, 9, at(P.rose, 1));
    c.vline(10, 21, 6, at(P.walnut, 1)); c.vline(21, 21, 6, at(P.walnut, 1));
    c.ball(16, 18, 10, 3.4, P.rose);
    c.rect(6, 20, 20, 2, at(P.walnut, 3)); c.hline(6, 21, 20, at(P.walnut, 1));
    for (const lx of [7, 24]) { c.rect(lx, 22, 2, 8, at(P.walnut, 3)); c.vline(lx, 22, 8, at(P.walnut, 4)); }
  },
  chair_back: (c) => {
    c.ball(16, 17, 10, 3.4, P.rose);
    for (const lx of [7, 23]) { c.rect(lx, 2, 2, 28, at(P.walnut, 3)); c.vline(lx, 2, 28, at(P.walnut, 4)); }
    c.rect(7, 2, 18, 4, at(P.walnut, 3)); c.hline(7, 2, 18, at(P.walnut, 5)); c.hline(7, 5, 18, at(P.walnut, 1));
    for (const sx of [12, 16, 20]) { c.vline(sx, 6, 13, at(P.walnut, 3)); c.vline(sx - 1, 6, 13, at(P.walnut, 4)); }
    c.rect(7, 19, 18, 2, at(P.walnut, 2));
    for (const lx of [10, 21]) c.vline(lx, 21, 7, at(P.walnut, 1));
  },
  chair_left: (c) => chairSide(c),
  chair_right: (c) => { chairSide(c); c.mirror(); },
  sofa: (c) => {
    c.rect(5, 5, 54, 13, at(P.teal, 2));
    for (const bx of [6, 32]) {
      c.ball(bx + 13, 11, 13, 6, P.teal);
      for (const tx of [bx + 7, bx + 13, bx + 19]) c.px(tx, 10, at(P.teal, 0));
    }
    c.rect(6, 17, 52, 7, at(P.teal, 3)); c.hline(6, 17, 52, at(P.teal, 4)); c.vline(32, 17, 7, at(P.teal, 1));
    c.rect(6, 24, 52, 4, at(P.teal, 1));
    for (const ax of [1, 55]) { c.rect(ax, 12, 8, 16, at(P.teal, 3)); c.ball(ax + 4, 12, 4, 3, P.teal); c.vline(ax, 12, 16, at(P.teal, 4)); c.vline(ax + 7, 12, 16, at(P.teal, 1)); }
    for (const lx of [4, 57]) c.rect(lx, 28, 3, 3, at(P.walnut, 2));
  },
  bookshelf: (c) => {
    const L = 1, R = 30;
    c.rect(L + 1, 1, R - L - 1, 1, at(P.walnut, 4));
    c.rect(L, 2, R - L + 1, 4, at(P.walnut, 4)); c.hline(L, 6, R - L + 1, at(P.walnut, 5));
    for (let x = L + 2; x < R - 1; x += 7) c.px(x, 3, at(P.walnut, 5));
    c.rect(L, 7, 3, 55, at(P.walnut, 4)); c.vline(L, 7, 55, at(P.walnut, 5));
    c.rect(R - 2, 7, 3, 55, at(P.walnut, 3)); c.vline(R, 7, 55, at(P.walnut, 2));
    c.rect(L + 3, 7, R - L - 5, 2, at(P.walnut, 3));
    [9, 23, 37].forEach((sy, i) => {
      c.rect(L + 3, sy, R - L - 5, 12, at(P.wine, 0)); c.rect(L + 3, sy, R - L - 5, 2, at(P.walnut, 0)); c.vline(R - 3, sy, 12, at(P.walnut, 0));
      books(c, L + 4, R - 4, sy + 11, 20 + i);
      c.hline(L + 3, sy + 12, R - L - 5, at(P.walnut, 5)); c.hline(L + 3, sy + 13, R - L - 5, at(P.walnut, 3));
    });
    c.rect(L + 3, 51, R - L - 5, 10, at(P.walnut, 3)); c.hline(L + 3, 51, R - L - 5, at(P.walnut, 5));
    c.rect(L + 5, 53, R - L - 9, 6, at(P.walnut, 4)); c.hline(L + 5, 58, R - L - 9, at(P.walnut, 2)); c.vline(R - 5, 53, 6, at(P.walnut, 2));
    c.rect(15, 55, 2, 1, at(P.gold, 4)); c.hline(L, 61, R - L + 1, at(P.walnut, 2));
  },
  cat_tree: (c) => {
    c.rect(2, 87, 60, 7, at(P.pine, 2)); c.rect(2, 86, 60, 3, at(P.rose, 3)); c.hline(2, 86, 60, at(P.rose, 4));
    sisal(c, 14, 42, 6, 45); sisal(c, 44, 10, 6, 52);
    const plat = (x: number, y: number, w: number, r: Ramp) => { c.rect(x, y, w, 3, at(r, 4)); c.hline(x, y, w, at(r, 5)); c.rect(x, y + 3, w, 3, at(r, 2)); c.hline(x, y + 5, w, at(r, 1)); };
    plat(3, 38, 28, P.lilac); plat(3, 58, 28, P.lilac); plat(33, 6, 29, P.lilac);
    c.ball(47, 4, 9, 3, P.cream);
    c.vline(26, 44, 8, at(P.cream, 2)); c.ball(26, 54, 2.4, 2.4, P.red);
    // casinha
    c.rect(33, 62, 29, 25, at(P.lilac, 3)); c.hline(33, 62, 29, at(P.lilac, 5)); c.rect(33, 60, 29, 3, at(P.lilac, 4));
    c.vline(33, 62, 25, at(P.lilac, 4)); c.vline(61, 62, 25, at(P.lilac, 1));
    c.ellipse(47, 75, 7, 8, at(P.lilac, 0)); c.ellipse(46, 74, 5.5, 6.5, at(P.wine, 0));
    c.speckle(34, 63, 27, 23, at(P.lilac, 2), 0.02, rng(17));
  },
  cat_condo: (c) => {
    const box = (x: number, y: number, w: number, h: number, holeX: number) => {
      c.rect(x, y, w, h, at(P.rose, 3)); c.hline(x, y, w, at(P.rose, 5)); c.vline(x, y, h, at(P.rose, 4)); c.vline(x + w - 1, y, h, at(P.rose, 1)); c.hline(x, y + h - 1, w, at(P.rose, 1));
      c.speckle(x + 1, y + 1, w - 2, h - 2, at(P.rose, 2), 0.02, rng(x + y));
      c.ellipse(holeX, y + h / 2 + 1, 7, 8, at(P.rose, 0)); c.ellipse(holeX - 1, y + h / 2, 5.5, 6.5, at(P.wine, 0));
    };
    box(2, 31, 60, 31, 18); box(6, 8, 52, 24, 44);
    c.ball(32, 6, 22, 3.4, P.cream);
    c.vline(52, 34, 10, at(P.cream, 2)); c.ball(52, 46, 2.2, 2.2, P.butter);
  },
  scratch_post: (c) => {
    c.rect(5, 25, 22, 5, at(P.pine, 2)); c.rect(5, 24, 22, 3, at(P.mint, 3)); c.hline(5, 24, 22, at(P.mint, 4));
    sisal(c, 13, 8, 6, 16);
    c.rect(8, 5, 16, 3, at(P.mint, 4)); c.hline(8, 5, 16, at(P.mint, 5)); c.hline(8, 7, 16, at(P.mint, 2));
    c.vline(22, 8, 9, at(P.cream, 2)); c.ball(22, 19, 2.2, 2.2, P.butter);
  },
  cushion_pink: cushion(P.rose),
  cushion_mint: cushion(P.mint),
  cushion_sky: cushion(P.sky),
  cushion_lav: cushion(P.lilac),
  cushion_butter: cushion(P.butter),
  cat_bed: (c) => {
    c.ball(16, 21, 14, 8, P.wine, 0.1);
    c.ellipse(16, 21, 10, 5, at(P.wine, 1));
    c.ball(16, 22, 9.5, 4.5, P.cream);
    c.hline(10, 15, 10, at(P.rose, 4));
  },
  food_bowl: (c) => bowl(c, P.coffee, P.rose, true),
  water_bowl: (c) => bowl(c, P.sky, P.mint, false),
  yarn_balls: (c) => {
    const yarn = (x: number, y: number, r: number, ramp: Ramp) => {
      c.ball(x, y, r, r, ramp);
      for (let k = -r + 2; k < r - 1; k += 3) c.line(x - r + 2, y + k, x + r - 2, y + k - 2, darker(ramp, 1));
    };
    yarn(11, 22, 6, P.rose); yarn(21, 23, 5, P.butter); yarn(16, 15, 5, P.sky);
    c.line(25, 25, 29, 28, at(P.rose, 3)); c.line(29, 28, 30, 27, at(P.rose, 3));
  },
  plant_pot: (c) => {
    leaves(c, 16, 12, 8, 6, 14, 18);
    c.rect(9, 19, 14, 3, at(P.terracotta, 4)); c.hline(9, 19, 14, at(P.terracotta, 5));
    for (let y = 22; y < 30; y++) { const inset = Math.floor((y - 22) / 3); c.hline(10 + inset, y, 12 - 2 * inset, at(P.terracotta, 3)); c.px(21 - inset, y, at(P.terracotta, 1)); c.px(10 + inset, y, at(P.terracotta, 4)); }
  },
  plant_tall: (c) => {
    for (const [x0, x1] of [[16, 10], [16, 22], [16, 15], [15, 20]] as const) c.line(x0, 50, x1, 14, at(P.green, 1));
    leaves(c, 16, 22, 10, 14, 26, 19);
    leaves(c, 16, 38, 8, 6, 8, 20);
    c.rect(9, 49, 14, 3, at(P.cream, 5)); c.rect(10, 52, 12, 10, at(P.cream, 4)); c.vline(10, 52, 10, at(P.cream, 5)); c.vline(21, 52, 10, at(P.cream, 2)); c.hline(10, 56, 12, at(P.wine, 3));
  },
  plant_hanging: (c) => {
    c.line(16, 0, 9, 11, at(P.cream, 2)); c.line(16, 0, 23, 11, at(P.cream, 2));
    c.ball(16, 14, 8, 5, P.rose);
    leaves(c, 16, 10, 8, 2, 8, 21);
    for (const [x, len] of [[9, 12], [14, 16], [21, 10], [24, 14]] as const) for (let k = 0; k < len; k += 3) c.ball(x + (k % 6 ? 1 : 0), 18 + k, 1.8, 1.4, P.green);
  },
  cactus: (c) => {
    c.ball(16, 14, 4.6, 9, P.green); c.ball(10, 15, 2.4, 4, P.green); c.ball(22, 13, 2.4, 4, P.green);
    for (const [x, y] of [[14, 9], [17, 12], [15, 16], [18, 19], [10, 14], [22, 12]] as const) c.px(x, y, at(P.cream, 5));
    c.ball(16, 5, 2.2, 1.8, P.rose);
    c.rect(10, 22, 12, 3, at(P.butter, 4)); c.rect(11, 25, 10, 5, at(P.butter, 3)); c.vline(20, 25, 5, at(P.butter, 1));
  },
  flower_vase: (c) => {
    for (const [x0, x1] of [[16, 10], [16, 16], [16, 22]] as const) c.line(x0, 19, x1, 9, at(P.green, 2));
    leaves(c, 16, 15, 6, 2, 4, 22);
    c.ball(10, 8, 3, 3, P.rose); c.ball(16, 6, 3, 3, P.butter); c.ball(22, 8, 3, 3, P.lilac);
    for (const [x, y] of [[10, 8], [16, 6], [22, 8]] as const) c.px(x, y, at(P.gold, 4));
    c.ball(16, 23, 6, 6, P.sky); c.rect(14, 16, 5, 3, at(P.sky, 3)); c.hline(14, 16, 5, at(P.sky, 5));
  },
};

/** Peças opacas que emendam com a vizinha: sem contorno externo. */
const NO_OUTLINE = new Set(['floor_wood_a', 'floor_wood_b', 'floor_check_pink', 'floor_tile_mint', 'wall_stripe_pink', 'wall_dots_cream', 'wall_mint', 'wall_wainscot']);

const catalog = readCatalog('data/tiles.csv');
const sheet = new Sheet(8, 11);
const missing: string[] = [];
for (const [name, pos] of catalog) {
  const draw = pieces[name];
  if (!draw) { missing.push(name); continue; }
  const c = new Canvas(pos.w * 32, pos.h * 32);
  draw(c);
  if (!NO_OUTLINE.has(name)) c.outline();
  sheet.put(c, pos.col, pos.row);
}
if (missing.length) {
  console.error(`✗ peças sem desenho: ${missing.join(', ')}`);
  process.exit(1);
}
writeWithBackup(sheet.canvas, OUT);
const i = process.argv.indexOf('--preview');
if (i > 0 && process.argv[i + 1]) preview(sheet.canvas, 3, process.argv[i + 1]!);
console.log(`✓ ${OUT}: ${catalog.size} peças no estilo novo`);

export type { RGB };
void hex;
