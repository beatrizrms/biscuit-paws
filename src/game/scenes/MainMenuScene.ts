// Home: a rua da Vila das Baunilhas no inverno, ao entardecer, com neve caindo e os postes acesos (ADD),
// a câmera passeando devagar; por cima, o menu (HTML).
import Phaser from 'phaser';
import { resolveMap } from '../../core/map';
import { parseClock, tintAt } from '../../core/time';
import { content } from '../content';
import { addTileImage } from '../tileArt';
import { DayNightLayer } from '../DayNightLayer';
import { GAME_HEIGHT, GAME_WIDTH, SCREEN_OFFSET_X, SCREEN_OFFSET_Y, setupCamera } from '../screen';
import { services } from '../services';
import { startGame } from '../startGame';
import { MainMenu } from '../ui/menu/MainMenu';

/** Hora do céu da Home (entardecer de inverno: postes acesos). */
const HOME_CLOCK = '18:10';

export class MainMenuScene extends Phaser.Scene {
  private menu: MainMenu | null = null;

  constructor() {
    super('MainMenu');
  }

  create(): void {
    const street = content.maps['map.street']!;
    // Sem o que depende da história (ex.: a lousa só depois de comprada).
    const map = resolveMap({ ...street, objects: street.objects.filter((o) => !o.when) }, content.catalog);
    const ts = map.tileSize;
    for (const s of map.sprites) addTileImage(this, s.col * ts, s.row * ts - (s.dy ?? 0), s.sheet, s.frame).setDepth(s.depth);
    const width = map.cols * ts;
    const cam = setupCamera(this);
    cam.setBackgroundColor(street.background ?? '#a9d4ea');
    cam.setBounds(0, map.rows * ts - GAME_HEIGHT, width, GAME_HEIGHT);
    // scroll = canto de cima/esquerda da vista menos o deslocamento do zoom (screen.ts)
    cam.scrollY = map.rows * ts - GAME_HEIGHT - SCREEN_OFFSET_Y;
    cam.scrollX = -SCREEN_OFFSET_X;
    this.tweens.add({ targets: cam, scrollX: width - GAME_WIDTH - SCREEN_OFFSET_X, duration: 45_000, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

    const dayNight = new DayNightLayer(this);
    dayNight.setLights(street.lights ?? [], ts);
    dayNight.update(tintAt(parseClock(HOME_CLOCK), content.dayNight, content.world.season, false));

    // Neve leve, por cima de tudo (já com a cor do entardecer, sem ficar branca demais).
    if (!this.textures.exists('snowflake')) {
      const g = this.make.graphics({}, false);
      g.fillStyle(0xffffff, 1).fillCircle(2, 2, 1.5).generateTexture('snowflake', 4, 4);
      g.destroy();
    }
    this.add
      .particles(SCREEN_OFFSET_X, SCREEN_OFFSET_Y - 6, 'snowflake', {
        x: { min: -20, max: GAME_WIDTH + 20 },
        lifespan: 14_000,
        speedY: { min: 12, max: 26 },
        speedX: { min: -8, max: 6 },
        scale: { min: 0.5, max: 1.1 },
        alpha: { start: 0.85, end: 0.4 },
        frequency: 140,
        quantity: 1,
      })
      .setScrollFactor(0)
      .setDepth(160_000);

    cam.fadeIn(500, 27, 33, 64);
    const root = document.getElementById('ui')!;
    root.innerHTML = '';
    const { audio } = services();
    // Tela "Toque ou clique para começar": nada toca até o clique (que começa a música da Home).
    audio.silence();
    this.menu = new MainMenu(root, {
      started: () => audio.playScene('home'),
      play: async (slot) => this.go(() => startGame(this, { mode: 'load', from: slot })),
      newGame: (slot, player) => void this.go(() => startGame(this, { mode: 'new', slot, player })),
      textures: this.textures,
    });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.menu?.destroy();
      this.menu = null;
    });
  }

  /** Escurece, troca a música e começa o jogo. */
  private go(start: () => Promise<{ ok: true } | { ok: false; error: string }>): Promise<{ ok: true } | { ok: false; error: string }> {
    return new Promise((resolve) => {
      services().audio.fadeOutAll();
      this.cameras.main.fadeOut(450, 27, 33, 64);
      this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, async () => {
        const r = await start();
        if (!r.ok) this.cameras.main.fadeIn(300, 27, 33, 64);
        resolve(r);
      });
    });
  }
}
