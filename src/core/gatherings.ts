// Encontros da estação (data/festive.json: gatherings): uma data fixa por estação sem festa grande (o piquenique da
// primavera, a noite do sorvete no verão). Na semana antes, um amigo passa no café e chama; no dia, o café fecha mais
// cedo e, na hora, os amigos chegam (o roteiro da festa). O preparo (enfeitar o café, servir gelados) vale um extra.
// Feito, dá reputação, corações com quem veio e um presente ou uma receita. Puro: sem Phaser, DOM ou window.
import { dayInSeason, seasonOf, yearOf, type SeasonsData } from './calendar';
import type { Condition } from './content';

export interface GatheringDef {
  id: string;
  name: string;
  season: string;
  /** Dia (da estação) a partir do qual o amigo chama; vale até a véspera. */
  proposeDay: number;
  /** Dia (da estação) do encontro: o café fecha em closeAt e os amigos chegam em partyAt. */
  day: number;
  closeAt: string;
  partyAt: string;
  /** Luzes do café acesas a partir de partyAt, com a cor desta hora (a noite do sorvete, com as luzinhas). */
  partyLights?: string;
  proposer: string;
  /** Onde e quando o amigo chama (ela no café, de dia). */
  proposalWhen: Condition;
  proposalScript: string;
  /** Ela no café na hora: começa o roteiro do encontro. */
  partyWhen: Condition;
  partyScript: string;
  /**
   * O preparo: placedTag = ter tantos móveis com a tag posicionados na hora do encontro (o café enfeitado);
   * demand = no dia, a procura pelas receitas desta temperatura multiplica.
   */
  prep?: { placedTag?: { tag: string; count: number }; demand?: { temp: string; multiplier: number } };
  /** Quem vem (os amigos que ela já conhece). */
  guests: { npc: string; known: Condition }[];
  reward: { reputation: number; prepReputation?: number; points: number; item?: string; flag?: string };
  /** O que o balão diz (antes do dia, no dia) e os avisos (feito, perdido). {n}/{count}: o preparo. */
  texts: { goal: string; goalToday: string; prep?: string; done: string; missed: string };
}

/** O encontro do ano (save): convidou, aconteceu ou passou. */
export interface GatheringRecord {
  year: number;
  stage: 'invited' | 'done' | 'missed';
}

export type GatheringsState = Record<string, GatheringRecord>;

export function isGatheringDay(seasons: SeasonsData, def: GatheringDef, day: number): boolean {
  return seasonOf(seasons, day) === def.season && dayInSeason(seasons, day) === def.day;
}

/** Entre o convite e a véspera. */
export function inProposeWindow(seasons: SeasonsData, def: GatheringDef, day: number): boolean {
  const d = dayInSeason(seasons, day);
  return seasonOf(seasons, day) === def.season && d >= def.proposeDay && d < def.day;
}

/** O registro deste ano (o de um ano passado é esquecido). */
export function gatheringOfYear(seasons: SeasonsData, s: GatheringsState, id: string, day: number): GatheringRecord | null {
  const r = s[id];
  return r && r.year === yearOf(seasons, day) ? r : null;
}

export function validateGatherings(
  list: readonly GatheringDef[],
  refs: { seasons: SeasonsData; npcs: ReadonlySet<string>; scripts: ReadonlySet<string>; items: ReadonlySet<string> },
): string[] {
  const errors: string[] = [];
  const ids = new Set<string>();
  for (const g of list) {
    const w = `gatherings "${g.id}"`;
    if (!g.id?.startsWith('gath.')) errors.push(`${w}: id deve começar com "gath."`);
    if (ids.has(g.id)) errors.push(`${w}: id repetido`);
    ids.add(g.id);
    if (!refs.seasons.order.includes(g.season)) errors.push(`${w}: estação inexistente "${g.season}"`);
    if (!(g.proposeDay >= 1 && g.proposeDay < g.day && g.day <= refs.seasons.daysPerSeason)) errors.push(`${w}: proposeDay precisa vir antes de day, dentro da estação`);
    if (!refs.npcs.has(g.proposer)) errors.push(`${w}: proposer inexistente "${g.proposer}"`);
    for (const s of [g.proposalScript, g.partyScript]) if (!refs.scripts.has(s)) errors.push(`${w}: roteiro inexistente "${s}"`);
    for (const x of g.guests) if (!refs.npcs.has(x.npc)) errors.push(`${w}: convidado inexistente "${x.npc}"`);
    if (g.reward.item && !refs.items.has(g.reward.item)) errors.push(`${w}: presente inexistente "${g.reward.item}"`);
  }
  return errors;
}
