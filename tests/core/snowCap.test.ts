import { describe, expect, it } from 'vitest';
import { resolveMap } from '../../src/core/map';
import { roomAt } from '../../src/core/rooms';
import { GameSession } from '../../src/core/session';
import { newGameState } from '../../src/core/state';
import { snowCapPixels } from '../../src/core/snowCap';
import { loadContent } from './content';

const content = loadContent();

describe('neve por cima das coisas (puro)', () => {
  it('segue o contorno de cima do desenho e só fica em cima dele (para no primeiro buraco)', () => {
    // 4x8: coluna 0 vazia; colunas 1-3 com desenho a partir da linha 2 (a coluna 3, só até a linha 3).
    const w = 4, h = 8;
    const src = new Uint8ClampedArray(w * h * 4);
    for (let y = 2; y < h; y++) for (let x = 1; x < w; x++) if (x < 3 || y < 4) src[(y * w + x) * 4 + 3] = 255;
    const snow = snowCapPixels(src, w, h, 3);
    const at = (x: number, y: number) => snow[(y * w + x) * 4 + 3]!;
    for (let y = 0; y < h; y++) expect(at(0, y)).toBe(0); // sem desenho, sem neve
    for (const x of [1, 2]) {
      expect(at(x, 2)).toBe(255); // começa no contorno de cima
      expect(at(x, 7)).toBe(0); // não desce tudo
    }
    for (let y = 4; y < h; y++) expect(at(3, y)).toBe(0); // passou do buraco, não segue
    expect(snowCapPixels(src, w, h, 3)).toEqual(snow); // mesma semente, mesma neve
  });
});

describe('neve no inverno (regra geral)', () => {
  const session = (day: number) => {
    const state = newGameState(500, 'map.cafe_main', 10 * 60);
    state.day = day;
    state.business = 'soft_open';
    state.story.completed.push(...content.story.beats.map((b) => b.id));
    for (const r of content.rooms.rooms) state.rooms[r.id] = 'restored';
    state.placed.push({ uid: 'pchair', item: 'item.yard_wicker_chair', at: [38, 7] }, { uid: 'pin', item: 'item.decor_planter', at: [5, 8] });
    return new GameSession(content, state);
  };
  const capped = (s: GameSession, mapId = content.map.id) => s.mapData(mapId).objects.filter((o) => o.snowCap).map((o) => o.id);

  it('no inverno: o que está ao ar livre (o quintal) ganha neve; dentro do café, não; nas outras estações, nada', () => {
    const winter = session(5);
    const ids = capped(winter);
    expect(ids).toContain('placed.pchair');
    expect(ids).not.toContain('placed.pin');
    for (const o of winter.mapData().objects.filter((x) => x.snowCap)) expect(roomAt(content.rooms, o.at)?.outdoor).toBe(true);
    // A sebe do quintal vira a versão com neve.
    expect(Object.values(winter.mapData().legend)).toContain('parque_sebe_topo');
    const summer = session(content.seasons.daysPerSeason * 2 + 5);
    expect(capped(summer)).toEqual([]);
    expect(Object.values(summer.mapData().legend)).not.toContain('parque_sebe_topo');
  });

  it('nos mapas de fora: só o que não tem a neve dele (overlay) e não está na lista de skip', () => {
    const s = session(5);
    const objs = s.mapData('map.street').objects;
    for (const o of objs.filter((x) => x.snowCap)) {
      expect(o.overlay).toBeUndefined();
      expect(content.seasons.snowCaps!.skip.some((p) => o.tile.startsWith(p))).toBe(false);
    }
    expect(objs.filter((o) => o.overlay).every((o) => !o.snowCap)).toBe(true);
    // O mapa com a neve continua válido.
    expect(() => resolveMap(s.mapData(), content.catalog)).not.toThrow();
  });
});

describe('árvores do quintal num save que já tem móveis', () => {
  it('não vão em cima dos móveis dela: o lugar livre mais perto (e o mapa abre)', () => {
    const state = newGameState(500, 'map.cafe_main', 10 * 60);
    state.business = 'soft_open';
    state.story.completed.push(...content.story.beats.map((b) => b.id));
    for (const r of content.rooms.rooms) state.rooms[r.id] = 'restored';
    // Os móveis do save do dia 155 que estavam onde as árvores entram.
    state.placed.push(
      { uid: 'p50', item: 'item.yard_floor_lamp', at: [28, 8] },
      { uid: 'p53', item: 'item.decor_planter', at: [28, 9] },
      { uid: 'p54', item: 'item.decor_planter', at: [29, 9] },
      { uid: 'p33', item: 'item.yard_wicker_chair', at: [38, 7] },
      { uid: 'p34', item: 'item.yard_wicker_chair_left', at: [40, 7] },
    );
    const session = new GameSession(content, state);
    expect(state.flags['placed.room.backyard']).toBe(true);
    expect(state.placed.some((p) => p.item === 'item.yard_big_tree')).toBe(true);
    expect(() => resolveMap(session.mapData(), content.catalog)).not.toThrow();
  });
});
