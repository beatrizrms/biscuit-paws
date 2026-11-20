// Adoção on-line (decisão 291): a partir de minCats gatos que podem ir, a protagonista tem a ideia de anunciar na
// SocialVilla; todo gato que pode ir fica anunciado sozinho. De tempos em tempos (sorteio, everyDays) aparece alguém
// interessado em 1 ou 2 gatos: vem ao café, conversa (tela, sem acesso à rua; filhote: quando castrar) e leva. Depois,
// o post de "adotado" e, dias depois, a notícia da família. Mais lenta que a feira, e aleatória.
// Puro: sem Phaser, DOM ou window. A cena mostra a ideia e a visita (fila de momentos) e avisa quando terminaram.

import type { EventBus } from './events';
import { createRng, type Rng } from './rng';
import type { GameState } from './state';

export interface AdoptionOnlineConfig {
  /** Gatos que podem ir (no café) para a ideia de anunciar. */
  minCats: number;
  /** Dias entre um interessado e o próximo (sorteio [mín, máx]). */
  visitEveryDays: [number, number];
  /** Chance de o interessado querer 2 gatos (havendo 2 anunciados). */
  twoCatsChance: number;
  /** A visita só acontece com ela no café nesse horário ([de, até], "HH:MM"). */
  visitHours: [string, string];
  /** Dias até a notícia da família depois da adoção (sorteio [mín, máx]). */
  newsAfterDays: [number, number];
  /** As falas e os posts ({cat}, {cats}, {days}; {player} na fala dela). */
  texts: Record<string, string>;
}

export interface AdoptionOnlinePost {
  id: string;
  day: number;
  kind: 'listing' | 'adopted' | 'news';
  cats: string[];
  /** Notícia: o rosto da família (índice dos customerLooks). */
  look?: number;
}

export interface AdoptionOnlineVisit {
  cats: string[];
  /** O rosto do interessado (índice dos customerLooks). */
  look: number;
  day: number;
}

export interface AdoptionOnlineState {
  /** off: ainda não; idea: a ideia está para aparecer (cena); on: anunciando. */
  stage: 'off' | 'idea' | 'on';
  /** Gatos já anunciados (os que entram depois ganham um post novo). */
  listed: string[];
  /** Dia do próximo interessado (null: ainda não marcado). */
  nextVisit: number | null;
  /** O interessado de agora, esperando ela no café (a cena). */
  visit: AdoptionOnlineVisit | null;
  /** Notícias marcadas (a família posta a foto dos gatos na casa nova; uma por família). */
  news: { cats: string[]; day: number; look: number }[];
  posts: AdoptionOnlinePost[];
  /** Os nomes dos gatos que saíram (os posts continuam com o nome depois que ele não está mais no café). */
  names: Record<string, string>;
}

export function newAdoptionOnline(): AdoptionOnlineState {
  return { stage: 'off', listed: [], nextVisit: null, visit: null, news: [], posts: [], names: {} };
}

export interface AdoptionOnlineHost {
  state: GameState;
  bus: EventBus;
  cfg: AdoptionOnlineConfig;
  /** Gatos do café que podem ir agora (castrados ou filhotes antes da idade de castrar; ordem estável). */
  adoptable(): string[];
  catName(catId: string): string;
  /** Tira o gato do café (vai para a família). Diz se saiu. */
  adoptOut(catId: string): boolean;
  /** Quantos rostos de interessado existem (customerLooks). */
  looks: number;
  postSocial(postId: string): void;
}

/** Sorteio repetível do dia (o mesmo save dá o mesmo interessado). */
function rngFor(day: number, salt: number): Rng {
  return createRng(day * 7919 + salt * 104729 + 17);
}

export class AdoptionOnlineFlow {
  constructor(private h: AdoptionOnlineHost) {}

  private get st(): AdoptionOnlineState {
    return this.h.state.adoptionOnline;
  }

  /** De manhã: a ideia, os anúncios novos, o interessado do dia e as notícias das famílias. */
  morning(): void {
    const s = this.st;
    const day = this.h.state.day;
    const ready = this.h.adoptable();
    if (s.stage === 'off' && ready.length >= this.h.cfg.minCats) {
      s.stage = 'idea';
      this.h.bus.emit('adoption_online.idea', { cats: ready.length });
    }
    if (s.stage === 'on') {
      // O interessado de antes não tem mais gato que possa ir (adoeceu, foi para a feira): desiste e vem outro depois.
      if (s.visit && !this.pendingVisit()) {
        s.visit = null;
        s.nextVisit = day + this.gap(2);
      }
      this.listNew(ready);
      if (!s.visit && s.nextVisit !== null && day >= s.nextVisit && ready.length > 0) this.newVisit(ready);
    }
    for (const n of s.news.filter((x) => x.day <= day)) this.post('news', n.cats, n.look);
    s.news = s.news.filter((x) => x.day > day);
  }

  /** A cena da ideia terminou: começa a anunciar (post com os gatos) e marca o primeiro interessado. */
  ideaShown(): void {
    const s = this.st;
    if (s.stage !== 'idea') return;
    s.stage = 'on';
    this.listNew(this.h.adoptable());
    s.nextVisit = this.h.state.day + this.gap(1);
  }

  /** A visita que está esperando ela (a cena), com os gatos que ainda podem ir. null: nenhuma. */
  pendingVisit(): AdoptionOnlineVisit | null {
    const v = this.st.visit;
    if (!v) return null;
    const ready = new Set(this.h.adoptable());
    const cats = v.cats.filter((id) => ready.has(id));
    return cats.length > 0 ? { ...v, cats } : null;
  }

  /** A visita terminou: os gatos vão com a família, o post de adotado, a notícia marcada e o próximo interessado. */
  visitDone(): string[] {
    const s = this.st;
    const v = this.pendingVisit();
    s.visit = null;
    s.nextVisit = this.h.state.day + this.gap(2);
    if (!v) return [];
    const gone: string[] = [];
    for (const id of v.cats) {
      const name = this.h.catName(id);
      if (!this.h.adoptOut(id)) continue;
      s.names[id] = name;
      gone.push(id);
    }
    if (gone.length > 0) {
      const [min, max] = this.h.cfg.newsAfterDays;
      s.news.push({ cats: gone, day: this.h.state.day + rngFor(this.h.state.day, 3).int(min, max), look: v.look });
      this.post('adopted', gone);
      this.h.bus.emit('adoption_online.adopted', { cats: gone });
    }
    return gone;
  }

  /** O nome do gato num post (o salvo, se ele já saiu do café). */
  nameOf(catId: string): string {
    return this.st.names[catId] ?? this.h.catName(catId);
  }

  /** O post (id adopt.post.*) ou null. */
  postById(postId: string): AdoptionOnlinePost | null {
    return this.st.posts.find((p) => p.id === postId) ?? null;
  }

  private listNew(ready: string[]): void {
    const s = this.st;
    const fresh = ready.filter((id) => !s.listed.includes(id));
    if (fresh.length === 0) return;
    s.listed.push(...fresh);
    this.post('listing', fresh);
  }

  private newVisit(ready: string[]): void {
    const day = this.h.state.day;
    const rng = rngFor(day, 1);
    // Ordem sorteada (repetível): o primeiro gato e, às vezes, um segundo.
    const pool = [...ready];
    const first = pool.splice(rng.int(0, pool.length - 1), 1)[0]!;
    const cats = [first];
    if (pool.length > 0 && rng.chance(this.h.cfg.twoCatsChance)) cats.push(pool[rng.int(0, pool.length - 1)]!);
    this.st.visit = { cats, look: this.h.looks > 0 ? rng.int(0, this.h.looks - 1) : 0, day };
    this.h.bus.emit('adoption_online.visit', { cats });
  }

  private gap(salt: number): number {
    const [min, max] = this.h.cfg.visitEveryDays;
    return rngFor(this.h.state.day, salt + 10).int(min, max);
  }

  private post(kind: AdoptionOnlinePost['kind'], cats: string[], look?: number): void {
    const s = this.st;
    const id = `adopt.post.${s.posts.length + 1}`;
    for (const c of cats) s.names[c] ??= this.h.catName(c);
    s.posts.push({ id, day: this.h.state.day, kind, cats, ...(look !== undefined ? { look } : {}) });
    this.h.postSocial(id);
  }
}

/** Save: o que veio (ou o começo, se nada). */
export function normalizeAdoptionOnline(raw: unknown, knownCat: (id: string) => boolean): AdoptionOnlineState {
  const base = newAdoptionOnline();
  if (!raw || typeof raw !== 'object') return base;
  const r = raw as Partial<AdoptionOnlineState>;
  const ints = (n: unknown): n is number => Number.isInteger(n);
  const cats = (a: unknown) => (Array.isArray(a) ? a.filter((x): x is string => typeof x === 'string' && knownCat(x)) : []);
  return {
    stage: r.stage === 'idea' || r.stage === 'on' ? r.stage : 'off',
    listed: cats(r.listed),
    nextVisit: ints(r.nextVisit) ? r.nextVisit : null,
    visit: r.visit && ints(r.visit.day) && ints(r.visit.look) && cats(r.visit.cats).length > 0 ? { cats: cats(r.visit.cats), look: r.visit.look, day: r.visit.day } : null,
    news: Array.isArray(r.news) ? r.news.filter((n) => n && cats(n.cats).length > 0 && ints(n.day) && ints(n.look)).map((n) => ({ cats: cats(n.cats), day: n.day, look: n.look })) : [],
    posts: Array.isArray(r.posts)
      ? r.posts
          .filter((p) => p && typeof p.id === 'string' && ints(p.day) && ['listing', 'adopted', 'news'].includes(p.kind))
          .map((p) => ({ id: p.id, day: p.day, kind: p.kind, cats: cats(p.cats), ...(ints(p.look) ? { look: p.look } : {}) }))
      : [],
    names: Object.fromEntries(Object.entries((r.names ?? {}) as Record<string, unknown>).filter((e): e is [string, string] => knownCat(e[0]) && typeof e[1] === 'string')),
  };
}

export function validateAdoptionOnline(cfg: AdoptionOnlineConfig | undefined): string[] {
  if (!cfg) return [];
  const e: string[] = [];
  const pair = (p: [number, number], name: string) => {
    if (!(Array.isArray(p) && Number.isInteger(p[0]) && Number.isInteger(p[1]) && p[0] >= 1 && p[1] >= p[0])) e.push(`adoption.online.${name} precisa de [mín, máx] inteiros, mín >= 1`);
  };
  if (!(Number.isInteger(cfg.minCats) && cfg.minCats >= 1)) e.push('adoption.online.minCats precisa ser inteiro >= 1');
  pair(cfg.visitEveryDays, 'visitEveryDays');
  pair(cfg.newsAfterDays, 'newsAfterDays');
  if (!(cfg.twoCatsChance >= 0 && cfg.twoCatsChance <= 1)) e.push('adoption.online.twoCatsChance entre 0 e 1');
  if (!(Array.isArray(cfg.visitHours) && cfg.visitHours.every((h) => /^\d\d:\d\d$/.test(h)))) e.push('adoption.online.visitHours precisa de ["HH:MM", "HH:MM"]');
  for (const k of ['idea', 'listingPost', 'adoptedPost', 'newsPost', 'speaker', 'interest', 'askScreens', 'answerScreens', 'askStreet', 'answerStreet', 'kittenNeuter', 'kittenAnswer', 'thanks', 'bye']) {
    if (typeof cfg.texts?.[k] !== 'string') e.push(`adoption.online.texts.${k} faltando`);
  }
  return e;
}
