import Phaser from 'phaser';
import playerJson from '../../../data/player.json';
import { LocalStorage } from '../../platform/localStorage';
import { broom, content, emotes, serviceArt } from '../content';
import { saveSlot } from '../debug';
import { openSession } from '../saveGame';
import { catTexture } from '../entities/Cat';
import { npcTexture } from '../entities/Npc';
import { iconSheetKey } from '../icons';
import tilesetsJson from '../../../data/tilesets.json';

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
    this.load.image('broom', broom.image);
    this.load.image('emotes', emotes.image);
    this.load.image('van_left', content.delivery.van.left);
    // Ícones como texturas do Phaser (bebidas nas mãos e nos balões) e equipamentos animados.
    this.load.image(iconSheetKey(), content.icons.image);
    for (const [id, sheet] of Object.entries(content.icons.sheets ?? {})) this.load.image(iconSheetKey(id), sheet.image);
    const art = serviceArt;
    for (const [k, path] of Object.entries({ bubble_normal: art.bubble.normal, bubble_impatient: art.bubble.impatient, bubble_furious: art.bubble.furious, coin16: art.coin })) this.load.image(k, path);
    art.bubble.waiting.forEach((p, i) => this.load.image(`bubble_wait_${i}`, p));
    art.progress.forEach((p, i) => this.load.image(`progress_${i}`, p));
    art.readyMarker.forEach((p, i) => this.load.image(`ready_${i}`, p));
    this.load.spritesheet('dishes16', art.dishes.image, { frameWidth: art.dishes.tile, frameHeight: art.dishes.tile });
    for (const sheet of tilesetsJson.sheets) {
      if ('animation' in sheet) this.load.spritesheet(`anim:${sheet.id}`, sheet.image, { frameWidth: 32, frameHeight: 32 });
    }
    this.load.image('van_right', content.delivery.van.right);
    this.load.spritesheet(TEXTURE.player, playerJson.sheet, {
      frameWidth: playerJson.frameWidth,
      frameHeight: playerJson.frameHeight,
    });
  }

  async create(): Promise<void> {
    // Quadros da vassoura (tamanhos diferentes na mesma folha).
    const tex = this.textures.get('broom');
    for (const [name, [x, y, w, h]] of Object.entries(broom.frames)) tex.add(name, 0, x, y, w, h);
    const emoteTex = this.textures.get('emotes');
    for (const [name, [x, y, w, h]] of Object.entries(emotes.frames)) emoteTex.add(name, 0, x, y, w, h);
    // ?novo na URL começa um jogo novo (apaga o save).
    const forceNew = new URLSearchParams(window.location.search).has('novo');
    const { session, isNew } = await openSession(new LocalStorage(), saveSlot(), forceNew);
    this.scene.start('World', { session, isNew });
  }
}
