// Latte art: a xícara vista de cima com um contorno-guia semitransparente (coração, patinha, estrela, folha);
// a jogadora desenha com o leite segurando o botão do mouse (ou move a jarra com as setas e segura E).
// "Servir" (Enter ou botão) ou o fim do tempo dão a nota: cobertura do contorno e quanto o traço saiu dele
// (src/core/latte.ts) -> 1 a 3 estrelas -> gorjeta. Os padrões são listas de pontos em data/minigames.json.
import Phaser from 'phaser';
import { latteOutcome, scoreDrawing, starsFor, type LatteParams, type LattePattern, type LatteScore, type Pt } from '../../core/latte';
import type { MiniGameResult } from '../../core/minigame';
import { paramsOf } from '../../core/minigame';
import { content, uiText } from '../content';
import { GAME_HEIGHT, GAME_WIDTH } from '../screen';
import { ensurePlaceholders, LATTE, loadSheets } from './assets';
import { MiniGameScene } from './MiniGameScene';

export const LATTE_SCENE = 'MiniGame.latte';

/** Velocidade da jarra no teclado (px lógicos por segundo). */
const KEY_SPEED = 110;
/** Distância mínima entre dois pontos do traço (px do contorno): menos pontos, mesma forma. */
const MIN_STEP = 1.5;
/** O café na arte da xícara: elipse (raios em px da arte), para o leite não cair na borda. */
const COFFEE_RADII = { x: 72, y: 55 };

export class LatteScene extends MiniGameScene {
  private p!: LatteParams;
  private pattern!: LattePattern;
  private strokes: Pt[][] = [];
  private pouring = false;
  private cursor = { x: GAME_WIDTH / 2, y: GAME_HEIGHT / 2 };
  private lastPointer = { x: -1, y: -1 };
  private milk!: Phaser.GameObjects.Graphics;
  private pitcher!: Phaser.GameObjects.Image;
  private scoreText = '';
  private lastScore: LatteScore | null = null;
  private served = false;
  /** Centro do contorno na tela e px lógicos por px do contorno. */
  private center = { x: 0, y: 0 };
  private k = 1;

  constructor() {
    super('latte', LATTE_SCENE);
  }

  preload(): void {
    loadSheets(this, Object.values(LATTE));
  }

  protected buildGame(): void {
    ensurePlaceholders(this, Object.values(LATTE));
    const def = this.def;
    this.p = paramsOf<LatteParams>(content.minigames, 'latte', this.launch.params.difficulty);
    const pool = this.p.patterns;
    const id = pool[this.rng.int(0, pool.length - 1)]!;
    this.pattern = def.patterns!.find((x) => x.id === id)!;
    this.strokes = [];
    this.pouring = false;
    this.served = false;
    this.lastScore = null;

    // Balcão de madeira e a xícara no meio; o contorno fica no centro do café (cupCenter, na arte).
    this.cameras.main.setBackgroundColor('#7f4b33');
    this.drawBackdrop();
    const cupScale = def.cupScale ?? 1;
    const cx = GAME_WIDTH / 2;
    const cy = GAME_HEIGHT / 2 + 10;
    const cup = this.add.image(cx, cy, LATTE.cup.key, 0).setScale(cupScale);
    const [ax, ay] = def.cupCenter ?? [LATTE.cup.frameWidth / 2, LATTE.cup.frameHeight / 2];
    this.center = { x: cup.x - cup.displayWidth / 2 + ax * cupScale, y: cup.y - cup.displayHeight / 2 + ay * cupScale };
    this.k = (def.guideScale ?? 0.8) * cupScale;

    // Contorno-guia: linhas brancas semitransparentes, desenhadas dos pontos (padrão novo = só dados).
    const guide = this.add.graphics().setDepth(5);
    guide.lineStyle(2, 0xfff7e6, 0.45);
    for (const line of this.pattern.lines) {
      guide.beginPath();
      line.forEach(([x, y], i) => (i === 0 ? guide.moveTo(...this.toScreen(x, y)) : guide.lineTo(...this.toScreen(x, y))));
      guide.strokePath();
    }
    this.milk = this.add.graphics().setDepth(6);
    // A jarra no tamanho dela (não cresce com a xícara), com o bico (em cima, à esquerda) na ponta do mouse: o corpo fica
    // de lado e não cobre o desenho.
    this.pitcher = this.add.image(cx + 120, cy - 60, LATTE.pitcher.key, 0).setOrigin(0.12, 0.22).setDepth(10);
    this.cursor = { x: cx + 80, y: cy };
    this.input.keyboard!.on('keydown-ENTER', this.serve, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.input.keyboard?.off('keydown-ENTER', this.serve, this));
    this.hudButton(uiText.minigames.latte.serve, () => this.serve());
  }

  protected startGame(): void {
    // Acabou o tempo: serve como está (o que foi desenhado ainda vale nota).
    this.startTimer(this.p.timeSec, () => this.serve());
  }

  protected updateGame(delta: number): void {
    // Jarra: segue o mouse quando ele se mexe; senão, as setas movem.
    const ptr = this.controls.pointer();
    if (ptr.x !== this.lastPointer.x || ptr.y !== this.lastPointer.y) {
      this.lastPointer = { x: ptr.x, y: ptr.y };
      this.cursor = { x: ptr.x, y: ptr.y };
    } else {
      const d = this.controls.direction();
      const step = (KEY_SPEED * delta) / 1000;
      this.cursor.x += (d.right ? step : 0) - (d.left ? step : 0);
      this.cursor.y += (d.down ? step : 0) - (d.up ? step : 0);
    }
    this.cursor.x = Phaser.Math.Clamp(this.cursor.x, 0, GAME_WIDTH);
    this.cursor.y = Phaser.Math.Clamp(this.cursor.y, 0, GAME_HEIGHT);
    const holding = this.controls.holding() && this.insideCoffee(this.cursor.x, this.cursor.y);
    this.pitcher.setPosition(this.cursor.x, this.cursor.y).setAngle(holding ? -35 : 0);
    if (holding) this.pour(this.cursor.x, this.cursor.y);
    else this.pouring = false;
  }

  protected resultText(r: MiniGameResult): string {
    if (r.skipped) return '';
    return this.scoreText;
  }

  // ---------- Desenho ----------

  /** Ponto do contorno (0 a guideSize) -> tela. */
  private toScreen(x: number, y: number): [number, number] {
    const half = (this.def.guideSize ?? 128) / 2;
    return [this.center.x + (x - half) * this.k, this.center.y + (y - half) * this.k];
  }

  private toGuide(x: number, y: number): Pt {
    const half = (this.def.guideSize ?? 128) / 2;
    return [(x - this.center.x) / this.k + half, (y - this.center.y) / this.k + half];
  }

  private insideCoffee(x: number, y: number): boolean {
    const s = this.def.cupScale ?? 1;
    const dx = (x - this.center.x) / (COFFEE_RADII.x * s);
    const dy = (y - this.center.y) / (COFFEE_RADII.y * s);
    return dx * dx + dy * dy <= 1;
  }

  /** Despeja o leite: o traço é guardado no espaço do contorno (para a nota) e desenhado na tela. */
  private pour(x: number, y: number): void {
    const p = this.toGuide(x, y);
    if (!this.pouring) {
      this.strokes.push([p]);
      this.pouring = true;
    } else {
      const s = this.strokes[this.strokes.length - 1]!;
      const last = s[s.length - 1]!;
      if (Math.hypot(p[0] - last[0], p[1] - last[1]) < MIN_STEP) return;
      s.push(p);
    }
    const s = this.strokes[this.strokes.length - 1]!;
    const w = this.def.milkWidth ?? 4;
    const [x0, y0] = this.toScreen(...(s[s.length - 2] ?? p));
    this.milk.lineStyle(w, 0xfff4e0, 1).lineBetween(x0, y0, x, y);
    this.milk.fillStyle(0xfff4e0, 1).fillCircle(x, y, w / 2);
  }

  /** Servir: nota, estrelas e gorjeta (núcleo); a xícara mostra o contorno de verdade por cima para comparar. */
  private serve(): void {
    if (this.served || this.phase !== 'playing') return;
    this.served = true;
    const score = scoreDrawing(this.pattern, this.strokes, this.p);
    const stars = starsFor(score.score, this.p.starAt);
    this.lastScore = score;
    const t = uiText.minigames.latte;
    const starsText = '★'.repeat(stars) + '☆'.repeat(3 - stars);
    this.scoreText = t.result
      .replace('{pattern}', this.pattern.name)
      .replace('{stars}', starsText)
      .replace('{coverage}', String(Math.round(score.coverage * 100)))
      .replace('{accuracy}', String(Math.round(score.accuracy * 100)))
      .replace('{tip}', String(this.p.tipPerStar[stars]));
    this.finish(latteOutcome(stars), stars, false, { bonusCoins: this.p.tipPerStar[stars] });
  }
}
