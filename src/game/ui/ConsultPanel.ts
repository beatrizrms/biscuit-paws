// Balcão da clínica da Fernanda (E no balcão). Com o gato no colo: a consulta de entrada (testes, castração),
// a ficha do gato já examinado (castrar, deixar até amanhã, levar), a consulta de doença ou o pontinho inflamado.
// De mãos livres: buscar quem dormiu na clínica. Quem decide tudo é o núcleo (session -> clinicFlow.ts).
import type { GameSession } from '../../core/session';
import type { ExamResult } from '../../core/clinicFlow';
import { content, uiText } from '../content';
import { iconHtml } from './ShopPanel';
import { catSexText, vetLine } from './vetText';

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
const fill = (s: string, v: Record<string, string | number>) => s.replace(/\{(\w+)\}/g, (_m, k: string) => String(v[k] ?? ''));

type Mode = { kind: 'sick'; catId: string } | { kind: 'intake'; catId: string } | { kind: 'exam'; catId: string; lines: string[] } | { kind: 'recheck'; catId: string } | { kind: 'pickup'; cats: string[] };

export class ConsultPanel {
  private el: HTMLElement;
  private body: HTMLElement;
  private title: HTMLElement;
  private mode: Mode | null = null;

  constructor(
    root: HTMLElement,
    private session: GameSession,
    private onChange: () => void,
    private onProblem: (reason: string) => void,
    private onDone: (text: string) => void,
  ) {
    this.el = document.createElement('section');
    this.el.className = 'panel catalog consult';
    this.el.innerHTML = `<header><h2>${uiText.consult.title}</h2><button class="close">${uiText.consult.close}</button></header><div class="list"></div>`;
    root.appendChild(this.el);
    this.body = this.el.querySelector('.list') as HTMLElement;
    this.title = this.el.querySelector('h2') as HTMLElement;
    (this.el.querySelector('.close') as HTMLElement).addEventListener('click', () => this.close());
    this.body.addEventListener('click', (e) => {
      const b = (e.target as HTMLElement).closest('[data-act]') as HTMLElement | null;
      if (b) this.act(b.dataset.act!, b.dataset.cat);
    });
  }

  isOpen(): boolean {
    return this.mode !== null;
  }

  /** Abre o balcão pelo que ela traz: o gato no colo (entrada, ficha, doença, pontinho) ou nada (buscar). */
  open(): void {
    const desk = this.session.clinicDesk();
    const id = desk.carried;
    if (id) {
      const cat = this.session.state.cats[id];
      if (desk.recheck) this.mode = { kind: 'recheck', catId: id };
      else if (desk.intake) {
        const q = this.session.clinicIntakeQuote(id);
        if ('problem' in q) return this.onProblem(q.problem);
        this.mode = { kind: 'intake', catId: id };
      } else if (cat?.sickness && !cat.sickness.treatment) {
        const q = this.session.consultQuote(id);
        if ('problem' in q) return this.onProblem(q.problem);
        this.mode = { kind: 'sick', catId: id };
      } else if (desk.examined) this.mode = { kind: 'exam', catId: id, lines: [vetLine(this.session, 'intake.hello', {}, id)] };
      else {
        const q = this.session.consultQuote(id);
        if ('problem' in q) return this.onProblem(q.problem);
        this.mode = { kind: 'sick', catId: id };
      }
    } else if (desk.pickups.length > 0) this.mode = { kind: 'pickup', cats: desk.pickups };
    else return this.onProblem('bring_cat');
    this.render();
    this.el.classList.add('open');
    this.onChange();
  }

  close(): void {
    if (!this.mode) return;
    this.mode = null;
    this.el.classList.remove('open');
    this.onChange();
  }

  private act(act: string, catId?: string): void {
    const m = this.mode;
    if (!m) return;
    const s = this.session;
    const t = uiText.consult;
    if (act === 'pay-sick' && m.kind === 'sick') {
      const q = s.consultQuote(m.catId);
      const r = s.consult(m.catId);
      if (!r.ok) return this.onProblem(r.reason);
      this.close();
      if (!('problem' in q)) this.onDone(fill(q.onCredit ? t.doneCredit : t.done, { days: q.days }));
    } else if (act === 'pay-intake' && m.kind === 'intake') {
      const r = s.clinicIntake(m.catId);
      if (!r.ok) return this.onProblem(r.reason);
      this.mode = { kind: 'exam', catId: m.catId, lines: this.examLines(r.exam) };
      this.render();
    } else if (act === 'neuter' && m.kind === 'exam') {
      const r = s.clinicBookNeuter(m.catId);
      if (!r.ok) return this.onProblem(r.reason);
      this.close();
      this.onDone(vetLine(s, 'neuter.booked', {}, m.catId));
    } else if (act === 'home' && m.kind === 'exam') {
      this.close();
      this.onDone(vetLine(s, 'intake.takeHome', {}, m.catId));
    } else if (act === 'recheck' && m.kind === 'recheck') {
      const r = s.clinicRecheck(m.catId);
      if (!r.ok) return this.onProblem(r.reason);
      this.close();
      this.onDone(vetLine(s, 'neuter.complicationFixed', {}, m.catId));
    } else if (act === 'pickup' && m.kind === 'pickup' && catId) {
      const r = s.clinicPickUp(catId);
      if (!r.ok) return this.onProblem(r.reason);
      this.close();
      this.onDone(vetLine(s, 'pickup.ready', {}, catId));
    }
  }

  /** O que a Fernanda diz depois do exame: testes, saúde e castração. */
  private examLines(exam: ExamResult): string[] {
    const s = this.session;
    const id = exam.catId;
    const disease = exam.disease ? (content.health.diseases.find((d) => d.id === exam.disease)?.name ?? exam.disease) : '';
    const lines = [vetLine(s, 'intake.tests', {}, id), vetLine(s, 'intake.testsNegative', {}, id), vetLine(s, exam.disease ? 'intake.sick' : 'intake.healthy', { disease }, id)];
    if (exam.earTipped) lines.push(vetLine(s, 'intake.earTipped', {}, id));
    else if (exam.status === 'neutered') lines.push(vetLine(s, 'intake.neutered', {}, id));
    else lines.push(this.neuterLine(exam));
    return lines;
  }

  /** A fala sobre a castração de quem ainda é inteiro. */
  private neuterLine(exam: ExamResult): string {
    const s = this.session;
    const id = exam.catId;
    const b = exam.neuter?.block;
    if (!b) return vetLine(s, 'intake.intact', {}, id);
    const key: Record<string, string> = { too_young: 'intake.tooYoung', too_thin: 'intake.tooThin', too_weak: 'intake.tooWeak', sick: 'intake.sickFirst', no_beds: 'intake.noBeds', no_slots: 'intake.noSlots', already_neutered: 'neuter.alreadyNeutered' };
    return vetLine(s, key[b] ?? 'intake.intact', { day: exam.neuter?.readyDay ?? '' }, id);
  }

  private render(): void {
    const m = this.mode;
    if (!m) return;
    const c = uiText.clinic;
    const cur = content.economy.currency;
    const s = this.session;
    this.title.textContent = m.kind === 'sick' ? uiText.consult.title : c.title;
    if (m.kind === 'sick') return this.renderSick(m.catId);
    if (m.kind === 'pickup') {
      this.body.innerHTML = `<p class="patient">${c.pickupTitle}</p>${m.cats
        .map((id) => `<button class="pay" data-act="pickup" data-cat="${esc(id)}">${esc(fill(c.pickup, { name: s.catName(id) }))}</button>`)
        .join('')}`;
      return;
    }
    const name = esc(s.catName(m.catId));
    if (m.kind === 'recheck') {
      this.body.innerHTML = `<p class="patient">${esc(vetLine(s, 'neuter.complication', {}, m.catId))}</p><button class="pay" data-act="recheck">${c.recheck}</button>`;
      return;
    }
    if (m.kind === 'intake') {
      const q = s.clinicIntakeQuote(m.catId);
      if ('problem' in q) return this.close();
      this.body.innerHTML = `
        <p class="patient">${fill(c.intakeTitle, { name })}</p>
        <p class="vet-line">${esc(vetLine(s, 'intake.hello', {}, m.catId))}</p>
        <p class="desc">${esc(fill(c.intakeIntro, { name: s.catName(m.catId) }))}</p>
        <div class="bill">
          <span>${c.consultPrice}</span><b>${q.consult} ${cur}</b>
          ${q.medicine ? `<span>${c.medicinePrice.replace('{days}', String(q.medicine / content.health.prices.medicinePerDay))}</span><b>${q.medicine} ${cur}</b>` : ''}
          ${q.discount ? `<span>${c.discount}</span><b>-${q.discount} ${cur}</b>` : ''}
          <span class="total">${c.total}</span><b class="total">${q.total} ${cur}</b>
        </div>
        ${q.onCredit ? `<p class="credit">${c.creditNote}</p>` : ''}
        <button class="pay" data-act="pay-intake">${q.onCredit ? c.payCredit : fill(c.pay, { total: `${q.total} ${cur}` })}</button>`;
      return;
    }
    // Ficha do gato examinado: o que ela sabe agora e o que fazer.
    const exam = s.clinicExam(m.catId);
    if (!exam) return this.close();
    const profile = s.catProfiles().find((p) => p.id === m.catId);
    const sex = uiText.cats.sex[exam.sex];
    const age = exam.ageMonths >= 24 ? fill(c.ageYears, { n: Math.floor(exam.ageMonths / 12) }) : fill(c.ageMonths, { n: exam.ageMonths });
    const status = catSexText(s, uiText.cats.repro[profile?.repro.known ?? 'unknown'], m.catId);
    const tests = Object.values(exam.tests).every((r) => r === 'negative') ? c.testNegative : '?';
    const lines = m.lines.length > 1 ? m.lines : [...m.lines, this.neuterLineOrStatus(exam)];
    this.body.innerHTML = `
      <p class="patient">${fill(c.examTitle, { name })}</p>
      ${lines.map((l) => `<p class="vet-line">${esc(l)}</p>`).join('')}
      <div class="bill">
        <span>${c.sex}</span><b>${esc(sex)}</b>
        <span>${c.age}</span><b>${esc(age)}</b>
        <span>${c.weight}</span><b>${esc(fill(c.weightKg, { n: exam.weightKg.toLocaleString('pt-BR') }))}</b>
        <span>${c.tests}</span><b>${esc(tests)}</b>
        <span>${c.status}</span><b>${esc(status)}${exam.earTipped ? ` · ${esc(uiText.cats.earTipped)}` : ''}</b>
      </div>
      <div class="options">${this.neuterOption(exam)}${this.option('home', exam.neuter ? c.takeHomeDone : c.takeHome)}</div>`;
  }

  // Sem castração a fazer agora (já castrado, novo demais...): o único botão é levar para o café.
  /** Um botão de opção (a fala da Fernanda, acima, já explica o que acontece); `note` só quando ele não dá. */
  private option(act: string, title: string, note = '', disabled = false): string {
    return `<button class="pay" data-act="${act}"${disabled ? ' disabled' : ''}>${esc(title)}</button>${note ? `<p class="desc note">${esc(note)}</p>` : ''}`;
  }

  /** A opção de castrar: à vista (com a conta anterior junto), no fiado ou sem dinheiro. Não opera: sem cartão. */
  private neuterOption(exam: ExamResult): string {
    if (exam.neuter) return '';
    const c = uiText.clinic;
    const cur = content.economy.currency;
    const price = `${exam.neuterPrice} ${cur}`;
    if (exam.neuterPay === 'no_money') return this.option('neuter', fill(c.neuter, { price }), fill(c.neuterNoMoney, { debt: `${exam.debt} ${cur}` }), true);
    if (exam.neuterPay === 'credit') return this.option('neuter', c.neuterCredit);
    // A conta anterior (fiado) vem junto no preço.
    return this.option('neuter', fill(c.neuter, { price: `${exam.neuterPrice + exam.debt} ${cur}` }));
  }

  /** Ficha reaberta (gato trazido depois): a fala sobre a castração pelo estado de agora. */
  private neuterLineOrStatus(exam: ExamResult): string {
    if (exam.status === 'neutered') return vetLine(this.session, exam.earTipped ? 'intake.earTipped' : 'intake.neutered', {}, exam.catId);
    return this.neuterLine(exam);
  }

  /** Consulta de doença (gato doente sem receita): diagnóstico, receita e preço. */
  private renderSick(catId: string): void {
    const t = uiText.consult;
    const q = this.session.consultQuote(catId);
    if ('problem' in q) return this.close();
    const disease = content.health.diseases.find((d) => d.id === q.disease);
    const cur = content.economy.currency;
    const medicine = content.items[content.health.medicine.item];
    this.body.innerHTML = `
      <p class="patient">${fill(t.patient, { name: esc(this.session.catName(catId)) })}</p>
      <div class="diagnosis"><span class="label">${t.diagnosis}</span><strong>${esc(disease?.name ?? q.disease)}</strong><span class="desc">${esc(disease?.description ?? '')}</span></div>
      <div class="prescription">${iconHtml(medicine?.icon, 16)}<span>${fill(t.prescription, { days: q.days })}</span></div>
      <div class="bill">
        <span>${t.consultPrice}</span><b>${q.consult} ${cur}</b>
        <span>${fill(t.medicinePrice, { days: q.days, each: content.health.prices.medicinePerDay })}</span><b>${q.medicine} ${cur}</b>
        ${q.discount ? `<span>${uiText.clinic.discount}</span><b>-${q.discount} ${cur}</b>` : ''}
        <span class="total">${t.total}</span><b class="total">${q.total} ${cur}</b>
      </div>
      ${q.onCredit ? `<p class="credit">${t.credit}</p>` : ''}
      <button class="pay" data-act="pay-sick">${q.onCredit ? t.payCredit : fill(t.pay, { total: q.total })}</button>`;
  }
}
