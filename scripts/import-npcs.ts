// NPCs na arte nova (PixelLab, 64 px por tile): monta uma folha por NPC a partir dos quadros exportados em
// assets/_pixellab/personagens/<pasta>/Idle/animations e copia o retrato de 128 px.
// Folha: quadros 112x128 (a figura tem ~120 px de altura, ~1,9 tile), pés na base, centro da figura no meio.
// Linhas: caminhada baixo, esquerda, direita, cima (4 quadros) e, na linha 4, acenar; na 5, segurar (5 quadros).
// NPC só com caminhada (a Fernanda): só as 4 primeiras linhas.
// Rodar: npm run npcs. Saída em public/assets/characters/npcs/v64/ (fora do git, como toda a arte).
import fs from 'node:fs';
import path from 'node:path';
import { PNG } from 'pngjs';

const SRC = 'assets/_pixellab/personagens';
const OUT = 'public/assets/characters/npcs/v64';
const W = 112;
const H = 128;
const COLUMNS = 5;

/** Pasta do PixelLab -> id do NPC (data/npcs.json) e se tem só a caminhada (sem acenar e segurar). */
const NPCS: Record<string, { id: string; walkOnly?: boolean }> = {
  gabi: { id: 'npc.gabi' },
  corretora: { id: 'npc.realtor' },
  neusa: { id: 'npc.neusa' },
  entregadora: { id: 'npc.mail_carrier' },
  fernanda: { id: 'npc.fernanda', walkOnly: true },
};

/** Linha da folha -> animação e direção do PixelLab. */
const ROWS: [string, string][] = [
  ['walk', 'south'],
  ['walk', 'west'],
  ['walk', 'east'],
  ['walk', 'north'],
  ['wave', 'south'],
  ['hold', 'south'],
];

function frames(folder: string, anim: string, dir: string): PNG[] {
  const dirPath = path.join(SRC, folder, 'Idle', 'animations', `${folder}_${anim}`, dir);
  if (!fs.existsSync(dirPath)) throw new Error(`faltam os quadros: ${dirPath}`);
  return fs
    .readdirSync(dirPath)
    .filter((f) => f.endsWith('.png'))
    .sort()
    .map((f) => PNG.sync.read(fs.readFileSync(path.join(dirPath, f))));
}

/**
 * Onde recortar uma animação: o centro da figura (pela caixa de todos os quadros juntos, para não tremer de um
 * quadro para o outro) e a linha dos pés (o pixel mais baixo de todos os quadros).
 */
function anchor(list: PNG[]): { cx: number; feet: number } {
  let minX = Infinity;
  let maxX = -1;
  let maxY = -1;
  for (const p of list) {
    for (let y = 0; y < p.height; y++) {
      for (let x = 0; x < p.width; x++) {
        if (p.data[(y * p.width + x) * 4 + 3]! <= 40) continue;
        minX = Math.min(minX, x);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
    }
  }
  return { cx: Math.round((minX + maxX + 1) / 2), feet: maxY + 1 };
}

function blit(dst: PNG, src: PNG, dx: number, dy: number, a: { cx: number; feet: number }): void {
  const ox = a.cx - W / 2;
  const oy = a.feet - H;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const sx = x + ox;
      const sy = y + oy;
      if (sx < 0 || sy < 0 || sx >= src.width || sy >= src.height) continue;
      const i = (sy * src.width + sx) * 4;
      if (src.data[i + 3]! <= 40) continue; // pixels quase transparentes da exportação: fora
      const o = ((dy + y) * dst.width + dx + x) * 4;
      for (let k = 0; k < 4; k++) dst.data[o + k] = src.data[i + k]!;
    }
  }
}

fs.mkdirSync(OUT, { recursive: true });
for (const [folder, { id, walkOnly }] of Object.entries(NPCS)) {
  const rows = walkOnly ? ROWS.filter(([anim]) => anim === 'walk') : ROWS;
  const sheet = new PNG({ width: W * COLUMNS, height: H * rows.length });
  rows.forEach(([anim, dir], row) => {
    const list = frames(folder, anim, dir);
    const a = anchor(list);
    list.slice(0, COLUMNS).forEach((p, col) => blit(sheet, p, col * W, row * H, a));
  });
  const name = id.replace('npc.', 'npc_');
  fs.writeFileSync(path.join(OUT, `${name}.png`), PNG.sync.write(sheet));
  fs.copyFileSync(path.join(SRC, folder, `${folder}_retrato_128.png`), path.join(OUT, `${name}_portrait.png`));
  console.log(`${id}: ${OUT}/${name}.png (${W}x${H} por quadro, ${COLUMNS}x${rows.length}) + retrato`);
}
