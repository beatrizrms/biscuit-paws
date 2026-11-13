// A plateia dos eventos no quintal (feira de adoção, Dia do Gato, concurso de fofura): no dia, com a placa na porta,
// vizinhos e clientes passeiam pelo quintal e conversam em grupinhos de 2 ou 3, virados uns para os outros.
// Puro: quem vem, onde fica cada grupo e por onde andam os que passeiam saem de um sorteio com semente (o mesmo no
// dia inteiro). O jogo só desenha os NPCs e os balõezinhos de conversa (data/festivals.json: crowd).
import type { Cell, Facing } from './map';
import type { Rng } from './rng';
import { parseClock } from './time';

export interface CrowdDef {
  /** Quem pode vir (NPCs com folha de caminhada; os clientes). */
  npcs: string[];
  /** Amigos que vêm sempre, depois de ela os conhecer (`when`: condição das metas); ficam nos grupinhos. */
  friends?: { npc: string; when?: unknown }[];
  /** Células do quintal que ficam livres (a chegada da Jacque na primeira feira anda por elas). */
  keepFree?: Cell[];
  /** Quantas pessoas, no mínimo e no máximo (sorteado por dia). */
  people: [number, number];
  /** Quantas delas passeiam (o resto fica em grupinhos de 2 ou 3). */
  walkers: number;
  /** Até que hora ficam no quintal ("20:00"). */
  until: string;
  /** Falas dos balõezinhos de conversa, em ordem (o jogo vai passando uma a uma). */
  lines: string[];
}

export interface CrowdMember {
  npc: string;
  at: Cell;
  facing: Facing;
}

export interface CrowdLayout {
  /** Grupinhos parados conversando (2 ou 3 cada). */
  groups: CrowdMember[][];
  /** Quem passeia: começa no primeiro ponto e vai de um a outro, em volta. */
  walkers: { npc: string; path: Cell[] }[];
}

export interface CrowdArea {
  from: Cell;
  to: Cell;
}

/** Os grupos: dupla (um de frente para o outro) e trio (o terceiro atrás, no meio, olhando para baixo). */
const SHAPES: Record<2 | 3, { dc: number; dr: number; facing: Facing }[]> = {
  2: [{ dc: 0, dr: 0, facing: 'right' }, { dc: 1, dr: 0, facing: 'left' }],
  3: [{ dc: 0, dr: 0, facing: 'right' }, { dc: 2, dr: 0, facing: 'left' }, { dc: 1, dr: -1, facing: 'down' }],
};

/** Os tamanhos dos grupos para `n` pessoas paradas: de 2 e 3 (nunca sobra uma sozinha). */
function groupSizes(n: number, rng: Rng): (2 | 3)[] {
  const out: (2 | 3)[] = [];
  let left = n;
  while (left > 0) {
    if (left === 1) {
      // Uma sobrando entra no último grupo de 2 (vira trio) ou fica de fora.
      const i = out.lastIndexOf(2);
      if (i >= 0) out[i] = 3;
      break;
    }
    const size: 2 | 3 = left === 2 || left === 4 ? 2 : left === 3 ? 3 : rng.chance(0.5) ? 2 : 3;
    out.push(size);
    left -= size;
  }
  return out;
}

/**
 * Monta a plateia do dia: `free(c, r)` diz se a célula está livre (sem móvel, parede ou água), `area` é o quintal e
 * `avoid` são células onde ninguém fica (os pontos do evento, a porta; os NPCs não bloqueiam a personagem, então
 * basta não ficar em cima). Cada grupo ocupa células livres com uma célula de folga dos outros; quem passeia ganha 4
 * pontos livres para ir e voltar.
 */
export function crowdLayout(def: CrowdDef, area: CrowdArea, free: (c: number, r: number) => boolean, avoid: readonly Cell[], rng: Rng, friends: readonly string[] = []): CrowdLayout {
  const taken = new Set<string>();
  const key = (c: number, r: number) => `${c},${r}`;
  const blocked = new Set<string>();
  for (const [c, r] of [...avoid, ...(def.keepFree ?? [])]) blocked.add(key(c, r));
  const inside = (c: number, r: number) => c >= area.from[0] && c <= area.to[0] && r >= area.from[1] && r <= area.to[1];
  const ok = (c: number, r: number) => inside(c, r) && free(c, r) && !blocked.has(key(c, r)) && !taken.has(key(c, r));
  const cells: Cell[] = [];
  for (let r = area.from[1]; r <= area.to[1]; r++) for (let c = area.from[0]; c <= area.to[0]; c++) if (inside(c, r) && free(c, r) && !blocked.has(key(c, r))) cells.push([c, r]);
  const pick = (): Cell | undefined => cells[Math.floor(rng.next() * cells.length)];

  const shuffle = <T>(list: T[]): T[] => {
    for (let i = list.length - 1; i > 0; i--) {
      const j = Math.floor(rng.next() * (i + 1));
      [list[i], list[j]] = [list[j]!, list[i]!];
    }
    return list;
  };
  // Quem vem: os amigos (sempre, nos grupinhos) e, do resto embaralhado, os primeiros até completar.
  const pool = shuffle(def.npcs.filter((id) => !friends.includes(id)));
  const people = Math.min(pool.length + friends.length, Math.max(friends.length, rng.int(def.people[0], def.people[1])));
  const walking = Math.min(def.walkers, people - friends.length, pool.length);
  const standing = shuffle([...friends, ...pool.slice(walking, people - friends.length)]);
  const groups: CrowdMember[][] = [];
  let next = 0;
  for (const size of groupSizes(standing.length, rng)) {
    const shape = SHAPES[size];
    for (let tries = 0; tries < 80; tries++) {
      const anchor = pick();
      if (!anchor) break;
      const spots = shape.map((s): Cell => [anchor[0] + s.dc, anchor[1] + s.dr]);
      if (!spots.every(([c, r]) => ok(c, r))) continue;
      // Folga de uma célula em volta do grupo (os grupos não se encostam).
      for (const [c, r] of spots) for (let dc = -1; dc <= 1; dc++) for (let dr = -1; dr <= 1; dr++) taken.add(key(c + dc, r + dr));
      groups.push(spots.map((at, i) => ({ npc: standing[next + i]!, at, facing: shape[i]!.facing })));
      break;
    }
    next += size;
  }
  const walkers: { npc: string; path: Cell[] }[] = [];
  for (const npc of pool.slice(0, walking)) {
    const path: Cell[] = [];
    for (let tries = 0; tries < 40 && path.length < 4; tries++) {
      const at = pick();
      if (at && ok(at[0], at[1])) path.push(at);
    }
    if (path.length >= 2) walkers.push({ npc, path });
  }
  return { groups, walkers };
}

/** A plateia ainda está no quintal a esta hora? */
export function crowdStays(def: CrowdDef, time: number): boolean {
  return time < parseClock(def.until);
}

export function validateCrowd(def: CrowdDef | undefined, npcs: ReadonlySet<string>): string[] {
  if (!def) return [];
  const errors: string[] = [];
  for (const id of [...def.npcs, ...(def.friends ?? []).map((f) => f.npc)]) if (!npcs.has(id)) errors.push(`festivals: crowd com NPC inexistente "${id}"`);
  const [min, max] = def.people;
  if (!(min >= 2 && max >= min)) errors.push('festivals: crowd.people precisa ser [mínimo >= 2, máximo >= mínimo]');
  if (!(def.walkers >= 0)) errors.push('festivals: crowd.walkers precisa ser 0 ou mais');
  if (!/^\d{1,2}:\d{2}$/.test(def.until)) errors.push(`festivals: crowd.until com hora inválida "${def.until}"`);
  if (def.lines.length === 0) errors.push('festivals: crowd.lines vazio');
  return errors;
}
