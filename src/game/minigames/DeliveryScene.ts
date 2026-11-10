// Entrega relâmpago: a rua da fuga, da ponta esquerda (A) até o cliente que espera o pedido (B) na direita. Pedestres e
// bicicletas vão e voltam em rotas simples; esbarrar para a personagem por stunMs e estraga o pedido. O pedido
// (café, ração, bolo) também perde qualidade com o tempo. A regra mora em src/core/delivery.ts.
import Phaser from 'phaser';
import { mapInSeason } from '../../core/calendar';
import {
  bumpQuality,
  decayQuality,
  deliveryOutcome,
  FULL_QUALITY,
  pickDeliveryItem,
  routePosition,
  type DeliveryItem,
  type DeliveryParams,
  type ObstacleRoute,
} from '../../core/delivery';
import { resolveMap, solidRects, type ResolvedMap } from '../../core/map';
import type { MiniGameResult } from '../../core/minigame';
import { paramsOf } from '../../core/minigame';
import { content, serviceArt, uiText } from '../content';
import { NpcSprite, npcTexture } from '../entities/Npc';
import { Player } from '../entities/Player';
import { iconFrame } from '../icons';
import { services } from '../services';
import { addTileImage } from '../tileArt';
import { ART_SCALE, CHASE, DELIVERY, ensurePlaceholders, loadSheets } from './assets';
import { MiniGameScene } from './MiniGameScene';

export const DELIVERY_SCENE = 'MiniGame.delivery';

/** Folga entre o topo da cabeça e o ícone do pedido (px lógicos). */
const CARRY_GAP = 10;
/** Largura da barrinha de qualidade em cima do pedido. */
const BAR_W = 18;
/** O balão de pedido (40x44) em cima do cliente, na metade, como os balões de cuidado dos gatos. */
const BUBBLE_SCALE = 0.5;

interface Obstacle {
  route: ObstacleRoute;
  sprite: Phaser.GameObjects.Sprite;
  /** Cada um começa num ponto diferente da rota (senão andariam todos juntos). */
  offsetMs: number;
}

export class DeliveryScene extends MiniGameScene {
  private p!: DeliveryParams;
  private map!: ResolvedMap;
  private player!: Player;
  private item!: DeliveryItem;
  private quality = FULL_QUALITY;
  private obstacles: Obstacle[] = [];
  private elapsed = 0;
  private stunnedUntil = 0;
  private safeUntil = 0;
  private carried!: Phaser.GameObjects.Image;
  private bar!: Phaser.GameObjects.Graphics;
  /** O cliente que espera o pedido (B): um dos visitantes do café, sorteado. */
  private customer!: NpcSprite;
  private goal!: { x: number; y: number };
  private arrow!: Phaser.GameObjects.Image;
  private ended: 'arrived' | 'ruined' | 'late' | null = null;

  constructor() {
    super('delivery', DELIVERY_SCENE);
  }

  preload(): void {
    loadSheets(this, [CHASE.arrow, ...Object.values(DELIVERY)]);
  }

  protected buildGame(): void {
    // A bicicleta vira retângulo se o arquivo faltar (assets.ts: DELIVERY; npm run pixellab).
    ensurePlaceholders(this, [CHASE.arrow, ...Object.values(DELIVERY)]);
    const def = this.def;
    this.p = paramsOf<DeliveryParams>(content.minigames, 'delivery', this.launch.params.difficulty);
    this.item = pickDeliveryItem(this.rng, def.items!, this.launch.params.itemId);
    this.quality = FULL_QUALITY;
    this.elapsed = 0;
    this.stunnedUntil = 0;
    this.safeUntil = 0;
    this.ended = null;
    this.obstacles = [];

    // A arena e a colisão são as da fuga (mesmo mapa, mesma estação do mundo).
    const raw = content.maps[def.map!]!;
    this.map = resolveMap(mapInSeason(content.seasons, raw, this.launch.season, (t) => !!content.catalog.tiles[t]), content.catalog);
    const ts = this.map.tileSize;
    const width = this.map.cols * ts;
    const height = this.map.rows * ts;
    this.cameras.main.setBackgroundColor(this.map.background ?? '#a9d4ea');
    for (const s of this.map.sprites) addTileImage(this, s.col * ts, s.row * ts - (s.dy ?? 0), s.sheet, s.frame).setDepth(s.depth);
    this.physics.world.setBounds(0, 0, width, height);
    const solids = this.physics.add.staticGroup();
    for (const r of solidRects(this.map.solid)) solids.add(this.add.zone(r.col * ts + (r.w * ts) / 2, r.row * ts + (r.h * ts) / 2, r.w * ts, r.h * ts));

    // O cliente que espera (B), virado para quem chega, com o balão do pedido; a personagem no ponto A.
    const looks = content.service.customerLooks.map((id) => content.npcs[id]).filter((n) => n && this.textures.exists(npcTexture(n.id)));
    const [gc, gr] = def.goal!;
    this.goal = { x: gc * ts + ts / 2, y: (gr + 1) * ts - 2 };
    if (looks.length > 0) {
      this.customer = new NpcSprite(this, looks[this.rng.int(0, looks.length - 1)]!, this.goal.x, this.goal.y, ts);
      this.customer.face('left');
      this.waitingBubble();
    }
    const [sc, sr] = def.start!;
    this.player = new Player(this, sc * ts + ts / 2, (sr + 1) * ts - 2);
    this.physics.add.collider(this.player, solids);
    const f = iconFrame(this, this.item.icon);
    this.carried = this.add.image(0, 0, f?.key ?? '__MISSING', f?.frame).setScale(0.5 * (f?.scale ?? 1)).setDepth(1e6);
    this.bar = this.add.graphics().setDepth(1e6);

    // Obstáculos: as primeiras rotas da lista (a dificuldade diz quantas).
    for (const route of def.obstacles!.slice(0, this.p.obstacles)) {
      const sprite =
        route.kind === 'pedestrian' && looks.length > 0
          ? new NpcSprite(this, looks[this.rng.int(0, looks.length - 1)]!, 0, 0, ts)
          : this.add.sprite(0, 0, DELIVERY.bike.key, 0).setOrigin(0.5, 1).setScale(ART_SCALE);
      this.obstacles.push({ route, sprite, offsetMs: this.rng.int(0, 8000) });
    }
    this.placeObstacles();

    this.cameras.main.setBounds(0, 0, width, height).startFollow(this.player, true);
    this.arrow = this.add.image(0, 0, CHASE.arrow.key, 0).setScale(ART_SCALE).setDepth(1e6).setVisible(false);
    this.updateCarry();
  }

  protected startGame(): void {
    this.startTimer(this.p.timeSec, () => this.end('late'));
  }

  protected updateGame(delta: number): void {
    this.elapsed += delta;
    const stunned = this.elapsed < this.stunnedUntil;
    this.player.speedFactor = stunned ? 0 : 1;
    this.player.move(stunned ? { up: false, down: false, left: false, right: false } : this.controls.direction());
    this.player.updateDepth();
    this.placeObstacles();
    this.quality = decayQuality(this.quality, this.item, this.p, delta / 1000);
    this.checkBumps();
    this.updateCarry();
    this.updateArrow();
    if (this.quality <= 0) return this.end('ruined');
    if (Phaser.Math.Distance.Between(this.player.x, this.player.y, this.goal.x, this.goal.y) < (this.def.goalRadius ?? 18)) this.end('arrived');
  }

  protected resultText(r: MiniGameResult): string {
    if (r.skipped) return '';
    const t = uiText.minigames.delivery;
    const name = this.item.name.toLowerCase();
    if (this.ended === 'late') return t.late;
    if (this.ended === 'ruined') return t.ruined.replace('{item}', name);
    return t.result.replace('{item}', name).replace('{quality}', String(Math.round(this.quality)));
  }

  protected finish(...args: Parameters<MiniGameScene['finish']>): void {
    this.arrow?.setVisible(false);
    super.finish(...args);
  }

  // ---------- Obstáculos ----------

  private placeObstacles(): void {
    const ts = this.map.tileSize;
    for (const o of this.obstacles) {
      const pos = routePosition(o.route, ts, this.p.speedScale, this.elapsed + o.offsetMs);
      o.sprite.setPosition(pos.x, pos.y).setDepth(pos.y);
      if (o.sprite instanceof NpcSprite) o.sprite.play(`${npcTexture(o.sprite.def.id)}-walk_${pos.dir}`, true);
      else o.sprite.setFlipX(pos.dir === 'left');
    }
  }

  /** Esbarrou: para por stunMs, o pedido estraga um pouco e, por um tempinho, não esbarra de novo. */
  private checkBumps(): void {
    if (this.elapsed < this.safeUntil) return;
    const radius = this.def.hitRadius ?? {};
    const hit = this.obstacles.find((o) => Phaser.Math.Distance.Between(this.player.x, this.player.y, o.sprite.x, o.sprite.y) < (radius[o.route.kind] ?? 12));
    if (!hit) return;
    const stun = this.def.stunMs ?? 1000;
    this.stunnedUntil = this.elapsed + stun;
    this.safeUntil = this.stunnedUntil + (this.def.graceMs ?? 0);
    this.quality = bumpQuality(this.quality, this.item);
    this.tweens.add({ targets: this.player, alpha: 0.4, duration: 120, yoyo: true, repeat: Math.max(0, Math.floor(stun / 240) - 1) });
    this.float(uiText.minigames.delivery.bump);
    this.sfx(this.def.sounds?.bump);
  }

  // ---------- Pedido e fim ----------

  /** O balão do cliente com o que ele espera (o ícone do pedido), balançando de leve. */
  private waitingBubble(): void {
    const top = this.customer.y - this.customer.displayHeight - 2;
    const bubble = this.add.container(this.customer.x, top).setDepth(1e6 - 1);
    const bg = this.add.image(0, 0, 'bubble_normal').setOrigin(0.5, 1).setScale(BUBBLE_SCALE);
    bubble.add(bg);
    const f = iconFrame(this, this.item.icon);
    if (f) {
      const [sx, sy, sw, sh] = serviceArt.bubble.iconSlot;
      bubble.add(this.add.image((sx + sw / 2 - bg.width / 2) * BUBBLE_SCALE, (sy + sh / 2 - bg.height) * BUBBLE_SCALE, f.key, f.frame).setScale(f.scale * BUBBLE_SCALE));
    }
    this.tweens.add({ targets: bubble, y: top - 2, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  }

  /** Altura do ícone do pedido: logo acima da cabeça da personagem. */
  private carryY(): number {
    return this.player.y - this.player.displayHeight - CARRY_GAP;
  }

  /** O pedido em cima da cabeça e a barrinha de qualidade (verde -> amarela -> vermelha) logo acima dele. */
  private updateCarry(): void {
    const x = this.player.x;
    const y = this.carryY();
    this.carried.setPosition(x, y);
    const share = this.quality / FULL_QUALITY;
    const color = share > 0.5 ? 0x68ad8a : share > 0.25 ? 0xe0a94e : 0xd9475d;
    this.bar.clear().fillStyle(0x3b2a32, 0.85).fillRect(x - BAR_W / 2 - 1, y - 12, BAR_W + 2, 4).fillStyle(color, 1).fillRect(x - BAR_W / 2, y - 11, BAR_W * share, 2);
    const t = uiText.minigames.delivery;
    this.setHudInfo(t.hud.replace('{item}', this.item.name).replace('{verb}', this.item.verb).replace('{quality}', String(Math.round(this.quality))));
  }

  /** Seta na borda da tela apontando o cliente quando ele está fora da vista (como a do gato na fuga). */
  private updateArrow(): void {
    const view = this.cameras.main.worldView;
    const t = { x: this.goal.x, y: this.goal.y - 8 };
    if (view.contains(t.x, t.y)) {
      this.arrow.setVisible(false);
      return;
    }
    const m = 12;
    const x = Phaser.Math.Clamp(t.x, view.x + m, view.right - m);
    const y = Phaser.Math.Clamp(t.y, view.y + m, view.bottom - m);
    this.arrow.setPosition(x, y).setRotation(Math.atan2(t.y - y, t.x - x)).setVisible(true);
  }

  private end(how: 'arrived' | 'ruined' | 'late'): void {
    if (this.ended) return;
    this.ended = how;
    this.player.move({ up: false, down: false, left: false, right: false });
    if (how === 'arrived') this.sfx(this.def.sounds?.arrive);
    this.finish(deliveryOutcome(how === 'arrived', this.quality, this.p), Math.round(this.quality));
  }

  private float(text: string): void {
    const label = this.add
      .text(this.player.x, this.carryY() - 14, text, { fontFamily: 'Trebuchet MS, sans-serif', fontSize: '9px', fontStyle: 'bold', color: '#d9475d', stroke: '#fff4e0', strokeThickness: 3, resolution: 4 })
      .setOrigin(0.5, 1)
      .setDepth(1e6);
    this.tweens.add({ targets: label, y: label.y - 12, alpha: 0, delay: 400, duration: 500, onComplete: () => label.destroy() });
  }

  private sfx(id: string | undefined): void {
    if (id) services().audio.sfx(id);
  }
}
