import { describe, expect, it } from 'vitest';
import { giftKey, publishDay, thanksLine, togoItemId, validateFriendship, weekOf, type FriendshipData } from '../../src/core/friendship';
import { hearts, points, PLAYER } from '../../src/core/relationships';
import { knownIds, parseSave, serializeSave } from '../../src/core/save';
import { GameSession } from '../../src/core/session';
import { newGameState } from '../../src/core/state';
import { loadContent } from './content';

const content = loadContent();
const F = content.friendship;
const START = content.seasons.startWeekday;

/** Café com a Gabi, o Joca e a Dona Neusa conhecidos, no começo de uma semana. */
function cafe() {
  const state = newGameState(500, 'map.cafe_main', 10 * 60);
  const session = new GameSession(content, state);
  Object.assign(state.flags, { 'prologue.done': true, 'seen.scr.gabi_visit': true, 'met.old_neighbor': true });
  // Primeiro dia de uma semana do calendário (a semana muda 7 dias depois).
  state.day = 14 - ((START + 14 - 1) % 7);
  return { state, session };
}

/** Item ativo na barra (com 1 na mochila). */
function holdItem(state: ReturnType<typeof cafe>['state'], itemId: string, qty = 1): void {
  state.inventory[itemId] = qty;
  state.hotbar.slots[0] = itemId;
  state.hotbar.active = 0;
}

describe('amizade: presentes', () => {
  it('os dados de friendship.json estão em ordem', () => {
    expect(content.friendship.friends.map((f) => f.npc)).toEqual(['npc.gabi', 'npc.joca', 'npc.neusa', 'npc.builder', 'npc.fernanda', 'npc.jacque']);
  });

  it('ama, gosta, neutro e não gosta: os pontos de cada reação', () => {
    const { state, session } = cafe();
    holdItem(state, 'item.vase_tulips');
    const liked = session.giveGift('npc.gabi');
    expect(liked).toMatchObject({ ok: true, reaction: 'liked', points: F.points.liked });
    expect(points(state, PLAYER, 'npc.gabi')).toBe(40);
    expect(state.inventory['item.vase_tulips']).toBeUndefined();

    holdItem(state, 'item.honey');
    expect(session.giveGift('npc.neusa')).toMatchObject({ ok: true, reaction: 'liked' });
    holdItem(state, 'item.apple');
    expect(session.giveGift('npc.joca')).toMatchObject({ ok: true, reaction: 'liked', points: 40 });
  });

  it('presente que ela não gosta tira um pouco (sem ficar negativo)', () => {
    const { state, session } = cafe();
    state.relationships[`${PLAYER}|npc.neusa`] = 100;
    holdItem(state, 'item.coffee_ground');
    expect(session.giveGift('npc.neusa')).toMatchObject({ ok: true, reaction: 'disliked', points: -15 });
    expect(points(state, PLAYER, 'npc.neusa')).toBe(85);
  });

  it('um presente por pessoa por semana: o segundo recebe a fala do limite e não gasta o item', () => {
    const { state, session } = cafe();
    holdItem(state, 'item.strawberry', 2);
    expect(session.giveGift('npc.gabi').ok).toBe(true);
    const again = session.giveGift('npc.gabi');
    expect(again).toEqual({ ok: false, reason: 'gift_week', line: F.weekLimit });
    expect(state.inventory['item.strawberry']).toBe(1);
    // Outra pessoa na mesma semana pode.
    expect(session.giveGift('npc.neusa').ok).toBe(true);
    // Na semana seguinte, a Gabi de novo.
    holdItem(state, 'item.strawberry');
    state.day += 7;
    expect(weekOf(state.day, START)).toBe(weekOf(state.day - 7, START) + 1);
    expect(session.giveGift('npc.gabi').ok).toBe(true);
  });

  it('só para quem ela conhece; ferramentas e coisas de uso não são presente', () => {
    const { state, session } = cafe();
    holdItem(state, 'item.strawberry');
    expect(session.giveGift('npc.jacque')).toEqual({ ok: false, reason: 'not_friend' });
    holdItem(state, 'item.cat_food_basic');
    expect(session.giftProblem('npc.gabi')).toBe('nothing_to_give');
  });

  it('a fala combina com o tipo de presente (uma fruta não vai "pra mesa do trabalho")', () => {
    const { state, session } = cafe();
    holdItem(state, 'item.strawberry');
    const r = session.giveGift('npc.gabi');
    expect(r.ok && r.line).toContain('Morango');
    const gabi = F.friends.find((f) => f.npc === 'npc.gabi')!;
    for (let seed = 0; seed < 6; seed++) expect(thanksLine(gabi, 'item.strawberry', 'ingredient', 'liked', seed)).not.toContain('mesa');
  });

  it('o chocolate do Joca: a Gabi dá bronca (fala especial)', () => {
    const { state, session } = cafe();
    holdItem(state, 'item.chocolate');
    const r = session.giveGift('npc.joca');
    expect(r).toMatchObject({ ok: true, reaction: 'disliked' });
    expect(r.ok && r.line).toContain('chocolate não pode');
  });

  it('presente da mão: a bebida do café vai, e a louça volta limpa', () => {
    const { state, session } = cafe();
    const cups = state.dishes.cup ?? 0;
    state.hands.push({ kind: 'drink', recipe: 'recipe.cafe_latte', vessel: 'cup' });
    const r = session.giveGift('npc.gabi');
    expect(r).toMatchObject({ ok: true, reaction: 'loved', points: F.points.loved });
    expect(r.ok && r.line).not.toContain('{item}');
    expect(state.hands).toEqual([]);
    expect(state.dishes.cup).toBe(cups + 1);
  });

  it('para viagem: a bebida da mão vai para a mochila e, dada depois, vale a receita', () => {
    const { state, session } = cafe();
    state.hands.push({ kind: 'drink', recipe: 'recipe.cheese_bread', vessel: 'plate' });
    const stored = session.storeToGo();
    expect(stored).toEqual({ ok: true, itemId: togoItemId('recipe.cheese_bread') });
    expect(state.hands).toEqual([]);
    expect(content.items['item.togo.cheese_bread']?.name).toBe(content.recipes['recipe.cheese_bread']!.name);
    expect(giftKey('item.togo.cheese_bread')).toBe('recipe.cheese_bread');
    holdItem(state, 'item.togo.cheese_bread');
    expect(session.giveGift('npc.neusa')).toMatchObject({ ok: true, reaction: 'loved' });
    expect(state.inventory['item.togo.cheese_bread']).toBeUndefined();
  });

  it('o presente descobre o gosto (o neutro fica anotado como neutro)', () => {
    const { state, session } = cafe();
    holdItem(state, 'item.flour');
    const r = session.giveGift('npc.gabi');
    expect(r).toMatchObject({ ok: true, reaction: 'neutral', points: 5, discovered: true });
    expect(state.friends['npc.gabi']!.tastes).toEqual({ 'item.flour': 'neutral' });
  });

  it('subir de coração: os corações antes e depois', () => {
    const { state, session } = cafe();
    state.relationships[`${PLAYER}|npc.gabi`] = 90;
    state.hands.push({ kind: 'drink', recipe: 'recipe.macarons', vessel: 'plate' });
    const r = session.giveGift('npc.gabi');
    expect(r.ok && r.hearts).toEqual([0, 1]);
    expect(hearts(state, content.relationships, PLAYER, 'npc.gabi')).toBe(1);
  });
});

describe('SocialVilla', () => {
  it('posts só de quem ela conhece; o que ela não viu volta no dia seguinte, com a data nova', () => {
    const { state, session } = cafe();
    session.socialDay();
    const first = session.socialFeed();
    expect(first.length).toBe(F.postsPerDay);
    expect(first.every((p) => ['npc.gabi', 'npc.joca', 'npc.neusa'].includes(p.npc))).toBe(true);
    // Não abriu o app: no dia seguinte, os mesmos posts, com a data de hoje.
    state.day += 1;
    session.socialDay();
    const second = session.socialFeed();
    expect(second.map((p) => p.id)).toEqual(first.map((p) => p.id));
    expect(second.every((p) => p.day === state.day && !p.seen)).toBe(true);
  });

  it('os gostos só ficam descobertos quando ela abre o app e vê o post', () => {
    const { state, session } = cafe();
    session.socialDay();
    const feed = session.socialFeed();
    expect(state.friends['npc.gabi']?.tastes ?? {}).toEqual({});
    session.viewSocial();
    const revealed = feed.flatMap((p) => F.friends.find((f) => f.npc === p.npc)!.posts.find((x) => x.id === p.id)!.reveals ?? []);
    const tastes = Object.values(state.friends).flatMap((f) => Object.keys(f.tastes));
    expect(tastes.sort()).toEqual([...revealed].sort());
    // Viu tudo: no dia seguinte, posts novos.
    state.day += 1;
    session.socialDay();
    expect(session.socialFeed().filter((p) => !p.seen).length).toBe(F.postsPerDay);
  });

  it('a Jacque só posta depois de ela conhecer', () => {
    const { state, session } = cafe();
    for (let d = 0; d < 30; d++) {
      session.socialDay();
      session.viewSocial();
      state.day += 1;
    }
    expect(state.social.seen.some((p) => p.startsWith('post.jacque'))).toBe(false);
  });

  it('publishDay alterna as pessoas', () => {
    const data: FriendshipData = { ...F, postsPerDay: 3 };
    const social = { feed: [], seen: [] };
    publishDay(social, data, 1, (npc) => npc === 'npc.gabi' || npc === 'npc.neusa');
    const authors = social.feed.map((f: { post: string }) => f.post.split('.')[1]);
    expect(new Set(authors)).toEqual(new Set(['gabi', 'neusa']));
  });
});

describe('amizade: conversa e save', () => {
  it('a conversa do dia fica no save: recarregar não dá os pontos de novo', () => {
    const { state, session } = cafe();
    const walk = content.npcWalks.find((w) => w.npc === 'npc.neusa')!;
    expect(walk).toBeDefined();
    session.neighborChat('npc.neusa');
    expect(points(state, PLAYER, 'npc.neusa')).toBe(F.points.chat);
    const loaded = parseSave(serializeSave(state, new Date()), knownIds(content)).state;
    const again = new GameSession(content, loaded);
    again.neighborChat('npc.neusa');
    expect(points(loaded, PLAYER, 'npc.neusa')).toBe(F.points.chat);
    expect(loaded.friends['npc.neusa']!.chatDay).toBe(state.day);
  });

  it('conversar com o Tião na obra (ou na festa) também vale a conversa do dia, uma vez por dia', () => {
    const { state, session } = cafe();
    expect(session.noteFriendChat('npc.builder')).toBe(F.points.chat);
    expect(session.noteFriendChat('npc.builder')).toBe(0);
    expect(points(state, PLAYER, 'npc.builder')).toBe(F.points.chat);
    state.day += 1;
    expect(session.noteFriendChat('npc.builder')).toBe(F.points.chat);
    expect(session.noteFriendChat('npc.market_clerk')).toBe(0);
  });

  it('o save guarda gostos, presente da semana, feed e os itens para viagem', () => {
    const { state, session } = cafe();
    holdItem(state, 'item.strawberry');
    session.giveGift('npc.gabi');
    session.socialDay();
    session.viewSocial();
    state.inventory['item.togo.cafe_latte'] = 2;
    const loaded = parseSave(serializeSave(state, new Date()), knownIds(content)).state;
    expect(loaded.friends).toEqual(state.friends);
    expect(loaded.social).toEqual(state.social);
    expect(loaded.inventory['item.togo.cafe_latte']).toBe(2);
  });

  it('o check acusa reação sem fala para o tipo de presente', () => {
    const gabi = F.friends.find((f) => f.npc === 'npc.gabi')!;
    const broken: FriendshipData = { ...F, friends: [{ ...gabi, thanks: { ...gabi.thanks, liked: [{ text: 'Vai pra minha mesa.', for: ['object'] }] } }] };
    const errors = validateFriendship(broken, {
      npcs: new Set(Object.keys(content.npcs)),
      items: new Set(Object.keys(content.items)),
      recipes: new Set(Object.keys(content.recipes)),
      kindOf: (k) => (k.startsWith('recipe.') ? 'dish' : content.items[k]?.tags.includes('ingredient') ? 'ingredient' : content.items[k]?.tags.includes('plant') ? 'plant' : 'object'),
      checkCondition: () => undefined,
    });
    expect(errors.some((e) => e.includes('falta fala de "liked" para dish'))).toBe(true);
    expect(errors.some((e) => e.includes('falta fala de "liked" para ingredient'))).toBe(true);
  });
});
