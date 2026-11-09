// npx tsx scripts/import-mannequin.ts (npm run mannequin): monta as folhas do manequim do PixelLab
// (assets/_pixellab/personagens/protagonista/manequim, fora do Git) no formato da folha da jogadora:
// 4 colunas (quadros da animação) e linhas baixo, esquerda, direita, cima, em public/ (também fora do Git).
// Os quadros do PixelLab têm 176x176 com a figura no meio; cada um é recortado numa caixa fixa
// (data/character.json, mannequin.frameWidth x frameHeight) com os pés na base, e perde os pontinhos soltos.
// A ação (limpar, máquinas...) só existe de frente e de costas: as linhas de lado repetem a de frente.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { PNG } from 'pngjs';
import type { CharacterData } from '../src/core/appearance';

const SRC = 'assets/_pixellab/personagens/protagonista/manequim/Idle/animations';
/** Tamanho dos quadros que o PixelLab entrega. */
const CANVAS = 176;
/** Linha (em pixels do quadro do PixelLab) onde fica a base da caixa: logo abaixo do pé mais baixo. */
const FEET_Y = 152;
/** Grupos menores que isto (pixels soltos) somem. */
const MIN_BLOB = 8;
const FRAMES = 4;
/** Linhas da folha (baixo, esquerda, direita, cima) -> direção do PixelLab. */
const ROWS = ['south', 'west', 'east', 'north'] as const;

/** Arquivo da folha -> pasta da animação no PixelLab e direções que existem. */
const SHEETS: Record<string, { anim: string; only?: Partial<Record<(typeof ROWS)[number], (typeof ROWS)[number]>> }> = {
  'mannequin_walk.png': { anim: 'man_walk' },
  'mannequin_tray.png': { anim: 'm_tray' },
  'mannequin_carry.png': { anim: 'm_carry' },
  'mannequin_work.png': { anim: 'm_work', only: { west: 'south', east: 'south' } },
};

const data = JSON.parse(readFileSync('data/character.json', 'utf8')) as CharacterData;
const m = data.mannequin;
if (!m) {
  console.error('✗ data/character.json não tem o bloco "mannequin"');
  process.exit(1);
}
const OUT = `public/${m.basePath}`;
mkdirSync(OUT, { recursive: true });
const W = m.frameWidth;
const H = m.frameHeight;
const X0 = (CANVAS - W) / 2;
const Y0 = FEET_Y - H;

/** Apaga grupos de pixels opacos (vizinhança de 8) menores que MIN_BLOB. */
function dropSpecks(p: PNG): number {
  const seen = new Uint8Array(p.width * p.height);
  const opaque = (i: number) => p.data[i * 4 + 3]! > 0;
  let removed = 0;
  for (let s = 0; s < seen.length; s++) {
    if (seen[s] || !opaque(s)) continue;
    const group = [s];
    seen[s] = 1;
    for (let k = 0; k < group.length; k++) {
      const q = group[k]!;
      const x = q % p.width;
      const y = Math.floor(q / p.width);
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= p.width || ny >= p.height) continue;
          const n = ny * p.width + nx;
          if (!seen[n] && opaque(n)) {
            seen[n] = 1;
            group.push(n);
          }
        }
    }
    if (group.length >= MIN_BLOB) continue;
    for (const q of group) p.data[q * 4 + 3] = 0;
    removed += group.length;
  }
  return removed;
}

let specks = 0;
let cut = 0;
for (const [file, { anim, only }] of Object.entries(SHEETS)) {
  const sheet = new PNG({ width: W * FRAMES, height: H * ROWS.length });
  ROWS.forEach((row, r) => {
    const dir = only?.[row] ?? row;
    for (let f = 0; f < FRAMES; f++) {
      const src = PNG.sync.read(readFileSync(`${SRC}/${anim}/${dir}/frame_${String(f).padStart(3, '0')}.png`));
      if (src.width !== CANVAS || src.height !== CANVAS) throw new Error(`${anim}/${dir}/${f}: quadro ${src.width}x${src.height}, esperado ${CANVAS}x${CANVAS}`);
      specks += dropSpecks(src);
      // Algo fora da caixa ficaria cortado: avisa.
      for (let y = 0; y < CANVAS; y++)
        for (let x = 0; x < CANVAS; x++) if (src.data[(y * CANVAS + x) * 4 + 3]! > 0 && (x < X0 || x >= X0 + W || y < Y0 || y >= FEET_Y)) cut++;
      PNG.bitblt(src, sheet, X0, Y0, W, H, f * W, r * H);
    }
  });
  writeFileSync(`${OUT}/${file}`, PNG.sync.write(sheet));
}
console.log(`✓ manequim: ${Object.keys(SHEETS).length} folhas em ${OUT} (quadros ${W}x${H}, resolução ${m.resolution}); ${specks} pixels soltos apagados`);
if (cut > 0) console.warn(`! ${cut} pixels ficaram fora da caixa (aumente frameWidth/frameHeight ou ajuste FEET_Y)`);
