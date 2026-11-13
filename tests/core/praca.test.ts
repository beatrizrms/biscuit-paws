import { describe, expect, it } from 'vitest';
import { resolveMap } from '../../src/core/map';
import { loadContent } from './content';

const content = loadContent();
const praca = content.maps['map.minigame_praca']!;

/** Cantos (NW, NE, SW, SE) de um tile de transição: g = grama, p = pedregulho; null se não for da praça. */
const corners = (tile: string | undefined) => (tile?.startsWith('praca_v') ? tile.slice(-4) : null);

describe('Confiança do gato na praça da vila', () => {
  it('o mini game usa a praça da vila (o mesmo mapa, na estação do jogo); o caminho até o gato é livre', () => {
    const games = content.minigames.games as unknown as Record<string, { map?: string; view?: number[]; catAt?: number[]; difficulties?: Record<string, { startDistance: number }> }>;
    const trust = games.trust!;
    expect(trust.map).toBe('map.praca');
    for (const id of ['chase', 'kitten_hunt', 'delivery']) expect(games[id]!.map).toBe('map.minigame_chase');
    const vila = content.maps['map.praca']!;
    const [vc, vr, vw, vh] = trust.view!;
    expect(vc! + vw!).toBeLessThanOrEqual(vila.size.cols);
    expect(vr! + vh!).toBeLessThanOrEqual(vila.size.rows);
    // O gato e o trecho que ela anda até ele (a distância inicial, para a esquerda) ficam em células livres, dentro da câmera.
    const solid = resolveMap(vila, content.catalog).solid;
    const [cc, cr] = trust.catAt!;
    const ts = vila.tileSize;
    const start = Math.max(...Object.values(trust.difficulties!).map((d) => d.startDistance));
    const from = Math.floor(((cc! + 0.5) * ts - start) / ts);
    expect(from).toBeGreaterThanOrEqual(vc!);
    for (let c = from; c <= cc!; c++) expect(solid[cr!]![c], `${c},${cr}`).toBe(false);
  });

});

// O mapa antigo do mini game fica guardado (o mini game passou a usar a praça da vila).
describe('a praça antiga do Confiança do gato (map.minigame_praca, guardada)', () => {
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
