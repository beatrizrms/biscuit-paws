import { describe, expect, it } from 'vitest';
import { adoptionOutcome, hasPerfectMatch, judge, setupMatch, type Judgement } from '../../src/core/adoption';
import { makeResult } from '../../src/core/minigame';
import { createRng } from '../../src/core/rng';
import { GameSession } from '../../src/core/session';
import { newGameState } from '../../src/core/state';
import { loadContent } from './content';

const content = loadContent();
const data = content.adoption;
const cat = (id: string) => data.cats.find((c) => c.id === id)!;
const fam = (id: string) => data.families.find((f) => f.id === id)!;

describe('match de adoção', () => {
  it('veredito pela soma dos traços, com o porquê do traço que mais pesou', () => {
    const calmSenior = judge(data, cat('adopt.mingau'), fam('fam.elderly'));
    expect(calmSenior.verdict).toBe('good');
    expect(calmSenior.trait).toMatch(/personality.calm|age.senior/);
    const longCoat = judge(data, cat('adopt.nuvem'), fam('fam.allergic'));
    expect(longCoat).toMatchObject({ verdict: 'bad', trait: 'coat.long', note: fam('fam.allergic').notes['coat.long'] });
  });

  it('o sorteio sempre tem uma resposta toda boa (o perfeito não depende de sorte)', () => {
    for (let seed = 1; seed <= 40; seed++) {
      for (const n of [3, 4, 5]) {
        const m = setupMatch(createRng(seed), data, n);
        expect(m.cats).toHaveLength(n);
        expect(m.families).toHaveLength(n);
        expect(hasPerfectMatch(data, m.cats, m.families)).toBe(true);
      }
    }
  });

  it('feira montada: famílias a mais que gatos (mais escolha), sem repetir família', () => {
    const m = setupMatch(createRng(7), data, 3, [], 2);
    expect(m.cats).toHaveLength(3);
    expect(m.families).toHaveLength(5);
    expect(new Set(m.families.map((f) => f.id)).size).toBe(5);
  });

  it('resultado: todas boas = perfeito; pontos acima de okAt = conseguiu; senão, não deu', () => {
    const j = (verdict: Judgement['verdict']): Judgement => ({ catId: 'a', familyId: 'b', verdict, score: 0 });
    expect(adoptionOutcome([j('good'), j('good'), j('good')], { okAt: 0.5 })).toBe('great');
    expect(adoptionOutcome([j('good'), j('ok'), j('bad')], { okAt: 0.5 })).toBe('ok');
    expect(adoptionOutcome([j('bad'), j('ok'), j('bad')], { okAt: 0.5 })).toBe('fail');
  });

  it('integração: adoção boa tira do café um gato abrigado; os da história e os do abrigo não', () => {
    const state = newGameState(100, 'map.cafe_main');
    state.cats['cat.first_stray'] = { sheltered: true, name: 'Botinhas', map: 'map.cafe_main', shelteredOn: 1, health: 80, sickness: null };
    state.cats['cat.visitante'] = { sheltered: true, name: 'Visitante', map: 'map.cafe_main', shelteredOn: 1, health: 80, sickness: null };
    const session = new GameSession(content, state);
    const adopted: unknown[] = [];
    session.bus.on('cat.adopted', (e) => adopted.push(e));
    const adoptions = [
      { catId: 'cat.first_stray', verdict: 'good' as const },
      { catId: 'cat.visitante', verdict: 'good' as const },
      { catId: 'adopt.mingau', verdict: 'ok' as const },
    ];
    session.finishMiniGame(makeResult(content.minigames, 'adoption', 'easy', 'ok', 0, false, { adoptions }), { difficulty: 'easy' });
    expect(state.cats['cat.first_stray']!.sheltered).toBe(true); // protegido pela história
    expect(state.cats['cat.visitante']!.sheltered).toBe(false);
    expect(adopted).toEqual([
      { catId: 'cat.first_stray', verdict: 'good', leftCafe: false },
      { catId: 'cat.visitante', verdict: 'good', leftCafe: true },
      { catId: 'adopt.mingau', verdict: 'ok', leftCafe: false },
    ]);
    // Pular não adota ninguém.
    expect(makeResult(content.minigames, 'adoption', 'easy', 'ok', 0, true, { adoptions }).adoptions).toBeUndefined();
  });
});
