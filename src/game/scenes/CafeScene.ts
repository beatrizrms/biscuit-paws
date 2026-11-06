import Phaser from 'phaser';
import { resolveMap, solidRects, type Cell, type ResolvedMap } from '../../core/map';
import type { GameSession } from '../../core/session';
import { frameOf } from '../../core/tiles';
import { Player } from '../entities/Player';
import { isDebugOn } from '../debug';
import type { DebugPanel } from '../ui/DebugPanel';
import { GameUi } from '../ui/GameUi';
import { TEXTURE } from './BootScene';

type Keys = Record<'up' | 'down' | 'left' | 'right' | 'w' | 'a' | 's' | 'd', Phaser.Input.Keyboard.Key>;

const GHOST_OK = 0x9fd8b5;
const GHOST_BAD = 0xd9475d;
const GHOST_DEPTH = 100_000;
const NO_INPUT = { up: false, down: false, left: false, right: false };

/** O café: desenha o mapa da sessão, move a jogadora e cuida do modo de posicionar móveis. */
export class CafeScene extends Phaser.Scene {
  session!: GameSession;
  private isNew = false;
  ui!: GameUi;
  private player!: Player;
  private keys!: Keys;
  private mapImages?: Phaser.GameObjects.Group;
  private solids?: Phaser.Physics.Arcade.StaticGroup;
  private solidCollider?: Phaser.Physics.Arcade.Collider;
  private placing: { itemId: string; ghosts: Phaser.GameObjects.Image[]; at: Cell } | null = null;
  private debugPanel?: DebugPanel;
  map!: ResolvedMap;

  constructor() {
    super('Cafe');
  }

  init(data: { session: GameSession; isNew: boolean }): void {
    this.session = data.session;
    this.isNew = data.isNew;
  }

  create(): void {
    const uiRoot = document.getElementById('ui')!;
    this.ui = new GameUi(uiRoot, this.session, { onPlace: (id) => this.startPlacing(id) }, isDebugOn());

    this.buildMap();
    const ts = this.map.tileSize;
    const width = this.map.cols * ts;
    const height = this.map.rows * ts;
    this.physics.world.setBounds(0, 0, width, height);
    this.cameras.main.centerOn(width / 2, height / 2);

    const [col, row] = this.map.spawn;
    this.player = new Player(this, col * ts + ts / 2, (row + 1) * ts - 8);
    this.solidCollider = this.physics.add.collider(this.player, this.solids!);

    const K = Phaser.Input.Keyboard.KeyCodes;
    this.keys = this.input.keyboard!.addKeys({
      up: K.UP, down: K.DOWN, left: K.LEFT, right: K.RIGHT, w: K.W, a: K.A, s: K.S, d: K.D,
    }) as Keys;
    // Teclas de ação por evento: um toque rápido nunca se perde.
    this.input.keyboard!.on('keydown-C', () => {
      if (this.ui.isDialogueOpen()) return;
      this.cancelPlacing();
      this.ui.toggleCatalog();
    });
    this.input.keyboard!.on('keydown-ESC', () => {
      if (this.placing) this.cancelPlacing();
      else this.ui.closeCatalog();
    });
    this.input.mouse?.disableContextMenu();
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => this.moveGhost(p));
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => this.onPointerDown(p));

    this.session.bus.on('item.placed', () => this.buildMap());
    this.session.bus.on('item.picked_up', () => this.buildMap());
    this.session.bus.on('surface.painted', () => this.buildMap());

    if (import.meta.env.DEV) {
      exposeDebug(this);
      if (isDebugOn()) {
        void import('../debugTools').then((m) => (this.debugPanel = m.attachDebugTools(this, uiRoot)));
      }
    }
    this.session.start(this.isNew);
  }

  update(): void {
    const k = this.keys;

    this.player.move(
      this.ui.isBusy()
        ? NO_INPUT
        : {
            up: k.up.isDown || k.w.isDown,
            down: k.down.isDown || k.s.isDown,
            left: k.left.isDown || k.a.isDown,
            right: k.right.isDown || k.d.isDown,
          },
    );
    this.player.updateDepth();
    if (this.placing) this.refreshGhost();
  }

  /** (Re)desenha o mapa e a colisão a partir da sessão. Chamado quando um móvel muda. */
  private buildMap(): void {
    this.map = resolveMap(this.session.mapData(), this.session.content.catalog);
    const ts = this.map.tileSize;

    this.mapImages?.destroy(true);
    this.mapImages = this.add.group();
    for (const s of this.map.sprites) {
      this.mapImages.add(this.add.image(s.col * ts, s.row * ts, TEXTURE.tiles, s.frame).setOrigin(0).setDepth(s.depth));
    }

    this.solidCollider?.destroy();
    this.solids?.destroy(true);
    this.solids = this.physics.add.staticGroup();
    for (const r of solidRects(this.map.solid)) {
      const w = r.w * ts;
      const h = r.h * ts;
      this.solids.add(this.add.zone(r.col * ts + w / 2, r.row * ts + h / 2, w, h));
    }
    if (this.player) this.solidCollider = this.physics.add.collider(this.player, this.solids);
  }

  // ---------- Posicionar móveis ----------

  private startPlacing(itemId: string): void {
    this.cancelPlacing();
    const { catalog, items } = this.session.content;
    const def = catalog.tiles[items[itemId]!.tile]!;
    const ghosts: Phaser.GameObjects.Image[] = [];
    for (let dy = 0; dy < def.h; dy++) {
      for (let dx = 0; dx < def.w; dx++) {
        ghosts.push(
          this.add.image(0, 0, TEXTURE.tiles, frameOf(catalog, def, dx, dy)).setOrigin(0).setAlpha(0.8).setDepth(GHOST_DEPTH),
        );
      }
    }
    this.placing = { itemId, ghosts, at: [0, 0] };
    this.ui.setHint('placing');
    this.moveGhost(this.input.activePointer);
  }

  private cancelPlacing(): void {
    this.placing?.ghosts.forEach((g) => g.destroy());
    this.placing = null;
    this.ui.setHint('walk');
  }

  /** O cursor aponta para a célula da base (canto inferior esquerdo) da peça. */
  private moveGhost(pointer: Phaser.Input.Pointer): void {
    if (this.debugPanel) this.debugPanel.setCell(...this.cellAt(pointer));
    if (!this.placing) return;
    const [col, row] = this.cellAt(pointer);
    const def = this.ghostDef();
    this.placing.at = [col, row - (def.h - 1)];
    this.refreshGhost();
  }

  private refreshGhost(): void {
    if (!this.placing) return;
    const ts = this.map.tileSize;
    const def = this.ghostDef();
    const [c0, r0] = this.placing.at;
    const ok = this.session.checkPlacement(this.placing.itemId, this.placing.at, this.playerCells()) === null;
    this.placing.ghosts.forEach((g, i) => {
      g.setPosition((c0 + (i % def.w)) * ts, (r0 + Math.floor(i / def.w)) * ts).setTint(ok ? GHOST_OK : GHOST_BAD);
    });
  }

  private onPointerDown(pointer: Phaser.Input.Pointer): void {
    if (this.ui.isBusy()) return;
    if (this.placing) {
      if (pointer.rightButtonDown()) return this.cancelPlacing();
      this.moveGhost(pointer);
      const { itemId, at } = this.placing;
      const result = this.session.place(itemId, at, this.playerCells());
      if (!result.ok) return this.ui.problem(result.reason);
      this.cancelPlacing();
      return;
    }
    if (pointer.rightButtonDown()) {
      // Recolher um móvel e já pegá-lo na mão, para mudar de lugar.
      const placed = this.session.placedAt(this.cellAt(pointer));
      if (!placed) return;
      this.session.pickUp(placed.uid);
      this.startPlacing(placed.item);
    }
  }

  private ghostDef() {
    const { catalog, items } = this.session.content;
    return catalog.tiles[items[this.placing!.itemId]!.tile]!;
  }

  private cellAt(pointer: Phaser.Input.Pointer): Cell {
    const ts = this.map.tileSize;
    return [Math.floor(pointer.worldX / ts), Math.floor(pointer.worldY / ts)];
  }

  /** Células tocadas pelos pés da jogadora (nada sólido pode ser posto ali). */
  private playerCells(): Cell[] {
    const ts = this.map.tileSize;
    const b = this.player.body as Phaser.Physics.Arcade.Body;
    const cells: Cell[] = [];
    for (let r = Math.floor(b.top / ts); r <= Math.floor((b.bottom - 0.01) / ts); r++) {
      for (let c = Math.floor(b.left / ts); c <= Math.floor((b.right - 0.01) / ts); c++) cells.push([c, r]);
    }
    return cells;
  }

  // ---------- Para testes e depuração ----------

  playerState(): { x: number; y: number; depth: number } {
    return { x: this.player.x, y: this.player.y, depth: this.player.depth };
  }

  teleportPlayer(col: number, row: number): void {
    const ts = this.map.tileSize;
    (this.player.body as Phaser.Physics.Arcade.Body).reset(col * ts + ts / 2, (row + 1) * ts - 8);
    this.player.updateDepth();
  }

  sessionState() {
    return this.session.state;
  }
}

/** Em desenvolvimento, deixa a cena acessível no console e no Playwright. */
function exposeDebug(scene: CafeScene): void {
  (window as unknown as { __biscuitPaws: unknown }).__biscuitPaws = { cafe: scene };
}
