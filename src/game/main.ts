import Phaser from 'phaser';
import './ui/ui.css';
import { BootScene } from './scenes/BootScene';
import { MainMenuScene } from './scenes/MainMenuScene';
import { WorldScene } from './scenes/WorldScene';
import { ChaseScene, CHASE_SCENE } from './minigames/ChaseScene';
import { FishingScene, FISHING_SCENE } from './minigames/FishingScene';
import { MiniGameRegistry } from './minigames/MiniGameRegistry';
import './ui/menu/menu.css';
import './ui/skin.css';
import { CANVAS_HEIGHT, CANVAS_WIDTH, GAME_HEIGHT, GAME_WIDTH, RENDER_SCALE } from './screen';

/** Maior escala inteira que cabe na janela (pixel art nítida, sem borrar). */
function integerZoom(): number {
  return Math.max(1, Math.floor(Math.min(window.innerWidth / GAME_WIDTH, window.innerHeight / GAME_HEIGHT)));
}

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'stage',
  width: CANVAS_WIDTH,
  height: CANVAS_HEIGHT,
  backgroundColor: '#2b1d1a',
  pixelArt: true,
  roundPixels: true,
  scale: { mode: Phaser.Scale.NONE, zoom: integerZoom() / RENDER_SCALE },
  physics: { default: 'arcade', arcade: { debug: false } },
  scene: [BootScene, MainMenuScene, WorldScene, ChaseScene, FishingScene],
});

// Mini games: id (data/minigames.json) -> cena. Para um jogo novo: a cena acima e uma linha aqui.
MiniGameRegistry.register('chase', CHASE_SCENE);
MiniGameRegistry.register('fishing', FISHING_SCENE);

/** Canvas e interface HTML crescem juntos, sempre na mesma escala inteira. */
function layout(): void {
  const zoom = integerZoom();
  game.scale.setZoom(zoom / RENDER_SCALE);
  const stage = document.getElementById('stage')!;
  stage.style.width = `${GAME_WIDTH * zoom}px`;
  stage.style.height = `${GAME_HEIGHT * zoom}px`;
  document.getElementById('ui')!.style.transform = `scale(${zoom})`;
}

layout();
window.addEventListener('resize', layout);

// F9 liga/desliga o modo debug (só em npm run dev; some do build de produção).
if (import.meta.env.DEV) {
  window.addEventListener('keydown', (e) => {
    if (e.code !== 'F9') return;
    e.preventDefault();
    void import('./debug').then((d) => d.setDebug(!d.isDebugOn()));
  });
}
