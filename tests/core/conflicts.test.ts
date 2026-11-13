// Revisão de conflitos (docs/REVISAO_CONFLITOS.md): sistemas que disparam no mesmo dia ou na mesma hora. Cada teste
// força um par de situações juntas e confere que nada trava, o mapa abre e a ordem faz sentido.
import { describe, expect, it } from 'vitest';
import { resolveMap } from '../../src/core/map';
import { GameSession } from '../../src/core/session';
import { newGameState, type GameState } from '../../src/core/state';
import { activeBeats } from '../../src/core/story';
import { loadContent } from './content';

const content = loadContent();

/** Um café já inaugurado, com os cômodos prontos; `skip`: passos da história que ainda não aconteceram. */
function midGame(skip: string[] = [], day = 40): { session: GameSession; state: GameState; events: { name: string; payload: unknown }[] } {
  const state = newGameState(500, 'map.cafe_main', 10 * 60);
  state.day = day;
  state.business = 'soft_open';
  state.story.completed.push(...content.story.beats.map((b) => b.id).filter((id) => !skip.includes(id)));
  for (const r of content.rooms.rooms) state.rooms[r.id] = 'restored';
  const session = new GameSession(content, state);
  const events: { name: string; payload: unknown }[] = [];
  session.bus.onAny((name, payload) => events.push({ name, payload }));
  return { session, state, events };
}

describe('passos exclusivos da história', () => {
  it('um passo exclusivo que ainda espera a condição (dia da feira, 30 dias, a chave) não segura o resto do jogo', () => {
    // Os passos exclusivos que esperam muito tempo: o resto (chegadas, cenas da Fernanda, a CED) não pode ficar parado.
    for (const id of ['story.jacque_meet', 'story.secret_garden']) {
      const { session, state } = midGame([id]);
      state.story.completedOn['story.back_room_opened'] = state.day; // a chave do jardim ainda longe
      const active = activeBeats(content.story, state, (session as unknown as { storyContext(): never }).storyContext());
      expect(active.map((b) => b.id), id).not.toContain(id);
      expect(session.exclusiveActive(), id).toBe(false);
    }
  });

  it('entre a inauguração e a primeira feira (a Jacque ainda por conhecer), gato novo chega', () => {
    const { session, state } = midGame(['story.jacque_meet']);
    expect((session as unknown as { arrivals: { queueNow(id: string): boolean } }).arrivals.queueNow('arr.third_cat')).toBe(true);
    expect(state.arrivals.active?.id).toBe('arr.third_cat');
  });
});

describe('o jardim vem antes dos eventos', () => {
  it('o desbloqueio do jardim não depende de evento; nenhum evento começa antes do jardim desbloqueado e reformado', () => {
    // O desbloqueio (a cena do jardim secreto) só pede o tempo depois do quarto dos fundos e a chave.
    const garden = content.story.beats.find((b) => b.id === 'story.secret_garden')!;
    expect(JSON.stringify([garden.start, garden.when, garden.after])).not.toMatch(/fest/);
    // Cada evento pede o quintal reformado.
    for (const f of content.festivals) expect(JSON.stringify(f.when), f.id).toContain('"room":"room.backyard","atLeast":"restored"');
    // Tudo pronto para a feira, menos o quintal: ela não começa; com o quintal reformado, começa.
    const g = midGame([], 0);
    const fair = content.festivals.find((f) => f.id === 'fest.adoption_fair')!;
    g.state.day = 70;
    (g.session as unknown as { debugSatisfy(c: unknown): void }).debugSatisfy(fair.when);
    g.state.festivals.active = null;
    g.state.rooms['room.backyard'] = 'abandoned';
    g.session.enter('map.cafe_main');
    expect(g.state.festivals.active).toBeNull();
    g.state.rooms['room.backyard'] = 'restored';
    g.session.enter('map.cafe_main');
    expect((g.state.festivals.active as { id: string } | null)?.id).toBe('fest.adoption_fair');
  });
});

describe('eventos com e sem data', () => {
  type Debug = { debugSatisfy(c: unknown): void; addReputation(n: number, why: string): void; enter(map: string): void };
  /** A feira de adoção e o Dia do Gato liberados, no verão, no dia dayOfSummer. */
  function bothReady(dayOfSummer: number) {
    const g = midGame([], 0);
    const fair = content.festivals.find((f) => f.id === 'fest.adoption_fair')!;
    const per = content.seasons.daysPerSeason;
    g.state.day = content.seasons.order.indexOf('summer') * per + 1;
    (g.session as unknown as Debug).debugSatisfy(fair.when);
    const need = content.reputation.thresholds.find((t) => t.id === 'rep.noticed')!.at;
    g.session.addReputation(need, 'teste');
    g.state.festivals.active = null;
    g.state.day = content.seasons.order.indexOf('summer') * per + dayOfSummer;
    g.session.enter('map.cafe_main');
    return g;
  }

  it('a feira de adoção não começa os panfletos quando o Dia do Gato vem antes de ela acontecer (o Dia do Gato não se perde)', () => {
    expect(bothReady(2).state.festivals.active).toBeNull();
    expect(bothReady(5).state.festivals.active?.id).toBe('fest.cat_day');
  });

  it('longe da data, a feira de adoção começa normalmente', () => {
    expect(bothReady(20).state.festivals.active?.id).toBe('fest.adoption_fair');
  });
});

describe('plateia × festas', () => {
  it('em dia de festa (ceia de Natal) os amigos ficam fora da plateia (estão na festa)', () => {
    const { session, state } = midGame();
    const catDay = content.festivals.find((f) => f.id === 'fest.cat_day')!;
    for (const flag of ['seen.scr.gabi_visit', 'met.old_neighbor', 'met.jacque']) state.flags[flag] = true;
    session.debugStartFestival(catDay.id);
    state.day = state.festivals.active!.day!;
    state.time = 11 * 60;
    for (const id of [catDay.closePoint!.point, ...catDay.decorations!.map((d) => d.point)]) expect(session.doJobPoint(id)).toEqual({ ok: true });
    const people = (l: ReturnType<GameSession['festivalCrowd']>) => [...l!.groups.flat().map((m) => m.npc), ...l!.walkers.map((w) => w.npc)];
    expect(people(session.festivalCrowd())).toEqual(expect.arrayContaining(['npc.gabi', 'npc.neusa', 'npc.jacque']));
    // O mesmo dia, sendo dia de ceia: sem os amigos.
    (session as unknown as { crowdOfDay: null }).crowdOfDay = null;
    (session as unknown as { santaPartyPending: () => boolean }).santaPartyPending = () => true;
    const party = people(session.festivalCrowd());
    for (const id of ['npc.gabi', 'npc.neusa', 'npc.jacque']) expect(party).not.toContain(id);
  });
});

describe('passeios × plateia', () => {
  it('quem está na plateia do evento não sai passeando (não fica em dois lugares)', () => {
    const { session, state } = midGame();
    state.flags['met.jacque'] = true;
    const jacque = content.npcWalks.find((w) => w.npc === 'npc.jacque')!;
    state.time = 17 * 60;
    const stub = session as unknown as { festivalCrowd: () => unknown };
    // Um dia em que ela passeia (sem plateia)...
    stub.festivalCrowd = () => null;
    let day = 1;
    for (; day < 60; day++) {
      state.day = day;
      if (session.neighborWalksNow(jacque.map).some((w) => w.npc === 'npc.jacque')) break;
    }
    expect(day).toBeLessThan(60);
    // ...e o mesmo dia com ela na plateia do quintal: não passeia.
    stub.festivalCrowd = () => ({ groups: [[{ npc: 'npc.jacque', at: [30, 5], facing: 'right' }, { npc: 'npc.customer_01', at: [31, 5], facing: 'left' }]], walkers: [] });
    expect(session.neighborWalksNow(jacque.map).map((w) => w.npc)).not.toContain('npc.jacque');
  });
});

describe('horários das visitas', () => {
  const scripts = (events: { name: string; payload: unknown }[]) => events.filter((e) => e.name === 'script.requested').map((e) => (e.payload as { scriptId: string }).scriptId);

  it('a Dona Neusa não aparece de madrugada: cafeteira montada à noite, a visita fica para a manhã', () => {
    const { session, state, events } = midGame(['story.neusa_visit']);
    state.time = 23 * 60;
    session.enter('map.cafe_main');
    expect(scripts(events)).not.toContain('scr.neusa_visit');
    state.time = 9 * 60;
    session.enter('map.cafe_main');
    expect(scripts(events)).toContain('scr.neusa_visit');
    expect(state.flags['met.old_neighbor']).toBe(true);
  });

  it('save que já teve a visita da Dona Neusa: o passo novo nunca fica ativo nem segura nada', () => {
    const { session, state, events } = midGame(['story.neusa_visit']);
    state.flags['met.old_neighbor'] = true;
    state.time = 9 * 60;
    session.enter('map.cafe_main');
    expect(scripts(events)).not.toContain('scr.neusa_visit');
    expect(session.exclusiveActive()).toBe(false);
  });
});

describe('dia de evento no quintal', () => {
  it('não chove (o clima do jogo e o das chegadas de gato)', async () => {
    const { weatherOf } = await import('../../src/core/calendar');
    const { session, state } = midGame();
    let day = 1;
    while (weatherOf(content.seasons, day) !== 'rain') day++;
    state.day = day;
    expect(session.weather()).toBe('rain');
    session.debugStartFestival('fest.cat_day');
    state.festivals.active!.day = day;
    expect(session.weather()).not.toBe('rain');
  });

  it('até as 20h: lembrete às 19h; deu 20h sem acabar, o evento é perdido', () => {
    const { session, state, events } = midGame();
    const catDay = content.festivals.find((f) => f.id === 'fest.cat_day')!;
    expect(catDay.until).toBe('20:00');
    session.debugStartFestival(catDay.id);
    state.day = state.festivals.active!.day!;
    state.time = 10 * 60;
    expect(session.doJobPoint(catDay.closePoint!.point)).toEqual({ ok: true });
    state.time = 19 * 60 - 1;
    session.tickClock(2 / content.dayNight.minutesPerSecond);
    expect(events.some((e) => e.name === 'festival.endSoon')).toBe(true);
    state.time = 20 * 60 - 1;
    session.tickClock(2 / content.dayNight.minutesPerSecond);
    expect(events.find((e) => e.name === 'festival.missed')?.payload).toMatchObject({ festivalId: catDay.id, evening: true });
    expect(state.festivals.active).toBeNull();
  });

  it('a decoração tem as luzes (acendem à noite)', () => {
    const lights = Object.keys(content.dayNight.lightTiles ?? {});
    for (const f of content.festivals) expect((f.decorations ?? []).filter((d) => lights.includes(d.tile)).length, f.id).toBeGreaterThanOrEqual(2);
  });
});

describe('feira com o dia marcado na ideia', () => {
  it('o dia fica no calendário desde a ideia; sem os panfletos, ninguém vem e dá para planejar outra daqui retryDays dias', () => {
    const { session, state, events } = midGame();
    const fair = content.festivals.find((f) => f.id === 'fest.adoption_fair')!;
    session.debugStartFestival(fair.id);
    const start = state.day;
    expect(state.festivals.active).toMatchObject({ stage: 'prep', day: start + fair.prep!.daysAfter });
    expect(session.calendar(start, start + 10).some((c) => c.id === 'cal.' + fair.id)).toBe(true);
    // Só um panfleto e o dia chega.
    session.doJobPoint(fair.prep!.points[0]!);
    for (let d = 0; d < fair.prep!.daysAfter; d++) session.endDay('home');
    expect(state.festivals.active).toBeNull();
    expect(events.find((e) => e.name === 'festival.noPrep')?.payload).toEqual({ festivalId: fair.id, retryIn: fair.prep!.retryDays });
    // Dá para começar de novo depois de retryDays (não no intervalo inteiro de 30 dias).
    const ctxDay = state.day + fair.prep!.retryDays!;
    expect(ctxDay - state.festivals.last[fair.id]!).toBeGreaterThanOrEqual(fair.cooldownDays);
  });

  it('com os panfletos feitos, a feira acontece no dia marcado na ideia (não depois)', () => {
    const { session, state } = midGame();
    const fair = content.festivals.find((f) => f.id === 'fest.adoption_fair')!;
    session.debugStartFestival(fair.id);
    const day = state.festivals.active!.day!;
    session.endDay('home');
    for (const id of fair.prep!.points) expect(session.doJobPoint(id)).toEqual({ ok: true });
    expect(state.festivals.active).toMatchObject({ stage: 'scheduled', day });
  });

  it('em dia de evento no quintal, gato novo não chega (espera o dia seguinte)', () => {
    const { session, state } = midGame();
    session.debugStartFestival('fest.cat_day');
    const arrivals = (session as unknown as { arrivals: { queueNow(id: string): boolean } }).arrivals;
    arrivals.queueNow('arr.third_cat');
    expect(state.arrivals.active).toBeNull();
  });
});

describe('o mapa sempre abre', () => {
  it('café, rua, praça e beco, em cada estação', () => {
    const { session, state } = midGame();
    for (let s = 0; s < content.seasons.order.length; s++) {
      state.day = s * content.seasons.daysPerSeason + 5;
      for (const id of ['map.cafe_main', 'map.street', 'map.praca', 'map.alley']) expect(() => resolveMap(session.mapData(id), content.catalog), `${id} estação ${s}`).not.toThrow();
    }
  });

  it('quintal cheio de móveis dela: em cada estação, em dia de evento montado, com plateia e neve, o mapa abre', () => {
    const { session, state } = midGame();
    const yardItems = Object.values(content.items).filter((i) => (i.tile ?? '').startsWith('yard_') && (i.kind ?? 'furniture') === 'furniture');
    expect(yardItems.length).toBeGreaterThan(5);
    // Põe o que couber, varrendo o quintal (só lugares válidos, como ela faria).
    let k = 0;
    for (let r = 2; r <= 10; r++) {
      for (let c = 26; c <= 43; c++) {
        const item = yardItems[(r * 7 + c) % yardItems.length]!;
        state.inventory[item.id] = (state.inventory[item.id] ?? 0) + 1;
        if (session.place(item.id, [c, r]).ok) k++;
      }
    }
    expect(k).toBeGreaterThan(10);
    const catDay = content.festivals.find((x) => x.id === 'fest.cat_day')!;
    for (let season = 0; season < content.seasons.order.length; season++) {
      state.festivals.active = null;
      state.festivals.heldOn = null;
      session.debugStartFestival(catDay.id);
      const day = season * content.seasons.daysPerSeason + 9;
      state.festivals.active!.day = day;
      state.day = day;
      state.time = 11 * 60;
      for (const id of [catDay.closePoint!.point, ...catDay.decorations!.map((d) => d.point)]) session.doJobPoint(id);
      expect(() => resolveMap(session.mapData(), content.catalog), content.seasons.order[season]).not.toThrow();
      expect(session.festivalCrowd()).not.toBeNull();
    }
  });
});
