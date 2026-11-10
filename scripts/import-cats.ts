// Gatos na arte nova (PixelLab, 64 px): monta a folha de cada gato no layout do Cosy Cats (data/cat_sprites.json),
// com quadros de 64x64 e pés na linha 56 (= 28 de 32). Variante com `resolutions: 2` no cat_sprites.json.
// Linhas: 0 sentado, 1-4 andar (baixo, cima, direita, esquerda), 5 dormir, 6 brincar (bote) e, só nas folhas novas,
// 7-8 comer (pote à direita/à esquerda) e 9-10 estranhar (virado para a direita/esquerda).
// Cada linha anda inteira junto: os pés da animação vão para a linha 56 e o centro para o meio do quadro.
// O lado esquerdo é o direito espelhado. Dormir respira por código (o alto do corpo sobe 1 px); estranhar treme 1 px.
// Fonte: o ruivo, dos quadros exportados em assets/_pixellab/gatos/ruivo_* (personagens e imagens do PixelLab); as outras
// pelagens, de base_<pelagem>/ (fromBase).
// Rodar: npm run gatos. Saída em public/assets/characters/cats/ (fora do git, como toda a arte).
import fs from 'node:fs';
import path from 'node:path';
import { PNG } from 'pngjs';

const SRC = 'assets/_pixellab/gatos';
const OUT = 'public/assets/characters/cats';
const S = 64;
const COLS = 6;
const FEET = 56;

const read = (f: string) => PNG.sync.read(fs.readFileSync(path.join(SRC, f)));
const frames = (dir: string, idx: number[]) => idx.map((i) => read(`${dir}/frame_${String(i).padStart(3, '0')}.png`));

function bbox(imgs: PNG[]): [number, number, number, number] {
  const a: [number, number, number, number] = [Infinity, Infinity, -1, -1];
  for (const p of imgs)
    for (let y = 0; y < p.height; y++)
      for (let x = 0; x < p.width; x++)
        if (p.data[(y * p.width + x) * 4 + 3]) {
          a[0] = Math.min(a[0], x);
          a[1] = Math.min(a[1], y);
          a[2] = Math.max(a[2], x);
          a[3] = Math.max(a[3], y);
        }
  return a;
}

function mirror(p: PNG): PNG {
  const o = new PNG({ width: p.width, height: p.height });
  for (let y = 0; y < p.height; y++)
    for (let x = 0; x < p.width; x++) p.data.copy(o.data, (y * p.width + p.width - 1 - x) * 4, (y * p.width + x) * 4, (y * p.width + x) * 4 + 4);
  return o;
}

/** Respira/treme: a parte de cima do corpo (até 60% da altura) sobe 1 px; a linha da emenda se repete. */
function breathe(p: PNG): PNG {
  const [, y0, , y1] = bbox([p]);
  const seam = Math.round(y0 + (y1 - y0) * 0.6);
  const o = new PNG({ width: p.width, height: p.height });
  p.data.copy(o.data);
  for (let y = 0; y < seam; y++) p.data.copy(o.data, y * p.width * 4, (y + 1) * p.width * 4, (y + 2) * p.width * 4);
  return o;
}

/** O ruivo (o Botinhas): quadros escolhidos de cada animação do PixelLab. */
function ruivo(): PNG[][] {
  const pe = 'ruivo_em_pe/Idle/animations';
  const sentado = frames('ruivo_sentado/Idle/animations/sentado/south', [0, 2, 4, 6]);
  const east = frames(`${pe}/andar/east`, [0, 1, 3, 4]);
  const dormir = read('ruivo_dormir_enrolado.png');
  const comer = frames(`${pe}/comer/east`, [1, 2, 3, 4, 5, 6]);
  const estranhar = read('ruivo_estranhar.png');
  return [
    sentado,
    frames(`${pe}/andar/south`, [0, 1, 3, 4]),
    frames(`${pe}/andar_cima_v2/north`, [0, 1, 3, 4]),
    east,
    east.map(mirror),
    [dormir, breathe(dormir), breathe(dormir), dormir],
    // Bote: agacha, balança, sobe e dá o tapa com a pata.
    frames(`${pe}/bote_v3/south`, [0, 1, 2, 5, 6, 7]),
    comer,
    comer.map(mirror),
    [estranhar, breathe(estranhar)],
    [mirror(estranhar), breathe(mirror(estranhar))],
  ];
}

/**
 * As outras pelagens: os 30 quadros únicos da folha do ruivo (base_ruivo/, tirados da folha pronta) repintados pelo
 * transfer_outfit do PixelLab em base_<pelagem>/, na mesma ordem dos nomes (00_sit_0 ... 29_startle_right_0).
 * Vêm já no lugar (mesmo quadro de 64); a montagem só espelha os lados esquerdos e refaz respiração e tremor.
 */
function fromBase(coat: string): () => PNG[][] {
  return () => {
    const dir = `base_${coat}`;
    const f = fs.readdirSync(path.join(SRC, dir)).filter((n) => n.endsWith('.png')).sort().map((n) => read(`${dir}/${n}`));
    if (f.length !== 30) throw new Error(`${dir}: esperava 30 quadros, achei ${f.length}`);
    const right = f.slice(12, 16);
    const [sleep, play, eat, startle] = [f[16]!, f.slice(17, 23), f.slice(23, 29), f[29]!];
    return [
      f.slice(0, 4),
      f.slice(4, 8),
      f.slice(8, 12),
      right,
      right.map(mirror),
      [sleep, breathe(sleep), breathe(sleep), sleep],
      play,
      eat,
      eat.map(mirror),
      [startle, breathe(startle)],
      [mirror(startle), breathe(mirror(startle))],
    ];
  };
}

function sheet(rows: PNG[][]): PNG {
  const out = new PNG({ width: S * COLS, height: S * rows.length });
  rows.forEach((imgs, r) => {
    const [x0, , x1, y1] = bbox(imgs);
    const dx = Math.round(S / 2 - (x0 + x1 + 1) / 2);
    const dy = FEET - y1;
    imgs.forEach((p, c) => {
      for (let y = 0; y < p.height; y++)
        for (let x = 0; x < p.width; x++) {
          const tx = x + dx;
          const ty = y + dy;
          if (tx < 0 || ty < 0 || tx >= S || ty >= S) continue;
          p.data.copy(out.data, ((r * S + ty) * out.width + c * S + tx) * 4, (y * p.width + x) * 4, (y * p.width + x) * 4 + 4);
        }
    });
  });
  return out;
}

const cats: Record<string, () => PNG[][]> = { ruivo, frajola: fromBase('frajola') };
fs.mkdirSync(OUT, { recursive: true });
for (const [variant, build] of Object.entries(cats)) {
  const file = path.join(OUT, `cat_${variant}.png`);
  fs.writeFileSync(file, PNG.sync.write(sheet(build())));
  console.log(`${file}`);
}
