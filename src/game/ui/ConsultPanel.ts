// Consulta na clínica da Fernanda: com o gato doente no colo, E no balcão abre a ficha (diagnóstico, receita,
// preço). "Pagar" faz a consulta pela sessão; a primeira pode ficar fiado. Quem decide tudo é o núcleo (session.consult).
import type { GameSession } from '../../core/session';
import { content, uiText } from '../content';
import { iconHtml } from './ShopPanel';

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
const fill = (s: string, v: Record<string, string | number>) => s.replace(/\{(\w+)\}/g, (_m, k: string) => String(v[k] ?? ''));

export class ConsultPanel {
  private el: HTMLElement;
  private body: HTMLElement;
  private catId: string | null = null;

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
    (this.el.querySelector('.close') as HTMLElement).addEventListener('click', () => this.close());
    this.body.addEventListener('click', (e) => {
      if ((e.target as HTMLElement).closest('[data-pay]')) this.pay();
    });
  }

  isOpen(): boolean {
    return this.catId !== null;
  }

  /** Abre a ficha do gato que está no colo (ou avisa por que não dá). */
  open(): void {
    const catId = this.session.service.carriedCat() ?? this.session.shelteredCats()[0] ?? '';
    const q = this.session.consultQuote(catId);
    if ('problem' in q) return this.onProblem(q.problem);
    this.catId = catId;
    this.render();
    this.el.classList.add('open');
    this.onChange();
  }

  close(): void {
    if (!this.catId) return;
    this.catId = null;
    this.el.classList.remove('open');
    this.onChange();
  }

  private pay(): void {
    if (!this.catId) return;
    const q = this.session.consultQuote(this.catId);
    const r = this.session.consult(this.catId);
    if (!r.ok) return this.onProblem(r.reason);
    const t = uiText.consult;
    this.close();
    if (!('problem' in q)) this.onDone(fill(q.onCredit ? t.doneCredit : t.done, { days: q.days }));
  }

  private render(): void {
    if (!this.catId) return;
    const t = uiText.consult;
    const q = this.session.consultQuote(this.catId);
    if ('problem' in q) return this.close();
    const disease = content.health.diseases.find((d) => d.id === q.disease);
    const cur = content.economy.currency;
    const medicine = content.items[content.health.medicine.item];
    this.body.innerHTML = `
      <p class="patient">${fill(t.patient, { name: esc(this.session.catName(this.catId)) })}</p>
      <div class="diagnosis"><span class="label">${t.diagnosis}</span><strong>${esc(disease?.name ?? q.disease)}</strong><span class="desc">${esc(disease?.description ?? '')}</span></div>
      <div class="prescription">${iconHtml(medicine?.icon, 16)}<span>${fill(t.prescription, { days: q.days })}</span></div>
      <div class="bill">
        <span>${t.consultPrice}</span><b>${q.consult} ${cur}</b>
        <span>${fill(t.medicinePrice, { days: q.days, each: content.health.prices.medicinePerDay })}</span><b>${q.medicine} ${cur}</b>
        <span class="total">${t.total}</span><b class="total">${q.total} ${cur}</b>
      </div>
      ${q.onCredit ? `<p class="credit">${t.credit}</p>` : ''}
      <button class="pay" data-pay>${q.onCredit ? t.payCredit : fill(t.pay, { total: q.total })}</button>`;
  }
}
