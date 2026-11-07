// Cliente provisório: o sprite da personagem tingido, com um balão do pedido em cima.
// Só desenha: onde ele fica e o que pediu vêm do núcleo (CafeService).
import Phaser from 'phaser';
import type { Cell } from '../../core/map';
import type { NpcDef } from '../../core/script';
import { iconFrame } from '../icons';
import { NpcSprite } from './Npc';

export class CustomerSprite {
  readonly sprite: NpcSprite;
  private bubble: Phaser.GameObjects.Container;
  private bubbleIcon: Phaser.GameObjects.Image | null = null;
  private walking: Promise<void> = Promise.resolve();
  /** Célula para onde está indo (ou onde está). */
  target: Cell;
  shownRecipe: string | null | undefined;
  leaving = false;

  constructor(
    private scene: Phaser.Scene,
    def: NpcDef,
    at: Cell,
    tint: number,
    private tileSize: number,
  ) {
    this.sprite = new NpcSprite(scene, def, at[0] * tileSize + tileSize / 2, (at[1] + 1) * tileSize - 4, tileSize);
    this.sprite.setTint(tint);
    this.target = at;
    const bg = scene.add.graphics();
    bg.fillStyle(0xfff6e8, 1).lineStyle(1, 0x5a4048, 1).fillRoundedRect(-11, -11, 22, 20, 5).strokeRoundedRect(-11, -11, 22, 20, 5);
    bg.fillTriangle(-3, 9, 3, 9, 0, 13).lineBetween(-3, 9, 0, 13).lineBetween(3, 9, 0, 13);
    this.bubble = scene.add.container(0, 0, [bg]).setVisible(false).setDepth(99_500);
  }

  /**
   * Anda até a célula (uma caminhada por vez). Entrando no salão, desce primeiro e depois vira
   * para o lugar, para não atravessar o balcão; saindo, o caminho de volta (de lado e depois sobe).
   */
  walkTo(cell: Cell, verticalFirst = false): Promise<void> {
    this.target = cell;
    this.walking = this.walking.then(async () => {
      if (!this.sprite.active) return;
      if (verticalFirst) {
        const col = Math.floor(this.sprite.x / this.tileSize);
        await this.sprite.walkTo([col, cell[1]]);
      }
      if (this.sprite.active) await this.sprite.walkTo(cell);
    });
    return this.walking;
  }

  /** Balão com o ícone do pedido (null: "..." pensando; undefined: sem balão). */
  showOrder(icon: string | null | undefined): void {
    this.bubbleIcon?.destroy();
    this.bubbleIcon = null;
    if (icon === undefined) {
      this.bubble.setVisible(false);
      return;
    }
    if (icon) {
      const f = iconFrame(this.scene, icon);
      if (f) this.bubbleIcon = this.scene.add.image(0, -1, f.key, f.frame).setScale(0.5);
    } else {
      this.bubbleIcon = this.scene.add.image(0, -1, 'emotes', 'exclamation').setScale(0.9);
    }
    if (this.bubbleIcon) this.bubble.add(this.bubbleIcon);
    this.bubble.setVisible(true);
  }

  /** Mantém o balão em cima da cabeça. */
  update(): void {
    this.bubble.setPosition(this.sprite.x, this.sprite.y - 74);
  }

  destroy(): void {
    this.bubble.destroy();
    this.sprite.destroy();
  }
}
