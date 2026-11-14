// Luz e sombra de ambiente por cima da arte (sem mudar os PNGs): sombras de contato embaixo dos objetos e de quem
// anda, o escurecido onde a parede encontra o piso, a luz das janelas no piso (some à noite) e a vinheta.
// As formas vêm do núcleo (src/core/ambience.ts); aqui só se desenha. Fica acima do piso e abaixo dos objetos.
import Phaser from 'phaser';
import type { Ambience, AmbienceConfig } from '../core/ambience';
import { hexToRgb, rgbToHex } from '../core/time';
import { frameOf } from '../core/tiles';
import { content } from './content';
import { fixedScreenRect } from './screen';

const SHADOW_TEXTURE = 'ambience-shadow';
const VIGNETTE_TEXTURE = 'ambience-vignette';
/** Acima do piso, dos tapetes e da sujeira (0 a 0.6), abaixo das paredes (1) e de tudo que usa y-sort (>= 32). */
const FLOOR_FX_DEPTH = 0.7;
/** Abaixo da cor do dia/noite (150 000): a vinheta escurece junto com a noite. */
const VIGNETTE_DEPTH = 149_000;
/** A base de uma peça é a faixa desenhada mais baixa: até esta fração da altura do quadro acima do último pixel. */
const FOOT_BAND = 0.12;
/** Camadas da luz da janela (de fora para dentro): mais camadas = borda mais macia. */
const WINDOW_STEPS = 4;

export interface AmbienceActor {
  x: number;
  y: number;
  w: number;
  visible: boolean;
}

export class AmbienceLayer {
  private statics: Phaser.GameObjects.GameObject[] = [];
  private windowGfx: Phaser.GameObjects.Graphics | null = null;
  private actorShadows: Phaser.GameObjects.Image[] = [];
  private vignette: Phaser.GameObjects.Image;
  /** Base desenhada de cada peça (medida na arte uma vez): onde a sombra encosta. */
  private feet = new Map<string, { bottom: number; left: number; right: number } | null>();
  /** Pixels de cada folha (lidos uma vez), para medir as bases. */
  private pixels = new Map<string, { data: Uint8ClampedArray; width: number } | null>();

  constructor(
    private scene: Phaser.Scene,
    private cfg: AmbienceConfig,
  ) {
    AmbienceLayer.createTextures(scene);
    const view = fixedScreenRect(scene);
    this.vignette = scene.add
      .image(view.x, view.y, VIGNETTE_TEXTURE)
      .setOrigin(0)
      .setDisplaySize(view.w, view.h)
      .setScrollFactor(0)
      .setDepth(VIGNETTE_DEPTH)
      .setAlpha(cfg.vignetteAlpha);
  }

  /** Texturas macias geradas uma vez (gradientes; não são arte do pacote). */
  private static createTextures(scene: Phaser.Scene): void {
    const tex = scene.textures;
    if (!tex.exists(SHADOW_TEXTURE)) {
      // Elipse escura no meio, sumindo nas bordas (desenhada redonda e achatada pela escala).
      const c = tex.createCanvas(SHADOW_TEXTURE, 64, 64)!;
      const ctx = c.getContext();
      const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
      g.addColorStop(0, 'rgba(40,24,30,1)');
      g.addColorStop(0.55, 'rgba(40,24,30,0.6)');
      g.addColorStop(1, 'rgba(40,24,30,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 64, 64);
      c.refresh();
    }
    if (!tex.exists(VIGNETTE_TEXTURE)) {
      const w = 320;
      const h = 180;
      const c = tex.createCanvas(VIGNETTE_TEXTURE, w, h)!;
      const ctx = c.getContext();
      const g = ctx.createRadialGradient(w / 2, h / 2, h * 0.45, w / 2, h / 2, w * 0.62);
      g.addColorStop(0, 'rgba(30,18,24,0)');
      g.addColorStop(1, 'rgba(30,18,24,1)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
      c.refresh();
    }
  }

  /** Troca as formas ao mudar de mapa (ou ao mudar os móveis). */
  setAmbience(a: Ambience): void {
    this.statics.forEach((o) => o.destroy());
    this.statics = [];
    this.windowGfx?.destroy();
    this.windowGfx = null;
    const cfg = this.cfg;
    for (const s of a.shadows) {
      // Na base desenhada (pote, caminha e arranhador não encostam no fundo da célula): senão parecem flutuar.
      const foot = this.footOf(s.tile);
      if (foot) this.statics.push(this.shadowImage(s.left + (foot.left + foot.right) / 2, s.top + foot.bottom - 1, (foot.right - foot.left) * cfg.shadowWidth + 4));
      else this.statics.push(this.shadowImage(s.x, s.y, s.w));
    }
    // Faixas junto da parede: degradê por canto (escuro do lado da parede). Num só Graphics, contínuo de um tile
    // para o outro (com uma textura girada por tile apareciam falhas nas emendas).
    const edges = this.scene.add.graphics().setDepth(FLOOR_FX_DEPTH);
    const ink = 0x28181e;
    const on = cfg.edgeAlpha;
    for (const e of a.edges) {
      const [tl, tr, bl, br] = e.wall === 'up' ? [on, on, 0, 0] : e.wall === 'left' ? [on, 0, on, 0] : [0, on, 0, on];
      edges.fillGradientStyle(ink, ink, ink, ink, tl, tr, bl, br).fillRect(e.x, e.y, e.w, e.h);
    }
    this.statics.push(edges);
    if (a.windows.length > 0) {
      // Luz somada (ADD): clareia o piso sem apagar a arte. Camadas encolhendo para o meio = borda macia.
      const g = this.scene.add.graphics().setDepth(FLOOR_FX_DEPTH + 0.01).setBlendMode(Phaser.BlendModes.ADD);
      const color = rgbToHex(hexToRgb(cfg.windowColor));
      for (const w of a.windows) {
        const cx = w.points.reduce((s, p) => s + p[0], 0) / w.points.length;
        const cy = w.points.reduce((s, p) => s + p[1], 0) / w.points.length;
        for (let i = 0; i < WINDOW_STEPS; i++) {
          const k = 1 - i * 0.12;
          g.fillStyle(color, 1 / WINDOW_STEPS);
          g.fillPoints(w.points.map(([x, y]) => new Phaser.Math.Vector2(cx + (x - cx) * k, cy + (y - cy) * k)), true);
        }
      }
      this.windowGfx = g;
    }
  }

  /**
   * A cada quadro: sombras de quem anda (personagem, gatos, NPCs, clientes) e a luz das janelas pela hora
   * (`daylight`: 1 de dia, 0 à noite).
   */
  update(actors: readonly AmbienceActor[], daylight: number): void {
    while (this.actorShadows.length < actors.length) this.actorShadows.push(this.shadowImage(0, 0, 16));
    this.actorShadows.forEach((img, i) => {
      const a = actors[i];
      if (!a || !a.visible) return void img.setVisible(false);
      img.setVisible(true).setPosition(Math.round(a.x), Math.round(a.y)).setDisplaySize(a.w, this.cfg.shadowHeight);
    });
    this.windowGfx?.setAlpha(this.cfg.windowAlpha * Math.max(0, Math.min(1, daylight)));
  }

  /**
   * Base desenhada da peça, em px do mundo a partir do canto dela: a última linha com pixel (bottom) e, na faixa
   * logo acima, onde a arte começa e termina (left, right). null = não deu para medir (fica a base da célula).
   */
  private footOf(tile: string): { bottom: number; left: number; right: number } | null {
    if (this.feet.has(tile)) return this.feet.get(tile)!;
    const def = content.catalog.tiles[tile];
    const texture = def && this.scene.textures.exists(def.sheet) ? this.scene.textures.get(def.sheet) : null;
    const px = def && texture ? this.sheetPixels(def.sheet, texture) : null;
    let foot: { bottom: number; left: number; right: number } | null = null;
    if (def && texture && px) {
      // Por linha da peça inteira (todas as células): a primeira e a última coluna com pixel.
      const rows = new Map<number, { x0: number; x1: number }>();
      let fs = 0;
      for (let dy = 0; dy < def.h; dy++) {
        for (let dx = 0; dx < def.w; dx++) {
          const f = texture.get(frameOf(content.catalog, def, dx, dy));
          if (!f || f.name === '__BASE') continue;
          fs = f.cutHeight;
          for (let y = 0; y < f.cutHeight; y++) {
            for (let x = 0; x < f.cutWidth; x++) {
              if (px.data[((f.cutY + y) * px.width + f.cutX + x) * 4 + 3]! < 40) continue;
              const gy = dy * f.cutHeight + y;
              const gx = dx * f.cutWidth + x;
              const row = rows.get(gy);
              if (row) {
                row.x0 = Math.min(row.x0, gx);
                row.x1 = Math.max(row.x1, gx);
              } else rows.set(gy, { x0: gx, x1: gx });
            }
          }
        }
      }
      if (rows.size > 0 && fs > 0) {
        const k = content.catalog.tileSize / fs; // px da arte -> px do mundo (folha de 64 px: 0,5)
        const bottom = Math.max(...rows.keys());
        const band = [...rows].filter(([y]) => y >= bottom - fs * FOOT_BAND).map(([, r]) => r);
        foot = { bottom: (bottom + 1) * k, left: Math.min(...band.map((r) => r.x0)) * k, right: (Math.max(...band.map((r) => r.x1)) + 1) * k };
      }
    }
    this.feet.set(tile, foot);
    return foot;
  }

  /** Os pixels da folha inteira (uma leitura por folha). */
  private sheetPixels(sheet: string, texture: Phaser.Textures.Texture): { data: Uint8ClampedArray; width: number } | null {
    if (this.pixels.has(sheet)) return this.pixels.get(sheet)!;
    const img = texture.getSourceImage() as HTMLImageElement | HTMLCanvasElement;
    let out: { data: Uint8ClampedArray; width: number } | null = null;
    try {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
      ctx.drawImage(img, 0, 0);
      out = { data: ctx.getImageData(0, 0, img.width, img.height).data, width: img.width };
    } catch {
      out = null; // sem acesso aos pixels: as sombras ficam na base da célula
    }
    this.pixels.set(sheet, out);
    return out;
  }

  private shadowImage(x: number, y: number, w: number): Phaser.GameObjects.Image {
    return this.scene.add.image(x, y, SHADOW_TEXTURE).setDisplaySize(w, this.cfg.shadowHeight).setDepth(FLOOR_FX_DEPTH).setAlpha(this.cfg.shadowAlpha);
  }

  destroy(): void {
    this.statics.forEach((o) => o.destroy());
    this.actorShadows.forEach((o) => o.destroy());
    this.windowGfx?.destroy();
    this.vignette.destroy();
  }
}
