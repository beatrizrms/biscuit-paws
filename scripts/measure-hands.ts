// npx tsx scripts/measure-hands.ts (npm run hands): mede onde ficam as mãos da protagonista em cada quadro das poses
// que seguram algo (bandeja, colo, ação) e grava data/hand_anchors.json (guia de estilo, seção 3; fase 3 do plano de
// polimento). Cada roupa foi desenhada à parte e põe as mãos num lugar diferente: por isso o ponto é por roupa, por
// direção e por quadro. Rode de novo sempre que a arte do manequim mudar (npm run mannequin).
// As mãos saem da máscara da pele (outfit_<roupa>_<anim>_mask.png): grupos de pixels fora a cabeça (o maior), e deles
// a ponta na direção em que ela olha (de frente, a de baixo; de lado, a da frente; de costas, a de cima).
import { readFileSync, writeFileSync } from 'node:fs';
import { PNG } from 'pngjs';
import type { CharacterData } from '../src/core/appearance';

type Dir = 'down' | 'left' | 'right' | 'up';
type Point = [number, number];
interface Blob { px: Point[]; n: number; cx: number; cy: number; l: number; r: number; b: number }

/** Linhas da folha, na ordem do jogo. */
const DIRS: Dir[] = ['down', 'left', 'right', 'up'];
/** As animações medidas. A de ação (varrer, lavar...) só existe de frente: as linhas de lado repetem a de frente. */
const ANIMS = ['tray', 'carry', 'work'] as const;
/** Quantos pixels da ponta entram na conta. */
const TIP = 6;

const data = JSON.parse(readFileSync('data/character.json', 'utf8')) as CharacterData;
const m = data.mannequin;
const W = m.frameWidth;
const H = m.frameHeight;
const columns = data.sheet.columns;

function blobs(mask: PNG, fx: number, fy: number): Blob[] {
  const seen = new Uint8Array(W * H);
  const on = (x: number, y: number) => mask.data[((fy + y) * mask.width + fx + x) * 4 + 3]! > 100;
  const out: Blob[] = [];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (seen[y * W + x] || !on(x, y)) continue;
    const stack: Point[] = [[x, y]];
    seen[y * W + x] = 1;
    const px: Point[] = [];
    while (stack.length) {
      const [a, b] = stack.pop()!;
      px.push([a, b]);
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const u = a + dx, v = b + dy;
        if (u < 0 || v < 0 || u >= W || v >= H || seen[v * W + u] || !on(u, v)) continue;
        seen[v * W + u] = 1;
        stack.push([u, v]);
      }
    }
    const xs = px.map((q) => q[0]), ys = px.map((q) => q[1]);
    out.push({ px, n: px.length, cx: xs.reduce((s, v) => s + v, 0) / px.length, cy: ys.reduce((s, v) => s + v, 0) / px.length, l: Math.min(...xs), r: Math.max(...xs), b: Math.max(...ys) });
  }
  return out.sort((a, b) => b.n - a.n);
}

/** O ponto das mãos num quadro (pixels do quadro), olhando para `dir`; null quando não dá para ver. */
function hands(mask: PNG, col: number, row: number, dir: Dir, maxBelowHead: number): Point | null {
  const all = blobs(mask, col * W, row * H);
  const head = all[0];
  if (!head) return null;
  // De costas as mãos aparecem em pedacinhos (atrás da cabeça e dos ombros).
  const cand = all.slice(1).filter((b) => b.n >= (dir === 'up' ? 2 : 6) && b.cy > head.cy && b.cy < head.b + maxBelowHead);
  let pick: Blob[];
  if (dir === 'left') pick = cand.filter((b) => b.l <= Math.min(...cand.map((c) => c.l)) + TIP);
  else if (dir === 'right') pick = cand.filter((b) => b.r >= Math.max(...cand.map((c) => c.r)) - TIP);
  else {
    // De frente e de costas: uma mão de cada lado da cabeça (o grupo maior; de costas, todos os pedacinhos).
    const side = (bs: Blob[]): Blob[] => (!bs.length ? [] : dir === 'up' ? bs : [bs.reduce((a, b) => (b.n > a.n ? b : a))]);
    pick = [...side(cand.filter((b) => b.cx < head.cx - 6)), ...side(cand.filter((b) => b.cx > head.cx + 6))];
  }
  if (!pick.length) return null;
  // A ponta das mãos: de frente, a de baixo; de costas, a de cima; de lado, a da frente.
  const reach = (q: Point) => (dir === 'down' ? q[1] : dir === 'up' ? -q[1] : dir === 'left' ? -q[0] : q[0]);
  const tips = pick.flatMap((b) => {
    const most = Math.max(...b.px.map(reach));
    return b.px.filter((q) => reach(q) >= most - TIP);
  });
  return [tips.reduce((s, q) => s + q[0], 0) / tips.length, tips.reduce((s, q) => s + q[1], 0) / tips.length];
}

const outfits: Record<string, Record<string, Record<Dir, Point[]>>> = {};
for (const [outfit, full] of Object.entries(m.outfits)) {
  if (!full) continue;
  outfits[outfit] = {};
  for (const anim of ANIMS) {
    const mask = PNG.sync.read(readFileSync(`public/${m.basePath}/outfit_${outfit}_${anim}_mask.png`));
    const rows = {} as Record<Dir, (Point | null)[]>;
    DIRS.forEach((dir, row) => {
      // Na ação, as linhas de lado são a pose de frente: as duas mãos juntas no cabo.
      const as: Dir = anim === 'work' && dir !== 'up' ? 'down' : dir;
      rows[dir] = Array.from({ length: columns }, (_, col) => hands(mask, col, row, as, anim === 'carry' ? 30 : 45));
    });
    // De costas no colo e na ação as mãos ficam escondidas: o mesmo ponto de frente.
    if (anim !== 'tray') rows.up = [...rows.down];
    const out = {} as Record<Dir, Point[]>;
    for (const dir of DIRS) {
      out[dir] = rows[dir].map((p, col) => {
        // Quadro sem mão visível: o vizinho, ou o de frente.
        const q = p ?? rows[dir].find((x) => x) ?? rows.down[col] ?? [W / 2, H / 2];
        // Em pixels da arte, a partir do meio dos pés (a origem do sprite).
        return [Math.round(q[0] - W / 2), Math.round(q[1] - H)];
      });
    }
    outfits[outfit][anim] = out;
  }
}

const file = {
  _comment: 'Gerado por npm run hands (scripts/measure-hands.ts); não editar à mão. Onde ficam as mãos da protagonista em cada quadro das poses que seguram algo, por roupa, animação e direção (4 quadros cada), em pixels da arte a partir do meio dos pés (resolution pixels da arte por pixel do jogo). O item na mão (bandeja, louça, gato, vassoura) vai preso a este ponto.',
  resolution: m.resolution,
  outfits,
};
// Uma direção (4 quadros) por linha: o arquivo fica fácil de ler e de comparar no diff.
const json = JSON.stringify(file, null, 2).replace(/\[\s+(-?\d+),\s+(-?\d+)\s+\]/g, '[$1, $2]').replace(/\[\s+(\[[^\]]+\](?:,\s+\[[^\]]+\])*)\s+\]/g, (_, inner: string) => `[${inner.replace(/,\s+/g, ', ')}]`);
writeFileSync('data/hand_anchors.json', `${json}\n`);
console.log(`data/hand_anchors.json: ${Object.keys(outfits).length} roupas x ${ANIMS.length} animações`);
