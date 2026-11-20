import Phaser from 'phaser';
import { touch } from './touch';

const DEPTH = 99_000; // acima do mundo, abaixo do fantasma de posicionar
const KEY = 13; // a teclinha "E"
const PAD = 4;
/** Folga da plaquinha até a borda da tela (px do mundo). */
const EDGE = 3;
const INK = '#3b2a32';

/**
 * Quanto mover o texto (centrado pela caixa da fonte) para que a letra desenhada fique no meio: a caixa conta o
 * espaço de acentos e descendentes, e a maiúscula da Nunito ficava baixa e torta no círculo do botão (decisão 300).
 */
function glyphNudge(text: Phaser.GameObjects.Text): { x: number; y: number } {
  const ctx = text.context;
  // _font e metrics: o que o Phaser mediu da fonte (a base da letra fica em metrics.ascent a partir do topo).
  const style = text.style as unknown as { _font?: string; metrics?: { ascent: number } };
  if (!ctx || !style._font) return { x: 0, y: 0 };
  // Medida 10x maior (no tamanho real o navegador arredonda para o pixel inteiro e o desvio some na conta).
  const SCALE = 10;
  ctx.save();
  ctx.font = style._font.replace(/(\d+(?:\.\d+)?)px/, (_, px: string) => `${Number(px) * SCALE}px`);
  const m = ctx.measureText(text.text);
  ctx.restore();
  const top = m.actualBoundingBoxAscent / SCALE;
  const bottom = m.actualBoundingBoxDescent / SCALE;
  const ascent = style.metrics?.ascent ?? top;
  // Centro da tinta: na horizontal, entre as bordas desenhadas (de -left a right); na vertical, entre o topo e a base.
  const inkX = (m.actualBoundingBoxRight - m.actualBoundingBoxLeft) / 2 / SCALE;
  const inkY = ascent - (top - bottom) / 2;
  return { x: Math.round((text.width / 2 - inkX) * 4) / 4, y: Math.round((text.height / 2 - inkY) * 4) / 4 };
}

/**
 * Dica "E" do tutorial: uma plaquinha com a tecla e o que ela faz ali ("E  Varrer"), flutuando em cima
 * do que o E usaria agora (WorldScene.eTarget decide onde). Aparece sempre, mesmo no que ela já usou (decisão 228).
 * Só desenha; some quando não há nada por perto ou quando ela está ocupada.
 */
export class InteractHint {
  private readonly box: Phaser.GameObjects.Container;
  private readonly bg: Phaser.GameObjects.Graphics;
  private readonly letter: Phaser.GameObjects.Text;
  private readonly label: Phaser.GameObjects.Text;
  private key = '';

  constructor(private readonly scene: Phaser.Scene) {
    this.bg = scene.add.graphics();
    const style = { fontFamily: 'Nunito, Trebuchet MS, sans-serif', fontStyle: 'bold', color: INK, resolution: 4 };
    this.letter = scene.add.text(0, 0, 'E', { ...style, fontSize: '10px' }).setOrigin(0.5, 0.5);
    this.label = scene.add.text(0, 0, '', { ...style, fontSize: '9px' }).setOrigin(0, 0.5);
    // A de dentro sobe e desce devagar (chama a atenção sem piscar); a de fora fica no lugar do objeto.
    const float = scene.add.container(0, 0, [this.bg, this.letter, this.label]);
    scene.tweens.add({ targets: float, y: -1.5, duration: 600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    this.box = scene.add.container(0, 0, [float]).setDepth(DEPTH).setVisible(false);
  }

  /** Mostra em cima do ponto (x, y: o topo do objeto, em pixels do mundo) com o texto da ação, ou esconde (null). */
  show(at: { x: number; y: number; label: string } | null): void {
    const view = this.scene.cameras.main.worldView;
    const padOn = touch.mode === 'pad';
    const key = at ? `${Math.round(at.x)},${Math.round(at.y)},${at.label},${Math.round(view.x)},${Math.round(view.width)},${padOn}` : '';
    if (key === this.key) return;
    this.key = key;
    this.box.setVisible(!!at);
    if (!at) return;
    this.label.setText(at.label);
    // Plaquinha [E] Texto, centrada no objeto, com a setinha embaixo.
    const w = PAD + KEY + PAD + Math.ceil(this.label.width) + PAD + 1;
    const h = KEY + 4;
    const left = -Math.round(w / 2);
    const g = this.bg.clear();
    g.fillStyle(0x3b2a32, 0.3).fillRoundedRect(left, -h / 2 + 1, w, h, 4); // sombra
    g.fillStyle(0xfff4e0, 0.96).fillRoundedRect(left, -h / 2, w, h, 4);
    g.lineStyle(1, 0x8a5a44, 1).strokeRoundedRect(left, -h / 2, w, h, 4);
    // Perto da borda da tela, a plaquinha encosta dentro dela e só a setinha fica em cima do objeto.
    const x = Math.round(Math.min(Math.max(at.x, view.x + w / 2 + EDGE), view.right - w / 2 - EDGE));
    const tip = Math.max(left + 4, Math.min(-left - 4, Math.round(at.x) - x));
    g.fillStyle(0x8a5a44, 1).fillTriangle(tip - 3, h / 2, tip + 3, h / 2, tip, h / 2 + 3);
    // A tecla: quadradinho branco com borda, como no teclado; no controle de videogame, o botão A (bolinha verde).
    const kx = left + PAD;
    if (padOn) {
      g.fillStyle(0x5aa04a, 1).fillCircle(kx + KEY / 2, 0, KEY / 2);
      g.lineStyle(1, 0x2f5a28, 1).strokeCircle(kx + KEY / 2, 0, KEY / 2);
    } else {
      g.fillStyle(0xffffff, 1).fillRoundedRect(kx, -KEY / 2, KEY, KEY, 2);
      g.lineStyle(1, 0x3b2a32, 0.8).strokeRoundedRect(kx, -KEY / 2, KEY, KEY, 2);
    }
    this.letter.setText(padOn ? 'A' : 'E').setColor(padOn ? '#ffffff' : INK);
    const nudge = glyphNudge(this.letter);
    this.letter.setPosition(kx + KEY / 2 + nudge.x, nudge.y);
    this.label.setPosition(kx + KEY + PAD, 0);
    this.box.setPosition(x, Math.round(at.y - h / 2 - 5));
  }

  /** Onde a plaquinha está agora (px do mundo), ou null se escondida: o "!" que cair embaixo dela some. */
  bounds(): Phaser.Geom.Rectangle | null {
    return this.box.visible ? this.box.getBounds() : null;
  }

  destroy(): void {
    this.box.destroy();
  }
}
