// Cômodos do café e passagens entre eles (data/rooms.json): estados, descoberta, abertura,
// restauração, capacidade de gatos e funcionalidades. Puro: sem Phaser, DOM ou window.
// O café é um mapa só (câmera contínua); cada cômodo é uma área dele.
import type { Condition } from './content';
import type { Cell, MapObject } from './map';

export const ROOM_STATES = ['locked', 'discovered', 'abandoned', 'restored'] as const;
/** locked: ninguém sabe que existe (escuro). discovered: ela sabe, mas ainda não entra. abandoned: aberto, sujo. restored: reformado. */
export type RoomState = (typeof ROOM_STATES)[number];

export const DOOR_STATES = ['hidden', 'locked', 'open'] as const;
/** hidden: parece parede. locked: porta fechada (trancada ou esperando a obra). open: passa. */
export type DoorState = (typeof DOOR_STATES)[number];

/** Como o cômodo é descoberto (cada um tem um "momento" na tela). */
export const DISCOVERY_TRIGGERS = ['key_found', 'cat_leads', 'neighbor_tells', 'renovation'] as const;
export type DiscoveryTrigger = (typeof DISCOVERY_TRIGGERS)[number];

/** O que o cômodo libera quando restaurado. */
export const ROOM_FEATURES = ['service', 'sleep', 'playground'] as const;
export type RoomFeature = (typeof ROOM_FEATURES)[number];

/** O visual do cômodo: tiles por letra do mapa (e por estado) e objetos (por estado). */
export interface RoomLook {
  legend?: Record<string, string>;
  legendByState?: Partial<Record<RoomState, Record<string, string>>>;
  objects?: MapObject[];
  objectsByState?: Partial<Record<RoomState, MapObject[]>>;
}

export interface RoomDef {
  /** ID estável (nunca reaproveitado nem renomeado). */
  id: string;
  name: string;
  /** Estado num jogo novo (e em saves que não conheciam o cômodo). */
  initial: RoomState;
  /** Área no mapa do café (células, inclusive). */
  area: { from: Cell; to: Cell };
  /** Ao ar livre: pega a luz do dia/noite com força total (o resto do café é interno). */
  outdoor?: boolean;
  /** Descoberta: o gatilho (só para a cena), a condição (automática) e o momento. */
  discover?: { trigger: DiscoveryTrigger; when?: Condition; dialogue?: string; highlight?: string };
  /** Abrir (discovered -> abandoned): obra paga no catálogo e/ou porta com chave. */
  unlock?: { cost?: number; minCats?: number; beats?: string[]; label?: string; dialogue?: string };
  /** Restaurar (abandoned -> restored): limpar a sujeira com esta tag e pagar a obra; ou sozinho quando `when` valer. */
  restore?: { cost?: number; dirtTag?: string; when?: Condition; label?: string; dialogue?: string };
  /** Quantos gatos moram aqui; clientes: só informação (o atendimento não tem teto fixo). */
  capacity: { cats: number; customers: number };
  features?: RoomFeature[];
  /** Funcionalidade "sleep": a cama (E para dormir) e onde ela acorda. */
  sleep?: { bed: Cell; wake: Cell };
  look?: RoomLook;
  /** Variantes visuais (ex.: quintal "hedge"); `variant` diz qual vale. */
  variants?: Record<string, RoomLook>;
  variant?: string;
}

export interface RoomDoor {
  id: string;
  /** Célula da passagem (no vão da parede divisória). */
  at: Cell;
  /** Os dois cômodos ligados; `to` é o que ela abre. */
  from: string;
  to: string;
  initial: DoorState;
  /** Precisa deste item na bolsa para abrir (ex.: a chave do cadeado). */
  requires?: { item?: string };
  /** Gasta o item ao abrir. */
  consumesItem?: boolean;
  /** Tiles: como parece escondida (parede) e trancada. Aberta não desenha nada (é chão). */
  tiles: { hidden: string; locked: string };
  /** Fala ao tentar passar trancada (sem o item). */
  lockedDialogue?: string;
}

export interface RoomsData {
  schemaVersion: number;
  _comment?: string;
  rooms: RoomDef[];
  doors: RoomDoor[];
  /** Playground do quintal: módulos (itens com `tag`) só neste cômodo e com `minCats` gatos; pontos de afeto por dia. */
  playground: { room: string; tag: string; minCats: number; pointsPerModulePerDay: number };
}

/** Estados atuais (o save guarda só o que mudou; o resto vem de `initial`). */
export interface RoomsState {
  rooms: Record<string, RoomState>;
  doors: Record<string, DoorState>;
}

export const stateIndex = (s: RoomState) => ROOM_STATES.indexOf(s);
export const atLeast = (s: RoomState, min: RoomState) => stateIndex(s) >= stateIndex(min);
/** Dá para entrar (aberto, sujo ou reformado). */
export const isOpen = (s: RoomState) => atLeast(s, 'abandoned');

export function roomState(data: RoomsData, st: RoomsState, roomId: string): RoomState {
  return st.rooms[roomId] ?? data.rooms.find((r) => r.id === roomId)?.initial ?? 'locked';
}

export function doorState(data: RoomsData, st: RoomsState, doorId: string): DoorState {
  return st.doors[doorId] ?? data.doors.find((d) => d.id === doorId)?.initial ?? 'hidden';
}

export function inArea(room: RoomDef, [c, r]: Cell): boolean {
  return c >= room.area.from[0] && c <= room.area.to[0] && r >= room.area.from[1] && r <= room.area.to[1];
}

/** Cômodo de uma célula (paredes divisórias e portas não são de nenhum). */
export function roomAt(data: RoomsData, cell: Cell): RoomDef | undefined {
  return data.rooms.find((r) => inArea(r, cell));
}

/** Capacidade de gatos: soma dos cômodos abertos (sujos ou reformados). */
export function catCapacity(data: RoomsData, st: RoomsState): number {
  return data.rooms.filter((r) => isOpen(roomState(data, st, r.id))).reduce((n, r) => n + r.capacity.cats, 0);
}

/** Funcionalidades ligadas: as dos cômodos restaurados. */
export function activeFeatures(data: RoomsData, st: RoomsState): Set<RoomFeature> {
  const out = new Set<RoomFeature>();
  for (const r of data.rooms) if (roomState(data, st, r.id) === 'restored') for (const f of r.features ?? []) out.add(f);
  return out;
}

/** Retângulo (células) que a câmera pode mostrar: os cômodos que não estão ocultos. */
export function visibleArea(data: RoomsData, st: RoomsState): { from: Cell; to: Cell } | null {
  const shown = data.rooms.filter((r) => roomState(data, st, r.id) !== 'locked');
  if (shown.length === 0) return null;
  // Inclui as paredes/portas entre cômodos vizinhos que aparecem.
  const from: Cell = [Math.min(...shown.map((r) => r.area.from[0])), Math.min(...shown.map((r) => r.area.from[1]))];
  const to: Cell = [Math.max(...shown.map((r) => r.area.to[0])), Math.max(...shown.map((r) => r.area.to[1]))];
  return { from, to };
}

/** O visual valendo: o base + a variante escolhida; tiles e objetos do estado atual por cima. */
export function resolvedLook(room: RoomDef, state: RoomState): { legend: Record<string, string>; objects: MapObject[] } {
  const looks = [room.look, room.variant ? room.variants?.[room.variant] : undefined].filter((l): l is RoomLook => !!l);
  const legend: Record<string, string> = {};
  const objects: MapObject[] = [];
  for (const l of looks) Object.assign(legend, l.legend ?? {}, l.legendByState?.[state] ?? {});
  for (const l of looks) objects.push(...(l.objects ?? []), ...(l.objectsByState?.[state] ?? []));
  return { legend, objects };
}

export type OpenProblem = 'not_discovered' | 'already_open' | 'needs_money' | 'needs_cats' | 'needs_beat' | 'needs_item';
export type RestoreProblem = 'not_open' | 'already_restored' | 'still_dirty' | 'needs_money' | 'automatic';

/** Por que não dá para abrir agora (ou null). `viaDoor`: a porta com o item na mão (sem obra paga). */
export function openProblem(
  data: RoomsData,
  st: RoomsState,
  roomId: string,
  ctx: { money: number; cats: number; beats: readonly string[]; has: (item: string) => boolean },
): OpenProblem | null {
  const room = data.rooms.find((r) => r.id === roomId);
  if (!room) return 'not_discovered';
  const s = roomState(data, st, roomId);
  if (isOpen(s)) return 'already_open';
  if (s === 'locked') return 'not_discovered';
  const u = room.unlock ?? {};
  if ((u.beats ?? []).some((b) => !ctx.beats.includes(b))) return 'needs_beat';
  if (ctx.cats < (u.minCats ?? 0)) return 'needs_cats';
  if (ctx.money < (u.cost ?? 0)) return 'needs_money';
  const keyDoor = data.doors.find((d) => d.to === roomId && d.requires?.item);
  if (keyDoor && !ctx.has(keyDoor.requires!.item!)) return 'needs_item';
  return null;
}

/** Por que não dá para terminar a reforma agora (ou null). `dirty`: quantas sujeiras do cômodo faltam. */
export function restoreProblem(data: RoomsData, st: RoomsState, roomId: string, ctx: { money: number; dirty: number }): RestoreProblem | null {
  const room = data.rooms.find((r) => r.id === roomId);
  const s = roomState(data, st, roomId);
  if (!room || !isOpen(s)) return 'not_open';
  if (s === 'restored') return 'already_restored';
  if (room.restore?.when) return 'automatic';
  if (ctx.dirty > 0) return 'still_dirty';
  if (ctx.money < (room.restore?.cost ?? 0)) return 'needs_money';
  return null;
}

/** Saves antigos ou editados: estado que não existe some (volta ao `initial`); cômodo/porta que sumiu é ignorado. */
export function normalizeRoomsState(data: RoomsData, raw: { rooms?: unknown; doors?: unknown } | undefined): RoomsState {
  const out: RoomsState = { rooms: {}, doors: {} };
  const rooms = (raw?.rooms ?? {}) as Record<string, unknown>;
  const doors = (raw?.doors ?? {}) as Record<string, unknown>;
  for (const r of data.rooms) {
    const v = rooms[r.id];
    if (typeof v === 'string' && (ROOM_STATES as readonly string[]).includes(v)) out.rooms[r.id] = v as RoomState;
  }
  for (const d of data.doors) {
    const v = doors[d.id];
    if (typeof v === 'string' && (DOOR_STATES as readonly string[]).includes(v)) out.doors[d.id] = v as DoorState;
  }
  return out;
}

export function validateRooms(
  data: RoomsData,
  refs: { cols: number; rows: number; items: ReadonlySet<string>; tiles: ReadonlySet<string>; dialogues: ReadonlySet<string>; beats: ReadonlySet<string>; dirtTags: ReadonlySet<string> },
): string[] {
  const errors: string[] = [];
  const ids = new Set<string>();
  const inMap = ([c, r]: Cell) => c >= 0 && r >= 0 && c < refs.cols && r < refs.rows;
  for (const r of data.rooms) {
    const w = `rooms: "${r.id}"`;
    if (!r.id.startsWith('room.')) errors.push(`${w}: id deve começar com "room."`);
    if (ids.has(r.id)) errors.push(`${w}: id repetido`);
    ids.add(r.id);
    if (!(ROOM_STATES as readonly string[]).includes(r.initial)) errors.push(`${w}: estado inicial inválido "${r.initial}"`);
    if (!inMap(r.area.from) || !inMap(r.area.to) || r.area.from[0] > r.area.to[0] || r.area.from[1] > r.area.to[1]) errors.push(`${w}: área fora do mapa`);
    if (r.discover && !(DISCOVERY_TRIGGERS as readonly string[]).includes(r.discover.trigger)) errors.push(`${w}: gatilho de descoberta inválido "${r.discover.trigger}"`);
    for (const dlg of [r.discover?.dialogue, r.unlock?.dialogue, r.restore?.dialogue]) if (dlg && !refs.dialogues.has(dlg)) errors.push(`${w}: fala inexistente "${dlg}"`);
    for (const b of r.unlock?.beats ?? []) if (!refs.beats.has(b)) errors.push(`${w}: marco inexistente "${b}"`);
    if (r.restore?.dirtTag && !refs.dirtTags.has(r.restore.dirtTag)) errors.push(`${w}: nenhuma sujeira com a tag "${r.restore.dirtTag}"`);
    for (const f of r.features ?? []) if (!(ROOM_FEATURES as readonly string[]).includes(f)) errors.push(`${w}: funcionalidade inválida "${f}"`);
    if (r.features?.includes('sleep') && (!r.sleep || !inArea(r, r.sleep.bed) || !inArea(r, r.sleep.wake))) errors.push(`${w}: "sleep" precisa de cama e lugar de acordar dentro do cômodo`);
    if (r.variant && !r.variants?.[r.variant]) errors.push(`${w}: variante inexistente "${r.variant}"`);
    for (const look of [r.look, ...Object.values(r.variants ?? {})]) {
      if (!look) continue;
      const tiles = [...Object.values(look.legend ?? {}), ...Object.values(look.legendByState ?? {}).flatMap((m) => Object.values(m ?? {}))];
      const objects = [...(look.objects ?? []), ...Object.values(look.objectsByState ?? {}).flatMap((o) => o ?? [])];
      for (const t of [...tiles, ...objects.map((o) => o.tile)]) if (!refs.tiles.has(t)) errors.push(`${w}: tile inexistente "${t}"`);
      for (const o of objects) if (!inArea(r, o.at)) errors.push(`${w}: objeto "${o.id}" fora do cômodo`);
    }
    if (!(r.capacity.cats >= 0) || !(r.capacity.customers >= 0)) errors.push(`${w}: capacidade inválida`);
  }
  for (const d of data.doors) {
    const w = `rooms: porta "${d.id}"`;
    if (!d.id.startsWith('door.')) errors.push(`${w}: id deve começar com "door."`);
    if (!ids.has(d.from) || !ids.has(d.to)) errors.push(`${w}: liga cômodo inexistente`);
    if (!inMap(d.at)) errors.push(`${w}: fora do mapa`);
    if (d.requires?.item && !refs.items.has(d.requires.item)) errors.push(`${w}: item inexistente "${d.requires.item}"`);
    for (const t of [d.tiles.hidden, d.tiles.locked]) if (!refs.tiles.has(t)) errors.push(`${w}: tile inexistente "${t}"`);
    if (d.lockedDialogue && !refs.dialogues.has(d.lockedDialogue)) errors.push(`${w}: fala inexistente "${d.lockedDialogue}"`);
    if (!(DOOR_STATES as readonly string[]).includes(d.initial)) errors.push(`${w}: estado inicial inválido`);
  }
  for (const r of data.rooms) if (r.discover?.highlight && !data.doors.some((d) => d.id === r.discover!.highlight)) errors.push(`rooms: "${r.id}" destaca porta inexistente "${r.discover.highlight}"`);
  if (!ids.has(data.playground.room)) errors.push(`rooms: playground em cômodo inexistente "${data.playground.room}"`);
  return errors;
}
