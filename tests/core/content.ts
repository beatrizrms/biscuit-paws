// Carrega o conteúdo real de data/ para os testes.
import { readFileSync, readdirSync } from 'node:fs';
import { loadCatalogFromDisk } from '../../scripts/catalog-node';
import { buildContent, type Content, type RawContent } from '../../src/core/content';
import type { MapData } from '../../src/core/map';

const read = <T>(path: string) => JSON.parse(readFileSync(path, 'utf8')) as T;

export function rawContent(): RawContent {
  return {
    catalog: loadCatalogFromDisk(),
    maps: readdirSync('data/maps')
      .filter((f) => f.endsWith('.json'))
      .map((f) => read<MapData>(`data/maps/${f}`)),
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
  };
}

export function loadContent(): Content {
  return buildContent(rawContent());
}
