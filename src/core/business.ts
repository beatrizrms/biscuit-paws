// Estágios do negócio: fechado -> funcionamento parcial (sem placa) -> inaugurado (com placa).
// Puro: sem Phaser, DOM ou window. As condições ficam em data/business.json.
import type { Condition } from './content';

export const BUSINESS_STAGES = ['closed', 'soft_open', 'inaugurated'] as const;
export type BusinessStage = (typeof BUSINESS_STAGES)[number];

export interface BusinessData {
  schemaVersion: number;
  _comment?: string;
  /** Fechado -> funcionamento parcial: o mínimo para atender (ex.: cafeteira, 1 mesa e 1 cadeira). */
  softOpenWhen: Condition;
  /** Superfícies que precisam estar reformadas (com acabamento do pintor) para poder inaugurar. */
  requiredSurfaces: string[];
  /** Itens com esta tag (os upgrades) só aparecem para comprar quando upgradesWhen vale (ex.: depois da inauguração). */
  upgradeTag?: string;
  upgradesWhen?: Condition;
  /** Os preparativos da inauguração (passos optional de story.inauguration). */
  openingPrep?: { posters: string[]; posterTile: string; posterLift: number; posterSpots?: Record<string, { tile?: string; lift?: number; shiftX?: number }>; reputationPerStep: number; arrivalFactorPerStep: number; friendWalkChance?: number; invite?: { ask: string; yes: Record<string, string>; yesDefault: string; hintEnd: string; whereabouts: Record<string, string> }; decor?: { tile: string; at: [number, number]; lift?: number }[] };
}

export const isBusinessStage = (x: unknown): x is BusinessStage => typeof x === 'string' && (BUSINESS_STAGES as readonly string[]).includes(x);

/** O estágio atual já chegou a `min`? (inaugurado também conta como funcionamento parcial). */
export function stageAtLeast(current: BusinessStage, min: BusinessStage): boolean {
  return BUSINESS_STAGES.indexOf(current) >= BUSINESS_STAGES.indexOf(min);
}

/** Reforma completa: toda superfície obrigatória tem acabamento novo. */
export function isRenovated(finishes: Record<string, string>, required: readonly string[]): boolean {
  return required.every((s) => finishes[s] !== undefined);
}

export function validateBusiness(data: BusinessData, surfaceIds: ReadonlySet<string>): string[] {
  const errors: string[] = [];
  if (data.requiredSurfaces.length === 0) errors.push('business: requiredSurfaces vazio (a inauguração sairia na hora)');
  for (const s of data.requiredSurfaces) if (!surfaceIds.has(s)) errors.push(`business: superfície inexistente "${s}"`);
  return errors;
}
