// Vaquinha (pelo CatPay, o app de pagamento do jogo): genérica e reutilizável, uma por campanha. Só online: o dinheiro
// fica separado do caixa do café e só compra os itens de destino; cada gasto vai para o extrato (prestação de contas).
// Puro: sem Phaser, DOM ou window. Quem decide quando doam é o ced.ts (com os números de data/ced.json).
import type { Rng } from './rng';

export type CrowdfundStatus = 'inactive' | 'active' | 'done';

/** Uma doação: quem, quanto, quando e por onde (balcão do café, app a distância, ajuda de um vizinho, ela mesma). */
export interface Donation {
  donor: string;
  amount: number;
  day: number;
  source: 'counter' | 'remote' | 'boost' | 'player';
}

/** Um gasto do extrato: o item, quanto custou e onde foi usado. */
export interface Spend {
  item: string;
  amount: number;
  day: number;
  usedFor: string;
}

/** Item que o dinheiro pode comprar (o kit da campanha). */
export interface PurposeItem {
  id: string;
  name: string;
  price: number;
}

export interface Crowdfund {
  id: string;
  /** Para que é (ex.: "ced.1": os materiais da 1ª campanha). */
  purpose: string;
  target: number;
  raised: number;
  /** Saldo: arrecadado menos o já gasto. */
  balance: number;
  /** Itens de destino (o que o dinheiro pode comprar). */
  items: PurposeItem[];
  /** Dia limite (opcional). */
  deadline: number | null;
  status: CrowdfundStatus;
  startedOn: number;
  donations: Donation[];
  spends: Spend[];
  /** Quanto ela já completou do próprio caixa (tem teto por vaquinha). */
  toppedUp: number;
}

export function newCrowdfund(id: string, purpose: string, target: number, items: PurposeItem[], day: number, deadline: number | null): Crowdfund {
  return { id, purpose, target, raised: 0, balance: 0, items: items.map((i) => ({ ...i })), deadline, status: 'active', startedOn: day, donations: [], spends: [], toppedUp: 0 };
}

/** Recebe uma doação (só vaquinha ativa; valor inteiro positivo). Bateu a meta: concluída. */
export function donate(c: Crowdfund, d: Donation): boolean {
  if (c.status !== 'active' || !(d.amount > 0)) return false;
  const amount = Math.round(d.amount);
  c.donations.push({ ...d, amount });
  c.raised += amount;
  c.balance += amount;
  if (c.raised >= c.target) c.status = 'done';
  return true;
}

/** Quanto falta para a meta. */
export function remaining(c: Crowdfund): number {
  return Math.max(0, c.target - c.raised);
}

/** Quanto ela ainda pode completar do próprio caixa nesta vaquinha (teto: maxShare da meta). */
export function topUpRoom(c: Crowdfund, maxShare: number): number {
  return Math.max(0, Math.min(remaining(c), Math.floor(c.target * maxShare) - c.toppedUp));
}

/** Gasta o saldo num item de destino (vai para o extrato). Só itens de destino e com saldo. */
export function spend(c: Crowdfund, itemId: string, qty: number, day: number, usedFor: string): boolean {
  const item = c.items.find((i) => i.id === itemId);
  const amount = (item?.price ?? 0) * qty;
  if (!item || qty < 1 || amount > c.balance) return false;
  c.balance -= amount;
  c.spends.push({ item: itemId, amount, day, usedFor });
  return true;
}

/** Preço do kit inteiro (todos os itens de destino, um de cada). */
export function kitPrice(items: readonly PurposeItem[]): number {
  return items.reduce((n, i) => n + i.price, 0);
}

/** Quantos kits o saldo compra (um kit por gato). */
export function kitsAffordable(c: Crowdfund): number {
  const price = kitPrice(c.items);
  return price > 0 ? Math.floor(c.balance / price) : 0;
}

/** Chance de alguém doar pelo app num dia: nota do café, corações e alcance da campanha (data/ced.json: remote). */
export function remoteChance(r: { base: number; ratingMin: number; heartWeight: number; reach: number; maxChance: number }, rating: number | null, hearts: number): number {
  const ratingFactor = r.ratingMin + ((rating ?? 0) / 5) * (1 - r.ratingMin);
  return Math.min(r.maxChance, r.base * ratingFactor * (1 + hearts * r.heartWeight) * r.reach);
}

/** Valor de uma doação: sorteado na faixa, mais um tanto por coração. */
export function donationAmount(rng: Rng, amount: [number, number], perHeart: number, hearts: number): number {
  return rng.int(amount[0], amount[1]) + Math.round(hearts * perHeart);
}

/** A vaquinha está andando devagar demais? (média dos últimos windowDays dias, depois de afterDays dias) */
export function stalled(c: Crowdfund, day: number, a: { afterDays: number; windowDays: number; minPerDay: number }): boolean {
  if (c.status !== 'active' || day - c.startedOn < a.afterDays) return false;
  const from = day - a.windowDays;
  const recent = c.donations.filter((d) => d.day > from && d.day <= day).reduce((n, d) => n + d.amount, 0);
  return recent < a.minPerDay * a.windowDays;
}
