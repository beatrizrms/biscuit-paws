// npm run check: valida todos os mapas em data/maps contra o catálogo de tiles.
import { readFileSync, readdirSync } from 'node:fs';
import { validateMap, type MapData } from '../src/core/map';
import type { TileCatalog } from '../src/core/tiles';

const catalog = JSON.parse(readFileSync('data/tiles.json', 'utf8')) as TileCatalog;
const files = readdirSync('data/maps').filter((f) => f.endsWith('.json'));
let failed = false;

for (const file of files) {
  const map = JSON.parse(readFileSync(`data/maps/${file}`, 'utf8')) as MapData;
  const errors = validateMap(map, catalog);
  if (errors.length > 0) {
    failed = true;
    console.error(`✗ ${file}\n  ${errors.join('\n  ')}`);
  } else {
    console.log(`✓ ${file} (${map.size.cols}x${map.size.rows}, ${map.objects.length} objetos)`);
  }
}
process.exit(failed ? 1 : 0);
