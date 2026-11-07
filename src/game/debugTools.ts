// Ferramentas do modo debug. Carregado sob demanda (import dinâmico) só em `npm run dev`,
// então nada disto entra no build de produção.
import { setDebug } from './debug';
import type { WorldScene } from './scenes/WorldScene';
import { DebugPanel } from './ui/DebugPanel';
import './ui/debug.css';

const OVERLAY_DEPTH = 99_999;

export function attachDebugTools(scene: WorldScene, root: HTMLElement): DebugPanel {
  const ts = scene.map.tileSize;
  const grid = scene.add
    .grid(0, 0, scene.map.cols * ts, scene.map.rows * ts, ts, ts)
    .setOrigin(0)
    .setOutlineStyle(0xd9475d, 0.5)
    .setDepth(OVERLAY_DEPTH)
    .setVisible(false);

  return new DebugPanel(root, scene.session, {
    skipDialogue: () => scene.ui.skipDialogue(),
    toggleCollision: () => {
      const world = scene.physics.world;
      world.drawDebug = !world.drawDebug;
      if (world.drawDebug && !world.debugGraphic) world.createDebugGraphic();
      world.debugGraphic?.clear().setVisible(world.drawDebug).setDepth(OVERLAY_DEPTH);
      return world.drawDebug;
    },
    toggleGrid: () => grid.setVisible(!grid.visible).visible,
    // Jogo novo no slot 1 do debug (a URL ?novo pula a Home).
    newGame: () => (window.location.href = `${window.location.pathname}?novo`),
    turnOff: () => setDebug(false),
  });
}
