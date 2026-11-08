// npx tsx scripts/import-seasons.ts (npm run seasons): copia a rua de primavera, verão e outono do pacote
// "rua_estacoes_tilesets" (assets/_originais_pacotes, fora do Git) para public/assets/env/street/<estação>/
// (também fora do Git) e escreve o JSON de peças em data/tilesets/. O inverno já vem da importação antiga.
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { PNG } from 'pngjs';

const PACK = 'assets/_originais_pacotes/rua_estacoes_tilesets/pack/tilesets';
const SEASONS = ['spring', 'summer', 'autumn'] as const;
/** Nome no pacote -> nome da folha no jogo (convenção de docs/ASSET_REORGANIZATION.md). */
const SHEETS = { chao: 'ground', objetos: 'props', fachadas: 'facades' } as const;

for (const season of SEASONS) {
  const out = `public/assets/env/street/${season}`;
  mkdirSync(out, { recursive: true });
  for (const [pack, name] of Object.entries(SHEETS)) {
    const src = `${PACK}/${pack}_${season}`;
    const png = PNG.sync.read(readFileSync(`${src}.png`));
    copyFileSync(`${src}.png`, `${out}/tile_street_${name}_${season}.png`);
    const json = JSON.parse(readFileSync(`${src}.json`, 'utf8')) as { tileSize: number; columns: number; rows?: number; pieces: Record<string, unknown> };
    // As linhas da folha vêm da imagem (o JSON do pacote nem sempre traz).
    const pieces = { tileSize: json.tileSize, columns: json.columns, rows: json.rows ?? png.height / json.tileSize, pieces: json.pieces };
    writeFileSync(`data/tilesets/${pack}_${season}.json`, JSON.stringify(pieces, null, 1) + '\n');
  }
}
console.log(`✓ rua: ${SEASONS.join(', ')}`);
