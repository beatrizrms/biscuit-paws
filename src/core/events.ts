// Barramento de eventos tipado. Os nomes estão na tabela de docs/ARCHITECTURE.md.
// Puro: sem Phaser, DOM ou window.
import type { Cell } from './map';

export interface GameEvents {
  'game.started': { isNew: boolean };
  'map.entered': { mapId: string };
  'money.changed': { from: number; to: number; reason: string };
  'item.bought': { itemId: string; price: number };
  'item.placed': { itemId: string; uid: string; at: Cell };
  'item.picked_up': { itemId: string; uid: string };
  'item.refunded': { itemId: string; amount: number };
  'surface.painted': { surfaceId: string; finishId: string; price: number };
  'story.beat_completed': { beatId: string };
  'dialogue.requested': { dialogueId: string };
}

export type EventName = keyof GameEvents;
type Handler<K extends EventName> = (payload: GameEvents[K]) => void;
type AnyHandler = (name: EventName, payload: GameEvents[EventName]) => void;

export class EventBus {
  private handlers = new Map<EventName, Set<Handler<EventName>>>();
  private anyHandlers = new Set<AnyHandler>();

  /** Escuta um evento. Devolve a função que cancela a escuta. */
  on<K extends EventName>(name: K, handler: Handler<K>): () => void {
    const set = this.handlers.get(name) ?? new Set();
    set.add(handler as Handler<EventName>);
    this.handlers.set(name, set);
    return () => set.delete(handler as Handler<EventName>);
  }

  /** Escuta todos os eventos (usado pelo motor da história e pelo save). */
  onAny(handler: AnyHandler): () => void {
    this.anyHandlers.add(handler);
    return () => this.anyHandlers.delete(handler);
  }

  emit<K extends EventName>(name: K, payload: GameEvents[K]): void {
    this.handlers.get(name)?.forEach((h) => h(payload));
    this.anyHandlers.forEach((h) => h(name, payload));
  }
}
