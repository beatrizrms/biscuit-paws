// Tigela de ração, caixa de areia e os automáticos (pote de ração e caixa de areia que guardam até autoDays dias).
// Uma porção por dia serve o café inteiro, não importa quantos gatos. Puro: sem Phaser, DOM ou window.
import type { ItemDef } from './content';
import type { PlacedItem } from './state';

export type StationKind = 'food_bowl' | 'litter_box';

/** Tigela (food_bowl) ou caixa de areia (litter_box), pela tag do móvel. */
export function stationKind(item: ItemDef | undefined): StationKind | null {
  if (!item?.tile) return null;
  if (item.tags.includes('food_bowl')) return 'food_bowl';
  if (item.tags.includes('litter_box')) return 'litter_box';
  return null;
}

/** Quantos dias faltam no automático (0 = vazio ou não é automático). */
export const stockOf = (p: PlacedItem) => p.stock ?? 0;

/** Por que não dá para abastecer o automático com `itemId` agora (ou null). */
export function loadProblem(p: PlacedItem, item: ItemDef, itemId: string): 'full' | 'other_item' | null {
  if (stockOf(p) >= (item.autoDays ?? 0)) return 'full';
  if (stockOf(p) > 0 && p.stockItem && p.stockItem !== itemId) return 'other_item';
  return null;
}

/** Abastece o automático com até `available` porções de `itemId`; devolve quantas entraram. */
export function load(p: PlacedItem, item: ItemDef, itemId: string, available: number): number {
  const qty = Math.max(0, Math.min(available, (item.autoDays ?? 0) - stockOf(p)));
  if (qty > 0) {
    p.stock = stockOf(p) + qty;
    p.stockItem = itemId;
  }
  return qty;
}

export interface StationsDayEnd {
  /** Os gatos comeram hoje (pela tigela ou pelo pote automático, que gastou uma porção). */
  fed: boolean;
  /** Houve areia limpa hoje (uma caixa trocada ou a automática, que gastou uma troca). */
  litterOk: boolean;
  /** Automáticos que gastaram hoje e ficaram com poucos dias (avisar): uid, item e dias que sobraram. */
  low: { uid: string; item: string; days: number }[];
}

/**
 * Fim do dia: sem tigela cheia hoje, o pote automático serve (uma porção); sem caixa trocada hoje, a caixa
 * automática troca (uma). `fedToday`: algum gato já tinha comido pela tigela. `lowAt`: avisar com tantos dias ou menos.
 */
export function stationsAtDayEnd(placed: PlacedItem[], items: Record<string, ItemDef>, day: number, fedToday: boolean, lowAt: number): StationsDayEnd {
  const low: StationsDayEnd['low'] = [];
  const autoOf = (kind: StationKind) => placed.find((p) => stationKind(items[p.item]) === kind && items[p.item]!.autoDays && stockOf(p) > 0);
  const spend = (p: PlacedItem) => {
    p.stock = stockOf(p) - 1;
    if (p.stock <= lowAt) low.push({ uid: p.uid, item: p.item, days: p.stock });
    if (p.stock === 0) delete p.stockItem;
  };
  let fed = fedToday;
  if (!fed) {
    const feeder = autoOf('food_bowl');
    if (feeder) {
      spend(feeder);
      fed = true;
    }
  }
  let litterOk = placed.some((p) => stationKind(items[p.item]) === 'litter_box' && !items[p.item]!.autoDays && p.refilledOn === day);
  if (!litterOk) {
    const box = autoOf('litter_box');
    if (box) {
      spend(box);
      litterOk = true;
    }
  }
  return { fed, litterOk, low };
}
