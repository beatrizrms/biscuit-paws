// A parte cheia das barras dos mini games (empolgação da varinha, paciência da escovação, desconfiança do remédio).
import type Phaser from 'phaser';

/**
 * Retângulo de cantos redondos que pode ficar bem estreito: sem largura, não desenha nada; o raio nunca passa da
 * metade da largura. Antes, a barra vazia virava um retângulo de 0,01 px com cantos de 3 px, e o iPhone travava
 * montando essa forma a cada quadro (a varinha começa com a empolgação em 0 e ficava parada por segundos).
 */
export function fillBarPart(g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number, radius: number): void {
  if (w < 1) return;
  g.fillRoundedRect(x, y, w, h, Math.min(radius, w / 2, h / 2));
}
