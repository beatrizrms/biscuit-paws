// Mãos: objetos físicos que a personagem leva (bebida pronta, louça suja, um petisco).
// A mochila é o inventário (state.inventory): coisas abstratas, sem peso. Puro: sem Phaser, DOM ou window.
import type { Cell } from './map';
import type { CarryConfig, Vessel } from './recipes';

export type HandItem =
  /** Bebida pronta, na louça (a louça volta suja depois que o cliente consome). */
  | { kind: 'drink'; recipe: string; vessel: Vessel }
  /** Louça suja, a caminho da pia. */
  | { kind: 'dirty'; vessel: Vessel }
  /** Um item da mochila na mão (ex.: petisco para o gato). */
  | { kind: 'item'; item: string };

/** Algo deixado numa superfície do café (balcão, mesa, chão). Uma coisa por célula. */
export interface SurfaceItem {
  at: Cell;
  item: HandItem;
}

/** Velocidade com tantos objetos na mão (nunca abaixo de 40%). */
export function speedFactor(count: number, cfg: CarryConfig): number {
  return Math.max(0.4, 1 - count * cfg.speedPenaltyPerItem);
}

/** A louça que este objeto ocupa (bebida ou suja), se ocupar. */
export function vesselOf(item: HandItem): Vessel | undefined {
  return item.kind === 'item' ? undefined : item.vessel;
}
