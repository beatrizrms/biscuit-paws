// Gera data/tiles.json: folha do café (tiles.csv + tiles.meta.json), tiles velhos (tiles.worn.json)
// e folhas extras (tilesets.json: rua, neve, sujeira).
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { loadCatalogFromDisk } from './catalog-node';

const catalog = loadCatalogFromDisk();

// Só grava se mudou: regravar à toa faz o Vite recarregar o jogo aberto (e testes em andamento).
const json = JSON.stringify(catalog, null, 2) + '\n';
if (!existsSync('data/tiles.json') || readFileSync('data/tiles.json', 'utf8') !== json) {
  writeFileSync('data/tiles.json', json);
}
console.log(`tiles.json: ${Object.keys(catalog.tiles).length} tiles em ${Object.keys(catalog.sheets).length} folhas`);
