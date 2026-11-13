import { describe, expect, it } from 'vitest';
import { resolveMap } from '../../src/core/map';
import { loadContent } from './content';

const content = loadContent();

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
