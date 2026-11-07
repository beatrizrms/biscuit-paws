// Estado do jogo: só IDs, números, booleanos e textos simples (é o que vai para o save).
// Puro: sem Phaser, DOM ou window.
import type { HandItem, SurfaceItem } from './carry';
import type { Vessel } from './recipes';
import { emptyLoad, newServiceState, type ServiceState, type SinkState } from './service';
import type { Cell } from './map';
import { newHotbar, type HotbarState } from './hotbar';
import type { BusinessStage } from './business';

export interface PlacedItem {
  /** Identificador desta peça posicionada ("p1", "p2"...). Nunca reaproveitado. */
  uid: string;
  item: string;
  at: Cell;
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
    dishes: { cup: 0, glass: 0, plate: 0 },
    hands: [],
    surfaces: [],
    service: newServiceState(),
    tray: false,
    sink: { load: emptyLoad(), washing: null },
    hotbar: newHotbar(),
    business: 'closed',
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
