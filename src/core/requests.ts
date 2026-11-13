// Pedidos dos amigos (data/requests.json): de tempos em tempos, fora da história, um amigo conhecido passa no café com
// um pedido pequeno (servir uma receita, ver um móvel no café, mimar os gatos, trazer algo do mercado). O pedido vira
// uma linha no balão e não expira (pode atravessar estações); feito, dá corações, moedas e às vezes um presente.
// Puro: sem Phaser, DOM ou window.
import type { Condition } from './content';
import type { Rng } from './rng';

export type RequestKind = 'serve' | 'place' | 'care' | 'bring';

export interface FriendRequestDef {
  id: string;
  /** Quem pede (npc.*). */
  npc: string;
  kind: RequestKind;
  /** serve: a receita; place/bring: o item; care: o mini game de cuidado (sem: qualquer um). */
  recipe?: string;
  item?: string;
  game?: string;
  /** Quantas vezes (serve, care) ou quantas peças (place, bring). */
  count: number;
  /** A linha do balão (curta, o que fazer) e as falas da chegada e do agradecimento (com o nome de quem fala). */
  text: string;
  intro: string;
  thanks: string;
  /** Quando pode aparecer (o amigo já conhecido, a receita liberada...). */
  when?: Condition;
  reward: { points: number; money?: number; item?: string };
  /** Pode voltar depois de feito. */
  repeatable?: boolean;
}

export interface RequestsData {
  schemaVersion: 1;
  /** Intervalo (dias, sorteado entre os dois) entre um pedido novo e o próximo. */
  everyDays: [number, number];
  /** Quantos pedidos abertos ao mesmo tempo (um por amigo). */
  maxActive: number;
  requests: FriendRequestDef[];
}

export interface ActiveRequest {
  id: string;
  /** Dia em que o amigo pediu. */
  since: number;
  /** Quanto já foi feito (serve, care). */
  progress: number;
}

/** No save. */
export interface RequestsState {
  active: ActiveRequest[];
  /** Quantas vezes cada pedido foi feito. */
  done: Record<string, number>;
  /** Dia do próximo pedido novo (null: ainda não calculado). */
  nextOn: number | null;
}

export function newRequests(): RequestsState {
  return { active: [], done: {}, nextOn: null };
}

/** Os pedidos que podem aparecer agora: não abertos, não feitos (ou repetíveis), de um amigo sem pedido aberto. */
export function requestCandidates(data: RequestsData, s: RequestsState, ok: (def: FriendRequestDef) => boolean): FriendRequestDef[] {
  const busy = new Set(s.active.map((a) => data.requests.find((r) => r.id === a.id)?.npc));
  return data.requests.filter((r) => !s.active.some((a) => a.id === r.id) && (!s.done[r.id] || r.repeatable) && !busy.has(r.npc) && ok(r));
}

/** De manhã: na data, se cabe mais um pedido e a história não tem meta, sorteia um. Devolve o pedido novo. */
export function maybeNewRequest(data: RequestsData, s: RequestsState, day: number, rng: Rng, storyGoal: boolean, ok: (def: FriendRequestDef) => boolean): FriendRequestDef | null {
  const gap = () => rng.int(data.everyDays[0], data.everyDays[1]);
  if (s.nextOn === null) s.nextOn = day + gap();
  if (day < s.nextOn || storyGoal || s.active.length >= data.maxActive) return null;
  const options = requestCandidates(data, s, ok);
  if (options.length === 0) return null;
  const pick = options[rng.int(0, options.length - 1)]!;
  s.active.push({ id: pick.id, since: day, progress: 0 });
  s.nextOn = day + gap();
  return pick;
}

/** Conta um passo (uma receita servida, um cuidado). Devolve os pedidos que ficaram completos. */
export function countRequest(data: RequestsData, s: RequestsState, match: (def: FriendRequestDef) => boolean): FriendRequestDef[] {
  const out: FriendRequestDef[] = [];
  for (const a of s.active) {
    const def = data.requests.find((r) => r.id === a.id);
    if (!def || !match(def)) continue;
    a.progress = Math.min(def.count, a.progress + 1);
    if (a.progress >= def.count) out.push(def);
  }
  return out;
}

/** Tira o pedido dos abertos e anota como feito. */
export function completeRequest(s: RequestsState, id: string): void {
  s.active = s.active.filter((a) => a.id !== id);
  s.done[id] = (s.done[id] ?? 0) + 1;
}

export function validateRequests(data: RequestsData, refs: { npcs: ReadonlySet<string>; recipes: ReadonlySet<string>; items: ReadonlySet<string>; games: ReadonlySet<string> }): string[] {
  const errors: string[] = [];
  const err = (m: string) => errors.push(`requests: ${m}`);
  if (!(data.everyDays?.[0] >= 1 && data.everyDays[1] >= data.everyDays[0])) err('everyDays precisa ser [mín, máx], mín >= 1');
  if (!(Number.isInteger(data.maxActive) && data.maxActive >= 1)) err('maxActive precisa ser um inteiro >= 1');
  const ids = new Set<string>();
  for (const r of data.requests ?? []) {
    const w = `"${r.id}"`;
    if (!r.id?.startsWith('req.')) err(`${w}: id deve começar com "req."`);
    if (ids.has(r.id)) err(`${w}: id repetido`);
    ids.add(r.id);
    if (!refs.npcs.has(r.npc)) err(`${w}: npc inexistente "${r.npc}"`);
    if (!['serve', 'place', 'care', 'bring'].includes(r.kind)) err(`${w}: kind inválido "${r.kind}"`);
    if (r.kind === 'serve' && !refs.recipes.has(r.recipe ?? '')) err(`${w}: receita inexistente "${r.recipe}"`);
    if ((r.kind === 'place' || r.kind === 'bring') && !refs.items.has(r.item ?? '')) err(`${w}: item inexistente "${r.item}"`);
    if (r.kind === 'care' && r.game && !refs.games.has(r.game)) err(`${w}: mini game inexistente "${r.game}"`);
    if (!(Number.isInteger(r.count) && r.count >= 1)) err(`${w}: count precisa ser >= 1`);
    if (!r.text || !r.intro || !r.thanks) err(`${w}: falta text, intro ou thanks`);
    if (r.reward?.item && !refs.items.has(r.reward.item)) err(`${w}: presente inexistente "${r.reward.item}"`);
  }
  return errors;
}
