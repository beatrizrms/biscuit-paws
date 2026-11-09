import { describe, expect, it } from 'vitest';
import { contestOutcome, runContest, scoreOutfit, unlockedPieces, validateCostume, type CostumeParams, type CostumeTheme } from '../../src/core/costume';
import { makeResult } from '../../src/core/minigame';
import { createRng } from '../../src/core/rng';
import { GameSession } from '../../src/core/session';
import { newGameState } from '../../src/core/state';
import { loadContent } from './content';

const content = loadContent();
const data = content.costume;
const theme = (id: string): CostumeTheme => data.themes.find((t) => t.id === id)!;

describe('concurso de fantasia', () => {
  it('nota: tema, harmonia (cores e estilo) e variedade; peça faltando vale menos', () => {
    // Realeza: coroa dourada + golinha branca + capa lilás, todas elegantes (dourado e lilás combinam).
    const royal = scoreOutfit(data, theme('theme.royal'), { head: 'costume.crown_gold', neck: 'costume.ruffle_white', back: 'costume.cape_purple' });
    expect(royal.theme).toBe(3 * data.scoring.themeCap * data.scoring.theme); // cada peça bate 2+ etiquetas (teto)
    expect(royal.harmony).toBe(data.scoring.color + data.scoring.style); // 1 par que combina + mesmo estilo
    expect(royal.variety).toBe(data.scoring.variety);
    // A mesma fantasia num tema que não tem nada a ver vale bem menos.
    const sea = scoreOutfit(data, theme('theme.sea'), { head: 'costume.crown_gold', neck: 'costume.ruffle_white', back: 'costume.cape_purple' });
    expect(sea.score).toBeLessThan(royal.score - 30);
    // Sem peça nenhuma: zero; só uma peça: sem harmonia nem variedade.
    expect(scoreOutfit(data, theme('theme.royal'), {}).score).toBe(0);
    expect(scoreOutfit(data, theme('theme.royal'), { head: 'costume.crown_gold' })).toMatchObject({ harmony: 0, variety: 0 });
  });

  it('a nota máxima possível é 100 (os pesos fecham a conta)', () => {
    const s = data.scoring;
    expect(3 * s.themeCap * s.theme + 3 * s.color + s.style + s.variety).toBe(100);
  });

  it('peças liberadas pela reputação', () => {
    const start = unlockedPieces(data, []).map((p) => p.id);
    expect(start).not.toContain('costume.star_band');
    expect(unlockedPieces(data, ['rep.noticed', 'rep.trusted']).map((p) => p.id)).toContain('costume.star_band');
  });

  it('ranking: concorrentes sem repetir nome, nota na faixa, empate fica com ela; colocação vira o resultado', () => {
    const p: CostumeParams = { seconds: 60, rivals: 3, rivalRange: [50, 50] };
    const r = runContest(data, p, createRng(4), { cat: 'Mimi', owner: '', score: 50 });
    expect(r).toHaveLength(4);
    expect(r[0]!.player).toBe(true); // empate em 50: ela na frente
    expect(new Set(r.map((e) => e.cat)).size).toBe(4);
    const low = runContest(data, { ...p, rivalRange: [80, 90] }, createRng(4), { cat: 'Mimi', owner: '', score: 10 });
    expect(low.findIndex((e) => e.player)).toBe(3);
    expect([1, 2, 3, 4].map(contestOutcome)).toEqual(['great', 'ok', 'ok', 'fail']);
  });

  it('dados válidos; cada lugar tem peça desde o começo; tema sem peça é acusado', () => {
    const thresholds = new Set(content.reputation.thresholds.map((t) => t.id));
    expect(validateCostume(data, { thresholds }, content.minigames.games.costume!.difficulties as unknown as Record<string, CostumeParams>)).toEqual([]);
    const bad = { ...data, themes: [...data.themes, { id: 'theme.x', name: 'X', tags: ['nada'] }] };
    expect(validateCostume(bad, { thresholds })).toContain('costume: tema "theme.x": nenhuma peça tem "nada"');
  });
});

describe('concurso nos eventos', () => {
  function cafe() {
    const state = newGameState(500, 'map.street', 10 * 60);
    state.business = 'soft_open';
    state.story.completed.push(...content.story.beats.map((b) => b.id));
    for (const id of content.rooms.rooms.map((r) => r.id)) state.rooms[id] = 'restored';
    const session = new GameSession(content, state);
    return { session, state };
  }

  it('Concurso de fofura: com "De confiança" e o quintal pronto, na primavera; o desfile guarda a colocação', () => {
    const { session, state } = cafe();
    const def = content.festivals.find((f) => f.id === 'fest.cuteness_contest')!;
    const per = content.seasons.daysPerSeason;
    const spring = content.seasons.order.indexOf('spring');
    state.day = spring * per + def.date!.day - def.date!.noticeDays!;
    const need = content.reputation.thresholds.find((t) => t.id === 'rep.trusted')!.at;
    session.addReputation(need, 'teste');
    expect(state.festivals.active).toMatchObject({ id: def.id, stage: 'scheduled', day: spring * per + def.date!.day });
    // No dia: placa, decoração e o desfile.
    state.day = state.festivals.active!.day!;
    session.doJobPoint(def.closePoint!.point);
    for (const d of def.decorations!) session.doJobPoint(d.point);
    const stage = def.activities[0]!.point;
    expect(session.pendingJobPoints('map.cafe_main').map((p) => p.id)).toEqual([stage]);
    // Os gatos do café desfilam (os da história também) com as peças liberadas pela reputação de agora.
    const extras = session.miniGameExtras(stage);
    expect(extras.contestCats?.map((c) => c.id)).toEqual(session.shelteredCats());
    expect(extras.costumePieces).toContain('costume.star_band');
    const catId = session.shelteredCats()[0]!;
    session.finishMiniGame(makeResult(content.minigames, 'costume', 'normal', 'ok', 70, false, { bonusCoins: 10, contest: { catId, theme: 'theme.sea', rank: 2 } }), { difficulty: 'normal', jobPoint: stage });
    expect(state.festivals.active!.results[0]).toMatchObject({ game: 'costume', contest: { rank: 2 } });
    // Depois do desfile, a foto (os mesmos gatos do café).
    const spot = def.activities[1]!.point;
    expect(session.pendingJobPoints('map.cafe_main').map((p) => p.id)).toEqual([spot]);
    expect(session.miniGameExtras(spot).contestCats?.map((c) => c.id)).toEqual(session.shelteredCats());
    session.finishMiniGame(makeResult(content.minigames, 'photo', 'normal', 'great', 90, false, { photo: { pose: 'cute', score: 90, catIds: [catId] } }), { difficulty: 'normal', jobPoint: spot });
    expect(state.bestPhoto).toEqual({ pose: 'cute', score: 90, catIds: [catId], day: state.day });
    expect(state.festivals.active).toBeNull();
    expect(state.festivals.heldOn).toEqual({ id: def.id, day: state.day });
  });

  it('o Dia do Gato: montagem, mesa, desfile e a foto', () => {
    const catDay = content.festivals.find((f) => f.id === 'fest.cat_day')!;
    expect(catDay.activities.map((a) => a.game)).toEqual(['fair_setup', 'adoption', 'costume', 'photo']);
  });
});
