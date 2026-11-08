// Feira de adoção: um evento que a protagonista organiza, uma vez por estação, quando o café tem gatos demais
// (mais de minCats - 1 abrigados). Etapas: distribuir panfletos na rua -> a feira fica marcada para daqui a
// daysAfterFlyers dias -> no dia: placa de "fechado para a feira" na porta (o atendimento não abre), decorar o
// salão e, na mesa da feira, o match de adoção com os gatos do café. Se o dia passar sem a feira, ela volta ao
// começo (dá para organizar de novo na mesma estação).
// Puro: sem Phaser, DOM ou window. Os pontos são pontos de pedido (data/jobs.json: pt.fair_*); a sessão junta.

/** data/adoption.json: fair */
export interface FairConfig {
  minCats: number;
  /** Condição para poder começar, além dos gatos (ex.: uma semana depois do quintal pronto). */
  startWhen?: unknown;
  daysAfterFlyers: number;
  flyers: string[];
  sign: { point: string; tile: string };
  decorations: { point: string; tile: string }[];
  table: string;
  /** Personalidade do gato do café -> jeito na adoção (calm, playful, shy). */
  personalityFrom: Record<string, string>;
  /** Traços de quem não tem adoptionTraits nem tradução. */
  defaultTraits: Record<string, string>;
}

export type FairStage = 'idle' | 'flyers' | 'scheduled';

/** No save (v17). */
export interface FairState {
  stage: FairStage;
  /** Dia marcado da feira (com a etapa "scheduled"). */
  day: number | null;
  /** Pontos já feitos na etapa atual (panfletos; no dia: placa e decorações). */
  done: string[];
  /** Estação (contada desde o começo do jogo) da última feira que aconteceu. */
  lastSeason: number | null;
  /** Dia em que a última feira aconteceu (a placa e a decoração ficam até o fim dele). */
  heldOn: number | null;
}

export function newFair(): FairState {
  return { stage: 'idle', day: null, done: [], lastSeason: null, heldOn: null };
}

/** Estação contada desde o começo do jogo (0 = o primeiro inverno, 4 = o inverno do ano 2...). */
export const seasonCount = (day: number, daysPerSeason: number) => Math.floor((Math.max(1, day) - 1) / daysPerSeason);

/** Dá para começar a organizar uma feira agora? */
export function fairCanStart(s: FairState, cfg: FairConfig, cats: number, day: number, daysPerSeason: number): boolean {
  return s.stage === 'idle' && cats >= cfg.minCats && s.lastSeason !== seasonCount(day, daysPerSeason);
}

/** É o dia da feira (marcado e hoje)? */
export function isFairDay(s: FairState, day: number): boolean {
  return s.stage === 'scheduled' && s.day === day;
}

/** O atendimento fecha hoje: a placa da feira já está na porta (ou a feira já aconteceu hoje). */
export function fairClosesCafe(s: FairState, cfg: FairConfig, day: number): boolean {
  return (isFairDay(s, day) && s.done.includes(cfg.sign.point)) || s.heldOn === day;
}

/** Pontos da feira pendentes agora, na ordem das etapas (panfletos; no dia: placa -> decorações -> mesa). */
export function pendingFairPoints(s: FairState, cfg: FairConfig, day: number): string[] {
  if (s.stage === 'flyers') return cfg.flyers.filter((id) => !s.done.includes(id));
  if (!isFairDay(s, day)) return [];
  if (!s.done.includes(cfg.sign.point)) return [cfg.sign.point];
  const decor = cfg.decorations.map((d) => d.point).filter((id) => !s.done.includes(id));
  return decor.length > 0 ? decor : [cfg.table];
}

export type FairStep = 'flyer' | 'scheduled' | 'sign' | 'decor' | 'ready';

/** Fez um ponto da feira (não a mesa: a mesa é o mini game). Devolve o que aconteceu, ou null se não era a vez dele. */
export function doFairPoint(s: FairState, cfg: FairConfig, pointId: string, day: number): FairStep | null {
  if (pointId === cfg.table || !pendingFairPoints(s, cfg, day).includes(pointId)) return null;
  s.done.push(pointId);
  if (s.stage === 'flyers') {
    if (cfg.flyers.some((id) => !s.done.includes(id))) return 'flyer';
    s.stage = 'scheduled';
    s.day = day + cfg.daysAfterFlyers;
    s.done = [];
    return 'scheduled';
  }
  if (pointId === cfg.sign.point) return 'sign';
  return cfg.decorations.every((d) => s.done.includes(d.point)) ? 'ready' : 'decor';
}

/** A feira aconteceu (o match terminou): fica marcada a estação dela e volta ao começo. */
export function finishFair(s: FairState, daysPerSeason: number): void {
  s.lastSeason = seasonCount(s.day ?? 1, daysPerSeason);
  s.heldOn = s.day;
  s.stage = 'idle';
  s.day = null;
  s.done = [];
}

/** Virada do dia: a feira marcada para um dia que já passou sem acontecer volta ao começo. Devolve se perdeu. */
export function fairDayEnded(s: FairState, newDay: number): boolean {
  if (s.stage !== 'scheduled' || s.day === null || newDay <= s.day) return false;
  s.stage = 'idle';
  s.day = null;
  s.done = [];
  return true;
}

export function validateFair(cfg: FairConfig, refs: { points: ReadonlySet<string>; tiles: ReadonlySet<string>; traits: Record<string, Record<string, string>> }): string[] {
  const errors: string[] = [];
  const err = (m: string) => errors.push(`adoption: fair: ${m}`);
  if (!(cfg.minCats >= 1)) err('minCats precisa ser 1 ou mais');
  if (!(cfg.daysAfterFlyers >= 1)) err('daysAfterFlyers precisa ser 1 ou mais');
  for (const id of [...cfg.flyers, cfg.sign.point, ...cfg.decorations.map((d) => d.point), cfg.table]) if (!refs.points.has(id)) err(`ponto inexistente "${id}"`);
  for (const t of [cfg.sign.tile, ...cfg.decorations.map((d) => d.tile)]) if (!refs.tiles.has(t)) err(`tile inexistente "${t}"`);
  if (cfg.flyers.length === 0 || cfg.decorations.length === 0) err('precisa de panfletos e decorações');
  for (const [from, to] of Object.entries(cfg.personalityFrom)) if (!refs.traits.personality?.[to]) err(`personalityFrom "${from}" -> jeito inexistente "${to}"`);
  for (const [g, v] of Object.entries(cfg.defaultTraits)) if (!refs.traits[g]?.[v]) err(`defaultTraits com traço inexistente "${g}.${v}"`);
  return errors;
}
