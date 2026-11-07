// Relógio do jogo e cor do ciclo dia/noite. Puro: sem Phaser, DOM ou window.
// A hora é guardada em minutos desde 00:00 do dia atual; pode passar de 24:00 (madrugada) até passOut.

export interface DayNightConfig {
  schemaVersion: 1;
  /** Minutos do jogo por segundo real. */
  minutesPerSecond: number;
  /** Hora em que o dia começa ("07:00"). */
  dayStart: string;
  /** Hora em que ela vai para casa de qualquer jeito ("26:00" = 2h da manhã). */
  passOut: string;
  /** Interiores: 0 = sem tinta, 1 = igual à rua. */
  indoorStrength: number;
  keyframes: { time: string; color: string }[];
  seasons?: Record<string, { keyframes?: { time: string; color: string }[] }>;
}

export type RGB = [number, number, number];

/** "07:30" -> 450. Aceita horas acima de 24 ("26:00"). */
export function parseClock(text: string): number {
  const m = /^(\d{1,2}):(\d{2})$/.exec(text);
  if (!m) throw new Error(`Hora inválida: "${text}"`);
  return Number(m[1]) * 60 + Number(m[2]);
}

/** 450 -> "07:30"; arredonda para baixo em passos de `step` minutos (o relógio do HUD anda de 10 em 10). */
export function formatClock(minutes: number, step = 10): string {
  const m = Math.floor(minutes / step) * step;
  const h = Math.floor(m / 60) % 24;
  return `${String(h).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

export function hexToRgb(hex: string): RGB {
  const v = parseInt(hex.replace('#', ''), 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
}

export function rgbToHex([r, g, b]: RGB): number {
  return (r << 16) | (g << 8) | b;
}

/** Cor da tinta (MULTIPLY) para a hora, estação e tipo de lugar. */
export function tintAt(minutes: number, config: DayNightConfig, season: string, indoor = false): RGB {
  const frames = (config.seasons?.[season]?.keyframes ?? config.keyframes)
    .map((k) => ({ t: parseClock(k.time), c: hexToRgb(k.color) }))
    .sort((a, b) => a.t - b.t);
  let color = frames[frames.length - 1]!.c;
  if (minutes <= frames[0]!.t) color = frames[0]!.c;
  else {
    for (let i = 0; i < frames.length - 1; i++) {
      const a = frames[i]!;
      const b = frames[i + 1]!;
      if (minutes >= a.t && minutes <= b.t) {
        const k = b.t === a.t ? 0 : (minutes - a.t) / (b.t - a.t);
        color = [0, 1, 2].map((j) => Math.round(a.c[j]! + (b.c[j]! - a.c[j]!) * k)) as RGB;
        break;
      }
    }
  }
  if (!indoor) return color;
  const s = config.indoorStrength;
  return color.map((v) => Math.round(255 + (v - 255) * s)) as RGB;
}

/** Quão escuro está (0 = dia claro, 1 = noite fechada): base para acender as luzes. */
export function darkness(color: RGB): number {
  const lum = (0.3 * color[0] + 0.59 * color[1] + 0.11 * color[2]) / 255;
  return Math.max(0, Math.min(1, (0.92 - lum) / 0.45));
}

export function validateDayNight(config: DayNightConfig): string[] {
  const errors: string[] = [];
  const check = (where: string, text: string) => {
    try {
      parseClock(text);
    } catch {
      errors.push(`daynight: ${where} tem hora inválida "${text}"`);
    }
  };
  check('dayStart', config.dayStart);
  check('passOut', config.passOut);
  const lists = [config.keyframes, ...Object.values(config.seasons ?? {}).map((s) => s.keyframes ?? [])];
  for (const list of lists) {
    for (const k of list) {
      check('keyframes', k.time);
      if (!/^#[0-9a-fA-F]{6}$/.test(k.color)) errors.push(`daynight: cor inválida "${k.color}"`);
    }
  }
  if (config.keyframes.length < 2) errors.push('daynight: precisa de pelo menos 2 horas-chave');
  if (!(config.indoorStrength >= 0 && config.indoorStrength <= 1)) errors.push('daynight: indoorStrength deve ficar entre 0 e 1');
  return errors;
}
