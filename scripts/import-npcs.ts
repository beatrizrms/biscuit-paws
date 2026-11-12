// NPCs na arte nova (PixelLab, 64 px por tile): monta uma folha por NPC a partir dos quadros exportados em
// assets/_pixellab/personagens/<pasta>/Idle/animations e copia o retrato de 128 px.
// Folha: quadros 112x128 (a figura tem ~120 px de altura, ~1,9 tile), pés na base, centro da figura no meio.
// Linhas: caminhada baixo, esquerda, direita, cima (4 quadros) e, na linha 4, acenar; na 5, segurar (5 quadros).
// NPC só com caminhada (a Fernanda): só as 4 primeiras linhas. Cliente: caminhada e, nas linhas 4 a 7, sentado
// (2 quadros, sem o 1º, que às vezes ainda é a descida; baixo, esquerda, direita, cima), para a cadeira do jogo ficar
// por baixo (o cliente na mesa). O sentado para a direita é o da esquerda espelhado (de lado a IA virava 3/4).
// Construtor: quadros 144x128 (o martelo), linha 6 = martelando para a direita.
// Atendente do mercado: só de costas (fica atrás do caixa); linha 0 = à toa (vira a cabeça), linha 1 = passando as
// compras. As duas linhas com o mesmo recorte, para ela não pular ao trocar de animação.
// Cachorro (o Joca): quadros 64x64, 6 colunas; caminhada, latindo (frente e lado), sentado e dormindo.
// Rodar: npm run npcs. Saída em public/assets/characters/npcs/v64/ (fora do git, como toda a arte).
import fs from 'node:fs';
import path from 'node:path';
import { PNG } from 'pngjs';

const SRC = 'assets/_pixellab/personagens';
const OUT = 'public/assets/characters/npcs/v64';
type Kit = 'full' | 'walk' | 'customer' | 'dog' | 'builder' | 'clerk';

/** Quadro (largura x altura) e colunas da folha de cada kit. */
const SIZE: Record<Kit, { w: number; h: number; columns: number }> = {
  full: { w: 112, h: 128, columns: 5 },
  walk: { w: 112, h: 128, columns: 5 },
  customer: { w: 112, h: 128, columns: 5 },
  dog: { w: 64, h: 64, columns: 6 },
  // O construtor: quadros mais largos para o martelo caber (o golpe vai longe para a direita).
  builder: { w: 144, h: 128, columns: 5 },
  clerk: { w: 112, h: 128, columns: 5 },
};

/** Pasta do PixelLab -> id do NPC (data/npcs.json) e o kit: completo (acenar, segurar), só caminhada ou cliente (sentado). */
const NPCS: Record<string, { id: string; kit: Kit; portrait: boolean }> = {
  gabi: { id: 'npc.gabi', kit: 'full', portrait: true },
  corretora: { id: 'npc.realtor', kit: 'full', portrait: true },
  neusa: { id: 'npc.neusa', kit: 'full', portrait: true },
  jacque: { id: 'npc.jacque', kit: 'full', portrait: true },
  entregadora: { id: 'npc.mail_carrier', kit: 'full', portrait: true },
  fernanda: { id: 'npc.fernanda', kit: 'walk', portrait: true },
  joca: { id: 'npc.joca', kit: 'dog', portrait: false },
  construtor: { id: 'npc.builder', kit: 'builder', portrait: true },
  atendente: { id: 'npc.market_clerk', kit: 'clerk', portrait: false },
  ...Object.fromEntries(
    Array.from({ length: 10 }, (_, i) => String(i + 1).padStart(2, '0')).map((n) => [`cliente${n}`, { id: `npc.customer_${n}`, kit: 'customer' as Kit, portrait: false }]),
  ),
};

/** Linha da folha: animação, direção e opções (`mirror`: espelha; `skip`: pula os primeiros quadros). */
type Row = [string, string, { mirror?: boolean; skip?: number }?];

const WALK: Row[] = [
  ['walk', 'south'],
  ['walk', 'west'],
  ['walk', 'east'],
  ['walk', 'north'],
];

/** Linhas da folha de cada kit -> animação e direção do PixelLab. */
const ROWS: Record<Kit, Row[]> = {
  full: [...WALK, ['wave', 'south'], ['hold', 'south']],
  walk: WALK,
  customer: [...WALK, ['sit', 'south', { skip: 1 }], ['sit', 'west', { skip: 1 }], ['sit', 'west', { skip: 1, mirror: true }], ['sit', 'north', { skip: 1 }]],
  dog: [...WALK, ['bark', 'south'], ['bark', 'east'], ['sit', 'south'], ['sleep', 'south']],
  // Construtor: caminhada, acenar, segurar (2ª versão) e, na linha 6, martelando para a direita (com o martelo).
  builder: [...WALK, ['wave', 'south'], ['hold_v2', 'south'], ['hammer_v3', 'east']],
  clerk: [['idle', 'north'], ['scan', 'north']],
};

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

function blit(dst: PNG, src: PNG, dx: number, dy: number, a: { cx: number; feet: number }, W: number, H: number, mirror = false): void {
  const ox = a.cx - W / 2;
  const oy = a.feet - H;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const sx = x + ox;
      const sy = y + oy;
      if (sx < 0 || sy < 0 || sx >= src.width || sy >= src.height) continue;
      const i = (sy * src.width + sx) * 4;
      if (src.data[i + 3]! <= 40) continue; // pixels quase transparentes da exportação: fora
      const o = ((dy + y) * dst.width + dx + (mirror ? W - 1 - x : x)) * 4;
      for (let k = 0; k < 4; k++) dst.data[o + k] = src.data[i + k]!;
    }
  }
}

fs.mkdirSync(OUT, { recursive: true });
for (const [folder, { id, kit, portrait }] of Object.entries(NPCS)) {
  if (!fs.existsSync(path.join(SRC, folder))) {
    console.log(`${id}: sem a pasta ${folder} (ainda não gerado), pulei`);
    continue;
  }
  const rows = ROWS[kit];
  const missing = rows.filter(([anim, dir]) => !fs.existsSync(path.join(SRC, folder, 'Idle', 'animations', `${folder}_${anim}`, dir)));
  if (missing.length > 0) {
    console.log(`${id}: faltam quadros (${missing.map(([a, d]) => `${a} ${d}`).join(', ')}), pulei`);
    continue;
  }
  const { w: W, h: H, columns: COLUMNS } = SIZE[kit];
  const sheet = new PNG({ width: W * COLUMNS, height: H * rows.length });
  const shared = kit === 'clerk' ? anchor(rows.flatMap(([anim, dir]) => frames(folder, anim, dir))) : undefined;
  rows.forEach(([anim, dir, opt], row) => {
    const list = frames(folder, anim, dir).slice(opt?.skip ?? 0);
    const a = shared ?? anchor(list);
    list.slice(0, COLUMNS).forEach((p, col) => blit(sheet, p, col * W, row * H, a, W, H, opt?.mirror));
  });
  const name = id.replace('npc.', 'npc_');
  fs.writeFileSync(path.join(OUT, `${name}.png`), PNG.sync.write(sheet));
  if (portrait) fs.copyFileSync(path.join(SRC, folder, `${folder}_retrato_128.png`), path.join(OUT, `${name}_portrait.png`));
  console.log(`${id}: ${OUT}/${name}.png (${W}x${H} por quadro, ${COLUMNS}x${rows.length})${portrait ? ' + retrato' : ''}`);
}
