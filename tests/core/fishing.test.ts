import { describe, expect, it } from 'vitest';
import { fishingOutcome, rollFish, startReel, stepReel, type FishDef, type FishingParams, type ReelState } from '../../src/core/fishing';
import { makeResult, paramsOf } from '../../src/core/minigame';
import { createRng } from '../../src/core/rng';
import { GameSession } from '../../src/core/session';
import { newGameState } from '../../src/core/state';
import { loadContent } from './content';

const content = loadContent();
const cfg = content.minigames;
const table = cfg.games.fishing!.fish!;
const p = paramsOf<FishingParams>(cfg, 'fishing', 'normal');
const fish = (id: string) => table.find((f) => f.id === id)!;

describe('Pescaria: sorteio', () => {
  it('respeita os pesos: sem peso, a raridade nunca sai; a mesma semente sorteia o mesmo peixe', () => {
    const easy = paramsOf<FishingParams>(cfg, 'fishing', 'easy');
    const rng = createRng(1);
    const got = new Set(Array.from({ length: 500 }, () => rollFish(rng, table, easy.rarityWeights).rarity));
    expect(got.has('legendary')).toBe(false); // fácil: peso 0
    expect(got.has('common')).toBe(true);
    expect(rollFish(createRng(9), table, p.rarityWeights)).toEqual(rollFish(createRng(9), table, p.rarityWeights));
  });

  it('a raridade mais pesada é a mais comum', () => {
    const rng = createRng(4);
    const n: Record<string, number> = {};
    for (let i = 0; i < 2000; i++) {
      const r = rollFish(rng, table, p.rarityWeights).rarity;
      n[r] = (n[r] ?? 0) + 1;
    }
    expect(n.common!).toBeGreaterThan(n.uncommon!);
    expect(n.uncommon!).toBeGreaterThan(n.rare!);
  });
});

describe('Pescaria: barra de timing', () => {
  /** Joga a barra: a jogadora "segura" quando o indicador está abaixo da zona (estratégia perfeita) ou nunca. */
  function play(f: FishDef, strategy: 'good' | 'idle', seed = 3): ReelState {
    const rng = createRng(seed);
    let s = startReel(f, p, rng);
    for (let i = 0; i < 60 * 40 && s.status === 'reeling'; i++) {
      const hold = strategy === 'good' && (s.indicator < s.zone || (s.indicatorVel < 0 && s.indicator < s.zone + s.zoneSize / 4));
      s = stepReel(s, 1 / 60, hold, f, p, rng);
    }
    return s;
  }

  it('quem acompanha a zona pesca; quem não faz nada perde o peixe', () => {
    expect(play(fish('fish.silver'), 'good').status).toBe('caught');
    expect(play(fish('fish.silver'), 'idle').status).toBe('escaped');
  });

  it('a caixa da jogadora e a zona ficam inteiras dentro da barra (a caixa bate na ponta e para)', () => {
    const rng = createRng(5);
    let s = startReel(fish('fish.golden'), p, rng);
    for (let i = 0; i < 600; i++) {
      s = stepReel(s, 1 / 60, i % 50 < 30, fish('fish.golden'), p, rng);
      // A caixa (do tamanho da zona, centrada no indicador) não passa das pontas.
      expect(s.indicator - s.zoneSize / 2).toBeGreaterThanOrEqual(-1e-9);
      expect(s.indicator + s.zoneSize / 2).toBeLessThanOrEqual(1 + 1e-9);
      expect(s.zone - s.zoneSize / 2).toBeGreaterThanOrEqual(-1e-9);
      expect(s.zone + s.zoneSize / 2).toBeLessThanOrEqual(1 + 1e-9);
      if (s.status !== 'reeling') break;
    }
  });

  it('great com boa precisão, ok com precisão baixa, fail sem peixe', () => {
    expect(fishingOutcome(true, { elapsed: 10, inside: 8 }, 0.75)).toBe('great');
    expect(fishingOutcome(true, { elapsed: 10, inside: 5 }, 0.75)).toBe('ok');
    expect(fishingOutcome(false, { elapsed: 10, inside: 10 }, 0.75)).toBe('fail');
  });
});

describe('Pescaria: o peixe vai para a mochila', () => {
  it('pescou: moedas do resultado + valor do peixe, e o peixe na mochila; pular não traz peixe', () => {
    const session = new GameSession(content, newGameState(100, 'map.street'));
    const f = fish('fish.tuna');
    const r = makeResult(cfg, 'fishing', 'normal', 'ok', f.value, false, { bonusCoins: f.value, itemId: f.item });
    expect(r.coinsEarned).toBe(cfg.games.fishing!.rewards.normal.ok + f.value);
    session.finishMiniGame(r, { difficulty: 'normal' });
    expect(session.state.inventory['item.fish_tuna']).toBe(1);
    const skip = makeResult(cfg, 'fishing', 'normal', 'ok', 0, true, { bonusCoins: 10, itemId: f.item });
    expect(skip.itemId).toBeUndefined();
    expect(skip.coinsEarned).toBe(Math.round(cfg.games.fishing!.rewards.normal.ok * cfg.skipRewardShare));
  });
});
