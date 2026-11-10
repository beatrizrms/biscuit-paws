// App "Café em números" do celular: o raio X do café (session.stats, src/core/stats.ts). Clientes (total, hoje, média
// da semana e o gráfico dos últimos 14 dias), consumo de ingredientes por dia, reputação e moedas, gatos e as
// sequências de bom comportamento. Só desenha: as contas são do núcleo.
import type { GameSession } from '../../core/session';
import type { StreakId } from '../../core/stats';
import { content, uiText } from '../content';
import { iconHtml } from './ShopPanel';

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
/** 9,3 (uma casa, só quando precisa). */
const num = (n: number) => n.toLocaleString('pt-BR', { maximumFractionDigits: 1 });
/** Quantos ingredientes a lista de consumo mostra. */
const DOSES_SHOWN = 6;

export class StatsApp {
  constructor(private session: GameSession) {}

  render(body: HTMLElement): void {
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

    body.innerHTML = `<div class="stats-app">
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
