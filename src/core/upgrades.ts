// Assistência técnica: upgrade de móvel (troca a peça no mesmo lugar por outra do mesmo grupo).
// Os grupos ficam em data/items.json ("upgrades"): peças do mesmo tamanho que podem virar uma na outra
// (balcão esquerda/meio/direita e os modelos, cadeira virada para cada lado, cores, tigela -> pote automático).
// Preço: a diferença entre as peças (se a nova for mais cara) + a taxa do serviço. Puro: sem Phaser, DOM ou window.
import type { ItemDef } from './content';
import type { TileCatalog } from './tiles';

export interface UpgradeGroup {
  /** ID estável (upg.*). */
  id: string;
  name: string;
  /** Itens que trocam entre si (todos do mesmo tamanho e da mesma camada). */
  items: string[];
}

export interface UpgradesData {
  /** Taxa do serviço de troca, em moedas. */
  fee: number;
  groups: UpgradeGroup[];
}

export const NO_UPGRADES: UpgradesData = { fee: 0, groups: [] };

/** O grupo de upgrade de um item (ou nenhum). */
export function upgradeGroupOf(data: UpgradesData, itemId: string): UpgradeGroup | undefined {
  return data.groups.find((g) => g.items.includes(itemId));
}

/** Quanto custa trocar `from` por `to`: a diferença (só se a nova for mais cara; não há troco) + a taxa. */
export function upgradeCost(data: UpgradesData, items: Record<string, ItemDef>, from: string, to: string): number {
  const diff = (items[to]?.price ?? 0) - (items[from]?.price ?? 0);
  return Math.max(0, diff) + data.fee;
}

export function validateUpgrades(data: UpgradesData, items: Record<string, ItemDef>, catalog: TileCatalog): string[] {
  const errors: string[] = [];
  if (!Number.isInteger(data.fee) || data.fee < 0) errors.push('upgrades: fee precisa ser um inteiro >= 0');
  const seenGroups = new Set<string>();
  const seenItems = new Map<string, string>();
  for (const g of data.groups) {
    const w = `upgrades: grupo "${g.id}"`;
    if (!g.id.startsWith('upg.')) errors.push(`${w}: id deve começar com "upg."`);
    if (seenGroups.has(g.id)) errors.push(`${w}: id repetido`);
    seenGroups.add(g.id);
    if (g.items.length < 2) errors.push(`${w}: precisa de pelo menos 2 itens`);
    let shape: string | null = null;
    let placeRule: string | null = null;
    for (const id of g.items) {
      const item = items[id];
      if (!item) {
        errors.push(`${w}: item inexistente "${id}"`);
        continue;
      }
      if (seenItems.has(id)) errors.push(`${w}: "${id}" já está no grupo "${seenItems.get(id)}"`);
      seenItems.set(id, g.id);
      const def = catalog.tiles[item.tile ?? ''];
      if (!def) {
        errors.push(`${w}: "${id}" não tem tile no catálogo`);
        continue;
      }
      const s = `${def.w}x${def.h} ${def.layer}`;
      if (shape === null) shape = s;
      else if (s !== shape) errors.push(`${w}: "${id}" é ${s}, diferente do resto do grupo (${shape})`);
      // Equipamento de balcão (só em cima) não entra; enfeite pequeno (chão ou em cima, orFloor) entra, todos com a mesma regra.
      if (item.placeOn && !item.orFloor) errors.push(`${w}: "${id}" fica em cima de outro móvel; não entra em upgrade`);
      const rule = `${item.placeOn ?? ''}/${item.orFloor ? 1 : 0}`;
      if (placeRule === null) placeRule = rule;
      else if (rule !== placeRule) errors.push(`${w}: "${id}" tem outra regra de posição (placeOn/orFloor) que o resto do grupo`);
    }
  }
  return errors;
}
