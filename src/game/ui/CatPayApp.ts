// App "CatPay" do celular: a vaquinha da CED (session.ced, src/core/ced.ts). Saldo e meta com a barra, o botão de
// completar com o caixa (até o teto dos dados), as doações (quem, quanto, por onde) e o extrato dos gastos
// (prestação de contas, inclusive das vaquinhas encerradas). Sem vaquinha: "nenhuma vaquinha ativa".
// Só desenha: as contas são do núcleo.
import type { Crowdfund } from '../../core/crowdfund';
import type { GameSession } from '../../core/session';
import { content, uiText } from '../content';

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
/** Quantas doações a lista mostra (as mais recentes). */
const DONATIONS_SHOWN = 8;

export class CatPayApp {
  constructor(private session: GameSession) {}

  render(body: HTMLElement): void {
    const t = uiText.catPayApp;
    const ced = this.session.state.ced;
    const c = ced.crowdfund;
    const last = ced.history[ced.history.length - 1];
    body.innerHTML = `<div class="catpay-app">${c ? this.cardHtml(c) : `<p class="cp-none">${esc(t.none)}</p>`}${
      c ? this.donationsHtml(c) : ''
    }${this.statementHtml(c ?? last)}</div>`;
    body.querySelector<HTMLButtonElement>('[data-cp="top-up"]')?.addEventListener('click', () => {
      this.session.ced.topUp(this.topUpAmount());
      this.render(body);
    });
  }

  /** Quanto o botão completa: o que cabe no teto e no caixa. */
  private topUpAmount(): number {
    return Math.min(this.session.ced.topUpRoom(), this.session.state.money);
  }

  private purposeName(c: Crowdfund): string {
    const [kind, n] = c.purpose.split('.');
    const name = (uiText.catPayApp.purposes as Record<string, string>)[kind ?? ''] ?? c.purpose;
    return n ? `${name} #${n}` : name;
  }

  /** O cartão da vaquinha: para que é, a barra, o saldo e o botão do caixa. */
  private cardHtml(c: Crowdfund): string {
    const t = uiText.catPayApp;
    const pct = Math.min(100, Math.round((c.raised / c.target) * 100));
    const done = c.status !== 'active';
    const room = this.session.ced.topUpRoom();
    const amount = this.topUpAmount();
    const share = Math.round(content.ced.topUp.maxShare * c.target);
    const topUp = done
      ? `<p class="cp-goal">${esc(t.goalReached)}</p>`
      : `<button class="cp-topup" data-cp="top-up" ${amount > 0 ? '' : 'disabled'}>${esc(t.topUp.replace('{n}', String(amount)))}</button>
         <p class="cp-hint">${esc(room > 0 ? (this.session.state.money > 0 ? t.topUpHint.replace('{n}', String(share)) : t.noMoney) : t.topUpDone)}</p>`;
    return `<section class="cp-card">
      <p class="cp-purpose">${esc(this.purposeName(c))}</p>
      <p class="cp-raised"><b>${c.raised}</b> ${esc(t.of.replace('{target}', String(c.target)))}</p>
      <div class="cp-bar"><i style="width:${pct}%"></i></div>
      <p class="cp-balance">${esc(t.balance)}: <b>${c.balance}</b></p>
      ${topUp}
    </section>`;
  }

  private donorName(id: string): string {
    return id === 'player' ? uiText.catPayApp.you : content.npcs[id]?.name ?? id;
  }

  /** As doações mais recentes. */
  private donationsHtml(c: Crowdfund): string {
    const t = uiText.catPayApp;
    const list = c.donations.slice(-DONATIONS_SHOWN).reverse();
    const rows = list
      .map(
        (d) => `<li><span class="cp-who">${esc(this.donorName(d.donor))}<small>${esc(t.sources[d.source])} · ${esc(t.day.replace('{n}', String(d.day)))}</small></span><b class="cp-in">+${d.amount}</b></li>`,
      )
      .join('');
    return `<h3>${esc(t.donations)}</h3>${rows ? `<ul class="cp-list">${rows}</ul>` : `<p class="cp-empty">${esc(t.noDonations)}</p>`}`;
  }

  /** O extrato: cada gasto, para que foi usado (da vaquinha atual ou da última encerrada). */
  private statementHtml(c: Crowdfund | undefined): string {
    const t = uiText.catPayApp;
    if (!c) return '';
    const rows = c.spends
      .map((s) => {
        const name = c.items.find((i) => i.id === s.item)?.name ?? s.item;
        return `<li><span class="cp-who">${esc(name)}<small>${esc(s.usedFor)} · ${esc(t.day.replace('{n}', String(s.day)))}</small></span><b class="cp-out">−${s.amount}</b></li>`;
      })
      .join('');
    const title = c === this.session.state.ced.crowdfund ? t.statement : `${t.statement} · ${this.purposeName(c)}`;
    return `<h3>${esc(title)}</h3>${rows ? `<ul class="cp-list">${rows}</ul>` : `<p class="cp-empty">${esc(t.noSpends)}</p>`}`;
  }
}
