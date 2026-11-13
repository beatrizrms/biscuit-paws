// Balão de cuidado em cima de cada gato do café: o que ele está precisando (remédio, banho, carinho) e o sinal da
// clínica (operado, doente, doença que passa), lado a lado no mesmo balão. Na arte do jogo: o balão de pedido dos
// clientes (meia escala), alargado para caber mais de um ícone, com os ícones da folha; necessidade com emote pronto
// (data/health.json: care.bubbles: o coração, que passa logo) fica por cima do balão. Só desenha; quem decide o que falta é a sessão (catCare -> core/care.ts).
import Phaser from 'phaser';
import type { CareConfig, CareNeed } from '../core/care';
import { content, emoteImage, serviceArt } from './content';
import { iconFrame } from './icons';

/** O balão de pedido (40x44) em cima de um gato fica na metade: do tamanho dos emotes. */
const BUBBLE_SCALE = 0.5;
/** Acima da cabeça do gato (px a partir dos pés). */
const ABOVE_FEET = 22;
/** Na arte do balão (40x44): a borda da esquerda e da direita (não estica), a última linha do corpo e o rabinho. */
const BUBBLE_EDGE = 2;
const BUBBLE_BODY_ROWS = 38;
const TAIL = { x: 17, w: 6 };
/** Emote por cima do balão: quanto ele desce sobre a borda de cima (px). */
const EMOTE_OVER = 8;
/** Um ícone a mais no balão: o slot (32) e o respiro entre os ícones. */
const SLOT_STEP = 34;

/** Textura da imagem própria de um item usado num balão (carregada no BootScene). */
export const itemIconKey = (itemId: string) => `itemicon:${itemId}`;

/** O sinal da clínica no balão: operado (tesoura), doente (termômetro), doença que passa já diagnosticada (micróbio). */
export type CareStatus = 'op' | 'sick' | 'contagious';
const STATUS_ICONS: Record<CareStatus, string> = { op: 'sinal_tesoura', sick: 'sinal_termometro', contagious: 'sinal_microbio' };

export interface CareBubbleCat {
  catId: string;
  x: number;
  y: number;
  depth: number;
  needs: CareNeed[];
  status: CareStatus | null;
}

export class CareBubbles {
  private readonly bubbles = new Map<string, { key: string; view: Phaser.GameObjects.Container }>();

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly cfg: CareConfig,
  ) {}

  /** O balão com `n` ícones: o de pedido alargado pelo meio (as bordas e o rabinho do centro não esticam). */
  private bubbleTexture(n: number): string {
    if (n <= 1) return 'bubble_normal';
    const key = `bubble_normal_x${n}`;
    if (this.scene.textures.exists(key)) return key;
    const src = this.scene.textures.get('bubble_normal').getSourceImage() as HTMLImageElement;
    const w = src.width + (n - 1) * SLOT_STEP;
    const tex = this.scene.textures.createCanvas(key, w, src.height)!;
    const ctx = tex.getContext();
    ctx.imageSmoothingEnabled = false;
    // Corpo: as bordas como estão e o miolo esticado com uma coluna do meio (sem o rabinho, que fica embaixo do corpo).
    ctx.drawImage(src, 0, 0, BUBBLE_EDGE, BUBBLE_BODY_ROWS, 0, 0, BUBBLE_EDGE, BUBBLE_BODY_ROWS);
    ctx.drawImage(src, BUBBLE_EDGE, 0, 1, BUBBLE_BODY_ROWS, BUBBLE_EDGE, 0, w - 2 * BUBBLE_EDGE, BUBBLE_BODY_ROWS);
    ctx.drawImage(src, src.width - BUBBLE_EDGE, 0, BUBBLE_EDGE, BUBBLE_BODY_ROWS, w - BUBBLE_EDGE, 0, BUBBLE_EDGE, BUBBLE_BODY_ROWS);
    // O rabinho no meio, embaixo.
    ctx.drawImage(src, TAIL.x, BUBBLE_BODY_ROWS, TAIL.w, src.height - BUBBLE_BODY_ROWS, Math.round(w / 2 - TAIL.w / 2), BUBBLE_BODY_ROWS, TAIL.w, src.height - BUBBLE_BODY_ROWS);
    tex.refresh();
    return key;
  }

  /** Os ícones de uma necessidade (ou null se ela é um emote pronto, desenhado à parte). */
  private needIcon(need: CareNeed): { key: string; frame?: string; scale: number } | null {
    const art = this.cfg.bubbles[need];
    if (art?.emote && this.scene.textures.get('emotes').has(art.emote)) return null;
    const item = art?.item ? content.items[art.item] : undefined;
    const icon = art?.icon ?? item?.icon;
    const f = icon ? iconFrame(this.scene, icon) : undefined;
    if (f) return { key: f.key, frame: f.frame, scale: f.scale };
    // Imagem própria do item (ex.: a varinha): do tamanho de um ícone da folha.
    if (item?.iconImage && this.scene.textures.exists(itemIconKey(item.id))) {
      const img = this.scene.textures.get(itemIconKey(item.id)).getSourceImage();
      const [, , sw, sh] = serviceArt.bubble.iconSlot;
      return { key: itemIconKey(item.id), scale: Math.min(sw, sh) / Math.max(img.width, img.height) };
    }
    return null;
  }

  /** O balão do gato: os ícones das necessidades e do sinal lado a lado; as de emote, ao lado do balão. */
  private build(c: CareBubbleCat): Phaser.GameObjects.Container {
    const view = this.scene.add.container(0, 0);
    const icons: { key: string; frame?: string; scale: number }[] = [];
    const emotes: string[] = [];
    for (const need of c.needs) {
      const icon = this.needIcon(need);
      if (icon) icons.push(icon);
      else {
        const e = this.cfg.bubbles[need]?.emote;
        if (e) emotes.push(e);
      }
    }
    if (c.status) {
      const f = iconFrame(this.scene, STATUS_ICONS[c.status]);
      if (f) icons.push({ key: f.key, frame: f.frame, scale: f.scale });
    }
    let top = 0;
    if (icons.length > 0) {
      const bg = this.scene.add.image(0, 0, this.bubbleTexture(icons.length)).setOrigin(0.5, 1).setScale(BUBBLE_SCALE);
      view.add(bg);
      const [sx, sy, sw, sh] = serviceArt.bubble.iconSlot;
      icons.forEach((ic, i) => {
        const x = (sx + i * SLOT_STEP + sw / 2 - bg.width / 2) * BUBBLE_SCALE;
        const y = (sy + sh / 2 - bg.height) * BUBBLE_SCALE;
        view.add(this.scene.add.image(x, y, ic.key, ic.frame).setScale(ic.scale * BUBBLE_SCALE));
      });
      top = -bg.height * BUBBLE_SCALE;
    }
    // Emote pronto (o coração do carinho, que passa logo): sozinho no lugar do balão, ou por cima do balão, encostado na
    // borda de cima (sem empurrar os ícones).
    emotes.forEach((e, i) => {
      const img = emoteImage(this.scene, i * 4, icons.length ? top + EMOTE_OVER : 0, e).setOrigin(0.5, 1);
      view.add(img);
    });
    return view;
  }

  /** `cats`: os gatos (visíveis ou na caixinha), onde estão, o que falta e o sinal da clínica. */
  update(cats: CareBubbleCat[]): void {
    const seen = new Set<string>();
    for (const c of cats) {
      if (c.needs.length === 0 && !c.status) continue;
      seen.add(c.catId);
      const key = `${c.needs.join(',')}|${c.status ?? ''}`;
      let b = this.bubbles.get(c.catId);
      if (b && b.key !== key) {
        b.view.destroy();
        b = undefined;
      }
      if (!b) {
        b = { key, view: this.build(c) };
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
