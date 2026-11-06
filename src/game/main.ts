import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene';
import { CafeScene } from './scenes/CafeScene';

export const GAME_WIDTH = 640;
export const GAME_HEIGHT = 360;

/** Maior escala inteira que cabe na janela (pixel art nítida, sem borrar). */
function integerZoom(): number {
  return Math.max(1, Math.floor(Math.min(window.innerWidth / GAME_WIDTH, window.innerHeight / GAME_HEIGHT)));
}

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  backgroundColor: '#2b1d1a',
  pixelArt: true,
  roundPixels: true,
  scale: { mode: Phaser.Scale.NONE, zoom: integerZoom() },
  physics: { default: 'arcade', arcade: { debug: false } },
  scene: [BootScene, CafeScene],
});

window.addEventListener('resize', () => game.scale.setZoom(integerZoom()));
