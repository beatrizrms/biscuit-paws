import Phaser from 'phaser';
import { doorAt, resolveMap, solidRects, ySortDepth, type Cell, type Facing, type MapDoor, type MapInteraction, type ResolvedMap } from '../../core/map';
import { HOTBAR_SIZE } from '../../core/hotbar';
import { nowAbs } from '../../core/state';
import type { GameSession } from '../../core/session';
import { frameOf } from '../../core/tiles';
import { Player } from '../entities/Player';
import { CatSprite, catTexture } from '../entities/Cat';
import { NpcSprite } from '../entities/Npc';
import { CustomerSprite } from '../entities/Customer';
import { iconFrame } from '../icons';
import { addTileImage, tileScale } from '../tileArt';
import { MiniGameRegistry } from '../minigames/MiniGameRegistry';
import { actorsOf } from '../../core/arrivalModels';
import type { MiniGameParams, MiniGameResult } from '../../core/minigame';
import tilesetsJson from '../../../data/tilesets.json';
import type { HandItem } from '../../core/carry';
import { ScriptRunner, type ScriptStage } from '../ScriptRunner';
import { createRng, cellHash } from '../../core/rng';
import { isDebugOn } from '../debug';
import { GAME_HEIGHT, GAME_WIDTH, setupCamera } from '../screen';
import type { DebugPanel } from '../ui/DebugPanel';
import { GameUi } from '../ui/GameUi';
import { broom, itemUse, serviceArt, uiText } from '../content';
import { DayNightLayer } from '../DayNightLayer';
import type { ManualSlot } from '../../core/saveSlots';
import { services } from '../services';
import { saveNow } from '../startGame';
import { openPause } from '../ui/menu/PauseMenu';
import { t } from '../i18n';
import { darkness, formatClock, tintAt } from '../../core/time';
import { ambienceOf } from '../../core/ambience';
import { AmbienceLayer, type AmbienceActor } from '../AmbienceLayer';
import type { Pose } from '../../core/appearance';
import { poseTexture } from '../playerLook';
import { RoomView } from '../rooms/RoomView';
import { SoundEvents } from '../audio/SoundEvents';
import { InteractHint } from '../InteractHint';
import { PLACED_PREFIX } from '../../core/placement';
import { CareBubbles } from '../careBubbles';
import type { CareNeed } from '../../core/care';
import { runFactor } from '../../core/movement';
import playerJson from '../../../data/player.json';

/** Caixa de entrega: escala na pilha (0,5 = 32 px como a antiga) e nas mãos, e o passo da pilha. */
const PARCEL_PILE_SCALE = 0.5;
const PARCEL_PILE_STEP = 12;
const PARCEL_HAND_SCALE = 0.36;
const PARCEL_HAND_STEP = 9;
/** Ajuste da caixa em relação ao ponto da mão (negativo = mais para cima): na altura dos braços, no peito. */
const PARCEL_HAND_DROP = -2;

const playerRun = playerJson.run;

/** Tipos de coisa da dica "E" (os textos ficam em ui_text.json: hints). */
type HintKind = keyof typeof uiText.hints;

type Keys = Record<'up' | 'down' | 'left' | 'right' | 'w' | 'a' | 's' | 'd' | 'run', Phaser.Input.Keyboard.Key>;

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
/** Chegada pegadas: o gato escondido aparece quando ela chega a tantas células. */
const ARRIVAL_REVEAL_CELLS = 2.5;
/** Chegada gato_leva: o guia espera se ela ficar mais longe que isto (células) e anda a esta velocidade (px/s). */
const ARRIVAL_GUIDE_WAIT_CELLS = 3;
const ARRIVAL_GUIDE_SPEED = 55;

export class WorldScene extends Phaser.Scene implements ScriptStage {
  session!: GameSession;
  private isNew = false;
  /** Slot manual desta partida (o autosave lembra dele). */
  private slot: ManualSlot = 'slot1';
  ui!: GameUi;
  private player!: Player;
  private keys!: Keys;
  private mapImages?: Phaser.GameObjects.Group;
  private solids?: Phaser.Physics.Arcade.StaticGroup;
  private solidCollider?: Phaser.Physics.Arcade.Collider;
  /**
   * Posicionando: um item da mochila, ou (moveUid) um móvel do café mudando de lugar, com o que está em cima dele
   * (riders: fantasmas que acompanham, já na altura do tampo).
   */
  private placing: { itemId: string; ghosts: Phaser.GameObjects.Image[]; at: Cell; moveUid?: string; riders?: { ghosts: Phaser.GameObjects.Image[]; w: number; lift: number }[] } | null = null;
  /** Imagens do mapa por objeto (id): o móvel sendo mudado de lugar fica esmaecido no lugar de origem. */
  private objectImages = new Map<string, Phaser.GameObjects.Image[]>();
  private debugPanel?: DebugPanel;
  private changingMap = false;
  private dayNight!: DayNightLayer;
  /** Cômodos do café: escuro, destaque, câmera, luz de fora. */
  private roomView: RoomView | null = null;
  /** Sons ligados aos eventos e ao lugar. */
  private sounds: SoundEvents | null = null;
  /** Varrendo (a jogadora fica parada até terminar). */
  private sweeping = false;
  /** Um mini game está aberto (o mundo está pausado embaixo). */
  private miniGameOpen = false;
  /** Tocando a animação de usar um item da barra (ração na tigela, petisco no gato). */
  private usingItem = false;
  /** "Esperar": o relógio corre depressa até a meta de espera concluir. */
  /** "Esperar": o relógio corre depressa até este momento absoluto. */
  private waitUntilAbs: number | null = null;
  /** Dica "E" em cima do que dá para usar agora. */
  private hint!: InteractHint;
  private hintCheckedAt = 0;
  /** Balão de cuidado em cima de cada gato (remédio, banho, carinho); o que falta é relido 2 vezes por segundo. */
  private careBubbles!: CareBubbles;
  /** Luz e sombra de ambiente (sombras de contato, parede com piso, luz das janelas, vinheta). */
  private ambience!: AmbienceLayer;
  private careNeeds = new Map<string, CareNeed | null>();
  private careCheckedAt = -Infinity;
  private parcelImages: Phaser.GameObjects.Image[] = [];
  private surfaceIcons: Phaser.GameObjects.Image[] = [];
  private handIcons: Phaser.GameObjects.Image[] = [];
  private handsKey = '';
  private carriedCatSprite: Phaser.GameObjects.Sprite | null = null;
  private sinkSprite: Phaser.GameObjects.Sprite | null = null;
  private sinkBar: Phaser.GameObjects.Image | null = null;
  private sinkCleanUntil = 0;
  private equipAnims = new Map<string, Phaser.GameObjects.Sprite>();
  private progressBars = new Map<string, Phaser.GameObjects.Image>();
  private customerViews = new Map<string, CustomerSprite>();
  private customersFresh = true;
  private carriedImages: Phaser.GameObjects.Image[] = [];
  /** Caixas que chegaram e ainda não foram deixadas pela entregadora (animação na rua). */
  private arriving = 0;
  private vanQueue: string[] = [];
  private vanBusy = false;
  private vanObjects: Phaser.GameObjects.GameObject[] = [];
  private jobIcons: Phaser.GameObjects.Image[] = [];
  /** Gato (e vizinho) da chegada esperando no mapa. */
  private arrivalActors: Phaser.GameObjects.GameObject[] = [];
  /** pegadas: o gato escondido (só aparece de perto) e quantas pegadas estão desenhadas (a neve cobre com o tempo). */
  private arrivalHidden: Phaser.GameObjects.Sprite | null = null;
  private arrivalTrailKey: number | null = null;
  /** Gato carteiro: onde ele está desenhado ('' = fora do horário). */
  private arrivalFeedKey = '';
  /** gato_leva: o gato do café que guia e a próxima célula do caminho. */
  private arrivalGuide: { sprite: Phaser.GameObjects.Sprite; next: number; variant: string } | null = null;
  private lastDay: { reason: 'home' | 'passOut' | 'story' | 'sleep'; earned: number; jobs: number } | null = null;
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

  init(data: { session: GameSession; isNew: boolean; slot: ManualSlot }): void {
    this.session = data.session;
    this.isNew = data.isNew;
    this.slot = data.slot;
  }

  create(): void {
    setupCamera(this);
    const uiRoot = document.getElementById('ui')!;
    this.ui = new GameUi(uiRoot, this.session, { onPlace: (id) => this.startPlacing(id), onWait: (until) => (this.waitUntilAbs = until) }, isDebugOn());

    this.player = new Player(this, 0, 0);
    this.dayNight = new DayNightLayer(this);
    this.scripts = new ScriptRunner(this.session, this);
    this.hint = new InteractHint(this);
    this.careBubbles = new CareBubbles(this, this.session.content.health.care);
    this.ambience = new AmbienceLayer(this, this.session.content.dayNight.ambience);
    this.loadMap(this.session.location());

    const K = Phaser.Input.Keyboard.KeyCodes;
    this.keys = this.input.keyboard!.addKeys({
      up: K.UP, down: K.DOWN, left: K.LEFT, right: K.RIGHT, w: K.W, a: K.A, s: K.S, d: K.D, run: K.R,
      // Sem captura: senão W, A, S, D não dá para digitar na caixa de nome do gato.
    }, false) as Keys;
    // Teclas de ação por evento: um toque rápido nunca se perde.
    // C: o Market do celular (compra online: funciona em qualquer lugar; posicionar só dentro do café).
    this.onKey('C', () => {
      if (this.ui.isDialogueOpen()) return;
      this.cancelPlacing();
      this.ui.toggleCatalog();
    });
    // Q: mudando um móvel de lugar, guarda na mochila.
    this.onKey('Q', () => this.storeMoving());
    this.onKey('ESC', () => {
      if (this.placing) this.cancelPlacing();
      else if (this.ui.isCatalogOpen() || this.ui.isPanelOpen()) {
        this.ui.closeCatalog();
        this.ui.closeShop();
      } else if (!this.ui.isBusy() && !this.changingMap && !this.scripts.isRunning()) this.openPause();
    });
    // E: interagir com o que estiver perto (o caixa do mercado...). E de novo fecha a loja.
    this.onKey('E', () => {
      if (this.ui.isPanelOpen()) return this.ui.closeShop();
      if (this.ui.isBusy()) return;
      const kind = this.eTarget()?.kind;
      if (this.interact() && kind) this.session.noteHintUse(kind);
    });
    // P: o celular ("Vila Hoje"), depois do prólogo.
    // M: quadro do cardápio; I: mochila (no café ou em qualquer lugar, depois do prólogo).
    this.onKey('M', () => {
      if (this.ui.isBusy()) return this.ui.isPanelOpen() && this.ui.closeShop();
      if (!this.session.atHome()) return this.ui.toastText('notHome');
      this.ui.openMenuBoard();
    });
    this.onKey('I', () => {
      if (this.ui.isBusy()) return this.ui.isPanelOpen() && this.ui.closeShop();
      this.ui.openBackpack();
    });
    this.onKey('P', () => {
      if (this.ui.isNewsOpen()) return this.ui.closeShop();
      if (this.ui.isBusy() || !this.session.state.flags['prologue.done']) return;
      this.ui.openNews('phone');
    });
    // Barra de itens: 1 a 8 escolhem o espaço (também com a mochila aberta); a roda do mouse passa de um em um.
    this.input.keyboard!.on('keydown', (e: KeyboardEvent) => {
      const n = Number(e.key);
      if (!Number.isInteger(n) || n < 1 || n > HOTBAR_SIZE) return;
      if (this.ui.isBusy() && !this.ui.isPanelOpen()) return;
      if (this.ui.backpackNumberKey(n)) return;
      this.session.selectHotbarSlot(n - 1);
    });
    this.input.on('wheel', (_p: Phaser.Input.Pointer, _o: unknown, _dx: number, dy: number) => {
      if (this.ui.isBusy() || this.placing || dy === 0) return;
      const { active } = this.session.state.hotbar;
      this.session.selectHotbarSlot((active + (dy > 0 ? 1 : -1) + HOTBAR_SIZE) % HOTBAR_SIZE);
    });
    this.input.mouse?.disableContextMenu();
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => this.moveGhost(p));
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => this.onPointerDown(p));

    const rebuildIfHome = () => this.session.atHome() && this.buildMap();
    this.session.bus.on('item.placed', rebuildIfHome);
    this.session.bus.on('item.picked_up', rebuildIfHome);
    this.session.bus.on('item.moved', rebuildIfHome);
    this.session.bus.on('surface.painted', rebuildIfHome);
    this.session.bus.on('dirt.cleaned', rebuildIfHome);
    // Cômodos: o mapa, a câmera (só o que ela conhece) e a luz do quintal mudam; descobrir tem um momento.
    for (const ev of ['room.opened', 'room.restored'] as const) this.session.bus.on(ev, () => this.session.atHome() && this.refreshRooms());
    this.session.bus.on('room.discovered', ({ trigger, highlight }) => {
      if (!this.session.atHome()) return;
      this.refreshRooms();
      if (highlight) void this.discoveryMoment(highlight, trigger);
    });
    this.session.bus.on('item.received', ({ itemId }) => {
      // A chave achada na sujeira: destaca a porta que ela abre.
      const door = this.session.content.rooms.doors.find((d) => d.requires?.item === itemId);
      if (door && this.session.atHome()) this.roomView?.highlight(door.at);
    });
    // Pontos de pedido: marcadores (neve...) e o "!" em cima de cada ponto pendente.
    for (const ev of ['arrival.started', 'arrival.step', 'arrival.needs', 'arrival.need_met', 'arrival.finished', 'job.accepted', 'job.progress', 'job.completed', 'festival.started', 'festival.scheduled', 'festival.progress', 'festival.finished', 'festival.missed'] as const) this.session.bus.on(ev, () => this.refreshJobPoints(true));
    this.session.bus.on('day.ended', (summary) => (this.lastDay = summary));
    // Correio: o furgão chega se ela estiver na rua; senão, só o aviso.
    this.session.bus.on('delivery.arrived', ({ deliveryId }) => {
      if (this.session.location() === this.session.content.delivery.door.map) {
        this.arriving++;
        this.vanQueue.push(deliveryId);
        void this.playVan();
      } else this.ui.toast(uiText.delivery.arrivedAway);
    });
    for (const ev of ['delivery.ordered', 'delivery.picked_up', 'delivery.unpacked'] as const) this.session.bus.on(ev, () => this.refreshParcels());
    for (const ev of ['hands.changed', 'prep.ready', 'prep.started', 'customer.left', 'customer.served', 'dish.washed'] as const) this.session.bus.on(ev, () => this.refreshSurfaces());
    this.session.bus.on('dish.washed', () => (this.sinkCleanUntil = this.time.now + 1500));
    this.session.bus.on('customer.served', ({ customerId, price, tip }) => {
      const view = this.customerViews.get(customerId);
      if (!view) return;
      const x = view.sprite.x;
      const y = view.sprite.y - 66;
      const coin = this.add.image(x - 8, y, 'coin16').setDepth(99_600);
      const label = this.add.text(x + 2, y, `+${price + tip}`, { fontFamily: 'Trebuchet MS, sans-serif', fontSize: '10px', color: '#7a4f1c', stroke: '#fff4e0', strokeThickness: 3 }).setOrigin(0, 0.5).setDepth(99_600);
      this.tweens.add({ targets: [coin, label], y: y - 16, alpha: 0, delay: 500, duration: 900, onComplete: () => (coin.destroy(), label.destroy()) });
    });
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
        this.waitUntilAbs = null;
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
    // Som: eventos -> efeitos e jingles; música e ambiente do lugar (dia/noite) a cada quadro (data/audio.json).
    this.sounds = new SoundEvents(this.session, services().audio);
    this.session.start(this.isNew);
  }

  /** Pausa: Continuar, Opções, Salvar, Voltar ao menu (salva antes). */
  private openPause(): void {
    this.ui.paused = true;
    openPause(document.getElementById('ui')!, {
      save: async () => {
        await saveNow(this.session, this.slot);
        return t(`slot.${this.slot}`);
      },
      toMenu: async () => {
        await saveNow(this.session, this.slot);
        services().audio.fadeOutAll();
        this.cameras.main.fadeOut(400, 27, 33, 64);
        // Recarrega sem os atalhos da URL: volta à Home com tudo limpo.
        this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => (window.location.href = window.location.pathname));
      },
      onClose: () => (this.ui.paused = false),
    });
  }

  update(): void {
    this.sounds?.update();
    this.updateArrivalActors(this.game.loop.delta);
    const k = this.keys;
    const busy = this.ui.isBusy() || this.changingMap || this.scripts.isRunning() || this.sweeping || this.usingItem || this.player.isActing();
    if (this.waitUntilAbs !== null && nowAbs(this.session.state) >= this.waitUntilAbs) this.waitUntilAbs = null;
    // O relógio para em falas, cenas, roteiros e transições; com o catálogo ou o celular abertos, o tempo corre.
    const clockPaused = this.ui.pausesClock() || this.changingMap || this.scripts.isRunning() || this.sweeping || this.usingItem;
    if (!clockPaused) this.session.tickClock((this.game.loop.delta / 1000) * (this.waitUntilAbs !== null ? WAIT_SPEED : 1));
    this.updateDayNight();
    this.updateAmbience();
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
    this.player.speedFactor = this.session.service.speed();
    // R segurado: corre (carregando algo, um pouco menos). Guiada por roteiro, anda normal.
    this.player.runFactor = runFactor(!this.autoWalk && k.run.isDown, this.session.service.carrying(), playerRun);
    this.player.move(input);
    this.player.updateDepth();
    for (const cat of this.cats) if (cat.visible) cat.tick(this.time.now);
    // Dica "E": recalcula 10 vezes por segundo (procurar o que está perto passa pelos pedidos todos).
    if (busy || this.placing) this.hint.show(null);
    else if (this.time.now - this.hintCheckedAt >= 100) {
      this.hintCheckedAt = this.time.now;
      const at = this.eTarget();
      this.hint.show(at && this.session.hintWanted(at.kind) ? { ...at, label: uiText.hints[at.kind] } : null);
    }
    this.updateCareBubbles();
    this.fadeHudOverWorld();
    for (const w of this.waiters.filter((x) => x.until())) {
      this.waiters.splice(this.waiters.indexOf(w), 1);
      w.resolve();
    }
    if (this.placing) this.refreshGhost();
    this.updateCarried();
    this.updateService();

    // Direção em que ela está andando (uma só): as portas pedem uma direção (para cima, ou para baixo na saída do mercado).
    const moving = input.up && !input.down ? 'up' : input.down && !input.up ? 'down' : input.left && !input.right ? 'left' : input.right && !input.left ? 'right' : null;
    if (!moving && !this.changingMap) this.doorLocked = false;
    const door = doorAt(this.map, this.feetCell(), moving);
    if (door && !this.placing && !this.doorLocked && !this.scripts.isRunning()) {
      if (this.session.doorIntercept(door)) this.doorLocked = true; // a porta mostrou uma cena
      else if (this.session.canUseDoor(door) && this.session.content.world.goHomeDoors.includes(door.id) && this.session.canGoHome()) this.askGoHome(door);
      else if (this.session.canUseDoor(door) && this.session.content.world.goHomeDoors.includes(door.id) && this.session.goHomeProblem() === 'customers_inside') {
        // Já é hora, mas ainda tem cliente: ela pode sair para a rua, só não encerra o dia.
        this.ui.problem('customers_inside');
        this.useDoor(door);
      }
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
    this.careBubbles?.clear();
    this.careCheckedAt = -Infinity;
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
    const [col, row] = spawn ?? this.map.spawn;
    this.placePlayer(col, row);
    this.player.face(facing);
    this.applyCamera();

    // Gatos que moram neste mapa.
    for (const catId of this.session.shelteredCats()) {
      if (this.session.state.cats[catId]!.map === mapId) this.spawnCat(catId);
    }
    // NPCs que ficam no mapa (a Fernanda no balcão da clínica).
    for (const n of this.session.mapData(mapId).npcs ?? []) this.spawnNpc(n.npc, n.at, n.facing);
    this.refreshJobPoints();
    this.stopVan();
    this.refreshParcels();
    this.clearCustomers();
    this.refreshSurfaces();
  }

  /** Na cama do quartinho: dormir no café (depois do horário de ir para casa). */
  private askSleep(): void {
    const problem = this.session.goHomeProblem();
    if (problem) return this.ui.problem(problem);
    const r = uiText.rooms;
    void this.ui.confirm(r.sleepQuestion, r.sleepYes, r.sleepNo).then((yes) => {
      if (yes) this.session.sleepInCafe();
    });
  }

  /** Na porta do café, à tarde: encerrar o dia ou só sair para a rua. Com o quartinho, ela dorme no café. */
  private askGoHome(door: MapDoor): void {
    this.doorLocked = true;
    if (this.session.sleepRoom()) {
      this.ui.toast(uiText.rooms.goHomeSleep.replace('{time}', this.session.content.dayNight.goHomeFrom));
      return this.useDoor(door);
    }
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
    this.objectImages.clear();
    for (const s of this.map.sprites) {
      const img = addTileImage(this, s.col * ts, s.row * ts - (s.dy ?? 0), s.sheet, s.frame).setDepth(s.depth);
      this.mapImages.add(img);
      if (s.obj) this.objectImages.set(s.obj, [...(this.objectImages.get(s.obj) ?? []), img]);
    }
    // Luz e sombra de ambiente: refeitas junto com o mapa (inclui os móveis colocados).
    const { content } = this.session;
    this.ambience?.setAmbience(ambienceOf(this.session.mapData(mapId), content.catalog, content.dayNight.ambience, content.maps[this.map.id]?.lighting === 'indoor'));

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
    this.roomView ??= new RoomView(this, this.session, ts);
    this.roomView.refresh(mapId === this.session.content.map.id);
  }

  /** Cômodos mudaram: mapa, escuro, câmera e luz de fora. */
  private refreshRooms(): void {
    this.buildMap();
    this.applyCamera();
  }

  /**
   * Câmera: em mapa maior que a tela, segue a personagem. No café, só até onde ela conhece (os cômodos
   * descobertos); andar entre cômodos é contínuo (sem fade: o fade fica só na porta da fachada).
   */
  private applyCamera(): void {
    const ts = this.map.tileSize;
    const home = this.map.id === this.session.content.map.id;
    const area = (home && this.roomView?.cameraArea()) || { x: 0, y: 0, w: this.map.cols * ts, h: this.map.rows * ts };
    const cam = this.cameras.main;
    this.dayNight.setOutdoorAreas(home ? (this.roomView?.outdoorAreas() ?? []) : []);
    if (area.w <= GAME_WIDTH && area.h <= GAME_HEIGHT) {
      cam.stopFollow();
      cam.removeBounds();
      cam.centerOn(area.x + area.w / 2, area.y + area.h / 2);
      return;
    }
    // Se sobrar largura, centraliza; se sobrar altura, a sobra fica em cima (céu), nunca embaixo do chão.
    const bx = area.w < GAME_WIDTH ? area.x + (area.w - GAME_WIDTH) / 2 : area.x;
    const by = area.h < GAME_HEIGHT ? area.y + area.h - GAME_HEIGHT : area.y;
    cam.setBounds(bx, by, Math.max(area.w, GAME_WIDTH), Math.max(area.h, GAME_HEIGHT));
    cam.startFollow(this.player, true);
  }

  /** Momento da descoberta: a câmera vai até a porta, ela pulsa; o gato leva até lá (cat_leads). */
  private async discoveryMoment(doorId: string, trigger: string): Promise<void> {
    const door = this.session.content.rooms.doors.find((d) => d.id === doorId);
    if (!door) return;
    const ts = this.map.tileSize;
    const [c, r] = door.at;
    if (trigger === 'cat_leads') {
      // O gato do café aparece sentado na frente da porta e mia para ela.
      const cat = this.cats.find((x) => x.visible);
      if (cat) {
        cat.setPosition((c - 1) * ts + ts / 2, (r + 1) * ts - 6);
        (cat.body as Phaser.Physics.Arcade.Body).reset(cat.x, cat.y);
        cat.stay(4000, this.time.now);
        void this.emote(cat.catId, 'exclamation', 1400);
      }
    }
    const cam = this.cameras.main;
    cam.stopFollow();
    cam.pan(c * ts + ts / 2, r * ts + ts / 2, 600, 'Sine.easeInOut');
    this.roomView?.highlight(door.at);
    await this.wait(2200);
    cam.pan(this.player.x, this.player.y - ts, 500, 'Sine.easeInOut');
    await this.wait(520);
    this.applyCamera();
  }

  /** Põe um gato no mapa atual, perto de `near` (ou num lugar livre qualquer). */
  private spawnCat(catId: string, near?: Cell): void {
    const state = this.session.state.cats[catId];
    const def = this.session.catDef(catId);
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
    // Sem balcão livre: não entra no modo de posicionar (todo clique daria erro); fica na mochila.
    const missing = this.session.missingHost(itemId);
    if (missing) return this.ui.problem(missing);
    const { catalog, items } = this.session.content;
    const def = catalog.tiles[items[itemId]!.tile ?? '']!;
    const ghosts: Phaser.GameObjects.Image[] = [];
    for (let dy = 0; dy < def.h; dy++) {
      for (let dx = 0; dx < def.w; dx++) {
        ghosts.push(
          addTileImage(this, 0, 0, def.sheet, frameOf(catalog, def, dx, dy)).setAlpha(0.8).setDepth(GHOST_DEPTH),
        );
      }
    }
    this.placing = { itemId, ghosts, at: [0, 0] };
    this.ui.setHint('placing');
    this.moveGhost(this.input.activePointer);
  }

  /**
   * Tecla de ação, uma vez por toque. O Phaser às vezes entrega o mesmo keydown de novo ao soltar a tecla
   * (apertar e soltar no mesmo quadro): sem isto, um toque rápido no C abria e fechava o Market.
   */
  private onKey(key: string, fn: () => void): void {
    let last: KeyboardEvent | null = null;
    this.input.keyboard!.on(`keydown-${key}`, (e: KeyboardEvent) => {
      if (e === last) return;
      last = e;
      fn();
    });
  }

  /** Botão direito num móvel do café: muda de lugar sem passar pela mochila; o que está em cima vai junto. */
  private startMoving(uid: string): void {
    this.cancelPlacing();
    const group = this.session.movingGroup(uid);
    const host = group[0];
    if (!host) return;
    const { catalog, items } = this.session.content;
    const ghostsOf = (itemId: string) => {
      const def = catalog.tiles[items[itemId]!.tile ?? '']!;
      const out: Phaser.GameObjects.Image[] = [];
      for (let dy = 0; dy < def.h; dy++) for (let dx = 0; dx < def.w; dx++) out.push(addTileImage(this, 0, 0, def.sheet, frameOf(catalog, def, dx, dy)).setAlpha(0.8).setDepth(GHOST_DEPTH));
      return { ghosts: out, w: def.w };
    };
    const lift = this.session.content.world.counterLift ?? 0;
    const riders = group.slice(1).map((p) => ({ ...ghostsOf(p.item), lift }));
    riders.forEach((r) => r.ghosts.forEach((g) => g.setDepth(GHOST_DEPTH + 1)));
    this.placing = { itemId: host.item, ghosts: ghostsOf(host.item).ghosts, at: [host.at[0], host.at[1]], moveUid: uid, riders };
    // O original fica no lugar, esmaecido, até soltar (cancelar não muda nada).
    for (const p of group) this.objectImages.get(PLACED_PREFIX + p.uid)?.forEach((img) => img.setAlpha(0.35));
    this.ui.setHint('moving');
    this.moveGhost(this.input.activePointer);
  }

  /** Q enquanto muda de lugar: guarda o móvel (e o que está em cima) na mochila. */
  private storeMoving(): void {
    const uid = this.placing?.moveUid;
    if (!uid) return;
    const r = this.session.storePlaced(uid);
    if (!r.ok) return this.ui.problem(r.reason);
    this.cancelPlacing();
  }

  private cancelPlacing(): void {
    this.placing?.ghosts.forEach((g) => g.destroy());
    this.placing?.riders?.forEach((r) => r.ghosts.forEach((g) => g.destroy()));
    if (this.placing?.moveUid) for (const imgs of this.objectImages.values()) imgs.forEach((img) => img.setAlpha(1));
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
    const { moveUid } = this.placing;
    const ok = (moveUid ? this.session.moveProblem(moveUid, this.placing.at, this.playerCells()) : this.session.checkPlacement(this.placing.itemId, this.placing.at, this.playerCells())) === null;
    this.placing.ghosts.forEach((g, i) => {
      g.setPosition((c0 + (i % def.w)) * ts, (r0 + Math.floor(i / def.w)) * ts).setTint(ok ? GHOST_OK : GHOST_BAD);
    });
    // O que vai em cima: na célula de origem do apoio, subido até o tampo.
    for (const r of this.placing.riders ?? []) r.ghosts.forEach((g, i) => g.setPosition((c0 + (i % r.w)) * ts, (r0 + Math.floor(i / r.w)) * ts - r.lift).setTint(ok ? GHOST_OK : GHOST_BAD));
  }

  private onPointerDown(pointer: Phaser.Input.Pointer): void {
    if (this.ui.isBusy()) return;
    if (!pointer.rightButtonDown() && !this.placing && this.interact(this.cellAt(pointer))) return;
    if (!this.session.atHome()) return;
    if (this.placing) {
      if (pointer.rightButtonDown()) return this.cancelPlacing();
      this.moveGhost(pointer);
      const { itemId, at, moveUid } = this.placing;
      const result = moveUid ? this.session.move(moveUid, at, this.playerCells()) : this.session.place(itemId, at, this.playerCells());
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
      // Botão direito: mudar o móvel de lugar (o que está em cima vai junto; Q guarda na mochila). Na célula de um
      // balcão com cafeteira, pega o balcão (com ela); Shift + botão direito pega só a de cima.
      const placed = this.session.placedAt(this.cellAt(pointer));
      if (!placed) return;
      const onTop = !!this.session.content.items[placed.item]?.placeOn;
      const shift = (pointer.event as MouseEvent | undefined)?.shiftKey ?? false;
      const host = onTop && !shift ? this.session.state.placed.find((p) => p !== placed && !this.session.content.items[p.item]?.placeOn && p.at[0] === placed.at[0] && p.at[1] === placed.at[1]) : undefined;
      this.startMoving((host ?? placed).uid);
    }
  }

  /** Pontos do mundo que não podem ficar escondidos pelo HUD: o mouse e a personagem (cabeça e pés). */
  private fadeHudOverWorld(): void {
    const rect = this.game.canvas.getBoundingClientRect();
    const zoom = rect.width / GAME_WIDTH;
    const view = this.cameras.main.worldView;
    const toClient = (x: number, y: number) => ({ x: rect.left + (x - view.x) * zoom, y: rect.top + (y - view.y) * zoom });
    const p = this.input.activePointer;
    const feet = toClient(this.player.x, this.player.y);
    const points = [toClient(this.player.x, this.player.y - 56), feet];
    if (p.event) points.push(toClient(p.worldX, p.worldY));
    this.ui.updateHudFade(points, feet);
  }

  /** Cor do momento sobre o mundo e relógio no HUD. */
  /** Sombras de quem anda e a luz das janelas pela hora (de dia forte, à noite some). */
  private updateAmbience(): void {
    const { content } = this.session;
    const sh = content.dayNight.ambience.actorShadow;
    const actors: AmbienceActor[] = [{ x: this.player.x, y: this.player.y - 1, w: sh.person, visible: this.player.visible }];
    for (const c of this.cats) actors.push({ x: c.x, y: c.y - 1, w: sh.cat, visible: c.visible });
    for (const n of this.npcs.values()) actors.push({ x: n.x, y: n.y - 1, w: sh.person, visible: n.visible });
    for (const v of this.customerViews.values()) actors.push({ x: v.sprite.x, y: v.sprite.y - 1, w: sh.person, visible: v.sprite.visible });
    const daylight = 1 - darkness(tintAt(this.session.state.time, content.dayNight, this.session.season(), false));
    this.ambience.update(actors, daylight);
  }

  private updateDayNight(): void {
    const { content } = this.session;
    const indoor = content.maps[this.map.id]?.lighting === 'indoor';
    const t = this.session.state.time;
    const season = this.session.season();
    const color = tintAt(t, content.dayNight, season, indoor);
    this.dayNight.update(color, indoor ? tintAt(t, content.dayNight, season, false) : undefined);
    this.ui.setClock(formatClock(t));
  }

  /**
   * Abre um mini game (pedido da vila, história ou atalho de debug): pausa o mundo, joga e, na volta, paga as
   * moedas e conta o ponto do pedido pela sessão. Devolve o resultado para quem chamou.
   */
  async openMiniGame(gameId: string, params: MiniGameParams): Promise<MiniGameResult | null> {
    if (this.miniGameOpen) return null;
    this.miniGameOpen = true;
    this.cancelPlacing();
    this.ui.closeCatalog();
    this.ui.closeShop();
    this.player.setVelocity(0, 0);
    try {
      const result = await MiniGameRegistry.open(this, gameId, params, {
        season: this.session.season(),
        catVariant: miniGameCatVariant(this, params.catId),
        ...(params.catId ? { pillWindow: this.session.pillWindow(params.catId) } : {}),
        // Semente: dia e hora do jogo (repetível no mesmo save, diferente a cada partida do dia).
        seed: this.session.state.day * 100_003 + Math.floor(this.session.state.time),
      });
      this.session.finishMiniGame(result, params);
      return result;
    } finally {
      this.miniGameOpen = false;
    }
  }

  /** Interage com o que estiver ao alcance (ou só com a célula clicada). Devolve se fez algo. */
  private interact(target?: Cell): boolean {
    if (this.session.atHome() && this.serviceInteract(target)) return true;
    const point = this.session.jobPointNear(this.playerCells(), target);
    if (point) {
      const problem = this.session.jobPointProblem(point.id);
      if (problem) {
        this.ui.problem(problem);
        return true;
      }
      if (point.action === 'minigame' && point.minigame) {
        // O ponto só conta se o jogo der certo (session.finishMiniGame faz o doJobPoint).
        void this.openMiniGame(point.minigame.id, {
          difficulty: point.minigame.difficulty,
          jobPoint: point.id,
          ...(point.minigame.itemId ? { itemId: point.minigame.itemId } : {}),
          ...this.session.miniGameExtras(point.id), // a mesa da feira leva os gatos do café
        });
      } else if (point.action === 'sweep') {
        if (this.sweeping) return true;
        const ts = this.map.tileSize;
        void this.playSweep((point.at[0] + 0.5) * ts, (point.at[1] + 0.5) * ts).then(() => this.doJobPoint(point.id));
      } else this.doJobPoint(point.id);
      return true;
    }
    // Clique num ponto de pedido de longe: avisa em vez de não fazer nada.
    if (target && this.session.jobPointAt(target)) {
      this.ui.problem('too_far');
      return true;
    }
    const parcels = this.session.parcelsNear(this.playerCells(), target);
    if (parcels === 'door') {
      const result = this.session.pickUpParcels();
      if (!result.ok) this.ui.problem(result.reason);
      return true;
    }
    if (parcels === 'inside') {
      const result = this.session.unpackParcel();
      if (!result.ok) {
        this.ui.problem(result.reason);
        return true;
      }
      // Móvel: já vai para a mão, para posicionar (Esc guarda na bolsa).
      const kind = this.session.content.items[result.itemId]?.kind ?? 'furniture';
      if (kind === 'furniture') this.startPlacing(result.itemId);
      return true;
    }
    const it = this.session.interactionAt(this.playerCells(), target);
    if (it) {
      if ('shop' in it.action) this.ui.openShop(it.action.shop);
      else if ('shelf' in it.action) this.ui.openShelf(it.action.shelf, it.action.tags);
      else if ('vet' in it.action) this.ui.openConsult();
      else if ('door' in it.action) this.session.useRoomDoor(it.action.door); // trancada: a fala avisa; com a chave, abre
      else if ('sleep' in it.action) this.askSleep();
      else this.ui.openNews('board');
      return true;
    }
    // E perto de uma sujeira, com a vassoura na mão: varre (o clique na sujeira faz o mesmo, no onPointerDown).
    // Sem a vassoura, o E segue para o resto (gatos, tigela): num café sujo, a sujeira não pode tomar o E de tudo.
    const broom = this.session.activeItem() === this.session.content.world.tools.sweep;
    const dirt = !target && broom && this.session.atHome() ? this.session.dirtNear(this.playerCells()) : undefined;
    if (dirt) {
      if (this.sweeping) return true;
      const problem = this.session.cleanProblem(dirt.id, this.playerCells());
      if (problem) {
        this.ui.problem(problem);
        return true;
      }
      const ts = this.map.tileSize;
      const def = this.session.content.catalog.tiles[dirt.tile]!;
      void this.sweep(dirt.id, (dirt.at[0] + def.w / 2) * ts, (dirt.at[1] + def.h / 2) * ts);
      return true;
    }
    // Tigela de ração por perto: a ração ativa vai para a mão, ela despeja e o gato vem comer.
    const bowl = this.session.bowlNear(this.playerCells(), target);
    if (!bowl) return this.tryCareGame(target) || this.tryTreatCat(target) || this.tryPickUpCat(target);
    if (this.usingItem) return true;
    const problem = this.session.feedProblem(bowl);
    if (problem) {
      this.ui.problem(problem);
      return true;
    }
    const food = this.session.activeItem()!;
    const placed = this.session.state.placed.find((p) => p.uid === bowl)!;
    const ts = this.map.tileSize;
    void this.playUse(food, (placed.at[0] + 0.5) * ts, (placed.at[1] + 0.5) * ts, 'pour').then(() => {
      const result = this.session.feedFromBowl(bowl);
      if (!result.ok) this.ui.problem(result.reason);
    });
    return true;
  }

  /**
   * Onde o E agiria agora (o topo do objeto, em pixels) e em que tipo de coisa (tutorial: ui_text.hints),
   * na mesma ordem do interact(); null: nada por perto. Só olha, não muda nada.
   * Fica de fora o que não tem lugar no mapa (saco pesado, gato no colo).
   */
  private eTarget(): { x: number; y: number; kind: HintKind } | null {
    const s = this.session;
    const st = s.state;
    const ts = this.map.tileSize;
    const feet = this.playerCells();
    const near = (at: Cell) => feet.some((f) => Math.max(Math.abs(f[0] - at[0]), Math.abs(f[1] - at[1])) <= 1);
    const cell = ([c, r]: Cell, kind: HintKind) => ({ x: (c + 0.5) * ts, y: r * ts, kind });
    const floor = ([c, r]: Cell, kind: HintKind) => ({ x: (c + 0.5) * ts, y: (r + 0.4) * ts, kind }); // rente ao chão: a dica mais perto
    const nearCat = () => this.cats.find((c) => c.visible && near(c.cell()));
    // Nos gatos, um pouco mais alto: o balão de cuidado (careBubbles) fica logo acima da cabeça.
    const catTop = (c: CatSprite, kind: HintKind) => ({ x: c.x, y: c.y - c.displayHeight * 0.9 - 12, kind });
    if (s.atHome()) {
      const sv = s.service;
      const customer = sv.customerToServe(feet);
      if (customer) return cell(customer.spot, 'customer');
      if (sv.sinkNear(feet) && sv.sinkAction()) return cell(s.content.service.sink, 'sink');
      if (sv.carriedCat() || st.hands.some((h) => h.kind === 'heavy')) return null;
      const free = st.hands.length < sv.handsCapacity();
      for (const eq of Object.keys(s.content.service.equipment)) {
        const station = sv.stationsFor(eq).find((x) => x.cells.some(near));
        if (!station) continue;
        const bringsWip = st.hands.some((h) => h.kind === 'wip' && sv.recipe(h.recipe)?.steps[h.step]?.equipment === eq);
        if ((sv.surfaceAt(station.at) && free) || st.hands.length === 0 || bringsWip) return cell(station.at, 'station');
      }
      const surface = st.surfaces.find((x) => near(x.at));
      if (surface && free) return cell(surface.at, 'surface');
    }
    const point = s.jobPointNear(feet);
    if (point) return cell(point.at, 'job');
    const parcels = s.parcelsNear(feet);
    if (parcels) return parcels === 'door' ? cell(s.content.delivery.door.at, 'parcels_door') : cell(s.content.delivery.inside.at, 'parcels_inside');
    const it = s.interactionAt(feet);
    if (it) return cell(it.at, `int_${Object.keys(it.action)[0] as keyof MapInteraction['action'] & string}` as HintKind);
    const dirt = s.atHome() && s.activeItem() === s.content.world.tools.sweep ? s.dirtNear(feet) : undefined;
    if (dirt) return floor(dirt.at, 'dirt');
    const bowl = s.bowlNear(feet);
    if (bowl && !s.feedProblem(bowl)) return floor(st.placed.find((p) => p.uid === bowl)!.at, 'bowl');
    if (!s.atHome()) return null;
    const cat = nearCat();
    const care = s.careGameInHand();
    if (cat && care) return catTop(cat, care === 'wand' ? 'cat_wand' : 'cat_brush');
    if (cat && s.holdingMedicine()) return catTop(cat, 'cat_medicine');
    if (cat && s.holdingTreat()) return catTop(cat, 'cat_treat');
    if (cat && st.hands.length === 0 && !st.tray) return catTop(cat, 'cat_pickup');
    return null;
  }

  /** Balões de cuidado: seguem os gatos visíveis; o que cada um precisa vem da sessão (care.ts). */
  private updateCareBubbles(): void {
    if (this.time.now - this.careCheckedAt >= 500) {
      this.careCheckedAt = this.time.now;
      this.careNeeds = new Map(this.cats.map((c) => [c.catId, this.session.catCare(c.catId)?.needs[0] ?? null]));
    }
    this.careBubbles.update(this.cats.filter((c) => c.visible).map((c) => ({ catId: c.catId, x: c.x, y: c.y, depth: c.depth, need: this.careNeeds.get(c.catId) ?? null })));
  }

  /** Varinha ou escova ativa na barra e um gato do café perto: abre o mini game de cuidado com ele. */
  private tryCareGame(target?: Cell): boolean {
    const game = this.session.careGameInHand();
    if (!game) return false;
    const feet = this.playerCells();
    const near = (at: Cell) => feet.some((f) => Math.max(Math.abs(f[0] - at[0]), Math.abs(f[1] - at[1])) <= 1);
    const cat = this.cats.find((c) => c.visible && near(c.cell()) && (!target || (c.cell()[0] === target[0] && c.cell()[1] === target[1])));
    if (!cat) return false;
    void this.openMiniGame(game, { difficulty: this.session.careDifficulty(cat.catId), catId: cat.catId });
    return true;
  }

  /** Petisco ou remédio ativo na barra e um gato perto: vai da mão até o gato. */
  private tryTreatCat(target?: Cell): boolean {
    const medicine = this.session.holdingMedicine();
    if ((!this.session.holdingTreat() && !medicine) || !this.session.atHome() || this.usingItem) return false;
    const feet = this.playerCells();
    const near = (at: Cell) => feet.some((f) => Math.max(Math.abs(f[0] - at[0]), Math.abs(f[1] - at[1])) <= 1);
    const cat = this.cats.find((c) => c.visible && near(c.cell()) && (!target || (c.cell()[0] === target[0] && c.cell()[1] === target[1])));
    if (!cat) return false;
    const item = this.session.activeItem()!;
    if (medicine) {
      // Remédio: confere antes (uma dose por dia, só com receita) para não tocar a animação à toa.
      const problem = this.session.medicineProblem(cat.catId);
      if (problem) {
        this.ui.problem(problem);
        return true;
      }
      // A dose é o remédio escondido: esconder o comprimido na comida e oferecer na hora certa (a sessão dá a dose
      // se der certo; falhou, dá para tentar de novo).
      void this.openMiniGame('pill', { difficulty: this.session.careDifficulty(cat.catId), catId: cat.catId });
      return true;
    }
    void this.playUse(item, cat.x, cat.y - 10, 'give').then(() => {
      const result = this.session.treatCat(cat.catId);
      if (!result.ok) this.ui.problem(result.reason);
    });
    return true;
  }

  /**
   * Usar um item da barra, sem mudar nada no jogo: o ícone aparece na mão dela, vai até o alvo e
   * despeja (grãos caindo na tigela) ou é entregue (some no gato). Placeholder até a pose "despejar".
   */
  private async playUse(itemId: string, x: number, y: number, how: 'pour' | 'give'): Promise<void> {
    const item = this.session.content.items[itemId];
    const f = item?.icon ? iconFrame(this, item.icon) : undefined;
    if (!f) return;
    this.usingItem = true;
    const dx = x - this.player.x;
    const dy = y - (this.player.y - 16);
    this.player.face(Math.abs(dx) >= Math.abs(dy) ? (dx < 0 ? 'left' : 'right') : dy < 0 ? 'up' : 'down');
    const [ax, ay] = serviceArt.handAnchor[this.player.facingDirection()];
    const icon = this.add
      .image(this.player.x - 16 + ax, this.player.y - 64 + ay, f.key, f.frame)
      .setScale(0)
      .setDepth(this.player.depth + 2);
    await this.tweenProps(icon, { scale: 0.5 * f.scale }, itemUse.pickMs);
    if (how === 'pour') {
      // Fica na mão: só estica o braço um pouco na direção da tigela e inclina; os grãos caem dele até a tigela.
      const reach = 0.55;
      const px = icon.x + (x - icon.x) * reach;
      const py = icon.y + (y - 14 - icon.y) * reach;
      await this.tweenProps(icon, { x: px, y: py, angle: dx < 0 ? -70 : 70 }, itemUse.moveMs);
      const grainMs = itemUse.pourMs / itemUse.grains;
      const color = Phaser.Display.Color.HexStringToColor(itemUse.grainColor).color;
      for (let i = 0; i < itemUse.grains; i++) {
        const g = this.add.rectangle(px + (i % 3) - 1, py + 4, 2, 2, color).setDepth(icon.depth - 1);
        this.tweens.add({ targets: g, x: x + (i % 3) - 1, y: y + 2, duration: grainMs * 2, ease: 'Quad.easeIn', onComplete: () => g.destroy() });
        await this.wait(grainMs);
      }
    } else {
      await this.tweenProps(icon, { x, y, scale: 0.35 }, itemUse.giveMs);
    }
    await this.tweenProps(icon, { alpha: 0 }, 120);
    icon.destroy();
    this.usingItem = false;
  }

  private tweenProps(target: Phaser.GameObjects.GameObject, props: Record<string, number>, duration: number): Promise<void> {
    return new Promise((resolve) => this.tweens.add({ targets: target, ...props, duration, ease: 'Sine.easeInOut', onComplete: () => resolve() }));
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

  /** Pontos de pedido pendentes neste mapa: marcadores (redesenha o mapa), o quadro do ponto (a caixa) ou um "!". */
  private refreshJobPoints(rebuild = false): void {
    if (rebuild) this.buildMap();
    this.refreshArrivalActors();
    this.jobIcons.forEach((i) => i.destroy());
    const ts = this.map.tileSize;
    this.jobIcons = this.session
      .pendingJobPoints()
      .filter((p) => !p.marker)
      .map((p) => {
        if (p.sprite) {
          // Fica no chão da célula, como as caixas do correio.
          const bottom = (p.at[1] + 1) * ts - 2;
          return this.add.image((p.at[0] + 0.5) * ts, bottom, 'emotes', p.sprite).setOrigin(0.5, 1).setDepth(ySortDepth(bottom));
        }
        const icon = this.add.image((p.at[0] + 0.5) * ts, p.at[1] * ts - 2, 'emotes', 'exclamation').setOrigin(0.5, 1).setDepth(99_000);
        this.tweens.add({ targets: icon, y: icon.y - 3, duration: 600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
        return icon;
      });
  }

  /**
   * Chegada de gato no mapa: quem espera no lugar do encontro (o gato; no vizinho_traz, o vizinho ao lado), as pegadas
   * (pegadas: só as que a neve ainda não cobriu; o gato escondido só aparece de perto) e o gato do café que guia
   * (gato_leva: anda pelo caminho esperando por ela; no fim, o gato novo).
   */
  private refreshArrivalActors(): void {
    this.arrivalActors.forEach((a) => a.destroy());
    this.arrivalActors = [];
    this.arrivalHidden = null;
    this.arrivalGuide = null;
    this.arrivalTrailKey = null;
    const a = this.session.arrivals.active();
    const step = this.session.arrivals.currentStep();
    const ts = this.map.tileSize;
    // Esperando as necessidades: o gato sentado no lugar dele (com a ração e o cobertor ela aperta E nele).
    if (a && !step && this.session.arrivals.pendingNeeds()?.length) {
      const spot = this.session.arrivals.needsSpot();
      const variant = this.session.catDef(a.catId)?.variant;
      if (spot.map !== this.map.id || !variant || !this.textures.exists(catTexture(variant))) return;
      CatSprite.createAnimations(this, variant);
      const feet = (spot.at[1] + 1) * ts - 4;
      const cat = this.add.sprite((spot.at[0] + 0.5) * ts, feet, catTexture(variant), 0).setOrigin(0.5, 28 / 32).setDepth(ySortDepth(feet));
      cat.play(`${catTexture(variant)}-sit`);
      this.arrivalActors.push(cat);
      return;
    }
    if (!a || !step || a.def.place.map !== this.map.id) return;
    const who = actorsOf(a.def);
    const sitCat = (catId: string | undefined, [c, r]: [number, number], lift = 0) => {
      const variant = catId ? this.session.catDef(catId)?.variant : undefined;
      if (!variant || !this.textures.exists(catTexture(variant))) return null;
      CatSprite.createAnimations(this, variant);
      const feet = (r + 1) * ts - 4 - lift;
      const cat = this.add.sprite((c + 0.5) * ts, feet, catTexture(variant), 0).setOrigin(0.5, 28 / 32).setDepth(ySortDepth(feet));
      cat.play(`${catTexture(variant)}-sit`);
      this.arrivalActors.push(cat);
      return cat;
    };
    const at = a.def.place.at;
    // Gato carteiro: aparece no horário, cada dia uma célula mais perto (some depois de comer).
    const feed = 'feed' in step ? this.session.arrivals.feedSpot() : null;
    if (feed) sitCat(a.catId, feed);
    this.arrivalFeedKey = feed ? feed.join(',') : '';
    // Etapa de mini game (e as dicas antes dela): o gato fica no lugar (preso no alto do poste: place.lift).
    if (('minigame' in step || 'ask' in step) && at && who.cat) sitCat(a.catId, at, a.def.place.lift ?? 0);
    // Dicas: os vizinhos em volta, olhando para cima.
    if ('ask' in step && at) {
      step.ask.forEach((o, i) => {
        const npc = this.session.content.npcs[o.npc];
        if (!npc) return;
        const sprite = new NpcSprite(this, npc, (at[0] - 1 + i * 1.5) * ts, (at[1] + 1) * ts + 6, ts);
        sprite.face('up');
        this.arrivalActors.push(sprite);
      });
    }
    if ('meet' in step && at) {
      if (who.parcel) {
        // A caixa que mia (o quadro da caixa de entrega dos balões).
        const bottom = (at[1] + 1) * ts - 2;
        this.arrivalActors.push(this.parcelImage(PARCEL_PILE_SCALE).setPosition((at[0] + 0.5) * ts, bottom).setDepth(ySortDepth(bottom)));
      }
      if (who.trail) {
        // PLACEHOLDER(arte): pegadas desenhadas por código (ph_footprints).
        const def = this.session.content.catalog.tiles['ph_footprints'];
        if (def) for (const [c, r] of this.session.arrivals.trailNow()) this.arrivalActors.push(addTileImage(this, c * ts, r * ts, def.sheet, frameOf(this.session.content.catalog, def)).setDepth(1));
        this.arrivalTrailKey = this.session.arrivals.trailNow().length;
      }
      if (who.cat) {
        const cat = sitCat(a.catId, at, a.def.place.lift ?? 0);
        if (cat && who.hidden) {
          cat.setVisible(false);
          this.arrivalHidden = cat;
        }
      }
      const npc = who.npc ? this.session.content.npcs[who.npc] : undefined;
      if (npc) {
        const sprite = new NpcSprite(this, npc, (at[0] - 0.5) * ts, (at[1] + 1) * ts, ts);
        sprite.face('right');
        this.arrivalActors.push(sprite);
      }
      if (who.leader) sitCat(a.leaderId, at);
    }
    const route = a.def.place.route;
    if ('lead' in step && route && route.length > 0) {
      sitCat(a.catId, route[route.length - 1]!); // o gato novo espera no fim do caminho
      const guide = sitCat(a.leaderId, at ?? route[0]!);
      if (guide) this.arrivalGuide = { sprite: guide, next: 0, variant: this.session.catDef(a.leaderId!)!.variant };
    }
  }

  /** A cada quadro: o gato escondido aparece de perto; o guia anda pelo caminho esperando por ela; a neve cobre as pegadas. */
  private updateArrivalActors(delta: number): void {
    const ts = this.map.tileSize;
    if (this.arrivalHidden) {
      const d = Phaser.Math.Distance.Between(this.player.x, this.player.y, this.arrivalHidden.x, this.arrivalHidden.y);
      this.arrivalHidden.setVisible(d < ARRIVAL_REVEAL_CELLS * ts);
    }
    if (this.arrivalTrailKey !== null && this.session.arrivals.trailNow().length !== this.arrivalTrailKey) this.refreshArrivalActors();
    // Gato carteiro: chegou ou passou o horário (ou ele comeu): redesenha.
    const feed = this.session.arrivals.feedSpot();
    if ((feed ? feed.join(',') : '') !== this.arrivalFeedKey) this.refreshJobPoints();
    const g = this.arrivalGuide;
    const route = this.session.arrivals.active()?.def.place.route;
    if (!g || !route || g.next >= route.length) return;
    // Ficou para trás (longe e mais longe do destino que o guia): o guia senta e espera. Se ela foi na frente, ele segue.
    const [ec, er] = route[route.length - 1]!;
    const toEnd = (x: number, y: number) => Phaser.Math.Distance.Between(x, y, (ec + 0.5) * ts, (er + 1) * ts - 4);
    const far =
      Phaser.Math.Distance.Between(this.player.x, this.player.y, g.sprite.x, g.sprite.y) > ARRIVAL_GUIDE_WAIT_CELLS * ts &&
      toEnd(this.player.x, this.player.y) > toEnd(g.sprite.x, g.sprite.y);
    const tex = catTexture(g.variant);
    if (far) {
      g.sprite.play(`${tex}-sit`, true);
      return;
    }
    const [c, r] = route[g.next]!;
    const tx = (c + 0.5) * ts;
    const ty = (r + 1) * ts - 4;
    const step = (ARRIVAL_GUIDE_SPEED * delta) / 1000;
    const dx = tx - g.sprite.x;
    const dy = ty - g.sprite.y;
    const dist = Math.hypot(dx, dy);
    if (dist <= step) {
      g.sprite.setPosition(tx, ty);
      g.next++;
      if (g.next >= route.length) g.sprite.play(`${tex}-sit`, true);
    } else {
      g.sprite.setPosition(g.sprite.x + (dx / dist) * step, g.sprite.y + (dy / dist) * step);
      const dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'walk_right' : 'walk_left') : dy > 0 ? 'walk_down' : 'walk_up';
      g.sprite.play(`${tex}-${dir}`, true);
    }
    g.sprite.setDepth(ySortDepth(g.sprite.y));
  }

  // ---------- Atendimento ----------

  /** Célula na frente dela (para soltar o que está nas mãos). */
  private facingCell(): Cell {
    const [c, r] = this.feetCell();
    const d = this.player.facingDirection();
    return d === 'up' ? [c, r - 1] : d === 'down' ? [c, r + 1] : d === 'left' ? [c - 1, r] : [c + 1, r];
  }

  /** E ou clique no café: entregar, lavar, dar ao gato, preparar/pegar no equipamento, pegar ou soltar. */
  private serviceInteract(target?: Cell): boolean {
    const sv = this.session.service;
    const st = this.session.state;
    const feet = this.playerCells();
    const report = (r: { ok: true } | { ok: false; reason: string }) => {
      if (!r.ok) this.ui.problem(r.reason as Parameters<GameUi['problem']>[0]);
      return true;
    };
    const customer = sv.customerToServe(feet);
    if (customer && !target) return report(sv.serve(customer.id));
    // Pia: com louça suja na mão, deixa lá; com as mãos livres e louça na pia, começa a lavar.
    const sink = this.session.content.service.sink;
    if (sv.sinkNear(feet) && (!target || (target[0] === sink[0] && target[1] === sink[1]))) {
      const act = sv.sinkAction();
      if (act === 'deposit') return report(sv.depositDirty());
      if (act === 'wash') return report(this.withPose(sv.startWash(), 'wash'));
    }
    // Saco pesado: no café, vai para o estoque.
    if (st.hands.some((h) => h.kind === 'heavy')) return report(sv.storeHeavy());
    // Gato no colo: põe no chão, na frente dela.
    const carried = sv.carriedCat();
    if (carried) {
      const r = sv.putDownCat();
      if (r.ok) this.dropCat(carried, this.facingCell());
      return report(r);
    }
    const near = (at: Cell) => feet.some((f) => Math.max(Math.abs(f[0] - at[0]), Math.abs(f[1] - at[1])) <= 1);
    if (st.hands.some((h) => h.kind === 'item')) {
      const cat = this.cats.find((c) => near(c.cell()));
      if (cat && !target) return report(sv.giveToCat(cat.catId));
    }
    // Equipamento ao alcance: pegar o que está pronto ou começar o preparo.
    const stations = Object.keys(this.session.content.service.equipment).flatMap((eq) => sv.stationsFor(eq));
    const station = stations.find((s) => s.cells.some((c) => near(c) && (!target || (c[0] === target[0] && c[1] === target[1]))));
    if (station) {
      const equipment = sv.equipmentOf(station.uid);
      const bringsWip = st.hands.some((h) => h.kind === 'wip' && sv.recipe(h.recipe)?.steps[h.step]?.equipment === equipment);
      if (sv.surfaceAt(station.at) && st.hands.length < sv.handsCapacity()) return report(sv.pickUp(station.at));
      if (st.hands.length === 0 || bringsWip) return report(this.withPose(sv.prepare(station.uid), equipment === 'stove' ? 'stir' : 'operate'));
    }
    // Pegar de uma superfície (a clicada ou a mais perto).
    const surface = target ? sv.surfaceAt(target) : st.surfaces.find((s) => near(s.at));
    if (surface && near(surface.at) && st.hands.length < sv.handsCapacity()) {
      // Recolher louça suja: a pose de limpar a mesa.
      const dirty = surface.item.kind === 'dirty';
      return report(dirty ? this.withPose(sv.pickUp(surface.at), 'wipe_table') : sv.pickUp(surface.at));
    }
    // Soltar: na célula clicada ou na da frente.
    if (st.hands.length > 0) {
      const at = target ?? this.facingCell();
      if (sv.canPutDown(at, feet)) return report(sv.putDown(at, feet));
    }
    return false;
  }

  /** Deu certo: ela faz a pose da ação por um instante (data/character.json, actionMs). */
  private withPose<R extends { ok: boolean }>(result: R, pose: Pose): R {
    if (result.ok) void this.player.playAction(pose, this.session.content.character.poses[pose].actionMs ?? 800);
    return result;
  }

  /** Quanto um móvel posicionado foi desenhado para cima (equipamento em cima do balcão). */
  private liftOf(uid: string): number {
    return this.map.sprites.find((s) => s.dy && this.session.state.placed.some((p) => p.uid === uid && p.at[0] === s.col && p.at[1] === s.row))?.dy ?? 0;
  }

  /** Itens deixados no café (bebidas prontas, louça suja) como ícones nas células. */
  private refreshSurfaces(): void {
    this.surfaceIcons.forEach((i) => i.destroy());
    this.surfaceIcons = [];
    if (!this.session.atHome()) return;
    const ts = this.map.tileSize;
    if (!this.anims.exists('ready-pulse')) {
      this.anims.create({ key: 'ready-pulse', frames: serviceArt.readyMarker.map((_, i) => ({ key: `ready_${i}` })), frameRate: 3, repeat: -1 });
    }
    for (const s of this.session.state.surfaces) {
      // Pronto para pegar (pedido ou massa): o marcador pulsa embaixo.
      if (s.item.kind === 'drink' || s.item.kind === 'wip') {
        const marker = this.add.sprite(s.at[0] * ts, s.at[1] * ts, 'ready_0').setOrigin(0).setDepth(ySortDepth((s.at[1] + 1) * ts) + 4);
        marker.play('ready-pulse');
        this.surfaceIcons.push(marker as unknown as Phaser.GameObjects.Image);
      }
      const img = this.handItemImage(s.item);
      if (!img) continue;
      // Em cima do móvel da célula (balcão, mesa, equipamento): mesma profundidade da base dele, um pouco à frente.
      const base = (s.at[1] + 1) * ts;
      img.setPosition((s.at[0] + 0.5) * ts, base - 12).setOrigin(0.5, 1).setScale(s.item.kind === 'item' ? 0.6 : 1).setDepth(ySortDepth(base) + 5);
      this.surfaceIcons.push(img);
    }
  }

  /** Imagem do que está na mão (bebida: ícone da receita; louça suja: ícone apagado; item: ícone do item). */
  private handItemImage(item: HandItem): Phaser.GameObjects.Image | undefined {
    const c = this.session.content;
    // Pedido pronto e louça suja: a louça 16x16 do pacote (cheia ou suja), no tamanho de verdade.
    if (item.kind === 'drink' || item.kind === 'dirty') {
      const d = serviceArt.dishes;
      const row = d.rows[item.vessel];
      if (row !== undefined) return this.add.image(0, 0, 'dishes16', row * 3 + (item.kind === 'drink' ? d.cols.full : d.cols.dirty));
    }
    if (item.kind === 'cat') return undefined; // o gato no colo é desenhado à parte (animado)
    const icon = item.kind === 'wip' ? c.recipes[item.recipe]?.icon : item.kind === 'item' || item.kind === 'heavy' ? c.items[item.item]?.icon : undefined;
    const f = icon ? iconFrame(this, icon) : undefined;
    if (!f) return undefined;
    const img = this.add.image(0, 0, f.key, f.frame).setData('iconScale', f.scale);
    if (item.kind === 'wip') img.setTint(0xf2dcb8); // massa crua, ainda não terminou
    return img;
  }

  /** Tamanho do objeto na mão (petisco e massa pequenos; saco grande). */
  private handScale(item: HandItem | undefined): number {
    if (!item) return 1;
    return item.kind === 'heavy' ? 0.85 : item.kind === 'item' || item.kind === 'wip' ? 0.55 : 1;
  }

  /** Pega o gato que estiver ao lado (mãos livres). */
  private tryPickUpCat(target?: Cell): boolean {
    const st = this.session.state;
    if (st.hands.length > 0 || st.tray || !this.session.atHome()) return false;
    const feet = this.playerCells();
    const near = (at: Cell) => feet.some((f) => Math.max(Math.abs(f[0] - at[0]), Math.abs(f[1] - at[1])) <= 1);
    const cat = this.cats.find((c) => c.visible && near(c.cell()) && (!target || (c.cell()[0] === target[0] && c.cell()[1] === target[1])));
    if (!cat) return false;
    const r = this.session.service.pickUpCat(cat.catId);
    if (!r.ok) this.ui.problem(r.reason as Parameters<GameUi['problem']>[0]);
    return true;
  }

  /** Põe o gato no chão, na célula da frente (ou nos pés dela, se a da frente estiver ocupada). */
  private dropCat(catId: string, at: Cell): void {
    const cat = this.cats.find((c) => c.catId === catId);
    if (!cat) return;
    const ts = this.map.tileSize;
    const solid = this.map.solid[at[1]]?.[at[0]] !== false;
    const [c, r] = solid ? this.feetCell() : at;
    cat.setPosition(c * ts + ts / 2, (r + 1) * ts - 6).setVisible(true);
    (cat.body as Phaser.Physics.Arcade.Body).reset(cat.x, cat.y);
  }

  /** A cada quadro: o que ela carrega, barras de preparo, equipamentos animados e os clientes. */
  private updateService(): void {
    const st = this.session.state;
    const sv = this.session.service;
    // Mãos: o ícone vai na frente dela.
    // Caixas nas mãos: a pose de carregar, a mesma do gato no colo, sem gato desenhado.
    const boxes = this.carriedImages.length > 0;
    const key = JSON.stringify([st.hands, st.tray, boxes]);
    if (key !== this.handsKey) {
      this.handsKey = key;
      this.handIcons.forEach((i) => i.destroy());
      this.carriedCatSprite?.destroy();
      this.carriedCatSprite = null;
      const catId = sv.carriedCat();
      // Pose de carregar (bandeja, gato no colo): a personagem anda com ela, de mãos vazias; o jogo desenha o objeto.
      this.player.setCarryPose(st.tray ? 'tray' : catId || boxes ? 'cat' : null);
      if (st.tray) {
        // A bandeja: um desenho só, com 0 a 3 louças em cima.
        const icon = serviceArt.trayIcons[Math.min(st.hands.length, serviceArt.trayIcons.length - 1)]!;
        const f = iconFrame(this, icon);
        this.handIcons = f ? [this.add.image(0, 0, f.key, f.frame).setScale(f.scale).setOrigin(0.5, 0.5)] : [];
      } else {
        this.handIcons = st.hands
          .map((h) => ({ h, img: this.handItemImage(h) }))
          .filter((x): x is { h: HandItem; img: Phaser.GameObjects.Image } => !!x.img)
          .map(({ h, img }) => img.setScale(this.handScale(h) * ((img.getData('iconScale') as number | undefined) ?? 1)).setOrigin(0.5, 0.5));
      }
      // Gato no colo: aparece deitado nos braços (a pose de dormir do gato) em qualquer mapa; no café, some do chão.
      // Fora do café (rua, clínica) o gato não está entre os gatos do mapa, mas continua no colo.
      if (catId) {
        for (const cat of this.cats) if (cat.catId === catId) cat.setVisible(false).setVelocity(0, 0);
        const variant = this.session.catDef(catId)?.variant ?? '';
        CatSprite.createAnimations(this, variant); // fora do café o gato pode não ter aparecido no mapa ainda
        // Na pose de dormir o corpo fica na parte de baixo do quadro: origem 1,05 põe o gato na altura das mãos.
        this.carriedCatSprite = this.add.sprite(0, 0, catTexture(variant), 0).setOrigin(0.5, 1.05).play(`${catTexture(variant)}-sleep`);
      }
    }
    const dir = this.player.facingDirection();
    const [ax, ay] = serviceArt.handAnchor[dir];
    const hx = this.player.x - 16 + ax;
    const hy = this.player.y - 64 + ay;
    const front = this.player.depth + (dir === 'up' ? -1 : 2);
    this.handIcons.forEach((img, i) => img.setPosition(hx, hy - (st.tray ? 0 : i * 7)).setDepth(front));
    this.carriedCatSprite?.setPosition(hx, hy).setDepth(front).setFlipX(dir === 'left');
    if (!this.session.atHome()) return;
    // Preparo: barra em cima do equipamento e animação (bule, liquidificador).
    const ts = this.map.tileSize;
    const working = new Set<string>();
    for (const prep of st.service.preps) {
      const placed = st.placed.find((p) => p.uid === prep.stationUid);
      const progress = sv.prepProgress(prep.stationUid);
      if (!placed || progress === undefined) continue;
      working.add(placed.uid);
      const frame = Math.min(serviceArt.progress.length - 1, Math.round(progress * (serviceArt.progress.length - 1)));
      let bar = this.progressBars.get(placed.uid);
      if (!bar) {
        bar = this.add.image((placed.at[0] + 0.5) * ts, placed.at[1] * ts - 2 - this.liftOf(placed.uid), 'progress_0').setOrigin(0.5, 1).setDepth(99_400);
        this.progressBars.set(placed.uid, bar);
      }
      bar.setTexture(`progress_${frame}`);
      if (!this.equipAnims.has(placed.uid)) {
        const def = this.session.content.catalog.tiles[this.session.content.items[placed.item]?.tile ?? ''];
        // Folhas com "animation" em data/tilesets.json: quadros do preparo (bule, liquidificador, cafeteira...).
        const sheet = def && (tilesetsJson.sheets as { id: string; animation?: { columns: number; work: number[] } }[]).find((s) => s.id === def.sheet);
        if (def && sheet?.animation) {
          const { columns, work } = sheet.animation;
          const key = `anim:${sheet.id}`;
          const first = def.row * columns + work[0]!;
          const anim = `work-${sheet.id}-${def.row}`;
          if (!this.anims.exists(anim)) this.anims.create({ key: anim, frames: this.anims.generateFrameNumbers(key, { start: first, end: def.row * columns + work[1]! }), frameRate: 6, repeat: -1 });
          const sprite = this.add.sprite(placed.at[0] * ts, placed.at[1] * ts - this.liftOf(placed.uid), key, first).setOrigin(0).setScale(tileScale(sheet.id)).setDepth(ySortDepth((placed.at[1] + 1) * ts) + 2);
          sprite.play(anim);
          this.equipAnims.set(placed.uid, sprite);
        }
      }
    }
    for (const [uid, sprite] of this.equipAnims) {
      if (working.has(uid)) continue;
      sprite.destroy();
      this.equipAnims.delete(uid);
    }
    for (const [uid, bar] of this.progressBars) {
      if (working.has(uid)) continue;
      bar.destroy();
      this.progressBars.delete(uid);
    }
    this.updateSink();
    this.syncCustomers();
  }

  /** Pia: louça esperando (quadro com louça), lavando (animação + barra), recém-lavada (louça limpa). */
  private updateSink(): void {
    const sv = this.session.service;
    const sheet = (tilesetsJson.sheets as { id: string; animation?: { columns: number; work: number[]; dirty?: number; clean?: number } }[]).find((s) => s.id === 'sink');
    if (!sheet?.animation) return;
    const ts = this.map.tileSize;
    const [c, r] = this.session.content.service.sink;
    if (!this.sinkSprite || !this.sinkSprite.active) {
      this.sinkSprite = this.add.sprite(c * ts, r * ts, 'anim:sink', 0).setOrigin(0).setScale(tileScale('sink')).setDepth(ySortDepth((r + 1) * ts) + 1).setVisible(false);
      const [a, b] = sheet.animation.work as [number, number];
      if (!this.anims.exists('sink-wash')) this.anims.create({ key: 'sink-wash', frames: this.anims.generateFrameNumbers('anim:sink', { start: a, end: b }), frameRate: 6, repeat: -1 });
    }
    const progress = sv.washProgress();
    if (progress !== undefined) {
      if (!this.sinkSprite.anims.isPlaying) this.sinkSprite.setVisible(true).play('sink-wash');
      if (!this.sinkBar || !this.sinkBar.active) this.sinkBar = this.add.image((c + 0.5) * ts, r * ts - 2, 'progress_0').setOrigin(0.5, 1).setDepth(99_400);
      this.sinkBar.setTexture(`progress_${Math.min(serviceArt.progress.length - 1, Math.round(progress * (serviceArt.progress.length - 1)))}`);
      return;
    }
    this.sinkBar?.destroy();
    this.sinkBar = null;
    this.sinkSprite.stop();
    if (this.time.now < this.sinkCleanUntil && sheet.animation.clean !== undefined) this.sinkSprite.setVisible(true).setFrame(sheet.animation.clean);
    else if (sv.sinkLoad() > 0 && sheet.animation.dirty !== undefined) this.sinkSprite.setVisible(true).setFrame(sheet.animation.dirty);
    else this.sinkSprite.setVisible(false);
  }

  /** Clientes: cria quem chegou (entra pela porta), anda até o lugar, balão do pedido; quem saiu vai embora. */
  private syncCustomers(): void {
    const cfg = this.session.content.service;
    const ts = this.map.tileSize;
    const door: Cell = [14, 4];
    const alive = new Set<string>();
    for (const c of this.session.state.service.customers) {
      alive.add(c.id);
      let view = this.customerViews.get(c.id);
      if (!view) {
        const def = this.session.content.npcs[cfg.customerLooks[c.look % cfg.customerLooks.length]!];
        if (!def) continue;
        // Recém-chegado entra pela porta; ao abrir o café (trocar de mapa), já aparece no lugar.
        view = new CustomerSprite(this, def, this.customersFresh ? c.spot : door, ts);
        this.customerViews.set(c.id, view);
        if (!this.customersFresh) void view.walkTo(c.spot, true);
      } else if (view.target[0] !== c.spot[0] || view.target[1] !== c.spot[1]) void view.walkTo(c.spot, true);
      const shown = c.stage === 'waiting' ? c.recipe : c.stage === 'queue' ? null : undefined;
      if (view.shownRecipe !== shown) {
        view.shownRecipe = shown;
        view.showOrder(shown ? this.session.content.recipes[shown]?.icon : shown);
      }
      // Depois de pagar, fica no lugar consumindo (consumeMinutes): a barrinha mostra quanto falta para ir embora.
      view.showConsuming(c.stage === 'drinking' ? 1 - (c.until - nowAbs(this.session.state)) / cfg.consumeMinutes[c.kind] : undefined);
      if (c.stage === 'waiting') {
        const left = (c.until - nowAbs(this.session.state)) / cfg.patienceMinutes;
        const b = serviceArt.bubble;
        view.setMood(left < b.furiousBelow ? 'furious' : left < b.impatientBelow ? 'impatient' : 'normal');
      }
      view.update();
    }
    this.customersFresh = false;
    for (const [id, view] of this.customerViews) {
      if (alive.has(id) || view.leaving) {
        if (view.leaving) view.update();
        continue;
      }
      view.leaving = true;
      view.showOrder(undefined);
      view.showConsuming(undefined);
      void view.walkTo(door).then(() => (view.sprite.active ? view.sprite.leave() : undefined)).then(() => {
        view.destroy();
        this.customerViews.delete(id);
      });
    }
  }

  private clearCustomers(): void {
    this.customerViews.forEach((v) => v.destroy());
    this.customerViews.clear();
    this.equipAnims.forEach((s) => s.destroy());
    this.equipAnims.clear();
    this.progressBars.forEach((b) => b.destroy());
    this.progressBars.clear();
    this.sinkSprite?.destroy();
    this.sinkSprite = null;
    this.sinkBar?.destroy();
    this.sinkBar = null;
    this.handsKey = ''; // redesenha o que está nas mãos (o gato do mapa novo)
    this.customersFresh = true;
  }

  /** Pilhas de caixas: na porta do café (rua) e dentro do salão. Até 3, uma em cima da outra. */
  private refreshParcels(): void {
    this.ui.setParcelsOnTheWay(this.arriving);
    this.parcelImages.forEach((i) => i.destroy());
    this.parcelImages = [];
    const cfg = this.session.content.delivery;
    const stack = (at: Cell, count: number) => {
      const ts = this.map.tileSize;
      const bottom = (at[1] + 1) * ts - 2;
      for (let i = 0; i < Math.min(count, cfg.maxPending); i++) {
        this.parcelImages.push(this.parcelImage(PARCEL_PILE_SCALE).setPosition((at[0] + 0.5) * ts, bottom - i * PARCEL_PILE_STEP).setDepth(ySortDepth(bottom) + i));
      }
    };
    const loc = this.session.location();
    if (loc === cfg.door.map) stack(cfg.door.at, this.session.deliveriesAt('door') - this.arriving);
    if (this.session.atHome()) stack(cfg.inside.at, this.session.deliveriesAt('inside'));
  }

  /** Caixa de papelão (ícone de data/delivery.json), com a base embaixo, na escala pedida (a arte é 64 px). */
  private parcelImage(scale: number): Phaser.GameObjects.Image {
    const f = iconFrame(this, this.session.content.delivery.parcelIcon);
    return (f ? this.add.image(0, 0, f.key, f.frame).setScale(scale * f.scale * 2) : this.add.image(0, 0, 'emotes', 'parcel').setScale(scale)).setOrigin(0.5, 1);
  }

  /** As caixas que ela carrega ficam nas mãos (ponto da mão da direção), empilhadas: as do correio e itens com carrySprite. */
  private updateCarried(): void {
    const { inventory } = this.session.state;
    const items = this.session.content.items;
    const frames = [
      ...Array<string>(this.session.deliveriesAt('carried')).fill('parcel'),
      ...Object.entries(inventory).flatMap(([id, qty]) => (items[id]?.carrySprite ? Array<string>(qty).fill(items[id]!.carrySprite!) : [])),
    ].slice(0, 3);
    while (this.carriedImages.length > frames.length) this.carriedImages.pop()!.destroy();
    while (this.carriedImages.length < frames.length) this.carriedImages.push(this.parcelImage(PARCEL_HAND_SCALE));
    const dir = this.player.facingDirection();
    const [ax, ay] = serviceArt.handAnchor[dir];
    const front = this.player.depth + (dir === 'up' ? -1 : 2);
    this.carriedImages.forEach((img, i) => img.setPosition(this.player.x - 16 + ax, this.player.y - 64 + ay + PARCEL_HAND_DROP - i * PARCEL_HAND_STEP).setDepth(front + i * (dir === 'up' ? -0.01 : 0.01)));
  }

  /** Furgão do correio: chega pela rua, a entregadora deixa a caixa na porta e vai embora. Uma de cada vez. */
  private async playVan(): Promise<void> {
    if (this.vanBusy) return;
    this.vanBusy = true;
    const cfg = this.session.content.delivery;
    const ts = this.map.tileSize;
    const [dc, dr] = cfg.door.at;
    while (this.vanQueue.length > 0 && this.session.location() === cfg.door.map) {
      this.vanQueue.shift();
      const roadY = this.map.rows * ts - 4;
      // Para um pouco depois da porta, para não esconder a entregadora nem a pilha.
      const stopX = (dc + 6.5) * ts;
      const van = this.add.image(this.map.cols * ts + 120, roadY, 'van_left').setOrigin(0.5, 1).setScale(cfg.van.scale ?? 1).setDepth(ySortDepth(roadY));
      this.vanObjects.push(van);
      await this.tweenTo(van, stopX, 1600);
      const def = this.session.content.npcs[cfg.carrier]!;
      const carrier = new NpcSprite(this, def, (dc + 4) * ts + ts / 2, (dr + 2) * ts - 4, ts);
      this.vanObjects.push(carrier);
      carrier.setAlpha(0);
      this.tweens.add({ targets: carrier, alpha: 1, duration: 250 });
      await carrier.walkTo([dc, dr + 1]);
      carrier.face('up');
      // Deixa todas as caixas que chegaram até agora, uma em cima da outra (uma viagem só).
      while (this.arriving > 0 && carrier.active) {
        await carrier.act('segurando_pacote', 500);
        this.arriving--;
        this.refreshParcels();
      }
      if (!carrier.active) break;
      this.vanQueue = [];
      carrier.face('down');
      await this.wait(250);
      await carrier.walkTo([dc + 4, dr + 1]);
      await carrier.leave();
      if (!van.active) break;
      await this.tweenTo(van, -120, 1600);
      van.destroy();
      this.vanObjects = [];
    }
    this.vanBusy = false;
  }

  private tweenTo(obj: Phaser.GameObjects.Image, x: number, ms: number): Promise<void> {
    return new Promise((resolve) => this.tweens.add({ targets: obj, x, duration: ms, ease: 'Sine.easeInOut', onComplete: () => resolve() }));
  }

  /** Saiu da rua no meio da entrega: some com o furgão; as caixas já estão na porta. */
  private stopVan(): void {
    this.vanObjects.forEach((o) => o.destroy());
    this.vanObjects = [];
    this.vanQueue = [];
    this.arriving = 0;
  }

  /** Animação de varrer (vassoura, poeira, brilho), sem mudar nada no jogo. */
  private async playSweep(x: number, y: number): Promise<void> {
    this.sweeping = true;
    services().audio.sfx('broom');
    const left = x < this.player.x;
    this.player.face(left ? 'left' : 'right');
    const posed = this.textures.exists(poseTexture('sweep'));
    if (posed) void this.player.playAction('sweep', broom.sweepMs);
    // A vassoura na mão: o cabo vai onde estão as mãos no quadro atual da pose de ação, as cerdas no chão.
    const hold = broom.hold;
    const img = this.textures.get('broom_hold').getSourceImage() as { width: number; height: number };
    const tool = this.add
      .image(this.player.x, this.player.y, 'broom_hold')
      .setOrigin(hold.grip[0] / img.width, hold.grip[1] / img.height)
      .setScale(1 / hold.resolution)
      .setFlipX(!left) // a imagem tem as cerdas à esquerda: espelha para elas irem para o lado da sujeira
      .setDepth(this.player.depth + 1);
    const followHands = () => {
      const col = Number(this.player.frame.name) % hold.handDx.length;
      tool.setPosition(this.player.x + (hold.handDx[col] ?? 0) / hold.resolution, this.player.y - hold.handHeight / hold.resolution);
    };
    const dust = this.add.image(x, y, 'broom', 'poeira_1').setDepth(100_000);
    const frameMs = 1000 / broom.sweepFps;
    // Passo curto: a vassoura acompanha a troca de quadro da personagem sem atraso.
    const STEP = 40;
    for (let t = 0; t < broom.sweepMs; t += STEP) {
      followHands();
      dust.setFrame(`poeira_${(Math.floor(t / frameMs) % 3) + 1}`);
      await this.wait(STEP);
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
          ? { x: this.npcs.get(who)!.x, y: this.npcs.get(who)!.y, top: this.npcs.get(who)!.def.frameHeight / (this.npcs.get(who)!.def.resolution ?? 1) - 2 }
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
  /** Debug (F9): redesenha o mapa do zero depois de mudar a história ou os cômodos; com mapId, vai para ele. */
  debugReload(mapId?: string): void {
    this.ui.skipDialogue();
    if (mapId && mapId !== this.session.location()) return this.goTo(mapId);
    this.loadMap(this.session.location(), this.feetCell());
  }

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

/** Variante do Cosy Cats do gato do mini game: o pedido, ou o primeiro abrigado, ou o gato de rua do prólogo. */
function miniGameCatVariant(scene: WorldScene, catId?: string): string {
  const id = catId ?? scene.session.shelteredCats()[0] ?? 'cat.first_stray';
  return scene.session.catDef(id)?.variant ?? 'marmalade';
}

/** Em desenvolvimento, deixa a cena acessível no console e no Playwright. */
function exposeDebug(scene: WorldScene): void {
  (window as unknown as { __biscuitPaws: unknown }).__biscuitPaws = { world: scene, cafe: scene };
  // ?minijogo=chase[&dificuldade=hard]: abre o mini game direto (atalho de teste).
  const q = new URLSearchParams(window.location.search);
  const id = q.get('minijogo');
  if (id) {
    const d = q.get('dificuldade');
    scene.time.delayedCall(300, () => void scene.openMiniGame(id, { difficulty: d === 'easy' || d === 'hard' ? d : 'normal' }));
  }
}
