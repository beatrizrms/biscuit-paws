import Phaser from 'phaser';

const DEPTH = 99_000; // acima do mundo, abaixo do fantasma de posicionar
const KEY = 13; // a teclinha "E"
const PAD = 4;
const INK = '#3b2a32';

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

  constructor(scene: Phaser.Scene) {
    this.bg = scene.add.graphics();
    const style = { fontFamily: 'Trebuchet MS, sans-serif', fontStyle: 'bold', color: INK, resolution: 4 };
    this.letter = scene.add.text(0, 0, 'E', { ...style, fontSize: '10px' }).setOrigin(0.5, 0.5);
    this.label = scene.add.text(0, 0, '', { ...style, fontSize: '9px' }).setOrigin(0, 0.5);
    // A de dentro sobe e desce devagar (chama a atenção sem piscar); a de fora fica no lugar do objeto.
    const float = scene.add.container(0, 0, [this.bg, this.letter, this.label]);
    scene.tweens.add({ targets: float, y: -1.5, duration: 600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    this.box = scene.add.container(0, 0, [float]).setDepth(DEPTH).setVisible(false);
  }

  /** Mostra em cima do ponto (x, y: o topo do objeto, em pixels do mundo) com o texto da ação, ou esconde (null). */
  show(at: { x: number; y: number; label: string } | null): void {
    const key = at ? `${Math.round(at.x)},${Math.round(at.y)},${at.label}` : '';
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
    g.fillStyle(0x8a5a44, 1).fillTriangle(-3, h / 2, 3, h / 2, 0, h / 2 + 3);
    // A tecla: quadradinho branco com borda, como no teclado.
    const kx = left + PAD;
    g.fillStyle(0xffffff, 1).fillRoundedRect(kx, -KEY / 2, KEY, KEY, 2);
    g.lineStyle(1, 0x3b2a32, 0.8).strokeRoundedRect(kx, -KEY / 2, KEY, KEY, 2);
    this.letter.setPosition(kx + KEY / 2, 0);
    this.label.setPosition(kx + KEY + PAD, 0);
    this.box.setPosition(Math.round(at.x), Math.round(at.y - h / 2 - 5));
  }

  destroy(): void {
    this.box.destroy();
  }
}
