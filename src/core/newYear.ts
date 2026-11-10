// Ano Novo (data/festive.json: newYear): na última noite do ano, a vizinhança se junta na rua e, à meia-noite,
// tem fogos. Na hora de juntar (gatherAt), o roteiro leva ela para a rua; a hora-limite da noite vai mais longe
// (curfew) e ela só vai para casa depois dos fogos. Puro: sem Phaser, DOM ou window.
import { dayInSeason, seasonOf, yearOf, type SeasonsData } from './calendar';
import type { Condition } from './content';
import { parseClock } from './time';

/** Fogos desenhados por código (o jogo só desenha): intervalos em ms, velocidades em px do mundo por segundo. */
export interface FireworksFx {
  /** Um estouro a cada [mín, máx] ms. */
  everyMs: [number, number];
  /** Faíscas por estouro. */
  particles: [number, number];
  speed: [number, number];
  lifespan: [number, number];
  /** Cores sorteadas por estouro (#rrggbb). */
  colors: string[];
}

export interface NewYearData {
  season: string;
  /** Dia (da estação) da véspera: os fogos são à meia-noite dele. */
  day: number;
  /** Hora em que a vizinhança chama para a rua (o roteiro começa). */
  gatherAt: string;
  /** Hora-limite da noite na véspera (em vez da de sempre): dá tempo de ver os fogos. */
  curfew: string;
  /** Condição para ter a festa (ex.: depois do prólogo). */
  when: Condition;
  /** Condição para o roteiro começar, já na hora (ex.: fora do café, ou no salão). Até lá, ela anda livre. */
  startWhen: Condition;
  script: string;
  /** Pontos de coração com cada amigo que estava na rua. */
  points: number;
  fireworks: FireworksFx;
}

/** É a véspera de Ano Novo (o dia cuja meia-noite tem fogos)? */
export function isNewYearEve(seasons: SeasonsData, data: NewYearData, day: number): boolean {
  return seasonOf(seasons, day) === data.season && dayInSeason(seasons, day) === data.day;
}

/** Marca de que os fogos deste ano já foram vistos (uma por ano, nas flags do save). */
export function newYearFlag(seasons: SeasonsData, day: number): string {
  return `newyear.seen.${yearOf(seasons, day)}`;
}

export function validateNewYear(data: NewYearData, refs: { seasons: SeasonsData; scripts: ReadonlySet<string>; passOut: string }): string[] {
  const errors: string[] = [];
  const err = (m: string) => errors.push(`festive.newYear: ${m}`);
  const clock = /^\d{1,2}:\d{2}$/;
  if (!refs.seasons.order.includes(data.season)) err(`estação inexistente "${data.season}"`);
  if (!(data.day >= 1 && data.day <= refs.seasons.daysPerSeason)) err('day fora da estação');
  for (const [k, v] of [['gatherAt', data.gatherAt], ['curfew', data.curfew]] as const) if (!clock.test(v)) err(`${k}: hora inválida "${v}"`);
  if (clock.test(data.gatherAt) && parseClock(data.gatherAt) >= 24 * 60) err('gatherAt precisa ser antes da meia-noite');
  if (clock.test(data.curfew) && (parseClock(data.curfew) <= 24 * 60 || parseClock(data.curfew) > parseClock(refs.passOut))) err(`curfew precisa ser depois da meia-noite e até o desmaio (${refs.passOut})`);
  if (!refs.scripts.has(data.script)) err(`roteiro inexistente "${data.script}"`);
  const f = data.fireworks;
  const range = (r: [number, number]) => r.length === 2 && r[0] > 0 && r[1] >= r[0];
  if (![f.everyMs, f.particles, f.speed, f.lifespan].every(range)) err('fireworks: everyMs, particles, speed e lifespan são [mín, máx] positivos');
  if (f.colors.length === 0 || f.colors.some((c) => !/^#[0-9a-f]{6}$/i.test(c))) err('fireworks: cores #rrggbb');
  return errors;
}
