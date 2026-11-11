// Noite das Abóboras (Halloween; data/festive.json: halloween). Na Semana do Halloween, a Dona Neusa chama para a festa
// no café: ela tira um amigo para dar um presente de Halloween e cada amigo conhecido conta o doce favorito. No último
// dia do outono, o café fecha mais cedo e, na hora da festa, os amigos chegam, comem as comidas de Halloween postas nos
// balcões e mesas (o favorito vale mais) e ela entrega o presente. Puro: sem Phaser, DOM ou window.
import { dayInSeason, seasonOf, yearOf, type SeasonsData } from './calendar';
import type { Condition } from './content';

/** Como o presente foi recebido: o que a pessoa gosta, outro presente de Halloween, ou nenhum. */
export type HalloweenResult = 'loved' | 'liked' | 'none';

export interface HalloweenFriend {
  npc: string;
  /** Como o nome entra no meio da frase ("a Dona Neusa", "o Tião"). */
  name: string;
  /** Ela já conhece (só quem ela conhece vem para a festa e entra no sorteio do presente). */
  known: Condition;
  /** O presente que a pessoa mais gosta (tag de presente de Halloween) e a dica dele. */
  likes: string;
  hint: string;
  /** A comida favorita (receita de Halloween) e a dica dela, contada no convite. */
  food: string;
  foodHint: string;
  /** A mesma dica na boca de quem convida (ela fala de si: "eu juro que..."). */
  foodHintSelf?: string;
  /** Fala de quem recebeu o presente: o que gosta ou outro presente de Halloween. */
  dialogues: { loved: string; liked: string };
}

export interface HalloweenData {
  season: string;
  /** Dia (da estação) a partir do qual a Dona Neusa convida; vale até a véspera da festa. */
  inviteDay: number;
  /** Dia (da estação) da festa: o café fecha em closeAt, a festa é em partyAt e as luzes acendem com a cor de partyLights. */
  day: number;
  closeAt: string;
  partyAt: string;
  partyLights: string;
  proposer: string;
  proposalWhen: Condition;
  proposalScript: string;
  partyScript: string;
  /** O fim da festa, depois do presente (a reação e a noite que acaba). */
  partyEndScript: string;
  /** O fim da festa, quando ela sai pela porta da rua e confirma (a despedida; os convidados vão embora). */
  partyCloseScript: string;
  /** Depois da troca, os convidados ficam: o E num deles mostra estas falas, uma por vez (npc -> falas). */
  partyChat: Record<string, string[]>;
  partyWhen: Condition;
  /** Tag dos presentes (o que ela pode dar). */
  giftTag: string;
  /** As comidas da festa (receitas): o que os convidados comem dos balcões e mesas. */
  foods: string[];
  /** Pontos de coração: o presente (loved/liked), cada convidado pela noite (party) e cada um pela comida. */
  points: { loved: number; liked: number; party: number; favoriteFood: number; otherFood: number };
  noGiftDialogue: string;
  friends: HalloweenFriend[];
}

/** A festa do ano (save v39): quem ela tirou para o presente, o que deu e o que cada um comeu. */
export interface HalloweenRecord {
  year: number;
  drawn: string;
  stage: 'invited' | 'done' | 'missed';
  result?: HalloweenResult;
  gift?: string;
  /** Quem já comeu na festa: a receita (ou null: não sobrou comida). */
  ate?: Record<string, string | null>;
}

/** É o dia da festa? */
export function isHalloween(seasons: SeasonsData, data: HalloweenData, day: number): boolean {
  return seasonOf(seasons, day) === data.season && dayInSeason(seasons, day) === data.day;
}

/** Está entre o convite e a véspera da festa? */
export function inInviteWindow(seasons: SeasonsData, data: HalloweenData, day: number): boolean {
  const d = dayInSeason(seasons, day);
  return seasonOf(seasons, day) === data.season && d >= data.inviteDay && d < data.day;
}

/** O registro vale para o ano deste dia? */
export function halloweenOfYear(seasons: SeasonsData, record: HalloweenRecord | null, day: number): HalloweenRecord | null {
  return record && record.year === yearOf(seasons, day) ? record : null;
}

/**
 * O que um convidado come do que está posto: o favorito, se houver; senão, a primeira comida da festa que sobrou.
 * `available` = receitas postas (com repetição: uma por porção).
 */
export function pickFood(available: readonly string[], favorite: string): { recipe: string | null; favorite: boolean } {
  if (available.includes(favorite)) return { recipe: favorite, favorite: true };
  return available.length ? { recipe: available[0]!, favorite: false } : { recipe: null, favorite: false };
}

export interface HalloweenRefs {
  items: ReadonlyMap<string, { tags: string[] }>;
  recipes: ReadonlySet<string>;
  npcs: ReadonlySet<string>;
  dialogues: ReadonlySet<string>;
  scripts: ReadonlySet<string>;
  seasons: SeasonsData;
}

export function validateHalloween(data: HalloweenData, refs: HalloweenRefs): string[] {
  const errors: string[] = [];
  const err = (m: string) => errors.push(`festive.halloween: ${m}`);
  for (const [v, what] of [[data.closeAt, 'closeAt'], [data.partyAt, 'partyAt'], [data.partyLights, 'partyLights']] as const) {
    if (!/^\d{1,2}:\d{2}$/.test(v)) err(`${what}: hora inválida "${v}"`);
  }
  if (!refs.seasons.order.includes(data.season)) err(`estação inexistente "${data.season}"`);
  if (!(data.inviteDay >= 1 && data.inviteDay < data.day && data.day <= refs.seasons.daysPerSeason)) err('inviteDay precisa vir antes de day, dentro da estação');
  if (!refs.npcs.has(data.proposer)) err(`NPC inexistente "${data.proposer}"`);
  for (const s of [data.proposalScript, data.partyScript, data.partyEndScript, data.partyCloseScript]) if (!refs.scripts.has(s)) err(`roteiro inexistente "${s}"`);
  if (!refs.dialogues.has(data.noGiftDialogue)) err(`fala inexistente "${data.noGiftDialogue}"`);
  const gifts = [...refs.items].filter(([, i]) => i.tags.includes(data.giftTag)).map(([id]) => id);
  if (gifts.length === 0) err(`nenhum item tem a tag "${data.giftTag}"`);
  if (data.foods.length === 0) err('foods vazio');
  for (const r of data.foods) if (!refs.recipes.has(r)) err(`receita inexistente "${r}"`);
  if (!data.friends.some((f) => f.npc === data.proposer)) err(`quem convida ("${data.proposer}") precisa estar entre os amigos`);
  const seen = new Set<string>();
  for (const f of data.friends) {
    if (!refs.npcs.has(f.npc)) err(`NPC inexistente "${f.npc}"`);
    if (seen.has(f.npc)) err(`amigo repetido "${f.npc}"`);
    seen.add(f.npc);
    if (!gifts.includes(f.likes)) err(`${f.npc}: "${f.likes}" não é presente (tag "${data.giftTag}")`);
    if (!data.foods.includes(f.food)) err(`${f.npc}: "${f.food}" não é comida da festa`);
    for (const d of [f.dialogues.loved, f.dialogues.liked]) if (!refs.dialogues.has(d)) err(`${f.npc}: fala inexistente "${d}"`);
    if (!f.name.trim() || !f.hint.trim() || !f.foodHint.trim()) err(`${f.npc}: falta name, hint ou foodHint`);
  }
  return errors;
}
