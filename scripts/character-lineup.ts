// npx tsx scripts/character-lineup.ts (npm run lineup): todos os personagens lado a lado, alinhados pelos pés e
// ampliados 2x, com linhas-guia a cada 16 px de figura (docs/GUIA_DE_ESTILO.md, seção 2). Serve para conferir a
// proporção da cabeça de um personagem novo contra as referências antes de aprovar. As referências saem com uma
// faixa verde embaixo. Grava assets/_lineup/lineup.png (fora do Git).
// Uso: npm run lineup [-- npc.gabi npc.builder ...] (sem ids: todos os personagens de 2 tiles, mais a protagonista).
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { PNG } from 'pngjs';
import type { CharacterData } from '../src/core/appearance';

/** As referências de proporção escolhidas pela Beatriz (novembro de 2026). */
const REFERENCES = ['npc.builder', 'npc.fernanda', 'npc.customer_01', 'npc.customer_03', 'npc.customer_04', 'npc.customer_09', 'npc.customer_10'];
const ZOOM = 2;
const CELL_W = 112;
const CELL_H = 136;
const COLS = 7;
const FLOOR = 128;
const BG = [214, 196, 168];
const GUIDE = [190, 170, 140];
const MARK = [111, 143, 58];

interface NpcDef { id: string; sheet: string; frameWidth: number; frameHeight: number }

const npcs = (JSON.parse(readFileSync('data/npcs.json', 'utf8')) as { npcs: NpcDef[] }).npcs;
const asked = process.argv.slice(2);

function firstFrame(path: string, w: number, h: number): PNG {
  const src = PNG.sync.read(readFileSync(path));
  const f = new PNG({ width: w, height: h });
  PNG.bitblt(src, f, 0, 0, w, h, 0, 0);
  return f;
}

/** A protagonista de frente: roupa e cabelo do visual padrão, um por cima do outro. */
function protagonist(): PNG | null {
  const data = JSON.parse(readFileSync('data/character.json', 'utf8')) as CharacterData;
  const m = data.mannequin;
  const base = `public/${m.basePath}/`;
  try {
    const o = firstFrame(`${base}outfit_${m.fallback.outfit}_walk.png`, m.frameWidth, m.frameHeight);
    const h = firstFrame(`${base}hair_${m.fallback.hair}_walk.png`, m.frameWidth, m.frameHeight);
    for (let i = 0; i < o.data.length; i += 4) {
      const a = h.data[i + 3]! / 255;
      for (let c = 0; c < 3; c++) o.data[i + c] = Math.round(h.data[i + c]! * a + o.data[i + c]! * (1 - a));
      o.data[i + 3] = Math.max(o.data[i + 3]!, h.data[i + 3]!);
    }
    return o;
  } catch {
    return null;
  }
}

const figures: { id: string; png: PNG }[] = [];
if (!asked.length || asked.includes('player')) {
  const p = protagonist();
  if (p) figures.push({ id: 'player', png: p });
}
for (const d of npcs) {
  if (asked.length ? !asked.includes(d.id) : d.frameHeight !== 128) continue;
  figures.push({ id: d.id, png: firstFrame(`public/${d.sheet}`, d.frameWidth, d.frameHeight) });
}
if (!figures.length) throw new Error('Nenhum personagem encontrado.');

const rows = Math.ceil(figures.length / COLS);
const W = Math.min(figures.length, COLS) * CELL_W * ZOOM;
const H = rows * CELL_H * ZOOM;
const img = new PNG({ width: W, height: H });
const paint = (x: number, y: number, rgb: number[], a = 1): void => {
  if (x < 0 || y < 0 || x >= W || y >= H) return;
  const i = (y * W + x) * 4;
  for (let c = 0; c < 3; c++) img.data[i + c] = Math.round(rgb[c]! * a + img.data[i + c]! * (1 - a));
  img.data[i + 3] = 255;
};
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) paint(x, y, BG);

figures.forEach(({ id, png }, n) => {
  const cx = (n % COLS) * CELL_W * ZOOM;
  const cy = Math.floor(n / COLS) * CELL_H * ZOOM;
  let bottom = 0, left = png.width, right = 0;
  for (let y = 0; y < png.height; y++) for (let x = 0; x < png.width; x++) {
    if (png.data[(y * png.width + x) * 4 + 3]! > 40) { bottom = Math.max(bottom, y); left = Math.min(left, x); right = Math.max(right, x); }
  }
  for (let g = 0; g <= FLOOR; g += 16) for (let x = 0; x < CELL_W * ZOOM; x++) paint(cx + x, cy + (FLOOR - g) * ZOOM, GUIDE);
  if (REFERENCES.includes(id)) for (let y = 0; y < 4; y++) for (let x = 8; x < CELL_W * ZOOM - 8; x++) paint(cx + x, cy + (FLOOR + 3) * ZOOM + y, MARK);
  const ox = cx + Math.round((CELL_W - (right - left + 1)) / 2) * ZOOM - left * ZOOM;
  const oy = cy + (FLOOR - bottom) * ZOOM;
  for (let y = 0; y < png.height * ZOOM; y++) for (let x = 0; x < png.width * ZOOM; x++) {
    const si = (Math.floor(y / ZOOM) * png.width + Math.floor(x / ZOOM)) * 4;
    const a = png.data[si + 3]! / 255;
    if (a) paint(ox + x, oy + y, [png.data[si]!, png.data[si + 1]!, png.data[si + 2]!], a);
  }
});

mkdirSync('assets/_lineup', { recursive: true });
writeFileSync('assets/_lineup/lineup.png', PNG.sync.write(img));
console.log(`assets/_lineup/lineup.png: ${figures.map((f, i) => `${i + 1} ${f.id}`).join(', ')}`);
