// Ícones de data/icons.json como quadros do Phaser (as folhas são carregadas no BootScene).
import type Phaser from 'phaser';
import { content } from './content';

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
