// Controles dos mini games: teclado (setas/WASD, E/Espaço = ação, Esc = pausa) e mouse (clique = ação no ponto).
// Tudo passa por aqui, nunca direto pelas cenas: para pôr gamepad depois, basta somar os botões dele em
// direction() e chamar os mesmos callbacks de ação e pausa.
import Phaser from 'phaser';
import type { InputState } from '../../core/movement';

const MOVE_KEYS: Record<string, 'up' | 'down' | 'left' | 'right'> = {
  ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down', ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right',
};

export class MiniGameControls {
  private keys: Record<'up' | 'down' | 'left' | 'right' | 'w' | 'a' | 's' | 'd' | 'e' | 'space' | 'enter', Phaser.Input.Keyboard.Key>;
  private actionCbs: ((world?: { x: number; y: number }) => void)[] = [];
  private moveCbs: ((dir: 'up' | 'down' | 'left' | 'right') => void)[] = [];
  private pauseCbs: (() => void)[] = [];

  constructor(private scene: Phaser.Scene) {
    const K = Phaser.Input.Keyboard.KeyCodes;
    this.keys = scene.input.keyboard!.addKeys({ up: K.UP, down: K.DOWN, left: K.LEFT, right: K.RIGHT, w: K.W, a: K.A, s: K.S, d: K.D, e: K.E, space: K.SPACE, enter: K.ENTER }, false) as typeof this.keys;
    const kb = scene.input.keyboard!;
    const action = () => this.actionCbs.forEach((cb) => cb());
    const pause = () => this.pauseCbs.forEach((cb) => cb());
    const click = (p: Phaser.Input.Pointer) => {
      if (p.leftButtonDown()) this.actionCbs.forEach((cb) => cb(this.toWorld(p)));
    };
    // Setas/WASD como "passos" (um por toque): escolher um alvo sem mouse (esconderijos, cartas...).
    const move = (e: KeyboardEvent) => {
      const dir = MOVE_KEYS[e.code];
      if (dir) this.moveCbs.forEach((cb) => cb(dir));
    };
    kb.on('keydown', move);
    kb.on('keydown-E', action);
    kb.on('keydown-SPACE', action);
    kb.on('keydown-ESC', pause);
    scene.input.on('pointerdown', click);
    // A cena é reaberta a cada partida: sem isso, os ouvintes da partida anterior continuariam vivos.
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      kb.off('keydown', move);
      kb.off('keydown-E', action);
      kb.off('keydown-SPACE', action);
      kb.off('keydown-ESC', pause);
      scene.input.off('pointerdown', click);
    });
  }

  /** Direção pedida agora (mesmo formato da caminhada do jogo). */
  direction(): InputState {
    const k = this.keys;
    return { up: k.up.isDown || k.w.isDown, down: k.down.isDown || k.s.isDown, left: k.left.isDown || k.a.isDown, right: k.right.isDown || k.d.isDown };
  }

  /** A ação está sendo segurada agora (E, Espaço ou botão do mouse): para jogos de segurar, como a pescaria. */
  holding(): boolean {
    return this.keys.e.isDown || this.keys.space.isDown || this.scene.input.activePointer.isDown;
  }

  /**
   * Enter (ou o botão do mouse) segurado: para segurar sem confundir com a ação do E (na pescaria, o E lança e fisga
   * e o Enter puxa).
   */
  holdingEnter(): boolean {
    return this.keys.enter.isDown || this.scene.input.activePointer.isDown;
  }

  /** E/Espaço ou clique (com o ponto do mundo, quando foi clique). */
  onAction(cb: (world?: { x: number; y: number }) => void): void {
    this.actionCbs.push(cb);
  }

  /** Um passo de seta/WASD (para escolher alvos com o teclado). */
  onMove(cb: (dir: 'up' | 'down' | 'left' | 'right') => void): void {
    this.moveCbs.push(cb);
  }

  onPause(cb: () => void): void {
    this.pauseCbs.push(cb);
  }

  /** Mouse/ponteiro pressionado e onde, no mundo (para jogos de desenhar ou de segurar). */
  pointer(): { down: boolean; x: number; y: number } {
    const p = this.scene.input.activePointer;
    return { down: p.isDown, ...this.toWorld(p) };
  }

  /**
   * Posição do ponteiro no mundo pela câmera desta cena. O worldX do Phaser pode vir em pixels do canvas
   * (1280 x 720) numa cena aberta por cima de outra; a câmera com zoom 2 (decisão 052) converte certo.
   */
  private toWorld(p: Phaser.Input.Pointer): { x: number; y: number } {
    const w = this.scene.cameras.main.getWorldPoint(p.x, p.y);
    return { x: w.x, y: w.y };
  }
}
