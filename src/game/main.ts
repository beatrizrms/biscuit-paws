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
import { PhotoScene, PHOTO_SCENE } from './minigames/PhotoScene';
import { MiniGameRegistry } from './minigames/MiniGameRegistry';
import './ui/menu/menu.css';
import './ui/skin.css';
import { CANVAS_HEIGHT, CANVAS_WIDTH, GAME_HEIGHT, GAME_WIDTH, RENDER_SCALE } from './screen';
import { isTouchDevice, touch } from './touch';
import './touch.css';

/** Celular e tablet (tela de toque sem mouse, ou ?toque na URL). */
const TOUCH_DEVICE = isTouchDevice();

/**
 * Escala do jogo na janela. No computador, a maior inteira que cabe (pixel art nítida, sem borrar); tela menor que o
 * jogo encolhe até caber. No celular e no tablet, ocupa a tela toda mesmo sem ser inteira: a tela deles tem muitos
 * pixels e a arte em 64 px quase não perde nitidez (com escala inteira sobrava até metade da tela preta).
 */
function integerZoom(): number {
  const fit = Math.min(window.innerWidth / GAME_WIDTH, window.innerHeight / GAME_HEIGHT);
  return fit >= 1 && !TOUCH_DEVICE ? Math.floor(fit) : fit;
}

/** O recorte da tela (o entalhe do iPhone deitado), em px da tela: o lado maior. */
function safeInset(): number {
  const probe = document.createElement('div');
  probe.style.cssText = 'position:fixed;visibility:hidden;padding-left:env(safe-area-inset-left);padding-right:env(safe-area-inset-right)';
  document.body.appendChild(probe);
  const cs = getComputedStyle(probe);
  const inset = Math.max(parseFloat(cs.paddingLeft) || 0, parseFloat(cs.paddingRight) || 0);
  probe.remove();
  return inset;
}

/** Faixa dos lados a partir de que os controles e a barra de itens saem de cima do jogo (px do jogo, de 640). */
const SIDE_MIN = 36;

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
  scene: [BootScene, MainMenuScene, WorldScene, ChaseScene, FishingScene, LatteScene, KittenHuntScene, DeliveryScene, TrustScene, AdoptionScene, WandScene, GroomingScene, PillScene, FairSetupScene, CostumeScene, PhotoScene],
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
MiniGameRegistry.register('photo', PHOTO_SCENE);

/** Canvas e interface HTML crescem juntos, sempre na mesma escala inteira. */
function layout(): void {
  const zoom = integerZoom();
  game.scale.setZoom(zoom / RENDER_SCALE);
  const stage = document.getElementById('stage')!;
  stage.style.width = `${GAME_WIDTH * zoom}px`;
  stage.style.height = `${GAME_HEIGHT * zoom}px`;
  document.getElementById('ui')!.style.transform = `scale(${zoom})`;
  document.getElementById('touch')!.style.transform = `scale(${zoom})`;
  // Celular deitado: o jogo é 16:9 e a tela é mais comprida; as faixas que sobram dos lados (fora do entalhe) recebem
  // o direcional, os botões e a barra de itens (touch.css e ui.css: #stage.sides, --side em px do jogo).
  const side = ((window.innerWidth - GAME_WIDTH * zoom) / 2 - safeInset()) / zoom;
  stage.style.setProperty('--side', `${Math.max(0, Math.floor(side))}px`);
  stage.classList.toggle('sides', TOUCH_DEVICE && side >= SIDE_MIN);
}

layout();
// Controles de toque (celular e tablet): aparecem sozinhos quando ela toca na tela.
touch.attach(document.getElementById('touch')!);
window.addEventListener('resize', layout);

// F9 liga/desliga o modo debug (só em npm run dev; some do build de produção).
if (import.meta.env.DEV) {
  window.addEventListener('keydown', (e) => {
    if (e.code !== 'F9') return;
    e.preventDefault();
    void import('./debug').then((d) => d.setDebug(!d.isDebugOn()));
  });
}

// Debug: um erro de código (cena que quebrou ao carregar, por exemplo) aparece numa caixa na tela, para o celular
// também mostrar o que aconteceu (lá não há console). Toque na caixa para fechar.
if (import.meta.env.DEV) {
  const show = (msg: string, stack?: string) => {
    void import('./debug').then((d) => {
      if (!d.isDebugOn()) return;
      const box = document.createElement('pre');
      box.className = 'debug-error';
      box.textContent = `${msg}\n${(stack ?? '').split('\n').slice(0, 8).join('\n')}`;
      box.addEventListener('click', () => box.remove());
      document.body.appendChild(box);
    });
  };
  window.addEventListener('error', (e) => show(e.message, (e.error as Error | undefined)?.stack));
  window.addEventListener('unhandledrejection', (e) => show(String((e.reason as Error | undefined)?.message ?? e.reason), (e.reason as Error | undefined)?.stack));
}
