import Phaser from 'phaser';
import tilesJson from '../../../data/tiles.json';
import playerJson from '../../../data/player.json';
import type { TileCatalog } from '../../core/tiles';

export const TEXTURE = { tiles: 'tiles', player: 'player' } as const;

/** Carrega a arte e passa para o café. */
export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  preload(): void {
    const { sheet } = tilesJson as TileCatalog;
    this.load.spritesheet(TEXTURE.tiles, sheet.image, { frameWidth: sheet.tileSize, frameHeight: sheet.tileSize });
    this.load.spritesheet(TEXTURE.player, playerJson.sheet, {
      frameWidth: playerJson.frameWidth,
      frameHeight: playerJson.frameHeight,
    });
  }

  create(): void {
    this.scene.start('Cafe');
  }
}
