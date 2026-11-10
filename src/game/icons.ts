// Ícones de data/icons.json como quadros do Phaser (as folhas são carregadas no BootScene).
import type Phaser from 'phaser';
import { content } from './content';

/** Miniatura de um móvel (tile do catálogo) em HTML: o desenho inteiro (w x h células) cabendo em `px`. */
export function tileThumbHtml(tileName: string | undefined, px: number, hue?: number): string {
  const { tiles, sheets, tileSize } = content.catalog;
  const def = tileName ? tiles[tileName] : undefined;
  const sheet = def ? sheets[def.sheet] : undefined;
  if (!def || !sheet) return '';
  const rise = def.rise ?? 0;
  const scale = px / (Math.max(def.w, def.h + rise) * tileSize);
  const w = def.w * tileSize * scale;
  const h = (def.h + rise) * tileSize * scale;
  return `<span class="icon tile-thumb" style="${hue ? `filter:hue-rotate(${hue}deg);` : ''}width:${w}px;height:${h}px;background-image:url(${sheet.image});background-size:${sheet.columns * tileSize * scale}px auto;background-position:${-def.col * tileSize * scale}px ${-(def.row - rise) * tileSize * scale}px"></span>`;
}

/** Chave da textura de uma folha de ícones. */
export const iconSheetKey = (sheet?: string) => (sheet ? `icons_${sheet}` : 'icons_default');

/**
 * Textura e quadro de um ícone (o quadro é criado na primeira vez). `scale`: quanto escalar para o ícone
 * ter o tamanho padrão (folha em 64 px = 0,5, a arte nova desenhada em meia escala; decisão 052).
 */
export function iconFrame(scene: Phaser.Scene, icon: string): { key: string; frame: string; scale: number } | undefined {
  const icons = content.icons;
  const pos = icons.icons[icon];
  if (!pos) return undefined;
  const key = iconSheetKey(pos.sheet);
  const size = (pos.sheet ? icons.sheets?.[pos.sheet]?.tileSize : undefined) ?? icons.tileSize;
  const tex = scene.textures.get(key);
  const frame = `icon:${icon}`;
  if (!tex.has(frame)) tex.add(frame, 0, pos.col * size, pos.row * size, size, size);
  return { key, frame, scale: icons.tileSize / size };
}
