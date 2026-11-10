// Sessão de jogo: o único lugar que muda o estado. O Phaser chama estas ações
// e escuta os eventos. Puro: sem Phaser, DOM ou window.
import { isOpenAt, nextOpening, weekdayOf } from './schedule';
import { type QuoteProblem, builderOnShift, builderSpot, cellKey, siteMarkers, finishJobIfDone, isolatedCells, jobDays, quoteBlocker, scheduleJob, surfaceCells, type RepairKind } from './construction';
import type { Condition, Content, Effect, ItemUse } from './content';
import { seenFlag } from './cutscene';
import { parseClock } from './time';
import { newsForDay, sporadicToday, type JobDef, type JobPoint, type NewsItem, tipForDay, type CatTip } from './jobs';
import { createRng } from './rng';
import { CafeService } from './service';
import { cleanCatName, suggestCatName, type CatDef } from './cats';
import { addPoints, hearts, PLAYER } from './relationships';
import { EventBus, type DayEndReason } from './events';
import { clampEnergy, energyLevel, energySpeed, ENERGY_EVENTS, type EnergyLevel, type SeatDef } from './energy';
import type { MiniGameParams, MiniGameResult, Difficulty } from './minigame';
import { clampHealth, isContagious, pickDisease, prescriptionDays, rollsContagion, rollsIllness } from './health';
import { activeItem, assignToSlot, fitsHotbar, isSlot, swapSlots, syncHotbar } from './hotbar';
import { lowIngredients } from './shopping';
import type { RecipeDef } from './recipes';
import { Cart, MAX_QTY_PER_ITEM } from './cart';
import { DEFAULT_PRONOUN, type Pronoun } from './pronoun';
import { addCare, careAtDayEnd, careGain, careNeeds, careOf, needsMedicine, toysMissing, type CareNeed, type CareStat, type PlayRoom } from './care';
import { load, loadProblem, stationKind, stationsAtDayEnd, type StationKind } from './petcare';

/** Automático com tantos dias ou menos: avisa que está acabando. */
const PET_LOW_DAYS = 2;
import { stageAtLeast, type BusinessStage } from './business';
import type { Appearance } from './appearance';
import { calendarEntries, dayInSeason, daysUntil, mapInSeason, seasonOf, type CalendarEntry } from './calendar';
import { addReputation, reputationForResult } from './reputation';
import { ArrivalSystem } from './arrivalSystem';
import { doFestivalPoint, festivalCanStart, festivalDayEnded, finishFestival, isFestivalDay, pendingFestivalPoints, recordActivity, startFestival, type FestivalDef } from './festival';
import { cafeAdoptCats, type AdoptCat } from './adoption';
import { unlockedPieces } from './costume';
import {
  activeFeatures,
  catCapacity,
  doorState,
  inArea,
  isOpen,
  openProblem,
  resolvedLook,
  restoreProblem,
  roomAt,
  roomState,
  type DoorState,
  type OpenProblem,
  type RestoreProblem,
  type RoomBuilderWork,
  type RoomDef,
  type RoomState,
} from './rooms';
import { hasFreeHost, itemOnTop, placedItemAt, placementProblem, placeOnProblem, withPlaced, type PlaceProblem } from './placement';
import { upgradeCost, upgradeGroupOf } from './upgrades';
import { nowAbs, type Delivery, type DeliveryStage, type GameState, type PlacedItem } from './state';
import { activeBeats, currentGoals, evaluate, isBeatSatisfied, isCleaned, type GoalView, type StoryContext } from './story';
import {
  cellsOf,
  solidGrid,
  interactionNear,
  type Cell,
  type DirtSpot,
  type Facing,
  type MapData,
  type MapDoor,
  type MapInteraction,
  type SurfaceDef,
} from './map';

/** Orçamento da consulta na clínica. */
/** O que a plaquinha de horário mostra (placeHours). `cafe`: o nome vem da UI; `enabled` false = ainda não atende. */
export interface PlaceHours {
  name: string;
  cafe: boolean;
  enabled: boolean;
  days: boolean[];
  open: string;
  close: string;
  openNow: boolean;
  next: { day: number; open: string } | null;
}

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

/** Uma obra de cômodo que o Tião faz (abrir, limpeza pesada, reforma). */
export interface RoomWork {
  kind: 'room_open' | 'room_clear' | 'room_restore';
  cost: number;
  days: number;
  label: string;
  site: RoomBuilderWork['site'];
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
        | 'heavy_dirt'
        | 'no_upgrade'
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
        | 'already_clean'
        | 'no_litter'
        | 'needs_litter'
        | 'full'
        | 'energy_full'
        | 'seat_taken'
        | 'other_item'
        | 'unknown_job'
        | 'job_full'
        | 'job_unavailable'
        | 'missing_item'
        | 'need_food'
        | 'need_warmth'
        | 'door_full'
        | 'hands_full'
        | 'nothing_here'
        | 'already_owned'
        | 'too_early'
        | 'customers_inside'
        | 'cart_empty'
        | 'one_heavy_per_trip'
        | QuoteProblem
        | PlaceProblem;
    };

export class GameSession {
  readonly bus = new EventBus();

  /** Atendimento do café: cardápio, pedidos, mãos, louça, clientes (service.ts). */
  readonly service: CafeService;
  /** Chegada de gatos (data/arrivals.json). */
  readonly arrivals: ArrivalSystem;

  /** Carrinho do mercado (fora do save: nada foi pago ainda). */
  readonly cart = new Cart();
  /** Carrinho do app Market do celular: só vira pedido ao confirmar (checkoutOrder). Não vai para o save. */
  readonly orderCart = new Cart();

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
      hallDirt: () => this.hallDirt(),
      playerSeat: () => this.restingCell(),
      addReputation: (amount, reason) => this.addReputation(amount, reason),
    });
    this.arrivals = new ArrivalSystem({
      state,
      content,
      bus: this.bus,
      evaluate: (c) => evaluate(c as Condition, this.state, this.storyContext()),
      shelteredCount: () => this.shelteredCats().length,
      takeItem: (itemId) => {
        if ((this.state.inventory[itemId] ?? 0) < 1) return false;
        this.removeFromInventory(itemId);
        return true;
      },
      catPersonality: (id) => this.catDef(id)?.personality ?? '',
      guideCats: () => this.shelteredCats().filter((id) => this.state.cats[id]?.provisionalUntil === undefined),
      now: () => nowAbs(this.state),
      capacity: () => this.catCapacity(),
      exclusiveActive: () => this.exclusiveActive(),
      reputation: () => this.reputation(),
      shelterCat: (id, condition, until, treated) => this.shelterCat(id, condition, until, treated),
      money: () => this.state.money,
      addMoney: (delta, reason) => this.addMoney(delta, reason),
      addReputation: (amount, reason) => this.addReputation(amount, reason),
      addPoints: (from, to, delta) => void addPoints(this.state, this.content.relationships, from, to, delta),
    });
    // Ferramenta ou item com uso que acabou de chegar (a vassoura da corretora, a ração do mercado) vai sozinho
    // para a barra, venha de onde vier. O que ela tirou da barra de propósito não volta sozinho.
    if (state.hotbar.slots.every((s) => s === null)) syncHotbar(state.hotbar, state.inventory, content.items); // save sem barra (v9)
    this.ownedIds = this.ownedNow();
    this.bus.onAny((name) => {
      if (name !== 'hotbar.changed') this.syncHotbar();
    });
    this.bus.on('cat.cared', ({ gameId }) => {
      const play = this.content.dayNight.energy.restore.play;
      if (play.games.includes(gameId)) this.recover('play', play.amount);
    });
    // Energia: cada tarefa gasta o que está nos dados (louça: por peça; mini game pulado não gasta).
    for (const name of ENERGY_EVENTS) {
      this.bus.on(name, (e) => {
        if ('skipped' in e && e.skipped) return;
        // Brincar com o gato não cansa: recompõe (cat.cared, abaixo).
        if ('gameId' in e && this.content.dayNight.energy.restore.play.games.includes(e.gameId)) return;
        const cost = this.content.dayNight.energy.costs[name] ?? 0;
        this.spendEnergy(cost * ('count' in e && typeof e.count === 'number' ? e.count : 1));
      });
    }
    // Lista de compras: o que ela compra sai da lista (no caixa ou um a um).
    this.bus.on('item.bought', ({ itemId }) => {
      this.state.shoppingList = this.state.shoppingList.filter((id) => id !== itemId);
    });
    // A bandeja vale quando está selecionada na barra (e continua enquanto houver louça demais para levar sem ela).
    const syncTray = () => this.service.syncTray(this.activeItem() === this.content.carry.tray.item);
    this.bus.on('hotbar.changed', syncTray);
    this.bus.on('hands.changed', syncTray);
    syncTray();
  }

  /** Começa a sessão: avisa quem escuta e dispara os marcos que já valem (ex.: a abertura). */
  start(isNew: boolean): void {
    // Jogo novo: a reputação começa no valor dos dados (newGameState não conhece o conteúdo).
    if (isNew && this.state.reputation.log.length === 0) this.state.reputation.value = this.content.reputation.start;
    // Saves de antes da v8: a louça que ela já ganhou entra no estoque.
    for (const id of Object.keys(this.state.inventory)) this.service.stockDishes(id);
    this.announceRecipes(true);
    this.bus.emit('game.started', { isNew });
    this.advanceStory();
  }

  // ---------- Barra de itens ----------

  /** Itens que ela tinha no último evento (para achar os que acabaram de chegar). */
  private ownedIds = new Set<string>();
  /** Sofá ou cadeira em que ela está sentada (uid), recompondo a energia. Não vai para o save. */
  private restingOn: string | null = null;
  /** Dia em que já lembrou da hora-limite (não vai para o save: recarregar pode lembrar de novo). */
  private curfewRemindedOn = 0;

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

  /** Esta porta, agora, mostra uma cena ou roda um roteiro em vez de deixar passar? Devolve o id da cena ou do roteiro. */
  doorIntercept(door: MapDoor): string | undefined {
    if (this.doorClosedNow(door)) return undefined;
    const i = door.intercept;
    if (!i || !evaluate(i.when as Condition, this.state, this.storyContext())) return undefined;
    if (i.script) {
      this.bus.emit('script.requested', { scriptId: i.script });
      return i.script;
    }
    this.bus.emit('cutscene.requested', { cutsceneId: i.cutscene! });
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

  /** Tigela de ração (comum ou o pote automático) posicionada ao alcance dos pés (`target`: só a célula clicada). */
  bowlNear(feet: readonly Cell[], target?: Cell, reach = 1): string | undefined {
    return this.stationNear('food_bowl', feet, target, reach);
  }

  /** Caixa de areia (comum ou automática) ao alcance dos pés. */
  litterNear(feet: readonly Cell[], target?: Cell, reach = 1): string | undefined {
    return this.stationNear('litter_box', feet, target, reach);
  }

  private stationNear(kind: StationKind, feet: readonly Cell[], target?: Cell, reach = 1): string | undefined {
    if (!this.atHome()) return undefined;
    const { catalog, items } = this.content;
    const dist = (a: Cell, b: Cell) => Math.max(Math.abs(a[0] - b[0]), Math.abs(a[1] - b[1]));
    return this.state.placed.find((p) => {
      const item = items[p.item];
      if (stationKind(item) !== kind) return false;
      const cells = cellsOf(p.at, catalog.tiles[item!.tile!]!);
      if (target && !cells.some(([c, r]) => c === target[0] && r === target[1])) return false;
      return cells.some((c) => feet.some((f) => dist(c, f) <= reach));
    })?.uid;
  }

  /** Quantos dias o automático ainda tem (undefined: não é automático). */
  stationStock(uid: string): number | undefined {
    const p = this.state.placed.find((x) => x.uid === uid);
    return p && this.content.items[p.item]?.autoDays ? (p.stock ?? 0) : undefined;
  }

  /** Item ativo da barra, se ele tiver este uso (ração para a tigela, petisco para o gato). */
  private activeUse(use: ItemUse): string | null {
    const id = this.activeItem();
    return id && this.content.items[id]?.use === use ? id : null;
  }

  /** Gatos do café (os que comem na tigela e usam a caixa de areia). */
  private homeCats(): string[] {
    return this.shelteredCats().filter((id) => this.state.cats[id]!.map === this.content.map.id);
  }

  /**
   * Por que não dá para encher a tigela agora (ou null). A interface confere antes de tocar a animação.
   * Pote automático: abastece (até autoDays dias) em vez de servir na hora.
   */
  feedProblem(bowlUid: string): 'not_found' | 'already_fed' | 'no_food' | 'no_cat' | 'needs_food' | 'full' | 'other_item' | null {
    const p = this.state.placed.find((x) => x.uid === bowlUid);
    const item = p ? this.content.items[p.item] : undefined;
    if (!p || !item) return 'not_found';
    const cats = this.homeCats();
    if (!item.autoDays && cats.length > 0 && cats.every((id) => this.state.cats[id]!.fedOn === this.state.day)) return 'already_fed';
    const hasFood = Object.values(this.content.items).some((i) => i.use === 'food_bowl' && (this.state.inventory[i.id] ?? 0) > 0);
    if (!hasFood) return 'no_food';
    if (!item.autoDays && cats.length === 0) return 'no_cat';
    // A ração vai da barra para a mão: precisa estar no espaço ativo (simples ou premium, a que ela escolher).
    const food = this.activeUse('food_bowl');
    if (!food) return 'needs_food';
    return item.autoDays ? loadProblem(p, item, food) : null;
  }

  /**
   * Enche a tigela com a ração ativa na barra: uma porção serve todos os gatos do café hoje (ganham corações).
   * Pote automático: guarda a ração da mochila (até autoDays dias) e serve sozinho no fim de cada dia.
   */
  feedFromBowl(bowlUid: string): ActionResult {
    const problem = this.feedProblem(bowlUid);
    if (problem) return { ok: false, reason: problem };
    const p = this.state.placed.find((x) => x.uid === bowlUid)!;
    const item = this.content.items[p.item]!;
    const food = this.activeUse('food_bowl')!;
    if (item.autoDays) {
      const qty = load(p, item, food, this.state.inventory[food] ?? 0);
      for (let i = 0; i < qty; i++) this.removeFromInventory(food);
      this.bus.emit('pet.loaded', { itemId: p.item, days: p.stock ?? 0 });
      return { ok: true };
    }
    this.removeFromInventory(food);
    for (const catId of this.homeCats()) {
      if (this.state.cats[catId]!.fedOn === this.state.day) continue;
      this.state.flags[`fed.${catId}`] = true;
      this.state.cats[catId]!.fedOn = this.state.day;
      this.state.cats[catId]!.fedWith = food;
      this.bus.emit('cat.fed', { catId, itemId: food, bowlUid });
      this.addCatAffection(catId, this.content.relationships.feedPoints);
    }
    return { ok: true };
  }

  /** Por que não dá para pôr areia na caixa agora (ou null). Automática: abastece até autoDays dias. */
  litterProblem(boxUid: string): 'not_found' | 'already_clean' | 'no_litter' | 'needs_litter' | 'full' | 'other_item' | null {
    const p = this.state.placed.find((x) => x.uid === boxUid);
    const item = p ? this.content.items[p.item] : undefined;
    if (!p || !item) return 'not_found';
    if (!item.autoDays && p.refilledOn === this.state.day) return 'already_clean';
    const hasLitter = Object.values(this.content.items).some((i) => i.use === 'litter_box' && (this.state.inventory[i.id] ?? 0) > 0);
    if (!hasLitter) return 'no_litter';
    const litter = this.activeUse('litter_box');
    if (!litter) return 'needs_litter';
    return item.autoDays ? loadProblem(p, item, litter) : null;
  }

  /** Põe areia limpa na caixa (a areia ativa na barra). Automática: guarda a areia da mochila (até autoDays dias). */
  refillLitter(boxUid: string): ActionResult {
    const problem = this.litterProblem(boxUid);
    if (problem) return { ok: false, reason: problem };
    const p = this.state.placed.find((x) => x.uid === boxUid)!;
    const item = this.content.items[p.item]!;
    const litter = this.activeUse('litter_box')!;
    if (item.autoDays) {
      const qty = load(p, item, litter, this.state.inventory[litter] ?? 0);
      for (let i = 0; i < qty; i++) this.removeFromInventory(litter);
      this.bus.emit('pet.loaded', { itemId: p.item, days: p.stock ?? 0 });
      return { ok: true };
    }
    this.removeFromInventory(litter);
    p.refilledOn = this.state.day;
    this.bus.emit('litter.refilled', { uid: boxUid });
    return { ok: true };
  }

  /** Fim do dia: os automáticos servem o que faltou; sem areia limpa, a higiene dos gatos do café cai mais. */
  private stationsAtDayEnd(day: number): void {
    const cats = this.homeCats();
    if (cats.length === 0) return;
    const fedToday = cats.some((id) => this.state.cats[id]!.fedOn === day);
    const r = stationsAtDayEnd(this.state.placed, this.content.items, day, fedToday, PET_LOW_DAYS);
    if (r.fed && !fedToday)
      for (const id of cats) {
        const cat = this.state.cats[id]!;
        cat.fedOn = day;
        if (r.fedWith) cat.fedWith = r.fedWith;
        else delete cat.fedWith;
      }
    if (!r.litterOk) {
      for (const id of cats) addCare(this.state.cats[id]!, 'hygiene', -this.content.health.care.litterMissed, this.content.health.care);
      this.bus.emit('litter.missed', { day });
    }
    for (const l of r.low) this.bus.emit('pet.low', { itemId: l.item, days: l.days });
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
   * Fim do dia: ela vai para casa e amanhece chegando pela rua; com o quartinho reformado
   * ("sleep"), ela dorme no café e acorda lá (inclusive quando desmaia).
   */
  endDay(reason: DayEndReason = 'story'): void {
    const day = this.state.day;
    const summary = { day, reason, earned: this.state.today.earned, jobs: this.state.today.jobs };
    // Pedidos pela metade não passam para o dia seguinte (e a caixa da entrega volta para o mercado).
    this.state.jobs.active = [];
    this.state.jobs.progress = {};
    for (const id of Object.keys(this.state.inventory)) if (this.content.items[id]?.tags.includes('job')) delete this.state.inventory[id];
    this.stationsAtDayEnd(day);
    this.healthAtDayEnd(day);
    const missed = festivalDayEnded(this.state.festivals, day + 1);
    if (missed) this.bus.emit('festival.missed', { festivalId: missed, day });
    this.arrivals.dayEnded(day + 1);
    this.state.day = day + 1;
    this.constructionDayEnded(day + 1);
    this.stopRest();
    // Dormiu depois da meia-noite: acorda com menos energia.
    const late = this.state.time > 24 * 60;
    this.state.time = parseClock(reason === 'passOut' ? this.content.dayNight.wakeAfterPassOut : this.content.dayNight.dayStart);
    this.setEnergy(late ? this.content.dayNight.energy.wakeAfterLateNight : this.content.dayNight.energy.max);
    this.state.today = { earned: 0, jobs: 0 };
    this.playgroundDay();
    const sleepRoom = this.sleepRoom();
    const morning = sleepRoom ? { map: this.content.map.id } : this.content.world.morning;
    this.state.location = morning.map;
    if (!this.state.visited.includes(morning.map)) this.state.visited.push(morning.map);
    this.dirtComesBack();
    this.randomIllness();
    if (this.customersAway()) this.bus.emit('customers.away', { sickCats: this.sickCats().length });
    this.service.endOfDay();
    this.cart.clear();
    this.orderCart.clear();
    this.bus.emit('cart.changed', { count: 0, total: 0 });
    this.bus.emit('day.ended', summary);
    this.bus.emit('day.started', { day: day + 1 });
    this.advanceStory();
  }

  /** Relógio: avança `seconds` reais (o jogo chama a cada quadro, quando nada está aberto). */
  tickClock(seconds: number): void {
    const before = Math.floor(this.state.time);
    this.state.time += seconds * this.content.dayNight.minutesPerSecond;
    // A hora-limite vem antes do desmaio (curfew <= passOut): ela vai para casa sem a penalidade de acordar tarde.
    if (this.state.time >= this.curfew()) this.endDay(this.service.opensOn(this.state.day + 1) ? 'curfew' : 'tired');
    else if (this.state.time >= parseClock(this.content.dayNight.passOut)) this.endDay('passOut');
    // A cada minuto de jogo: o correio e a história olham de novo (marcos com hora marcada, ex.: a visita da Gabi).
    else if (Math.floor(this.state.time) !== before) {
      // Sentada: recompõe a cada minuto; ao encher, avisa e ela continua sentada até levantar.
      if (this.restingOn && !this.energyFull()) {
        const gain = this.content.dayNight.energy.restore.seat.perMinute * (Math.floor(this.state.time) - before);
        this.setEnergy(this.energy() + gain);
        if (this.energyFull()) this.bus.emit('rest.full', {});
      }
      // Uma vez por dia, um pouco antes da hora-limite: "está ficando tarde".
      const remind = this.content.dayNight.curfewReminder;
      if (remind > 0 && this.curfewRemindedOn !== this.state.day && this.state.time >= this.curfew() - remind) {
        this.curfewRemindedOn = this.state.day;
        this.bus.emit('curfew.soon', { minutes: Math.round(this.curfew() - this.state.time) });
      }
      this.deliverArrived();
      this.service.tick();
      this.checkBuilderShift();
      this.advanceStory();
    }
  }

  /**
   * Hora-limite da noite (minutos): nela ela vai para casa sozinha. Meia-noite quando o café abre amanhã;
   * na véspera de folga, até as 2h. Ponto de extensão: escolher entre ir para casa e dormir no porão.
   */
  curfew(): number {
    const dn = this.content.dayNight;
    return parseClock(this.service.opensOn(this.state.day + 1) ? dn.curfew : dn.curfewBeforeDayOff);
  }

  // ---------- Energia ----------

  /** Energia agora (sem o campo no save: cheia). */
  energy(): number {
    const cfg = this.content.dayNight.energy;
    return clampEnergy(this.state.energy ?? cfg.max, cfg);
  }

  energyLevel(): EnergyLevel {
    return energyLevel(this.energy(), this.content.dayNight.energy);
  }

  /** Fator da velocidade de andar (cansada anda mais devagar). */
  energySpeed(): number {
    return energySpeed(this.energy(), this.content.dayNight.energy);
  }

  /** Dá para correr? Cansada, não. */
  canRun(): boolean {
    return this.energyLevel() === 'ok';
  }

  energyFull(): boolean {
    return this.energy() >= this.content.dayNight.energy.max;
  }

  /** Onde dá para sentar (sofá, cadeira) pelo tile do item, ou undefined. */
  seatDef(itemId: string): SeatDef | undefined {
    const tile = this.content.items[itemId]?.tile;
    return tile ? this.content.dayNight.energy.restore.seat.tiles[tile] : undefined;
  }

  /** Sofá ou cadeira do café ao alcance dos pés (`target`: só a célula clicada). */
  seatNear(feet: readonly Cell[], target?: Cell, reach = 1): string | undefined {
    if (!this.atHome()) return undefined;
    const dist = (a: Cell, b: Cell) => Math.max(Math.abs(a[0] - b[0]), Math.abs(a[1] - b[1]));
    return this.state.placed.find((p) => {
      if (!this.seatDef(p.item)) return false;
      const cells = cellsOf(p.at, this.content.catalog.tiles[this.content.items[p.item]!.tile!]!);
      if (target && !cells.some(([c, r]) => c === target[0] && r === target[1])) return false;
      return cells.some((c) => feet.some((f) => dist(c, f) <= reach));
    })?.uid;
  }

  /** Por que não dá para sentar agora (ou null). Com a energia cheia também senta. Cadeira com cliente não serve. */
  restProblem(uid?: string): 'hands_full' | 'seat_taken' | null {
    if (this.state.hands.length > 0 || this.state.tray) return 'hands_full';
    const p = uid ? this.state.placed.find((x) => x.uid === uid) : undefined;
    if (p && this.state.service.customers.some((c) => c.stage !== 'queue' && c.spot[0] === p.at[0] && c.spot[1] === p.at[1])) return 'seat_taken';
    return null;
  }

  /** Célula do móvel em que ela está sentada (ou null). */
  private restingCell(): Cell | null {
    const p = this.restingOn ? this.state.placed.find((x) => x.uid === this.restingOn) : undefined;
    return p ? [p.at[0], p.at[1]] : null;
  }

  /** Senta no sofá ou na cadeira: recompõe a cada minuto do jogo (tickClock) até encher ou levantar. */
  startRest(uid: string): ActionResult {
    const problem = this.restProblem(uid);
    if (problem) return { ok: false, reason: problem };
    if (!this.state.placed.some((p) => p.uid === uid)) return { ok: false, reason: 'not_found' };
    this.restingOn = uid;
    this.bus.emit('rest.changed', { uid });
    return { ok: true };
  }

  /** Levanta (andou ou apertou E). */
  stopRest(): void {
    if (!this.restingOn) return;
    this.restingOn = null;
    this.bus.emit('rest.changed', { uid: null });
  }

  /** O sofá ou a cadeira em que ela está sentada (ou null). Não vai para o save. */
  resting(): string | null {
    return this.restingOn;
  }

  /** O café que ela pode tomar: o último da mão entre as receitas de restore.coffee. */
  private coffeeInHands(): number {
    const recipes = this.content.dayNight.energy.restore.coffee.recipes;
    for (let i = this.state.hands.length - 1; i >= 0; i--) {
      const h = this.state.hands[i]!;
      if (h.kind === 'drink' && recipes.includes(h.recipe)) return i;
    }
    return -1;
  }

  holdingCoffee(): boolean {
    return this.coffeeInHands() >= 0;
  }

  /** Toma o café da mão: recompõe e a xícara fica suja na mão (vai para a pia como as outras). */
  drinkCoffee(): ActionResult {
    const i = this.coffeeInHands();
    if (i < 0) return { ok: false, reason: 'not_found' };
    if (this.energyFull()) return { ok: false, reason: 'energy_full' };
    const drink = this.state.hands[i]!;
    if (drink.kind !== 'drink') return { ok: false, reason: 'not_found' };
    this.state.hands[i] = { kind: 'dirty', vessel: drink.vessel };
    this.bus.emit('hands.changed', { count: this.state.hands.length });
    this.recover('coffee', this.content.dayNight.energy.restore.coffee.amount);
    return { ok: true };
  }

  private recover(source: 'coffee' | 'play', amount: number): void {
    const before = this.energy();
    this.setEnergy(before + amount);
    this.bus.emit('energy.recovered', { source, amount: Math.round(this.energy() - before) });
  }

  spendEnergy(amount: number): void {
    if (amount > 0) this.setEnergy(this.energy() - amount);
  }

  private setEnergy(value: number): void {
    const cfg = this.content.dayNight.energy;
    const next = clampEnergy(value, cfg);
    if (next === this.state.energy) return;
    this.state.energy = next;
    this.bus.emit('energy.changed', { energy: next, max: cfg.max, level: energyLevel(next, cfg) });
  }

  /** Já dá para encerrar o dia na porta do café? */
  canGoHome(): boolean {
    return this.goHomeProblem() === null;
  }

  /** Por que ainda não dá para ir para casa: cedo demais, ou ainda tem cliente no café (ela espera o último sair). */
  goHomeProblem(): 'too_early' | 'customers_inside' | null {
    if (this.state.time < parseClock(this.content.dayNight.goHomeFrom)) return 'too_early';
    if (this.state.service.customers.length > 0) return 'customers_inside';
    return null;
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
    // "*" (saves antigos: tudo limpo) vira a lista de verdade antes de sujar de novo (só o salão: cômodos novos começam sujos).
    if (this.state.cleaned.includes('*')) {
      this.state.cleaned = (this.content.map.dirt ?? []).filter((d) => !d.clearedBy && !d.tags.includes('room') && !d.when).map((d) => d.id);
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

  /**
   * Rotina do dia, depois do prólogo: comida para cada gato do café, o que o balão de cuidado de cada um pede
   * (remédio, escovar, brincar; `hasTool`: já tem a escova/varinha) e a poeira que voltou.
   */
  chores(): { kind: 'feed' | 'sweep' | 'sick' | 'pantry' | 'care' | 'toys'; catId?: string; need?: CareNeed; hasTool?: boolean; done: boolean; progress?: [number, number] }[] {
    if (!this.state.flags['prologue.done']) return [];
    const out: { kind: 'feed' | 'sweep' | 'sick' | 'pantry' | 'care' | 'toys'; catId?: string; need?: CareNeed; hasTool?: boolean; done: boolean; progress?: [number, number] }[] = [];
    if (this.customersAway()) out.push({ kind: 'sick', done: false, progress: [this.sickCats().length, this.content.health.customers.stopAtSickCats] });
    for (const id of this.shelteredCats()) {
      if (this.state.cats[id]!.map === this.content.map.id) out.push({ kind: 'feed', catId: id, done: this.state.cats[id]!.fedOn === this.state.day });
    }
    // Brinquedos de menos para os gatos do café (1 a cada catsPerToy): eles pedem para brincar todo dia.
    const room = this.playRoom();
    const missing = toysMissing(this.content.health.care, room);
    if (missing > 0) out.push({ kind: 'toys', done: false, progress: [room.toys, room.toys + missing] });
    // O balão em cima do gato (sujo, triste, remédio): a mesma coisa vira um lembrete aqui, dizendo o que fazer.
    const owns = (use: string) => Object.values(this.content.items).some((i) => i.use === use && (this.state.inventory[i.id] ?? 0) > 0);
    const toolFor: Partial<Record<CareNeed, string>> = { dirty: 'brush', sad: 'wand', play: 'wand', medicine: 'medicine' };
    for (const id of this.homeCats()) {
      for (const need of this.catCare(id)?.needs ?? []) {
        const use = toolFor[need];
        out.push({ kind: 'care', catId: id, need, hasTool: !use || owns(use), done: false });
      }
    }
    const daily = (this.content.map.dirt ?? []).filter((d) => !d.clearedBy && d.tags.includes('daily'));
    const left = daily.filter((d) => !isCleaned(this.state, d)).length;
    const back = this.content.world.dailyDirt;
    if (left > 0 || this.state.day > 2) out.push({ kind: 'sweep', done: left === 0, progress: [Math.max(0, back - left), back] });
    // Compras de ingrediente na mochila: guardar na despensa (só assim contam para as receitas).
    if (this.service.ingredientsInBag() > 0) out.push({ kind: 'pantry', done: false });
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

  /**
   * Celular: quantos deste item ainda cabem no pedido. Fixo, só 1 (e nenhum se já tem ou está chegando);
   * no total, não mais do que cabe na porta (delivery.maxPending, contando o que já está a caminho).
   */
  orderMax(itemId: string): number {
    const item = this.content.items[itemId];
    if (!item) return 0;
    const room = this.content.delivery.maxPending - this.pendingDeliveries() - (this.orderCart.count() - this.orderCart.qty(itemId));
    const own = item.kind === 'fixture' ? ((this.state.inventory[itemId] ?? 0) > 0 || this.state.deliveries.some((d) => d.item === itemId) ? 0 : 1) : MAX_QTY_PER_ITEM;
    return Math.max(0, Math.min(own, room));
  }

  /** Celular: põe uma unidade no pedido (o dinheiro só é conferido ao confirmar). */
  addToOrder(itemId: string): ActionResult {
    const item = this.content.items[itemId];
    if (!item || item.deprecated || ['key', 'tool', 'gift'].includes(item.kind ?? 'furniture')) return { ok: false, reason: 'unknown_item' };
    if (!this.itemUnlocked(itemId)) return { ok: false, reason: 'locked' };
    if (this.orderCart.qty(itemId) >= this.orderMax(itemId)) return { ok: false, reason: item.kind === 'fixture' ? 'already_owned' : 'door_full' };
    this.orderCart.add(itemId);
    return { ok: true };
  }

  removeFromOrder(itemId: string): void {
    this.orderCart.remove(itemId);
  }

  orderTotal(): number {
    return this.orderCart.total((id) => this.content.items[id]?.price ?? 0);
  }

  /**
   * Celular: confirma o pedido. Sem dinheiro para tudo, não compra nada. Encomenda unidade por unidade
   * (order); se uma falhar, para ali e o resto fica no carrinho. Devolve quantos saíram e quando chega o último.
   */
  checkoutOrder(): { ok: true; ordered: number; arrivesAt: number } | { ok: false; reason: Extract<ActionResult, { ok: false }>['reason']; ordered: number } {
    if (this.orderCart.isEmpty()) return { ok: false, reason: 'cart_empty', ordered: 0 };
    if (this.state.money < this.orderTotal()) return { ok: false, reason: 'no_money', ordered: 0 };
    let ordered = 0;
    for (const { itemId, qty } of this.orderCart.lines()) {
      for (let i = 0; i < qty; i++) {
        const r = this.order(itemId);
        if (!r.ok) return { ok: false, reason: r.reason, ordered };
        this.orderCart.remove(itemId);
        ordered++;
      }
    }
    return { ok: true, ordered, arrivesAt: this.state.deliveries[this.state.deliveries.length - 1]!.arrivesAt };
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

  /** A dica de hoje da Cartilha do gato (Vila Hoje). */
  catTip(): CatTip | null {
    return tipForDay(this.content.news, this.state.day);
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
    if (job.repeat === 'sporadic') return last !== this.state.day && sporadicToday(job.id, this.state.day, job.chance ?? 0);
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
    // A chegada de gato da vez: o lugar do encontro ou a pista.
    out.push(...this.arrivals.pendingPoints(mapId));
    // Os festivais usam pontos de pedido sem ser um pedido (as etapas ficam em state.festivals).
    const fest = this.activeFestival();
    for (const id of fest ? pendingFestivalPoints(this.state.festivals, fest, this.state.day) : []) {
      const p = this.content.jobPoints[id];
      if (p && p.map === mapId) out.push(p);
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
    const arrival = this.arrivals.interact(pointId);
    if (typeof arrival === 'string') return { ok: false, reason: arrival };
    if (arrival) return { ok: true };
    if (this.isFestivalPoint(pointId)) return this.doFestivalStep(pointId);
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

  /** Ponto do dia seguinte onde ela aparece de manhã (no quartinho, se dormiu no café). */
  morningSpawn(): Cell {
    const room = this.sleepRoom();
    if (room?.sleep && this.state.location === this.content.map.id) return room.sleep.wake;
    return this.content.world.morning.spawn;
  }

  // ---------- Cômodos (data/rooms.json) ----------

  roomState(roomId: string): RoomState {
    return roomState(this.content.rooms, this.state, roomId);
  }

  doorState(doorId: string): DoorState {
    return doorState(this.content.rooms, this.state, doorId);
  }

  rooms(): RoomDef[] {
    return this.content.rooms.rooms;
  }

  /** Quantos gatos cabem: soma dos cômodos abertos. */
  catCapacity(): number {
    return catCapacity(this.content.rooms, this.state);
  }

  /** Cabe mais um gato no abrigo? (gatos de rua; os da história sempre entram.) */
  canShelterMoreCats(): boolean {
    return this.shelteredCats().length < this.catCapacity();
  }

  /** O cômodo com "sleep" restaurado (ela dorme no café), se houver. */
  sleepRoom(): RoomDef | undefined {
    if (!activeFeatures(this.content.rooms, this.state).has('sleep')) return undefined;
    return this.content.rooms.rooms.find((r) => r.features?.includes('sleep') && this.roomState(r.id) === 'restored');
  }

  /** Sujeiras ainda visíveis de um cômodo (a tag de restore.dirtTag). */
  roomDirtLeft(roomId: string): number {
    const tag = this.content.rooms.rooms.find((r) => r.id === roomId)?.restore?.dirtTag;
    return tag ? this.visibleDirt().filter((d) => d.tags.includes(tag)).length : 0;
  }

  /** Descobre um cômodo: ele aparece (sai do escuro) e a passagem vira uma porta fechada. Com o momento (fala + destaque). */
  discoverRoom(roomId: string): void {
    const room = this.content.rooms.rooms.find((r) => r.id === roomId);
    if (!room || this.roomState(roomId) !== 'locked') return;
    this.state.rooms[roomId] = 'discovered';
    for (const d of this.content.rooms.doors) if (d.to === roomId && this.doorState(d.id) === 'hidden') this.state.doors[d.id] = 'locked';
    if (room.discover?.dialogue) this.bus.emit('dialogue.requested', { dialogueId: room.discover.dialogue });
    this.bus.emit('room.discovered', { roomId, trigger: room.discover?.trigger ?? 'renovation', highlight: room.discover?.highlight ?? null });
  }

  /** Por que não dá para abrir este cômodo agora (ou null). */
  openRoomProblem(roomId: string): OpenProblem | null {
    return openProblem(this.content.rooms, this.state, roomId, {
      money: this.state.money,
      cats: this.shelteredCats().length,
      beats: this.state.story.completed,
      has: (item) => (this.state.inventory[item] ?? 0) > 0,
    });
  }

  /** Abre o cômodo (obra paga e/ou chave usada): as portas abrem e ele fica "abandonado" (sujo). */
  openRoom(roomId: string): ActionResult & { problem?: OpenProblem } {
    const problem = this.openRoomProblem(roomId);
    if (problem) return { ok: false, reason: 'locked', problem };
    const room = this.content.rooms.rooms.find((r) => r.id === roomId)!;
    const cost = room.unlock?.cost ?? 0;
    if (cost > 0) this.addMoney(-cost, `room:${roomId}`);
    this.applyRoomOpen(room);
    return { ok: true };
  }

  /** As portas do cômodo abrem e ele fica "abandonado" (sujo): pela chave, pela obra paga ou no fim da obra do Tião. */
  private applyRoomOpen(room: RoomDef): void {
    const roomId = room.id;
    for (const d of this.content.rooms.doors.filter((x) => x.to === roomId)) {
      this.state.doors[d.id] = 'open';
      if (d.requires?.item && d.consumesItem) this.removeFromInventory(d.requires.item);
    }
    this.state.rooms[roomId] = 'abandoned';
    if (room.unlock?.dialogue) this.bus.emit('dialogue.requested', { dialogueId: room.unlock.dialogue });
    this.bus.emit('room.opened', { roomId });
    this.advanceStory();
  }

  /**
   * As obras do cômodo que o Tião faz agora: abrir o descoberto; no aberto, a limpeza pesada (enquanto houver
   * sujeira "heavy") e a reforma. Cada uma com o preço, os dias e o lugar dele.
   */
  roomWorks(roomId: string): RoomWork[] {
    const room = this.content.rooms.rooms.find((r) => r.id === roomId);
    if (!room) return [];
    const s = this.roomState(roomId);
    const out: RoomWork[] = [];
    const add = (kind: RoomWork['kind'], w: { cost?: number; label?: string; builder?: RoomBuilderWork } | undefined) => {
      if (w?.builder) out.push({ kind, cost: w.cost ?? 0, days: w.builder.days, label: w.label ?? room.name, site: w.builder.site });
    };
    if (s === 'discovered') add('room_open', room.unlock);
    if (s === 'abandoned') {
      if (this.roomHeavyDirtLeft(roomId) > 0) add('room_clear', room.clear);
      add('room_restore', room.restore);
    }
    return out;
  }

  /** Sujeira pesada que falta no cômodo (mato alto: só o Tião tira, na limpeza pesada). */
  roomHeavyDirtLeft(roomId: string): number {
    const tag = this.content.rooms.rooms.find((r) => r.id === roomId)?.restore?.dirtTag;
    return tag ? this.visibleDirt().filter((d) => d.heavy && d.tags.includes(tag)).length : 0;
  }

  /** Pede ao Tião uma obra do cômodo (abrir, limpeza pesada ou reforma): abre a ligação com o orçamento. A limpeza vem antes da reforma. */
  quoteRoom(roomId: string, kind?: RoomWork['kind']): ActionResult {
    const works = this.roomWorks(roomId);
    const work = kind ? works.find((w) => w.kind === kind) : works[0];
    if (!work) return { ok: false, reason: 'room_not_ready' };
    const s = this.state.construction;
    const blocker = quoteBlocker(s, work.kind, this.painterUnlocked());
    if (blocker) return { ok: false, reason: blocker };
    const problem = work.kind === 'room_open' ? this.openRoomProblem(roomId) : work.kind === 'room_restore' ? this.restoreRoomProblem(roomId) : null;
    if (problem === 'needs_money' || this.state.money < work.cost) return { ok: false, reason: 'no_money' };
    if (problem) return { ok: false, reason: 'room_not_ready' };
    s.quote = { kind: work.kind, roomId, site: work.site, material: 0, labor: work.cost, days: work.days };
    this.bus.emit('construction.call', { kind: work.kind });
    return { ok: true };
  }

  /** E numa passagem fechada: com o item (chave), abre; sem, a fala de trancada. */
  useRoomDoor(doorId: string): ActionResult & { problem?: OpenProblem } {
    const door = this.content.rooms.doors.find((d) => d.id === doorId);
    if (!door || this.doorState(doorId) !== 'locked') return { ok: false, reason: 'not_found' };
    // Porta de obra (sem item): abre pelo catálogo; porta com item: abre aqui, se ela tiver o item.
    const problem = door.requires?.item ? this.openRoomProblem(door.to) : 'needs_money';
    if (problem) {
      if (door.lockedDialogue) this.bus.emit('dialogue.requested', { dialogueId: door.lockedDialogue });
      this.bus.emit('door.blocked', { doorId });
      return { ok: false, reason: 'locked', problem };
    }
    return this.openRoom(door.to);
  }

  /** Por que não dá para terminar a reforma agora (ou null). */
  restoreRoomProblem(roomId: string): RestoreProblem | null {
    return restoreProblem(this.content.rooms, this.state, roomId, { money: this.state.money, dirty: this.roomDirtLeft(roomId) });
  }

  /** Termina a reforma (limpo + obra paga): o visual muda e as funcionalidades ligam. */
  restoreRoom(roomId: string): ActionResult & { problem?: RestoreProblem } {
    const problem = this.restoreRoomProblem(roomId);
    if (problem) return { ok: false, reason: 'locked', problem };
    const room = this.content.rooms.rooms.find((r) => r.id === roomId)!;
    const cost = room.restore?.cost ?? 0;
    if (cost > 0) this.addMoney(-cost, `restore:${roomId}`);
    this.markRestored(room);
    this.advanceStory();
    return { ok: true };
  }

  private markRestored(room: RoomDef): void {
    this.state.rooms[room.id] = 'restored';
    if (room.restore?.dialogue) this.bus.emit('dialogue.requested', { dialogueId: room.restore.dialogue });
    this.bus.emit('room.restored', { roomId: room.id });
  }

  /** Descobertas e reformas automáticas (condições dos dados). Diz se mudou algo. */
  private advanceRooms(): boolean {
    let changed = false;
    const ctx = this.storyContext();
    for (const room of this.content.rooms.rooms) {
      const s = this.roomState(room.id);
      if (s === 'locked' && room.discover?.when && evaluate(room.discover.when, this.state, ctx)) {
        this.discoverRoom(room.id);
        changed = true;
      } else if (s === 'abandoned' && room.restore?.when && evaluate(room.restore.when, this.state, ctx)) {
        this.markRestored(room);
        changed = true;
      }
    }
    return changed;
  }

  /** Cômodo aberto onde a célula fica (paredes e portas: nenhum). */
  roomAt(cell: Cell): RoomDef | undefined {
    return roomAt(this.content.rooms, cell);
  }

  /** Dorme no café (a cama do quartinho, depois do horário de ir para casa). */
  sleepInCafe(): ActionResult {
    if (!this.sleepRoom()) return { ok: false, reason: 'locked' };
    const problem = this.goHomeProblem();
    if (problem) return { ok: false, reason: problem };
    this.endDay('sleep');
    return { ok: true };
  }

  /** Playground: cada módulo posicionado no quintal reformado dá afeto a todos os gatos, por dia. */
  private playgroundDay(): void {
    const pg = this.content.rooms.playground;
    const room = this.content.rooms.rooms.find((r) => r.id === pg.room);
    if (!room || this.roomState(room.id) !== 'restored') return;
    const modules = this.state.placed.filter((p) => this.content.items[p.item]?.tags.includes(pg.tag) && inArea(room, p.at)).length;
    if (modules === 0) return;
    for (const catId of this.shelteredCats()) this.addCatAffection(catId, modules * pg.pointsPerModulePerDay);
  }

  // ---------- Gatos ----------

  /** Gatos abrigados (ids). Gatos de lembrança (a Tekinha) nunca contam, nem se um save trouxer um deles. */
  shelteredCats(): string[] {
    return Object.keys(this.state.cats).filter((id) => this.state.cats[id]!.sheltered && !this.catDef(id)?.memory);
  }

  /** Nome da protagonista (vazio em saves de antes do criador). */
  playerName(): string {
    return this.state.player.name;
  }

  /** Ela ou ele (criador): escolhe a forma nos textos com {g:feminino|masculino}. */
  playerPronoun(): Pronoun {
    return this.state.player.pronoun ?? DEFAULT_PRONOUN;
  }

  /** Aparência da protagonista: a escolhida ou a padrão dos dados. */
  appearance(): Appearance {
    return this.state.player.appearance ?? this.content.character.default;
  }

  /** Definição do gato: a de data/cats.json ou, para os gerados pelas chegadas, a do save. */
  catDef(catId: string): CatDef | undefined {
    return this.content.cats[catId] ?? this.state.catDefs[catId];
  }

  /** Nome do gato: o escolhido, o fixo dos dados, ou vazio. */
  catName(catId: string): string {
    return this.state.cats[catId]?.name || this.catDef(catId)?.name || '';
  }

  suggestCatName(catId: string, attempt: number): string {
    const cat = this.catDef(catId);
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
      const def = this.catDef(id);
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

  /** Fim do dia: comeu sobe (mais com a ração premium), não comeu desce (descuido), doente sem o remédio do dia desce mais; baixa demais, adoece. */
  private healthAtDayEnd(day: number): void {
    const cfg = this.content.health;
    for (const id of this.shelteredCats()) {
      const cat = this.state.cats[id]!;
      // A ração premium (healthMultiplier) rende mais saúde que a comum.
      const mult = (cat.fedWith && this.content.items[cat.fedWith]?.healthMultiplier) || 1;
      let delta = cat.fedOn === day ? Math.round(cfg.daily.fed * mult) : cfg.daily.hungry;
      if (cat.sickness && cat.sickness.treatment?.lastDoseDay !== day) delta += cfg.daily.sickUntreated;
      cat.health = clampHealth(cfg, cat.health + delta);
      if (!cat.sickness && cat.health < cfg.sickBelow) this.makeSick(id);
      careAtDayEnd(cat, cfg.care, day, this.playRoom());
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

  /** O mini game de cuidado que o item ativo abre num gato do café (varinha: wand; escova: grooming), ou null. */
  careGameInHand(): 'wand' | 'grooming' | null {
    if (!this.atHome()) return null;
    if (this.activeUse('wand')) return 'wand';
    if (this.activeUse('brush')) return 'grooming';
    return null;
  }

  /** Dificuldade dos cuidados pelo jeito do gato (cat_profiles.json: personalities[].trust; gato arisco = difícil). */
  careDifficulty(catId: string): Difficulty {
    const personality = this.catDef(catId)?.personality;
    return (personality && this.content.catProfiles.personalities[personality]?.trust) || 'normal';
  }

  /** Cuidados do gato: felicidade, higiene e o que ele está precisando agora (o balão em cima dele, o app). */
  catCare(catId: string): { happiness: number; hygiene: number; needs: CareNeed[] } | null {
    const cat = this.state.cats[catId];
    if (!cat?.sheltered) return null;
    const cfg = this.content.health.care;
    return { ...careOf(cat, cfg), needs: careNeeds(cat, this.state.day, cfg, this.playRoom()) };
  }

  /** Brinquedos posicionados (health.json: care.play.toyTag) e gatos no café, para o pedido de brincar. */
  playRoom(): PlayRoom {
    const tag = this.content.health.care.play.toyTag;
    return { toys: this.state.placed.filter((p) => this.content.items[p.item]?.tags.includes(tag)).length, cats: this.homeCats().length };
  }

  /** Debug: muda felicidade ou higiene de um gato (F9, linha Cuidados). */
  debugCare(catId: string, stat: CareStat, delta: number): void {
    const cat = this.state.cats[catId];
    if (cat?.sheltered) addCare(cat, stat, delta, this.content.health.care);
  }

  /**
   * Debug: conclui o próximo marco da história sem esperar a condição. Os efeitos que mudam o estado valem (itens,
   * flags, dinheiro, gato, cômodo); falas, cenas, roteiros e saltos de hora/dia ficam de fora (não abrem uma fila de
   * diálogos). Gato abrigado sem nome ganha o primeiro nome sugerido. Devolve o marco concluído (ou null: acabou).
   */
  debugCompleteBeat(): string | null {
    this.debugNaming = true;
    try {
      return this.completeBeatQuietly();
    } finally {
      this.debugNaming = false;
    }
  }

  /** Gato abrigado durante o debug da história já ganha nome (sem a caixa de nome). */
  private debugNaming = false;

  private completeBeatQuietly(): string | null {
    // Ignora também a condição de início (ex.: "a partir do dia 3"): só a ordem (after) vale.
    const done = this.state.story.completed;
    const next = this.content.story.beats.find((b) => !done.includes(b.id) && (b.after ?? []).every((d) => done.includes(d)));
    if (!next) return null;
    this.state.story.completed.push(next.id);
    this.state.story.completedOn[next.id] = this.state.day;
    for (const e of next.effects) {
      if ('dialogue' in e || 'cutscene' in e || 'script' in e || 'endDay' in e || 'setTime' in e) continue;
      if ('discoverRoom' in e) {
        if (this.roomState(e.discoverRoom) === 'locked') this.state.rooms[e.discoverRoom] = 'discovered';
        continue;
      }
      this.applyEffect(e);
    }
    for (const id of this.shelteredCats()) if (!this.state.cats[id]!.name) this.state.cats[id]!.name = this.suggestCatName(id, 0);
    this.bus.emit('story.beat_completed', { beatId: next.id });
    return next.id;
  }

  /** Debug: conclui marcos até `untilId` (inclusive) ou até o fim da história; a sujeira de vassoura sai junto (a faxina). */
  debugCompleteStory(untilId?: string): number {
    for (const d of this.visibleDirt()) if (!d.clearedBy) this.state.cleaned.push(d.id);
    let n = 0;
    for (let id = this.debugCompleteBeat(); id; id = untilId === id ? null : this.debugCompleteBeat()) n++;
    this.advanceStory();
    return n;
  }

  /** Debug: todos os cômodos descobertos, abertos e reformados (passagens abertas, sujeira deles limpa). */
  debugUnlockRooms(): void {
    for (const room of this.content.rooms.rooms) {
      for (const d of this.content.rooms.doors.filter((x) => x.to === room.id)) this.state.doors[d.id] = 'open';
      const tag = room.restore?.dirtTag;
      if (tag) for (const d of this.visibleDirt().filter((x) => x.tags.includes(tag))) this.state.cleaned.push(d.id);
      if (this.roomState(room.id) === 'restored') continue;
      this.state.rooms[room.id] = 'restored';
      this.bus.emit('room.restored', { roomId: room.id });
    }
    this.advanceStory();
  }

  /** Debug: o gato fica doente e já com receita (3 dias), para testar o remédio sem passar pela clínica. */
  debugSickWithPrescription(catId: string): void {
    const cat = this.state.cats[catId];
    if (!cat?.sheltered) return;
    this.makeSick(catId);
    if (cat.sickness && !cat.sickness.treatment) cat.sickness.treatment = { days: 3, dosesGiven: 0, lastDoseDay: null };
  }

  /** Dá a dose do dia: cura um pouco; tomou todas as doses da receita, sara. */
  medicateCat(catId: string): ActionResult {
    const problem = this.medicineProblem(catId);
    if (problem) return { ok: false, reason: problem };
    this.applyDose(catId, this.activeUse('medicine')!);
    return { ok: true };
  }

  /**
   * A dose do dia (com o item de remédio `itemId`, que sai da mochila): cura um pouco; tomou todas as doses da
   * receita, sara. Quem chama já conferiu que pode (medicineProblem ou pillDose).
   */
  private applyDose(catId: string, itemId: string): void {
    const cfg = this.content.health;
    const cat = this.state.cats[catId]!;
    const t = cat.sickness!.treatment!;
    this.removeFromInventory(itemId);
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
  }

  /** Remédio escondido: quanto dura a distração do gato pelo jeito dele (cat_profiles.json: pillWindow). */
  pillWindow(catId: string): number {
    const personality = this.catDef(catId)?.personality;
    return (personality && this.content.catProfiles.personalities[personality]?.pillWindow) || 1;
  }

  /**
   * Remédio escondido deu certo: a dose do dia. O remédio pode estar na mão ou só na mochila (a missão do vet
   * também abre o jogo: o vet entrega o remédio, o jogo dá a dose). Sem receita, já tomou hoje ou sem remédio: nada.
   */
  private pillDose(catId: string): void {
    const cat = this.state.cats[catId];
    const t = cat?.sickness?.treatment;
    if (!cat?.sheltered || !t || t.lastDoseDay === this.state.day) return;
    const medicine = this.content.health.medicine.item;
    const item = this.activeUse('medicine') ?? ((this.state.inventory[medicine] ?? 0) > 0 ? medicine : null);
    if (item) this.applyDose(catId, item);
  }

  /** O item ativo é remédio? (aí E perto do gato dá a dose) */
  holdingMedicine(): boolean {
    return !!this.activeUse('medicine');
  }


  // ---------- Mini games (data/minigames.json) ----------

  /**
   * O mini game acabou: paga as moedas do resultado e, se ele foi aberto por um ponto de pedido e deu certo,
   * conta o ponto. Quem chamou recebe o resultado pelo registro (a tela); a regra fica aqui.
   */
  finishMiniGame(result: MiniGameResult, params: MiniGameParams): void {
    if (result.coinsEarned > 0) this.addMoney(result.coinsEarned, `minigame:${result.gameId}`);
    if (result.itemId && this.content.items[result.itemId]) this.receiveItem(result.itemId);
    for (const a of result.adoptions ?? []) {
      this.bus.emit('cat.adopted', { catId: a.catId, verdict: a.verdict, leftCafe: a.verdict === 'good' && this.adoptOut(a.catId) });
      // Cada adoção vale a sua reputação (boa vale mais que ok: data/adoption.json).
      const rep = this.content.adoption.reputation[a.verdict] ?? 0;
      if (rep !== 0) this.addReputation(rep, `adoption:${a.catId}:${a.verdict}`);
    }
    // Remédio escondido: deu certo (sem pular), a dose do dia vai.
    if (result.gameId === 'pill' && params.catId && result.outcome !== 'fail' && !result.skipped) this.pillDose(params.catId);
    // Cuidado de um gato do café (varinha, escova, remédio): felicidade e higiene sobem (health.json: care.gains).
    const careCat = params.catId ? this.state.cats[params.catId] : undefined;
    if (careCat?.sheltered && !result.skipped) {
      const gain = careGain(this.content.health.care, result.gameId, result.outcome);
      for (const [stat, v] of Object.entries(gain) as [CareStat, number][]) addCare(careCat, stat, v, this.content.health.care);
      // Brincou de verdade (a varinha): o pedido de brincar volta a contar daqui.
      if (result.gameId === 'wand' && result.outcome !== 'fail') careCat.playedOn = this.state.day;
      if (Object.keys(gain).length > 0) this.bus.emit('cat.cared', { catId: params.catId!, gameId: result.gameId, ...careOf(careCat, this.content.health.care) });
    }
    // Foto perfeita: a melhor de sempre fica guardada (pose, nota, gatos, dia).
    if (result.photo && !result.skipped && result.photo.score > (this.state.bestPhoto?.score ?? -1)) {
      this.state.bestPhoto = { ...result.photo, day: this.state.day };
      this.bus.emit('photo.best', result.photo);
    }
    const rep = reputationForResult(this.content.minigames.games[result.gameId]?.reputation, result);
    if (rep !== 0) this.addReputation(rep, `minigame:${result.gameId}:${result.outcome}`);
    this.bus.emit('minigame.finished', { gameId: result.gameId, outcome: result.outcome, coins: result.coinsEarned, skipped: result.skipped });
    // Mini game de uma chegada de gato: deu certo, a chegada segue; não deu, tenta de novo no mesmo lugar.
    if (params.jobPoint && this.arrivals.ownsMinigame(params.jobPoint)) {
      this.arrivals.minigameResult(params.jobPoint, result.outcome !== 'fail' && !result.skipped);
      this.advanceStory();
      return;
    }
    // Atividade de um festival: conta com qualquer resultado (a feira acontece mesmo sem o match perfeito).
    const fest = this.activeFestival();
    const activity = params.jobPoint ? fest?.activities.find((a) => a.point === params.jobPoint) : undefined;
    if (fest && activity && isFestivalDay(this.state.festivals, this.state.day)) {
      const adopted = (result.adoptions ?? []).filter((a) => a.verdict === 'good').length;
      this.festivalAdopted += adopted;
      const record = { game: result.gameId, outcome: result.outcome, coins: result.coinsEarned, skipped: result.skipped, ...(result.fairSetup ? { setup: result.fairSetup } : {}), ...(result.contest ? { contest: result.contest } : {}), ...(result.photo ? { photo: result.photo } : {}) };
      const step = recordActivity(this.state.festivals, fest, activity.point, record, this.state.day);
      if (step === 'finished') this.endFestival(fest);
      this.advanceStory();
    } else if (params.jobPoint && result.outcome !== 'fail') this.doJobPoint(params.jobPoint);
    else this.advanceStory();
  }

  /**
   * Ponto de integração da adoção: um gato do café que foi adotado (match "boa") sai do café. Os gatos do abrigo
   * da vila (adopt.*) não estão no café, e os da história (adoption.json: protectedCats) nunca saem.
   * Devolve se o gato saiu.
   */
  adoptOut(catId: string): boolean {
    // Do abrigo da vila (café estava cheio): ganhou família e sai da lista.
    const pool = this.state.arrivals.shelterPool;
    if (pool.includes(catId)) {
      this.state.arrivals.shelterPool = pool.filter((id) => id !== catId);
      return true;
    }
    const cat = this.state.cats[catId];
    if (!cat?.sheltered || this.content.adoption.protectedCats.includes(catId)) return false;
    cat.sheltered = false;
    return true;
  }

  // ---------- Reputação felina ----------

  /** Valor de 0 a max (data/reputation.json). */
  reputation(): number {
    return this.state.reputation.value;
  }

  /**
   * Soma (ou tira) reputação, com o motivo (fica no log curto do save, para debug). Emite reputation.changed e,
   * para cada limiar cruzado pela primeira vez, reputation.threshold_reached (os desbloqueios ainda não existem).
   */
  addReputation(amount: number, reason: string): void {
    const { from, to, crossed } = addReputation(this.state.reputation, this.content.reputation, amount, reason, this.state.day);
    if (from !== to) this.bus.emit('reputation.changed', { from, to, amount: to - from, reason });
    for (const t of crossed) this.bus.emit('reputation.threshold_reached', { thresholdId: t.id, value: to });
    if (crossed.length > 0) this.maybeStartFestivals();
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

  /** A porta deixa passar? (requisito em dados, ex.: ter a chave; e o horário do estabelecimento). */
  canUseDoor(door: MapDoor): boolean {
    if (this.doorClosedNow(door)) return false;
    return !door.requires || evaluate(door.requires as Condition, this.state, this.storyContext());
  }

  /** O estabelecimento desta porta está fora do horário agora? (porta sem horário: nunca). */
  doorClosedNow(door: MapDoor): boolean {
    const h = door.hours;
    return !!h && !isOpenAt(h, weekdayOf(this.state.day, this.content.seasons.startWeekday), this.state.time);
  }

  /** Quando o estabelecimento da porta abre de novo (ou null). */
  doorOpening(door: MapDoor): { day: number; open: string } | null {
    return door.hours ? nextOpening(door.hours, this.state.day, this.state.time, this.content.seasons.startWeekday) : null;
  }

  /**
   * Plaquinha de horário (interação "hours"): o horário do estabelecimento da porta `doorId` (mapa atual), se está aberto
   * agora e quando abre. A porta do café não tem horário nos dados: vale o do app Horário (null em `days` = o café
   * ainda não atende).
   */
  placeHours(doorId: string): PlaceHours | null {
    const door = (this.mapData(this.state.location).doors ?? []).find((d) => d.id === doorId);
    if (!door) return null;
    if (door.hours) {
      const h = door.hours;
      return { name: h.name, cafe: false, enabled: true, days: h.days, open: h.open, close: h.close, openNow: !this.doorClosedNow(door), next: this.doorOpening(door) };
    }
    if (door.to !== this.content.map.id) return null;
    const s = this.service.schedule();
    return { name: '', cafe: true, enabled: this.service.enabled(), days: s.days, open: s.open, close: s.close, openNow: this.service.isOpen(), next: this.service.nextOpening() };
  }

  /** Tentou abrir uma porta trancada: a fala de trancada (requisito) ou o aviso de fechado (horário). */
  doorLocked(door: MapDoor): void {
    // Trancada pela história (ex.: a clínica ainda é obra): a fala dela vale mais que o horário.
    const unmet = door.requires && !evaluate(door.requires as Condition, this.state, this.storyContext());
    if (!unmet && this.doorClosedNow(door)) {
      const next = this.doorOpening(door);
      this.bus.emit('door.closed', { doorId: door.id, name: door.hours!.name, opensDay: next?.day ?? null, opensAt: next?.open ?? null });
      return;
    }
    if (door.locked) this.bus.emit('dialogue.requested', { dialogueId: door.locked });
  }

  /** Recebe um item (história ou roteiro): vai para a bolsa. */
  receiveItem(itemId: string): void {
    // Item que não fica na mochila (a chave, o presente de louça): só a marca de que chegou.
    if (this.content.items[itemId]?.inBag === false) this.state.flags[`received.${itemId}`] = true;
    else this.state.inventory[itemId] = (this.state.inventory[itemId] ?? 0) + 1;
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
    this.arrivals.stepFinished({ script: scriptId });
    this.advanceStory();
  }

  /** A interface terminou de mostrar uma cena: marca `seen.<id>` e segue a história. */
  finishCutscene(cutsceneId: string): void {
    this.state.flags[seenFlag(cutsceneId)] = true;
    this.bus.emit('cutscene.finished', { cutsceneId });
    this.arrivals.stepFinished({ cutscene: cutsceneId });
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
      // A fachada do café com a cor do pintor; depois, a rua na estação do dia (sem neve fora do inverno).
      const painted = this.withFacade({ ...other, objects: this.visibleObjects(other) });
      const inSeason = mapInSeason(this.content.seasons, painted, this.season(), (t) => !!this.content.catalog.tiles[t]);
      const builder = this.builderAt(mapId);
      const npcs = [...(inSeason.npcs ?? []), ...(builder ? [{ npc: this.content.construction.npc, at: builder.at, facing: builder.facing, anim: 'martelando' }] : [])];
      // Com ele trabalhando, a peça solta da calçada no lugar dele (a árvore de Natal, a lousa) sai de lá; a fachada fica.
      const { tiles } = this.content.catalog;
      const onHim = (o: MapData['objects'][number]) => !!builder && tiles[o.tile]?.layer === 'object' && cellsOf(o.at, tiles[o.tile]!).some(([c, r]) => c === builder.at[0] && r === builder.at[1]);
      const kept = inSeason.objects.filter((o) => !onHim(o));
      const blocked = new Set([inSeason.spawn.player, ...(inSeason.doors ?? []).map((d) => d.at)].map((c) => cellKey(c)));
      for (const o of kept) { const def = tiles[o.tile]; if (def) for (const cell of cellsOf(o.at, def)) blocked.add(cellKey(cell)); }
      return { ...inSeason, npcs, objects: [...kept, ...this.jobMarkers(mapId), ...this.siteMarkerObjects({ ...inSeason, objects: kept }, blocked)] };
    }
    const rooms = this.roomsMapParts();
    const base = {
      ...this.content.map,
      objects: [...this.visibleObjects(this.content.map), ...rooms.objects, ...this.jobMarkers(mapId), ...this.festivalObjects()],
      interactions: [...(this.content.map.interactions ?? []), ...rooms.interactions],
    };
    const legend = { ...base.legend, ...rooms.legend };
    for (const surface of base.surfaces ?? []) {
      const finish = this.content.finishes[this.state.finishes[surface.id] ?? ''];
      if (finish) legend[surface.legend] = finish.tile;
    }
    // Obras: acabamento por célula, a fita da área isolada e o construtor trabalhando.
    const works = this.constructionMapParts(base);
    const builder = this.builderAt(base.id);
    const npcs = [...(base.npcs ?? []), ...(builder ? [{ npc: this.content.construction.npc, at: builder.at, facing: builder.facing, anim: 'martelando' }] : [])];
    return withPlaced({ ...base, layers: works.layers, legend: { ...legend, ...works.legend }, objects: [...base.objects, ...works.objects], npcs, dirt: this.visibleDirt() }, this.state.placed, this.content.items, this.content.world.counterLift ?? 0);
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

  /** O que os cômodos põem no mapa do café: tiles por estado/variante, objetos, portas e interações (porta, cama). */
  private roomsMapParts(): { legend: Record<string, string>; objects: MapData['objects']; interactions: MapInteraction[] } {
    const legend: Record<string, string> = {};
    const objects: MapData['objects'] = [];
    const interactions: MapInteraction[] = [];
    for (const room of this.content.rooms.rooms) {
      const s = this.roomState(room.id);
      const look = resolvedLook(room, s);
      Object.assign(legend, look.legend);
      objects.push(...look.objects);
      if (s === 'restored' && room.features?.includes('sleep') && room.sleep) {
        interactions.push({ id: `int.sleep.${room.id}`, at: room.sleep.bed, reach: 2, action: { sleep: room.id } });
      }
    }
    for (const door of this.content.rooms.doors) {
      const s = this.doorState(door.id);
      // A porta (1x2) tem a base na célula da passagem e sobe por cima da parede; a parede escondida é 1x1.
      // Sem tile para o estado (escondida numa parede lisa, ou aberta sem porta), não desenha nada.
      const tile = s === 'hidden' ? door.tiles.hidden : s === 'locked' ? door.tiles.locked : door.tiles.open;
      if (!tile) continue;
      const h = this.content.catalog.tiles[tile]?.h ?? 1;
      // Porta na parede de cima (o jardim): embutida na parede, não no vão de uma parede divisória.
      const inWall = (this.content.map.layers.walls[door.at[1]]?.[door.at[0]] ?? '.') !== '.';
      objects.push({ id: `obj.${door.id}`, tile, at: [door.at[0], door.at[1] - h + 1], ...(inWall ? { inWall: true } : {}) });
      if (s === 'locked' && door.tiles.lockedOverlay) objects.push({ id: `obj.${door.id}.lock`, tile: door.tiles.lockedOverlay, at: door.at, inWall: true });
      if (s === 'locked') interactions.push({ id: `int.${door.id}`, at: door.at, reach: 1, action: { door: door.id } });
    }
    return { legend, objects, interactions };
  }

  /** Sujeira do café que ainda aparece (a limpa, a de superfícies reformadas e a de cômodos fechados somem). */
  /** Sujeira do salão agora: sujeiras visíveis (das que saem com faxina) dentro dele e louça suja nas superfícies (pesa na avaliação dos clientes). */
  hallDirt(): number {
    const hall = this.content.rooms.rooms.find((r) => r.id === 'room.hall')?.area;
    const inHall = ([c, r]: Cell) => !hall || (c >= hall.from[0] && c <= hall.to[0] && r >= hall.from[1] && r <= hall.to[1]);
    // Só o que sai com faxina: rachaduras e manchas da reforma não são culpa do dia.
    const dirt = this.visibleDirt().filter((d) => !d.clearedBy && inHall(d.at)).length;
    return dirt + this.state.surfaces.filter((x) => x.item.kind === 'dirty').length;
  }

  visibleDirt(): DirtSpot[] {
    return (this.content.map.dirt ?? [])
      .filter((d) => {
        // Cômodo ainda fechado: a sujeira dele não aparece nem se limpa.
        const room = this.roomAt(d.at);
        if (room && !isOpen(this.roomState(room.id))) return false;
        // Sujeira que só aparece a partir de uma condição (o cocô do dia 2).
        if (d.when && !evaluate(d.when as Condition, this.state, this.storyContext())) return false;
        return d.clearedBy ? !this.state.finishes[d.clearedBy] : !isCleaned(this.state, d);
      })
      .map((d) => (d.when ? this.freeSpotFor(d) : d));
  }

  /** A célula não fica num cômodo ainda fechado. */
  private cellOpen(cell: Cell): boolean {
    const room = this.roomAt(cell);
    return !room || isOpen(this.roomState(room.id));
  }

  /**
   * Sujeira que aparece no meio do jogo (com `when`): se a jogadora já pôs um móvel naquela célula, ela vai para a
   * célula livre mais próxima (senão ficaria escondida embaixo dele).
   */
  private freeSpotFor(d: DirtSpot): DirtSpot {
    const { catalog, items } = this.content;
    const taken = new Set<string>();
    for (const p of this.state.placed) {
      const def = catalog.tiles[items[p.item]?.tile ?? ''];
      if (def) for (const [c, r] of cellsOf(p.at, def)) taken.add(`${c},${r}`);
    }
    const solid = solidGrid({ ...this.content.map, objects: this.visibleObjects(this.content.map) }, catalog);
    const free = ([c, r]: Cell) => !taken.has(`${c},${r}`) && solid[r]?.[c] === false && this.cellOpen([c, r]);
    if (free(d.at)) return d;
    for (let dist = 1; dist <= 6; dist++)
      for (let dr = -dist; dr <= dist; dr++)
        for (let dc = -dist; dc <= dist; dc++) {
          if (Math.max(Math.abs(dc), Math.abs(dr)) !== dist) continue;
          const at: Cell = [d.at[0] + dc, d.at[1] + dr];
          if (free(at)) return { ...d, at };
        }
    return d;
  }

  /** Marcadores dos pontos de pedido pendentes (ex.: montes de neve a varrer). */
  // ---------- Festivais (src/core/festival.ts; data/festivals.json) ----------

  /** Gatos adotados nas atividades do festival de hoje (para o resumo; não vai para o save). */
  private festivalAdopted = 0;

  /** O festival em andamento (ou undefined). */
  activeFestival(): FestivalDef | undefined {
    const id = this.state.festivals.active?.id;
    return id ? this.content.festivals.find((f) => f.id === id) : undefined;
  }

  /** Começa o primeiro festival disponível: a protagonista tem a ideia (fala) e a meta aparece. */
  private maybeStartFestivals(): void {
    if (this.state.festivals.active) return;
    const { season, day: dayOfSeason } = this.seasonDay();
    const ctx = { day: this.state.day, season, dayOfSeason, reached: this.state.reputation.reached, evaluate: (c: unknown) => evaluate(c as Condition, this.state, this.storyContext()) };
    const def = this.content.festivals.find((f) => festivalCanStart(this.state.festivals, f, ctx));
    if (def) this.beginFestival(def);
  }

  private beginFestival(def: FestivalDef): void {
    startFestival(this.state.festivals, def, { day: this.state.day, dayOfSeason: this.seasonDay().day });
    this.festivalAdopted = 0;
    this.bus.emit('festival.started', { festivalId: def.id });
    if (def.idea) this.bus.emit('dialogue.requested', { dialogueId: def.idea });
    const a = this.state.festivals.active!;
    if (a.stage === 'scheduled') this.bus.emit('festival.scheduled', { festivalId: def.id, day: a.day! });
  }

  /**
   * Debug: começa um festival agora, sem as condições (nem data: fica marcado para hoje, ou a preparação começa).
   * Um em andamento é trocado.
   */
  debugStartFestival(id: string): void {
    const def = this.content.festivals.find((f) => f.id === id);
    if (!def) return;
    this.state.festivals.active = null;
    this.state.festivals.heldOn = null;
    delete this.state.festivals.last[id];
    this.beginFestival({ ...def, date: undefined });
    this.advanceStory();
  }

  private isFestivalPoint(pointId: string): boolean {
    const def = this.activeFestival();
    return !!def && pendingFestivalPoints(this.state.festivals, def, this.state.day).includes(pointId);
  }

  private doFestivalStep(pointId: string): ActionResult {
    const def = this.activeFestival()!;
    const step = doFestivalPoint(this.state.festivals, def, pointId, this.state.day);
    if (!step) return { ok: false, reason: 'not_found' };
    if (step === 'scheduled') this.bus.emit('festival.scheduled', { festivalId: def.id, day: this.state.festivals.active!.day! });
    else this.bus.emit('festival.progress', { festivalId: def.id, step, pointId });
    this.advanceStory();
    return { ok: true };
  }

  /** A última atividade acabou: prêmios do evento e o resumo. */
  private endFestival(def: FestivalDef): void {
    const done = finishFestival(this.state.festivals);
    if (!done) return;
    const coins = def.rewards?.coins ?? 0;
    const reputation = def.rewards?.reputation ?? 0;
    if (coins > 0) this.addMoney(coins, `festival:${def.id}`);
    if (reputation > 0) this.addReputation(reputation, `festival:${def.id}`);
    const adopted = this.festivalAdopted;
    this.festivalAdopted = 0;
    this.bus.emit('festival.finished', { festivalId: def.id, results: done.results, coins: coins + done.results.reduce((n, r) => n + r.coins, 0), reputation, adopted });
  }

  /** O que o festival mostra agora (para o balão): a etapa, o dia marcado, o que falta e a atividade da vez. */
  festivalStatus(): { def: FestivalDef; stage: 'prep' | 'waiting' | 'today'; day: number | null; left: number; total: number; next: 'prep' | 'close' | 'decor' | 'activity' | null; game: string | null } | null {
    const def = this.activeFestival();
    const a = this.state.festivals.active;
    if (!def || !a) return null;
    const pending = pendingFestivalPoints(this.state.festivals, def, this.state.day);
    const base = { def, day: a.day, game: null };
    if (a.stage === 'prep') return { ...base, stage: 'prep', left: pending.length, total: def.prep?.points.length ?? 0, next: 'prep' };
    if (!isFestivalDay(this.state.festivals, this.state.day)) return { ...base, stage: 'waiting', left: 0, total: 0, next: null };
    const decor = def.decorations ?? [];
    if (pending[0] && pending[0] === def.closePoint?.point) return { ...base, stage: 'today', left: 0, total: 0, next: 'close' };
    if (pending[0] && decor.some((d) => d.point === pending[0])) return { ...base, stage: 'today', left: pending.length, total: decor.length, next: 'decor' };
    const act = def.activities.find((x) => x.point === pending[0]);
    return { ...base, stage: 'today', left: 0, total: 0, next: act ? 'activity' : null, game: act?.game ?? null };
  }

  /** Parâmetros extras de um mini game aberto por um ponto (a mesa da feira leva os gatos do café). */
  miniGameExtras(pointId: string): Pick<MiniGameParams, 'adoptCats' | 'catId' | 'extraFamilies' | 'contestCats' | 'costumePieces'> {
    // Mini game de uma chegada: o gato da chegada (a fuga, a confiança... com a cor dele).
    if (this.arrivals.ownsMinigame(pointId)) return { catId: this.state.arrivals.active!.catId };
    // Ponto de pedido com o remédio escondido (missão do vet): o primeiro gato que precisa da dose hoje.
    if (this.content.jobPoints[pointId]?.minigame?.id === 'pill') {
      const catId = this.shelteredCats().find((id) => needsMedicine(this.state.cats[id]!, this.state.day));
      return catId ? { catId } : {};
    }
    // Atividades de um festival: montar a feira (escolhe os gatos do café) e a mesa de adoção (os escolhidos primeiro,
    // e as famílias a mais que a montagem trouxe).
    const fest = this.activeFestival();
    const game = fest?.activities.find((a) => a.point === pointId)?.game ?? this.content.jobPoints[pointId]?.minigame?.id;
    // Concurso de fantasia: qualquer gato do café desfila (os da história também) com as peças liberadas.
    if (game === 'costume') return this.contestExtras();
    if (game === 'photo') return { contestCats: this.contestExtras().contestCats };
    if (!fest || (game !== 'adoption' && game !== 'fair_setup')) return {};
    const protectedCats = this.content.adoption.protectedCats;
    const cats = [...this.shelteredCats(), ...this.state.arrivals.shelterPool]
      .filter((id) => !protectedCats.includes(id) && this.catDef(id))
      .map((id) => {
        const def = this.catDef(id)!;
        return { id, name: this.catName(id), variant: def.variant, personality: def.personality, ...(def.adoptionTraits ? { adoptionTraits: def.adoptionTraits } : {}) };
      });
    const all = cafeAdoptCats(this.content.adoption, cats);
    if (game === 'fair_setup') return { adoptCats: all };
    const setup = this.state.festivals.active?.results.find((r) => r.setup)?.setup;
    if (!setup) return { adoptCats: all };
    const chosen = setup.cats.map((id) => all.find((c) => c.id === id)).filter((c): c is AdoptCat => !!c);
    const extra = Math.max(0, Math.min(setup.extraFamilies, this.content.fairSetup.maxFamilies - this.adoptionPairs(pointId)));
    return { adoptCats: chosen, extraFamilies: extra };
  }

  /** O que o concurso de fantasia precisa: os gatos do café (com o nome dado) e as peças liberadas pela reputação. */
  contestExtras(): Pick<MiniGameParams, 'contestCats' | 'costumePieces'> {
    const contestCats = this.shelteredCats()
      .map((id) => ({ id, name: this.catName(id), variant: this.catDef(id)?.variant ?? '' }))
      .filter((c) => c.variant);
    return { contestCats, costumePieces: unlockedPieces(this.content.costume, this.state.reputation.reached).map((p) => p.id) };
  }

  /** Pares do match aberto por este ponto (a dificuldade dele). */
  private adoptionPairs(pointId: string): number {
    const difficulty = this.content.jobPoints[pointId]?.minigame?.difficulty ?? 'normal';
    return Number(this.content.minigames.games.adoption?.difficulties[difficulty]?.pairs ?? 0);
  }

  /** No dia do festival: a placa na porta e as decorações já feitas aparecem no mapa (até o fim do dia). */
  private festivalObjects(): MapData['objects'] {
    const f = this.state.festivals;
    const held = f.heldOn?.day === this.state.day ? f.heldOn.id : null;
    const id = held ?? (isFestivalDay(f, this.state.day) ? f.active!.id : null);
    const def = id ? this.content.festivals.find((d) => d.id === id) : undefined;
    if (!def) return [];
    const pieces = [...(def.closePoint ? [def.closePoint] : []), ...(def.decorations ?? [])];
    const done = held ? null : f.active!.done;
    return pieces
      .filter((d) => !done || done.includes(d.point))
      .map((d) => ({ id: `fest.${d.point}`, tile: d.tile, at: [...this.content.jobPoints[d.point]!.at] as Cell }));
  }

  private jobMarkers(mapId: string): MapData['objects'] {
    return this.pendingJobPoints(mapId)
      .filter((p) => p.marker)
      .map((p) => ({ id: `marker.${p.id}`, tile: p.marker!, at: p.at }));
  }

  /** Objetos do mapa que aparecem agora (os com `when` só depois da condição). */
  private visibleObjects(map: MapData): MapData['objects'] {
    const open = this.state.openCurtains ?? [];
    return map.objects
      .filter((o) => !o.when || evaluate(o.when as Condition, this.state, this.storyContext()))
      .map((o) => {
        if (!o.curtainOpen || !open.includes(o.id)) return o;
        const wild = o.curtainOvergrown && this.roomOvergrown(o.curtainOvergrown.room);
        return { ...o, tile: wild ? o.curtainOvergrown!.tile : o.curtainOpen };
      });
  }

  /**
   * O cômodo ainda tem o mato pesado (antes da limpeza do Tião), aberto ou não: a vista da janela para ele (o quintal)
   * é de galhos. Diferente de roomHeavyDirtLeft, conta também com o cômodo fechado.
   */
  roomOvergrown(roomId: string): boolean {
    const tag = this.content.rooms.rooms.find((r) => r.id === roomId)?.restore?.dirtTag;
    return !!tag && (this.content.map.dirt ?? []).some((d) => d.heavy && d.tags.includes(tag) && !isCleaned(this.state, d));
  }

  /** A cortina desta janela está aberta? */
  curtainOpen(objectId: string): boolean {
    return (this.state.openCurtains ?? []).includes(objectId);
  }

  /**
   * Abre ou fecha a cortina (a luz no piso só sai da janela aberta). Na primeira vez que alguma abre no jogo, a fala
   * dela sobre a vista (`dialogue`), uma vez só (flag seen.<fala>).
   */
  toggleCurtain(objectId: string, dialogue?: string): void {
    const open = this.state.openCurtains ?? [];
    const opening = !open.includes(objectId);
    this.state.openCurtains = opening ? [...open, objectId] : open.filter((id) => id !== objectId);
    this.bus.emit('curtain.toggled', { objectId, open: opening });
    if (opening && dialogue && !this.state.flags[`seen.${dialogue}`]) {
      this.state.flags[`seen.${dialogue}`] = true;
      this.bus.emit('dialogue.requested', { dialogueId: dialogue });
    }
  }

  /** Sujeira visível numa célula do café (ou undefined). */
  dirtAt([col, row]: Cell): DirtSpot | undefined {
    const { catalog } = this.content;
    return this.visibleDirt()
      .filter((d) => catalog.tiles[d.tile] && cellsOf(d.at, catalog.tiles[d.tile]!).some(([c, r]) => c === col && r === row))
      .sort((a, b) => Number(!!a.clearedBy) - Number(!!b.clearedBy))[0];
  }

  /** Tutorial: a dica "E" deste tipo de coisa ainda aparece? (some depois de world.hintTimes usos) */
  hintWanted(kind: string): boolean {
    return (this.state.hintUses[kind] ?? 0) < (this.content.world.hintTimesBy?.[kind] ?? this.content.world.hintTimes);
  }

  /** Ela usou o E neste tipo de coisa: conta para o tutorial (até sumir a dica). */
  noteHintUse(kind: string): void {
    if (this.hintWanted(kind)) this.state.hintUses[kind] = (this.state.hintUses[kind] ?? 0) + 1;
  }

  /** A sujeira que dá para varrer mais perto dos pés dela, a até `reach` células (E com a vassoura). */
  dirtNear(from: readonly Cell[], reach = 2): DirtSpot | undefined {
    const { catalog } = this.content;
    const dist = (d: DirtSpot) =>
      Math.min(...cellsOf(d.at, catalog.tiles[d.tile]!).flatMap(([c, r]) => from.map(([fc, fr]) => Math.max(Math.abs(c - fc), Math.abs(r - fr)))));
    return this.visibleDirt()
      .filter((d) => !d.clearedBy && !d.heavy && catalog.tiles[d.tile] && dist(d) <= reach)
      .sort((a, b) => dist(a) - dist(b))[0];
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
    // Embaixo dela tinha algo (ex.: a chave do quintal).
    if (d.gives) {
      this.state.inventory[d.gives] = (this.state.inventory[d.gives] ?? 0) + 1;
      this.bus.emit('item.received', { itemId: d.gives });
      if (d.foundDialogue) this.bus.emit('dialogue.requested', { dialogueId: d.foundDialogue });
    }
    this.advanceStory();
    return { ok: true };
  }

  /** Por que não dá para limpar agora (ou null): a interface confere antes de varrer. */
  cleanProblem(dirtId: string, from: readonly Cell[] = [], reach = 2): 'not_found' | 'needs_repair' | 'heavy_dirt' | 'too_far' | 'needs_broom' | null {
    const d = this.visibleDirt().find((x) => x.id === dirtId);
    if (!d) return 'not_found';
    if (d.clearedBy) return 'needs_repair';
    if (d.heavy) return 'heavy_dirt';
    const def = this.content.catalog.tiles[d.tile]!;
    if (from.length > 0) {
      const near = cellsOf(d.at, def).some(([c, r]) => from.some(([fc, fr]) => Math.max(Math.abs(c - fc), Math.abs(r - fr)) <= reach));
      if (!near) return 'too_far';
    }
    return this.toolProblem('sweep');
  }

  private storyContext(): StoryContext {
    return { items: this.content.items, dirt: this.content.map.dirt ?? [], requiredSurfaces: this.content.business.requiredSurfaces, rooms: this.content.rooms, seasons: this.content.seasons };
  }

  /** Superfícies que o pintor pode reformar (as do café e a fachada na rua). */
  surfaces(): SurfaceDef[] {
    return [...(this.content.map.surfaces ?? []), ...(this.content.facade ? [this.content.facade.surface] : [])];
  }

  /** A fachada do café com o acabamento escolhido (a neve por cima, se houver para ela). */
  private withFacade(map: MapData): MapData {
    const f = this.content.facade;
    const finish = f && map.id === f.map ? this.content.finishes[this.state.finishes[f.surface.id] ?? ''] : undefined;
    if (!f || !finish) return map;
    const snow = `snow_${finish.tile}`;
    return {
      ...map,
      objects: map.objects.map((o) => (o.id === f.object ? { ...o, tile: finish.tile, overlay: this.content.catalog.tiles[snow] ? snow : undefined } : o)),
    };
  }

  // ---------- Calendário (data/seasons.json) ----------

  /** Estação de hoje. */
  season(): string {
    return seasonOf(this.content.seasons, this.state.day);
  }

  /** "Inverno, dia 12". */
  seasonDay(): { season: string; name: string; day: number } {
    const season = this.season();
    return { season, name: this.content.seasons.names[season] ?? season, day: dayInSeason(this.content.seasons, this.state.day) };
  }

  /** Marcações do calendário (app "Calendário") de `from` a `to`: começos de estação e eventos ainda valendo. */
  calendar(from: number, to: number): CalendarEntry[] {
    const out = calendarEntries(this.content.seasons, from, to, (e) => !!e.hideWhen && evaluate(e.hideWhen as Condition, this.state, this.storyContext()));
    // O festival marcado, com o nome dele.
    const a = this.state.festivals.active;
    const def = this.activeFestival();
    if (def && a?.stage === 'scheduled' && a.day !== null && a.day >= from && a.day <= to) out.push({ id: `cal.${def.id}`, day: a.day, title: def.name, kind: 'event' });
    return out.sort((a, b) => a.day - b.day);
  }

  /** Dias até a estação chegar pela primeira vez (0 se já chegou). */
  daysUntil(season: string): number {
    return daysUntil(this.content.seasons, this.state.day, season);
  }

  // ---------- Obras com o construtor (src/core/construction.ts; data/finishes.json construction) ----------

  /** Acabamento que vale numa célula: o da obra por área, senão o da superfície (ou nenhum: o velho do mapa). */
  finishAt(surface: SurfaceDef, cell: Cell): string | undefined {
    return this.state.construction.cells[cellKey(cell)] ?? this.state.finishes[surface.id];
  }

  /** Pede um reparo (interno, ou externo com a cor da fachada): abre a ligação com o orçamento. */
  quoteRepair(kind: RepairKind, facadeFinishId?: string): ActionResult {
    const s = this.state.construction;
    const problem = quoteBlocker(s, kind, this.painterUnlocked());
    if (problem) return { ok: false, reason: problem };
    const r = this.content.construction.repairs[kind];
    if (kind === 'outside' && this.content.finishes[facadeFinishId ?? '']?.kind !== 'facade') return { ok: false, reason: 'unknown_finish' };
    if (this.state.money < r.price) return { ok: false, reason: 'no_money' };
    s.quote = { kind, ...(kind === 'outside' ? { finishId: facadeFinishId } : {}), material: 0, labor: r.price, days: r.days };
    this.bus.emit('construction.call', { kind });
    return { ok: true };
  }

  /** Pinta a fachada de outra cor (depois do reparo externo). */
  quoteFacade(finishId: string): ActionResult {
    const s = this.state.construction;
    const problem = quoteBlocker(s, 'facade', this.painterUnlocked());
    if (problem) return { ok: false, reason: problem };
    const finish = this.content.finishes[finishId];
    if (finish?.kind !== 'facade') return { ok: false, reason: 'unknown_finish' };
    if (this.state.finishes[this.content.facade?.surface.id ?? ''] === finishId) return { ok: false, reason: 'already_painted' };
    if (this.state.money < finish.price) return { ok: false, reason: 'no_money' };
    s.quote = { kind: 'facade', finishId, material: 0, labor: finish.price, days: this.content.construction.facadeDays };
    this.bus.emit('construction.call', { kind: 'facade' });
    return { ok: true };
  }

  /**
   * Orçamento de uma troca de acabamento na área (sem cobrar). Paredes pegam a coluna inteira. `more`: outras áreas
   * marcadas junto (Ctrl + arrastar): tudo vira uma obra só, e a célula que está em duas áreas conta uma vez.
   */
  finishQuote(surfaceId: string, finishId: string, a: Cell, b: Cell, more: readonly (readonly [Cell, Cell])[] = []): { cells: Cell[]; material: number; labor: number; days: number } | null {
    const surface = this.surfaces().find((x) => x.id === surfaceId);
    const finish = this.content.finishes[finishId];
    if (!surface || !finish || finish.kind !== surface.kind || surface.kind === 'facade') return null;
    const c = this.content.construction;
    const seen = new Set<string>();
    const cells = [[a, b] as const, ...more]
      .flatMap(([x, y]) => surfaceCells(this.content.map, surface, x, y))
      .filter((cell) => !seen.has(cellKey(cell)) && (seen.add(cellKey(cell)), this.finishAt(surface, cell) !== finishId));
    const perTile = c.materialPerTile[surface.kind as 'floor' | 'wall' | 'wainscot'] ?? 0;
    return { cells, material: cells.length * perTile, labor: cells.length * c.laborPerTile, days: jobDays(cells.length, c) };
  }

  /** Pede a troca de acabamento na área (e nas outras marcadas junto): ela compra o material (sai agora) e liga para o construtor. */
  quoteFinish(surfaceId: string, finishId: string, a: Cell, b: Cell, more: readonly (readonly [Cell, Cell])[] = []): ActionResult {
    const s = this.state.construction;
    const problem = quoteBlocker(s, 'finish', this.painterUnlocked());
    if (problem) return { ok: false, reason: problem };
    const q = this.finishQuote(surfaceId, finishId, a, b, more);
    if (!q) return { ok: false, reason: 'wrong_surface' };
    if (q.cells.length === 0) return { ok: false, reason: 'no_cells' };
    // O total precisa caber: a mão de obra é paga logo em seguida, na ligação.
    if (this.state.money < q.material + q.labor) return { ok: false, reason: 'no_money' };
    if (q.material > 0) this.addMoney(-q.material, `material:${finishId}`);
    s.quote = { kind: 'finish', surfaceId, finishId, cells: q.cells, material: q.material, labor: q.labor, days: q.days };
    this.bus.emit('construction.call', { kind: 'finish' });
    return { ok: true };
  }

  /** Resposta ao orçamento: sim paga adiantado e ele vem amanhã; não devolve o material. */
  answerQuote(accept: boolean): ActionResult {
    const s = this.state.construction;
    const q = s.quote;
    if (!q) return { ok: false, reason: 'not_found' };
    if (!accept || this.state.money < q.labor) {
      if (q.material > 0) this.addMoney(q.material, `material_refund:${q.finishId ?? q.kind}`);
      s.quote = null;
      this.bus.emit('construction.declined', { kind: q.kind });
      return accept ? { ok: false, reason: 'no_money' } : { ok: true };
    }
    this.addMoney(-q.labor, `construction:${q.kind}`);
    s.job = scheduleJob(q, this.state.day);
    s.quote = null;
    this.bus.emit('construction.accepted', { kind: q.kind, startDay: s.job.startDay!, endDay: s.job.endDay! });
    return { ok: true };
  }

  /** Depois da obra, ele pergunta se ela quer mais algum serviço: a resposta (sim abre a aba Construção) encerra a pergunta. */
  answerBuilder(more: boolean): void {
    this.state.construction.askPending = false;
    this.bus.emit('construction.asked', { more });
  }

  /** Se o Tião estava no expediente no último minuto (para avisar quando ele chega e quando vai embora). */
  private builderWasWorking: boolean | null = null;

  /** A cada minuto: ele chegou (workFrom) ou foi embora (fim do expediente)? Avisa a cena para pôr ou tirar ele. */
  private checkBuilderShift(): void {
    const spot = builderSpot(this.state.construction, this.content.map, this.state.day, this.content.construction);
    const working = !!spot && builderOnShift(this.content.construction, this.state.time);
    if (this.builderWasWorking !== null && working !== this.builderWasWorking) this.bus.emit('construction.shift', { working, map: spot?.map ?? this.content.map.id });
    this.builderWasWorking = working;
  }

  /** O construtor está trabalhando hoje neste mapa: onde e virado para onde. */
  builderAt(mapId: string): { at: Cell; facing: Facing } | null {
    const spot = builderSpot(this.state.construction, this.content.map, this.state.day, this.content.construction);
    if (!spot || (spot.map ?? this.content.map.id) !== mapId) return null;
    // Só no expediente dele (chega às 08:00 e vai embora depois de 8 horas).
    if (!builderOnShift(this.content.construction, this.state.time)) return null;
    return { at: spot.at, facing: spot.facing };
  }

  /** Cone e fita em volta do lugar do Tião neste mapa (nos dias de obra): cada um no primeiro lugar livre, só no chão. */
  private siteMarkerObjects(map: MapData, blocked: Set<string>): MapData['objects'] {
    const free = ([c, r]: Cell) => (map.layers.floor[r]?.[c] ?? '.') !== '.' && (map.layers.walls[r]?.[c] ?? '.') === '.' && !blocked.has(cellKey([c, r]));
    const builder = this.builderAt(map.id) ?? builderSpot(this.state.construction, this.content.map, this.state.day, this.content.construction);
    if (builder) blocked.add(cellKey(builder.at)); // nada em cima dele
    const out: MapData['objects'] = [];
    for (const m of siteMarkers(this.state.construction, this.content.map, this.state.day, this.content.construction)) {
      if ((m.map ?? this.content.map.id) !== map.id) continue;
      const at = m.at.find(free);
      if (!at) continue;
      blocked.add(cellKey(at));
      out.push({ id: `obj.construction.site_${at[0]}_${at[1]}`, tile: m.tile, at: [at[0], at[1]] });
    }
    return out;
  }

  /** Fim do dia: a obra que terminou entra no café (ou na fachada). */
  private constructionDayEnded(newDay: number): void {
    const facade = this.content.facade?.surface.id ?? 'surface.facade';
    const done = finishJobIfDone(this.state.construction, this.state.finishes, newDay, this.content.construction, facade);
    if (!done) return;
    // Obra de cômodo: abre (as portas) ou termina a reforma (o visual e as funcionalidades).
    const room = this.content.rooms.rooms.find((r) => r.id === done.roomId);
    if (room && done.kind === 'room_open' && this.roomState(room.id) === 'discovered') this.applyRoomOpen(room);
    if (room && done.kind === 'room_clear') {
      // Limpeza pesada: o mato alto do cômodo sai todo de uma vez.
      for (const d of this.visibleDirt().filter((x) => x.heavy && x.tags.includes(room.restore?.dirtTag ?? ''))) {
        this.state.cleaned.push(d.id);
        this.bus.emit('dirt.cleaned', { dirtId: d.id });
      }
      this.advanceStory();
    }
    if (room && done.kind === 'room_restore' && this.roomState(room.id) === 'abandoned') {
      this.markRestored(room);
      this.advanceStory();
    }
    this.bus.emit('construction.done', { kind: done.kind });
  }

  /** O que a obra põe no mapa do café hoje: o acabamento por célula e a área isolada (fita). */
  private constructionMapParts(base: MapData): { layers: MapData['layers']; legend: Record<string, string>; objects: MapData['objects'] } {
    const legend: Record<string, string> = {};
    const layers = { ...base.layers, floor: [...base.layers.floor], walls: [...base.layers.walls] };
    const cells = this.state.construction.cells;
    const surfaces = base.surfaces ?? [];
    // Uma letra nova por acabamento usado nas células (as da legenda não servem: valem para a superfície toda).
    const pool = [...'0123456789!#$%&*+=?@^~'].filter((ch) => !(ch in base.legend));
    const letterOf = new Map<string, string>();
    for (const [key, finishId] of Object.entries(cells)) {
      const finish = this.content.finishes[finishId];
      if (!finish) continue;
      const [c, r] = key.split(',').map(Number) as Cell;
      const surface = surfaces.find((s) => (s.kind === 'floor' ? base.layers.floor : base.layers.walls)[r]?.[c] === s.legend);
      if (!surface) continue;
      let ch = letterOf.get(finish.tile);
      if (!ch) {
        ch = pool.shift();
        if (!ch) continue;
        letterOf.set(finish.tile, ch);
        legend[ch] = finish.tile;
      }
      const layer = surface.kind === 'floor' ? layers.floor : layers.walls;
      layer[r] = layer[r]!.slice(0, c) + ch + layer[r]!.slice(c + 1);
    }
    // A fita não cai onde ela entra no café, nas portas nem embaixo de móveis (essas células ficam livres).
    const blocked = new Set([base.spawn.player, ...(base.doors ?? []).map((d) => d.at)].map((c) => cellKey(c)));
    const { catalog, items } = this.content;
    for (const o of base.objects) { const def = catalog.tiles[o.tile]; if (def) for (const cell of cellsOf(o.at, def)) blocked.add(cellKey(cell)); }
    for (const p of this.state.placed) { const def = catalog.tiles[items[p.item]?.tile ?? '']; if (def) for (const cell of cellsOf(p.at, def)) blocked.add(cellKey(cell)); }
    const objects = isolatedCells(this.state.construction, base, this.state.day)
      .filter((cell) => !blocked.has(cellKey(cell)))
      .map(([c, r]) => ({ id: `obj.construction.${c}_${r}`, tile: this.content.construction.tapeTile, at: [c, r] as Cell }));
    // O cone (e a fita dos reparos) em volta dele, só onde ficar livre.
    for (const o of objects) blocked.add(cellKey(o.at));
    objects.push(...this.siteMarkerObjects(base, blocked));
    return { layers, legend, objects };
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
  /** Anota na lista de compras os ingredientes do cardápio que acabaram ou estão acabando. Devolve os anotados agora. */
  addMissingToShoppingList(): string[] {
    const menu = this.state.menu.map((id) => this.content.recipes[id]).filter((r): r is RecipeDef => !!r);
    const low = lowIngredients(menu, (id) => this.service.doses(id), this.content.service.shoppingListBelow);
    const added = low.filter((id) => !this.state.shoppingList.includes(id));
    this.state.shoppingList.push(...added);
    return added;
  }

  /** Risca um item da lista de compras (a jogadora tirou à mão). */
  removeFromShoppingList(itemId: string): void {
    this.state.shoppingList = this.state.shoppingList.filter((id) => id !== itemId);
  }

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
    const cells = cellsOf(at, def);
    const roomsOf = cells.map((c) => this.roomAt(c));
    if (roomsOf.some((r) => !r)) return 'out_of_bounds'; // fora do mapa, ou na parede entre cômodos
    if (roomsOf.some((r) => !isOpen(this.roomState(r!.id)))) return 'room_closed';
    const only = this.content.items[itemId]?.room;
    if (only && roomsOf.some((r) => r!.id !== only)) return 'wrong_room';
    // Porta no vão da parede divisória: a passagem e os dois lados. Porta na parede de cima (o jardim): ela (1x2)
    // e a célula da frente, por onde se passa.
    const walls = this.content.map.layers.walls;
    const doorCells = this.content.rooms.doors.flatMap((d): Cell[] => {
      const [c, r] = d.at;
      const inWall = (walls[r]?.[c] ?? '.') !== '.';
      return inWall ? [d.at, [c, r - 1], [c, r + 1]] : [d.at, [c - 1, r], [c + 1, r]];
    });
    if (cells.some(([c, r]) => doorCells.some(([dc, dr]) => dc === c && dr === r))) return 'blocks_door';
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

  // ---------- Assistência técnica: upgrade do móvel no lugar (src/core/upgrades.ts; data/items.json upgrades) ----------

  /** As peças em que este móvel pode virar (mesmo grupo, liberadas, que podem ficar naquele cômodo) e o preço de cada troca. */
  upgradeOptions(uid: string): { itemId: string; cost: number }[] {
    const p = this.state.placed.find((x) => x.uid === uid);
    if (!p) return [];
    const group = upgradeGroupOf(this.content.upgrades, p.item);
    if (!group) return [];
    const room = this.roomAt(p.at)?.id;
    return group.items
      .filter((id) => id !== p.item && this.itemUnlocked(id) && (!this.content.items[id]?.room || this.content.items[id]!.room === room))
      .map((id) => ({ itemId: id, cost: upgradeCost(this.content.upgrades, this.content.items, p.item, id) }));
  }

  /** Troca o móvel pela peça escolhida, no mesmo lugar (o que está em cima fica). Paga a diferença + o serviço. */
  upgradePlaced(uid: string, to: string): ActionResult {
    const p = this.state.placed.find((x) => x.uid === uid);
    if (!p) return { ok: false, reason: 'not_found' };
    const option = this.upgradeOptions(uid).find((o) => o.itemId === to);
    if (!option) return { ok: false, reason: 'no_upgrade' };
    if (this.state.money < option.cost) return { ok: false, reason: 'no_money' };
    if (option.cost > 0) this.addMoney(-option.cost, `upgrade:${to}`);
    // O que estava guardado no automático (ração, areia) volta para a mochila.
    if (p.stock && p.stockItem) this.state.inventory[p.stockItem] = (this.state.inventory[p.stockItem] ?? 0) + p.stock;
    delete p.refilledOn;
    delete p.stock;
    delete p.stockItem;
    const from = p.item;
    p.item = to;
    this.bus.emit('item.upgraded', { uid, from, to, cost: option.cost });
    this.advanceStory();
    return { ok: true };
  }

  /** Móvel da jogadora numa célula, se houver. */
  placedAt(cell: Cell) {
    return placedItemAt(this.content.catalog, this.state.placed, this.content.items, cell);
  }

  /** O móvel e o que está em cima dele (cafeteira no balcão...): vão juntos ao mover ou guardar. */
  movingGroup(uid: string): PlacedItem[] {
    const host = this.state.placed.find((p) => p.uid === uid);
    if (!host) return [];
    const riders = this.content.items[host.item]?.placeOn
      ? []
      : this.state.placed.filter((p) => p !== host && this.content.items[p.item]?.placeOn && p.at[0] === host.at[0] && p.at[1] === host.at[1]);
    return [host, ...riders];
  }

  /**
   * Por que o móvel (e o que vai com ele) não pode ir para `to` (ou null). Confere como se ele já tivesse saído do
   * lugar: a peça não "esbarra" nela mesma nem no que está em cima.
   */
  moveProblem(uid: string, to: Cell, reserved: readonly Cell[] = []): PlaceProblem | 'not_found' | null {
    const group = this.movingGroup(uid);
    if (group.length === 0) return 'not_found';
    const all = this.state.placed;
    this.state.placed = all.filter((p) => !group.includes(p));
    try {
      return this.checkPlacement(group[0]!.item, to, reserved);
    } finally {
      this.state.placed = all;
    }
  }

  /** Muda o móvel de lugar sem passar pela mochila: o que está em cima (e a louça no balcão) vai junto. */
  move(uid: string, to: Cell, reserved: readonly Cell[] = []): ActionResult {
    const problem = this.moveProblem(uid, to, reserved);
    if (problem) return { ok: false, reason: problem };
    const group = this.movingGroup(uid);
    const host = group[0]!;
    const [dc, dr] = [to[0] - host.at[0], to[1] - host.at[1]];
    const def = this.content.catalog.tiles[this.content.items[host.item]?.tile ?? ''];
    const cells = def ? cellsOf(host.at, def) : [host.at];
    // Louça e pedidos prontos em cima do balcão (atendimento) acompanham.
    for (const s of this.state.surfaces) if (cells.some(([c, r]) => c === s.at[0] && r === s.at[1])) s.at = [s.at[0] + dc, s.at[1] + dr];
    for (const p of group) p.at = [p.at[0] + dc, p.at[1] + dr];
    this.bus.emit('item.moved', { itemId: host.item, uid, at: [to[0], to[1]], carried: group.length - 1 });
    this.advanceStory();
    return { ok: true };
  }

  /** Guarda o móvel e o que está em cima dele na mochila (a louça do balcão não: precisa estar livre). */
  storePlaced(uid: string): ActionResult {
    const group = this.movingGroup(uid);
    if (group.length === 0) return { ok: false, reason: 'not_found' };
    const def = this.content.catalog.tiles[this.content.items[group[0]!.item]?.tile ?? ''];
    const cells = def ? cellsOf(group[0]!.at, def) : [group[0]!.at];
    if (this.state.surfaces.some((s) => cells.some(([c, r]) => c === s.at[0] && r === s.at[1]))) return { ok: false, reason: 'has_something_on_top' };
    for (const p of [...group].reverse()) {
      const r = this.pickUp(p.uid);
      if (!r.ok) return r;
    }
    return { ok: true };
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
    this.maybeStartFestivals();
    this.arrivals?.tick(); // (o construtor chama a história antes de criar o sistema)
    for (let guard = 0; guard < 1000; guard++) {
      if (this.advanceRooms()) continue;
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
    else if ('discoverRoom' in effect) this.discoverRoom(effect.discoverRoom);
    else if ('script' in effect) this.bus.emit('script.requested', { scriptId: effect.script });
    else if ('shelterCat' in effect) {
      this.shelterCat(effect.shelterCat);
    } else if ('makeSick' in effect) {
      this.makeSick(effect.makeSick);
    } else if ('giveItem' in effect) this.receiveItem(effect.giveItem);
    else if ('setFlag' in effect) this.state.flags[effect.setFlag] = true;
    else if ('addMoney' in effect) this.addMoney(effect.addMoney, 'story');
  }

  /**
   * Abriga um gato no café. Com a condição de chegada (data/cat_profiles.json), a saúde e a doença vêm dela; sem
   * ela (o gato da história), a saúde inicial e o arrivesSick dos dados. provisionalUntil: café cheio, com prazo.
   */
  shelterCat(catId: string, condition?: string, provisionalUntil?: number, treated = false): void {
    const def = this.catDef(catId);
    const profile = condition ? this.content.catProfiles.conditions[condition] : undefined;
    this.state.cats[catId] = {
      sheltered: true,
      // Debug (concluir marcos): já nomeado, para a caixa de nome não abrir no meio da fila.
      name: def?.name || (this.debugNaming ? this.suggestCatName(catId, 0) : ''),
      map: this.content.map.id,
      shelteredOn: this.state.day,
      health: profile?.health ?? this.content.health.start,
      sickness: null,
      happiness: this.content.health.care.start.happiness,
      hygiene: this.content.health.care.start.hygiene,
      ...(provisionalUntil !== undefined ? { provisionalUntil } : {}),
    };
    this.bus.emit('cat.sheltered', { catId });
    // Chega doente pela condição (ferido) ou pelos dados, a não ser que o vet já tenha cuidado na chegada.
    if (!treated && (profile ? profile.sick : def?.arrivesSick)) this.makeSick(catId);
  }

  /** Resposta da pergunta da chegada (ou do cartaz do mural): sim segue, não recusa. */
  answerArrival(yes: boolean): void {
    this.arrivals.answer(yes);
    this.advanceStory();
  }

  /** Ela escolheu ouvir a dica de um vizinho (etapa ask da chegada). */
  answerArrivalAsk(index: number): void {
    this.arrivals.answerAsk(index);
    this.advanceStory();
  }

  /** Algum marco exclusivo da história em andamento (as chegadas esperam a vez). */
  exclusiveActive(): boolean {
    return activeBeats(this.content.story, this.state, this.storyContext()).some((b) => b.exclusive);
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
