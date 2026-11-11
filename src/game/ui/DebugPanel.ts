// Painel do modo debug (só em `npm run dev`, com o debug ligado).
import type { GameSession } from '../../core/session';
import { weatherOf } from '../../core/calendar';

/** O painel recolhido (só o título) fica lembrado entre as sessões. */
const FOLD_KEY = 'biscuit-paws:debug-panel-collapsed';

export interface DebugActions {
  skipDialogue(): void;
  toggleCollision(): boolean;
  toggleGrid(): boolean;
  newGame(): void;
  turnOff(): void;
  /** Abre um mini game direto (sem missão). */
  /** catId: o gato da linha Cuidados (os mini games de cuidado sobem a alegria/higiene dele). */
  openMiniGame(gameId: string, difficulty: 'easy' | 'normal' | 'hard', catId?: string): void;
  miniGames(): string[];
  /** Redesenha o mapa atual (depois de concluir marcos ou abrir cômodos); com mapId, vai para ele. */
  reloadWorld(mapId?: string): void;
}

export class DebugPanel {
  private status: HTMLElement;
  private cell = '-';
  /** Resultado do botão "gatilhos agora". */
  private note = '';
  /** O estado reprodutivo real do gato escolhido (linha Castração), mesmo quando ela não sabe. */
  private reproReal: () => string = () => '';

  constructor(
    root: HTMLElement,
    private session: GameSession,
    actions: DebugActions,
  ) {
    const panel = document.createElement('section');
    panel.className = 'panel debug-panel';
    panel.innerHTML = `
      <header title="Clique para recolher ou abrir"><strong>DEBUG</strong> · save de teste · F9 desliga <span class="fold"></span></header>
      <div class="buttons">
        <button data-act="money">+100 moedas</button>
        <button data-act="rep">+10 reputação</button>
        <button data-act="rep-zero">Zerar reputação</button>
      </div>
      <div class="buttons festivals">
        <strong>Eventos</strong>
        ${session.content.festivals.map((f) => `<button data-festival="${f.id}">${f.name}</button>`).join('')}
        <button data-act="fest-day">Ir ao dia do evento</button>
      </div>
      <div class="buttons festive">
        <strong>Natal e Ano Novo</strong>
        <button data-festive="draw">Sorteio (inv. 18)</button>
        <button data-festive="party">Ceia (inv. 25)</button>
        <button data-festive="newyear">Fogos (inv. 30)</button>
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
      <div class="buttons story">
        <strong>História</strong>
        <button data-act="skip-intro">pular introdução</button>
        <button data-act="beat">concluir marco</button>
        <button data-act="story-all">concluir história</button>
        <button data-act="rooms">abrir cômodos</button>
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
      <div class="buttons neuter">
        <strong>Castração</strong>
        <select data-dbg="repro-status"><option value="intact">inteiro</option><option value="neutered">castrado</option></select>
        <select data-dbg="repro-known"><option value="unknown">ela não sabe</option><option value="intact">sabe: inteiro</option><option value="neutered">sabe: castrado</option></select>
        <button data-act="repro-set">aplicar estado</button>
        <input data-dbg="age" type="number" min="0" max="200" value="2" style="width:3.5em" title="idade (meses)"><button data-act="age-set">idade</button>
        <input data-dbg="health" type="number" min="0" max="100" value="80" style="width:3.5em" title="saúde"><button data-act="health-set">saúde</button>
        <button data-act="intake">→ consulta de entrada</button>
        <button data-act="neuter-book">castrar (volta amanhã)</button>
        <button data-act="clinic-morning">manhã da clínica</button>
        <button data-act="recovery-end">fim do cercadinho</button>
        <button data-act="clinic-full">lotar agenda</button>
        <button data-act="complication">complicação</button>
        <span data-dbg="repro-real"></span>
      </div>
      <div class="buttons ced">
        <strong>CED</strong>
        <button data-act="ced-start">começar vaquinha</button>
        <button data-act="ced-counter">doação balcão</button>
        <button data-act="ced-remote">doação app</button>
        <button data-act="ced-boost">ajuda do vizinho</button>
        <button data-act="ced-complete">completar meta</button>
        <span data-dbg="ced-status"></span>
      </div>
      <div class="buttons minigames">${actions
        .miniGames()
        .map((id) => ['easy', 'normal', 'hard'].map((d) => `<button data-mg="${id}" data-dif="${d}">${id} ${d}</button>`).join(''))
        .join('')}</div>
      <div class="status"></div>`;
    root.appendChild(panel);
    // Recolher: clicar no título deixa só a faixa de cima (lembra na próxima vez).
    const header = panel.querySelector('header') as HTMLElement;
    const fold = (collapsed: boolean) => {
      panel.classList.toggle('collapsed', collapsed);
      (header.querySelector('.fold') as HTMLElement).textContent = collapsed ? '▸ abrir' : '▾ recolher';
      try {
        window.localStorage.setItem(FOLD_KEY, collapsed ? '1' : '0');
      } catch {
        // sem armazenamento: só não lembra
      }
    };
    let collapsed = false;
    try {
      collapsed = window.localStorage.getItem(FOLD_KEY) === '1';
    } catch {
      collapsed = false;
    }
    fold(collapsed);
    header.addEventListener('click', () => fold(!panel.classList.contains('collapsed')));
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
    // Castração: o gato da linha Cuidados.
    const val = (name: string) => (panel.querySelector(`[data-dbg="${name}"]`) as HTMLInputElement | HTMLSelectElement).value;
    const neuter = (fn: (catId: string) => void) => () => {
      if (!careCat.value) return;
      fn(careCat.value);
      this.render();
    };
    on('repro-set', neuter((id) => session.debugRepro(id, val('repro-status') as 'intact' | 'neutered', val('repro-known') as 'unknown' | 'intact' | 'neutered')));
    on('age-set', neuter((id) => session.debugAge(id, Number(val('age')))));
    on('health-set', neuter((id) => session.debugHealth(id, Number(val('health')))));
    on('intake', neuter((id) => session.debugIntake(id)));
    on('neuter-book', neuter((id) => session.debugBookNeuter(id)));
    on('clinic-morning', neuter(() => session.debugClinicMorning()));
    on('recovery-end', neuter((id) => session.debugAdvanceRecovery(id)));
    on('clinic-full', neuter(() => session.debugFillClinic()));
    on('complication', neuter((id) => session.debugComplication(id)));
    // CED: a vaquinha sem esperar a condição nem a sorte das doações.
    const ced = (fn: () => void) => () => {
      fn();
      this.render();
    };
    on('ced-start', ced(() => session.ced.debugStart()));
    on('ced-counter', ced(() => session.ced.debugDonate('counter')));
    on('ced-remote', ced(() => session.ced.debugDonate('remote')));
    on('ced-boost', ced(() => session.ced.debugStallBoost()));
    on('ced-complete', ced(() => session.ced.debugComplete()));
    this.reproReal = () => {
      const r = careCat.value ? session.state.cats[careCat.value]?.repro : undefined;
      const stage = careCat.value ? session.state.cats[careCat.value]?.clinic?.stage : undefined;
      return r ? `real: ${r.status === 'neutered' ? 'castrado' : 'inteiro'} (${r.sex === 'male' ? 'macho' : 'fêmea'}), ela sabe: ${r.known}${stage ? `, ${stage}` : ''}` : '';
    };
    careCat.addEventListener('change', () => this.render());
    // História: concluir marcos sem esperar a condição (sem as falas) e abrir/reformar os cômodos.
    const story = (text: string) => {
      this.note = text;
      this.render();
    };
    on('skip-intro', () => {
      const n = session.debugCompleteStory('story.prologue_end');
      actions.reloadWorld(session.content.map.id);
      story(`introdução pulada (${n} marcos)`);
    });
    on('beat', () => {
      const id = session.debugCompleteBeat();
      actions.reloadWorld();
      story(id ? `concluído: ${id}` : 'história completa');
    });
    on('story-all', () => {
      const n = session.debugCompleteStory();
      actions.reloadWorld();
      story(`história completa (${n} marcos)`);
    });
    on('rooms', () => {
      session.debugUnlockRooms();
      actions.reloadWorld();
      story('cômodos abertos e reformados');
    });
    on('money', () => session.addMoney(100, 'debug'));
    on('rep', () => session.addReputation(10, 'debug'));
    // Eventos sem as condições (nem a data: no dia de hoje, ou a preparação começa); e pular até o dia marcado (de manhã).
    panel.querySelectorAll<HTMLButtonElement>('[data-festival]').forEach((b) =>
      b.addEventListener('click', () => {
        session.debugStartFestival(b.dataset.festival!);
        actions.reloadWorld();
      }),
    );
    // Natal e Ano Novo: pula para um minuto antes (o sorteio, a ceia, os fogos), já com as condições.
    panel.querySelectorAll<HTMLButtonElement>('[data-festive]').forEach((b) =>
      b.addEventListener('click', () => {
        const what = b.dataset.festive as 'draw' | 'party' | 'newyear';
        session.debugFestive(what);
        // O sorteio só acontece com ela no café.
        actions.reloadWorld(what === 'draw' ? session.content.map.id : undefined);
      }),
    );
    on('fest-day', () => {
      const day = session.state.festivals.active?.day ?? null;
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
      this.note = `gatilhos: ${session.arrivals.triggerReport().filter((r) => r.holds).map((r) => r.id.replace('arr.', '')).join(', ') || 'nenhum'}`;
      this.render();
    });
    // Chegadas: põe na fila agora (ignora o gatilho e o sorteio; respeita a vez).
    panel.querySelectorAll<HTMLButtonElement>('[data-arrival]').forEach((b) => b.addEventListener('click', () => session.arrivals.queueNow(b.dataset.arrival!)));
    panel.querySelectorAll<HTMLButtonElement>('[data-mg]').forEach((b) =>
      b.addEventListener('click', () => actions.openMiniGame(b.dataset.mg!, b.dataset.dif as 'easy' | 'normal' | 'hard', careCat.value || undefined)),
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
    const arrivals = `chegada ${ar.active ? `${ar.active.id} (${ar.active.catId})` : '-'} · fila ${ar.queue.length} · próxima ${ar.nextOn ?? '-'} · clima ${forced.weather ?? weather}${forced.cafeFull ? ' · CAFÉ CHEIO' : ''}${this.note ? ` · ${this.note}` : ''}`;
    const real = this.status.parentElement?.querySelector('[data-dbg="repro-real"]');
    if (real) real.textContent = this.reproReal();
    this.status.textContent = `célula ${this.cell} · reputação ${rep.value}${last ? ` (${last})` : ''} · ${arrivals} · marcos: ${done}`;
  }
}
