// Painel do modo debug (só em `npm run dev`, com o debug ligado). Organizado em grupos que abrem e fecham (lembrados
// entre as sessões), com listas de seleção no lugar de fileiras de botões: escolher na lista e apertar o botão ao lado.
// "Ir para" leva a qualquer evento já com os pré-requisitos (session.debugSatisfy).
import type { GameSession } from '../../core/session';
import { weatherOf } from '../../core/calendar';

/** O painel recolhido (só o título) fica lembrado entre as sessões. */
const FOLD_KEY = 'biscuit-paws:debug-panel-collapsed';
/** Os grupos abertos (lembrados). */
const OPEN_KEY = 'biscuit-paws:debug-panel-open';

export interface DebugActions {
  skipDialogue(): void;
  toggleCollision(): boolean;
  toggleGrid(): boolean;
  newGame(): void;
  turnOff(): void;
  /** Abre um mini game direto (sem missão). catId: o gato escolhido (os de cuidado sobem a alegria/higiene dele). */
  openMiniGame(gameId: string, difficulty: 'easy' | 'normal' | 'hard', catId?: string): void;
  miniGames(): string[];
  /** Redesenha o mapa atual (depois de concluir marcos ou abrir cômodos); com mapId, vai para ele. */
  reloadWorld(mapId?: string): void;
}

const opt = (value: string, label: string) => `<option value="${value}">${label}</option>`;

export class DebugPanel {
  private status: HTMLElement;
  private cell = '-';
  /** Resultado das ações (gatilhos, marcos concluídos...). */
  private note = '';
  /** O estado reprodutivo real do gato escolhido, mesmo quando ela não sabe. */
  private reproReal: () => string = () => '';

  constructor(
    root: HTMLElement,
    private session: GameSession,
    actions: DebugActions,
  ) {
    const c = session.content;
    const panel = document.createElement('section');
    panel.className = 'panel debug-panel';
    const section = (id: string, title: string, body: string) => `<details class="dbg-sec" data-sec="${id}"><summary>${title}</summary><div class="buttons">${body}</div></details>`;
    panel.innerHTML = `
      <header title="Clique para recolher ou abrir"><strong>DEBUG</strong> · save de teste · F9 desliga <span class="fold"></span></header>
      <div class="buttons dbg-go">
        <select data-dbg="goto" title="Vai para o momento do evento, já com tudo o que ele pede (gatos, cômodos, marcos, amigos)">
          <optgroup label="Eventos no quintal">${c.festivals.map((f) => opt(`fest:${f.id}`, f.name)).join('')}</optgroup>
          <optgroup label="História">${opt('beat:story.inauguration', 'Inauguração (primavera)')}</optgroup>
          <optgroup label="Natal e Ano Novo">${opt('festive:draw', 'Sorteio do amigo secreto (inv. 18)')}${opt('festive:party', 'Ceia de Natal (inv. 25)')}${opt('festive:newyear', 'Fogos de Ano Novo (inv. 30)')}</optgroup>
          <optgroup label="Halloween">${opt('festive:hw_invite', 'Convite da Dona Neusa (out. 24)')}${opt('festive:hw_party', 'Noite das Abóboras (out. 30)')}</optgroup>
        </select>
        <button data-act="goto">ir</button>
        <button data-act="fest-day" title="Evento do quintal marcado: pula para o dia dele, de manhã">dia do evento</button>
      </div>
      ${section(
        'time',
        'Tempo e clima',
        `<button data-act="hour">+1 h</button><button data-act="day">+1 dia</button>
         <select data-dbg="weather">${opt('', 'clima do dia')}${[...new Set(Object.values(c.seasons.weather ?? {}).flatMap((w) => Object.keys(w)))].map((w) => opt(w, w)).join('')}</select>
         <button data-act="full" title="As chegadas tratam o café como cheio">café cheio</button>`,
      )}
      ${section(
        'story',
        'História',
        `<select data-dbg="story">${opt('intro', 'pular introdução')}${opt('beat', 'concluir o marco da vez')}${opt('all', 'concluir a história toda')}${opt('rooms', 'abrir e reformar os cômodos')}</select>
         <button data-act="story">fazer</button>`,
      )}
      ${section(
        'cats',
        'Gatos',
        `<label>gato <select data-dbg="care-cat"></select></label>
         <select data-dbg="care">${opt('happy+', 'alegria +20')}${opt('happy-', 'alegria −20')}${opt('clean+', 'higiene +20')}${opt('clean-', 'higiene −20')}${opt('sick', 'doente com receita')}</select>
         <button data-act="care">aplicar</button>
         <span class="dbg-break"></span>
         <label>novo <select data-dbg="personality">${Object.keys(c.catProfiles.personalities).map((p) => opt(p, p)).join('')}</select></label>
         <select data-dbg="condition">${Object.keys(c.catProfiles.conditions).map((x) => opt(x, x)).join('')}</select>
         <button data-act="gen-cat">gerar gato</button>`,
      )}
      ${section(
        'neuter',
        'Castração (gato escolhido)',
        `<select data-dbg="clinic">${opt('intake', '→ consulta de entrada')}${opt('book', 'castrar (volta amanhã)')}${opt('morning', 'manhã da clínica')}${opt('recovery', 'fim do cercadinho')}${opt('full', 'lotar a agenda')}${opt('complication', 'complicação')}</select>
         <button data-act="clinic">aplicar</button>
         <span class="dbg-break"></span>
         <select data-dbg="repro-status">${opt('intact', 'inteiro')}${opt('neutered', 'castrado')}</select>
         <select data-dbg="repro-known">${opt('unknown', 'ela não sabe')}${opt('intact', 'sabe: inteiro')}${opt('neutered', 'sabe: castrado')}</select>
         <button data-act="repro-set">estado</button>
         <label>idade <input data-dbg="age" type="number" min="0" max="200" value="2" title="meses"></label><button data-act="age-set">ok</button>
         <label>saúde <input data-dbg="health" type="number" min="0" max="100" value="80"></label><button data-act="health-set">ok</button>
         <span class="dbg-note" data-dbg="repro-real"></span>`,
      )}
      ${section(
        'arrivals',
        'Chegadas de gatos',
        `<select data-dbg="arrival">${c.arrivals.arrivals.map((a) => opt(a.id, a.id.replace('arr.', ''))).join('')}</select>
         <button data-act="arrival" title="Põe na fila agora (ignora o gatilho e o sorteio; respeita a vez)">pôr na fila</button>
         <button data-act="triggers">gatilhos agora</button>`,
      )}
      ${section(
        'ced',
        'CED (vaquinha)',
        `<select data-dbg="ced">${opt('start', 'começar a vaquinha')}${opt('counter', 'doação no balcão')}${opt('remote', 'doação pelo app')}${opt('boost', 'ajuda do vizinho')}${opt('complete', 'completar a meta')}</select>
         <button data-act="ced">fazer</button>`,
      )}
      ${section(
        'games',
        'Mini games',
        `<select data-dbg="game">${actions.miniGames().map((id) => opt(id, id)).join('')}</select>
         <select data-dbg="difficulty">${opt('easy', 'fácil')}${opt('normal', 'normal')}${opt('hard', 'difícil')}</select>
         <button data-act="game" title="Com o gato escolhido em Gatos">jogar</button>`,
      )}
      ${section(
        'money',
        'Dinheiro e reputação',
        `<button data-act="money">+100 moedas</button><button data-act="rep">+10 reputação</button><button data-act="rep-zero">zerar reputação</button>`,
      )}
      ${section(
        'tools',
        'Ferramentas',
        `<button data-act="skip">pular falas</button><button data-act="collision">colisão</button><button data-act="grid">grade</button>
         <button data-act="new">jogo novo</button><button data-act="off">desligar o debug</button>`,
      )}
      <div class="status"></div>`;
    root.appendChild(panel);

    // Recolher o painel: clicar no título deixa só a faixa de cima (lembra na próxima vez).
    const header = panel.querySelector('header') as HTMLElement;
    const store = (key: string, value: string) => {
      try {
        window.localStorage.setItem(key, value);
      } catch {
        // sem armazenamento: só não lembra
      }
    };
    const read = (key: string) => {
      try {
        return window.localStorage.getItem(key);
      } catch {
        return null;
      }
    };
    const fold = (collapsed: boolean) => {
      panel.classList.toggle('collapsed', collapsed);
      (header.querySelector('.fold') as HTMLElement).textContent = collapsed ? '▸ abrir' : '▾ recolher';
      store(FOLD_KEY, collapsed ? '1' : '0');
    };
    fold(read(FOLD_KEY) === '1');
    header.addEventListener('click', () => fold(!panel.classList.contains('collapsed')));
    // Grupos abertos: lembrados.
    const openSecs = new Set((read(OPEN_KEY) ?? '').split(',').filter(Boolean));
    panel.querySelectorAll<HTMLDetailsElement>('details.dbg-sec').forEach((d) => {
      d.open = openSecs.has(d.dataset.sec!);
      d.addEventListener('toggle', () => {
        if (d.open) openSecs.add(d.dataset.sec!);
        else openSecs.delete(d.dataset.sec!);
        store(OPEN_KEY, [...openSecs].join(','));
      });
    });
    this.status = panel.querySelector('.status') as HTMLElement;

    const on = (act: string, fn: (btn: HTMLButtonElement) => void) => {
      const btn = panel.querySelector(`[data-act="${act}"]`) as HTMLButtonElement;
      btn.addEventListener('click', () => {
        fn(btn);
        this.render();
      });
    };
    const val = (name: string) => (panel.querySelector(`[data-dbg="${name}"]`) as HTMLInputElement | HTMLSelectElement).value;
    const sel = (k: string) => panel.querySelector(`[data-dbg="${k}"]`) as HTMLSelectElement;
    const say = (text: string) => (this.note = text);

    // ---------- Ir para (eventos com os pré-requisitos) ----------
    on('goto', () => {
      const [kind, id] = val('goto').split(/:(.*)/) as [string, string];
      if (kind === 'fest') {
        // Recarrega antes: a recarga pula as falas da fila, e a ideia do evento (a fala de quem propõe) sumia.
        actions.reloadWorld();
        session.debugStartFestival(id);
      } else if (kind === 'beat') {
        actions.reloadWorld(c.map.id);
        session.debugReachBeat(id);
      } else {
        const what = id as 'draw' | 'party' | 'newyear' | 'hw_invite' | 'hw_party';
        session.debugFestive(what);
        // O sorteio e o convite só acontecem com ela no café.
        actions.reloadWorld(what === 'draw' || what === 'hw_invite' ? c.map.id : undefined);
      }
      say(`ir para: ${sel('goto').selectedOptions[0]?.textContent ?? id}`);
    });
    on('fest-day', () => {
      const day = session.state.festivals.active?.day ?? null;
      if (day !== null && session.state.day < day) {
        session.state.day = day;
        session.state.time = 9 * 60;
        session.bus.emit('day.started', { day });
      } else say('nenhum evento marcado para depois');
    });

    // ---------- Tempo e clima ----------
    sel('weather').addEventListener('change', () => {
      session.arrivals.debug.weather = val('weather') || undefined;
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

    // ---------- História ----------
    on('story', () => {
      const what = val('story');
      if (what === 'intro') {
        const n = session.debugCompleteStory('story.prologue_end');
        actions.reloadWorld(c.map.id);
        say(`introdução pulada (${n} marcos)`);
      } else if (what === 'beat') {
        const id = session.debugCompleteBeat();
        actions.reloadWorld();
        say(id ? `concluído: ${id}` : 'história completa');
      } else if (what === 'all') {
        const n = session.debugCompleteStory();
        actions.reloadWorld();
        say(`história completa (${n} marcos)`);
      } else {
        session.debugUnlockRooms();
        actions.reloadWorld();
        say('cômodos abertos e reformados');
      }
    });

    // ---------- Gatos (o escolhido vale para Castração e Mini games) ----------
    const careCat = sel('care-cat');
    const fillCats = () => {
      const keep = careCat.value;
      careCat.innerHTML = session.shelteredCats().map((id) => opt(id, session.catName(id) || id)).join('');
      if (keep && session.shelteredCats().includes(keep)) careCat.value = keep;
    };
    fillCats();
    careCat.addEventListener('mousedown', fillCats);
    careCat.addEventListener('focus', fillCats);
    careCat.addEventListener('change', () => this.render());
    on('care', () => {
      const id = careCat.value;
      if (!id) return say('nenhum gato no café');
      const what = val('care');
      if (what === 'sick') session.debugSickWithPrescription(id);
      else session.debugCare(id, what.startsWith('happy') ? 'happiness' : 'hygiene', what.endsWith('+') ? 20 : -20);
    });
    on('gen-cat', () => {
      session.arrivals.debugGenerate(val('personality'), val('condition'));
      fillCats();
    });

    // ---------- Castração ----------
    on('clinic', () => {
      const id = careCat.value;
      const what = val('clinic');
      if (what === 'morning') return session.debugClinicMorning();
      if (what === 'full') return session.debugFillClinic();
      if (!id) return say('escolha um gato em Gatos');
      if (what === 'intake') session.debugIntake(id);
      else if (what === 'book') session.debugBookNeuter(id);
      else if (what === 'recovery') session.debugAdvanceRecovery(id);
      else session.debugComplication(id);
    });
    on('repro-set', () => careCat.value && session.debugRepro(careCat.value, val('repro-status') as 'intact' | 'neutered', val('repro-known') as 'unknown' | 'intact' | 'neutered'));
    on('age-set', () => careCat.value && session.debugAge(careCat.value, Number(val('age'))));
    on('health-set', () => careCat.value && session.debugHealth(careCat.value, Number(val('health'))));
    this.reproReal = () => {
      const r = careCat.value ? session.state.cats[careCat.value]?.repro : undefined;
      const stage = careCat.value ? session.state.cats[careCat.value]?.clinic?.stage : undefined;
      return r ? `real: ${r.status === 'neutered' ? 'castrado' : 'inteiro'} (${r.sex === 'male' ? 'macho' : 'fêmea'}), ela sabe: ${r.known}${stage ? `, ${stage}` : ''}` : '';
    };

    // ---------- Chegadas ----------
    on('arrival', () => session.arrivals.queueNow(val('arrival')));
    on('triggers', () => say(`gatilhos: ${session.arrivals.triggerReport().filter((r) => r.holds).map((r) => r.id.replace('arr.', '')).join(', ') || 'nenhum'}`));

    // ---------- CED ----------
    on('ced', () => {
      const what = val('ced');
      if (what === 'start') session.ced.debugStart();
      else if (what === 'counter' || what === 'remote') session.ced.debugDonate(what);
      else if (what === 'boost') session.ced.debugStallBoost();
      else session.ced.debugComplete();
    });

    // ---------- Mini games ----------
    on('game', () => actions.openMiniGame(val('game'), val('difficulty') as 'easy' | 'normal' | 'hard', careCat.value || undefined));

    // ---------- Dinheiro, reputação e ferramentas ----------
    on('money', () => session.addMoney(100, 'debug'));
    on('rep', () => session.addReputation(10, 'debug'));
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

    session.bus.onAny(() => this.render());
    this.render();
  }

  /** Célula sob o mouse, para posicionar coisas no mapa à mão. */
  setCell(col: number, row: number): void {
    this.cell = `${col},${row}`;
    this.render();
  }

  private render(): void {
    const s = this.session;
    const rep = s.state.reputation;
    // Chegadas de gatos: a em andamento, a fila, a próxima sorteada e o clima do dia.
    const ar = s.state.arrivals;
    const forced = s.arrivals.debug;
    const weather = forced.weather ?? weatherOf(s.content.seasons, s.state.day);
    const real = this.status.parentElement?.querySelector('[data-dbg="repro-real"]');
    if (real) real.textContent = this.reproReal();
    const lines = [
      `célula ${this.cell} · reputação ${rep.value} · clima ${weather}${forced.cafeFull ? ' · CAFÉ CHEIO' : ''} · ${s.shelteredCats().length} gatos`,
      `chegada ${ar.active ? `${ar.active.id.replace('arr.', '')} (${ar.active.catId})` : '-'} · fila ${ar.queue.length} · próxima ${ar.nextOn ?? '-'}`,
      `último marco: ${s.state.story.completed[s.state.story.completed.length - 1]?.replace('story.', '') ?? 'nenhum'}`,
      ...(this.note ? [`→ ${this.note}`] : []),
    ];
    this.status.innerHTML = lines.map((l) => `<div>${l.replace(/[&<>]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[ch]!)}</div>`).join('');
  }
}
