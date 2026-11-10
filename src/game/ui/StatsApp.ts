// App "Café em números" do celular, em duas abas. Números: o raio X do café (session.stats, src/core/stats.ts):
// clientes (total, hoje, média da semana e o gráfico dos últimos 14 dias), consumo de ingredientes por dia, reputação e
// moedas, gatos e as sequências de bom comportamento. Selos (session.milestoneTracks, src/core/milestones.ts): por
// trilha, os conquistados com a recompensa, o próximo com a barra e a recompensa só pelo tipo ("Nova receita ?").
// Só desenha: as contas são do núcleo.
import type { GameSession } from '../../core/session';
import type { StreakId } from '../../core/stats';
import type { MilestoneDef } from '../../core/milestones';
import { content, uiText } from '../content';
import { iconHtml } from './ShopPanel';

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
/** 9,3 (uma casa, só quando precisa). */
const num = (n: number) => n.toLocaleString('pt-BR', { maximumFractionDigits: 1 });
/** Quantos ingredientes a lista de consumo mostra. */
const DOSES_SHOWN = 6;

/** O nome de cada recompensa do selo ("Petisco de biscoito ×3" quando repete). */
function rewardNames(m: MilestoneDef): string {
  const name = (id: string) =>
    m.reward.kind === 'recipe' ? content.recipes[id]?.name
    : m.reward.kind === 'room' ? content.rooms.rooms.find((r) => r.id === id)?.name
    : m.reward.kind === 'event' ? content.festivals.find((f) => f.id === id)?.name
    : content.items[id]?.name;
  const counts = new Map<string, number>();
  for (const id of m.reward.ids) counts.set(id, (counts.get(id) ?? 0) + 1);
  return [...counts].map(([id, n]) => (name(id) ?? id) + (n > 1 ? ` ×${n}` : '')).join(', ');
}

/** "Nova receita: Café com leite" (o que o selo deu). */
export function rewardText(m: MilestoneDef): string {
  return `${uiText.statsApp.rewardKinds[m.reward.kind]}: ${rewardNames(m)}`;
}

export class StatsApp {
  private tab: 'numbers' | 'seals' = 'numbers';

  constructor(private session: GameSession) {}

  render(body: HTMLElement): void {
    const t = uiText.statsApp;
    const tabs = `<div class="s-tabs">${(['numbers', 'seals'] as const)
      .map((id) => `<button data-tab="${id}" class="${this.tab === id ? 'on' : ''}">${esc(t.tabs[id])}</button>`)
      .join('')}</div>`;
    body.innerHTML = tabs + (this.tab === 'numbers' ? this.numbersHtml() : this.sealsHtml());
    body.querySelectorAll<HTMLButtonElement>('[data-tab]').forEach((b) =>
      b.addEventListener('click', () => {
        this.tab = b.dataset.tab as 'numbers' | 'seals';
        this.render(body);
        body.scrollTop = 0;
      }),
    );
  }

  /** Selos: uma caixinha por trilha. */
  private sealsHtml(): string {
    const t = uiText.statsApp;
    const tracks = this.session.milestoneTracks().map((v) => {
      const done = v.reached.map((m) => `<li class="s-done"><b>✓ ${esc(m.name)}</b><span>${esc(rewardText(m))}</span></li>`).join('');
      const n = v.next;
      const next = n
        ? `<li class="s-next"><b>${esc(n.def.name)}</b><span class="s-progress"><span class="bar"><span class="fill" style="width:${Math.round((n.value / n.def.at) * 100)}%"></span></span><i>${n.value}/${n.def.at}</i></span>
            <span class="s-teaser">${esc(t.rewardKinds[n.def.reward.kind])} ?</span>${n.blocked && n.def.whenText ? `<span class="s-when">${esc(n.def.whenText)}</span>` : ''}</li>`
        : `<li class="s-all">${esc(t.allDone)}</li>`;
      const more = v.hidden > 0 ? `<li class="s-more">${esc((v.hidden === 1 ? t.moreOne : t.more).replace('{n}', String(v.hidden)))}</li>` : '';
      return `<section class="s-track ${v.track.kind}"><h3>${esc(v.track.name)}</h3><ul>${done}${next}${more}</ul></section>`;
    });
    return `<div class="stats-app seals"><p class="s-note">${esc(t.sealsHint)}</p>${tracks.join('')}</div>`;
  }

  private numbersHtml(): string {
    const t = uiText.statsApp;
    const v = this.session.stats();
    const avg = (n: number | null) => (n === null ? '–' : num(n));
    const tile = (value: string, label: string, title?: string) =>
      `<div class="s-tile"${title ? ` title="${esc(title)}"` : ''}><b>${value}</b><span>${esc(label)}</span></div>`;

    // Gráfico: um palito por dia fechado (dia fechado = listrado), da mesma altura máxima.
    const top = Math.max(1, ...v.chart.map((d) => d.served));
    const bars = v.chart
      .map((d) => {
        const h = Math.round((d.served / top) * 100);
        const title = t.chartDay.replace('{day}', String(d.day)).replace('{n}', String(d.served)) + (d.open ? '' : ` · ${t.closedDay}`);
        return `<span class="s-bar${d.open ? '' : ' closed'}" title="${esc(title)}"><i style="height:${d.open ? Math.max(h, d.served ? 6 : 2) : 100}%"></i></span>`;
      })
      .join('');
    const chart = v.chart.length ? `<div class="s-chart">${bars}</div><p class="s-note">${esc(t.chartHint)}</p>` : `<p class="s-note">${esc(t.noDays)}</p>`;

    const doses = v.weekDosesPerDay.slice(0, DOSES_SHOWN).map(({ itemId, perDay }) => {
      const item = content.items[itemId];
      return `<li><span class="s-item">${iconHtml(item?.icon)}${esc(item?.name ?? itemId)}</span><b>${esc(t.perDay.replace('{n}', num(perDay)))}</b></li>`;
    });

    const rep = content.reputation;
    const level = [...rep.thresholds].sort((a, b) => b.at - a.at).find((x) => v.reputation >= x.at);
    const streak = (id: StreakId) => {
      const s = v.streaks[id];
      const days = (n: number) => (n === 1 ? t.oneDay : t.days.replace('{n}', String(n)));
      return `<li title="${esc(t.streaks[id].hint)}"><strong>${esc(t.streaks[id].name)}</strong><span>${esc(t.streakNow)} <b>${esc(days(s.current))}</b> · ${esc(t.streakBest)} ${esc(days(s.best))}</span></li>`;
    };

    return `<div class="stats-app">
      <h3>${esc(t.customers)}</h3>
      <div class="s-tiles">
        ${tile(String(v.servedTotal), t.servedTotal)}
        ${tile(String(v.servedToday), t.servedToday)}
        ${tile(avg(v.weekServedPerDay), t.perOpenDay, t.weekHint.replace('{n}', String(v.weekOpenDays)))}
      </div>
      ${chart}
      <h3>${esc(t.consumption)}</h3>
      ${doses.length ? `<ul class="s-list">${doses.join('')}</ul>` : `<p class="s-note">${esc(t.noConsumption)}</p>`}
      <h3>${esc(t.cafe)}</h3>
      <div class="s-rep" title="${esc(uiText.reputation.title.replace('{value}', String(Math.round(v.reputation))).replace('{max}', String(rep.max)))}">
        <span class="s-rep-label">${esc(uiText.reputation.label)}${level ? ` · <i>${esc(level.name)}</i>` : ''}</span>
        <span class="bar"><span class="fill" style="width:${Math.round((v.reputation / rep.max) * 100)}%"></span></span><b>${Math.round(v.reputation)}</b>
      </div>
      <div class="s-tiles">
        ${tile(avg(v.weekEarnedPerDay), t.coinsPerDay, t.weekHint.replace('{n}', String(v.weekOpenDays)))}
        ${tile(String(v.openDaysTotal), t.openDays)}
        ${tile(String(v.gaveUpTotal), t.gaveUp)}
      </div>
      <h3>${esc(t.cats)}</h3>
      <div class="s-tiles two">
        ${tile(String(v.catsNow), t.catsNow)}
        ${tile(String(v.catsEver), t.catsEver)}
      </div>
      <h3>${esc(t.streaksTitle)}</h3>
      <ul class="s-streaks">${streak('no_gave_up')}${streak('cats_cared')}</ul>
    </div>`;
  }
}
