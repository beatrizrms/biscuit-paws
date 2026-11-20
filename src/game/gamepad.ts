// Controle de videogame (gamepad, no layout do Xbox: A, B, X, Y). O jogo inteiro já ouve o teclado (mundo, falas,
// janelas, mini games), então o controle "aperta" as mesmas teclas: cada botão vira a tecla equivalente (apertar e
// soltar, para os jogos de segurar), o analógico e o direcional viram as setas e, na borda, o R de correr. Nos mini
// games de mouse, o analógico move um cursor e o A é o botão do mouse. Só entrada: nenhuma regra do jogo mora aqui.
import { menuOpen } from './ui/menu/MenuKit';
import { padEvents, touch } from './touch';

/** Onde ela está: muda o que o A (e alguns botões) aperta. */
export type PadContext = 'world' | 'ui' | 'minigame' | 'area';

interface Key {
  key: string;
  code: string;
  keyCode: number;
}

const k = (key: string, code: string, keyCode: number): Key => ({ key, code, keyCode });
const KEYS = {
  E: k('e', 'KeyE', 69),
  ENTER: k('Enter', 'Enter', 13),
  SPACE: k(' ', 'Space', 32),
  ESC: k('Escape', 'Escape', 27),
  T: k('t', 'KeyT', 84),
  I: k('i', 'KeyI', 73),
  F: k('f', 'KeyF', 70),
  P: k('p', 'KeyP', 80),
  M: k('m', 'KeyM', 77),
  C: k('c', 'KeyC', 67),
  R: k('r', 'KeyR', 82),
  UP: k('ArrowUp', 'ArrowUp', 38),
  DOWN: k('ArrowDown', 'ArrowDown', 40),
  LEFT: k('ArrowLeft', 'ArrowLeft', 37),
  RIGHT: k('ArrowRight', 'ArrowRight', 39),
};

/** Os botões no mapeamento padrão do navegador (a ordem de Gamepad.buttons). */
const B = { A: 0, B: 1, X: 2, Y: 3, LB: 4, RB: 5, LT: 6, RT: 7, SELECT: 8, START: 9, LS: 10, RS: 11, UP: 12, DOWN: 13, LEFT: 14, RIGHT: 15 } as const;

/** O nome do botão para cada tecla, nas dicas da tela (o P é o petisco nos mini games e o celular no mundo). */
const LABELS: Record<string, string> = { E: 'A', Espaço: 'A', Esc: 'B', I: 'Y', T: 'X', F: 'LT', M: 'L3', C: 'R3', R: 'RT' };

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
    // A tecla P tem dois nomes: o petisco nos mini games (Y) e o celular no mundo (Select).
    // Nos mini games, o Enter é o X; nos de mouse (o A clica), o E também.
    touch.padLabel = (key) => {
      const mini = this.context() === 'minigame';
      if (key === 'P') return mini ? 'Y' : 'Select';
      if (key === 'Enter' || key === 'ENTER') return mini ? 'X' : 'A';
      if (key === 'E' && mini && this.cursorOn) return 'X';
      return LABELS[key] ?? key;
    };
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

  private poll(now: number): void {
    const dt = this.last ? Math.min(0.05, (now - this.last) / 1000) : 0;
    this.last = now;
    const pad = [...(navigator.getGamepads?.() ?? [])].find((p) => p?.connected);
    if (!pad) return;
    const pressed = (i: number) => !!pad.buttons[i] && (pad.buttons[i]!.pressed || pad.buttons[i]!.value > 0.5);
    const ax = pad.axes[0] ?? 0;
    const ay = pad.axes[1] ?? 0;
    const mag = Math.min(1, Math.hypot(ax, ay));
    const any = pad.buttons.some((_, i) => pressed(i)) || mag > PRESS || Math.hypot(pad.axes[2] ?? 0, pad.axes[3] ?? 0) > PRESS;
    if (any && touch.mode !== 'pad') touch.usePad();
    if (touch.mode !== 'pad') return this.releaseAll();
    const ctx = this.context();
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
      const rx = pad.axes[2] ?? 0;
      const ry = pad.axes[3] ?? 0;
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
    // Correr: o analógico no fim ou o RT segurado (só no mundo).
    const run = ctx === 'world' && (mag >= RUN_AT || pressed(B.RT));
    if (run !== this.running) {
      this.running = run;
      send(run ? 'keydown' : 'keyup', KEYS.R);
    }
  }

  /** A tecla de cada botão agora. */
  private keyFor(i: number, ctx: PadContext): Key | Key[] | 'mouse' | 'mouse2' | 'confirm' | 'hotbar-' | 'hotbar+' | null {
    if (i === B.B || i === B.START) return KEYS.ESC;
    if (ctx === 'minigame') {
      // Jogo de mouse: o A clica; o X faz o que o teclado faz (Pronto e Oferecer no E, Servir e Confirmar no Enter).
      if (this.cursor) return i === B.A ? 'mouse' : i === B.Y ? 'mouse2' : i === B.X ? [KEYS.E, KEYS.ENTER] : null;
      return i === B.A ? KEYS.E : i === B.X ? KEYS.ENTER : i === B.Y ? KEYS.P : null;
    }
    if (ctx === 'area') return i === B.A ? KEYS.SPACE : i === B.X ? KEYS.ENTER : null;
    if (i === B.A) return ctx === 'ui' ? 'confirm' : KEYS.E;
    const map: Partial<Record<number, Key | 'hotbar-' | 'hotbar+'>> = { [B.X]: KEYS.T, [B.Y]: KEYS.I, [B.LT]: KEYS.F, [B.SELECT]: KEYS.P, [B.LS]: KEYS.M, [B.RS]: KEYS.C, [B.LB]: 'hotbar-', [B.RB]: 'hotbar+' };
    return map[i] ?? null;
  }

  private press(i: number, ctx: PadContext): void {
    const key = this.keyFor(i, ctx);
    // Segurado, conta como um toque só (o botão fica marcado, sem tecla para soltar).
    this.held.set(i, []);
    if (key === null) return;
    if (key === 'hotbar-' || key === 'hotbar+') return this.onHotbar(key === 'hotbar+' ? 1 : -1);
    if (key === 'mouse' || key === 'mouse2') {
      this.held.set(i, key);
      return this.mouse('down', key === 'mouse' ? 0 : 2);
    }
    if (key === 'confirm') {
      // Menus e caixas de escolha: o A aperta o botão em foco; sem foco, o primeiro ganha o foco (aparece marcado).
      const layer = focusLayer();
      const list = layer ? buttons(layer) : [];
      const active = document.activeElement as HTMLElement | null;
      if (layer && active && layer.contains(active) && active.matches('button, input')) active.click();
      else if (list.length > 0 && !menuOpen()) list[0]!.focus();
      else {
        this.held.set(i, [KEYS.ENTER]);
        send('keydown', KEYS.ENTER);
      }
      return;
    }
    const keys = Array.isArray(key) ? key : [key];
    this.held.set(i, keys);
    keys.forEach((one) => send('keydown', one));
  }

  private release(i: number): void {
    const key = this.held.get(i);
    this.held.delete(i);
    if (key === 'mouse' || key === 'mouse2') this.mouse('up', key === 'mouse' ? 0 : 2);
    else key?.forEach((one) => send('keyup', one));
  }

  /** Setas apertadas e soltas conforme a direção; segurada, repete. Nas caixas de escolha, passa o foco. */
  private setArrows(want: typeof this.arrows, now: number): void {
    let pushed = false;
    for (const dir of ['up', 'down', 'left', 'right'] as const) {
      if (want[dir] === this.arrows[dir]) continue;
      this.arrows[dir] = want[dir];
      send(want[dir] ? 'keydown' : 'keyup', KEYS[dir.toUpperCase() as 'UP']);
      if (want[dir]) {
        pushed = true;
        this.repeatAt = now + REPEAT_WAIT;
        this.moveFocus(dir);
      }
    }
    if (!pushed && now >= this.repeatAt && (want.up || want.down || want.left || want.right)) {
      this.repeatAt = now + REPEAT_EVERY;
      for (const dir of ['up', 'down', 'left', 'right'] as const) {
        if (!want[dir]) continue;
        send('keydown', KEYS[dir.toUpperCase() as 'UP'], true);
        this.moveFocus(dir);
      }
    }
  }

  /** Caixa de escolha aberta (fora dos menus, que andam pelas setas sozinhos): o direcional passa pelos botões. */
  private moveFocus(dir: 'up' | 'down' | 'left' | 'right'): void {
    if (this.context() !== 'ui' || menuOpen()) return;
    const layer = focusLayer();
    if (!layer) return;
    const list = buttons(layer);
    if (list.length === 0) return;
    const i = list.indexOf(document.activeElement as HTMLElement);
    const step = dir === 'up' || dir === 'left' ? -1 : 1;
    list[i < 0 ? 0 : (i + step + list.length) % list.length]!.focus();
  }

  private releaseAll(): void {
    for (const i of [...this.held.keys()]) this.release(i);
    this.setArrows({ up: false, down: false, left: false, right: false }, 0);
    if (this.running) send('keyup', KEYS.R);
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
  const e = new KeyboardEvent(type, { key: key.key, code: key.code, repeat, bubbles: true, cancelable: true });
  Object.defineProperty(e, 'keyCode', { get: () => key.keyCode });
  Object.defineProperty(e, 'which', { get: () => key.keyCode });
  padEvents.add(e);
  (document.activeElement ?? document.body).dispatchEvent(e);
}

/** A camada de botões de cima: um menu (pausa, tela inicial) ou uma caixa de escolha/confirmação. */
function focusLayer(): HTMLElement | null {
  const layers = document.querySelectorAll<HTMLElement>('.menu-layer, .confirm-layer');
  return layers[layers.length - 1] ?? null;
}

function buttons(layer: HTMLElement): HTMLElement[] {
  return [...layer.querySelectorAll<HTMLElement>('button:not([disabled])')].filter((b) => b.offsetParent !== null);
}

/** O controle do jogo (um só). */
export const pad = new PadInput();
