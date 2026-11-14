import { describe, expect, it } from 'vitest';
import { paramsOf } from '../../src/core/minigame';
import { coverage, FULL_SUSPICION, newPill, offer, pillOutcome, spread, startOffering, stepPill, warning, type PillParams } from '../../src/core/pill';
import { createRng } from '../../src/core/rng';
import { GameSession } from '../../src/core/session';
import { newGameState } from '../../src/core/state';
import { loadContent } from './content';

const content = loadContent();
const p = paramsOf<PillParams>(content.minigames, 'pill', 'normal');

/** Passa a pasta pelo comprimido inteiro, em linhas. */
function coverAll(s: ReturnType<typeof newPill>) {
  for (let v = 0; v <= 1; v += 0.05) for (let u = 0; u <= 1; u += 0.05) spread(s, p, u, v);
}
/** Avança até o humor pedido. */
function until(s: ReturnType<typeof newPill>, mood: 'distracted' | 'attentive', rng = createRng(1)) {
  for (let i = 0; i < 2000 && s.mood !== mood; i++) stepPill(s, p, 16, rng);
  for (let i = 0; i < 3; i++) stepPill(s, p, 1, rng); // entra um pouco na janela
}

describe('remédio escondido', () => {
  it('passo 1: a pasta cobre aos poucos, só em volta de onde passou; fora do comprimido não conta', () => {
    const s = newPill(p);
    expect(coverage(s)).toBe(0);
    spread(s, p, 0.5, 0.5);
    expect(coverage(s)).toBeGreaterThan(0);
    expect(coverage(s)).toBeLessThan(0.5);
    expect(spread(s, p, 3, 3)).toBe(0);
    coverAll(s);
    expect(coverage(s)).toBe(1);
  });

  it('passo 2: o gato alterna distraído e atento, com aviso no fim da distração; repetível pela semente', () => {
    const run = () => {
      const s = newPill(p);
      startOffering(s, p, createRng(7));
      const rng = createRng(7);
      const moods: string[] = [];
      let warned = false;
      for (let i = 0; i < 600; i++) {
        const ev = stepPill(s, p, 16, rng);
        if (ev.turned) moods.push(ev.turned);
        if (warning(s, p)) warned = true;
      }
      return { moods, warned };
    };
    const a = run();
    expect(a.moods.slice(0, 2)).toEqual(['attentive', 'distracted']);
    expect(a.warned).toBe(true);
    expect(run()).toEqual(a);
  });

  it('oferecer distraído e coberto na primeira = great; atento sobe muito a desconfiança e dá para tentar de novo', () => {
    const s = newPill(p);
    coverAll(s);
    startOffering(s, p, createRng(3));
    until(s, 'distracted');
    expect(offer(s, p)).toBe('ate');
    expect(pillOutcome(s)).toBe('great');

    const t = newPill(p);
    coverAll(t);
    startOffering(t, p, createRng(3));
    until(t, 'attentive');
    expect(offer(t, p)).toBe('caught');
    expect(t.suspicion).toBe(p.attentivePenalty);
    until(t, 'distracted');
    expect(offer(t, p)).toBe('ate');
    expect(pillOutcome(t)).toBe('ok');
  });

  it('cobertura incompleta sobe a desconfiança ao oferecer; desconfiança cheia, ele foge (fail)', () => {
    const s = newPill(p);
    startOffering(s, p, createRng(5));
    until(s, 'attentive');
    // Nada coberto e atento: a soma passa do limite.
    expect(offer(s, p)).toBe('fled');
    expect(s.suspicion).toBe(FULL_SUSPICION);
    expect(pillOutcome(s)).toBe('fail');
  });

  it('comprimido aparecendo (abaixo de minCover): mesmo distraído, ele sente o cheiro, não come e ela volta a cobrir', () => {
    expect(p.minCover).toBeGreaterThan(0.5);
    const s = newPill(p);
    spread(s, p, 0.5, 0.5); // um pouquinho só
    startOffering(s, p, createRng(2));
    until(s, 'distracted');
    expect(offer(s, p)).toBe('smelled');
    expect(s.phase).toBe('cover');
    expect(s.suspicion).toBeGreaterThan(30);
    expect(pillOutcome(s)).toBeNull();
    // Cobriu direito: agora, distraído, come (na segunda oferta: ok, não perfeito).
    coverAll(s);
    startOffering(s, p, createRng(3));
    until(s, 'distracted');
    expect(offer(s, p)).toBe('ate');
    expect(pillOutcome(s)).toBe('ok');
  });

  it('sem cobrir nada, duas ofertas e ele foge (cobrir é o jogo)', () => {
    const s = newPill(p);
    startOffering(s, p, createRng(4));
    until(s, 'distracted');
    expect(offer(s, p)).toBe('smelled');
    startOffering(s, p, createRng(4));
    until(s, 'distracted');
    expect(offer(s, p)).toBe('fled');
  });

  it('gato desconfiado: a janela de distração encolhe', () => {
    const avg = (scale: number) => {
      const s = newPill(p, scale);
      startOffering(s, p, createRng(11));
      return s.moodUntil;
    };
    expect(avg(0.65)).toBeLessThan(avg(1));
  });
});

describe('remédio escondido na sessão', () => {
  function sickCat() {
    const state = newGameState(500, 'map.cafe_main', 10 * 60);
    state.story.completed.push(...content.story.beats.map((b) => b.id));
    const session = new GameSession(content, state);
    session.shelterCat('cat.first_stray');
    session.debugSickWithPrescription('cat.first_stray');
    state.inventory[content.health.medicine.item] = 2;
    return { session, state };
  }
  const result = (outcome: 'fail' | 'ok' | 'great', skipped = false) => ({ gameId: 'pill', outcome, score: 0, coinsEarned: 0, skipped });

  it('deu certo: a dose do dia vai (com o remédio da mochila); falhou ou pulou, não', () => {
    const { session, state } = sickCat();
    session.finishMiniGame(result('fail'), { difficulty: 'normal', catId: 'cat.first_stray' });
    session.finishMiniGame(result('great', true), { difficulty: 'normal', catId: 'cat.first_stray' });
    expect(state.cats['cat.first_stray']!.sickness!.treatment!.dosesGiven).toBe(0);
    session.finishMiniGame(result('ok'), { difficulty: 'normal', catId: 'cat.first_stray' });
    expect(state.cats['cat.first_stray']!.sickness!.treatment!.dosesGiven).toBe(1);
    expect(state.inventory[content.health.medicine.item]).toBe(1);
    // A segunda do mesmo dia não vale.
    session.finishMiniGame(result('great'), { difficulty: 'normal', catId: 'cat.first_stray' });
    expect(state.cats['cat.first_stray']!.sickness!.treatment!.dosesGiven).toBe(1);
  });

  it('o jeito do gato muda a janela (cat_profiles.json: pillWindow)', () => {
    const { session } = sickCat();
    const personality = session.catDef('cat.first_stray')!.personality;
    // O Botinhas é castrado: mais calmo, distrai por mais tempo (clinic.json: effects.pillWindow).
    const effect = content.clinic.procedures.find((p) => p.id === 'proc.neuter')!.effects.pillWindow ?? 1;
    expect(session.pillWindow('cat.first_stray')).toBeCloseTo((content.catProfiles.personalities[personality]!.pillWindow ?? 1) * effect);
  });
});
