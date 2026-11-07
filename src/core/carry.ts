// Mãos: objetos físicos que a personagem leva (bebida pronta, louça suja, massa entre etapas, petisco,
// saco pesado, o gato no colo). A mochila é o inventário (state.inventory): coisas abstratas, sem peso.
// Puro: sem Phaser, DOM ou window.
import type { Cell } from './map';
import type { CarryConfig, Quality, Vessel } from './recipes';

export type HandItem =
  /** Pedido pronto, na louça (a louça volta suja depois que o cliente consome). */
  | { kind: 'drink'; recipe: string; vessel: Vessel; quality?: Quality }
  /** Louça suja, a caminho da pia. */
  | { kind: 'dirty'; vessel: Vessel }
  /** Massa entre etapas (ex.: pão de queijo escaldado, indo para o forno). `step`: a próxima etapa. */
  | { kind: 'wip'; recipe: string; step: number; quality?: Quality }
  /** Um item da mochila na mão (ex.: petisco para o gato). */
  | { kind: 'item'; item: string }
  /** Item pesado (saco de ração, areia): ocupa as mãos sozinho. */
  | { kind: 'heavy'; item: string }
  /** O gato no colo. */
  | { kind: 'cat'; catId: string };

/** Algo deixado numa superfície do café (balcão, mesa, chão). Uma coisa por célula. */
export interface SurfaceItem {
  at: Cell;
  item: HandItem;
}

/** O que vai na bandeja: só louça (pedido pronto ou suja). */
export const onTray = (item: HandItem): boolean => item.kind === 'drink' || item.kind === 'dirty';

/** O que ocupa as mãos sozinho (nada mais cabe junto). */
export const exclusive = (item: HandItem): boolean => item.kind === 'heavy' || item.kind === 'cat';

/** Velocidade com o que está nas mãos (nunca abaixo de 40%). */
export function speedFactor(hands: readonly HandItem[], tray: boolean, cfg: CarryConfig): number {
  if (hands.some((h) => h.kind === 'heavy')) return cfg.heavy.speedFactor;
  if (hands.some((h) => h.kind === 'cat')) return cfg.cat.speedFactor;
  const base = tray ? cfg.tray.speedFactor : 1;
  return Math.max(0.4, base - hands.length * cfg.speedPenaltyPerItem);
}

/** A louça que este objeto ocupa (pedido pronto ou suja), se ocupar. */
export function vesselOf(item: HandItem): Vessel | undefined {
  return item.kind === 'drink' || item.kind === 'dirty' ? item.vessel : undefined;
}
