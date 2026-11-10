// Estado do jogo: só IDs, números, booleanos e textos simples (é o que vai para o save).
// Puro: sem Phaser, DOM ou window.
import { newConstruction, type ConstructionState } from './construction';
import { DEFAULT_PRONOUN, type Pronoun } from './pronoun';
import type { HandItem, SurfaceItem } from './carry';
import type { Vessel } from './recipes';
import { emptyLoad, newServiceState, type ServiceState, type SinkState } from './service';
import type { Cell } from './map';
import type { CatSickness } from './health';
import { newHotbar, type HotbarState } from './hotbar';
import type { BusinessStage } from './business';
import type { Appearance } from './appearance';
import type { DoorState, RoomState } from './rooms';
import type { Schedule } from './schedule';
import type { ArrivalsState } from './arrivals';
import type { CatDef } from './cats';
import { newFestivals, type FestivalsState } from './festival';
import type { ReputationState } from './reputation';

export interface PlacedItem {
  /** Identificador desta peça posicionada ("p1", "p2"...). Nunca reaproveitado. */
  uid: string;
  item: string;
  at: Cell;
  /** Caixa de areia comum: o dia em que ela pôs areia limpa. */
  refilledOn?: number;
  /** Automático (pote de ração, caixa de areia): quantos dias guardados e de qual item (a ração escolhida). */
  stock?: number;
  stockItem?: string;
}

export interface GameState {
  day: number;
  /** Hora do dia, em minutos desde 00:00 (passa de 1440 de madrugada). */
  time: number;
  money: number;
  flags: Record<string, boolean>;
  /** Itens comprados e ainda não posicionados: itemId -> quantidade. */
  inventory: Record<string, number>;
  placed: PlacedItem[];
  nextUid: number;
  /** Marcos concluídos e o dia em que cada um terminou (v6). */
  story: { completed: string[]; completedOn: Record<string, number> };
  /** Gatos abrigados: nome escolhido e mapa onde vivem. */
  cats: Record<string, CatState>;
  /** Corações entre pares ("player|cat.x", "npc.y|cat.x"...): pontos acumulados. */
  relationships: Record<string, number>;
  /** Reforma: superfície -> acabamento aplicado pelo pintor. Sem entrada = original (velho). */
  finishes: Record<string, string>;
  /** Mapa onde a personagem está. */
  location: string;
  /** Mapas onde ela já entrou. */
  visited: string[];
  /** Sujeiras do café já limpas (ids). */
  cleaned: string[];
  /** Relógios marcados pela história (v6): id -> momento absoluto (ver nowAbs). Ex.: a chegada da Gabi. */
  timers: Record<string, number>;
  /** Resumo do dia em andamento (v6): moedas ganhas e pedidos feitos. */
  today: { earned: number; jobs: number };
  /** Pedidos da vila (v6): aceitos agora, pontos já feitos e o último dia em que cada um foi concluído. */
  jobs: { active: string[]; progress: Record<string, string[]>; doneOn: Record<string, number> };
  /** Compras do catálogo pelo correio (v7): a caminho, na porta, nas mãos dela ou dentro do café. */
  deliveries: Delivery[];
  /** Quadro do cardápio (v8): receitas, na ordem dos slots. */
  menu: string[];
  /** Doses que sobraram do pacote aberto de cada ingrediente (v8). Os fechados ficam em inventory. */
  pantryOpen: Record<string, number>;
  /**
   * Despensa (v26): pacotes de ingrediente guardados no armário da cozinha. Só o que está aqui (e o pacote aberto,
   * pantryOpen) conta para as receitas; as compras vão para a mochila e ela guarda no armário.
   */
  pantry: Record<string, number>;
  /** Louça limpa no estoque (v8): xícaras, copos, pratos. A suja está nas mãos ou nas superfícies. */
  dishes: Record<Vessel, number>;
  /** O que está nas mãos (v8). */
  hands: HandItem[];
  /** O que foi deixado em balcões, mesas, equipamentos ou no chão do café (v8). */
  surfaces: SurfaceItem[];
  /** Atendimento (v8): clientes, preparos e o total atendido. */
  service: ServiceState;
  /** Está segurando a bandeja (v9). */
  tray: boolean;
  /** Barra de itens e o espaço ativo (v10). */
  hotbar: HotbarState;
  /** Pia (v9): louça suja esperando e a lavagem em andamento. */
  sink: SinkState;
  /** Estágio do negócio (v11): fechado, funcionamento parcial (sem placa) ou inaugurado (com placa). Só avança. */
  business: BusinessStage;
  /** Fiado (v13): quanto ela ainda deve (a primeira consulta da clínica). Parte de cada ganho paga. */
  debt: number;
  /**
   * A protagonista (v12): nome e aparência escolhidos no início do jogo.
   * appearance null = a padrão dos dados (saves de antes do criador).
   */
  player: PlayerState;
  /** Cômodos (v14): estado de cada um e das passagens; o que não está aqui vale o `initial` de data/rooms.json. */
  rooms: Record<string, RoomState>;
  doors: Record<string, DoorState>;
  /** Horário de funcionamento escolhido (v15; app "Horário"). null = o padrão de data/service.json. */
  schedule: Schedule | null;
  /** Energia da protagonista (energy.ts). Sem o campo (save antigo ou jogo novo): cheia. */
  energy?: number;
  /** Janelas com a cortina aberta (ids dos objetos). Sem o campo (save antigo ou jogo novo): todas fechadas. */
  openCurtains?: string[];
  /** Reputação felina da cidade (v16): valor, limiares já alcançados e o log curto dos motivos. */
  reputation: ReputationState;
  /** Festivais (v22; a feira de adoção era o campo fair, v17): o evento em andamento, a última edição de cada um e o de hoje. */
  festivals: FestivalsState;
  /** A melhor foto (v23; foto perfeita): a pose, a nota, os gatos e o dia. Sem galeria por enquanto. */
  bestPhoto: { pose: string; score: number; catIds: string[]; day: number } | null;
  /** Lista de compras (v24; app Notas): IDs de itens anotados, na ordem; some ao comprar. */
  shoppingList: string[];
  /** Obras com o construtor (v25): reparos feitos, orçamento, obra em andamento e acabamento por célula. */
  construction: ConstructionState;
  /** Chegadas de gatos (v18): a em andamento, a fila, o histórico, a próxima e o abrigo da vila. */
  arrivals: ArrivalsState;
  /** Gatos gerados pelas chegadas (v18): a definição fica no save (os de data/cats.json não). */
  catDefs: Record<string, CatDef>;
  /** Tutorial (v19): quantas vezes ela já usou o E em cada tipo de coisa (a dica "E" some depois de algumas). */
  hintUses: Record<string, number>;
}

export interface PlayerState {
  name: string;
  appearance: Appearance | null;
  /** Ela ou ele (v21): os textos com {g:feminino|masculino} seguem esta escolha (core/pronoun.ts). */
  pronoun: Pronoun;
}

/** Ordem das etapas de uma entrega (depois de "inside" ela abre a caixa e o item vai para a bolsa). */
export const DELIVERY_STAGES = ['shipping', 'door', 'carried', 'inside'] as const;
export type DeliveryStage = (typeof DELIVERY_STAGES)[number];

export interface Delivery {
  uid: string;
  item: string;
  stage: DeliveryStage;
  /** Momento absoluto (nowAbs) em que chega na porta. */
  arrivesAt: number;
}

/** Momento absoluto do jogo, em minutos: cresce sempre (dia * 1440 + hora; a madrugada passa de 1440). */
export function nowAbs(state: Pick<GameState, 'day' | 'time'>): number {
  return state.day * 1440 + state.time;
}

export interface CatState {
  sheltered: boolean;
  /** Nome dado pela jogadora (vazio até ela escolher). */
  name: string;
  map: string;
  /** Último dia em que comeu (v6; rotina diária). */
  fedOn?: number;
  /** Último dia em que brincaram com ele (varinha); sem = desde shelteredOn. O pedido de brincar conta daqui (care.ts). */
  playedOn?: number;
  /** Ração que comeu no dia `fedOn` (id do item; sem = a comum). A premium dá mais saúde (healthMultiplier). */
  fedWith?: string;
  /** Dia em que foi abrigado (v13; app "Meus gatos": dias no café). */
  shelteredOn: number;
  /** Saúde de 0 a health.max (v13). */
  health: number;
  /** Doença em andamento e a receita (v13); null = saudável. */
  sickness: CatSickness | null;
  /** Felicidade e higiene, 0 a 100 (v20; care.ts). Ausente = o valor inicial de health.json: care.start. */
  happiness?: number;
  hygiene?: number;
  /** Abrigado provisório (v18; café cheio): até este dia, a vaga precisa abrir ou ele vai para o abrigo da vila. */
  provisionalUntil?: number;
}

export function newGameState(startingMoney: number, startMap = 'map.street', time = 7 * 60): GameState {
  return {
    day: 1,
    time,
    money: startingMoney,
    flags: {},
    inventory: {},
    placed: [],
    nextUid: 1,
    story: { completed: [], completedOn: {} },
    cats: {},
    relationships: {},
    finishes: {},
    location: startMap,
    visited: [startMap],
    cleaned: [],
    timers: {},
    today: { earned: 0, jobs: 0 },
    jobs: { active: [], progress: {}, doneOn: {} },
    deliveries: [],
    menu: [],
    pantryOpen: {},
    pantry: {},
    dishes: { cup: 0, glass: 0, plate: 0 },
    hands: [],
    surfaces: [],
    service: newServiceState(),
    tray: false,
    sink: { load: emptyLoad(), washing: null },
    hotbar: newHotbar(),
    business: 'closed',
    player: { name: '', appearance: null, pronoun: DEFAULT_PRONOUN },
    debt: 0,
    rooms: {},
    doors: {},
    schedule: null,
    // O valor inicial de verdade vem de data/reputation.json: a sessão aplica no jogo novo (start).
    reputation: { value: 0, reached: [], log: [] },
    festivals: newFestivals(),
    bestPhoto: null,
    shoppingList: [],
    construction: newConstruction(),
    arrivals: { active: null, queue: [], last: {}, nextOn: null, seq: 0, shelterPool: [] },
    catDefs: {},
    hintUses: {},
  };
}

/** Quantos deste item estão posicionados no café. */
export function placedCount(state: GameState, itemId: string): number {
  return state.placed.filter((p) => p.item === itemId).length;
}

/** Quantos deste item estão em entregas numa etapa igual ou depois de `from`. */
export function deliveredCount(state: GameState, itemId: string, from: DeliveryStage = 'shipping'): number {
  const min = DELIVERY_STAGES.indexOf(from);
  return state.deliveries.filter((d) => d.item === itemId && DELIVERY_STAGES.indexOf(d.stage) >= min).length;
}

/** Quantos deste item a jogadora tem (no inventário + posicionados). */
export function ownedCount(state: GameState, itemId: string): number {
  return (state.inventory[itemId] ?? 0) + placedCount(state, itemId);
}
