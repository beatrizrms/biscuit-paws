// Painel do modo debug (só em `npm run dev`, com o debug ligado).
import type { GameSession } from '../../core/session';

export interface DebugActions {
  skipDialogue(): void;
  toggleCollision(): boolean;
  toggleGrid(): boolean;
  newGame(): void;
  turnOff(): void;
}

export class DebugPanel {
  private status: HTMLElement;
  private cell = '-';

  constructor(
    root: HTMLElement,
    private session: GameSession,
    actions: DebugActions,
  ) {
    const panel = document.createElement('section');
    panel.className = 'panel debug-panel';
    panel.innerHTML = `
      <header><strong>DEBUG</strong> · save de teste · F9 desliga</header>
      <div class="buttons">
        <button data-act="money">+100 moedas</button>
        <button data-act="skip">Pular falas</button>
        <button data-act="collision">Colisão</button>
        <button data-act="grid">Grade</button>
        <button data-act="new">Jogo novo</button>
        <button data-act="off">Desligar</button>
      </div>
      <div class="status"></div>`;
    root.appendChild(panel);
    this.status = panel.querySelector('.status') as HTMLElement;

    const on = (act: string, fn: (btn: HTMLButtonElement) => void) => {
      const btn = panel.querySelector(`[data-act="${act}"]`) as HTMLButtonElement;
      btn.addEventListener('click', () => fn(btn));
    };
    on('money', () => session.addMoney(100, 'debug'));
    on('skip', () => actions.skipDialogue());
    on('collision', (b) => b.classList.toggle('on', actions.toggleCollision()));
    on('grid', (b) => b.classList.toggle('on', actions.toggleGrid()));
    on('new', () => actions.newGame());
    on('off', () => actions.turnOff());

    session.bus.onAny(() => this.render());
    this.render();
  }

  /** Célula sob o mouse, para posicionar coisas no mapa à mão. */
  setCell(col: number, row: number): void {
    this.cell = `${col},${row}`;
    this.render();
  }

  private render(): void {
    const done = this.session.state.story.completed.map((id) => id.replace('story.', '')).join(' → ') || 'nenhum';
    this.status.textContent = `célula ${this.cell} · marcos: ${done}`;
  }
}
