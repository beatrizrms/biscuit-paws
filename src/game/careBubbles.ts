// Balão de cuidado em cima de cada gato do café: o que ele está precisando (remédio, banho, carinho).
// Na arte do jogo: o balão de pedido dos clientes (meia escala) com um ícone da folha, ou um emote pronto
// (data/health.json: care.bubbles). Só desenha; quem decide o que falta é a sessão (catCare -> core/care.ts).
import Phaser from 'phaser';
import type { CareConfig, CareNeed } from '../core/care';
import { content, serviceArt } from './content';
import { iconFrame } from './icons';

/** O balão de pedido (40x44) em cima de um gato fica na metade: do tamanho dos emotes. */
const BUBBLE_SCALE = 0.5;
/** Acima da cabeça do gato (px a partir dos pés). */
const ABOVE_FEET = 22;

/** Textura da imagem própria de um item usado num balão (carregada no BootScene). */
export const itemIconKey = (itemId: string) => `itemicon:${itemId}`;

export class CareBubbles {
  private readonly bubbles = new Map<string, { need: CareNeed; view: Phaser.GameObjects.Container }>();

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly cfg: CareConfig,
  ) {}

  /** O balão de uma necessidade: emote pronto, ou o balão de pedido com o ícone no lugar do pedido. */
  private build(need: CareNeed): Phaser.GameObjects.Container {
    const art = this.cfg.bubbles[need];
    const view = this.scene.add.container(0, 0);
    if (art?.emote && this.scene.textures.get('emotes').has(art.emote)) {
      view.add(this.scene.add.image(0, 0, 'emotes', art.emote).setOrigin(0.5, 1));
      return view;
    }
    const bg = this.scene.add.image(0, 0, 'bubble_normal').setOrigin(0.5, 1).setScale(BUBBLE_SCALE);
    view.add(bg);
    const item = art?.item ? content.items[art.item] : undefined;
    const icon = art?.icon ?? item?.icon;
    const f = icon ? iconFrame(this.scene, icon) : undefined;
    const own = !f && item?.iconImage && this.scene.textures.exists(itemIconKey(item.id)) ? itemIconKey(item.id) : undefined;
    if (own) {
      // Imagem própria do item (ex.: a varinha): no slot do ícone, do tamanho de um ícone da folha.
      const [sx, sy, sw, sh] = serviceArt.bubble.iconSlot;
      const img = this.scene.add.image((sx + sw / 2 - bg.width / 2) * BUBBLE_SCALE, (sy + sh / 2 - bg.height) * BUBBLE_SCALE, own);
      view.add(img.setScale((Math.min(sw, sh) * BUBBLE_SCALE) / Math.max(img.width, img.height)));
    } else if (f) {
      // O ícone no slot do balão (dados do atendimento), na mesma escala do balão.
      const [sx, sy, sw, sh] = serviceArt.bubble.iconSlot;
      const x = (sx + sw / 2 - bg.width / 2) * BUBBLE_SCALE;
      const y = (sy + sh / 2 - bg.height) * BUBBLE_SCALE;
      view.add(this.scene.add.image(x, y, f.key, f.frame).setScale(f.scale * BUBBLE_SCALE));
    }
    return view;
  }

  /** `cats`: os gatos visíveis, onde estão e o que falta (o mais urgente). */
  update(cats: { catId: string; x: number; y: number; depth: number; need: CareNeed | null }[]): void {
    const seen = new Set<string>();
    for (const c of cats) {
      if (!c.need) continue;
      seen.add(c.catId);
      let b = this.bubbles.get(c.catId);
      if (b && b.need !== c.need) {
        b.view.destroy();
        b = undefined;
      }
      if (!b) {
        b = { need: c.need, view: this.build(c.need) };
        this.bubbles.set(c.catId, b);
      }
      // Balança de leve (devagar: não pode competir com a dica "E").
      const bob = Math.sin(this.scene.time.now / 500);
      b.view.setPosition(Math.round(c.x), Math.round(c.y - ABOVE_FEET + bob)).setDepth(c.depth + 1);
    }
    for (const [id, b] of this.bubbles) {
      if (seen.has(id)) continue;
      b.view.destroy();
      this.bubbles.delete(id);
    }
  }

  clear(): void {
    this.bubbles.forEach((b) => b.view.destroy());
    this.bubbles.clear();
  }
}
