// Clínica da Fernanda (data/clinic.json): consulta de entrada, procedimentos (só a castração por enquanto), internação
// e recuperação no cercadinho. Genérico e em dados: é a casca do futuro CED (captura, esterilização e devolução).
// Puro: sem Phaser, DOM ou window. A sessão (session.ts) só liga isto ao estado e aos eventos.
import { ageMonths, dayAtAge, validateRepro, weightKg, type CatRepro, type ReproConfig } from './repro';
import type { Rng } from './rng';

/** Quem paga o procedimento: o caixa do café agora; a vaquinha na fase da CED. */
export type CostSource = 'cafe' | 'crowdfund';

export interface ProcedureDef {
  id: string;
  /** O que o gato precisa para operar (a validar com um veterinário). */
  requirements: { minAgeMonths: number; minWeightKg: number; minHealth: number; notSick: boolean };
  /** Valor tudo incluso (somado à consulta). */
  price: number;
  /** Cirurgias por dia na clínica (a agenda). */
  surgeriesPerDay: number;
  /** Dias no cercadinho depois de voltar e dias de remédio. */
  isolationDays: number;
  aftercareDays: number;
  /** Latinhas de comida de recuperação (pen.food) que vêm junto na volta (tudo incluso). */
  recoveryCans: number;
  /** Complicação pequena: chance na volta e chance por dia sem comer no cercadinho. */
  /** extra: o que soma em dias de cercadinho, doses e latinhas quando o pontinho está inflamado na entrega. */
  complication: { chance: number; missedFeedChance: number; extra?: number };
  costSource: CostSource;
  /** O que muda no gato depois (trustEasier: níveis mais fácil na confiança; pillWindow: multiplica a distração). */
  effects: { trustEasier?: number; pillWindow?: number };
}

export interface ClinicConfig {
  schemaVersion: 1;
  /** A NPC veterinária: traz o gato operado ao café (a cena da entrega). */
  vet: string;
  /** A consulta de entrada só é exigida depois desta flag (antes, o gato do prólogo entra direto). */
  intake: { requiresFlag: string };
  /** Desconto de amiga: a partir da fromConsult-ésima consulta paga. */
  discount: { fromConsult: number; share: number };
  /** Fiado: sem dinheiro e sem dívida, fica devendo; paga junto (retroativo) na próxima castração. */
  credit: { allowed: boolean };
  /** Leitos de internação (gatos do abrigo de um dia para o outro; na CED, os de colônia). */
  ward: { beds: number };
  /**
   * O cercadinho de recuperação: o móvel, quantos gatos cabem em cada um e a comida (a latinha, dada direto no
   * cercadinho, alimenta todos lá dentro; sem caixa de areia: forrado com fraldas descartáveis).
   */
  /** treatmentCans: na receita de doença que passa, uma latinha por dia de tratamento (o gato fica isolado). */
  pen: { item: string; slots: number; food: string; treatmentCans?: boolean };
  procedures: ProcedureDef[];
  repro: ReproConfig;
  /** Testes de doenças transmissíveis na entrada (por enquanto sempre negativo). */
  tests: string[];
}

/** Onde o gato está no caminho da clínica (CatState.clinic). Ausente = no café, com os outros. */
export type CatClinicStage =
  /** Abrigado agora: espera a consulta de entrada isolado (cercadinho ou caixinha). */
  | { stage: 'intake' }
  /** Internado na clínica até `until`; `procedure` se vai operar; quem traz de volta: a Fernanda ou a jogadora. */
  | { stage: 'ward'; until: number; procedure?: string; returnBy: 'vet' | 'player' }
  /**
   * No cercadinho depois da cirurgia, até `until`; complicação: precisa voltar à clínica. boxed: voltou sem vaga no
   * cercadinho e está na caixinha de transporte; só sai dela quando ela leva a caixinha até um cercadinho.
   */
  | { stage: 'isolation'; until: number; procedure: string; complication?: boolean; boxed?: boolean };

/** Remédio do pós-cirurgia (mesma forma da receita da doença). */
export interface Aftercare {
  days: number;
  dosesGiven: number;
  lastDoseDay: number | null;
}

/** Estado da clínica no save. */
export interface ClinicState {
  /** Consultas pagas até agora (o desconto de amiga começa em discount.fromConsult). */
  consults: number;
  /** A Fernanda já falou do desconto de amiga. */
  friendSaid: boolean;
  /** Cirurgias marcadas por dia (dia -> quantas): a agenda. */
  surgeries: Record<string, number>;
  /** Fiado: quanto ela deve à clínica (paga junto na próxima castração; com dívida, não há outro fiado). */
  debt: number;
}

export function newClinic(): ClinicState {
  return { consults: 0, friendSaid: false, surgeries: {}, debt: 0 };
}

export function procedureOf(cfg: ClinicConfig, id: string): ProcedureDef | undefined {
  return cfg.procedures.find((p) => p.id === id);
}

/** O gato que vai (ou não) para a cirurgia: o que a clínica olha. */
export interface PatientView {
  repro: CatRepro;
  health: number;
  sick: boolean;
}

export type NeuterBlock = 'already_neutered' | 'too_young' | 'too_thin' | 'too_weak' | 'sick';

/**
 * Pode operar hoje? null = pode. Já castrado: a Fernanda avisa e não opera (nem cobra). Novo demais: `readyDay` é o
 * dia estimado em que ele terá a idade mínima.
 */
export function neuterBlock(cfg: ClinicConfig, proc: ProcedureDef, p: PatientView, day: number): { block: NeuterBlock; readyDay?: number } | null {
  const r = proc.requirements;
  if (p.repro.status === 'neutered') return { block: 'already_neutered' };
  if (ageMonths(cfg.repro, p.repro, day) < r.minAgeMonths) return { block: 'too_young', readyDay: dayAtAge(cfg.repro, p.repro, r.minAgeMonths) };
  if (r.notSick && p.sick) return { block: 'sick' };
  if (weightKg(cfg.repro, p.repro, day) < r.minWeightKg) return { block: 'too_thin' };
  if (p.health < r.minHealth) return { block: 'too_weak' };
  return null;
}

/** Cabe na agenda? Leito livre na internação e vaga de cirurgia no dia. */
export function bookingBlock(cfg: ClinicConfig, proc: ProcedureDef, st: ClinicState, wardUsed: number, day: number): 'no_beds' | 'no_slots' | null {
  if (wardUsed >= cfg.ward.beds) return 'no_beds';
  if ((st.surgeries[String(day)] ?? 0) >= proc.surgeriesPerDay) return 'no_slots';
  return null;
}

/** A consulta desta vez já tem o desconto de amiga? (a consulta atual é a consults + 1) */
export function friendDiscount(cfg: ClinicConfig, st: ClinicState): boolean {
  return st.consults + 1 >= cfg.discount.fromConsult;
}

/** O orçamento: consulta + remédio + procedimento, com o desconto de amiga no total (arredondado). */
export function clinicBill(cfg: ClinicConfig, st: ClinicState, parts: { consult: number; medicine: number; procedure: number }): { subtotal: number; discount: number; total: number } {
  const subtotal = parts.consult + parts.medicine + parts.procedure;
  const discount = friendDiscount(cfg, st) ? Math.round(subtotal * cfg.discount.share) : 0;
  return { subtotal, discount, total: subtotal - discount };
}

/**
 * Como pagar uma conta da clínica: à vista (com a dívida anterior junto, se `withDebt`), no fiado (sem dinheiro e sem
 * dívida) ou não dá (sem dinheiro e já devendo).
 */
export function payPlan(cfg: ClinicConfig, st: ClinicState, money: number, total: number, withDebt: boolean): { kind: 'cash'; due: number } | { kind: 'credit' } | { kind: 'no_money' } {
  const due = total + (withDebt ? st.debt : 0);
  if (money >= due) return { kind: 'cash', due };
  if (cfg.credit.allowed && st.debt === 0) return { kind: 'credit' };
  return { kind: 'no_money' };
}

/** Os testes de doenças transmissíveis da entrada. Por enquanto o resultado é sempre negativo. */
export function runTests(cfg: ClinicConfig): Record<string, 'negative'> {
  return Object.fromEntries(cfg.tests.map((t) => [t, 'negative' as const]));
}

/**
 * Gancho da CED (não usado ainda): os gatos de colônia recuperados vão de volta à região; a Fernanda pergunta se cabe
 * algum no abrigo e o jogo sorteia quais ficam, até as vagas livres. Devolve os escolhidos (o resto volta à rua).
 */
export function dischargeChoice(colonyCats: readonly string[], freeSlots: number, rng: Rng): string[] {
  const pool = [...colonyCats];
  const chosen: string[] = [];
  while (chosen.length < Math.max(0, freeSlots) && pool.length > 0) chosen.push(pool.splice(rng.int(0, pool.length - 1), 1)[0]!);
  return chosen;
}

export function validateClinic(cfg: ClinicConfig, refs: { items: ReadonlySet<string>; npcs?: ReadonlySet<string> }): string[] {
  const errors: string[] = [...validateRepro(cfg.repro)];
  const err = (m: string) => errors.push(`clinic: ${m}`);
  if (refs.npcs && !refs.npcs.has(cfg.vet)) err(`vet: NPC inexistente "${cfg.vet}"`);
  for (const id of [cfg.pen.item, cfg.pen.food]) if (!refs.items.has(id)) err(`pen: item inexistente "${id}"`);
  if (!(Number.isInteger(cfg.pen.slots) && cfg.pen.slots >= 1)) err("pen.slots precisa ser um inteiro de 1 ou mais");
  if (!(cfg.discount.fromConsult >= 1)) err('discount.fromConsult precisa ser 1 ou mais');
  if (!(cfg.discount.share >= 0 && cfg.discount.share < 1)) err('discount.share entre 0 e 1');
  if (!(Number.isInteger(cfg.ward.beds) && cfg.ward.beds >= 1)) err('ward.beds precisa ser um inteiro de 1 ou mais');
  if (cfg.procedures.length === 0) err('precisa de pelo menos um procedimento');
  const ids = new Set<string>();
  for (const p of cfg.procedures) {
    const w = `procedimento "${p.id}"`;
    if (!p.id.startsWith('proc.')) err(`${w}: id deve começar com "proc."`);
    if (ids.has(p.id)) err(`${w}: repetido`);
    ids.add(p.id);
    const r = p.requirements;
    if (!(r.minAgeMonths >= 0) || !(r.minWeightKg >= 0) || !(r.minHealth >= 0)) err(`${w}: requisitos precisam ser 0 ou mais`);
    if (!(p.price >= 0)) err(`${w}: price precisa ser 0 ou mais`);
    if (!(Number.isInteger(p.surgeriesPerDay) && p.surgeriesPerDay >= 1)) err(`${w}: surgeriesPerDay precisa ser 1 ou mais`);
    if (!(Number.isInteger(p.isolationDays) && p.isolationDays >= 0)) err(`${w}: isolationDays inteiro, 0 ou mais`);
    if (!(Number.isInteger(p.aftercareDays) && p.aftercareDays >= 0)) err(`${w}: aftercareDays inteiro, 0 ou mais`);
    if (!(Number.isInteger(p.recoveryCans) && p.recoveryCans >= 0)) err(`${w}: recoveryCans inteiro, 0 ou mais`);
    for (const c of [p.complication.chance, p.complication.missedFeedChance]) if (!(c >= 0 && c <= 1)) err(`${w}: complicação entre 0 e 1`);
    if (p.costSource !== 'cafe' && p.costSource !== 'crowdfund') err(`${w}: costSource precisa ser cafe ou crowdfund`);
  }
  if (!ids.has('proc.neuter')) err('falta o procedimento "proc.neuter" (castração)');
  for (const t of cfg.tests) if (!t.startsWith('test.')) err(`teste "${t}" deve começar com "test."`);
  return errors;
}
