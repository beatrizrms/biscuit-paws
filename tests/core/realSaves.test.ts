// Saves reais e pontos críticos do calendário (docs/REVISAO_CONFLITOS.md, fase 4): carregar, deixar os dias correrem
// (as cenas terminam na hora), virar a estação e conferir todos os mapas. Falha com "Mapa inválido", erro ou dia travado.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { firstDayOf } from '../../src/core/calendar';
import { validateMap } from '../../src/core/map';
import { knownIds, parseSave } from '../../src/core/save';
import { GameSession } from '../../src/core/session';
import { newGameState, type GameState } from '../../src/core/state';
import { loadContent } from './content';

const content = loadContent();
const known = knownIds(content);
// Todos os mapas (café, rua, praça, beco, mercado, clínica e os dos minigames).
const MAPS = Object.keys(content.maps);
const DAYS = Number(process.env.SWEEP_DAYS ?? 4);

/** Carrega como o jogo: sessão nova sobre o estado, cenas terminando na hora. */
function boot(state: GameState): GameSession {
  const session = new GameSession(content, state);
  session.bus.on('script.requested', ({ scriptId }) => queueMicrotask(() => session.finishScript(scriptId)));
  session.bus.on('cutscene.requested', ({ cutsceneId }) => queueMicrotask(() => session.finishCutscene(cutsceneId)));
  session.start(false);
  return session;
}

/** Os mapas abrem (cada um, como o jogo os monta agora) e a plateia do evento, se houver, cabe. */
function checkMaps(session: GameSession, where: string): void {
  for (const id of MAPS) expect(validateMap(session.mapData(id), content.catalog), `${where}: ${id}`).toEqual([]);
  expect(() => session.festivalCrowd(content.map.id), where).not.toThrow();
}

/** Deixa `days` dias correrem até a hora-limite, conferindo os mapas a cada 90 minutos de jogo. */
async function runDays(session: GameSession, days: number, label: string): Promise<void> {
  const state = session.state;
  const step = 90 / content.dayNight.minutesPerSecond;
  const start = state.day;
  for (let d = 0; d < days; d++) {
    const today = state.day;
    for (let guard = 0; state.day === today; guard++) {
      expect(guard, `${label} dia ${today}: o dia não terminou`).toBeLessThan(60);
      checkMaps(session, `${label} dia ${today} ${Math.floor(state.time / 60)}h`);
      session.tickClock(step);
      await Promise.resolve();
    }
    if (state.festivals.active) expect(state.festivals.active.day, `${label} dia ${state.day}: evento de dia passado`).toBeGreaterThanOrEqual(state.day);
  }
  expect(state.day, label).toBe(start + days);
  if (process.env.SWEEP_DAYS) console.log(label, 'chegou ao dia', state.day);
}

describe('saves reais da Bi', () => {
  for (const file of ['save_real_dia154.json', 'save_real_dia155.json']) {
    it(`${file}: carrega, os dias correm e todas as estações abrem`, async () => {
      const { state } = parseSave(readFileSync(`tests/fixtures/${file}`, 'utf8'), known);
      const session = boot(state);
      checkMaps(session, `${file} ao carregar`);
      await runDays(session, DAYS, file);
      for (const season of content.seasons.order) {
        session.debugGoToSeason(season);
        checkMaps(session, `${file} em ${season}`);
        await runDays(session, 1, `${file} ${season}`);
      }
    }, 120_000);
  }
});

describe('pontos críticos do calendário', () => {
  const seasons = content.seasons;
  const per = seasons.daysPerSeason;
  const catDay = content.festivals.find((f) => f.id === 'fest.cat_day')!;
  const points: [string, number][] = [
    ['véspera do Dia do Gato', firstDayOf(seasons, catDay.date!.season) + catDay.date!.day - 2],
    ['véspera de Natal', firstDayOf(seasons, content.festive.secretSanta.season) + content.festive.secretSanta.day - 2],
    ...seasons.order.map((s, i): [string, number] => [`último dia do ${s}`, (i + 1) * per]),
    ['véspera de Ano Novo do 2º ano', seasons.order.length * per * 2 - 1],
  ];
  for (const [label, day] of points) {
    it(`${label} (dia ${day}): o café cheio de gatos e móveis passa para o dia seguinte`, async () => {
      const state = newGameState(5000, 'map.cafe_main', 8 * 60);
      state.day = day;
      state.business = 'soft_open';
      state.story.completed.push(...content.story.beats.map((b) => b.id));
      for (const r of content.rooms.rooms) state.rooms[r.id] = 'restored';
      const session = boot(state);
      session.debugSatisfy({ cats: { gte: 12 } } as never);
      // Quintal mobiliado (o que couber, em lugares válidos).
      const yardItems = Object.values(content.items).filter((i) => (i.tile ?? '').startsWith('yard_') && (i.kind ?? 'furniture') === 'furniture');
      for (let r = 2; r <= 10; r += 2) for (let c = 26; c <= 43; c += 3) {
        const item = yardItems[(r + c) % yardItems.length]!;
        state.inventory[item.id] = (state.inventory[item.id] ?? 0) + 1;
        session.place(item.id, [c, r]);
      }
      checkMaps(session, label);
      await runDays(session, 3, label);
    }, 60_000);
  }
});
