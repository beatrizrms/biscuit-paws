import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { isRenovated, jobDays, surfaceCells } from '../../src/core/construction';
import { resolveMap, type Cell } from '../../src/core/map';
import { knownIds, parseSave, serializeSave } from '../../src/core/save';
import { GameSession } from '../../src/core/session';
import { newGameState } from '../../src/core/state';
import { loadContent } from './content';

const content = loadContent();
const c = content.construction;
const surface = (id: string) => content.map.surfaces!.find((s) => s.id === id)!;

/** No café, com o Tião liberado (a Dona Neusa já falou dele). */
function session(money = 2000): GameSession {
  const state = newGameState(money, 'map.cafe_main', 10 * 60);
  state.flags['painter.available'] = true;
  return new GameSession(content, state);
}

/** Aceita o orçamento e passa os dias até a obra terminar. */
function acceptAndWait(s: GameSession): void {
  expect(s.answerQuote(true)).toEqual({ ok: true });
  const end = s.state.construction.job!.endDay!;
  while (s.state.day <= end) s.endDay('home');
}

describe('obras: contas', () => {
  it('dias: 0,5 h por tile, 8 h por dia, arredondando para cima (mínimo 1)', () => {
    expect(jobDays(1, c)).toBe(1);
    expect(jobDays(16, c)).toBe(1);
    expect(jobDays(17, c)).toBe(2);
    expect(jobDays(48, c)).toBe(3);
  });

  it('parede pega a coluna inteira da superfície; piso, só o retângulo', () => {
    const wall = surfaceCells(content.map, surface('surface.wallpaper'), [2, 5], [3, 6]);
    expect(wall.length).toBeGreaterThan(0);
    expect(new Set(wall.map(([col]) => col))).toEqual(new Set([2, 3]));
    // Todas as linhas do papel de parede naquelas colunas (não só as do retângulo).
    const rows = content.map.layers.walls.map((line, r) => (line[2] === surface('surface.wallpaper').legend ? r : -1)).filter((r) => r >= 0);
    expect(wall.filter(([col]) => col === 2).map(([, r]) => r)).toEqual(rows);
    const floor = surfaceCells(content.map, surface('surface.hall_floor'), [9, 6], [10, 7]);
    expect(floor).toEqual([[9, 6], [10, 6], [9, 7], [10, 7]]);
  });
});

describe('obras: reparos', () => {
  it('reparo interno: ligação, paga adiantado, ele vem amanhã, 2 dias; tira as manchas e conta para a inauguração', () => {
    const s = session();
    const events: string[] = [];
    s.bus.onAny((name) => events.push(name));
    const stains = () => s.visibleDirt().filter((d) => d.clearedBy).length;
    expect(stains()).toBeGreaterThan(0);
    expect(s.quoteRepair('inside')).toEqual({ ok: true });
    expect(events).toContain('construction.call');
    const before = s.state.money;
    expect(s.answerQuote(true)).toEqual({ ok: true });
    expect(s.state.money).toBe(before - c.repairs.inside.price);
    expect(s.state.construction.job).toMatchObject({ kind: 'inside', startDay: 2, endDay: 3 });
    // Uma obra por vez.
    expect(s.quoteRepair('outside', 'finish.facade_mint')).toEqual({ ok: false, reason: 'busy' });
    // Hoje ele ainda não está; amanhã está no café.
    expect(s.builderAt('map.cafe_main')).toBeNull();
    s.endDay('home');
    // Amanhece às 07:00: ele chega às 08:00 e vai embora depois de 8 horas (16:00).
    expect(s.builderAt('map.cafe_main')).toBeNull();
    s.state.time = 10 * 60;
    expect(s.builderAt('map.cafe_main')).toEqual(c.repairs.inside.site);
    expect(s.mapData().npcs?.some((n) => n.npc === c.npc && n.anim === 'martelando')).toBe(true);
    s.endDay('home');
    expect(stains()).toBeGreaterThan(0); // ainda no último dia
    s.endDay('home');
    expect(stains()).toBe(0);
    expect(s.state.construction.repaired).toEqual(['inside']);
    expect(s.state.construction.askPending).toBe(true);
    expect(isRenovated(s.state.construction)).toBe(false);
    s.answerBuilder(false);
    expect(s.state.construction.askPending).toBe(false);
  });

  it('reparo externo: a fachada vira a nova na cor escolhida; os dois juntos contam para a inauguração', () => {
    const s = session();
    expect(s.quoteRepair('outside', 'finish.wood_planks')).toEqual({ ok: false, reason: 'unknown_finish' });
    expect(s.quoteRepair('outside', 'finish.facade_pink')).toEqual({ ok: true });
    acceptAndWait(s);
    expect(s.state.finishes['surface.facade']).toBe('finish.facade_pink');
    expect(s.quoteRepair('inside')).toEqual({ ok: true });
    acceptAndWait(s);
    expect(isRenovated(s.state.construction)).toBe(true);
    expect(s.quoteRepair('inside')).toEqual({ ok: false, reason: 'already_repaired' });
  });

  it('sem a Dona Neusa falar dele, não dá para chamar', () => {
    const s = new GameSession(content, newGameState(2000, 'map.cafe_main'));
    expect(s.quoteRepair('inside')).toEqual({ ok: false, reason: 'locked' });
  });
});

describe('obras: troca de acabamento por área', () => {
  const a: Cell = [9, 6];
  const b: Cell = [12, 9];

  it('só depois do reparo interno', () => {
    const s = session();
    expect(s.quoteFinish('surface.hall_floor', 'finish.wood_planks', a, b)).toEqual({ ok: false, reason: 'repair_first' });
  });

  it('ela compra o material; recusar o orçamento devolve o material', () => {
    const s = session();
    s.state.construction.repaired = ['inside', 'outside'];
    const before = s.state.money;
    const q = s.finishQuote('surface.hall_floor', 'finish.wood_planks', a, b)!;
    expect(q.cells.length).toBe(16);
    expect(q).toMatchObject({ material: 16 * c.materialPerTile.floor!, labor: 16 * c.laborPerTile, days: 1 });
    expect(s.quoteFinish('surface.hall_floor', 'finish.wood_planks', a, b)).toEqual({ ok: true });
    expect(s.state.money).toBe(before - q.material);
    expect(s.answerQuote(false)).toEqual({ ok: true });
    expect(s.state.money).toBe(before);
    expect(s.state.construction.quote).toBeNull();
  });

  it('Ctrl + arrastar: duas áreas separadas viram uma obra só; célula repetida conta uma vez', () => {
    const s = session();
    s.state.construction.repaired = ['inside', 'outside'];
    const one = s.finishQuote('surface.hall_floor', 'finish.wood_planks', a, b)!;
    const far: [Cell, Cell] = [[b[0] + 2, a[1]], [b[0] + 3, a[1] + 1]];
    const other = s.finishQuote('surface.hall_floor', 'finish.wood_planks', far[0], far[1])!;
    expect(other.cells.length).toBeGreaterThan(0);
    const both = s.finishQuote('surface.hall_floor', 'finish.wood_planks', a, b, [far])!;
    expect(both.cells.length).toBe(one.cells.length + other.cells.length);
    // A mesma área duas vezes não cobra em dobro.
    expect(s.finishQuote('surface.hall_floor', 'finish.wood_planks', a, b, [[a, b]])!.cells.length).toBe(one.cells.length);
    expect(s.quoteFinish('surface.hall_floor', 'finish.wood_planks', a, b, [far])).toEqual({ ok: true });
    expect(s.state.construction.quote?.cells?.length).toBe(both.cells.length);
  });

  it('aceita: área isolada (fita, não dá para pisar), ele trabalha ao lado; no fim, só aquelas células mudam', () => {
    const s = session();
    s.state.construction.repaired = ['inside', 'outside'];
    s.state.finishes['surface.hall_floor'] = 'finish.check_pink';
    expect(s.quoteFinish('surface.hall_floor', 'finish.wood_planks', a, b)).toEqual({ ok: true });
    expect(s.answerQuote(true)).toEqual({ ok: true });
    s.endDay('home');
    const map = s.mapData();
    const tape = map.objects.filter((o) => o.tile === c.tapeTile);
    expect(tape.length).toBe(16);
    const solid = resolveMap(map, content.catalog).solid;
    expect(solid[6]![9]).toBe(true);
    // Encostado na parede do fundo, na coluna à esquerda da área (no expediente).
    s.state.time = 10 * 60;
    expect(s.builderAt('map.cafe_main')).toEqual({ at: [8, 3], facing: 'right' });
    s.endDay('home');
    const done = s.mapData();
    const tileAt = (col: number, row: number) => done.legend[done.layers.floor[row]![col]!];
    expect(tileAt(10, 7)).toBe('floor_wood_b');
    expect(tileAt(13, 7)).toBe('floor_check_pink');
    expect(done.objects.some((o) => o.tile === c.tapeTile)).toBe(false);
    // As mesmas células com o mesmo acabamento: nada para trocar.
    expect(s.quoteFinish('surface.hall_floor', 'finish.wood_planks', a, b)).toEqual({ ok: false, reason: 'no_cells' });
  });
});

describe('obras: a área isolada não quebra o mapa', () => {
  it('a fita pula a entrada do café e os móveis (o mapa continua válido)', () => {
    const s = session();
    s.state.construction.repaired = ['inside', 'outside'];
    const spawn = content.map.spawn.player;
    expect(s.quoteFinish('surface.hall_floor', 'finish.wood_planks', [spawn[0] - 1, spawn[1] - 1], [spawn[0] + 1, spawn[1] + 1])).toEqual({ ok: true });
    s.answerQuote(true);
    s.endDay('home');
    const map = s.mapData();
    expect(() => resolveMap(map, content.catalog)).not.toThrow();
    expect(map.objects.some((o) => o.tile === c.tapeTile && o.at[0] === spawn[0] && o.at[1] === spawn[1])).toBe(false);
  });
});

describe('obras: save', () => {
  it('a obra em andamento e as células voltam do save', () => {
    const s = session();
    s.state.construction.repaired = ['inside'];
    s.state.construction.cells['9,6'] = 'finish.wood_planks';
    expect(s.quoteRepair('outside', 'finish.facade_sky')).toEqual({ ok: true });
    s.answerQuote(true);
    const back = parseSave(serializeSave(s.state, new Date()), knownIds(content)).state;
    expect(back.construction).toEqual(s.state.construction);
  });

  it('v24 -> v25: reparos contam como feitos se as superfícies já tinham acabamento', () => {
    const v24 = JSON.parse(readFileSync('tests/fixtures/save_v24.json', 'utf8'));
    const all = { ...v24, finishes: { 'surface.wallpaper': 'finish.wallpaper_mint', 'surface.wainscot': 'finish.wainscot_varnished', 'surface.hall_floor': 'finish.check_pink', 'surface.counter_floor': 'finish.wood_parquet', 'surface.facade': 'finish.facade_mint' } };
    expect(parseSave(JSON.stringify(all), knownIds(content)).state.construction.repaired).toEqual(['inside', 'outside']);
    const some = { ...v24, finishes: { 'surface.wallpaper': 'finish.wallpaper_mint' } };
    expect(parseSave(JSON.stringify(some), knownIds(content)).state.construction).toMatchObject({ repaired: [], job: null, cells: {} });
  });
});

describe('obras: expediente do Tião', () => {
  it('chega às 08:00 e vai embora depois de 8 horas; a cena é avisada na chegada e na saída', () => {
    const s = session();
    expect(s.quoteRepair('inside')).toEqual({ ok: true });
    expect(s.answerQuote(true)).toEqual({ ok: true });
    s.endDay('home');
    const shifts: boolean[] = [];
    s.bus.on('construction.shift', ({ working }) => shifts.push(working));
    const at = (clock: string) => {
      const [h, m] = clock.split(':').map(Number);
      s.tickClock(((h! * 60 + m! - s.state.time) / content.dayNight.minutesPerSecond));
      return s.builderAt('map.cafe_main');
    };
    expect(at('07:30')).toBeNull();
    expect(at('08:05')).toEqual(c.repairs.inside.site);
    expect(at('15:55')).toEqual(c.repairs.inside.site);
    expect(at('16:05')).toBeNull();
    expect(shifts).toEqual([true, false]);
  });
});

describe('obras: cone e fita em volta do Tião', () => {
  it('reparo interno: cone ao lado dele e fita embaixo, o dia todo; mapa válido; sem obra, nada', () => {
    const s = session();
    expect(s.quoteRepair('inside')).toEqual({ ok: true });
    expect(s.answerQuote(true)).toEqual({ ok: true });
    const marks = () => s.mapData().objects.filter((o) => o.id.startsWith('obj.construction.site_')).map((o) => `${o.tile}@${o.at.join(',')}`);
    expect(marks()).toEqual([]); // hoje ainda não
    s.endDay('home');
    const [x, y] = c0();
    expect(marks().sort()).toEqual([`${c.coneTile}@${x - 1},${y}`, `${c.tapeTile}@${x},${y + 1}`].sort());
    expect(() => resolveMap(s.mapData(), content.catalog)).not.toThrow();
  });

  it('reparo da fachada: as marcas ficam na rua, não no café', () => {
    const s = session();
    expect(s.quoteRepair('outside', 'finish.facade_mint')).toEqual({ ok: true });
    expect(s.answerQuote(true)).toEqual({ ok: true });
    s.endDay('home');
    expect(s.mapData('map.street').objects.some((o) => o.tile === c.coneTile)).toBe(true);
    expect(s.mapData().objects.some((o) => o.tile === c.coneTile)).toBe(false);
    expect(() => resolveMap(s.mapData('map.street'), content.catalog)).not.toThrow();
  });
});

function c0(): [number, number] {
  return [...c.repairs.inside.site.at] as [number, number];
}
