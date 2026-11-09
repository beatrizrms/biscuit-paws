// Balão de cuidado em cima de cada gato do café: o que ele está precisando (remédio, banho, carinho).
// Só desenha; quem decide o que falta é a sessão (catCare -> core/care.ts: careNeeds).
import Phaser from 'phaser';
import type { CareNeed } from '../core/care';

/**
 * PLACEHOLDER(arte): balões 16x16 desenhados por código. Para trocar, carregue uma imagem com a mesma chave
 * (o desenho só é feito quando a chave ainda não existe). Lista em assets-pendentes.
 */
export const CARE_BUBBLE_KEYS: Record<CareNeed, string> = {
  medicine: 'care_bubble_medicine',
  dirty: 'care_bubble_dirty',
  sad: 'care_bubble_sad',
};

const W = 16;
const H = 16;

/** Desenha os balões que ainda não têm imagem. */
export function ensureCareBubbleTextures(scene: Phaser.Scene): void {
  for (const [need, key] of Object.entries(CARE_BUBBLE_KEYS) as [CareNeed, string][]) {
    if (scene.textures.exists(key)) continue;
    const g = scene.make.graphics({}, false);
    // Balão: creme com borda, rabinho embaixo.
    g.fillStyle(0xfff4e0, 1).fillRoundedRect(1, 1, W - 2, H - 5, 4);
    g.lineStyle(1, 0x8a5a44, 1).strokeRoundedRect(1, 1, W - 2, H - 5, 4);
    g.fillStyle(0xfff4e0, 1).fillTriangle(6, H - 5, 10, H - 5, 8, H - 1);
    g.lineStyle(1, 0x8a5a44, 1).lineBetween(6, H - 5, 8, H - 1).lineBetween(10, H - 5, 8, H - 1);
    if (need === 'medicine') {
      // Cápsula metade vermelha, metade branca.
      g.fillStyle(0xd9475d, 1).fillRoundedRect(3, 4, 5, 5, 2);
      g.fillStyle(0xffffff, 1).fillRoundedRect(7, 4, 5, 5, 2);
      g.lineStyle(1, 0x3b2a32, 0.7).strokeRoundedRect(3, 4, 9, 5, 2);
    } else if (need === 'dirty') {
      // Manchinhas de sujeira e uma gota.
      g.fillStyle(0x8a6a4a, 1).fillCircle(5, 6, 1.6).fillCircle(9, 5, 1.2).fillCircle(11, 8, 1.6).fillCircle(7, 9, 1.1);
    } else {
      // Carinha triste: olhos e boca para baixo, uma lágrima azul.
      g.fillStyle(0x3b2a32, 1).fillRect(5, 5, 1, 2).fillRect(10, 5, 1, 2);
      g.lineStyle(1, 0x3b2a32, 1).beginPath().arc(8, 11, 2.5, Math.PI * 1.15, Math.PI * 1.85).strokePath();
      g.fillStyle(0x6fb3e0, 1).fillCircle(11, 8, 1.1);
    }
    g.generateTexture(key, W, H);
    g.destroy();
  }
}

/** Um balão por gato: aparece em cima dele quando falta algo; some quando está tudo bem. */
export class CareBubbles {
  private readonly bubbles = new Map<string, Phaser.GameObjects.Image>();

  constructor(private readonly scene: Phaser.Scene) {
    ensureCareBubbleTextures(scene);
  }

  /** `cats`: os gatos visíveis, onde estão e o que falta (o primeiro da lista é o mais urgente). */
  update(cats: { catId: string; x: number; y: number; depth: number; need: CareNeed | null }[]): void {
    const seen = new Set<string>();
    for (const c of cats) {
      if (!c.need) continue;
      seen.add(c.catId);
      let img = this.bubbles.get(c.catId);
      if (!img) {
        img = this.scene.add.image(0, 0, CARE_BUBBLE_KEYS[c.need]).setOrigin(0.5, 1);
        this.bubbles.set(c.catId, img);
      }
      img.setTexture(CARE_BUBBLE_KEYS[c.need]);
      // Em cima da cabeça, balançando de leve (devagar: não pode competir com a dica "E").
      const bob = Math.sin(this.scene.time.now / 500) * 1;
      img.setPosition(Math.round(c.x), Math.round(c.y - 24 + bob)).setDepth(c.depth + 1);
    }
    for (const [id, img] of this.bubbles) {
      if (seen.has(id)) continue;
      img.destroy();
      this.bubbles.delete(id);
    }
  }

  clear(): void {
    this.bubbles.forEach((img) => img.destroy());
    this.bubbles.clear();
  }
}
