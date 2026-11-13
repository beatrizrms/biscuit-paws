// QA "jogar errado": brechas pontuais, cada uma reproduzida direto no núcleo. Imprime ABERTA (a brecha existe) ou
// fechada. Rodar depois de cada correção:  npx tsx scripts/qa/brechas.ts
import { festivalCanStart, startFestival } from '../../src/core/festival';
import { resolveMap } from '../../src/core/map';
import { GameSession } from '../../src/core/session';
import { newGameState, nowAbs, type GameState } from '../../src/core/state';
import { loadContent } from '../../tests/core/content';

const content = loadContent();
const beats = content.story.beats.map((b) => b.id);
const results: { id: string; open: boolean; detail: string }[] = [];
const report = (id: string, open: boolean, detail: string) => results.push({ id, open, detail });
const all = Array(7).fill(true);

/** Café funcionando (balcão, cafeteira, mesa, cadeira, café no quadro), às 9h. */
function cafe(): { s: GameSession; state: GameState } {
  const state = newGameState(500, 'map.cafe_main', 9 * 60);
  state.flags['has.cat'] = true;
  state.story.completed.push(...beats.slice(0, beats.indexOf('story.chairs') + 1));
  const s = new GameSession(content, state);
  const put = (item: string, at: [number, number]) => { s.buy(item); s.place(item, at); };
  put('item.counter_single', [4, 5]); put('item.counter_single', [7, 5]); put('item.coffee_machine', [7, 5]); put('item.table_round', [10, 8]); put('item.chair_front', [11, 8]);
  s.receiveItem('item.dishes_set'); s.buy('item.coffee_ground'); s.buy('item.paper_filter'); s.service.storeInPantry();
  s.service.toggleMenu('recipe.black_coffee');
  s.service.setSchedule({ days: all, open: '09:00', close: '22:00', lunch: null });
  return { s, state };
}
const advance = (s: GameSession, m: number) => { for (let i = 0; i < m; i++) s.tickClock(1 / content.dayNight.minutesPerSecond); };
const clock = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;

// 1. Almoço "empurrado": mudar o almoço para a meia hora atual de novo e de novo congela a paciência para sempre.
{
  const { s, state } = cafe();
  advance(s, 6);
  const c = state.service.customers.find((x) => x.stage === 'waiting');
  if (c) {
    for (let h = 0; h < 8; h++) {
      s.service.setSchedule({ days: all, open: '09:00', close: '22:00', lunch: clock(Math.floor(state.time / 30) * 30) });
      advance(s, 30);
    }
    const left = Math.round(c.until - nowAbs(state));
    report('almoço empurrado congela a paciência', state.service.customers.includes(c) && left >= content.service.patienceMinutes - 1, `4 h depois, o cliente ainda espera com ${left} min de paciência`);
  }
}

// 2. Fechar mais cedo esvazia a fila sem avaliação ruim (e dá para reabrir logo depois).
{
  const { s, state } = cafe();
  const chair = state.placed.find((p) => p.item === 'item.chair_front')!;
  s.pickUp(chair.uid); // só o lugar em pé: a fila se forma
  state.time = 15 * 60; // à tarde (o horário tem um mínimo de horas aberto)
  advance(s, 6);
  state.service.nextCustomerAt = 0;
  advance(s, 2);
  const queued = state.service.customers.filter((c) => c.stage === 'queue').length;
  const rep = s.reputation();
  const gaveUp = state.stats.totals.gaveUp;
  s.service.setSchedule({ days: all, open: '09:00', close: clock(Math.floor(state.time / 30) * 30), lunch: null });
  advance(s, 2);
  const after = state.service.customers.filter((c) => c.stage === 'queue').length;
  s.service.setSchedule({ days: all, open: '09:00', close: '22:00', lunch: null });
  const penalized = state.stats.totals.gaveUp > gaveUp;
  report('fechar e reabrir esvazia a fila sem nota ruim', queued > 0 && after === 0 && !penalized, `fila ${queued} -> ${after}; contaram como desistência: ${penalized}; reputação ${rep} -> ${s.reputation()}; reaberto: ${s.service.isOpen()}`);
}

// 3. Feira de adoção (sem data) marcada em cima das datas fixas.
{
  const fair = content.festivals.find((f) => f.id === 'fest.adoption_fair')!;
  const seasons = content.seasons;
  const hits: string[] = [];
  for (const [season, day, label] of [['winter', 18, 'sorteio do amigo secreto'], ['winter', 25, 'Natal'], ['winter', 30, 'Ano Novo'], ['autumn', 30, 'Halloween']] as const) {
    const start = day - fair.prep!.daysAfter;
    const daysUntil = (ss: string, d: number) => { const y = seasons.order.length * seasons.daysPerSeason; const at = seasons.order.indexOf(ss) * seasons.daysPerSeason + d; const now = seasons.order.indexOf(season) * seasons.daysPerSeason + start; return (((at - now) % y) + y) % y; };
    const st = { active: null, last: {}, held: {} } as never;
    const fx = content.festive;
    const fixedDates = [
      { season: fx.secretSanta.season, day: fx.secretSanta.drawDay }, { season: fx.secretSanta.season, day: fx.secretSanta.day },
      { season: fx.newYear.season, day: fx.newYear.day }, { season: fx.halloween.season, day: fx.halloween.inviteDay }, { season: fx.halloween.season, day: fx.halloween.day },
    ];
    const ctx = { day: 100, season, dayOfSeason: start, reached: ['rep.noticed'], evaluate: () => true, others: content.festivals, daysUntil, fixedDates };
    if (festivalCanStart(st, fair, ctx)) {
      startFestival(st, fair, ctx);
      hits.push(`${label} (${season} ${day})`);
    }
  }
  report('feira de adoção cai em data fixa', hits.length > 0, hits.join(', '));
}

// 4. A chegada do 2º gato espera para sempre (sem prazo nem meta), e sem 2º gato não vem mais nenhum.
{
  const state = newGameState(5000, 'map.cafe_main', 8 * 60);
  state.day = 5;
  Object.assign(state.flags, { 'has.cat': true, 'prologue.done': true, 'met.old_neighbor': true });
  state.business = 'inaugurated';
  state.story.completed.push(...beats.slice(0, beats.indexOf('story.inauguration') + 1));
  state.cats['cat.first_stray'] = { sheltered: true, name: 'Botinhas', map: 'map.cafe_main', shelteredOn: 1, health: 80, sickness: null } as GameState['cats'][string];
  const s = new GameSession(content, state);
  s.bus.on('script.requested', ({ scriptId }) => queueMicrotask(() => s.finishScript(scriptId)));
  s.bus.on('cutscene.requested', ({ cutsceneId }) => queueMicrotask(() => s.finishCutscene(cutsceneId)));
  s.start(false);
  await (async () => {
    for (let d = 0; d < 40; d++) {
      const day = state.day;
      for (let g = 0; state.day === day && g < 300; g++) { s.tickClock(25); await Promise.resolve(); }
    }
  })();
  const active = state.arrivals.active;
  const stale = !!active && state.day - active.startedOn > (content.arrivals.expire?.days ?? Infinity);
  report('chegada parada para sempre trava as próximas', !!active && (stale || !content.arrivals.expire), `dia ${state.day}: chegada ${active?.id ?? '-'} desde o dia ${active?.startedOn ?? '-'} (etapa ${active?.step ?? '-'}); gatos: ${s.shelteredCats().length}; metas no balão: ${s.goals().length}`);
}

// 5. Fechar a entrada do café por dentro (três móveis em volta da célula de chegada).
{
  const s = new GameSession(content, newGameState(5000, 'map.cafe_main', 10 * 60));
  const put = (it: string, at: [number, number]) => { s.receiveItem(it); return s.place(it, at).ok; };
  // A linha da porta (10) também é chão: para prender, é preciso fechar ela dos dois lados e as três vizinhas.
  const cells: [number, number][] = [[12, 10], [16, 10], [13, 9], [15, 9], [14, 8]];
  const placed = cells.map((at) => put('item.counter_single', at));
  const m = resolveMap(s.mapData('map.cafe_main'), content.catalog);
  const sealed = cells.every(([c, r]) => m.solid[r]?.[c]);
  report('dá para fechar a entrada do café por dentro', placed.every(Boolean) && sealed, `balcões em ${cells.map((c) => `[${c}]`).join(' ')}: ${placed.map((ok) => (ok ? 'aceito' : 'recusado')).join(', ')}`);
}

// 6. Presente vira dinheiro: devolver dá 100% do preço, inclusive do que veio de graça.
{
  const s = new GameSession(content, newGameState(0, 'map.cafe_main', 10 * 60));
  s.receiveItem('item.paw_rug'); // presente de selo (Ninguém espera)
  const r = s.refund('item.paw_rug');
  report('presente de selo vira moedas na devolução', r.ok && s.state.money > 0, `tapete de patinhas recebido de presente devolvido por ${s.state.money} moedas (refundRate ${content.economy.refundRate})`);
}

// 7. Gato abandonado: doente e sem comer o ano todo, sem consequência além de corações.
{
  const state = newGameState(5000, 'map.cafe_main', 8 * 60);
  Object.assign(state.flags, { 'has.cat': true, 'prologue.done': true });
  state.story.completed.push(...beats);
  state.cats['cat.first_stray'] = { sheltered: true, name: 'Botinhas', map: 'map.cafe_main', shelteredOn: 1, health: 80, sickness: null } as GameState['cats'][string];
  const s = new GameSession(content, state);
  for (let d = 0; d < 60; d++) s.endDay('home');
  const cat = state.cats['cat.first_stray']!;
  report('gato largado não tem consequência', cat.sheltered && s.shelteredCats().includes('cat.first_stray'), `60 dias sem comida nem remédio: saúde ${cat.health}, doença ${cat.sickness ? 'sim' : 'não'}, continua no café`);
}

for (const r of results) console.log(`${r.open ? 'ABERTA ' : 'fechada'}  ${r.id}: ${r.detail}`);
