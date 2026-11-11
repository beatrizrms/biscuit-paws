// Calendário: estações de N dias (data/seasons.json), a partir do dia do jogo (o save já guarda o dia).
// E a rua de cada estação: mesmos lugares, folhas da estação (sem neve fora do inverno).
// Puro: sem Phaser, DOM ou window.
import { parseClock } from './time';
import type { MapData, MapObject } from './map';
import { createRng, pickWeighted } from './rng';

export interface SeasonalMap {
  /** Prefixos de tile que têm versão por estação: "street_" -> "spring_street_" (o inverno é o nome sem prefixo). */
  prefixes: string[];
  /** Tiles e camadas que só existem no inverno (neve por cima): somem nas outras estações. */
  snowPrefix: string;
  /** Peças de inverno sem par nas outras estações que devem sumir (abeto de Natal, pegadas). As outras sem par ficam como estão. */
  winterOnly?: string[];
}

/** Dia importante no app "Calendário" (data/seasons.json: events). */
export interface CalendarEvent {
  id: string;
  title: string;
  /** Dia do jogo (1 = o primeiro) ou o primeiro dia de uma estação (no primeiro ano). */
  day?: number;
  fromSeason?: string;
  /** Repete todo ano (Natal, Ano Novo). */
  everyYear?: boolean;
  /** Some do calendário quando esta condição vale (ex.: a inauguração já aconteceu). */
  hideWhen?: unknown;
}

/** Uma marcação no calendário: um evento ou o começo de uma estação. */
export interface CalendarEntry {
  id: string;
  day: number;
  title: string;
  kind: 'season' | 'event';
}

export interface SeasonsData {
  schemaVersion: number;
  _comment?: string;
  daysPerSeason: number;
  /** Dia da semana do primeiro dia do jogo (0 = segunda ... 6 = domingo). */
  startWeekday: number;
  /** "Começa a primavera"...: título do primeiro dia de cada estação no calendário. */
  seasonStarts: Record<string, string>;
  events: CalendarEvent[];
  /** Clima: pesos por estação (snow, rain, wind, sun...). Sorteado por dia, sem guardar nada no save. */
  weather?: Record<string, Record<string, number>>;
  /** Clima garantido em alguns dias (ex.: neve na véspera e no dia de Natal), por cima do sorteio. */
  weatherFixed?: { season: string; from: number; to: number; weather: string }[];
  /** O que cai na tela em cada clima (os que não estão aqui, como o sol, não mostram nada). */
  weatherFx?: Record<string, WeatherFx>;
  /** Ordem das estações; o jogo começa na primeira. */
  order: string[];
  /** Estação cujos tiles são os nomes sem prefixo (a arte de inverno veio primeiro). */
  base: string;
  names: Record<string, string>;
  maps: Record<string, SeasonalMap>;
  /** Peças que trocam de arte com a estação e com a noite (o céu do quintal): tileVariantOf. */
  tileVariants?: TileVariants;
}

/** tile -> a arte de cada estação de dia e de noite (falta: a de dia, e depois a original). A noite começa em nightFrom. */
export interface TileVariants {
  nightFrom: string;
  tiles: Record<string, { day?: Record<string, string>; night?: Record<string, string> }>;
}

/** A arte da peça agora: a da estação (de noite, a da noite), ou a própria peça. */
export function tileVariantOf(v: TileVariants | undefined, tile: string, season: string, night: boolean): string {
  const t = v?.tiles[tile];
  if (!t) return tile;
  return (night ? t.night?.[season] : undefined) ?? t.day?.[season] ?? tile;
}

/** Já é noite para as peças com variante (a partir de nightFrom; antes do dia começar também). */
export function variantNight(v: TileVariants | undefined, time: number): boolean {
  if (!v) return false;
  const from = parseClock(v.nightFrom);
  return time >= from;
}

export const WEATHER_PARTICLES = ['streak', 'flake', 'leaf'] as const;
export type WeatherParticle = (typeof WEATHER_PARTICLES)[number];

/** Partículas de um clima (data/seasons.json: weatherFx). Velocidades em px do mundo por segundo. */
export interface WeatherFx {
  particle: WeatherParticle;
  /** Quantas partículas vivas por tile da área, em média. */
  perTile: number;
  lifespan: [number, number];
  speedX: [number, number];
  speedY: [number, number];
  alpha: number;
  colors: string[];
  /** Cores por estação (as folhas: rosas e verdes na primavera, verdes no verão); sem a estação, colors. */
  seasonColors?: Record<string, string[]>;
  spin?: boolean;
  /** Véu por cima da área (a chuva escurece um pouco). */
  darken?: { color: string; alpha: number };
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

/** Clima do dia (sorteio com semente do dia, pelos pesos da estação). Sem pesos para a estação: "sun". */
export function weatherOf(data: SeasonsData, day: number): string {
  const d = dayInSeason(data, day);
  const fixed = data.weatherFixed?.find((f) => f.season === seasonOf(data, day) && d >= f.from && d <= f.to);
  if (fixed) return fixed.weather;
  const weights = data.weather?.[seasonOf(data, day)];
  if (!weights) return 'sun';
  return pickWeighted(createRng(Math.imul(Math.max(1, day), 2654435761) ^ 0x5eed), weights);
}

/** Dias do ano (todas as estações). */
export function yearLength(data: SeasonsData): number {
  return data.daysPerSeason * data.order.length;
}

/**
 * Marcações do calendário de `from` a `to` (dias do jogo, inclusive), em ordem: começos de estação e eventos
 * (os com hideWhen valendo ficam de fora; `hidden` avalia a condição).
 */
export function calendarEntries(data: SeasonsData, from: number, to: number, hidden: (e: CalendarEvent) => boolean = () => false): CalendarEntry[] {
  const out: CalendarEntry[] = [];
  const year = yearLength(data);
  for (let d = Math.max(1, from); d <= to; d++) {
    if ((d - 1) % data.daysPerSeason === 0) {
      const season = seasonOf(data, d);
      if (d > 1) out.push({ id: `season.${season}.${d}`, day: d, title: data.seasonStarts[season] ?? data.names[season] ?? season, kind: 'season' });
    }
  }
  for (const e of data.events) {
    if (hidden(e)) continue;
    const first = e.day ?? (e.fromSeason ? firstDayOf(data, e.fromSeason) : 0);
    if (first < 1) continue;
    for (let d = first; d <= to; d += year) {
      if (d >= from) out.push({ id: e.id, day: d, title: e.title, kind: 'event' });
      if (!e.everyYear) break;
    }
  }
  return out.sort((a, b) => a.day - b.day || (a.kind === 'season' ? -1 : 1));
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
  for (const s of data.order) if (!data.seasonStarts?.[s]) errors.push(`seasons: falta seasonStarts de "${s}"`);
  for (const f of data.weatherFixed ?? []) {
    if (!data.order.includes(f.season)) errors.push(`seasons: weatherFixed com estação inexistente "${f.season}"`);
    if (!(f.from >= 1 && f.to >= f.from && f.to <= data.daysPerSeason)) errors.push(`seasons: weatherFixed ${f.season} ${f.from}-${f.to} fora da estação`);
    if (!Object.values(data.weather ?? {}).some((w) => f.weather in w)) errors.push(`seasons: weatherFixed com clima desconhecido "${f.weather}"`);
  }
  if (data.tileVariants) {
    try {
      parseClock(data.tileVariants.nightFrom);
    } catch {
      errors.push(`seasons: tileVariants.nightFrom com hora inválida "${data.tileVariants.nightFrom}"`);
    }
    for (const [tile, v] of Object.entries(data.tileVariants.tiles)) {
      if (!refs.tiles.has(tile)) errors.push(`seasons: tileVariants com tile inexistente "${tile}"`);
      for (const [season, to] of [...Object.entries(v.day ?? {}), ...Object.entries(v.night ?? {})]) {
        if (!data.order.includes(season)) errors.push(`seasons: tileVariants "${tile}" com estação desconhecida "${season}"`);
        if (!refs.tiles.has(to)) errors.push(`seasons: tileVariants "${tile}" troca por tile inexistente "${to}"`);
      }
    }
  }
  for (const [w, fx] of Object.entries(data.weatherFx ?? {})) {
    if (!(WEATHER_PARTICLES as readonly string[]).includes(fx.particle)) errors.push(`seasons: weatherFx "${w}" com partícula desconhecida "${fx.particle}"`);
    if (!(fx.perTile > 0) || !(fx.lifespan[0] > 0) || fx.lifespan[1] < fx.lifespan[0]) errors.push(`seasons: weatherFx "${w}" com perTile ou lifespan inválido`);
    if (fx.colors.length === 0 || fx.colors.some((c) => !/^#[0-9a-f]{6}$/i.test(c))) errors.push(`seasons: weatherFx "${w}" precisa de cores #rrggbb`);
    for (const [season, list] of Object.entries(fx.seasonColors ?? {})) {
      if (!data.order.includes(season)) errors.push(`seasons: weatherFx "${w}" tem cores para estação desconhecida "${season}"`);
      if (list.length === 0 || list.some((c) => !/^#[0-9a-f]{6}$/i.test(c))) errors.push(`seasons: weatherFx "${w}" precisa de cores #rrggbb em ${season}`);
    }
  }
  const ids = new Set<string>();
  for (const e of data.events ?? []) {
    if (!e.id.startsWith('cal.')) errors.push(`seasons: evento "${e.id}" deve começar com "cal."`);
    if (ids.has(e.id)) errors.push(`seasons: evento repetido "${e.id}"`);
    ids.add(e.id);
    if ((e.day === undefined) === (e.fromSeason === undefined)) errors.push(`seasons: evento "${e.id}" precisa de day ou de fromSeason (só um)`);
    if (e.day !== undefined && !(Number.isInteger(e.day) && e.day >= 1)) errors.push(`seasons: evento "${e.id}" com day inválido`);
    if (e.fromSeason !== undefined && !data.order.includes(e.fromSeason)) errors.push(`seasons: evento "${e.id}" com estação inexistente "${e.fromSeason}"`);
  }
  for (const [mapId, cfg] of Object.entries(data.maps)) {
    if (!refs.maps.has(mapId)) errors.push(`seasons: mapa inexistente "${mapId}"`);
    for (const s of data.order.filter((x) => x !== data.base)) {
      for (const p of cfg.prefixes) if (![...refs.tiles].some((t) => t.startsWith(`${s}_${p}`))) errors.push(`seasons: nenhum tile "${s}_${p}*" (rode npm run seasons)`);
    }
  }
  return errors;
}
