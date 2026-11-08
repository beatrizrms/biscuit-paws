// Primitivas de desenho para a arte gerada por código (estilo novo, decisão 047).
// Tudo em pixels inteiros; luz de cima à esquerda; contorno externo com LINE no final de cada peça.
import { existsSync, mkdirSync, readFileSync, writeFileSync, copyFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { PNG } from 'pngjs';
import { LINE, type Ramp, type RGB } from './palette';

export class Canvas {
  readonly data: Uint8Array;
  constructor(
    readonly w: number,
    readonly h: number,
  ) {
    this.data = new Uint8Array(w * h * 4);
  }

  inside(x: number, y: number): boolean {
    return x >= 0 && y >= 0 && x < this.w && y < this.h;
  }
  opaque(x: number, y: number): boolean {
    return this.inside(x, y) && this.data[(y * this.w + x) * 4 + 3]! > 0;
  }
  get(x: number, y: number): RGB | null {
    if (!this.opaque(x, y)) return null;
    const i = (y * this.w + x) * 4;
    return [this.data[i]!, this.data[i + 1]!, this.data[i + 2]!];
  }
  /** Pinta um pixel (alpha 0..255; abaixo de 255 mistura com o que já está). */
  px(x: number, y: number, c: RGB, a = 255): void {
    x = Math.round(x);
    y = Math.round(y);
    if (!this.inside(x, y)) return;
    const i = (y * this.w + x) * 4;
    if (a >= 255 || this.data[i + 3] === 0) {
      this.data[i] = c[0];
      this.data[i + 1] = c[1];
      this.data[i + 2] = c[2];
      this.data[i + 3] = a >= 255 ? 255 : Math.max(this.data[i + 3]!, a);
      return;
    }
    const k = a / 255;
    for (let q = 0; q < 3; q++) this.data[i + q] = Math.round(c[q]! * k + this.data[i + q]! * (1 - k));
  }
  clear(x: number, y: number): void {
    if (this.inside(x, y)) this.data[(y * this.w + x) * 4 + 3] = 0;
  }
  rect(x: number, y: number, w: number, h: number, c: RGB, a = 255): void {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.px(x + i, y + j, c, a);
  }
  hline(x: number, y: number, len: number, c: RGB): void {
    this.rect(x, y, len, 1, c);
  }
  vline(x: number, y: number, len: number, c: RGB): void {
    this.rect(x, y, 1, len, c);
  }
  line(x0: number, y0: number, x1: number, y1: number, c: RGB): void {
    const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    for (;;) {
      this.px(x0, y0, c);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) { err += dy; x0 += sx; }
      if (e2 <= dx) { err += dx; y0 += sy; }
    }
  }
  /** Elipse cheia (teste no centro do pixel). */
  ellipse(cx: number, cy: number, rx: number, ry: number, c: RGB): void {
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++)
      for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++)
        if (((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2 <= 1) this.px(x, y, c);
  }
  /** Elipse sombreada como volume: clara em cima à esquerda, escura embaixo à direita. */
  ball(cx: number, cy: number, rx: number, ry: number, r: Ramp, bias = 0): void {
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++)
      for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
        const nx = (x + 0.5 - cx) / rx, ny = (y + 0.5 - cy) / ry;
        const d = nx * nx + ny * ny;
        if (d > 1) continue;
        const light = 0.55 - 0.38 * nx - 0.5 * ny - 0.25 * d + bias;
        this.px(x, y, pick(r, light));
      }
  }
  /** Caixa de frente com espessura: face da frente com luz na esquerda e sombra na direita. */
  front(x: number, y: number, w: number, h: number, r: Ramp, edges = true): void {
    this.rect(x, y, w, h, mid(r));
    if (!edges) return;
    this.rect(x, y, 1, h, lighter(r, 1));
    this.rect(x + w - 1, y, 1, h, darker(r, 1));
    this.rect(x, y, w, 1, lighter(r, 2));
  }
  /** Tampo visto de cima (faixa clara) com quina iluminada embaixo. */
  top(x: number, y: number, w: number, h: number, r: Ramp): void {
    this.rect(x, y, w, h, lighter(r, 1));
    this.rect(x, y, w, 1, mid(r));
    this.rect(x, y + h - 1, w, 1, lighter(r, 2));
  }
  /** Mancha de pontinhos com semente (textura de madeira, tecido, terra). */
  speckle(x: number, y: number, w: number, h: number, c: RGB, density: number, rnd: () => number): void {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) if (rnd() < density && this.opaque(x + i, y + j)) this.px(x + i, y + j, c);
  }
  /** Escurece (ou clareia com f < 0) a área já pintada, puxando para um tom quente. */
  shade(x: number, y: number, w: number, h: number, f: number): void {
    for (let j = 0; j < h; j++)
      for (let i = 0; i < w; i++) {
        const c = this.get(x + i, y + j);
        if (!c) continue;
        const t = f > 0 ? ([46, 26, 34] as const) : ([255, 244, 220] as const);
        const k = Math.abs(f);
        this.px(x + i, y + j, [c[0] * (1 - k) + t[0] * k, c[1] * (1 - k) + t[1] * k, c[2] * (1 - k) + t[2] * k].map(Math.round) as unknown as RGB);
      }
  }
  /** Contorno externo: todo pixel transparente vizinho (4 lados) de um opaco vira LINE. */
  outline(c: RGB = LINE): this {
    const edge: [number, number][] = [];
    for (let y = 0; y < this.h; y++)
      for (let x = 0; x < this.w; x++)
        if (!this.opaque(x, y) && (this.opaque(x - 1, y) || this.opaque(x + 1, y) || this.opaque(x, y - 1) || this.opaque(x, y + 1))) edge.push([x, y]);
    for (const [x, y] of edge) this.px(x, y, c);
    return this;
  }
  /** Espelha na horizontal (versão virada para o outro lado). */
  mirror(): this {
    for (let y = 0; y < this.h; y++)
      for (let x = 0; x < this.w >> 1; x++) {
        const a = (y * this.w + x) * 4, b = (y * this.w + this.w - 1 - x) * 4;
        for (let k = 0; k < 4; k++) { const t = this.data[a + k]!; this.data[a + k] = this.data[b + k]!; this.data[b + k] = t; }
      }
    return this;
  }
  blit(src: Canvas, dx: number, dy: number): void {
    for (let y = 0; y < src.h; y++)
      for (let x = 0; x < src.w; x++) {
        const i = (y * src.w + x) * 4;
        const a = src.data[i + 3]!;
        if (a) this.px(dx + x, dy + y, [src.data[i]!, src.data[i + 1]!, src.data[i + 2]!], a);
      }
  }
  toPng(): PNG {
    const png = new PNG({ width: this.w, height: this.h });
    Buffer.from(this.data.buffer).copy(png.data);
    return png;
  }
}

export const mid = (r: Ramp): RGB => r[Math.floor((r.length - 1) / 2)]!;
export const lighter = (r: Ramp, n: number): RGB => r[Math.min(r.length - 1, Math.floor((r.length - 1) / 2) + n)]!;
export const darker = (r: Ramp, n: number): RGB => r[Math.max(0, Math.floor((r.length - 1) / 2) - n)]!;
/** Escolhe o tom da rampa por uma luz de 0 (sombra) a 1 (brilho). */
export const pick = (r: Ramp, light: number): RGB => r[Math.max(0, Math.min(r.length - 1, Math.floor(light * r.length)))]!;
export const at = (r: Ramp, i: number): RGB => r[Math.max(0, Math.min(r.length - 1, i < 0 ? r.length + i : i))]!;

/** Gerador com semente (LCG), para a arte sair igual toda vez. */
export function rng(seed: number): () => number {
  let s = seed >>> 0 || 1;
  return () => ((s = (Math.imul(s, 1103515245) + 12345) >>> 0) / 4294967296);
}

/** Folha de tiles: cola peças (em blocos de 32) nas posições do catálogo. */
export class Sheet {
  readonly canvas: Canvas;
  constructor(
    readonly cols: number,
    readonly rows: number,
    readonly tile = 32,
  ) {
    this.canvas = new Canvas(cols * tile, rows * tile);
  }
  put(piece: Canvas, col: number, row: number): void {
    this.canvas.blit(piece, col * this.tile, row * this.tile);
  }
}

/** Grava a folha; na primeira vez, guarda a versão antiga em assets/_estilo_antigo/ (para voltar atrás). */
export function writeWithBackup(c: Canvas, out: string): void {
  const backup = out.replace(/^public\/assets\//, 'assets/_estilo_antigo/');
  if (existsSync(out) && !existsSync(backup)) {
    mkdirSync(dirname(backup), { recursive: true });
    copyFileSync(out, backup);
    console.log(`  backup: ${backup}`);
  }
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, PNG.sync.write(c.toPng()));
}

/** Lê o catálogo name,col,row,w,h de um CSV de tiles. */
export function readCatalog(csv: string): Map<string, { col: number; row: number; w: number; h: number }> {
  const out = new Map<string, { col: number; row: number; w: number; h: number }>();
  for (const line of readFileSync(csv, 'utf8').trim().split(/\r?\n/).slice(1)) {
    const [name, col, row, w, h] = line.split(',');
    out.set(name!, { col: Number(col), row: Number(row), w: Number(w), h: Number(h) });
  }
  return out;
}

/** Prancha ampliada (vizinho mais próximo) para conferir. */
export function preview(c: Canvas, scale: number, out: string): void {
  const big = new Canvas(c.w * scale, c.h * scale);
  for (let y = 0; y < big.h; y++)
    for (let x = 0; x < big.w; x++) {
      const checker = ((x >> 4) + (y >> 4)) & 1 ? 150 : 132;
      big.px(x, y, [checker, checker - 4, checker + 6]);
    }
  for (let y = 0; y < c.h; y++)
    for (let x = 0; x < c.w; x++) {
      const i = (y * c.w + x) * 4;
      const a = c.data[i + 3]!;
      if (a) for (let j = 0; j < scale; j++) for (let k = 0; k < scale; k++) big.px(x * scale + k, y * scale + j, [c.data[i]!, c.data[i + 1]!, c.data[i + 2]!], a);
    }
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, PNG.sync.write(big.toPng()));
}
