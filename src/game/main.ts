import Phaser from 'phaser';
import './ui/ui.css';
import { BootScene } from './scenes/BootScene';
import { MainMenuScene } from './scenes/MainMenuScene';
import { WorldScene } from './scenes/WorldScene';
import { ChaseScene, CHASE_SCENE } from './minigames/ChaseScene';
import { FishingScene, FISHING_SCENE } from './minigames/FishingScene';
import { AdoptionScene, ADOPTION_SCENE } from './minigames/AdoptionScene';
import { DeliveryScene, DELIVERY_SCENE } from './minigames/DeliveryScene';
import { KittenHuntScene, KITTEN_HUNT_SCENE } from './minigames/KittenHuntScene';
import { LatteScene, LATTE_SCENE } from './minigames/LatteScene';
import { TrustScene, TRUST_SCENE } from './minigames/TrustScene';
import { WandScene, WAND_SCENE } from './minigames/WandScene';
import { GroomingScene, GROOMING_SCENE } from './minigames/GroomingScene';
import { PillScene, PILL_SCENE } from './minigames/PillScene';
import { FairSetupScene, FAIR_SETUP_SCENE } from './minigames/FairSetupScene';
import { CostumeScene, COSTUME_SCENE } from './minigames/CostumeScene';
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
  scene: [BootScene, MainMenuScene, WorldScene, ChaseScene, FishingScene, LatteScene, KittenHuntScene, DeliveryScene, TrustScene, AdoptionScene, WandScene, GroomingScene, PillScene, FairSetupScene, CostumeScene],
});

// Mini games: id (data/minigames.json) -> cena. Para um jogo novo: a cena acima e uma linha aqui.
MiniGameRegistry.register('chase', CHASE_SCENE);
MiniGameRegistry.register('fishing', FISHING_SCENE);
MiniGameRegistry.register('latte', LATTE_SCENE);
MiniGameRegistry.register('kitten_hunt', KITTEN_HUNT_SCENE);
MiniGameRegistry.register('delivery', DELIVERY_SCENE);
MiniGameRegistry.register('trust', TRUST_SCENE);
MiniGameRegistry.register('adoption', ADOPTION_SCENE);
MiniGameRegistry.register('wand', WAND_SCENE);
MiniGameRegistry.register('grooming', GROOMING_SCENE);
MiniGameRegistry.register('pill', PILL_SCENE);
MiniGameRegistry.register('fair_setup', FAIR_SETUP_SCENE);
MiniGameRegistry.register('costume', COSTUME_SCENE);

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
