// Configurações do jogador (som), à parte do save: valem para todos os slots.
// Puro: sem Phaser, DOM ou window. Quem lê e grava é o jogo, numa chave própria do armazenamento.

export interface ChannelSettings {
  on: boolean;
  /** 0 a 1. */
  volume: number;
}

export interface Settings {
  version: 1;
  /** Música de fundo. */
  music: ChannelSettings;
  /** Sons ambientes: vento, neve, rua, passos... */
  ambient: ChannelSettings;
}

export const SETTINGS_KEY = 'settings';

export const DEFAULT_SETTINGS: Settings = {
  version: 1,
  music: { on: true, volume: 0.6 },
  ambient: { on: true, volume: 0.7 },
};

const clamp = (v: unknown, fallback: number) => (typeof v === 'number' && Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : fallback);

function channel(raw: unknown, fallback: ChannelSettings): ChannelSettings {
  const o = typeof raw === 'object' && raw !== null ? (raw as Record<string, unknown>) : {};
  return { on: typeof o.on === 'boolean' ? o.on : fallback.on, volume: clamp(o.volume, fallback.volume) };
}

/** Lê as configurações; qualquer coisa estranha volta ao padrão (nunca joga erro). */
export function parseSettings(json: string | null): Settings {
  if (!json) return structuredClone(DEFAULT_SETTINGS);
  try {
    const raw = JSON.parse(json) as Record<string, unknown>;
    return { version: 1, music: channel(raw.music, DEFAULT_SETTINGS.music), ambient: channel(raw.ambient, DEFAULT_SETTINGS.ambient) };
  } catch {
    return structuredClone(DEFAULT_SETTINGS);
  }
}

export function serializeSettings(s: Settings): string {
  return JSON.stringify(s);
}

/** Volume que o canal toca de verdade (desligado = 0). */
export function effectiveVolume(c: ChannelSettings): number {
  return c.on ? c.volume : 0;
}
