// npx tsx scripts/import-mannequin.ts (npm run mannequin): monta as folhas do manequim do PixelLab
// (assets/_pixellab/personagens/protagonista/manequim, fora do Git) no formato da folha da jogadora:
// 4 colunas (quadros da animação) e linhas baixo, esquerda, direita, cima, em public/ (também fora do Git).
// Os quadros do PixelLab têm 176x176 com a figura no meio; cada um é recortado numa caixa fixa
// (data/character.json, mannequin.frameWidth x frameHeight) com os pés na base, e perde os pontinhos soltos.
// A ação (limpar, máquinas...) só existe de frente e de costas: as linhas de lado repetem a de frente.
// Caminhada, bandeja, colo e parada são as versões "2" (passos com os pés juntos, decisão 076); a parada tem 3 quadros
// (respiração) e a 4ª coluna repete o do meio.
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
const SHEETS: Record<string, { anim: string; only?: Partial<Record<(typeof ROWS)[number], (typeof ROWS)[number]>>; frames?: number[] }> = {
  'mannequin_walk.png': { anim: 'm_walk2' },
  'mannequin_tray.png': { anim: 'm_tray2' },
  'mannequin_carry.png': { anim: 'm_carry2' },
  'mannequin_idle.png': { anim: 'm_idle2', frames: [0, 1, 2, 1] },
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
for (const [file, { anim, only, frames }] of Object.entries(SHEETS)) {
  const sheet = new PNG({ width: W * FRAMES, height: H * ROWS.length });
  ROWS.forEach((row, r) => {
    const dir = only?.[row] ?? row;
    for (let f = 0; f < FRAMES; f++) {
      const src = PNG.sync.read(readFileSync(`${SRC}/${anim}/${dir}/frame_${String(frames?.[f] ?? f).padStart(3, '0')}.png`));
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

// ---------------------------------------------------------------------------------------------------------
// Camadas (decisão 077): roupa = figura inteira vestida + máscara de regiões (pele, cima, baixo, sapato);
// cabelo = só os fios, recortados do personagem pintado de verde (cor-chave) usando o manequim alinhado.
// Peça completa: uma folha por animação. Toda peça também tem _front (de frente, parada) para a prévia do criador.
const L = m.layers;
if (L) {
  const MAN = 'assets/_pixellab/personagens/protagonista/manequim';
  /** Peças completas: pasta do personagem no PixelLab e prefixo das animações (m = o próprio manequim). */
  const FULL: Record<string, { dir: string; prefix: string }> = {
    'outfit:hoodie': { dir: `${MAN}/roupa_moletom`, prefix: 'r' },
    'hair:long': { dir: `${MAN}/cabelo_longo`, prefix: 'l' },
  };
  /** Peças só de frente: imagem 128x128 editada sobre a rotação sul do manequim (cabelo sobre o manequim verde). */
  const FRONT: Record<string, string> = {
    'outfit:dress': 'dress.png',
    'outfit:collar_shirt': 'collar.png',
    'outfit:tshirt': 'tshirt.png',
    'hair:short': 'short.png',
    'hair:bun': 'bun.png',
    'hair:afro': 'afro.png',
    'hair:curly': 'curly.png',
    'hair:ponytail': 'ponytail.png',
    'hair:bob': 'bob.png',
  };
  /** Como achar cima e baixo em cada roupa: pela cor (moletom vermelho, jeans azul), pela altura (corte na cintura) ou tudo cima (vestido). */
  const SPLIT: Record<string, 'hue' | 'waist' | 'dress'> = { hoodie: 'hue', dress: 'dress', collar_shirt: 'waist', tshirt: 'waist' };
  /** Animação -> nome no PixelLab (depois do prefixo) e quadros. A ação só tem frente e costas. */
  const ANIM: Record<string, { name: string; frames?: number[]; only?: Partial<Record<(typeof ROWS)[number], (typeof ROWS)[number]>> }> = {
    walk: { name: 'walk2' },
    idle: { name: 'idle2', frames: [0, 1, 2, 1] },
    tray: { name: 'tray2' },
    carry: { name: 'carry2' },
    work: { name: 'work', only: { west: 'south', east: 'south' } },
  };

  const hsl = (p: PNG, i: number) => {
    const r = p.data[i]! / 255, g = p.data[i + 1]! / 255, b = p.data[i + 2]! / 255;
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, d = mx - mn;
    if (!d) return [0, 0, l] as const;
    let h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
    h *= 60;
    return [h < 0 ? h + 360 : h, d / (1 - Math.abs(2 * l - 1)), l] as const;
  };
  const opaque = (p: PNG, x: number, y: number) => x >= 0 && y >= 0 && x < p.width && y < p.height && p.data[(y * p.width + x) * 4 + 3]! > 128;
  const bounds = (p: PNG, test: (x: number, y: number) => boolean) => {
    let x0 = p.width, x1 = -1, y0 = p.height, y1 = -1;
    for (let y = 0; y < p.height; y++)
      for (let x = 0; x < p.width; x++)
        if (test(x, y)) {
          x0 = Math.min(x0, x);
          x1 = Math.max(x1, x);
          y0 = Math.min(y0, y);
          y1 = Math.max(y1, y);
        }
    return { x0, x1, y0, y1, cx: Math.round((x0 + x1) / 2) };
  };
  /** Grupos (vizinhança de 4) de uma região menores que `min` passam para a região que mais aparece em volta (ou somem). */
  const absorbIslands = (reg: Uint8Array, w: number, h: number, min: number) => {
    const seen = new Uint8Array(w * h);
    for (let s = 0; s < w * h; s++) {
      if (!reg[s] || seen[s]) continue;
      const r = reg[s]!;
      const group = [s];
      seen[s] = 1;
      for (let k = 0; k < group.length; k++) {
        const q = group[k]!;
        const x = q % w, y = (q / w) | 0;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
          const nx = x + dx, ny = y + dy, n = ny * w + nx;
          if (nx >= 0 && ny >= 0 && nx < w && ny < h && !seen[n] && reg[n] === r) {
            seen[n] = 1;
            group.push(n);
          }
        }
      }
      if (group.length >= min) continue;
      const votes = new Map<number, number>();
      for (const q of group)
        for (let dy = -2; dy <= 2; dy++)
          for (let dx = -2; dx <= 2; dx++) {
            const x = (q % w) + dx, y = ((q / w) | 0) + dy;
            if (x < 0 || y < 0 || x >= w || y >= h) continue;
            const o = reg[y * w + x]!;
            if (o && o !== r) votes.set(o, (votes.get(o) ?? 0) + 1);
          }
      const best = [...votes].sort((a, b) => b[1] - a[1])[0];
      for (const q of group) reg[q] = best ? best[0] : 0;
    }
  };

  /** Máscara de regiões (canal vermelho) da roupa: 1 pele, 2 cima, 3 baixo, 4 sapato, 0 contorno e detalhes. */
  const outfitMask = (p: PNG, split: 'hue' | 'waist' | 'dress'): PNG => {
    const w = p.width, h = p.height;
    const reg = new Uint8Array(w * h);
    const b = bounds(p, (x, y) => opaque(p, x, y));
    const fig = b.y1 - b.y0;
    const footY = b.y1 - Math.round(fig * 0.07), neckY = b.y0 + Math.round(fig * 0.22);
    /** Do cano do tênis para baixo: o branco do calçado puxa para o bege, então pele ali só com bastante cor. */
    const shoeTop = b.y1 - Math.round(fig * 0.12);
    // Corte na cintura pela cor: a média da roupa no peito e nas coxas; no meio, cada pixel vai para a mais parecida
    // (a barra da camiseta passa da cintura do manequim).
    const band = (from: number, to: number) => {
      const sum = [0, 0, 0];
      let n = 0;
      for (let y = b.y0 + Math.round(fig * from); y < b.y0 + Math.round(fig * to); y++)
        for (let x = 0; x < w; x++) {
          const i = (y * w + x) * 4;
          if (!opaque(p, x, y)) continue;
          const [hu, s, l] = hsl(p, i);
          if (l < 0.14 || (hu >= 5 && hu <= 42 && s > 0.22 && l > 0.42)) continue;
          for (let k = 0; k < 3; k++) sum[k]! += p.data[i + k]!;
          n++;
        }
      return sum.map((v) => v / Math.max(1, n));
    };
    const chest = band(0.3, 0.4), thigh = band(0.66, 0.76);
    const topY = b.y0 + Math.round(fig * 0.4), bottomY = b.y0 + Math.round(fig * 0.76);
    const dist = (i: number, ref: number[]) => ref.reduce((a, v, k) => a + (p.data[i + k]! - v) ** 2, 0);
    // A barra é uma linha reta: cada linha do meio vai inteira para o lado da maioria dos seus pixels (a sombra da camisa não vira calça).
    const rowTop = new Map<number, boolean>();
    for (let y = topY; y < bottomY; y++) {
      let up = 0, down = 0;
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4;
        if (!opaque(p, x, y)) continue;
        const [hu, s, l] = hsl(p, i);
        if (l < 0.14 || (hu >= 5 && hu <= 42 && s > 0.22 && l > 0.42)) continue;
        if (dist(i, chest) <= dist(i, thigh)) up++;
        else down++;
      }
      rowTop.set(y, up >= down);
    }
    const waistRegion = (_x: number, y: number) => (y < topY ? 2 : y >= bottomY ? 3 : rowTop.get(y) ? 2 : 3);
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        if (!opaque(p, x, y)) continue;
        const [hu, s, l] = hsl(p, (y * w + x) * 4);
        if (l < 0.14) continue;
        // Nos pés, só pele bem saturada (tênis branco e sapato claro puxam para o bege).
        // Nos pés, pela intensidade da cor (croma): o branco creme do tênis tem saturação alta no HSL, mas pouca cor.
        const chroma = s * (1 - Math.abs(2 * l - 1));
        const skin = hu >= 5 && hu <= 42 && l > 0.42 && (y >= shoeTop ? chroma > 0.3 : s > 0.22);
        let r = 0;
        if (skin) r = 1;
        else if (y >= footY) r = 4;
        else if (y < neckY) r = 0; // olhos, boca e contorno da cabeça ficam como estão
        else if (split === 'hue') r = (hu >= 330 || hu <= 15) && s > 0.35 ? 2 : hu >= 190 && hu <= 240 && s > 0.15 ? 3 : 0;
        else if (split === 'dress') r = 2;
        else r = waistRegion(x, y);
        reg[y * w + x] = r;
      }
    absorbIslands(reg, w, h, 10);
    const out = new PNG({ width: w, height: h });
    for (let i = 0; i < w * h; i++)
      if (reg[i]) {
        out.data[i * 4] = reg[i]!;
        out.data[i * 4 + 3] = 255;
      }
    return out;
  };

  /** Só o cabelo: o que não é verde (corpo cor-chave) até o meio do corpo, sem sombra, franja verde e contorno do manequim. */
  const hairCut = (c: PNG, man: PNG): PNG => {
    const w = c.width, h = c.height;
    const green = (x: number, y: number) => {
      if (!opaque(c, x, y)) return false;
      const [hu, s, l] = hsl(c, (y * w + x) * 4);
      return hu >= 85 && hu <= 160 && s > 0.3 && l > 0.2;
    };
    const gb = bounds(c, green);
    const lim = gb.y0 + Math.round((gb.y1 - gb.y0) * 0.6);
    const near = (x: number, y: number, test: (x: number, y: number) => boolean) => {
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (test(x + dx, y + dy)) return true;
      return false;
    };
    const manLine = (x: number, y: number) => opaque(man, x, y) && hsl(man, (y * w + x) * 4)[2] < 0.3;
    const keep = new Uint8Array(w * h);
    for (let y = 0; y < lim; y++)
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4;
        if (c.data[i + 3]! < 200 || green(x, y)) continue;
        const [hu, s, l] = hsl(c, i);
        if (s < 0.12 && l > 0.25) continue; // sombra cinza no chão
        if (hu >= 60 && hu <= 170 && s > 0.08) continue; // franja esverdeada
        if (near(x, y, green) && opaque(man, x, y) && near(x, y, manLine)) continue; // contorno do corpo
        keep[y * w + x] = 1;
      }
    absorbIslands(keep, w, h, 20);
    // Fica só a massa do cabelo: grupos bem menores que o maior (um pedaço do braço perto da mão) saem.
    {
      const seen = new Uint8Array(w * h);
      const groups: number[][] = [];
      for (let s0 = 0; s0 < w * h; s0++) {
        if (!keep[s0] || seen[s0]) continue;
        const g = [s0];
        seen[s0] = 1;
        for (let k = 0; k < g.length; k++) {
          const q = g[k]!, x = q % w, y = (q / w) | 0;
          for (let dy = -1; dy <= 1; dy++)
            for (let dx = -1; dx <= 1; dx++) {
              const nx = x + dx, ny = y + dy, n = ny * w + nx;
              if (nx >= 0 && ny >= 0 && nx < w && ny < h && keep[n] && !seen[n]) {
                seen[n] = 1;
                g.push(n);
              }
            }
        }
        groups.push(g);
      }
      const biggest = Math.max(0, ...groups.map((g) => g.length));
      for (const g of groups) if (g.length < biggest * 0.15) for (const q of g) keep[q] = 0;
    }
    for (let pass = 0; pass < 2; pass++) {
      const drop: number[] = [];
      for (let y = 1; y < h - 1; y++)
        for (let x = 1; x < w - 1; x++) {
          if (!keep[y * w + x]) continue;
          let n = 0;
          for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if ((dx || dy) && keep[(y + dy) * w + x + dx]) n++;
          if (n <= 2) drop.push(y * w + x);
        }
      for (const q of drop) keep[q] = 0;
    }
    const out = new PNG({ width: w, height: h });
    for (let i = 0; i < w * h; i++) if (keep[i]) for (let k = 0; k < 4; k++) out.data[i * 4 + k] = c.data[i * 4 + k]!;
    return out;
  };

  /** Um quadro (176x176) da animação `anim` de uma peça (`prefix`/`dir`) na direção da linha. */
  const frameOf = (dir: string, prefix: string, anim: string, row: (typeof ROWS)[number], f: number) => {
    const a = ANIM[anim]!;
    const d = a.only?.[row] ?? row;
    return PNG.sync.read(readFileSync(`${dir}/Idle/animations/${prefix}_${a.name}/${d}/frame_${String(a.frames?.[f] ?? f).padStart(3, '0')}.png`));
  };

  /**
   * Base do cabelo do tamanho da cabeça do molde: por baixo de todo penteado vai o topo do cabelo longo (o que melhor
   * cobre a cabeça: risca na testa e laterais até as orelhas), cortado na altura das orelhas do manequim. Assim nenhum
   * penteado deixa a cabeça careca nas têmporas; onde o penteado já cobre, ele fica por cima.
   */
  const CAP_HAIR = L.fallback.hair;
  const capUnder = (hair: PNG, cap: PNG, man: PNG): void => {
    const w = man.width;
    let top = -1;
    const widths: number[] = [];
    for (let y = 0; y < man.height; y++) {
      let a = -1, b = -1;
      for (let x = 0; x < w; x++) if (opaque(man, x, y)) { if (a < 0) a = x; b = x; }
      widths.push(a < 0 ? 0 : b - a + 1);
      if (top < 0 && a >= 0) top = y;
    }
    let bottom = top;
    for (let y = top; y < man.height; y++) if (widths[y]) bottom = y;
    // Pescoço: a linha mais estreita entre 10% e 35% da figura; orelhas: um pouco acima do meio da cabeça para baixo.
    let neck = top, min = Infinity;
    for (let y = top + Math.round((bottom - top) * 0.1); y < top + Math.round((bottom - top) * 0.35); y++) if (widths[y]! < min) { min = widths[y]!; neck = y; }
    const earY = top + Math.round((neck - top) * 0.62);
    for (let y = 0; y < earY; y++)
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4;
        if (hair.data[i + 3]! > 0 || cap.data[i + 3]! === 0) continue;
        for (let k = 0; k < 4; k++) hair.data[i + k] = cap.data[i + k]!;
      }
  };
  let capFront: PNG | null = null;
  let manFront: PNG | null = null;

  const blank = () => new PNG({ width: W * FRAMES, height: H * ROWS.length });
  let pieces = 0;
  for (const [kind, table] of [['outfit', L.outfits], ['hair', L.hair]] as const) {
    for (const [id, full] of Object.entries(table)) {
      const key = `${kind}:${id}`;
      const split = SPLIT[id] ?? 'waist';
      if (full) {
        const src = FULL[key];
        if (!src) throw new Error(`${key}: completa em data/character.json, mas o script não sabe onde estão as animações (FULL)`);
        for (const anim of L.anims) {
          const sheet = blank(), mask = blank();
          ROWS.forEach((row, r) => {
            for (let f = 0; f < FRAMES; f++) {
              const piece = frameOf(src.dir, src.prefix, anim, row, f);
              if (kind === 'outfit') {
                dropSpecks(piece);
                PNG.bitblt(piece, sheet, X0, Y0, W, H, f * W, r * H);
                PNG.bitblt(outfitMask(piece, split), mask, X0, Y0, W, H, f * W, r * H);
              } else PNG.bitblt(hairCut(piece, frameOf(MAN, 'm', anim, row, f)), sheet, X0, Y0, W, H, f * W, r * H);
            }
          });
          writeFileSync(`${OUT}/${kind}_${id}_${anim}.png`, PNG.sync.write(sheet));
          if (kind === 'outfit') writeFileSync(`${OUT}/${kind}_${id}_${anim}_mask.png`, PNG.sync.write(mask));
        }
      }
      // Prévia de frente (um quadro): da parada da peça completa, ou da imagem editada encaixada pelos pés e pelo centro.
      let front: PNG;
      if (full) {
        front = frameOf(FULL[key]!.dir, FULL[key]!.prefix, 'idle', 'south', 0);
        if (kind === 'hair') front = hairCut(front, frameOf(MAN, 'm', 'idle', 'south', 0));
      }
      else {
        const file = FRONT[key];
        if (!file) throw new Error(`${key}: sem imagem de frente no script (FRONT)`);
        const rot = PNG.sync.read(readFileSync(`${MAN}/Idle/rotations/south.png`));
        let img: PNG = PNG.sync.read(readFileSync(`${MAN}/teste_combos/${file}`));
        if (kind === 'hair') img = hairCut(img, rot);
        else dropSpecks(img);
        const idle = frameOf(MAN, 'm', 'idle', 'south', 0);
        const a = bounds(idle, (x, y) => opaque(idle, x, y)), b = bounds(rot, (x, y) => opaque(rot, x, y));
        front = new PNG({ width: CANVAS, height: CANVAS });
        PNG.bitblt(img, front, 0, 0, img.width, img.height, a.cx - b.cx, a.y1 - b.y1);
      }
      const out = new PNG({ width: W, height: H });
      PNG.bitblt(front, out, X0, Y0, W, H, 0, 0);
      if (kind === 'hair') {
        if (!manFront) {
          const idle = frameOf(MAN, 'm', 'idle', 'south', 0);
          manFront = new PNG({ width: W, height: H });
          PNG.bitblt(idle, manFront, X0, Y0, W, H, 0, 0);
        }
        if (id === CAP_HAIR) capFront = out;
        else if (capFront) capUnder(out, capFront, manFront);
        else throw new Error(`cabelo "${CAP_HAIR}" (base) precisa vir antes dos outros em mannequin.layers.hair`);
      }
      writeFileSync(`${OUT}/${kind}_${id}_front.png`, PNG.sync.write(out));
      if (kind === 'outfit') {
        const mk = new PNG({ width: W, height: H });
        PNG.bitblt(outfitMask(front, split), mk, X0, Y0, W, H, 0, 0);
        writeFileSync(`${OUT}/${kind}_${id}_front_mask.png`, PNG.sync.write(mk));
      }
      pieces++;
    }
  }
  console.log(`✓ camadas: ${pieces} peças em ${OUT} (completas: ${[...Object.entries(L.outfits), ...Object.entries(L.hair)].filter(([, f]) => f).map(([id]) => id).join(', ')})`);
}
