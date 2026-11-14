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
/** As medidas da última arrumação da tela (main.ts: layout); o painel de debug mostra, para conferir no celular. */
export const screenInfo = { w: 0, h: 0, zoom: 1, bar: 0, insets: [0, 0] as [number, number], touch: false, sides: false };

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

/**
 * No celular, o mundo aparece maior: a câmera do mapa chega mais perto (mostra 16 x 9 tiles em vez de 20 x 11) e segue
 * a personagem. A proporção não muda (16:9). No computador, 1. ?toque na URL testa no PC.
 */
export const WORLD_ZOOM = worldZoom();

function worldZoom(): number {
  if (typeof window === 'undefined') return 1;
  const touch = (typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches) || new URLSearchParams(window.location.search).has('toque');
  return touch ? 1.25 : 1;
}

/** O pedaço do mundo que cabe na tela no mapa (px lógicos): 640 x 360 no PC, menos no celular. */
export const VIEW_WIDTH = GAME_WIDTH / WORLD_ZOOM;
export const VIEW_HEIGHT = GAME_HEIGHT / WORLD_ZOOM;

/** A câmera do mapa (WorldScene): a resolução lógica e o zoom do celular. */
export function setupWorldCamera(scene: Phaser.Scene): Phaser.Cameras.Scene2D.Camera {
  return scene.cameras.main.setZoom(RENDER_SCALE * WORLD_ZOOM);
}

/** Um retângulo fixo na tela (scrollFactor 0) que cobre a vista inteira, no zoom atual da câmera da cena. */
export function fixedScreenRect(scene: Phaser.Scene): { x: number; y: number; w: number; h: number } {
  const z = scene.cameras.main.zoom;
  return { x: (CANVAS_WIDTH / 2) * (1 - 1 / z), y: (CANVAS_HEIGHT / 2) * (1 - 1 / z), w: CANVAS_WIDTH / z, h: CANVAS_HEIGHT / z };
}
