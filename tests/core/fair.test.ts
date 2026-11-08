import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { cafeAdoptCats, setupMatch } from '../../src/core/adoption';
import { doFairPoint, fairCanStart, fairDayEnded, newFair, pendingFairPoints, seasonCount } from '../../src/core/fair';
import { makeResult } from '../../src/core/minigame';
import { createRng } from '../../src/core/rng';
import { knownIds, parseSave } from '../../src/core/save';
import { GameSession } from '../../src/core/session';
import { newGameState } from '../../src/core/state';
import { loadContent } from './content';

const content = loadContent();
const cfg = content.adoption.fair;
const per = content.seasons.daysPerSeason;

describe('feira de adoção (puro)', () => {
  it('panfletos -> marcada daysAfterFlyers depois -> no dia: placa, decorações e a mesa, nessa ordem', () => {
    const s = newFair();
    s.stage = 'flyers';
    expect(pendingFairPoints(s, cfg, 3)).toEqual(cfg.flyers);
    expect(doFairPoint(s, cfg, cfg.table, 3)).toBeNull(); // fora de hora
    cfg.flyers.slice(0, -1).forEach((id) => expect(doFairPoint(s, cfg, id, 3)).toBe('flyer'));
    expect(doFairPoint(s, cfg, cfg.flyers.at(-1)!, 3)).toBe('scheduled');
    expect(s.day).toBe(3 + cfg.daysAfterFlyers);
    expect(pendingFairPoints(s, cfg, 4)).toEqual([]); // ainda não é o dia
    const day = s.day!;
    expect(pendingFairPoints(s, cfg, day)).toEqual([cfg.sign.point]);
    expect(doFairPoint(s, cfg, cfg.decorations[0]!.point, day)).toBeNull(); // placa primeiro
    expect(doFairPoint(s, cfg, cfg.sign.point, day)).toBe('sign');
    cfg.decorations.slice(0, -1).forEach((d) => expect(doFairPoint(s, cfg, d.point, day)).toBe('decor'));
    expect(doFairPoint(s, cfg, cfg.decorations.at(-1)!.point, day)).toBe('ready');
    expect(pendingFairPoints(s, cfg, day)).toEqual([cfg.table]);
  });

  it('o dia passou sem a feira: volta ao começo (dá para organizar de novo); uma feira por estação', () => {
    const s = newFair();
    s.stage = 'scheduled';
    s.day = 5;
    expect(fairDayEnded(s, 5)).toBe(false);
    expect(fairDayEnded(s, 6)).toBe(true);
    expect(s.stage).toBe('idle');
    expect(fairCanStart(s, cfg, cfg.minCats, 6, per)).toBe(true);
    expect(fairCanStart(s, cfg, cfg.minCats - 1, 6, per)).toBe(false); // gatos de menos
    s.lastSeason = seasonCount(6, per);
    expect(fairCanStart(s, cfg, cfg.minCats, 7, per)).toBe(false); // já teve nesta estação
    expect(fairCanStart(s, cfg, cfg.minCats, per + 1, per)).toBe(true); // estação seguinte
  });

  it('gatos do café entram na partida (jeito pela personalidade) e o resto vem do abrigo', () => {
    const mine = cafeAdoptCats(content.adoption, [{ id: 'cat.x', name: 'Xodó', variant: 'pebble', personality: 'brave' }, { id: 'cat.y', name: 'Yuki', variant: 'misty', personality: 'outra', adoptionTraits: { coat: 'long' } }]);
    expect(mine[0]!.traits).toEqual({ ...cfg.defaultTraits, personality: cfg.personalityFrom.brave });
    expect(mine[1]!.traits).toEqual({ ...cfg.defaultTraits, coat: 'long' });
    const m = setupMatch(createRng(3), content.adoption, 4, mine);
    expect(m.cats.slice(0, 2).map((c) => c.id)).toEqual(['cat.x', 'cat.y']);
    expect(m.cats).toHaveLength(4);
  });
});

describe('feira de adoção na sessão', () => {
  function cafe() {
    const state = newGameState(500, 'map.street', 10 * 60);
    state.business = 'soft_open';
    state.story.completed.push(...content.story.beats.map((b) => b.id));
    const session = new GameSession(content, state);
    const events: string[] = [];
    session.bus.onAny((name) => events.push(name));
    return { session, state, events };
  }

  it('do começo ao fim: panfletos, o dia no calendário, café fechado, decoração no salão e o match encerra a feira', () => {
    const { session, state, events } = cafe();
    session.debugStartFair();
    expect(session.fairStatus()).toMatchObject({ stage: 'flyers', left: cfg.flyers.length });
    for (const id of cfg.flyers) expect(session.doJobPoint(id)).toEqual({ ok: true });
    expect(events).toContain('fair.scheduled');
    const day = state.fair.day!;
    expect(session.calendar(day, day).map((e) => e.id)).toContain('cal.adoption_fair');
    session.endDay('home');
    state.day = day;
    state.time = 10 * 60;
    expect(session.service.isOpen()).toBe(true);
    expect(session.doJobPoint(cfg.sign.point)).toEqual({ ok: true });
    expect(session.service.isOpen()).toBe(false); // placa na porta: fechado hoje
    for (const d of cfg.decorations) expect(session.doJobPoint(d.point)).toEqual({ ok: true });
    expect(session.mapData().objects.filter((o) => o.id.startsWith('fair.'))).toHaveLength(1 + cfg.decorations.length);
    expect(session.pendingJobPoints('map.cafe_main').map((p) => p.id)).toEqual([cfg.table]);
    expect(session.miniGameExtras(cfg.table).adoptCats).toEqual([]); // o gato da história nunca vai para a feira
    const adoptions = [{ catId: 'adopt.mingau', verdict: 'good' as const }];
    session.finishMiniGame(makeResult(content.minigames, 'adoption', 'normal', 'fail', 1, false, { adoptions }), { difficulty: 'normal', jobPoint: cfg.table });
    expect(events).toContain('fair.finished');
    expect(state.fair).toMatchObject({ stage: 'idle', lastSeason: seasonCount(day, per), heldOn: day });
    // Até o fim do dia: placa e decoração no salão e o café fechado; no dia seguinte, tudo volta.
    expect(session.mapData().objects.filter((o) => o.id.startsWith('fair.'))).toHaveLength(1 + cfg.decorations.length);
    expect(session.service.isOpen()).toBe(false);
    session.endDay('home');
    state.time = 10 * 60;
    expect(session.mapData().objects.some((o) => o.id.startsWith('fair.'))).toBe(false);
    expect(session.service.isOpen()).toBe(true);
  });

  it('começa sozinha com 9 gatos abrigados e uma semana depois do quintal pronto', () => {
    const { session, state, events } = cafe();
    for (let i = 0; i < cfg.minCats; i++) state.cats[`cat.t${i}`] = { sheltered: true, name: `T${i}`, map: 'map.cafe_main', shelteredOn: 1, health: 80, sickness: null };
    state.day = 40;
    state.story.completedOn['story.backyard'] = 35; // quintal pronto há 5 dias: ainda não
    session.enter('map.cafe_main'); // entrar no café reavalia a história (e a feira)
    expect(state.fair.stage).toBe('idle');
    state.day = 42; // uma semana depois
    session.enter('map.street');
    expect(events).toContain('fair.started');
    expect(state.fair.stage).toBe('flyers');
  });

  it('a decoração e a mesa ficam no quintal; a placa, na porta do café', () => {
    const backyard = content.rooms.rooms.find((r) => r.id === 'room.backyard')!.area;
    const inYard = ([c, r]: [number, number]) => c >= backyard.from[0] && c <= backyard.to[0] && r >= backyard.from[1] && r <= backyard.to[1];
    for (const id of [...cfg.decorations.map((d) => d.point), cfg.table]) expect(inYard(content.jobPoints[id]!.at), id).toBe(true);
    expect(inYard(content.jobPoints[cfg.sign.point]!.at)).toBe(false);
  });

  it('save v17 guarda a feira; save antigo (v16) começa sem feira', () => {
    const known = knownIds(content);
    expect(parseSave(readFileSync('tests/fixtures/save_v17.json', 'utf8'), known).state.fair).toEqual({ stage: 'scheduled', day: 6, done: ['pt.fair_sign'], lastSeason: null, heldOn: null });
    expect(parseSave(readFileSync('tests/fixtures/save_v16.json', 'utf8'), known).state.fair).toEqual({ stage: 'idle', day: null, done: [], lastSeason: null, heldOn: null });
  });
});
