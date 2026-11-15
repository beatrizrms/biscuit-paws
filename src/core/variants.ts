// Famílias de móveis (data/items.json: variants): um item só no Market, as outras peças por dentro.
// - rotate: a mesma peça em direções diferentes (a cadeira de frente, de lado, de costas). Girar (G ou o botão Girar)
//   troca para a próxima da lista; o item posicionado passa a ser a peça girada (os IDs não mudam).
// - autotile: os módulos do balcão de uma cor (único, ponta esquerda, meio, ponta direita). O desenho de cada um sai dos
//   vizinhos da mesma família na mesma linha; o save continua guardando só o item.
// O primeiro de cada família (rotate) e o "single" (autotile) são a peça principal: a que está à venda e a que volta
// para a mochila. Puro: sem Phaser, DOM ou window.
import type { Cell } from './map';

export interface AutotileFamily {
  single: string;
  left: string;
  mid: string;
  right: string;
}

export interface VariantsData {
  rotate: string[][];
  autotile: AutotileFamily[];
}

export const NO_VARIANTS: VariantsData = { rotate: [], autotile: [] };

const pieces = (f: AutotileFamily) => [f.single, f.left, f.mid, f.right];

function familyOf(v: VariantsData, id: string): string[] | undefined {
  return v.rotate.find((f) => f.includes(id)) ?? v.autotile.map(pieces).find((f) => f.includes(id));
}

/** A peça principal da família (a que está à venda e a que volta para a mochila); fora de família, ele mesmo. */
export function mainVariant(v: VariantsData, id: string): string {
  const r = v.rotate.find((f) => f.includes(id));
  if (r) return r[0]!;
  return v.autotile.find((f) => pieces(f).includes(id))?.single ?? id;
}

/** É uma peça da família que não é a principal (não aparece no Market nem na loja). */
export function hiddenVariant(v: VariantsData, id: string): boolean {
  return mainVariant(v, id) !== id;
}

/** As duas peças são da mesma família (dá para posicionar uma no lugar da outra). */
export function sameFamily(v: VariantsData, a: string, b: string): boolean {
  return a === b || !!familyOf(v, a)?.includes(b);
}

/** A próxima direção ao girar (ou null: o item não gira). */
export function nextRotation(v: VariantsData, id: string): string | null {
  const f = v.rotate.find((x) => x.includes(id));
  if (!f || f.length < 2) return null;
  return f[(f.indexOf(id) + 1) % f.length]!;
}

/**
 * O módulo do balcão a desenhar, pelos vizinhos da mesma família (mesma cor) na mesma linha: sozinho, o único; só com
 * vizinho à direita, a ponta esquerda; só à esquerda, a ponta direita; dos dois lados, o meio. Fora de família, null.
 */
export function autotilePiece(v: VariantsData, placed: readonly { item: string; at: Cell }[], item: string, at: Cell): string | null {
  const f = v.autotile.find((x) => pieces(x).includes(item));
  if (!f) return null;
  const has = (dc: number) => placed.some((p) => p.at[1] === at[1] && p.at[0] === at[0] + dc && pieces(f).includes(p.item));
  const left = has(-1);
  const right = has(1);
  return left && right ? f.mid : left ? f.right : right ? f.left : f.single;
}

export function validateVariants(v: VariantsData, items: ReadonlySet<string>): string[] {
  const errors: string[] = [];
  const seen = new Set<string>();
  const all = [...v.rotate.map((f, i) => ({ where: `rotate[${i}]`, ids: f })), ...v.autotile.map((f, i) => ({ where: `autotile[${i}]`, ids: pieces(f) }))];
  for (const { where, ids } of all) {
    if (ids.length < 2) errors.push(`items.variants.${where}: precisa de pelo menos 2 peças`);
    for (const id of ids) {
      if (!items.has(id)) errors.push(`items.variants.${where}: item inexistente "${id}"`);
      if (seen.has(id)) errors.push(`items.variants.${where}: "${id}" já está em outra família`);
      seen.add(id);
    }
  }
  return errors;
}
