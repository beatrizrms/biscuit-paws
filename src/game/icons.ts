// Ícones de data/icons.json como quadros do Phaser (as folhas são carregadas no BootScene).
import type Phaser from 'phaser';
import { content } from './content';

/** Miniatura de um móvel (tile do catálogo) em HTML: o desenho inteiro (w x h células) cabendo em `px`. */
export function tileThumbHtml(tileName: string | undefined, px: number): string {
  const { tiles, sheets, tileSize } = content.catalog;
  const def = tileName ? tiles[tileName] : undefined;
  const sheet = def ? sheets[def.sheet] : undefined;
  if (!def || !sheet) return '';
  const scale = px / (Math.max(def.w, def.h) * tileSize);
  const w = def.w * tileSize * scale;
  const h = def.h * tileSize * scale;
  return `<span class="icon tile-thumb" style="width:${w}px;height:${h}px;background-image:url(${sheet.image});background-size:${sheet.columns * tileSize * scale}px auto;background-position:${-def.col * tileSize * scale}px ${-def.row * tileSize * scale}px"></span>`;
}

/** Chave da textura de uma folha de ícones. */
export const iconSheetKey = (sheet?: string) => (sheet ? `icons_${sheet}` : 'icons_default');

/** Textura e quadro de um ícone (o quadro é criado na primeira vez). */
export function iconFrame(scene: Phaser.Scene, icon: string): { key: string; frame: string } | undefined {
  const icons = content.icons;
  const pos = icons.icons[icon];
  if (!pos) return undefined;
  const key = iconSheetKey(pos.sheet);
  const tex = scene.textures.get(key);
  const frame = `icon:${icon}`;
  if (!tex.has(frame)) tex.add(frame, 0, pos.col * icons.tileSize, pos.row * icons.tileSize, icons.tileSize, icons.tileSize);
  return { key, frame };
}
