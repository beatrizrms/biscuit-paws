import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { addCare, careAtDayEnd, careGain, careNeeds, careOf, playInterval, toysMissing } from '../../src/core/care';
import { knownIds, parseSave } from '../../src/core/save';
import { GameSession } from '../../src/core/session';
import { newGameState, type CatState } from '../../src/core/state';
import { loadContent } from './content';

const content = loadContent();
const cfg = content.health.care;
// Alimentado (fedOn longe no futuro): estes testes não olham a fome.
const cat = (over: Partial<CatState> = {}): CatState => ({ sheltered: true, name: 'Mimi', map: 'map.cafe_main', shelteredOn: 1, fedOn: 999, health: 80, sickness: null, ...over });

describe('cuidados (puro)', () => {
  it('sem o campo, vale o inicial; soma fica entre 0 e max', () => {
    const c = cat();
    expect(careOf(c, cfg)).toEqual(cfg.start);
    addCare(c, 'happiness', 500, cfg);
    expect(c.happiness).toBe(cfg.max);
    addCare(c, 'hygiene', -500, cfg);
    expect(c.hygiene).toBe(0);
  });

  it('fim do dia: a higiene cai; com brinquedo, a felicidade fica', () => {
    const c = cat({ happiness: 50, hygiene: 50 });
    careAtDayEnd(c, cfg, 5, { toys: 1, cats: 1 });
    expect(c).toMatchObject({ happiness: 50 - cfg.daily.happiness, hygiene: 50 - cfg.daily.hygiene });
  });

  it('sem brinquedo suficiente (1 a cada 3 gatos): pede todo dia e fica triste se ninguém brincar', () => {
    expect(toysMissing(cfg, { toys: 0, cats: 1 })).toBe(1);
    expect(toysMissing(cfg, { toys: 1, cats: 3 })).toBe(0);
    expect(toysMissing(cfg, { toys: 1, cats: 4 })).toBe(1);
    expect(playInterval(cfg, { toys: 1, cats: 4 })).toBe(1);
    const c = cat({ happiness: 50, playedOn: 4 });
    careAtDayEnd(c, cfg, 5, { toys: 0, cats: 1 });
    expect(c.happiness).toBe(50 - cfg.play.missedHappiness);
    const played = cat({ happiness: 50, playedOn: 5 });
    careAtDayEnd(played, cfg, 5, { toys: 0, cats: 1 });
    expect(played.happiness).toBe(50);
  });

  it('com brinquedo: pede a cada 4 dias, +1 por brinquedo a mais e por outro gato, até 8', () => {
    expect(playInterval(cfg, { toys: 1, cats: 1 })).toBe(cfg.play.everyDays);
    expect(playInterval(cfg, { toys: 2, cats: 2 })).toBe(cfg.play.everyDays + 2);
    expect(playInterval(cfg, { toys: 9, cats: 9 })).toBe(cfg.play.maxDays);
    const c = cat({ playedOn: 1 });
    const room = { toys: 1, cats: 1 };
    expect(careNeeds(c, 1 + cfg.play.everyDays - 1, cfg, room)).toEqual([]);
    expect(careNeeds(c, 1 + cfg.play.everyDays, cfg, room)).toEqual(['play']);
  });

  it('o que falta, por urgência: remédio (dose de hoje pendente), banho, carinho', () => {
    const sick = { disease: 'disease.whisker_fever', since: 1, treatment: { days: 3, dosesGiven: 1, lastDoseDay: 4 } };
    const c = cat({ happiness: cfg.low.happiness - 1, hygiene: cfg.low.hygiene - 1, sickness: sick });
    const room = { toys: 1, cats: 1 };
    const fresh = { playedOn: 5 };
    expect(careNeeds({ ...c, ...fresh }, 5, cfg, room)).toEqual(['medicine', 'dirty', 'sad']);
    expect(careNeeds({ ...c, playedOn: 4 }, 4, cfg, room)).toEqual(['dirty', 'sad']); // já tomou a de hoje
    expect(careNeeds(cat({ sickness: { ...sick, treatment: null }, ...fresh }), 5, cfg, room)).toEqual([]); // doente sem receita: o vet primeiro
    expect(careNeeds(cat(fresh), 5, cfg, room)).toEqual([]);
  });

  it('ganho por mini game: só quando dá certo, e great vale mais', () => {
    expect(careGain(cfg, 'wand', 'fail')).toEqual({});
    expect(careGain(cfg, 'wand', 'great').happiness).toBeGreaterThan(careGain(cfg, 'wand', 'ok').happiness!);
    expect(careGain(cfg, 'grooming', 'ok').hygiene).toBeGreaterThan(0);
    expect(careGain(cfg, 'chase', 'great')).toEqual({});
  });
});

describe('cuidados na sessão', () => {
  function cafe() {
    const state = newGameState(500, 'map.cafe_main', 10 * 60);
    state.story.completed.push(...content.story.beats.map((b) => b.id));
    const session = new GameSession(content, state);
    session.shelterCat('cat.first_stray');
    return { session, state };
  }

  it('gato abrigado começa com o inicial; o dia passa e cai', () => {
    const { session, state } = cafe();
    expect(session.catCare('cat.first_stray')).toMatchObject(cfg.start);
    session.endDay('home');
    // Sem caixa de areia trocada no dia, a higiene cai mais (litterMissed).
    expect(state.cats['cat.first_stray']).toMatchObject({ happiness: cfg.start.happiness - cfg.daily.happiness, hygiene: cfg.start.hygiene - cfg.daily.hygiene - cfg.litterMissed });
  });

  it('mini game de cuidado com o gato sobe os atributos (e avisa); falhou ou pulou, nada', () => {
    const { session, state } = cafe();
    const events: string[] = [];
    session.bus.onAny((n) => events.push(n));
    const result = (outcome: 'fail' | 'ok' | 'great', skipped = false) => ({ gameId: 'grooming', outcome, score: 0, coinsEarned: 0, skipped });
    state.cats['cat.first_stray']!.hygiene = 10;
    session.finishMiniGame(result('fail'), { difficulty: 'normal', catId: 'cat.first_stray' });
    session.finishMiniGame(result('great', true), { difficulty: 'normal', catId: 'cat.first_stray' });
    expect(state.cats['cat.first_stray']!.hygiene).toBe(10);
    session.finishMiniGame(result('great'), { difficulty: 'normal', catId: 'cat.first_stray' });
    expect(state.cats['cat.first_stray']!.hygiene).toBe(10 + cfg.gains.grooming!.hygiene!.great);
    expect(events).toContain('cat.cared');
    expect(session.catCare('cat.first_stray')!.needs).not.toContain('dirty');
  });

  it('save v20 guarda os dois; v19 ganha 70 em cada gato; valor quebrado volta ao inicial', () => {
    const known = knownIds(content);
    const v20 = parseSave(readFileSync('tests/fixtures/save_v20.json', 'utf8'), known).state;
    expect(v20.cats['cat.first_stray']).toMatchObject({ happiness: 40, hygiene: 20 });
    const v19 = parseSave(readFileSync('tests/fixtures/save_v19.json', 'utf8'), known).state;
    expect(v19.cats['cat.first_stray']).toMatchObject({ happiness: 70, hygiene: 70 });
    const bad = JSON.parse(readFileSync('tests/fixtures/save_v20.json', 'utf8'));
    bad.cats['cat.first_stray'].happiness = 'feliz';
    bad.cats['cat.first_stray'].hygiene = 900;
    const c = parseSave(JSON.stringify(bad), known).state.cats['cat.first_stray']!;
    expect(c.happiness).toBeUndefined();
    expect(careOf(c, cfg)).toEqual(cfg.start);
  });
});
