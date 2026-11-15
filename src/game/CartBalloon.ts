import Phaser from 'phaser';

const DEPTH = 98_000; // acima do mundo, abaixo da dica do E
const ICON_KEY = 'hud_cart_full';
const ICON_FILE = 'assets/ui/hud/icon_cart_full.png';
const ICON = 10;
const PAD = 3;
const INK = '#3b2a32';

/**
 * O carrinho do mercado num balãozinho em cima da cabeça dela (ícone + "itens · total"), enquanto ela está no mercado
 * com algo no carrinho. Antes ficava no HUD, escondido embaixo da energia. Só desenha: quem decide é a WorldScene.
 */
export class CartBalloon {
  private readonly box: Phaser.GameObjects.Container;
  private readonly bg: Phaser.GameObjects.Graphics;
  private readonly icon: Phaser.GameObjects.Image;
  private readonly label: Phaser.GameObjects.Text;
  private text = '';

  constructor(private readonly scene: Phaser.Scene) {
    this.bg = scene.add.graphics();
    this.icon = scene.add.image(0, 0, '__MISSING').setVisible(false);
    this.label = scene.add.text(0, 0, '', { fontFamily: 'Trebuchet MS, sans-serif', fontStyle: 'bold', fontSize: '9px', color: INK, resolution: 4 }).setOrigin(0, 0.5);
    this.box = scene.add.container(0, 0, [this.bg, this.icon, this.label]).setDepth(DEPTH).setVisible(false);
    // O ícone é o mesmo do HUD (imagem da interface): carrega na hora, se ainda não estiver no jogo.
    const useIcon = () => {
      this.icon.setTexture(ICON_KEY).setDisplaySize(ICON, ICON).setVisible(true);
      this.layout();
    };
    if (scene.textures.exists(ICON_KEY)) useIcon();
    else {
      scene.load.image(ICON_KEY, ICON_FILE);
      scene.load.once(Phaser.Loader.Events.COMPLETE, () => scene.textures.exists(ICON_KEY) && useIcon());
      scene.load.start();
    }
  }

  /** Em cima de (x, y) — o topo da cabeça, em pixels do mundo — com o texto, ou esconde (null). */
  show(at: { x: number; y: number; text: string } | null): void {
    this.box.setVisible(!!at);
    if (!at) return;
    if (at.text !== this.text) {
      this.text = at.text;
      this.label.setText(at.text);
      this.layout();
    }
    this.box.setPosition(Math.round(at.x), Math.round(at.y));
  }

  private layout(): void {
    const iconW = this.icon.visible ? ICON + 2 : 0;
    const w = PAD + iconW + Math.ceil(this.label.width) + PAD;
    const h = ICON + 4;
    const left = -Math.round(w / 2);
    const top = -h - 4;
    this.bg
      .clear()
      .fillStyle(0x3b2a32, 0.3)
      .fillRoundedRect(left, top + 1, w, h, 4)
      .fillStyle(0xe4f2e8, 0.97)
      .fillRoundedRect(left, top, w, h, 4)
      .lineStyle(1, 0x8a5a44, 1)
      .strokeRoundedRect(left, top, w, h, 4)
      .fillStyle(0x8a5a44, 1)
      .fillTriangle(-3, top + h, 3, top + h, 0, top + h + 3);
    this.icon.setPosition(left + PAD + ICON / 2, top + h / 2);
    this.label.setPosition(left + PAD + iconW, top + h / 2);
  }
}
