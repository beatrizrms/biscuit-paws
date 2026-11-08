import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { makeResult } from '../../src/core/minigame';
import { addReputation, newReputation, reputationForResult } from '../../src/core/reputation';
import { knownIds, parseSave } from '../../src/core/save';
import { GameSession } from '../../src/core/session';
import { newGameState } from '../../src/core/state';
import { loadContent } from './content';

const content = loadContent();
const cfg = content.reputation;

describe('reputação felina', () => {
  it('soma presa entre 0 e max, com o motivo no log curto', () => {
    const s = newReputation(cfg);
    expect(addReputation(s, cfg, 30, 'teste', 1)).toMatchObject({ from: cfg.start, to: cfg.start + 30 });
    addReputation(s, cfg, 500, 'muito', 1);
    expect(s.value).toBe(cfg.max);
    addReputation(s, cfg, -500, 'nada', 1);
    expect(s.value).toBe(0);
    for (let i = 0; i < cfg.logSize + 5; i++) addReputation(s, cfg, 1, `r${i}`, 2);
    expect(s.log).toHaveLength(cfg.logSize);
    expect(s.log[s.log.length - 1]).toEqual({ day: 2, amount: 1, reason: `r${cfg.logSize + 4}` });
  });

  it('limiares: o evento sai uma vez, mesmo que caia e volte; pular dois de uma vez dispara os dois', () => {
    const s = newReputation(cfg);
    const [a, b] = cfg.thresholds;
    expect(addReputation(s, cfg, b!.at, 'pulo', 1).crossed.map((t) => t.id)).toEqual([a!.id, b!.id]);
    addReputation(s, cfg, -b!.at, 'queda', 1);
    expect(addReputation(s, cfg, b!.at, 'volta', 1).crossed).toEqual([]);
  });

  it('mini games somam conforme o resultado (pular não vale); adoção boa vale mais que ok', () => {
    const table = content.minigames.games.trust!.reputation;
    expect(reputationForResult(table, { outcome: 'great', skipped: false })).toBeGreaterThan(reputationForResult(table, { outcome: 'ok', skipped: false }));
    expect(reputationForResult(table, { outcome: 'great', skipped: true })).toBe(0);
    expect(reputationForResult(table, { outcome: 'fail', skipped: false })).toBeLessThan(0);
    expect(content.adoption.reputation.good).toBeGreaterThan(content.adoption.reputation.ok);
  });

  it('na sessão: evento, log com o motivo, limiar e as adoções', () => {
    const session = new GameSession(content, newGameState(100, 'map.cafe_main'));
    const events: { name: string; payload: unknown }[] = [];
    session.bus.onAny((name, payload) => events.push({ name, payload }));
    session.finishMiniGame(makeResult(content.minigames, 'kitten_hunt', 'easy', 'great', 3), { difficulty: 'easy' });
    const great = content.minigames.games.kitten_hunt!.reputation!.great!;
    expect(session.reputation()).toBe(cfg.start + great);
    expect(events).toContainEqual({ name: 'reputation.changed', payload: { from: cfg.start, to: cfg.start + great, amount: great, reason: 'minigame:kitten_hunt:great' } });
    const adoptions = [{ catId: 'adopt.mingau', verdict: 'good' as const }, { catId: 'adopt.tico', verdict: 'ok' as const }];
    session.finishMiniGame(makeResult(content.minigames, 'adoption', 'easy', 'ok', 1, false, { adoptions }), { difficulty: 'easy' });
    expect(session.state.reputation.log.map((e) => e.reason)).toEqual(['minigame:kitten_hunt:great', 'adoption:adopt.mingau:good', 'adoption:adopt.tico:ok', 'minigame:adoption:ok']);
    session.addReputation(cfg.thresholds[0]!.at, 'debug');
    expect(events.filter((e) => e.name === 'reputation.threshold_reached').map((e) => e.payload)).toContainEqual({ thresholdId: cfg.thresholds[0]!.id, value: session.reputation() });
  });

  it('save v16 guarda a reputação; save antigo (v15) começa no valor inicial', () => {
    const known = knownIds(content);
    const v16 = parseSave(readFileSync('tests/fixtures/save_v16.json', 'utf8'), known).state.reputation;
    expect(v16.value).toBe(42);
    expect(v16.reached).toEqual(['rep.noticed', 'rep.trusted']);
    expect(v16.log).toHaveLength(2);
    expect(parseSave(readFileSync('tests/fixtures/save_v15.json', 'utf8'), known).state.reputation).toEqual({ value: cfg.start, reached: [], log: [] });
  });
});
