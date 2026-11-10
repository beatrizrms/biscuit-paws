// Reputação felina da cidade: um valor de 0 a max, com o motivo de cada mudança num log curto (debug) e limiares
// que só disparam um evento (o que a reputação destrava fica nos eventos e nos selos do café, data/milestones.json). Puro: sem Phaser, DOM ou window; a sessão
// guarda o estado no save e emite os eventos.
import type { MiniGameResult } from './minigame';

export interface ReputationThreshold {
  id: string;
  at: number;
  name: string;
}

/** data/reputation.json */
export interface ReputationConfig {
  schemaVersion: 1;
  start: number;
  max: number;
  logSize: number;
  thresholds: ReputationThreshold[];
}

export interface ReputationLogEntry {
  day: number;
  amount: number;
  reason: string;
}

/** No save (v16). */
export interface ReputationState {
  value: number;
  /** Limiares já alcançados (o evento sai uma vez só, mesmo que o valor caia e volte). */
  reached: string[];
  log: ReputationLogEntry[];
}

export function newReputation(cfg: Pick<ReputationConfig, 'start'>): ReputationState {
  return { value: cfg.start, reached: [], log: [] };
}

/**
 * Soma (ou tira) reputação, presa entre 0 e max, e anota o motivo no log (só os últimos logSize).
 * Devolve o antes, o depois e os limiares cruzados agora (subindo, pela primeira vez).
 */
export function addReputation(
  s: ReputationState,
  cfg: ReputationConfig,
  amount: number,
  reason: string,
  day: number,
): { from: number; to: number; crossed: ReputationThreshold[] } {
  const from = s.value;
  const to = Math.max(0, Math.min(cfg.max, from + amount));
  s.value = to;
  s.log.push({ day, amount: to - from, reason });
  if (s.log.length > cfg.logSize) s.log.splice(0, s.log.length - cfg.logSize);
  const crossed = cfg.thresholds.filter((t) => to >= t.at && !s.reached.includes(t.id)).sort((a, b) => a.at - b.at);
  for (const t of crossed) s.reached.push(t.id);
  return { from, to, crossed };
}

/** Quanto um resultado de mini game vale: o do outcome no jogo (pular não vale nada). */
export function reputationForResult(table: Partial<Record<'fail' | 'ok' | 'great', number>> | undefined, r: Pick<MiniGameResult, 'outcome' | 'skipped'>): number {
  if (r.skipped || !table) return 0;
  return table[r.outcome] ?? 0;
}

export function validateReputation(cfg: ReputationConfig): string[] {
  const errors: string[] = [];
  if (!(cfg.max > 0)) errors.push('reputation: max precisa ser maior que 0');
  if (!(cfg.start >= 0 && cfg.start <= cfg.max)) errors.push('reputation: start entre 0 e max');
  if (!(cfg.logSize >= 1)) errors.push('reputation: logSize precisa ser 1 ou mais');
  const ids = new Set<string>();
  for (const t of cfg.thresholds) {
    if (!t.id.startsWith('rep.')) errors.push(`reputation: limiar "${t.id}" deve começar com "rep."`);
    if (ids.has(t.id)) errors.push(`reputation: limiar repetido "${t.id}"`);
    ids.add(t.id);
    if (!(t.at > 0 && t.at <= cfg.max)) errors.push(`reputation: limiar "${t.id}" fora de 1..max`);
  }
  return errors;
}
