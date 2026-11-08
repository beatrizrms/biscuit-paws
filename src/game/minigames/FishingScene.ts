// Pescaria: lançar a linha -> esperar (a boia balança) -> mordida ("!" + som) -> barra de timing.
// Na barra, segurar E/Espaço/mouse sobe o indicador e soltar ele cai; dentro da zona verde (o peixe) o progresso
// enche. Encheu = pescou (o peixe vai para a mochila). Sorteio e física da barra em src/core/fishing.ts.
import Phaser from 'phaser';
import { fishingOutcome, rollFish, startReel, stepReel, type FishDef, type FishingParams, type ReelState } from '../../core/fishing';
import type { MiniGameResult } from '../../core/minigame';
import { paramsOf } from '../../core/minigame';
import { content, uiText } from '../content';
import { Player } from '../entities/Player';
import { services } from '../services';
import { GAME_HEIGHT, GAME_WIDTH } from '../screen';
import { ART_SCALE, BAR_TRACK, CHASE, ensurePlaceholders, FISHING, loadSheets } from './assets';
import { MiniGameScene } from './MiniGameScene';

export const FISHING_SCENE = 'MiniGame.fishing';

/** Linha d'água (y lógico) e de onde a jogadora pesca (a ponta do cais). */
const WATER_TOP = 168;
const PLAYER_AT = { x: 104, y: 176 };
/** Onde a boia cai quando a jogadora lança com E (sem clicar). */
const DEFAULT_CAST = { x: 330, y: 252 };
/** Barra de timing na tela (canto de cima à esquerda, lógico). */
const BAR_AT = { x: 580, y: 120 };

type Stage = 'aim' | 'cast' | 'wait' | 'bite' | 'reel' | 'landed';

export class FishingScene extends MiniGameScene {
  private p!: FishingParams;
  private table: FishDef[] = [];
  private stage: Stage = 'aim';
  private stageUntil = 0;
  private elapsed = 0;
  private fish: FishDef | null = null;
  private reel: ReelState | null = null;
  private player!: Player;
  private bobber!: Phaser.GameObjects.Sprite;
  private line!: Phaser.GameObjects.Graphics;
  private bar!: Phaser.GameObjects.Container;
  private barGfx!: Phaser.GameObjects.Graphics;
  private barFish!: Phaser.GameObjects.Image;
  private hint!: Phaser.GameObjects.Text;

  constructor() {
    super('fishing', FISHING_SCENE);
  }

  preload(): void {
    loadSheets(this, [...Object.values(FISHING), CHASE.alerts]);
  }

  protected buildGame(): void {
    ensurePlaceholders(this, [...Object.values(FISHING), CHASE.alerts]);
    this.p = paramsOf<FishingParams>(content.minigames, 'fishing', this.launch.params.difficulty);
    this.table = this.def.fish ?? [];
    this.stage = 'aim';
    this.elapsed = 0;
    this.fish = null;
    this.reel = null;

    // Céu, água animada (64 px desenhados na metade = um tile de 32) e o cais com a jogadora na ponta.
    this.cameras.main.setBackgroundColor('#a9d4ea');
    if (!this.anims.exists('mg.fishing.water')) {
      this.anims.create({ key: 'mg.fishing.water', frames: this.anims.generateFrameNumbers(FISHING.water.key, { start: 0, end: 3 }), frameRate: 3, repeat: -1 });
    }
    const tile = FISHING.water.frameWidth * ART_SCALE;
    for (let y = WATER_TOP; y < GAME_HEIGHT; y += tile) {
      for (let x = 0; x < GAME_WIDTH; x += tile) this.add.sprite(x, y, FISHING.water.key, 0).setOrigin(0).setScale(ART_SCALE).play({ key: 'mg.fishing.water', startFrame: Math.floor(x / tile + y / tile) % 4 });
    }
    this.add.image(24, WATER_TOP - 40, FISHING.pier.key, 0).setOrigin(0).setScale(ART_SCALE).setDepth(10);
    this.player = new Player(this, PLAYER_AT.x, PLAYER_AT.y);
    this.player.face('right');
    this.player.setDepth(20);
    (this.player.body as Phaser.Physics.Arcade.Body).setAllowGravity(false).setImmovable(true);

    this.line = this.add.graphics().setDepth(30);
    this.bobber = this.add.sprite(0, 0, FISHING.bobber.key, 0).setScale(ART_SCALE).setDepth(31).setVisible(false);
    this.buildBar();
    this.hint = this.add.text(GAME_WIDTH / 2, 70, '', { fontFamily: 'Trebuchet MS, sans-serif', fontSize: '11px', color: '#3b2a32', backgroundColor: '#fff4e0cc', padding: { x: 6, y: 3 } });
    this.hint.setOrigin(0.5).setDepth(100).setResolution(2);

    // Lançar: E/Espaço lança no ponto padrão; clique na água, onde clicou. Fisgar também é E/clique.
    this.controls.onAction((world) => this.onAction(world));
  }

  protected startGame(): void {
    this.startTimer(this.p.timeSec, () => this.finish('fail', 0));
    this.toAim();
  }

  protected updateGame(delta: number): void {
    this.elapsed += delta;
    if (this.stage === 'wait') {
      // A boia balança calma e, de vez em quando, dá uma beliscada.
      this.bobber.setFrame(Math.floor(this.elapsed / 450) % 2);
      if (this.elapsed >= this.stageUntil) this.toBite();
    } else if (this.stage === 'bite') {
      if (this.elapsed >= this.stageUntil) this.escaped(uiText.minigames.fishing.missed);
    } else if (this.stage === 'reel' && this.reel && this.fish) {
      this.reel = stepReel(this.reel, delta / 1000, this.controls.holding(), this.fish, this.p, this.rng);
      this.drawBar();
      if (this.reel.status === 'caught') this.landed();
      else if (this.reel.status === 'escaped') this.escaped(uiText.minigames.fishing.escaped);
    }
    this.drawLine();
  }

  protected resultText(r: MiniGameResult): string {
    const t = uiText.minigames.fishing;
    if (r.skipped) return '';
    if (r.outcome === 'fail' || !this.fish) return t.noFish;
    return t.caught.replace('{fish}', this.fish.name).replace('{value}', String(this.fish.value));
  }

  // ---------- Etapas ----------

  private onAction(world?: { x: number; y: number }): void {
    if (this.phase !== 'playing') return;
    if (this.stage === 'aim') this.cast(world && world.y > WATER_TOP + 8 && world.x > 150 ? world : DEFAULT_CAST);
    else if (this.stage === 'bite') this.hook();
  }

  private toAim(): void {
    this.stage = 'aim';
    this.bobber.setVisible(false);
    this.bar.setVisible(false);
    this.say(uiText.minigames.fishing.aim);
  }

  /** A boia voa num arco até o ponto e cai na água. */
  private cast(to: { x: number; y: number }): void {
    this.stage = 'cast';
    this.say('');
    const from = this.rodTip();
    this.bobber.setPosition(from.x, from.y).setFrame(0).setVisible(true);
    this.tweens.addCounter({
      from: 0,
      to: 1,
      duration: 600,
      onUpdate: (tw) => {
        const k = tw.getValue() ?? 0;
        this.bobber.setPosition(from.x + (to.x - from.x) * k, from.y + (to.y - from.y) * k - Math.sin(k * Math.PI) * 60);
      },
      onComplete: () => {
        this.bobber.setFrame(3);
        this.stage = 'wait';
        this.stageUntil = this.elapsed + this.rng.int(this.p.waitMs[0], this.p.waitMs[1]);
        this.say(uiText.minigames.fishing.waiting);
      },
    });
  }

  /** Mordida: a boia afunda, "!" e o som. A jogadora tem biteWindowMs para fisgar. */
  private toBite(): void {
    this.stage = 'bite';
    this.stageUntil = this.elapsed + this.p.biteWindowMs;
    this.bobber.setFrame(2);
    this.tweens.add({ targets: this.bobber, y: this.bobber.y + 2, duration: 80, yoyo: true, repeat: 3 });
    const alert = this.add.image(this.bobber.x, this.bobber.y - 18, CHASE.alerts.key, 0).setScale(ART_SCALE).setDepth(40);
    this.tweens.add({ targets: alert, y: alert.y - 6, alpha: 0, delay: this.p.biteWindowMs - 200, duration: 200, onComplete: () => alert.destroy() });
    this.playSfx(this.def.sounds?.bite);
    this.say(uiText.minigames.fishing.bite);
  }

  private hook(): void {
    this.fish = rollFish(this.rng, this.table, this.p.rarityWeights);
    this.reel = startReel(this.fish, this.p, this.rng);
    this.barFish.setFrame(this.fish.icon);
    this.stage = 'reel';
    this.bar.setVisible(true);
    this.say(uiText.minigames.fishing.reel);
    this.drawBar();
  }

  private landed(): void {
    if (!this.fish || !this.reel) return;
    this.stage = 'landed';
    this.playSfx(this.def.sounds?.catch);
    // O peixe pula da água até a jogadora antes do resultado.
    const icon = this.add.image(this.bobber.x, this.bobber.y, FISHING.fish.key, this.fish.icon).setScale(ART_SCALE).setDepth(50);
    this.bobber.setVisible(false);
    const fish = this.fish;
    const reel = this.reel;
    this.tweens.add({
      targets: icon,
      x: PLAYER_AT.x,
      y: PLAYER_AT.y - 48,
      duration: 500,
      ease: 'Quad.easeOut',
      onComplete: () => this.finish(fishingOutcome(true, reel, this.p.greatAccuracy), fish.value, false, { bonusCoins: fish.value, itemId: fish.item }),
    });
  }

  /** Perdeu o peixe (não fisgou a tempo ou a barra esvaziou): lança de novo enquanto tiver tempo. */
  private escaped(text: string): void {
    this.playSfx(this.def.sounds?.escape);
    this.fish = null;
    this.reel = null;
    this.toAim();
    this.say(text);
  }

  // ---------- Desenho ----------

  /** Ponta da vara (provisória, desenhada por código até existir a pose de pescar). */
  private rodTip(): { x: number; y: number } {
    return { x: PLAYER_AT.x + 26, y: PLAYER_AT.y - 46 };
  }

  private drawLine(): void {
    const g = this.line.clear();
    const hand = { x: PLAYER_AT.x + 6, y: PLAYER_AT.y - 28 };
    const tip = this.rodTip();
    g.lineStyle(2, 0x6b4a33, 1).lineBetween(hand.x, hand.y, tip.x, tip.y); // vara
    if (this.bobber.visible) g.lineStyle(1, 0xfff4e0, 0.9).lineBetween(tip.x, tip.y, this.bobber.x, this.bobber.y - 3);
  }

  private buildBar(): void {
    this.bar = this.add.container(BAR_AT.x, BAR_AT.y).setDepth(90).setVisible(false);
    // A arte traz um peixinho parado do lado da barra: recorta só a barra (o peixe de verdade se move, desenhado à parte).
    const frame = this.add.image(0, 0, FISHING.bar.key, 0).setOrigin(0).setScale(ART_SCALE).setCrop(0, 0, BAR_TRACK.progressX + BAR_TRACK.progressW + 2, FISHING.bar.frameHeight);
    this.barGfx = this.add.graphics();
    this.barFish = this.add.image(0, 0, FISHING.fish.key, 0).setScale((ART_SCALE * 32) / FISHING.fish.frameWidth);
    this.bar.add([frame, this.barGfx, this.barFish]);
  }

  /** Trilho por cima da arte: fundo, zona verde (o peixe), indicador e o tubo do progresso. */
  private drawBar(): void {
    const r = this.reel;
    if (!r) return;
    const s = ART_SCALE;
    const x = BAR_TRACK.x * s;
    const w = BAR_TRACK.w * s;
    const top = BAR_TRACK.y * s;
    const h = BAR_TRACK.h * s;
    const yOf = (v: number) => top + (1 - v) * h; // 1 = em cima
    const g = this.barGfx.clear();
    g.fillStyle(0xfff7e6, 1).fillRect(x, top, w, h);
    g.fillStyle(0xa8b77c, 1).fillRect(x, yOf(r.zone + r.zoneSize / 2), w, r.zoneSize * h);
    g.fillStyle(0x463027, 1).fillRect(x - 0.5, yOf(r.indicator) - 1, w + 1, 2);
    // Progresso: o tubo da direita enche de baixo para cima (verde perto de pescar, rosa perto de escapar).
    g.fillStyle(0xe3c49e, 1).fillRect(BAR_TRACK.progressX * s, top, BAR_TRACK.progressW * s, h);
    g.fillStyle(r.progress > 0.66 ? 0x68ad8a : r.progress > 0.33 ? 0xe0a94e : 0xd97890, 1).fillRect(BAR_TRACK.progressX * s, yOf(r.progress), BAR_TRACK.progressW * s, r.progress * h);
    this.barFish.setPosition(x + w + 14, yOf(r.zone));
  }

  private say(text: string): void {
    this.hint.setText(text).setVisible(text.length > 0);
  }

  private playSfx(id: string | undefined): void {
    if (id) services().audio.sfx(id);
  }
}
