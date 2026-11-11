// Luzes das lâmpadas: todo objeto com lâmpada (data/daynight.json: lightTiles) ganha à noite uma luz desenhada por
// código em cima dela, iluminando em volta. Puro: o mapa entra, as luzes saem (a cena só desenha).
import { parseClock } from './time';
import type { MapData, MapLight } from './map';
import type { TileCatalog } from './tiles';

/** Onde fica a lâmpada na peça (células a partir do canto de cima à esquerda), o raio (px) e a cor. */
export interface LightSpot {
  at: [number, number];
  radius?: number;
  color?: string;
}

/** A partir de `from`, as lâmpadas ficam acesas pelo menos com `alpha` (vai acendendo em `fadeMinutes`). */
export interface LightsOn {
  from: string;
  alpha: number;
  fadeMinutes: number;
}

/** Luzes que já existem a menos disto (células) de uma lâmpada: ela não ganha outra (os postes da rua). */
const SAME_LIGHT = 0.75;

/** As luzes do mapa: as feitas à mão (map.lights) e uma em cada lâmpada dos objetos (os móveis dela também). */
export function mapLights(map: Pick<MapData, 'objects' | 'lights'>, catalog: TileCatalog, lightTiles: Record<string, LightSpot[]> = {}): MapLight[] {
  const manual = map.lights ?? [];
  const out: MapLight[] = [...manual];
  for (const o of map.objects) {
    const spots = lightTiles[o.tile];
    if (!spots || !catalog.tiles[o.tile]) continue;
    for (const s of spots) {
      const at: [number, number] = [o.at[0] + s.at[0], o.at[1] + s.at[1]];
      if (manual.some((m) => Math.hypot(m.at[0] - at[0], m.at[1] - at[1]) < SAME_LIGHT)) continue;
      out.push({ at, ...(s.radius !== undefined ? { radius: s.radius } : {}), ...(s.color ? { color: s.color } : {}) });
    }
  }
  return out;
}

/** O mínimo das lâmpadas acesas a esta hora (0 antes de `from`; sobe até `alpha` em `fadeMinutes`). */
export function lightsFloor(cfg: LightsOn | undefined, time: number): number {
  if (!cfg) return 0;
  const from = parseClock(cfg.from);
  if (time < from) return 0;
  return cfg.alpha * Math.min(1, (time - from) / Math.max(1, cfg.fadeMinutes));
}

export function validateLights(lightTiles: Record<string, LightSpot[]> | undefined, lightsOn: LightsOn | undefined, catalog: TileCatalog): string[] {
  const errors: string[] = [];
  for (const [tile, spots] of Object.entries(lightTiles ?? {})) {
    const def = catalog.tiles[tile];
    if (!def) errors.push(`daynight: lightTiles: tile inexistente "${tile}"`);
    for (const s of spots) {
      if (!Array.isArray(s.at) || s.at.length !== 2) errors.push(`daynight: lightTiles "${tile}": "at" precisa ser [coluna, linha]`);
      else if (def && (s.at[0] < 0 || s.at[0] > def.w || s.at[1] < -def.h || s.at[1] > def.h)) errors.push(`daynight: lightTiles "${tile}": lâmpada fora da peça`);
      if (s.color && !/^#[0-9a-fA-F]{6}$/.test(s.color)) errors.push(`daynight: lightTiles "${tile}": cor inválida "${s.color}"`);
    }
  }
  if (lightsOn) {
    try {
      parseClock(lightsOn.from);
    } catch {
      errors.push(`daynight: lightsOn.from tem hora inválida "${lightsOn.from}"`);
    }
    if (!(lightsOn.alpha >= 0 && lightsOn.alpha <= 1)) errors.push('daynight: lightsOn.alpha precisa ficar entre 0 e 1');
  }
  return errors;
}
