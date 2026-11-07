// Ciclo dia/noite na tela: uma cor em MULTIPLY cobre o mundo e as luzes do mapa brilham com ADD
// por cima, mais fortes quanto mais escuro. As cores e as horas vêm do núcleo (time.ts + daynight.json).
import Phaser from 'phaser';
import type { MapLight } from '../core/map';
import { darkness, hexToRgb, rgbToHex, type RGB } from '../core/time';
import { GAME_HEIGHT, GAME_WIDTH } from './screen';

const TINT_DEPTH = 150_000;
const LIGHT_DEPTH = 150_001;
const LIGHT_TEXTURE = 'daynight-light';
const LIGHT_PX = 128;
const DEFAULT_RADIUS = 48;
const DEFAULT_COLOR = '#ffe2a0';

export class DayNightLayer {
  private tint: Phaser.GameObjects.Rectangle;
  private lights: Phaser.GameObjects.Image[] = [];
  private lastColor = -1;

  constructor(private scene: Phaser.Scene) {
    this.tint = scene.add
      .rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0xffffff)
      .setOrigin(0)
      .setScrollFactor(0)
      .setDepth(TINT_DEPTH)
      .setBlendMode(Phaser.BlendModes.MULTIPLY);
    if (!scene.textures.exists(LIGHT_TEXTURE)) DayNightLayer.createLightTexture(scene);
  }

  /** Brilho redondo e macio (gerado uma vez; não é arte do pacote). */
  private static createLightTexture(scene: Phaser.Scene): void {
    const canvas = scene.textures.createCanvas(LIGHT_TEXTURE, LIGHT_PX, LIGHT_PX)!;
    const ctx = canvas.getContext();
    const g = ctx.createRadialGradient(LIGHT_PX / 2, LIGHT_PX / 2, 0, LIGHT_PX / 2, LIGHT_PX / 2, LIGHT_PX / 2);
    g.addColorStop(0, 'rgba(255,255,255,0.9)');
    g.addColorStop(0.35, 'rgba(255,255,255,0.45)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, LIGHT_PX, LIGHT_PX);
    canvas.refresh();
  }

  /** Troca as luzes ao mudar de mapa. */
  setLights(lights: readonly MapLight[], tileSize: number): void {
    this.lights.forEach((l) => l.destroy());
    this.lights = lights.map((l) =>
      this.scene.add
        .image(l.at[0] * tileSize, l.at[1] * tileSize, LIGHT_TEXTURE)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setDepth(LIGHT_DEPTH)
        .setScale(((l.radius ?? DEFAULT_RADIUS) * 2) / LIGHT_PX)
        .setTint(rgbToHex(hexToRgb(l.color ?? DEFAULT_COLOR)))
        .setAlpha(0),
    );
  }

  /** Aplica a cor do momento; as luzes acendem conforme escurece. */
  update(color: RGB): void {
    const hex = rgbToHex(color);
    if (hex === this.lastColor) return;
    this.lastColor = hex;
    this.tint.setFillStyle(hex);
    const dark = darkness(color);
    for (const l of this.lights) l.setAlpha(dark);
  }
}
