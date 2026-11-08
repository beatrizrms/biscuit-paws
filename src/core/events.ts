// Barramento de eventos tipado. Os nomes estão na tabela de docs/ARCHITECTURE.md.
// Puro: sem Phaser, DOM ou window.
import type { Cell } from './map';
import type { BusinessStage } from './business';
import type { Schedule } from './schedule';

export interface GameEvents {
  'game.started': { isNew: boolean };
  'map.entered': { mapId: string };
  'cat.sheltered': { catId: string };
  /** Saúde (data/health.json): adoeceu, consultou, tomou remédio, sarou; e o fiado sendo pago. */
  'cat.sick': { catId: string; disease: string };
  'cat.diagnosed': { catId: string; disease: string; days: number; total: number; onCredit: boolean };
  'cat.medicated': { catId: string; dosesGiven: number; days: number };
  'cat.cured': { catId: string };
  /** Contágio: pegou a doença de outro gato. */
  'cat.infected': { catId: string; fromCatId: string; disease: string };
  /** De manhã: gatos doentes demais, os clientes evitam o café. */
  'customers.away': { sickCats: number };
  'debt.paid': { amount: number; left: number };
  /** Um mini game acabou (as moedas já entraram). */
  'reputation.changed': { from: number; to: number; amount: number; reason: string };
  'reputation.threshold_reached': { thresholdId: string; value: number };
  'arrival.queued': { arrivalId: string };
  'arrival.started': { arrivalId: string; catId: string; model: string };
  'arrival.step': { arrivalId: string; step: number };
  'arrival.finished': { arrivalId: string; catId: string; outcome: 'accepted' | 'declined' | 'failed'; placement: 'sheltered' | 'provisional' | 'shelter_pool' | null };
  'arrival.provisional_settled': { catId: string };
  'arrival.provisional_expired': { catId: string };
  'fair.started': Record<string, never>;
  'fair.progress': { step: 'flyer' | 'scheduled' | 'sign' | 'decor' | 'ready'; pointId: string };
  'fair.scheduled': { day: number };
  'fair.missed': { day: number };
  'fair.finished': { adopted: number };
  'cat.adopted': { catId: string; verdict: 'good' | 'ok' | 'bad'; leftCafe: boolean };
  'minigame.finished': { gameId: string; outcome: 'fail' | 'ok' | 'great'; coins: number; skipped: boolean };
  'cat.named': { catId: string; name: string };
  'cat.affection_changed': { catId: string; from: number; to: number };
  'cat.fed': { catId: string; itemId: string; bowlUid: string };
  /** reason: "home" (foi para casa), "passOut" (desmaiou às 2h), "story" (a história encerrou o dia). */
  'day.ended': { day: number; reason: 'home' | 'passOut' | 'story' | 'sleep'; earned: number; jobs: number };
  'day.started': { day: number };
  'money.changed': { from: number; to: number; reason: string };
  'item.bought': { itemId: string; price: number };
  /** Carrinho do mercado mudou (count: unidades; total: moedas). */
  'cart.changed': { count: number; total: number };
  'schedule.changed': { schedule: Schedule };
  /** Cômodos: descoberto (com o gatilho e a porta a destacar), aberto, reformado; passagem trancada. */
  'room.discovered': { roomId: string; trigger: string; highlight: string | null };
  'room.opened': { roomId: string };
  'room.restored': { roomId: string };
  'door.blocked': { doorId: string };
  /** O negócio mudou de estágio (fechado -> parcial -> inaugurado). */
  'business.changed': { from: BusinessStage; to: BusinessStage };
  /** Pagou no caixa: tudo o que estava no carrinho. */
  'cart.checked_out': { lines: { itemId: string; qty: number }[]; total: number };
  'item.received': { itemId: string };
  'item.placed': { itemId: string; uid: string; at: Cell };
  'item.picked_up': { itemId: string; uid: string };
  'item.refunded': { itemId: string; amount: number };
  'dirt.cleaned': { dirtId: string };
  'surface.painted': { surfaceId: string; finishId: string; price: number };
  'story.beat_completed': { beatId: string };
  'dialogue.requested': { dialogueId: string };
  'cutscene.requested': { cutsceneId: string };
  'cutscene.finished': { cutsceneId: string };
  'script.requested': { scriptId: string };
  'script.finished': { scriptId: string };
  'job.accepted': { jobId: string };
  'menu.changed': { menu: string[] };
  'prep.started': { stationUid: string; recipeId: string };
  'prep.ready': { stationUid: string; recipeId: string; final: boolean };
  'customer.arrived': { customerId: string; recipeId: string | null };
  'customer.served': { customerId: string; recipeId: string; price: number; tip: number; quality: 'simple' | 'premium' };
  'sink.changed': { load: number };
  'heavy.stored': { itemId: string };
  'customer.left': { customerId: string; happy: boolean };
  'hands.changed': { count: number };
  'dish.washed': { count: number };
  'delivery.ordered': { deliveryId: string; itemId: string; arrivesAt: number };
  'delivery.arrived': { deliveryId: string; itemId: string };
  'delivery.picked_up': { count: number };
  'delivery.unpacked': { deliveryId: string; itemId: string };
  'job.progress': { jobId: string; pointId: string };
  'job.completed': { jobId: string; reward: number };
  'hotbar.changed': { active: number };
  /** Receita nova destrancada (pela evolução do café: clientes atendidos). */
  'recipe.unlocked': { recipeId: string };
  'cat.treated': { catId: string; itemId: string };
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
