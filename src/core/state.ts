// Estado do jogo: só IDs, números, booleanos e textos simples (é o que vai para o save).
// Puro: sem Phaser, DOM ou window.
import type { Cell } from './map';

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
  story: { completed: string[] };
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
}

export interface CatState {
  sheltered: boolean;
  /** Nome dado pela jogadora (vazio até ela escolher). */
  name: string;
  map: string;
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
    story: { completed: [] },
    cats: {},
    relationships: {},
    finishes: {},
    location: startMap,
    visited: [startMap],
    cleaned: [],
  };
}

/** Quantos deste item estão posicionados no café. */
export function placedCount(state: GameState, itemId: string): number {
  return state.placed.filter((p) => p.item === itemId).length;
}

/** Quantos deste item a jogadora tem (no inventário + posicionados). */
export function ownedCount(state: GameState, itemId: string): number {
  return (state.inventory[itemId] ?? 0) + placedCount(state, itemId);
}
