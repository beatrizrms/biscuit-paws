// Ciclo dia/noite na tela: uma cor em MULTIPLY cobre o mundo e as luzes do mapa brilham com ADD
// por cima, mais fortes quanto mais escuro. As cores e as horas vêm do núcleo (time.ts + daynight.json).
import Phaser from 'phaser';
import type { MapLight } from '../core/map';
import { darkness, hexToRgb, rgbToHex, type RGB } from '../core/time';
import { GAME_HEIGHT, GAME_WIDTH, SCREEN_OFFSET_X, SCREEN_OFFSET_Y } from './screen';
import { tileScale } from './tileArt';

const TINT_DEPTH = 150_000;
const LIGHT_DEPTH = 150_001;
const OUTDOOR_DEPTH = 150_000.5;
const LIGHT_TEXTURE = 'daynight-light';
const LIGHT_PX = 128;
const DEFAULT_RADIUS = 48;
const DEFAULT_COLOR = '#ffe2a0';

export class DayNightLayer {
  private tint: Phaser.GameObjects.Rectangle;
  private lights: Phaser.GameObjects.Image[] = [];
  /** Áreas ao ar livre dentro de um mapa interno (ex.: o quintal do café): luz de fora por cima da de dentro. */
  private outdoor: Phaser.GameObjects.Rectangle[] = [];
  /** O céu das janelas de um mapa interno: só os pixels de céu do vidro, com a cor de fora (à noite, escuro). */
  private glass: Phaser.GameObjects.Image[] = [];
  private lastKey = '';

  constructor(private scene: Phaser.Scene) {
    this.tint = scene.add
      .rectangle(SCREEN_OFFSET_X, SCREEN_OFFSET_Y, GAME_WIDTH, GAME_HEIGHT, 0xffffff)
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

  /**
   * Janelas do mapa (as que mostram o céu): uma máscara com só os pixels de céu do vidro (azuis), gerada uma vez por
   * peça, recebe a cor de fora por cima da de dentro, como as áreas ao ar livre. Moldura, cortina e galhos ficam com
   * a luz de dentro.
   */
  setWindowGlass(windows: readonly { x: number; y: number; sheet: string; frame: number }[]): void {
    this.glass.forEach((g) => g.destroy());
    this.glass = windows.map((w) =>
      this.scene.add
        .image(w.x, w.y, DayNightLayer.skyMask(this.scene, w.sheet, w.frame))
        .setOrigin(0)
        .setScale(tileScale(w.sheet))
        .setDepth(OUTDOOR_DEPTH)
        .setBlendMode(Phaser.BlendModes.MULTIPLY)
        .setVisible(false),
    );
    this.lastKey = '';
  }

  /** Máscara do céu de uma peça: branco onde o pixel é azul (céu e brilho do vidro), transparente no resto. */
  private static skyMask(scene: Phaser.Scene, sheet: string, frameIndex: number): string {
    const key = `sky-mask:${sheet}:${frameIndex}`;
    if (scene.textures.exists(key)) return key;
    const frame = scene.textures.getFrame(sheet, frameIndex);
    const w = frame.cutWidth;
    const h = frame.cutHeight;
    const canvas = scene.textures.createCanvas(key, w, h)!;
    const ctx = canvas.getContext();
    ctx.drawImage(frame.source.image as CanvasImageSource, frame.cutX, frame.cutY, w, h, 0, 0, w, h);
    const img = ctx.getImageData(0, 0, w, h);
    const d = img.data;
    for (let i = 0; i < d.length; i += 4) {
      const sky = d[i + 3]! > 0 && d[i + 2]! > d[i]! + 25 && d[i + 2]! >= d[i + 1]!;
      d[i] = d[i + 1] = d[i + 2] = 255;
      d[i + 3] = sky ? 255 : 0;
    }
    ctx.putImageData(img, 0, 0);
    canvas.refresh();
    return key;
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

  /** Retângulos (pixels do mundo) que recebem a luz de fora; [] tira. */
  setOutdoorAreas(rects: readonly { x: number; y: number; w: number; h: number }[]): void {
    this.outdoor.forEach((r) => r.destroy());
    this.outdoor = rects.map((r) =>
      this.scene.add.rectangle(r.x, r.y, r.w, r.h, 0xffffff).setOrigin(0).setDepth(OUTDOOR_DEPTH).setBlendMode(Phaser.BlendModes.MULTIPLY),
    );
    this.lastKey = '';
  }

  /**
   * Aplica a cor do momento; as luzes acendem conforme escurece. `outdoor`: a cor de fora, para as áreas ao ar livre
   * (a camada delas multiplica a diferença, então o resultado nelas é a cor de fora).
   */
  update(color: RGB, outdoor?: RGB, lightsFloor = 0): void {
    const key = `${color.join()}|${outdoor?.join() ?? ''}|${lightsFloor.toFixed(2)}`;
    if (key === this.lastKey) return;
    this.lastKey = key;
    this.tint.setFillStyle(rgbToHex(color));
    if (outdoor) {
      const ratio = [0, 1, 2].map((i) => Math.min(255, Math.round((outdoor[i]! / Math.max(1, color[i]!)) * 255))) as RGB;
      for (const r of this.outdoor) r.setFillStyle(rgbToHex(ratio));
      for (const g of this.glass) g.setTint(rgbToHex(ratio)).setVisible(true);
    }
    // As lâmpadas acendem com o escuro de fora (dentro do café também: a tinta de dentro é mais fraca) e, a partir
    // da hora delas (lightsOn), ficam acesas pelo menos um tanto.
    const dark = Math.max(darkness(outdoor ?? color), lightsFloor);
    for (const l of this.lights) l.setAlpha(dark);
  }
}
