// npx tsx scripts/import-mannequin.ts (npm run mannequin): monta as peças da personagem (decisões 077, 083 e 087)
// a partir do PixelLab (assets/_pixellab/personagens/protagonista/manequim, fora do Git) em public/ (também fora do Git):
// roupa = figura inteira vestida + máscara da pele; cabelo = só os fios (personagem pintado de verde, cor-chave).
// Folhas no formato da jogadora: 4 colunas (quadros) e linhas baixo, esquerda, direita, cima. Os quadros do PixelLab
// (176x176, às vezes maiores) são cortados pelo centro e recortados numa caixa fixa (mannequin.frameWidth x
// frameHeight) com os pés na base. A ação só existe de frente e de costas: as linhas de lado repetem a de frente.
// Caminhada, bandeja, colo e parada são as versões "2" (passos com os pés juntos, decisão 076).
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { PNG } from 'pngjs';
import type { CharacterData } from '../src/core/appearance';

/** Tamanho dos quadros que o PixelLab entrega. */
const CANVAS = 176;
/** Linha (em pixels do quadro do PixelLab) onde fica a base da caixa: logo abaixo do pé mais baixo. */
const FEET_Y = 152;
/** Grupos menores que isto (pixels soltos) somem. */
const MIN_BLOB = 8;
const FRAMES = 4;
/** Linhas da folha (baixo, esquerda, direita, cima) -> direção do PixelLab. */
const ROWS = ['south', 'west', 'east', 'north'] as const;

const data = JSON.parse(readFileSync('data/character.json', 'utf8')) as CharacterData;
const m = data.mannequin;
const OUT = `public/${m.basePath}`;
mkdirSync(OUT, { recursive: true });
const W = m.frameWidth;
const H = m.frameHeight;
const X0 = (CANVAS - W) / 2;
const Y0 = FEET_Y - H;

/** Espelha na horizontal (a figura fica no meio do quadro). */
function mirrorPng(p: PNG): PNG {
  const out = new PNG({ width: p.width, height: p.height });
  for (let y = 0; y < p.height; y++)
    for (let x = 0; x < p.width; x++) p.data.copy(out.data, (y * p.width + (p.width - 1 - x)) * 4, (y * p.width + x) * 4, (y * p.width + x) * 4 + 4);
  return out;
}

/** Move o conteúdo `dx` px para a esquerda (negativo: para a direita). */
function shiftPng(p: PNG, dx: number): PNG {
  const out = new PNG({ width: p.width, height: p.height });
  PNG.bitblt(p, out, Math.max(0, dx), 0, p.width - Math.abs(dx), p.height, Math.max(0, -dx), 0);
  return out;
}

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

// ---------------------------------------------------------------------------------------------------------
// Camadas (decisões 077 e 083): roupa = figura inteira vestida, nas cores do desenho, + máscara da pele;
// cabelo = só os fios, recortados do personagem pintado de verde (cor-chave) usando o manequim alinhado.
// Peça completa: uma folha por animação. Toda peça também tem _front (de frente, parada) para a prévia do criador.
const L = m;
{
  const MAN = 'assets/_pixellab/personagens/protagonista/manequim';
  /** Peças completas: pasta do personagem no PixelLab e prefixo das animações (m = o próprio manequim). */
  const FULL: Record<string, { dir: string; prefix: string }> = {
    'outfit:hoodie': { dir: `${MAN}/roupa_moletom`, prefix: 'r' },
    'outfit:dress': { dir: `${MAN}/roupa_dress`, prefix: 'v' },
    'outfit:collar_shirt': { dir: `${MAN}/roupa_collar_shirt`, prefix: 'c' },
    'outfit:tshirt': { dir: `${MAN}/roupa_tshirt`, prefix: 't' },
    'outfit:blazer': { dir: `${MAN}/roupa_blazer`, prefix: 'z' },
    'outfit:winter_coat': { dir: `${MAN}/roupa_winter_coat`, prefix: 'w' },
    'hair:long': { dir: `${MAN}/cabelo_longo`, prefix: 'l' },
    'hair:short': { dir: `${MAN}/cabelo_short`, prefix: 's' },
    'hair:bob': { dir: `${MAN}/cabelo_bob`, prefix: 'b' },
    'hair:bun': { dir: `${MAN}/cabelo_bun`, prefix: 'u' },
    'hair:ponytail': { dir: `${MAN}/cabelo_ponytail`, prefix: 'p' },
    'hair:afro': { dir: `${MAN}/cabelo_afro`, prefix: 'a' },
    'hair:curly': { dir: `${MAN}/cabelo_curly`, prefix: 'k' },
    'hair:short_afro': { dir: `${MAN}/cabelo_short_afro`, prefix: 'f' },
    'hair:side_part': { dir: `${MAN}/cabelo_side_part`, prefix: 'd' },
    'hair:quiff': { dir: `${MAN}/cabelo_quiff`, prefix: 'q' },
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
    'outfit:blazer': 'blazer.png',
    'outfit:winter_coat': 'winter_coat.png',
    'hair:bob': 'bob.png',
    'hair:short_afro': 'short_afro.png',
    'hair:side_part': 'side_part.png',
    'hair:quiff': 'quiff.png',
  };
  /** Animação -> nome no PixelLab (depois do prefixo) e quadros. A ação só tem frente e costas. */
  /** Linha com outra animação do PixelLab (rows): nome, direção de origem, quadros e espelhada (a direita = a esquerda). */
  type RowSource = { name: string; dir: (typeof ROWS)[number]; frames?: number[]; mirror?: boolean; shiftX?: number };
  const ANIM: Record<string, { name: string; frames?: number[]; only?: Partial<Record<(typeof ROWS)[number], (typeof ROWS)[number]>>; rows?: Partial<Record<(typeof ROWS)[number], RowSource>> }> = {
    walk: { name: 'walk2' },
    idle: { name: 'idle2', frames: [0, 1, 2, 1] },
    tray: { name: 'tray2' },
    carry: { name: 'carry2' },
    work: { name: 'work', only: { west: 'south', east: 'south' } },
    // Sentada (sofá e cadeiras): parada, um quadro só (o 0 é a transição). De frente (sit_front, sul) e de lado
    // (sit_side, oeste; a direita espelhada: de lado a IA virava 3/4). De costas ainda não tem: usa a de frente.
    // De lado a figura sentada é mais larga e fica à direita do meio: shiftX recentraliza (o rabo de cavalo cabe).
    sit: {
      name: 'sit_front',
      frames: [1, 1, 1, 1],
      rows: {
        west: { name: 'sit_side', dir: 'west', frames: [1, 1, 1, 1], shiftX: 10 },
        east: { name: 'sit_side', dir: 'west', frames: [1, 1, 1, 1], mirror: true, shiftX: -10 },
        north: { name: 'sit_front', dir: 'south', frames: [1, 1, 1, 1] },
      },
    },
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

  /**
   * Máscara da roupa (canal vermelho): 1 = pele, 0 = o resto (roupa e calçado ficam nas cores do desenho, decisão 083).
   * Pixel art usa poucas cores: a pele do corpo tem as mesmas cores do rosto. A cabeça (careca, sempre pele) dá a paleta
   * da pele; do pescoço para baixo, só é pele o pixel com uma dessas cores (o bege do blazer e do casaco tem outras).
   */
  const outfitMask = (p: PNG, cloth?: number[][]): PNG => {
    const w = p.width, h = p.height;
    const reg = new Uint8Array(w * h);
    const b = bounds(p, (x, y) => opaque(p, x, y));
    const neckY = b.y0 + Math.round((b.y1 - b.y0) * 0.24);
    /** Todas as roupas têm calçado: os pés nunca são pele (o branco creme do tênis bate com o brilho do rosto). */
    const shoeY = b.y1 - Math.round((b.y1 - b.y0) * 0.06);
    const skinish = (i: number) => {
      const [hu, s, l] = hsl(p, i);
      return hu >= 0 && hu <= 45 && s > 0.2 && l > 0.3;
    };
    const palette: number[][] = [];
    for (let y = b.y0; y < neckY; y++)
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4;
        if (opaque(p, x, y) && skinish(i)) palette.push([p.data[i]!, p.data[i + 1]!, p.data[i + 2]!]);
      }
    const dist = (list: number[][], i: number) => {
      let d = Infinity;
      for (const c of list) d = Math.min(d, Math.abs(c[0]! - p.data[i]!) + Math.abs(c[1]! - p.data[i + 1]!) + Math.abs(c[2]! - p.data[i + 2]!));
      return d;
    };
    // Com a paleta da roupa (tirada da frente, que está certa): só é pele se a cor estiver mais perto do rosto do que
    // de qualquer cor da roupa. Assim o bege do blazer e do casaco continua roupa nos quadros redesenhados.
    const inPalette = (i: number) => {
      const d = dist(palette, i);
      // Na dúvida (as duas paletas quase iguais), fica roupa: a pele tem que estar claramente mais perto.
      return d <= 8 && (!cloth || d + 12 < dist(cloth, i));
    };
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        if (!opaque(p, x, y)) continue;
        const i = (y * w + x) * 4;
        if (hsl(p, i)[2] < 0.14) continue; // contorno
        if (y < neckY ? skinish(i) : y < shoeY && inPalette(i)) reg[y * w + x] = 1;
      }
    absorbIslands(reg, w, h, 6);
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
    const rs = a.rows?.[row];
    const d = rs?.dir ?? a.only?.[row] ?? row;
    const frames = rs?.frames ?? a.frames;
    const read = PNG.sync.read(readFileSync(`${dir}/Idle/animations/${prefix}_${rs?.name ?? a.name}/${d}/frame_${String(frames?.[f] ?? f).padStart(3, '0')}.png`));
    const flipped = rs?.mirror ? mirrorPng(read) : read;
    const p = rs?.shiftX ? shiftPng(flipped, rs.shiftX) : flipped;
    // O PixelLab aumenta o quadro quando o movimento precisa de espaço (176, 192...), com a figura no meio:
    // corta (ou completa) pelo centro para 176, o tamanho do manequim, antes de comparar ou montar.
    if (p.width === CANVAS && p.height === CANVAS) return p;
    const out = new PNG({ width: CANVAS, height: CANVAS });
    const ox = (p.width - CANVAS) / 2, oy = (p.height - CANVAS) / 2;
    PNG.bitblt(p, out, Math.max(0, ox), Math.max(0, oy), Math.min(CANVAS, p.width), Math.min(CANVAS, p.height), Math.max(0, -ox), Math.max(0, -oy));
    return out;
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
  /**
   * Cabelo de um quadro animado, recortado contra o mesmo quadro do manequim (mesmo movimento: cabeça no mesmo lugar,
   * ±1 px). Um encaixe automático (deslocar até a cabeça "bater") foi testado e errou: o couro cabeludo careca engana.
   */
  const hairFrame = (piece: PNG, man: PNG): PNG => hairCut(piece, man);
  /** Cores da roupa (do pescoço para baixo, fora da pele) na imagem de frente da peça. */
  const clothPalette = (front: PNG): number[][] => {
    const m = outfitMask(front);
    const b = bounds(front, (x, y) => opaque(front, x, y));
    const neckY = b.y0 + Math.round((b.y1 - b.y0) * 0.24);
    // Cores do rosto (sempre pele) não entram: senão a pele perde para a roupa nas cores que as duas dividem.
    const face: number[][] = [];
    for (let y = b.y0; y < neckY; y++)
      for (let x = 0; x < front.width; x++) {
        const i = (y * front.width + x) * 4;
        if (opaque(front, x, y) && m.data[i + 3]! > 0) face.push([front.data[i]!, front.data[i + 1]!, front.data[i + 2]!]);
      }
    const onFace = (i: number) => face.some((c) => Math.abs(c[0]! - front.data[i]!) + Math.abs(c[1]! - front.data[i + 1]!) + Math.abs(c[2]! - front.data[i + 2]!) <= 6);
    const seen = new Set<number>();
    const out: number[][] = [];
    for (let y = neckY; y < front.height; y++)
      for (let x = 0; x < front.width; x++) {
        const i = (y * front.width + x) * 4;
        if (!opaque(front, x, y) || m.data[i + 3]! > 0 || hsl(front, i)[2] < 0.14 || onFace(i)) continue;
        const k = (front.data[i]! << 16) | (front.data[i + 1]! << 8) | front.data[i + 2]!;
        if (seen.has(k)) continue;
        seen.add(k);
        out.push([front.data[i]!, front.data[i + 1]!, front.data[i + 2]!]);
      }
    return out;
  };
  const capFrames = new Map<string, PNG>();
  let capFront: PNG | null = null;
  let manFront: PNG | null = null;

  const blank = () => new PNG({ width: W * FRAMES, height: H * ROWS.length });
  let pieces = 0;
  for (const [kind, table] of [['outfit', L.outfits], ['hair', L.hair]] as const) {
    for (const [id, full] of Object.entries(table)) {
      const key = `${kind}:${id}`;
      if (full) {
        const src = FULL[key];
        if (!src) throw new Error(`${key}: completa em data/character.json, mas o script não sabe onde estão as animações (FULL)`);
        const cloth = kind === 'outfit' ? clothPalette(frameOf(src.dir, src.prefix, 'idle', 'south', 0)) : undefined;
        for (const anim of L.anims) {
          const sheet = blank(), mask = blank();
          ROWS.forEach((row, r) => {
            for (let f = 0; f < FRAMES; f++) {
              const piece = frameOf(src.dir, src.prefix, anim, row, f);
              if (kind === 'outfit') {
                dropSpecks(piece);
                PNG.bitblt(piece, sheet, X0, Y0, W, H, f * W, r * H);
                PNG.bitblt(outfitMask(piece, cloth), mask, X0, Y0, W, H, f * W, r * H);
              } else {
                const man = frameOf(MAN, 'm', anim, row, f);
                const cut = hairFrame(piece, man);
                // Base do cabelo do molde também nas animações: o cabelo longo do mesmo quadro por baixo.
                const capKey = `${anim}/${row}/${f}`;
                if (id === CAP_HAIR) capFrames.set(capKey, cut);
                else {
                  const cap = capFrames.get(capKey);
                  if (!cap) throw new Error(`cabelo "${CAP_HAIR}" (base) precisa vir antes dos outros em mannequin.layers.hair`);
                  capUnder(cut, cap, man);
                }
                PNG.bitblt(cut, sheet, X0, Y0, W, H, f * W, r * H);
              }
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
        if (kind === 'hair') front = hairFrame(front, frameOf(MAN, 'm', 'idle', 'south', 0));
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
        PNG.bitblt(outfitMask(front, clothPalette(front)), mk, X0, Y0, W, H, 0, 0);
        writeFileSync(`${OUT}/${kind}_${id}_front_mask.png`, PNG.sync.write(mk));
      }
      pieces++;
    }
  }
  console.log(`✓ camadas: ${pieces} peças em ${OUT} (completas: ${[...Object.entries(L.outfits), ...Object.entries(L.hair)].filter(([, f]) => f).map(([id]) => id).join(', ')})`);
}
