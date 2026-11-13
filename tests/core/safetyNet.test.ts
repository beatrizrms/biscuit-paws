// Rede de proteção (docs/REVISAO_CONFLITOS.md, fase 5): o save com móveis em conflito abre (eles voltam para a
// mochila), e um mês de dias caóticos (evento, chegada, entrega, obra, chuva e plateia juntos) não trava nem quebra o mapa.
import { describe, expect, it } from 'vitest';
import { resolveMap, validateMap } from '../../src/core/map';
import { GameSession } from '../../src/core/session';
import { newGameState, type GameState } from '../../src/core/state';
import { loadContent } from './content';

const content = loadContent();
// Todos os mapas (café, rua, praça, beco, mercado, clínica e os dos minigames).
const MAPS = Object.keys(content.maps);

function midGame(day = 40): GameState {
  const state = newGameState(100000, 'map.cafe_main', 10 * 60);
  state.day = day;
  state.business = 'soft_open';
  state.story.completed.push(...content.story.beats.map((b) => b.id));
  for (const r of content.rooms.rooms) state.rooms[r.id] = 'restored';
  state.construction.repaired.push('inside', 'outside');
  if (content.painterUnlockFlag) state.flags[content.painterUnlockFlag] = true;
  return state;
}

describe('save com móveis em conflito', () => {
  it('um em cima do outro e um fora do mapa: voltam para a mochila, avisando, e o café abre', () => {
    const state = midGame();
    const first = new GameSession(content, state);
    state.inventory['item.chair_front'] = 2;
    const spot = [6, 9] as [number, number];
    expect(first.place('item.chair_front', spot).ok).toBe(true);
    // O save "quebrado": a segunda cadeira no mesmo lugar e outra fora do mapa (save de uma versão com o mapa maior).
    state.placed.push({ uid: 'dup', item: 'item.chair_front', at: [...spot] }, { uid: 'out', item: 'item.chair_front', at: [500, 3] });
    expect(validateMap(first.mapData(), content.catalog).some((e) => e.includes('"placed.dup"'))).toBe(true);
    const before = state.inventory['item.chair_front'] ?? 0;

    const session = new GameSession(content, state);
    const repaired: string[][] = [];
    session.bus.on('save.repaired', ({ itemIds }) => repaired.push(itemIds));
    session.start(false);
    expect(() => resolveMap(session.mapData(), content.catalog)).not.toThrow();
    expect(state.placed.map((p) => p.uid)).not.toContain('dup');
    expect(state.placed.map((p) => p.uid)).not.toContain('out');
    expect(state.placed.some((p) => p.item === 'item.chair_front' && p.at[0] === spot[0] && p.at[1] === spot[1])).toBe(true); // a primeira fica
    expect(state.inventory['item.chair_front']).toBe(before + 2);
    expect(repaired).toEqual([['item.chair_front', 'item.chair_front']]);
  });

  it('save sem conflito: nada muda e não avisa', () => {
    const state = midGame();
    const session = new GameSession(content, state);
    const placed = state.placed.length;
    let warned = false;
    session.bus.on('save.repaired', () => (warned = true));
    session.start(false);
    expect(state.placed.length).toBe(placed);
    expect(warned).toBe(false);
  });
});

describe('dia caótico', () => {
  it('30 dias com evento no quintal, gato novo, entregas, obra, chuva e plateia ao mesmo tempo: nada trava e todo mapa abre', async () => {
    const state = midGame(30);
    const session = new GameSession(content, state);
    // As cenas terminam na hora (no jogo, a jogadora assiste e o relógio espera).
    session.bus.on('script.requested', ({ scriptId }) => queueMicrotask(() => session.finishScript(scriptId)));
    session.bus.on('cutscene.requested', ({ cutsceneId }) => queueMicrotask(() => session.finishCutscene(cutsceneId)));
    session.start(false);
    session.arrivals.debug.weather = 'rain';
    const personalities = Object.keys(content.catProfiles.personalities);
    const festivals = ['fest.cat_day', 'fest.adoption_fair'].map((id) => content.festivals.find((f) => f.id === id)!).filter(Boolean);
    expect(festivals.length).toBe(2);
    const minutesPerStep = 45;
    const step = minutesPerStep / content.dayNight.minutesPerSecond;
    let crowdSeen = 0;
    let built = false;

    for (let d = 0; d < 30; d++) {
      const today = state.day;
      const where = `dia ${today} (${d + 1}º do teste)`;
      // Gato novo a cada 3 dias (pela vaga, como uma chegada aceita).
      if (d % 3 === 0) session.arrivals.debugGenerate(personalities[d % personalities.length]!, d % 2 ? 'cold' : 'healthy');
      // Encomenda todo dia: as caixas se acumulam na porta se ninguém busca.
      session.addToOrder('item.chair_front');
      session.checkoutOrder();
      // Obra no piso do salão, uma vez (o construtor trabalha alguns dias no café).
      if (!built && !state.construction.job && !state.construction.quote) {
        const r = session.quoteFinish('surface.hall_floor', 'finish.check_pink', [6, 6], [12, 10]);
        expect(r, where).toEqual({ ok: true });
        built = session.answerQuote(true).ok;
      }
      // Evento no quintal a cada 5 dias, montado de manhã (placa e enfeites), com a plateia.
      if (d % 5 === 1) {
        const def = festivals[(d / 5) % 2 | 0]!;
        session.debugStartFestival(def.id);
        if (state.festivals.active) {
          state.festivals.active.day = today;
          state.time = Math.max(state.time, 10 * 60);
          for (const id of [def.closePoint?.point, ...(def.decorations ?? []).map((x) => x.point)]) if (id) session.doJobPoint(id);
        }
      }
      // O dia corre até ela ir para casa (a hora-limite), conferindo os mapas e a plateia a cada passo.
      for (let guard = 0; state.day === today; guard++) {
        expect(guard, `${where}: o dia não terminou`).toBeLessThan(200);
        for (const id of MAPS) {
          const errors = validateMap(session.mapData(id), content.catalog);
          expect(errors, `${where} ${state.time}min: ${id}`).toEqual([]);
        }
        if (session.festivalCrowd(content.map.id)) crowdSeen++;
        session.tickClock(step);
        await Promise.resolve();
      }
      // Evento não fica pendurado de um dia para o outro.
      if (state.festivals.active) expect(state.festivals.active.day, `${where}: evento de dia passado ainda ativo`).toBeGreaterThanOrEqual(state.day);
    }
    expect(built).toBe(true);
    expect(crowdSeen).toBeGreaterThan(0);
    expect(state.deliveries.length).toBeGreaterThan(0); // caixas na porta (até o limite dela), ninguém buscou
  });
});
