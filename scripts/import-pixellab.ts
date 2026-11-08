// npx tsx scripts/import-pixellab.ts (npm run pixellab): junta numa folha de 64 px (resolução 2, decisão 052)
// as peças geradas no PixelLab e aprovadas, e escreve o JSON de peças.
// Os PNGs baixados ficam em assets/_pixellab/<lote>/ e a folha vai para public/assets (os dois fora do Git).
// Cada peça encosta a base no fim das suas células: `dy` desce o desenho quando sobra margem embaixo.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { PNG } from 'pngjs';

const TS = 64;

interface Piece {
  file: string;
  col: number;
  row: number;
  w: number;
  h: number;
  dy?: number;
}

interface Sheet {
  source: string;
  image: string;
  pieces: string;
  columns: number;
  rows: number;
  layout: Record<string, Piece>;
}

const SHEETS: Sheet[] = [
  {
    source: 'assets/_pixellab/lote01',
    image: 'public/assets/objects/pixellab/tile_pixellab_lote01.png',
    pieces: 'data/tilesets/pixellab_lote01.json',
    columns: 4,
    rows: 2,
    layout: {
      door_closed: { file: 'door64x128.png', col: 0, row: 0, w: 1, h: 2, dy: 3 },
      door_open: { file: 'door64x128_aberta.png', col: 1, row: 0, w: 1, h: 2, dy: 3 },
      cookie_jar_a_full: { file: 'obj_7.png', col: 2, row: 0, w: 1, h: 1 },
      cookie_jar_a_empty: { file: 'obj_7_vazio.png', col: 2, row: 1, w: 1, h: 1 },
      cookie_jar_b_full: { file: 'obj_9.png', col: 3, row: 0, w: 1, h: 1 },
      cookie_jar_b_empty: { file: 'obj_9_vazio.png', col: 3, row: 1, w: 1, h: 1 },
    },
  },
];

for (const sheet of SHEETS) {
  const out = new PNG({ width: sheet.columns * TS, height: sheet.rows * TS });
  const pieces: Record<string, { col: number; row: number; w_tiles: number; h_tiles: number }> = {};
  for (const [name, p] of Object.entries(sheet.layout)) {
    const png = PNG.sync.read(readFileSync(`${sheet.source}/${p.file}`));
    if (png.width !== p.w * TS || png.height !== p.h * TS) {
      throw new Error(`${p.file}: ${png.width}x${png.height}, esperado ${p.w * TS}x${p.h * TS} (${p.w}x${p.h} tiles)`);
    }
    const dy = p.dy ?? 0;
    for (let y = 0; y + dy < png.height; y++) {
      for (let x = 0; x < png.width; x++) {
        const src = (y * png.width + x) * 4;
        const dst = ((p.row * TS + y + dy) * out.width + p.col * TS + x) * 4;
        png.data.copy(out.data, dst, src, src + 4);
      }
    }
    pieces[name] = { col: p.col, row: p.row, w_tiles: p.w, h_tiles: p.h };
  }
  mkdirSync(sheet.image.slice(0, sheet.image.lastIndexOf('/')), { recursive: true });
  writeFileSync(sheet.image, PNG.sync.write(out));
  writeFileSync(sheet.pieces, JSON.stringify({ tileSize: TS, columns: sheet.columns, rows: sheet.rows, pieces }, null, 1) + '\n');
  console.log(`${sheet.image}: ${Object.keys(pieces).length} peças`);
}
