// Gera data/tiles.json a partir de data/tiles.csv (do pacote), data/tiles.meta.json (nosso)
// e data/tiles.worn.json (tiles velhos gerados por npm run art).
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { buildCatalog, type TileMeta, type WornTiles } from '../src/core/tiles';

const csv = readFileSync('data/tiles.csv', 'utf8');
const meta = JSON.parse(readFileSync('data/tiles.meta.json', 'utf8')) as TileMeta;
const worn = JSON.parse(readFileSync('data/tiles.worn.json', 'utf8')) as WornTiles;
const catalog = buildCatalog(csv, meta, worn);

// Só grava se mudou: regravar à toa faz o Vite recarregar o jogo aberto (e testes em andamento).
const json = JSON.stringify(catalog, null, 2) + '\n';
if (!existsSync('data/tiles.json') || readFileSync('data/tiles.json', 'utf8') !== json) {
  writeFileSync('data/tiles.json', json);
}
console.log(`tiles.json: ${Object.keys(catalog.tiles).length} tiles`);
