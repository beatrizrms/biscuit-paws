// Interface em HTML por cima do canvas: dinheiro, diário de metas, falas, catálogo e avisos.
// Só mostra o estado da sessão e repassa os cliques; as regras ficam no core.
import type { GameSession } from '../../core/session';
import { content, uiText } from '../content';

type HintMode = 'walk' | 'placing' | 'dialogue';

const TYPE_SPEED_MS = 22;

export interface UiHandlers {
  /** A jogadora escolheu um item que já está na bolsa: começar a posicionar. */
  onPlace(itemId: string): void;
}

export class GameUi {
  private money: HTMLElement;
  private goals: HTMLElement;
  private hint: HTMLElement;
  private toastEl: HTMLElement;
  private dialogueLayer: HTMLElement;
  private dialogueBox: HTMLElement;
  private catalog: HTMLElement;
  private catalogList: HTMLElement;

  private dialogueQueue: { speaker: string; text: string }[] = [];
  private typing: { full: string; shown: number; timer: number } | null = null;
  private toastTimer = 0;
  private hintMode: HintMode = 'walk';
  /** Mudanças no HUD esperam a fala acabar (o dinheiro não sobe antes da fala que o explica). */
  private hudPending = false;
  /** Meta mostrada agora (para animar o pensamento quando ela muda). */
  private shownGoal: string | undefined;

  constructor(
    private root: HTMLElement,
    private session: GameSession,
    private handlers: UiHandlers,
    private debug = false,
  ) {
    root.innerHTML = `
      <div class="panel hud-goals"></div>
      <div class="panel hud-money"><span class="coin"></span><span class="amount"></span></div>
      <div class="hint"></div>
      <div class="toast" role="status"></div>
      <section class="panel catalog" aria-label="${uiText.catalogTitle}">
        <header><h2>${uiText.catalogTitle}</h2><button class="close" title="Fechar (C)">fechar</button></header>
        <div class="list"></div>
      </section>
      <div class="dialogue-layer">
        <div class="panel dialogue"><span class="speaker"></span><span class="text"></span><span class="more">▼</span></div>
      </div>`;
    const $ = (sel: string) => root.querySelector(sel) as HTMLElement;
    this.money = $('.hud-money');
    this.goals = $('.hud-goals');
    this.hint = $('.hint');
    this.toastEl = $('.toast');
    this.dialogueLayer = $('.dialogue-layer');
    this.dialogueBox = $('.dialogue');
    this.catalog = $('.catalog');
    this.catalogList = $('.catalog .list');

    $('.catalog .close').addEventListener('click', () => this.closeCatalog());
    this.dialogueLayer.addEventListener('click', () => this.advanceDialogue());
    window.addEventListener('keydown', (e) => {
      if (!this.isDialogueOpen()) return;
      if (e.code === 'Space' || e.code === 'Enter') {
        e.preventDefault();
        this.advanceDialogue();
      }
    });

    const bus = session.bus;
    bus.on('dialogue.requested', ({ dialogueId }) => this.queueDialogue(dialogueId));
    bus.on('money.changed', () => this.refresh(true));
    bus.onAny(() => this.refresh());
    this.refresh();
  }

  /** Falas ou catálogo abertos: a personagem não anda. */
  isBusy(): boolean {
    return this.isDialogueOpen() || this.isCatalogOpen();
  }

  isDialogueOpen(): boolean {
    return this.dialogueLayer.classList.contains('open');
  }

  isCatalogOpen(): boolean {
    return this.catalog.classList.contains('open');
  }

  toggleCatalog(): void {
    if (this.isCatalogOpen()) this.closeCatalog();
    else if (!this.isDialogueOpen()) {
      this.renderCatalog();
      this.catalog.classList.add('open');
    }
  }

  closeCatalog(): void {
    this.catalog.classList.remove('open');
  }

  setHint(mode: HintMode): void {
    this.hintMode = mode;
    this.renderHint();
  }

  toast(text: string): void {
    this.toastEl.textContent = text;
    this.toastEl.classList.add('show');
    window.clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => this.toastEl.classList.remove('show'), 1600);
  }

  problem(reason: keyof typeof uiText.problems): void {
    this.toast(uiText.problems[reason] ?? reason);
  }

  /** Modo debug: fecha todas as falas de uma vez. */
  skipDialogue(): void {
    this.dialogueQueue = [];
    if (this.typing) window.clearInterval(this.typing.timer);
    this.typing = null;
    if (this.isDialogueOpen()) this.closeDialogue();
  }

  private refresh(bumpMoney = false): void {
    if (this.isDialogueOpen()) {
      this.hudPending = true;
      return;
    }
    const { state } = this.session;
    (this.money.querySelector('.amount') as HTMLElement).textContent = `${state.money} ${content.economy.currency}`;
    if (bumpMoney) {
      this.money.classList.remove('bump');
      void this.money.offsetWidth; // reinicia a animação
      this.money.classList.add('bump');
    }

    const goal = this.session.goals()[0];
    if (goal?.beatId !== this.shownGoal) {
      this.shownGoal = goal?.beatId;
      this.goals.classList.remove("new");
      void this.goals.offsetWidth; // reinicia a animação
      this.goals.classList.add("new");
    }
    this.goals.innerHTML = goal
      ? `<h2>${uiText.goalsTitle}</h2><h3>${esc(goal.title)}</h3><ul>${goal.steps
          .map((s) => {
            const note = this.debug && s.devNote ? `<span class="dev">${esc(s.devNote)}</span>` : '';
            return `<li class="${s.done ? 'done' : ''}"><span>${esc(s.text)}${note}</span></li>`;
          })
          .join('')}</ul>`
      : '';

    if (this.isCatalogOpen()) this.renderCatalog();
    this.renderHint();
  }

  private renderHint(): void {
    const mode = this.isDialogueOpen() ? 'dialogue' : this.hintMode;
    this.hint.textContent = mode === 'dialogue' ? uiText.hintDialogue : mode === 'placing' ? uiText.hintPlacing : uiText.hintWalk;
  }

  private renderCatalog(): void {
    const { state } = this.session;
    const items = Object.values(content.items).filter((i) => !i.deprecated);
    this.catalogList.innerHTML = uiText.catalogSections
      .map((section) => {
        const rows = items
          .filter((i) => i.tags.includes(section.tag))
          .filter((i) => uiText.catalogSections.find((s) => i.tags.includes(s.tag)) === section) // cada item numa seção só
          .map((i) => {
            const owned = state.inventory[i.id] ?? 0;
            const disabled = owned === 0 && state.money < i.price;
            return `<button class="row" data-item="${i.id}" ${disabled ? 'disabled' : ''}>
              <span>${esc(i.name)}</span><span class="price">${i.price}</span>
              ${owned > 0 ? `<span class="owned">${owned} ${uiText.inBag}</span>` : ''}
            </button>`;
          })
          .join('');
        return rows ? `<h3>${esc(section.title)}</h3>${rows}` : '';
      })
      .join('') + this.renderRenovation();
    this.catalogList.querySelectorAll<HTMLButtonElement>('.row[data-item]').forEach((btn) =>
      btn.addEventListener('click', () => this.pick(btn.dataset.item!)),
    );
    this.catalogList.querySelectorAll<HTMLButtonElement>('.row[data-finish]').forEach((btn) =>
      btn.addEventListener('click', () => this.paint(btn.dataset.surface!, btn.dataset.finish!)),
    );
  }

  /** Seção do pintor: para cada superfície, os acabamentos que servem nela. */
  private renderRenovation(): string {
    const { state } = this.session;
    const finishes = Object.values(content.finishes);
    const blocks = this.session
      .surfaces()
      .map((surface) => {
        const rows = finishes
          .filter((f) => f.kind === surface.kind)
          .map((f) => {
            const current = state.finishes[surface.id] === f.id;
            const disabled = current || state.money < f.price;
            return `<button class="row" data-surface="${surface.id}" data-finish="${f.id}" ${disabled ? 'disabled' : ''}>
              <span>${esc(f.name)}</span><span class="price">${current ? uiText.current : f.price}</span>
            </button>`;
          })
          .join('');
        return `<h4>${esc(surface.name)}</h4>${rows}`;
      })
      .join('');
    return blocks ? `<h3>${esc(uiText.renovationTitle)}</h3><p class="note">${esc(uiText.renovationHint)}</p>${blocks}` : '';
  }

  private paint(surfaceId: string, finishId: string): void {
    const result = this.session.paint(surfaceId, finishId);
    if (!result.ok) return this.problem(result.reason);
    this.closeCatalog();
    this.toast(uiText.painted);
  }

  /** Item da bolsa: posiciona. Senão: compra e posiciona. */
  private pick(itemId: string): void {
    if ((this.session.state.inventory[itemId] ?? 0) === 0) {
      const result = this.session.buy(itemId);
      if (!result.ok) return this.problem(result.reason);
    }
    this.closeCatalog();
    this.handlers.onPlace(itemId);
  }

  private queueDialogue(dialogueId: string): void {
    const lines = content.dialogue.dialogues[dialogueId]?.lines ?? [];
    this.dialogueQueue.push(...lines);
    if (!this.isDialogueOpen()) {
      this.closeCatalog();
      this.dialogueLayer.classList.add('open');
      this.advanceDialogue();
    }
  }

  /** Mostra a próxima fala; se a atual ainda está sendo escrita, completa. */
  private advanceDialogue(): void {
    const textEl = this.dialogueBox.querySelector('.text') as HTMLElement;
    if (this.typing) {
      window.clearInterval(this.typing.timer);
      textEl.textContent = this.typing.full;
      this.typing = null;
      return;
    }
    const line = this.dialogueQueue.shift();
    if (!line) return this.closeDialogue();
    (this.dialogueBox.querySelector('.speaker') as HTMLElement).textContent = line.speaker;
    this.dialogueBox.classList.toggle('narrator', line.speaker === uiText.narrator);
    textEl.textContent = '';
    const typing = { full: line.text, shown: 0, timer: 0 };
    typing.timer = window.setInterval(() => {
      typing.shown++;
      textEl.textContent = typing.full.slice(0, typing.shown);
      if (typing.shown >= typing.full.length) {
        window.clearInterval(typing.timer);
        this.typing = null;
      }
    }, TYPE_SPEED_MS);
    this.typing = typing;
    this.renderHint();
  }

  private closeDialogue(): void {
    this.dialogueLayer.classList.remove('open');
    if (this.hudPending) {
      this.hudPending = false;
      this.refresh(true);
    }
    this.renderHint();
  }
}

function esc(text: string): string {
  return text.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
}
