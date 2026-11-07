// Serviços compartilhados pelas cenas: armazenamento, saves, configurações e áudio. Criados uma vez no main.
import type Phaser from 'phaser';
import { parseSettings, serializeSettings, SETTINGS_KEY, type Settings } from '../core/settings';
import { LocalStorage } from '../platform/localStorage';
import type { Storage } from '../platform/storage';
import { AudioManager } from './audio/AudioManager';
import { isDebugOn } from './debug';
import { SaveManager } from './SaveManager';

export interface GameServices {
  storage: Storage;
  saves: SaveManager;
  audio: AudioManager;
  /** Grava as configurações (som) e aplica no áudio. */
  saveSettings(s: Settings): Promise<void>;
}

let current: GameServices | null = null;

/** Cria os serviços (lê as configurações antes, para o som já sair certo na Home). */
export async function initServices(game: Phaser.Game): Promise<GameServices> {
  if (current) return current;
  const storage = new LocalStorage();
  const saves = new SaveManager(storage, isDebugOn() ? 'debug-' : '');
  await saves.migrateLegacy();
  const audio = new AudioManager(game, parseSettings(await storage.load(SETTINGS_KEY)));
  current = {
    storage,
    saves,
    audio,
    async saveSettings(s) {
      audio.setSettings(s);
      await storage.save(SETTINGS_KEY, serializeSettings(s));
    },
  };
  return current;
}

export function services(): GameServices {
  if (!current) throw new Error('Serviços ainda não criados (initServices)');
  return current;
}
