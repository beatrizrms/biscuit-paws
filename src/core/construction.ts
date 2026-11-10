// Obras com o construtor (o Tião): reparos (interno e da fachada) e troca de acabamento por área.
// Uma obra por vez: ela pede pelo celular, ouve o orçamento numa ligação e paga adiantado; ele vem no dia seguinte
// e trabalha os dias combinados (0,5 h por tile, 8 h por dia). Também abre e reforma os cômodos (data/rooms.json). O material da troca de acabamento é ela que compra
// (sai na hora do pedido; volta se ela recusar o orçamento). Puro: sem Phaser, DOM ou window.
import type { Cell, MapData, SurfaceDef } from './map';

export type RepairKind = 'inside' | 'outside';

export interface ConstructionData {
  /** NPC do construtor (data/npcs.json). */
  npc: string;
  hoursPerTile: number;
  hoursPerDay: number;
  /** Mão de obra por tile (troca de acabamento). */
  laborPerTile: number;
  /** Material por tile, pelo tipo da superfície (piso, papel de parede, lambri). */
  materialPerTile: Partial<Record<'floor' | 'wall' | 'wainscot', number>>;
  repairs: {
    /** Reparo interno: tira manchas, rachaduras e buraco de rato e devolve o acabamento original novo (surface -> finish). */
    inside: { name: string; price: number; days: number; finishes: Record<string, string>; site: { at: Cell; facing: Facing } };
    /** Reparo externo: a fachada abandonada vira a nova, na cor escolhida (um acabamento da fachada). */
    outside: { name: string; price: number; days: number; site: { map: string; at: Cell; facing: Facing } };
  };
  /** Pintar a fachada de outra cor depois do reparo: o preço é o do acabamento; leva estes dias. */
  facadeDays: number;
  /** Tile da fita que isola a área da obra (sólido). */
  tapeTile: string;
}

type Facing = 'down' | 'left' | 'right' | 'up';

/** O que foi pedido (orçamento) ou está em obra. */
export interface ConstructionJob {
  kind: 'inside' | 'outside' | 'finish' | 'facade' | 'room_open' | 'room_restore';
  /** Obra de cômodo (data/rooms.json): qual cômodo e onde ele trabalha. */
  roomId?: string;
  site?: { at: Cell; facing: Facing };
  /** Troca de acabamento: superfície, acabamento e células. */
  surfaceId?: string;
  finishId?: string;
  cells?: Cell[];
  /** Material já pago por ela (volta se recusar o orçamento). */
  material: number;
  /** Mão de obra (ou o preço do reparo), paga ao aceitar. */
  labor: number;
  days: number;
  /** Dias da obra (do primeiro ao último, inclusive). Só depois de aceita. */
  startDay?: number;
  endDay?: number;
}

/** Estado das obras no save (v24). */
export interface ConstructionState {
  repaired: RepairKind[];
  /** Orçamento esperando a resposta dela (a ligação). */
  quote: ConstructionJob | null;
  /** Obra aceita (do dia seguinte até terminar). */
  job: ConstructionJob | null;
  /** A obra terminou e ele ainda vai perguntar se ela quer mais algum serviço. */
  askPending: boolean;
  /** Acabamento célula a célula (troca por área): "col,row" -> acabamento. Vale por cima do da superfície. */
  cells: Record<string, string>;
}

export const newConstruction = (): ConstructionState => ({ repaired: [], quote: null, job: null, askPending: false, cells: {} });

export const cellKey = ([c, r]: Cell): string => `${c},${r}`;

/** Os dois reparos feitos (condição da inauguração). */
export function isRenovated(s: ConstructionState): boolean {
  return s.repaired.includes('inside') && s.repaired.includes('outside');
}

/** Dias de obra para tantos tiles (mínimo 1). */
export function jobDays(tiles: number, d: ConstructionData): number {
  return Math.max(1, Math.ceil((tiles * d.hoursPerTile) / d.hoursPerDay));
}

/**
 * Células de uma superfície dentro da seleção (retângulo de c0,r0 a c1,r1). Paredes (papel e lambri) pegam a coluna
 * inteira da superfície: não faz sentido trocar só um pedaço da altura.
 */
export function surfaceCells(map: MapData, surface: SurfaceDef, [c0, r0]: Cell, [c1, r1]: Cell): Cell[] {
  const layer = surface.kind === 'floor' ? map.layers.floor : map.layers.walls;
  const [x0, x1] = [Math.min(c0, c1), Math.max(c0, c1)];
  const [y0, y1] = surface.kind === 'floor' ? [Math.min(r0, r1), Math.max(r0, r1)] : [0, layer.length - 1];
  const cells: Cell[] = [];
  for (let r = y0; r <= y1; r++) for (let c = x0; c <= x1; c++) if (layer[r]?.[c] === surface.legend) cells.push([c, r]);
  return cells;
}

export type QuoteProblem = 'locked' | 'busy' | 'repair_first' | 'already_repaired' | 'no_cells' | 'already_painted' | 'wrong_surface' | 'no_money' | 'room_not_ready';

/** O que impede pedir uma obra agora (ou nada). */
export function quoteBlocker(s: ConstructionState, kind: ConstructionJob['kind'], unlocked: boolean): QuoteProblem | null {
  if (!unlocked) return 'locked';
  if (s.job || s.quote) return 'busy';
  if ((kind === 'inside' || kind === 'outside') && s.repaired.includes(kind)) return 'already_repaired';
  if ((kind === 'room_open' || kind === 'room_restore') && !isRenovated(s)) return 'repair_first';
  if (kind === 'finish' && !s.repaired.includes('inside')) return 'repair_first';
  if (kind === 'facade' && !s.repaired.includes('outside')) return 'repair_first';
  return null;
}

/** O construtor aceitou: a obra começa amanhã e dura `days` dias. */
export function scheduleJob(job: ConstructionJob, today: number): ConstructionJob {
  return { ...job, startDay: today + 1, endDay: today + job.days };
}

/** Obra em andamento hoje (ele está no lugar). */
export function workingToday(s: ConstructionState, day: number): boolean {
  return !!s.job && s.job.startDay !== undefined && day >= s.job.startDay && day <= (s.job.endDay ?? -1);
}

/**
 * Fim do dia: se o último dia da obra passou, aplica o resultado. Devolve a obra terminada (ou nada).
 * `finishes` é o acabamento por superfície (state.finishes), alterado aqui.
 */
export function finishJobIfDone(s: ConstructionState, finishes: Record<string, string>, day: number, d: ConstructionData, facadeSurface: string): ConstructionJob | null {
  const job = s.job;
  if (!job || job.endDay === undefined || day <= job.endDay) return null;
  if (job.kind === 'inside') {
    // Volta o acabamento original novo; o que ela já tinha escolhido antes (saves antigos) fica.
    for (const [surface, finish] of Object.entries(d.repairs.inside.finishes)) finishes[surface] ??= finish;
    s.repaired.push('inside');
  } else if (job.kind === 'outside') {
    if (job.finishId) finishes[facadeSurface] = job.finishId;
    s.repaired.push('outside');
  } else if (job.kind === 'facade') {
    if (job.finishId) finishes[facadeSurface] = job.finishId;
  } else if (job.finishId) {
    for (const cell of job.cells ?? []) s.cells[cellKey(cell)] = job.finishId;
  }
  s.job = null;
  s.askPending = true;
  return job;
}

/** Células isoladas pela obra hoje (não dá para pisar nem pôr móvel). Parede: a fileira de piso logo abaixo dela. */
export function isolatedCells(s: ConstructionState, map: MapData, day: number): Cell[] {
  if (!workingToday(s, day) || s.job?.kind !== 'finish') return [];
  const cells = s.job.cells ?? [];
  const floor = map.layers.floor;
  const out = new Map<string, Cell>();
  for (const [c, r] of cells) {
    const isFloor = (floor[r]?.[c] ?? '.') !== '.';
    if (isFloor) out.set(cellKey([c, r]), [c, r]);
    else {
      // Parede: a primeira célula de piso abaixo da coluna.
      let rr = r + 1;
      while (rr < floor.length && (floor[rr]?.[c] ?? '.') === '.') rr++;
      if (rr < floor.length) out.set(cellKey([c, rr]), [c, rr]);
    }
  }
  return [...out.values()];
}

/**
 * Onde ele trabalha hoje, sempre encostado numa parede (a animação martela para a direita): o lugar fixo do reparo
 * ou, numa troca de acabamento, a primeira fileira de piso (colada na parede do fundo), na coluna à esquerda da área.
 */
export function builderSpot(s: ConstructionState, map: MapData, day: number, d: ConstructionData): { map?: string; at: Cell; facing: Facing } | null {
  if (!workingToday(s, day) || !s.job) return null;
  const job = s.job;
  if (job.site) return job.site;
  if (job.kind === 'inside') return d.repairs.inside.site;
  if (job.kind === 'outside' || job.kind === 'facade') return d.repairs.outside.site;
  const area = isolatedCells(s, map, day);
  if (area.length === 0) return null;
  const col = Math.max(0, Math.min(...area.map(([c]) => c)) - 1);
  const floor = map.layers.floor;
  let row = 0;
  while (row < floor.length - 1 && (floor[row]?.[col] ?? '.') === '.') row++;
  return { at: [col, row], facing: 'right' };
}

export function validateConstruction(d: ConstructionData, refs: { npcs: ReadonlySet<string>; finishes: ReadonlySet<string>; surfaces: ReadonlySet<string> }): string[] {
  const errors: string[] = [];
  if (!refs.npcs.has(d.npc)) errors.push(`construction: NPC inexistente "${d.npc}"`);
  if (!(d.hoursPerTile > 0) || !(d.hoursPerDay > 0)) errors.push('construction: hoursPerTile e hoursPerDay precisam ser maiores que 0');
  for (const [k, r] of Object.entries(d.repairs)) {
    if (!(r.price >= 0) || !Number.isInteger(r.days) || r.days < 1) errors.push(`construction: reparo "${k}" com preço ou dias inválidos`);
  }
  for (const [s, f] of Object.entries(d.repairs.inside.finishes)) {
    if (!refs.surfaces.has(s)) errors.push(`construction: reparo interno: superfície inexistente "${s}"`);
    if (!refs.finishes.has(f)) errors.push(`construction: reparo interno: acabamento inexistente "${f}"`);
  }
  return errors;
}
