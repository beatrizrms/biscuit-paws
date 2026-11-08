// Texturas dos mini games: chave -> arquivo (npm run minigames copia o pacote para public/assets/minigames).
// Toda a arte do pacote é de 64 px por tile e é desenhada na metade (ART_SCALE), como pede a decisão 052:
// assim um esconderijo de 64 x 64 ocupa uma célula de 32 do mundo e mostra o detalhe inteiro no canvas de 1280 x 720.
// Se um arquivo faltar, a chave ganha um placeholder (retângulo colorido) e o jogo funciona igual: dá para trocar a
// arte depois sem mexer na lógica.
import type Phaser from 'phaser';
import { content } from '../content';
import { catTexture } from '../entities/Cat';

export const ART_SCALE = 0.5;

export interface SheetSpec {
  key: string;
  file: string;
  frameWidth: number;
  frameHeight: number;
  /** Cor do placeholder (se o arquivo faltar). */
  placeholder: number;
}

const DIR = 'assets/minigames';

/** Gato em fuga. */
export const CHASE = {
  hideBox: { key: 'mg.chase.hide_box', file: `${DIR}/chase/anim_hide_box.png`, frameWidth: 64, frameHeight: 64, placeholder: 0xb07a4a },
  hideTrash: { key: 'mg.chase.hide_trash', file: `${DIR}/chase/anim_hide_trash.png`, frameWidth: 64, frameHeight: 64, placeholder: 0x7d8a8c },
  hideBush: { key: 'mg.chase.hide_bush', file: `${DIR}/chase/anim_hide_bush.png`, frameWidth: 64, frameHeight: 64, placeholder: 0x5f9a5a },
  hideCar: { key: 'mg.chase.hide_car', file: `${DIR}/chase/anim_hide_car.png`, frameWidth: 64, frameHeight: 64, placeholder: 0xd07070 },
  dust: { key: 'mg.chase.dust', file: `${DIR}/chase/anim_dust.png`, frameWidth: 32, frameHeight: 32, placeholder: 0xe8dcc8 },
  arrow: { key: 'mg.chase.arrow', file: `${DIR}/chase/ui_arrow.png`, frameWidth: 24, frameHeight: 24, placeholder: 0xd97890 },
  /** Quadro 0: "!" (o gato te notou); quadro 1: "?". */
  alerts: { key: 'mg.chase.alerts', file: `${DIR}/chase/ui_alerts.png`, frameWidth: 32, frameHeight: 32, placeholder: 0xfff4e0 },
} satisfies Record<string, SheetSpec>;

/** Pescaria. A barra de timing é só a moldura: a zona verde, o indicador e o progresso são desenhados por cima. */
export const FISHING = {
  water: { key: 'mg.fishing.water', file: `${DIR}/fishing/anim_water.png`, frameWidth: 64, frameHeight: 64, placeholder: 0x6fa8c8 },
  bobber: { key: 'mg.fishing.bobber', file: `${DIR}/fishing/anim_bobber.png`, frameWidth: 32, frameHeight: 32, placeholder: 0xd9475d },
  pier: { key: 'mg.fishing.pier', file: `${DIR}/fishing/tile_pier.png`, frameWidth: 192, frameHeight: 128, placeholder: 0x9b6a45 },
  bar: { key: 'mg.fishing.bar', file: `${DIR}/fishing/ui_timing_bar.png`, frameWidth: 48, frameHeight: 192, placeholder: 0xfff7e6 },
  /** Peixes em 64 px (arte nova, npm run pixellab): desenhados em um quarto da escala, do tamanho dos antigos de 32 px. */
  fish: { key: 'mg.fishing.fish', file: `${DIR}/fishing/icons_fish_pixellab.png`, frameWidth: 64, frameHeight: 64, placeholder: 0xe0a94e },
} satisfies Record<string, SheetSpec>;

/** Latte art. Os contornos são desenhados dos pontos dos dados (as imagens-guia do pacote ficam de reserva). */
export const LATTE = {
  cup: { key: 'mg.latte.cup', file: `${DIR}/latte/obj_cup.png`, frameWidth: 192, frameHeight: 192, placeholder: 0xf5d7ac },
  pitcher: { key: 'mg.latte.pitcher', file: `${DIR}/latte/obj_pitcher.png`, frameWidth: 48, frameHeight: 48, placeholder: 0xc8ccd0 },
} satisfies Record<string, SheetSpec>;

/**
 * Caça ao filhote: os esconderijos que não existem no pacote: cesto, caixote e vaso (64 x 64, 1 x 1 tile,
 * quadro 0 parado), gerados no PixelLab e copiados por `npm run pixellab`. Sem o arquivo, viram retângulos coloridos.
 * Caixa, lixeira, arbusto e carro são os do Gato em fuga.
 */
export const KITTEN_HUNT = {
  basket: { key: 'mg.hunt.basket', file: `${DIR}/hunt/hide_basket.png`, frameWidth: 64, frameHeight: 64, placeholder: 0xd8a75e },
  crate: { key: 'mg.hunt.crate', file: `${DIR}/hunt/hide_crate.png`, frameWidth: 64, frameHeight: 64, placeholder: 0xa8663e },
  pot: { key: 'mg.hunt.pot', file: `${DIR}/hunt/hide_pot.png`, frameWidth: 64, frameHeight: 64, placeholder: 0xc0704a },
} satisfies Record<string, SheetSpec>;

/**
 * Entrega relâmpago: a bicicleta (128 x 128, 2 x 2 tiles, de lado, virada para a direita; espelhada para a esquerda) e a porta
 * da casa de entrega (64 x 128, 1 x 2 tiles), copiadas por `npm run pixellab` (arte do PixelLab). Sem o arquivo,
 * viram retângulos coloridos. Pedestres são os NPCs de cliente.
 */
export const DELIVERY = {
  bike: { key: 'mg.delivery.bike', file: `${DIR}/delivery/obstacle_bike.png`, frameWidth: 128, frameHeight: 128, placeholder: 0x5a86b8 },
  door: { key: 'mg.delivery.door', file: `${DIR}/delivery/goal_door.png`, frameWidth: 64, frameHeight: 128, placeholder: 0x9fd8b5 },
} satisfies Record<string, SheetSpec>;

/** Onde fica a parte de dentro da barra de timing (pixels da arte, 48 x 192): o trilho e o tubo do progresso. */
export const BAR_TRACK = { x: 8, w: 19, y: 40, h: 113, progressX: 28, progressW: 3 };

/** Tipos de esconderijo (data/minigames.json: games.chase.spots[].kind) -> textura. */
export const HIDE_SHEETS: Record<string, SheetSpec> = { box: CHASE.hideBox, trash: CHASE.hideTrash, bush: CHASE.hideBush, car: CHASE.hideCar };

/** Tipos de esconderijo da caça ao filhote (data/minigames.json: games.kitten_hunt.hideoutKinds) -> textura. */
export const HUNT_SHEETS: Record<string, SheetSpec> = { ...HIDE_SHEETS, basket: KITTEN_HUNT.basket, crate: KITTEN_HUNT.crate, pot: KITTEN_HUNT.pot };

/** Folhas do Cosy Cats que o Boot não carregou (ele só carrega os gatos do mundo): os do abrigo, os filhotes... */
export function loadCatVariants(scene: Phaser.Scene, variants: Iterable<string>): void {
  const sprites = content.catSprites;
  for (const v of new Set(variants)) {
    const file = sprites.variants[v];
    if (file && !scene.textures.exists(catTexture(v))) scene.load.spritesheet(catTexture(v), file, { frameWidth: sprites.frameSize, frameHeight: sprites.frameSize });
  }
}

export function loadSheets(scene: Phaser.Scene, sheets: SheetSpec[]): void {
  for (const s of sheets) if (!scene.textures.exists(s.key)) scene.load.spritesheet(s.key, s.file, { frameWidth: s.frameWidth, frameHeight: s.frameHeight });
}

/** Depois do load: quem não carregou vira um placeholder com o mesmo tamanho de quadro (2 quadros). */
export function ensurePlaceholders(scene: Phaser.Scene, sheets: SheetSpec[]): string[] {
  const missing: string[] = [];
  for (const s of sheets) {
    if (scene.textures.exists(s.key)) continue;
    missing.push(s.key);
    const g = scene.make.graphics({ x: 0, y: 0 }, false);
    for (let i = 0; i < 2; i++) {
      g.fillStyle(s.placeholder, 1).fillRect(i * s.frameWidth + 2, 2, s.frameWidth - 4, s.frameHeight - 4);
      g.lineStyle(2, 0x3b2a32, 1).strokeRect(i * s.frameWidth + 2, 2, s.frameWidth - 4, s.frameHeight - 4);
    }
    g.generateTexture(s.key, s.frameWidth * 2, s.frameHeight);
    g.destroy();
    const tex = scene.textures.get(s.key);
    for (let i = 0; i < 2; i++) tex.add(i, 0, i * s.frameWidth, 0, s.frameWidth, s.frameHeight);
  }
  if (missing.length) console.warn(`[mini games] placeholders: ${missing.join(', ')} (rode npm run minigames)`);
  return missing;
}
