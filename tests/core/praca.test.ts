import { describe, expect, it } from 'vitest';
import { resolveMap } from '../../src/core/map';
import { loadContent } from './content';

const content = loadContent();
const praca = content.maps['map.minigame_praca']!;

/** Cantos (NW, NE, SW, SE) de um tile de transição: g = grama, p = pedregulho; null se não for da praça. */
const corners = (tile: string | undefined) => (tile?.startsWith('praca_v') ? tile.slice(-4) : null);

describe('praça do Confiança do gato', () => {
  it('só o Confiança do gato vai para a praça; os outros mini games continuam na rua', () => {
    const games = content.minigames.games as Record<string, { map?: string; view?: number[]; catAt?: number[] }>;
    expect(games.trust!.map).toBe('map.minigame_praca');
    for (const id of ['chase', 'kitten_hunt', 'delivery']) expect(games[id]!.map).toBe('map.minigame_chase');
    // O recorte da câmera e o gato cabem no mapa, e o gato fica no pedregulho.
    const [vc, vr, vw, vh] = games.trust!.view!;
    expect(vc! + vw!).toBeLessThanOrEqual(praca.size.cols);
    expect(vr! + vh!).toBeLessThanOrEqual(praca.size.rows);
    const [cc, cr] = games.trust!.catAt!;
    expect(corners(praca.legend[praca.layers.floor[cr!]![cc!]!])).toBe('pppp');
  });

  it('o mapa é válido e todo tile existe no catálogo', () => {
    expect(() => resolveMap(praca, content.catalog)).not.toThrow();
    for (const tile of Object.values(praca.legend)) expect(content.catalog.tiles[tile], tile).toBeDefined();
  });

  it('a borda emenda: os cantos de tiles vizinhos são iguais (grama com grama, pedregulho com pedregulho)', () => {
    const floor = praca.layers.floor;
    const at = (r: number, c: number) => corners(praca.legend[floor[r]?.[c] ?? '']);
    for (let r = 0; r < praca.size.rows; r++)
      for (let c = 0; c < praca.size.cols; c++) {
        const here = at(r, c);
        if (!here) continue;
        const right = at(r, c + 1);
        // NE/SE daqui = NW/SW do vizinho da direita; SW/SE daqui = NW/NE do de baixo.
        if (right) expect(here[1]! + here[3]!, `${r},${c} -> direita`).toBe(right[0]! + right[2]!);
        const down = at(r + 1, c);
        if (down) expect(here[2]! + here[3]!, `${r},${c} -> baixo`).toBe(down[0]! + down[1]!);
      }
  });

  it('os bancos ficam nos recuos de grama, com o vaso de flores ao lado', () => {
    const benches = praca.objects.filter((o) => o.tile === 'prop_banco');
    expect(benches).toHaveLength(2);
    for (const b of benches) {
      // O banco (2x2) tem a base na linha de baixo: as duas células dela são grama pura.
      const [c, r] = b.at;
      for (const dc of [0, 1]) expect(corners(praca.legend[praca.layers.floor[r + 1]![c + dc]!])).toBe('gggg');
      expect(praca.objects.some((o) => o.tile === 'yard_vaso_baixo_flores' && o.at[0] === c + 2 && o.at[1] === r + 1)).toBe(true);
    }
  });
});
