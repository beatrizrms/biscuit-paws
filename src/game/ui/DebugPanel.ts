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
  /** Resultado do botão "gatilhos agora". */
  private note = '';

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
      </div>
      <div class="buttons arrivals">
        <strong>Chegadas</strong>
        ${session.content.arrivals.arrivals.map((a) => `<button data-arrival="${a.id}">${a.id.replace('arr.', '')}</button>`).join('')}
        <select data-dbg="weather"><option value="">clima do dia</option>${[...new Set(Object.values(session.content.seasons.weather ?? {}).flatMap((w) => Object.keys(w)))].map((w) => `<option>${w}</option>`).join('')}</select>
        <button data-act="hour">+1 h</button>
        <button data-act="day">+1 dia</button>
        <button data-act="full">café cheio</button>
        <select data-dbg="personality">${Object.keys(session.content.catProfiles.personalities).map((p) => `<option>${p}</option>`).join('')}</select>
        <select data-dbg="condition">${Object.keys(session.content.catProfiles.conditions).map((c) => `<option>${c}</option>`).join('')}</select>
        <button data-act="gen-cat">gerar gato</button>
        <button data-act="triggers">gatilhos agora</button>
        <button data-act="skip">Pular falas</button>
        <button data-act="collision">Colisão</button>
        <button data-act="grid">Grade</button>
        <button data-act="new">Jogo novo</button>
        <button data-act="off">Desligar</button>
      </div>
      <div class="buttons care">
        <strong>Cuidados</strong>
        <select data-dbg="care-cat"></select>
        <button data-act="happy-up">alegria +20</button>
        <button data-act="happy-down">alegria −20</button>
        <button data-act="clean-up">higiene +20</button>
        <button data-act="clean-down">higiene −20</button>
        <button data-act="sick-rx">doente c/ receita</button>
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
    // Cuidados: o gato escolhido (a lista é refeita ao abrir, porque os gatos mudam durante o jogo).
    const careCat = panel.querySelector('[data-dbg="care-cat"]') as HTMLSelectElement;
    const fillCats = () => {
      const keep = careCat.value;
      careCat.innerHTML = session.shelteredCats().map((id) => `<option value="${id}">${session.catName(id) || id}</option>`).join('');
      if (keep && session.shelteredCats().includes(keep)) careCat.value = keep;
    };
    fillCats();
    careCat.addEventListener('mousedown', fillCats);
    careCat.addEventListener('focus', fillCats);
    const care = (stat: 'happiness' | 'hygiene', delta: number) => () => careCat.value && session.debugCare(careCat.value, stat, delta);
    on('happy-up', care('happiness', 20));
    on('happy-down', care('happiness', -20));
    on('clean-up', care('hygiene', 20));
    on('clean-down', care('hygiene', -20));
    on('sick-rx', () => careCat.value && session.debugSickWithPrescription(careCat.value));
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
    // Chegadas: forçar clima, horas, dias e café cheio; gerar um gato; ver quais gatilhos valem agora.
    const sel = (k: string) => panel.querySelector(`[data-dbg="${k}"]`) as HTMLSelectElement;
    sel('weather').addEventListener('change', () => {
      session.arrivals.debug.weather = sel('weather').value || undefined;
      session.arrivals.tick();
    });
    on('hour', () => {
      session.state.time += 60;
      session.arrivals.tick();
    });
    on('day', () => session.endDay('home'));
    on('full', (b) => {
      session.arrivals.debug.cafeFull = !session.arrivals.debug.cafeFull;
      b.classList.toggle('on', session.arrivals.debug.cafeFull);
    });
    on('gen-cat', () => session.arrivals.debugGenerate(sel('personality').value, sel('condition').value));
    on('triggers', () => {
      this.note = session.arrivals.triggerReport().filter((r) => r.holds).map((r) => r.id.replace('arr.', '')).join(', ') || 'nenhum';
      this.render();
    });
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
    const forced = this.session.arrivals.debug;
    const arrivals = `chegada ${ar.active ? `${ar.active.id} (${ar.active.catId})` : '-'} · fila ${ar.queue.length} · próxima ${ar.nextOn ?? '-'} · clima ${forced.weather ?? weather}${forced.cafeFull ? ' · CAFÉ CHEIO' : ''}${this.note ? ` · gatilhos: ${this.note}` : ''}`;
    this.status.textContent = `célula ${this.cell} · reputação ${rep.value}${last ? ` (${last})` : ''} · ${arrivals} · marcos: ${done}`;
  }
}
