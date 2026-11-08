// Sessão de jogo: o único lugar que muda o estado. O Phaser chama estas ações
// e escuta os eventos. Puro: sem Phaser, DOM ou window.
import type { Condition, Content, Effect, ItemUse } from './content';
import { seenFlag } from './cutscene';
import { parseClock } from './time';
import { newsForDay, type JobDef, type JobPoint, type NewsItem } from './jobs';
import { createRng } from './rng';
import { CafeService } from './service';
import { cleanCatName, suggestCatName } from './cats';
import { addPoints, hearts, PLAYER } from './relationships';
import { EventBus } from './events';
import { clampHealth, isContagious, pickDisease, prescriptionDays, rollsContagion, rollsIllness } from './health';
import { activeItem, assignToSlot, fitsHotbar, isSlot, swapSlots, syncHotbar } from './hotbar';
import { Cart, MAX_QTY_PER_ITEM } from './cart';
import { stageAtLeast, type BusinessStage } from './business';
import type { Appearance } from './appearance';
import { hasFreeHost, itemOnTop, placedItemAt, placementProblem, placeOnProblem, withPlaced, type PlaceProblem } from './placement';
import { nowAbs, type Delivery, type DeliveryStage, type GameState } from './state';
import { activeBeats, currentGoals, evaluate, isBeatSatisfied, isCleaned, type GoalView, type StoryContext } from './story';
import {
  cellsOf,
  interactionNear,
  type Cell,
  type DirtSpot,
  type MapData,
  type MapDoor,
  type MapInteraction,
  type SurfaceDef,
} from './map';

/** Orçamento da consulta na clínica. */
export interface ConsultQuote {
  catId: string;
  disease: string;
  days: number;
  consult: number;
  medicine: number;
  total: number;
  /** Primeira consulta sem dinheiro bastante: fica fiado. */
  onCredit: boolean;
}

/** Ficha de um gato abrigado (app "Meus gatos"). */
export interface CatProfile {
  id: string;
  name: string;
  variant: string;
  personality: string;
  hearts: number;
  maxHearts: number;
  fedToday: boolean;
  daysInCafe: number;
  map: string;
  /** Saúde (0 a maxHealth). */
  health: number;
  maxHealth: number;
  /** Doente: a doença e, depois da consulta, a receita (doses dadas, se já tomou hoje). */
  sickness: { disease: string; treatment: { days: number; dosesGiven: number; dosedToday: boolean } | null } | null;
}

export type ActionResult =
  | { ok: true }
  | {
      ok: false;
      reason:
        | 'unknown_item'
        | 'no_money'
        | 'not_in_inventory'
        | 'needs_broom'
        | 'needs_food'
        | 'needs_treat'
        | 'needs_medicine'
        | 'not_at_clinic'
        | 'bring_cat'
        | 'not_sick'
        | 'already_treated'
        | 'no_prescription'
        | 'already_dosed'
        | 'not_found'
        | 'unknown_surface'
        | 'unknown_finish'
        | 'wrong_surface'
        | 'already_painted'
        | 'locked'
        | 'too_far'
        | 'needs_repair'
        | 'invalid_name'
        | 'not_sheltered'
        | 'no_food'
        | 'no_cat'
        | 'already_fed'
        | 'unknown_job'
        | 'job_full'
        | 'job_unavailable'
        | 'missing_item'
        | 'door_full'
        | 'hands_full'
        | 'nothing_here'
        | 'already_owned'
        | 'cart_empty'
        | 'one_heavy_per_trip'
        | PlaceProblem;
    };

export class GameSession {
  readonly bus = new EventBus();

  /** Atendimento do café: cardápio, pedidos, mãos, louça, clientes (service.ts). */
  readonly service: CafeService;

  /** Carrinho do mercado (fora do save: nada foi pago ainda). */
  readonly cart = new Cart();

  constructor(
    readonly content: Content,
    readonly state: GameState,
  ) {
    let rngCalls = 0;
    this.service = new CafeService({
      state,
      content,
      bus: this.bus,
      rng: () => createRng(state.day * 1009 + state.service.nextCustomerId * 97 + rngCalls++),
      homeMap: () => this.mapData(this.content.map.id),
      atHome: () => this.atHome(),
      evaluate: (c) => evaluate(c, this.state, this.storyContext()),
      addMoney: (delta, reason) => this.addMoney(delta, reason),
      advanceStory: () => this.advanceStory(),
      catAffection: (catId, points) => this.addCatAffection(catId, points),
      customersAway: () => this.customersAway(),
    });
    // Ferramenta ou item com uso que acabou de chegar (a vassoura da corretora, a ração do mercado) vai sozinho
    // para a barra, venha de onde vier. O que ela tirou da barra de propósito não volta sozinho.
    if (state.hotbar.slots.every((s) => s === null)) syncHotbar(state.hotbar, state.inventory, content.items); // save sem barra (v9)
    this.ownedIds = this.ownedNow();
    this.bus.onAny((name) => {
      if (name !== 'hotbar.changed') this.syncHotbar();
    });
  }

  /** Começa a sessão: avisa quem escuta e dispara os marcos que já valem (ex.: a abertura). */
  start(isNew: boolean): void {
    // Saves de antes da v8: a louça que ela já ganhou entra no estoque.
    for (const id of Object.keys(this.state.inventory)) this.service.stockDishes(id);
    this.announceRecipes(true);
    this.bus.emit('game.started', { isNew });
    this.advanceStory();
  }

  // ---------- Barra de itens ----------

  /** Itens que ela tinha no último evento (para achar os que acabaram de chegar). */
  private ownedIds = new Set<string>();

  private ownedNow(): Set<string> {
    return new Set(Object.keys(this.state.inventory).filter((id) => (this.state.inventory[id] ?? 0) > 0));
  }

  private syncHotbar(): void {
    const now = this.ownedNow();
    const arrived = [...now].filter((id) => !this.ownedIds.has(id));
    this.ownedIds = now;
    if (arrived.length && syncHotbar(this.state.hotbar, this.state.inventory, this.content.items, arrived)) this.bus.emit('hotbar.changed', { active: this.state.hotbar.active });
  }

  /** Item no espaço ativo da barra (o que ela usa para agir), se ainda tiver. */
  activeItem(): string | null {
    return activeItem(this.state.hotbar, this.state.inventory);
  }

  /** Deixa ativo o espaço onde está este item (se estiver na barra). */
  selectHotbarItem(itemId: string): boolean {
    const slot = this.state.hotbar.slots.indexOf(itemId);
    if (slot < 0) return false;
    this.selectHotbarSlot(slot);
    return true;
  }

  /** Escolhe o espaço ativo (0 a HOTBAR_SIZE - 1). */
  selectHotbarSlot(slot: number): void {
    if (!isSlot(slot) || slot === this.state.hotbar.active) return;
    this.state.hotbar.active = slot;
    this.bus.emit('hotbar.changed', { active: slot });
  }

  /** Põe um item da mochila num espaço da barra (padrão: o ativo). Se já estava na barra, troca de lugar. */
  assignToHotbar(itemId: string, slot = this.state.hotbar.active): ActionResult {
    if (!fitsHotbar(this.content.items[itemId]) || !isSlot(slot)) return { ok: false, reason: 'unknown_item' };
    if ((this.state.inventory[itemId] ?? 0) < 1) return { ok: false, reason: 'not_in_inventory' };
    assignToSlot(this.state.hotbar, slot, itemId);
    this.bus.emit('hotbar.changed', { active: this.state.hotbar.active });
    return { ok: true };
  }

  /** Tira o item de um espaço da barra (ele continua na mochila). */
  clearHotbarSlot(slot: number): void {
    if (!isSlot(slot) || this.state.hotbar.slots[slot] === null) return;
    this.state.hotbar.slots[slot] = null;
    this.bus.emit('hotbar.changed', { active: this.state.hotbar.active });
  }

  /** Troca dois espaços da barra (arrastar um sobre o outro). */
  moveHotbarSlot(from: number, to: number): void {
    if (!isSlot(from) || !isSlot(to) || from === to) return;
    swapSlots(this.state.hotbar, from, to);
    this.bus.emit('hotbar.changed', { active: this.state.hotbar.active });
  }

  /** Falta a ferramenta da ação no espaço ativo? */
  private toolProblem(action: 'sweep'): 'needs_broom' | null {
    return this.activeItem() === this.content.world.tools[action] ? null : 'needs_broom';
  }

  /**
   * O item já pode ser comprado? (ex.: coisas de gato só depois de ter um gato)
   * Equipamentos e ingredientes seguem a evolução das receitas: só aparecem quando alguma receita
   * destrancada usa eles (o bule chega ao catálogo junto com o chá). Sem receita nenhuma, ficam escondidos.
   */
  itemUnlocked(itemId: string): boolean {
    const item = this.content.items[itemId];
    if (!item || (item.requires && !evaluate(item.requires, this.state, this.storyContext()))) return false;
    const recipes = Object.values(this.content.recipes);
    const equipment = this.content.service.equipment;
    const isEquipment = Object.values(equipment).some((e) => item.tags.includes(e.tag));
    const usedBy = recipes.filter((r) =>
      isEquipment
        ? r.steps.some((st) => item.tags.includes(equipment[st.equipment]?.tag ?? ''))
        : item.tags.includes('ingredient') && (itemId in r.ingredients || Object.values(r.premium ?? {}).includes(itemId)),
    );
    // Ingrediente que nenhuma receita usa ainda (chá de camomila, mel...) fica guardado para quando usar.
    if (usedBy.length === 0) return !isEquipment && !item.tags.includes('ingredient');
    return usedBy.some((r) => this.service.recipeStatus(r.id) !== 'locked');
  }

  /** Receitas destrancadas que ela ainda não viu: avisa uma vez (o café evoluiu). Na abertura, só marca. */
  private announceRecipes(silent: boolean): void {
    for (const r of this.service.unlockedRecipes()) {
      const flag = `recipe.known.${r.id}`;
      if (this.state.flags[flag]) continue;
      this.state.flags[flag] = true;
      if (!silent && r.unlock) this.bus.emit('recipe.unlocked', { recipeId: r.id });
    }
  }

  /** Esta porta, agora, mostra uma cena em vez de deixar passar? Devolve o id da cena. */
  doorIntercept(door: MapDoor): string | undefined {
    const i = door.intercept;
    if (!i || !evaluate(i.when as Condition, this.state, this.storyContext())) return undefined;
    this.bus.emit('cutscene.requested', { cutsceneId: i.cutscene });
    return i.cutscene;
  }

  /** Interação ao alcance no mapa atual (`target`: só a célula clicada). */
  interactionAt(feet: readonly Cell[], target?: Cell): MapInteraction | undefined {
    const map = this.mapData(this.state.location);
    return interactionNear({ interactions: map.interactions ?? [] }, feet, target);
  }

  /** Itens à venda numa loja (na ordem dos dados). */
  shopItems(shopId: string): string[] {
    return this.content.shops[shopId]?.items ?? [];
  }

  /** Tigela de ração posicionada ao alcance dos pés (`target`: só a célula clicada). */
  bowlNear(feet: readonly Cell[], target?: Cell, reach = 1): string | undefined {
    if (!this.atHome()) return undefined;
    const { catalog, items } = this.content;
    const dist = (a: Cell, b: Cell) => Math.max(Math.abs(a[0] - b[0]), Math.abs(a[1] - b[1]));
    return this.state.placed.find((p) => {
      const item = items[p.item];
      if (!item?.tags.includes('food_bowl') || !item.tile) return false;
      const cells = cellsOf(p.at, catalog.tiles[item.tile]!);
      if (target && !cells.some(([c, r]) => c === target[0] && r === target[1])) return false;
      return cells.some((c) => feet.some((f) => dist(c, f) <= reach));
    })?.uid;
  }

  /** Item ativo da barra, se ele tiver este uso (ração para a tigela, petisco para o gato). */
  private activeUse(use: ItemUse): string | null {
    const id = this.activeItem();
    return id && this.content.items[id]?.use === use ? id : null;
  }

  /** Por que não dá para encher a tigela agora (ou null). A interface confere antes de tocar a animação. */
  feedProblem(bowlUid: string): 'not_found' | 'already_fed' | 'no_food' | 'no_cat' | 'needs_food' | null {
    if (!this.state.placed.some((p) => p.uid === bowlUid)) return 'not_found';
    const catId = this.shelteredCats().find((id) => this.state.cats[id]!.map === this.content.map.id);
    if (catId && this.state.cats[catId]!.fedOn === this.state.day) return 'already_fed';
    const hasFood = Object.values(this.content.items).some((i) => i.use === 'food_bowl' && (this.state.inventory[i.id] ?? 0) > 0);
    if (!hasFood) return 'no_food';
    if (!catId) return 'no_cat';
    // A ração vai da barra para a mão: precisa estar no espaço ativo (simples ou premium, a que ela escolher).
    return this.activeUse('food_bowl') ? null : 'needs_food';
  }

  /** Enche a tigela com a ração ativa na barra e um gato do café come (ganha corações). */
  feedFromBowl(bowlUid: string): ActionResult {
    const problem = this.feedProblem(bowlUid);
    if (problem) return { ok: false, reason: problem };
    const catId = this.shelteredCats().find((id) => this.state.cats[id]!.map === this.content.map.id)!;
    const food = this.activeUse('food_bowl')!;
    this.removeFromInventory(food);
    this.state.flags[`fed.${catId}`] = true;
    this.state.cats[catId]!.fedOn = this.state.day;
    this.bus.emit('cat.fed', { catId, itemId: food, bowlUid });
    this.addCatAffection(catId, this.content.relationships.feedPoints);
    return { ok: true };
  }

  /** O item ativo é um petisco? (aí clicar no gato dá o petisco em vez de pegar no colo) */
  holdingTreat(): boolean {
    return !!this.activeUse('cat');
  }

  /** Dá ao gato o petisco ativo na barra (direto da mochila, sem passar pelas mãos). */
  treatCat(catId: string): ActionResult {
    if (!this.state.cats[catId]?.sheltered) return { ok: false, reason: 'not_found' };
    const treat = this.activeUse('cat');
    if (!treat) return { ok: false, reason: 'needs_treat' };
    this.removeFromInventory(treat);
    this.bus.emit('cat.treated', { catId, itemId: treat });
    this.addCatAffection(catId, this.content.relationships.treatPoints);
    return { ok: true };
  }

  /**
   * Fim do dia: ela vai para casa (ou para o quartinho, quando existir: world.sleepMap)
   * e amanhece no dia seguinte, chegando pela rua.
   */
  endDay(reason: 'home' | 'passOut' | 'story' = 'story'): void {
    const day = this.state.day;
    const summary = { day, reason, earned: this.state.today.earned, jobs: this.state.today.jobs };
    // Pedidos pela metade não passam para o dia seguinte (e a caixa da entrega volta para o mercado).
    this.state.jobs.active = [];
    this.state.jobs.progress = {};
    for (const id of Object.keys(this.state.inventory)) if (this.content.items[id]?.tags.includes('job')) delete this.state.inventory[id];
    this.healthAtDayEnd(day);
    this.state.day = day + 1;
    this.state.time = parseClock(reason === 'passOut' ? this.content.dayNight.wakeAfterPassOut : this.content.dayNight.dayStart);
    this.state.today = { earned: 0, jobs: 0 };
    const morning = this.content.world.morning;
    this.state.location = morning.map;
    if (!this.state.visited.includes(morning.map)) this.state.visited.push(morning.map);
    this.dirtComesBack();
    this.randomIllness();
    if (this.customersAway()) this.bus.emit('customers.away', { sickCats: this.sickCats().length });
    this.service.endOfDay();
    this.cart.clear();
    this.bus.emit('cart.changed', { count: 0, total: 0 });
    this.bus.emit('day.ended', summary);
    this.bus.emit('day.started', { day: day + 1 });
    this.advanceStory();
  }

  /** Relógio: avança `seconds` reais (o jogo chama a cada quadro, quando nada está aberto). */
  tickClock(seconds: number): void {
    const before = Math.floor(this.state.time);
    this.state.time += seconds * this.content.dayNight.minutesPerSecond;
    if (this.state.time >= parseClock(this.content.dayNight.passOut)) this.endDay('passOut');
    // A cada minuto de jogo: o correio e a história olham de novo (marcos com hora marcada, ex.: a visita da Gabi).
    else if (Math.floor(this.state.time) !== before) {
      this.deliverArrived();
      this.service.tick();
      this.advanceStory();
    }
  }

  /** Já dá para encerrar o dia na porta do café? */
  canGoHome(): boolean {
    return this.state.time >= parseClock(this.content.dayNight.goHomeFrom);
  }

  /** Ela encerra o dia e vai para casa (na porta do café, a partir de goHomeFrom). */
  goHome(): void {
    if (this.canGoHome()) this.endDay('home');
  }

  /** De manhã, um pouco da poeira do café volta (depois do prólogo): a rotina de varrer. */
  private dirtComesBack(): void {
    if (!this.state.flags['prologue.done']) return;
    const daily = (this.content.map.dirt ?? []).filter((d) => !d.clearedBy && d.tags.includes('daily'));
    const clean = daily.filter((d) => isCleaned(this.state, d));
    if (clean.length === 0) return;
    // "*" (saves antigos: tudo limpo) vira a lista de verdade antes de sujar de novo.
    if (this.state.cleaned.includes('*')) {
      this.state.cleaned = (this.content.map.dirt ?? []).filter((d) => !d.clearedBy).map((d) => d.id);
    }
    const rng = createRng(this.state.day * 31 + 7);
    // Sorteio estável (Fisher-Yates com a semente do dia).
    const pool = [...clean];
    for (let i = pool.length - 1; i > 0; i--) {
      const j = rng.int(0, i);
      [pool[i], pool[j]] = [pool[j]!, pool[i]!];
    }
    const back = pool.slice(0, this.content.world.dailyDirt);
    this.state.cleaned = this.state.cleaned.filter((id) => !back.some((d) => d.id === id));
  }

  /** Rotina do dia, depois do prólogo: comida para cada gato do café e a poeira que voltou. */
  chores(): { kind: 'feed' | 'sweep' | 'sick'; catId?: string; done: boolean; progress?: [number, number] }[] {
    if (!this.state.flags['prologue.done']) return [];
    const out: { kind: 'feed' | 'sweep' | 'sick'; catId?: string; done: boolean; progress?: [number, number] }[] = [];
    if (this.customersAway()) out.push({ kind: 'sick', done: false, progress: [this.sickCats().length, this.content.health.customers.stopAtSickCats] });
    for (const id of this.shelteredCats()) {
      if (this.state.cats[id]!.map === this.content.map.id) out.push({ kind: 'feed', catId: id, done: this.state.cats[id]!.fedOn === this.state.day });
    }
    const daily = (this.content.map.dirt ?? []).filter((d) => !d.clearedBy && d.tags.includes('daily'));
    const left = daily.filter((d) => !isCleaned(this.state, d)).length;
    const back = this.content.world.dailyDirt;
    if (left > 0 || this.state.day > 2) out.push({ kind: 'sweep', done: left === 0, progress: [Math.max(0, back - left), back] });
    return out;
  }

  // ---------- Correio ----------

  /** Compra no catálogo: desconta já e a caixa chega na porta do café depois (data/delivery.json). */
  order(itemId: string): ActionResult {
    const item = this.content.items[itemId];
    if (!item || item.deprecated) return { ok: false, reason: 'unknown_item' };
    if (['key', 'tool', 'gift'].includes(item.kind ?? 'furniture')) return { ok: false, reason: 'unknown_item' };
    if (!this.itemUnlocked(itemId)) return { ok: false, reason: 'locked' };
    if (item.kind === 'fixture' && ((this.state.inventory[itemId] ?? 0) > 0 || this.state.deliveries.some((d) => d.item === itemId))) {
      return { ok: false, reason: 'already_owned' };
    }
    if (this.pendingDeliveries() >= this.content.delivery.maxPending) return { ok: false, reason: 'door_full' };
    if (this.state.money < item.price) return { ok: false, reason: 'no_money' };
    this.addMoney(-item.price, `order:${itemId}`);
    const delivery: Delivery = { uid: `d${this.state.nextUid++}`, item: itemId, stage: 'shipping', arrivesAt: this.arrivalFor(nowAbs(this.state)) };
    this.state.deliveries.push(delivery);
    this.bus.emit('delivery.ordered', { deliveryId: delivery.uid, itemId, arrivesAt: delivery.arrivesAt });
    this.advanceStory();
    return { ok: true };
  }

  /** Quando chega um pedido feito agora: `minutes` depois, dentro do horário do correio (senão, amanhã cedo). */
  private arrivalFor(now: number): number {
    const cfg = this.content.delivery;
    const at = now + cfg.minutes;
    const day = Math.floor(at / 1440);
    const clock = at - day * 1440;
    if (clock < parseClock(cfg.from)) return day * 1440 + parseClock(cfg.from);
    if (clock > parseClock(cfg.until)) return (day + 1) * 1440 + parseClock(cfg.from);
    return at;
  }

  /** Caixas a caminho ou esperando na porta (o limite do catálogo). */
  pendingDeliveries(): number {
    return this.state.deliveries.filter((d) => d.stage === 'shipping' || d.stage === 'door').length;
  }

  /** Quantas entregas estão numa etapa (opcional: só de um item). */
  deliveriesAt(stage: DeliveryStage, itemId?: string): number {
    return this.state.deliveries.filter((d) => d.stage === stage && (!itemId || d.item === itemId)).length;
  }

  /** Próxima chegada (momento absoluto), se houver algo a caminho. */
  nextArrival(): number | undefined {
    const times = this.state.deliveries.filter((d) => d.stage === 'shipping').map((d) => d.arrivesAt);
    return times.length ? Math.min(...times) : undefined;
  }

  /** O que já deu a hora chega na porta. */
  private deliverArrived(): void {
    const now = nowAbs(this.state);
    for (const d of this.state.deliveries) {
      if (d.stage !== 'shipping' || d.arrivesAt > now) continue;
      d.stage = 'door';
      this.bus.emit('delivery.arrived', { deliveryId: d.uid, itemId: d.item });
    }
  }

  /** Perto da porta do café (na rua), com caixas esperando? */
  parcelsNear(feet: readonly Cell[], target?: Cell): 'door' | 'inside' | undefined {
    const cfg = this.content.delivery;
    const near = (at: Cell) =>
      (!target || (target[0] === at[0] && target[1] === at[1])) && feet.some((f) => Math.max(Math.abs(f[0] - at[0]), Math.abs(f[1] - at[1])) <= 1);
    if (this.state.location === cfg.door.map && this.deliveriesAt('door') > 0 && near(cfg.door.at)) return 'door';
    if (this.atHome() && this.deliveriesAt('inside') > 0 && near(cfg.inside.at)) return 'inside';
    return undefined;
  }

  /** Pega todas as caixas da porta (ela leva nos braços até entrar no café). */
  pickUpParcels(): ActionResult {
    const here = this.state.deliveries.filter((d) => d.stage === 'door');
    if (here.length === 0) return { ok: false, reason: 'nothing_here' };
    for (const d of here) d.stage = 'carried';
    this.bus.emit('delivery.picked_up', { count: here.length });
    this.advanceStory();
    return { ok: true };
  }

  /** Abre uma caixa dentro do café: o item vai para a bolsa (a interface já põe na mão para posicionar). */
  unpackParcel(): { ok: true; itemId: string } | { ok: false; reason: 'nothing_here' } {
    const i = this.state.deliveries.findIndex((d) => d.stage === 'inside');
    if (i < 0 || !this.atHome()) return { ok: false, reason: 'nothing_here' };
    const [d] = this.state.deliveries.splice(i, 1);
    this.state.inventory[d!.item] = (this.state.inventory[d!.item] ?? 0) + 1;
    this.bus.emit('delivery.unpacked', { deliveryId: d!.uid, itemId: d!.item });
    this.advanceStory();
    return { ok: true, itemId: d!.item };
  }

  // ---------- Pedidos da vila ----------

  /** Notícias do dia no "Vila Hoje". */
  news(): NewsItem[] {
    return newsForDay(this.content.news, this.state.day);
  }

  /** Pedidos que dá para aceitar agora. */
  availableJobs(): JobDef[] {
    return Object.values(this.content.jobs).filter((j) => !this.state.jobs.active.includes(j.id) && this.jobOpen(j));
  }

  /** Pedidos aceitos, em andamento. */
  activeJobs(): JobDef[] {
    return this.state.jobs.active.map((id) => this.content.jobs[id]).filter((j): j is JobDef => !!j);
  }

  private jobOpen(job: JobDef): boolean {
    if (job.available && !evaluate(job.available as Condition, this.state, this.storyContext())) return false;
    const last = this.state.jobs.doneOn[job.id];
    return job.repeat === 'daily' ? last !== this.state.day : last === undefined;
  }

  acceptJob(jobId: string): ActionResult {
    const job = this.content.jobs[jobId];
    if (!job) return { ok: false, reason: 'unknown_job' };
    if (this.state.jobs.active.includes(jobId) || !this.jobOpen(job)) return { ok: false, reason: 'job_unavailable' };
    if (this.state.jobs.active.length >= this.content.maxActiveJobs) return { ok: false, reason: 'job_full' };
    this.state.jobs.active.push(jobId);
    this.state.jobs.progress[jobId] = [];
    this.bus.emit('job.accepted', { jobId });
    return { ok: true };
  }

  /** Índice do passo atual de um pedido aceito (= número de passos quando acabou). */
  jobStep(jobId: string): number {
    const job = this.content.jobs[jobId];
    if (!job) return 0;
    const done = new Set(this.state.jobs.progress[jobId] ?? []);
    const i = job.steps.findIndex((s) => !s.points.every((p) => done.has(p)));
    return i === -1 ? job.steps.length : i;
  }

  /** Quanto do passo atual já foi feito: [feitos, total]. */
  jobStepProgress(jobId: string): [number, number] {
    const step = this.content.jobs[jobId]?.steps[this.jobStep(jobId)];
    if (!step) return [0, 0];
    const done = new Set(this.state.jobs.progress[jobId] ?? []);
    return [step.points.filter((p) => done.has(p)).length, step.points.length];
  }

  /** Pontos pendentes num mapa (do passo atual de cada pedido aceito). */
  pendingJobPoints(mapId = this.state.location): JobPoint[] {
    const out: JobPoint[] = [];
    for (const job of this.activeJobs()) {
      const step = job.steps[this.jobStep(job.id)];
      if (!step) continue;
      const done = new Set(this.state.jobs.progress[job.id] ?? []);
      for (const id of step.points) {
        const p = this.content.jobPoints[id];
        if (p && p.map === mapId && !done.has(id)) out.push(p);
      }
    }
    return out;
  }

  /** Ponto de pedido ao alcance dos pés (`target`: só a célula clicada). */
  /** Ponto de pedido pendente exatamente nesta célula (perto ou não). */
  jobPointAt([c, r]: Cell): JobPoint | undefined {
    return this.pendingJobPoints().find((p) => p.at[0] === c && p.at[1] === r);
  }

  /** Por que ela não pode fazer este ponto agora (ou null): a interface confere antes de tocar a varrida. */
  jobPointProblem(pointId: string): 'needs_broom' | null {
    return this.content.jobPoints[pointId]?.action === 'sweep' ? this.toolProblem('sweep') : null;
  }

  jobPointNear(feet: readonly Cell[], target?: Cell): JobPoint | undefined {
    const dist = (a: Cell, b: Cell) => Math.max(Math.abs(a[0] - b[0]), Math.abs(a[1] - b[1]));
    return this.pendingJobPoints()
      .filter((p) => !target || (p.at[0] === target[0] && p.at[1] === target[1]))
      .map((p) => ({ p, d: Math.min(...feet.map((f) => dist(f, p.at))) }))
      .filter(({ p, d }) => d <= (p.reach ?? 1))
      .sort((a, b) => a.d - b.d)[0]?.p;
  }

  /** Faz um ponto de pedido; no último ponto do último passo, o pedido é pago. */
  doJobPoint(pointId: string): ActionResult {
    const job = this.activeJobs().find((j) => this.pendingJobPoints(this.content.jobPoints[pointId]?.map).some((p) => p.id === pointId) && j.steps[this.jobStep(j.id)]?.points.includes(pointId));
    const point = this.content.jobPoints[pointId];
    if (!job || !point) return { ok: false, reason: 'not_found' };
    if (point.action === 'sweep') {
      const problem = this.toolProblem('sweep');
      if (problem) return { ok: false, reason: problem };
    }
    if (point.takes) {
      if ((this.state.inventory[point.takes] ?? 0) < 1) return { ok: false, reason: 'missing_item' };
      this.removeFromInventory(point.takes);
    }
    if (point.gives) this.state.inventory[point.gives] = (this.state.inventory[point.gives] ?? 0) + 1;
    (this.state.jobs.progress[job.id] ??= []).push(pointId);
    this.bus.emit('job.progress', { jobId: job.id, pointId });
    if (this.jobStep(job.id) >= job.steps.length) {
      this.state.jobs.active = this.state.jobs.active.filter((id) => id !== job.id);
      delete this.state.jobs.progress[job.id];
      this.state.jobs.doneOn[job.id] = this.state.day;
      this.state.today.jobs++;
      this.addMoney(job.reward, `job:${job.id}`);
      this.bus.emit('job.completed', { jobId: job.id, reward: job.reward });
    }
    this.advanceStory();
    return { ok: true };
  }

  /** Ponto do dia seguinte onde ela aparece de manhã. */
  morningSpawn(): Cell {
    return this.content.world.morning.spawn;
  }

  // ---------- Gatos ----------

  /** Gatos abrigados (ids). Gatos de lembrança (a Tekinha) nunca contam, nem se um save trouxer um deles. */
  shelteredCats(): string[] {
    return Object.keys(this.state.cats).filter((id) => this.state.cats[id]!.sheltered && !this.content.cats[id]?.memory);
  }

  /** Nome da protagonista (vazio em saves de antes do criador). */
  playerName(): string {
    return this.state.player.name;
  }

  /** Aparência da protagonista: a escolhida ou a padrão dos dados. */
  appearance(): Appearance {
    return this.state.player.appearance ?? this.content.character.default;
  }

  /** Nome do gato: o escolhido, o fixo dos dados, ou vazio. */
  catName(catId: string): string {
    return this.state.cats[catId]?.name || this.content.cats[catId]?.name || '';
  }

  suggestCatName(catId: string, attempt: number): string {
    const cat = this.content.cats[catId];
    return cat ? suggestCatName(cat, attempt) : '';
  }

  /** A jogadora deu nome ao gato (caixa de nome). */
  nameCat(catId: string, rawName: string): ActionResult {
    const cat = this.state.cats[catId];
    if (!cat?.sheltered) return { ok: false, reason: 'not_sheltered' };
    const name = cleanCatName(rawName);
    if (!name) return { ok: false, reason: 'invalid_name' };
    cat.name = name;
    this.bus.emit('cat.named', { catId, name });
    this.advanceStory();
    return { ok: true };
  }

  /**
   * Ficha de cada gato abrigado (app "Meus gatos"): nome, variante (sprite), personalidade, corações,
   * se comeu hoje e há quantos dias está no café (o dia em que chegou conta como o 1º).
   */
  catProfiles(): CatProfile[] {
    return this.shelteredCats().map((id) => {
      const cat = this.state.cats[id]!;
      const def = this.content.cats[id];
      return {
        id,
        name: this.catName(id),
        variant: def?.variant ?? '',
        personality: def?.personality ?? '',
        hearts: this.catHearts(id),
        maxHearts: this.content.relationships.maxHearts,
        fedToday: cat.fedOn === this.state.day,
        daysInCafe: Math.max(1, this.state.day - cat.shelteredOn + 1),
        map: cat.map,
        health: cat.health,
        maxHealth: this.content.health.max,
        sickness: cat.sickness && {
          disease: cat.sickness.disease,
          treatment: cat.sickness.treatment && {
            days: cat.sickness.treatment.days,
            dosesGiven: cat.sickness.treatment.dosesGiven,
            dosedToday: cat.sickness.treatment.lastDoseDay === this.state.day,
          },
        },
      };
    });
  }

  // ---------- Saúde (data/health.json) ----------

  /** Adoece um gato abrigado: doença sorteada (ou a dada) e a saúde cai para health.sickHealth. */
  makeSick(catId: string, disease?: string): void {
    const cat = this.state.cats[catId];
    if (!cat?.sheltered || cat.sickness) return;
    const cfg = this.content.health;
    cat.sickness = { disease: disease ?? pickDisease(cfg, this.state.day, catId), since: this.state.day, treatment: null };
    cat.health = Math.min(cat.health, cfg.sickHealth);
    this.bus.emit('cat.sick', { catId, disease: cat.sickness.disease });
  }

  /** Fim do dia: comeu sobe, não comeu desce (descuido), doente sem o remédio do dia desce mais; baixa demais, adoece. */
  private healthAtDayEnd(day: number): void {
    const cfg = this.content.health;
    for (const id of this.shelteredCats()) {
      const cat = this.state.cats[id]!;
      let delta = cat.fedOn === day ? cfg.daily.fed : cfg.daily.hungry;
      if (cat.sickness && cat.sickness.treatment?.lastDoseDay !== day) delta += cfg.daily.sickUntreated;
      cat.health = clampHealth(cfg, cat.health + delta);
      if (!cat.sickness && cat.health < cfg.sickBelow) this.makeSick(id);
    }
    // Contágio: um doente que já transmite passa a mesma doença para os gatos saudáveis do mesmo lugar.
    for (const sourceId of this.shelteredCats()) {
      const source = this.state.cats[sourceId]!;
      if (!source.sickness || !isContagious(cfg, source.sickness, day)) continue;
      for (const id of this.shelteredCats()) {
        const cat = this.state.cats[id]!;
        if (id === sourceId || cat.sickness || cat.map !== source.map || !rollsContagion(cfg, day, id)) continue;
        this.makeSick(id, source.sickness.disease);
        this.bus.emit('cat.infected', { catId: id, fromCatId: sourceId, disease: source.sickness.disease });
      }
    }
  }

  /** Gatos doentes agora (ids). */
  sickCats(): string[] {
    return this.shelteredCats().filter((id) => this.state.cats[id]!.sickness);
  }

  /** Prejuízo: com gatos doentes demais (health.customers.stopAtSickCats), nenhum cliente novo entra. */
  customersAway(): boolean {
    return this.sickCats().length >= this.content.health.customers.stopAtSickCats;
  }

  /** Manhã: um gato pode adoecer à toa (evento aleatório com semente), só depois que a clínica abre. */
  private randomIllness(): void {
    const r = this.content.health.randomIllness;
    if (this.state.day < r.fromDay || !this.state.flags[r.requiresFlag]) return;
    for (const id of this.shelteredCats()) {
      if (!this.state.cats[id]!.sickness && rollsIllness(this.content.health, this.state.day, id)) this.makeSick(id);
    }
  }

  /** O orçamento da consulta (sem mudar nada): a doença, a receita sorteada e o preço; ou por que não dá. */
  consultQuote(catId: string): ConsultQuote | { problem: 'not_at_clinic' | 'bring_cat' | 'not_sick' | 'already_treated' | 'no_money' } {
    const cfg = this.content.health;
    const cat = this.state.cats[catId];
    if (this.state.location !== cfg.clinic.map) return { problem: 'not_at_clinic' };
    if (!cat?.sheltered || this.service.carriedCat() !== catId) return { problem: 'bring_cat' };
    if (!cat.sickness) return { problem: 'not_sick' };
    if (cat.sickness.treatment) return { problem: 'already_treated' };
    const days = prescriptionDays(cfg, this.state.day, catId);
    const medicine = days * cfg.prices.medicinePerDay;
    const total = cfg.prices.consult + medicine;
    const canCredit = cfg.credit.firstConsultOnCredit && !this.state.flags['vet.credit_used'];
    const onCredit = this.state.money < total && canCredit;
    if (this.state.money < total && !onCredit) return { problem: 'no_money' };
    return { catId, disease: cat.sickness.disease, days, consult: cfg.prices.consult, medicine, total, onCredit };
  }

  /** A consulta: paga (ou fica fiado, na primeira vez), recebe o remédio da receita e o tratamento começa. */
  consult(catId: string): ActionResult {
    const q = this.consultQuote(catId);
    if ('problem' in q) return { ok: false, reason: q.problem };
    if (q.onCredit) {
      this.state.debt += q.total;
      this.state.flags['vet.credit_used'] = true;
    } else this.addMoney(-q.total, 'vet');
    const cat = this.state.cats[catId]!;
    cat.sickness!.treatment = { days: q.days, dosesGiven: 0, lastDoseDay: null };
    const med = this.content.health.medicine.item;
    this.state.inventory[med] = (this.state.inventory[med] ?? 0) + q.days;
    this.state.flags['vet.consulted'] = true;
    this.bus.emit('cat.diagnosed', { catId, disease: q.disease, days: q.days, total: q.total, onCredit: q.onCredit });
    this.advanceStory();
    return { ok: true };
  }

  /** Por que não dá para dar o remédio agora (ou null). Uma dose por dia, só com a receita e o remédio ativo na barra. */
  medicineProblem(catId: string): 'not_found' | 'not_sick' | 'no_prescription' | 'already_dosed' | 'needs_medicine' | null {
    const cat = this.state.cats[catId];
    if (!cat?.sheltered) return 'not_found';
    if (!cat.sickness) return 'not_sick';
    const t = cat.sickness.treatment;
    if (!t) return 'no_prescription';
    if (t.lastDoseDay === this.state.day) return 'already_dosed';
    return this.activeUse('medicine') ? null : 'needs_medicine';
  }

  /** Dá a dose do dia: cura um pouco; tomou todas as doses da receita, sara. */
  medicateCat(catId: string): ActionResult {
    const problem = this.medicineProblem(catId);
    if (problem) return { ok: false, reason: problem };
    const cfg = this.content.health;
    const cat = this.state.cats[catId]!;
    const t = cat.sickness!.treatment!;
    this.removeFromInventory(this.activeUse('medicine')!);
    t.dosesGiven += 1;
    t.lastDoseDay = this.state.day;
    cat.health = clampHealth(cfg, cat.health + cfg.medicine.healPerDose);
    this.bus.emit('cat.medicated', { catId, dosesGiven: t.dosesGiven, days: t.days });
    if (t.dosesGiven >= t.days) {
      cat.sickness = null;
      cat.health = Math.max(cat.health, cfg.sickBelow);
      this.state.flags['vet.cured'] = true;
      this.bus.emit('cat.cured', { catId });
    }
    this.advanceStory();
    return { ok: true };
  }

  /** O item ativo é remédio? (aí E perto do gato dá a dose) */
  holdingMedicine(): boolean {
    return !!this.activeUse('medicine');
  }


  /** Corações entre a protagonista e um gato. */
  catHearts(catId: string): number {
    return hearts(this.state, this.content.relationships, PLAYER, catId);
  }

  /** Soma afeto (pontos) entre a protagonista e um gato. */
  addCatAffection(catId: string, delta: number): void {
    const [from, to] = addPoints(this.state, this.content.relationships, PLAYER, catId, delta);
    if (from !== to) this.bus.emit('cat.affection_changed', { catId, from, to });
    this.advanceStory();
  }

  /** A porta deixa passar? (requisito em dados, ex.: ter a chave). */
  canUseDoor(door: MapDoor): boolean {
    return !door.requires || evaluate(door.requires as Condition, this.state, this.storyContext());
  }

  /** Tentou abrir uma porta trancada: mostra a fala de trancada, se houver. */
  doorLocked(door: MapDoor): void {
    if (door.locked) this.bus.emit('dialogue.requested', { dialogueId: door.locked });
  }

  /** Recebe um item (história ou roteiro): vai para a bolsa. */
  receiveItem(itemId: string): void {
    this.state.inventory[itemId] = (this.state.inventory[itemId] ?? 0) + 1;
    this.service.stockDishes(itemId);
    this.bus.emit('item.received', { itemId });
    this.advanceStory();
  }

  /** Pede uma fala (roteiros usam isto). */
  say(dialogueId: string): void {
    this.bus.emit('dialogue.requested', { dialogueId });
  }

  /** O jogo terminou um roteiro: marca `seen.<id>` e segue a história. */
  finishScript(scriptId: string): void {
    this.state.flags[seenFlag(scriptId)] = true;
    this.bus.emit('script.finished', { scriptId });
    this.advanceStory();
  }

  /** A interface terminou de mostrar uma cena: marca `seen.<id>` e segue a história. */
  finishCutscene(cutsceneId: string): void {
    this.state.flags[seenFlag(cutsceneId)] = true;
    this.bus.emit('cutscene.finished', { cutsceneId });
    this.advanceStory();
  }

  /** Mapa onde a personagem está. */
  location(): string {
    return this.state.location;
  }

  /** Está no café (onde dá para decorar e reformar)? */
  atHome(): boolean {
    return this.state.location === this.content.map.id;
  }

  /** Entra num mapa (pela porta): guarda o local e lembra que já esteve lá. */
  enter(mapId: string): void {
    if (!this.content.maps[mapId]) throw new Error(`Mapa desconhecido: "${mapId}"`);
    this.state.location = mapId;
    if (!this.state.visited.includes(mapId)) this.state.visited.push(mapId);
    // As caixas que ela carrega entram no café com ela.
    if (mapId === this.content.map.id) for (const d of this.state.deliveries) if (d.stage === 'carried') d.stage = 'inside';
    this.bus.emit('map.entered', { mapId });
    this.advanceStory();
  }

  /**
   * Dados do mapa para desenhar. O café vem com a reforma do pintor e os móveis da jogadora;
   * os outros mapas vêm como estão nos dados.
   */
  mapData(mapId = this.content.map.id): MapData {
    if (mapId !== this.content.map.id) {
      const other = this.content.maps[mapId];
      if (!other) throw new Error(`Mapa desconhecido: "${mapId}"`);
      return { ...other, objects: [...this.visibleObjects(other), ...this.jobMarkers(mapId)] };
    }
    const base = { ...this.content.map, objects: [...this.visibleObjects(this.content.map), ...this.jobMarkers(mapId)] };
    const legend = { ...base.legend };
    for (const surface of base.surfaces ?? []) {
      const finish = this.content.finishes[this.state.finishes[surface.id] ?? ''];
      if (finish) legend[surface.legend] = finish.tile;
    }
    return withPlaced({ ...base, legend, dirt: this.visibleDirt() }, this.state.placed, this.content.items, this.content.world.counterLift ?? 0);
  }

  /** O pintor já foi apresentado (flag do conteúdo)? Sem flag configurada, está sempre liberado. */
  painterUnlocked(): boolean {
    const flag = this.content.painterUnlockFlag;
    return !flag || this.state.flags[flag] === true;
  }

  /** Quanto volta ao devolver este item. */
  refundValue(itemId: string): number {
    const item = this.content.items[itemId];
    return item ? Math.floor(item.price * this.content.economy.refundRate) : 0;
  }

  /** Devolve um item da bolsa (não posicionado) e recebe o reembolso. */
  refund(itemId: string): ActionResult {
    const refundable = this.content.items[itemId];
    if (!refundable || ['key', 'tool', 'fixture', 'gift'].includes(refundable.kind ?? 'furniture')) return { ok: false, reason: 'unknown_item' };
    if ((this.state.inventory[itemId] ?? 0) < 1) return { ok: false, reason: 'not_in_inventory' };
    this.removeFromInventory(itemId);
    const amount = this.refundValue(itemId);
    this.addMoney(amount, `refund:${itemId}`);
    this.bus.emit('item.refunded', { itemId, amount });
    this.advanceStory();
    return { ok: true };
  }

  /** Sujeira do café que ainda aparece (a limpa e a de superfícies reformadas somem). */
  visibleDirt(): DirtSpot[] {
    return (this.content.map.dirt ?? []).filter((d) =>
      d.clearedBy ? !this.state.finishes[d.clearedBy] : !isCleaned(this.state, d),
    );
  }

  /** Marcadores dos pontos de pedido pendentes (ex.: montes de neve a varrer). */
  private jobMarkers(mapId: string): MapData['objects'] {
    return this.pendingJobPoints(mapId)
      .filter((p) => p.marker)
      .map((p) => ({ id: `marker.${p.id}`, tile: p.marker!, at: p.at }));
  }

  /** Objetos do mapa que aparecem agora (os com `when` só depois da condição). */
  private visibleObjects(map: MapData): MapData['objects'] {
    return map.objects.filter((o) => !o.when || evaluate(o.when as Condition, this.state, this.storyContext()));
  }

  /** Sujeira visível numa célula do café (ou undefined). */
  dirtAt([col, row]: Cell): DirtSpot | undefined {
    const { catalog } = this.content;
    return this.visibleDirt()
      .filter((d) => catalog.tiles[d.tile] && cellsOf(d.at, catalog.tiles[d.tile]!).some(([c, r]) => c === col && r === row))
      .sort((a, b) => Number(!!a.clearedBy) - Number(!!b.clearedBy))[0];
  }

  /**
   * Limpa uma sujeira. `from`: células dos pés da personagem; ela precisa estar a até
   * `reach` células de alguma célula da sujeira.
   */
  clean(dirtId: string, from: readonly Cell[] = [], reach = 2): ActionResult {
    const problem = this.cleanProblem(dirtId, from, reach);
    if (problem) return { ok: false, reason: problem };
    const d = this.visibleDirt().find((x) => x.id === dirtId)!;
    this.state.cleaned.push(d.id);
    this.bus.emit('dirt.cleaned', { dirtId: d.id });
    this.advanceStory();
    return { ok: true };
  }

  /** Por que não dá para limpar agora (ou null): a interface confere antes de varrer. */
  cleanProblem(dirtId: string, from: readonly Cell[] = [], reach = 2): 'not_found' | 'needs_repair' | 'too_far' | 'needs_broom' | null {
    const d = this.visibleDirt().find((x) => x.id === dirtId);
    if (!d) return 'not_found';
    if (d.clearedBy) return 'needs_repair';
    const def = this.content.catalog.tiles[d.tile]!;
    if (from.length > 0) {
      const near = cellsOf(d.at, def).some(([c, r]) => from.some(([fc, fr]) => Math.max(Math.abs(c - fc), Math.abs(r - fr)) <= reach));
      if (!near) return 'too_far';
    }
    return this.toolProblem('sweep');
  }

  private storyContext(): StoryContext {
    return { items: this.content.items, dirt: this.content.map.dirt ?? [], requiredSurfaces: this.content.business.requiredSurfaces };
  }

  /** Superfícies que o pintor pode reformar. */
  surfaces(): SurfaceDef[] {
    return this.content.map.surfaces ?? [];
  }

  /** Contrata o pintor: troca o acabamento de uma superfície (fica pronto na hora). */
  paint(surfaceId: string, finishId: string): ActionResult {
    const surface = this.surfaces().find((s) => s.id === surfaceId);
    if (!surface) return { ok: false, reason: 'unknown_surface' };
    const finish = this.content.finishes[finishId];
    if (!finish) return { ok: false, reason: 'unknown_finish' };
    if (!this.painterUnlocked()) return { ok: false, reason: 'locked' };
    if (finish.kind !== surface.kind) return { ok: false, reason: 'wrong_surface' };
    if (this.state.finishes[surfaceId] === finishId) return { ok: false, reason: 'already_painted' };
    if (this.state.money < finish.price) return { ok: false, reason: 'no_money' };
    this.addMoney(-finish.price, `paint:${surfaceId}`);
    this.state.finishes[surfaceId] = finishId;
    this.bus.emit('surface.painted', { surfaceId, finishId, price: finish.price });
    this.advanceStory();
    return { ok: true };
  }

  goals(): GoalView[] {
    return currentGoals(this.content.story, this.state, this.storyContext());
  }

  /** Se a meta ativa só espera o relógio (ex.: a Gabi chegar), o momento em que ela conclui. */
  waitTarget(): number | undefined {
    for (const g of this.goals()) for (const s of g.steps) if (!s.done && s.waitUntil !== undefined) return s.waitUntil;
    return undefined;
  }

  /** Hora (do dia) de um relógio da história, para mostrar ("A Gabi chega às 10:40"). */
  timerClock(id: string): number | undefined {
    const at = this.state.timers[id];
    return at === undefined ? undefined : at - this.state.day * 1440;
  }

  /** Compra um item: desconta o preço e põe no inventário. */
  /** Avança o negócio (nunca volta: tirar a mesa depois não fecha o café). */
  private setBusiness(stage: BusinessStage): void {
    const from = this.state.business;
    if (stageAtLeast(from, stage)) return;
    this.state.business = stage;
    this.bus.emit('business.changed', { from, to: stage });
  }

  /** Por que este item não pode ser comprado agora (sem olhar o dinheiro), ou null. */
  private buyProblem(itemId: string): Extract<ActionResult, { ok: false }>['reason'] | null {
    const item = this.content.items[itemId];
    if (!item || item.deprecated) return 'unknown_item';
    // Chave e presente não se compram; ferramenta só se tiver preço (ex.: a bandeja; a vassoura é presente).
    if (['key', 'gift'].includes(item.kind ?? 'furniture') || (item.kind === 'tool' && !(item.price > 0))) return 'unknown_item';
    if (!this.itemUnlocked(itemId)) return 'locked';
    if ((item.kind === 'fixture' || item.kind === 'tool') && (this.state.inventory[itemId] ?? 0) > 0) return 'already_owned';
    return null;
  }

  private isHeavy(itemId: string): boolean {
    return this.content.items[itemId]?.tags.includes(this.content.carry.heavy.tag) ?? false;
  }

  /** Compra uma unidade na hora (usado pelos testes e pelo debug; no mercado a compra passa pelo carrinho). */
  buy(itemId: string): ActionResult {
    const problem = this.buyProblem(itemId);
    if (problem) return { ok: false, reason: problem };
    const item = this.content.items[itemId]!;
    if (this.state.money < item.price) return { ok: false, reason: 'no_money' };
    // Pesado (saco de ração, areia): vai direto para as mãos; precisa estar com elas livres.
    const heavy = this.isHeavy(itemId);
    if (heavy) {
      const r = this.service.carryHeavy(itemId);
      if (!r.ok) return { ok: false, reason: r.reason === 'hands_full' ? 'hands_full' : 'unknown_item' };
    }
    this.addMoney(-item.price, `buy:${itemId}`);
    if (!heavy) this.state.inventory[itemId] = (this.state.inventory[itemId] ?? 0) + 1;
    this.bus.emit('item.bought', { itemId, price: item.price });
    this.advanceStory();
    return { ok: true };
  }

  /** Item que vai em cima de algo (ex.: bule no balcão) sem nenhum apoio livre no café: não dá para posicionar agora. */
  missingHost(itemId: string): PlaceProblem | null {
    const placeOn = this.content.items[itemId]?.placeOn;
    if (!placeOn || hasFreeHost(this.state.placed, this.content.items, placeOn)) return null;
    return 'no_free_counter';
  }

  // ---------- Carrinho do mercado ----------

  /** Valor total do carrinho. */
  cartTotal(): number {
    return this.cart.total((id) => this.content.items[id]?.price ?? 0);
  }

  /** Quantos deste item cabem no carrinho: ferramenta e fixo só 1; pesado, um por viagem (vai nas mãos). */
  private cartMax(itemId: string): number {
    const kind = this.content.items[itemId]?.kind;
    if (kind === 'tool' || kind === 'fixture' || this.isHeavy(itemId)) return 1;
    return MAX_QTY_PER_ITEM;
  }

  private cartChanged(): void {
    this.bus.emit('cart.changed', { count: this.cart.count(), total: this.cartTotal() });
  }

  /** Põe uma unidade no carrinho (o dinheiro só é conferido no caixa). */
  addToCart(itemId: string): ActionResult {
    const problem = this.buyProblem(itemId);
    if (problem) return { ok: false, reason: problem };
    if (this.cart.qty(itemId) >= this.cartMax(itemId)) return { ok: false, reason: this.isHeavy(itemId) ? 'one_heavy_per_trip' : 'already_owned' };
    // Pesados ocupam as mãos sozinhos: um só por compra, de qualquer tipo.
    if (this.isHeavy(itemId) && this.cart.countWhere((id) => this.isHeavy(id)) > 0) return { ok: false, reason: 'one_heavy_per_trip' };
    this.cart.add(itemId, 1, this.cartMax(itemId));
    this.cartChanged();
    return { ok: true };
  }

  /** Tira uma unidade (ou todas, com `all`). */
  removeFromCart(itemId: string, all = false): void {
    this.cart.remove(itemId, all ? this.cart.qty(itemId) : 1);
    this.cartChanged();
  }

  /** Quanto falta para pagar o carrinho (0 se o dinheiro basta). */
  cartShortfall(): number {
    return Math.max(0, this.cartTotal() - this.state.money);
  }

  /**
   * Caixa: confere tudo e só então cobra e entrega (tudo ou nada).
   * Sem dinheiro, nada muda: ela tira itens e tenta de novo.
   */
  checkout(): ActionResult {
    if (this.cart.isEmpty()) return { ok: false, reason: 'cart_empty' };
    for (const { itemId } of this.cart.lines()) {
      const problem = this.buyProblem(itemId);
      if (problem) return { ok: false, reason: problem };
    }
    if (this.cartShortfall() > 0) return { ok: false, reason: 'no_money' };
    const heavy = this.cart.lines().find((l) => this.isHeavy(l.itemId));
    if (heavy && this.service.holdProblem({ kind: 'heavy', item: heavy.itemId })) return { ok: false, reason: 'hands_full' };
    const total = this.cartTotal();
    const lines = this.cart.lines();
    this.addMoney(-total, 'checkout');
    for (const { itemId, qty } of lines) {
      if (this.isHeavy(itemId)) this.service.carryHeavy(itemId);
      else this.state.inventory[itemId] = (this.state.inventory[itemId] ?? 0) + qty;
      const price = this.content.items[itemId]!.price;
      for (let i = 0; i < qty; i++) this.bus.emit('item.bought', { itemId, price });
    }
    this.cart.clear();
    this.bus.emit('cart.checked_out', { lines, total });
    this.cartChanged();
    this.advanceStory();
    return { ok: true };
  }

  /** Diz se o item pode ficar em `at`, sem mudar nada. */
  checkPlacement(itemId: string, at: Cell, reserved: readonly Cell[] = []): PlaceProblem | null {
    const def = this.content.catalog.tiles[this.content.items[itemId]?.tile ?? ''];
    if (!def) return 'out_of_bounds';
    const placeOn = this.content.items[itemId]?.placeOn;
    if (placeOn) return placeOnProblem(this.state.placed, this.content.items, placeOn, at);
    return placementProblem(this.mapData(), this.content.catalog, def, at, [...reserved, this.content.map.spawn.player]);
  }

  /** Tira um item do inventário e posiciona no café. */
  place(itemId: string, at: Cell, reserved: readonly Cell[] = []): ActionResult {
    if (!this.content.items[itemId]) return { ok: false, reason: 'unknown_item' };
    if ((this.state.inventory[itemId] ?? 0) < 1) return { ok: false, reason: 'not_in_inventory' };
    const problem = this.checkPlacement(itemId, at, reserved);
    if (problem) return { ok: false, reason: problem };

    this.removeFromInventory(itemId);
    const uid = `p${this.state.nextUid++}`;
    this.state.placed.push({ uid, item: itemId, at: [at[0], at[1]] });
    this.bus.emit('item.placed', { itemId, uid, at: [at[0], at[1]] });
    this.advanceStory();
    return { ok: true };
  }

  /** Móvel da jogadora numa célula, se houver. */
  placedAt(cell: Cell) {
    return placedItemAt(this.content.catalog, this.state.placed, this.content.items, cell);
  }

  /** Recolhe um móvel de volta para o inventário. */
  pickUp(uid: string): ActionResult {
    const index = this.state.placed.findIndex((p) => p.uid === uid);
    if (index < 0) return { ok: false, reason: 'not_found' };
    if (itemOnTop(this.state.placed, this.content.items, this.state.placed[index]!)) return { ok: false, reason: 'has_something_on_top' };
    const [removed] = this.state.placed.splice(index, 1);
    this.state.inventory[removed!.item] = (this.state.inventory[removed!.item] ?? 0) + 1;
    this.bus.emit('item.picked_up', { itemId: removed!.item, uid });
    this.advanceStory();
    return { ok: true };
  }

  /**
   * Conclui todos os marcos ativos cujas condições já valem, em ordem, e aplica os efeitos.
   * Repete porque concluir um marco pode liberar o próximo. Marcos concluídos não voltam atrás.
   */
  private advanceStory(): void {
    for (let guard = 0; guard < 1000; guard++) {
      // Fechado -> funcionamento parcial assim que o café tem o mínimo (data/business.json).
      if (this.state.business === 'closed' && evaluate(this.content.business.softOpenWhen, this.state, this.storyContext())) this.setBusiness('soft_open');
      const ctx = this.storyContext();
      const next = activeBeats(this.content.story, this.state, ctx).find((b) => isBeatSatisfied(b, this.state, ctx));
      if (!next) return this.announceRecipes(false);
      this.state.story.completed.push(next.id);
      this.state.story.completedOn[next.id] = this.state.day;
      // Efeitos antes do aviso: quem escuta já sabe que uma fala foi aberta (o HUD espera ela acabar).
      next.effects.forEach((e) => this.applyEffect(e));
      this.bus.emit('story.beat_completed', { beatId: next.id });
    }
    throw new Error('História em laço infinito');
  }

  private applyEffect(effect: Effect): void {
    if ('dialogue' in effect) this.bus.emit('dialogue.requested', { dialogueId: effect.dialogue });
    else if ('cutscene' in effect) this.bus.emit('cutscene.requested', { cutsceneId: effect.cutscene });
    else if ('endDay' in effect) this.endDay();
    else if ('setTime' in effect) this.state.time = parseClock(effect.setTime);
    else if ('startTimer' in effect) this.state.timers[effect.startTimer] = nowAbs(this.state) + effect.minutes;
    else if ('setBusiness' in effect) this.setBusiness(effect.setBusiness);
    else if ('script' in effect) this.bus.emit('script.requested', { scriptId: effect.script });
    else if ('shelterCat' in effect) {
      const id = effect.shelterCat;
      this.state.cats[id] = { sheltered: true, name: this.content.cats[id]?.name ?? '', map: this.content.map.id, shelteredOn: this.state.day, health: this.content.health.start, sickness: null };
      this.bus.emit('cat.sheltered', { catId: id });
      if (this.content.cats[id]?.arrivesSick) this.makeSick(id);
    } else if ('makeSick' in effect) {
      this.makeSick(effect.makeSick);
    } else if ('giveItem' in effect) this.receiveItem(effect.giveItem);
    else if ('setFlag' in effect) this.state.flags[effect.setFlag] = true;
    else if ('addMoney' in effect) this.addMoney(effect.addMoney, 'story');
  }

  /** Soma (ou desconta) dinheiro. Usado pela história, pelas compras e pelo modo debug. */
  addMoney(delta: number, reason: string): void {
    const from = this.state.money;
    // Fiado: parte de cada ganho (não devoluções) paga a dívida da clínica.
    let toDebt = 0;
    if (delta > 0 && this.state.debt > 0 && !reason.startsWith('refund')) {
      toDebt = Math.min(this.state.debt, Math.ceil(delta * this.content.health.credit.repayShare));
      this.state.debt -= toDebt;
    }
    this.state.money = from + delta - toDebt;
    // Resumo do dia: o que ela ganhou (devoluções não contam).
    if (delta > 0 && !reason.startsWith('refund')) this.state.today.earned += delta;
    this.bus.emit('money.changed', { from, to: this.state.money, reason });
    if (toDebt > 0) this.bus.emit('debt.paid', { amount: toDebt, left: this.state.debt });
  }

  private removeFromInventory(itemId: string): void {
    const left = (this.state.inventory[itemId] ?? 0) - 1;
    if (left > 0) this.state.inventory[itemId] = left;
    else delete this.state.inventory[itemId];
  }
}
