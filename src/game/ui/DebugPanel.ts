// Painel do modo debug (só em `npm run dev`, com o debug ligado).
import type { GameSession } from '../../core/session';
import { weatherOf } from '../../core/calendar';

export interface DebugActions {
  skipDialogue(): void;
  toggleCollision(): boolean;
  toggleGrid(): boolean;
  newGame(): void;
  turnOff(): void;
  /** Abre um mini game direto (sem missão). */
  openMiniGame(gameId: string, difficulty: 'easy' | 'normal' | 'hard'): void;
  miniGames(): string[];
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
        <button data-act="rep">+10 reputação</button>
        <button data-act="rep-zero">Zerar reputação</button>
        <button data-act="fair">Feira: começar</button>
        <button data-act="fair-day">Feira: ir ao dia</button>
        ${session.content.arrivals.arrivals.map((a) => `<button data-arrival="${a.id}">chegada ${a.id.replace('arr.', '')}</button>`).join('')}
        <button data-act="skip">Pular falas</button>
        <button data-act="collision">Colisão</button>
        <button data-act="grid">Grade</button>
        <button data-act="new">Jogo novo</button>
        <button data-act="off">Desligar</button>
      </div>
      <div class="buttons minigames">${actions
        .miniGames()
        .map((id) => ['easy', 'normal', 'hard'].map((d) => `<button data-mg="${id}" data-dif="${d}">${id} ${d}</button>`).join(''))
        .join('')}</div>
      <div class="status"></div>`;
    root.appendChild(panel);
    this.status = panel.querySelector('.status') as HTMLElement;

    const on = (act: string, fn: (btn: HTMLButtonElement) => void) => {
      const btn = panel.querySelector(`[data-act="${act}"]`) as HTMLButtonElement;
      btn.addEventListener('click', () => fn(btn));
    };
    on('money', () => session.addMoney(100, 'debug'));
    on('rep', () => session.addReputation(10, 'debug'));
    // Feira de adoção sem precisar dos 9 gatos; e pular os dias até a data marcada (de manhã).
    on('fair', () => session.debugStartFair());
    on('fair-day', () => {
      const day = session.state.fair.day;
      if (day !== null && session.state.day < day) {
        session.state.day = day;
        session.state.time = 9 * 60;
        session.bus.emit('day.started', { day });
      }
    });
    // Zerar também esquece os limiares alcançados (para testar os eventos de novo).
    on('rep-zero', () => {
      session.addReputation(-session.reputation(), 'debug:zerar');
      session.state.reputation.reached = [];
    });
    on('skip', () => actions.skipDialogue());
    on('collision', (b) => b.classList.toggle('on', actions.toggleCollision()));
    on('grid', (b) => b.classList.toggle('on', actions.toggleGrid()));
    on('new', () => actions.newGame());
    on('off', () => actions.turnOff());
    // Chegadas: põe na fila agora (ignora o gatilho e o sorteio; respeita a vez).
    panel.querySelectorAll<HTMLButtonElement>('[data-arrival]').forEach((b) => b.addEventListener('click', () => session.arrivals.queueNow(b.dataset.arrival!)));
    panel.querySelectorAll<HTMLButtonElement>('[data-mg]').forEach((b) =>
      b.addEventListener('click', () => actions.openMiniGame(b.dataset.mg!, b.dataset.dif as 'easy' | 'normal' | 'hard')),
    );

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
    const rep = this.session.state.reputation;
    const last = rep.log.slice(-3).map((e) => `${e.amount > 0 ? '+' : ''}${e.amount} ${e.reason}`).join(', ');
    // Chegadas de gatos: a em andamento, a fila, a próxima sorteada e o clima do dia.
    const ar = this.session.state.arrivals;
    const weather = weatherOf(this.session.content.seasons, this.session.state.day);
    const arrivals = `chegada ${ar.active ? `${ar.active.id} (${ar.active.catId})` : '-'} · fila ${ar.queue.length} · próxima ${ar.nextOn ?? '-'} · clima ${weather}`;
    this.status.textContent = `célula ${this.cell} · reputação ${rep.value}${last ? ` (${last})` : ''} · ${arrivals} · marcos: ${done}`;
  }
}
