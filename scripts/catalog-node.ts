// Lê do disco tudo o que forma o catálogo de tiles (usado pelos scripts e pelos testes).
import { readFileSync } from 'node:fs';
import { buildCatalog, type ExtraSheet, type PiecesFile, type TileCatalog, type TileMeta, type WornTiles } from '../src/core/tiles';

const read = <T>(path: string) => JSON.parse(readFileSync(path, 'utf8')) as T;

interface TilesetsFile {
  sheets: (Omit<ExtraSheet, 'pieces'> & { pieces: string })[];
}

export function readCatalogParts() {
  const csv = readFileSync('data/tiles.csv', 'utf8');
  const meta = read<TileMeta>('data/tiles.meta.json');
  const worn = read<WornTiles>('data/tiles.worn.json');
  const extras: ExtraSheet[] = read<TilesetsFile>('data/tilesets.json').sheets.map((s) => ({
    ...s,
    pieces: read<PiecesFile>(`data/tilesets/${s.pieces}`),
  }));
  return { csv, meta, worn, extras };
}

export function loadCatalogFromDisk(): TileCatalog {
  const { csv, meta, worn, extras } = readCatalogParts();
  return buildCatalog(csv, meta, worn, extras);
}
