// npx tsx scripts/import-backyard.ts (npm run backyard): prepara a arte dos cômodos da expansão.
// - Quintal secreto (sebe): copia a folha do pacote e escreve o JSON de peças.
// - Provisórios dos cômodos (parede divisória, portas, cama, folhas secas, módulos do playground),
//   desenhados por código até a arte chegar (lista em docs/ART_AND_LICENSE.md).
// Os originais ficam em assets/_originais_pacotes (fora do Git); as folhas vão para public/assets (fora do Git).
import { copyFileSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { PNG } from 'pngjs';

const PACK = 'assets/_originais_pacotes/quintal_secreto/pack/quintal_secreto';
const ENV = 'public/assets/env/backyard';
const INTERIOR = 'public/assets/interiors/cafe';
const TS = 32;
mkdirSync(ENV, { recursive: true });
mkdirSync(INTERIOR, { recursive: true });

type Pieces = Record<string, { col: number; row: number; w_tiles: number; h_tiles: number }>;
const writePieces = (file: string, columns: number, rows: number, pieces: Pieces) =>
  writeFileSync(`data/tilesets/${file}`, JSON.stringify({ tileSize: TS, columns, rows, pieces }, null, 1) + '\n');

// ---------- Variante A: sebe ----------
{
  const json = JSON.parse(readFileSync(`${PACK}/quintal_secreto_tileset.json`, 'utf8')) as { columns: number; pieces: Pieces };
  const png = PNG.sync.read(readFileSync(`${PACK}/quintal_secreto_tileset.png`));
  copyFileSync(`${PACK}/quintal_secreto_tileset.png`, `${ENV}/tile_backyard_hedge.png`);
  writePieces('quintal_sebe.json', json.columns, png.height / TS, json.pieces);
}

/** Copia `src` para `dst` na posição (x, y) em pixels. */
function blit(dst: PNG, src: PNG, x: number, y: number): void {
  for (let j = 0; j < src.height; j++) {
    for (let i = 0; i < src.width; i++) {
      const s = (j * src.width + i) * 4;
      const d = ((y + j) * dst.width + x + i) * 4;
      for (let k = 0; k < 4; k++) dst.data[d + k] = src.data[s + k]!;
    }
  }
}

/** Junta imagens (múltiplos de 32) numa folha de `columns` tiles, em prateleiras. */
function pack(images: { name: string; png: PNG }[], columns: number): { sheet: PNG; pieces: Pieces; rows: number } {
  const pieces: Pieces = {};
  let col = 0;
  let row = 0;
  let shelf = 0;
  for (const { name, png } of images) {
    const w = Math.ceil(png.width / TS);
    const h = Math.ceil(png.height / TS);
    if (col + w > columns) {
      col = 0;
      row += shelf;
      shelf = 0;
    }
    pieces[name] = { col, row, w_tiles: w, h_tiles: h };
    col += w;
    shelf = Math.max(shelf, h);
  }
  const rows = row + shelf;
  const sheet = new PNG({ width: columns * TS, height: rows * TS });
  for (const { name, png } of images) blit(sheet, png, pieces[name]!.col * TS, pieces[name]!.row * TS);
  return { sheet, pieces, rows };
}

// ---------- Provisórios (desenhados por código, paleta Cosy) ----------
type RGBA = [number, number, number, number];
const hex = (h: string, a = 255): RGBA => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16), a];
const C = {
  ink: hex('#3b2a22'),
  wood: hex('#8b5e3c'),
  woodLight: hex('#b9845a'),
  woodDark: hex('#5e3b26'),
  wall: hex('#6e4a36'),
  wallLight: hex('#87604a'),
  metal: hex('#c9b27a'),
  metalDark: hex('#8d7a4a'),
  cream: hex('#f3e3c6'),
  pink: hex('#e48aa0'),
  sky: hex('#9fc7e8'),
  leaf: hex('#b0763a'),
  leafDark: hex('#7d5126'),
  weed: hex('#6f9a4a'),
  weedDark: hex('#4a6e33'),
  orange: hex('#e98a3c'),
  orangeDark: hex('#b8622a'),
  blue: hex('#7fa7d6'),
  blueDark: hex('#4f74a3'),
  sun: hex('#f5d77a'),
};

function canvas(wTiles: number, hTiles: number): PNG {
  return new PNG({ width: wTiles * TS, height: hTiles * TS });
}
function rect(p: PNG, x: number, y: number, w: number, h: number, c: RGBA): void {
  for (let j = y; j < y + h; j++) {
    for (let i = x; i < x + w; i++) {
      if (i < 0 || j < 0 || i >= p.width || j >= p.height) continue;
      const o = (j * p.width + i) * 4;
      [p.data[o], p.data[o + 1], p.data[o + 2], p.data[o + 3]] = c;
    }
  }
}
/** Retângulo com contorno escuro (estilo do pacote). */
function box(p: PNG, x: number, y: number, w: number, h: number, fill: RGBA, line = C.ink): void {
  rect(p, x, y, w, h, line);
  rect(p, x + 1, y + 1, w - 2, h - 2, fill);
}
function ellipse(p: PNG, cx: number, cy: number, rx: number, ry: number, fill: RGBA, line = C.ink): void {
  for (let j = -ry - 1; j <= ry + 1; j++) {
    for (let i = -rx - 1; i <= rx + 1; i++) {
      const d = (i * i) / (rx * rx) + (j * j) / (ry * ry);
      const dOut = (i * i) / ((rx + 1) * (rx + 1)) + (j * j) / ((ry + 1) * (ry + 1));
      if (d <= 1) rect(p, cx + i, cy + j, 1, 1, fill);
      else if (dOut <= 1) rect(p, cx + i, cy + j, 1, 1, line);
    }
  }
}

const placeholders: { name: string; png: PNG }[] = [];
const add = (name: string, png: PNG) => placeholders.push({ name, png });

// Parede divisória entre cômodos (vista de frente: uma faixa de parede de lado).
{
  const p = canvas(1, 1);
  rect(p, 0, 0, 32, 32, C.wall);
  rect(p, 4, 0, 24, 32, C.wallLight);
  rect(p, 0, 0, 2, 32, C.ink);
  rect(p, 30, 0, 2, 32, C.ink);
  for (let y = 6; y < 32; y += 10) rect(p, 6, y, 20, 1, C.wall);
  add('parede_divisoria', p);
}
// Porta fechada, porta com cadeado (1x1, no vão da parede).
for (const padlock of [false, true]) {
  const p = canvas(1, 1);
  rect(p, 0, 0, 32, 32, C.wall);
  box(p, 4, 1, 24, 31, C.wood);
  rect(p, 8, 5, 16, 10, C.woodLight);
  rect(p, 8, 18, 16, 10, C.woodLight);
  rect(p, 22, 16, 3, 3, C.metal);
  if (padlock) {
    box(p, 11, 12, 10, 9, C.metal);
    rect(p, 13, 8, 6, 2, C.metalDark);
    rect(p, 13, 9, 1, 4, C.metalDark);
    rect(p, 18, 9, 1, 4, C.metalDark);
    rect(p, 15, 15, 2, 3, C.ink);
  }
  add(padlock ? 'porta_cadeado' : 'porta_fechada', p);
}
// Cama do quartinho (2x1).
{
  const p = canvas(2, 1);
  box(p, 1, 8, 62, 22, C.woodDark);
  box(p, 3, 10, 58, 14, C.cream);
  box(p, 4, 11, 14, 10, hex('#ffffff'));
  rect(p, 20, 12, 40, 11, C.pink);
  rect(p, 3, 26, 3, 6, C.ink);
  rect(p, 58, 26, 3, 6, C.ink);
  add('cama_quartinho', p);
}
// Sujeira do quintal abandonado: folhas secas e mato.
{
  const p = canvas(1, 1);
  for (const [x, y] of [[5, 8], [16, 5], [24, 14], [9, 20], [20, 24], [27, 26]] as const) ellipse(p, x, y, 3, 2, x % 2 ? C.leaf : C.leafDark, C.leafDark);
  add('folhas_secas', p);
}
{
  const p = canvas(1, 1);
  for (let x = 3; x < 30; x += 4) rect(p, x, 14 + (x % 7), 2, 18 - (x % 7), x % 8 ? C.weed : C.weedDark);
  add('mato', p);
}
// Módulos do playground (provisórios).
{
  const p = canvas(2, 1); // túnel
  box(p, 2, 10, 60, 20, C.orange);
  for (let x = 8; x < 60; x += 8) rect(p, x, 11, 2, 18, C.orangeDark);
  ellipse(p, 6, 20, 4, 8, C.ink, C.orangeDark);
  add('tunel', p);
}
{
  const p = canvas(1, 1); // casinha
  box(p, 4, 12, 24, 20, C.blue);
  for (let i = 0; i < 12; i++) rect(p, 4 + i, 12 - i, 24 - 2 * i, 1, C.pink);
  ellipse(p, 16, 25, 5, 6, C.ink, C.blueDark);
  add('casinha', p);
}
{
  const p = canvas(2, 1); // tora
  box(p, 2, 14, 56, 16, C.woodLight);
  for (let x = 8; x < 54; x += 9) rect(p, x, 18, 6, 1, C.woodDark);
  ellipse(p, 57, 22, 5, 8, C.cream, C.woodDark);
  ellipse(p, 57, 22, 2, 4, C.woodLight, C.woodLight);
  add('tora', p);
}
{
  const p = canvas(1, 1); // cama ao sol
  ellipse(p, 16, 22, 13, 7, C.sun, C.metalDark);
  ellipse(p, 16, 21, 9, 4, C.cream, C.cream);
  add('cama_ao_sol', p);
}
{
  const { sheet, pieces, rows } = pack(placeholders, 8);
  writeFileSync(`${INTERIOR}/tile_rooms_placeholder.png`, PNG.sync.write(sheet));
  writePieces('comodos_provisorio.json', 8, rows, pieces);
}
console.log('✓ quintal (sebe e tijolo) e provisórios dos cômodos');
