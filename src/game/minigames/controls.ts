// Controles dos mini games: teclado (setas/WASD, E/Espaço = ação, Esc = pausa) e mouse (clique = ação no ponto).
// Tudo passa por aqui, nunca direto pelas cenas: para pôr gamepad depois, basta somar os botões dele em
// direction() e chamar os mesmos callbacks de ação e pausa.
import Phaser from 'phaser';
import type { InputState } from '../../core/movement';

export class MiniGameControls {
  private keys: Record<'up' | 'down' | 'left' | 'right' | 'w' | 'a' | 's' | 'd' | 'e' | 'space', Phaser.Input.Keyboard.Key>;
  private actionCbs: ((world?: { x: number; y: number }) => void)[] = [];
  private pauseCbs: (() => void)[] = [];

  constructor(private scene: Phaser.Scene) {
    const K = Phaser.Input.Keyboard.KeyCodes;
    this.keys = scene.input.keyboard!.addKeys({ up: K.UP, down: K.DOWN, left: K.LEFT, right: K.RIGHT, w: K.W, a: K.A, s: K.S, d: K.D, e: K.E, space: K.SPACE }, false) as typeof this.keys;
    const kb = scene.input.keyboard!;
    const action = () => this.actionCbs.forEach((cb) => cb());
    const pause = () => this.pauseCbs.forEach((cb) => cb());
    const click = (p: Phaser.Input.Pointer) => {
      if (p.leftButtonDown()) this.actionCbs.forEach((cb) => cb({ x: p.worldX, y: p.worldY }));
    };
    kb.on('keydown-E', action);
    kb.on('keydown-SPACE', action);
    kb.on('keydown-ESC', pause);
    scene.input.on('pointerdown', click);
    // A cena é reaberta a cada partida: sem isso, os ouvintes da partida anterior continuariam vivos.
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
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

  /** E/Espaço ou clique (com o ponto do mundo, quando foi clique). */
  onAction(cb: (world?: { x: number; y: number }) => void): void {
    this.actionCbs.push(cb);
  }

  onPause(cb: () => void): void {
    this.pauseCbs.push(cb);
  }

  /** Mouse/ponteiro pressionado e onde (para jogos de desenhar ou de segurar). */
  pointer(): { down: boolean; x: number; y: number } {
    const p = this.scene.input.activePointer;
    return { down: p.isDown, x: p.worldX, y: p.worldY };
  }
}
