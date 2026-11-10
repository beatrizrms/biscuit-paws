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
import { ART_SCALE, CHASE, ensurePlaceholders, FISHING, loadSheets } from './assets';
import { MiniGameScene } from './MiniGameScene';

export const FISHING_SCENE = 'MiniGame.fishing';

/** Linha d'água (y lógico) e de onde a jogadora pesca (a ponta do cais). */
const WATER_TOP = 168;
/** Os pés em cima do deck, perto da ponta (cais do PixelLab: tábuas nas linhas 22 a 70 da arte, postes até a 100). */
const PLAYER_AT = { x: 104, y: 152 };
/** Canto do cais (meia escala): a frente do deck (linha 70) encosta na linha da água e os postes entram nela. */
const PIER_AT = { x: 32, y: WATER_TOP - 35 };
/** Onde a boia cai quando a jogadora lança com E (sem clicar). */
const DEFAULT_CAST = { x: 330, y: 252 };
/** Barra de puxar (px lógicos): canto de cima à esquerda do painel; trilho (onde o peixe nada) e o medidor ao lado. */
const BAR_AT = { x: 504, y: 64 };
const BAR = { w: 76, h: 232, track: { x: 10, y: 10, w: 36, h: 212 }, meter: { x: 56, y: 10, w: 10, h: 212 } };

type Stage = 'aim' | 'cast' | 'wait' | 'bite' | 'reel' | 'landed';

export class FishingScene extends MiniGameScene {
  private p!: FishingParams;
  private table: FishDef[] = [];
  private stage: Stage = 'aim';
  /** Folga da linha (fração da distância que ela cai no meio) e quanto a ponta da vara verga (px): seguem o alvo da etapa. */
  private slack = 0.2;
  private bend = 0;
  /** Onde a boia caiu: ela balança em volta deste ponto (esperando e no puxão). */
  private bobberRest = { x: 0, y: 0 };
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
  private barHelp!: Phaser.GameObjects.Text;
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
    this.add.image(PIER_AT.x, PIER_AT.y, FISHING.pier.key, 0).setOrigin(0).setScale(ART_SCALE).setDepth(10);
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
      this.bobber.setPosition(this.bobberRest.x + Math.sin(this.elapsed / 900) * 0.8, this.bobberRest.y + Math.sin(this.elapsed / 520) * 0.6);
      if (this.elapsed >= this.stageUntil) this.toBite();
    } else if (this.stage === 'bite') {
      if (this.elapsed >= this.stageUntil) this.escaped(uiText.minigames.fishing.missed);
    } else if (this.stage === 'reel' && this.reel && this.fish) {
      this.reel = stepReel(this.reel, delta / 1000, this.controls.holdingEnter(), this.fish, this.p, this.rng);
      // O peixe puxa: a boia treme e corre um pouco de um lado para o outro.
      this.bobber.setPosition(this.bobberRest.x + Math.sin(this.elapsed / 110) * 2 + Math.sin(this.elapsed / 37) * 0.6, this.bobberRest.y + Math.sin(this.elapsed / 80) * 0.8);
      this.drawBar();
      if (this.reel.status === 'caught') this.landed();
      else if (this.reel.status === 'escaped') this.escaped(uiText.minigames.fishing.escaped);
    }
    this.drawLine(delta);
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
        this.bobberRest = { x: this.bobber.x, y: this.bobber.y };
        // Splash: a linha bate na água e fica bamba, depois assenta.
        this.slack = 0.3;
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

  /** Ponta da vara (provisória, desenhada por código até existir a pose de pescar): desce e recua quando verga. */
  private rodTip(): { x: number; y: number } {
    const sway = this.stage === 'wait' || this.stage === 'aim' ? Math.sin(this.elapsed / 700) * 0.8 : 0;
    return { x: PLAYER_AT.x + 26 - this.bend * 0.35, y: PLAYER_AT.y - 46 + this.bend + sway };
  }

  /**
   * Vara e linha como curvas. A linha é uma curva com a barriga para baixo (a folga) e um pouco de vento; a folga e o
   * vergar da vara mudam devagar até o alvo de cada etapa: lançando, bamba; esperando, caída e balançando; na mordida,
   * esticada com trancos; puxando, esticada e tremendo.
   */
  private drawLine(delta = 16): void {
    const t = this.elapsed;
    const target =
      this.stage === 'cast' ? { slack: 0.32, bend: 0 }
      : this.stage === 'wait' ? { slack: 0.16, bend: 0 }
      : this.stage === 'bite' ? { slack: 0.02, bend: 6 + Math.abs(Math.sin(t / 70)) * 3 }
      : this.stage === 'reel' ? { slack: 0.04, bend: 4 + Math.sin(t / 55) * 1.5 + (this.controls.holdingEnter() ? 2 : 0) }
      : { slack: 0.2, bend: 0 };
    this.slack += (target.slack - this.slack) * Math.min(1, delta / 260);
    this.bend += (target.bend - this.bend) * Math.min(1, delta / 110);

    const g = this.line.clear();
    const hand = { x: PLAYER_AT.x + 6, y: PLAYER_AT.y - 28 };
    const tip = this.rodTip();
    // Vara: curva da mão até a ponta; vergada, o meio fica acima da reta (o arco da vara puxada).
    const rodMid = { x: (hand.x + tip.x) / 2 - this.bend * 0.15, y: (hand.y + tip.y) / 2 - 1 - this.bend * 0.45 };
    g.lineStyle(2, 0x6b4a33, 1).strokePoints(this.curve(hand, rodMid, tip, 8), false);
    if (!this.bobber.visible) return;
    const end = { x: this.bobber.x, y: this.bobber.y - 3 };
    const dist = Math.hypot(end.x - tip.x, end.y - tip.y);
    const sag = Math.min(46, this.slack * dist);
    const wind = Math.sin(t / 1100) * 3 * (this.slack / 0.16) + Math.sin(t / 430) * 0.8 * this.slack * 4;
    const mid = { x: (tip.x + end.x) / 2 + wind, y: (tip.y + end.y) / 2 + sag };
    // A linha não passa da água: o que cairia abaixo da boia fica rente à superfície.
    const pts = this.curve(tip, mid, end, 20).map((q) => new Phaser.Math.Vector2(q.x, Math.min(q.y, end.y)));
    g.lineStyle(1, 0xfff4e0, 0.9).strokePoints(pts, false);
  }

  /** Pontos de uma curva quadrática (de `a` a `c`, puxada por `b`). */
  private curve(a: { x: number; y: number }, b: { x: number; y: number }, c: { x: number; y: number }, n: number): Phaser.Math.Vector2[] {
    return Array.from({ length: n + 1 }, (_, i) => {
      const k = i / n;
      const u = 1 - k;
      return new Phaser.Math.Vector2(u * u * a.x + 2 * u * k * b.x + k * k * c.x, u * u * a.y + 2 * u * k * b.y + k * k * c.y);
    });
  }

  /** Painel da barra (desenhado por código): trilho com a caixa verde e o peixe, medidor ao lado e a ajuda embaixo. */
  private buildBar(): void {
    this.bar = this.add.container(BAR_AT.x, BAR_AT.y).setDepth(90).setVisible(false);
    this.barGfx = this.add.graphics();
    // O peixe da partida, em meia escala (32 px lógicos), virado para cima como quem nada contra a corrente.
    this.barFish = this.add.image(0, 0, FISHING.fish.key, 0).setScale(0.5).setAngle(-90);
    this.barHelp = this.add
      .text(BAR.w / 2, BAR.h + 6, uiText.minigames.fishing.reelHelp, { fontFamily: 'Trebuchet MS, sans-serif', fontSize: '9px', fontStyle: 'bold', color: '#3b2a32', align: 'center', backgroundColor: '#fff4e0e6', padding: { x: 4, y: 2 } })
      .setOrigin(0.5, 0)
      .setResolution(4);
    this.bar.add([this.barGfx, this.barFish, this.barHelp]);
  }

  /**
   * A caixa verde é da jogadora: centrada no indicador, do tamanho da zona (a regra é a mesma: o peixe conta dentro
   * dela). O peixe nada sozinho. Peixe na caixa: ela brilha e o medidor enche; fora, a caixa fica rosa e ele esvazia.
   */
  private drawBar(): void {
    const r = this.reel;
    if (!r) return;
    const { track: t, meter: m } = BAR;
    const yOf = (v: number) => t.y + (1 - v) * t.h; // 1 = em cima
    const inside = Math.abs(r.indicator - r.zone) <= r.zoneSize / 2;
    const g = this.barGfx.clear();
    // Painel de madeira clara com borda escura (a moldura das outras telas).
    g.fillStyle(0x3b2a32, 1).fillRoundedRect(-2, -2, BAR.w + 4, BAR.h + 4, 8);
    g.fillStyle(0xe8c79a, 1).fillRoundedRect(0, 0, BAR.w, BAR.h, 6);
    // Trilho: água funda embaixo, clara em cima.
    g.fillStyle(0x3b2a32, 1).fillRect(t.x - 2, t.y - 2, t.w + 4, t.h + 4);
    g.fillGradientStyle(0x9fd3e0, 0x9fd3e0, 0x4f8fa8, 0x4f8fa8, 1).fillRect(t.x, t.y, t.w, t.h);
    // A caixa da jogadora.
    const boxTop = yOf(Math.min(1, r.indicator + r.zoneSize / 2));
    const boxBottom = yOf(Math.max(0, r.indicator - r.zoneSize / 2));
    g.fillStyle(inside ? 0x7fd18f : 0xe7a0b4, 0.75).fillRect(t.x, boxTop, t.w, boxBottom - boxTop);
    g.lineStyle(2, inside ? 0x2f7a46 : 0xb0496a, 1).strokeRect(t.x + 1, boxTop + 1, t.w - 2, boxBottom - boxTop - 2);
    // Medidor: enche de baixo para cima (verde perto de pescar, rosa perto de escapar).
    g.fillStyle(0x3b2a32, 1).fillRect(m.x - 2, m.y - 2, m.w + 4, m.h + 4);
    g.fillStyle(0xfff4e0, 1).fillRect(m.x, m.y, m.w, m.h);
    g.fillStyle(r.progress > 0.66 ? 0x68ad8a : r.progress > 0.33 ? 0xe0a94e : 0xd97890, 1).fillRect(m.x, yOf(r.progress), m.w, r.progress * m.h);
    // O peixe: dentro da caixa, se debate (balança de lado).
    const wiggle = inside ? Math.sin(this.elapsed / 45) * 2 : Math.sin(this.elapsed / 160) * 1;
    this.barFish.setPosition(t.x + t.w / 2 + wiggle, yOf(r.zone));
  }

  private say(text: string): void {
    this.hint.setText(text).setVisible(text.length > 0);
  }

  private playSfx(id: string | undefined): void {
    if (id) services().audio.sfx(id);
  }
}
