import { describe, expect, it } from 'vitest';
import { bumpQuality, decayQuality, deliveryOutcome, FULL_QUALITY, pickDeliveryItem, routePosition, type DeliveryParams, type ObstacleRoute } from '../../src/core/delivery';
import { paramsOf } from '../../src/core/minigame';
import { createRng } from '../../src/core/rng';
import { loadContent } from './content';

const content = loadContent();
const def = content.minigames.games.delivery!;
const coffee = def.items!.find((i) => i.id === 'coffee')!;
const cake = def.items!.find((i) => i.id === 'cake')!;

describe('entrega relâmpago', () => {
  it('o item pedido vai; sem pedido, sorteia (repetível)', () => {
    expect(pickDeliveryItem(createRng(1), def.items!, 'cake').id).toBe('cake');
    expect(pickDeliveryItem(createRng(5), def.items!).id).toBe(pickDeliveryItem(createRng(5), def.items!).id);
  });

  it('a qualidade cai com o tempo (mais rápido no difícil) e a cada esbarrão, sem passar de 0', () => {
    const normal = paramsOf<DeliveryParams>(content.minigames, 'delivery', 'normal');
    const hard = paramsOf<DeliveryParams>(content.minigames, 'delivery', 'hard');
    expect(decayQuality(FULL_QUALITY, coffee, normal, 10)).toBeCloseTo(FULL_QUALITY - coffee.decayPerSec * 10);
    expect(decayQuality(FULL_QUALITY, coffee, hard, 10)).toBeLessThan(decayQuality(FULL_QUALITY, coffee, normal, 10));
    expect(bumpQuality(FULL_QUALITY, cake)).toBe(FULL_QUALITY - cake.hitLoss);
    expect(bumpQuality(5, cake)).toBe(0);
    expect(decayQuality(1, coffee, normal, 60)).toBe(0);
  });

  it('chegou com mais de 50% = perfeito; chegou com menos = ok; não chegou ou estragou = não deu', () => {
    const p = { greatQuality: 0.5 };
    expect(deliveryOutcome(true, 51, p)).toBe('great');
    expect(deliveryOutcome(true, 50, p)).toBe('ok');
    expect(deliveryOutcome(true, 0, p)).toBe('fail');
    expect(deliveryOutcome(false, 90, p)).toBe('fail');
  });

  it('obstáculo vai e volta na rota', () => {
    const r: ObstacleRoute = { kind: 'bike', path: [[0, 0], [10, 0]], speed: 32 };
    // 10 células de 32 px a 32 px/s: 10 s para ir, 10 s para voltar.
    expect(routePosition(r, 32, 1, 0).x).toBe(16);
    expect(routePosition(r, 32, 1, 5000)).toMatchObject({ x: 16 + 160, dir: 'right' });
    expect(routePosition(r, 32, 1, 15000)).toMatchObject({ x: 16 + 160, dir: 'left' });
    expect(routePosition(r, 32, 2, 5000).x).toBeCloseTo(16 + 320);
  });
});
