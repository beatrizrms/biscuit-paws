// Registro central: abre um mini game por id, pausa a cena que chamou e devolve o resultado para ela.
// Quem chama decide o que fazer com o resultado (o mundo paga as moedas pela sessão: session.finishMiniGame).
import type Phaser from 'phaser';
import type { MiniGameParams, MiniGameResult } from '../../core/minigame';
import type { MiniGameLaunch } from './MiniGameScene';

/** id do jogo (data/minigames.json) -> chave da cena Phaser. */
const SCENES: Record<string, string> = {};

export const MiniGameRegistry = {
  register(gameId: string, sceneKey: string): void {
    SCENES[gameId] = sceneKey;
  },

  /** Jogos registrados (para o atalho de debug). */
  ids(): string[] {
    return Object.keys(SCENES);
  },

  /**
   * Abre o jogo por cima da cena que chamou (ela fica pausada: relógio, NPCs e teclas param) e resolve com o
   * resultado quando a jogadora fecha a tela de resultado.
   */
  open(caller: Phaser.Scene, gameId: string, params: MiniGameParams, world: Omit<MiniGameLaunch, 'params' | 'done'>): Promise<MiniGameResult> {
    const key = SCENES[gameId];
    if (!key) return Promise.reject(new Error(`mini game não registrado "${gameId}"`));
    return new Promise((resolve) => {
      caller.scene.pause();
      const launch: MiniGameLaunch = {
        ...world,
        params,
        done: (result) => {
          caller.scene.stop(key);
          caller.scene.resume();
          resolve(result);
        },
      };
      caller.scene.launch(key, launch);
      caller.scene.bringToTop(key);
    });
  },
};
