// Capacidade do café: quantos clientes cabem ao mesmo tempo, e de que forma.
// Puro: sem Phaser, DOM ou window. As regras (onde cada louça pode ser servida) vêm de data/service.json.
import type { ServiceKind, Vessel } from './recipes';

export interface CapacityInput {
  /** Louça disponível para o atendimento (limpa + já servida/em preparo). */
  vessels: Record<Vessel, number>;
  /** Lugares em pé (na frente de balcão) e assentos (cadeira junto de mesa). */
  standingSpots: number;
  seats: number;
  /** Onde cada louça pode ser servida (ex.: xícara em pé ou na mesa; prato só na mesa). */
  servedAt: Record<Vessel, readonly ServiceKind[]>;
  /** Louças que o cardápio de agora usa (sem receita de prato no quadro, prato não conta). */
  menuVessels: ReadonlySet<Vessel>;
}

export interface CapacityView {
  /** Clientes ao mesmo tempo. */
  total: number;
  /** No máximo quantos em pé e quantos sentados (cada um sozinho). */
  standing: number;
  seated: number;
  /** Dá para servir comida agora (louça só de mesa, como o prato, + assento + receita no quadro)? */
  canEat: boolean;
}

/**
 * Cada cliente ocupa um lugar e uma peça de louça. Quem fica em pé só usa louça servida em pé;
 * quem senta usa louça servida na mesa. O total é o maior número que cabe respeitando os dois.
 */
export function capacityOf(input: CapacityInput): CapacityView {
  const vessels = Object.keys(input.servedAt) as Vessel[];
  const sum = (pred: (at: readonly ServiceKind[]) => boolean) =>
    vessels.filter((v) => input.menuVessels.has(v) && pred(input.servedAt[v])).reduce((n, v) => n + (input.vessels[v] ?? 0), 0);
  const both = sum((at) => at.includes('standing') && at.includes('table'));
  const standOnly = sum((at) => at.includes('standing') && !at.includes('table'));
  const tableOnly = sum((at) => at.includes('table') && !at.includes('standing'));
  const maxStanding = Math.min(input.standingSpots, both + standOnly);
  const maxSeated = Math.min(input.seats, both + tableOnly);
  // Tenta cada número de clientes em pé: eles usam primeiro a louça só de pé; o resto vai para a mesa.
  let total = 0;
  for (let s = 0; s <= maxStanding; s++) {
    const bothLeft = both - Math.max(0, s - standOnly);
    total = Math.max(total, s + Math.min(input.seats, bothLeft + tableOnly));
  }
  return { total, standing: maxStanding, seated: maxSeated, canEat: input.seats > 0 && tableOnly > 0 };
}
