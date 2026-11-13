// App SocialVilla do celular, em duas abas. Feed: os posts dos amigos (session.socialFeed; friendship.ts), o mais novo
// primeiro; abrir o feed marca os posts como vistos e anota os gostos de que eles dão a pista (session.viewSocial).
// Amigos: cada amigo que ela conhece, com o retrato, os corações, a conversa de hoje, o presente da semana e os gostos
// já descobertos (os que faltam aparecem como "?"). Só desenha: as regras são do núcleo.
import type { GameSession } from '../../core/session';
import type { GiftReaction } from '../../core/friendship';
import { content, uiText } from '../content';
import { iconHtml } from './ShopPanel';

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
const REACTIONS: GiftReaction[] = ['loved', 'liked', 'disliked', 'neutral'];

export class SocialApp {
  private tab: 'feed' | 'friends' = 'feed';
  /** Posts que estavam sem ver quando ela abriu (o selo "novo" fica até o dia acabar, mesmo depois de vistos). */
  private fresh = new Set<string>();

  constructor(private session: GameSession) {}

  /** Tem post que ela ainda não viu (o ícone do app ganha a bolinha). */
  hasNew(): boolean {
    return this.session.socialFeed().some((p) => !p.seen);
  }

  /** O app aparece no celular quando ela conhece alguém. */
  visible(): boolean {
    return this.session.friendsList().length > 0;
  }

  render(body: HTMLElement): void {
    const t = uiText.socialApp;
    // Antes de marcar como vistos: os novos ganham o selo "novo" nesta abertura.
    const feed = this.session.socialFeed();
    for (const p of feed) if (!p.seen) this.fresh.add(p.id);
    const tabs = `<div class="s-tabs">${(['feed', 'friends'] as const)
      .map((id) => `<button data-tab="${id}" class="${this.tab === id ? 'on' : ''}">${esc(t.tabs[id])}</button>`)
      .join('')}</div>`;
    body.innerHTML = `<div class="social-app">${tabs}${this.tab === 'feed' ? this.feedHtml(feed) : this.friendsHtml()}</div>`;
    body.querySelectorAll<HTMLButtonElement>('[data-tab]').forEach((b) =>
      b.addEventListener('click', () => {
        this.tab = b.dataset.tab as 'feed' | 'friends';
        this.render(body);
      }),
    );
    // Abriu o feed: vistos, e as pistas viram gostos anotados (na aba Amigos).
    if (this.tab === 'feed') this.session.viewSocial();
  }

  private avatar(npc: string): string {
    const def = content.npcs[npc];
    if (def?.portrait) return `<img class="sv-avatar" src="${def.portrait}" alt="" />`;
    // Sem retrato (o Joca): o primeiro quadro da folha dele.
    if (def?.sheet) return `<span class="sv-avatar sv-sheet" style="background-image:url(${def.sheet})"></span>`;
    return '<span class="sv-avatar"></span>';
  }

  private when(day: number): string {
    const t = uiText.socialApp;
    const ago = this.session.state.day - day;
    return ago <= 0 ? t.today : ago === 1 ? t.yesterday : t.daysAgo.replace('{n}', String(ago));
  }

  private feedHtml(feed: ReturnType<GameSession['socialFeed']>): string {
    const t = uiText.socialApp;
    if (feed.length === 0) return `<p class="sv-empty">${esc(t.emptyFeed)}</p>`;
    const posts = feed
      .map((p) => {
        const clue = content.friendship.friends.find((f) => f.npc === p.npc)?.posts.find((x) => x.id === p.id)?.reveals?.length;
        const isNew = this.fresh.has(p.id) && p.day === this.session.state.day;
        return `<article class="sv-post${isNew ? ' new' : ''}">${this.avatar(p.npc)}<div class="sv-body">
          <p class="sv-head"><b>${esc(p.handle)}</b><span>${esc(this.when(p.day))}</span>${isNew ? `<em>${esc(t.new)}</em>` : ''}</p>
          <p class="sv-text">${esc(p.text)}</p>${clue ? `<p class="sv-clue">${esc(t.clue)}</p>` : ''}
        </div></article>`;
      })
      .join('');
    return `<div class="sv-feed">${posts}</div>`;
  }

  private friendsHtml(): string {
    const t = uiText.socialApp;
    const list = this.session.friendsList();
    if (list.length === 0) return `<p class="sv-empty">${esc(t.emptyFriends)}</p>`;
    const cards = list
      .map((f) => {
        const hearts = Array.from({ length: f.maxHearts }, (_, i) => `<span class="heart${i < f.hearts ? ' on' : ''}">♥</span>`).join('');
        const def = content.friendship.friends.find((x) => x.npc === f.npc)!;
        const totals: Record<GiftReaction, number> = { loved: def.loves.length, liked: def.likes.length, disliked: def.dislikes.length, neutral: 0 };
        const rows = REACTIONS.map((r) => {
          const found = f.tastes.filter((x) => x.reaction === r);
          const missing = Math.max(0, totals[r] - found.length);
          if (found.length === 0 && missing === 0) return '';
          const chips = found.map((x) => `<span class="sv-chip">${this.giftIcon(x.gift)}${esc(x.name)}</span>`).join('') + (missing ? `<span class="sv-chip unknown">${'?'.repeat(Math.min(missing, 3))}${missing > 3 ? '…' : ''}</span>` : '');
          return `<p class="sv-taste ${r}"><b>${esc(t.reactions[r])}</b>${chips}</p>`;
        }).join('');
        const status = [f.chattedToday ? t.chatted : t.notChatted, f.giftedThisWeek ? t.gifted : t.canGift].map((x) => `<span>${esc(x)}</span>`).join('');
        return `<div class="sv-friend">${this.avatar(f.npc)}<div class="sv-body">
          <p class="sv-head"><b>${esc(f.handle)}</b></p>
          <span class="hearts" title="${esc(t.heartsTitle.replace('{n}', String(f.hearts)).replace('{max}', String(f.maxHearts)))}">${hearts} <b class="n">${f.hearts}/${f.maxHearts}</b></span>
          <p class="sv-status">${status}</p>${rows}
        </div></div>`;
      })
      .join('');
    return `<p class="sv-hint">${esc(t.friendsHint)}</p><div class="sv-friends">${cards}</div>`;
  }

  /** O ícone do gosto: o da receita (feito no café) ou o do item. */
  private giftIcon(key: string): string {
    const icon = key.startsWith('recipe.') ? content.recipes[key]?.icon : content.items[key]?.icon;
    return icon ? iconHtml(icon, 12) : '';
  }
}
