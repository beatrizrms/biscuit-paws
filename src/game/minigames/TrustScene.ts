// Confiança do gato: a rua da fuga em tela fixa, um gato assustado sentado e a personagem chegando de lado.
// Sem cronômetro. Segurar (→, E, Espaço ou o mouse) aproxima devagar; ← se afasta; P dá um petisco.
// O gato mostra o humor: calmo (sentado, balançando), alerta ("!") e bufando (treme, fica vermelho, "Fff!").
// A regra (tensão, humor, sustos, confiança) mora em src/core/trust.ts; aqui só se desenha.
import Phaser from 'phaser';
import { mapInSeason } from '../../core/calendar';
import { resolveMap } from '../../core/map';
import type { MiniGameResult } from '../../core/minigame';
import { paramsOf } from '../../core/minigame';
import { crowded, FULL_TRUST, newTrust, stepTrust, trustOutcome, useTreat, type CatMood, type TrustParams, type TrustState } from '../../core/trust';
import { content, uiText } from '../content';
import { CatSprite, catTexture } from '../entities/Cat';
import { Player } from '../entities/Player';
import { services } from '../services';
import { addTileImage } from '../tileArt';
import { ART_SCALE, CHASE, ensurePlaceholders, loadSheets } from './assets';
import { MiniGameScene } from './MiniGameScene';

export const TRUST_SCENE = 'MiniGame.trust';

/** Largura da barra de confiança em cima do gato (px lógicos). */
const BAR_W = 40;
/** Um coraçãozinho sobe a cada tanto, enquanto a confiança cresce. */
const HEART_EVERY_MS = 1200;
/** Quanto o gato treme bufando (px). */
const SHAKE_PX = 1;

export class TrustScene extends MiniGameScene {
  private p!: TrustParams;
  private s!: TrustState;
  private player!: Player;
  private cat!: Phaser.GameObjects.Sprite;
  private catX = 0;
  private bar!: Phaser.GameObjects.Graphics;
  private alertIcon!: Phaser.GameObjects.Image;
  private hissBubble!: Phaser.GameObjects.Container;
  private treatBtn: HTMLButtonElement | null = null;
  private lastMood: CatMood = 'calm';
  private lastTrust = 0;
  private heartAt = 0;
  /** Já avisou que ela está perto demais para o humor de agora (avisa de novo depois que ela respeitar o espaço). */
  private crowdWarned = false;
  /** Quando subiu o último texto flutuante e quantos estão subindo juntos (o seguinte nasce mais acima, sem encavalar). */
  private floatAt = -Infinity;
  private floatStack = 0;
  private ended = false;

  constructor() {
    super('trust', TRUST_SCENE);
  }

  preload(): void {
    loadSheets(this, [CHASE.alerts]);
  }

  protected buildGame(): void {
    ensurePlaceholders(this, [CHASE.alerts]);
    const def = this.def;
    this.p = paramsOf<TrustParams>(content.minigames, 'trust', this.launch.params.difficulty);
    // O petisco da missão (params.itemId) vale um a mais que os da dificuldade.
    this.s = newTrust(this.p, this.rng, def.treatItem && this.launch.params.itemId === def.treatItem ? 1 : 0);
    this.crowdWarned = false;
    this.lastMood = 'calm';
    this.lastTrust = 0;
    this.heartAt = 0;
    this.ended = false;

    const raw = content.maps[def.map!]!;
    const map = resolveMap(mapInSeason(content.seasons, raw, this.launch.season, (t) => !!content.catalog.tiles[t]), content.catalog);
    const ts = map.tileSize;
    this.cameras.main.setBackgroundColor(map.background ?? '#a9d4ea');
    for (const s of map.sprites) addTileImage(this, s.col * ts, s.row * ts - (s.dy ?? 0), s.sheet, s.frame).setDepth(s.depth);
    const [vc, vr, vw, vh] = def.view ?? [0, 0, map.cols, map.rows];
    this.cameras.main.centerOn((vc + vw / 2) * ts, (vr + vh / 2) * ts);

    // O gato e a personagem na mesma linha; quem manda na distância é o núcleo (o corpo físico fica desligado).
    const [cc, cr] = def.catAt!;
    const feet = (cr + 1) * ts - 4;
    this.catX = cc * ts + ts / 2;
    CatSprite.createAnimations(this, this.launch.catVariant);
    this.cat = this.add.sprite(this.catX, feet, catTexture(this.launch.catVariant), 0).setOrigin(0.5, 28 / 32).setDepth(feet);
    this.cat.play(`${catTexture(this.launch.catVariant)}-sit`);
    this.player = new Player(this, this.catX - this.s.distance, feet + 2);
    (this.player.body as Phaser.Physics.Arcade.Body).enable = false;
    this.player.face('right');

    this.bar = this.add.graphics().setDepth(1e5);
    this.alertIcon = this.add.image(this.catX, feet - 30, CHASE.alerts.key, 0).setScale(ART_SCALE).setDepth(1e5).setVisible(false);
    // PLACEHOLDER(arte): balão "Fff!" desenhado por código; o gato bufando (orelhas para trás, rabo eriçado) ainda
    // não tem folha: por enquanto ele treme e fica avermelhado (lista na memória: assets-pendentes).
    const hissText = this.add
      .text(0, 0, uiText.minigames.trust.hiss, { fontFamily: 'Trebuchet MS, sans-serif', fontSize: '9px', fontStyle: 'bold', color: '#d9475d', resolution: 4 })
      .setOrigin(0.5);
    const bubbleBg = this.add.graphics().fillStyle(0xfff4e0, 1).fillRoundedRect(-14, -7, 28, 14, 5).lineStyle(1, 0x3b2a32, 1).strokeRoundedRect(-14, -7, 28, 14, 5);
    this.hissBubble = this.add.container(this.catX + 14, feet - 34, [bubbleBg, hissText]).setDepth(1e5).setVisible(false);

    this.treatBtn = this.hudButton(this.treatLabel(), () => this.giveTreat());
    const onP = () => this.giveTreat();
    this.input.keyboard!.on('keydown-P', onP);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.input.keyboard?.off('keydown-P', onP);
      services().audio.setLoop(this.def.sounds?.trust ?? '', false);
    });
    this.draw();
  }

  protected startGame(): void {
    // Sem cronômetro: a confiança não se apressa (trust não tem timeSec).
    this.startTimer(undefined, () => {});
  }

  protected updateGame(delta: number): void {
    if (this.ended) return;
    const dir = this.controls.direction();
    const approach = this.controls.holding() || dir.right;
    const back = dir.left;
    const { scared, startled } = stepTrust(this.s, this.p, { approach, back }, delta, this.rng);
    if (startled) {
      this.float(uiText.minigames.trust.startled, '#c48a1e');
      this.sfx(this.def.sounds?.hiss);
    }
    // Perto demais para o humor de agora: avisa uma vez (o "!" de alerta aparece quando a tensão subir).
    if (crowded(this.s) && !this.crowdWarned) {
      this.crowdWarned = true;
      this.float(uiText.minigames.trust.crowded, '#9a86b4');
    } else if (!crowded(this.s)) this.crowdWarned = false;
    // Personagem: anda (animação) só quando a distância muda; parada, olha para o gato.
    const prev = this.player.x;
    const x = this.catX - this.s.distance;
    this.player.setPosition(x, this.player.y);
    if (Math.abs(x - prev) > 0.01) this.player.move({ up: false, down: false, left: x < prev, right: x > prev });
    else this.player.face('right');
    if (scared) this.onScare();
    this.draw();
    const out = trustOutcome(this.s, this.p);
    if (out) this.end(out);
  }

  protected resultText(r: MiniGameResult): string {
    if (r.skipped) return '';
    const t = uiText.minigames.trust;
    return r.outcome === 'fail' ? t.failed : t.result.replace('{scares}', String(this.s.scares));
  }

  // ---------- Desenho ----------

  private draw(): void {
    const s = this.s;
    const mood = s.mood;
    const gaining = s.trust > this.lastTrust;
    this.lastTrust = s.trust;
    // Humor: muda a pose e os balões só quando troca (a animação não reinicia a cada quadro).
    if (mood !== this.lastMood) {
      if (mood === 'calm') this.cat.play(`${catTexture(this.launch.catVariant)}-sit`).clearTint();
      else this.cat.stop().setFrame(0);
      if (mood === 'hissing') {
        this.cat.setTint(0xffb0b0);
        this.sfx(this.def.sounds?.hiss);
      } else this.cat.clearTint();
      this.lastMood = mood;
    }
    this.alertIcon.setVisible(mood === 'alert');
    this.hissBubble.setVisible(mood === 'hissing');
    this.cat.x = this.catX + (mood === 'hissing' ? (Math.random() < 0.5 ? -SHAKE_PX : SHAKE_PX) : 0);
    // Ronrona enquanto a confiança sobe; coraçõezinhos de vez em quando.
    services().audio.setLoop(this.def.sounds?.trust ?? '', gaining && !this.ended);
    if (gaining && s.elapsed - this.heartAt > HEART_EVERY_MS) {
      this.heartAt = s.elapsed;
      this.float('♥', '#d97890');
    }
    // Barra de confiança em cima do gato (lilás; com o petisco valendo, dourada).
    const y = this.cat.y - 44;
    const color = s.elapsed < s.treatUntil ? 0xe0a94e : 0x9a86b4;
    this.bar
      .clear()
      .fillStyle(0x3b2a32, 0.85)
      .fillRect(this.catX - BAR_W / 2 - 1, y - 1, BAR_W + 2, 5)
      .fillStyle(color, 1)
      .fillRect(this.catX - BAR_W / 2, y, (BAR_W * s.trust) / FULL_TRUST, 3);
    const t = uiText.minigames.trust;
    this.setHudInfo(t.hud.replace('{trust}', String(Math.floor(s.trust))).replace('{scares}', String(s.scares)).replace('{max}', String(this.p.maxScares)));
  }

  private treatLabel(): string {
    return uiText.minigames.trust.treat.replace('{n}', String(this.s.treatsLeft));
  }

  private giveTreat(): void {
    if (this.phase !== 'playing' || this.ended || !useTreat(this.s, this.p)) return;
    this.sfx(this.def.sounds?.treat);
    if (this.treatBtn) {
      this.treatBtn.textContent = this.treatLabel();
      this.treatBtn.disabled = this.s.treatsLeft <= 0;
    }
    this.float(uiText.minigames.trust.treatGiven, '#e0a94e');
  }

  private onScare(): void {
    this.sfx(this.def.sounds?.scare);
    this.float(uiText.minigames.trust.scared, '#d9475d');
    this.tweens.add({ targets: this.cat, y: this.cat.y - 6, duration: 90, yoyo: true });
    this.cameras.main.shake(150, 0.004);
  }

  private end(outcome: 'fail' | 'ok' | 'great'): void {
    this.ended = true;
    services().audio.setLoop(this.def.sounds?.trust ?? '', false);
    if (outcome !== 'fail') {
      this.sfx(this.def.sounds?.done);
      this.cat.clearTint().play(`${catTexture(this.launch.catVariant)}-play`);
    } else this.tweens.add({ targets: this.cat, x: this.catX + 220, duration: 700, ease: 'Quad.In' }); // fugiu
    this.time.delayedCall(700, () => this.finish(outcome, Math.round(this.s.trust)));
  }

  private float(text: string, color: string): void {
    // Dois avisos juntos ("Ele quer espaço" e "Um barulho!"): o segundo sobe uma linha acima do primeiro.
    this.floatStack = this.time.now - this.floatAt < 1000 ? this.floatStack + 1 : 0;
    this.floatAt = this.time.now;
    const label = this.add
      .text(this.cat.x, this.cat.y - 52 - this.floatStack * 11, text, { fontFamily: 'Trebuchet MS, sans-serif', fontSize: '9px', fontStyle: 'bold', color, stroke: '#fff4e0', strokeThickness: 3, resolution: 4 })
      .setOrigin(0.5, 1)
      .setDepth(1e5);
    this.tweens.add({ targets: label, y: label.y - 14, alpha: 0, delay: 300, duration: 700, onComplete: () => label.destroy() });
  }

  private sfx(id: string | undefined): void {
    if (id) services().audio.sfx(id);
  }
}
