import Phaser from 'phaser';
import tilesJson from '../../../data/tiles.json';
import cafeJson from '../../../data/maps/cafe_main.json';
import { resolveMap, solidRects, type MapData, type ResolvedMap } from '../../core/map';
import type { TileCatalog } from '../../core/tiles';
import { Player } from '../entities/Player';
import { TEXTURE } from './BootScene';

type Keys = Record<'up' | 'down' | 'left' | 'right' | 'w' | 'a' | 's' | 'd', Phaser.Input.Keyboard.Key>;

/** O café: desenha o mapa e cuida da jogadora. As regras vêm do core. */
export class CafeScene extends Phaser.Scene {
  private player!: Player;
  private keys!: Keys;
  map!: ResolvedMap;

  constructor() {
    super('Cafe');
  }

  create(): void {
    this.map = resolveMap(cafeJson as unknown as MapData, tilesJson as TileCatalog);
    const ts = this.map.tileSize;
    const width = this.map.cols * ts;
    const height = this.map.rows * ts;

    for (const s of this.map.sprites) {
      this.add.image(s.col * ts, s.row * ts, TEXTURE.tiles, s.frame).setOrigin(0).setDepth(s.depth);
    }

    const solids = this.physics.add.staticGroup();
    for (const r of solidRects(this.map.solid)) {
      const w = r.w * ts;
      const h = r.h * ts;
      solids.add(this.add.zone(r.col * ts + w / 2, r.row * ts + h / 2, w, h));
    }
    this.physics.world.setBounds(0, 0, width, height);

    const [col, row] = this.map.spawn;
    this.player = new Player(this, col * ts + ts / 2, (row + 1) * ts - 8);
    this.physics.add.collider(this.player, solids);

    this.cameras.main.centerOn(width / 2, height / 2);

    const K = Phaser.Input.Keyboard.KeyCodes;
    this.keys = this.input.keyboard!.addKeys({
      up: K.UP, down: K.DOWN, left: K.LEFT, right: K.RIGHT, w: K.W, a: K.A, s: K.S, d: K.D,
    }) as Keys;

    if (import.meta.env.DEV) exposeDebug(this);
  }

  update(): void {
    const k = this.keys;
    this.player.move({
      up: k.up.isDown || k.w.isDown,
      down: k.down.isDown || k.s.isDown,
      left: k.left.isDown || k.a.isDown,
      right: k.right.isDown || k.d.isDown,
    });
    this.player.updateDepth();
  }

  /** Para testes e depuração: posição dos pés e profundidade. */
  playerState(): { x: number; y: number; depth: number } {
    return { x: this.player.x, y: this.player.y, depth: this.player.depth };
  }

  /** Só para testes: coloca a jogadora numa célula (pés perto da base da célula). */
  teleportPlayer(col: number, row: number): void {
    const ts = this.map.tileSize;
    (this.player.body as Phaser.Physics.Arcade.Body).reset(col * ts + ts / 2, (row + 1) * ts - 8);
    this.player.updateDepth();
  }
}

/** Em desenvolvimento, deixa a cena acessível no console e no Playwright. */
function exposeDebug(scene: CafeScene): void {
  (window as unknown as { __biscuitPaws: unknown }).__biscuitPaws = { cafe: scene };
}
