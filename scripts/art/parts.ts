// Peças e ajudantes de desenho reaproveitados entre as folhas (estilo novo, decisão 051).
import { Canvas, at, darker, lighter, mid, rng } from './lib';
import { P, type Ramp, type RGB } from './palette';

export type Draw = (c: Canvas) => void;

/** Tábuas horizontais que emendam sem costura (duas juntas por fileira, a cada 16 px). */
export function planks(c: Canvas, r: Ramp, rowH: number, joints: number[], seed: number): void {
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

export function plate(c: Canvas, cx: number, cy: number, rx: number): void {
  c.ellipse(cx, cy + 1, rx, 3, at(P.porcelain, 1));
  c.ellipse(cx, cy, rx, 3, at(P.porcelain, 3));
  c.ellipse(cx, cy - 0.5, rx - 3, 1.6, at(P.porcelain, 4));
}

export function sisal(c: Canvas, x: number, y: number, w: number, h: number): void {
  for (let j = 0; j < h; j++) {
    const band = Math.floor(j / 2) % 2 ? at(P.pine, 3) : at(P.pine, 2);
    c.hline(x, y + j, w, band);
  }
  c.vline(x, y, h, at(P.pine, 4));
  c.vline(x + w - 1, y, h, at(P.pine, 1));
}

export function leaves(c: Canvas, cx: number, cy: number, sx: number, sy: number, n: number, seed: number, r: Ramp = P.green): void {
  const rnd = rng(seed);
  const pts = Array.from({ length: n }, () => [cx + (rnd() - 0.5) * 2 * sx, cy + (rnd() - 0.5) * 2 * sy] as const).sort((a, b) => a[1] - b[1]);
  for (const [x, y] of pts) c.ball(x, y, 3.2, 2.4, r);
}

/** Lombadas de livros apoiadas numa base (com pilha deitada e vasinho de vez em quando). */
export const BOOKS: Ramp[] = [P.red, P.navy, P.butter, P.teal, P.cream, P.lilac, P.terracotta];
export function books(c: Canvas, x0: number, x1: number, floor: number, seed: number): void {
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
export function counter(c: Canvas, left: boolean, right: boolean): void {
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
export function chairSide(c: Canvas): void {
  c.rect(20, 3, 3, 27, at(P.walnut, 3)); c.vline(20, 3, 27, at(P.walnut, 4)); c.vline(22, 3, 27, at(P.walnut, 1));
  c.rect(18, 3, 5, 2, at(P.walnut, 4)); c.hline(18, 3, 5, at(P.walnut, 5));
  c.rect(17, 6, 3, 10, at(P.rose, 3)); c.vline(17, 6, 10, at(P.rose, 4)); c.hline(17, 15, 3, at(P.rose, 2));
  c.ball(14, 17, 8, 2.6, P.rose);
  c.rect(6, 19, 17, 2, at(P.walnut, 3)); c.hline(6, 20, 17, at(P.walnut, 1));
  c.rect(7, 21, 2, 9, at(P.walnut, 3)); c.vline(7, 21, 9, at(P.walnut, 4));
  c.line(10, 21, 19, 21, at(P.walnut, 2));
}

export function cushion(r: Ramp): Draw {
  return (c) => {
    c.ellipse(16, 23, 13, 6, at(r, 1)); // lateral (espessura)
    c.ball(16, 20, 13, 6, r, 0.15); // tampo fofo
    c.ellipse(16, 20, 8, 3, lighter(r, 1));
    c.ellipse(13, 18.5, 4, 1.2, lighter(r, 2));
    c.px(16, 20, at(r, 1)); c.px(15, 20, darker(r, 1)); // botão do capitonê
  };
}

export function bowl(c: Canvas, inner: Ramp, outer: Ramp, kibble: boolean): void {
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
