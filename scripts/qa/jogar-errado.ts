// QA "jogar errado": joga um ano inteiro (120 dias) com perfis de jogadora que fogem do caminho esperado e
// registra, dia a dia, o que o jogo mostra e cobra: cenas e roteiros, eventos (festas, Natal, Ano Novo, Halloween),
// chegadas de gatos, metas do balão e pedidos da vila. No fim, aponta dias com eventos grandes juntos, trechos sem
// nada para fazer (sem meta nem pedido novo) e metas que não andam.
//   npx tsx scripts/qa/jogar-errado.ts [perfil] [dias]
// Perfis: parada (jogo novo, não faz nada), largada (meio do jogo, abandona o café), completa (tudo liberado, só vive os dias).
// Saída: test-results/qa/<perfil>.json (fora do Git) e o resumo no terminal.
import { mkdirSync, writeFileSync } from 'node:fs';
import { GameSession } from '../../src/core/session';
import { newGameState, type GameState } from '../../src/core/state';
import { seasonOf, dayInSeason } from '../../src/core/calendar';
import { loadContent } from '../../tests/core/content';

const content = loadContent();
const [profile = 'completa', daysArg = '120'] = process.argv.slice(2);
const DAYS = Number(daysArg);

/** Eventos que puxam a atenção da jogadora (uma cena, um evento do calendário, um gato chegando). */
const BIG = new Set([
  'script.requested', 'cutscene.requested', 'festival.started', 'festival.scheduled', 'festival.missed', 'event.starting',
  'xmas.day', 'xmas.santa_drawn', 'xmas.santa_missed', 'newyear.eve', 'newyear.started', 'newyear.missed',
  'halloween.invited', 'halloween.day', 'halloween.missed', 'arrival.started', 'arrival.queued', 'room.discovered',
  'construction.call', 'clinic.complication', 'ced.started', 'story.beat_completed', 'milestone.reached', 'cat.sick',
  'customers.away', 'cat.neglected', 'litter.pooped', 'delivery.dropped',
]);

function startState(): GameState {
  if (profile === 'parada') return newGameState(150, 'map.street', 7 * 60);
  const state = newGameState(5000, 'map.cafe_main', 8 * 60);
  state.day = profile === 'largada' ? 5 : 1;
  if (profile === 'largada') state.flags['met.old_neighbor'] = true;
  state.flags['has.cat'] = true;
  state.flags['prologue.done'] = true;
  state.business = 'inaugurated';
  if (profile === 'completa') {
    state.story.completed.push(...content.story.beats.map((b) => b.id));
    for (const r of content.rooms.rooms) state.rooms[r.id] = 'restored';
  } else {
    // Meio do jogo: a história até a inauguração.
    const beats = content.story.beats.map((b) => b.id);
    state.story.completed.push(...beats.slice(0, beats.indexOf('story.inauguration') + 1));
  }
  state.cats['cat.first_stray'] = { sheltered: true, name: 'Botinhas', map: 'map.cafe_main', shelteredOn: 1, health: 80, sickness: null } as GameState['cats'][string];
  return state;
}

type DayLog = { day: number; season: string; dayInSeason: number; big: string[]; goals: string[]; jobs: string[]; chores: string[]; money: number; reputation: number; cats: number; sick: number };

async function main(): Promise<void> {
  const state = startState();
  const session = new GameSession(content, state);
  // As cenas terminam na hora (no jogo, ela assiste).
  session.bus.on('script.requested', ({ scriptId }) => queueMicrotask(() => session.finishScript(scriptId)));
  session.bus.on('cutscene.requested', ({ cutsceneId }) => queueMicrotask(() => session.finishCutscene(cutsceneId)));
  let today: string[] = [];
  session.bus.onAny((name, payload) => {
    if (!BIG.has(name)) return;
    const p = payload as Record<string, unknown>;
    const id = p.scriptId ?? p.cutsceneId ?? p.festivalId ?? p.beatId ?? p.milestoneId ?? p.roomId ?? p.catId ?? p.modelId ?? '';
    today.push(`${name}${id ? `:${String(id)}` : ''}`);
  });
  session.start(false);
  const step = 30 / content.dayNight.minutesPerSecond;
  const log: DayLog[] = [];
  for (let d = 0; d < DAYS; d++) {
    const day = state.day;
    // O dia corre sozinho até a hora-limite (ela não faz nada além de existir).
    for (let guard = 0; state.day === day && guard < 300; guard++) {
      session.tickClock(step);
      await Promise.resolve();
    }
    if (state.day === day) {
      today.push('TRAVOU: o dia não terminou sozinho');
      session.endDay('home');
    }
    const goals = session.goals().map((g) => `${g.beatId}: ${g.steps.filter((s) => !s.done).map((s) => s.text).join(' / ')}`);
    log.push({
      day,
      season: seasonOf(content.seasons, day),
      dayInSeason: dayInSeason(content.seasons, day),
      big: today,
      goals,
      jobs: session.availableJobs().map((j) => j.id),
      chores: session.chores().filter((c) => !c.done).map((c) => c.kind + (c.catId ? `:${c.catId}` : '')),
      money: state.money,
      reputation: Math.round(session.reputation()),
      cats: session.shelteredCats().length,
      sick: session.sickCats().length,
    });
    today = [];
  }
  mkdirSync('test-results/qa', { recursive: true });
  writeFileSync(`test-results/qa/${profile}.json`, JSON.stringify(log, null, 1));

  // ---- Resumo ----
  const scenes = (l: DayLog) => l.big.filter((b) => /^(script|cutscene|festival\.started|xmas\.day|newyear\.started|halloween\.day|arrival\.started|event\.starting)/.test(b));
  console.log(`\n== ${profile}: ${DAYS} dias a partir do dia ${log[0]?.day} ==`);
  console.log('\nDias com 2+ momentos grandes (cena/evento/chegada) juntos:');
  for (const l of log) if (scenes(l).length >= 2) console.log(`  dia ${l.day} (${l.season} ${l.dayInSeason}): ${scenes(l).join(', ')}`);
  console.log('\nTrechos de 5+ dias sem nenhum momento grande e sem meta:');
  let run: DayLog[] = [];
  const flush = () => {
    if (run.length >= 5) console.log(`  dias ${run[0]!.day}-${run[run.length - 1]!.day} (${run[0]!.season} ${run[0]!.dayInSeason} a ${run[run.length - 1]!.dayInSeason}): ${run.length} dias; pedidos: ${[...new Set(run.flatMap((r) => r.jobs))].join(', ') || 'nenhum'}`);
    run = [];
  };
  for (const l of log) (scenes(l).length === 0 && l.goals.length === 0 ? run.push(l) : flush());
  flush();
  console.log('\nMetas que ficaram paradas 10+ dias seguidos:');
  const since = new Map<string, number>();
  for (const l of log) {
    for (const g of l.goals) since.set(g, (since.get(g) ?? 0) + 1);
    for (const g of [...since.keys()]) if (!l.goals.includes(g)) since.delete(g);
  }
  for (const [g, n] of since) if (n >= 10) console.log(`  ${n} dias: ${g}`);
  const last = log[log.length - 1]!;
  console.log(`\nFim: dia ${last.day}, moedas ${last.money}, reputação ${last.reputation}, gatos ${last.cats} (doentes ${last.sick}); tarefas abertas: ${last.chores.join(', ') || 'nenhuma'}`);
  const stuck = log.filter((l) => l.big.some((b) => b.startsWith('TRAVOU')));
  if (stuck.length) console.log(`\nTRAVOU em ${stuck.length} dia(s): ${stuck.map((l) => l.day).join(', ')}`);
  console.log(`\nLog completo: test-results/qa/${profile}.json`);
}

void main();
