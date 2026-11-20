// O dia da campanha da CED no beco (cedCampaign.ts; data/ced.json: campaign).
import { describe, expect, it } from 'vitest';
import { CED_SCENES } from '../../src/core/ced';
import { CAMPAIGN_SCRIPTS } from '../../src/core/cedCampaign';
import type { EventName } from '../../src/core/events';
import { GameSession } from '../../src/core/session';
import { newGameState } from '../../src/core/state';
import { loadContent } from './content';

const content = loadContent();
const cfg = content.ced.campaign;

/** Vaquinha batida, fornecedor pago, ligação para a Gabi feita: a campanha marcada. Começa na véspera. */
function setup() {
  const state = newGameState(500, 'map.cafe_main');
  state.flags['prologue.done'] = true;
  state.flags['vet.neutered_once'] = true;
  state.day = 45;
  state.time = 10 * 60;
  const session = new GameSession(content, state);
  session.debugCompleteStory();
  state.time = 10 * 60;
  state.location = 'map.street';
  state.ced = { ...state.ced, stage: 'off', crowdfund: null, scheduled: [], pendingScene: null };
  session.ced.debugStart();
  session.finishCutscene(CED_SCENES.intro);
  session.ced.debugComplete();
  for (const id of [CED_SCENES.goal, CED_SCENES.supplier, CED_SCENES.callGabi]) session.finishCutscene(id);
  const events: { name: EventName; payload: unknown }[] = [];
  session.bus.onAny((name, payload) => events.push({ name, payload }));
  const scripts = () => events.filter((e) => e.name === 'script.requested').map((e) => (e.payload as { scriptId: string }).scriptId);
  /** Vira o dia (de manhã, 7h) e põe ela no lugar. */
  const nextDay = (where = 'map.street') => {
    session.endDay('home');
    state.location = where;
  };
  /** Passa minutos do relógio (cada minuto, um tick). */
  const minutes = (n: number) => {
    for (let i = 0; i < n; i++) {
      state.time += 1;
      session.cedCampaign.tick();
    }
  };
  return { state, session, events, scripts, nextDay, minutes };
}

/** Do encontro em diante: o dia da campanha, ela no beco, o roteiro do encontro terminado. */
function atCapture() {
  const t = setup();
  const day = t.state.ced.campaignDay!;
  while (t.state.day < day) t.nextDay();
  t.state.location = cfg.map;
  t.state.time = 8 * 60;
  t.session.setPlayerCell([20, 9]);
  t.minutes(1);
  t.session.finishScript(CAMPAIGN_SCRIPTS.meet);
  return t;
}

describe('campanha da CED no beco', () => {
  it('na véspera os gatos da colônia aparecem (um por kit, cada um num lugar, com nome); no dia o café não abre', () => {
    const { state, session, nextDay, events } = setup();
    const day = state.ced.campaignDay!;
    while (state.day < day - 1) nextDay();
    const c = state.ced.campaign!;
    expect(c.stage).toBe('eve');
    expect(events.some((e) => e.name === 'ced.campaign_eve')).toBe(true);
    expect(c.cats).toHaveLength(Math.min(state.ced.campaignCats, cfg.spots.length));
    expect(new Set(c.cats.map((x) => x.spot)).size).toBe(c.cats.length);
    for (const cat of c.cats) expect(cfg.names).toContain(cat.name);
    nextDay();
    expect(c.stage).toBe('meet');
    state.time = 10 * 60;
    expect(session.service.isOpen()).toBe(false);
    expect(session.chores().some((x) => x.kind === 'ced_meet')).toBe(true);
  });

  it('o encontro só começa com ela no beco; depois, a captura', () => {
    const { state, session, scripts, nextDay, minutes } = setup();
    while (state.day < state.ced.campaignDay!) nextDay();
    minutes(5);
    expect(scripts()).not.toContain(CAMPAIGN_SCRIPTS.meet);
    state.location = cfg.map;
    minutes(1);
    expect(scripts()).toContain(CAMPAIGN_SCRIPTS.meet);
    session.finishScript(CAMPAIGN_SCRIPTS.meet);
    expect(state.ced.campaign!.stage).toBe('capture');
    expect(session.cedCampaign.points().every((p) => p.kind === 'trap')).toBe(true);
  });

  it('caixa posta: com ela longe o gato entra; perto demais ele foge e volta depois; E fecha', () => {
    const { state, session, minutes, events } = atCapture();
    const cat = state.ced.campaign!.cats[0]!;
    const spot = cfg.spots[cat.spot]!.at;
    session.setPlayerCell([spot[0], spot[1] + 1]);
    expect(session.doJobPoint(`pt.ced_trap.${cat.id}`)).toEqual({ ok: true });
    expect(cat.status).toBe('waiting');
    // Perto da caixa, nada acontece.
    minutes(5);
    expect(cat.progress).toBe(0);
    // Longe: ele vem chegando...
    session.setPlayerCell([spot[0] + cfg.trap.awayCells + 2, 9]);
    minutes(3);
    expect(cat.progress).toBe(3);
    // ...e ela volta perto: ele foge.
    session.setPlayerCell(spot);
    minutes(1);
    expect(cat.progress).toBe(0);
    expect(events.some((e) => e.name === 'ced.cat_scared')).toBe(true);
    // Longe de novo: só depois de voltar ele recomeça e, com a espera toda, entra.
    session.setPlayerCell([spot[0] + cfg.trap.awayCells + 2, 9]);
    minutes(cfg.trap.scareMinutes + cat.need + 2);
    expect(cat.status).toBe('inside');
    expect(session.doJobPoint(`pt.ced_close.${cat.id}`)).toEqual({ ok: true });
    expect(cat.status).toBe('caught');
    expect(session.chores().find((x) => x.kind === 'ced_capture')?.progress).toEqual([1, state.ced.campaign!.cats.length]);
  });

  it('às 17h a Fernanda leva quem foi pego; na manhã seguinte, com vaga, a pergunta; os outros voltam e viram post', () => {
    const t = atCapture();
    const { state, session, events } = t;
    const c = state.ced.campaign!;
    // Dois pegos (direto), o resto não.
    for (const cat of c.cats.slice(0, 2)) cat.status = 'caught';
    state.time = 17 * 60 - 1;
    t.minutes(1);
    expect(c.stage).toBe('clinic');
    expect(events.some((e) => e.name === 'ced.capture_ended')).toBe(true);
    expect(c.cats.filter((x) => x.status === 'free')).toHaveLength(c.cats.length - 2);
    t.nextDay(cfg.map);
    expect(c.stage).toBe('release');
    expect(session.chores().some((x) => x.kind === 'ced_release')).toBe(true);
    t.minutes(1);
    expect(t.scripts()).toContain(CAMPAIGN_SCRIPTS.release);
    session.finishScript(CAMPAIGN_SCRIPTS.release);
    const ask = events.find((e) => e.name === 'ced.keep_ask')?.payload as { max: number; cats: string[] } | undefined;
    expect(ask?.cats).toHaveLength(2);
    // Fica com um: vai para o café (castrado, orelha marcada, sem a consulta de entrada).
    const kept = ask!.cats[0]!;
    expect(session.cedCampaign.keep(kept)).toBe(true);
    expect(state.cats[kept]?.sheltered).toBe(true);
    expect(state.cats[kept]?.repro?.status).toBe('neutered');
    expect(state.cats[kept]?.repro?.earTipped).toBe(true);
    expect(state.cats[kept]?.clinic).toBeUndefined();
    session.cedCampaign.afterKeep();
    // O outro: E na caixa solta (volta ao lugar dele) e a campanha acaba, com o post de adoção.
    const other = ask!.cats[1]!;
    expect(session.doJobPoint(`pt.ced_release.${other}`)).toEqual({ ok: true });
    expect(c.stage).toBe('done');
    expect(state.flags['ced.campaign_done']).toBe(true);
    const feed = session.socialFeed();
    expect(feed.some((p) => p.npc === 'npc.fernanda' && p.text.includes(c.cats.find((x) => x.id === other)!.name))).toBe(true);
  });

  it('sem vaga no café, não pergunta; depois, alguém adota (post) e, com vaga aberta, dá para levar do beco', () => {
    const t = atCapture();
    const { state, session, events } = t;
    const c = state.ced.campaign!;
    for (const cat of c.cats) cat.status = 'caught';
    t.minutes(1);
    t.nextDay(cfg.map);
    // Café lotado.
    const full = session.catCapacity() - session.shelteredCats().length;
    for (let i = 0; i < full; i++) state.cats[`cat.test.${i}`] = { sheltered: true, name: 'x', map: 'map.cafe_main', shelteredOn: 1, health: 10, sickness: null, happiness: 10, hygiene: 10 } as never;
    t.minutes(1);
    session.finishScript(CAMPAIGN_SCRIPTS.release);
    expect(events.some((e) => e.name === 'ced.keep_ask')).toBe(false);
    expect(events.some((e) => e.name === 'ced.release_others')).toBe(true);
    for (const cat of [...c.cats]) session.doJobPoint(`pt.ced_release.${cat.id}`);
    expect(c.stage).toBe('done');
    expect(session.cedCampaign.points()).toHaveLength(0); // sem vaga, nada de "levar"
    // Abre vaga: E no gato do beco pergunta se leva.
    delete state.cats['cat.test.0'];
    const take = session.cedCampaign.points().find((p) => p.kind === 'take');
    expect(take).toBeDefined();
    // Alguém adota um, alguns dias depois.
    for (let i = 0; i < cfg.adoption.everyDays[1] + 1; i++) t.nextDay(cfg.map);
    expect(c.cats.some((x) => x.status === 'adopted')).toBe(true);
    expect(events.some((e) => e.name === 'ced.cat_adopted')).toBe(true);
  });

  it('faltou no dia: a Fernanda remarca uma vez; faltou de novo, fica para a próxima', () => {
    const { state, nextDay, events } = setup();
    while (state.day < state.ced.campaignDay!) nextDay();
    const c = state.ced.campaign!;
    nextDay();
    expect(c.stage).toBe('meet');
    expect(c.day).toBe(state.day);
    expect(events.some((e) => e.name === 'ced.campaign_rescheduled')).toBe(true);
    nextDay();
    expect(c.stage).toBe('done');
    expect(events.some((e) => e.name === 'ced.campaign_cancelled')).toBe(true);
  });
});
