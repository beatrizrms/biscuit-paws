// Tiles do catálogo como imagens do Phaser, na escala da folha (decisão 052).
// Uma folha em 64 px (resolução 2) é desenhada na metade do tamanho: ocupa a mesma célula de 32 do mundo
// e, com a câmera em zoom 2, aparece pixel a pixel na tela.
import type Phaser from 'phaser';
import { sheetResolution } from '../core/tiles';
import { content } from './content';

/** Escala para desenhar um quadro da folha no mundo (1 para 32 px, 0.5 para 64 px). */
export function tileScale(sheet: string): number {
  return 1 / sheetResolution(content.catalog, sheet);
}

/** Lado do quadro na imagem da folha, em px (para carregar a folha). */
export function sheetFrameSize(sheet: string): number {
  return content.catalog.tileSize * sheetResolution(content.catalog, sheet);
}

/** Gira a cor da imagem (graus): o mesmo desenho com outra cor (ex.: o pote automático). Só no WebGL. */
export function applyHue(img: Phaser.GameObjects.Image, hue: number | undefined): void {
  if (hue) img.postFX?.addColorMatrix().hue(hue);
}

/** Giro de cor em CSS, para a interface (o mesmo de applyHue). */
export const hueCss = (hue: number | undefined) => (hue ? `filter:hue-rotate(${hue}deg);` : '');

/** Imagem de um quadro da folha com a origem no canto superior esquerdo, em (x, y) do mundo. */
export function addTileImage(scene: Phaser.Scene, x: number, y: number, sheet: string, frame: number): Phaser.GameObjects.Image {
  return scene.add.image(x, y, sheet, frame).setOrigin(0).setScale(tileScale(sheet));
}

/**
 * Tira uma lasca de `inset` px de cada borda do que cada quadro lê da folha (só no WebGL; o desenho continua do mesmo
 * tamanho). No celular o zoom (1,25) não divide a arte de 64 px por inteiro, e em algumas posições da câmera o iPhone
 * lia a fileira de pixels da peça vizinha na folha: viravam linhas claras atravessando o chão. Com a lasca, a borda
 * lê a própria peça. 0,15 px não aparece a olho.
 */
export function insetSheetFrames(scene: Phaser.Scene, key: string, inset = 0.15): void {
  if (!scene.textures.exists(key)) return;
  const texture = scene.textures.get(key);
  for (const name of texture.getFrameNames()) {
    const f = texture.get(name);
    const tw = f.source.width;
    const th = f.source.height;
    f.setUVs(f.cutWidth, f.cutHeight, (f.cutX + inset) / tw, (f.cutY + inset) / th, (f.cutX + f.cutWidth - inset) / tw, (f.cutY + f.cutHeight - inset) / th);
  }
}
