// Gato em fuga: o gato corre pela calçada, muda de direção de tempos em tempos, desvia de obstáculos e pode
// entrar num esconderijo; a jogadora encosta nele antes do tempo acabar. Escondido, só sai se ela espiar (E/clique
// perto) ou depois de um tempo. Regras puras (para onde ir, resultado) em src/core/chase.ts; números nos dados.
import Phaser from 'phaser';
import { between, bounceHeading, chaseOutcome, fleeHeading, type ChaseParams, type Vec } from '../../core/chase';
import { mapInSeason } from '../../core/calendar';
import { resolveMap, solidRects, type Cell, type ResolvedMap } from '../../core/map';
import type { MiniGameResult } from '../../core/minigame';
import { paramsOf } from '../../core/minigame';
import { content, uiText } from '../content';
import { Player } from '../entities/Player';
import { catTexture, CatSprite } from '../entities/Cat';
import { ART_SCALE, CHASE, ensurePlaceholders, HIDE_SHEETS, loadSheets } from './assets';
import { MiniGameScene } from './MiniGameScene';

export const CHASE_SCENE = 'MiniGame.chase';

/** Um esconderijo sorteado para a partida. */
interface Spot {
  at: Cell;
  sprite: Phaser.GameObjects.Sprite;
  /** O gato está dentro. */
  occupied: boolean;
}

/** Distância (px) em que dá para espiar um esconderijo. */
const PEEK_RADIUS = 30;
/** Perto disto do esconderijo escolhido, o gato entra. */
const ENTER_RADIUS = 5;
/** O gato só considera esconderijos a até esta distância (px) quando decide se esconder. */
const HIDE_SEARCH_RADIUS = 140;
/** Um rastro de poeira a cada tantos ms enquanto alguém corre. */
const DUST_EVERY_MS = 160;

export class ChaseScene extends MiniGameScene {
  private p!: ChaseParams;
  private map!: ResolvedMap;
  private player!: Player;
  private cat!: Phaser.Physics.Arcade.Sprite;
  private catDir: Vec = { x: 1, y: 0 };
  private nextTurnAt = 0;
  private spots: Spot[] = [];
  /** Indo para um esconderijo / escondido nele (e até quando). */
  private targetSpot: Spot | null = null;
  private hiddenIn: Spot | null = null;
  private hiddenUntil = 0;
  private noticed = false;
  private elapsed = 0;
  private lastDust = { player: 0, cat: 0 };
  private arrow!: Phaser.GameObjects.Image;

  constructor() {
    super('chase', CHASE_SCENE);
  }

  preload(): void {
    loadSheets(this, Object.values(CHASE));
  }

  protected buildGame(): void {
    ensurePlaceholders(this, Object.values(CHASE));
    this.p = paramsOf<ChaseParams>(content.minigames, 'chase', this.launch.params.difficulty);
    this.elapsed = 0;
    this.spots = [];
    this.targetSpot = null;
    this.hiddenIn = null;
    this.noticed = false;

    // A arena é um mapa de dados (data/maps/minigame_chase.json), na estação do mundo.
    const raw = content.maps[this.def.map!]!;
    const exists = (t: string) => !!content.catalog.tiles[t];
    this.map = resolveMap(mapInSeason(content.seasons, raw, this.launch.season, exists), content.catalog);
    const ts = this.map.tileSize;
    const width = this.map.cols * ts;
    const height = this.map.rows * ts;
    this.cameras.main.setBackgroundColor(this.map.background ?? '#a9d4ea');
    for (const s of this.map.sprites) this.add.image(s.col * ts, s.row * ts - (s.dy ?? 0), s.sheet, s.frame).setOrigin(0).setDepth(s.depth);
    this.physics.world.setBounds(0, 0, width, height);
    const solids = this.physics.add.staticGroup();
    for (const r of solidRects(this.map.solid)) {
      const w = r.w * ts;
      const h = r.h * ts;
      solids.add(this.add.zone(r.col * ts + w / 2, r.row * ts + h / 2, w, h));
    }

    // Personagem (a mesma do mundo, com as camadas do criador) e o gato da missão.
    const [pc, pr] = this.map.spawn;
    this.player = new Player(this, pc * ts + ts / 2, (pr + 1) * ts - 2);
    const def = this.def as { catSpawn?: Cell; spots?: { at: Cell; kind: string }[] };
    const [cc, cr] = def.catSpawn ?? [Math.floor(this.map.cols / 2), Math.floor(this.map.rows / 2)];
    CatSprite.createAnimations(this, this.launch.catVariant);
    this.cat = this.physics.add.sprite(cc * ts + ts / 2, (cr + 1) * ts - 4, catTexture(this.launch.catVariant), 0);
    this.cat.setOrigin(0.5, 28 / 32); // pés na linha 28 do quadro (Cosy Cats)
    const body = this.cat.body as Phaser.Physics.Arcade.Body;
    body.setSize(14, 6).setOffset(9, 23).setCollideWorldBounds(true);
    this.cat.play(`${catTexture(this.launch.catVariant)}-sit`);
    this.physics.add.collider(this.player, solids);
    this.physics.add.collider(this.cat, solids);

    // Esconderijos: hidingSpots sorteados entre os possíveis da arena.
    const pool = [...(def.spots ?? [])];
    for (let i = 0; i < this.p.hidingSpots && pool.length > 0; i++) {
      const pick = pool.splice(this.rng.int(0, pool.length - 1), 1)[0]!;
      const sheet = HIDE_SHEETS[pick.kind] ?? CHASE.hideBox;
      const bottom = (pick.at[1] + 1) * ts;
      const sprite = this.add.sprite(pick.at[0] * ts + ts / 2, bottom, sheet.key, 0).setOrigin(0.5, 1).setScale(ART_SCALE).setDepth(bottom);
      this.spots.push({ at: pick.at, sprite, occupied: false });
    }

    // Câmera segue a jogadora dentro da arena; a seta aponta o gato quando ele sai da tela.
    this.cameras.main.setBounds(0, 0, width, height).startFollow(this.player, true);
    this.arrow = this.add.image(0, 0, CHASE.arrow.key, 0).setScale(ART_SCALE).setDepth(1e6).setVisible(false);
    this.controls.onAction((world) => this.peek(world));
  }

  protected startGame(): void {
    this.startTimer(this.p.timeSec, () => this.finish('fail', 0));
    this.turnCat(true);
  }

  protected updateGame(delta: number): void {
    this.elapsed += delta;
    this.player.move(this.controls.direction());
    this.player.updateDepth();
    this.updateCat();
    this.cat.setDepth(this.cat.y);
    this.dust(delta);
    this.updateArrow();

    // Encostou no gato (fora do esconderijo): pegou.
    if (!this.hiddenIn && Phaser.Math.Distance.Between(this.player.x, this.player.y, this.cat.x, this.cat.y) < this.p.catchRadius) {
      const share = this.timer?.remainingShare() ?? 0;
      this.cat.setVelocity(0, 0).play(`${catTexture(this.launch.catVariant)}-sit`);
      this.finish(chaseOutcome(true, share, this.p.greatTimeShare), Math.round((this.timer?.remainingMs() ?? 0) / 1000));
    }
  }

  /** Acabou: a seta e a poeira não ficam por cima da tela de resultado. */
  protected finish(...args: Parameters<MiniGameScene['finish']>): void {
    this.arrow?.setVisible(false);
    this.cat?.setVelocity(0, 0);
    super.finish(...args);
  }

  protected resultText(r: MiniGameResult): string {
    const t = uiText.minigames.chase;
    if (r.skipped) return '';
    return r.outcome === 'fail' ? t.escaped : t.caught.replace('{s}', String(r.score));
  }

  // ---------- O gato ----------

  private updateCat(): void {
    if (this.hiddenIn) {
      if (this.elapsed >= this.hiddenUntil) this.leaveSpot(false); // cansou de esperar e saiu sozinho
      return;
    }
    if (this.targetSpot) {
      const s = this.targetSpot;
      const dx = s.sprite.x - this.cat.x;
      const dy = s.sprite.y - 4 - this.cat.y;
      const d = Math.hypot(dx, dy);
      if (d < ENTER_RADIUS) return this.enterSpot(s);
      this.catDir = { x: dx / d, y: dy / d };
    } else if (this.elapsed >= this.nextTurnAt) {
      this.turnCat(false);
    }
    // Bateu em algo (obstáculo ou borda): vira para o lado em vez de ficar empurrando a parede.
    const body = this.cat.body as Phaser.Physics.Arcade.Body;
    if (!this.targetSpot && (body.blocked.left || body.blocked.right || body.blocked.up || body.blocked.down)) {
      this.catDir = bounceHeading(this.rng, this.catDir);
      this.nextTurnAt = this.elapsed + between(this.rng, this.p.turnEveryMs);
    }
    this.cat.setVelocity(this.catDir.x * this.p.catSpeed, this.catDir.y * this.p.catSpeed);
    this.animateCat();
  }

  /** Decide a próxima direção; às vezes, perto de um esconderijo livre, vai se esconder. */
  private turnCat(first: boolean): void {
    const { dir, noticed } = fleeHeading(this.rng, this.cat, this.player, this.p.noticeRadius);
    this.catDir = dir;
    if (noticed && !this.noticed) this.alert(0); // "!": ele te viu
    this.noticed = noticed;
    this.nextTurnAt = this.elapsed + between(this.rng, this.p.turnEveryMs);
    if (first) return;
    const free = this.spots.filter((s) => !s.occupied && Phaser.Math.Distance.Between(s.sprite.x, s.sprite.y, this.cat.x, this.cat.y) < HIDE_SEARCH_RADIUS);
    if (free.length > 0 && this.rng.chance(this.p.hideChance)) this.targetSpot = free[this.rng.int(0, free.length - 1)]!;
  }

  private enterSpot(s: Spot): void {
    this.targetSpot = null;
    this.hiddenIn = s;
    s.occupied = true;
    s.sprite.setFrame(1); // orelhas aparecendo
    this.hiddenUntil = this.elapsed + between(this.rng, this.p.hideMs);
    this.cat.setVelocity(0, 0).setVisible(false);
    (this.cat.body as Phaser.Physics.Arcade.Body).enable = false;
  }

  /** Sai do esconderijo e corre (espiado: com susto, foge da jogadora). */
  private leaveSpot(spooked: boolean): void {
    const s = this.hiddenIn;
    if (!s) return;
    this.hiddenIn = null;
    s.occupied = false;
    s.sprite.setFrame(0);
    this.cat.setPosition(s.sprite.x, s.sprite.y + 6).setVisible(true);
    (this.cat.body as Phaser.Physics.Arcade.Body).enable = true;
    (this.cat.body as Phaser.Physics.Arcade.Body).reset(this.cat.x, this.cat.y);
    this.noticed = false;
    this.turnCat(true);
    if (spooked) this.alert(0);
  }

  /** E/clique: espia o esconderijo mais perto (com o gato dentro, ele sai correndo). */
  private peek(world?: { x: number; y: number }): void {
    if (this.phase !== 'playing') return;
    const near = this.spots.find((s) => {
      const close = Phaser.Math.Distance.Between(this.player.x, this.player.y, s.sprite.x, s.sprite.y) < PEEK_RADIUS;
      const clicked = !world || s.sprite.getBounds().contains(world.x, world.y);
      return close && clicked;
    });
    if (!near) return;
    this.tweens.add({ targets: near.sprite, x: near.sprite.x + 1.5, duration: 50, yoyo: true, repeat: 2 });
    if (near === this.hiddenIn) this.leaveSpot(true);
    else this.alertAt(near.sprite.x, near.sprite.y - 30, 1); // "?": vazio
  }

  private animateCat(): void {
    const v = this.catDir;
    const anim = Math.abs(v.x) > Math.abs(v.y) ? (v.x > 0 ? 'walk_right' : 'walk_left') : v.y > 0 ? 'walk_down' : 'walk_up';
    this.cat.play(`${catTexture(this.launch.catVariant)}-${anim}`, true);
  }

  // ---------- Efeitos ----------

  /** Balão em cima do gato: 0 = "!", 1 = "?". */
  private alert(frame: number): void {
    this.alertAt(this.cat.x, this.cat.y - 26, frame);
  }

  private alertAt(x: number, y: number, frame: number): void {
    const b = this.add.image(x, y, CHASE.alerts.key, frame).setScale(ART_SCALE).setDepth(1e6);
    this.tweens.add({ targets: b, y: y - 6, alpha: 0, delay: 450, duration: 350, onComplete: () => b.destroy() });
  }

  /** Poeira nos pés de quem está correndo. */
  private dust(delta: number): void {
    void delta;
    const puff = (who: 'player' | 'cat', x: number, y: number, moving: boolean) => {
      if (!moving || this.elapsed - this.lastDust[who] < DUST_EVERY_MS) return;
      this.lastDust[who] = this.elapsed;
      const d = this.add.sprite(x, y, CHASE.dust.key, 0).setScale(ART_SCALE).setOrigin(0.5, 1).setDepth(y - 1);
      let f = 0;
      this.time.addEvent({ delay: 90, repeat: 3, callback: () => (++f < 4 ? d.setFrame(f) : d.destroy()) });
    };
    const pv = (this.player.body as Phaser.Physics.Arcade.Body).velocity;
    puff('player', this.player.x, this.player.y, pv.lengthSq() > 1);
    if (this.cat.visible) puff('cat', this.cat.x, this.cat.y, (this.cat.body as Phaser.Physics.Arcade.Body).velocity.lengthSq() > 1);
  }

  /** Seta na borda da tela apontando o gato (ou o esconderijo dele) quando ele está fora da vista. */
  private updateArrow(): void {
    const target = this.hiddenIn ? this.hiddenIn.sprite : this.cat;
    const view = this.cameras.main.worldView;
    if (view.contains(target.x, target.y)) {
      this.arrow.setVisible(false);
      return;
    }
    const m = 12;
    const x = Phaser.Math.Clamp(target.x, view.x + m, view.right - m);
    const y = Phaser.Math.Clamp(target.y, view.y + m, view.bottom - m);
    this.arrow.setPosition(x, y).setRotation(Math.atan2(target.y - y, target.x - x)).setVisible(true);
  }
}
