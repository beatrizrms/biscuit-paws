// Movimento da personagem a partir das teclas. Puro: sem Phaser, DOM ou window.

export type Direction = 'down' | 'left' | 'right' | 'up';

export interface InputState {
  left: boolean;
  right: boolean;
  up: boolean;
  down: boolean;
}

export interface Movement {
  vx: number;
  vy: number;
  moving: boolean;
  facing: Direction;
}

/**
 * Converte teclas em velocidade (px/s). Na diagonal a velocidade é normalizada,
 * para não andar mais rápido. A direção atual é mantida enquanto ainda for válida,
 * para a animação não "piscar" ao apertar uma segunda tecla.
 */
export function movementFromInput(input: InputState, speed: number, current: Direction): Movement {
  const dx = (input.right ? 1 : 0) - (input.left ? 1 : 0);
  const dy = (input.down ? 1 : 0) - (input.up ? 1 : 0);
  if (dx === 0 && dy === 0) return { vx: 0, vy: 0, moving: false, facing: current };

  const len = Math.hypot(dx, dy);
  const active: Direction[] = [];
  if (dx < 0) active.push('left');
  if (dx > 0) active.push('right');
  if (dy < 0) active.push('up');
  if (dy > 0) active.push('down');
  const facing = active.includes(current) ? current : active[0]!;

  return { vx: (dx / len) * speed, vy: (dy / len) * speed, moving: true, facing };
}
