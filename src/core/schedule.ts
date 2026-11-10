// Horário de funcionamento do café, escolhido pela jogadora (app "Horário" do celular): em quais dias da
// semana abre e de que horas a que horas. Fora dele não entra cliente novo. Puro: sem Phaser, DOM ou window.
import { parseClock } from './time';

export const WEEK = 7;

export interface Schedule {
  /** Um por dia da semana (0 = segunda ... 6 = domingo): abre nesse dia? */
  days: boolean[];
  /** "HH:MM". */
  open: string;
  close: string;
  /**
   * Almoço: começo ("HH:MM"); por rules.lunchMinutes não chega cliente novo (quem já está termina; quem espera não perde a paciência). null = sem almoço.
   * Sem o campo (save de antes do almoço): o almoço do horário padrão.
   */
  lunch?: string | null;
}

/** Regras do horário (data/service.json: schedule). */
export interface ScheduleRules {
  /** O horário de um jogo novo. */
  default: Schedule;
  /** Mais cedo que dá para abrir e mais tarde que dá para fechar. */
  earliest: string;
  latest: string;
  /** As horas andam de tanto em tanto (minutos). */
  stepMinutes: number;
  /** Aberto pelo menos tantas horas. */
  minHours: number;
  /** Quanto dura o almoço (minutos). */
  lunchMinutes: number;
}

export type ScheduleProblem = 'no_days' | 'too_short' | 'out_of_range' | 'bad_step';

/** Dia da semana (0 = segunda) do dia do jogo (1 = o primeiro), sabendo em que dia da semana o jogo começa. */
export function weekdayOf(day: number, startWeekday: number): number {
  return (((startWeekday + Math.max(1, day) - 1) % WEEK) + WEEK) % WEEK;
}

/** Aberto neste dia da semana, neste minuto do dia? */
export function isOpenAt(s: Schedule, weekday: number, minutes: number): boolean {
  return s.days[weekday] === true && minutes >= parseClock(s.open) && minutes < parseClock(s.close);
}

/** Começo do almoço que vale ("HH:MM"), ou null sem almoço. Sem o campo, o do horário padrão. */
export function lunchStart(s: Schedule, rules: ScheduleRules): string | null {
  return s.lunch === undefined ? (rules.default.lunch ?? null) : s.lunch;
}

/** Hora em que o almoço acaba ("HH:MM"). */
export function lunchEnd(start: string, rules: ScheduleRules): string {
  const m = parseClock(start) + rules.lunchMinutes;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

/** É hora do almoço (neste minuto do dia)? Sem almoço, nunca. */
export function inLunch(s: Schedule, rules: ScheduleRules, minutes: number): boolean {
  const start = lunchStart(s, rules);
  if (!start) return false;
  const from = parseClock(start);
  const t = ((minutes % 1440) + 1440) % 1440;
  return t >= from && t < from + rules.lunchMinutes;
}

/** O que está errado no horário (ou null). */
export function scheduleProblem(s: Schedule, rules: ScheduleRules): ScheduleProblem | null {
  if (s.days.length !== WEEK || !s.days.some(Boolean)) return 'no_days';
  const open = parseClock(s.open);
  const close = parseClock(s.close);
  if (open < parseClock(rules.earliest) || close > parseClock(rules.latest)) return 'out_of_range';
  if (open % rules.stepMinutes !== 0 || close % rules.stepMinutes !== 0) return 'bad_step';
  if (close - open < rules.minHours * 60) return 'too_short';
  // Almoço: hora válida, em passos e dentro do possível (fora do expediente, só não faz diferença).
  if (s.lunch !== undefined && s.lunch !== null) {
    if (!/^\d{1,2}:\d{2}$/.test(s.lunch)) return 'bad_step';
    const l = parseClock(s.lunch);
    if (l % rules.stepMinutes !== 0) return 'bad_step';
    if (l < parseClock(rules.earliest) || l + rules.lunchMinutes > parseClock(rules.latest)) return 'out_of_range';
  }
  return null;
}

/**
 * Próxima abertura a partir de agora (dia do jogo e "HH:MM"); se já está aberto, o próprio agora não conta.
 * Procura até uma semana à frente (sempre acha: o horário tem pelo menos um dia).
 */
export function nextOpening(s: Schedule, day: number, minutes: number, startWeekday: number): { day: number; open: string } | null {
  for (let d = 0; d <= WEEK; d++) {
    const wd = weekdayOf(day + d, startWeekday);
    if (!s.days[wd]) continue;
    if (d === 0 && minutes >= parseClock(s.open)) continue;
    return { day: day + d, open: s.open };
  }
  return null;
}

export function validateScheduleRules(rules: ScheduleRules, startWeekday: number): string[] {
  const errors: string[] = [];
  if (!Number.isInteger(startWeekday) || startWeekday < 0 || startWeekday >= WEEK) errors.push('calendar: startWeekday deve ser de 0 (segunda) a 6 (domingo)');
  if (!(rules.stepMinutes > 0) || 60 % rules.stepMinutes !== 0) errors.push('service: schedule.stepMinutes deve dividir 60');
  if (!(rules.lunchMinutes > 0) || rules.lunchMinutes % rules.stepMinutes !== 0) errors.push('service: schedule.lunchMinutes deve ser maior que 0 e em passos de stepMinutes');
  const p = scheduleProblem(rules.default, rules);
  if (p) errors.push(`service: o horário padrão é inválido (${p})`);
  return errors;
}
