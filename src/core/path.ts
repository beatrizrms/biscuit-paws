// Caminho pelas células livres do mapa (busca em largura, 4 direções): para NPCs andarem até um lugar sem atravessar
// paredes e móveis (o Tião indo embora pela porta). Puro: sem Phaser, DOM ou window.
import type { Cell } from './map';

/**
 * O caminho mais curto de `from` até `to` (inclusive os dois), andando só por células livres (`solid[row][col]` false).
 * `from` e `to` podem ser sólidas (ele está em cima de um objeto; a porta fica na parede). null se não houver caminho.
 */
export function findPath(solid: readonly (readonly boolean[])[], from: Cell, to: Cell): Cell[] | null {
  const rows = solid.length;
  const cols = solid[0]?.length ?? 0;
  const key = ([c, r]: Cell) => r * cols + c;
  const inside = ([c, r]: Cell) => c >= 0 && r >= 0 && c < cols && r < rows;
  if (!inside(from) || !inside(to)) return null;
  const goal = key(to);
  const prev = new Map<number, number>([[key(from), -1]]);
  const queue: Cell[] = [from];
  for (let i = 0; i < queue.length; i++) {
    const cur = queue[i]!;
    if (key(cur) === goal) break;
    for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const next: Cell = [cur[0] + dc, cur[1] + dr];
      const k = key(next);
      if (!inside(next) || prev.has(k)) continue;
      if (solid[next[1]]![next[0]] && k !== goal) continue;
      prev.set(k, key(cur));
      queue.push(next);
    }
  }
  if (!prev.has(goal)) return null;
  const out: Cell[] = [];
  for (let k = goal; k !== -1; k = prev.get(k)!) out.push([k % cols, Math.floor(k / cols)]);
  return out.reverse();
}

/** Só as esquinas do caminho (onde ele muda de direção) e o fim: o NPC anda em linha reta entre elas. */
export function pathCorners(path: readonly Cell[]): Cell[] {
  const out: Cell[] = [];
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1]!;
    const b = path[i]!;
    const c = path[i + 1];
    const turns = !c || c[0] - b[0] !== b[0] - a[0] || c[1] - b[1] !== b[1] - a[1];
    if (turns) out.push(b);
  }
  return out;
}
