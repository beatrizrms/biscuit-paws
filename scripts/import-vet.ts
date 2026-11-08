// npx tsx scripts/import-vet.ts: copia os pacotes da clínica veterinária (assets/_originais_pacotes, fora do Git)
// para public/assets (também fora do Git), já com os nomes da convenção (docs/ASSET_REORGANIZATION.md):
// - veterinaria_medica: a Fernanda (folha 128x256, 32x64) e o retrato 64x64;
// - veterinaria_interior: tiles e peças soltas juntados numa folha de 8 colunas, com o JSON das posições
//   (data/tilesets/vet_clinic.json, que o build-tiles lê). Peça mais baixa que a célula (a placa de 64x16)
//   fica embaixo da célula, como as outras peças de parede.
// Não muda os arquivos originais. Rode de novo se os pacotes forem atualizados.
import { copyFileSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { PNG } from 'pngjs';

const TILE = 32;
const COLUMNS = 8;
const MEDICA = 'assets/_originais_pacotes/veterinaria_medica';
const INTERIOR = 'assets/_originais_pacotes/veterinaria_interior';

// A Fernanda.
mkdirSync('public/assets/characters/npcs', { recursive: true });
copyFileSync(`${MEDICA}/medica_vet_spritesheet.png`, 'public/assets/characters/npcs/npc_fernanda.png');
copyFileSync(`${MEDICA}/medica_vet_retrato_64.png`, 'public/assets/characters/npcs/npc_fernanda_portrait.png');

// O interior: tiles primeiro (1x1), depois as peças, das maiores para as menores (empacotamento em prateleiras).
const pieces = [
  ...readdirSync(`${INTERIOR}/tiles`).map((f) => ({ dir: 'tiles', file: f })),
  ...readdirSync(`${INTERIOR}/pecas`).map((f) => ({ dir: 'pecas', file: f })),
]
  .filter((p) => p.file.endsWith('.png'))
  .map((p) => {
    const img = PNG.sync.read(readFileSync(`${INTERIOR}/${p.dir}/${p.file}`));
    return { name: p.file.replace(/\.png$/, ''), img, w: Math.ceil(img.width / TILE), h: Math.ceil(img.height / TILE), tile: p.dir === 'tiles' };
  })
  .sort((a, b) => Number(b.tile) - Number(a.tile) || b.h - a.h || b.w - a.w || a.name.localeCompare(b.name));

// Prateleiras: cada linha de peças tem a altura da peça mais alta dela.
const placed: { name: string; col: number; row: number; w: number; h: number; img: PNG }[] = [];
let col = 0;
let row = 0;
let shelf = 0;
for (const p of pieces) {
  if (col + p.w > COLUMNS) {
    col = 0;
    row += shelf;
    shelf = 0;
  }
  placed.push({ name: p.name, col, row, w: p.w, h: p.h, img: p.img });
  col += p.w;
  shelf = Math.max(shelf, p.h);
}
const rows = row + shelf;
const png = new PNG({ width: COLUMNS * TILE, height: rows * TILE });
for (const p of placed) {
  // Peça mais baixa que as células dela: encostada embaixo.
  const dy = p.h * TILE - p.img.height;
  for (let y = 0; y < p.img.height; y++) {
    for (let x = 0; x < p.img.width; x++) {
      const i = (y * p.img.width + x) * 4;
      const o = ((p.row * TILE + y + dy) * png.width + p.col * TILE + x) * 4;
      for (let k = 0; k < 4; k++) png.data[o + k] = p.img.data[i + k]!;
    }
  }
}
mkdirSync('public/assets/interiors/vet_clinic', { recursive: true });
writeFileSync('public/assets/interiors/vet_clinic/tile_vet_clinic.png', PNG.sync.write(png));

const json = {
  tileSize: TILE,
  columns: COLUMNS,
  rows,
  pieces: Object.fromEntries(
    [...placed].sort((a, b) => a.name.localeCompare(b.name)).map((p) => [p.name, { col: p.col, row: p.row, w_tiles: p.w, h_tiles: p.h, first_tile_id: p.row * COLUMNS + p.col }]),
  ),
};
writeFileSync('data/tilesets/vet_clinic.json', JSON.stringify(json, null, 1) + '\n');
console.log(`✓ clínica: Fernanda + ${placed.length} peças numa folha ${COLUMNS}x${rows} (public/assets/interiors/vet_clinic)`);
