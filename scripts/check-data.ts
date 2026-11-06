// npm run check: valida todo o conteúdo em data/ (mapas, itens, história, falas, economia).
import { readFileSync, readdirSync } from 'node:fs';
import { validateContent, type RawContent } from '../src/core/content';
import type { MapData } from '../src/core/map';

const read = <T>(path: string) => JSON.parse(readFileSync(path, 'utf8')) as T;
const shared: Omit<RawContent, 'map'> = {
  catalog: read('data/tiles.json'),
  items: read('data/items.json'),
  finishes: read('data/finishes.json'),
  economy: read('data/economy.json'),
  story: read('data/story.json'),
  dialogue: read('data/dialogue.json'),
};

let failed = false;
for (const file of readdirSync('data/maps').filter((f) => f.endsWith('.json'))) {
  const map = read<MapData>(`data/maps/${file}`);
  const errors = validateContent({ ...shared, map });
  if (errors.length > 0) {
    failed = true;
    console.error(`✗ ${file}\n  ${errors.join('\n  ')}`);
  } else {
    console.log(`✓ ${file} + itens (${shared.items.items.length}), história (${shared.story.beats.length} marcos), falas`);
  }
}
process.exit(failed ? 1 : 0);
