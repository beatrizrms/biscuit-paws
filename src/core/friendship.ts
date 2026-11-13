// Amizade com os vizinhos: presentes (1 por semana), gostos escondidos que ela descobre (dando o presente, lendo um
// post da SocialVilla ou pela dica de um evento), a conversa do dia e o feed de posts. Puro: sem Phaser, DOM ou
// window. Os dados ficam em data/friendship.json; o save guarda só IDs e números (GameState.friends e .social).
import type { Condition } from './content';

/** Como a pessoa recebe o presente. "neutral": o que não está em nenhuma lista. */
export type GiftReaction = 'loved' | 'liked' | 'neutral' | 'disliked';

/**
 * Que tipo de coisa é o presente (a fala de agradecimento combina com ele: não dá para pôr uma fruta "na mesa de
 * trabalho"). dish: bebida ou doce feito no café; ingredient: do mercado; plant: vasos, flores, mudas; object: o resto.
 */
export type GiftKind = 'dish' | 'ingredient' | 'plant' | 'object';
export const GIFT_KINDS: readonly GiftKind[] = ['dish', 'ingredient', 'plant', 'object'];

/** Uma fala de agradecimento; `for`: só para estes tipos de presente (sem o campo, serve para qualquer um). */
export interface ThanksLine {
  text: string;
  for?: GiftKind[];
}

/** Um post da SocialVilla; `reveals`: os gostos (chaves de presente) que ele dá a pista. */
export interface FriendPost {
  id: string;
  text: string;
  reveals?: string[];
}

export interface FriendDef {
  /** O NPC (data/npcs.json). */
  npc: string;
  /** O nome na SocialVilla, quando não é o do NPC (o Joca: "quem digita é a Gabi"). */
  handle?: string;
  /** Desde quando ela conhece a pessoa (os posts e os presentes só depois). */
  known: Condition;
  /** Chaves de presente: "recipe.<id>" (feito no café, da mão ou para viagem) ou "item.<id>". */
  loves: string[];
  likes: string[];
  dislikes: string[];
  /** Falas por reação; `{item}` vira o nome do presente. */
  thanks: Record<GiftReaction, ThanksLine[]>;
  /** Falas para presentes específicos, no lugar da reação comum (o chocolate do Joca: a Gabi dá bronca). */
  special?: { gifts: string[]; text: string }[];
  posts: FriendPost[];
}

export interface FriendshipData {
  schemaVersion: 1;
  /** Pontos de coração por reação e pela conversa do dia (uma por dia). */
  points: Record<GiftReaction, number> & { chat: number };
  /** Presentes por pessoa por semana do calendário. */
  giftsPerWeek: number;
  /** A fala de quem já ganhou presente nesta semana (não dá nem tira pontos). */
  weekLimit: string;
  /** Posts novos por dia na SocialVilla (só quando ela já viu os de antes). */
  postsPerDay: number;
  /** Quantos posts o feed guarda (os mais antigos saem). */
  feedSize: number;
  friends: FriendDef[];
}

/** O que ela sabe e fez com cada pessoa (no save). */
export interface FriendState {
  /** Gostos descobertos: chave do presente -> reação. */
  tastes: Record<string, GiftReaction>;
  /** Semanas em que deu presente: a última e quantos nela. */
  giftWeek?: number;
  giftsInWeek?: number;
  /** O último dia da conversa que deu pontos. */
  chatDay?: number;
}

/** O feed da SocialVilla (no save): os posts publicados (o mais novo primeiro) e os já vistos. */
export interface SocialState {
  feed: { post: string; day: number }[];
  seen: string[];
}

export function newSocial(): SocialState {
  return { feed: [], seen: [] };
}

/** Prefixo dos itens "para viagem" gerados das receitas (a bebida ou o doce guardado na mochila). */
export const TOGO_PREFIX = 'item.togo.';

/** O item "para viagem" de uma receita ("recipe.cafe_latte" -> "item.togo.cafe_latte"). */
export function togoItemId(recipeId: string): string {
  return TOGO_PREFIX + recipeId.replace(/^recipe\./, '');
}

/** A receita de um item "para viagem", ou undefined. */
export function togoRecipe(itemId: string): string | undefined {
  return itemId.startsWith(TOGO_PREFIX) ? `recipe.${itemId.slice(TOGO_PREFIX.length)}` : undefined;
}

/** O tipo de presente de uma chave (feito no café, do mercado, planta ou o resto). */
export function giftKindOf(key: string, items: Record<string, { tags: string[] } | undefined>): GiftKind {
  if (key.startsWith('recipe.') || togoRecipe(key)) return 'dish';
  const tags = items[key]?.tags ?? [];
  if (tags.includes('plant') || tags.includes('garden')) return 'plant';
  if (tags.includes('ingredient')) return 'ingredient';
  return 'object';
}

/** A chave do presente (como nos gostos): o item "para viagem" vale a receita; o resto, o próprio item. */
export function giftKey(itemOrRecipe: string): string {
  return togoRecipe(itemOrRecipe) ?? itemOrRecipe;
}

export function reactionOf(def: Pick<FriendDef, 'loves' | 'likes' | 'dislikes'>, key: string): GiftReaction {
  if (def.loves.includes(key)) return 'loved';
  if (def.likes.includes(key)) return 'liked';
  if (def.dislikes.includes(key)) return 'disliked';
  return 'neutral';
}

/** Semana do calendário (começa no primeiro dia da semana do jogo; mesma conta do weekdayOf). */
export function weekOf(day: number, startWeekday: number): number {
  return Math.floor((startWeekday + Math.max(1, day) - 1) / 7);
}

/** Já deu os presentes da semana? */
export function giftWeekFull(s: FriendState | undefined, week: number, perWeek: number): boolean {
  return !!s && s.giftWeek === week && (s.giftsInWeek ?? 0) >= perWeek;
}

/** Marca o presente da semana. */
export function noteGift(s: FriendState, week: number): void {
  s.giftsInWeek = s.giftWeek === week ? (s.giftsInWeek ?? 0) + 1 : 1;
  s.giftWeek = week;
}

/**
 * A fala de agradecimento: a especial do presente, se tiver; senão uma da reação que sirva para o tipo dele
 * (sorteada pela semente `seed`, para variar sem depender de Math.random).
 */
export function thanksLine(def: FriendDef, key: string, kind: GiftKind, reaction: GiftReaction, seed: number): string | null {
  const special = def.special?.find((s) => s.gifts.includes(key));
  if (special) return special.text;
  const lines = def.thanks[reaction].filter((l) => !l.for || l.for.includes(kind));
  if (lines.length === 0) return null;
  return lines[Math.abs(Math.floor(seed)) % lines.length]!.text;
}

/** Os gostos que um post revela, com a reação (para marcar como descobertos). */
export function postReveals(def: FriendDef, post: FriendPost): [string, GiftReaction][] {
  return (post.reveals ?? []).map((k) => [k, reactionOf(def, k)]);
}

/**
 * O feed do dia: se ela não viu os posts que estão lá, eles voltam com a data de hoje (como se tivessem sido postados
 * hoje) e nada novo entra; se já viu tudo, entram até `postsPerDay` posts novos (de quem ela conhece, na ordem dos
 * dados, alternando as pessoas). Muda `social` e devolve se mudou.
 */
export function publishDay(social: SocialState, data: FriendshipData, day: number, isKnown: (npc: string) => boolean): boolean {
  const unseen = social.feed.filter((f) => !social.seen.includes(f.post));
  if (unseen.length > 0) {
    let changed = false;
    for (const f of unseen) if (f.day !== day) (f.day = day), (changed = true);
    return changed;
  }
  const published = new Set(social.feed.map((f) => f.post).concat(social.seen));
  const queues = data.friends.filter((f) => isKnown(f.npc)).map((f) => f.posts.filter((p) => !published.has(p.id)));
  const fresh: string[] = [];
  // Alterna as pessoas (o dia escolhe quem começa), um post de cada por vez.
  for (let round = 0; fresh.length < data.postsPerDay && queues.some((q) => q.length > round); round++) {
    for (let i = 0; i < queues.length && fresh.length < data.postsPerDay; i++) {
      const q = queues[(i + day) % queues.length]!;
      if (q[round]) fresh.push(q[round]!.id);
    }
  }
  if (fresh.length === 0) return false;
  social.feed.unshift(...fresh.map((post) => ({ post, day })));
  social.feed.length = Math.min(social.feed.length, data.feedSize);
  return true;
}

/** Acha o post (e quem é) pelo id. */
export function findPost(data: FriendshipData, postId: string): { def: FriendDef; post: FriendPost } | undefined {
  for (const def of data.friends) {
    const post = def.posts.find((p) => p.id === postId);
    if (post) return { def, post };
  }
  return undefined;
}

/** Referências que o check confere. */
export interface FriendshipRefs {
  npcs: ReadonlySet<string>;
  items: ReadonlySet<string>;
  recipes: ReadonlySet<string>;
  /** O tipo de presente de uma chave existente. */
  kindOf: (key: string) => GiftKind | null;
  checkCondition: (where: string, c: Condition) => void;
}

/** Confere os dados (lista vazia: tudo certo). */
export function validateFriendship(data: FriendshipData, refs: FriendshipRefs): string[] {
  const errors: string[] = [];
  const posts = new Set<string>();
  const keyOk = (k: string) => (k.startsWith('recipe.') ? refs.recipes.has(k) : refs.items.has(k));
  for (const def of data.friends) {
    const where = `friendship: ${def.npc}`;
    if (!refs.npcs.has(def.npc)) errors.push(`${where}: NPC inexistente`);
    refs.checkCondition(where, def.known);
    const lists: [GiftReaction, string[]][] = [['loved', def.loves], ['liked', def.likes], ['disliked', def.dislikes]];
    const seen = new Set<string>();
    for (const [reaction, keys] of lists) {
      for (const k of keys) {
        if (!keyOk(k)) errors.push(`${where}: presente inexistente "${k}" (${reaction})`);
        if (seen.has(k)) errors.push(`${where}: "${k}" em mais de uma lista`);
        seen.add(k);
      }
      // Cada tipo de presente desta reação precisa de uma fala que sirva para ele (ou de uma fala especial).
      for (const k of keys) {
        const kind = refs.kindOf(k);
        if (!kind || def.special?.some((s) => s.gifts.includes(k))) continue;
        if (!def.thanks[reaction]?.some((l) => !l.for || l.for.includes(kind))) errors.push(`${where}: falta fala de "${reaction}" para ${kind} ("${k}")`);
      }
    }
    // Neutro: qualquer coisa pode chegar, então precisa de uma fala que sirva para tudo.
    if (!def.thanks.neutral?.some((l) => !l.for)) errors.push(`${where}: falta uma fala neutra que sirva para qualquer presente`);
    for (const s of def.special ?? []) for (const k of s.gifts) if (!keyOk(k)) errors.push(`${where}: fala especial com presente inexistente "${k}"`);
    for (const p of def.posts) {
      if (posts.has(p.id)) errors.push(`${where}: post repetido "${p.id}"`);
      posts.add(p.id);
      for (const k of p.reveals ?? []) if (!seen.has(k)) errors.push(`${where}: o post "${p.id}" revela "${k}", que não está nos gostos`);
    }
  }
  for (const r of ['loved', 'liked', 'neutral', 'disliked', 'chat'] as const) if (!Number.isFinite(data.points[r])) errors.push(`friendship: points.${r} inválido`);
  if (!(data.giftsPerWeek >= 1)) errors.push('friendship: giftsPerWeek precisa ser 1 ou mais');
  if (!(data.postsPerDay >= 1) || !(data.feedSize >= data.postsPerDay)) errors.push('friendship: postsPerDay/feedSize inválidos');
  return errors;
}
