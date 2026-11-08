// Chegada de gatos: poucos MODELOS (na_porta, pegadas, preso...) combinados com DADOS de cada chegada
// (data/arrivals.json): gatilho, lugar, pista, gato (fixo ou gerado), condição, etapas, resultado e o que fazer
// com o café cheio. Aqui ficam os tipos, a validação e as decisões puras (o gatilho vale? quem entra na fila hoje?
// quando é a próxima?). Quem executa (cria o gato, abriga, guarda no save) é o ArrivalSystem.
// Puro: sem Phaser, DOM ou window.
import type { GenerateSpec } from './catGen';
import { pickWeighted, type Rng } from './rng';
import { parseClock } from './time';
import { modelReady, stepsOf } from './arrivalModels';

export const ARRIVAL_MODELS = ['na_porta', 'pegadas', 'preso', 'vizinho_traz', 'gato_leva', 'ninhada', 'dentro_do_cafe', 'entrega', 'em_perigo', 'mural'] as const;
export type ArrivalModel = (typeof ARRIVAL_MODELS)[number];

export const PLACE_KINDS = ['cafe_door', 'street', 'roof', 'market', 'backyard', 'inside_cafe', 'clinic'] as const;
export type PlaceKind = (typeof PLACE_KINDS)[number];

export const CLUES = ['meow', 'footprints', 'neighbor', 'poster', 'leader', 'none'] as const;
export type Clue = (typeof CLUES)[number];

/** Café cheio: o gato fica provisório (com prazo), vai para o abrigo da vila (adoção) ou a chegada espera vaga. */
export type WhenFull = 'provisional' | 'adoption' | 'postpone';

export interface ArrivalTrigger {
  /** Dia do jogo: a partir de [0] e, se houver, até [1]. */
  days?: [number, number?];
  /** Hora do dia: de, até ("06:00", "09:00"). */
  hours?: [string, string];
  seasons?: string[];
  /** Clima do dia (data/seasons.json: weather). */
  weather?: string[];
  /** Gatos abrigados no café. */
  cats?: { gte?: number; lte?: number };
  /** Reputação felina (a "nota do café"). */
  reputation?: { gte: number };
  /** Qualquer condição da história (cômodo descoberto, corações, marco concluído...). */
  when?: unknown;
}

/** Uma etapa da chegada (o modelo dá as etapas padrão: arrivalModels.ts; os dados podem trocar). */
export type ArrivalStep =
  /** Ir até o lugar da chegada (place.map / place.at) e apertar E (o gato, ou o vizinho, espera ali). */
  | { meet: true }
  /** Cartaz no mural do mercado e no Vila Hoje: "Acolher" segue, "Agora não" recusa. */
  | { poster: true }
  /** Seguir o gato do café que leva até o lugar (place.route; o fim é o destino, onde o gato novo espera). */
  | { lead: true }
  | { dialogue: string }
  | { cutscene: string }
  | { script: string }
  /** Pista no mapa: ponto de data/jobs.json que ela precisa visitar. */
  | { clue: string }
  | { minigame: { id: string; difficulty: 'easy' | 'normal' | 'hard' } }
  /** Escolha sim/não (ex.: acolher o gato do mural). Textos em ui_text. */
  | { choice: string };

export interface ArrivalResult {
  /** Pontos de afeto do gato pela protagonista ao entrar. */
  startPoints?: number;
  /** Vizinho envolvido ganha pontos com a protagonista quando ela aceita o gato. */
  npc?: { id: string; points: number };
  /** Moedas que entram (bônus) ou saem (custo do vet, ração...). */
  money?: number;
}

export interface ArrivalDef {
  /** "arr.*", estável. */
  id: string;
  model: ArrivalModel;
  /** scripted: escrita à mão, dispara quando o gatilho vale (prioridade); random: entra no sorteio do dia. */
  kind: 'scripted' | 'random';
  repeatable?: boolean;
  /** Dias mínimos entre duas vezes (com repeatable). */
  minGapDays?: number;
  /** Peso no sorteio do dia (random; padrão 1). */
  weight?: number;
  trigger: ArrivalTrigger;
  place: {
    kind: PlaceKind;
    map?: string;
    /** Onde o encontro acontece (o gato esperando; nas pegadas, o esconderijo; no gato_leva, onde o guia aparece). */
    at?: [number, number];
    /** pegadas: as células das pegadas, da porta até perto do esconderijo. */
    trail?: [number, number][];
    /** pegadas: em quantos minutos a neve cobre as pegadas (some primeiro o começo: seguir cedo é mais fácil). */
    fadeMinutes?: number;
    /** gato_leva: o caminho do guia; a última célula é onde o gato novo espera. */
    route?: [number, number][];
  };
  clue: Clue;
  /** Gato fixo (data/cats.json) ou gerado (o que vier fixo; o resto sorteado). */
  cat: { id: string } | { generate: GenerateSpec };
  /** Como chega (data/cat_profiles.json: conditions). Sem ela: a do gato gerado, ou "healthy". */
  condition?: string;
  steps: ArrivalStep[];
  result?: ArrivalResult;
  whenFull: WhenFull;
}

export interface ArrivalsData {
  schemaVersion: 1;
  /** Intervalo (dias, sorteado entre os dois) entre chegadas sorteadas, por fase do jogo. */
  pacing: { phases: { untilDay?: number; everyDays: [number, number] }[] };
  /** O sorteio automático só começa quando isto vale (depois dos gatos escritos à mão). */
  autoStartWhen?: unknown;
  queueMax: number;
  provisional: { days: number };
  arrivals: ArrivalDef[];
}

/** A chegada em andamento. */
export interface ActiveArrival {
  id: string;
  catId: string;
  condition: string;
  startedOn: number;
  /** Minuto absoluto em que começou (as pegadas somem com o tempo). */
  startedAt?: number;
  /** gato_leva: o gato do café que guia. */
  leaderId?: string;
  /** Etapa atual (índice em steps). */
  step: number;
}

/** No save (v18). */
export interface ArrivalsState {
  active: ActiveArrival | null;
  /** Chegadas esperando a vez (o evento exclusivo acabar, ou vaga no café). */
  queue: string[];
  /** Último dia em que cada chegada começou. */
  last: Record<string, number>;
  /** Dia da próxima chegada sorteada (null: ainda não calculado). */
  nextOn: number | null;
  /** Sequência dos gatos gerados (cat.gen.<n>). */
  seq: number;
  /** Gatos que foram para o abrigo da vila (café cheio): entram na feira de adoção. */
  shelterPool: string[];
}

export function newArrivals(): ArrivalsState {
  return { active: null, queue: [], last: {}, nextOn: null, seq: 0, shelterPool: [] };
}

/** O que o gatilho olha agora. `evaluate` responde as condições da história. */
export interface TriggerContext {
  day: number;
  time: number;
  season: string;
  weather: string;
  cats: number;
  reputation: number;
  evaluate(condition: unknown): boolean;
}

/**
 * Pegadas ainda visíveis: a neve cobre do começo (perto da porta) para o fim, ao longo de fadeMinutes.
 * Sem fadeMinutes, todas ficam.
 */
export function visibleTrail(trail: readonly [number, number][], fadeMinutes: number | undefined, elapsedMinutes: number): [number, number][] {
  if (!fadeMinutes) return [...trail];
  const gone = Math.floor(Math.max(0, Math.min(1, elapsedMinutes / fadeMinutes)) * trail.length);
  return trail.slice(gone);
}

/** O gatilho da chegada vale agora? */
export function triggerHolds(t: ArrivalTrigger, ctx: TriggerContext): boolean {
  if (t.days && (ctx.day < t.days[0] || (t.days[1] !== undefined && ctx.day > t.days[1]))) return false;
  if (t.hours && (ctx.time < parseClock(t.hours[0]) || ctx.time >= parseClock(t.hours[1]))) return false;
  if (t.seasons && !t.seasons.includes(ctx.season)) return false;
  if (t.weather && !t.weather.includes(ctx.weather)) return false;
  if (t.cats && ((t.cats.gte !== undefined && ctx.cats < t.cats.gte) || (t.cats.lte !== undefined && ctx.cats > t.cats.lte))) return false;
  if (t.reputation && ctx.reputation < t.reputation.gte) return false;
  if (t.when !== undefined && !ctx.evaluate(t.when)) return false;
  return true;
}

/** Ainda pode acontecer hoje? (nunca aconteceu; ou repete e já passou o intervalo) */
export function canHappen(def: ArrivalDef, s: ArrivalsState, day: number): boolean {
  if (s.active?.id === def.id || s.queue.includes(def.id)) return false;
  const last = s.last[def.id];
  if (last === undefined) return true;
  return !!def.repeatable && day - last >= (def.minGapDays ?? 1);
}

/** Intervalo até a próxima chegada sorteada, pela fase do jogo (a primeira com untilDay >= dia, ou a última). */
export function nextGap(data: Pick<ArrivalsData, 'pacing'>, day: number, rng: Rng): number {
  const phase = data.pacing.phases.find((p) => p.untilDay === undefined || day <= p.untilDay) ?? data.pacing.phases[data.pacing.phases.length - 1]!;
  return rng.int(phase.everyDays[0], phase.everyDays[1]);
}

/**
 * Quem entra na fila agora: as escritas à mão cujo gatilho vale (todas) e, se o sorteio está ligado e chegou o
 * dia, uma das sorteadas que valem (por peso). Não passa de queueMax.
 */
export function arrivalsToQueue(data: ArrivalsData, s: ArrivalsState, ctx: TriggerContext, rng: Rng, autoOn: boolean): string[] {
  const out: string[] = [];
  const room = () => s.queue.length + out.length < data.queueMax;
  for (const def of data.arrivals) {
    if (def.kind === 'scripted' && room() && canHappen(def, s, ctx.day) && triggerHolds(def.trigger, ctx)) out.push(def.id);
  }
  if (autoOn && room() && s.nextOn !== null && ctx.day >= s.nextOn && !s.active && s.queue.length === 0) {
    const pool = data.arrivals.filter((d) => d.kind === 'random' && canHappen(d, s, ctx.day) && triggerHolds(d.trigger, ctx));
    if (pool.length > 0) out.push(pickWeighted(rng, Object.fromEntries(pool.map((d) => [d.id, d.weight ?? 1]))));
  }
  return out;
}

export function validateArrivals(
  data: ArrivalsData,
  refs: {
    maps: ReadonlySet<string>;
    seasons: ReadonlySet<string>;
    weather: ReadonlySet<string>;
    cats: ReadonlySet<string>;
    personalities: ReadonlySet<string>;
    conditions: ReadonlySet<string>;
    variants: ReadonlySet<string>;
    npcs: ReadonlySet<string>;
    dialogues: ReadonlySet<string>;
    cutscenes: ReadonlySet<string>;
    scripts: ReadonlySet<string>;
    points: ReadonlySet<string>;
    minigames: ReadonlySet<string>;
  },
  checkCondition: (where: string, c: unknown) => void,
): string[] {
  const errors: string[] = [];
  const err = (m: string) => errors.push(`arrivals: ${m}`);
  if (data.pacing.phases.length === 0) err('pacing sem fases');
  for (const p of data.pacing.phases) if (!(p.everyDays[0] >= 1 && p.everyDays[1] >= p.everyDays[0])) err('pacing: everyDays precisa ser [mín >= 1, máx >= mín]');
  if (!(data.queueMax >= 1)) err('queueMax precisa ser 1 ou mais');
  if (!(data.provisional.days >= 1)) err('provisional.days precisa ser 1 ou mais');
  if (data.autoStartWhen !== undefined) checkCondition('arrivals: autoStartWhen', data.autoStartWhen);
  const ids = new Set<string>();
  for (const a of data.arrivals) {
    const w = `chegada "${a.id}"`;
    if (!a.id.startsWith('arr.')) err(`${w}: id deve começar com "arr."`);
    if (ids.has(a.id)) err(`${w}: id repetido`);
    ids.add(a.id);
    if (!ARRIVAL_MODELS.includes(a.model)) err(`${w}: modelo desconhecido "${a.model}"`);
    if (!['scripted', 'random'].includes(a.kind)) err(`${w}: kind inválido "${a.kind}"`);
    if (!['provisional', 'adoption', 'postpone'].includes(a.whenFull)) err(`${w}: whenFull inválido "${a.whenFull}"`);
    if (!PLACE_KINDS.includes(a.place.kind)) err(`${w}: lugar desconhecido "${a.place.kind}"`);
    if (a.place.map && !refs.maps.has(a.place.map)) err(`${w}: mapa inexistente "${a.place.map}"`);
    if (!CLUES.includes(a.clue)) err(`${w}: pista desconhecida "${a.clue}"`);
    const t = a.trigger;
    if (t.hours) for (const h of t.hours) if (!/^\d{1,2}:\d{2}$/.test(h)) err(`${w}: hora inválida "${h}"`);
    for (const s of t.seasons ?? []) if (!refs.seasons.has(s)) err(`${w}: estação inexistente "${s}"`);
    for (const x of t.weather ?? []) if (!refs.weather.has(x)) err(`${w}: clima inexistente "${x}"`);
    if (t.when !== undefined) checkCondition(`arrivals: ${w}`, t.when);
    if ('id' in a.cat) {
      if (!refs.cats.has(a.cat.id)) err(`${w}: gato inexistente "${a.cat.id}"`);
    } else {
      const g = a.cat.generate;
      if (g.personality && !refs.personalities.has(g.personality)) err(`${w}: personalidade inexistente "${g.personality}"`);
      if (g.condition && !refs.conditions.has(g.condition)) err(`${w}: condição inexistente "${g.condition}"`);
      if (g.variant && !refs.variants.has(g.variant)) err(`${w}: variante inexistente "${g.variant}"`);
    }
    if (a.condition && !refs.conditions.has(a.condition)) err(`${w}: condição inexistente "${a.condition}"`);
    if (a.result?.npc && !refs.npcs.has(a.result.npc.id)) err(`${w}: NPC inexistente "${a.result.npc.id}"`);
    if (!modelReady(a.model)) err(`${w}: o modelo "${a.model}" ainda não tem etapas`);
    const steps = stepsOf(a);
    if (steps.some((s) => 'meet' in s) && (!a.place.map || !a.place.at)) err(`${w}: a etapa meet precisa de place.map e place.at`);
    if (a.model === 'vizinho_traz' && !a.result?.npc) err(`${w}: vizinho_traz precisa de result.npc (quem traz o gato)`);
    if (a.model === 'pegadas' && (a.place.trail?.length ?? 0) < 2) err(`${w}: pegadas precisa de place.trail (2 células ou mais)`);
    if (steps.some((s) => 'lead' in s) && (a.place.route?.length ?? 0) < 2) err(`${w}: a etapa lead precisa de place.route (2 células ou mais)`);
    for (const step of steps) {
      if ('dialogue' in step && !refs.dialogues.has(step.dialogue)) err(`${w}: fala inexistente "${step.dialogue}"`);
      else if ('cutscene' in step && !refs.cutscenes.has(step.cutscene)) err(`${w}: cena inexistente "${step.cutscene}"`);
      else if ('script' in step && !refs.scripts.has(step.script)) err(`${w}: roteiro inexistente "${step.script}"`);
      else if ('clue' in step && !refs.points.has(step.clue)) err(`${w}: ponto inexistente "${step.clue}"`);
      else if ('minigame' in step && !refs.minigames.has(step.minigame.id)) err(`${w}: mini game inexistente "${step.minigame.id}"`);
    }
  }
  return errors;
}
