// Movimento na praça e na rua (data/npcs.json: ambient): das 9h às 21h, figurantes (os clientes) sentados nos bancos,
// em pé nas barracas, conversando em grupinhos e passeando; na rua, gente passando de uma ponta à outra.
// Puro: quem está onde sai de um sorteio com semente por dia e por bloco de horas (o mesmo o bloco inteiro); os
// passantes da rua saem de uma agenda do dia. O jogo só desenha. Com chuva ou neve caindo, vem menos gente.
import { crowdLayout, type CrowdArea, type CrowdLayout } from './festivalCrowd';
import type { Cell, Facing } from './map';
import { createRng } from './rng';
import { parseClock } from './time';

/** Lugar fixo: um banco (sentado) ou a frente de uma barraca, do bebedouro, do chafariz (em pé, virado para ela). */
export interface AmbientSpot {
  at: Cell;
  facing: Facing;
  pose: 'sit' | 'stand';
}

export interface AmbientMapDef {
  map: string;
  /** Janela do dia ("HH:MM"). */
  hours: [string, string];
  /** A cada quantos minutos o sorteio muda (uns vão embora, outros chegam). */
  blockMinutes: number;
  spots?: AmbientSpot[];
  /** Quantos lugares fixos ficam ocupados por bloco (sorteado). */
  spotsUsed?: [number, number];
  /** Onde ficam os grupinhos e por onde passeiam os que andam. */
  area?: CrowdArea;
  /** Quantas pessoas em grupinhos (de 2 ou 3) por bloco (sorteado). */
  chatting?: [number, number];
  /** Quantos passeiam pela área. */
  wanderers?: number;
  /** Rua: gente passando. A cada `everyMinutes`, chance de alguém atravessar entre duas pontas de `ends`. */
  passers?: { ends: Cell[]; everyMinutes: number; chance: number };
}

export interface AmbientDef {
  /** Figurantes (NPCs com folha de caminhada e pose sentada). Cada um aparece uma vez por mapa. */
  npcs: string[];
  /** Com chuva ou neve caindo, a gente que vem é multiplicada por isto (arredondado para baixo). */
  badWeather: number;
  /** Climas que contam como ruins (data/seasons.json: weather). */
  badWeathers: string[];
  /** Falas dos grupinhos (os balõezinhos, em ordem). */
  lines: string[];
  maps: AmbientMapDef[];
}

export interface AmbientLayout extends CrowdLayout {
  /** Quem está num lugar fixo (sentado no banco, em pé na barraca). */
  spots: { npc: string; at: Cell; facing: Facing; pose: 'sit' | 'stand' }[];
  /** Bloco do sorteio (muda a cada blockMinutes): o jogo troca a turma quando ele muda. */
  block: number;
}

export interface AmbientPass {
  npc: string;
  /** Minuto do dia em que entra numa ponta. */
  at: number;
  from: Cell;
  to: Cell;
}

const inHours = (m: AmbientMapDef, time: number) => time >= parseClock(m.hours[0]) && time < parseClock(m.hours[1]);

/** Embaralha com o sorteio dado. */
function shuffled<T>(list: readonly T[], next: () => number): T[] {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

/**
 * Quem está na praça (ou noutro mapa com lugares e área) agora: null fora do horário ou sem nada para mostrar.
 * `free(c, r)`: célula livre para ficar em pé (grupinhos e passeio); `avoid`: células onde ninguém fica (portas,
 * a chegada dela). `exclude`: NPCs que já estão no mapa (um passeio de vizinho, uma cena).
 */
export function ambientLayout(def: AmbientDef, mapId: string, day: number, time: number, weather: string, free: (c: number, r: number) => boolean, avoid: readonly Cell[] = [], exclude: readonly string[] = []): AmbientLayout | null {
  const m = def.maps.find((x) => x.map === mapId);
  if (!m || !inHours(m, time) || (!m.spots?.length && !m.area)) return null;
  const block = Math.floor((time - parseClock(m.hours[0])) / m.blockMinutes);
  const rng = createRng(day * 104729 + block * 7919 + mapId.length * 31);
  const next = () => rng.next();
  const scale = def.badWeathers.includes(weather) ? def.badWeather : 1;
  const pool = shuffled(def.npcs.filter((id) => !exclude.includes(id)), next);
  // Os lugares fixos primeiro (bancos e barracas); quem sobra conversa e passeia.
  const wanted = Math.floor(rng.int(m.spotsUsed?.[0] ?? 0, m.spotsUsed?.[1] ?? 0) * scale);
  const spotCells = shuffled(m.spots ?? [], next).slice(0, Math.min(wanted, pool.length));
  const spots = spotCells.map((s, i) => ({ npc: pool[i]!, at: s.at, facing: s.facing, pose: s.pose }));
  const rest = pool.slice(spots.length);
  const chatting = Math.min(rest.length, Math.floor(rng.int(m.chatting?.[0] ?? 0, m.chatting?.[1] ?? 0) * scale));
  const wanderers = Math.min(rest.length - chatting, Math.floor((m.wanderers ?? 0) * scale));
  const crowd = m.area && chatting + wanderers > 0
    ? crowdLayout({ npcs: rest, people: [chatting + wanderers, chatting + wanderers], walkers: wanderers, until: m.hours[1], lines: def.lines }, m.area, free, [...avoid, ...spots.map((s) => s.at)], rng)
    : { groups: [], walkers: [] };
  if (spots.length === 0 && crowd.groups.length === 0 && crowd.walkers.length === 0) return null;
  return { spots, groups: crowd.groups, walkers: crowd.walkers, block };
}

/**
 * Agenda de quem passa pela rua hoje: a cada everyMinutes da janela, com a chance (menor com chuva ou neve), alguém
 * entra numa ponta e sai noutra. Ninguém repete enquanto ainda está atravessando (`crossMinutes`).
 */
export function ambientPasses(def: AmbientDef, mapId: string, day: number, weather: string, crossMinutes: number): AmbientPass[] {
  const m = def.maps.find((x) => x.map === mapId);
  const p = m?.passers;
  if (!m || !p || p.ends.length < 2) return [];
  const rng = createRng(day * 6151 + mapId.length * 17);
  const chance = p.chance * (def.badWeathers.includes(weather) ? def.badWeather : 1);
  const busyUntil: Record<string, number> = {};
  const out: AmbientPass[] = [];
  for (let t = parseClock(m.hours[0]); t < parseClock(m.hours[1]); t += p.everyMinutes) {
    if (!rng.chance(chance)) continue;
    const at = t + rng.int(0, p.everyMinutes - 1);
    const npc = shuffled(def.npcs, () => rng.next()).find((id) => (busyUntil[id] ?? -1) <= at);
    if (!npc) continue;
    const from = p.ends[rng.int(0, p.ends.length - 1)]!;
    const others = p.ends.filter((e) => Math.abs(e[0] - from[0]) >= 8);
    if (others.length === 0) continue;
    const to = others[rng.int(0, others.length - 1)]!;
    busyUntil[npc] = at + crossMinutes;
    out.push({ npc, at, from, to });
  }
  return out;
}

/** Quem deve estar atravessando a rua agora (começou há menos de crossMinutes). */
export function passesNow(passes: readonly AmbientPass[], time: number, crossMinutes: number): AmbientPass[] {
  return passes.filter((p) => time >= p.at && time < p.at + crossMinutes);
}

export function validateAmbient(def: AmbientDef | undefined, npcs: ReadonlySet<string>, maps: ReadonlySet<string>): string[] {
  if (!def) return [];
  const errors: string[] = [];
  for (const id of def.npcs) if (!npcs.has(id)) errors.push(`npcs: ambient com NPC inexistente "${id}"`);
  if (!(def.badWeather >= 0 && def.badWeather <= 1)) errors.push('npcs: ambient.badWeather precisa estar entre 0 e 1');
  for (const m of def.maps) {
    if (!maps.has(m.map)) errors.push(`npcs: ambient com mapa inexistente "${m.map}"`);
    if (!m.hours.every((h) => /^\d{1,2}:\d{2}$/.test(h))) errors.push(`npcs: ambient ${m.map} com hora inválida`);
    if (!(m.blockMinutes > 0)) errors.push(`npcs: ambient ${m.map} blockMinutes precisa ser > 0`);
    if (m.passers && (m.passers.ends.length < 2 || !(m.passers.everyMinutes > 0))) errors.push(`npcs: ambient ${m.map} passers precisa de 2 pontas e everyMinutes > 0`);
  }
  return errors;
}
