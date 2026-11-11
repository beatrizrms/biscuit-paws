// Clima na tela: chuva, neve e folhas ao vento caindo por cima das áreas ao ar livre (a rua inteira; no café, só o
// quintal). O clima do dia vem do núcleo (session.weather) e as partículas de data/seasons.json: weatherFx. Só desenha.
// A folha é arte do PixelLab (public/assets/fx/weather_leaf.png, 64 px: meia escala; carregada no BootScene como
// weather-leaf). PLACEHOLDER(arte): o risco da chuva e o floco são desenhados por código (texturas weather-*), e a folha
// também, quando a arte não carregou.
import Phaser from 'phaser';
import type { WeatherFx, WeatherParticle } from '../core/calendar';
import { hexToRgb, rgbToHex } from '../core/time';

/** Acima dos objetos e das luzes, abaixo da vinheta (149 000) e da cor do dia/noite (150 000): a noite escurece a chuva. */
const WEATHER_DEPTH = 148_000;
const VEIL_DEPTH = 147_900;
/** A cada quantos ms o emissor solta partículas. */
const FREQUENCY = 50;

export interface WeatherArea {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Desenhos de cada partícula (pixels do mundo): # = cor cheia, + = meia. */
const SHAPES: Record<WeatherParticle, string[]> = {
  streak: ['+', '#', '#', '#', '#', '#', '+'],
  flake: ['.++.', '+##+', '+##+', '.++.'],
  leaf: ['...++#', '..####', '.####+', '####..', '+##...', '#.....'],
};

export class WeatherLayer {
  private emitters: Phaser.GameObjects.Particles.ParticleEmitter[] = [];
  private veils: Phaser.GameObjects.Rectangle[] = [];
  private key = '';
  /** Partículas com arte de 64 px (desenhadas na metade): as que não foram geradas por código aqui. */
  private art = new Set<string>();

  constructor(private scene: Phaser.Scene) {
    for (const [name, rows] of Object.entries(SHAPES)) {
      const key = `weather-${name}`;
      if (scene.textures.exists(key)) {
        if (scene.textures.get(key).getSourceImage().width > Math.max(...rows.map((r) => r.length))) this.art.add(name);
        continue;
      }
      const g = scene.make.graphics({ x: 0, y: 0 }, false);
      rows.forEach((row, y) =>
        [...row].forEach((ch, x) => {
          if (ch === '#') g.fillStyle(0xffffff, 1).fillRect(x, y, 1, 1);
          else if (ch === '+') g.fillStyle(0xffffff, 0.55).fillRect(x, y, 1, 1);
        }),
      );
      g.generateTexture(key, Math.max(...rows.map((r) => r.length)), rows.length);
      g.destroy();
    }
  }

  /** Clima `fx` (ou nada) nas `areas` (pixels do mundo, tamanho do tile `ts`). Só refaz quando muda algo. */
  set(fx: WeatherFx | undefined, areas: readonly WeatherArea[], ts: number): void {
    const key = fx ? JSON.stringify([fx, areas]) : '';
    if (key === this.key) return;
    this.key = key;
    this.clear();
    if (!fx) return;
    const life = (fx.lifespan[0] + fx.lifespan[1]) / 2;
    for (const a of areas) {
      const alive = fx.perTile * ((a.w * a.h) / (ts * ts));
      const quantity = Math.max(1, Math.round((alive * FREQUENCY) / life));
      const emitter = this.scene.add
        .particles(0, 0, `weather-${fx.particle}`, {
          emitZone: { type: 'random', source: new Phaser.Geom.Rectangle(a.x, a.y, a.w, a.h) } as Phaser.Types.GameObjects.Particles.EmitZoneData,
          lifespan: { min: fx.lifespan[0], max: fx.lifespan[1] },
          speedX: { min: fx.speedX[0], max: fx.speedX[1] },
          speedY: { min: fx.speedY[0], max: fx.speedY[1] },
          // Aparece e some devagar (sem "piscar" onde nasce): o alfa sobe e desce ao longo da vida.
          alpha: { onEmit: () => 0, onUpdate: (_p: unknown, _k: string, t: number) => fx.alpha * Math.sin(Math.PI * t) },
          tint: fx.colors.map((c) => rgbToHex(hexToRgb(c))),
          ...(fx.spin ? { rotate: { start: 0, end: 540 } } : {}),
          ...(this.art.has(fx.particle) ? { scale: 0.5 } : {}),
          frequency: FREQUENCY,
          quantity,
        })
        .setDepth(WEATHER_DEPTH);
      // Começa já com a tela cheia (sem esperar as primeiras caírem).
      emitter.fastForward(fx.lifespan[1]);
      this.emitters.push(emitter);
      if (fx.darken) {
        this.veils.push(
          this.scene.add.rectangle(a.x, a.y, a.w, a.h, rgbToHex(hexToRgb(fx.darken.color)), fx.darken.alpha).setOrigin(0).setDepth(VEIL_DEPTH),
        );
      }
    }
  }

  clear(): void {
    this.emitters.forEach((e) => e.destroy());
    this.veils.forEach((v) => v.destroy());
    this.emitters = [];
    this.veils = [];
  }
}
