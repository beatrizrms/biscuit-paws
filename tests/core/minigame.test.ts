import { describe, expect, it } from 'vitest';
import { bounceHeading, chaseOutcome, fleeHeading, type ChaseParams } from '../../src/core/chase';
import { coinsFor, Countdown, DIFFICULTIES, makeResult, paramsOf, validateMiniGames } from '../../src/core/minigame';
import { sporadicToday } from '../../src/core/jobs';
import { createRng } from '../../src/core/rng';
import { GameSession } from '../../src/core/session';
import { newGameState } from '../../src/core/state';
import { loadContent } from './content';

const content = loadContent();
const cfg = content.minigames;

describe('framework dos mini games', () => {
  it('os dados são válidos e todo jogo tem as 3 dificuldades', () => {
    expect(validateMiniGames(cfg, { maps: new Set(Object.keys(content.maps)) })).toEqual([]);
    for (const d of DIFFICULTIES) expect(paramsOf<ChaseParams>(cfg, 'chase', d).timeSec).toBeGreaterThan(0);
  });

  it('tutorial: de 1 a 3 linhas e ícone que existe', () => {
    const icons = new Set(['peixe_sardinha']);
    const maps = new Set(Object.keys(content.maps));
    const withTut = (tutorial: { icon?: string; lines: string[] }) => ({ ...cfg, games: { x: { ...cfg.games.latte!, tutorial } } });
    expect(validateMiniGames(withTut({ icon: 'peixe_sardinha', lines: ['um'] }), { maps, icons })).toEqual([]);
    expect(validateMiniGames(withTut({ lines: [] }), { maps, icons }).join()).toMatch(/1 a 3 linhas/);
    expect(validateMiniGames(withTut({ lines: ['a', 'b', 'c', 'd'] }), { maps, icons }).join()).toMatch(/1 a 3 linhas/);
    expect(validateMiniGames(withTut({ icon: 'nada', lines: ['a'] }), { maps, icons }).join()).toMatch(/ícone do tutorial inexistente/);
  });

  it('cronômetro: conta, pausa, retoma e chama o fim uma vez só', () => {
    let ended = 0;
    const t = new Countdown(1000, () => ended++);
    t.tick(400);
    expect(t.remainingMs()).toBe(600);
    t.pause();
    t.tick(500);
    expect(t.remainingMs()).toBe(600);
    t.resume();
    t.tick(700);
    expect(t.remainingMs()).toBe(0);
    t.tick(100);
    expect(ended).toBe(1);
    const s = new Countdown(1000, () => ended++);
    s.stop();
    s.tick(2000);
    expect(ended).toBe(1); // parado por outro motivo: não chama o fim
  });

  it('moedas vêm dos dados: fail 0, ok e great por dificuldade, pular = 25% do ok', () => {
    const r = cfg.games.chase!.rewards.normal;
    expect(coinsFor(cfg, 'chase', 'normal', 'fail')).toBe(0);
    expect(coinsFor(cfg, 'chase', 'normal', 'ok')).toBe(r.ok);
    expect(coinsFor(cfg, 'chase', 'normal', 'great')).toBe(r.great);
    const skip = makeResult(cfg, 'chase', 'normal', 'fail', 0, true);
    expect(skip).toEqual({ gameId: 'chase', outcome: 'ok', score: 0, coinsEarned: Math.round(r.ok * cfg.skipRewardShare), skipped: true });
  });

  it('o resultado paga as moedas e conclui o ponto do pedido se deu certo', () => {
    const state = newGameState(100, 'map.street');
    const session = new GameSession(content, state);
    const events: string[] = [];
    session.bus.onAny((n) => events.push(n));
    session.finishMiniGame(makeResult(cfg, 'chase', 'easy', 'great', 30), { difficulty: 'easy' });
    expect(state.money).toBe(100 + cfg.games.chase!.rewards.easy.great);
    expect(events).toContain('minigame.finished');
    session.finishMiniGame(makeResult(cfg, 'chase', 'easy', 'fail', 0), { difficulty: 'easy', jobPoint: 'pt.nao_existe' });
    expect(state.money).toBe(100 + cfg.games.chase!.rewards.easy.great);
  });
});

describe('mini game pela missão (Gatinho fujão)', () => {
  /** Depois do prólogo, com o pedido aceito. */
  function withJob() {
    const state = newGameState(100, 'map.street');
    state.story.completed.push(...content.story.beats.slice(0, content.story.beats.findIndex((b) => b.id === 'story.prologue_end') + 1).map((b) => b.id));
    const session = new GameSession(content, state);
    expect(session.acceptJob('job.runaway_cat')).toEqual({ ok: true });
    return { session, state };
  }

  it('deu certo: moedas do jogo + recompensa do pedido, e o pedido conta como feito hoje', () => {
    const { session, state } = withJob();
    const r = makeResult(cfg, 'chase', 'normal', 'ok', 10);
    session.finishMiniGame(r, { difficulty: 'normal', jobPoint: 'pt.runaway_cat' });
    expect(state.money).toBe(100 + r.coinsEarned + content.jobs['job.runaway_cat']!.reward);
    expect(state.jobs.doneOn['job.runaway_cat']).toBe(state.day);
    expect(session.activeJobs()).toEqual([]);
  });

  it('não deu: sem moedas e o pedido continua aberto para tentar de novo', () => {
    const { session, state } = withJob();
    session.finishMiniGame(makeResult(cfg, 'chase', 'normal', 'fail', 0), { difficulty: 'normal', jobPoint: 'pt.runaway_cat' });
    expect(state.money).toBe(100);
    expect(session.activeJobs().map((j) => j.id)).toEqual(['job.runaway_cat']);
  });
});

describe('mini game pela missão (Filhotes escondidos)', () => {
  it('só depois de conhecer a Dona Neusa; o ponto abre a caça ao filhote e, dando certo, conclui o pedido', () => {
    const state = newGameState(100, 'map.street');
    state.story.completed.push(...content.story.beats.slice(0, content.story.beats.findIndex((b) => b.id === 'story.prologue_end') + 1).map((b) => b.id));
    const session = new GameSession(content, state);
    expect(session.availableJobs().map((j) => j.id)).not.toContain('job.lost_kittens');
    state.flags['met.old_neighbor'] = true;
    expect(session.availableJobs().map((j) => j.id)).toContain('job.lost_kittens');
    expect(content.jobPoints['pt.kitten_hunt']!.minigame).toEqual({ id: 'kitten_hunt', difficulty: 'normal' });
    expect(session.acceptJob('job.lost_kittens')).toEqual({ ok: true });
    const r = makeResult(cfg, 'kitten_hunt', 'normal', 'great', 3);
    session.finishMiniGame(r, { difficulty: 'normal', jobPoint: 'pt.kitten_hunt' });
    expect(state.money).toBe(100 + r.coinsEarned + content.jobs['job.lost_kittens']!.reward);
    expect(state.jobs.doneOn['job.lost_kittens']).toBe(state.day);
  });
});

describe('missões esporádicas (Entrega relâmpago, Gato assustado)', () => {
  it('o sorteio do dia é repetível, separado por pedido e perto da chance', () => {
    expect(sporadicToday('job.flash_delivery', 7, 0.35)).toBe(sporadicToday('job.flash_delivery', 7, 0.35));
    const days = Array.from({ length: 400 }, (_, i) => i + 1);
    const share = days.filter((d) => sporadicToday('job.flash_delivery', d, 0.35)).length / days.length;
    expect(share).toBeGreaterThan(0.25);
    expect(share).toBeLessThan(0.45);
    const same = days.filter((d) => sporadicToday('job.flash_delivery', d, 0.35) === sporadicToday('job.scared_cat', d, 0.35)).length;
    expect(same).toBeLessThan(days.length); // não aparecem sempre juntos
  });

  it('aparece só nos dias sorteados; feito, some até outro dia sorteado; abre o jogo com o item do ponto', () => {
    const state = newGameState(100, 'map.street');
    state.story.completed.push(...content.story.beats.slice(0, content.story.beats.findIndex((b) => b.id === 'story.prologue_end') + 1).map((b) => b.id));
    state.flags['met.old_neighbor'] = true;
    state.flags['clinic.open'] = true;
    const session = new GameSession(content, state);
    const job = content.jobs['job.flash_delivery']!;
    const open = (d: number) => {
      state.day = d;
      return session.availableJobs().some((j) => j.id === job.id);
    };
    const days = Array.from({ length: 60 }, (_, i) => i + 2);
    const yes = days.find((d) => sporadicToday(job.id, d, job.chance!))!;
    const no = days.find((d) => !sporadicToday(job.id, d, job.chance!))!;
    expect(open(no)).toBe(false);
    expect(open(yes)).toBe(true);
    expect(session.acceptJob(job.id)).toEqual({ ok: true });
    session.finishMiniGame(makeResult(cfg, 'delivery', 'normal', 'ok', 40), { difficulty: 'normal', jobPoint: 'pt.flash_delivery' });
    expect(open(yes)).toBe(false); // feito hoje
    expect(content.jobPoints['pt.flash_delivery']!.minigame).toEqual({ id: 'delivery', difficulty: 'normal', itemId: 'coffee' });
    expect(content.jobPoints['pt.scared_cat']!.minigame?.id).toBe('trust');
  });
});

describe('Gato em fuga (regras)', () => {
  it('pegou com mais da metade do tempo = great; pegou depois = ok; não pegou = fail', () => {
    expect(chaseOutcome(true, 0.6, 0.5)).toBe('great');
    expect(chaseOutcome(true, 0.5, 0.5)).toBe('ok');
    expect(chaseOutcome(false, 0.9, 0.5)).toBe('fail');
  });

  it('perto da jogadora o gato nota e foge para longe dela', () => {
    const rng = createRng(7);
    for (let i = 0; i < 50; i++) {
      const { dir, noticed } = fleeHeading(rng, { x: 100, y: 100 }, { x: 80, y: 100 }, 85);
      expect(noticed).toBe(true);
      expect(dir.x).toBeGreaterThan(0); // a jogadora está à esquerda: ele vai para a direita
    }
    expect(fleeHeading(rng, { x: 500, y: 100 }, { x: 0, y: 0 }, 85).noticed).toBe(false);
  });

  it('ao bater, vira entre 90° e 180°', () => {
    const rng = createRng(3);
    for (let i = 0; i < 30; i++) {
      const d = bounceHeading(rng, { x: 1, y: 0 });
      expect(d.x).toBeLessThanOrEqual(1e-9); // virou pelo menos 90°
      expect(Math.hypot(d.x, d.y)).toBeCloseTo(1);
    }
  });
});
