// Montar a feira (fase 4f): num tabuleiro do quintal visto de cima, a protagonista põe a mesa da feira, caixas de
// transporte, cercadinhos, o cartaz e a mesa de petiscos, e acomoda os gatos que vão para a feira. A pontuação vem de
// regras em dados (data/fair_setup.json): gatos acomodados, caminho livre do portão até cada estação, cartaz perto do
// portão e petiscos perto dos gatos. O resultado dá os visitantes, que viram famílias a mais no Match de adoção.
// Puro: sem Phaser, DOM ou window.
import { reachableCells, type Cell } from './map';
import type { Outcome } from './minigame';

export type FairItemKind = 'table' | 'carrier' | 'pen' | 'sign' | 'treats';
export const FAIR_ITEM_KINDS: readonly FairItemKind[] = ['table', 'carrier', 'pen', 'sign', 'treats'];

export interface FairItemDef {
  id: string;
  kind: FairItemKind;
  name: string;
  /** Largura e altura em células. */
  size: [number, number];
  /** Quantos gatos cabem (caixa e cercadinho). */
  capacity?: number;
  /** A arte (tile do catálogo) e o que vai por cima dela; sem tile, a cena desenha um provisório. */
  tile?: string;
  topTile?: string;
}

export interface FairSetupData {
  schemaVersion: 1;
  board: {
    cols: number;
    rows: number;
    /** O portão (por onde os visitantes entram): ninguém monta nada nele e o caminho começa ali. */
    gate: Cell[];
    /** O que já está no quintal (árvore, vaso): não dá para montar em cima. */
    blocked: Cell[];
    /** A arte: gramado (sorteado por célula), o caminho do portão e o que já está no quintal (as células em blocked). */
    floor: string[];
    gateFloor: string;
    decor: { tile: string; at: Cell }[];
  };
  items: FairItemDef[];
  /** Pesos (somam 100) e as distâncias (em células, contando a diagonal) das regras. */
  scoring: { housed: number; access: number; sign: number; treats: number; signNear: number; treatsNear: number };
  /** Visitantes = pontuação x max / 100; cada faixa dá famílias a mais no match. */
  visitors: { max: number; families: { at: number; extra: number }[] };
  /** Teto de famílias no match (cabe na tela). */
  maxFamilies: number;
}

/** minigames.json: fair_setup.difficulties. */
export interface FairSetupParams {
  /** Quantos gatos levar (os escolhidos são os acomodados). */
  cats: number;
  /** Quantas peças de cada tipo dá para usar. */
  stock: Partial<Record<FairItemKind, number>>;
  okAt: number;
  greatAt: number;
}

export interface PlacedFairItem {
  uid: number;
  item: string;
  at: Cell;
}

export interface FairBoard {
  placed: PlacedFairItem[];
  /** Gato -> peça (caixa ou cercadinho) onde está. */
  housed: Record<string, number>;
  nextUid: number;
}

export function newFairBoard(): FairBoard {
  return { placed: [], housed: {}, nextUid: 1 };
}

const key = ([c, r]: Cell) => `${c},${r}`;
const itemDef = (data: FairSetupData, id: string) => data.items.find((i) => i.id === id);

export function itemCells(def: FairItemDef, [c0, r0]: Cell): Cell[] {
  const out: Cell[] = [];
  for (let r = 0; r < def.size[1]; r++) for (let c = 0; c < def.size[0]; c++) out.push([c0 + c, r0 + r]);
  return out;
}

/** Quantas peças deste tipo ainda dá para pôr. */
export function stockLeft(data: FairSetupData, p: FairSetupParams, b: FairBoard, kind: FairItemKind): number {
  const used = b.placed.filter((x) => itemDef(data, x.item)?.kind === kind).length;
  return (p.stock[kind] ?? 0) - used;
}

export type PlaceProblem = 'out' | 'blocked' | 'gate' | 'overlap' | 'stock';

/** Por que não dá para pôr esta peça aqui (ou null). `ignore`: a peça que está sendo mudada de lugar. */
export function placeProblem(data: FairSetupData, p: FairSetupParams, b: FairBoard, itemId: string, at: Cell, ignore?: number): PlaceProblem | null {
  const def = itemDef(data, itemId);
  if (!def) return 'out';
  const { cols, rows, gate, blocked } = data.board;
  const cells = itemCells(def, at);
  if (cells.some(([c, r]) => c < 0 || r < 0 || c >= cols || r >= rows)) return 'out';
  const has = (list: readonly Cell[]) => cells.some((cell) => list.some((x) => key(x) === key(cell)));
  if (has(gate)) return 'gate';
  if (has(blocked)) return 'blocked';
  const taken = b.placed.filter((x) => x.uid !== ignore).flatMap((x) => itemCells(itemDef(data, x.item)!, x.at));
  if (has(taken)) return 'overlap';
  if (ignore === undefined && stockLeft(data, p, b, def.kind) <= 0) return 'stock';
  return null;
}

/** Põe (ou, com `uid`, muda de lugar) uma peça. Devolve o uid, ou o problema. */
export function placeFairItem(data: FairSetupData, p: FairSetupParams, b: FairBoard, itemId: string, at: Cell, uid?: number): number | PlaceProblem {
  const problem = placeProblem(data, p, b, itemId, at, uid);
  if (problem) return problem;
  const moving = uid !== undefined ? b.placed.find((x) => x.uid === uid) : undefined;
  if (moving) {
    moving.at = [at[0], at[1]];
    return moving.uid;
  }
  const placed = { uid: b.nextUid++, item: itemId, at: [at[0], at[1]] as Cell };
  b.placed.push(placed);
  return placed.uid;
}

/** Tira uma peça (os gatos que estavam nela saem junto). */
export function removeFairItem(b: FairBoard, uid: number): void {
  b.placed = b.placed.filter((x) => x.uid !== uid);
  for (const [cat, at] of Object.entries(b.housed)) if (at === uid) delete b.housed[cat];
}

/** A peça nesta célula (ou undefined). */
export function fairItemAt(data: FairSetupData, b: FairBoard, cell: Cell): PlacedFairItem | undefined {
  return b.placed.find((x) => itemCells(itemDef(data, x.item)!, x.at).some((c) => key(c) === key(cell)));
}

export type HouseProblem = 'not_holder' | 'full' | 'limit';

/** Acomoda um gato numa caixa ou cercadinho (troca de lugar se já estava em outro). */
export function houseCat(data: FairSetupData, p: FairSetupParams, b: FairBoard, catId: string, uid: number): HouseProblem | null {
  const placed = b.placed.find((x) => x.uid === uid);
  const def = placed && itemDef(data, placed.item);
  if (!def?.capacity) return 'not_holder';
  if (b.housed[catId] === uid) return null;
  if (Object.values(b.housed).filter((u) => u === uid).length >= def.capacity) return 'full';
  if (b.housed[catId] === undefined && Object.keys(b.housed).length >= p.cats) return 'limit';
  b.housed[catId] = uid;
  return null;
}

export function unhouseCat(b: FairBoard, catId: string): void {
  delete b.housed[catId];
}

/** Peças com caminho livre: alguma célula vizinha (sem diagonal) alcançável a pé a partir do portão. */
export function accessibleItems(data: FairSetupData, b: FairBoard): Set<number> {
  const { cols, rows, gate, blocked } = data.board;
  const solid = Array.from({ length: rows }, () => Array.from({ length: cols }, () => false));
  for (const [c, r] of [...blocked, ...b.placed.flatMap((x) => itemCells(itemDef(data, x.item)!, x.at))]) if (solid[r]) solid[r]![c] = true;
  const reached = solid.map((line) => line.map(() => false));
  for (const g of gate) reachableCells(solid, g).forEach((line, r) => line.forEach((v, c) => v && (reached[r]![c] = true)));
  const out = new Set<number>();
  for (const x of b.placed) {
    const cells = itemCells(itemDef(data, x.item)!, x.at);
    const near = cells.flatMap(([c, r]) => [[c + 1, r], [c - 1, r], [c, r + 1], [c, r - 1]] as Cell[]);
    if (near.some(([c, r]) => reached[r]?.[c])) out.add(x.uid);
  }
  return out;
}

/** Distância entre duas peças (ou peça e células), contando a diagonal: 0 = encostadas por cima. */
function gap(a: readonly Cell[], b: readonly Cell[]): number {
  let best = Infinity;
  for (const [ac, ar] of a) for (const [bc, br] of b) best = Math.min(best, Math.max(Math.abs(ac - bc), Math.abs(ar - br)) - 1);
  return Math.max(0, best);
}

export interface FairScore {
  /** Cada regra de 0 a 1. */
  housed: number;
  access: number;
  sign: number;
  treats: number;
  hasTable: boolean;
  /** 0 a 100. */
  score: number;
  visitors: number;
  extraFamilies: number;
  /** Peças sem caminho (para a tela marcar). */
  blockedItems: number[];
}

/**
 * Pontua a montagem. `available`: quantos gatos dá para levar (o pedido da dificuldade, ou menos se o café não
 * tem tantos). Sem a mesa da feira com caminho livre, não há feira: pontuação 0.
 */
export function scoreFair(data: FairSetupData, p: FairSetupParams, b: FairBoard, available: number): FairScore {
  const s = data.scoring;
  const reach = accessibleItems(data, b);
  const cellsOf = (x: PlacedFairItem) => itemCells(itemDef(data, x.item)!, x.at);
  const kindOf = (x: PlacedFairItem) => itemDef(data, x.item)!.kind;
  const want = Math.min(p.cats, available);
  const housed = want === 0 ? 1 : Math.min(1, Object.keys(b.housed).length / want);
  const access = b.placed.length === 0 ? 0 : reach.size / b.placed.length;
  const sign = b.placed.some((x) => kindOf(x) === 'sign' && reach.has(x.uid) && gap(cellsOf(x), data.board.gate) <= s.signNear) ? 1 : 0;
  const occupied = b.placed.filter((x) => Object.values(b.housed).includes(x.uid));
  const treatsTables = b.placed.filter((x) => kindOf(x) === 'treats');
  const treats = occupied.length === 0 ? 0 : occupied.filter((h) => treatsTables.some((t) => gap(cellsOf(h), cellsOf(t)) <= s.treatsNear)).length / occupied.length;
  const hasTable = b.placed.some((x) => kindOf(x) === 'table' && reach.has(x.uid));
  const score = hasTable ? Math.round(s.housed * housed + s.access * access + s.sign * sign + s.treats * treats) : 0;
  const visitors = Math.round((score * data.visitors.max) / 100);
  const extraFamilies = Math.max(0, ...data.visitors.families.filter((f) => visitors >= f.at).map((f) => f.extra));
  return { housed, access, sign, treats, hasTable, score, visitors, extraFamilies, blockedItems: b.placed.filter((x) => !reach.has(x.uid)).map((x) => x.uid) };
}

/** Perfeito = acima de greatAt com todos os gatos acomodados; deu certo = acima de okAt. */
export function fairSetupOutcome(p: FairSetupParams, r: FairScore): Outcome {
  if (r.score >= p.greatAt && r.housed >= 1) return 'great';
  return r.score >= p.okAt ? 'ok' : 'fail';
}

export function validateFairSetup(
  data: FairSetupData,
  difficulties: Record<string, FairSetupParams> | undefined,
  tiles?: Readonly<Record<string, { w: number; h: number }>>,
): string[] {
  const errors: string[] = [];
  const err = (m: string) => errors.push(`fair_setup: ${m}`);
  const { cols, rows, gate, blocked } = data.board;
  const inside = ([c, r]: Cell) => c >= 0 && r >= 0 && c < cols && r < rows;
  if (gate.length === 0) err('precisa de um portão');
  for (const c of [...gate, ...blocked]) if (!inside(c)) err(`célula fora do tabuleiro ${key(c)}`);
  const ids = new Set<string>();
  for (const i of data.items) {
    if (!i.id.startsWith('fair.')) err(`peça "${i.id}" deve começar com "fair."`);
    if (ids.has(i.id)) err(`peça repetida "${i.id}"`);
    ids.add(i.id);
    if (!FAIR_ITEM_KINDS.includes(i.kind)) err(`peça "${i.id}" de tipo desconhecido "${i.kind}"`);
    if ((i.kind === 'carrier' || i.kind === 'pen') !== (i.capacity !== undefined && i.capacity > 0)) err(`peça "${i.id}": só caixa e cercadinho têm capacity`);
  }
  if (tiles) {
    const named = [...data.board.floor, data.board.gateFloor, ...data.board.decor.map((d) => d.tile), ...data.items.flatMap((i) => [i.tile, i.topTile])];
    for (const t of named) if (t && !tiles[t]) err(`tile inexistente "${t}"`);
    for (const d of data.board.decor) {
      const t = tiles[d.tile];
      if (!t) continue;
      for (let r = 0; r < t.h; r++) for (let c = 0; c < t.w; c++) if (!blocked.some((b) => b[0] === d.at[0] + c && b[1] === d.at[1] + r)) err(`decor "${d.tile}" em ${key([d.at[0] + c, d.at[1] + r])} fora de blocked`);
    }
  }
  for (const k of FAIR_ITEM_KINDS) if (data.items.filter((i) => i.kind === k).length !== 1) err(`precisa de exatamente uma peça do tipo "${k}"`);
  const s = data.scoring;
  if (s.housed + s.access + s.sign + s.treats !== 100) err('os pesos de scoring precisam somar 100');
  for (const [d, p] of Object.entries(difficulties ?? {})) {
    if (!(p.okAt < p.greatAt)) err(`${d}: okAt precisa ser menor que greatAt`);
    if (!p.stock.table) err(`${d}: precisa de pelo menos uma mesa da feira`);
    const room = data.items.reduce((n, i) => n + (i.capacity ?? 0) * (p.stock[i.kind] ?? 0), 0);
    if (room < p.cats) err(`${d}: caixas e cercadinhos não cabem ${p.cats} gatos`);
  }
  return errors;
}
