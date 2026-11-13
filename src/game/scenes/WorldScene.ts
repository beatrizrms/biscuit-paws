import Phaser from 'phaser';
import { touch, type TouchAction } from '../touch';
import { fillNames } from '../ui/text';
import { WalkFollowers } from '../WalkFollowers';
import type { WalkCat } from '../../core/neighborWalks';
import { cellsOf, doorAt, type DirtSpot, playerBlockBoxes, resolveMap, solidBoxes, solidRects, ySortDepth, type Cell, type Facing, type MapDoor, type MapInteraction, type ResolvedMap } from '../../core/map';
import { HOTBAR_SIZE } from '../../core/hotbar';
import type { DayEndReason } from '../../core/events';
import { spreadBoxes } from '../../core/spread';
import { nowAbs } from '../../core/state';
import { stationKind } from '../../core/petcare';
import type { GameSession } from '../../core/session';
import { frameOf, sheetResolution } from '../../core/tiles';
import { snowCapDepth, snowCapPixels } from '../../core/snowCap';
import { Player } from '../entities/Player';
import { CatSprite, catScale, catTexture, type CatPlaces } from '../entities/Cat';
import { NpcSprite } from '../entities/Npc';
import { findPath, pathCorners } from '../../core/path';
import { pickETarget, type ECandidate } from '../../core/eTarget';
import { CustomerSprite } from '../entities/Customer';
import { iconFrame, iconSheetKey } from '../icons';
import { addTileImage, applyHue, tileScale } from '../tileArt';
import { RobotVacuumView } from '../RobotVacuumView';
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
import { broom, catObjectUses, content, emoteImage, itemUse, serviceArt, uiText } from '../content';
import { DayNightLayer } from '../DayNightLayer';
import { WeatherLayer } from '../WeatherLayer';
import { seasonOf } from '../../core/calendar';
import { FireworksLayer } from '../FireworksLayer';
import type { ManualSlot } from '../../core/saveSlots';
import { services } from '../services';
import { restartDay, saveNow } from '../startGame';
import { openPause } from '../ui/menu/PauseMenu';
import { pageWasReloaded } from '../../platform/navigation';
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
import type { PlacedItem } from '../../core/state';
import { CareBubbles, type CareStatus } from '../careBubbles';
import type { CareNeed } from '../../core/care';
import { runFactor } from '../../core/movement';
import playerJson from '../../../data/player.json';
import { AreaSelect } from '../AreaSelect';
import { daysText, workName } from '../ui/constructionText';
import { catSexText, vetLine } from '../ui/vetText';
import { lightsFloor } from '../../core/lights';
import { catSpots } from '../../core/cats';

/** Caixa de entrega: escala na pilha (0,5 = 32 px como a antiga) e nas mãos, e o passo da pilha. */
const PARCEL_PILE_SCALE = 0.5;
/** Quanto tempo o balão com o nome do gato fica (Meus gatos). */
const CAT_LABEL_MS = 5000;
/** Cercadinho (3x2): as 4 vagas dos gatos (x dos pés, px do mundo a partir do canto) e a linha dos pés. */
const PEN_SLOTS_X = [26, 42, 58, 74];
const PEN_FEET_Y = 43;
/** A cerca da frente começa nesta fração da fileira de baixo (o que fica por cima dos gatos). */
const PEN_FENCE_FROM = 14 / 64;

/** A caixinha de transporte (tile do catálogo): o gato no colo fora do café e quem espera sem cercadinho. */
function clinicBoxTile(): { sheet: string; frame: number } | null {
  const def = content.catalog.tiles['vet_caixinha_gato'];
  return def ? { sheet: def.sheet, frame: frameOf(content.catalog, def) } : null;
}
const PARCEL_PILE_STEP = 12;
const PARCEL_HAND_SCALE = 0.36;
const PARCEL_HAND_STEP = 9;
/** Ajuste da caixa em relação ao ponto da mão (negativo = mais para cima): na altura dos braços, no peito. */
const PARCEL_HAND_DROP = -2;

const playerRun = playerJson.run;

/** Tipos de coisa da dica "E" (os textos ficam em ui_text.json: hints). */
type HintKind = keyof typeof uiText.hints;

/**
 * O que o E faz agora: a dica (onde e o quê; null: o E age sem balão, como soltar a louça) e a ação. A dica e o E
 * saem do mesmo plano (planE), então o balão nunca diz uma coisa com o E fazendo outra.
 */
type EPlan = { hint: { x: number; y: number; kind: HintKind } | null; run: () => boolean };

/**
 * Desempate do E entre coisas igualmente na frente dela (src/core/eTarget.ts): menor vence. A frente dela e a
 * ferramenta na mão vêm antes disto; o que é estado (entregar ao cliente, soltar o saco, levantar) vem antes de tudo.
 */
const E_TIER = { parcels: 1, catSettling: 2, service: 3, pen: 3, cat: 4, interaction: 4, dirt: 5, job: 5, bowl: 5, bowlEmpty: 8, seat: 9, putDown: 9 } as const;

type Keys = Record<'up' | 'down' | 'left' | 'right' | 'w' | 'a' | 's' | 'd' | 'run', Phaser.Input.Keyboard.Key>;

const GHOST_OK = 0x9fd8b5;
const GHOST_BAD = 0xd9475d;

/** Os móveis que têm troca piscam (sobe e desce a transparência) enquanto ela escolhe na assistência técnica. */
const UPGRADE_BLINK_MS = 420;
/** Gato na caixinha: o balão de cuidado fica em cima dela (px acima do topo da caixinha, contando o ABOVE_FEET do balão). */
const ABOVE_BOX = 20;
/** Mudar de lugar com mais de um móvel perto: o escolhido fica dourado e uma seta pula em cima dele. */
const PICK_TINT = 0xffd36e;
/** Setas e WASD com o fantasma na mão: uma célula por toque. */
const GHOST_STEPS: Record<string, Cell> = { ArrowUp: [0, -1], KeyW: [0, -1], ArrowDown: [0, 1], KeyS: [0, 1], ArrowLeft: [-1, 0], KeyA: [-1, 0], ArrowRight: [1, 0], KeyD: [1, 0] };
const GHOST_DEPTH = 100_000;
/** A sujeira até tantas células dela deixa o HUD transparente em cima (a varrida alcança 2); recalcula a cada tanto (ms). */
const DIRT_FADE_CELLS = 3;
const DIRT_FADE_EVERY_MS = 150;
/** Vizinho passeando: o balãozinho sai quando ele passa a até tantas células dela e fica tanto tempo (ms). */
const NEIGHBOR_BARK_CELLS = 3;
const NEIGHBOR_BARK_MS = 3200;
/** Plateia dos eventos: a cada quanto tempo alguém de um grupinho fala, e quanto o balão fica. */
const CROWD_TALK_EVERY_MS = 2400;
const CROWD_TALK_MS = 2200;
/** Quem passeia na plateia para um pouco em cada ponto. */
const CROWD_PAUSE_MS = 1400;
/** Velocidade dos carros passando na rua (px do mundo por segundo). */
const TRAFFIC_SPEED = 170;
/** No máximo quantos veículos na rua ao mesmo tempo, quantos esperam na fila e o espaço entre um e outro (px do mundo). */
const TRAFFIC_MAX = 2;
const TRAFFIC_QUEUE = 2;
const TRAFFIC_GAP = 200;
/** Na praça, alguém de um grupinho fala a cada tanto (mais devagar que na plateia da festa). */
const AMBIENT_TALK_EVERY_MS = 4200;
/** Celular: segurando o direcional com o fantasma na mão, uma célula a cada tanto (ms). */
const TOUCH_NUDGE_MS = 220;
/** Caminhada de roteiro: sem chegar mais perto por tanto tempo (ms), ela muda de eixo e depois desiste. */
const AUTOWALK_STUCK_MS = 700;
/** A cada quantos minutos de jogo (mín, máx) um gato que já comeu volta ao pote para beliscar. */
const SNACK_EVERY_MIN = [150, 240] as const;
const FADE_MS = 160;
/** Quantas vezes o relógio corre mais rápido ao "Esperar". */
const WAIT_SPEED = 40;

const NO_INPUT = { up: false, down: false, left: false, right: false };
/** Sem a folha da pose sentada, no sofá: a borda do assento acima da base e o quadril acima dos pés (corte provisório). */
const SOFA_SEAT = 9;
const HIP_HEIGHT = 28;
/** Quanto tempo o ícone "se recompondo" fica depois de um café ou de brincar com o gato (ms). */
const RECOVER_ICON_MS = 1800;

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
  /** A partida começou pela Home (e não direto pela URL, com ?jogar): o F5 não precisa voltar pausado. */
  private fromHome = false;
  /** Slot manual desta partida (o autosave lembra dele). */
  private slot: ManualSlot = 'slot1';
  ui!: GameUi;
  private player!: Player;
  private keys!: Keys;
  private mapImages?: Phaser.GameObjects.Group;
  private solids?: Phaser.Physics.Arcade.StaticGroup;
  private solidCollider?: Phaser.Physics.Arcade.Collider;
  /** Potes e caminhas: colidem só com ela (world.playerBlockTiles). */
  private playerSolids?: Phaser.Physics.Arcade.StaticGroup;
  private playerSolidCollider?: Phaser.Physics.Arcade.Collider;
  /** Potes: os gatos não atravessam, menos quem está indo comer ou comendo (world.catBlockTiles). */
  private catSolids?: Phaser.Physics.Arcade.StaticGroup;
  /** Com que hora (dia/noite) o mapa foi desenhado: virou (18h), o céu do quintal troca (redesenha o café). */
  private shownVariantNight = false;
  /** Clientes no lugar (sentados ou em pé no balcão): a célula deles vira sólida só para ela (refeito quando mudam). */
  private customerSolids?: Phaser.Physics.Arcade.StaticGroup;
  private customerCollider?: Phaser.Physics.Arcade.Collider;
  private customerSolidKey = '';
  /** NPCs (Gabi, Dona Neusa, o Tião...): um corpo nos pés de cada um, que acompanha o NPC; só bloqueia com ele parado. */
  private npcBlockers?: Phaser.Physics.Arcade.Group;
  private npcBlockerCollider?: Phaser.Physics.Arcade.Collider;
  private npcBlockerOf = new Map<NpcSprite, Phaser.GameObjects.Zone>();
  /**
   * Posicionando: um item da mochila, ou (moveUid) um móvel do café mudando de lugar, com o que está em cima dele
   * (riders: fantasmas que acompanham, já na altura do tampo).
   */
  /** Marcando a área de uma obra (troca de acabamento). */
  private areaSelect: AreaSelect | null = null;
  private builderAsking = false;
  /** Vizinhos passeando neste mapa agora (data/npcs.json: walks) e os gatos que vão atrás. */
  private readonly neighborWalks = new Map<string, WalkFollowers>();
  private neighborWalksCheckedAt = -Infinity;
  /** Quem já soltou o balãozinho neste passeio (uma vez por passeio, quando passa perto dela). */
  private readonly walkBarked = new Set<string>();
  /** A plateia do evento no quintal (session.festivalCrowd): quem está aqui, e a vez da conversa. */
  /** Os bonecos da plateia (o próprio sprite: um roteiro que chama o mesmo NPC troca o boneco, e o dele não é da plateia). */
  private readonly crowd = new Map<string, NpcSprite>();
  private crowdGroups: string[][] = [];
  private crowdCheckedAt = -Infinity;
  private crowdTalkAt = 0;
  private crowdTurn = 0;
  /** Figurantes da praça e da rua (session.ambientPeople): os bonecos, o bloco do sorteio na tela e a vez da conversa. */
  private readonly ambient = new Map<string, NpcSprite>();
  private ambientBlock: number | null = null;
  /** Acabou de entrar no mapa: a turma já está lá (sem aparecer devagar). */
  private ambientFresh = true;
  private ambientGroups: string[][] = [];
  private ambientCheckedAt = -Infinity;
  private ambientTalkAt = 0;
  private ambientTurn = 0;
  /** Quem está atravessando a rua (session.ambientPassersNow) e as travessias já começadas neste mapa. */
  private readonly passers = new Map<string, NpcSprite>();
  private readonly passesStarted = new Set<string>();
  /** Carros passando na rua: os que estão na tela e o último minuto já olhado (null = acabou de entrar no mapa). */
  private trafficImages: Phaser.GameObjects.Image[] = [];
  /** Veículos da agenda esperando espaço para entrar na rua (no máximo TRAFFIC_QUEUE; os de sobra não passam). */
  private trafficQueue: { vehicle: string; dir: 'left' | 'right' }[] = [];
  private trafficMinute: number | null = null;
  /** O ônibus está levando ela (sem andar nem agir até o dia encerrar). */
  private ridingBus = false;
  /** O Tião consertando um equipamento (fora do mapa de NPCs: pode coincidir com ele na obra). */
  private repairNpcs = new Map<string, NpcSprite>();
  /** "!" em cima de cada equipamento quebrado. */
  private brokenIcons = new Map<string, Phaser.GameObjects.Image>();
  /** Barra do conserto em cima do equipamento (separada das barras de preparo, que são refeitas a cada quadro). */
  private repairBars = new Map<string, Phaser.GameObjects.Image>();
  /** O enfeite no fantasma saiu da caixa de Natal: ao posicionar, sai o próximo. */
  /** O enfeite sendo posicionado saiu desta caixa (Natal ou Halloween): posicionou, sai o próximo. */
  private placingFromBox: string | null = null;
  /** Os próximos móveis da caixa do correio a posicionar (um depois do outro). */
  private parcelQueue: string[] = [];
  /** O balão com o nome do gato (Meus gatos > tocar no gato). */
  private catLabel?: Phaser.GameObjects.Container;
  private placing: { itemId: string; ghosts: Phaser.GameObjects.Image[]; at: Cell; moveUid?: string; riders?: { ghosts: Phaser.GameObjects.Image[]; w: number; lift: number }[] } | null = null;
  /** Imagens do mapa por objeto (id): o móvel sendo mudado de lugar fica esmaecido no lugar de origem. */
  private objectImages = new Map<string, Phaser.GameObjects.Image[]>();
  /** Clínica: gatos que a cena segura (isolados ou internados: sem andar nem colidir) e as caixinhas do canto. */
  private clinicHeld = new Set<string>();
  private isoBoxes = new Map<string, Phaser.GameObjects.Image>();
  private debugPanel?: DebugPanel;
  private changingMap = false;
  private dayNight!: DayNightLayer;
  /** Chuva, neve e folhas ao vento nas áreas ao ar livre; o clima mostrado agora (para refazer quando mudar). */
  private weatherFx!: WeatherLayer;
  private fireworksFx!: FireworksLayer;
  private shownWeather = '';
  /** Dia em que o clima foi desenhado (a cor das folhas depende da estação). */
  private shownWeatherDay = 0;
  /** Cômodos do café: escuro, destaque, câmera, luz de fora. */
  private roomView: RoomView | null = null;
  private robotView?: RobotVacuumView;
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
  private careNeeds = new Map<string, CareNeed[]>();
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
  private lastDay: { reason: DayEndReason; earned: number; jobs: number } | null = null;
  /** Onde ela estava quando sentou no sofá (para levantar no mesmo lugar). */
  private restFrom: { x: number; y: number } | null = null;
  private recoverIcon!: Phaser.GameObjects.Image;
  private recoverIconUntil = 0;
  private cats: CatSprite[] = [];
  private npcs = new Map<string, NpcSprite>();
  private scripts!: ScriptRunner;
  /** Esperas dos roteiros: resolvem quando a condição vale (conferido a cada quadro). */
  private waiters: { until: () => boolean; resolve: () => void }[] = [];
  /** Caminhada da jogadora guiada por roteiro. */
  /**
   * Caminhada de roteiro (playerWalk): o alvo, a menor distância já alcançada e desde quando ela não melhora (para
   * perceber que travou num móvel ou parede) e se já tentou ir primeiro na vertical.
   */
  /** A fila do pote (ids de gatos esperando a vez), o pote da última ração e quando um gato volta para beliscar. */
  private eatQueue: string[] = [];
  private bowlUid = '';
  private nextSnackAt = 0;
  private autoWalk: { x: number; y: number; resolve: () => void; best?: number; since?: number; verticalFirst?: boolean } | null = null;
  private catColliders: Phaser.Physics.Arcade.Collider[] = [];
  /** Depois de passar por uma porta, só usa outra quando a jogadora soltar a seta para cima (sem vai e vem). */
  private doorLocked = false;
  map!: ResolvedMap;

  constructor() {
    super('World');
  }

  init(data: { session: GameSession; isNew: boolean; slot: ManualSlot; fromHome?: boolean }): void {
    this.session = data.session;
    this.isNew = data.isNew;
    this.fromHome = !!data.fromHome;
    this.slot = data.slot;
  }

  create(): void {
    setupCamera(this);
    const uiRoot = document.getElementById('ui')!;
    this.ui = new GameUi(uiRoot, this.session, { onPlace: (id) => this.startPlacing(id), onWait: (until) => (this.waitUntilAbs = until), onSelectArea: (s, f) => this.startAreaSelect(s, f), onPickUpgrade: () => this.startUpgradePick(), onLocateCat: (id) => this.locateCat(id), onSpeak: () => this.faceTalkers() }, isDebugOn());

    this.player = new Player(this, 0, 0);
    this.dayNight = new DayNightLayer(this);
    this.weatherFx = new WeatherLayer(this);
    this.fireworksFx = new FireworksLayer(this);
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
    // T: toma o café pronto que está na mão (recompõe energia; um por hora do jogo).
    this.onKey('T', () => {
      if (this.ui.isDialogueOpen() || this.ui.isBusy()) return;
      this.tryDrinkCoffee();
    });
    // Q: mudando um móvel de lugar, guarda na mochila.
    this.onKey('Q', () => this.storeMoving());
    // F: muda de lugar o móvel ao lado dela, pelo teclado (o botão direito faz o mesmo com o mouse). Com o fantasma
    // na mão, F (ou Enter) solta; setas e WASD andam com ele uma célula por toque e a personagem fica parada.
    this.onKey('F', () => {
      if (this.ui.isBusy() || this.areaSelect || this.changingMap || this.scripts.isRunning()) return;
      if (this.pickingUpgrade) return this.pickUpgradeNear();
      if (this.movePick) return this.cycleMovePick();
      if (this.placing) return this.dropPlacing();
      if (!this.session.atHome()) return this.ui.toastText('notHome');
      const uids = this.furnitureCandidates();
      if (uids.length === 0) return this.ui.problem('no_furniture_near');
      this.chooseToMove(uids);
    });
    this.onKey('ENTER', () => {
      if (this.ui.isBusy()) return;
      if (this.pickingUpgrade) this.pickUpgradeNear();
      else if (this.movePick) this.confirmMovePick();
      else if (this.placing) this.dropPlacing();
    });
    this.input.keyboard!.on('keydown', (e: KeyboardEvent) => {
      const step = GHOST_STEPS[e.code];
      if (!step || !this.placing || this.ui.isBusy()) return;
      this.nudgeGhost(step);
    });
    this.onKey('ESC', () => {
      if (this.areaSelect) return; // a seleção da área trata o Esc (cancela)
      if (this.pickingUpgrade) this.finishUpgradePick(null);
      else if (this.movePick) this.endMovePick();
      else if (this.placing) {
        this.parcelQueue = []; // o resto da caixa fica na mochila
        this.cancelPlacing();
      } else if (this.ui.isCatalogOpen() || this.ui.isPanelOpen()) {
        this.ui.closeCatalog();
        this.ui.closeShop();
      } else if (!this.ui.isBusy() && !this.changingMap && !this.scripts.isRunning()) this.openPause();
    });
    // E: interagir com o que estiver perto (o caixa do mercado...). E de novo fecha a loja.
    this.onKey('E', () => {
      if (this.areaSelect) return;
      if (this.ui.isPanelOpen()) return this.ui.closeShop();
      if (this.ui.isBusy()) return;
      if (this.pickingUpgrade) return this.pickUpgradeNear();
      if (this.movePick) return this.confirmMovePick();
      const plan = this.planE();
      plan?.run();
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
      // Posicionando: o item volta para a mochila (o que estava no mapa é recolhido) e a mochila abre (ex.: pôr na barra).
      if (this.placing) {
        this.parcelQueue = [];
        if (this.placing.moveUid) this.storeMoving();
        else this.cancelPlacing();
      }
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
    // Caixa de enfeites aberta: o enfeite que saiu vai direto para o fantasma de posicionar.
    this.session.bus.on('xmas.box_opened', ({ itemId, box }) => {
      this.startPlacing(itemId);
      this.placingFromBox = this.placing ? box : null;
    });
    this.session.bus.on('item.picked_up', rebuildIfHome);
    this.session.bus.on('item.removed', rebuildIfHome);
    this.session.bus.on('plant.grew', rebuildIfHome);
    this.session.bus.on('item.moved', rebuildIfHome);
    this.session.bus.on('item.upgraded', rebuildIfHome);
    // O Tião chega às 08:00 e vai embora no fim do expediente: aparece martelando ou some, se ela estiver no mapa da obra.
    this.session.bus.on('equipment.repair_started', ({ uid }) => this.showRepairNpc(uid));
    this.session.bus.on('equipment.repaired', ({ uid }) => {
      const npc = this.repairNpcs.get(uid);
      this.repairNpcs.delete(uid);
      void npc?.leave();
    });
    this.session.bus.on('construction.shift', ({ working, map }) => {
      if (map !== this.map.id || this.builderAsking) return;
      const npcId = this.session.content.construction.npc;
      const spot = this.session.builderAt(map);
      if (working && spot) {
        this.spawnNpc(npcId, spot.at, spot.facing);
        this.npcs.get(npcId)?.loop('martelando');
      } else if (!working) {
        // Fim do expediente: ele anda até a saída (a porta da rua, no café) e some lá, em vez de sumir no lugar.
        const npc = this.npcs.get(npcId);
        this.npcs.delete(npcId);
        if (npc) void this.walkOutAndLeave(npc);
      }
    });
    this.session.bus.on('surface.painted', rebuildIfHome);
    this.session.bus.on('dirt.cleaned', rebuildIfHome);
    this.session.bus.on('curtain.toggled', rebuildIfHome);
    // Cômodos: o mapa, a câmera (só o que ela conhece) e a luz do quintal mudam; descobrir tem um momento.
    for (const ev of ['room.opened', 'room.restored'] as const) this.session.bus.on(ev, () => this.session.atHome() && this.refreshRooms());
    this.session.bus.on('room.discovered', ({ trigger, highlight }) => {
      if (!this.session.atHome()) return;
      this.refreshRooms();
      if (highlight) void this.discoveryMoment(highlight, trigger);
    });
    this.session.bus.on('item.received', ({ itemId }) => {
      // A chave achada na sujeira: destaca a porta que ela abre, se a porta já está à vista (a do quintal ainda está
      // escondida quando ela acha a chave: é um mistério até a cena do jardim secreto).
      const door = this.session.content.rooms.doors.find((d) => d.requires?.item === itemId);
      if (door && this.session.atHome() && this.session.doorState(door.id) !== 'hidden') this.roomView?.highlight(door.at);
    });
    // Pontos de pedido: marcadores (neve...) e o "!" em cima de cada ponto pendente.
    for (const ev of ['arrival.started', 'arrival.step', 'arrival.finished', 'job.accepted', 'job.progress', 'job.completed', 'festival.started', 'festival.scheduled', 'festival.progress', 'festival.finished', 'festival.missed'] as const) this.session.bus.on(ev, () => this.refreshJobPoints(true));
    this.session.bus.on('day.ended', (summary) => (this.lastDay = summary));
    // Correio: o furgão chega se ela estiver na rua; senão, só o aviso.
    this.session.bus.on('delivery.arrived', ({ deliveryId }) => {
      if (this.session.location() === this.session.content.delivery.door.map) {
        this.arriving++;
        this.vanQueue.push(deliveryId);
        void this.playVan();
      } else this.ui.toast(uiText.delivery.arrivedAway);
    });
    for (const ev of ['delivery.ordered', 'delivery.picked_up', 'delivery.unpacked', 'delivery.dropped'] as const) this.session.bus.on(ev, () => this.refreshParcels());
    for (const ev of ['hands.changed', 'prep.ready', 'prep.started', 'customer.left', 'customer.served', 'dish.washed'] as const) this.session.bus.on(ev, () => this.refreshSurfaces());
    this.session.bus.on('customer.left', ({ customerId, happy, stars, reputation }) => stars !== undefined && this.showReview(customerId, happy, stars, reputation ?? 0));
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
    this.session.bus.on('crowdfund.donated', ({ customerId, amount }) => {
      const view = customerId ? this.customerViews.get(customerId) : undefined;
      if (!view) return;
      const x = view.sprite.x;
      const y = view.sprite.y - 84;
      const label = this.add.text(x, y, `♥ +${amount}`, { fontFamily: 'Trebuchet MS, sans-serif', fontSize: '10px', color: '#d97890', stroke: '#fff4e0', strokeThickness: 3 }).setOrigin(0.5).setDepth(99_600);
      this.tweens.add({ targets: label, y: y - 16, alpha: 0, delay: 900, duration: 1000, onComplete: () => label.destroy() });
    });
    this.session.bus.on('cat.sheltered', ({ catId }) => this.spawnCat(catId, this.feetCell()));
    this.session.bus.on('cat.affection_changed', ({ catId, from, to }) => to > from && this.floatHeart(catId));
    // Ração no pote: todos comeram (núcleo), mas vão até o pote um de cada vez (a fila do pote).
    this.session.bus.on('clinic.delivered', (d) => this.queueVetDelivery(d));
    this.session.bus.on('cat.fed', ({ catId, bowlUid }) => {
      this.bowlUid = bowlUid;
      if (!this.eatQueue.includes(catId)) this.eatQueue.push(catId);
    });
    // Fim do dia: ela vai para casa (transição) e amanhece chegando pela rua.
    // Ponto de extensão: com o quartinho (world.sleepMap), ela dorme no café em vez de ir para casa.
    // Energia: sentar/levantar do sofá e o ícone depois de um café ou de brincar com o gato.
    this.session.bus.on('rest.changed', ({ uid }) => (uid ? this.sitOn(uid) : this.standUp()));
    this.session.bus.on('energy.recovered', () => (this.recoverIconUntil = this.time.now + RECOVER_ICON_MS));
    // O balão da folha de ícones (64 px, no tamanho dos balões de cuidado); sem a folha, o desenhado por código.
    const recover = this.textures.exists(iconSheetKey('pixellab')) ? iconFrame(this, 'recompondo') : undefined;
    this.recoverIcon = (recover ? this.add.image(0, 0, recover.key, recover.frame).setScale(recover.scale * 0.5) : this.add.image(0, 0, recoverIconTexture(this)).setScale(0.5)).setVisible(false);
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
    // F5: o jogo salvo volta pausado (menu de pausa aberto e música parada), onde ela estiver; uma vez por carregamento.
    // Jogo novo começa direto, sem a pausa; pela Home também (ela já escolheu continuar).
    if (!reloadPauseShown && !this.isNew && !this.fromHome && pageWasReloaded()) {
      reloadPauseShown = true;
      this.time.delayedCall(0, () => this.openPause());
    }
  }

  /** Pausa: Continuar, Opções, Salvar, Voltar ao menu (salva antes). */
  private openPause(): void {
    this.ui.paused = true;
    touch.setHidden(true);
    // A música de fundo para enquanto o menu de pausa está aberto.
    services().audio.setMusicPaused(true);
    // Congela tudo: a cena inteira para (gatos, clientes, animações, tweens, física e relógio); o menu é HTML e segue.
    this.scene.pause();
    openPause(document.getElementById('ui')!, {
      save: async () => {
        await saveNow(this.session, this.slot);
        return t(`slot.${this.slot}`);
      },
      restartDay: async () => {
        services().audio.fadeOutAll();
        const ok = await restartDay(this.slot);
        if (!ok) this.ui.toast(t('pause.noDayStart'), 4000);
      },
      toMenu: async () => {
        await saveNow(this.session, this.slot);
        services().audio.fadeOutAll();
        this.scene.resume(); // o fade da câmera só anda com a cena rodando
        this.cameras.main.fadeOut(400, 27, 33, 64);
        // Recarrega sem os atalhos da URL: volta à Home com tudo limpo.
        this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => (window.location.href = window.location.pathname));
      },
      onClose: () => {
        this.scene.resume();
        this.ui.paused = false;
        touch.setHidden(false);
        services().audio.setMusicPaused(false);
      },
    });
  }

  update(): void {
    this.sounds?.update();
    // Clima ou estação novos (o vento continua, mas a estação virou: as folhas trocam de cor).
    if (this.session.weather() !== this.shownWeather || this.session.state.day !== this.shownWeatherDay) this.refreshWeather();
    this.updateArrivalActors(this.game.loop.delta);
    this.syncNpcBlockers();
    const k = this.keys;
    const busy = this.ui.isBusy() || this.ridingBus || this.changingMap || this.scripts.isRunning() || this.sweeping || this.usingItem || this.player.isActing() || this.areaSelect !== null;
    if (this.waitUntilAbs !== null && nowAbs(this.session.state) >= this.waitUntilAbs) this.waitUntilAbs = null;
    this.updateEatQueue();
    // Onde ela está (as cenas de Natal e Ano Novo só começam com ela no salão).
    if (!this.changingMap) this.session.setPlayerCell(this.feetCell());
    // O relógio para em falas, cenas, roteiros e transições; com o catálogo ou o celular abertos, o tempo corre.
    const clockPaused = this.ui.pausesClock() || this.changingMap || this.scripts.isRunning() || this.sweeping || this.usingItem;
    if (!clockPaused) this.session.tickClock((this.game.loop.delta / 1000) * (this.waitUntilAbs !== null ? WAIT_SPEED : 1));
    this.updateDayNight();
    this.updateAmbience();
    const input = this.autoWalk
      ? this.autoWalkInput()
      : busy || this.placing || this.movePick
      ? NO_INPUT
      : {
          // Teclado ou o direcional de toque.
          up: k.up.isDown || k.w.isDown || touch.dir.up,
          down: k.down.isDown || k.s.isDown || touch.dir.down,
          left: k.left.isDown || k.a.isDown || touch.dir.left,
          right: k.right.isDown || k.d.isDown || touch.dir.right,
        };
    this.updateTouchPlacing(busy);
    this.updateNeighborWalks();
    this.updateCrowd();
    this.updateAmbient();
    this.updateTraffic();
    // Controles de toque só quando ela pode andar e agir: com qualquer coisa por cima do jogo (fala, pergunta, cena,
    // placa, janela, pausa), somem (a camada deles fica acima da interface e cobriria os botões da janela).
    touch.setHidden(this.ui.isBusy());
    // Sentada no sofá: fica parada; andar levanta.
    if (this.session.resting() && (input.up || input.down || input.left || input.right)) this.session.stopRest();
    if (!this.session.resting()) {
      // Cansada (pouca energia), anda mais devagar e não corre.
      this.player.speedFactor = this.session.service.speed() * this.session.energySpeed();
      // R segurado: corre (carregando algo, um pouco menos). Guiada por roteiro, anda normal.
      this.player.runFactor = runFactor(!this.autoWalk && (k.run.isDown || touch.run) && this.session.canRun(), this.session.service.carrying(), playerRun);
      this.player.move(input);
      this.player.updateDepth();
    }
    this.updateRecoverIcon();
    this.layoutClinicCats();
    for (const cat of this.cats) if (cat.visible && !this.clinicHeld.has(cat.catId)) cat.tick(this.time.now);
    // Dica "E": recalcula 10 vezes por segundo (procurar o que está perto passa pelos pedidos todos).
    if (busy || this.placing || this.movePick) this.hint.show(null);
    else if (this.time.now - this.hintCheckedAt >= 100) {
      this.hintCheckedAt = this.time.now;
      const at = this.eTarget();
      this.hint.show(at ? { ...at, label: uiText.hints[at.kind] } : null);
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
      // Festa no café: a porta da rua pergunta antes (a cena da porta, se houver, fica para a próxima vez).
      if (this.session.festivePartyOn() && this.session.content.world.goHomeDoors.includes(door.id)) this.askEndParty();
      else if (this.session.doorIntercept(door)) this.doorLocked = true; // a porta mostrou uma cena
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
    this.fireworksFx?.stop();
    this.ui.closeCatalog();
    this.catColliders.forEach((c) => c.destroy());
    this.catColliders = [];
    this.cats.forEach((c) => c.destroy());
    this.cats = [];
    this.catPlaces.taken.clear();
    this.careBubbles?.clear();
    this.careCheckedAt = -Infinity;
    this.npcs.forEach((n) => n.destroy());
    this.npcs.clear();
    this.neighborWalks.forEach((f) => f.destroy());
    this.neighborWalks.clear();
    this.crowd.clear();
    this.crowdGroups = [];
    this.player.setAlpha(1); // voltando do ônibus (ela sumiu dentro dele)
    this.trafficImages.forEach((img) => img.destroy());
    this.trafficImages = [];
    this.trafficQueue = [];
    this.trafficMinute = null;
    this.ambient.clear();
    this.passers.clear();
    this.passesStarted.clear();
    this.ambientGroups = [];
    this.ambientBlock = null;
    this.ambientFresh = true;
    this.buildMap(mapId);
    const ts = this.map.tileSize;
    const width = this.map.cols * ts;
    const height = this.map.rows * ts;
    this.physics.world.setBounds(0, 0, width, height);

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
    for (const n of this.session.mapData(mapId).npcs ?? []) {
      this.spawnNpc(n.npc, n.at, n.facing);
      if (n.anim) this.npcs.get(n.npc)?.loop(n.anim); // o Tião martelando na obra
      // A atendente do mercado: mexe à toa com pausas e, com ela no caixa, passa as compras.
      if (n.idle || n.busy) this.npcs.get(n.npc)?.attend(n.idle, n.busy, () => this.session.interactionAt(this.playerCells())?.id === n.busy?.interaction);
    }
    // A obra terminou: no café, o Tião vem perguntar se ela quer mais algum serviço.
    if (mapId === this.session.content.map.id && this.session.state.construction.askPending) void this.builderAsk();
    // A Fernanda trouxe um gato operado: a entrega acontece quando ela entra no café.
    if (mapId === this.session.content.map.id && this.vetDeliveries.length) void this.vetDeliveryScene();
    this.refreshJobPoints();
    this.stopVan();
    this.refreshParcels();
    this.clearCustomers();
    this.refreshSurfaces();
  }

  /** No ponto de ônibus: para onde ir (casa, por enquanto) ou ficar. */
  private askBus(): void {
    if (this.ridingBus) return;
    const t = uiText.bus;
    const dests = this.session.content.world.bus?.destinations ?? [];
    void this.ui.choose(t.question, [...dests.map((d) => d.label), t.stay]).then((i) => {
      const dest = dests[i];
      if (!dest) return;
      const problem = this.session.busProblem(dest.id);
      if (problem) return this.ui.problem(problem);
      if (this.ridingBus) return;
      void this.rideBus().then(() => this.session.takeBus(dest.id));
    });
  }

  /**
   * O ônibus chega pela rua e para na frente dela (ela fica atrás dele, na calçada), ela some, e ele vai embora pela
   * outra ponta. Arte: data/world.json bus.vehicle (sem ela, o furgão do correio faz o papel).
   */
  private async rideBus(): Promise<void> {
    this.ridingBus = true;
    this.player.stop?.();
    const ts = this.map.tileSize;
    // Encosta no meio-fio, logo na frente dos pés dela (assim ele a cobre inteira).
    const curbY = Math.min(this.map.rows * ts - 4, this.player.y + 10);
    const art = this.textures.exists('bus_left') ? 'bus_left' : 'van_left';
    const scale = art === 'bus_left' ? (this.session.content.world.bus?.vehicle?.scale ?? 0.5) : (this.session.content.delivery.van.scale ?? 1);
    const bus = this.add.image(this.map.cols * ts + 160, curbY, art).setOrigin(0.5, 1).setScale(scale).setDepth(Math.max(ySortDepth(curbY), this.player.depth + 1));
    this.vanObjects.push(bus);
    await this.tweenTo(bus, this.player.x, 2200);
    await this.wait(500);
    this.tweens.add({ targets: this.player, alpha: 0, duration: 300 });
    await this.wait(700);
    await this.tweenTo(bus, -160, 2200);
    bus.destroy();
    this.ridingBus = false;
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

  /** Festa no café e ela na porta da rua: sair encerra a festa (os convidados vão embora); senão, fica. */
  private askEndParty(): void {
    this.doorLocked = true;
    const t = uiText.party;
    void this.ui.confirm(this.session.partyGiftPending() ? t.questionNoGift : t.question, t.yes, t.no).then((yes) => {
      if (yes) this.session.endFestiveParty();
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
    this.endMovePick(); // os desenhos dos móveis vão ser refeitos (o pisca sairia do lugar)
    this.map =resolveMap(this.session.mapData(mapId), this.session.content.catalog);
    this.shownVariantNight = this.session.variantNight();
    // As luzes: as do mapa e uma em cada lâmpada (posicionou ou mudou um abajur: a luz vai junto).
    this.dayNight.setLights(this.session.mapLights(mapId), this.map.tileSize);
    const ts = this.map.tileSize;

    this.mapImages?.destroy(true);
    this.mapImages = this.add.group();
    this.objectImages.clear();
    for (const s of this.map.sprites) {
      const img = addTileImage(this, s.col * ts, s.row * ts - (s.dy ?? 0), s.sheet, s.frame).setDepth(s.depth);
      // Móvel com outra cor (o mesmo desenho, ex.: os automáticos): giro de cor do item.
      if (s.obj?.startsWith(PLACED_PREFIX)) {
        const placed = this.session.state.placed.find((p) => PLACED_PREFIX + p.uid === s.obj);
        applyHue(img, placed ? this.session.content.items[placed.item]?.hue : undefined);
      }
      this.mapImages.add(img);
      if (s.obj) this.objectImages.set(s.obj, [...(this.objectImages.get(s.obj) ?? []), img]);
    }
    this.drawSnowCaps(ts);
    this.buildPenFronts();
    // Luz e sombra de ambiente: refeitas junto com o mapa (inclui os móveis colocados).
    const { content } = this.session;
    // O céu das janelas abertas (as que jogam luz) segue a hora de fora: à noite, o vidro escurece.
    const indoorMap = content.maps[this.map.id]?.lighting === 'indoor';
    const glass = indoorMap ? this.map.sprites.filter((s) => s.obj && content.dayNight.ambience.windowTiles.includes(s.tile)) : [];
    this.dayNight.setWindowGlass(glass.map((s) => ({ x: s.col * ts, y: s.row * ts - (s.dy ?? 0), sheet: s.sheet, frame: s.frame })));
    this.ambience?.setAmbience(ambienceOf(this.session.mapData(mapId), content.catalog, content.dayNight.ambience, content.maps[this.map.id]?.lighting === 'indoor'));

    this.solidCollider?.destroy();
    this.solids?.destroy(true);
    this.solids = this.physics.add.staticGroup();
    // Paredes inteiras; a base dos móveis só na parte de baixo da célula (world.objectBaseDepth): ela passa por trás.
    for (const b of solidBoxes(this.session.mapData(mapId), this.session.content.catalog, this.session.content.world.objectBaseDepth)) {
      this.solids.add(this.add.zone(b.x + b.w / 2, b.y + b.h / 2, b.w, b.h));
    }
    this.solidCollider = this.physics.add.collider(this.player, this.solids);
    // Potes e caminhas: só ela não atravessa (os gatos comem em volta e deitam na caminha).
    this.playerSolidCollider?.destroy();
    this.playerSolids?.destroy(true);
    this.playerSolids = this.physics.add.staticGroup();
    const { world } = this.session.content;
    for (const b of playerBlockBoxes(this.session.mapData(mapId), this.session.content.catalog, world.playerBlockTiles ?? [], world.objectBaseDepth)) {
      this.playerSolids.add(this.add.zone(b.x + b.w / 2, b.y + b.h / 2, b.w, b.h));
    }
    this.playerSolidCollider = this.physics.add.collider(this.player, this.playerSolids);
    this.catSolids?.destroy(true);
    this.catSolids = this.physics.add.staticGroup();
    for (const b of playerBlockBoxes(this.session.mapData(mapId), this.session.content.catalog, world.catBlockTiles ?? [], world.objectBaseDepth)) {
      this.catSolids.add(this.add.zone(b.x + b.w / 2, b.y + b.h / 2, b.w, b.h));
    }
    this.catColliders.forEach((c) => c.destroy());
    this.catColliders = this.cats.flatMap((cat) => this.catCollidersOf(cat));
    this.roomView ??= new RoomView(this, this.session, ts);
    this.roomView.refresh(mapId === this.session.content.map.id);
    this.robotView ??= new RobotVacuumView(this, this.session);
    this.robotView.refresh(mapId, ts, () => this.map.solid);
  }

  /** Cômodos mudaram: mapa, escuro, câmera e luz de fora. */
  private refreshRooms(): void {
    this.buildMap();
    this.applyCamera();
  }

  /** Clima do dia nas áreas ao ar livre: o mapa inteiro nos mapas da estação (a rua); no café, as áreas abertas (o quintal). */
  private refreshWeather(): void {
    const ts = this.map.tileSize;
    const seasons = this.session.content.seasons;
    const home = this.map.id === this.session.content.map.id;
    const areas = seasons.maps[this.map.id] ? [{ x: 0, y: 0, w: this.map.cols * ts, h: this.map.rows * ts }] : home ? (this.roomView?.outdoorAreas() ?? []) : [];
    this.shownWeather = this.session.weather();
    this.shownWeatherDay = this.session.state.day;
    // As cores podem mudar com a estação (as folhas do vento: rosas e verdes na primavera, verdes no verão, laranjas no outono).
    const fx = seasons.weatherFx?.[this.shownWeather];
    const colors = fx?.seasonColors?.[seasonOf(seasons, this.session.state.day)];
    this.weatherFx.set(fx && colors ? { ...fx, colors } : fx, areas, ts);
  }

  /**
   * Câmera: em mapa maior que a tela, segue a personagem. No café, só até onde ela conhece (os cômodos
   * descobertos); andar entre cômodos é contínuo (sem fade: o fade fica só na porta da fachada).
   */
  private applyCamera(): void {
    const ts = this.map.tileSize;
    const home = this.map.id === this.session.content.map.id;
    // Lugar à parte (o quintal): o que está em volta dele no mapa fica escuro (a sobra da tela não mostra o vizinho).
    this.roomView?.isolate(home ? this.roomView.separateArea(this.feetCell()) : null, Phaser.Display.Color.HexStringToColor(this.map.background ?? '#2b1d1a').color);
    const area = (home && this.roomView?.cameraArea(this.feetCell())) || { x: 0, y: 0, w: this.map.cols * ts, h: this.map.rows * ts };
    const cam = this.cameras.main;
    this.dayNight.setOutdoorAreas(home ? (this.roomView?.outdoorAreas() ?? []) : []);
    this.refreshWeather();
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

  // ---------- Clínica no café: cercadinho e caixinha ----------

  /** Os cercadinhos posicionados neste mapa. */
  private placedPens(): PlacedItem[] {
    if (!this.session.atHome()) return [];
    const item = this.session.content.clinic.pen.item;
    return this.session.state.placed.filter((p) => p.item === item);
  }

  /** A cerca da frente de cada cercadinho, de novo por cima dos gatos lá dentro (a fileira de baixo, da cerca para baixo). */
  private buildPenFronts(): void {
    for (const p of this.placedPens()) {
      const imgs = this.objectImages.get(PLACED_PREFIX + p.uid) ?? [];
      const bottom = Math.max(...imgs.map((i) => i.y));
      for (const img of imgs.filter((i) => i.y === bottom)) {
        const fw = img.frame.width;
        const cut = Math.round(fw * PEN_FENCE_FROM);
        const front = this.add.image(img.x, img.y, img.texture.key, img.frame.name).setOrigin(0).setScale(img.scaleX).setCrop(0, cut, fw, img.frame.height - cut).setDepth(img.depth + 2);
        this.mapImages?.add(front);
      }
    }
  }

  /**
   * A cada quadro: internado some; isolado (esperando a consulta ou se recuperando) fica numa vaga do cercadinho
   * (sentado ou dormindo) ou, sem vaga, na caixinha num canto; quem volta para a turma é solto na frente do cercadinho.
   */
  private layoutClinicCats(): void {
    if (!this.session.atHome()) return;
    const ts = this.map.tileSize;
    const carried = this.session.service.carriedCat();
    const a = this.session.penAssignments();
    const slots = new Map<string, { x: number; y: number; depth: number }>();
    for (const p of this.placedPens()) {
      const depth = Math.max(...(this.objectImages.get(PLACED_PREFIX + p.uid) ?? []).map((i) => i.depth)) + 1;
      (a.pen[p.uid] ?? []).forEach((id, i) => slots.set(id, { x: p.at[0] * ts + PEN_SLOTS_X[i % PEN_SLOTS_X.length]!, y: p.at[1] * ts + PEN_FEET_Y, depth }));
    }
    const inBox = new Set(a.box);
    for (const cat of this.cats) {
      const id = cat.catId;
      if (id === carried) continue;
      const place = this.session.catPlace(id);
      const body = cat.body as Phaser.Physics.Arcade.Body;
      if (place === 'with_others') {
        if (this.clinicHeld.delete(id)) {
          // Saiu do cercadinho (ou voltou da clínica): solto num lugar livre perto de onde estava.
          const [c, r] = this.freeCellNear(cat.cell(), createRng(cellHash(id.length, ts)));
          body.enable = true;
          cat.setPosition(c * ts + ts / 2, (r + 1) * ts - 6).setVisible(true);
          body.reset(cat.x, cat.y);
        }
        continue;
      }
      this.clinicHeld.add(id);
      body.enable = false;
      cat.setVelocity(0, 0);
      const slot = slots.get(id);
      if (place === 'ward' || !slot) cat.setVisible(false);
      else {
        cat.setVisible(true).setPosition(slot.x, slot.y).setDepth(slot.depth);
        // Esperando a consulta: sentado; voltou da cirurgia: dormindo.
        const anim = `${catTexture(this.session.catDef(id)?.variant ?? '')}-${this.session.state.cats[id]?.clinic?.stage === 'isolation' ? 'sleep' : 'sit'}`;
        if (cat.anims.currentAnim?.key !== anim) cat.play(anim, true);
      }
      if (place === 'isolated' && inBox.has(id) && !this.isoBoxes.has(id)) this.isoBoxes.set(id, this.boxImage(id));
    }
    for (const [id, img] of this.isoBoxes) {
      if (inBox.has(id) && id !== carried) continue;
      img.destroy();
      this.isoBoxes.delete(id);
    }
  }

  /** A caixinha de um gato que espera sem cercadinho, num canto livre do salão. */
  private boxImage(catId: string): Phaser.GameObjects.Image {
    const ts = this.map.tileSize;
    const box = clinicBoxTile()!;
    const [c, r] = this.boxSpots.get(catId) ?? this.freeCellNear(this.map.spawn, createRng(cellHash(catId.length * 7, this.isoBoxes.size + 3)));
    const bottom = (r + 1) * ts;
    return this.add.image((c + 0.5) * ts, bottom, box.sheet, box.frame).setOrigin(0.5, 1).setScale(tileScale(box.sheet)).setDepth(ySortDepth(bottom));
  }

  /** O cercadinho ao alcance dela (ou o da célula clicada). */
  private penNear(target?: Cell): string | null {
    const feet = this.playerCells();
    const near = (cells: Cell[]) => cells.some((c) => (!target || (c[0] === target[0] && c[1] === target[1])) && feet.some((f) => Math.max(Math.abs(f[0] - c[0]), Math.abs(f[1] - c[1])) <= 1));
    for (const p of this.placedPens()) {
      const cells: Cell[] = [];
      for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 3; dx++) cells.push([p.at[0] + dx, p.at[1] + dy]);
      if (near(cells)) return p.uid;
    }
    return null;
  }

  /**
   * A caixinha de transporte no colo (castrado sem vaga): perto do cercadinho, o gato sai dela e vai para lá; longe,
   * ela põe a caixinha no chão, na frente dela (ele continua dentro).
   */
  private putDownBoxedCat(catId: string, target?: Cell): boolean {
    const pen = this.penNear(target);
    if (pen) {
      const r = this.session.releaseIntoPen(pen);
      if (!r.ok) this.ui.problem(r.reason as Parameters<GameUi['problem']>[0]);
      return true;
    }
    const ahead = target ?? this.facingCell();
    const free = this.map.solid[ahead[1]]?.[ahead[0]] === false && !this.session.placedAt(ahead);
    const r = this.session.service.putDownCat();
    if (!r.ok) {
      this.ui.problem(r.reason as Parameters<GameUi['problem']>[0]);
      return true;
    }
    this.boxSpots.set(catId, free ? ahead : this.feetCell());
    return true;
  }

  /**
   * Gato com doença que passa (a Fungadinha) no colo: perto do cercadinho com vaga, vai para lá (isolado); longe, o
   * aviso com a escolha: colocar no cercadinho (se algum tem vaga) ou deixar na caixinha (isolado, na frente dela), ou
   * soltar com a turma (pode passar a doença).
   */
  private putDownSickCat(catId: string, target?: Cell): boolean {
    const pen = this.penNear(target);
    if (pen && (this.session.penAssignments().pen[pen]?.length ?? 0) < this.session.content.clinic.pen.slots) {
      const r = this.session.putDownSick(true);
      if (!r.ok) this.ui.problem(r.reason as Parameters<GameUi['problem']>[0]);
      return true;
    }
    const t = uiText.health;
    const name = this.session.catName(catId);
    const disease = this.session.content.health.diseases.find((d) => d.id === this.session.state.cats[catId]?.sickness?.disease)?.name ?? '';
    const ahead = target ?? this.facingCell();
    const free = this.map.solid[ahead[1]]?.[ahead[0]] === false && !this.session.placedAt(ahead);
    const at = free ? ahead : this.feetCell();
    // Algum cercadinho com vaga: a opção é ele (o isolado vai sozinho para a vaga); sem vaga, a caixinha.
    const slots = this.session.content.clinic.pen.slots;
    const penRoom = Object.values(this.session.penAssignments().pen).some((cats) => cats.length < slots);
    void this.ui.choose(catSexText(this.session, t.sickDrop, catId).replace('{cat}', name).replace('{disease}', disease), [penRoom ? t.sickDropPen : t.sickDropBox, t.sickDropFree]).then((i) => {
      if (i !== 0 && i !== 1) return;
      const r = this.session.putDownSick(i === 0);
      if (!r.ok) return this.ui.problem(r.reason as Parameters<GameUi['problem']>[0]);
      if (i === 0 && !penRoom) this.boxSpots.set(catId, at);
      else {
        this.dropCat(catId, at);
        this.ui.toast(catSexText(this.session, t.sickFreed, catId).replace('{cat}', name).replace('{disease}', disease), 4000);
      }
    });
    return true;
  }

  /** E no cercadinho (ou na caixinha do canto): com a latinha, alimenta quem está lá; de mãos livres, pega um gato. */
  private penInteract(target?: Cell): boolean {
    const choice = this.penChoice(target);
    return choice ? this.penDo(choice) : false;
  }

  /**
   * O que o E faz no cercadinho (ou na caixinha) ao alcance: alimentar (alguém com fome e a latinha na mochila), avisar
   * que ninguém precisa (com a latinha ativa) ou pegar um gato (mãos livres: quem precisa ir à clínica primeiro). null:
   * nada (longe, ou com algo na mão: o E segue para o gato, o remédio escondido do pós-cirurgia).
   */
  private penChoice(target?: Cell): { where: string; boxCat?: string; act: 'feed' | 'nobody' | 'pick'; pick?: string; hint: EPlan['hint'] } | null {
    if (!this.session.atHome()) return null;
    const feet = this.playerCells();
    const ts = this.map.tileSize;
    const near = (cells: Cell[]) => cells.some((c) => (!target || (c[0] === target[0] && c[1] === target[1])) && feet.some((f) => Math.max(Math.abs(f[0] - c[0]), Math.abs(f[1] - c[1])) <= 1));
    const a = this.session.penAssignments();
    let where: string | null = this.penNear(target);
    // A caixinha ao alcance: pega aquela (com várias no chão, a que está perto dela).
    let boxCat: string | undefined;
    if (!where) for (const [id, img] of this.isoBoxes) if (!boxCat && near([[Math.floor(img.x / ts), Math.floor((img.y - 1) / ts)]])) (where = 'box'), (boxCat = id);
    if (!where) return null;
    const st = this.session.state;
    // A dica: em cima da caixinha, do gato ou do cercadinho.
    const boxTop = (id: string) => {
      const img = this.isoBoxes.get(id);
      return img ? { x: img.x, y: img.y - img.displayHeight - 4 } : null;
    };
    const penTop = () => {
      const p = this.placedPens().find((x) => x.uid === where);
      return p ? { x: (p.at[0] + 1.5) * ts, y: p.at[1] * ts } : null;
    };
    const spot = (kind: HintKind, catId?: string) => {
      const sprite = catId ? this.cats.find((c) => c.catId === catId && c.visible) : undefined;
      if (sprite) return this.hintCat(sprite, kind);
      const at = (catId ? boxTop(catId) : null) ?? (boxCat ? boxTop(boxCat) : null) ?? penTop();
      return at ? { ...at, kind } : null;
    };
    // A latinha vem da mochila: com alguém com fome lá, o E alimenta; senão (todos comeram), pega o gato.
    if (this.session.canFeedIsolated(where)) return { where, boxCat, act: 'feed', hint: spot('pen_feed') };
    if (this.session.activeItem() === this.session.content.clinic.pen.food) return { where, boxCat, act: 'nobody', hint: null };
    // Remédio (ou outra ferramenta) ativo: o E segue para o gato (o remédio escondido do pós-cirurgia).
    if (st.hands.length > 0 || st.tray || this.session.holdingMedicine() || this.session.careGameInHand()) return null;
    // De mãos livres: pega quem precisa ir à clínica primeiro (consulta ou pontinho), senão o primeiro.
    const cats = where === 'box' ? a.box : (a.pen[where] ?? []);
    const urgent = cats.find((id) => { const c = st.cats[id]?.clinic; return c?.stage === 'intake' || (c?.stage === 'isolation' && c.complication); });
    const pick = boxCat ?? urgent ?? cats[0];
    if (!pick) return null;
    return { where, boxCat, act: 'pick', pick, hint: spot('cat_pickup', pick) };
  }

  private penDo(choice: { where: string; boxCat?: string; act: 'feed' | 'nobody' | 'pick'; pick?: string }): boolean {
    if (choice.act === 'feed') {
      // Um por vez: o da caixinha que ela escolheu, ou o próximo com fome do cercadinho.
      const r = this.session.feedIsolated(choice.where, choice.boxCat);
      if (!r.ok) this.ui.problem(r.reason as Parameters<GameUi['problem']>[0]);
      else {
        const t = uiText.problems;
        const left = this.session.hungryIsolated(choice.where).length;
        const name = this.session.catName(r.fed[0]!);
        this.ui.toast((left > 0 ? t.recoveryMore : t.recoveryFed).replace('{cat}', name).replace('{n}', String(left)), 3000);
      }
      return true;
    }
    if (choice.act === 'nobody') {
      this.ui.problem('nobody_here');
      return true;
    }
    const r = this.session.service.pickUpCat(choice.pick!);
    if (!r.ok) this.ui.problem(r.reason as Parameters<GameUi['problem']>[0]);
    return true;
  }

  /** Põe um gato no mapa atual, perto de `near` (ou num lugar livre qualquer). */
  private spawnCat(catId: string, near?: Cell): void {
    const state = this.session.state.cats[catId];
    const def = this.session.catDef(catId);
    if (!state || !def || state.map !== this.map.id) return;
    const rng = createRng(cellHash(catId.length, this.cats.length + 1) ^ 0x9e37);
    const [c, r] = this.freeCellNear(near ?? this.map.spawn, rng);
    const ts = this.map.tileSize;
    const cat = new CatSprite(this, catId, def.variant, c * ts + ts / 2, (r + 1) * ts - 6, rng, ts, () => this.catWalkGrid(), this.catPlaces);
    this.cats.push(cat);
    this.catColliders.push(...this.catCollidersOf(cat));
  }

  /** Onde o gato passeia à toa: o chão livre, sem os potes (ele só vai até o pote para comer). */
  private catWalkGrid(): boolean[][] {
    const tiles = this.session.content.world.catBlockTiles ?? [];
    const grid = this.map.solid.map((row) => [...row]);
    for (const o of this.session.mapData(this.map.id).objects) if (tiles.includes(o.tile) && grid[o.at[1]]) grid[o.at[1]]![o.at[0]] = true;
    return grid;
  }

  /** Paredes e móveis; os potes, menos quando ele vai comer (a cabeça vai até o pote); e ela. */
  private catCollidersOf(cat: CatSprite): Phaser.Physics.Arcade.Collider[] {
    return [this.physics.add.collider(cat, this.solids!), this.physics.add.collider(cat, this.catSolids!, undefined, () => !cat.eating(this.time.now)), this.playerCatCollider(cat)];
  }

  /** Ela não atravessa o gato (nem ele a ela): fora do colo (escondido) e de roteiros. */
  private playerCatCollider(cat: CatSprite): Phaser.Physics.Arcade.Collider {
    return this.physics.add.collider(this.player, cat, undefined, () => cat.visible && !this.scripts.isRunning());
  }

  /** Os objetos dos gatos neste mapa (caminha, arranhador, árvore...) e os lugares ocupados (um gato por lugar). */
  private readonly catPlaces: CatPlaces = {
    spots: () => catSpots(this.session.mapData(this.map.id).objects, this.session.content.catalog.tiles, catObjectUses, this.map.solid, this.map.tileSize),
    taken: new Set<string>(),
  };

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
    // Começa na frente dela (dá para levar com as setas); mexendo o mouse, o fantasma vai para o cursor.
    const [fc, fr] = this.feetCell();
    this.placing = { itemId, ghosts, at: [fc, Math.max(0, fr + 1 - (def.h - 1))] };
    this.ui.setHint('placing');
    this.refreshGhost();
  }

  /**
   * Tecla de ação, uma vez por toque. O Phaser às vezes entrega o mesmo keydown de novo ao soltar a tecla
   * (apertar e soltar no mesmo quadro): sem isto, um toque rápido no C abria e fechava o Market.
   */
  private onKey(key: string, fn: () => void): void {
    // O botão de toque da mesma tecla faz o mesmo (só com o mundo ativo: num mini game, os botões são do jogo).
    if (['E', 'I', 'C', 'M', 'P', 'F', 'ESC'].includes(key)) touch.on(key as TouchAction, () => this.scene.isActive() && !this.miniGameOpen && fn());
    let last: KeyboardEvent | null = null;
    this.input.keyboard!.on(`keydown-${key}`, (e: KeyboardEvent) => {
      if (e === last) return;
      last = e;
      fn();
    });
  }

  /** Botão direito (ou F) num móvel do café: muda de lugar sem passar pela mochila; o que está em cima vai junto. */
  private startMoving(uid: string, fromKeys = false): void {
    this.endMovePick();
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
    this.ui.setHint(this.isTree(uid) ? 'movingTree' : 'moving');
    // Pelo teclado, o fantasma começa no lugar do móvel; pelo mouse, no cursor.
    if (fromKeys) this.refreshGhost();
    else this.moveGhost(this.input.activePointer);
  }

  // ---------- Assistência técnica: escolher o móvel para trocar ----------

  /** Escolhendo o móvel da assistência (os que têm troca brilham). */
  private pickingUpgrade = false;

  startUpgradePick(): void {
    if (!this.session.atHome()) return this.ui.toastText('notHome');
    this.cancelPlacing();
    this.pickingUpgrade = true;
    this.ui.setHint('upgradePick');
    this.tintUpgradable(true);
  }

  /** Termina a escolha: com um móvel, abre o Market nas trocas dele. */
  private finishUpgradePick(uid: string | null): void {
    this.pickingUpgrade = false;
    this.tintUpgradable(false);
    this.ui.setHint('walk');
    if (uid) this.ui.openUpgrade(uid);
  }

  /** Os móveis com troca brilham enquanto ela escolhe. */
  private tintUpgradable(on: boolean): void {
    for (const p of this.session.state.placed) {
      if (this.session.upgradeOptions(p.uid).length === 0) continue;
      this.objectImages.get(PLACED_PREFIX + p.uid)?.forEach((img) => {
        this.tweens.killTweensOf(img);
        img.setAlpha(1);
        if (on) this.tweens.add({ targets: img, alpha: 0.45, duration: UPGRADE_BLINK_MS, yoyo: true, repeat: -1 });
      });
    }
  }

  /** O móvel com troca nesta célula (num balcão com cafeteira, o balcão). */
  private upgradableAt(cell: Cell): string | null {
    const placed = this.session.placedAt(cell);
    if (!placed) return null;
    const { items } = this.session.content;
    const host = this.session.hostUnder(placed);
    const uid = (host ?? placed).uid;
    return this.session.upgradeOptions(uid).length > 0 ? uid : null;
  }

  /** E, F ou Enter escolhendo: o móvel com troca da frente dela (ou encostado). */
  private pickUpgradeNear(): void {
    const uid = this.furnitureNearPlayer((id) => this.session.upgradeOptions(id).length > 0);
    if (uid) this.finishUpgradePick(uid);
    else this.ui.problem('no_upgradable_near');
  }

  /** Solta o fantasma onde ele está: posiciona o item novo ou muda o móvel de lugar. */
  private dropPlacing(): void {
    if (!this.placing) return;
    const { itemId, at, moveUid } = this.placing;
    const def = this.ghostDef();
    const result = moveUid ? this.session.move(moveUid, at, this.playerCells()) : this.session.place(itemId, at, this.playerCells());
    if (!result.ok) return this.ui.problem(result.reason);
    // Gato à toa em cima de onde o móvel foi parar (ex.: o cercadinho): sai para o lado, não fica "dentro" dele.
    this.shooCatsFrom(at, def.w, def.h);
    // Da caixa de Natal: posicionou, sai o próximo enfeite (até a caixa esvaziar).
    const chain = !moveUid ? this.placingFromBox : null;
    this.cancelPlacing();
    if (chain && this.session.xmasBoxCount(chain) > 0) this.session.openXmasBox(chain);
    // Caixa do correio com vários móveis: posicionou um, sai o próximo (Esc para; o resto fica na mochila).
    else if (!moveUid && this.parcelQueue.length > 0) {
      const next = this.parcelQueue.shift()!;
      if ((this.session.state.inventory[next] ?? 0) > 0) this.startPlacing(next);
    }
  }

  /** Tira os gatos soltos (não os do cercadinho/caixinha) de cima de um móvel recém-posicionado: a célula livre mais perto. */
  private shooCatsFrom([c0, r0]: Cell, w: number, h: number): void {
    const inside = ([c, r]: Cell) => c >= c0 && c < c0 + w && r >= r0 && r < r0 + h;
    const ts = this.map.tileSize;
    for (const cat of this.cats) {
      if (!cat.visible || this.clinicHeld.has(cat.catId) || !inside(cat.cell())) continue;
      let to: Cell | null = null;
      for (let d = 1; d <= 6 && !to; d++) {
        for (let r = r0 - d; r < r0 + h + d && !to; r++) {
          for (let c = c0 - d; c < c0 + w + d && !to; c++) {
            if (inside([c, r]) || this.map.solid[r]?.[c] !== false || this.session.placedAt([c, r])) continue;
            to = [c, r];
          }
        }
      }
      if (!to) continue;
      cat.setPosition(to[0] * ts + ts / 2, (to[1] + 1) * ts - 6);
      (cat.body as Phaser.Physics.Arcade.Body).reset(cat.x, cat.y);
      cat.stay(800, this.time.now);
    }
  }

  /** Setas com o fantasma na mão: uma célula por toque, sem sair do mapa. */
  private nudgeGhost([dc, dr]: Cell): void {
    if (!this.placing) return;
    const def = this.ghostDef();
    const [c, r] = this.placing.at;
    this.placing.at = [Phaser.Math.Clamp(c + dc, 0, this.map.cols - def.w), Phaser.Math.Clamp(r + dr, 0, this.map.rows - def.h)];
    this.refreshGhost();
  }

  /**
   * O móvel da jogadora que a assistência pega: o da frente dela, senão um encostado nela. Balcão com cafeteira: pega
   * o balcão (ela vai junto).
   */
  private furnitureNearPlayer(accept: (uid: string) => boolean = () => true): string | null {
    for (const cell of this.cellsNearPlayer()) {
      const placed = this.session.placedAt(cell);
      if (!placed) continue;
      const host = this.session.hostUnder(placed);
      const uid = (host ?? placed).uid;
      if (accept(uid)) return uid;
    }
    return null;
  }

  /** As células perto dela, a da frente primeiro. Olhando para cima, também as da parede (quadros, relógio). */
  private cellsNearPlayer(): Cell[] {
    const [c, r] = this.feetCell();
    const dir = this.player.facingDirection();
    const ahead: Cell[] =
      dir === 'up' ? [[c, r - 1], [c, r - 2], [c, r - 3]] : dir === 'down' ? [[c, r + 1]] : dir === 'left' ? [[c - 1, r]] : [[c + 1, r]];
    const around = ([[0, 0], [0, -1], [0, 1], [-1, 0], [1, 0], [-1, -1], [1, -1], [-1, 1], [1, 1]] as const).map(([dc, dr]): Cell => [c + dc, r + dr]);
    return [...ahead, ...around];
  }

  /**
   * Os móveis que o F pode mudar de lugar, o da frente primeiro. Numa célula, cada peça conta: o globo em cima do
   * balcão, o balcão (com o globo) e o tapete embaixo.
   */
  private furnitureCandidates(cells: readonly Cell[] = this.cellsNearPlayer()): string[] {
    const out: string[] = [];
    for (const cell of cells) for (const p of this.session.placedAllAt(cell)) if (!out.includes(p.uid)) out.push(p.uid);
    return out;
  }

  // ---------- Celular: botões e direcional enquanto posiciona ou escolhe ----------

  /** O que os botões de toque mostram agora (só mexe no DOM quando muda). */
  private touchLabels = "";
  /** Quando o direcional andou com o fantasma pela última vez (uma célula por passo, sem disparar). */
  private touchNudgeAt = 0;

  /**
   * No celular não há setas: o direcional leva o fantasma uma célula por passo. E os botões mudam de nome:
   * escolhendo o móvel, Mover vira "Próximo" e E vira "OK"; com o móvel na mão, Mover vira "Soltar".
   */
  private updateTouchPlacing(busy: boolean): void {
    const labels = this.movePick ? "pick" : this.placing ? "place" : "";
    if (labels !== this.touchLabels) {
      this.touchLabels = labels;
      const t = uiText.touch;
      touch.setLabel("F", labels === "pick" ? t.next : labels === "place" ? t.drop : undefined);
      touch.setLabel("E", labels === "pick" ? t.ok : undefined);
    }
    const d = touch.dir;
    const step: Cell | null = d.left ? [-1, 0] : d.right ? [1, 0] : d.up ? [0, -1] : d.down ? [0, 1] : null;
    if (!step) return void (this.touchNudgeAt = 0);
    if (busy || this.time.now - this.touchNudgeAt < TOUCH_NUDGE_MS) return;
    this.touchNudgeAt = this.time.now;
    if (this.placing) this.nudgeGhost(step);
    else if (this.movePick) this.cycleMovePick(step[0] < 0 || step[1] < 0 ? -1 : 1);
  }

  // ---------- Mudar de lugar: escolher o móvel (quando há mais de um perto) ----------

  /** Escolhendo qual móvel mudar de lugar: o destacado pisca; F passa para o próximo, E ou Enter escolhe. */
  private movePick: { uids: string[]; i: number } | null = null;
  /** A seta em cima do móvel escolhido. */
  private pickArrow: Phaser.GameObjects.Graphics | null = null;

  /** Um móvel só: muda de lugar direto. Mais de um: destaca o primeiro para ela escolher. */
  private chooseToMove(uids: string[]): void {
    if (uids.length === 1) return this.startMoving(uids[0]!, true);
    this.cancelPlacing();
    this.movePick = { uids, i: 0 };
    this.player.setVelocity(0, 0);
    this.ui.setHint('movePick');
    this.highlightMovePick();
  }

  private cycleMovePick(by = 1): void {
    if (!this.movePick) return;
    const n = this.movePick.uids.length;
    this.movePick.i = (this.movePick.i + by + n) % n;
    this.highlightMovePick();
  }

  private confirmMovePick(): void {
    const uid = this.movePick?.uids[this.movePick.i];
    this.endMovePick();
    if (uid) this.startMoving(uid, true);
  }

  private endMovePick(): void {
    if (!this.movePick) return;
    this.movePick = null;
    this.highlightMovePick();
    this.ui.setHint('walk');
  }

  /** O escolhido (e o que vai junto com ele) pisca; o resto fica normal. */
  private highlightMovePick(): void {
    const uid = this.movePick?.uids[this.movePick.i];
    const group = uid ? this.session.movingGroup(uid) : [];
    const ids = new Set(group.map((p) => p.uid));
    for (const p of this.session.state.placed) {
      this.objectImages.get(PLACED_PREFIX + p.uid)?.forEach((img) => {
        this.tweens.killTweensOf(img);
        img.setAlpha(1).clearTint();
        if (!ids.has(p.uid)) return;
        img.setTint(PICK_TINT);
        this.tweens.add({ targets: img, alpha: 0.55, duration: UPGRADE_BLINK_MS, yoyo: true, repeat: -1 });
      });
    }
    // A seta: em cima do topo do grupo (o que vai em cima, subido até o tampo), por cima da personagem.
    if (this.pickArrow) this.tweens.killTweensOf(this.pickArrow);
    this.pickArrow?.destroy();
    this.pickArrow = null;
    if (group.length === 0) return;
    const ts = this.map.tileSize;
    const { catalog, items, world } = this.session.content;
    const lift = world.counterLift ?? 0;
    let top = Infinity;
    let cx = 0;
    for (const [i, p] of group.entries()) {
      const def = catalog.tiles[items[p.item]?.tile ?? ""];
      const y = p.at[1] * ts - (i > 0 ? lift : 0);
      if (i === 0) cx = (p.at[0] + (def?.w ?? 1) / 2) * ts;
      top = Math.min(top, y);
    }
    const g = this.add.graphics().setDepth(GHOST_DEPTH + 2);
    g.fillStyle(0x3b2a20, 1).fillTriangle(-9, -14, 9, -14, 0, 0);
    g.fillStyle(PICK_TINT, 1).fillTriangle(-6, -12, 6, -12, 0, -3);
    g.setPosition(cx, top - 2);
    this.tweens.add({ targets: g, y: top - 8, duration: UPGRADE_BLINK_MS, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
    this.pickArrow = g;
  }

  /** Q enquanto muda de lugar: guarda o móvel (e o que está em cima) na mochila; árvore do quintal: remove (pergunta). */
  private storeMoving(): void {
    const uid = this.placing?.moveUid;
    if (!uid) return;
    if (this.isTree(uid)) {
      const t = uiText.trees;
      void this.ui.confirm(t.removeAsk, t.yes, t.no).then((yes) => {
        if (!yes) return;
        const r = this.session.removeTree(uid);
        if (!r.ok) return this.ui.problem(r.reason);
        this.cancelPlacing();
        this.ui.toast(t.removed);
      });
      return;
    }
    const r = this.session.storePlaced(uid);
    if (!r.ok) return this.ui.problem(r.reason);
    this.cancelPlacing();
  }

  /** Uma árvore do quintal (tag tree): Q remove em vez de guardar. */
  private isTree(uid: string): boolean {
    const p = this.session.state.placed.find((x) => x.uid === uid);
    return !!p && !!this.session.content.items[p.item]?.tags.includes('tree');
  }

  private cancelPlacing(): void {
    this.endMovePick();
    this.placing?.ghosts.forEach((g) => g.destroy());
    this.placing?.riders?.forEach((r) => r.ghosts.forEach((g) => g.destroy()));
    if (this.placing?.moveUid) for (const imgs of this.objectImages.values()) imgs.forEach((img) => img.setAlpha(1));
    this.placing = null;
    this.placingFromBox = null;
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
    if (this.ui.isBusy() || this.areaSelect) return;
    if (this.pickingUpgrade) {
      // Assistência: o clique escolhe o móvel (botão direito cancela).
      if (pointer.rightButtonDown()) return this.finishUpgradePick(null);
      const uid = this.upgradableAt(this.cellAt(pointer));
      if (uid) this.finishUpgradePick(uid);
      else this.ui.problem('no_upgrade');
      return;
    }
    if (this.movePick) {
      // Escolhendo: clicar numa peça da lista escolhe ela; fora (ou botão direito), cancela.
      const uid = this.furnitureCandidates([this.cellAt(pointer)]).find((u) => this.movePick!.uids.includes(u));
      this.endMovePick();
      if (uid && !pointer.rightButtonDown()) this.startMoving(uid);
      return;
    }
    // Toque ou clique em cima de uma sujeira que a vassoura limpa: ela vem primeiro (a teia em cima do armário não abre
    // a despensa).
    const tapped = !pointer.rightButtonDown() && !this.placing && this.session.atHome() ? this.session.dirtAt(this.cellAt(pointer)) : undefined;
    if (tapped && !tapped.clearedBy && !tapped.heavy) {
      if (this.sweeping) return;
      const problem = this.session.cleanProblem(tapped.id, this.playerCells());
      if (problem) return this.ui.problem(problem);
      void this.sweep(tapped.id, pointer.worldX, pointer.worldY);
      return;
    }
    if (!pointer.rightButtonDown() && !this.placing && this.interact(this.cellAt(pointer))) return;
    if (!this.session.atHome()) return;
    if (this.placing) {
      if (pointer.rightButtonDown()) return this.cancelPlacing();
      this.moveGhost(pointer);
      this.dropPlacing();
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
      // Botão direito: mudar o móvel de lugar (o que está em cima vai junto; Q guarda na mochila). Com mais de uma peça
      // na célula (o globo em cima do balcão), destaca para ela escolher (F passa, E ou clique escolhe).
      const uids = this.furnitureCandidates([this.cellAt(pointer)]);
      if (uids.length === 1) this.startMoving(uids[0]!);
      else if (uids.length > 1) this.chooseToMove(uids);
    }
  }

  /** Sujeira perto dela (pontos do mundo), recalculada de tempos em tempos para o HUD não cobrir. */
  private dirtNear: { x: number; y: number }[] = [];
  private dirtFadeAt = -Infinity;

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
    // A sujeira perto dela não fica escondida: o HUD e o balão ficam transparentes em cima dela.
    if (this.time.now - this.dirtFadeAt >= DIRT_FADE_EVERY_MS) {
      this.dirtFadeAt = this.time.now;
      const ts = this.map.tileSize;
      const [fc, fr] = this.feetCell();
      const { catalog } = this.session.content;
      this.dirtNear = this.session.atHome()
        ? this.session.visibleDirt().filter((d) => catalog.tiles[d.tile]).flatMap((d) => cellsOf(d.at, catalog.tiles[d.tile]!)).filter(([c, r]) => Math.max(Math.abs(c - fc), Math.abs(r - fr)) <= DIRT_FADE_CELLS).map(([c, r]) => ({ x: (c + 0.5) * ts, y: (r + 0.5) * ts }))
        : [];
    }
    this.ui.updateHudFade(points, feet, this.dirtNear.map((d) => toClient(d.x, d.y)));
  }

  /** Cor do momento sobre o mundo e relógio no HUD. */
  /** Sombras de quem anda e a luz das janelas pela hora (de dia forte, à noite some). */
  private updateAmbience(): void {
    const { content } = this.session;
    const sh = content.dayNight.ambience.actorShadow;
    // Sentada no sofá: sem sombra no chão (os pés estão escondidos).
    const actors: AmbienceActor[] = [{ x: this.player.x, y: this.player.y - 1, w: sh.person, visible: this.player.visible && !this.session.resting() }];
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
    // Noite de Natal: o café com as luzes acesas (a cor de dentro de uma hora clara); a rua segue a noite.
    const lit = indoor && this.map.id === content.map.id ? this.session.cafeLightsAs() : null;
    const color = tintAt(lit ?? t, content.dayNight, season, indoor);
    // Dia de evento montado no quintal: a noite lá fora mais clara (as luzes da festa).
    const out = indoor ? tintAt(t, content.dayNight, season, false) : undefined;
    const lift = this.session.outdoorNightLift();
    const outdoor = out && lift > 0 ? (out.map((v) => Math.round(v + (255 - v) * lift)) as typeof out) : out;
    this.dayNight.update(color, outdoor, lightsFloor(content.dayNight.lightsOn, t));
    this.ui.setClock(formatClock(t));
    // Anoiteceu (ou amanheceu): as peças com arte de noite (o céu do quintal) trocam.
    if (this.session.atHome() && !this.changingMap && this.session.variantNight() !== this.shownVariantNight) this.buildMap();
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
    touch.setHidden(false);
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

  /**
   * Interage com o que estiver ao alcance (E: o plano do planE, o mesmo da dica) ou só com a célula clicada. Devolve
   * se fez algo.
   */
  private interact(target?: Cell): boolean {
    if (!target) return this.planE()?.run() ?? false;
    // Clique ou toque: vale o que foi clicado.
    if (this.talkToBuilder(target)) return true;
    if (this.trySantaGive(target)) return true;
    if (this.tryHalloweenGive(target)) return true;
    if (this.tryPartyChat(target)) return true;
    if (this.tryNeighborChat(target)) return true;
    if (this.parcelInteract(target)) return true;
    if (this.penInteract(target)) return true;
    if (this.session.atHome() && this.serviceInteract(target)) return true;
    const point = this.session.jobPointNear(this.playerCells(), target);
    if (point) return this.useJobPoint(point);
    // Clique num ponto de pedido de longe: avisa em vez de não fazer nada.
    if (this.session.jobPointAt(target)) {
      this.ui.problem('too_far');
      return true;
    }
    const it = this.session.interactionAt(this.playerCells(), target);
    if (it) return this.useInteraction(it);
    const { bowl, box } = this.stationForHand(this.playerCells(), target);
    if (bowl || box) return this.useBowlOrBox(bowl, box);
    return this.trySettleCat(target) || this.tryCareGame(target) || this.tryTreatCat(target) || this.tryPickUpCat(target) || this.tryRest(target);
  }

  /**
   * O que o E faz agora, na ordem de prioridade. A dica mostra o `hint` deste plano e o E roda o `run`: uma decisão
   * só, então os dois nunca discordam. Coisa nova no E entra aqui (e em interact, para o clique). null: nada por perto.
   */
  private planE(): EPlan | null {
    const s = this.session;
    const ts = this.map.tileSize;
    const feet = this.playerCells();
    const plan = (hint: EPlan['hint'], run: () => boolean): EPlan => ({ hint, run });
    // Antes de tudo: o Tião na obra, os convidados e vizinhos, as caixas da entrega na porta ou nas mãos.
    if (s.builderNear(feet)) {
      const at = s.builderAt(s.location())!.at;
      return plan({ x: (at[0] + 0.5) * ts, y: (at[1] - 1.6) * ts, kind: 'builder' }, () => this.talkToBuilder());
    }
    const guest = this.santaGuestNear();
    if (guest) {
      const [npc, sprite] = guest;
      const chat = s.festivePartyOn() && s.partyHasChat(npc);
      if (s.santaGivingNow() || s.halloweenGivingNow()) {
        const santa = s.santaGivingNow();
        const drawn = (santa ? s.santaRecord() : s.halloweenRecord())?.drawn;
        return plan(this.hintNpc(sprite, npc === drawn ? 'santa_give' : 'party_chat'), () => (santa ? this.trySantaGive() : this.tryHalloweenGive()));
      }
      if (chat) return plan(this.hintNpc(sprite, 'party_chat'), () => this.tryPartyChat());
      if (this.neighborWalks.has(npc) && s.neighborHasChat(npc)) return plan(this.hintNpc(sprite, 'party_chat'), () => this.tryNeighborChat());
    }
    const parcels = s.parcelsNear(feet);
    if (parcels === 'door') return plan(this.hintCell(s.content.delivery.door.at, 'parcels_door'), () => this.parcelInteract());
    if (s.atHome() && s.boxesAt('carried') > 0) return plan(this.hintFloor(this.facingCell(), 'parcel_drop'), () => this.parcelInteract());
    // O resto (sujeira, equipamento, gato, pote, janela, ponto de pedido...): uma regra só, em src/core/eTarget.ts. O que
    // está bem na frente dela vence; no empate, o que combina com a ferramenta na mão; depois o tipo; depois o mais perto.
    return pickETarget(this.eCandidates(), feet, this.feetCell(), this.player.facingDirection());
  }

  /**
   * Tudo o que o E poderia fazer agora ao alcance dela, com as células de cada coisa e o tipo (E_TIER). Coisa nova no
   * E entra aqui (e em interact, para o clique).
   */
  private eCandidates(): ECandidate<EPlan>[] {
    const s = this.session;
    const feet = this.playerCells();
    const out: ECandidate<EPlan>[] = [];
    const add = (cells: readonly Cell[], tier: number, hint: EPlan['hint'], run: () => boolean, extra: { tool?: boolean; sticky?: boolean; weak?: boolean } = {}) => {
      out.push({ cells, tier, ...extra, value: { hint, run } });
    };
    // As caixas da entrega no chão do café: abrir ou carregar.
    if (s.parcelsNear(feet) === 'inside') {
      const box = s.floorBoxNear(feet)!;
      add([box.at], E_TIER.parcels, this.hintCell(box.at, 'parcels_inside'), () => this.parcelInteract());
    }
    // O atendimento do café (cliente, pia, lava-louças, despensa, caixa pet, equipamentos, vitrine, balcão).
    if (s.atHome()) out.push(...this.serviceCandidates());
    // Com a ração ou a areia na mão e o pote pronto, o pote é o óbvio: os gatos em volta dele não tomam o E.
    const handReady = this.handStationReady();
    // Os gatos do café ao lado dela (fora do cercadinho): o que está chegando (confiança) antes dos outros.
    if (s.atHome() && !handReady) {
      const near = (at: Cell) => feet.some((f) => Math.max(Math.abs(f[0] - at[0]), Math.abs(f[1] - at[1])) <= 1);
      for (const cat of this.cats) {
        if (!cat.visible || this.clinicHeld.has(cat.catId) || !near(cat.cell())) continue;
        const kind = this.catHint(cat);
        if (kind) add([cat.cell()], s.catSettling(cat.catId) ? E_TIER.catSettling : E_TIER.cat, this.hintCat(cat, kind), () => this.catAct(cat));
      }
    }
    // O cercadinho (ou a caixinha): a latinha (ferramenta na mão), ou pegar o gato.
    const pen = this.penChoice();
    if (pen) add(this.penCells(pen), E_TIER.pen, pen.hint, () => this.penDo(pen), { tool: pen.act === 'feed', weak: pen.act === 'nobody' });
    // Interação do mapa (a janela, uma plaquinha): a célula dela e a peça inteira (a janela, na cortina).
    const it = s.interactionAt(feet);
    if (it) add(this.interactionCells(it), E_TIER.interaction, this.hintCell(it.at, this.intKind(it)), () => this.useInteraction(it));
    // A sujeira, com a vassoura na mão: toda a que dá para varrer daqui. Sem a vassoura, ela não toma o E de nada.
    if (s.atHome() && s.activeItem() === s.content.world.tools.sweep) {
      const { catalog } = s.content;
      for (const d of s.visibleDirt()) {
        const def = catalog.tiles[d.tile];
        if (!def || d.clearedBy || d.heavy || s.cleanProblem(d.id, feet) !== null) continue;
        add(cellsOf(d.at, def), E_TIER.dirt, this.hintFloor(d.at, 'dirt'), () => this.sweepDirt(d), { tool: true });
      }
    }
    // Ponto de pedido (a decoração da feira, um mini game). O que pede a vassoura na barra: sem ela, nada de dica (só explica).
    const point = s.jobPointNear(feet);
    if (point) {
      const needsTool = s.jobPointProblem(point.id) === 'needs_broom';
      add([point.at], E_TIER.job, needsTool ? null : this.hintCell(point.at, 'job'), () => this.useJobPoint(point), { weak: needsTool });
    }
    // A tigela ou a caixa de areia: com a ração/areia ativa na barra, encher (ou o porquê de não dar); sem, diz o que falta.
    const { bowl, box: litter } = this.stationForHand(feet);
    const station = bowl ?? litter;
    if (station) {
      const supply = bowl ? s.supplyFor('food_bowl') : s.supplyFor('litter_box');
      const at = s.state.placed.find((x) => x.uid === station)!.at;
      const hint = !supply ? null : bowl ? (s.feedProblem(bowl) ? null : this.hintFloor(at, 'bowl')) : s.litterProblem(litter!) ? null : this.hintFloor(at, 'litter');
      // Sem a ração/areia na mão (ou já cheio): só diz o que falta, e perde de qualquer ação de verdade em volta.
      add(this.placedCells(station), supply ? E_TIER.bowl : E_TIER.bowlEmpty, hint, () => this.useBowlOrBox(bowl, litter), { tool: !!supply && !!hint, weak: !hint });
    }
    // Sofá ou cadeira: senta. Sentada, o E levanta (antes de tudo).
    if (s.resting()) add([], 0, null, () => this.tryRest(), { sticky: true });
    else {
      const seat = s.seatNear(feet);
      if (seat) add(this.placedCells(seat), E_TIER.seat, null, () => this.tryRest());
    }
    return out;
  }

  /** As células de uma peça posicionada (pelo uid). */
  private placedCells(uid: string): Cell[] {
    const s = this.session;
    const p = s.state.placed.find((x) => x.uid === uid);
    if (!p) return [];
    const def = s.content.catalog.tiles[s.content.items[p.item]?.tile ?? ''];
    return def ? cellsOf(p.at, def) : [p.at];
  }

  /** As células de uma interação do mapa: o ponto dela e, na cortina, a janela inteira. */
  private interactionCells(it: MapInteraction): Cell[] {
    const { tiles } = this.session.content.catalog;
    const obj = 'curtain' in it.action ? this.map.sprites.find((x) => x.obj === (it.action as { curtain: string }).curtain) : undefined;
    const objDef = obj ? tiles[obj.tile] : undefined;
    const placedObj = obj && objDef ? this.session.mapData().objects.find((o) => o.id === obj.obj) : undefined;
    return [it.at, ...(placedObj && objDef ? cellsOf(placedObj.at, objDef) : [])];
  }

  /** As células do cercadinho (3x2) ou da caixinha escolhida. */
  private penCells(pen: { where: string; boxCat?: string }): Cell[] {
    const ts = this.map.tileSize;
    if (pen.where === 'box') {
      const img = pen.boxCat ? this.isoBoxes.get(pen.boxCat) : undefined;
      return img ? [[Math.floor(img.x / ts), Math.floor((img.y - 1) / ts)]] : [];
    }
    const p = this.placedPens().find((x) => x.uid === pen.where);
    if (!p) return [];
    const cells: Cell[] = [];
    for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 3; dx++) cells.push([p.at[0] + dx, p.at[1] + dy]);
    return cells;
  }


  /** O E neste gato: confiança (o que chegou), cuidado na mão, remédio ou petisco, colo (a mesma ordem do catHint). */
  private catAct(cat: CatSprite): boolean {
    const at = cat.cell();
    return this.trySettleCat(at) || this.tryCareGame(at) || this.tryTreatCat(at) || this.tryPickUpCat(at);
  }

  /** Ponto de pedido: o mini game, a vassoura ou o ponto na hora (ou por que não dá). */
  private useJobPoint(point: NonNullable<ReturnType<GameSession['jobPointNear']>>): boolean {
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

  /** Interação do mapa: loja, prateleira, consulta, porta, cama, horário, cortina ou o mural. */
  private useInteraction(it: MapInteraction): boolean {
    if ('shop' in it.action) this.ui.openShop(it.action.shop);
    else if ('shelf' in it.action) this.ui.openShelf(it.action.shelf, it.action.tags);
    else if ('vet' in it.action) this.ui.openConsult();
    else if ('door' in it.action) this.session.useRoomDoor(it.action.door); // trancada: a fala avisa; com a chave, abre
    else if ('sleep' in it.action) this.askSleep();
    else if ('hours' in it.action) this.ui.showHours(it.action.hours);
    else if ('bus' in it.action) this.askBus();
    else if ('curtain' in it.action) this.session.toggleCurtain(it.action.curtain, it.action.dialogue, it.action.dialogueWhen, it.action.dialogueAlt);
    else this.ui.openNews('board');
    return true;
  }

  private intKind(it: MapInteraction): HintKind {
    return `int_${Object.keys(it.action)[0] as keyof MapInteraction['action'] & string}` as HintKind;
  }

  /**
   * Tigela de ração: a ração ativa vai para a mão, ela despeja e o gato vem comer. Caixa de areia: a areia ativa vai
   * para a mão e ela despeja (automáticos: abastece). Sem dar, diz por quê.
   */
  private useBowlOrBox(bowl?: string, box?: string): boolean {
    if (this.usingItem) return true;
    const ts = this.map.tileSize;
    if (box) {
      const problem = this.session.litterProblem(box);
      if (problem) {
        this.ui.problem(problem);
        return true;
      }
      const litter = this.session.supplyFor('litter_box')!;
      const at = this.session.state.placed.find((p) => p.uid === box)!.at;
      void this.playUse(litter, (at[0] + 0.5) * ts, (at[1] + 0.5) * ts, 'pour').then(() => {
        const result = this.session.refillLitter(box);
        if (!result.ok) this.ui.problem(result.reason);
      });
      return true;
    }
    if (!bowl) return true;
    const problem = this.session.feedProblem(bowl);
    if (problem) {
      this.ui.problem(problem);
      return true;
    }
    const food = this.session.supplyFor('food_bowl')!;
    const placed = this.session.state.placed.find((p) => p.uid === bowl)!;
    void this.playUse(food, (placed.at[0] + 0.5) * ts, (placed.at[1] + 0.5) * ts, 'pour').then(() => {
      const result = this.session.feedFromBowl(bowl);
      if (!result.ok) this.ui.problem(result.reason);
    });
    return true;
  }

  /** Posições da dica: em cima da célula, rente ao chão (a mais perto), acima da cabeça do gato e do NPC. */
  private hintCell([c, r]: Cell, kind: HintKind): EPlan['hint'] {
    const ts = this.map.tileSize;
    return { x: (c + 0.5) * ts, y: r * ts, kind };
  }

  private hintFloor([c, r]: Cell, kind: HintKind): EPlan['hint'] {
    const ts = this.map.tileSize;
    return { x: (c + 0.5) * ts, y: (r + 0.4) * ts, kind };
  }

  /** Nos gatos, um pouco mais alto: o balão de cuidado (careBubbles) fica logo acima da cabeça. */
  private hintCat(c: CatSprite, kind: HintKind): NonNullable<EPlan['hint']> {
    return { x: c.x, y: c.y - c.displayHeight * 0.9 - 12, kind };
  }

  private hintNpc(n: NpcSprite, kind: HintKind): EPlan['hint'] {
    return { x: n.x, y: n.y - n.displayHeight - 4, kind };
  }

  /** Varre esta sujeira (ou diz por que não dá). */
  private sweepDirt(dirt: DirtSpot): boolean {
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


  /** Onde o E agiria agora (o topo do objeto, em pixels) e em que tipo de coisa: a dica do planE. null: sem dica. */
  private eTarget(): { x: number; y: number; kind: HintKind } | null {
    return this.planE()?.hint ?? null;
  }

  /** O que o E faz neste gato agora (a dica), ou null: confiança (o que chegou), cuidado na mão, remédio, petisco, colo. */
  private catHint(cat: CatSprite): HintKind | null {
    const s = this.session;
    if (s.catSettling(cat.catId)) return 'cat_trust';
    const care = s.careGameInHand();
    if (care) return care === 'wand' ? 'cat_wand' : 'cat_brush';
    if (s.holdingMedicine()) return 'cat_medicine';
    if (s.holdingTreat()) return 'cat_treat';
    if (s.state.hands.length === 0 && !s.state.tray) return 'cat_pickup';
    return null;
  }

  /** Balões de cuidado: seguem os gatos visíveis; o que cada um precisa vem da sessão (care.ts). */
  private updateCareBubbles(): void {
    if (this.time.now - this.careCheckedAt >= 500) {
      this.careCheckedAt = this.time.now;
      this.careNeeds = new Map(this.cats.map((c) => [c.catId, this.session.catCare(c.catId)?.needs ?? []]));
    }
    // O balão leva o que ele precisa e o sinal da clínica (operado, doente, doença que passa já diagnosticada); o gato na
    // caixinha (invisível) tem o balão em cima da caixinha.
    const st = this.session.state;
    const status = (id: string): CareStatus | null => {
      const s = st.cats[id];
      return s?.clinic?.stage === 'isolation' ? 'op' : s?.sickness?.treatment && this.session.catContagious(id) ? 'contagious' : s?.sickness ? 'sick' : null;
    };
    const entries = this.cats.flatMap((c) => {
      const box = this.isoBoxes.get(c.catId);
      const at = c.visible ? { x: c.x, y: c.y, depth: c.depth } : box?.active ? { x: box.x, y: box.y - box.displayHeight + ABOVE_BOX, depth: box.depth } : null;
      return at && this.session.atHome() ? [{ catId: c.catId, ...at, needs: this.careNeeds.get(c.catId) ?? [], status: status(c.catId) }] : [];
    });
    this.careBubbles.update(entries);
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

  /** O convidado da ceia ao alcance (célula dos pés dele a até 1 da dela), ou o clicado. */
  private santaGuestNear(target?: Cell): [string, NpcSprite] | undefined {
    const ts = this.map.tileSize;
    const feet = this.playerCells();
    return [...this.npcs].find(([, n]) => {
      const c: Cell = [Math.floor(n.x / ts), Math.floor(n.y / ts)];
      if (target && (target[0] !== c[0] || target[1] !== c[1])) return false;
      return feet.some((f) => Math.max(Math.abs(f[0] - c[0]), Math.abs(f[1] - c[1])) <= 1);
    });
  }

  /**
   * Ceia do amigo secreto, na hora de entregar: E em quem ela tirou abre a escolha dos presentes de Natal da mochila
   * (ou "não trouxe"); sem nenhum presente, ela entrega nada (a turma ri). Em outro convidado: lembra quem é.
   */
  private trySantaGive(target?: Cell): boolean {
    const s = this.session;
    if (!s.santaGivingNow()) return false;
    const guest = this.santaGuestNear(target);
    if (!guest) return false;
    const t = uiText.secretSanta;
    const drawn = s.santaRecord()!.drawn;
    const name = s.content.festive.secretSanta.friends.find((f) => f.npc === drawn)?.name ?? '';
    if (guest[0] !== drawn) {
      if (this.tryPartyChat(target)) return true;
      this.ui.toast(t.otherGuest.replace('{name}', name), 3000);
      return true;
    }
    const options = s.santaGiftOptions();
    if (options.length === 0) {
      s.secretSantaExchange(null);
      return true;
    }
    const labels = [...options.map((id) => s.content.items[id]?.name ?? id), t.giveNone];
    void this.ui.choose(t.giveAsk.replace('{name}', name), labels).then((i) => s.secretSantaExchange(i < options.length ? options[i]! : null));
    return true;
  }

  /**
   * A cada fala: quem está perto dela na cena (até 4 células), parado (sem animação nem caminhada) e fora da plateia
   * da festa, se vira para ela (as cenas deixavam alguém de costas no fim da caminhada).
   */
  private faceTalkers(): void {
    const ts = this.map.tileSize;
    for (const [id, npc] of this.npcs) {
      if (!npc.active || npc.anims.isPlaying || this.crowd.get(id) === npc || this.ambient.get(id) === npc || this.passers.get(id) === npc || this.neighborWalks.has(id)) continue;
      if (this.tweens.getTweensOf(npc).some((t) => t.isPlaying())) continue;
      const dx = this.player.x - npc.x;
      const dy = this.player.y - npc.y;
      if (Math.hypot(dx, dy) > 4 * ts) continue;
      npc.face(Math.abs(dx) >= Math.abs(dy) ? (dx < 0 ? 'left' : 'right') : dy < 0 ? 'up' : 'down');
    }
  }

  // ---------- Neve do inverno por cima das coisas ----------

  /**
   * Inverno ao ar livre (map.snowCaps, a regra geral do núcleo): a neve por cima de cada peça, feita do próprio
   * desenho dela (os quadros da folha montados numa imagem; snowCapPixels segue o contorno de cima). A textura fica
   * guardada pelo desenho (a mesma peça em outro lugar usa a mesma).
   */
  private drawSnowCaps(ts: number): void {
    for (const cap of this.map.snowCaps) {
      const parts = this.map.sprites.filter((s) => s.obj === cap.obj || s.dirt === cap.obj);
      const sheet = parts[0]?.sheet;
      if (!sheet || parts.some((p) => p.sheet !== sheet)) continue;
      const res = sheetResolution(content.catalog, sheet);
      const cell = ts * res;
      const top = Math.min(...parts.map((p) => p.row));
      const cols = Math.max(...parts.map((p) => p.col)) - cap.col + 1;
      const rows = Math.max(...parts.map((p) => p.row)) - top + 1;
      const key = `snowcap:${sheet}:${parts.map((p) => `${p.col - cap.col},${p.row - top},${p.frame}`).join(';')}`;
      if (!this.textures.exists(key)) {
        const canvas = document.createElement('canvas');
        canvas.width = cols * cell;
        canvas.height = rows * cell;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) continue;
        ctx.imageSmoothingEnabled = false;
        for (const p of parts) {
          const f = this.textures.getFrame(sheet, p.frame);
          if (!f) continue;
          ctx.drawImage(f.source.image as CanvasImageSource, f.cutX, f.cutY, f.cutWidth, f.cutHeight, (p.col - cap.col) * cell, (p.row - top) * cell, f.cutWidth, f.cutHeight);
        }
        const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
        const snow = snowCapPixels(pixels, canvas.width, canvas.height, snowCapDepth(canvas.height, res), parts[0]!.frame + 1);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        const image = ctx.createImageData(canvas.width, canvas.height);
        image.data.set(snow);
        ctx.putImageData(image, 0, 0);
        this.textures.addCanvas(key, canvas);
      }
      const img = this.add.image(cap.col * ts, top * ts - cap.dy, key).setOrigin(0).setScale(1 / res).setDepth(cap.depth);
      this.mapImages?.add(img);
      this.objectImages.set(cap.obj, [...(this.objectImages.get(cap.obj) ?? []), img]);
    }
  }

  // ---------- Plateia dos eventos no quintal ----------

  /**
   * No dia do evento (session.festivalCrowd): a plateia aparece no quintal (grupinhos parados, virados uns para os
   * outros, e alguns passeando) e some quando vai embora. De tempos em tempos alguém de um grupinho fala (um balão).
   */
  private updateCrowd(): void {
    if (this.changingMap || this.scripts.isRunning()) return;
    if (this.time.now - this.crowdCheckedAt >= 500) {
      this.crowdCheckedAt = this.time.now;
      const layout = this.session.festivalCrowd(this.map.id);
      if (layout && this.crowd.size === 0) this.spawnCrowd(layout);
      else if (!layout && this.crowd.size > 0) this.clearCrowd();
    }
    if (this.crowdGroups.length === 0 || this.ui.isBusy() || this.time.now < this.crowdTalkAt) return;
    this.crowdTalkAt = this.time.now + CROWD_TALK_EVERY_MS;
    const lines = this.session.content.festivalCrowd?.lines ?? [];
    const group = this.crowdGroups[this.crowdTurn % this.crowdGroups.length]!;
    const id = group[Math.floor(this.crowdTurn / this.crowdGroups.length) % group.length]!;
    const speaker = this.npcs.get(id) === this.crowd.get(id) ? this.crowd.get(id) : undefined;
    const line = lines[this.crowdTurn % Math.max(1, lines.length)];
    this.crowdTurn++;
    if (speaker?.active && line) this.speechBubble(speaker, line, CROWD_TALK_MS);
  }

  private spawnCrowd(layout: NonNullable<ReturnType<GameSession['festivalCrowd']>>): void {
    this.crowdGroups = layout.groups.map((g) => g.map((m) => m.npc));
    for (const group of layout.groups) {
      for (const m of group) {
        if (this.npcs.has(m.npc)) continue;
        this.spawnNpc(m.npc, m.at, m.facing);
        this.crowd.set(m.npc, this.npcs.get(m.npc)!);
      }
    }
    for (const w of layout.walkers) {
      if (this.npcs.has(w.npc)) continue;
      this.spawnNpc(w.npc, w.path[0]!, 'down');
      this.crowd.set(w.npc, this.npcs.get(w.npc)!);
      void this.crowdWander(w.npc, w.path);
    }
  }

  /** Quem passeia vai de um ponto a outro, para um pouco em cada um e recomeça, enquanto a plateia estiver aqui. */
  private async crowdWander(id: string, path: Cell[]): Promise<void> {
    const npc = this.crowd.get(id);
    // Para quando o boneco não é mais o da plateia (um roteiro chamou o mesmo NPC) ou a plateia foi embora.
    for (let i = 1; npc?.active && this.crowd.get(id) === npc && this.npcs.get(id) === npc; i++) {
      await this.npcWalk(id, path[i % path.length]!);
      if (!npc.active) return;
      npc.face('down');
      await new Promise<void>((done) => this.time.delayedCall(CROWD_PAUSE_MS, done));
    }
  }

  private clearCrowd(): void {
    for (const [id, npc] of this.crowd) {
      // Só o boneco da plateia: se um roteiro trocou pelo dele, fica.
      if (this.npcs.get(id) !== npc) continue;
      npc.destroy();
      this.npcs.delete(id);
    }
    this.crowd.clear();
    this.crowdGroups = [];
  }

  // ---------- Movimento na praça e na rua ----------

  /**
   * Das 9h às 21h (data/npcs.json: ambient): na praça, gente sentada nos bancos, nas barracas, em grupinhos e
   * passeando; a cada bloco de horas a turma troca (uns somem devagar, outros aparecem). Na rua, gente atravessando.
   */
  private updateAmbient(): void {
    if (this.changingMap || this.scripts.isRunning()) return;
    if (this.time.now - this.ambientCheckedAt >= 500) {
      this.ambientCheckedAt = this.time.now;
      const layout = this.session.ambientPeople(this.map.id);
      const block = layout?.block ?? null;
      if (block !== this.ambientBlock) {
        this.clearAmbient();
        if (layout) this.spawnAmbient(layout, !this.ambientFresh);
        this.ambientBlock = block;
      }
      this.ambientFresh = false;
      for (const p of this.session.ambientPassersNow(this.map.id)) {
        const key = `${p.npc}@${p.at}`;
        if (this.passesStarted.has(key) || this.npcs.has(p.npc)) continue;
        this.passesStarted.add(key);
        void this.startPasser(p.npc, p.from, p.to);
      }
    }
    if (this.ambientGroups.length === 0 || this.ui.isBusy() || this.time.now < this.ambientTalkAt) return;
    this.ambientTalkAt = this.time.now + AMBIENT_TALK_EVERY_MS;
    const lines = this.session.content.ambient?.lines ?? [];
    const group = this.ambientGroups[this.ambientTurn % this.ambientGroups.length]!;
    const id = group[Math.floor(this.ambientTurn / this.ambientGroups.length) % group.length]!;
    const speaker = this.npcs.get(id) === this.ambient.get(id) ? this.ambient.get(id) : undefined;
    const line = lines[(this.ambientTurn * 7 + this.session.state.day) % Math.max(1, lines.length)];
    this.ambientTurn++;
    if (speaker?.active && line) this.speechBubble(speaker, line, CROWD_TALK_MS);
  }

  /** Um figurante no lugar (aparece devagar quando a turma troca com ela olhando). */
  private placeAmbient(id: string, at: Cell, facing: Facing, fade: boolean): NpcSprite | undefined {
    if (this.npcs.has(id)) return undefined;
    this.spawnNpc(id, at, facing);
    const npc = this.npcs.get(id);
    if (!npc) return undefined;
    this.ambient.set(id, npc);
    if (fade) {
      npc.setAlpha(0);
      this.tweens.add({ targets: npc, alpha: 1, duration: 600 });
    }
    return npc;
  }

  private spawnAmbient(layout: NonNullable<ReturnType<GameSession['ambientPeople']>>, fade: boolean): void {
    const ts = this.map.tileSize;
    for (const s of layout.spots) {
      const npc = this.placeAmbient(s.npc, s.at, s.facing, fade);
      // Sentado no banco: na frente dele (o banco é desenhado pela base, na mesma linha).
      if (npc && s.pose === 'sit' && npc.sit(s.facing)) npc.setDepth(ySortDepth((s.at[1] + 1) * ts) + 1);
    }
    this.ambientGroups = layout.groups.map((g) => g.map((m) => m.npc));
    for (const m of layout.groups.flat()) this.placeAmbient(m.npc, m.at, m.facing, fade);
    for (const w of layout.walkers) if (this.placeAmbient(w.npc, w.path[0]!, 'down', fade)) void this.ambientWander(w.npc, w.path);
  }

  /** Quem passeia pela praça vai de um ponto a outro, parando um pouco em cada, enquanto a turma for a mesma. */
  private async ambientWander(id: string, path: Cell[]): Promise<void> {
    const npc = this.ambient.get(id);
    const ts = this.map.tileSize;
    for (let i = 1; npc?.active && this.ambient.get(id) === npc && this.npcs.get(id) === npc; i++) {
      // Pelas células livres, sem tirar a personagem do caminho (o npcWalk das cenas faz ela dar um passo).
      const route = findPath(this.map.solid, [Math.floor(npc.x / ts), Math.floor(npc.y / ts)], path[i % path.length]!);
      for (const corner of route ? pathCorners(route) : []) {
        if (!npc.active || this.npcs.get(id) !== npc) return;
        await npc.walkTo(corner);
      }
      if (!npc.active) return;
      npc.face('down');
      await new Promise<void>((done) => this.time.delayedCall(CROWD_PAUSE_MS * 2, done));
    }
  }

  /** A turma do bloco vai embora (some devagar); um roteiro que trocou o boneco de alguém fica com o dele. */
  private clearAmbient(): void {
    for (const [id, npc] of this.ambient) {
      if (this.npcs.get(id) !== npc) continue;
      this.npcs.delete(id);
      if (npc.active) void npc.leave();
    }
    this.ambient.clear();
    this.ambientGroups = [];
  }

  /** Alguém atravessa a rua: aparece numa ponta (ou saindo de uma porta), anda até a outra e some. */
  private async startPasser(id: string, from: Cell, to: Cell): Promise<void> {
    const path = findPath(this.map.solid, from, to);
    if (!path) return;
    this.spawnNpc(id, from, to[0] > from[0] ? 'right' : 'left');
    const npc = this.npcs.get(id);
    if (!npc) return;
    this.passers.set(id, npc);
    npc.setAlpha(0);
    this.tweens.add({ targets: npc, alpha: 1, duration: 400 });
    const mine = () => npc.active && this.npcs.get(id) === npc;
    for (const corner of pathCorners(path)) {
      if (!mine()) break;
      await npc.walkTo(corner);
    }
    if (this.passers.get(id) === npc) this.passers.delete(id);
    if (!mine()) return;
    this.npcs.delete(id);
    await npc.leave();
  }

  // ---------- Carros passando na rua ----------

  /**
   * A cada minuto de jogo: os veículos da agenda do dia que entram agora atravessam a rua inteira (data/world.json:
   * traffic). No máximo TRAFFIC_MAX na rua ao mesmo tempo, e o próximo só entra quando o da frente já andou
   * TRAFFIC_GAP (todos na mesma velocidade: a distância se mantém); quem chega sem espaço espera na fila. Nada passa
   * enquanto o furgão do correio entrega ou o ônibus do ponto a leva.
   */
  private updateTraffic(): void {
    const now = Math.floor(this.session.state.time);
    const from = this.trafficMinute;
    this.trafficMinute = now;
    if (this.changingMap) return;
    if (from !== null && now > from) {
      for (const pass of this.session.trafficBetween(this.map.id, from, now)) if (this.trafficQueue.length < TRAFFIC_QUEUE) this.trafficQueue.push({ vehicle: pass.vehicle, dir: pass.dir });
    }
    const next = this.trafficQueue[0];
    if (next && this.trafficRoomFor(next.dir)) {
      this.trafficQueue.shift();
      this.driveBy(next.vehicle, next.dir);
    }
  }

  /** Cabe mais um entrando por este lado: menos de TRAFFIC_MAX na rua e o último a entrar já se afastou da ponta. */
  private trafficRoomFor(dir: 'left' | 'right'): boolean {
    if (this.vanBusy || this.ridingBus || this.trafficImages.length >= TRAFFIC_MAX) return false;
    const width = this.map.cols * this.map.tileSize;
    // A traseira de cada um que vai para o mesmo lado precisa estar a TRAFFIC_GAP da ponta por onde o novo entra.
    return this.trafficImages.every((img) => {
      if (img.getData('dir') !== dir) return true;
      const back = dir === 'left' ? img.x + img.displayWidth / 2 : img.x - img.displayWidth / 2;
      return dir === 'left' ? back < width - TRAFFIC_GAP : back > TRAFFIC_GAP;
    });
  }

  private driveBy(vehicleId: string, dir: 'left' | 'right'): void {
    const def = this.session.content.world.traffic?.vehicles.find((v) => v.id === vehicleId);
    const key = `${vehicleId}:${dir}`;
    if (!def || !this.textures.exists(key)) return;
    const ts = this.map.tileSize;
    const roadY = this.map.rows * ts - 4;
    const img = this.add.image(0, roadY, key).setOrigin(0.5, 1).setScale(def.scale).setDepth(ySortDepth(roadY));
    const half = img.displayWidth / 2 + 8;
    const width = this.map.cols * ts;
    img.x = dir === 'left' ? width + half : -half;
    img.setData('dir', dir);
    this.trafficImages.push(img);
    this.tweens.add({
      targets: img,
      x: dir === 'left' ? -half : width + half,
      duration: ((width + half * 2) / TRAFFIC_SPEED) * 1000,
      onComplete: () => {
        this.trafficImages = this.trafficImages.filter((i) => i !== img);
        img.destroy();
      },
    });
  }

  // ---------- Vizinhos passeando na rua ----------

  /** Os gatos seguem quem passeia; a cada meio segundo, começa o passeio de quem está na hora (um por dia). */
  private updateNeighborWalks(): void {
    for (const f of this.neighborWalks.values()) f.update();
    // Passou perto dela: um balãozinho com aceno (uma vez por passeio; não com fala ou cena na tela).
    if (!this.ui.isBusy() && !this.scripts.isRunning() && !this.changingMap) {
      for (const id of this.neighborWalks.keys()) {
        const npc = this.npcs.get(id);
        if (!npc || this.walkBarked.has(id) || Math.hypot(npc.x - this.player.x, npc.y - this.player.y) > NEIGHBOR_BARK_CELLS * this.map.tileSize) continue;
        this.walkBarked.add(id);
        void this.neighborBark(id, npc);
      }
    }
    if (this.time.now - this.neighborWalksCheckedAt < 500 || this.changingMap || this.scripts.isRunning()) return;
    this.neighborWalksCheckedAt = this.time.now;
    for (const w of this.session.neighborWalksNow(this.map.id)) if (!this.neighborWalks.has(w.npc) && !this.npcs.has(w.npc)) void this.startNeighborWalk(w);
  }

  /** O vizinho entra numa ponta da rua, atravessa (desviando do que for sólido) com os gatos atrás e some na outra. */
  private async startNeighborWalk(w: { npc: string; from: Cell; to: Cell; cats: WalkCat[]; companions: string[] }): Promise<void> {
    this.session.markNeighborWalked(w.npc);
    this.walkBarked.delete(w.npc);
    const free = ([c, r]: Cell): Cell => {
      for (let d = 0; d < 6; d++) for (const [dc, dr] of [[0, 0], [0, -d], [0, d], [d, 0], [-d, 0]] as const) if (this.map.solid[r + dr]?.[c + dc] === false) return [c + dc, r + dr];
      return [c, r];
    };
    const from = free(w.from);
    const to = free(w.to);
    this.spawnNpc(w.npc, from, to[0] > from[0] ? 'right' : 'left');
    const npc = this.npcs.get(w.npc);
    if (!npc) return;
    const companions = w.companions.map((id) => this.session.content.npcs[id]).filter((d): d is NonNullable<typeof d> => !!d);
    const followers = new WalkFollowers(this, npc, w.cats, companions, this.map.tileSize);
    this.neighborWalks.set(w.npc, followers);
    const path = findPath(this.map.solid, from, to);
    // Para se uma cena chamou o mesmo NPC (o boneco dela entra no lugar): o passeio não mexe no boneco da cena.
    const mine = () => npc.active && this.npcs.get(w.npc) === npc;
    for (const corner of path ? pathCorners(path) : [to]) {
      if (!mine()) break;
      await npc.walkTo(corner);
    }
    if (this.neighborWalks.get(w.npc) !== followers) return; // trocou de mapa no meio
    this.neighborWalks.delete(w.npc);
    followers.leave();
    if (!mine()) return;
    this.npcs.delete(w.npc);
    await npc.leave();
  }

  /** O balãozinho do passeio: ela para, vira para a personagem, acena com a fala em cima da cabeça e segue andando. */
  private async neighborBark(id: string, npc: NpcSprite): Promise<void> {
    const text = this.session.neighborBark(id);
    if (!text) return;
    const tweens = this.tweens.getTweensOf(npc);
    tweens.forEach((t) => t.pause());
    const dx = this.player.x - npc.x;
    npc.face(dx < 0 ? 'left' : 'right');
    this.speechBubble(npc, fillNames(this.session, text), NEIGHBOR_BARK_MS);
    await npc.act('acenar', 1100);
    if (!npc.active) return;
    tweens.forEach((t) => t.isPaused() && t.resume());
    npc.resumeWalk();
  }

  /** Balão de fala creme com borda rosa em cima de alguém (acompanha quem fala) por `ms`. */
  private speechBubble(target: Phaser.GameObjects.Sprite, text: string, ms: number): void {
    const label = this.add.text(0, -9, text, { fontFamily: 'Trebuchet MS, sans-serif', fontSize: '9px', color: '#5c3428', resolution: 4, align: 'center', wordWrap: { width: 150 } }).setOrigin(0.5, 1);
    const w = Math.ceil(label.width) + 12;
    const h = Math.ceil(label.height) + 6;
    const g = this.add.graphics();
    g.fillStyle(0xfff4e0, 1).fillRoundedRect(-w / 2, -6 - h, w, h, 5);
    g.lineStyle(1.5, 0xd97890, 1).strokeRoundedRect(-w / 2, -6 - h, w, h, 5);
    g.fillStyle(0xfff4e0, 1).fillTriangle(-4, -6.5, 4, -6.5, 0, -1);
    g.lineStyle(1.5, 0xd97890, 1).lineBetween(-4, -6, 0, -1).lineBetween(4, -6, 0, -1);
    const top = () => target.y - target.displayHeight + 6;
    const bubble = this.add.container(target.x, top(), [g, label]).setDepth(160_000).setAlpha(0);
    const follow = () => bubble.active && target.active && bubble.setPosition(target.x, top());
    this.events.on('update', follow);
    this.tweens.add({ targets: bubble, alpha: 1, duration: 150 });
    this.time.delayedCall(ms, () => {
      this.events.off('update', follow);
      this.tweens.add({ targets: bubble, alpha: 0, duration: 300, onComplete: () => bubble.destroy() });
    });
  }

  /** O vizinho passeando do lado dela (o NPC e a id). */
  private walkerNear(target?: Cell): [string, NpcSprite] | undefined {
    const guest = this.santaGuestNear(target);
    return guest && this.neighborWalks.has(guest[0]) ? guest : undefined;
  }

  /** E em quem passeia: a próxima fala (a primeira do dia dá corações). */
  private tryNeighborChat(target?: Cell): boolean {
    const guest = this.walkerNear(target);
    const line = guest && this.session.neighborChat(guest[0]);
    if (!guest || !line) return false;
    // Para de andar, vira para ela enquanto conversam e segue o passeio depois da fala.
    const npc = guest[1];
    const tweens = this.tweens.getTweensOf(npc);
    tweens.forEach((t) => t.pause());
    const [dx, dy] = [this.player.x - npc.x, this.player.y - npc.y];
    npc.face(Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 'left' : 'right') : dy < 0 ? 'up' : 'down');
    void this.ui.npcSay(guest[0], fillNames(this.session, line)).then(() => {
      tweens.forEach((t) => t.isPaused() && t.resume());
      if (npc.active) npc.resumeWalk();
    });
    return true;
  }

  /** Na festa, E num convidado: a próxima fala dele (data/festive.json: partyChat). */
  private tryPartyChat(target?: Cell): boolean {
    if (!this.session.festivePartyOn()) return false;
    const guest = this.santaGuestNear(target);
    const line = guest && this.session.partyChat(guest[0]);
    if (!guest || !line) return false;
    // Vira para ela antes de falar.
    const [dx, dy] = [this.player.x - guest[1].x, this.player.y - guest[1].y];
    guest[1].face(Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 'left' : 'right') : dy < 0 ? 'up' : 'down');
    void this.ui.npcSay(guest[0], fillNames(this.session, line));
    return true;
  }

  /** Festa de Halloween, na hora do presente: E em quem ela tirou abre a escolha (ou "não trouxe"); em outro, lembra quem é. */
  private tryHalloweenGive(target?: Cell): boolean {
    const s = this.session;
    if (!s.halloweenGivingNow()) return false;
    const guest = this.santaGuestNear(target);
    if (!guest) return false;
    const t = uiText.halloween;
    const drawn = s.halloweenRecord()!.drawn;
    const name = s.content.festive.halloween.friends.find((f) => f.npc === drawn)?.name ?? '';
    if (guest[0] !== drawn) {
      if (this.tryPartyChat(target)) return true;
      this.ui.toast(t.otherGuest.replace('{name}', name), 3000);
      return true;
    }
    const options = s.halloweenGiftOptions();
    if (options.length === 0) {
      s.halloweenExchange(null);
      return true;
    }
    const labels = [...options.map((id) => s.content.items[id]?.name ?? id), t.giveNone];
    void this.ui.choose(t.giveAsk.replace('{name}', name), labels).then((i) => s.halloweenExchange(i < options.length ? options[i]! : null));
    return true;
  }

  /** A caixa da entrega ao alcance (na porta: pega todas; dentro do café: abre uma e o móvel vai para a mão). */
  private parcelInteract(target?: Cell): boolean {
    const parcels = this.session.parcelsNear(this.playerCells(), target);
    if (parcels === 'door') {
      const result = this.session.pickUpParcels();
      if (!result.ok) this.ui.problem(result.reason);
      return true;
    }
    // Carregando caixas no café: solta uma na frente dela (ou na célula clicada).
    if (this.session.atHome() && this.session.boxesAt('carried') > 0) {
      const dropped = this.session.dropParcel(target ?? this.facingCell());
      if (dropped.ok) return true;
      if (parcels !== 'inside') {
        this.ui.problem(dropped.reason);
        return true;
      }
    }
    if (parcels === 'inside') {
      const floorBox = this.session.floorBoxNear(this.playerCells(), target)!;
      const t = uiText.delivery;
      const items = this.session.content.items;
      const names = floorBox.itemIds.map((id) => items[id]?.name ?? id).join(', ');
      void this.ui.choose(t.boxAsk.replace('{name}', names), [t.boxOpen, t.boxCarry, t.boxLeave]).then((i) => {
        if (i === 0) this.openFloorBox(floorBox.box);
        else if (i === 1) {
          const r = this.session.carryParcel(floorBox.box);
          if (!r.ok) this.ui.problem(r.reason);
        }
      });
      return true;
    }
    return false;
  }

  /** Abre a caixa do chão: tudo vai para a mochila e os móveis saem um depois do outro para posicionar. */
  private openFloorBox(box: string): void {
    {
      const result = this.session.unpackParcel(box);
      if (!result.ok) {
        this.ui.problem(result.reason);
        return;
      }
      // Tudo da caixa já está na mochila. Os móveis: ela escolhe posicionar agora (um depois do outro, como tirando da
      // caixa) ou guardar.
      const items = this.session.content.items;
      const furniture = result.itemIds.filter((id) => (items[id]?.kind ?? 'furniture') === 'furniture');
      if (furniture.length > 0) {
        const t = uiText.delivery;
        const names = furniture.map((id) => items[id]?.name ?? id).join(', ');
        void this.ui.choose(t.unpackAsk.replace('{name}', names), [t.unpackPlace, t.unpackStore]).then((i) => {
          if (i !== 0) return this.ui.toast(t.unpackStored.replace('{name}', names));
          this.parcelQueue = furniture.slice(1);
          this.startPlacing(furniture[0]!);
        });
      }
    }
  }


  /** Com a ração ou a areia na mão e o pote/caixa de areia ao alcance (e dá para usar): o óbvio é o pote. */
  private handStationReady(): boolean {
    const { bowl, box } = this.stationForHand(this.playerCells());
    return (!!bowl && !this.session.feedProblem(bowl)) || (!!box && !this.session.litterProblem(box));
  }

  /** Gato que acabou de chegar, perto: o E abre a confiança dele (ele ainda não deixa pegar no colo nem fazer carinho). */
  private trySettleCat(target?: Cell): boolean {
    if (!this.session.atHome()) return false;
    const feet = this.playerCells();
    const near = (at: Cell) => feet.some((f) => Math.max(Math.abs(f[0] - at[0]), Math.abs(f[1] - at[1])) <= 1);
    const cat = this.cats.find((c) => c.visible && !this.clinicHeld.has(c.catId) && this.session.catSettling(c.catId) && near(c.cell()) && (!target || (c.cell()[0] === target[0] && c.cell()[1] === target[1])));
    if (!cat) return false;
    void this.openMiniGame('trust', { difficulty: this.session.settleDifficulty(cat.catId), catId: cat.catId });
    return true;
  }

  /**
   * A fila do pote: um gato por vez vai até o pote (quem comeu hoje, na ordem em que a ração serviu). Com a fila vazia,
   * de tempos em tempos um gato que já comeu volta para beliscar (algumas vezes no dia). Só desenho: quem comeu é o núcleo.
   */
  private updateEatQueue(): void {
    if (this.map.id !== this.session.content.map.id) return;
    const now = this.time.now;
    if (this.cats.some((c) => c.eating(now))) return;
    const st = this.session.state;
    const bowl = st.placed.find((p) => p.uid === this.bowlUid) ?? st.placed.find((p) => stationKind(this.session.content.items[p.item]) === 'food_bowl');
    if (!bowl) return;
    let next = this.eatQueue.shift();
    if (!next && nowAbs(st) >= this.nextSnackAt) {
      const fed = this.cats.filter((c) => st.cats[c.catId]?.fedOn === st.day);
      next = fed.length ? fed[Math.floor(Math.random() * fed.length)]!.catId : undefined;
      this.nextSnackAt = nowAbs(st) + SNACK_EVERY_MIN[0] + Math.random() * (SNACK_EVERY_MIN[1] - SNACK_EVERY_MIN[0]);
    }
    const cat = next ? this.cats.find((c) => c.catId === next) : undefined;
    if (!cat) return;
    // Come de lado, com a cabeça no pote: a célula livre ao lado (a mais perto dele); sem nenhuma, senta na frente.
    const [bc, br] = bowl.at;
    // Livre = chão sem móvel (cadeira e pote não são sólidos, mas não são lugar de comer).
    const free = (c: number) => this.map.solid[br]?.[c] === false && !this.session.placedAt([c, br]);
    const sides = ([[bc - 1, 'right'], [bc + 1, 'left']] as const).filter(([c]) => free(c));
    const [cc] = cat.cell();
    const side = sides.sort((x, y) => Math.abs(x[0] - cc) - Math.abs(y[0] - cc))[0];
    if (side) cat.goEat([side[0], br], now, side[1]);
    else cat.goEat([bc, br + 1], now);
  }

  /** Petisco ou remédio ativo na barra e um gato perto: vai da mão até o gato. */
  private tryTreatCat(target?: Cell): boolean {
    const medicine = this.session.holdingMedicine();
    if ((!this.session.holdingTreat() && !medicine) || !this.session.atHome() || this.usingItem) return false;
    const feet = this.playerCells();
    const near = (at: Cell) => feet.some((f) => Math.max(Math.abs(f[0] - at[0]), Math.abs(f[1] - at[1])) <= 1);
    const ts = this.map.tileSize;
    const boxCell = (img: Phaser.GameObjects.Image): Cell => [Math.floor(img.x / ts), Math.floor((img.y - 1) / ts)];
    // Gato na caixinha (sem vaga no cercadinho): o remédio vai pela caixinha.
    const inBox = [...this.isoBoxes].find(([, img]) => near(boxCell(img)) && (!target || (boxCell(img)[0] === target[0] && boxCell(img)[1] === target[1])))?.[0];
    const cat = this.cats.find((c) => c.visible && near(c.cell()) && (!target || (c.cell()[0] === target[0] && c.cell()[1] === target[1]))) ?? (inBox ? this.cats.find((c) => c.catId === inBox) : undefined);
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
  /** Meus gatos: um balão com o nome em cima do gato por uns segundos, acompanhando ele. false = não está à vista. */
  private locateCat(catId: string): boolean {
    const cat = this.cats.find((c) => c.catId === catId && c.visible);
    if (!cat) return false;
    this.catLabel?.destroy();
    // Balão creme com borda rosa e a pontinha para o gato, acima da luz do dia (a cor da manhã/noite não apaga).
    const text = this.add.text(0, -9, this.session.catName(catId), { fontFamily: 'Trebuchet MS, sans-serif', fontSize: '10px', fontStyle: 'bold', color: '#5c3428', resolution: 4 }).setOrigin(0.5, 1);
    const w = Math.ceil(text.width) + 10;
    const h = Math.ceil(text.height) + 4;
    const g = this.add.graphics();
    g.fillStyle(0xfff4e0, 1).fillRoundedRect(-w / 2, -7 - h, w, h, 5);
    g.lineStyle(1.5, 0xd97890, 1).strokeRoundedRect(-w / 2, -7 - h, w, h, 5);
    g.fillStyle(0xfff4e0, 1).fillTriangle(-4, -7.5, 4, -7.5, 0, -2);
    g.lineStyle(1.5, 0xd97890, 1).lineBetween(-4, -7, 0, -2).lineBetween(4, -7, 0, -2);
    const label = this.add.container(cat.x, cat.y - 30, [g, text]).setDepth(160_000);
    this.catLabel = label;
    const follow = () => label.active && label.setPosition(cat.x, cat.y - 30);
    this.events.on('update', follow);
    this.tweens.add({ targets: label, y: '-=3', yoyo: true, repeat: 9, duration: 250 });
    this.time.delayedCall(CAT_LABEL_MS, () => {
      this.events.off('update', follow);
      if (this.catLabel === label) this.catLabel = undefined;
      this.tweens.add({ targets: label, alpha: 0, duration: 300, onComplete: () => label.destroy() });
    });
    return true;
  }

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
    const pending = this.session.pendingJobPoints();
    // Ponto com marcador no mapa (os caixotes da feira, a mesa de adoção): uma seta pulando em cima mostra que é
    // ali (só o passo da vez fica pendente, então a seta segue a ordem).
    const arrows = pending
      .filter((p) => p.marker)
      .map((p) => {
        const def = this.session.content.catalog.tiles[p.marker!];
        const g = this.add.graphics().setDepth(99_000);
        g.fillStyle(0x3b2a20, 1).fillTriangle(-9, -14, 9, -14, 0, 0);
        g.fillStyle(PICK_TINT, 1).fillTriangle(-6, -12, 6, -12, 0, -3);
        const top = p.at[1] * ts - 4;
        g.setPosition((p.at[0] + (def?.w ?? 1) / 2) * ts, top);
        this.tweens.add({ targets: g, y: top - 6, duration: UPGRADE_BLINK_MS, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
        return g as unknown as Phaser.GameObjects.Image;
      });
    const icons = pending
      .filter((p) => !p.marker)
      .map((p) => {
        if (p.icon) {
          // Caixa para pegar (ícone da folha nova): no chão da célula, do tamanho das caixas do correio na porta.
          const bottom = (p.at[1] + 1) * ts - 2;
          const f = iconFrame(this, p.icon);
          if (f) return this.add.image((p.at[0] + 0.5) * ts, bottom, f.key, f.frame).setScale(PARCEL_PILE_SCALE * f.scale * 2).setOrigin(0.5, 1).setDepth(ySortDepth(bottom));
        }
        if (p.sprite) {
          // Fica no chão da célula, como as caixas do correio.
          const bottom = (p.at[1] + 1) * ts - 2;
          return this.add.image((p.at[0] + 0.5) * ts, bottom, 'emotes', p.sprite).setOrigin(0.5, 1).setDepth(ySortDepth(bottom));
        }
        const icon = this.add.image((p.at[0] + 0.5) * ts, p.at[1] * ts - 2, 'emotes', 'exclamation').setOrigin(0.5, 1).setDepth(99_000);
        this.tweens.add({ targets: icon, y: icon.y - 3, duration: 600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
        return icon;
      });
    this.jobIcons = [...arrows, ...icons];
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
    if (!a || !step || a.def.place.map !== this.map.id) return;
    const who = actorsOf(a.def);
    const sitCat = (catId: string | undefined, [c, r]: [number, number], lift = 0) => {
      const variant = catId ? this.session.catDef(catId)?.variant : undefined;
      if (!variant || !this.textures.exists(catTexture(variant))) return null;
      CatSprite.createAnimations(this, variant);
      const feet = (r + 1) * ts - 4 - lift;
      const cat = this.add.sprite((c + 0.5) * ts, feet, catTexture(variant), 0).setOrigin(0.5, 28 / 32).setScale(catScale(variant)).setDepth(ySortDepth(feet));
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

  /**
   * Tigela ou caixa de areia ao alcance. Com as duas perto (lado a lado), vale a que está bem na frente dela; senão, a
   * mais perto da célula da frente (como os equipamentos do café: stationInReach).
   */
  private stationForHand(feet: readonly Cell[], target?: Cell): { bowl?: string; box?: string } {
    const bowl = this.session.bowlNear(feet, target);
    const box = this.session.litterNear(feet, target);
    if (!bowl || !box) return bowl ? { bowl } : box ? { box } : {};
    const [fc, fr] = this.facingCell();
    const { tiles } = this.session.content.catalog;
    const dist = (uid: string) => {
      const p = this.session.state.placed.find((x) => x.uid === uid)!;
      const def = tiles[this.session.content.items[p.item]?.tile ?? ''];
      const cells: Cell[] = def ? cellsOf(p.at, def) : [p.at];
      return Math.min(...cells.map(([c, r]) => Math.abs(c - fc) + Math.abs(r - fr)));
    };
    return dist(box) < dist(bowl) ? { box } : { bowl };
  }


  /** Perto do Tião trabalhando (ou clicou nele): ele diz quantos dias faltam (hoje, amanhã ou N dias). */
  private talkToBuilder(target?: Cell): boolean {
    const b = this.session.builderNear(this.playerCells(), target);
    if (!b) return false;
    const t = uiText.construction;
    const work = workName(b.job);
    const text = b.daysLeft === 0 ? t.talkToday : b.daysLeft === 1 ? t.talkTomorrow : t.talkDays.replace('{n}', daysText(b.daysLeft));
    this.ui.npcSay(this.session.content.construction.npc, text.replace('{work}', work));
    return true;
  }

  /** Célula na frente dela (para soltar o que está nas mãos). */
  private facingCell(): Cell {
    const [c, r] = this.feetCell();
    const d = this.player.facingDirection();
    return d === 'up' ? [c, r - 1] : d === 'down' ? [c, r + 1] : d === 'left' ? [c - 1, r] : [c + 1, r];
  }

  /** E ou clique no café: entregar, lavar, dar ao gato, preparar/pegar no equipamento, pegar ou soltar. */
  private serviceInteract(target?: Cell): boolean {
    return this.servicePlan(target)?.run() ?? false;
  }

  /** O clique no atendimento: o primeiro do que vale na célula clicada (a ordem da lista). */
  private servicePlan(target?: Cell): EPlan | null {
    return this.serviceCandidates(target)[0]?.value ?? null;
  }

  /**
   * O atendimento do café ao alcance (`target`: só o clicado), com as células e o tipo de cada coisa: entregar ao
   * cliente, pia, lava-louças, despensa, caixa pet, o que está nas mãos, equipamento, vitrine, pegar e soltar. No E,
   * quem decide é pickETarget (o que está na frente dela); no clique, vale a ordem desta lista.
   */
  private serviceCandidates(target?: Cell): ECandidate<EPlan>[] {
    const out: ECandidate<EPlan>[] = [];
    const sv = this.session.service;
    const st = this.session.state;
    const feet = this.playerCells();
    const report = (r: { ok: true } | { ok: false; reason: string }) => {
      if (!r.ok) this.ui.problem(r.reason as Parameters<GameUi['problem']>[0]);
      return true;
    };
    // Sem dica (o conserto já a caminho, a vitrine vazia): só explica, e perde de qualquer ação de verdade (soltar no balcão não).
    const add = (cells: readonly Cell[], tier: number, hint: EPlan['hint'], run: () => boolean, sticky = false) => {
      out.push({ cells, tier, sticky, weak: !hint && !sticky && tier !== E_TIER.putDown, value: { hint, run } });
    };
    const placedAt = (uid: string) => st.placed.find((p) => p.uid === uid)!.at;
    const customer = sv.customerToServe(feet);
    // Com o pedido na mão e o cliente ao alcance, entregar vence tudo em volta.
    if (customer && !target) add([customer.spot], E_TIER.service, this.hintCell(customer.spot, 'customer'), () => report(sv.serve(customer.id)), true);
    // Pia: com louça suja na mão, deixa lá; com as mãos livres e louça na pia, começa a lavar.
    const sink = sv.sinkCell();
    if (sv.sinkNear(feet) && (!target || (target[0] === sink[0] && target[1] === sink[1]))) {
      const act = sv.sinkAction();
      if (act === 'deposit') add([sink], E_TIER.service, this.hintCell(sink, 'sink'), () => report(sv.depositDirty()));
      else if (act === 'wash') add([sink], E_TIER.service, this.hintCell(sink, 'sink'), () => report(this.withPose(sv.startWash(), 'wash')));
    }
    // Lava-louças: com louça suja na mão, põe lá; com as mãos livres e louça dentro, liga.
    const washer = sv.washerNear(feet, target);
    if (washer && sv.isBroken(washer) && st.hands.length === 0) add(this.placedCells(washer), E_TIER.service, sv.isRepairing(washer) ? null : this.hintCell(placedAt(washer), 'repair'), () => this.askRepair(washer));
    else if (washer) {
      const act = sv.washerAction(washer);
      if (act === 'deposit') add(this.placedCells(washer), E_TIER.service, this.hintCell(placedAt(washer), 'washer'), () => report(sv.depositInWasher(washer)));
      else if (act === 'wash') add(this.placedCells(washer), E_TIER.service, this.hintCell(placedAt(washer), 'washer'), () => report(this.withPose(sv.startWasher(washer), 'operate')));
    }
    // Armário da cozinha, de mãos livres: abre a despensa (o armário ocupa a célula da frente e a de cima).
    const pantry = sv.pantryCell();
    const onPantry = !target || (target[0] === pantry[0] && (target[1] === pantry[1] || target[1] === pantry[1] - 1));
    // O equipamento ou a janela bem na frente dela ganham da despensa do lado: quem decide é pickETarget, pela frente.
    if (st.hands.length === 0 && sv.pantryNear(feet) && onPantry) {
      add([pantry, [pantry[0], pantry[1] - 1]], E_TIER.service, this.hintCell(pantry, 'pantry'), () => {
        this.ui.openPantry();
        return true;
      });
    }
    // Caixa pet, de mãos livres: abre a mochila com o baú dela (equipamento bem na frente ganha, como na despensa).
    const petBox = st.hands.length === 0 ? this.session.storageNear(feet, target) : undefined;
    if (petBox) {
      add(this.placedCells(petBox), E_TIER.service, this.hintCell(placedAt(petBox), 'pet_box'), () => {
        this.ui.openPetBox(petBox);
        return true;
      });
    }
    // Saco pesado: no café, vai para o estoque.
    if (st.hands.some((h) => h.kind === 'heavy')) {
      add([], 0, null, () => report(sv.storeHeavy()), true);
      return out;
    }
    // Gato no colo: põe no chão, na frente dela.
    const carried = sv.carriedCat();
    // Gato no colo (ou na caixinha): o E é pôr no chão, antes de tudo.
    if (carried && this.session.catBoxed(carried)) return [...out, { cells: [], tier: 0, sticky: true, value: { hint: null, run: () => this.putDownBoxedCat(carried, target) } }];
    if (carried && this.session.catContagious(carried)) return [...out, { cells: [], tier: 0, sticky: true, value: { hint: null, run: () => this.putDownSickCat(carried, target) } }];
    if (carried) {
      add([], 0, null, () => {
        const r = sv.putDownCat();
        if (r.ok) this.dropCat(carried, this.facingCell());
        return report(r);
      }, true);
      return out;
    }
    const near = (at: Cell) => feet.some((f) => Math.max(Math.abs(f[0] - at[0]), Math.abs(f[1] - at[1])) <= 1);
    if (st.hands.some((h) => h.kind === 'item') && !target) {
      const cat = this.cats.find((c) => c.visible && near(c.cell()));
      if (cat) add([cat.cell()], E_TIER.service, this.hintCat(cat, 'cat_treat'), () => report(sv.giveToCat(cat.catId)));
    }
    // Equipamento ao alcance: pegar o que está pronto ou começar o preparo.
    const station = this.stationInReach(feet, target);
    // Todos os equipamentos ao alcance são candidatos (o da frente dela vence em pickETarget); no clique, o clicado.
    for (const station of this.stationsInReach(feet, target)) {
      if (sv.isBroken(station.uid)) {
        add(station.cells, E_TIER.service, sv.isRepairing(station.uid) ? null : this.hintCell(station.at, 'repair'), () => this.askRepair(station.uid));
        continue;
      }
      const equipment = sv.equipmentOf(station.uid);
      const bringsWip = st.hands.some((h) => h.kind === 'wip' && sv.recipe(h.recipe)?.steps[h.step]?.equipment === equipment);
      // Algo pronto em cima (para pegar) ou trabalho para ele: um pouco antes dos outros equipamentos do lado.
      const busy = sv.stationHasWork(station.uid) ? -1 : 0;
      if (sv.surfaceAt(station.at) && st.hands.length < sv.handsCapacity()) add(station.cells, E_TIER.service + busy, this.hintCell(station.at, 'station'), () => report(sv.pickUp(station.at)));
      else if (st.hands.length === 0 || bringsWip) add(station.cells, E_TIER.service + busy, this.hintCell(station.at, 'station'), () => this.prepareAt(station.uid, equipment));
    }
    // Vitrine ao alcance com um doce (ou o bolo inteiro) na mão: guarda.
    const display = this.displayInReach(feet, target);
    if (display && st.hands.some((h) => sv.storable(h))) add(this.placedCells(display.uid), E_TIER.service, this.hintCell(placedAt(display.uid), 'display'), () => report(sv.storeInDisplay(display.uid)));
    // Pegar de uma superfície (a clicada ou a mais perto).
    const surface = target ? sv.surfaceAt(target) : st.surfaces.find((x) => near(x.at));
    if (surface && near(surface.at) && st.hands.length < sv.handsCapacity()) {
      // Pegar é na hora: a louça vai direto para a mão ou a bandeja (sem pose de ação).
      add([surface.at], E_TIER.service, this.hintCell(surface.at, 'surface'), () => report(sv.pickUp(surface.at)));
    }
    // Vitrine com as mãos livres: escolhe o que tirar (do bolo inteiro, sai uma fatia).
    else if (display && st.hands.length < sv.handsCapacity()) {
      const hint = sv.displayStock(display.uid).length > 0 ? this.hintCell(placedAt(display.uid), 'display') : null;
      add(this.placedCells(display.uid), E_TIER.service, hint, () => {
        const stock = sv.displayStock(display.uid);
        if (stock.length === 0) return report({ ok: false, reason: 'display_empty' });
        const recipes = this.session.content.recipes;
        const names = stock.map((d) =>
          recipes[d.recipe]?.batch
            ? uiText.service.displaySlices.replace('{name}', recipes[d.recipe]?.name ?? '').replace('{n}', String(d.portions))
            : (recipes[d.recipe]?.name ?? d.recipe) + (d.quality === 'premium' ? ` ${uiText.service.premium}` : ''),
        );
        void this.ui.choose(uiText.service.displayAsk, [...names, uiText.service.extraCancel]).then((i) => {
          if (i < stock.length) report(sv.takeFromDisplay(display.uid, i));
        });
        return true;
      });
    }
    // Soltar: na célula clicada (até no chão) ou, com o E, só num balcão, mesa ou equipamento na frente: o E sem nada
    // para pegar ao alcance não larga a louça da bandeja no chão.
    if (st.hands.length > 0) {
      const at = target ?? this.facingCell();
      if (sv.canPutDown(at, feet, !!target)) add([at], E_TIER.putDown, null, () => report(sv.putDown(at, feet, !!target)));
    }
    return out;
  }

  /** Preparar no equipamento: o pedido de quem espera; sem pedido, ela pode adiantar uma receita do cardápio. */
  private prepareAt(uid: string, equipment: string | undefined): boolean {
    const sv = this.session.service;
    const report = (r: { ok: true } | { ok: false; reason: string }) => {
      if (!r.ok) this.ui.problem(r.reason as Parameters<GameUi['problem']>[0]);
      return true;
    };
    const pose = equipment === 'stove' ? 'stir' : 'operate';
    const r = sv.prepare(uid);
    if (r.ok || r.reason !== 'nothing_to_prepare') return report(this.withPose(r, pose));
    // Ninguém pediu: ela pode adiantar uma receita do cardápio (escolhe na lista; uma só, já começa).
    const options = sv.extraRecipes(uid);
    if (options.length === 0) return report(r);
    if (options.length === 1) return report(this.withPose(sv.prepare(uid, options[0]), pose));
    const names = options.map((id) => this.session.content.recipes[id]?.name ?? id);
    void this.ui.choose(uiText.service.extraAsk, [...names, uiText.service.extraCancel]).then((i) => {
      if (i < options.length) report(this.withPose(sv.prepare(uid, options[i]), pose));
    });
    return true;
  }

  /** Vitrine ao alcance dos pés (`target`: só a clicada), ou undefined. */
  private displayInReach(feet: readonly Cell[], target?: Cell): { uid: string } | undefined {
    const c = this.session.content;
    for (const p of this.session.service.displaysPlaced()) {
      const def = c.catalog.tiles[c.items[p.item]?.tile ?? ''];
      const cells: Cell[] = def ? cellsOf(p.at, def) : [p.at];
      const hit = target
        ? cells.some(([x, y]) => x === target[0] && y === target[1])
        : cells.some(([x, y]) => feet.some((f) => Math.max(Math.abs(f[0] - x), Math.abs(f[1] - y)) <= 1));
      if (hit) return p;
    }
    return undefined;
  }


  /**
   * Equipamento ao alcance dos pés (`target`: só o clicado). Com vários (cafeteira e bule lado a lado): o que está
   * bem na frente dela; senão, o que tem trabalho (pronto para pegar, massa para ele, cliente esperando); senão, o
   * mais perto da célula da frente.
   */
  /** Todos os equipamentos ao alcance dos pés (`target`: só o clicado). */
  private stationsInReach(feet: readonly Cell[], target?: Cell): { uid: string; at: Cell; cells: Cell[] }[] {
    const near = (at: Cell) => feet.some((f) => Math.max(Math.abs(f[0] - at[0]), Math.abs(f[1] - at[1])) <= 1);
    return this.session.service.allStations().filter((s) => s.cells.some((c) => near(c) && (!target || (c[0] === target[0] && c[1] === target[1]))));
  }

  private stationInReach(feet: readonly Cell[], target?: Cell): { uid: string; at: Cell; cells: Cell[] } | undefined {
    const sv = this.session.service;
    const all = this.stationsInReach(feet, target);
    if (all.length <= 1) return all[0];
    // Bem na frente dela: esse (faz o pedido ou diz por que não dá), mesmo que o do lado tenha algo pronto.
    const [fc, fr] = this.facingCell();
    const ahead = all.find((s) => s.cells.some(([c, r]) => c === fc && r === fr));
    if (ahead) return ahead;
    const busy = all.find((s) => sv.stationHasWork(s.uid));
    if (busy) return busy;
    const dist = (s: { cells: Cell[] }) => Math.min(...s.cells.map(([c, r]) => Math.abs(c - fc) + Math.abs(r - fr)));
    return [...all].sort((a, b) => dist(a) - dist(b))[0];
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
      img.setPosition((s.at[0] + 0.5) * ts, base - 12).setOrigin(0.5, 1).setScale((s.item.kind === 'item' ? 0.6 : 1) * ((img.getData('iconScale') as number | undefined) ?? 1)).setDepth(ySortDepth(base) + 5);
      this.surfaceIcons.push(img);
    }
  }

  /** Imagem do que está na mão (bebida: ícone da receita; louça suja: ícone apagado; item: ícone do item). */
  private handItemImage(item: HandItem): Phaser.GameObjects.Image | undefined {
    const c = this.session.content;
    // Pedido pronto (o ícone da receita, o mesmo do balão) e louça suja (ícone da louça): arte nova, no tamanho da louça.
    if (item.kind === 'drink' || item.kind === 'dirty') {
      const di = serviceArt.dishIcons;
      const f = iconFrame(this, item.kind === 'drink' ? c.recipes[item.recipe]?.icon ?? '' : di.dirty[item.vessel] ?? '');
      if (f) return this.add.image(0, 0, f.key, f.frame).setData('iconScale', f.scale * di.scale);
    }
    if (item.kind === 'cat') return undefined; // o gato no colo é desenhado à parte (animado)
    const icon =
      item.kind === 'wip' ? c.recipes[item.recipe]?.icon
      : item.kind === 'cake' ? c.recipes[item.recipe]?.batch?.icon
      : item.kind === 'item' || item.kind === 'heavy' ? c.items[item.item]?.icon
      : undefined;
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
  /** E perto de um sofá ou cadeira do café: senta e se recompõe (levanta ao andar, com E de novo ou ao encher). */
  private tryRest(target?: Cell): boolean {
    if (this.session.resting()) {
      this.session.stopRest();
      return true;
    }
    const uid = this.session.seatNear(this.playerCells(), target);
    if (!uid) return false;
    const r = this.session.startRest(uid);
    if (!r.ok) this.ui.problem(r.reason as Parameters<GameUi['problem']>[0]);
    return true;
  }

  /** T com um café pronto na mão: ela toma (a xícara fica suja na mão). Um por hora do jogo. */
  private tryDrinkCoffee(): void {
    if (!this.session.holdingCoffee()) return;
    const r = this.session.drinkCoffee();
    if (r.ok) return;
    if (r.reason === 'coffee_too_soon') this.ui.problem('coffee_too_soon', { n: String(this.session.coffeeWait()) });
    else this.ui.problem(r.reason as Parameters<GameUi['problem']>[0]);
  }

  /**
   * Senta no sofá. PLACEHOLDER(arte): sem pose sentada, ela fica de frente na frente do encosto, com as pernas
   * cortadas na borda do assento (o quadril no assento).
   */
  private sitOn(uid: string): void {
    const p = this.session.state.placed.find((x) => x.uid === uid);
    const def = p ? this.session.content.catalog.tiles[this.session.content.items[p.item]?.tile ?? ''] : undefined;
    const seat = p ? this.session.seatDef(p.item) : undefined;
    if (!p || !def || !seat) return;
    const ts = this.map.tileSize;
    const base = (p.at[1] + def.h) * ts;
    this.restFrom = { x: this.player.x, y: this.player.y };
    const body = this.player.body as Phaser.Physics.Arcade.Body;
    body.reset(this.player.x, this.player.y);
    body.enable = false;
    const x = (p.at[0] + def.w / 2) * ts;
    // Sentada virada para onde o móvel olha (sofá: de frente, na frente do encosto), com os pés no chão.
    if (this.player.sit(seat.facing)) {
      this.player.setPosition(x, base + seat.feet);
      this.player.setDepth(ySortDepth(base) + 1);
      return;
    }
    // Sem a folha (assets não importados): cortada na borda do assento.
    const seatY = base - SOFA_SEAT;
    this.player.setPosition(x, seatY - 2 + HIP_HEIGHT);
    this.player.face(seat.facing);
    this.player.move(NO_INPUT);
    // Só o que fica acima da borda do assento aparece (crop em pixels do quadro, antes da escala).
    const top = this.player.y - this.player.displayHeight * this.player.originY;
    this.player.setCrop(0, 0, this.player.frame.width, (seatY - top) / this.player.scaleY);
    this.player.setDepth(ySortDepth(base) + 1);
  }

  /** Levanta do sofá: volta para onde estava quando sentou. */
  private standUp(): void {
    const body = this.player.body as Phaser.Physics.Arcade.Body;
    body.enable = true;
    this.player.setCrop();
    this.player.standUp();
    const from = this.restFrom ?? { x: this.player.x, y: this.player.y };
    this.restFrom = null;
    body.reset(from.x, from.y);
    this.player.updateDepth();
  }

  /** Ícone "se recompondo" em cima da cabeça (no sofá, o tempo todo; depois do café ou da brincadeira, um instante). */
  private updateRecoverIcon(): void {
    const show = this.session.resting() !== null || this.time.now < this.recoverIconUntil;
    if (!show) {
      this.recoverIcon.setVisible(false);
      return;
    }
    const bob = Math.sin(this.time.now / 260) * 1.5;
    this.recoverIcon
      .setVisible(true)
      .setPosition(this.player.x, this.player.y - this.player.displayHeight - 4 + bob)
      .setDepth(this.player.depth + 1);
  }

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
    const key = JSON.stringify([st.hands, st.tray, boxes, this.session.atHome()]);
    if (key !== this.handsKey) {
      this.handsKey = key;
      this.handIcons.forEach((i) => i.destroy());
      this.carriedCatSprite?.destroy();
      this.carriedCatSprite = null;
      const catId = sv.carriedCat();
      // Bandeja só quando está selecionada na barra: nas mãos, com uma louça em cima, mesmo levando várias (o número
      // não aparece). Sem ela, a louça (uma por vez) vai direto nas mãos, na mesma pose de mãos à frente.
      const onTray = st.tray;
      const dish = !onTray ? st.hands.find((h) => h.kind === 'drink' || h.kind === 'dirty') : undefined;
      // Pose de carregar (bandeja, gato no colo): a personagem anda com ela, de mãos vazias; o jogo desenha o objeto.
      this.player.setCarryPose(onTray || dish ? 'tray' : catId || boxes ? 'cat' : null);
      if (dish) {
        const item = this.handItemImage(dish);
        item?.setScale(this.handScale(dish) * ((item.getData('iconScale') as number | undefined) ?? 1)).setOrigin(0.5, 1).setData('handOffset', [0, DISH_HAND_LIFT]).setData('onTray', true);
        this.handIcons = item ? [item] : [];
      } else if (onTray) {
        const tray = iconFrame(this, serviceArt.trayIcons[0]!);
        const top = st.hands[0];
        const item = top ? this.handItemImage(top) : undefined;
        item?.setScale(this.handScale(top) * ((item.getData('iconScale') as number | undefined) ?? 1)).setOrigin(0.5, 1).setData('handOffset', [0, TRAY_ITEM_LIFT]).setData('onTray', true);
        this.handIcons = [...(tray ? [this.add.image(0, 0, tray.key, tray.frame).setScale(tray.scale).setOrigin(0.5, 0.5).setData('handOffset', [0, 0]).setData('onTray', true)] : []), ...(item ? [item] : [])];
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
        // Fora do café (indo ou voltando da clínica), ele vai na caixinha de transporte.
        // No café também, se ele está na caixinha (castrado sem vaga): só sai dela no cercadinho.
        const box = !this.session.atHome() || this.session.catBoxed(catId) ? clinicBoxTile() : null;
        if (box) this.carriedCatSprite = this.add.sprite(0, 0, box.sheet, box.frame).setOrigin(0.5, 0.95).setScale(tileScale(box.sheet));
        // Na pose de dormir o corpo fica na parte de baixo do quadro: origem 1,05 põe o gato na altura das mãos.
        else this.carriedCatSprite = this.add.sprite(0, 0, catTexture(variant), 0).setOrigin(0.5, 1.05).setScale(catScale(variant)).play(`${catTexture(variant)}-sleep`);
      }
    }
    const dir = this.player.facingDirection();
    const [ax, ay] = serviceArt.handAnchor[dir];
    const hx = this.player.x - 16 + ax;
    const hy = this.player.y - 64 + ay;
    const front = this.player.depth + (dir === 'up' ? -1 : 2);
    this.handIcons.forEach((img, i) => {
      const off = img.getData('handOffset') as [number, number] | undefined;
      // Bandeja e louça em cima: o meio da bandeja vai onde trayHand manda para esta direção.
      const tray: [number, number] = img.getData('onTray') ? serviceArt.trayHand[dir] : [0, 0];
      if (off) img.setPosition(hx + tray[0] + off[0], hy + tray[1] + off[1]).setDepth(front + (i > 0 ? 0.5 : 0));
      else img.setPosition(hx, hy - (st.tray ? 0 : i * 7)).setDepth(front);
    });
    this.carriedCatSprite?.setPosition(hx, hy).setDepth(front).setFlipX(dir === 'left');
    // Lavar na pia é à mão: só anda com ela em frente à pia (fora do café, também não).
    sv.setSinkAttended(this.session.atHome() && sv.sinkNear(this.playerCells()));
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
    // Lava-louças lavando: a mesma barra de progresso, em cima dela.
    for (const placed of st.placed) {
      const progress = sv.washerProgress(placed.uid);
      if (progress === undefined) continue;
      working.add(placed.uid);
      const frame = Math.min(serviceArt.progress.length - 1, Math.round(progress * (serviceArt.progress.length - 1)));
      let bar = this.progressBars.get(placed.uid);
      if (!bar) {
        bar = this.add.image((placed.at[0] + 0.5) * ts, placed.at[1] * ts - 2, 'progress_0').setOrigin(0.5, 1).setDepth(99_400);
        this.progressBars.set(placed.uid, bar);
      }
      bar.setTexture(`progress_${frame}`);
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
    this.updateBroken();
    this.updateSink();
    this.syncCustomers();
  }

  /** Equipamento quebrado: "!" balançando em cima; com o Tião consertando, a barra do conserto no lugar. */
  private updateBroken(): void {
    const sv = this.session.service;
    const ts = this.map.tileSize;
    const live = new Set<string>();
    const repairing = new Set<string>();
    for (const uid of this.session.atHome() ? sv.brokenEquipment() : []) {
      const placed = this.session.state.placed.find((p) => p.uid === uid);
      if (!placed) continue;
      const top = placed.at[1] * ts - 2 - this.liftOf(uid);
      const progress = sv.repairProgress(uid);
      if (progress !== undefined) {
        // Conserto: a mesma arte da barra dos preparos.
        repairing.add(uid);
        let bar = this.repairBars.get(uid);
        if (!bar) {
          bar = this.add.image((placed.at[0] + 0.5) * ts, top, 'progress_0').setOrigin(0.5, 1).setDepth(99_400);
          this.repairBars.set(uid, bar);
        }
        bar.setTexture(`progress_${Math.min(serviceArt.progress.length - 1, Math.round(progress * (serviceArt.progress.length - 1)))}`);
        if (!this.repairNpcs.has(uid)) this.showRepairNpc(uid);
        continue;
      }
      live.add(uid);
      if (!this.brokenIcons.has(uid)) {
        const icon = this.add.image((placed.at[0] + 0.5) * ts, top, 'emotes', 'exclamation').setOrigin(0.5, 1).setDepth(99_000);
        this.tweens.add({ targets: icon, y: icon.y - 3, duration: 600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
        this.brokenIcons.set(uid, icon);
      }
    }
    for (const [uid, icon] of this.brokenIcons) {
      if (live.has(uid)) continue;
      icon.destroy();
      this.brokenIcons.delete(uid);
    }
    for (const [uid, bar] of this.repairBars) {
      if (repairing.has(uid)) continue;
      bar.destroy();
      this.repairBars.delete(uid);
    }
  }

  /** E no equipamento quebrado: pergunta se chama o Tião (preço do conserto); sim, ele vem na hora. */
  private askRepair(uid: string): boolean {
    const sv = this.session.service;
    const t = uiText.service;
    if (sv.isRepairing(uid)) {
      this.ui.toast(t.repairing, 2000);
      return true;
    }
    const item = this.session.content.items[this.session.state.placed.find((p) => p.uid === uid)?.item ?? ''];
    const price = String(this.session.content.service.breakdown?.repairPrice ?? 0);
    void this.ui.confirm(t.repairAsk.replace('{name}', item?.name ?? '').replace('{price}', price), t.repairYes.replace('{price}', price), t.repairNo).then((yes) => {
      if (!yes) return;
      const r = sv.callRepair(uid);
      if (!r.ok) this.ui.problem(r.reason as Parameters<GameUi['problem']>[0]);
    });
    return true;
  }

  /** O Tião ao lado do equipamento, martelando (de preferência à esquerda, virado para ele). */
  private showRepairNpc(uid: string): void {
    if (!this.session.atHome() || this.repairNpcs.has(uid)) return;
    const placed = this.session.state.placed.find((p) => p.uid === uid);
    const def = this.session.content.npcs[this.session.content.construction.npc];
    if (!placed || !def) return;
    const [c, r] = placed.at;
    const free = ([x, y]: Cell) => this.map.solid[y]?.[x] === false;
    const spot = ([[c - 1, r], [c - 1, r + 1], [c, r + 1], [c + 1, r + 1]] as Cell[]).find(free);
    if (!spot) return;
    const ts = this.map.tileSize;
    const npc = new NpcSprite(this, def, spot[0] * ts + ts / 2, (spot[1] + 1) * ts - 4, ts);
    npc.loop('martelando');
    this.repairNpcs.set(uid, npc);
  }

  /** Pia: louça esperando (quadro com louça), lavando (animação + barra; pausada sem ela na frente), recém-lavada (louça limpa). */
  private updateSink(): void {
    const sv = this.session.service;
    const sheet = (tilesetsJson.sheets as { id: string; animation?: { columns: number; work: number[]; dirty?: number; clean?: number } }[]).find((s) => s.id === 'sink');
    if (!sheet?.animation) return;
    const ts = this.map.tileSize;
    const [c, r] = sv.sinkCell();
    if (!this.sinkSprite || !this.sinkSprite.active) {
      this.sinkSprite = this.add.sprite(c * ts, r * ts, 'anim:sink', 0).setOrigin(0).setScale(tileScale('sink')).setDepth(ySortDepth((r + 1) * ts) + 1).setVisible(false);
      const [a, b] = sheet.animation.work as [number, number];
      if (!this.anims.exists('sink-wash')) this.anims.create({ key: 'sink-wash', frames: this.anims.generateFrameNumbers('anim:sink', { start: a, end: b }), frameRate: 6, repeat: -1 });
    }
    const progress = sv.washProgress();
    if (progress !== undefined) {
      // Pausada (ela saiu da frente da pia): a água para e fica a louça esperando; a barra fica parada.
      if (sv.sinkPaused()) {
        this.sinkSprite.stop();
        if (sheet.animation.dirty !== undefined) this.sinkSprite.setVisible(true).setFrame(sheet.animation.dirty);
      } else if (!this.sinkSprite.anims.isPlaying) this.sinkSprite.setVisible(true).play('sink-wash');
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

  /**
   * A avaliação de quem saiu, subindo em cima dele: a carinha (feliz ou triste) e uma estrela por ponto da nota, com a
   * reputação embaixo (+2, −1). Arte em data/service_art.json: review; sem ela, as estrelas em texto.
   */
  private showReview(customerId: string, happy: boolean, stars: number, reputation: number): void {
    const view = this.customerViews.get(customerId);
    if (!view) return; // só existe no café: fora dele, ninguém vê
    const x = view.sprite.x;
    const y = view.sprite.y - 52;
    const style = (size: number, color: string) => ({ fontFamily: 'Trebuchet MS, sans-serif', fontSize: `${size}px`, fontStyle: 'bold', color, stroke: '#3b2a2f', strokeThickness: 2, resolution: 4 });
    const art = serviceArt.review;
    const face = happy && stars >= art.happyFrom ? 'review_happy' : 'review_sad';
    let row: Phaser.GameObjects.Container | Phaser.GameObjects.Text;
    if (this.textures.exists(face) && this.textures.exists('review_star')) {
      const keys = [face, ...Array<string>(stars).fill('review_star')];
      const icons = keys.map((k) => this.add.image(0, 0, k).setOrigin(0, 1).setScale(art.scale));
      const width = icons.reduce((w, i) => w + i.displayWidth, 0) + art.gap * (icons.length - 1);
      let left = -width / 2;
      for (const i of icons) {
        i.x = left;
        left += i.displayWidth + art.gap;
      }
      row = this.add.container(x, y, icons).setDepth(99_800);
    } else row = this.add.text(x, y, '★'.repeat(stars) + '☆'.repeat(5 - stars), style(11, '#f2c45a')).setOrigin(0.5, 1).setDepth(99_800);
    const rep = reputation ? this.add.text(x, y + 1, (reputation > 0 ? '+' : '−') + Math.abs(reputation) + ' ' + uiText.review.reputation, style(7, reputation > 0 ? '#a8e6a1' : '#ff9aa8')).setOrigin(0.5, 0).setDepth(99_800) : null;
    const targets = rep ? [row, rep] : [row];
    this.tweens.add({ targets, y: '-=14', duration: 1400, ease: 'Sine.easeOut' });
    this.tweens.add({ targets, alpha: 0, delay: 1700, duration: 500, onComplete: () => targets.forEach((t) => t.destroy()) });
  }

  /** Clientes: cria quem chegou (entra pela porta), anda até o lugar, balão do pedido; quem saiu vai embora. */
  private syncCustomers(): void {
    const cfg = this.session.content.service;
    const ts = this.map.tileSize;
    // Entram pela porta da rua (embaixo, no capacho).
    const street = this.session.content.map.doors?.find((d) => d.id === 'door.street');
    const door: Cell = street ? [street.at[0], street.at[1]] : [14, 10];
    const alive = new Set<string>();
    const inPlace: Cell[] = [];
    for (const c of this.session.state.service.customers) {
      alive.add(c.id);
      let view = this.customerViews.get(c.id);
      if (!view) {
        const def = this.session.content.npcs[cfg.customerLooks[c.look % cfg.customerLooks.length]!];
        if (!def) continue;
        // Recém-chegado entra pela porta; ao abrir o café (trocar de mapa), já aparece no lugar.
        view = new CustomerSprite(this, def, this.customersFresh ? c.spot : door, ts, (from, to) => {
          const path = findPath(this.map.solid, from, to);
          return path ? pathCorners(path) : null;
        });
        this.customerViews.set(c.id, view);
        if (!this.customersFresh) void view.walkTo(c.spot, true);
        else view.arrived = true;
      } else if (view.target[0] !== c.spot[0] || view.target[1] !== c.spot[1]) void view.walkTo(c.spot, true);
      const shown = c.stage === 'waiting' ? c.recipe : c.stage === 'queue' ? null : undefined;
      if (view.shownRecipe !== shown) {
        view.shownRecipe = shown;
        view.showOrder(shown ? this.session.content.recipes[shown]?.icon : shown);
      }
      // Depois de pagar, fica no lugar consumindo (consumeMinutes): a barrinha mostra quanto falta para ir embora.
      view.showConsuming(
        c.stage === 'drinking' ? 1 - (c.until - nowAbs(this.session.state)) / cfg.consumeMinutes[c.kind] : undefined,
        c.recipe ? this.session.content.recipes[c.recipe]?.icon : undefined,
      );
      // Na fila (em pé) também tem paciência: a barra embaixo do ícone de espera.
      view.setQueuePatience(c.stage === 'queue' ? (c.until - nowAbs(this.session.state)) / cfg.patienceMinutes : undefined);
      if (c.stage === 'waiting') {
        const left = (c.until - nowAbs(this.session.state)) / cfg.patienceMinutes;
        const b = serviceArt.bubble;
        view.setMood(left < b.furiousBelow ? 'furious' : left < b.impatientBelow ? 'impatient' : 'normal');
        view.setPatience(left);
      } else view.setPatience(undefined);
      // Na mesa: chegou à cadeira, senta virado para a mesa (a cadeira do mapa fica por baixo).
      if (c.kind === 'table' && c.stage !== 'queue' && view.arrived && view.target[0] === c.spot[0] && view.target[1] === c.spot[1]) {
        const dx = c.dishAt[0] - c.spot[0];
        const dy = c.dishAt[1] - c.spot[1];
        view.sit(dx < 0 ? 'left' : dx > 0 ? 'right' : dy < 0 ? 'up' : 'down', ySortDepth((c.spot[1] + 1) * ts));
      }
      // Em pé no lugar: virado para a bancada, a mesa alta ou o balcão (de lado na bancada da parede do lado).
      if (c.kind === 'standing' && c.stage !== 'queue' && view.arrived && view.target[0] === c.spot[0] && view.target[1] === c.spot[1]) {
        const dx = c.dishAt[0] - c.spot[0];
        const dy = c.dishAt[1] - c.spot[1];
        view.sprite.face(dx < 0 ? 'left' : dx > 0 ? 'right' : dy < 0 ? 'up' : 'down');
        // Encosta: a bancada da parede fica na beira da célula dela; sem isso, o cliente parece longe (item.stand.lean).
        const lean = this.standLean(c.dishAt);
        view.lean(Math.sign(dx) * lean, Math.sign(dy) * lean);
      }
      // No lugar (sentado ou em pé no balcão): ela não atravessa. Na fila, não (para não fechar a passagem da porta).
      if (c.stage !== 'queue' && view.arrived && view.target[0] === c.spot[0] && view.target[1] === c.spot[1]) inPlace.push(c.spot);
      view.update();
    }
    this.customersFresh = false;
    this.syncCustomerSolids(inPlace);
    for (const [id, view] of this.customerViews) {
      if (alive.has(id) || view.leaving) {
        if (view.leaving) view.update();
        continue;
      }
      view.leaving = true;
      view.showOrder(undefined);
      view.showConsuming(undefined);
      view.setQueuePatience(undefined);
      void view.walkTo(door).then(() => (view.sprite.active ? view.sprite.leave() : undefined)).then(() => {
        view.destroy();
        this.customerViews.delete(id);
      });
    }
    // Mesa cheia: os balões vizinhos se afastam o mínimo para não encostar um no outro.
    const withBubble = [...this.customerViews.values()].flatMap((v) => {
      const box = v.bubbleBox();
      return box ? [{ v, box }] : [];
    });
    const offsets = spreadBoxes(withBubble.map((b) => b.box));
    withBubble.forEach(({ v }, i) => v.update(offsets[i]));
  }

  /** Quanto o cliente em pé encosta na peça desta célula (item.stand.lean, px do jogo); 0 no balcão. */
  private standLean(cell: Cell): number {
    const { items, catalog } = this.session.content;
    const p = this.session.state.placed.find((x) => {
      const def = catalog.tiles[items[x.item]?.tile ?? ''];
      return !!items[x.item]?.stand && !!def && cellsOf(x.at, def).some(([c, r]) => c === cell[0] && r === cell[1]);
    });
    return p ? (items[p.item]!.stand!.lean ?? 0) : 0;
  }

  /** Altura da caixa de colisão nos pés (a base dos móveis: world.objectBaseDepth da célula). */
  private baseHeight(): number {
    return Math.round(this.map.tileSize * Math.min(1, Math.max(0.1, this.session.content.world.objectBaseDepth ?? 1)));
  }

  /** Ela não atravessa cliente no lugar: a base da célula dele bloqueia, como a dos móveis. */
  private syncCustomerSolids(cells: readonly Cell[]): void {
    const key = cells.map(([c, r]) => `${c},${r}`).sort().join(' ');
    if (key === this.customerSolidKey && this.customerSolids) return;
    this.customerSolidKey = key;
    this.customerCollider?.destroy();
    this.customerSolids?.destroy(true);
    this.customerSolids = this.physics.add.staticGroup();
    const ts = this.map.tileSize;
    const h = this.baseHeight();
    for (const [c, r] of cells) this.customerSolids.add(this.add.zone(c * ts + ts / 2, (r + 1) * ts - h / 2, ts, h));
    // Num roteiro (ela andando sozinha), não trava no caminho.
    this.customerCollider = this.physics.add.collider(this.player, this.customerSolids, undefined, () => !this.scripts.isRunning());
  }

  /**
   * A cada quadro: um corpo centrado nos pés de cada NPC do mapa, que acompanha ele (vindo de baixo, ela para um pouco
   * antes, sem cobrir o NPC todo). Só bloqueia com ele parado e fora de
   * roteiro: andando (ou numa cena), passa por ela, para não empurrá-la nem travar o roteiro.
   */
  private syncNpcBlockers(): void {
    this.npcBlockers ??= this.physics.add.group();
    this.npcBlockerCollider ??= this.physics.add.collider(this.player, this.npcBlockers, undefined, (_p, z) => !this.scripts.isRunning() && (z as Phaser.GameObjects.Zone).getData('still') === true);
    for (const [npc, zone] of this.npcBlockerOf) {
      if (npc.active && [...this.npcs.values()].includes(npc)) continue;
      zone.destroy();
      this.npcBlockerOf.delete(npc);
    }
    const h = this.baseHeight();
    for (const npc of this.npcs.values()) {
      if (!npc.active) continue;
      let zone = this.npcBlockerOf.get(npc);
      if (!zone) {
        zone = this.add.zone(npc.x, npc.y, Math.round(this.map.tileSize * 0.6), h);
        this.npcBlockers.add(zone);
        const body = zone.body as Phaser.Physics.Arcade.Body;
        body.setImmovable(true).setAllowGravity(false);
        body.pushable = false;
        body.moves = false;
        this.npcBlockerOf.set(npc, zone);
      }
      const still = zone.x === npc.x && zone.y === npc.y;
      zone.setData('still', still && npc.visible && npc.alpha > 0.5);
      zone.setPosition(npc.x, npc.y);
    }
  }

  private clearCustomers(): void {
    this.syncCustomerSolids([]);
    this.customerViews.forEach((v) => v.destroy());
    this.customerViews.clear();
    this.equipAnims.forEach((s) => s.destroy());
    this.equipAnims.clear();
    this.progressBars.forEach((b) => b.destroy());
    this.progressBars.clear();
    this.brokenIcons.forEach((i) => i.destroy());
    this.brokenIcons.clear();
    this.repairBars.forEach((b) => b.destroy());
    this.repairBars.clear();
    this.repairNpcs.forEach((n) => n.destroy());
    this.repairNpcs.clear();
    this.sinkSprite?.destroy();
    this.sinkSprite = null;
    this.sinkBar?.destroy();
    this.sinkBar = null;
    this.handsKey = ''; // redesenha o que está nas mãos (o gato do mapa novo)
    this.customersFresh = true;
  }

  /** Caixas: a pilha na porta do café (rua, até 3) e cada caixa solta no chão do café, onde ela deixou. */
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
    if (loc === cfg.door.map) stack(cfg.door.at, this.session.boxesAt('door') - this.arriving);
    if (this.session.atHome()) for (const b of this.session.floorBoxes()) stack(b.at, 1);
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
      ...Array<string>(this.session.boxesAt('carried')).fill('parcel'),
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
    // Duas metades da mesma imagem: das mãos para baixo, na frente dela; das mãos para cima, atrás (o cabo passa
    // por trás da cabeça, e não na frente do rosto).
    const hold = broom.hold;
    const img = this.textures.get('broom_hold').getSourceImage() as { width: number; height: number };
    const gripY = Math.round(hold.grip[1]);
    const half = (depth: number, cropY: number, cropH: number) =>
      this.add
        .image(this.player.x, this.player.y, 'broom_hold')
        .setOrigin(hold.grip[0] / img.width, hold.grip[1] / img.height)
        .setScale(1 / hold.resolution)
        .setFlipX(!left) // a imagem tem as cerdas à esquerda: espelha para elas irem para o lado da sujeira
        .setCrop(0, cropY, img.width, cropH)
        .setDepth(depth);
    const tools = [half(this.player.depth - 1, 0, gripY), half(this.player.depth + 1, gripY, img.height - gripY)];
    const followHands = () => {
      const col = Number(this.player.frame.name) % hold.handDx.length;
      for (const t of tools) t.setPosition(this.player.x + (hold.handDx[col] ?? 0) / hold.resolution, this.player.y - hold.handHeight / hold.resolution);
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
    tools.forEach((t) => t.destroy());
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

  // ---------- Obras com o construtor ----------

  /** Troca de acabamento: ela marca a área no café (retângulo); confirmar abre a ligação com o orçamento. */
  private startAreaSelect(surfaceId: string, finishId: string): void {
    if (!this.session.atHome()) return this.ui.toast(uiText.construction.selectNotHere, 3000);
    this.cancelPlacing();
    const t = uiText.construction;
    this.areaSelect = new AreaSelect(
      this,
      {
        tileSize: this.map.tileSize,
        start: this.feetCell(),
        cols: this.map.cols,
        rows: this.map.rows,
        quote: ([first, ...more]) => {
          const [a, b] = first!;
          const q = this.session.finishQuote(surfaceId, finishId, a, b, more);
          if (!q) return null;
          return { cells: q.cells, text: t.selectInfo.replace('{n}', String(q.cells.length)).replace('{material}', String(q.material)).replace('{labor}', String(q.labor)).replace('{days}', daysText(q.days)) };
        },
        onConfirm: ([first, ...more]) => {
          const [a, b] = first!;
          this.areaSelect = null;
          const r = this.session.quoteFinish(surfaceId, finishId, a, b, more);
          if (!r.ok) this.ui.problem(r.reason as keyof typeof uiText.problems);
        },
        onCancel: () => (this.areaSelect = null),
        onEmpty: () => this.ui.toast(t.selectEmpty, 2500),
      },
      t.selectHint,
    );
  }

  /** Gatos operados que a Fernanda trouxe e cuja entrega ela ainda não viu (as falas de cada um). */
  private vetDeliveries: { catId: string; lines: string[] }[] = [];
  /** Onde ela deixou cada caixinha de transporte no chão (sem isto, a caixinha vai para um canto livre). */
  private boxSpots = new Map<string, Cell>();
  private vetDelivering = false;

  /** A volta da castração: guarda a entrega; no café, a cena já começa (fora dele, espera ela entrar). */
  private queueVetDelivery(d: { catId: string; inPen: boolean; first: boolean; isolationDays: number; aftercareDays: number; cans?: number; inflamed?: boolean }): void {
    const cans = d.cans ?? this.session.content.clinic.procedures.find((p) => p.id === 'proc.neuter')?.recoveryCans ?? 0;
    // O pontinho inflamado: ela conta primeiro (por isso os dias, as doses e as latinhas a mais).
    const lines = d.inflamed ? [vetLine(this.session, 'neuter.inflamed', {}, d.catId)] : [];
    lines.push(vetLine(this.session, d.inPen ? 'neuter.delivered' : 'neuter.deliveredNoPen', { days: d.isolationDays, aftercare: d.aftercareDays, cans }, d.catId));
    // A primeira vez: o cercadinho com fraldas e as latinhas.
    if (d.first) lines.push(vetLine(this.session, 'neuter.diapers', {}, d.catId));
    this.vetDeliveries.push({ catId: d.catId, lines });
    if (this.session.atHome() && !this.changingMap) void this.vetDeliveryScene();
  }

  /** A Fernanda aparece ao lado da caixinha (ou do cercadinho) do gato, conta como foi e vai embora pela porta. */
  private async vetDeliveryScene(): Promise<void> {
    if (this.vetDelivering) return;
    this.vetDelivering = true;
    // Espera a entrada no mapa (o gato já no lugar dele) e o que estiver na tela acabar.
    await this.wait(600);
    while (this.ui.isBusy() || this.scripts.isRunning() || this.changingMap) await this.wait(300);
    const npcId = this.session.content.clinic.vet;
    while (this.vetDeliveries.length && this.session.atHome()) {
      const d = this.vetDeliveries.shift()!;
      const spot = this.besideClinicCat(d.catId);
      if (spot) {
        this.spawnNpc(npcId, spot.at, spot.facing);
        const npc = this.npcs.get(npcId)!;
        npc.setAlpha(0);
        this.tweens.add({ targets: npc, alpha: 1, duration: 250 });
      }
      for (const line of d.lines) await this.ui.npcSay(npcId, line);
      const npc = this.npcs.get(npcId);
      this.npcs.delete(npcId);
      if (npc) await this.walkOutAndLeave(npc);
    }
    this.vetDelivering = false;
  }

  /** Uma célula livre ao lado de onde o gato isolado está (a caixinha do canto ou a vaga do cercadinho), virada para ele. */
  private besideClinicCat(catId: string): { at: Cell; facing: Facing } | null {
    const ts = this.map.tileSize;
    const cat = this.cats.find((c) => c.catId === catId);
    const box = this.isoBoxes.get(catId);
    const ref = box ?? (cat?.visible ? cat : null);
    if (!ref) return null;
    const [cc, cr]: Cell = [Math.floor(ref.x / ts), Math.floor((ref.y - 1) / ts)];
    const taken = this.playerCells();
    const free = ([c, r]: Cell) => this.map.solid[r]?.[c] === false && !this.session.placedAt([c, r]) && !taken.some(([x, y]) => x === c && y === r);
    // Do lado (de frente para a caixinha), embaixo (olhando para cima), e um pouco mais longe se o canto estiver cheio.
    const tries: [number, number, Facing][] = [[1, 0, 'left'], [-1, 0, 'right'], [0, 1, 'up'], [1, 1, 'left'], [-1, 1, 'right'], [2, 0, 'left'], [-2, 0, 'right'], [0, 2, 'up']];
    for (const [dx, dy, facing] of tries) {
      const at: Cell = [cc + dx, cr + dy];
      if (free(at)) return { at, facing };
    }
    return null;
  }

  /** O Tião terminou a obra: vem até ela, pergunta se quer mais algum serviço e vai embora (sim abre a aba Construção). */
  private async builderAsk(): Promise<void> {
    if (this.builderAsking) return;
    this.builderAsking = true;
    // Espera a entrada no mapa e o que estiver na tela (falas, roteiros) acabar.
    await this.wait(600);
    while (this.ui.isBusy() || this.scripts.isRunning() || this.changingMap) await this.wait(300);
    const npcId = this.session.content.construction.npc;
    const [pc, pr] = this.feetCell();
    const spot = ([[2, 0], [-2, 0], [0, 2], [1, 1], [-1, 1]] as const).map(([dx, dy]) => [pc + dx, pr + dy] as Cell).find(([c, r]) => this.map.solid[r]?.[c] === false);
    if (spot) {
      this.spawnNpc(npcId, spot, spot[0] < pc ? 'right' : 'left');
      await this.npcs.get(npcId)?.act('acenar', 1200);
      this.npcs.get(npcId)?.face(spot[0] < pc ? 'right' : 'left');
    }
    const t = uiText.construction;
    // Ela já ligou e combinou a próxima obra (antes de ele vir perguntar): ele avisa quando começa, sem perguntar.
    const next = this.session.builderNextJob();
    let more = false;
    if (next) {
      const what = workName(next.job);
      const text = next.startDay === this.session.state.day + 1 ? t.nextTomorrow : t.nextOnDay.replace('{n}', String(next.startDay));
      await this.ui.npcSay(npcId, text.replace('{work}', what));
    } else more = await this.ui.confirm(t.ask, t.askYes, t.askNo);
    this.session.answerBuilder(more);
    // Ele vai embora andando até a saída; o Market (se ela quis mais serviço) abre enquanto ele sai.
    const npc = this.npcs.get(npcId);
    this.npcs.delete(npcId);
    if (npc) void this.walkOutAndLeave(npc);
    this.builderAsking = false;
    if (more) this.ui.openConstruction(true);
  }

  /**
   * Um NPC indo embora a pé: anda pelas células livres (desvia de móveis e da fita) até a saída e some lá. No café, a
   * saída é a porta da rua (world.goHomeDoors); nos outros mapas, a ponta mais perto da linha dele. Sem caminho, some no lugar.
   */
  private async walkOutAndLeave(npc: NpcSprite): Promise<void> {
    const ts = this.map.tileSize;
    const from: Cell = [Math.floor(npc.x / ts), Math.floor(npc.y / ts)];
    const home = this.map.id === this.session.content.map.id;
    const door = home ? this.map.doors.find((d) => this.session.content.world.goHomeDoors.includes(d.id)) : undefined;
    const exit: Cell = door ? door.at : [from[0] < this.map.cols / 2 ? 0 : this.map.cols - 1, from[1]];
    const path = findPath(this.map.solid, from, exit);
    for (const corner of path ? pathCorners(path) : []) {
      if (!npc.active) return;
      await npc.walkTo(corner);
    }
    if (npc.active) await npc.leave();
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

  /**
   * NPC andando numa cena: pelas células livres, desviando dos móveis, da personagem e dos outros NPCs (dá a volta
   * em quem estiver no caminho). Sem caminho livre (alguém tapando a porta), anda direto como antes.
   */
  async npcWalk(npcId: string, to: Cell): Promise<void> {
    const npc = this.npcs.get(npcId);
    if (!npc) return;
    const ts = this.map.tileSize;
    const from: Cell = [Math.floor(npc.x / ts), Math.floor(npc.y / ts)];
    const others = [...this.npcs].filter(([id]) => id !== npcId).map(([, n]): Cell => [Math.floor(n.x / ts), Math.floor(n.y / ts)]);
    const onPlayer = this.playerCells().some(([c, r]) => c === to[0] && r === to[1]);
    let path = onPlayer ? null : findPath(this.solidWith([...this.playerCells(), ...others], to), from, to);
    if (!path) {
      // Ela é que tapa a passagem: dá um passo para o lado (uma célula livre fora do caminho dele) e ele passa.
      const around = findPath(this.solidWith(others, to), from, to);
      const aside = around && this.stepAsideCell(around);
      if (aside) {
        await this.playerWalk(aside);
        path = around;
      }
    }
    // Nem assim (obstáculo dos dois lados): anda direto, para a cena nunca travar.
    if (!path) return npc.walkTo(to);
    for (const corner of pathCorners(path)) {
      if (!npc.active) return;
      await npc.walkTo(corner);
    }
  }

  /** Uma célula livre perto dela que não está no caminho do NPC (para ela sair da frente), ou null. */
  private stepAsideCell(path: readonly Cell[]): Cell | null {
    // Ela ocupa mais de uma célula (os pés): a célula escolhida e a vizinha de cima e do lado também ficam fora do caminho.
    const onPath = (c: number, r: number) => path.some(([pc, pr]) => Math.abs(pc - c) <= 1 && pr <= r && pr >= r - 1);
    const [pc, pr] = this.feetCell();
    for (let d = 1; d <= 4; d++) {
      for (const [dc, dr] of [[0, d], [0, -d], [d, 0], [-d, 0], [d, d], [-d, d], [d, -d], [-d, -d]] as const) {
        const [c, r] = [pc + dc, pr + dr];
        if (this.map.solid[r]?.[c] === false && !onPath(c, r) && ![...this.npcs.values()].some((n) => Math.floor(n.x / this.map.tileSize) === c && Math.floor(n.y / this.map.tileSize) === r)) return [c, r];
      }
    }
    return null;
  }

  /** A grade de colisão do mapa com estas células ocupadas a mais (menos o destino). */
  private solidWith(cells: readonly Cell[], except?: Cell): boolean[][] {
    const solid = this.map.solid.map((row) => [...row]);
    for (const [c, r] of cells) {
      if (except && c === except[0] && r === except[1]) continue;
      if (solid[r]?.[c] !== undefined) solid[r]![c] = true;
    }
    return solid;
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

  fireworks(ms: number): void {
    this.fireworksFx.play(ms, this.session.content.festive.newYear.fireworks);
  }

  until(check: () => boolean): Promise<void> {
    return new Promise((resolve) => this.waiters.push({ until: check, resolve }));
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
    const icon = emoteImage(this, target.x + 6, target.y - target.top, balloon).setOrigin(0.5, 1).setDepth(100_000);
    this.tweens.add({ targets: icon, y: icon.y - 4, duration: 300, ease: 'Quad.easeOut' });
    return new Promise((resolve) =>
      this.time.delayedCall(ms, () => {
        this.tweens.add({ targets: icon, alpha: 0, duration: 200, onComplete: () => (icon.destroy(), resolve()) });
      }),
    );
  }

  /**
   * Teclas "falsas" que levam a jogadora até o alvo do roteiro (primeiro na horizontal). Se ela parar de chegar mais
   * perto (um móvel ou parede no caminho), tenta primeiro na vertical; travou de novo, desiste e fica onde está, e o
   * roteiro segue (antes, ela ficava empurrando a parede para sempre).
   */
  private autoWalkInput(): { up: boolean; down: boolean; left: boolean; right: boolean } {
    const t = this.autoWalk!;
    const dx = t.x - this.player.x;
    const dy = t.y - this.player.y;
    const done = () => {
      this.autoWalk = null;
      t.resolve();
      return NO_INPUT;
    };
    if (Math.abs(dx) <= 1.5 && Math.abs(dy) <= 1.5) {
      (this.player.body as Phaser.Physics.Arcade.Body).reset(t.x, t.y);
      return done();
    }
    const dist = Math.abs(dx) + Math.abs(dy);
    const now = this.time.now;
    if (t.best === undefined || dist < t.best - 1) {
      t.best = dist;
      t.since = now;
    } else if (now - (t.since ?? now) > AUTOWALK_STUCK_MS) {
      if (t.verticalFirst) return done();
      t.verticalFirst = true;
      t.best = dist;
      t.since = now;
    }
    const vertical = Math.abs(dy) > 1.5 && (t.verticalFirst || Math.abs(dx) <= 1.5);
    if (vertical) return { up: dy < 0, down: dy > 0, left: false, right: false };
    return { up: false, down: false, left: dx < 0, right: dx > 0 };
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

/** Louça em cima da bandeja na mão: altura do pé dela a partir do meio da bandeja (pixels do jogo). */
const TRAY_ITEM_LIFT = 2;
/** Louça direto nas mãos (sem bandeja): a base fica tanto abaixo do meio das mãos (px lógicos). */
const DISH_HAND_LIFT = 3;

/** Variante do gato do mini game: o pedido, ou o primeiro abrigado, ou o gato de rua do prólogo. */
function miniGameCatVariant(scene: WorldScene, catId?: string): string {
  const id = catId ?? scene.session.shelteredCats()[0] ?? 'cat.first_stray';
  return scene.session.catDef(id)?.variant ?? 'ruivo';
}

/** Já abriu a pausa do F5 neste carregamento da página (voltar ao mundo depois não pausa de novo). */
let reloadPauseShown = false;

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

/**
 * Ícone "se recompondo" de reserva (sem a folha de ícones): balãozinho creme com um raio verde (desenhado em 2x; a
 * cena usa escala 0.5). A arte é o ícone "recompondo" da folha de 64 px.
 */
function recoverIconTexture(scene: Phaser.Scene): string {
  const key = 'icon-recover';
  if (scene.textures.exists(key)) return key;
  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  g.fillStyle(0x5a3a28, 1).fillCircle(16, 15, 14);
  g.fillStyle(0xfff6e4, 1).fillCircle(16, 15, 12);
  g.fillStyle(0xfff6e4, 1).fillTriangle(11, 25, 17, 25, 9, 31);
  g.fillStyle(0x5a3a28, 1).fillTriangle(9, 31, 10, 28, 12, 29);
  g.fillStyle(0x5aa04a, 1).fillPoints([
    { x: 18, y: 5 }, { x: 10, y: 17 }, { x: 15, y: 17 }, { x: 13, y: 26 }, { x: 22, y: 13 }, { x: 17, y: 13 }, { x: 20, y: 5 },
  ], true);
  g.generateTexture(key, 32, 32);
  g.destroy();
  return key;
}
