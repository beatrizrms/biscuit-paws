// Amigo secreto de Natal (data/festive.json: secretSanta). No dia do sorteio, a Gabi aparece no café e propõe o
// amigo secreto; ela tira um dos amigos que já conhece e ganha uma dica do gosto dele. No Natal, o café fecha mais
// cedo e, na hora da ceia, os amigos vêm trocar presentes: o presente que ela trouxer (tag de presente, na mochila)
// agrada mais se for o que a pessoa gosta. Puro: sem Phaser, DOM ou window.
import { dayInSeason, seasonOf, yearOf, type SeasonsData } from './calendar';
import type { Condition } from './content';
import type { Rng } from './rng';

/** Como o presente foi recebido: o que a pessoa gosta, outro presente de Natal, ou nenhum. */
export type SantaResult = 'loved' | 'liked' | 'none';

export interface SantaFriend {
  npc: string;
  /** Como o nome entra no meio da frase ("a Dona Neusa", "o Tião"). */
  name: string;
  /** Ela já conhece (só quem ela conhece entra no sorteio e vem para a ceia). */
  known: Condition;
  /** O presente que a pessoa mais gosta. */
  likes: string;
  /** A dica do gosto, dita no sorteio e lembrada no balão. */
  hint: string;
  /** Fala de quem recebeu: o presente que gosta ou outro presente de Natal. */
  dialogues: { loved: string; liked: string };
}

export interface SecretSantaData {
  season: string;
  /** Dia (da estação) a partir do qual a Gabi propõe o sorteio; vale até a véspera da ceia. */
  drawDay: number;
  /** Dia (da estação) do Natal: o café fecha em closeAt e a ceia é em partyAt. */
  day: number;
  closeAt: string;
  partyAt: string;
  /** Na noite da ceia (de partyAt em diante), o café fica com as luzes acesas: a cor de dentro é a desta hora. */
  partyLights: string;
  /** Quem propõe (sem conhecê-la, não tem amigo secreto naquele ano). */
  proposer: string;
  /** Condição extra para a proposta aparecer (ela no café, de dia, depois do prólogo...). */
  proposalWhen: Condition;
  proposalScript: string;
  partyScript: string;
  /** O fim da ceia, depois que ela entrega o presente (a reação, o presente dela, a noite que acaba). */
  partyEndScript: string;
  /** O fim da festa, quando ela sai pela porta da rua e confirma (a despedida; os convidados vão embora). */
  partyCloseScript: string;
  /**
   * Depois da troca, os convidados ficam: o E num deles mostra estas falas, uma por vez (npc -> falas). Uma fala pode ter
   * `when` (ex.: a do chocolate quente só se ela serviu): sem valer, fica de fora.
   */
  partyChat: Record<string, (string | { text: string; when: Condition })[]>;
  /**
   * O quitute da ceia, um por ano (years, em ordem; depois recomeça): a receita, a mistura vendida só no dia da ceia
   * (mix, que vira a receita pelo jeito alternativo) e o plural para os textos ({treats}; {treat} é o nome da receita).
   * Deixado nas mesas, a cada minuto da festa (depois da troca), com a chance chancePerMinute, um convidado que ainda não
   * pegou pega um (`take`: npc -> fala; `points` de coração). Quem está em `refuse` não pega (npc -> fala). Cada ano
   * pode trocar as falas (take/refuse do ano valem por cima das de sempre).
   */
  treat?: {
    points: number;
    chancePerMinute: number;
    take: Record<string, string>;
    refuse?: Record<string, string>;
    /** name: como o quitute aparece nas falas ({treat}); sem ele, o nome da receita em minúsculas. */
    /** call: a ligação da manhã da ceia (cena) contando do quitute, se callWhen vale (ex.: ela conhece a Neusa); sem ela, só o aviso. */
    years: { recipe: string; name?: string; mix?: string; plural: string; call?: string; callWhen?: Condition; take?: Record<string, string>; refuse?: Record<string, string> }[];
  };
  /**
   * A meta da ceia (todo ano, do sorteio até o fim da ceia): passos opcionais (text com {treat}/{treats}, when). No fim
   * da ceia, cada passo feito vale pointsPerStep de coração para cada convidado.
   */
  prep?: { title: string; extrasTitle: string; pointsPerStep: number; steps: { text: string; when: Condition }[] };
  /** Condição para a ceia começar na hora (ex.: fora do café, ou no salão: o roteiro não a tira de outro cômodo). */
  partyWhen: Condition;
  /** Tag dos presentes (o que ela pode dar). */
  giftTag: string;
  /** Pontos de coração: com quem ela tirou (loved/liked) e com cada convidado da ceia (party). */
  points: { loved: number; liked: number; party: number };
  /** O que ela ganha: o primeiro Natal tem o presente fixo; depois, um dos outros. */
  playerGifts: { first: string; later: string[] };
  /** Meias de Natal posicionadas: no Natal, cada gato do café ganha um petisco (alegria e pontos). */
  stockings: { item: string; happiness: number; points: number };
  /** Fala de quando ela chega sem presente. */
  noGiftDialogue: string;
  /** Fala de quando quem a tirou entrega o presente dela ({santa:giver}). */
  receiveDialogue: string;
  friends: SantaFriend[];
}

/** O amigo secreto do ano (save v34). */
export interface SantaRecord {
  year: number;
  /** Quem ela tirou. */
  drawn: string;
  stage: 'drawn' | 'done' | 'missed';
  result?: SantaResult;
  /** O que ela deu, quem a tirou e o que ganhou. */
  gift?: string;
  giver?: string;
  received?: string;
  /** Os convidados que já pegaram o quitute da ceia na mesa. */
  treatTaken?: string[];
}

/** É o dia do Natal (a ceia)? */
export function isChristmas(seasons: SeasonsData, data: SecretSantaData, day: number): boolean {
  return seasonOf(seasons, day) === data.season && dayInSeason(seasons, day) === data.day;
}

/** Está entre o dia do sorteio e a véspera da ceia? */
export function inDrawWindow(seasons: SeasonsData, data: SecretSantaData, day: number): boolean {
  const d = dayInSeason(seasons, day);
  return seasonOf(seasons, day) === data.season && d >= data.drawDay && d < data.day;
}

/** O registro vale para o ano deste dia? (O de um ano passado é esquecido.) */
export function recordOfYear(seasons: SeasonsData, record: SantaRecord | null, day: number): SantaRecord | null {
  return record && record.year === yearOf(seasons, day) ? record : null;
}

/** Sorteia quem ela tira entre os convidados (em ordem dos dados: repetível com a mesma semente). */
export function drawFriend(guests: readonly string[], rng: Rng): string | null {
  return guests.length ? guests[rng.int(0, guests.length - 1)]! : null;
}

/**
 * O presente que ela entrega: o que a pessoa gosta, se estiver na mochila; senão, o primeiro presente de Natal que ela
 * tiver (na ordem dos itens); sem nenhum, nada.
 */
export function pickGift(inventory: Record<string, number>, giftIds: readonly string[], friend: SantaFriend): { item: string | null; result: SantaResult } {
  if ((inventory[friend.likes] ?? 0) > 0) return { item: friend.likes, result: 'loved' };
  const other = giftIds.find((id) => (inventory[id] ?? 0) > 0);
  return other ? { item: other, result: 'liked' } : { item: null, result: 'none' };
}

/** Quem a tirou: um convidado sorteado, de preferência outro que não o que ela tirou. */
export function pickGiver(guests: readonly string[], drawn: string, rng: Rng): string | null {
  const pool = guests.length > 1 ? guests.filter((g) => g !== drawn) : guests;
  return drawFriend(pool, rng);
}

/** O presente que ela ganha: o fixo no primeiro amigo secreto; depois, um dos outros (sorteado). */
export function playerGift(data: SecretSantaData, firstTime: boolean, rng: Rng): string {
  if (firstTime || data.playerGifts.later.length === 0) return data.playerGifts.first;
  return data.playerGifts.later[rng.int(0, data.playerGifts.later.length - 1)]!;
}

export interface SantaRefs {
  items: ReadonlyMap<string, { kind?: string; tags: string[] }>;
  npcs: ReadonlySet<string>;
  dialogues: ReadonlySet<string>;
  scripts: ReadonlySet<string>;
  seasons: SeasonsData;
}

export function validateSecretSanta(data: SecretSantaData, refs: SantaRefs): string[] {
  const errors: string[] = [];
  const err = (m: string) => errors.push(`festive.secretSanta: ${m}`);
  const clock = (v: string, what: string) => {
    if (!/^\d{1,2}:\d{2}$/.test(v)) err(`${what}: hora inválida "${v}"`);
  };
  if (!refs.seasons.order.includes(data.season)) err(`estação inexistente "${data.season}"`);
  const days = refs.seasons.daysPerSeason;
  if (!(data.drawDay >= 1 && data.drawDay < data.day && data.day <= days)) err('drawDay precisa vir antes de day, dentro da estação');
  clock(data.closeAt, 'closeAt');
  clock(data.partyAt, 'partyAt');
  clock(data.partyLights, 'partyLights');
  if (!refs.npcs.has(data.proposer)) err(`NPC inexistente "${data.proposer}"`);
  for (const s of [data.proposalScript, data.partyScript, data.partyEndScript, data.partyCloseScript]) if (!refs.scripts.has(s)) err(`roteiro inexistente "${s}"`);
  for (const d of [data.noGiftDialogue, data.receiveDialogue]) if (!refs.dialogues.has(d)) err(`fala inexistente "${d}"`);
  const gifts = [...refs.items].filter(([, i]) => i.tags.includes(data.giftTag)).map(([id]) => id);
  if (gifts.length === 0) err(`nenhum item tem a tag "${data.giftTag}"`);
  for (const id of [data.playerGifts.first, ...data.playerGifts.later, data.stockings.item]) if (!refs.items.has(id)) err(`item inexistente "${id}"`);
  if (!data.friends.some((f) => f.npc === data.proposer)) err(`quem propõe ("${data.proposer}") precisa estar entre os amigos`);
  const seen = new Set<string>();
  for (const f of data.friends) {
    if (!refs.npcs.has(f.npc)) err(`NPC inexistente "${f.npc}"`);
    if (seen.has(f.npc)) err(`amigo repetido "${f.npc}"`);
    seen.add(f.npc);
    if (!gifts.includes(f.likes)) err(`${f.npc}: "${f.likes}" não é presente (tag "${data.giftTag}")`);
    for (const d of [f.dialogues.loved, f.dialogues.liked]) if (!refs.dialogues.has(d)) err(`${f.npc}: fala inexistente "${d}"`);
    if (!f.name.trim() || !f.hint.trim()) err(`${f.npc}: falta name ou hint`);
  }
  return errors;
}
