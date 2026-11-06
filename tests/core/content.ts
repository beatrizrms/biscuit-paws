// Carrega o conteúdo real de data/ para os testes.
import { readFileSync } from 'node:fs';
import { buildContent, type Content, type RawContent } from '../../src/core/content';
import { buildCatalog, type TileMeta } from '../../src/core/tiles';

const read = <T>(path: string) => JSON.parse(readFileSync(path, 'utf8')) as T;

export function rawContent(): RawContent {
  return {
    catalog: buildCatalog(readFileSync('data/tiles.csv', 'utf8'), read<TileMeta>('data/tiles.meta.json')),
    map: read('data/maps/cafe_main.json'),
    items: read('data/items.json'),
    economy: read('data/economy.json'),
    story: read('data/story.json'),
    dialogue: read('data/dialogue.json'),
  };
}

export function loadContent(): Content {
  return buildContent(rawContent());
}
