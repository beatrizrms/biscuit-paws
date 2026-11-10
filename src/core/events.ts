// Barramento de eventos tipado. Os nomes estão na tabela de docs/ARCHITECTURE.md.
// Puro: sem Phaser, DOM ou window.
import type { Cell } from './map';
import type { BusinessStage } from './business';
import type { Schedule } from './schedule';

/** Por que o dia acabou (ver 'day.ended'). */
export type DayEndReason = 'home' | 'passOut' | 'story' | 'sleep' | 'curfew' | 'tired';

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
  /** A chegada pergunta (sim/não); a resposta volta por session.answerArrival. */
  'arrival.choice': { arrivalId: string; key: string };
  /** Vizinhos dão dicas (etapa ask); a escolha volta por session.answerArrivalAsk. */
  /** Gato carteiro: comeu o que ela deixou (refeições até agora e quantas faltam no total). */
  /** Aceito: o gato precisa disto antes de entrar (ração, cobertor, vet). */
  /** Um mini game de cuidado subiu a felicidade/higiene do gato (os valores depois). */
  'cat.cared': { catId: string; gameId: string; happiness: number; hygiene: number };
  'arrival.needs': { arrivalId: string; needs: ('food' | 'vet' | 'warmth')[] };
  'arrival.need_met': { arrivalId: string; need: 'food' | 'vet' | 'warmth'; left: ('food' | 'vet' | 'warmth')[] };
  'arrival.fed': { arrivalId: string; fed: number; times: number };
  'arrival.ask': { arrivalId: string; options: { npc: string; tip: string }[] };
  'arrival.finished': { arrivalId: string; catId: string; outcome: 'accepted' | 'declined' | 'failed'; placement: 'sheltered' | 'provisional' | 'shelter_pool' | null };
  'arrival.provisional_settled': { catId: string };
  'arrival.provisional_expired': { catId: string };
  'festival.started': { festivalId: string };
  'festival.progress': { festivalId: string; step: 'prep' | 'close' | 'decor' | 'ready'; pointId: string };
  'festival.scheduled': { festivalId: string; day: number };
  'festival.missed': { festivalId: string; day: number };
  'festival.finished': { festivalId: string; results: { game: string; outcome: 'fail' | 'ok' | 'great'; coins: number; skipped: boolean; setup?: { visitors: number }; contest?: { rank: number }; photo?: { score: number } }[]; coins: number; reputation: number; adopted: number };
  'photo.best': { pose: string; score: number; catIds: string[] };
  'cat.adopted': { catId: string; verdict: 'good' | 'ok' | 'bad'; leftCafe: boolean };
  'minigame.finished': { gameId: string; outcome: 'fail' | 'ok' | 'great'; coins: number; skipped: boolean };
  'cat.named': { catId: string; name: string };
  'cat.affection_changed': { catId: string; from: number; to: number };
  'cat.fed': { catId: string; itemId: string; bowlUid: string };
  /** Abasteceu um automático (pote de ração, caixa de areia): o item e quantos dias ficou guardado. */
  'pet.loaded': { itemId: string; days: number };
  /** Um automático gastou e ficou com poucos dias (ou vazio). */
  'pet.low': { itemId: string; days: number };
  /** Areia limpa na caixa comum. */
  'litter.refilled': { uid: string };
  /** Fim de um dia sem areia limpa: a higiene dos gatos caiu mais. */
  'litter.missed': { day: number };
  /**
   * reason: "home" (foi para casa), "passOut" (desmaiou às 2h), "story" (a história encerrou o dia), "sleep" (dormiu no porão),
   * "curfew" (deu a hora-limite e amanhã tem expediente), "tired" (a hora-limite da véspera de folga).
   */
  'day.ended': { day: number; reason: DayEndReason; earned: number; jobs: number };
  /** A energia mudou (gastou numa tarefa ou acordou). level: 'ok', 'low' (cansada) ou 'empty'. */
  'energy.changed': { energy: number; max: number; level: 'ok' | 'low' | 'empty' };
  /** Ela se recompôs (café ou brincadeira; o sofá avisa por rest.changed). */
  'energy.recovered': { source: 'coffee' | 'play'; amount: number };
  /** Sentou (uid do sofá ou cadeira) ou levantou (null). */
  'rest.changed': { uid: string | null };
  /** Sentada, a energia encheu (ela continua sentada até levantar). */
  'rest.full': Record<string, never>;
  /** Falta `minutes` para a hora-limite (uma vez por dia). */
  'curfew.soon': { minutes: number };
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
  /** Móvel mudou de lugar (sem passar pela mochila); carried: quantos iam em cima dele. */
  'item.moved': { itemId: string; uid: string; at: [number, number]; carried: number };
  /** Assistência técnica: a peça virou outra do mesmo grupo, no mesmo lugar (src/core/upgrades.ts). */
  'item.upgraded': { uid: string; from: string; to: string; cost: number };
  'item.refunded': { itemId: string; amount: number };
  'dirt.cleaned': { dirtId: string };
  'curtain.toggled': { objectId: string; open: boolean };
  'surface.painted': { surfaceId: string; finishId: string; price: number };
  /** Obras (src/core/construction.ts): ligação com o orçamento, resposta, fim da obra e a pergunta dele depois. */
  'construction.call': { kind: string };
  'construction.accepted': { kind: string; startDay: number; endDay: number };
  'construction.declined': { kind: string };
  'construction.done': { kind: string };
  'construction.asked': { more: boolean };
  /** O Tião chegou para o expediente (working) ou foi embora; map: onde fica a obra. */
  'construction.shift': { working: boolean; map: string };
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
  /** stars e reputation: a avaliação ao sair (sem eles: o café fechou com ele na fila). */
  /** Porta de estabelecimento fora do horário: o nome e quando abre de novo. */
  'door.closed': { doorId: string; name: string; opensDay: number | null; opensAt: string | null };
  /** Ela guardou na despensa os ingredientes da mochila (pacotes). */
  'pantry.stored': { count: number };
  'customer.left': { customerId: string; happy: boolean; stars?: number; reputation?: number };
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
