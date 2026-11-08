// npx tsx scripts/import-pixellab.ts (npm run pixellab): junta numa folha de 64 px (resolução 2, decisão 052)
// as peças geradas no PixelLab e aprovadas, e escreve o JSON de peças.
// Os PNGs baixados ficam em assets/_pixellab/<pasta>/ e a folha vai para public/assets (os dois fora do Git).
// Cada peça encosta a base no fim das suas células: `dy` desce o desenho quando sobra margem embaixo.
// Folhas com `auto` arrumam as peças sozinhas (da esquerda para a direita, `columns` tiles por linha).
// `recolor` troca uma faixa de matiz por outra (cores alternativas por código, decisão 065);
// `mirror` espelha; `over` desenha outra imagem por cima (ex.: registradora sobre o balcão);
// `rows` remonta a peça com linhas escolhidas da origem; `wear` faz a versão velha (piso e parede antes da reforma).
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { PNG } from 'pngjs';

const TS = 64;
const SRC = 'assets/_pixellab';

interface Recolor {
  /** Faixa de matiz de origem, em graus (pode dar a volta: [330, 20]). */
  from: [number, number];
  /** Matiz novo, em graus. */
  hue: number;
  /** Multiplica a saturação (padrão 1). */
  sat?: number;
  /** Soma à luminosidade, de -1 a 1 (padrão 0). */
  light?: number;
}

interface Piece {
  /** Arquivo em assets/_pixellab (ou vazio quando a peça é desenhada por `build`). */
  file: string;
  /** Desenha a peça por código (teias grandes, raio de sol, poeira montada com pedaços). */
  build?: () => PNG;
  w: number;
  h: number;
  col?: number;
  row?: number;
  dy?: number;
  mirror?: boolean;
  recolor?: Recolor;
  over?: { file: string; dx: number; dy: number };
  /** Monta a peça com estas linhas da origem, na ordem (ex.: esticar o lambri repetindo as tábuas). */
  rows?: number[];
  /** Versão velha (antes da reforma): mais escura, desbotada e com pintinhas de sujeira. */
  wear?: boolean;
  /** Quantas variações seguidas na linha (com wear: cada uma com outra semente de sujeira). */
  variants?: number;
}

interface Sheet {
  image: string;
  pieces: string;
  columns: number;
  rows?: number;
  auto?: boolean;
  layout: Record<string, Piece>;
}

const range = (a: number, b: number) => Array.from({ length: b - a + 1 }, (_, i) => a + i);

const PINK: [number, number] = [330, 25];
const GREEN: [number, number] = [70, 170];

const SHEETS: Sheet[] = [
  {
    image: 'public/assets/objects/pixellab/tile_pixellab_lote01.png',
    pieces: 'data/tilesets/pixellab_lote01.json',
    columns: 4,
    rows: 2,
    layout: {
      door_closed: { file: 'lote01/door64x128.png', col: 0, row: 0, w: 1, h: 2, dy: 3 },
      door_open: { file: 'lote01/door64x128_aberta.png', col: 1, row: 0, w: 1, h: 2, dy: 3 },
      cookie_jar_a_full: { file: 'lote01/obj_7.png', col: 2, row: 0, w: 1, h: 1 },
      cookie_jar_a_empty: { file: 'lote01/obj_7_vazio.png', col: 2, row: 1, w: 1, h: 1 },
      cookie_jar_b_full: { file: 'lote01/obj_9.png', col: 3, row: 0, w: 1, h: 1 },
      cookie_jar_b_empty: { file: 'lote01/obj_9_vazio.png', col: 3, row: 1, w: 1, h: 1 },
    },
  },
  {
    // Arte nova do café: os nomes são os tiles que já existem (tilesets.json: replaces).
    image: 'public/assets/objects/pixellab/tile_pixellab_cafe.png',
    pieces: 'data/tilesets/pixellab_cafe.json',
    columns: 12,
    auto: true,
    layout: {
      cat_tree: { file: '01_cafe_1/arvore_gato_vazia.png', w: 2, h: 3 },
      floor_rug: { file: '01_cafe_1/tapete_a_vazio.png', w: 3, h: 2 },
      cat_condo: { file: '01_cafe_1/torre_gato_vazia.png', w: 2, h: 2 },
      window: { file: '02_cafe_2/janela_fechada_128.png', w: 2, h: 2 },
      bookshelf: { file: '02_cafe_2/estante_64x128.png', w: 1, h: 2 },
      plant_tall: { file: '02_cafe_2/planta_alta_a.png', w: 1, h: 2 },
      door: { file: 'lote01/door64x128.png', w: 1, h: 2, dy: 3 },
      sofa: { file: '03_cafe_3/sofa_128x64.png', w: 2, h: 1, recolor: { from: PINK, hue: 150, sat: 0.7 } },
      display_case: { file: '03_cafe_3/vitrine_cheia_128x64.png', w: 2, h: 1 },
      menu_board: { file: '03_cafe_3/lousa_a.png', w: 2, h: 1 },
      table_round: { file: 'piloto01/obj_7.png', w: 1, h: 1 },
      chair_front: { file: '02_cafe_2/cadeira_frente.png', w: 1, h: 1 },
      chair_left: { file: '02_cafe_2/cadeira_esq.png', w: 1, h: 1 },
      chair_right: { file: '02_cafe_2/cadeira_dir.png', w: 1, h: 1 },
      chair_back: { file: '02_cafe_2/cadeira_costas.png', w: 1, h: 1 },
      plant_pot: { file: 'piloto01/obj_13.png', w: 1, h: 1 },
      plant_hanging: { file: '05_06_cafe/obj_1.png', w: 1, h: 1 },
      cat_bed: { file: 'piloto01/obj_9.png', w: 1, h: 1 },
      food_bowl: { file: 'lote01/obj_0.png', w: 1, h: 1 },
      water_bowl: { file: 'lote01/obj_3.png', w: 1, h: 1 },
      cushion_pink: { file: 'piloto01/obj_8.png', w: 1, h: 1 },
      cushion_mint: { file: 'piloto01/obj_8.png', w: 1, h: 1, recolor: { from: PINK, hue: 150, sat: 0.7 } },
      cushion_sky: { file: 'piloto01/obj_8.png', w: 1, h: 1, recolor: { from: PINK, hue: 205, sat: 0.8 } },
      cushion_lav: { file: 'piloto01/obj_8.png', w: 1, h: 1, recolor: { from: PINK, hue: 265, sat: 0.7 } },
      cushion_butter: { file: 'piloto01/obj_8.png', w: 1, h: 1, recolor: { from: PINK, hue: 42, sat: 1.5, light: -0.06 } },
      picture_paw: { file: 'piloto01/obj_14.png', w: 1, h: 1 },
      flower_vase: { file: 'piloto01/obj_12.png', w: 1, h: 1 },
      yarn_balls: { file: '05_06_cafe/obj_13.png', w: 1, h: 1 },
      scratch_post: { file: 'piloto01/obj_10.png', w: 1, h: 1 },
      cactus: { file: 'piloto01/obj_5.png', w: 1, h: 1 },
      doormat: { file: '04_cafe_4/obj_7.png', w: 1, h: 1 },
      counter_left: { file: '01_cafe_1/balcao_esq.png', w: 1, h: 1 },
      counter_mid: { file: '01_cafe_1/balcao_meio.png', w: 1, h: 1 },
      counter_right: { file: '01_cafe_1/balcao_dir.png', w: 1, h: 1 },
      counter_single: { file: '01_cafe_1/balcao_unica.png', w: 1, h: 1 },
      counter_register: { file: '01_cafe_1/balcao_meio.png', w: 1, h: 1, over: { file: 'mercado_A/obj_0.png', dx: 0, dy: -30 } },
      bar_balcao_esq: { file: '01_cafe_1/balcao_esq.png', w: 1, h: 1 },
      bar_balcao_meio: { file: '01_cafe_1/balcao_meio.png', w: 1, h: 1 },
      bar_balcao_dir: { file: '01_cafe_1/balcao_dir.png', w: 1, h: 1 },
      wall_shelf: { file: 'cafe_superficies/prateleira_2x1.png', w: 2, h: 1 },
      wall_clock: { file: 'cafe_superficies/relogio.png', w: 1, h: 1 },
    },
  },
  {
    // Pisos e paredes do café (acabamentos do pintor e as versões velhas, antes da reforma).
    image: 'public/assets/interiors/cafe/tile_pixellab_cafe_superficies.png',
    pieces: 'data/tilesets/pixellab_cafe_superficies.json',
    columns: 6,
    auto: true,
    layout: {
      floor_wood_a: { file: 'cafe_superficies/tile_0.png', w: 1, h: 1 },
      floor_wood_b: { file: 'cafe_superficies/tile_1.png', w: 1, h: 1 },
      floor_check_pink: { file: 'cafe_superficies/tile_2.png', w: 1, h: 1 },
      floor_tile_mint: { file: 'cafe_superficies/tile_3.png', w: 1, h: 1 },
      wall_stripe_pink: { file: 'cafe_superficies/tile_4.png', w: 1, h: 1 },
      wall_dots_cream: { file: 'cafe_superficies/tile_5.png', w: 1, h: 1 },
      wall_mint: { file: 'cafe_superficies/tile_6.png', w: 1, h: 1 },
      wall_wainscot: { file: 'cafe_superficies/tile_7.png', w: 1, h: 1, rows: [...range(26, 33), ...range(34, 63), ...range(34, 59)] },
      floor_wood_old: { file: 'cafe_superficies/tile_0.png', w: 1, h: 1, wear: true, variants: 4 },
      floor_check_old: { file: 'cafe_superficies/tile_2.png', w: 1, h: 1, wear: true, variants: 4 },
      wall_stripe_old: { file: 'cafe_superficies/tile_4.png', w: 1, h: 1, wear: true, variants: 4 },
      wall_wainscot_old: { file: 'cafe_superficies/tile_7.png', w: 1, h: 1, rows: [...range(26, 33), ...range(34, 63), ...range(34, 59)], wear: true, variants: 4 },
    },
  },
  {
    // Cores novas do café (itens novos): nomes novos, não trocam nada.
    image: 'public/assets/objects/pixellab/tile_pixellab_cafe_cores.png',
    pieces: 'data/tilesets/pixellab_cafe_cores.json',
    columns: 6,
    auto: true,
    layout: {
      sofa_rosa: { file: '03_cafe_3/sofa_128x64.png', w: 2, h: 1 },
      sofa_ceu: { file: '03_cafe_3/sofa_128x64.png', w: 2, h: 1, recolor: { from: PINK, hue: 205, sat: 0.8 } },
      cat_bed_rosa: { file: 'piloto01/obj_9.png', w: 1, h: 1, recolor: { from: GREEN, hue: 350, sat: 1.9, light: 0.03 } },
      cat_bed_lilas: { file: 'piloto01/obj_9.png', w: 1, h: 1, recolor: { from: GREEN, hue: 268, sat: 1.7, light: 0.03 } },
    },
  },
  {
    // Sujeira do café (antes da faxina): troca a arte das peças dirt_* (mesmos nomes e tamanhos).
    // Reaproveita as peças do café abandonado e as sujeiras do PixelLab; teias grandes e raio de sol por código.
    image: 'public/assets/objects/dirt/tile_dirt_pixellab.png',
    pieces: 'data/tilesets/sujeira_pixellab.json',
    columns: 8,
    auto: true,
    layout: {
      dirt_raio_de_sol: { file: '', w: 2, h: 3, build: () => sunbeam(128, 192) },
      dirt_teia_canto_grande_esq: { file: '', w: 2, h: 2, build: () => web(128, 112, false) },
      dirt_teia_canto_grande_dir: { file: '', w: 2, h: 2, build: () => web(128, 112, true) },
      dirt_teia_janela: { file: '', w: 2, h: 2, build: () => windowWebs() },
      dirt_poeira_densa: { file: '', w: 2, h: 2, build: () => compose(128, 128, [['cafe_sujeira/obj_0.png', 0, 4], ['cafe_sujeira/obj_8.png', 60, 10], ['cafe_sujeira/obj_1.png', 30, 56], ['cafe_sujeira/obj_0.png', 66, 62]]) },
      dirt_poeira_c: { file: '', w: 2, h: 1, build: () => compose(128, 64, [['cafe_sujeira/obj_0.png', 0, 0], ['cafe_sujeira/obj_8.png', 62, 2]]) },
      dirt_teia_fio_aranha: { file: 'cafe_sujeira/fio_aranha.png', w: 1, h: 2, recolor: { from: [0, 360], hue: 30, sat: 0.08 } },
      dirt_escorrido_parede: { file: '', w: 1, h: 2, build: () => clearTop(readPng(`${SRC}/cafe_sujeira/escorrido.png`), 12) },
      dirt_teia_canto_esq: { file: 'fachadas/abandonado/obj_6.png', w: 1, h: 1 },
      dirt_teia_canto_dir: { file: 'fachadas/abandonado/obj_6.png', w: 1, h: 1, mirror: true },
      dirt_poeira_a: { file: 'cafe_sujeira/obj_0.png', w: 1, h: 1 },
      dirt_poeira_b: { file: 'cafe_sujeira/obj_1.png', w: 1, h: 1 },
      dirt_mancha_agua: { file: 'fachadas/abandonado/obj_4.png', w: 1, h: 1 },
      dirt_mancha_bolor: { file: 'fachadas/abandonado/obj_11.png', w: 1, h: 1 },
      dirt_mancha_fuligem: { file: 'cafe_sujeira/obj_6.png', w: 1, h: 1 },
      dirt_rachadura_a: { file: 'fachadas/abandonado/obj_2.png', w: 1, h: 1 },
      dirt_rachadura_b: { file: 'fachadas/abandonado/obj_3.png', w: 1, h: 1 },
      dirt_vidro_quebrado: { file: 'fachadas/abandonado/obj_8.png', w: 1, h: 1 },
      dirt_papeis_chao: { file: 'cafe_sujeira/obj_2.png', w: 1, h: 1 },
      dirt_folhas_secas: { file: 'fachadas/abandonado/obj_14.png', w: 1, h: 1 },
      dirt_buraco_rato: { file: 'cafe_sujeira/obj_10.png', w: 1, h: 1 },
      dirt_balde_goteira: { file: 'cafe_sujeira/obj_4.png', w: 1, h: 1 },
      dirt_particulas_poeira: { file: 'cafe_sujeira/obj_5.png', w: 1, h: 1 },
    },
  },
];

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h * 60, s, l];
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1));
  return [Math.round(f(0) * 255), Math.round(f(8) * 255), Math.round(f(4) * 255)];
}

const inRange = (h: number, [a, b]: [number, number]) => (a <= b ? h >= a && h <= b : h >= a || h <= b);

function recolor(png: PNG, rc: Recolor): void {
  for (let i = 0; i < png.data.length; i += 4) {
    if (!png.data[i + 3]) continue;
    const [h, s, l] = rgbToHsl(png.data[i]!, png.data[i + 1]!, png.data[i + 2]!);
    if (s < 0.12 || !inRange(h, rc.from)) continue;
    const [r, g, b] = hslToRgb(rc.hue, Math.min(1, s * (rc.sat ?? 1)), Math.max(0, Math.min(1, l + (rc.light ?? 0))));
    png.data[i] = r; png.data[i + 1] = g; png.data[i + 2] = b;
  }
}

function load(p: Piece, variant = 0): PNG {
  let png: PNG = p.build ? p.build() : PNG.sync.read(readFileSync(`${SRC}/${p.file}`));
  if (png.width !== p.w * TS || png.height !== p.h * TS) {
    throw new Error(`${p.file}: ${png.width}x${png.height}, esperado ${p.w * TS}x${p.h * TS} (${p.w}x${p.h} tiles)`);
  }
  if (p.rows) png = pickRows(png, p.rows);
  if (p.recolor) recolor(png, p.recolor);
  if (p.wear) wear(png, 7 + variant * 101);
  if (p.over) {
    const o = PNG.sync.read(readFileSync(`${SRC}/${p.over.file}`));
    for (let y = 0; y < o.height; y++) for (let x = 0; x < o.width; x++) {
      const X = x + p.over.dx, Y = y + p.over.dy;
      if (X < 0 || Y < 0 || X >= png.width || Y >= png.height) continue;
      const s = (y * o.width + x) * 4, d = (Y * png.width + X) * 4, a = o.data[s + 3]! / 255;
      if (!a) continue;
      for (let c = 0; c < 3; c++) png.data[d + c] = Math.round(o.data[s + c]! * a + png.data[d + c]! * (1 - a));
      png.data[d + 3] = Math.max(png.data[d + 3]!, o.data[s + 3]!);
    }
  }
  return png;
}

/** Nova imagem com as linhas escolhidas da origem (mesma largura). */
function pickRows(src: PNG, rows: number[]): PNG {
  const out = new PNG({ width: src.width, height: rows.length });
  rows.forEach((sy, y) => src.data.copy(out.data, y * src.width * 4, sy * src.width * 4, (sy + 1) * src.width * 4));
  return out;
}

/** Piso/parede velhos: mais escuros e desbotados, com pintinhas de sujeira (semente fixa: sempre igual). */
function wear(png: PNG, seed = 7): void {
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < png.data.length; i += 4) {
    const r = png.data[i]!, g = png.data[i + 1]!, b = png.data[i + 2]!, l = (r + g + b) / 3;
    const dirt = rnd() < 0.04 ? 0.78 : 1;
    png.data[i] = Math.round((r * 0.7 + l * 0.3) * 0.86 * dirt + 6);
    png.data[i + 1] = Math.round((g * 0.7 + l * 0.3) * 0.84 * dirt + 4);
    png.data[i + 2] = Math.round((b * 0.7 + l * 0.3) * 0.8 * dirt);
  }
}

/** Arruma as peças em linhas de `columns` tiles, na ordem da lista. */
function autoLayout(sheet: Sheet): number {
  let col = 0, row = 0, rowH = 0;
  for (const p of Object.values(sheet.layout)) {
    if (col + p.w * (p.variants ?? 1) > sheet.columns) { row += rowH; col = 0; rowH = 0; }
    p.col = col; p.row = row;
    col += p.w * (p.variants ?? 1); rowH = Math.max(rowH, p.h);
  }
  return row + rowH;
}

for (const sheet of SHEETS) {
  const rows = sheet.auto ? autoLayout(sheet) : sheet.rows!;
  const out = new PNG({ width: sheet.columns * TS, height: rows * TS });
  const pieces: Record<string, { col: number; row: number; w_tiles: number; h_tiles: number; variants?: number }> = {};
  for (const [name, p] of Object.entries(sheet.layout)) {
    for (let v = 0; v < (p.variants ?? 1); v++) {
      const png = load(p, v);
      const dy = p.dy ?? 0;
      for (let y = 0; y + dy < png.height; y++) {
        for (let x = 0; x < png.width; x++) {
          const sx = p.mirror ? png.width - 1 - x : x;
          const src = (y * png.width + sx) * 4;
          const dst = ((p.row! * TS + y + dy) * out.width + (p.col! + v * p.w) * TS + x) * 4;
          png.data.copy(out.data, dst, src, src + 4);
        }
      }
    }
    pieces[name] = { col: p.col!, row: p.row!, w_tiles: p.w, h_tiles: p.h, ...(p.variants ? { variants: p.variants } : {}) };
  }
  mkdirSync(sheet.image.slice(0, sheet.image.lastIndexOf('/')), { recursive: true });
  writeFileSync(sheet.image, PNG.sync.write(out));
  writeFileSync(sheet.pieces, JSON.stringify({ tileSize: TS, columns: sheet.columns, rows, pieces }, null, 1) + '\n');
  console.log(`${sheet.image}: ${Object.keys(pieces).length} peças`);
}

// ---------- Sujeira desenhada por código ----------

function readPng(path: string): PNG {
  return PNG.sync.read(readFileSync(path));
}

function blank(w: number, h: number): PNG {
  return new PNG({ width: w, height: h });
}

function plot(png: PNG, x: number, y: number, rgb: [number, number, number], a = 255): void {
  if (x < 0 || y < 0 || x >= png.width || y >= png.height) return;
  const d = (y * png.width + x) * 4;
  png.data[d] = rgb[0]; png.data[d + 1] = rgb[1]; png.data[d + 2] = rgb[2]; png.data[d + 3] = Math.max(png.data[d + 3]!, a);
}

function line(png: PNG, x0: number, y0: number, x1: number, y1: number, rgb: [number, number, number], a = 255): void {
  x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
  const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  for (;;) {
    plot(png, x0, y0, rgb, a);
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) { err += dy; x0 += sx; }
    if (e2 <= dx) { err += dx; y0 += sy; }
  }
}

/** Teia de canto: raios saindo do canto de cima e fios em arco (pontos dos raios ligados). */
function web(w: number, r: number, mirror: boolean): PNG {
  const png = blank(w, w);
  const light: [number, number, number] = [214, 210, 202], dark: [number, number, number] = [150, 146, 140];
  const spokes = [0, 14, 30, 46, 62, 78, 90].map((d) => (d * Math.PI) / 180);
  const pt = (ang: number, rad: number): [number, number] => {
    const x = Math.cos(ang) * rad, y = Math.sin(ang) * rad;
    return [mirror ? w - 1 - x : x, y];
  };
  for (const a of spokes) { const [x, y] = pt(a, r); line(png, mirror ? w - 1 : 0, 0, x, y, dark, 230); }
  for (const rad of [18, 34, 52, 72, 94]) {
    if (rad > r) break;
    for (let i = 0; i < spokes.length - 1; i++) {
      const [x0, y0] = pt(spokes[i]!, rad - 3 + (i % 2) * 4), [x1, y1] = pt(spokes[i + 1]!, rad + 1 - (i % 2) * 3);
      line(png, x0, y0, x1, y1, i % 2 ? light : dark, 210);
    }
  }
  return png;
}

/** Teias na janela: duas teias pequenas nos cantos de cima e alguns fios soltos. */
function windowWebs(): PNG {
  const png = blank(128, 128), l = web(128, 46, false), rr = web(128, 46, true);
  for (let i = 0; i < png.data.length; i += 4) for (const src of [l, rr]) if (src.data[i + 3]) src.data.copy(png.data, i, i, i + 4);
  const grey: [number, number, number] = [196, 192, 186];
  line(png, 46, 2, 70, 60, grey, 180); line(png, 82, 4, 60, 70, grey, 170); line(png, 64, 0, 64, 90, grey, 150);
  return png;
}

/** Raio de sol: faixa diagonal de luz quente, transparente, com pontinhos de poeira. */
function sunbeam(w: number, h: number): PNG {
  const png = blank(w, h);
  let seed = 11;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const left = 10 + y * 0.42, right = 64 + y * 0.42;
    if (x < left || x > right) continue;
    const edge = Math.min(x - left, right - x);
    const a = Math.min(70, 18 + edge * 2.2) * (1 - y / h * 0.45);
    plot(png, x, y, [255, 236, 170], Math.round(a));
    if (rnd() < 0.006) plot(png, x, y, [255, 250, 225], 200);
  }
  return png;
}

/** Junta pedaços (arquivo, x, y) numa peça maior. */
function compose(w: number, h: number, parts: [string, number, number][]): PNG {
  const png = blank(w, h);
  for (const [file, ox, oy] of parts) {
    const src = readPng(`${SRC}/${file}`);
    for (let y = 0; y < src.height; y++) for (let x = 0; x < src.width; x++) {
      const s = (y * src.width + x) * 4;
      if (!src.data[s + 3]) continue;
      const X = ox + x, Y = oy + y;
      if (X < 0 || Y < 0 || X >= w || Y >= h) continue;
      src.data.copy(png.data, (Y * w + X) * 4, s, s + 4);
    }
  }
  return png;
}

/** Apaga as primeiras linhas (o Pixen desenhou um xadrez de fundo no topo do escorrido). */
function clearTop(png: PNG, rows: number): PNG {
  png.data.fill(0, 0, rows * png.width * 4);
  return png;
}

// Equipamentos e pia: tiras de animação no mesmo arranjo das folhas antigas (parado, preparo, pronto),
// para o jogo continuar igual (tilesets.json: animation). Os quadros de preparo vêm do animate_image do PixelLab;
// o "pronto" é o último quadro com um brilho desenhado por código; a pia ganha louça suja/limpa por cima.
const EQ = `${SRC}/cafe_equip`;

function paste(dst: PNG, src: PNG, col: number, row: number, dx = 0, dy = 0): void {
  for (let y = 0; y < src.height; y++) for (let x = 0; x < src.width; x++) {
    const X = col * TS + x + dx, Y = row * TS + y + dy;
    if (X < col * TS || Y < row * TS || X >= (col + 1) * TS || Y >= (row + 1) * TS) continue;
    const s = (y * src.width + x) * 4, d = (Y * dst.width + X) * 4, a = src.data[s + 3]! / 255;
    if (!a) continue;
    for (let c = 0; c < 3; c++) dst.data[d + c] = Math.round(src.data[s + c]! * a + dst.data[d + c]! * (1 - a) * (dst.data[d + 3]! / 255));
    dst.data[d + 3] = Math.max(dst.data[d + 3]!, src.data[s + 3]!);
  }
}

/** Brilho de "pronto": estrelinha amarela no canto de cima à direita da célula. */
function sparkle(dst: PNG, col: number, row: number): void {
  const cx = col * TS + 54, cy = row * TS + 8;
  const px = (x: number, y: number, rgb: [number, number, number]) => {
    const d = (y * dst.width + x) * 4;
    dst.data[d] = rgb[0]; dst.data[d + 1] = rgb[1]; dst.data[d + 2] = rgb[2]; dst.data[d + 3] = 255;
  };
  for (let k = -4; k <= 4; k++) { px(cx + k, cy, [255, 236, 150]); px(cx, cy + k, [255, 236, 150]); }
  for (let k = -2; k <= 2; k++) { px(cx + k, cy, [255, 250, 220]); px(cx, cy + k, [255, 250, 220]); }
  px(cx, cy, [255, 255, 255]);
}

/** Copia do quadro parado as linhas de cima (o PixelLab desenhou um pão em cima do forno; só a janela anima). */
function keepTop(frame: PNG, base: PNG, rows: number): PNG {
  const out = PNG.sync.read(PNG.sync.write(frame));
  base.data.copy(out.data, 0, 0, rows * base.width * 4);
  return out;
}


interface Strip { image: string; pieces: string; columns: number; rows: { name: string; frames: (dst: PNG, row: number) => void }[] }

const anim = (name: string, i: number) => readPng(`${EQ}/anim_${name}_${i}.png`);
/** Linha padrão: parado, 4 de preparo, pronto (último de preparo + brilho). */
const equipRow = (name: string, work = [1, 2, 3, 4], fix?: (f: PNG) => PNG, ready?: number) => (dst: PNG, row: number) => {
  const f = (i: number) => (fix ? fix(anim(name, i)) : anim(name, i));
  paste(dst, anim(name, 0), 0, row);
  work.forEach((w, k) => paste(dst, f(w), 1 + k, row));
  paste(dst, f(ready ?? work[work.length - 1]!), 5, row);
  sparkle(dst, 5, row);
};

const STRIPS: Strip[] = [
  {
    image: 'public/assets/objects/equipment/anim_kitchen_equipment_pixellab.png',
    pieces: 'data/tilesets/equipamentos.json',
    columns: 6,
    rows: [
      { name: 'bule', frames: equipRow('bule') },
      { name: 'liquidificador', frames: equipRow('liquidificador') },
      { name: 'espremedor', frames: equipRow('espremedor') },
      { name: 'fogao', frames: equipRow('fogao') },
      { name: 'forno', frames: equipRow('forno', [1, 2, 3, 2], (f) => keepTop(f, anim('forno', 0), 22), 3) },
    ],
  },
  { image: 'public/assets/objects/equipment/anim_coffee_maker_pixellab.png', pieces: 'data/tilesets/cafeteira.json', columns: 6, rows: [{ name: 'cafeteira', frames: equipRow('cafeteira') }] },
  {
    image: 'public/assets/objects/equipment/anim_sink_pixellab.png',
    pieces: 'data/tilesets/pia.json',
    columns: 7,
    rows: [{
      name: 'pia',
      // 0 vazia, 1 louça suja, 2-5 lavando, 6 louça limpa (tilesets.json: work [2,5], dirty 1, clean 6).
      frames: (dst, row) => {
        const base = anim('pia', 0);
        paste(dst, base, 0, row);
        paste(dst, base, 1, row); paste(dst, readPng(`${EQ}/obj_7.png`), 1, row, 2, -6);
        [1, 2, 3, 4].forEach((w, k) => paste(dst, anim('pia', w), 2 + k, row));
        paste(dst, base, 6, row); paste(dst, readPng(`${EQ}/obj_8.png`), 6, row, -4, -6);
      },
    }],
  },
];

for (const strip of STRIPS) {
  const out = new PNG({ width: strip.columns * TS, height: strip.rows.length * TS });
  const pieces: Record<string, { col: number; row: number; w_tiles: number; h_tiles: number; first_tile_id: number }> = {};
  strip.rows.forEach((r, row) => {
    r.frames(out, row);
    pieces[r.name] = { col: 0, row, w_tiles: 1, h_tiles: 1, first_tile_id: row * strip.columns };
  });
  writeFileSync(strip.image, PNG.sync.write(out));
  writeFileSync(strip.pieces, JSON.stringify({ tileSize: TS, columns: strip.columns, rows: strip.rows.length, pieces }, null, 1) + '\n');
  console.log(`${strip.image}: ${strip.rows.length} linha(s) de animação`);
}
