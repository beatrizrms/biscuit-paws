import { describe, expect, it } from 'vitest';
import { activePerks, pendingRewards, taughtFlag, type FriendReward } from '../../src/core/friendRewards';
import { pairKey, PLAYER } from '../../src/core/relationships';
import { knownIds, parseSave, serializeSave } from '../../src/core/save';
import { weekdayOf } from '../../src/core/schedule';
import { GameSession } from '../../src/core/session';
import { newGameState } from '../../src/core/state';
import { loadContent } from './content';

const content = loadContent();
const PER_HEART = content.relationships.pointsPerHeart;
const START = content.seasons.startWeekday;

/** Café depois do prólogo, com os amigos conhecidos. */
function cafe(day = 10) {
  const state = newGameState(500, 'map.cafe_main', 10 * 60);
  const session = new GameSession(content, state);
  Object.assign(state.flags, { 'prologue.done': true, 'seen.scr.gabi_visit': true, 'met.old_neighbor': true, 'met.jacque': true, 'builder.called': true });
  state.day = day;
  return { state, session };
}

const setHearts = (state: ReturnType<typeof cafe>['state'], npc: string, n: number) => (state.relationships[pairKey(PLAYER, npc)] = n * PER_HEART);
const rewardOf = (npc: string, hearts: number) => content.friendship.friends.find((f) => f.npc === npc)!.rewards!.find((r) => r.hearts === hearts)!;
/** O próximo dia com este dia da semana (0 = segunda). */
const nextWeekday = (from: number, weekday: number) => Array.from({ length: 7 }, (_, i) => from + i).find((d) => weekdayOf(d, START) === weekday)!;

describe('recompensas por coração: as regras', () => {
  const rewards: FriendReward[] = [
    { hearts: 10, perk: { kind: 'extra_family', families: 1 }, text: 'c' },
    { hearts: 3, items: { 'item.cactus': 1 }, text: 'a' },
    { hearts: 6, items: { 'item.cactus': 1 }, text: 'b' },
  ];

  it('valem as dos corações alcançados que ainda não saíram, na ordem', () => {
    expect(pendingRewards(rewards, 2, [])).toEqual([]);
    expect(pendingRewards(rewards, 7, []).map((r) => r.hearts)).toEqual([3, 6]);
    expect(pendingRewards(rewards, 10, [3]).map((r) => r.hearts)).toEqual([6, 10]);
  });

  it('o favor só vale depois de entregue', () => {
    const friends = [{ npc: 'npc.x', rewards }];
    expect(activePerks(friends, () => [3, 6])).toEqual([]);
    expect(activePerks(friends, () => [10])).toEqual([{ npc: 'npc.x', perk: { kind: 'extra_family', families: 1 } }]);
  });

  it('todo amigo tem os três degraus (3, 6 e 10) e a receita aceita ser ensinada', () => {
    for (const f of content.friendship.friends) {
      expect(f.rewards?.map((r) => r.hearts)).toEqual([3, 6, 10]);
      for (const r of f.rewards!) if (r.recipe) expect(JSON.stringify(content.recipes[r.recipe]!.unlock)).toContain(taughtFlag(r.recipe));
    }
  });
});

describe('recompensas por coração no jogo', () => {
  it('3 corações: a Dona Neusa ensina o pão de queijo na conversa (libera antes da conquista), uma vez só', () => {
    const { state, session } = cafe();
    setHearts(state, 'npc.neusa', 2);
    expect(session.claimFriendRewards('npc.neusa')).toEqual([]);
    expect(session.service.recipeStatus('recipe.cheese_bread')).toBe('locked');
    setHearts(state, 'npc.neusa', 3);
    const [got] = session.claimFriendRewards('npc.neusa');
    expect(got).toEqual({ npc: 'npc.neusa', text: rewardOf('npc.neusa', 3).text, got: ['Pão de queijo'] });
    expect(state.flags[taughtFlag('recipe.cheese_bread')]).toBe(true);
    expect(session.service.recipeStatus('recipe.cheese_bread')).not.toBe('locked');
    expect(session.claimFriendRewards('npc.neusa')).toEqual([]);
  });

  it('já sabe a receita: ganha os ingredientes de duas porções', () => {
    const { state, session } = cafe();
    state.milestones.reached['milestone.customers_35'] = 1;
    setHearts(state, 'npc.neusa', 3);
    const before = { ...state.inventory };
    const [got] = session.claimFriendRewards('npc.neusa');
    for (const [id, n] of Object.entries(content.recipes['recipe.cheese_bread']!.ingredients)) expect(state.inventory[id]).toBe((before[id] ?? 0) + n * 2);
    expect(got!.got.length).toBe(Object.keys(content.recipes['recipe.cheese_bread']!.ingredients).length);
  });

  it('6 corações de uma vez: as duas recompensas saem em ordem; o presente vai para a mochila', () => {
    const { state, session } = cafe();
    setHearts(state, 'npc.jacque', 6);
    const got = session.claimFriendRewards('npc.jacque');
    expect(got.map((g) => g.text)).toEqual([rewardOf('npc.jacque', 3).text, rewardOf('npc.jacque', 6).text]);
    expect(state.inventory['item.cactus']).toBe(1);
  });

  it('conversando com a Gabi, o Joca (que passeia junto) também entrega o dele', () => {
    const { state, session } = cafe();
    setHearts(state, 'npc.joca', 6);
    const got = session.claimFriendRewards('npc.gabi');
    expect(got.map((g) => g.npc)).toEqual(['npc.joca', 'npc.joca']);
    expect(state.inventory['item.cat_treat_biscuit']).toBe(3);
    expect(state.inventory['item.playground_tunnel']).toBe(1);
  });

  it('sem conversa até a virada do dia: chega pela SocialVilla e vai para a mochila', () => {
    const { state, session } = cafe();
    setHearts(state, 'npc.jacque', 6);
    session.endDay('home');
    expect(state.inventory['item.cactus']).toBe(1);
    expect(state.friends['npc.jacque']?.rewards).toEqual([3, 6]);
    const feed = session.socialFeed();
    expect(feed.find((f) => f.id === 'reward.npc.jacque.6')).toMatchObject({ npc: 'npc.jacque', text: rewardOf('npc.jacque', 6).text, seen: false });
    // E o save guarda os degraus entregues.
    expect(parseSave(serializeSave(state, new Date()), knownIds(content)).state.friends['npc.jacque']?.rewards).toEqual([3, 6]);
  });

  it('10 corações do Tião: 20% a menos na mão de obra de toda obra', () => {
    const { state, session } = cafe();
    expect(session.builderLabor(100)).toBe(100);
    setHearts(state, 'npc.builder', 10);
    session.claimFriendRewards('npc.builder');
    expect(session.builderLabor(100)).toBe(80);
  });

  it('10 corações da Fernanda: um vale-castração já e outro a cada estação nova', () => {
    const { state, session } = cafe(5);
    setHearts(state, 'npc.fernanda', 10);
    state.visited.push('map.vet_clinic');
    expect(session.friendKnown('npc.fernanda')).toBe(true);
    session.claimFriendRewards('npc.fernanda');
    expect(state.clinic.vouchers).toBe(1);
    session.endDay('home');
    expect(state.clinic.vouchers).toBe(1); // mesma estação
    state.day = content.seasons.daysPerSeason; // último dia da estação: a virada leva à próxima
    session.endDay('home');
    expect(state.clinic.vouchers).toBe(2);
  });

  it('10 corações da Dona Neusa: toda segunda, um pote de mel chega na porta', () => {
    const monday = nextWeekday(20, 0);
    const { state, session } = cafe(monday - 1);
    setHearts(state, 'npc.neusa', 10);
    session.claimFriendRewards('npc.neusa');
    session.endDay('home');
    expect(state.day).toBe(monday);
    expect(state.deliveries.filter((d) => d.item === 'item.honey')).toHaveLength(1);
    session.endDay('home');
    expect(state.deliveries.filter((d) => d.item === 'item.honey')).toHaveLength(1); // terça: nada
  });

  it('10 corações da Gabi: na sexta, a partir das 14h, três clientes chegam sem esperar o intervalo', () => {
    const friday = nextWeekday(20, 4);
    const { state, session } = cafe(friday - 1);
    setHearts(state, 'npc.gabi', 10);
    session.claimFriendRewards('npc.gabi');
    session.endDay('home');
    const s = session as unknown as { friendRushDue(): boolean; friendRushSpawned(): void };
    state.time = 13 * 60;
    expect(s.friendRushDue()).toBe(false);
    state.time = 14 * 60;
    for (let i = 0; i < 3; i++) {
      expect(s.friendRushDue()).toBe(true);
      s.friendRushSpawned();
    }
    expect(s.friendRushDue()).toBe(false);
  });

  it('10 corações da Jacque: uma família a mais na adoção da feira', () => {
    const { state, session } = cafe();
    const s = session as unknown as { friendExtraFamilies(): number };
    expect(s.friendExtraFamilies()).toBe(0);
    setHearts(state, 'npc.jacque', 10);
    session.claimFriendRewards('npc.jacque');
    expect(s.friendExtraFamilies()).toBe(1);
  });

  it('a ficha da SocialVilla mostra os degraus e quais já saíram', () => {
    const { state, session } = cafe();
    setHearts(state, 'npc.jacque', 3);
    session.claimFriendRewards('npc.jacque');
    const jacque = session.friendsList().find((f) => f.npc === 'npc.jacque')!;
    expect(jacque.rewards.map((r) => [r.hearts, r.got])).toEqual([[3, true], [6, false], [10, false]]);
  });
});
