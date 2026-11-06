// Gera data/tiles.json a partir de data/tiles.csv (do pacote) + data/tiles.meta.json (nosso).
import { readFileSync, writeFileSync } from 'node:fs';
import { buildCatalog, type TileMeta } from '../src/core/tiles';

const csv = readFileSync('data/tiles.csv', 'utf8');
const meta = JSON.parse(readFileSync('data/tiles.meta.json', 'utf8')) as TileMeta;
const catalog = buildCatalog(csv, meta);
writeFileSync('data/tiles.json', JSON.stringify(catalog, null, 2) + '\n');
console.log(`tiles.json: ${Object.keys(catalog.tiles).length} tiles`);
