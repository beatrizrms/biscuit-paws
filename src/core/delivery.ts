// Entrega relâmpago: levar um item (café, ração, bolo) do ponto A até a casa B pela rua, desviando de pedestres
// e bicicletas. O item perde qualidade com o tempo (café esfria, bolo amassa) e a cada esbarrão.
// Puro: sem Phaser, DOM ou window. A cena só move a personagem e os obstáculos e chama daqui.
import type { Outcome } from './minigame';
import type { Rng } from './rng';

/** Um item de entrega (data/minigames.json: games.delivery.items). Qualidade em pontos de 0 a 100. */
export interface DeliveryItem {
  id: string;
  name: string;
  /** Ícone (data/icons.json). */
  icon: string;
  /** O que acontece com ele no caminho ("esfriando", "amassando"): o HUD mostra. */
  verb: string;
  /** Quanto cai por segundo. */
  decayPerSec: number;
  /** Quanto cai a cada esbarrão. */
  hitLoss: number;
}

/** Um obstáculo que vai e volta numa rota simples (células da arena). */
export interface ObstacleRoute {
  kind: 'pedestrian' | 'bike';
  path: [[number, number], [number, number]];
  /** Velocidade em px lógicos por segundo (antes da escala da dificuldade). */
  speed: number;
}

export interface DeliveryParams {
  /** Quantas rotas de obstáculo valem (as primeiras da lista). */
  obstacles: number;
  /** Multiplicadores da dificuldade: velocidade dos obstáculos e queda da qualidade. */
  speedScale: number;
  decayScale: number;
  /** Tempo total (opcional). */
  timeSec?: number;
  /** "Great": chegar com mais que esta fração da qualidade (0 a 1). */
  greatQuality: number;
}

export const FULL_QUALITY = 100;

/** Qual item vai nesta entrega: o pedido (se existir) ou um sorteado. */
export function pickDeliveryItem(rng: Rng, items: readonly DeliveryItem[], wanted?: string): DeliveryItem {
  return items.find((i) => i.id === wanted) ?? items[rng.int(0, items.length - 1)]!;
}

/** A qualidade depois de `dtSec` segundos no caminho. */
export function decayQuality(quality: number, item: DeliveryItem, p: Pick<DeliveryParams, 'decayScale'>, dtSec: number): number {
  return Math.max(0, quality - item.decayPerSec * p.decayScale * dtSec);
}

/** A qualidade depois de um esbarrão. */
export function bumpQuality(quality: number, item: DeliveryItem): number {
  return Math.max(0, quality - item.hitLoss);
}

/** Como foi: não chegou (ou chegou sem nada aproveitável) = não deu; chegou acima de greatQuality = perfeito. */
export function deliveryOutcome(arrived: boolean, quality: number, p: Pick<DeliveryParams, 'greatQuality'>): Outcome {
  if (!arrived || quality <= 0) return 'fail';
  return quality > p.greatQuality * FULL_QUALITY ? 'great' : 'ok';
}

/** Onde o obstáculo está no tempo t (ms): vai de path[0] a path[1] e volta (pingue-pongue). */
export function routePosition(route: ObstacleRoute, tileSize: number, speedScale: number, tMs: number): { x: number; y: number; dir: 'left' | 'right' | 'up' | 'down' } {
  const [[c0, r0], [c1, r1]] = route.path;
  const ax = c0 * tileSize + tileSize / 2;
  const ay = (r0 + 1) * tileSize - 4;
  const bx = c1 * tileSize + tileSize / 2;
  const by = (r1 + 1) * tileSize - 4;
  const len = Math.hypot(bx - ax, by - ay);
  if (len === 0) return { x: ax, y: ay, dir: 'down' };
  const travelled = ((route.speed * speedScale * tMs) / 1000) % (2 * len);
  const back = travelled > len;
  const k = back ? 2 - travelled / len : travelled / len;
  const dx = (bx - ax) * (back ? -1 : 1);
  const dy = (by - ay) * (back ? -1 : 1);
  const dir = Math.abs(dx) >= Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up';
  return { x: ax + (bx - ax) * k, y: ay + (by - ay) * k, dir };
}

export function validateDelivery(items: readonly DeliveryItem[], routes: readonly ObstacleRoute[], most: number, icons: ReadonlySet<string>): string[] {
  const errors: string[] = [];
  if (items.length === 0) errors.push('minigames: delivery sem itens');
  const ids = new Set<string>();
  for (const i of items) {
    if (ids.has(i.id)) errors.push(`minigames: item de entrega repetido "${i.id}"`);
    ids.add(i.id);
    if (!icons.has(i.icon)) errors.push(`minigames: item de entrega "${i.id}" com ícone inexistente "${i.icon}"`);
    if (!(i.decayPerSec >= 0) || !(i.hitLoss >= 0)) errors.push(`minigames: item de entrega "${i.id}" com decayPerSec/hitLoss inválido`);
  }
  if (routes.length < most) errors.push(`minigames: delivery pede ${most} obstáculos e só há ${routes.length} rotas`);
  for (const r of routes) if (!(r.speed > 0)) errors.push('minigames: rota de obstáculo com speed inválido');
  return errors;
}
