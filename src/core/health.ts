// Saúde dos gatos (data/health.json): barra de 0 a 100, doenças fictícias sorteadas, receita e remédio.
// Puro: sem Phaser, DOM ou window. A aleatoriedade vem de um RNG com semente (dia + gato), para repetir nos testes.
import { createRng, cellHash } from './rng';
import { validateCare, type CareConfig } from './care';

export interface DiseaseDef {
  id: string;
  /** Nome que a jogadora vê (doença fictícia). */
  name: string;
  /** O que a Fernanda explica na consulta. */
  description: string;
  /** Passa de gato para gato (tipo gripe): só estas contagiam e, em tratamento, o gato fica isolado da turma. */
  contagious?: boolean;
}

export interface HealthConfig {
  schemaVersion: 1;
  /** Felicidade e higiene (care.ts). */
  care: CareConfig;
  /** Saúde máxima e a de um gato que chega bem. */
  max: number;
  start: number;
  /** Abaixo disto o gato fica doente. Um gato que adoece cai para `sickHealth`. */
  sickBelow: number;
  sickHealth: number;
  /** Fim do dia: comeu hoje sobe; não comeu (descuido) desce; doente sem remédio desce mais. */
  daily: { fed: number; hungry: number; sickUntreated: number };
  /** Adoecer à toa (eventos aleatórios): chance por gato por dia, a partir de um dia e só com a clínica aberta. */
  randomIllness: { chancePerDay: number; fromDay: number; requiresFlag: string };
  /** Contágio: doente há mais de `afterDays` dias (sem tratamento, se onlyUntreated) passa a doença; cada saudável pega com a chance. */
  contagion: { afterDays: number; chancePerDay: number; onlyUntreated: boolean };
  /** Prejuízo: com tantos gatos doentes, nenhum cliente novo entra no café. */
  customers: { stopAtSickCats: number };
  diseases: DiseaseDef[];
  /** Remédio: o item e quanto cada dose cura. */
  medicine: { item: string; healPerDose: number };
  /** Receita: quantos dias de remédio (sorteado entre min e max). */
  prescription: { minDays: number; maxDays: number };
  /** Preços: a consulta e cada dia de remédio. */
  prices: { consult: number; medicinePerDay: number };
  /** Fiado: a primeira consulta pode ficar para depois; parte de cada ganho paga a dívida. */
  credit: { firstConsultOnCredit: boolean; repayShare: number };
  /** Clínica: o mapa e a interação da Fernanda (a consulta). */
  clinic: { map: string; vet: string };
}

/** Doença em andamento. `treatment`: a receita (depois da consulta). */
export interface CatSickness {
  disease: string;
  since: number;
  treatment: { days: number; dosesGiven: number; lastDoseDay: number | null } | null;
}

/** Semente estável por dia e gato (o mesmo save sorteia a mesma coisa). */
function rngFor(day: number, catId: string, salt: number) {
  let h = 0;
  for (const ch of catId) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return createRng(cellHash(day, salt) ^ h);
}

/** Sorteia uma doença da lista. */
export function pickDisease(cfg: HealthConfig, day: number, catId: string): string {
  return cfg.diseases[rngFor(day, catId, 11).int(0, cfg.diseases.length - 1)]!.id;
}

/** Sorteia quantos dias de remédio (entre min e max, inclusive). */
export function prescriptionDays(cfg: HealthConfig, day: number, catId: string): number {
  return rngFor(day, catId, 23).int(cfg.prescription.minDays, cfg.prescription.maxDays);
}

/** Adoece à toa hoje? (evento aleatório, com semente) */
export function rollsIllness(cfg: HealthConfig, day: number, catId: string): boolean {
  return rngFor(day, catId, 37).chance(cfg.randomIllness.chancePerDay);
}

/** Pega a doença de outro gato hoje? (com semente) */
export function rollsContagion(cfg: HealthConfig, day: number, catId: string): boolean {
  return rngFor(day, catId, 41).chance(cfg.contagion.chancePerDay);
}

/** Este doente já transmite? Doente há mais de afterDays dias (o dia em que adoeceu conta como o 1º). */
/** A doença passa de gato para gato (data/health.json: diseases[].contagious)? */
export function diseaseContagious(cfg: HealthConfig, disease: string): boolean {
  return !!cfg.diseases.find((d) => d.id === disease)?.contagious;
}

export function isContagious(cfg: HealthConfig, sickness: CatSickness, day: number): boolean {
  if (!diseaseContagious(cfg, sickness.disease)) return false;
  if (cfg.contagion.onlyUntreated && sickness.treatment) return false;
  return day - sickness.since + 1 > cfg.contagion.afterDays;
}

/** A barra de saúde baixa (amarela): abaixo de sickBelow + esta margem. */
export const HEALTH_LOW_MARGIN = 20;
export const healthLow = (cfg: HealthConfig, health: number) => health < cfg.sickBelow + HEALTH_LOW_MARGIN;

export const clampHealth = (cfg: HealthConfig, v: number) => Math.max(0, Math.min(cfg.max, Math.round(v)));

export function validateHealth(cfg: HealthConfig, refs: { items: ReadonlySet<string>; maps: ReadonlySet<string>; npcs: ReadonlySet<string> }): string[] {
  const errors: string[] = [];
  const err = (m: string) => errors.push(`health: ${m}`);
  errors.push(...validateCare(cfg.care));
  if (!(cfg.max > 0) || cfg.start > cfg.max || cfg.sickBelow > cfg.max || cfg.sickHealth >= cfg.sickBelow) err('max, start, sickBelow e sickHealth fora de ordem (sickHealth < sickBelow <= max)');
  if (cfg.diseases.length === 0) err('precisa de pelo menos uma doença');
  const ids = new Set<string>();
  for (const d of cfg.diseases) {
    if (!d.id.startsWith('disease.')) err(`doença "${d.id}" deve começar com "disease."`);
    if (ids.has(d.id)) err(`doença repetida "${d.id}"`);
    ids.add(d.id);
  }
  const { minDays, maxDays } = cfg.prescription;
  if (!(minDays >= 1) || maxDays < minDays) err('prescription: minDays >= 1 e maxDays >= minDays');
  if (!refs.items.has(cfg.medicine.item)) err(`medicine.item inexistente "${cfg.medicine.item}"`);
  if (!refs.maps.has(cfg.clinic.map)) err(`clinic.map inexistente "${cfg.clinic.map}"`);
  if (!refs.npcs.has(cfg.clinic.vet)) err(`clinic.vet: NPC inexistente "${cfg.clinic.vet}"`);
  if (!(cfg.credit.repayShare > 0 && cfg.credit.repayShare <= 1)) err('credit.repayShare entre 0 e 1');
  if (!(cfg.contagion.afterDays >= 0) || !(cfg.contagion.chancePerDay >= 0 && cfg.contagion.chancePerDay <= 1)) err('contagion: afterDays >= 0 e chancePerDay entre 0 e 1');
  if (!(cfg.customers.stopAtSickCats >= 1)) err('customers.stopAtSickCats precisa ser 1 ou mais');
  return errors;
}
