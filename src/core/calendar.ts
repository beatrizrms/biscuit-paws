// Calendário: estações de N dias (data/seasons.json), a partir do dia do jogo (o save já guarda o dia).
// E a rua de cada estação: mesmos lugares, folhas da estação (sem neve fora do inverno).
// Puro: sem Phaser, DOM ou window.
import type { MapData, MapObject } from './map';

export interface SeasonalMap {
  /** Prefixos de tile que têm versão por estação: "street_" -> "spring_street_" (o inverno é o nome sem prefixo). */
  prefixes: string[];
  /** Tiles e camadas que só existem no inverno (neve por cima): somem nas outras estações. */
  snowPrefix: string;
  /** Peças de inverno sem par nas outras estações que devem sumir (abeto de Natal, pegadas). As outras sem par ficam como estão. */
  winterOnly?: string[];
}

export interface SeasonsData {
  schemaVersion: number;
  _comment?: string;
  daysPerSeason: number;
  /** Ordem das estações; o jogo começa na primeira. */
  order: string[];
  /** Estação cujos tiles são os nomes sem prefixo (a arte de inverno veio primeiro). */
  base: string;
  names: Record<string, string>;
  maps: Record<string, SeasonalMap>;
}

/** Estação do dia (1 = primeiro dia do jogo). */
export function seasonOf(data: SeasonsData, day: number): string {
  const i = Math.floor((Math.max(1, day) - 1) / data.daysPerSeason) % data.order.length;
  return data.order[i]!;
}

/** Dia dentro da estação (1..daysPerSeason). */
export function dayInSeason(data: SeasonsData, day: number): number {
  return ((Math.max(1, day) - 1) % data.daysPerSeason) + 1;
}

/** Ano do jogo (1 = o primeiro). */
export function yearOf(data: SeasonsData, day: number): number {
  return Math.floor((Math.max(1, day) - 1) / (data.daysPerSeason * data.order.length)) + 1;
}

/** Primeiro dia (do jogo) em que esta estação começa no primeiro ano. */
export function firstDayOf(data: SeasonsData, season: string): number {
  return Math.max(0, data.order.indexOf(season)) * data.daysPerSeason + 1;
}

/** Quantos dias faltam para a estação começar pela primeira vez (0 se já começou). */
export function daysUntil(data: SeasonsData, day: number, season: string): number {
  return Math.max(0, firstDayOf(data, season) - day);
}

/** Nome de um tile na estação (o da base fica como está). Sem versão na estação: undefined. */
export function seasonalTile(map: SeasonalMap, season: string, base: string, tile: string, exists: (name: string) => boolean): string | undefined {
  if (season === base) return tile;
  if (tile.startsWith(map.snowPrefix)) {
    // Chão com neve: vira o chão sem neve; peça só de neve (montes, neve por cima): some.
    const plain = tile.slice(map.snowPrefix.length);
    return map.prefixes.some((p) => plain.startsWith(p)) ? seasonalTile(map, season, base, plain, exists) : undefined;
  }
  if (!map.prefixes.some((p) => tile.startsWith(p))) return tile;
  const name = `${season}_${tile}`;
  if (exists(name)) return name;
  // Sem arte da estação: some só o que é de inverno (abeto de Natal...); o resto (ex.: a clínica) fica como está.
  return map.winterOnly?.includes(tile) ? undefined : tile;
}

/** O mapa na estação: troca os tiles da legenda e dos objetos; tira a neve e o que só existe no inverno. */
export function mapInSeason(data: SeasonsData, map: MapData, season: string, exists: (name: string) => boolean): MapData {
  const cfg = data.maps[map.id];
  if (!cfg || season === data.base) return map;
  const legend: Record<string, string> = {};
  for (const [k, t] of Object.entries(map.legend)) legend[k] = seasonalTile(cfg, season, data.base, t, exists) ?? t;
  const objects: MapObject[] = [];
  for (const o of map.objects) {
    const tile = seasonalTile(cfg, season, data.base, o.tile, exists);
    if (!tile) continue; // abeto de Natal, montes de neve, pegadas...
    const { overlay: _snow, ...rest } = o;
    objects.push({ ...rest, tile });
  }
  return { ...map, legend, objects };
}

export function validateSeasons(data: SeasonsData, refs: { maps: ReadonlySet<string>; tiles: ReadonlySet<string> }): string[] {
  const errors: string[] = [];
  if (!(data.daysPerSeason >= 1)) errors.push('seasons: daysPerSeason precisa ser 1 ou mais');
  if (data.order.length === 0) errors.push('seasons: order vazio');
  if (!data.order.includes(data.base)) errors.push(`seasons: base "${data.base}" não está em order`);
  for (const s of data.order) if (!data.names[s]) errors.push(`seasons: falta o nome de "${s}"`);
  for (const [mapId, cfg] of Object.entries(data.maps)) {
    if (!refs.maps.has(mapId)) errors.push(`seasons: mapa inexistente "${mapId}"`);
    for (const s of data.order.filter((x) => x !== data.base)) {
      for (const p of cfg.prefixes) if (![...refs.tiles].some((t) => t.startsWith(`${s}_${p}`))) errors.push(`seasons: nenhum tile "${s}_${p}*" (rode npm run seasons)`);
    }
  }
  return errors;
}
