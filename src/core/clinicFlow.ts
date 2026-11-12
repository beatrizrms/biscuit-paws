// Fluxo da clínica no jogo (castração e consulta de entrada): liga as regras puras (clinic.ts, repro.ts) ao estado,
// ao dinheiro, aos itens e aos eventos. A sessão (session.ts) só delega para cá.
// Caminho do gato abrigado (depois que a clínica abre):
//   chega -> espera isolado (cercadinho ou caixinha) -> ela leva à clínica -> consulta de entrada (testes, estado
//   reprodutivo, doença) -> castra (fica internado; de manhã a Fernanda traz ao cercadinho) | deixa até amanhã (ela busca)
//   | leva para casa (junta-se aos outros) -> cercadinho isolationDays dias + remédio aftercareDays dias -> com os outros.
// Puro: sem Phaser, DOM ou window.
import {
  bookingBlock,
  clinicBill,
  friendDiscount,
  neuterBlock,
  procedureOf,
  payPlan,
  runTests,
  type CatClinicStage,
  type ClinicConfig,
  type NeuterBlock,
  type ProcedureDef,
} from './clinic';
import { diseaseContagious } from './health';
import { ageMonths, fixedRepro, rngForCat, rollRepro, weightKg, type AgeBand, type CatRepro, type FixedRepro, type NeuteredSpec } from './repro';
import type { EventBus } from './events';
import type { GameState, PlacedItem } from './state';
import type { CatDef } from './cats';
import type { HealthConfig } from './health';

export const NEUTER = 'proc.neuter';

/** O que a chegada sabe do gato para o sorteio do estado reprodutivo. */
export interface ArrivalReproInput {
  model?: string;
  condition?: string;
  neutered?: NeuteredSpec;
  earTipped?: boolean;
}

/** O que o fluxo precisa da sessão. */
export interface ClinicHost {
  state: GameState;
  bus: EventBus;
  clinic: ClinicConfig;
  health: HealthConfig;
  catDef(catId: string): CatDef | undefined;
  /** Condições de chegada (cat_profiles.json): a faixa de idade. */
  conditionAge(condition: string | undefined): AgeBand;
  /** Paga (negativo) ou recebe. */
  addMoney(delta: number, reason: string): void;
  /** Ela está na clínica? */
  atClinic(): boolean;
  /** O gato no colo dela agora. */
  carriedCat(): string | undefined;
  /** Tira o gato do colo fora do café (ficou na clínica). */
  dropCarriedCatAway(): void;
  /** Põe o gato no colo (buscar na clínica). */
  holdCat(catId: string): boolean;
  /** Receita da doença: dias (sorteados) e o preço do remédio por dia. */
  prescriptionDays(catId: string): number;
  removeFromInventory(itemId: string): void;
}

/** O que a consulta de entrada mostra (antes de pagar, nada se revela). */
export interface IntakeQuote {
  catId: string;
  consult: number;
  medicine: number;
  discount: number;
  total: number;
  /** A Fernanda dá o desconto de amiga nesta consulta. */
  friend: boolean;
  /** Sem dinheiro e sem dívida: fica no fiado (paga na próxima castração). */
  onCredit: boolean;
}

/** O que a jogadora fica sabendo no fim da consulta (a ficha da clínica). */
export interface ExamResult {
  catId: string;
  sex: CatRepro['sex'];
  ageMonths: number;
  weightKg: number;
  status: CatRepro['status'];
  earTipped: boolean;
  tests: Record<string, 'negative' | 'positive'>;
  disease: string | null;
  /** Por que não opera (null = pode), e o dia em que terá a idade. */
  neuter: { block: NeuterBlock | 'no_beds' | 'no_slots'; readyDay?: number } | null;
  /** Preço da castração agora (com o desconto de amiga). */
  neuterPrice: number;
  /** Fiado: a dívida de agora e como a castração seria paga (à vista com a dívida junto, fiado ou não dá). */
  debt: number;
  neuterPay: 'cash' | 'credit' | 'no_money';
}

export type ClinicProblem =
  | 'not_at_clinic'
  | 'bring_cat'
  | 'not_pending'
  | 'not_examined'
  | 'no_money'
  | 'cannot_neuter'
  | 'not_ready'
  | 'not_here'
  | 'no_complication'
  | 'needs_recovery_food'
  | 'nobody_here'
  | 'needs_pen'
  | 'pen_full';

export class ClinicFlow {
  constructor(private h: ClinicHost) {}

  private get st() {
    return this.h.state;
  }

  private neuterDef(): ProcedureDef {
    return procedureOf(this.h.clinic, NEUTER)!;
  }

  /** A consulta de entrada já vale? (antes da clínica abrir, o gato do prólogo entra direto) */
  intakeRequired(): boolean {
    return !!this.st.flags[this.h.clinic.intake.requiresFlag];
  }

  // ---------- Estado reprodutivo ----------

  /** Saves antigos e gatos fixos: quem não tem estado reprodutivo ganha um (semente pelo id: sempre o mesmo). */
  ensureRepro(): void {
    for (const [id, cat] of Object.entries(this.st.cats)) {
      if (cat.repro) continue;
      cat.repro = this.newRepro(id, cat.shelteredOn, {});
    }
  }

  private newRepro(catId: string, day: number, input: ArrivalReproInput): CatRepro {
    const fixed: FixedRepro | undefined = this.h.catDef(catId)?.repro;
    if (fixed) return fixedRepro(this.h.clinic.repro, fixed, day);
    const condition = input.condition ?? this.h.catDef(catId)?.tags.find((t) => t.startsWith('condition:'))?.slice('condition:'.length);
    return rollRepro(this.h.clinic.repro, rngForCat(catId, day), {
      day,
      condition,
      ageBand: this.h.conditionAge(condition),
      ...(input.model ? { model: input.model } : {}),
      ...(input.neutered !== undefined ? { neutered: input.neutered } : {}),
      ...(input.earTipped ? { earTipped: true } : {}),
    });
  }

  /** O gato acabou de ser abrigado: sorteia o estado e, com a clínica aberta, ele espera a consulta isolado. */
  onSheltered(catId: string, input: ArrivalReproInput): void {
    const cat = this.st.cats[catId];
    if (!cat) return;
    cat.repro = this.newRepro(catId, this.st.day, input);
    if (cat.repro.earTipped) this.h.bus.emit('cat.ear_tipped', { catId });
    if (this.intakeRequired() && !this.h.catDef(catId)?.memory) cat.clinic = { stage: 'intake' };
  }

  // ---------- Onde o gato está ----------

  stage(catId: string): CatClinicStage | undefined {
    return this.st.cats[catId]?.clinic;
  }

  /** Isolado no café (esperando a consulta, se recuperando ou tratando doença que passa): no cercadinho ou na caixinha. */
  isolated(catId: string): boolean {
    const s = this.stage(catId)?.stage;
    return s === 'intake' || s === 'isolation' || this.sickIsolated(catId);
  }

  /**
   * Doente de doença que passa de gato para gato (a Fungadinha) e já em tratamento: fica isolado até sarar (no
   * cercadinho; sem vaga, na caixinha). Sem estado no save: sarou, volta sozinho para a turma.
   */
  sickIsolated(catId: string): boolean {
    const cat = this.st.cats[catId];
    return !!cat?.sickness?.treatment && !this.stage(catId) && diseaseContagious(this.h.health, cat.sickness.disease);
  }

  /** Internado na clínica (não aparece no café). */
  inWard(catId: string): boolean {
    return this.stage(catId)?.stage === 'ward';
  }

  /** Com os outros gatos (anda pelo café, come no pote, brinca). */
  withOthers(catId: string): boolean {
    return !this.stage(catId) && !this.sickIsolated(catId);
  }

  wardCount(): number {
    return Object.values(this.st.cats).filter((c) => c.sheltered && c.clinic?.stage === 'ward').length;
  }

  // ---------- Cercadinho ----------

  /** Os cercadinhos posicionados no café, em ordem estável. */
  pens(): PlacedItem[] {
    return this.st.placed.filter((p) => p.item === this.h.clinic.pen.item).sort((a, b) => a.uid.localeCompare(b.uid, undefined, { numeric: true }));
  }

  /**
   * Quem fica em cada cercadinho (até pen.slots em cada, por ordem de chegada); quem não cabe espera na caixinha num
   * canto ('box'). O gato no colo dela não conta.
   */
  penAssignments(): { pen: Record<string, string[]>; box: string[] } {
    const carried = this.h.carriedCat();
    const cats = Object.keys(this.st.cats)
      .filter((id) => this.st.cats[id]!.sheltered && this.isolated(id) && id !== carried)
      .sort((a, b) => this.st.cats[a]!.shelteredOn - this.st.cats[b]!.shelteredOn || a.localeCompare(b));
    const pen: Record<string, string[]> = {};
    const box: string[] = [];
    const slots = this.h.clinic.pen.slots;
    const pens = this.pens();
    let i = 0;
    for (const p of pens) pen[p.uid] = [];
    for (const id of cats) {
      // Na caixinha de transporte (voltou da cirurgia sem vaga): fica nela até ela levar até um cercadinho.
      const s = this.st.cats[id]!.clinic;
      if (s?.stage === 'isolation' && s.boxed) {
        box.push(id);
        continue;
      }
      while (i < pens.length && pen[pens[i]!.uid]!.length >= slots) i++;
      if (i < pens.length) pen[pens[i]!.uid]!.push(id);
      else box.push(id);
    }
    return { pen, box };
  }

  /** Castrado em recuperação que está na caixinha (sem vaga) mas sem a marca (save de antes dela): marca. */
  boxLeftovers(): void {
    for (const id of this.penAssignments().box) {
      const s = this.st.cats[id]!.clinic;
      if (s?.stage === 'isolation') s.boxed = true;
    }
  }

  /** O gato está na caixinha de transporte (castrado sem vaga no cercadinho)? */
  boxed(catId: string): boolean {
    const s = this.st.cats[catId]?.clinic;
    return s?.stage === 'isolation' && !!s.boxed;
  }

  /** Solta o gato da caixinha (a que está no colo) no cercadinho: só lá ele sai dela. Quem tira do colo é a sessão. */
  releaseIntoPen(penUid: string): { ok: true } | { ok: false; reason: ClinicProblem } {
    const id = this.h.carriedCat();
    if (!id || !this.boxed(id)) return { ok: false, reason: 'not_pending' };
    if (!this.pens().some((p) => p.uid === penUid)) return { ok: false, reason: 'needs_pen' };
    if ((this.penAssignments().pen[penUid]?.length ?? 0) >= this.h.clinic.pen.slots) return { ok: false, reason: 'pen_full' };
    delete (this.st.cats[id]!.clinic as { boxed?: boolean }).boxed;
    return { ok: true };
  }

  /** Quem está com fome no cercadinho (ou na caixinha do canto). */
  hungryIn(where: string): string[] {
    const a = this.penAssignments();
    return (where === 'box' ? a.box : (a.pen[where] ?? [])).filter((id) => this.st.cats[id]!.fedOn !== this.st.day);
  }

  /** A latinha (da mochila) no cercadinho (ou na caixinha): alimenta todos os isolados de lá. Gasta uma latinha. */
  feedIsolated(where: string): { ok: true; fed: string[] } | { ok: false; reason: ClinicProblem } {
    const food = this.h.clinic.pen.food;
    const item = (this.st.inventory[food] ?? 0) > 0 ? food : null;
    if (!item) return { ok: false, reason: 'needs_recovery_food' };
    const a = this.penAssignments();
    const cats = (where === 'box' ? a.box : (a.pen[where] ?? [])).filter((id) => this.st.cats[id]!.fedOn !== this.st.day);
    if (cats.length === 0) return { ok: false, reason: 'nobody_here' };
    this.h.removeFromInventory(item);
    for (const id of cats) {
      this.st.cats[id]!.fedOn = this.st.day;
      this.st.cats[id]!.fedWith = item;
      this.h.bus.emit('cat.fed', { catId: id, itemId: item, bowlUid: where });
    }
    return { ok: true, fed: cats };
  }

  // ---------- Consulta de entrada ----------

  /** O orçamento da consulta de entrada (sem mudar nada) ou por que não dá. */
  intakeQuote(catId: string): IntakeQuote | { problem: ClinicProblem } {
    const cat = this.st.cats[catId];
    if (!this.h.atClinic()) return { problem: 'not_at_clinic' };
    if (!cat?.sheltered || this.h.carriedCat() !== catId) return { problem: 'bring_cat' };
    // A consulta de entrada: quem acabou de chegar, ou quem nunca foi examinado (saves antigos). Isolado em outra etapa, não.
    if (cat.tests || (cat.clinic && cat.clinic.stage !== 'intake')) return { problem: 'not_pending' };
    const days = cat.sickness && !cat.sickness.treatment ? this.h.prescriptionDays(catId) : 0;
    const medicine = days * this.h.health.prices.medicinePerDay;
    const bill = clinicBill(this.h.clinic, this.st.clinic, { consult: this.h.health.prices.consult, medicine, procedure: 0 });
    const plan = payPlan(this.h.clinic, this.st.clinic, this.st.money, bill.total, false);
    if (plan.kind === 'no_money') return { problem: 'no_money' };
    return { catId, consult: this.h.health.prices.consult, medicine, discount: bill.discount, total: bill.total, friend: friendDiscount(this.h.clinic, this.st.clinic), onCredit: plan.kind === 'credit' };
  }

  /**
   * A consulta de entrada: paga (com o desconto de amiga a partir da 5ª), faz os testes, revela o estado reprodutivo e,
   * se ele estiver doente, já começa o tratamento (o remédio vai para a mochila). Ele continua no colo dela.
   */
  intakeConsult(catId: string): { ok: true; exam: ExamResult } | { ok: false; reason: ClinicProblem } {
    const q = this.intakeQuote(catId);
    if ('problem' in q) return { ok: false, reason: q.problem };
    this.payConsult(q.total, 'vet:intake', q.onCredit);
    const cat = this.st.cats[catId]!;
    cat.tests = runTests(this.h.clinic);
    cat.repro!.known = cat.repro!.status;
    if (cat.sickness && !cat.sickness.treatment) {
      const days = q.medicine / Math.max(1, this.h.health.prices.medicinePerDay);
      cat.sickness.treatment = { days, dosesGiven: 0, lastDoseDay: null };
      const med = this.h.health.medicine.item;
      this.st.inventory[med] = (this.st.inventory[med] ?? 0) + days;
      this.h.bus.emit('cat.diagnosed', { catId, disease: cat.sickness.disease, days, total: q.total, onCredit: false });
    }
    // Consulta feita: ele sai da espera. O resto (castrar, ficar, levar) a jogadora escolhe em seguida.
    cat.clinic = undefined;
    this.st.flags['vet.intake_done'] = true;
    const exam = this.exam(catId)!;
    this.h.bus.emit('cat.examined', { catId, status: exam.status, earTipped: exam.earTipped });
    return { ok: true, exam };
  }

  /** Checkup junto de outra consulta: testes, estado da castração confirmado (só quem nunca foi examinado). */
  checkup(catId: string): boolean {
    const cat = this.st.cats[catId];
    if (!cat?.repro || cat.tests) return false;
    cat.tests = runTests(this.h.clinic);
    cat.repro.known = cat.repro.status;
    if (cat.clinic?.stage === 'intake') cat.clinic = undefined;
    this.h.bus.emit('cat.examined', { catId, status: cat.repro.status, earTipped: cat.repro.earTipped });
    this.h.bus.emit('clinic.checkup', { catId });
    return true;
  }

  /** Paga uma consulta (ou põe no fiado). Conta para o desconto de amiga; a 1ª com desconto, a Fernanda comenta. */
  payConsult(total: number, reason: string, onCredit = false): void {
    const friend = friendDiscount(this.h.clinic, this.st.clinic);
    if (onCredit) {
      this.st.clinic.debt += total;
      this.h.bus.emit('clinic.credit', { amount: total, debt: this.st.clinic.debt });
    } else this.h.addMoney(-total, reason);
    this.st.clinic.consults += 1;
    if (friend && !this.st.clinic.friendSaid) {
      this.st.clinic.friendSaid = true;
      this.h.bus.emit('clinic.friend_discount', {});
    }
  }

  /** O que a jogadora sabe do gato examinado (null antes do exame). */
  exam(catId: string): ExamResult | null {
    const cat = this.st.cats[catId];
    if (!cat?.repro || !cat.tests) return null;
    const cfg = this.h.clinic;
    const proc = this.neuterDef();
    const day = this.st.day;
    const block = neuterBlock(cfg, proc, { repro: cat.repro, health: cat.health, sick: !!cat.sickness }, day);
    const booking = block ? null : bookingBlock(cfg, proc, this.st.clinic, this.wardCount(), day);
    return {
      catId,
      sex: cat.repro.sex,
      ageMonths: ageMonths(cfg.repro, cat.repro, day),
      weightKg: weightKg(cfg.repro, cat.repro, day),
      status: cat.repro.status,
      earTipped: cat.repro.earTipped,
      tests: { ...cat.tests },
      disease: cat.sickness?.disease ?? null,
      neuter: block ?? (booking ? { block: booking } : null),
      neuterPrice: clinicBill(cfg, this.st.clinic, { consult: 0, medicine: 0, procedure: proc.price }).total,
      debt: this.st.clinic.debt,
      neuterPay: payPlan(cfg, this.st.clinic, this.st.money, clinicBill(cfg, this.st.clinic, { consult: 0, medicine: 0, procedure: proc.price }).total, true).kind,
    };
  }

  // ---------- Castração, internação e busca ----------

  /** Deixa o gato para castrar: paga, ocupa um leito e uma vaga do dia; de manhã a Fernanda traz ao cercadinho. */
  bookNeuter(catId: string): { ok: true } | { ok: false; reason: ClinicProblem | NeuterBlock | 'no_beds' | 'no_slots' } {
    if (!this.h.atClinic()) return { ok: false, reason: 'not_at_clinic' };
    if (this.h.carriedCat() !== catId) return { ok: false, reason: 'bring_cat' };
    const exam = this.exam(catId);
    if (!exam) return { ok: false, reason: 'not_examined' };
    // Já castrado: a Fernanda avisa e não opera (nem cobra).
    if (exam.neuter) return { ok: false, reason: exam.neuter.block };
    // Castração: paga junto a dívida anterior (retroativa); sem dinheiro e sem dívida, fica no fiado.
    const plan = payPlan(this.h.clinic, this.st.clinic, this.st.money, exam.neuterPrice, true);
    if (plan.kind === 'no_money') return { ok: false, reason: 'no_money' };
    if (plan.kind === 'cash' && this.st.clinic.debt > 0) {
      const old = this.st.clinic.debt;
      this.st.clinic.debt = 0;
      this.h.addMoney(-old, 'vet:debt');
      this.h.bus.emit('clinic.debt_paid', { amount: old });
    }
    this.payConsult(exam.neuterPrice, 'vet:neuter', plan.kind === 'credit');
    const day = this.st.day;
    this.st.clinic.surgeries[String(day)] = (this.st.clinic.surgeries[String(day)] ?? 0) + 1;
    this.st.cats[catId]!.clinic = { stage: 'ward', until: day + 1, procedure: NEUTER, returnBy: 'vet' };
    this.h.dropCarriedCatAway();
    this.h.bus.emit('procedure.booked', { catId, procedure: NEUTER, returnDay: day + 1 });
    return { ok: true };
  }

  /** Deixa o gato na clínica até amanhã (ela busca). Precisa de leito livre. */
  leaveOvernight(catId: string): { ok: true } | { ok: false; reason: ClinicProblem | 'no_beds' } {
    if (!this.h.atClinic()) return { ok: false, reason: 'not_at_clinic' };
    if (this.h.carriedCat() !== catId) return { ok: false, reason: 'bring_cat' };
    if (!this.st.cats[catId]?.tests) return { ok: false, reason: 'not_examined' };
    if (this.wardCount() >= this.h.clinic.ward.beds) return { ok: false, reason: 'no_beds' };
    this.st.cats[catId]!.clinic = { stage: 'ward', until: this.st.day + 1, returnBy: 'player' };
    this.h.dropCarriedCatAway();
    return { ok: true };
  }

  /** Gatos que ela pode buscar hoje na clínica. */
  readyForPickup(): string[] {
    return Object.keys(this.st.cats).filter((id) => {
      const s = this.st.cats[id]!.clinic;
      return this.st.cats[id]!.sheltered && s?.stage === 'ward' && s.returnBy === 'player' && s.until <= this.st.day;
    });
  }

  /** Busca o gato na clínica: volta para o colo dela e, no café, junta-se aos outros. */
  pickUp(catId: string): { ok: true } | { ok: false; reason: ClinicProblem } {
    if (!this.h.atClinic()) return { ok: false, reason: 'not_at_clinic' };
    if (!this.readyForPickup().includes(catId)) return { ok: false, reason: 'not_ready' };
    if (!this.h.holdCat(catId)) return { ok: false, reason: 'not_here' };
    this.st.cats[catId]!.clinic = undefined;
    return { ok: true };
  }

  /** Complicação: ela leva o gato à clínica e a Fernanda resolve (grátis, faz parte da castração). Ele volta ao cercadinho. */
  recheck(catId: string): { ok: true } | { ok: false; reason: ClinicProblem } {
    if (!this.h.atClinic()) return { ok: false, reason: 'not_at_clinic' };
    if (this.h.carriedCat() !== catId) return { ok: false, reason: 'bring_cat' };
    const s = this.st.cats[catId]?.clinic;
    if (s?.stage !== 'isolation' || !s.complication) return { ok: false, reason: 'no_complication' };
    delete s.complication;
    this.h.bus.emit('clinic.complication_fixed', { catId });
    return { ok: true };
  }

  // ---------- O dia ----------

  /**
   * Manhã: quem foi operado volta (a Fernanda traz ao cercadinho, com o remédio e as latinhas); quem terminou o
   * cercadinho volta para a turma. Chamado depois de virar o dia.
   */
  morning(): void {
    const day = this.st.day;
    const proc = this.neuterDef();
    for (const [id, cat] of Object.entries(this.st.cats)) {
      const s = cat.clinic;
      if (!cat.sheltered || !s) continue;
      if (s.stage === 'ward' && s.returnBy === 'vet' && s.until <= day && s.procedure) {
        cat.repro!.status = 'neutered';
        cat.repro!.known = 'neutered';
        cat.clinic = { stage: 'isolation', until: day + proc.isolationDays, procedure: s.procedure };
        if (proc.aftercareDays > 0) {
          cat.aftercare = { days: proc.aftercareDays, dosesGiven: 0, lastDoseDay: null };
          const med = this.h.health.medicine.item;
          this.st.inventory[med] = (this.st.inventory[med] ?? 0) + proc.aftercareDays;
        }
        const food = this.h.clinic.pen.food;
        this.st.inventory[food] = (this.st.inventory[food] ?? 0) + proc.recoveryCans;
        this.st.flags['vet.neutered_once'] = true;
        this.h.bus.emit('cat.neutered', { catId: id, procedure: s.procedure });
        const inPen = !this.penAssignments().box.includes(id);
        // Sem vaga no cercadinho: fica na caixinha de transporte até ela levar a caixinha a um cercadinho.
        if (!inPen) (cat.clinic as { boxed?: boolean }).boxed = true;
        // A primeira entrega: a Fernanda explica as fraldas do cercadinho e as latinhas.
        const first = !this.st.flags['vet.first_delivery'];
        this.st.flags['vet.first_delivery'] = true;
        this.h.bus.emit('clinic.delivered', { catId: id, inPen, first, isolationDays: proc.isolationDays, aftercareDays: proc.aftercareDays });
        if (rngForCat(id, day * 31 + 7).next() < proc.complication.chance) this.complicate(id);
      } else if (s.stage === 'isolation' && s.until <= day && !s.complication) {
        cat.clinic = undefined;
        this.h.bus.emit('clinic.released', { catId: id });
      }
    }
  }

  /** Fim do dia: gato no cercadinho que ficou sem comer pode ter uma complicação pequena (com chance). */
  dayEnded(day: number): void {
    const proc = this.neuterDef();
    for (const [id, cat] of Object.entries(this.st.cats)) {
      const s = cat.clinic;
      if (!cat.sheltered || s?.stage !== 'isolation' || s.complication || cat.fedOn === day) continue;
      if (rngForCat(id, day * 37 + 11).next() < proc.complication.missedFeedChance) this.complicate(id, true);
    }
  }

  private complicate(catId: string, missedFeed = false): void {
    const s = this.st.cats[catId]?.clinic;
    if (s?.stage !== 'isolation') return;
    s.complication = true;
    this.h.bus.emit('clinic.complication', { catId, missedFeed });
  }

  // ---------- Efeitos e adoção ----------

  /** Efeitos do gato castrado (dados): confiança mais fácil e mais tempo de distração no remédio. */
  effects(catId: string): { trustEasier: number; pillWindow: number } {
    const r = this.st.cats[catId]?.repro;
    if (r?.status !== 'neutered') return { trustEasier: 0, pillWindow: 1 };
    const e = this.neuterDef().effects;
    return { trustEasier: e.trustEasier ?? 0, pillWindow: e.pillWindow ?? 1 };
  }

  /**
   * O gato pode ir para adoção? null = pode. Só depois de castrado (e de a Fernanda confirmar); novo demais: aguarda a
   * idade (com o dia estimado). Na clínica ou no cercadinho, também não.
   */
  adoptionBlock(catId: string): { reason: 'in_care' | 'needs_neuter' | 'waiting_age'; readyDay?: number } | null {
    const cat = this.st.cats[catId];
    if (!cat?.repro) return null;
    if (!this.withOthers(catId)) return { reason: 'in_care' };
    if (cat.repro.known === 'neutered') return null;
    const block = neuterBlock(this.h.clinic, this.neuterDef(), { repro: cat.repro, health: cat.health, sick: false }, this.st.day);
    if (block?.block === 'too_young') return { reason: 'waiting_age', readyDay: block.readyDay! };
    return { reason: 'needs_neuter' };
  }
}
