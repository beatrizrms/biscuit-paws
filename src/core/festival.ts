// Eventos de festival no café (a feira de adoção, o Dia do Gato, o concurso de fofura...): ideia da protagonista,
// em dados (data/festivals.json). Cada um fica disponível por condições (reputação, estação, data, gatos), tem uma
// preparação opcional (os panfletos na rua) e um dia marcado; no dia: a placa na porta fecha o café, a decoração e as
// atividades (mini games, em ordem, no quintal). Feitas todas, o evento acaba: resumo com cada resultado, moedas e
// reputação. Se o dia passa sem acabar, volta ao começo. Um intervalo mínimo separa duas edições do mesmo evento.
// Puro: sem Phaser, DOM ou window. Os pontos são pontos de pedido (data/jobs.json); a sessão junta.
import type { ContestOutcome, FairSetupOutcome, Outcome, PhotoOutcome } from './minigame';
import type { CrowdDef } from './festivalCrowd';
import { parseClock } from './time';

export interface FestivalDef {
  id: string;
  name: string;
  /** A ideia da protagonista quando ele fica disponível (fala). */
  idea?: string;
  /** Liberado ao alcançar este limiar de reputação (data/reputation.json: thresholds[].id). */
  unlockReputation?: string;
  /** Condição para ficar disponível (a mesma das metas: gatos, cômodo, dias desde um marco...). */
  when?: unknown;
  /** Data fixa no calendário: a estação e o dia dela. A ideia vem `noticeDays` antes; o evento é nesse dia. */
  date?: { season: string; day: number; noticeDays?: number };
  /** Dias mínimos entre duas edições (30 = mensal). */
  cooldownDays: number;
  /** Preparação antes do dia (ex.: os panfletos): pontos em qualquer ordem; o dia fica marcado `daysAfter` depois. */
  prep?: { points: string[]; daysAfter: number };
  /**
   * No dia, antes de tudo: a placa na porta (fecha o atendimento). `by`: até que hora ("12:00"); passou sem a placa,
   * o evento é perdido. `remind`: quantos minutos antes do prazo vem o lembrete.
   */
  closePoint?: { point: string; tile: string; by?: string; remind?: number };
  /** No dia, depois da placa: decorações (cada ponto vira a peça dele no mapa). */
  decorations?: { point: string; tile: string; at?: [number, number] }[];
  /** As atividades do dia, em ordem: mini game aberto pelo ponto (data/jobs.json, action "minigame"). */
  activities: { point: string; game: string }[];
  /** Somados no fim, além do que cada atividade já pagou. */
  rewards?: { coins?: number; reputation?: number };
  /** Linhas do balão de metas: preparação, placa, decoração e uma por mini game das atividades. */
  texts: { prep?: string; close?: string; decor?: string; activities: Record<string, string> };
}

export interface FestivalsData {
  schemaVersion: 1;
  festivals: FestivalDef[];
  /** A plateia no quintal nos dias de evento (src/core/festivalCrowd.ts). */
  crowd?: CrowdDef;
}

export interface ActivityResult {
  game: string;
  outcome: Outcome;
  coins: number;
  skipped: boolean;
  /** Montar a feira: quem vai e quantos visitantes (a mesa de adoção usa depois). */
  setup?: FairSetupOutcome;
  /** Concurso de fantasia: a colocação (o resumo mostra). */
  contest?: ContestOutcome;
  /** Foto perfeita: a melhor foto (o resumo mostra a nota). */
  photo?: PhotoOutcome;
}

/** No save (v22). */
export interface FestivalsState {
  active: {
    id: string;
    stage: 'prep' | 'scheduled';
    /** Dia marcado (com a etapa "scheduled"). */
    day: number | null;
    /** Pontos já feitos na etapa atual (preparação; no dia: placa, decoração e atividades). */
    done: string[];
    results: ActivityResult[];
  } | null;
  /** Dia da última edição de cada evento (para o intervalo). */
  last: Record<string, number>;
  /** O evento que aconteceu hoje (a placa e a decoração ficam até o fim do dia). */
  heldOn: { id: string; day: number } | null;
}

export function newFestivals(): FestivalsState {
  return { active: null, last: {}, heldOn: null };
}

/** O que precisa vir de fora para saber se um evento está disponível. */
export interface FestivalContext {
  day: number;
  /** Estação de hoje e o dia dela (1 a daysPerSeason). */
  season: string;
  dayOfSeason: number;
  /** Limiares de reputação já alcançados. */
  reached: readonly string[];
  /** A condição `when` (a sessão avalia com o estado). */
  evaluate: (cond: unknown) => boolean;
  /** Os outros eventos e quantos dias faltam para uma data (estação, dia): o evento sem data não toma o lugar de um com data. */
  others?: readonly FestivalDef[];
  daysUntil?: (season: string, day: number) => number;
}

/** Folga, além de prep.daysAfter, para a preparação (os panfletos) de um evento sem data. */
const PREP_SLACK_DAYS = 7;

/** Disponível agora para começar? (nenhum evento em andamento, liberado, condição, data e intervalo). */
export function festivalCanStart(s: FestivalsState, def: FestivalDef, ctx: FestivalContext): boolean {
  if (s.active) return false;
  if (def.unlockReputation && !ctx.reached.includes(def.unlockReputation)) return false;
  const last = s.last[def.id];
  if (last !== undefined && ctx.day - last < def.cooldownDays) return false;
  if (def.date) {
    const notice = def.date.noticeDays ?? 0;
    if (ctx.season !== def.date.season || ctx.dayOfSeason > def.date.day || ctx.dayOfSeason < def.date.day - notice) return false;
  }
  if (def.when !== undefined && !ctx.evaluate(def.when)) return false;
  // Sem data (a feira de adoção): não começa se um evento com data, já liberado, cai antes de ela acontecer (só cabe
  // um por vez: o de data se perderia naquele ano).
  if (!def.date && ctx.others && ctx.daysUntil) {
    const window = (def.prep?.daysAfter ?? 0) + PREP_SLACK_DAYS;
    for (const d of ctx.others) {
      if (!d.date || d.id === def.id) continue;
      if (d.unlockReputation && !ctx.reached.includes(d.unlockReputation)) continue;
      const last = s.last[d.id];
      if (last !== undefined && ctx.day - last < d.cooldownDays) continue;
      if (d.when !== undefined && !ctx.evaluate(d.when)) continue;
      if (ctx.daysUntil(d.date.season, d.date.day) <= window) return false;
    }
  }
  return true;
}

/** Começa: com preparação, a etapa dela; sem, já marcado (o dia da data fixa, ou hoje). */
export function startFestival(s: FestivalsState, def: FestivalDef, ctx: Pick<FestivalContext, 'day' | 'dayOfSeason'>): void {
  if (def.prep) s.active = { id: def.id, stage: 'prep', day: null, done: [], results: [] };
  else {
    const day = def.date ? ctx.day + (def.date.day - ctx.dayOfSeason) : ctx.day;
    s.active = { id: def.id, stage: 'scheduled', day, done: [], results: [] };
  }
}

/** É o dia do evento em andamento? */
export function isFestivalDay(s: FestivalsState, day: number): boolean {
  return s.active?.stage === 'scheduled' && s.active.day === day;
}

/** O atendimento fecha hoje: a placa já está na porta (ou o evento já aconteceu hoje e tinha placa). */
export function festivalClosesCafe(s: FestivalsState, defs: readonly FestivalDef[], day: number): boolean {
  const a = s.active;
  if (a && isFestivalDay(s, day)) {
    const def = defs.find((d) => d.id === a.id);
    if (def?.closePoint && a.done.includes(def.closePoint.point)) return true;
  }
  const held = s.heldOn;
  return !!held && held.day === day && !!defs.find((d) => d.id === held.id)?.closePoint;
}

/** Pontos pendentes agora, na ordem: preparação (todos); no dia: placa -> decorações -> a próxima atividade. */
export function pendingFestivalPoints(s: FestivalsState, def: FestivalDef, day: number): string[] {
  const a = s.active;
  if (!a || a.id !== def.id) return [];
  if (a.stage === 'prep') return (def.prep?.points ?? []).filter((id) => !a.done.includes(id));
  if (!isFestivalDay(s, day)) return [];
  if (def.closePoint && !a.done.includes(def.closePoint.point)) return [def.closePoint.point];
  const decor = (def.decorations ?? []).map((d) => d.point).filter((id) => !a.done.includes(id));
  if (decor.length > 0) return decor;
  const next = def.activities.find((x) => !a.done.includes(x.point));
  return next ? [next.point] : [];
}

export type FestivalStep = 'prep' | 'scheduled' | 'close' | 'decor' | 'ready';

/** Fez um ponto (não uma atividade: atividade é mini game, recordActivity). Devolve o que aconteceu, ou null se não era a vez. */
export function doFestivalPoint(s: FestivalsState, def: FestivalDef, pointId: string, day: number): FestivalStep | null {
  const a = s.active;
  if (!a || def.activities.some((x) => x.point === pointId) || !pendingFestivalPoints(s, def, day).includes(pointId)) return null;
  a.done.push(pointId);
  if (a.stage === 'prep') {
    if ((def.prep?.points ?? []).some((id) => !a.done.includes(id))) return 'prep';
    a.stage = 'scheduled';
    a.day = day + (def.prep?.daysAfter ?? 1);
    a.done = [];
    return 'scheduled';
  }
  if (pointId === def.closePoint?.point) return 'close';
  return (def.decorations ?? []).every((d) => a.done.includes(d.point)) ? 'ready' : 'decor';
}

/**
 * Uma atividade do dia terminou (qualquer resultado conta: a feira acontece mesmo se o match não for perfeito).
 * Devolve 'finished' quando era a última (o evento acabou: chame finishFestival), 'next' se ainda há outras, ou null.
 */
export function recordActivity(s: FestivalsState, def: FestivalDef, pointId: string, result: ActivityResult, day: number): 'next' | 'finished' | null {
  const a = s.active;
  if (!a || !pendingFestivalPoints(s, def, day).includes(pointId) || !def.activities.some((x) => x.point === pointId)) return null;
  a.done.push(pointId);
  a.results.push(result);
  return def.activities.every((x) => a.done.includes(x.point)) ? 'finished' : 'next';
}

/** O evento acabou: guarda o dia (intervalo, decoração até o fim do dia) e devolve os resultados para o resumo. */
export function finishFestival(s: FestivalsState): { id: string; results: ActivityResult[] } | null {
  const a = s.active;
  if (!a) return null;
  const day = a.day ?? 0;
  s.last[a.id] = day;
  s.heldOn = { id: a.id, day };
  s.active = null;
  return { id: a.id, results: a.results };
}

/**
 * No dia do evento, com a placa ainda fora da porta: passou do prazo (closePoint.by), o evento é perdido (volta ao
 * começo, como um dia perdido) e devolve 'missed'; dentro dos closePoint.remind minutos antes dele, 'soon'. Senão, null.
 */
export function festivalCloseDeadline(s: FestivalsState, def: FestivalDef, day: number, time: number): 'missed' | 'soon' | null {
  const cp = def.closePoint;
  const a = s.active;
  if (!cp?.by || !a || a.id !== def.id || !isFestivalDay(s, day) || a.done.includes(cp.point)) return null;
  const by = parseClock(cp.by);
  if (time >= by) {
    s.active = null;
    return 'missed';
  }
  return cp.remind && time >= by - cp.remind ? 'soon' : null;
}

/** Virada do dia: o evento marcado para um dia que já passou sem acabar volta ao começo. Devolve o id, se perdeu. */
export function festivalDayEnded(s: FestivalsState, newDay: number): string | null {
  const a = s.active;
  if (!a || a.stage !== 'scheduled' || a.day === null || newDay <= a.day) return null;
  s.active = null;
  return a.id;
}

export function validateFestivals(
  data: FestivalsData,
  refs: { points: ReadonlySet<string>; tiles: ReadonlySet<string>; games: ReadonlySet<string>; dialogues: ReadonlySet<string>; thresholds: ReadonlySet<string>; seasons: ReadonlySet<string> },
): string[] {
  const errors: string[] = [];
  const ids = new Set<string>();
  for (const f of data.festivals) {
    const w = `festivals: "${f.id}"`;
    if (!f.id.startsWith('fest.')) errors.push(`${w}: id deve começar com "fest."`);
    if (ids.has(f.id)) errors.push(`${w}: id repetido`);
    ids.add(f.id);
    if (f.activities.length === 0) errors.push(`${w}: precisa de pelo menos uma atividade`);
    if (!(f.cooldownDays >= 0)) errors.push(`${w}: cooldownDays precisa ser 0 ou mais`);
    if (f.idea && !refs.dialogues.has(f.idea)) errors.push(`${w}: fala inexistente "${f.idea}"`);
    if (f.unlockReputation && !refs.thresholds.has(f.unlockReputation)) errors.push(`${w}: limiar de reputação inexistente "${f.unlockReputation}"`);
    if (f.date && !refs.seasons.has(f.date.season)) errors.push(`${w}: estação inexistente "${f.date.season}"`);
    if (f.prep && (f.prep.points.length === 0 || !(f.prep.daysAfter >= 1))) errors.push(`${w}: prep precisa de pontos e daysAfter 1 ou mais`);
    const points = [...(f.prep?.points ?? []), ...(f.closePoint ? [f.closePoint.point] : []), ...(f.decorations ?? []).map((d) => d.point), ...f.activities.map((a) => a.point)];
    for (const p of points) if (!refs.points.has(p)) errors.push(`${w}: ponto inexistente "${p}"`);
    for (const t of [...(f.closePoint ? [f.closePoint.tile] : []), ...(f.decorations ?? []).map((d) => d.tile)]) if (!refs.tiles.has(t)) errors.push(`${w}: tile inexistente "${t}"`);
    if (f.closePoint?.by !== undefined && !/^\d{1,2}:\d{2}$/.test(f.closePoint.by)) errors.push(`${w}: closePoint.by com hora inválida "${f.closePoint.by}"`);
    if (f.closePoint?.remind !== undefined && !(f.closePoint.remind > 0)) errors.push(`${w}: closePoint.remind precisa ser mais que 0`);
    for (const a of f.activities) if (!refs.games.has(a.game)) errors.push(`${w}: mini game inexistente "${a.game}"`);
  }
  return errors;
}
