// Passeios de vizinhos na rua (data/npcs.json: walks): em alguns dias, num horário, o vizinho atravessa a rua de uma
// ponta à outra com alguns gatos dele atrás; E nele conversa (uma fala por vez, em ordem) e a primeira conversa do dia
// dá corações. Puro: sem Phaser, DOM ou window.
import type { Cell } from './map';

export interface WalkCat {
  name: string;
  /** Pelagem (data/cat_sprites.json: variants). */
  variant: string;
}

export interface NeighborWalkDef {
  npc: string;
  map: string;
  /** Condição para começar a passear (ex.: depois de conhecê-la). */
  when?: unknown;
  /** Chance de passear em cada dia (sorteio pelo dia: a mesma resposta o dia inteiro). */
  chance: number;
  /** Janela do passeio ("HH:MM"). */
  hours: [string, string];
  /** As duas pontas do passeio (ela vai de uma à outra; o sentido muda pelo dia). */
  path: [Cell, Cell];
  /** Os gatos dela; em cada passeio vão de catsPerWalk[0] a catsPerWalk[1] deles. */
  cats: WalkCat[];
  catsPerWalk: [number, number];
  /** Falas quando ela para para conversar: uma por dia (todas saem antes de alguma repetir). */
  chat: string[];
  /** Corações (pontos) da primeira conversa do dia. */
  points: number;
  /**
   * Balãozinho quando ela passa perto (sem E, uma vez por passeio): falas curtas, com {cat} = o nome de um dos gatos
   * que estão com ela. Não gasta a frase do dia (chat).
   */
  barks?: string[];
}

/** Sorteio estável (0 a 1) por texto. */
function roll(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return (h >>> 0) / 4294967296;
}

/** O passeio do dia: se acontece, em que sentido e com quais gatos (sempre a mesma resposta para o mesmo dia). */
export function walkOfDay(def: NeighborWalkDef, day: number): { walks: boolean; from: Cell; to: Cell; cats: WalkCat[] } {
  const walks = roll(`${def.npc}:${day}:walk`) < def.chance;
  const reverse = roll(`${def.npc}:${day}:dir`) < 0.5;
  const [a, b] = def.path;
  const [min, max] = def.catsPerWalk;
  const n = Math.min(def.cats.length, min + Math.floor(roll(`${def.npc}:${day}:n`) * (max - min + 1)));
  const cats = [...def.cats].sort((x, y) => roll(`${def.npc}:${day}:${x.name}`) - roll(`${def.npc}:${day}:${y.name}`)).slice(0, n);
  return { walks, from: reverse ? b : a, to: reverse ? a : b, cats };
}

/**
 * A fala do dia: a ordem é embaralhada por volta (semente pela volta), então todas saem uma vez antes de alguma
 * repetir; no mesmo dia é sempre a mesma.
 */
export function chatOfDay(def: Pick<NeighborWalkDef, 'npc' | 'chat'>, day: number): string | null {
  const n = def.chat.length;
  if (n === 0) return null;
  const lap = Math.floor(day / n);
  const order = def.chat.map((_, i) => i).sort((a, b) => roll(`${def.npc}:${lap}:${a}`) - roll(`${def.npc}:${lap}:${b}`));
  return def.chat[order[day % n]!]!;
}

/** O balão do passeio do dia (sorteado pelo dia), com {cat} trocado pelo nome de um dos gatos que estão com ela. */
export function barkOfDay(def: Pick<NeighborWalkDef, 'npc' | 'barks'>, day: number, catNames: readonly string[]): string | null {
  const list = def.barks ?? [];
  if (list.length === 0) return null;
  const usable = catNames.length > 0 ? list : list.filter((b) => !b.includes('{cat}'));
  if (usable.length === 0) return null;
  const text = usable[Math.floor(roll(`${def.npc}:${day}:bark`) * usable.length)]!;
  const cat = catNames[Math.floor(roll(`${def.npc}:${day}:barkcat`) * catNames.length)] ?? '';
  return text.replace(/{cat}/g, cat);
}

/** Validação (npm run check). */
export function validateWalks(walks: readonly NeighborWalkDef[] | undefined, refs: { npcs: ReadonlySet<string>; maps: ReadonlySet<string>; variants: ReadonlySet<string> }): string[] {
  const errors: string[] = [];
  const clock = /^\d{2}:\d{2}$/;
  for (const w of walks ?? []) {
    const at = `walks ${w.npc}`;
    if (!refs.npcs.has(w.npc)) errors.push(`${at}: NPC inexistente`);
    if (!refs.maps.has(w.map)) errors.push(`${at}: mapa inexistente "${w.map}"`);
    if (!(w.chance >= 0 && w.chance <= 1)) errors.push(`${at}: chance entre 0 e 1`);
    if (!w.hours.every((h) => clock.test(h))) errors.push(`${at}: hours no formato HH:MM`);
    for (const c of w.cats) if (!refs.variants.has(c.variant)) errors.push(`${at}: pelagem inexistente "${c.variant}" (${c.name})`);
    if (w.catsPerWalk[0] > w.catsPerWalk[1]) errors.push(`${at}: catsPerWalk [mín, máx]`);
    if (w.chat.length === 0) errors.push(`${at}: precisa de pelo menos uma fala`);
  }
  return errors;
}
