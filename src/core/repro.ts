// Estado reprodutivo dos gatos (data/clinic.json: repro): castrado ou inteiro, sexo, idade, peso, marca na orelha e o
// que a jogadora já sabe. Sorteado na criação do gato com o RNG de semente (reproduzível e salvo).
// Base da castração (clinic.ts) e, no futuro, da CED (gatos de colônia, marca na orelha ao devolver à rua).
// Puro: sem Phaser, DOM ou window.
import { createRng, type Rng } from './rng';

/** Castrado ou inteiro. Espaço para outros estados no futuro (ex.: 'pregnant'). */
export type ReproStatus = 'intact' | 'neutered';
export type CatSex = 'male' | 'female';
/** De onde o paciente vem: abrigo (o café) agora; colônia na CED (só o tipo, sem implementar). */
export type CatOrigin = 'shelter' | 'colony';
/** O que a jogadora sabe: o estado real (depois do exame ou pela marca) ou ainda não sabe. */
export type KnownRepro = ReproStatus | 'unknown';
export type AgeBand = 'kitten' | 'adult' | 'senior';
export type TestResult = 'negative' | 'positive';

export interface CatRepro {
  status: ReproStatus;
  sex: CatSex;
  /** Dia (do jogo) em que o gato teria 0 meses: a idade cresce com os dias (pode ser negativo). */
  birthDay: number;
  /** Fator de peso do gato (1 = o peso médio da idade). */
  weightFactor: number;
  /** Ponta da orelha cortada (sinal da CED): gato com marca é sempre castrado. Falso nos gatos de abrigo. */
  earTipped: boolean;
  /** O que a jogadora sabe (a ficha mostra castrado, não castrado ou "não sei ainda"). */
  known: KnownRepro;
  origin: CatOrigin;
}

/** Como a chegada declara o estado: fixo ou com chance. Sem nada: a chance padrão da origem (dados). */
export type NeuteredSpec = boolean | { chance: number };

/** O que um gato fixo de data/cats.json declara (os escritos à mão: estado previsível para o tutorial). */
export interface FixedRepro {
  status: ReproStatus;
  sex: CatSex;
  ageMonths: number;
  /** Já começa sabendo o estado (o gato do prólogo). */
  known?: boolean;
  earTipped?: boolean;
}

export interface ReproConfig {
  maleChance: number;
  /** Chance de já chegar castrado: por condição (vale primeiro: filhote nunca), por modelo de chegada, padrão. */
  neuteredChance: { default: number; byModel: Record<string, number>; byCondition: Record<string, number> };
  /** Idade ao chegar (meses), por faixa. */
  ageMonths: Record<AgeBand, [number, number]>;
  /** Dias de jogo para 1 mês de idade. */
  daysPerMonth: number;
  /** Peso médio (kg) por idade (meses), em ordem; entre os pontos, interpola; depois do último, o último. */
  weightByAge: [number, number][];
  /** Variação do peso de cada gato (ex.: 0.15 = de 85% a 115% do médio). */
  weightJitter: number;
}

/** O que a criação do gato sabe para sortear. */
export interface ReproRollInput {
  day: number;
  /** Condição da chegada (data/cat_profiles.json): a faixa de idade e a chance por condição. */
  condition?: string;
  ageBand: AgeBand;
  /** Modelo da chegada (na_porta, vizinho_traz...): a chance por modelo. */
  model?: string;
  neutered?: NeuteredSpec;
  earTipped?: boolean;
  origin?: CatOrigin;
}

/** Semente estável pelo id do gato (gatos de saves antigos sorteiam sempre a mesma coisa). */
export function rngForCat(catId: string, salt = 0): Rng {
  let h = 2166136261 ^ salt;
  for (const ch of catId) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0;
  return createRng(h);
}

/** A chance de já chegar castrado, pelas regras dos dados (condição > modelo > padrão). */
export function neuteredChance(cfg: ReproConfig, input: Pick<ReproRollInput, 'condition' | 'model'>): number {
  const c = cfg.neuteredChance;
  if (input.condition && c.byCondition[input.condition] !== undefined) return c.byCondition[input.condition]!;
  if (input.model && c.byModel[input.model] !== undefined) return c.byModel[input.model]!;
  return c.default;
}

/** Sorteia o estado de um gato que está chegando. Com marca na orelha, é sempre castrado (e já se sabe). */
export function rollRepro(cfg: ReproConfig, rng: Rng, input: ReproRollInput): CatRepro {
  const sex: CatSex = rng.chance(cfg.maleChance) ? 'male' : 'female';
  const [lo, hi] = cfg.ageMonths[input.ageBand];
  const age = rng.int(lo, hi);
  const weightFactor = 1 + (rng.next() * 2 - 1) * cfg.weightJitter;
  const earTipped = input.earTipped === true;
  const spec = input.neutered;
  const neutered = earTipped || (typeof spec === 'boolean' ? spec : rng.chance(spec ? spec.chance : neuteredChance(cfg, input)));
  return {
    status: neutered ? 'neutered' : 'intact',
    sex,
    birthDay: Math.round(input.day - age * cfg.daysPerMonth),
    weightFactor: Math.round(weightFactor * 100) / 100,
    earTipped,
    known: earTipped ? 'neutered' : 'unknown',
    origin: input.origin ?? 'shelter',
  };
}

/** Estado de um gato fixo dos dados (os escritos à mão), no dia em que ele chega. */
export function fixedRepro(cfg: ReproConfig, fixed: FixedRepro, day: number): CatRepro {
  const earTipped = fixed.earTipped === true;
  const status = earTipped ? 'neutered' : fixed.status;
  return {
    status,
    sex: fixed.sex,
    birthDay: Math.round(day - fixed.ageMonths * cfg.daysPerMonth),
    weightFactor: 1,
    earTipped,
    known: fixed.known || earTipped ? status : 'unknown',
    origin: 'shelter',
  };
}

/** Idade em meses (inteiros) num dia. */
export function ageMonths(cfg: ReproConfig, r: CatRepro, day: number): number {
  return Math.max(0, Math.floor((day - r.birthDay) / cfg.daysPerMonth));
}

/** Faixa de idade num dia (para a adoção): filhote até 6 meses, idoso a partir de 8 anos. */
export function ageBandOf(cfg: ReproConfig, r: CatRepro, day: number): AgeBand {
  const m = ageMonths(cfg, r, day);
  return m < 6 ? 'kitten' : m >= 96 ? 'senior' : 'adult';
}

/** Peso médio da idade (kg), interpolando a tabela. */
export function averageWeight(cfg: ReproConfig, months: number): number {
  const t = cfg.weightByAge;
  if (months <= t[0]![0]) return t[0]![1];
  for (let i = 1; i < t.length; i++) {
    const [m1, w1] = t[i]!;
    const [m0, w0] = t[i - 1]!;
    if (months <= m1) return w0 + ((w1 - w0) * (months - m0)) / (m1 - m0);
  }
  return t[t.length - 1]![1];
}

/** Peso (kg, 1 casa) num dia: o médio da idade vezes o fator do gato. */
export function weightKg(cfg: ReproConfig, r: CatRepro, day: number): number {
  const months = Math.max(0, (day - r.birthDay) / cfg.daysPerMonth);
  return Math.round(averageWeight(cfg, months) * r.weightFactor * 10) / 10;
}

/** O primeiro dia em que o gato tem `months` meses. */
export function dayAtAge(cfg: ReproConfig, r: CatRepro, months: number): number {
  return Math.ceil(r.birthDay + months * cfg.daysPerMonth);
}

/** Troca {sex:macho|fêmea} pela forma do sexo do gato ("castrad{sex:o|a}"). */
export function sexText(text: string, sex: CatSex): string {
  return text.replace(/\{sex:([^|{}]*)\|([^{}]*)\}/g, (_m, male: string, female: string) => (sex === 'male' ? male : female));
}

export function validateRepro(cfg: ReproConfig): string[] {
  const errors: string[] = [];
  const err = (m: string) => errors.push(`clinic: repro: ${m}`);
  const p = (v: number) => v >= 0 && v <= 1;
  if (!p(cfg.maleChance)) err('maleChance entre 0 e 1');
  if (!p(cfg.neuteredChance.default)) err('neuteredChance.default entre 0 e 1');
  for (const [k, v] of [...Object.entries(cfg.neuteredChance.byModel), ...Object.entries(cfg.neuteredChance.byCondition)]) if (!p(v)) err(`neuteredChance "${k}" entre 0 e 1`);
  for (const band of ['kitten', 'adult', 'senior'] as const) {
    const r = cfg.ageMonths[band];
    if (!r || !(r[0] >= 0) || r[1] < r[0]) err(`ageMonths.${band} precisa de [mín, máx] com mín <= máx`);
  }
  if (!(cfg.daysPerMonth >= 1)) err('daysPerMonth precisa ser 1 ou mais');
  if (cfg.weightByAge.length < 2) err('weightByAge precisa de 2 pontos ou mais');
  for (let i = 1; i < cfg.weightByAge.length; i++) if (cfg.weightByAge[i]![0] <= cfg.weightByAge[i - 1]![0]) err('weightByAge precisa estar em ordem de idade');
  if (!(cfg.weightJitter >= 0 && cfg.weightJitter < 1)) err('weightJitter entre 0 e 1');
  return errors;
}
