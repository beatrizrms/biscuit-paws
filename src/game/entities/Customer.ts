// Cliente: um dos visuais do pacote clientes, com o balão do pedido em cima.
// Só desenha: onde ele fica, o que pediu e a paciência vêm do núcleo (CafeService).
import Phaser from 'phaser';
import type { Cell, Facing } from '../../core/map';
import type { AnchoredBox } from '../../core/spread';
import type { NpcDef } from '../../core/script';
import { serviceArt } from '../content';
import { iconFrame } from '../icons';
import { NpcSprite } from './Npc';

export type Mood = 'normal' | 'impatient' | 'furious';

/** Tamanho do ícone de "tomando" (fração do ícone normal da folha). */
const DRINK_ICON = 0.5;

export class CustomerSprite {
  readonly sprite: NpcSprite;
  private bubble: Phaser.GameObjects.Container;
  private bubbleBg: Phaser.GameObjects.Image;
  private bubbleIcon: Phaser.GameObjects.Image | null = null;
  /** Barra de paciência em cima do balão (só esperando o pedido). */
  private patienceBar: Phaser.GameObjects.Graphics;
  /** Largura da parte cheia desenhada (pixels da arte); -1 = escondida. */
  private patienceDrawn = -1;
  private waiting: Phaser.GameObjects.Sprite;
  /** Barrinha enquanto consome (depois de pagar): mostra quanto falta para ir embora. */
  private consuming: Phaser.GameObjects.Image;
  /** Ícone de "tomando" ao lado da barrinha de consumo (o que ele pediu). */
  private drinkIcon: Phaser.GameObjects.Image | null = null;
  /** Barra de espera na fila (em pé), embaixo do ícone de espera: a paciência de cada etapa recomeça cheia. */
  private queueBar: Phaser.GameObjects.Graphics;
  private queueDrawn = -1;
  private walking: Promise<void> = Promise.resolve();
  /** Célula para onde está indo (ou onde está). */
  target: Cell;
  shownRecipe: string | null | undefined;
  mood: Mood = 'normal';
  leaving = false;
  /** Chegou à célula de `target` (a caminhada terminou). */
  arrived = false;
  /** Sentado virado para esta direção (null: em pé). */
  seated: Facing | null = null;

  constructor(
    private scene: Phaser.Scene,
    def: NpcDef,
    at: Cell,
    private tileSize: number,
    /** Caminho pelas células livres (contorna móveis); sem ele (ou sem caminho), anda em L como antes. */
    private route?: (from: Cell, to: Cell) => Cell[] | null,
  ) {
    this.sprite = new NpcSprite(scene, def, at[0] * tileSize + tileSize / 2, (at[1] + 1) * tileSize - 4, tileSize);
    this.target = at;
    // Balão: 40x44, ícone no slot dos dados; a ponta embaixo, no meio.
    this.bubbleBg = scene.add.image(0, 0, 'bubble_normal').setOrigin(0.5, 1);
    this.patienceBar = scene.add.graphics().setVisible(false);
    this.bubble = scene.add.container(0, 0, [this.bubbleBg, this.patienceBar]).setVisible(false).setDepth(99_500).setScale(serviceArt.bubble.scale);
    if (!scene.anims.exists('bubble-wait')) {
      scene.anims.create({ key: 'bubble-wait', frames: serviceArt.bubble.waiting.map((_, i) => ({ key: `bubble_wait_${i}` })), frameRate: 3, repeat: -1 });
    }
    this.waiting = scene.add.sprite(0, 0, 'bubble_wait_0').setOrigin(0.5, 1).setVisible(false).setDepth(99_500).setScale(serviceArt.bubble.scale);
    this.consuming = scene.add.image(0, 0, 'progress_0').setOrigin(0.5, 1).setVisible(false).setDepth(99_400);
    this.queueBar = scene.add.graphics().setVisible(false).setDepth(99_500);
  }

  /**
   * Anda até a célula (uma caminhada por vez). Entrando no salão, desce primeiro e depois vira
   * para o lugar, para não atravessar o balcão; saindo, o caminho de volta (de lado e depois sobe).
   */
  walkTo(cell: Cell, verticalFirst = false): Promise<void> {
    this.target = cell;
    this.arrived = false;
    this.walking = this.walking.then(async () => {
      if (!this.sprite.active) return;
      this.seated = null;
      const from: Cell = [Math.floor(this.sprite.x / this.tileSize), Math.floor((this.sprite.y - 1) / this.tileSize)];
      const corners = this.route?.(from, cell);
      if (corners) {
        // Contorna os móveis: anda de quina em quina do caminho.
        for (const corner of corners) if (this.sprite.active) await this.sprite.walkTo(corner);
      } else {
        if (verticalFirst) {
          const col = Math.floor(this.sprite.x / this.tileSize);
          await this.sprite.walkTo([col, cell[1]]);
        }
        if (this.sprite.active) await this.sprite.walkTo(cell);
      }
      if (this.target === cell) this.arrived = true;
    });
    return this.walking;
  }

  /**
   * Senta na cadeira da célula onde está, virado para a mesa. A cadeira de costas (virado para cima) fica na frente
   * dele; nas outras, ele fica na frente da cadeira (base da cadeira: `chairBase`, a profundidade dela).
   */
  sit(dir: Facing, chairBase: number): void {
    if (this.seated === dir || !this.sprite.sit(dir)) return;
    this.seated = dir;
    this.sprite.setDepth(chairBase + (dir === 'up' ? -1 : 1));
  }

  /** Balão do pedido (ícone da receita); null: aguardando (na fila); undefined: sem balão. */
  showOrder(icon: string | null | undefined): void {
    this.bubbleIcon?.destroy();
    this.bubbleIcon = null;
    this.bubble.setVisible(false);
    this.waiting.setVisible(false).stop();
    if (icon === undefined) return;
    if (icon === null) {
      this.waiting.setVisible(true).play('bubble-wait');
      return;
    }
    const f = iconFrame(this.scene, icon);
    if (f) {
      const [sx, sy, sw, sh] = serviceArt.bubble.iconSlot;
      const [bw, bh] = [this.bubbleBg.width, this.bubbleBg.height];
      this.bubbleIcon = this.scene.add.image(sx + sw / 2 - bw / 2, sy + sh / 2 - bh, f.key, f.frame).setScale(f.scale);
      this.bubble.add(this.bubbleIcon);
    }
    this.bubble.setVisible(true);
  }

  /** Consumindo: barrinha de 0 a 1 e o ícone do que ele está tomando (undefined esconde). */
  showConsuming(progress: number | undefined, icon?: string): void {
    if (progress === undefined) {
      this.consuming.setVisible(false);
      this.drinkIcon?.destroy();
      this.drinkIcon = null;
      return;
    }
    if (!this.drinkIcon && icon) {
      const f = iconFrame(this.scene, icon);
      if (f) this.drinkIcon = this.scene.add.image(0, 0, f.key, f.frame).setOrigin(1, 1).setDepth(99_400).setScale(f.scale * DRINK_ICON);
    }
    const n = serviceArt.progress.length;
    this.consuming.setTexture(`progress_${Math.min(n - 1, Math.max(0, Math.round(progress * (n - 1))))}`).setVisible(true);
  }

  /** Paciência: o balão muda de cara (impaciente, furioso). */
  setMood(mood: Mood): void {
    if (mood === this.mood) return;
    this.mood = mood;
    this.bubbleBg.setTexture(`bubble_${mood}`);
    this.patienceDrawn = -2; // redesenha na cor nova
  }

  /** Quanto falta de paciência (1 = cheia, 0 = desiste); undefined esconde a barra. */
  setPatience(left: number | undefined): void {
    const p = serviceArt.bubble.patienceBar;
    if (left === undefined) {
      this.patienceBar.setVisible(false);
      this.patienceDrawn = -1;
      return;
    }
    // Largura em pixels inteiros da arte: só redesenha quando muda um pixel.
    const fill = Math.max(0, Math.min(p.w - 2, Math.ceil(left * (p.w - 2))));
    if (fill === this.patienceDrawn) return;
    this.patienceDrawn = fill;
    const color = (hex: string) => Phaser.Display.Color.HexStringToColor(hex).color;
    const x = p.x - this.bubbleBg.width / 2;
    const y = p.y - this.bubbleBg.height;
    this.patienceBar
      .clear()
      .fillStyle(color(p.border))
      .fillRect(x, y, p.w, p.h)
      .fillStyle(color(p.back))
      .fillRect(x + 1, y + 1, p.w - 2, p.h - 2)
      .fillStyle(color(p.colors[this.mood]))
      .fillRect(x + 1, y + 1, fill, p.h - 2)
      .setVisible(true);
  }

  /** Na fila: quanto falta de paciência (1 = cheia, 0 = desiste), na barra embaixo do ícone de espera; undefined esconde. */
  setQueuePatience(left: number | undefined): void {
    if (left === undefined) {
      this.queueBar.setVisible(false);
      this.queueDrawn = -1;
      return;
    }
    const p = serviceArt.bubble.patienceBar;
    const k = serviceArt.bubble.scale;
    // Um pouco maior que a do balão (que já vem em meia escala): 4 px de altura deixam ver o preenchimento.
    const w = Math.round(p.w * k) + 4;
    const h = 4;
    const fill = Math.max(0, Math.min(w - 2, Math.ceil(left * (w - 2))));
    if (fill === this.queueDrawn) return;
    this.queueDrawn = fill;
    const b = serviceArt.bubble;
    const mood: Mood = left < b.furiousBelow ? 'furious' : left < b.impatientBelow ? 'impatient' : 'normal';
    const color = (hex: string) => Phaser.Display.Color.HexStringToColor(hex).color;
    this.queueBar
      .clear()
      .fillStyle(color(p.border))
      .fillRect(-w / 2, 0, w, h)
      .fillStyle(color(p.back))
      .fillRect(-w / 2 + 1, 1, w - 2, h - 2)
      .fillStyle(color(p.colors[mood]))
      .fillRect(-w / 2 + 1, 1, fill, h - 2)
      .setVisible(true);
  }

  /** Altura da ponta do balão acima dos pés: sentado, a cabeça fica mais baixa. */
  private bubbleLift(): number {
    return this.seated ? 50 : 60;
  }

  /** Caixa do balão à mostra (pedido ou aguardando), pela ponta; null = sem balão. */
  bubbleBox(): AnchoredBox | null {
    const k = serviceArt.bubble.scale;
    // Com a barra de paciência, a caixa cresce para cima até ela.
    const bar = this.patienceBar.visible ? Math.max(0, -serviceArt.bubble.patienceBar.y) : 0;
    if (this.bubble.visible) return { x: this.sprite.x, y: this.sprite.y - this.bubbleLift(), w: this.bubbleBg.width * k, h: (this.bubbleBg.height + bar) * k };
    if (this.waiting.visible) return { x: this.sprite.x + 6, y: this.sprite.y - this.bubbleLift(), w: this.waiting.width * k, h: this.waiting.height * k };
    return null;
  }

  /** Mantém o balão em cima da cabeça; `offset` afasta dos balões vizinhos (mesa cheia). */
  update(offset: readonly [number, number] = [0, 0]): void {
    const [ox, oy] = offset;
    this.bubble.setPosition(this.sprite.x + ox, this.sprite.y - this.bubbleLift() + oy);
    this.waiting.setPosition(this.sprite.x + 6 + ox, this.sprite.y - this.bubbleLift() + oy);
    this.consuming.setPosition(this.sprite.x, this.sprite.y - this.bubbleLift() + 8);
    this.drinkIcon?.setPosition(this.sprite.x - this.consuming.displayWidth / 2 - 1, this.sprite.y - this.bubbleLift() + 10);
    this.queueBar.setPosition(this.sprite.x + 6 + ox, this.sprite.y - this.bubbleLift() + oy + 1);
  }

  destroy(): void {
    this.drinkIcon?.destroy();
    this.queueBar.destroy();
    this.bubble.destroy();
    this.waiting.destroy();
    this.consuming.destroy();
    this.sprite.destroy();
  }
}
