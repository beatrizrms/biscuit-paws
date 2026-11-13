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
import { CANVAS_HEIGHT, CANVAS_WIDTH, GAME_HEIGHT, GAME_WIDTH, RENDER_SCALE, screenInfo } from './screen';
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

/**
 * O recorte da tela de cada lado (o entalhe do iPhone, a câmera do Android em tela cheia), em px da tela. Para testar
 * no PC: ?recorte=47 (o do iPhone deitado).
 */
function safeInsets(): [number, number] {
  const forced = Number(new URLSearchParams(location.search).get('recorte'));
  if (forced > 0) return [forced, forced];
  const probe = document.createElement('div');
  probe.style.cssText = 'position:fixed;visibility:hidden;padding-left:env(safe-area-inset-left);padding-right:env(safe-area-inset-right)';
  document.body.appendChild(probe);
  const cs = getComputedStyle(probe);
  const insets: [number, number] = [parseFloat(cs.paddingLeft) || 0, parseFloat(cs.paddingRight) || 0];
  probe.remove();
  return insets;
}

/** Largura que os controles precisam em cada faixa dos lados (px do jogo): a barra de itens em pé e os atalhos. */
const SIDE_NEED = 42;
/** Para abrir as faixas, o jogo encolhe até esta fração da tela (mais que isso, como no tablet: controles por cima). */
const SIDE_SHRINK = 0.85;

/**
 * Escala e faixas no celular deitado: o jogo é 16:9 e a tela é mais comprida; as faixas que sobram dos lados recebem
 * o direcional, os botões e a barra de itens. Fora do recorte da tela (o entalhe do iPhone tira uns 47 px de cada
 * lado), cada faixa precisa de SIDE_NEED: o jogo encolhe um pouco para caber (no iPhone 14, uns 4%).
 */
function arrange(insets: [number, number]): { zoom: number; sides: boolean } {
  const zoom = integerZoom();
  if (!TOUCH_DEVICE) return { zoom, sides: false };
  const roomy = (window.innerWidth - 2 * Math.max(insets[0], insets[1])) / (GAME_WIDTH + 2 * SIDE_NEED);
  return roomy >= zoom ? { zoom, sides: true } : roomy >= zoom * SIDE_SHRINK ? { zoom: roomy, sides: true } : { zoom, sides: false };
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

/** Canvas e interface HTML crescem juntos, sempre na mesma escala. */
function layout(): void {
  const insets = safeInsets();
  const { zoom, sides } = arrange(insets);
  game.scale.setZoom(zoom / RENDER_SCALE);
  const stage = document.getElementById('stage')!;
  stage.style.width = `${GAME_WIDTH * zoom}px`;
  stage.style.height = `${GAME_HEIGHT * zoom}px`;
  document.getElementById('ui')!.style.transform = `scale(${zoom})`;
  document.getElementById('touch')!.style.transform = `scale(${zoom})`;
  // Faixas dos lados (touch.css e ui.css: #stage.sides). --side-l e --side-r: a parte de cada faixa fora do recorte da
  // tela, em px do jogo.
  const bar = (window.innerWidth - GAME_WIDTH * zoom) / 2;
  stage.style.setProperty('--side-l', `${Math.max(0, Math.floor((bar - insets[0]) / zoom))}px`);
  stage.style.setProperty('--side-r', `${Math.max(0, Math.floor((bar - insets[1]) / zoom))}px`);
  stage.classList.toggle('sides', sides);
  Object.assign(screenInfo, { w: window.innerWidth, h: window.innerHeight, zoom, bar, insets, touch: TOUCH_DEVICE, sides });
}

layout();
// Controles de toque (celular e tablet): aparecem sozinhos quando ela toca na tela.
touch.attach(document.getElementById('touch')!);
window.addEventListener('resize', layout);
// Girar o celular: algumas telas só dão o tamanho novo um pouco depois do evento.
window.addEventListener('orientationchange', () => window.setTimeout(layout, 300));
window.visualViewport?.addEventListener('resize', layout);

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
