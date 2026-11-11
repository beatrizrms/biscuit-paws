// Controles de toque (celular e tablet): um direcional virtual à esquerda e os botões à direita (ação e atalhos).
// O jogo não sabe de onde veio o comando: o mundo e os mini games leem a direção daqui junto com o teclado, e os
// botões disparam as mesmas ações das teclas (E, I, C, M, P, F, Esc). Aparece sozinho pelo último controle usado:
// tocou na tela, aparece; usou teclado ou mouse, some. Só desenho e entrada: nenhuma regra do jogo mora aqui.
import type { InputState } from '../core/movement';
import { uiText } from './content';

/** As ações dos botões: o nome da tecla equivalente (o mesmo do onKey do mundo). */
export type TouchAction = 'E' | 'I' | 'C' | 'M' | 'P' | 'F' | 'ESC';

/** Raio do direcional (px da interface, 640 x 360) e a partir de que parte dele conta direção e corrida. */
const STICK_R = 34;
const DEAD = 0.3;
const RUN_AT = 0.92;

/** Os atalhos na coluna da direita (de cima para baixo): tecla e o texto do botão. */
const SHORTCUTS: [TouchAction, string][] = [
  ['ESC', '❚❚'],
  ['P', 'Cel'],
  ['C', 'Market'],
  ['M', 'Menu'],
  ['I', 'Mochila'],
  ['F', 'Mover'],
];

class TouchInput {
  /** O último controle usado: com "touch", os botões aparecem. */
  mode: 'touch' | 'keys' = 'keys';
  /** Direção do direcional agora (mesmo formato do teclado) e se está correndo (empurrado até a borda). */
  dir: InputState = { up: false, down: false, left: false, right: false };
  run = false;
  /** O botão de ação está sendo segurado (jogos de segurar, como a pescaria). */
  holding = false;
  private listeners = new Map<TouchAction, Set<() => void>>();
  private modeListeners = new Set<() => void>();
  private root: HTMLElement | null = null;

  /** Avisa quando troca entre toque e teclado (a dica do rodapé muda de texto). */
  onModeChange(cb: () => void): void {
    this.modeListeners.add(cb);
  }

  /**
   * Troca o texto de um botão conforme o momento (escolhendo o móvel, o Mover vira "Próximo" e o E vira "OK"); sem
   * texto, volta ao normal.
   */
  setLabel(action: TouchAction, text?: string): void {
    const b = this.root?.querySelector<HTMLButtonElement>(`[data-act="${action}"]`);
    if (!b) return;
    b.dataset.label ??= b.textContent ?? '';
    b.textContent = text ?? b.dataset.label;
    b.classList.toggle('t-context', !!text);
  }

  /** Ouve um botão; devolve a função que para de ouvir (os mini games param no fim da partida). */
  on(action: TouchAction, cb: () => void): () => void {
    if (!this.listeners.has(action)) this.listeners.set(action, new Set());
    this.listeners.get(action)!.add(cb);
    return () => this.listeners.get(action)?.delete(cb);
  }

  /** Monta os controles na camada #touch (ao lado da interface, na mesma escala) e observa qual controle ela usa. */
  attach(root: HTMLElement): void {
    if (this.root) return;
    this.root = root;
    const layer = document.createElement('div');
    layer.className = 'touch-layer';
    layer.innerHTML = `
      <div class="t-stick"><div class="t-knob"></div></div>
      <button class="t-btn t-action" data-act="E">E</button>
      <button class="t-btn t-small t-full" aria-label="Tela cheia">⛶</button>
      <div class="t-shortcuts">${SHORTCUTS.map(([a, label]) => `<button class="t-btn t-small" data-act="${a}">${label}</button>`).join('')}</div>`;
    root.appendChild(layer);
    // Celular em pé: o jogo é deitado (640 x 360); o aviso cobre a tela até ela girar (só CSS: some ao deitar).
    const rotate = document.createElement('div');
    rotate.className = 'rotate-hint';
    rotate.innerHTML = `<span class="rotate-phone"></span><p>${uiText.touch.rotate}</p>`;
    document.body.appendChild(rotate);
    this.wireFullscreen(layer.querySelector('.t-full') as HTMLButtonElement);
    this.wireStick(layer.querySelector('.t-stick') as HTMLElement, layer.querySelector('.t-knob') as HTMLElement);
    layer.querySelectorAll<HTMLButtonElement>('[data-act]').forEach((b) => {
      const act = b.dataset.act as TouchAction;
      b.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (act === 'E') this.holding = true;
        b.classList.add('down');
        this.listeners.get(act)?.forEach((cb) => cb());
      });
      const up = () => {
        if (act === 'E') this.holding = false;
        b.classList.remove('down');
      };
      b.addEventListener('pointerup', up);
      b.addEventListener('pointercancel', up);
      b.addEventListener('pointerleave', up);
    });
    // Qual controle ela está usando: o toque mostra os botões; tecla ou mouse esconde.
    window.addEventListener('pointerdown', (e) => this.setMode(e.pointerType === 'touch' ? 'touch' : 'keys'), true);
    window.addEventListener('keydown', () => this.setMode('keys'), true);
    // Começa certo: tela de toque sem mouse (celular, tablet), ou ?toque na URL (para testar no PC).
    const coarse = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches && !matchMedia('(any-pointer: fine)').matches;
    this.setMode(coarse || new URLSearchParams(location.search).has('toque') ? 'touch' : 'keys');
  }

  private setMode(mode: 'touch' | 'keys'): void {
    if (mode === this.mode && this.root?.classList.contains('touch-on') === (mode === 'touch')) return;
    this.mode = mode;
    this.root?.classList.toggle('touch-on', mode === 'touch');
    if (mode === 'keys') this.release();
    this.modeListeners.forEach((cb) => cb());
  }

  /**
   * Tela cheia (Android e tablets; o iPhone não deixa: lá, "Adicionar à Tela de Início" abre como app, pelo manifest).
   * Some quando não dá, quando já abriu como app e enquanto está em tela cheia. Deita a tela quando o celular deixa.
   */
  private wireFullscreen(btn: HTMLButtonElement): void {
    const standalone = matchMedia('(display-mode: fullscreen), (display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true;
    const show = () => (btn.hidden = standalone || !document.fullscreenEnabled || document.fullscreenElement !== null);
    show();
    document.addEventListener('fullscreenchange', show);
    btn.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      void document.documentElement
        .requestFullscreen({ navigationUI: 'hide' })
        .then(() => (screen.orientation as { lock?: (o: string) => Promise<void> }).lock?.('landscape'))
        .catch(() => undefined);
    });
  }

  /** Solta tudo (trocou de controle, ou o dedo saiu). */
  private release(): void {
    this.dir = { up: false, down: false, left: false, right: false };
    this.run = false;
    this.holding = false;
  }

  /** O direcional: o dedo arrasta a bolinha; a direção sai do ângulo (8 direções) e a corrida, da borda. */
  private wireStick(stick: HTMLElement, knob: HTMLElement): void {
    let id: number | null = null;
    const move = (e: PointerEvent) => {
      const r = stick.getBoundingClientRect();
      // A interface é escalada (transform): a conta é em px da tela e vira fração do raio.
      const scale = r.width / (STICK_R * 2);
      const dx = (e.clientX - (r.left + r.width / 2)) / scale;
      const dy = (e.clientY - (r.top + r.height / 2)) / scale;
      const dist = Math.min(1, Math.hypot(dx, dy) / STICK_R);
      const a = Math.atan2(dy, dx);
      const kx = Math.cos(a) * dist;
      const ky = Math.sin(a) * dist;
      this.dir = { left: kx < -DEAD, right: kx > DEAD, up: ky < -DEAD, down: ky > DEAD };
      this.run = dist >= RUN_AT;
      knob.style.transform = `translate(${kx * STICK_R}px, ${ky * STICK_R}px)`;
    };
    const end = (e: PointerEvent) => {
      if (e.pointerId !== id) return;
      id = null;
      this.release();
      knob.style.transform = '';
      stick.classList.remove('down');
    };
    stick.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      id = e.pointerId;
      try {
        stick.setPointerCapture(e.pointerId);
      } catch {
        // sem captura (evento sintético): segue ouvindo no próprio direcional
      }
      stick.classList.add('down');
      move(e);
    });
    stick.addEventListener('pointermove', (e) => e.pointerId === id && move(e));
    stick.addEventListener('pointerup', end);
    stick.addEventListener('pointercancel', end);
  }
}

/** Os controles de toque do jogo (um só). */
export const touch = new TouchInput();
