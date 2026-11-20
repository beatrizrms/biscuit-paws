// Controle de videogame (gamepad, no layout do Xbox: A, B, X, Y). O jogo inteiro já ouve o teclado (mundo, falas,
// janelas, mini games), então o controle "aperta" as mesmas teclas: cada botão faz uma ação de data/controls.json
// (pad: botão -> ação, por momento) e a ação aperta a primeira tecla dela (apertar e soltar, para os jogos de
// segurar); o analógico e o direcional viram as setas e, na borda, a tecla de correr. Nos mini games de mouse, o
// analógico move um cursor e o A é o botão do mouse. Só entrada: nenhuma regra do jogo mora aqui.
import { padNameForKey, type PadButton, type PadContextName } from '../core/controls';
import { controls } from './content';
import { menuOpen } from './ui/menu/MenuKit';
import { padNav, topLayer } from './padNav';
import { padEvents, touch } from './touch';

/** Onde ela está: muda o que o A (e alguns botões) aperta. */
export type PadContext = 'world' | 'placing' | 'ui' | 'panel' | 'minigame' | 'area';

interface Key {
  key: string;
  code: string;
  keyCode: number;
  /** Com o Ctrl apertado junto (Ctrl + Espaço: mais uma área na obra). */
  ctrl?: boolean;
}

const k = (key: string, code: string, keyCode: number): Key => ({ key, code, keyCode });
const SPECIAL: Record<string, Key> = {
  ENTER: k('Enter', 'Enter', 13),
  SPACE: k(' ', 'Space', 32),
  'CTRL+SPACE': { ...k(' ', 'Space', 32), ctrl: true },
  ESC: k('Escape', 'Escape', 27),
  TAB: k('Tab', 'Tab', 9),
  UP: k('ArrowUp', 'ArrowUp', 38),
  DOWN: k('ArrowDown', 'ArrowDown', 40),
  LEFT: k('ArrowLeft', 'ArrowLeft', 37),
  RIGHT: k('ArrowRight', 'ArrowRight', 39),
};

/** A tecla pelo nome do Phaser ("E", "ESC", "TAB", "F1", "1"). */
function keyOf(name: string): Key {
  if (SPECIAL[name]) return SPECIAL[name]!;
  if (/^[A-Z]$/.test(name)) return k(name.toLowerCase(), `Key${name}`, name.charCodeAt(0));
  if (/^[0-9]$/.test(name)) return k(name, `Digit${name}`, name.charCodeAt(0));
  const f = /^F(\d{1,2})$/.exec(name);
  if (f) return k(name, name, 111 + Number(f[1]));
  return k(name, name, 0);
}
const KEYS = { ENTER: SPECIAL.ENTER!, ESC: SPECIAL.ESC!, UP: SPECIAL.UP!, DOWN: SPECIAL.DOWN!, LEFT: SPECIAL.LEFT!, RIGHT: SPECIAL.RIGHT! };

/** Os botões no mapeamento padrão do navegador (a ordem de Gamepad.buttons). */
const B = { A: 0, B: 1, X: 2, Y: 3, LB: 4, RB: 5, LT: 6, RT: 7, SELECT: 8, START: 9, L3: 10, R3: 11, UP: 12, DOWN: 13, LEFT: 14, RIGHT: 15 } as const;
const BUTTON_OF = Object.fromEntries(Object.entries(B).map(([name, i]) => [i, name])) as Record<number, PadButton>;

/** A tecla que a ação aperta (a primeira; com sendAll, todas: Pronto no E e Servir no Enter de uma vez). */
function keysOf(action: string): Key[] {
  const a = controls.actions[action];
  const keys = a?.keys ?? [];
  return (a?.sendAll ? keys : keys.slice(0, 1)).map(keyOf);
}

/** O botão que faz a ação no mundo (o de correr, segurado). */
function buttonFor(action: string, ctx: PadContextName = 'world'): number | null {
  const found = Object.entries(controls.pad[ctx] ?? {}).find(([, a]) => a === action);
  return found ? B[found[0] as keyof typeof B] : null;
}

/** Analógico: a partir de quanto conta direção (e de quanto solta, um pouco antes, para não piscar) e corrida. */
const PRESS = 0.5;
const RELEASE = 0.3;
const RUN_AT = 0.92;
/** Seta segurada repete (como o teclado): espera e intervalo, em ms. */
const REPEAT_WAIT = 380;
const REPEAT_EVERY = 110;
/** Cursor dos mini games de mouse: fração da largura do jogo por segundo, com o analógico no fim. */
const CURSOR_SPEED = 0.75;
const DEAD = 0.18;

class PadInput {
  /** Onde ela está (o mundo informa; sem mundo, a tela inicial: menus). */
  context: () => PadContext = () => 'ui';
  /** LB/RB: passa a barra de itens um espaço (o mundo põe). */
  onHotbar: (dir: 1 | -1) => void = () => undefined;
  /** A tecla solta de cada botão: a que ele apertou (o momento pode ter mudado enquanto segurava). */
  private held = new Map<number, Key[] | 'mouse' | 'mouse2'>();
  private arrows = { up: false, down: false, left: false, right: false };
  private repeatAt = 0;
  private running = false;
  /** Mini game de mouse jogando agora: o analógico move o cursor. */
  private cursorOn = false;
  private cursor: { x: number; y: number } | null = null;
  private cursorEl: HTMLElement | null = null;
  private last = 0;

  constructor() {
    if (typeof window === 'undefined') return;
    // A mesma tecla tem botões diferentes conforme o momento (o P é o petisco nos mini games e o celular no mundo).
    touch.padLabel = (key) => padNameForKey(controls, key, this.padContexts());
    const loop = (now: number) => {
      this.poll(now);
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  /** Liga o cursor (mini game de mouse jogando) ou desliga. */
  setCursor(on: boolean): void {
    if (on === this.cursorOn) return;
    this.cursorOn = on;
    if (!on) this.cursor = null;
    this.drawCursor();
  }

  /** Os momentos do arquivo que valem agora, do mais específico para o geral (para as dicas). */
  padContexts(): PadContextName[] {
    const ctx = this.context();
    if (ctx === 'minigame') return this.cursorOn ? ['minigameCursor', 'minigame'] : ['minigame'];
    if (ctx === 'area') return ['area', 'world'];
    if (ctx === 'placing') return ['placing', 'world'];
    return ['world', 'placing'];
  }

  /** A janela onde o destaque anda agora (Market, mochila, celular, caixa de escolha), ou null. */
  private navLayer: HTMLElement | null = null;

  private poll(now: number): void {
    const dt = this.last ? Math.min(0.05, (now - this.last) / 1000) : 0;
    this.last = now;
    const pad = readPads();
    if (!pad) return;
    const { pressed, axes } = pad;
    const ax = axes[0] ?? 0;
    const ay = axes[1] ?? 0;
    const mag = Math.min(1, Math.hypot(ax, ay));
    // Troca para o controle (as dicas mudam): botão, direcional ou, num controle padrão, o analógico. Eixo de aparelho
    // fora do padrão (gatilho parado em -1, sensor do celular) não conta: só depois de um botão ele anda com o analógico.
    const any = pad.any || (pad.standard && (mag > PRESS || Math.hypot(axes[2] ?? 0, axes[3] ?? 0) > PRESS));
    if (any && touch.mode !== 'pad') touch.usePad();
    if (touch.mode !== 'pad') {
      padNav.sync(null);
      return this.releaseAll();
    }
    const ctx = this.context();
    // Janela aberta: o destaque verde anda por ela (os menus da pausa e da tela inicial andam pelo foco, sozinhos).
    this.navLayer = ctx === 'panel' ? topLayer() : ctx === 'ui' && !menuOpen() ? topLayer('.confirm-layer') : null;
    padNav.sync(this.navLayer);
    const cursor = this.cursorOn && ctx === 'minigame';
    if (cursor !== !!this.cursor) {
      this.cursor = cursor ? this.canvasCenter() : null;
      this.drawCursor();
    }
    // Botões.
    for (const i of Object.values(B)) {
      if (i >= B.UP) continue; // o direcional é direção (abaixo)
      const down = pressed(i);
      const was = this.held.has(i);
      if (down && !was) this.press(i, ctx);
      else if (!down && was) this.release(i);
    }
    // Direção: analógico esquerdo ou direcional. Com o cursor, os dois movem o cursor.
    const dpad = { up: pressed(B.UP), down: pressed(B.DOWN), left: pressed(B.LEFT), right: pressed(B.RIGHT) };
    if (this.cursor) {
      this.setArrows({ up: false, down: false, left: false, right: false }, now);
      const rx = axes[2] ?? 0;
      const ry = axes[3] ?? 0;
      let vx = Math.abs(ax) > DEAD ? ax : Math.abs(rx) > DEAD ? rx : 0;
      let vy = Math.abs(ay) > DEAD ? ay : Math.abs(ry) > DEAD ? ry : 0;
      if (dpad.left || dpad.right) vx = dpad.left ? -0.6 : 0.6;
      if (dpad.up || dpad.down) vy = dpad.up ? -0.6 : 0.6;
      if (vx || vy) this.moveCursor(vx, vy, dt);
    } else {
      const hold = (dir: 'up' | 'down' | 'left' | 'right', v: number) => (this.arrows[dir] ? v > RELEASE : v > PRESS);
      this.setArrows(
        { up: dpad.up || hold('up', -ay), down: dpad.down || hold('down', ay), left: dpad.left || hold('left', -ax), right: dpad.right || hold('right', ax) },
        now,
      );
    }
    // Correr: o analógico no fim ou o botão de correr segurado (só no mundo).
    const runButton = buttonFor('run');
    const run = ctx === 'world' && (mag >= RUN_AT || (runButton !== null && pressed(runButton)));
    if (run !== this.running) {
      this.running = run;
      keysOf('run').forEach((key) => send(run ? 'keydown' : 'keyup', key));
    }
  }

  /**
   * O que cada botão faz agora. Janelas, falas e menus têm botões fixos (A escolhe, B volta, LB/RB trocam a aba, o
   * botão do losango fecha a janela); no resto, data/controls.json (pad).
   */
  private keyFor(i: number, ctx: PadContext): Key[] | 'mouse' | 'mouse2' | 'confirm' | 'back' | 'tab-' | 'tab+' | 'hotbar-' | 'hotbar+' | null {
    const button = BUTTON_OF[i]!;
    const quick = buttonFor('quickMenu');
    if (ctx === 'ui' || ctx === 'panel') {
      if (i === B.A) return 'confirm';
      if (i === B.B) return ctx === 'panel' ? 'back' : [KEYS.ESC];
      if (i === B.START) return [KEYS.ESC];
      if (ctx === 'panel' && (i === B.LB || i === B.RB)) return i === B.RB ? 'tab+' : 'tab-';
      return i === quick ? keysOf('quickMenu') : null;
    }
    const name: PadContextName = ctx === 'minigame' ? (this.cursor ? 'minigameCursor' : 'minigame') : ctx;
    const action = controls.pad[name]?.[button];
    if (!action || action === 'run') return null; // correr é segurar (poll)
    if (action === 'hotbarPrev') return 'hotbar-';
    if (action === 'hotbarNext') return 'hotbar+';
    if (action === 'mouse') return 'mouse';
    if (action === 'mouseRight') return 'mouse2';
    const keys = keysOf(action);
    return keys.length > 0 ? keys : null;
  }

  private press(i: number, ctx: PadContext): void {
    const key = this.keyFor(i, ctx);
    // Segurado, conta como um toque só (o botão fica marcado, sem tecla para soltar).
    this.held.set(i, []);
    if (key === null) return;
    if (key === 'hotbar-' || key === 'hotbar+') return this.onHotbar(key === 'hotbar+' ? 1 : -1);
    if (key === 'tab-' || key === 'tab+') return void padNav.tab(key === 'tab+' ? 1 : -1);
    // B numa janela: no celular, de um app volta para a tela inicial; senão, fecha (Esc).
    if (key === 'back') {
      if (padNav.back()) return;
      this.held.set(i, [KEYS.ESC]);
      return send('keydown', KEYS.ESC);
    }
    if (key === 'mouse' || key === 'mouse2') {
      this.held.set(i, key);
      return this.mouse('down', key === 'mouse' ? 0 : 2);
    }
    if (key === 'confirm') {
      // Janelas e caixas de escolha: o A clica no destacado. Menus: o botão em foco. Sem nada, é o Enter (falas).
      const active = document.activeElement as HTMLElement | null;
      if (this.navLayer && padNav.press()) return;
      // (A tela inicial é um menu sem .menu-layer: vale qualquer botão em foco com um menu aberto.)
      if (menuOpen() && active && active.matches('button, input')) active.click();
      else {
        this.held.set(i, [KEYS.ENTER]);
        send('keydown', KEYS.ENTER);
      }
      return;
    }
    this.held.set(i, key);
    key.forEach((one) => send('keydown', one));
  }

  private release(i: number): void {
    const key = this.held.get(i);
    this.held.delete(i);
    if (key === 'mouse' || key === 'mouse2') this.mouse('up', key === 'mouse' ? 0 : 2);
    else key?.forEach((one) => send('keyup', one));
  }

  /**
   * Setas apertadas e soltas conforme a direção; segurada, repete. Com uma janela aberta, em vez das setas, o
   * destaque anda pela janela.
   */
  private setArrows(want: typeof this.arrows, now: number): void {
    let pushed = false;
    const step = (dir: 'up' | 'down' | 'left' | 'right', repeat = false) => {
      if (this.navLayer) padNav.move(dir);
      else send('keydown', KEYS[dir.toUpperCase() as 'UP'], repeat);
    };
    for (const dir of ['up', 'down', 'left', 'right'] as const) {
      if (want[dir] === this.arrows[dir]) continue;
      this.arrows[dir] = want[dir];
      if (!want[dir]) {
        send('keyup', KEYS[dir.toUpperCase() as 'UP']);
        continue;
      }
      pushed = true;
      this.repeatAt = now + REPEAT_WAIT;
      step(dir);
    }
    if (!pushed && now >= this.repeatAt && (want.up || want.down || want.left || want.right)) {
      this.repeatAt = now + REPEAT_EVERY;
      for (const dir of ['up', 'down', 'left', 'right'] as const) if (want[dir]) step(dir, true);
    }
  }

  private releaseAll(): void {
    for (const i of [...this.held.keys()]) this.release(i);
    this.setArrows({ up: false, down: false, left: false, right: false }, 0);
    if (this.running) keysOf('run').forEach((key) => send('keyup', key));
    this.running = false;
    if (this.cursor) {
      this.cursor = null;
      this.drawCursor();
    }
  }

  // ---------- Cursor dos mini games de mouse ----------

  private canvasRect(): DOMRect | null {
    return document.querySelector('canvas')?.getBoundingClientRect() ?? null;
  }

  private canvasCenter(): { x: number; y: number } | null {
    const r = this.canvasRect();
    return r ? { x: r.left + r.width / 2, y: r.top + r.height / 2 } : null;
  }

  private moveCursor(vx: number, vy: number, dt: number): void {
    const r = this.canvasRect();
    if (!r || !this.cursor) return;
    const speed = r.width * CURSOR_SPEED * dt;
    this.cursor.x = Math.min(r.right - 1, Math.max(r.left, this.cursor.x + vx * speed));
    this.cursor.y = Math.min(r.bottom - 1, Math.max(r.top, this.cursor.y + vy * speed));
    this.drawCursor();
    this.mouse('move', 0);
  }

  /** Mouse de mentira no ponto do cursor: o Phaser e os botões da tela recebem como se fosse o de verdade. */
  private mouse(kind: 'down' | 'up' | 'move', button: number): void {
    if (!this.cursor) return;
    const { x, y } = this.cursor;
    const target = document.elementFromPoint(x, y) ?? document.body;
    const held = [...this.held.values()];
    const buttons = (held.includes('mouse') ? 1 : 0) | (held.includes('mouse2') ? 2 : 0);
    const init = { clientX: x, clientY: y, button, buttons, bubbles: true, cancelable: true, view: window };
    const fire = (type: string, ev: Event) => {
      padEvents.add(ev);
      target.dispatchEvent(ev);
      return type;
    };
    if (kind === 'move') return void fire('mousemove', new MouseEvent('mousemove', init));
    fire(`pointer${kind}`, new PointerEvent(`pointer${kind}`, { ...init, pointerType: 'mouse', isPrimary: true }));
    fire(`mouse${kind}`, new MouseEvent(`mouse${kind}`, init));
    if (kind === 'up' && button === 0) fire('click', new MouseEvent('click', init));
  }

  private drawCursor(): void {
    if (!this.cursor) return void this.cursorEl?.remove();
    if (!this.cursorEl) {
      this.cursorEl = document.createElement('div');
      this.cursorEl.className = 'pad-cursor';
    }
    if (!this.cursorEl.isConnected) document.body.appendChild(this.cursorEl);
    this.cursorEl.style.transform = `translate(${this.cursor.x}px, ${this.cursor.y}px)`;
  }
}

/** A tecla, como se viesse do teclado (o Phaser lê o keyCode, que o navegador não deixa pôr no evento). */
function send(type: 'keydown' | 'keyup', key: Key, repeat = false): void {
  const e = new KeyboardEvent(type, { key: key.key, code: key.code, repeat, ctrlKey: !!key.ctrl, bubbles: true, cancelable: true });
  Object.defineProperty(e, 'keyCode', { get: () => key.keyCode });
  Object.defineProperty(e, 'which', { get: () => key.keyCode });
  padEvents.add(e);
  (document.activeElement ?? document.body).dispatchEvent(e);
}

/** Botão apertado (os gatilhos são analógicos: valem a partir da metade). */
const isDown = (b: GamepadButton | undefined) => !!b && (b.pressed || b.value > 0.5);

/**
 * Os controles ligados, somados num só. Alguns aparecem duas vezes (o 8BitDo pelo receptor, por exemplo), e às vezes
 * o primeiro da lista é o que não manda nada: lendo todos, qualquer um vale. Com algum no mapeamento padrão do
 * navegador, só os padrões contam (os outros têm eixos em outra ordem, e gatilhos parados em -1 moveriam o cursor).
 * Sem nenhum padrão (modo D-input), usa a mesma ordem dos botões e o direcional do eixo 9 (o "hat").
 */
function readPads(): { pressed: (i: number) => boolean; axes: number[]; any: boolean; standard: boolean } | null {
  let list: Gamepad[];
  try {
    list = [...(navigator.getGamepads?.() ?? [])].filter((p): p is Gamepad => !!p && p.connected);
  } catch {
    return null; // a página não pode ler controles (fora de https ou de localhost)
  }
  if (list.length === 0) return null;
  const standard = list.filter((p) => p.mapping === 'standard');
  const pads = standard.length > 0 ? standard : list;
  const hat = (p: Gamepad) => {
    if (p.mapping === 'standard' || p.axes.length < 10) return null;
    const v = p.axes[9]!;
    if (v > 1.1 || v < -1.1) return null; // parado (cerca de 1,29)
    // As 8 direções caem em -1, -5/7, -3/7 ... 1; fora delas (0, de um aparelho que não é direcional), não é direção.
    const k = ((v + 1) / 2) * 7;
    if (Math.abs(k - Math.round(k)) > 0.15) return null;
    const at = Math.round(k); // 0 cima, 1 cima-direita, 2 direita ... 7 cima-esquerda
    return { up: at === 7 || at <= 1, right: at >= 1 && at <= 3, down: at >= 3 && at <= 5, left: at >= 5 && at <= 7 };
  };
  const pressed = (i: number) =>
    pads.some((p) => {
      if (isDown(p.buttons[i])) return true;
      const h = hat(p);
      return !!h && ((i === B.UP && h.up) || (i === B.DOWN && h.down) || (i === B.LEFT && h.left) || (i === B.RIGHT && h.right));
    });
  const axes = [0, 1, 2, 3].map((a) => pads.reduce((best, p) => (Math.abs(p.axes[a] ?? 0) > Math.abs(best) ? p.axes[a]! : best), 0));
  const any = pads.some((p) => p.buttons.some(isDown) || hat(p) !== null);
  return { pressed, axes, any, standard: standard.length > 0 };
}

/** O controle do jogo (um só). */
export const pad = new PadInput();
