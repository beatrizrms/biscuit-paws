import type Phaser from 'phaser';

// Resolução lógica do jogo: todas as posições, mapas e a interface HTML usam 640 x 360 (tile de 32).
export const GAME_WIDTH = 640;
export const GAME_HEIGHT = 360;

/**
 * O canvas tem o dobro de pixels (1280 x 720) e cada câmera usa zoom 2: a lógica continua em 640 x 360,
 * mas uma folha feita em 64 px por tile (resolution 2) mostra o detalhe inteiro (decisão 052).
 */
export const RENDER_SCALE = renderScale();

/** Padrão 2. Os testes de navegador usam ?escala=1: sem placa de vídeo (SwiftShader), 1280 x 720 cai para ~30 quadros/s. */
function renderScale(): number {
  const param = typeof window === 'undefined' ? null : new URLSearchParams(window.location.search).get('escala');
  return param === '1' ? 1 : 2;
}
export const CANVAS_WIDTH = GAME_WIDTH * RENDER_SCALE;
export const CANVAS_HEIGHT = GAME_HEIGHT * RENDER_SCALE;

/**
 * O zoom da câmera é a partir do centro. Um objeto fixo na tela (scrollFactor 0) na posição lógica (x, y)
 * precisa deste deslocamento para cair no lugar certo; e scrollX/scrollY = canto de cima da vista - deslocamento.
 */
export const SCREEN_OFFSET_X = (CANVAS_WIDTH / 2) * (1 - 1 / RENDER_SCALE);
export const SCREEN_OFFSET_Y = (CANVAS_HEIGHT / 2) * (1 - 1 / RENDER_SCALE);

/** Prepara a câmera principal de uma cena para a resolução lógica. */
export function setupCamera(scene: Phaser.Scene): Phaser.Cameras.Scene2D.Camera {
  return scene.cameras.main.setZoom(RENDER_SCALE);
}
