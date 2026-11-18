// Selos do café (milestones): metas por trilha, como os marcos de população de um jogo de cidade. Cada trilha lê um
// número (clientes atendidos, gatos que já passaram pelo café, reputação ou a melhor sequência de bom comportamento) e
// cada selo, ao passar do seu valor, fica conquistado para sempre (o evento sai uma vez). As recompensas das trilhas
// de quantidade (count) são as que importam (receitas, cômodos, móveis, eventos); as de sequência (streak) são só
// mimos (presentes), e nada da história pode depender delas. Puro: sem Phaser, DOM ou window.
import type { Condition, Effect } from './content';
import type { StreakId } from './stats';

/** De onde a trilha lê o número. */
export type MilestoneStat = 'served' | 'servedOpen' | 'servedSeason' | 'catsEver' | 'reputation' | 'fairsHeld' | `streak.${StreakId}`;
/**
 * count: quantidade fixa; streak: sequência (só mimos); season: as metas da estação (decisão 267): o contador zera a
 * cada estação e os selos da trilha são uma fila de recompensas: em cada estação, a meta goals[0] dá o próximo da fila
 * e goals[1] o seguinte; o que não sair fica para a mesma estação do ano que vem.
 */
export type MilestoneKind = 'count' | 'streak' | 'season';
/** O que o selo dá. A tela mostra só o tipo ("Nova receita ?") até ele ser conquistado. */
export type RewardKind = 'recipe' | 'room' | 'item' | 'event' | 'gift' | 'costume';

export interface MilestoneTrack {
  id: string;
  name: string;
  kind: MilestoneKind;
  stat: MilestoneStat;
  /** A meta no balão: a ação, com {n} (quanto falta) e {at} (o número da meta). Sem o campo, o nome da trilha. */
  goal?: string;
  /** Trilha da estação (kind season): de qual estação e as metas de clientes dela, em ordem. */
  season?: string;
  goals?: number[];
}

export interface MilestoneDef {
  id: string;
  track: string;
  name: string;
  /** Vale quando o número da trilha chega aqui (na trilha da estação, 0: a meta vem de goals). */
  at: number;
  /** Condição a mais (ex.: o porão só depois da inauguração); `whenText` explica na tela. */
  when?: Condition;
  whenText?: string;
  /**
   * recipe/room/item/event: o que passa a existir (as condições desses conteúdos usam { "milestone": id }).
   * gift: os itens entram na mochila ao conquistar (repita o id para dar mais de um).
   */
  reward: { kind: RewardKind; ids: string[] };
  /** Efeitos a mais ao conquistar (ex.: uma fala). */
  effects?: Effect[];
}

/** data/milestones.json */
export interface MilestonesData {
  schemaVersion: 1;
  /** No máximo quantas receitas novas ela aprende por dia; as outras esperam na fila (decisão 262). */
  recipesPerDay?: number;
  tracks: MilestoneTrack[];
  milestones: MilestoneDef[];
}

/** No save (v28): o dia em que cada selo foi conquistado. catchUp: save antigo, a primeira conferida marca sem avisar. */
export interface MilestonesState {
  reached: Record<string, number>;
  catchUp?: boolean;
}

export function newMilestones(): MilestonesState {
  return { reached: {} };
}

/** Os números das trilhas agora (a sessão monta). */
export type MilestoneValues = Record<MilestoneStat, number>;

/** A estação de agora: qual e o dia em que ela começou (as metas da estação contam dali). */
export interface SeasonNow {
  season: string;
  start: number;
}

/**
 * Trilha da estação: as metas que ainda valem nesta estação, cada uma com o selo que ela dá (o próximo da fila). As que
 * já saíram nesta estação (conquistadas a partir de `now.start`) gastam as primeiras metas.
 */
export function seasonGoals(data: MilestonesData, s: MilestonesState, track: MilestoneTrack, now: SeasonNow | undefined): { def: MilestoneDef; at: number }[] {
  if (track.kind !== 'season' || !now || track.season !== now.season) return [];
  const all = data.milestones.filter((m) => m.track === track.id);
  const used = all.filter((m) => (s.reached[m.id] ?? -1) >= now.start).length;
  const pending = all.filter((m) => s.reached[m.id] === undefined);
  return (track.goals ?? []).slice(used).map((at, i) => ({ def: pending[i]!, at })).filter((g) => !!g.def);
}

/** O selo vale agora? (o número da trilha e a condição a mais) */
export function milestoneMet(data: MilestonesData, m: MilestoneDef, values: MilestoneValues, when: (c: Condition, m: MilestoneDef) => boolean): boolean {
  const track = data.tracks.find((t) => t.id === m.track);
  return !!track && track.kind !== 'season' && values[track.stat] >= m.at && (!m.when || when(m.when, m));
}

/** Os selos que valem agora e ainda não foram conquistados: os de quantidade e sequência e as metas da estação. */
export function newlyMet(data: MilestonesData, s: MilestonesState, values: MilestoneValues, when: (c: Condition, m: MilestoneDef) => boolean, now?: SeasonNow): MilestoneDef[] {
  const fixed = data.milestones.filter((m) => s.reached[m.id] === undefined && milestoneMet(data, m, values, when));
  const season = data.tracks.flatMap((t) => seasonGoals(data, s, t, now).filter((g) => values[t.stat] >= g.at && (!g.def.when || when(g.def.when, g.def))).map((g) => g.def));
  return [...fixed, ...season];
}

/** Uma trilha na tela: os conquistados, o próximo (com o progresso) e quantos ainda faltam depois dele. */
export interface TrackView {
  track: MilestoneTrack;
  value: number;
  reached: MilestoneDef[];
  /** at: a meta (na trilha da estação, a de agora). */
  next: { def: MilestoneDef; value: number; at: number; blocked: boolean } | null;
  hidden: number;
}

/** As trilhas na tela. A da estação só aparece na estação dela (as outras voltam no ano que vem). */
export function trackViews(data: MilestonesData, s: MilestonesState, values: MilestoneValues, when: (c: Condition) => boolean, now?: SeasonNow): TrackView[] {
  return data.tracks
    .filter((track) => track.kind !== 'season' || track.season === now?.season)
    .map((track) => {
      const all = data.milestones.filter((m) => m.track === track.id).sort((a, b) => (track.kind === 'season' ? 0 : a.at - b.at));
      const value = values[track.stat];
      const reached = all.filter((m) => s.reached[m.id] !== undefined);
      const pending = all.filter((m) => s.reached[m.id] === undefined);
      // Estação: a próxima meta desta estação (sem nenhuma, as desta estação já saíram: a fila volta no ano que vem).
      const goal = track.kind === 'season' ? seasonGoals(data, s, track, now)[0] : pending[0] ? { def: pending[0], at: pending[0].at } : undefined;
      return {
        track,
        value,
        reached,
        // Chegou no número mas falta a condição a mais: o selo espera (blocked).
        next: goal ? { def: goal.def, at: goal.at, value: Math.min(value, goal.at), blocked: value >= goal.at && !!goal.def.when && !when(goal.def.when) } : null,
        hidden: Math.max(0, pending.length - (goal ? 1 : 0)),
      };
    });
}

/** Ids de selo citados numa condição ({ "milestone": id }, também dentro de all/any/not). */
export function milestoneRefs(c: unknown, out: string[] = []): string[] {
  if (Array.isArray(c)) c.forEach((x) => milestoneRefs(x, out));
  else if (c && typeof c === 'object') {
    for (const [k, v] of Object.entries(c)) {
      if (k === 'milestone' && typeof v === 'string') out.push(v);
      else milestoneRefs(v, out);
    }
  }
  return out;
}

const STATS: readonly string[] = ['served', 'servedOpen', 'servedSeason', 'catsEver', 'reputation', 'fairsHeld', 'streak.no_gave_up', 'streak.cats_cared'];

/**
 * Confere os dados. `exists` diz se o id de cada tipo de recompensa existe; `storyRefs` são os selos citados pela
 * história, cômodos e eventos (nenhum pode ser de sequência: os mimos não seguram a história).
 */
export function validateMilestones(data: MilestonesData, exists: (kind: RewardKind, id: string) => boolean, storyRefs: readonly string[]): string[] {
  const errors: string[] = [];
  const tracks = new Map<string, MilestoneTrack>();
  for (const t of data.tracks) {
    if (tracks.has(t.id)) errors.push(`milestones: trilha repetida "${t.id}"`);
    tracks.set(t.id, t);
    if (!STATS.includes(t.stat)) errors.push(`milestones: trilha "${t.id}" com stat desconhecido "${t.stat}"`);
    if ((t.kind === 'streak') !== t.stat.startsWith('streak.')) errors.push(`milestones: trilha "${t.id}": kind "${t.kind}" não combina com "${t.stat}"`);
    if ((t.kind === 'season') !== (t.stat === 'servedSeason')) errors.push(`milestones: trilha "${t.id}": a da estação usa servedSeason (e só ela)`);
    if (t.kind === 'season' && (!t.season || !t.goals?.length || t.goals.some((g, i) => !(g > 0) || (i > 0 && g <= t.goals![i - 1]!))))
      errors.push(`milestones: trilha "${t.id}": precisa de season e goals crescentes maiores que 0`);
  }
  const ids = new Set<string>();
  for (const m of data.milestones) {
    if (!m.id.startsWith('milestone.')) errors.push(`milestones: id "${m.id}" deve começar com "milestone."`);
    if (ids.has(m.id)) errors.push(`milestones: id repetido "${m.id}"`);
    ids.add(m.id);
    const track = tracks.get(m.track);
    if (!track) errors.push(`milestones: "${m.id}" numa trilha que não existe "${m.track}"`);
    if (track?.kind !== 'season' && !(m.at > 0)) errors.push(`milestones: "${m.id}" precisa de at maior que 0`);
    if (m.reward.ids.length === 0) errors.push(`milestones: "${m.id}" sem recompensa`);
    for (const id of m.reward.ids) if (!exists(m.reward.kind, id)) errors.push(`milestones: "${m.id}" dá ${m.reward.kind} que não existe "${id}"`);
    if (track?.kind === 'streak' && m.reward.kind !== 'gift' && m.reward.kind !== 'recipe')
      errors.push(`milestones: "${m.id}" é de sequência: só presentes ou receita bônus (${m.reward.kind} é da história)`);
  }
  for (const ref of storyRefs) {
    const m = data.milestones.find((x) => x.id === ref);
    if (!m) errors.push(`milestones: condição cita selo que não existe "${ref}"`);
    else if (tracks.get(m.track)?.kind === 'streak') errors.push(`milestones: "${ref}" é de sequência e não pode segurar história, cômodo ou evento`);
  }
  return errors;
}
