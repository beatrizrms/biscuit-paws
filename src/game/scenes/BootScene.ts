import Phaser from 'phaser';
import playerJson from '../../../data/player.json';
import { LocalStorage } from '../../platform/localStorage';
import { content } from '../content';
import { openSession } from '../saveGame';

export const TEXTURE = { tiles: 'tiles', player: 'player' } as const;

/** Carrega a arte e o save, e passa para o café. */
export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  preload(): void {
    const { sheet } = content.catalog;
    this.load.spritesheet(TEXTURE.tiles, sheet.image, { frameWidth: sheet.tileSize, frameHeight: sheet.tileSize });
    this.load.spritesheet(TEXTURE.player, playerJson.sheet, {
      frameWidth: playerJson.frameWidth,
      frameHeight: playerJson.frameHeight,
    });
  }

  async create(): Promise<void> {
    // ?novo na URL começa um jogo novo (apaga o save).
    const forceNew = new URLSearchParams(window.location.search).has('novo');
    const { session, isNew } = await openSession(new LocalStorage(), forceNew);
    this.scene.start('Cafe', { session, isNew });
  }
}
