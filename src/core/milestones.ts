// Selos do café (milestones): metas por trilha, como os marcos de população de um jogo de cidade. Cada trilha lê um
// número (clientes atendidos, gatos que já passaram pelo café, reputação ou a melhor sequência de bom comportamento) e
// cada selo, ao passar do seu valor, fica conquistado para sempre (o evento sai uma vez). As recompensas das trilhas
// de quantidade (count) são as que importam (receitas, cômodos, móveis, eventos); as de sequência (streak) são só
// mimos (presentes), e nada da história pode depender delas. Puro: sem Phaser, DOM ou window.
import type { Condition, Effect } from './content';
import type { StreakId } from './stats';

/** De onde a trilha lê o número. */
export type MilestoneStat = 'served' | 'servedOpen' | 'catsEver' | 'reputation' | 'fairsHeld' | `streak.${StreakId}`;
export type MilestoneKind = 'count' | 'streak';
/** O que o selo dá. A tela mostra só o tipo ("Nova receita ?") até ele ser conquistado. */
export type RewardKind = 'recipe' | 'room' | 'item' | 'event' | 'gift' | 'costume';

export interface MilestoneTrack {
  id: string;
  name: string;
  kind: MilestoneKind;
  stat: MilestoneStat;
}

export interface MilestoneDef {
  id: string;
  track: string;
  name: string;
  /** Vale quando o número da trilha chega aqui. */
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
  /**
   * Intervalo entre as conquistas de receita destas trilhas (decisão 266): a próxima só chega `days` dias depois da
   * anterior, mesmo com os clientes já contados (o café cresce e o número sozinho ficava rápido).
   */
  recipeGap?: { days: number; tracks: string[] };
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

/** O selo vale agora? (o número da trilha e a condição a mais) */
export function milestoneMet(data: MilestonesData, m: MilestoneDef, values: MilestoneValues, when: (c: Condition) => boolean): boolean {
  const track = data.tracks.find((t) => t.id === m.track);
  return !!track && values[track.stat] >= m.at && (!m.when || when(m.when));
}

/** Os selos que valem agora e ainda não foram conquistados, na ordem dos dados. */
export function newlyMet(data: MilestonesData, s: MilestonesState, values: MilestoneValues, when: (c: Condition) => boolean): MilestoneDef[] {
  return data.milestones.filter((m) => s.reached[m.id] === undefined && milestoneMet(data, m, values, when));
}

/** Uma trilha na tela: os conquistados, o próximo (com o progresso) e quantos ainda faltam depois dele. */
export interface TrackView {
  track: MilestoneTrack;
  value: number;
  reached: MilestoneDef[];
  /** waitDays: chegou no número, mas espera o intervalo das conquistas de receita (recipeGap). */
  next: { def: MilestoneDef; value: number; blocked: boolean; waitDays?: number } | null;
  hidden: number;
}

/** Dias que esta conquista ainda espera pelo intervalo das de receita (recipeGap); 0 = pode chegar. */
export function recipeGapWait(data: MilestonesData, s: MilestonesState, m: MilestoneDef, day: number): number {
  const gap = data.recipeGap;
  if (!gap || m.reward.kind !== 'recipe' || !gap.tracks.includes(m.track)) return 0;
  const days = data.milestones.filter((x) => x.reward.kind === 'recipe' && gap.tracks.includes(x.track)).map((x) => s.reached[x.id]).filter((d): d is number => d !== undefined);
  return days.length ? Math.max(0, Math.max(...days) + gap.days - day) : 0;
}

export function trackViews(data: MilestonesData, s: MilestonesState, values: MilestoneValues, when: (c: Condition) => boolean, day = 0): TrackView[] {
  return data.tracks.map((track) => {
    const all = data.milestones.filter((m) => m.track === track.id).sort((a, b) => a.at - b.at);
    const value = values[track.stat];
    const reached = all.filter((m) => s.reached[m.id] !== undefined);
    const pending = all.filter((m) => s.reached[m.id] === undefined);
    const first = pending[0];
    const nextView = (m: MilestoneDef) => {
      const waitDays = value >= m.at ? recipeGapWait(data, s, m, day) : 0;
      return { def: m, value: Math.min(value, m.at), blocked: value >= m.at && ((!!m.when && !when(m.when)) || waitDays > 0), ...(waitDays > 0 ? { waitDays } : {}) };
    };
    return {
      track,
      value,
      reached,
      // Chegou no número mas falta a condição a mais: o selo espera (blocked).
      next: first ? nextView(first) : null,
      hidden: Math.max(0, pending.length - 1),
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

const STATS: readonly string[] = ['served', 'servedOpen', 'catsEver', 'reputation', 'fairsHeld', 'streak.no_gave_up', 'streak.cats_cared'];

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
  }
  const ids = new Set<string>();
  for (const m of data.milestones) {
    if (!m.id.startsWith('milestone.')) errors.push(`milestones: id "${m.id}" deve começar com "milestone."`);
    if (ids.has(m.id)) errors.push(`milestones: id repetido "${m.id}"`);
    ids.add(m.id);
    const track = tracks.get(m.track);
    if (!track) errors.push(`milestones: "${m.id}" numa trilha que não existe "${m.track}"`);
    if (!(m.at > 0)) errors.push(`milestones: "${m.id}" precisa de at maior que 0`);
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
