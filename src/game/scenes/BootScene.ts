import Phaser from 'phaser';
import { itemIconKey } from '../careBubbles';
import { broom, content, emotes, serviceArt } from '../content';
import { preloadAudio } from '../audio/AudioManager';
import { t } from '../i18n';
import { GAME_HEIGHT, GAME_WIDTH, setupCamera } from '../screen';
import { initServices } from '../services';
import { startGame } from '../startGame';
import { catTexture } from '../entities/Cat';
import { npcTexture } from '../entities/Npc';
import { iconSheetKey } from '../icons';
import { sheetFrameSize } from '../tileArt';
import tilesetsJson from '../../../data/tilesets.json';
import { preloadCreatorLayers } from '../playerLook';

/**
 * Carrega a arte e o áudio (com barra de carregamento) e vai para a Home.
 * Atalhos de teste na URL: ?novo começa um jogo novo no slot 1; ?jogar continua o save mais recente (ou começa um novo).
 * Cada folha do catálogo vira uma textura com o id dela.
 */
export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  preload(): void {
    setupCamera(this).centerOn(GAME_WIDTH / 2, GAME_HEIGHT / 2);
    // Barra de carregamento (desenhada, sem arte).
    const w = 220;
    const x = (GAME_WIDTH - w) / 2;
    const y = GAME_HEIGHT / 2;
    this.add.text(GAME_WIDTH / 2, y - 16, t('boot.loading'), { fontFamily: 'Trebuchet MS, sans-serif', fontSize: '11px', color: '#fff4e0' }).setOrigin(0.5);
    this.add.rectangle(x - 2, y - 2, w + 4, 12, 0x5a4048).setOrigin(0);
    this.add.rectangle(x, y, w, 8, 0xf3e6d8).setOrigin(0);
    const bar = this.add.rectangle(x, y, 1, 8, 0xe58fa6).setOrigin(0);
    this.load.on(Phaser.Loader.Events.PROGRESS, (p: number) => bar.setSize(Math.max(1, Math.round(w * p)), 8));
    preloadAudio(this.load);
    const { sheets } = content.catalog;
    for (const [id, sheet] of Object.entries(sheets)) {
      const size = sheetFrameSize(id);
      this.load.spritesheet(id, sheet.image, { frameWidth: size, frameHeight: size });
    }
    // Todas as folhas do Cosy Cats: os gatos gerados pelas chegadas podem ter qualquer cor (são 12 folhas pequenas).
    const sprites = content.catSprites;
    for (const variant of Object.keys(sprites.variants)) {
      this.load.spritesheet(catTexture(variant), sprites.variants[variant]!, { frameWidth: sprites.frameSize, frameHeight: sprites.frameSize });
    }
    for (const npc of Object.values(content.npcs)) {
      this.load.spritesheet(npcTexture(npc.id), npc.sheet, { frameWidth: npc.frameWidth, frameHeight: npc.frameHeight });
    }
    this.load.image('broom', broom.image);
    this.load.image('broom_hold', broom.hold.image);
    this.load.image('emotes', emotes.image);
    this.load.image('van_left', content.delivery.van.left);
    // Ícones como texturas do Phaser (bebidas nas mãos e nos balões) e equipamentos animados.
    this.load.image(iconSheetKey(), content.icons.image);
    for (const [id, sheet] of Object.entries(content.icons.sheets ?? {})) this.load.image(iconSheetKey(id), sheet.image);
    // Itens com imagem própria nos balões dos gatos (health.json: care.bubbles, ex.: a varinha do pedido de brincar).
    for (const b of Object.values(content.health.care.bubbles)) {
      const item = b.item ? content.items[b.item] : undefined;
      if (item?.iconImage) this.load.image(itemIconKey(item.id), item.iconImage);
    }
    const art = serviceArt;
    for (const [k, path] of Object.entries({ bubble_normal: art.bubble.normal, bubble_impatient: art.bubble.impatient, bubble_furious: art.bubble.furious, coin16: art.coin })) this.load.image(k, path);
    art.bubble.waiting.forEach((p, i) => this.load.image(`bubble_wait_${i}`, p));
    art.progress.forEach((p, i) => this.load.image(`progress_${i}`, p));
    art.readyMarker.forEach((p, i) => this.load.image(`ready_${i}`, p));
    this.load.spritesheet('dishes16', art.dishes.image, { frameWidth: art.dishes.tile, frameHeight: art.dishes.tile });
    for (const sheet of tilesetsJson.sheets) {
      if ('animation' in sheet) {
        const size = sheetFrameSize(sheet.id);
        this.load.spritesheet(`anim:${sheet.id}`, sheet.image, { frameWidth: size, frameHeight: size });
      }
    }
    this.load.image('van_right', content.delivery.van.right);
    // Personagem: a frente de toda peça e a caminhada das completas (o criador mostra qualquer combinação; as poses vêm ao começar o jogo).
    preloadCreatorLayers(this.load);
  }

  async create(): Promise<void> {
    // Quadros da vassoura (tamanhos diferentes na mesma folha).
    const tex = this.textures.get('broom');
    for (const [name, [x, y, w, h]] of Object.entries(broom.frames)) tex.add(name, 0, x, y, w, h);
    const emoteTex = this.textures.get('emotes');
    for (const [name, [x, y, w, h]] of Object.entries(emotes.frames)) emoteTex.add(name, 0, x, y, w, h);
    const { saves } = await initServices(this.game);
    const params = new URLSearchParams(window.location.search);
    if (params.has('novo')) {
      await startGame(this, { mode: 'new', slot: 'slot1' });
      return;
    }
    if (params.has('jogar')) {
      const recent = await saves.mostRecent();
      const r = recent ? await startGame(this, { mode: 'load', from: recent }) : { ok: false as const, error: '' };
      if (!r.ok) await startGame(this, { mode: 'new', slot: 'slot1' });
      return;
    }
    this.scene.start('MainMenu');
  }
}
