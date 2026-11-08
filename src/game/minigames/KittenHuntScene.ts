// Caça ao filhote: a rua da fuga em tela fixa, com esconderijos sorteados. Clique (ou setas + E) para procurar;
// errou, sobe a dica "quente/frio" em cima do esconderijo, com a cor e o miado mais agudo quanto mais perto.
// A regra (sorteio, tentativas, calor, resultado) mora em src/core/kittenHunt.ts.
import Phaser from 'phaser';
import { heatLevel, huntOutcome, search, setupHunt, type HuntState, type KittenHuntParams } from '../../core/kittenHunt';
import { mapInSeason } from '../../core/calendar';
import { resolveMap } from '../../core/map';
import type { MiniGameResult } from '../../core/minigame';
import { paramsOf } from '../../core/minigame';
import { content, uiText } from '../content';
import { CatSprite, catTexture } from '../entities/Cat';
import { services } from '../services';
import { addTileImage } from '../tileArt';
import { ART_SCALE, CHASE, ensurePlaceholders, HUNT_SHEETS, KITTEN_HUNT, loadCatVariants, loadSheets } from './assets';
import { MiniGameScene } from './MiniGameScene';

export const KITTEN_HUNT_SCENE = 'MiniGame.kitten_hunt';

/** Espera depois do último achado (ou da última tentativa) para a tela de resultado: dá para ver o filhote. */
const END_DELAY_MS = 900;
/** Escala do filhote (o gato do Cosy Cats, menor). */
const KITTEN_SCALE = 0.75;

interface SpotView {
  id: string;
  sprite: Phaser.GameObjects.Sprite;
}

export class KittenHuntScene extends MiniGameScene {
  private p!: KittenHuntParams;
  private state!: HuntState;
  private views: SpotView[] = [];
  private selected = 0;
  private ring!: Phaser.GameObjects.Graphics;
  private ending = false;

  constructor() {
    super('kitten_hunt', KITTEN_HUNT_SCENE);
  }

  preload(): void {
    loadSheets(this, [CHASE.hideBox, CHASE.hideTrash, CHASE.hideBush, CHASE.hideCar, ...Object.values(KITTEN_HUNT)]);
    loadCatVariants(this, Object.keys(content.catSprites.variants)); // filhotes de cores variadas
  }

  protected buildGame(): void {
    // PLACEHOLDER(arte): cesto, caixote e vaso viram retângulos até a arte chegar (assets.ts: KITTEN_HUNT).
    ensurePlaceholders(this, [CHASE.hideBox, CHASE.hideTrash, CHASE.hideBush, CHASE.hideCar, ...Object.values(KITTEN_HUNT)]);
    const def = this.def;
    this.p = paramsOf<KittenHuntParams>(content.minigames, 'kitten_hunt', this.launch.params.difficulty);
    this.state = setupHunt(this.rng, def.hideouts!, this.p);
    this.views = [];
    this.selected = 0;
    this.ending = false;

    // A arena é a rua da fuga (mesma estação do mundo), mostrada só no pedaço `view` (tela fixa, sem rolar).
    const raw = content.maps[def.map!]!;
    const map = resolveMap(mapInSeason(content.seasons, raw, this.launch.season, (t) => !!content.catalog.tiles[t]), content.catalog);
    const ts = map.tileSize;
    this.cameras.main.setBackgroundColor(map.background ?? '#a9d4ea');
    for (const s of map.sprites) addTileImage(this, s.col * ts, s.row * ts - (s.dy ?? 0), s.sheet, s.frame).setDepth(s.depth);
    const [vc, vr, vw, vh] = def.view ?? [0, 0, map.cols, map.rows];
    this.cameras.main.centerOn((vc + vw / 2) * ts, (vr + vh / 2) * ts);

    // Esconderijos: os da partida, ordenados da esquerda para a direita (as setas andam nessa ordem).
    const spots = [...this.state.spots].sort((a, b) => a.at[0] - b.at[0] || a.at[1] - b.at[1]);
    for (const h of spots) {
      const sheet = HUNT_SHEETS[h.kind] ?? CHASE.hideBox;
      const bottom = (h.at[1] + 1) * ts;
      const sprite = this.add.sprite(h.at[0] * ts + ts / 2, bottom, sheet.key, 0).setOrigin(0.5, 1).setScale(ART_SCALE).setDepth(bottom);
      sprite.setInteractive({ useHandCursor: true });
      sprite.on('pointerover', () => this.select(this.views.findIndex((v) => v.id === h.id)));
      this.views.push({ id: h.id, sprite });
    }
    this.ring = this.add.graphics().setDepth(1e5);
    this.select(0);
    this.controls.onAction((world) => {
      if (this.phase !== 'playing' || this.ending) return;
      if (!world) return this.searchAt(this.selected); // E / Espaço: procura no selecionado
      const i = this.views.findIndex((v) => v.sprite.getBounds().contains(world.x, world.y));
      if (i >= 0) this.searchAt(i);
    });
    this.controls.onMove((dir) => {
      if (this.phase !== 'playing') return;
      const step = dir === 'left' || dir === 'up' ? -1 : 1;
      this.select((this.selected + step + this.views.length) % this.views.length);
    });
  }

  protected startGame(): void {
    // timeSec é opcional (o fácil não tem cronômetro).
    this.startTimer(this.p.timeSec, () => this.lose());
    this.updateInfo();
  }

  protected updateGame(): void {}

  protected resultText(r: MiniGameResult): string {
    if (r.skipped) return '';
    const s = this.state;
    if (s.found.length < s.kittens.length) return uiText.minigames.kitten_hunt.lost;
    return uiText.minigames.kitten_hunt.result
      .replace('{found}', String(s.found.length))
      .replace('{total}', String(s.kittens.length))
      .replace('{used}', String(s.triesUsed));
  }

  // ---------- Procurar ----------

  private select(i: number): void {
    if (i < 0) return;
    this.selected = i;
    const s = this.views[i]!.sprite;
    this.ring.clear().lineStyle(2, 0xfff4e0, 0.9).strokeEllipse(s.x, s.y - 2, 30, 10);
  }

  private searchAt(i: number): void {
    const view = this.views[i];
    if (!view) return;
    this.select(i);
    const r = search(this.state, view.id, this.def.heatRange ?? 12);
    const t = uiText.minigames.kitten_hunt;
    if (r.kind === 'already') return this.float(view.sprite, t.already, '#fff4e0');
    if (r.kind === 'no_tries') return;
    // Mexe no esconderijo (procurando).
    this.tweens.add({ targets: view.sprite, x: view.sprite.x + 2, duration: 50, yoyo: true, repeat: 3 });
    if (r.kind === 'found') {
      this.showKitten(view.sprite);
      this.float(view.sprite, t.found, '#e0525e');
      this.sfx(this.def.sounds?.found);
      if (r.done) this.endSoon(huntOutcome(this.state, this.p) === 'great' ? 'great' : 'ok');
    } else {
      const level = heatLevel(this.def.heat!, r.heat);
      view.sprite.setTint(0xb8b0b8); // já procurado
      this.float(view.sprite, level.label, level.color);
      this.sfx(this.def.sounds?.hint, level.rate);
      if (this.state.triesLeft <= 0) this.lose();
    }
    this.updateInfo();
  }

  /** O filhote sai do esconderijo (sentado, um pouco acima). */
  private showKitten(spot: Phaser.GameObjects.Sprite, faded = false): void {
    // Só os gatos com a folha já carregada (o Boot carrega os que o jogo usa).
    const variants = Object.keys(content.catSprites.variants).filter((v) => this.textures.exists(catTexture(v)));
    const variant = variants[this.rng.int(0, variants.length - 1)] ?? this.launch.catVariant;
    CatSprite.createAnimations(this, variant);
    const kitten = this.add.sprite(spot.x, spot.y - 6, catTexture(variant), 0).setOrigin(0.5, 28 / 32).setScale(KITTEN_SCALE).setDepth(spot.depth + 1);
    kitten.play(`${catTexture(variant)}-sit`);
    if (faded) kitten.setAlpha(0.6);
    this.tweens.add({ targets: kitten, y: spot.y - 14, duration: 220, ease: 'Back.Out' });
  }

  /** Acabaram as tentativas (ou o tempo): mostra onde os filhotes estavam e encerra. */
  private lose(): void {
    if (this.ending) return;
    for (const id of this.state.kittens.filter((k) => !this.state.found.includes(k))) {
      const v = this.views.find((x) => x.id === id);
      if (v) this.showKitten(v.sprite, true);
    }
    this.endSoon('fail');
  }

  private endSoon(outcome: 'fail' | 'ok' | 'great'): void {
    this.ending = true;
    this.timer?.pause();
    this.time.delayedCall(END_DELAY_MS, () => this.finish(outcome, this.state.triesLeft));
  }

  private updateInfo(): void {
    const s = this.state;
    this.setHudInfo(
      uiText.minigames.kitten_hunt.hud.replace('{tries}', String(s.triesLeft)).replace('{found}', String(s.found.length)).replace('{total}', String(s.kittens.length)),
    );
  }

  /** Texto que sobe e some em cima do esconderijo (a dica de calor, "Achou!"). */
  private float(spot: Phaser.GameObjects.Sprite, text: string, color: string): void {
    const label = this.add
      .text(spot.x, spot.y - spot.displayHeight - 4, text, { fontFamily: 'Trebuchet MS, sans-serif', fontSize: '9px', fontStyle: 'bold', color, stroke: '#3b2a32', strokeThickness: 3, resolution: 4 })
      .setOrigin(0.5, 1)
      .setDepth(1e5);
    this.tweens.add({ targets: label, y: label.y - 14, alpha: 0, delay: 700, duration: 600, onComplete: () => label.destroy() });
  }

  private sfx(id: string | undefined, rate = 1): void {
    if (id) services().audio.sfx(id, { rate });
  }
}
