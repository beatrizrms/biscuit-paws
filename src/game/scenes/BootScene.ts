import Phaser from 'phaser';
import playerJson from '../../../data/player.json';
import { LocalStorage } from '../../platform/localStorage';
import { content } from '../content';
import { saveSlot } from '../debug';
import { openSession } from '../saveGame';
import { catTexture } from '../entities/Cat';
import { npcTexture } from '../entities/Npc';

export const TEXTURE = { player: 'player' } as const;

/** Carrega a arte e o save, e passa para o mundo. Cada folha do catálogo vira uma textura com o id dela. */
export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  preload(): void {
    const { sheets, tileSize } = content.catalog;
    for (const [id, sheet] of Object.entries(sheets)) {
      this.load.spritesheet(id, sheet.image, { frameWidth: tileSize, frameHeight: tileSize });
    }
    // Folhas do Cosy Cats dos gatos que vivem no mundo (a Tekinha só aparece em lembrança, em HTML).
    const sprites = content.catSprites;
    for (const variant of new Set(Object.values(content.cats).filter((c) => !c.memory).map((c) => c.variant))) {
      this.load.spritesheet(catTexture(variant), sprites.variants[variant]!, { frameWidth: sprites.frameSize, frameHeight: sprites.frameSize });
    }
    for (const npc of Object.values(content.npcs)) {
      this.load.spritesheet(npcTexture(npc.id), npc.sheet, { frameWidth: npc.frameWidth, frameHeight: npc.frameHeight });
    }
    this.load.spritesheet(TEXTURE.player, playerJson.sheet, {
      frameWidth: playerJson.frameWidth,
      frameHeight: playerJson.frameHeight,
    });
  }

  async create(): Promise<void> {
    // ?novo na URL começa um jogo novo (apaga o save).
    const forceNew = new URLSearchParams(window.location.search).has('novo');
    const { session, isNew } = await openSession(new LocalStorage(), saveSlot(), forceNew);
    this.scene.start('World', { session, isNew });
  }
}
