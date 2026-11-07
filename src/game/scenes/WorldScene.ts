import Phaser from 'phaser';
import { doorAt, resolveMap, solidRects, type Cell, type Facing, type MapDoor, type ResolvedMap } from '../../core/map';
import type { GameSession } from '../../core/session';
import { frameOf } from '../../core/tiles';
import { Player } from '../entities/Player';
import { CatSprite } from '../entities/Cat';
import { NpcSprite } from '../entities/Npc';
import { ScriptRunner, type ScriptStage } from '../ScriptRunner';
import { createRng, cellHash } from '../../core/rng';
import { isDebugOn } from '../debug';
import { GAME_HEIGHT, GAME_WIDTH } from '../screen';
import type { DebugPanel } from '../ui/DebugPanel';
import { GameUi } from '../ui/GameUi';
import { broom, uiText } from '../content';
import { DayNightLayer } from '../DayNightLayer';
import { formatClock, tintAt } from '../../core/time';

type Keys = Record<'up' | 'down' | 'left' | 'right' | 'w' | 'a' | 's' | 'd', Phaser.Input.Keyboard.Key>;

const GHOST_OK = 0x9fd8b5;
const GHOST_BAD = 0xd9475d;
const GHOST_DEPTH = 100_000;
const FADE_MS = 160;
/** Quantas vezes o relógio corre mais rápido ao "Esperar". */
const WAIT_SPEED = 40;
const NO_INPUT = { up: false, down: false, left: false, right: false };

/**
 * O mundo: desenha o mapa onde a personagem está (rua, café...), move a jogadora,
 * troca de mapa pelas portas e, dentro do café, cuida do modo de posicionar móveis.
 */
export class WorldScene extends Phaser.Scene implements ScriptStage {
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
  private changingMap = false;
  private dayNight!: DayNightLayer;
  /** Varrendo (a jogadora fica parada até terminar). */
  private sweeping = false;
  /** "Esperar": o relógio corre depressa até a meta de espera concluir. */
  private fastWait = false;
  private jobIcons: Phaser.GameObjects.Image[] = [];
  private lastDay: { reason: 'home' | 'passOut' | 'story'; earned: number; jobs: number } | null = null;
  private cats: CatSprite[] = [];
  private npcs = new Map<string, NpcSprite>();
  private scripts!: ScriptRunner;
  /** Esperas dos roteiros: resolvem quando a condição vale (conferido a cada quadro). */
  private waiters: { until: () => boolean; resolve: () => void }[] = [];
  /** Caminhada da jogadora guiada por roteiro. */
  private autoWalk: { x: number; y: number; resolve: () => void } | null = null;
  private catColliders: Phaser.Physics.Arcade.Collider[] = [];
  /** Depois de passar por uma porta, só usa outra quando a jogadora soltar a seta para cima (sem vai e vem). */
  private doorLocked = false;
  map!: ResolvedMap;

  constructor() {
    super('World');
  }

  init(data: { session: GameSession; isNew: boolean }): void {
    this.session = data.session;
    this.isNew = data.isNew;
  }

  create(): void {
    const uiRoot = document.getElementById('ui')!;
    this.ui = new GameUi(uiRoot, this.session, { onPlace: (id) => this.startPlacing(id), onWait: () => (this.fastWait = true) }, isDebugOn());

    this.player = new Player(this, 0, 0);
    this.dayNight = new DayNightLayer(this);
    this.scripts = new ScriptRunner(this.session, this);
    this.loadMap(this.session.location());

    const K = Phaser.Input.Keyboard.KeyCodes;
    this.keys = this.input.keyboard!.addKeys({
      up: K.UP, down: K.DOWN, left: K.LEFT, right: K.RIGHT, w: K.W, a: K.A, s: K.S, d: K.D,
      // Sem captura: senão W, A, S, D não dá para digitar na caixa de nome do gato.
    }, false) as Keys;
    // Teclas de ação por evento: um toque rápido nunca se perde.
    this.input.keyboard!.on('keydown-C', () => {
      if (this.ui.isDialogueOpen()) return;
      if (!this.session.atHome()) return this.ui.toastText('notHome');
      this.cancelPlacing();
      this.ui.toggleCatalog();
    });
    this.input.keyboard!.on('keydown-ESC', () => {
      if (this.placing) this.cancelPlacing();
      else {
        this.ui.closeCatalog();
        this.ui.closeShop();
      }
    });
    // E: interagir com o que estiver perto (o caixa do mercado...). E de novo fecha a loja.
    this.input.keyboard!.on('keydown-E', () => {
      if (this.ui.isShopOpen() || this.ui.isNewsOpen()) return this.ui.closeShop();
      if (this.ui.isBusy()) return;
      this.interact();
    });
    // P: o celular ("Vila Hoje"), depois do prólogo.
    this.input.keyboard!.on('keydown-P', () => {
      if (this.ui.isNewsOpen()) return this.ui.closeShop();
      if (this.ui.isBusy() || !this.session.state.flags['prologue.done']) return;
      this.ui.openNews('phone');
    });
    this.input.mouse?.disableContextMenu();
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => this.moveGhost(p));
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => this.onPointerDown(p));

    const rebuildIfHome = () => this.session.atHome() && this.buildMap();
    this.session.bus.on('item.placed', rebuildIfHome);
    this.session.bus.on('item.picked_up', rebuildIfHome);
    this.session.bus.on('surface.painted', rebuildIfHome);
    this.session.bus.on('dirt.cleaned', rebuildIfHome);
    // Pontos de pedido: marcadores (neve...) e o "!" em cima de cada ponto pendente.
    for (const ev of ['job.accepted', 'job.progress', 'job.completed'] as const) this.session.bus.on(ev, () => this.refreshJobPoints(true));
    this.session.bus.on('day.ended', (summary) => (this.lastDay = summary));
    this.session.bus.on('cat.sheltered', ({ catId }) => this.spawnCat(catId, this.feetCell()));
    this.session.bus.on('cat.affection_changed', ({ catId }) => this.floatHeart(catId));
    this.session.bus.on('cat.fed', ({ catId, bowlUid }) => {
      const bowl = this.session.state.placed.find((p) => p.uid === bowlUid);
      const cat = this.cats.find((c) => c.catId === catId);
      if (bowl && cat) cat.goEat([bowl.at[0], bowl.at[1] + 1], this.time.now);
    });
    // Fim do dia: ela vai para casa (transição) e amanhece chegando pela rua.
    // Ponto de extensão: com o quartinho (world.sleepMap), ela dorme no café em vez de ir para casa.
    this.session.bus.on('day.started', ({ day }) => {
      this.changingMap = true;
      const cam = this.cameras.main;
      cam.fadeOut(400, 27, 33, 64);
      cam.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, async () => {
        this.fastWait = false;
        await this.ui.showDayTransition(day, this.lastDay ?? undefined);
        this.loadMap(this.session.location(), this.session.morningSpawn(), 'down');
        cam.fadeIn(600, 27, 33, 64);
        this.changingMap = false;
        if (this.session.state.flags['prologue.done']) this.ui.toast(uiText.news.arrived);
      });
    });

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
    const busy = this.ui.isBusy() || this.changingMap || this.scripts.isRunning() || this.sweeping;
    if (this.fastWait && this.session.waitTarget() === undefined) this.fastWait = false;
    // O relógio para em falas, cenas, roteiros e transições; com o catálogo ou o celular abertos, o tempo corre.
    const clockPaused = this.ui.pausesClock() || this.changingMap || this.scripts.isRunning() || this.sweeping;
    if (!clockPaused) this.session.tickClock((this.game.loop.delta / 1000) * (this.fastWait ? WAIT_SPEED : 1));
    this.updateDayNight();
    const input = this.autoWalk
      ? this.autoWalkInput()
      : busy
      ? NO_INPUT
      : {
          up: k.up.isDown || k.w.isDown,
          down: k.down.isDown || k.s.isDown,
          left: k.left.isDown || k.a.isDown,
          right: k.right.isDown || k.d.isDown,
        };
    this.player.move(input);
    this.player.updateDepth();
    for (const cat of this.cats) cat.tick(this.time.now);
    this.fadeHudOverWorld();
    for (const w of this.waiters.filter((x) => x.until())) {
      this.waiters.splice(this.waiters.indexOf(w), 1);
      w.resolve();
    }
    if (this.placing) this.refreshGhost();

    // Direção em que ela está andando (uma só): as portas pedem uma direção (para cima, ou para baixo na saída do mercado).
    const moving = input.up && !input.down ? 'up' : input.down && !input.up ? 'down' : input.left && !input.right ? 'left' : input.right && !input.left ? 'right' : null;
    if (!moving && !this.changingMap) this.doorLocked = false;
    const door = doorAt(this.map, this.feetCell(), moving);
    if (door && !this.placing && !this.doorLocked && !this.scripts.isRunning()) {
      if (this.session.doorIntercept(door)) this.doorLocked = true; // a porta mostrou uma cena
      else if (this.session.canUseDoor(door) && this.session.content.world.goHomeDoors.includes(door.id) && this.session.canGoHome()) this.askGoHome(door);
      else if (this.session.canUseDoor(door)) this.useDoor(door);
      else {
        this.doorLocked = true; // avisa uma vez por aperto
        this.session.doorLocked(door);
      }
    }
  }

  // ---------- Mapas e portas ----------

  /** Mostra um mapa e põe a personagem em `spawn` (ou no ponto de partida do mapa). */
  private loadMap(mapId: string, spawn?: Cell, facing: Facing = 'down'): void {
    this.cancelPlacing();
    this.ui.closeCatalog();
    this.catColliders.forEach((c) => c.destroy());
    this.catColliders = [];
    this.cats.forEach((c) => c.destroy());
    this.cats = [];
    this.npcs.forEach((n) => n.destroy());
    this.npcs.clear();
    this.buildMap(mapId);
    const ts = this.map.tileSize;
    const width = this.map.cols * ts;
    const height = this.map.rows * ts;
    this.physics.world.setBounds(0, 0, width, height);

    this.dayNight.setLights(this.session.mapData(mapId).lights ?? [], this.map.tileSize);
    const cam = this.cameras.main;
    cam.setBackgroundColor(this.map.background ?? '#2b1d1a');
    cam.stopFollow();
    if (width <= GAME_WIDTH && height <= GAME_HEIGHT) {
      cam.removeBounds();
      cam.centerOn(width / 2, height / 2);
    } else {
      // Mapa maior que a tela: a câmera segue a personagem. Se sobrar largura, centraliza;
      // se sobrar altura, a sobra fica em cima (céu), nunca embaixo do chão.
      const bx = width < GAME_WIDTH ? (width - GAME_WIDTH) / 2 : 0;
      const by = height < GAME_HEIGHT ? height - GAME_HEIGHT : 0;
      cam.setBounds(bx, by, Math.max(width, GAME_WIDTH), Math.max(height, GAME_HEIGHT));
      cam.startFollow(this.player, true);
    }

    const [col, row] = spawn ?? this.map.spawn;
    this.placePlayer(col, row);
    this.player.face(facing);

    // Gatos que moram neste mapa.
    for (const catId of this.session.shelteredCats()) {
      if (this.session.state.cats[catId]!.map === mapId) this.spawnCat(catId);
    }
    this.refreshJobPoints();
  }

  /** Na porta do café, à tarde: encerrar o dia ou só sair para a rua. */
  private askGoHome(door: MapDoor): void {
    this.doorLocked = true;
    const t = uiText.goHome;
    void this.ui.confirm(t.question, t.yes, t.no).then((yes) => {
      if (yes) this.session.goHome();
      else this.useDoor(door);
    });
  }

  private useDoor(door: MapDoor): void {
    this.changingMap = true;
    this.doorLocked = true;
    const cam = this.cameras.main;
    cam.fadeOut(FADE_MS, 43, 29, 26);
    cam.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.session.enter(door.to);
      this.loadMap(door.to, door.spawn, door.facing);
      cam.fadeIn(FADE_MS, 43, 29, 26);
      this.changingMap = false;
    });
  }

  /** (Re)desenha o mapa e a colisão. Sem `mapId`, redesenha o mapa atual (ex.: um móvel mudou). */
  private buildMap(mapId = this.session.location()): void {
    this.map = resolveMap(this.session.mapData(mapId), this.session.content.catalog);
    const ts = this.map.tileSize;

    this.mapImages?.destroy(true);
    this.mapImages = this.add.group();
    for (const s of this.map.sprites) {
      this.mapImages.add(this.add.image(s.col * ts, s.row * ts, s.sheet, s.frame).setOrigin(0).setDepth(s.depth));
    }

    this.solidCollider?.destroy();
    this.solids?.destroy(true);
    this.solids = this.physics.add.staticGroup();
    for (const r of solidRects(this.map.solid)) {
      const w = r.w * ts;
      const h = r.h * ts;
      this.solids.add(this.add.zone(r.col * ts + w / 2, r.row * ts + h / 2, w, h));
    }
    this.solidCollider = this.physics.add.collider(this.player, this.solids);
    this.catColliders.forEach((c) => c.destroy());
    this.catColliders = this.cats.map((cat) => this.physics.add.collider(cat, this.solids!));
  }

  /** Põe um gato no mapa atual, perto de `near` (ou num lugar livre qualquer). */
  private spawnCat(catId: string, near?: Cell): void {
    const state = this.session.state.cats[catId];
    const def = this.session.content.cats[catId];
    if (!state || !def || state.map !== this.map.id) return;
    const rng = createRng(cellHash(catId.length, this.cats.length + 1) ^ 0x9e37);
    const [c, r] = this.freeCellNear(near ?? this.map.spawn, rng);
    const ts = this.map.tileSize;
    const cat = new CatSprite(this, catId, def.variant, c * ts + ts / 2, (r + 1) * ts - 6, rng, ts, () => this.map.solid);
    this.cats.push(cat);
    this.catColliders.push(this.physics.add.collider(cat, this.solids!));
  }

  private freeCellNear([c0, r0]: Cell, rng: { int(min: number, max: number): number }): Cell {
    for (let i = 0; i < 30; i++) {
      const c = c0 + rng.int(-2, 2);
      const r = r0 + rng.int(0, 2);
      if (this.map.solid[r]?.[c] === false) return [c, r];
    }
    return [c0, r0];
  }

  private placePlayer(col: number, row: number): void {
    const ts = this.map.tileSize;
    (this.player.body as Phaser.Physics.Arcade.Body).reset(col * ts + ts / 2, (row + 1) * ts - 8);
    this.player.updateDepth();
  }

  private feetCell(): Cell {
    const ts = this.map.tileSize;
    return [Math.floor(this.player.x / ts), Math.floor((this.player.y - 1) / ts)];
  }

  // ---------- Posicionar móveis (só dentro do café) ----------

  private startPlacing(itemId: string): void {
    this.cancelPlacing();
    const { catalog, items } = this.session.content;
    const def = catalog.tiles[items[itemId]!.tile ?? '']!;
    const ghosts: Phaser.GameObjects.Image[] = [];
    for (let dy = 0; dy < def.h; dy++) {
      for (let dx = 0; dx < def.w; dx++) {
        ghosts.push(
          this.add.image(0, 0, def.sheet, frameOf(catalog, def, dx, dy)).setOrigin(0).setAlpha(0.8).setDepth(GHOST_DEPTH),
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
    this.ui?.setHint('walk');
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
    if (!pointer.rightButtonDown() && !this.placing && this.interact(this.cellAt(pointer))) return;
    if (!this.session.atHome()) return;
    if (this.placing) {
      if (pointer.rightButtonDown()) return this.cancelPlacing();
      this.moveGhost(pointer);
      const { itemId, at } = this.placing;
      const result = this.session.place(itemId, at, this.playerCells());
      if (!result.ok) return this.ui.problem(result.reason);
      this.cancelPlacing();
      return;
    }
    if (!pointer.rightButtonDown()) {
      // Clique: limpar a sujeira (de perto).
      const dirt = this.session.dirtAt(this.cellAt(pointer));
      if (!dirt || this.sweeping) return;
      const problem = this.session.cleanProblem(dirt.id, this.playerCells());
      if (problem) return this.ui.problem(problem);
      void this.sweep(dirt.id, pointer.worldX, pointer.worldY);
      return;
    }
    {
      // Botão direito: recolher um móvel e já pegá-lo na mão, para mudar de lugar.
      const placed = this.session.placedAt(this.cellAt(pointer));
      if (!placed) return;
      this.session.pickUp(placed.uid);
      this.startPlacing(placed.item);
    }
  }

  /** Pontos do mundo que não podem ficar escondidos pelo HUD: o mouse e a personagem (cabeça e pés). */
  private fadeHudOverWorld(): void {
    const rect = this.game.canvas.getBoundingClientRect();
    const zoom = rect.width / GAME_WIDTH;
    const view = this.cameras.main.worldView;
    const toClient = (x: number, y: number) => ({ x: rect.left + (x - view.x) * zoom, y: rect.top + (y - view.y) * zoom });
    const p = this.input.activePointer;
    const points = [toClient(this.player.x, this.player.y - 56), toClient(this.player.x, this.player.y)];
    if (p.event) points.push(toClient(p.worldX, p.worldY));
    this.ui.updateHudFade(points);
  }

  /** Cor do momento sobre o mundo e relógio no HUD. */
  private updateDayNight(): void {
    const data = this.session.mapData(this.map.id);
    const t = this.session.state.time;
    this.dayNight.update(tintAt(t, this.session.content.dayNight, this.session.content.world.season, data.lighting === 'indoor'));
    this.ui.setClock(formatClock(t));
  }

  /** Interage com o que estiver ao alcance (ou só com a célula clicada). Devolve se fez algo. */
  private interact(target?: Cell): boolean {
    const point = this.session.jobPointNear(this.playerCells(), target);
    if (point) {
      if (point.action === 'sweep') {
        if (this.sweeping) return true;
        const ts = this.map.tileSize;
        void this.playSweep((point.at[0] + 0.5) * ts, (point.at[1] + 0.5) * ts).then(() => this.doJobPoint(point.id));
      } else this.doJobPoint(point.id);
      return true;
    }
    const it = this.session.interactionAt(this.playerCells(), target);
    if (it) {
      if ('shop' in it.action) this.ui.openShop(it.action.shop);
      else this.ui.openNews('board');
      return true;
    }
    // Tigela de ração por perto: enche e o gato vem comer.
    const bowl = this.session.bowlNear(this.playerCells(), target);
    if (!bowl) return false;
    const result = this.session.feedFromBowl(bowl);
    if (!result.ok) this.ui.problem(result.reason);
    return true;
  }

  /** Coraçãozinho que sobe e some em cima do gato. */
  private floatHeart(catId: string): void {
    const cat = this.cats.find((c) => c.catId === catId);
    if (!cat) return;
    const heart = this.add
      .text(cat.x, cat.y - 30, '♥', { fontFamily: 'Trebuchet MS, sans-serif', fontSize: '16px', color: '#d97890' })
      .setOrigin(0.5)
      .setDepth(100_000);
    this.tweens.add({ targets: heart, y: heart.y - 18, alpha: 0, duration: 1200, ease: 'Quad.easeOut', onComplete: () => heart.destroy() });
  }

  /** Varre: vassoura na mão balançando, poeira subindo, brilho no fim; aí a sujeira some. */
  private async sweep(dirtId: string, x: number, y: number): Promise<void> {
    await this.playSweep(x, y);
    const result = this.session.clean(dirtId, this.playerCells());
    if (!result.ok) this.ui.problem(result.reason);
  }

  private doJobPoint(pointId: string): void {
    const result = this.session.doJobPoint(pointId);
    if (!result.ok) this.ui.problem(result.reason);
  }

  /** Pontos de pedido pendentes neste mapa: marcadores (redesenha o mapa) e um "!" em cima dos sem marcador. */
  private refreshJobPoints(rebuild = false): void {
    if (rebuild) this.buildMap();
    this.jobIcons.forEach((i) => i.destroy());
    const ts = this.map.tileSize;
    this.jobIcons = this.session
      .pendingJobPoints()
      .filter((p) => !p.marker)
      .map((p) => {
        const icon = this.add.image((p.at[0] + 0.5) * ts, p.at[1] * ts - 2, 'emotes', 'exclamation').setOrigin(0.5, 1).setDepth(99_000);
        this.tweens.add({ targets: icon, y: icon.y - 3, duration: 600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
        return icon;
      });
  }

  /** Animação de varrer (vassoura, poeira, brilho), sem mudar nada no jogo. */
  private async playSweep(x: number, y: number): Promise<void> {
    this.sweeping = true;
    const left = x < this.player.x;
    this.player.face(left ? 'left' : 'right');
    // O quadro cobre a metade de baixo da personagem (mão no meio do corpo, cerdas no chão).
    const tool = this.add
      .image(this.player.x, this.player.y, 'broom', 'varrer_1')
      .setOrigin(0.5, 1)
      .setFlipX(left)
      .setDepth(this.player.depth + 1);
    const dust = this.add.image(x, y, 'broom', 'poeira_1').setDepth(100_000);
    const frameMs = 1000 / broom.sweepFps;
    for (let t = 0, i = 0; t < broom.sweepMs; t += frameMs, i++) {
      tool.setFrame(i % 2 === 0 ? 'varrer_1' : 'varrer_2');
      dust.setFrame(`poeira_${(i % 3) + 1}`);
      await this.wait(frameMs);
    }
    tool.destroy();
    for (const f of ['brilho_1', 'brilho_2', 'brilho_3']) {
      dust.setFrame(f);
      await this.wait(90);
    }
    dust.destroy();
    this.sweeping = false;
  }

  private ghostDef() {
    const { catalog, items } = this.session.content;
    return catalog.tiles[items[this.placing!.itemId]!.tile ?? '']!;
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

  // ---------- Roteiros (ScriptStage) ----------

  spawnNpc(npcId: string, [c, r]: Cell, facing: Facing = 'down'): void {
    const def = this.session.content.npcs[npcId];
    if (!def) return;
    this.npcs.get(npcId)?.destroy();
    const ts = this.map.tileSize;
    const npc = new NpcSprite(this, def, c * ts + ts / 2, (r + 1) * ts - 4, ts);
    npc.face(facing);
    this.npcs.set(npcId, npc);
  }

  async npcWalk(npcId: string, to: Cell): Promise<void> {
    await this.npcs.get(npcId)?.walkTo(to);
  }

  async npcAct(npcId: string, anim: string, ms: number): Promise<void> {
    await this.npcs.get(npcId)?.act(anim, ms);
  }

  npcFace(npcId: string, facing: Facing): void {
    this.npcs.get(npcId)?.face(facing);
  }

  async npcLeave(npcId: string): Promise<void> {
    const npc = this.npcs.get(npcId);
    this.npcs.delete(npcId);
    await npc?.leave();
  }

  playerWalk([c, r]: Cell): Promise<void> {
    const ts = this.map.tileSize;
    return new Promise((resolve) => (this.autoWalk = { x: c * ts + ts / 2, y: (r + 1) * ts - 8, resolve }));
  }

  playerFace(facing: Facing): void {
    this.player.face(facing);
  }

  enter(mapId: string, spawn: Cell, facing: Facing, npcs: { npc: string; at: Cell; facing?: Facing }[]): Promise<void> {
    return new Promise((resolve) => {
      const cam = this.cameras.main;
      cam.fadeOut(FADE_MS * 2, 43, 29, 26);
      cam.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
        this.session.enter(mapId);
        this.loadMap(mapId, spawn, facing);
        npcs.forEach((n) => this.spawnNpc(n.npc, n.at, n.facing));
        cam.fadeIn(FADE_MS * 2, 43, 29, 26);
        cam.once(Phaser.Cameras.Scene2D.Events.FADE_IN_COMPLETE, () => resolve());
      });
    });
  }

  showItem(itemId: string): Promise<void> {
    return this.ui.showItem(itemId);
  }

  untilIdle(): Promise<void> {
    return new Promise((resolve) => this.waiters.push({ until: () => !this.ui.isBusy() && !this.changingMap, resolve }));
  }

  wait(ms: number): Promise<void> {
    return new Promise((resolve) => this.time.delayedCall(ms, resolve));
  }

  /** O gato vem até a célula e senta (desiste depois de alguns segundos, se algo bloquear). */
  async catWalk(catId: string, [c, r]: Cell): Promise<void> {
    const cat = this.cats.find((x) => x.catId === catId);
    if (!cat) return;
    cat.goEat([c, r], this.time.now);
    for (let t = 0; t < 5000; t += 100) {
      const [cc, cr] = cat.cell();
      if (cc === c && cr === r) break;
      await this.wait(100);
    }
  }

  /** O NPC vai até o lado do gato (o lado livre mais perto) e fica de frente para ele. */
  async npcToCat(npcId: string, catId: string): Promise<void> {
    const npc = this.npcs.get(npcId);
    const cat = this.cats.find((c) => c.catId === catId);
    if (!npc || !cat) return;
    cat.stay(9000, this.time.now);
    const [cc, cr] = cat.cell();
    const solid = this.map.solid;
    const free = ([c, r]: Cell) => r >= 0 && c >= 0 && r < solid.length && c < solid[0]!.length && !solid[r]![c];
    const ts = this.map.tileSize;
    const options: { cell: Cell; face: Facing }[] = [
      { cell: [cc - 1, cr], face: 'right' },
      { cell: [cc + 1, cr], face: 'left' },
      { cell: [cc, cr + 1], face: 'up' },
      { cell: [cc, cr - 1], face: 'down' },
    ];
    const pick = options
      .filter((o) => free(o.cell))
      .sort((a, b) => Math.hypot(a.cell[0] * ts - npc.x, a.cell[1] * ts - npc.y) - Math.hypot(b.cell[0] * ts - npc.x, b.cell[1] * ts - npc.y))[0];
    if (!pick) return;
    await npc.walkTo(pick.cell);
    npc.face(pick.face);
    cat.setFlipX(pick.face === 'left');
  }

  /** Balão de emoção que sobe um pouco em cima de alguém ("player", NPC ou gato). */
  emote(who: string, balloon: string, ms: number): Promise<void> {
    const target: { x: number; y: number; top: number } | undefined =
      who === 'player'
        ? { x: this.player.x, y: this.player.y, top: 60 }
        : this.npcs.has(who)
          ? { x: this.npcs.get(who)!.x, y: this.npcs.get(who)!.y, top: this.npcs.get(who)!.def.frameHeight - 2 }
          : (() => {
              const cat = this.cats.find((c) => c.catId === who);
              return cat ? { x: cat.x, y: cat.y, top: 26 } : undefined;
            })();
    if (!target) return Promise.resolve();
    const icon = this.add.image(target.x + 6, target.y - target.top, 'emotes', balloon).setOrigin(0.5, 1).setDepth(100_000);
    this.tweens.add({ targets: icon, y: icon.y - 4, duration: 300, ease: 'Quad.easeOut' });
    return new Promise((resolve) =>
      this.time.delayedCall(ms, () => {
        this.tweens.add({ targets: icon, alpha: 0, duration: 200, onComplete: () => (icon.destroy(), resolve()) });
      }),
    );
  }

  /** Teclas "falsas" que levam a jogadora até o alvo do roteiro (primeiro na horizontal). */
  private autoWalkInput(): { up: boolean; down: boolean; left: boolean; right: boolean } {
    const t = this.autoWalk!;
    const dx = t.x - this.player.x;
    const dy = t.y - this.player.y;
    if (Math.abs(dx) <= 1.5 && Math.abs(dy) <= 1.5) {
      (this.player.body as Phaser.Physics.Arcade.Body).reset(t.x, t.y);
      this.autoWalk = null;
      t.resolve();
      return NO_INPUT;
    }
    if (Math.abs(dx) > 1.5) return { up: false, down: false, left: dx < 0, right: dx > 0 };
    return { up: dy < 0, down: dy > 0, left: false, right: false };
  }

  // ---------- Para testes e depuração ----------

  isScriptRunning(): boolean {
    return this.scripts.isRunning();
  }


  playerState(): { x: number; y: number; depth: number; map: string } {
    return { x: this.player.x, y: this.player.y, depth: this.player.depth, map: this.map.id };
  }

  teleportPlayer(col: number, row: number): void {
    this.placePlayer(col, row);
  }

  /** Vai direto para um mapa (como se tivesse passado pela porta). */
  goTo(mapId: string, spawn?: Cell): void {
    this.session.enter(mapId);
    this.loadMap(mapId, spawn);
  }

  /** Para testes: confirma a caixa de nome. */
  confirmNaming(): void {
    this.ui.confirmNaming();
  }

  catCount(): number {
    return this.cats.length;
  }

  sessionState() {
    return this.session.state;
  }
}

/** Em desenvolvimento, deixa a cena acessível no console e no Playwright. */
function exposeDebug(scene: WorldScene): void {
  (window as unknown as { __biscuitPaws: unknown }).__biscuitPaws = { world: scene, cafe: scene };
}
