// Quem acompanha um vizinho no passeio (só desenho): os acompanhantes fixos (NPCs, ex.: o Joca com a Gabi) e os gatos
// do dia. Cada um segue o rastro de quem lidera, alguns passos atrás do anterior, com a animação de andar na direção em
// que vai; parado, senta. Não são gatos do café (não estão no save).
import Phaser from 'phaser';
import { ySortDepth } from '../core/map';
import type { WalkCat } from '../core/neighborWalks';
import type { NpcDef } from '../core/script';
import { catAnim, catScale, catTexture } from './entities/Cat';
import { NpcSprite, npcTexture } from './entities/Npc';

/** Distância (px do mundo) entre o líder e o primeiro gato, e entre um gato e o próximo. */
const GAP = 22;
/** Pontos do rastro guardados (o bastante para a fila inteira). */
const TRAIL_MAX = 400;

export class WalkFollowers {
  /** Na ordem da fila: os acompanhantes (NPCs) primeiro, depois os gatos. */
  private readonly sprites: Phaser.GameObjects.Sprite[] = [];
  /** Posições do líder, a mais nova primeiro (só quando ele anda). */
  private readonly trail: { x: number; y: number }[] = [];

  constructor(
    private scene: Phaser.Scene,
    private leader: Phaser.GameObjects.Sprite,
    cats: readonly WalkCat[],
    companions: readonly NpcDef[] = [],
    tileSize = 32,
  ) {
    for (const def of companions) {
      if (!scene.textures.exists(npcTexture(def.id))) continue;
      const s = new NpcSprite(scene, def, leader.x - (this.sprites.length + 1) * GAP, leader.y, tileSize);
      s.setData('npc', def.id);
      this.sprites.push(s);
    }
    cats.forEach((c) => {
      const i = this.sprites.length;
      if (!scene.textures.exists(catTexture(c.variant))) return;
      const s = scene.add.sprite(leader.x - (i + 1) * GAP, leader.y, catTexture(c.variant), 0).setOrigin(0.5, 28 / 32);
      s.setScale(catScale(c.variant));
      s.setData('variant', c.variant);
      s.play(catAnim(scene, c.variant, 'sit'));
      this.sprites.push(s);
    });
    this.trail.push({ x: leader.x, y: leader.y });
  }

  /** Chamar todo quadro enquanto o líder existe. */
  update(): void {
    if (!this.leader.active) return;
    const head = this.trail[0]!;
    if (Math.hypot(this.leader.x - head.x, this.leader.y - head.y) >= 1) {
      this.trail.unshift({ x: this.leader.x, y: this.leader.y });
      if (this.trail.length > TRAIL_MAX) this.trail.pop();
    }
    this.sprites.forEach((s, i) => {
      const want = this.pointBehind((i + 1) * GAP);
      const dx = want.x - s.x;
      const dy = want.y - s.y;
      const moving = Math.hypot(dx, dy) > 0.6;
      const variant = s.getData('variant') as string | undefined;
      const npc = s.getData('npc') as string | undefined;
      const dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up';
      if (moving) s.setPosition(s.x + dx * 0.35, s.y + dy * 0.35);
      if (npc) {
        const key = npcTexture(npc);
        if (moving) s.play(`${key}-walk_${dir}`, true);
        else if (this.scene.anims.exists(`${key}-sentado`)) s.play(`${key}-sentado`, true);
        else s.stop();
      } else if (variant) {
        if (moving) s.play(catAnim(this.scene, variant, `walk_${dir}`), true);
        else s.play(catAnim(this.scene, variant, 'sit'), true);
      }
      s.setDepth(ySortDepth(s.y));
    });
  }

  /** O ponto do rastro a `dist` px do líder (andando pelo caminho que ele fez). */
  private pointBehind(dist: number): { x: number; y: number } {
    let left = dist;
    for (let i = 1; i < this.trail.length; i++) {
      const a = this.trail[i - 1]!;
      const b = this.trail[i]!;
      const seg = Math.hypot(a.x - b.x, a.y - b.y);
      if (seg >= left) return { x: a.x + ((b.x - a.x) * left) / seg, y: a.y + ((b.y - a.y) * left) / seg };
      left -= seg;
    }
    return this.trail[this.trail.length - 1]!;
  }

  /** Somem junto com o líder (esmaecendo). */
  leave(): void {
    for (const s of this.sprites) this.scene.tweens.add({ targets: s, alpha: 0, duration: 400, onComplete: () => s.destroy() });
    this.sprites.length = 0;
  }

  destroy(): void {
    for (const s of this.sprites) s.destroy();
    this.sprites.length = 0;
  }
}
