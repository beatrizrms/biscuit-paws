// npm run check: valida todo o conteúdo em data/ (mapas, itens, história, falas, economia, reforma).
import { readFileSync, readdirSync } from 'node:fs';
import { validateContent, type RawContent } from '../src/core/content';
import type { MapData } from '../src/core/map';

const read = <T>(path: string) => JSON.parse(readFileSync(path, 'utf8')) as T;
const maps = readdirSync('data/maps')
  .filter((f) => f.endsWith('.json'))
  .map((f) => read<MapData>(`data/maps/${f}`));

const raw: RawContent = {
  catalog: read('data/tiles.json'),
  maps,
  world: read('data/world.json'),
  items: read('data/items.json'),
  finishes: read('data/finishes.json'),
  economy: read('data/economy.json'),
  story: read('data/story.json'),
  dialogue: read('data/dialogue.json'),
  cats: read('data/cats.json'),
  catSprites: read('data/cat_sprites.json'),
  cutscenes: read('data/cutscenes.json'),
  relationships: read('data/relationships.json'),
  shops: read('data/shops.json'),
  icons: read('data/icons.json'),
  npcs: read('data/npcs.json'),
  scripts: read('data/scripts.json'),
  dayNight: read('data/daynight.json'),
  recipes: read('data/recipes.json'),
  emotes: read('data/emotes.json'),
  jobs: read('data/jobs.json'),
  news: read('data/news.json'),
  delivery: read('data/delivery.json'),
};

const errors = validateContent(raw);
if (errors.length > 0) {
  console.error(`✗ conteúdo com problemas:\n  ${errors.join('\n  ')}`);
  process.exit(1);
}
console.log(
  `✓ mapas (${maps.map((m) => m.id).join(', ')}), itens (${raw.items.items.length}), história (${raw.story.beats.length} marcos), falas, reforma`,
);
