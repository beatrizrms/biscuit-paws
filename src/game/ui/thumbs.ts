// Miniaturas para a interface: o móvel recortado da própria folha de tiles (CSS, sem suavizar), cabendo numa caixa.
// Itens sem tile (ingredientes, ferramentas) usam o ícone de sempre.
import type { ItemDef } from '../../core/content';
import { content } from '../content';
import { itemIconHtml } from './Hotbar';

/** O tile inteiro (w x h células, mais as linhas de rise) reduzido para caber em box x box pixels do jogo. */
export function tileThumbHtml(tileName: string | undefined, box: number, hue?: number): string {
  const catalog = content.catalog;
  const def = tileName ? catalog.tiles[tileName] : undefined;
  const sheet = def ? catalog.sheets[def.sheet] : undefined;
  if (!def || !sheet) return '';
  const cell = catalog.tileSize * (sheet.resolution ?? 1);
  const rise = def.rise ?? 0;
  const h = def.h + rise;
  const k = Math.min(box / (def.w * cell), box / (h * cell));
  const px = (n: number) => `${+(n * k).toFixed(2)}px`;
  return `<span class="thumb" style="${hue ? `filter:hue-rotate(${hue}deg);` : ''}width:${px(def.w * cell)};height:${px(h * cell)};background-image:url(${sheet.image});background-size:${px(
    sheet.columns * cell,
  )} auto;background-position:-${px(def.col * cell)} -${px((def.row - rise) * cell)}"></span>`;
}

/** Miniatura de um item: a imagem própria (iconImage: o robô em vez da base dele), o móvel (tile) ou o ícone. */
export function itemThumbHtml(item: ItemDef, box: number): string {
  if (item.iconImage) return `<img class="thumb" src="${item.iconImage}" alt="" style="width:${box}px;height:${box}px;object-fit:contain;image-rendering:pixelated" />`;
  return item.tile ? tileThumbHtml(item.tile, box, item.hue) : itemIconHtml(item, Math.min(box, 32));
}
