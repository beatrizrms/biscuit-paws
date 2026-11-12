// Gatos que acompanham um vizinho no passeio (só desenho): cada um segue o rastro de quem lidera, alguns passos atrás
// do anterior, com a animação de andar na direção em que vai; parado, senta. Não são gatos do café (não estão no save).
import Phaser from 'phaser';
import { ySortDepth } from '../core/map';
import type { WalkCat } from '../core/neighborWalks';
import { catAnim, catScale, catTexture } from './entities/Cat';

/** Distância (px do mundo) entre o líder e o primeiro gato, e entre um gato e o próximo. */
const GAP = 22;
/** Pontos do rastro guardados (o bastante para a fila inteira). */
const TRAIL_MAX = 400;

export class WalkFollowers {
  private readonly sprites: Phaser.GameObjects.Sprite[] = [];
  /** Posições do líder, a mais nova primeiro (só quando ele anda). */
  private readonly trail: { x: number; y: number }[] = [];

  constructor(
    private scene: Phaser.Scene,
    private leader: Phaser.GameObjects.Sprite,
    cats: readonly WalkCat[],
  ) {
    cats.forEach((c, i) => {
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
      const variant = s.getData('variant') as string;
      if (moving) {
        s.setPosition(s.x + dx * 0.35, s.y + dy * 0.35);
        const dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up';
        s.play(catAnim(this.scene, variant, `walk_${dir}`), true);
      } else s.play(catAnim(this.scene, variant, 'sit'), true);
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
