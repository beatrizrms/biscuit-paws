// Energia da protagonista: cada tarefa gasta um pouco; com pouca, ela anda mais devagar e não corre.
// Ela acorda cheia (ou menos, se foi dormir depois da meia-noite). Puro: sem Phaser, DOM ou window.

import type { EventName } from './events';

/** Eventos que podem gastar energia (os custos em data/daynight.json: energy.costs). */
export const ENERGY_EVENTS: readonly EventName[] = ['dirt.cleaned', 'prep.started', 'customer.served', 'dish.washed', 'minigame.finished', 'cat.fed', 'litter.refilled'];

export interface EnergyConfig {
  /** Energia cheia. */
  max: number;
  /** Com isto ou menos: cansada (anda mais devagar e não corre). */
  lowAt: number;
  /** Velocidade de andar cansada e sem energia nenhuma (1 = normal). */
  tiredSpeed: number;
  emptySpeed: number;
  /** Quanto cada evento gasta (nome do evento -> energia). Mini game pulado não gasta. */
  costs: Record<string, number>;
  /** Energia ao acordar quando o dia acabou depois da meia-noite. */
  wakeAfterLateNight: number;
}

export type EnergyLevel = 'ok' | 'low' | 'empty';

export function clampEnergy(value: number, cfg: EnergyConfig): number {
  return Math.min(cfg.max, Math.max(0, value));
}

export function energyLevel(value: number, cfg: EnergyConfig): EnergyLevel {
  if (value <= 0) return 'empty';
  return value <= cfg.lowAt ? 'low' : 'ok';
}

/** Fator da velocidade de andar pela energia. */
export function energySpeed(value: number, cfg: EnergyConfig): number {
  const level = energyLevel(value, cfg);
  return level === 'ok' ? 1 : level === 'low' ? cfg.tiredSpeed : cfg.emptySpeed;
}

/** Erros da configuração (só eventos de ENERGY_EVENTS custam). */
export function validateEnergy(cfg: EnergyConfig): string[] {
  const eventNames = new Set<string>(ENERGY_EVENTS);
  const errors: string[] = [];
  if (!(cfg.max > 0)) errors.push('energy: max deve ser maior que 0');
  if (!(cfg.lowAt >= 0 && cfg.lowAt < cfg.max)) errors.push('energy: lowAt deve ficar entre 0 e max');
  if (!(cfg.wakeAfterLateNight > 0 && cfg.wakeAfterLateNight <= cfg.max)) errors.push('energy: wakeAfterLateNight deve ficar entre 1 e max');
  for (const k of ['tiredSpeed', 'emptySpeed'] as const) if (!(cfg[k] > 0 && cfg[k] <= 1)) errors.push(`energy: ${k} deve ficar entre 0 e 1`);
  for (const [name, cost] of Object.entries(cfg.costs)) {
    if (!eventNames.has(name)) errors.push(`energy: evento "${name}" não está em ENERGY_EVENTS`);
    if (!(cost >= 0)) errors.push(`energy: custo de "${name}" inválido`);
  }
  return errors;
}
