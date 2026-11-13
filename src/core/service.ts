// Atendimento do café: cardápio, pedidos, preparo nos equipamentos (em etapas), mãos e bandeja, itens pesados,
// gato no colo, louça e pia, clientes com preferências. Puro: sem Phaser, DOM ou window.
// O tempo é o relógio do jogo (minutos absolutos, nowAbs). A cena só desenha e chama as ações.
import { reviewReputation, reviewStars, type Waits } from './review';
import type { Condition, Content } from './content';
import type { EventBus } from './events';
import { cellsOf, solidGrid, type Cell, type MapData } from './map';
import { pickWeighted, type Rng } from './rng';
import { exclusive, onTray, speedFactor, vesselOf, type HandItem, type SurfaceItem } from './carry';
import { inSeason, VESSELS, type Quality, type RecipeDef, type RecipeStatus, type ServiceKind, type Vessel } from './recipes';
import { capacityOf, type CapacityView } from './capacity';
import { nowAbs, type DisplaySlot, type GameState, type PlacedItem } from './state';
import { parseClock } from './time';
import { festivalClosesCafe } from './festival';
import { isChristmas } from './secretSanta';
import { isHalloween } from './halloween';
import { seasonOf } from './calendar';
import { isOpenAt, nextOpening, scheduleProblem, weekdayOf, type Schedule, type ScheduleProblem, inLunch, lunchStart } from './schedule';
import { recordDoses, recordGaveUp, recordReview, recordServed } from './stats';
import type { GatheringDef } from './gatherings';

/** Cliente no café. `spot`: onde fica; `dishAt`: onde deixa a louça suja. */
export interface Customer {
  id: string;
  /** Índice do visual (service.json: customerLooks). */
  look: number;
  stage: 'queue' | 'waiting' | 'drinking';
  kind: ServiceKind;
  spot: Cell;
  dishAt: Cell;
  /** Pedido (null enquanto está na fila). */
  recipe: string | null;
  /** waiting: até quando espera; drinking: quando termina. */
  until: number;
  /** Preferências: uma receita favorita (pede mais) e gostar de premium (só dá gorjeta se for premium). */
  favorite: string | null;
  wantsPremium: boolean;
  /** Quanto da paciência gastou em pé (fila) e sentado (até ser atendido), de 0 a 1: entra na avaliação. */
  waits?: Waits;
}

/** Uma etapa sendo feita num equipamento posicionado. */
export interface Prep {
  stationUid: string;
  recipe: string;
  /** Índice da etapa (na receita). */
  step: number;
  quality: Quality;
  readyAt: number;
}

/** Pia: louça suja esperando e a lavagem em andamento. */
export interface SinkState {
  load: Record<Vessel, number>;
  washing: { readyAt: number; load: Record<Vessel, number> } | null;
}

export interface ServiceState {
  customers: Customer[];
  preps: Prep[];
  nextCustomerAt: number | null;
  nextCustomerId: number;
  /** Clientes atendidos (o total do jogo). */
  served: number;
  /** O almoço de hoje, travado quando começou (um por dia: mudar o almoço no app só vale amanhã). */
  lunch?: { day: number; from: number };
}

export function newServiceState(): ServiceState {
  return { customers: [], preps: [], nextCustomerAt: null, nextCustomerId: 1, served: 0 };
}

export const emptyLoad = (): Record<Vessel, number> => ({ cup: 0, glass: 0, plate: 0 });

export type ServiceProblem =
  | 'out_of_season'
  | 'display_full'
  | 'nothing_to_store'
  | 'display_empty'
  | 'not_unlocked'
  | 'menu_full'
  | 'hands_full'
  | 'hands_empty'
  | 'nothing_to_prepare'
  | 'equipment_locked'
  | 'equipment_off_menu'
  | 'extra_ready'
  | 'station_busy'
  | 'no_ingredients'
  | 'no_vessel'
  | 'cannot_put_here'
  | 'nothing_here'
  | 'wrong_order'
  | 'not_a_treat'
  | 'not_on_tray'
  | 'no_tray'
  | 'sink_full'
  | 'washer_full'
  | 'broken'
  | 'no_money'
  | 'not_at_home'
  | ScheduleProblem;

export type ServiceResult = { ok: true } | { ok: false; reason: ServiceProblem };

/** O que o atendimento precisa da sessão. */
export interface ServiceHost {
  state: GameState;
  content: Content;
  bus: EventBus;
  rng(): Rng;
  /** Mapa do café (com os móveis da jogadora). */
  homeMap(): MapData;
  /** Ela está no café? */
  atHome(): boolean;
  evaluate(c: Condition): boolean;
  addMoney(delta: number, reason: string): void;
  advanceStory(): void;
  catAffection(catId: string, points: number): void;
  /** Gatos doentes demais: nenhum cliente novo entra (data/health.json: customers). */
  customersAway(): boolean;
  /** Sujeira do salão agora (sujeiras visíveis e louça suja nas mesas): pesa na avaliação. */
  hallDirt(): number;
  addReputation(amount: number, reason: string): void;
  /** Célula da cadeira em que ela está sentada descansando (ou null): não é lugar livre para cliente. */
  playerSeat(): Cell | null;
  /** Clima de hoje (pesa no que os clientes pedem). */
  weather(): string;
  /** O encontro da estação de hoje, com o convite feito (fecha mais cedo; a procura de um dia de calor). */
  gatheringToday(): GatheringDef | undefined;
}

const near = (feet: readonly Cell[], at: Cell, reach = 1) => feet.some((f) => Math.max(Math.abs(f[0] - at[0]), Math.abs(f[1] - at[1])) <= reach);
const same = (a: Cell, b: Cell) => a[0] === b[0] && a[1] === b[1];
const loadCount = (load: Record<Vessel, number>) => VESSELS.reduce((n, v) => n + (load[v] ?? 0), 0);

export class CafeService {
  constructor(private h: ServiceHost) {}

  private get st(): GameState {
    return this.h.state;
  }
  private get cfg() {
    return this.h.content.service;
  }
  private get carry() {
    return this.h.content.carry;
  }
  private now(): number {
    return nowAbs(this.st);
  }
  private handsChanged(): void {
    this.h.bus.emit('hands.changed', { count: this.st.hands.length });
  }

  // ---------- Ingredientes (doses) ----------

  /** Doses disponíveis: pacotes fechados na despensa x rendimento + o que sobrou do pacote aberto. */
  doses(itemId: string): number {
    const servings = this.h.content.items[itemId]?.servings ?? 1;
    return (this.st.pantry[itemId] ?? 0) * servings + (this.st.pantryOpen[itemId] ?? 0);
  }

  /** Ingredientes ainda na mochila (comprados e não guardados): pacotes. */
  ingredientsInBag(): number {
    return Object.entries(this.st.inventory).filter(([id]) => this.isIngredient(id)).reduce((n, [, q]) => n + q, 0);
  }

  isIngredient(itemId: string): boolean {
    return !!this.h.content.items[itemId]?.tags.includes('ingredient');
  }

  /** Perto do armário da cozinha (despensa)? */
  /** A célula da ação de um móvel fixo (armário, pia): o móvel dela onde estiver, ou a célula dos dados. */
  private fixtureCell(role: 'pantry' | 'sink'): Cell {
    const f = this.cfg.fixtures?.find((x) => x.role === role);
    const p = f && this.st.placed.find((x) => x.item === f.item);
    return p ? [p.at[0] + f.use[0], p.at[1] + f.use[1]] : role === 'pantry' ? this.cfg.pantry : this.cfg.sink;
  }

  /** A célula da frente do armário da despensa (onde ele estiver). */
  pantryCell(): Cell {
    return this.fixtureCell('pantry');
  }

  /** A célula da pia (onde ela estiver). */
  sinkCell(): Cell {
    return this.fixtureCell('sink');
  }

  pantryNear(feet: readonly Cell[]): boolean {
    return near(feet, this.pantryCell());
  }

  /** Guarda na despensa os ingredientes da mochila (no café): todos, ou só os pacotes de `itemId`. */
  storeInPantry(itemId?: string): ServiceResult {
    if (!this.h.atHome()) return { ok: false, reason: 'not_at_home' };
    const moved = Object.entries(this.st.inventory).filter(([id, q]) => (!itemId || id === itemId) && this.isIngredient(id) && q > 0);
    if (moved.length === 0) return { ok: false, reason: 'nothing_here' };
    for (const [id, q] of moved) {
      this.st.pantry[id] = (this.st.pantry[id] ?? 0) + q;
      delete this.st.inventory[id];
    }
    this.h.bus.emit('pantry.stored', { count: moved.reduce((n, [, q]) => n + q, 0) });
    this.h.advanceStory();
    return { ok: true };
  }

  /** Ingredientes que a despensa já tem (pacote fechado ou aberto): os que o "empilhar" repõe. */
  private inPantry(itemId: string): boolean {
    return (this.st.pantry[itemId] ?? 0) > 0 || (this.st.pantryOpen[itemId] ?? 0) > 0;
  }

  /** Quanto o "empilhar" passaria agora da mochila para a despensa (pacotes). */
  pantryStackable(): number {
    return Object.entries(this.st.inventory).filter(([id]) => this.isIngredient(id) && this.inPantry(id)).reduce((n, [, q]) => n + q, 0);
  }

  /** Empilhar (como no Stardew Valley): da mochila para a despensa, só os ingredientes que ela já tem (repor). */
  stackInPantry(): ServiceResult {
    if (!this.h.atHome()) return { ok: false, reason: 'not_at_home' };
    const moved = Object.entries(this.st.inventory).filter(([id, q]) => q > 0 && this.isIngredient(id) && this.inPantry(id));
    if (moved.length === 0) return { ok: false, reason: 'nothing_here' };
    for (const [id, q] of moved) {
      this.st.pantry[id] = (this.st.pantry[id] ?? 0) + q;
      delete this.st.inventory[id];
    }
    this.h.bus.emit('pantry.stored', { count: moved.reduce((n, [, q]) => n + q, 0) });
    this.h.advanceStory();
    return { ok: true };
  }

  private useDoses(itemId: string, n: number): void {
    const servings = this.h.content.items[itemId]?.servings ?? 1;
    for (let i = 0; i < n; i++) {
      if ((this.st.pantryOpen[itemId] ?? 0) === 0) {
        // Abre um pacote novo (da despensa).
        const left = (this.st.pantry[itemId] ?? 0) - 1;
        if (left > 0) this.st.pantry[itemId] = left;
        else delete this.st.pantry[itemId];
        this.st.pantryOpen[itemId] = servings;
      }
      this.st.pantryOpen[itemId]! -= 1;
      if (this.st.pantryOpen[itemId] === 0) delete this.st.pantryOpen[itemId];
    }
    recordDoses(this.st.stats, itemId, n);
  }

  /** Dá para fazer com os ingredientes de agora? E sai premium (todas as trocas premium disponíveis)? */
  private ingredientsFor(r: RecipeDef): { ok: boolean; quality: Quality; use: [string, number][] } {
    const subs = r.premium ?? {};
    const canPremium = Object.keys(subs).length > 0 && Object.entries(r.ingredients).every(([item, n]) => this.doses(subs[item] ?? item) >= n);
    if (canPremium) return { ok: true, quality: 'premium', use: Object.entries(r.ingredients).map(([item, n]) => [subs[item] ?? item, n]) };
    // Simples: cada ingrediente pode vir do normal ou, se faltar, da troca premium.
    const use: [string, number][] = [];
    for (const [item, n] of Object.entries(r.ingredients)) {
      if (this.doses(item) >= n) use.push([item, n]);
      else if (subs[item] && this.doses(subs[item]!) >= n) use.push([subs[item]!, n]);
      else return { ok: false, quality: 'simple', use: [] };
    }
    return { ok: true, quality: 'simple', use };
  }

  /** Ingredientes do jeito alternativo (receita.alternative): todos precisam ter doses, e sai sempre premium. */
  private alternativeIngredients(r: RecipeDef): { ok: boolean; quality: Quality; use: [string, number][] } {
    const use = Object.entries(r.alternative?.ingredients ?? {});
    const ok = use.length > 0 && use.every(([item, n]) => this.doses(item) >= n);
    return { ok, quality: 'premium', use: ok ? use : [] };
  }

  /** Ingredientes para começar a receita neste equipamento (o alternativo ou o normal). */
  private ingredientsAt(r: RecipeDef, equipment: string): { ok: boolean; quality: Quality; use: [string, number][] } {
    return r.alternative?.equipment === equipment ? this.alternativeIngredients(r) : this.ingredientsFor(r);
  }

  /** A receita começa neste equipamento (pela primeira etapa ou pelo jeito alternativo)? */
  private startsAt(r: RecipeDef | undefined, equipment: string): boolean {
    return !!r && (r.steps[0]?.equipment === equipment || r.alternative?.equipment === equipment);
  }

  // ---------- Estações (cardápio) ----------

  /** A receita está na época hoje? */
  inSeasonNow(r: RecipeDef): boolean {
    return inSeason(r, this.h.content.seasons, this.st.day);
  }

  /** Peso da receita no sorteio do pedido: a temperatura dela na estação e no clima de hoje (o resto pesa 1). */
  demandWeight(r: RecipeDef): number {
    if (!r.temp) return 1;
    const d = this.cfg.demand;
    const season = seasonOf(this.h.content.seasons, this.st.day);
    // Dia de encontro com procura (a noite do sorvete: gelados em dobro).
    const g = this.h.gatheringToday()?.prep?.demand;
    const extra = g && g.temp === r.temp ? g.multiplier : 1;
    return (d?.seasons?.[season]?.[r.temp] ?? 1) * (d?.weather?.[this.h.weather()]?.[r.temp] ?? 1) * extra;
  }

  /**
   * Começo do dia: tira do quadro o que saiu de época e diz o que chegou (destrancado, na época hoje e não ontem).
   * `yesterday`: o dia anterior (para comparar).
   */
  seasonalMenu(yesterday: number): { arrived: string[]; left: string[] } {
    const seasons = this.h.content.seasons;
    const unlocked = Object.values(this.h.content.recipes).filter((r) => !r.unlock || this.h.evaluate(r.unlock));
    const arrived = unlocked.filter((r) => inSeason(r, seasons, this.st.day) && !inSeason(r, seasons, yesterday)).map((r) => r.id);
    const left = this.st.menu.filter((id) => {
      const r = this.recipe(id);
      return !!r && !inSeason(r, seasons, this.st.day);
    });
    if (left.length > 0) {
      this.st.menu = this.st.menu.filter((id) => !left.includes(id));
      this.h.bus.emit('menu.changed', { menu: [...this.st.menu] });
    }
    return { arrived, left };
  }

  // ---------- Vitrine (confeitaria) ----------

  /** Vitrines posicionadas (móveis com display). */
  displaysPlaced(): PlacedItem[] {
    return this.st.placed.filter((p) => this.h.content.items[p.item]?.display);
  }

  /** O que está guardado nesta vitrine. */
  displayStock(uid: string): readonly DisplaySlot[] {
    return this.st.displays[uid] ?? [];
  }

  /** Quantas fatias (ou doces) desta receita estão nas vitrines. */
  displayPortions(recipe: string): number {
    return Object.values(this.st.displays).reduce((n, slots) => n + slots.filter((s) => s.recipe === recipe).reduce((a, s) => a + s.portions, 0), 0);
  }

  /** Este objeto da mão vai para a vitrine? (um doce pronto ou um bolo inteiro) */
  storable(h: HandItem): boolean {
    return h.kind === 'cake' || (h.kind === 'drink' && !!this.recipe(h.recipe)?.display);
  }

  /** Guarda na vitrine o doce (ou o bolo inteiro) da mão. O prato do doce volta limpo para o estoque. */
  storeInDisplay(uid: string): ServiceResult {
    const def = this.h.content.items[this.st.placed.find((p) => p.uid === uid)?.item ?? '']?.display;
    if (!def) return { ok: false, reason: 'nothing_here' };
    const i = this.st.hands.findIndex((h) => this.storable(h));
    if (i < 0) return { ok: false, reason: 'nothing_to_store' };
    const slots = (this.st.displays[uid] ??= []);
    if (slots.length >= def.slots) return { ok: false, reason: 'display_full' };
    const [h] = this.st.hands.splice(i, 1);
    if (h!.kind === 'cake') slots.push({ recipe: h!.recipe, portions: h!.portions, ...(h!.quality === 'premium' ? { quality: 'premium' as const } : {}) });
    else if (h!.kind === 'drink') {
      this.st.dishes[h!.vessel] = (this.st.dishes[h!.vessel] ?? 0) + 1;
      slots.push({ recipe: h!.recipe, portions: 1, ...(h!.quality === 'premium' ? { quality: 'premium' as const } : {}) });
    }
    this.h.bus.emit('display.stored', { uid, recipeId: h!.kind === 'cake' || h!.kind === 'drink' ? h!.recipe : '' });
    this.handsChanged();
    return { ok: true };
  }

  /** Tira da vitrine um doce (ou uma fatia do bolo do espaço `index`), num prato limpo. */
  takeFromDisplay(uid: string, index: number): ServiceResult {
    const slots = this.st.displays[uid] ?? [];
    const slot = slots[index];
    if (!slot) return { ok: false, reason: 'display_empty' };
    const r = this.recipe(slot.recipe);
    if (!r) return { ok: false, reason: 'nothing_here' };
    const item: HandItem = { kind: 'drink', recipe: r.id, vessel: r.vessel, ...(slot.quality ? { quality: slot.quality } : {}) };
    const problem = this.canHold(item);
    if (problem) return { ok: false, reason: problem };
    if (this.cleanFree(r.vessel) < 1) return { ok: false, reason: 'no_vessel' };
    this.st.dishes[r.vessel] = (this.st.dishes[r.vessel] ?? 0) - 1;
    this.st.hands.push(item);
    slot.portions -= 1;
    if (slot.portions <= 0) slots.splice(index, 1);
    if (slots.length === 0) delete this.st.displays[uid];
    this.h.bus.emit('display.taken', { uid, recipeId: r.id });
    this.handsChanged();
    return { ok: true };
  }

  // ---------- Equipamentos e louça ----------

  /** Móveis posicionados que fazem o papel deste equipamento. */
  stationsFor(equipment: string): { uid: string; at: Cell; cells: Cell[] }[] {
    const tag = this.cfg.equipment[equipment]?.tag;
    if (!tag) return [];
    return this.st.placed
      .filter((p) => this.h.content.items[p.item]?.tags.includes(tag))
      .map((p) => ({ uid: p.uid, at: p.at, cells: this.cellsOfPlaced(p.item, p.at) }));
  }

  /** Todos os equipamentos posicionados. */
  allStations(): { uid: string; at: Cell; cells: Cell[] }[] {
    return Object.keys(this.cfg.equipment).flatMap((eq) => this.stationsFor(eq));
  }

  private cellsOfPlaced(itemId: string, at: Cell): Cell[] {
    const def = this.h.content.catalog.tiles[this.h.content.items[itemId]?.tile ?? ''];
    return def ? cellsOf(at, def) : [at];
  }

  /** Equipamento de um móvel posicionado (ou undefined). */
  equipmentOf(stationUid: string): string | undefined {
    const placed = this.st.placed.find((p) => p.uid === stationUid);
    const tags = placed ? this.h.content.items[placed.item]?.tags ?? [] : [];
    return Object.entries(this.cfg.equipment).find(([, eq]) => tags.includes(eq.tag))?.[0];
  }

  /** Massa entre etapas e preparos em andamento já separam uma louça limpa para o fim. */
  private reserved(v: Vessel): number {
    const uses = (id: string) => this.recipe(id)?.vessel === v && !this.recipe(id)?.batch;
    const wips = [...this.st.hands, ...this.st.surfaces.map((s) => s.item)].filter((i) => i.kind === 'wip' && uses(i.recipe));
    return this.st.service.preps.filter((p) => uses(p.recipe)).length + wips.length;
  }

  /** Louça limpa que ainda não está separada para um preparo. */
  cleanFree(v: Vessel): number {
    return (this.st.dishes[v] ?? 0) - this.reserved(v);
  }

  /** Louça suja espalhada (mãos, superfícies e esperando na pia). */
  dirtyCount(): number {
    const all = [...this.st.hands, ...this.st.surfaces.map((s) => s.item)];
    const washers = Object.values(this.st.washers).reduce((n, w) => n + loadCount(w.load) + loadCount(w.washing?.load ?? emptyLoad()), 0);
    return all.filter((i) => i.kind === 'dirty').length + loadCount(this.st.sink.load) + loadCount(this.st.sink.washing?.load ?? emptyLoad()) + washers;
  }

  /**
   * O presente da Gabi (ou outro item com "dishes") entra no estoque de louça limpa, uma vez. A louça comprada (preço
   * maior que 0: os pacotes do Market) entra a cada pacote: sai da mochila e soma no estoque.
   */
  stockDishes(itemId: string): void {
    const item = this.h.content.items[itemId];
    const dishes = item?.dishes;
    if (!dishes) return;
    if (item.price > 0) {
      const n = this.st.inventory[itemId] ?? 0;
      if (n <= 0) return;
      for (const v of VESSELS) this.st.dishes[v] = (this.st.dishes[v] ?? 0) + n * (dishes[v] ?? 0);
      delete this.st.inventory[itemId];
      this.h.bus.emit('dishes.added', { itemId, count: n });
      return;
    }
    if (this.st.flags[`dishes.stocked.${itemId}`]) return;
    for (const v of VESSELS) this.st.dishes[v] = (this.st.dishes[v] ?? 0) + (dishes[v] ?? 0);
    this.st.flags[`dishes.stocked.${itemId}`] = true;
  }

  // ---------- Receitas e cardápio ----------

  recipe(id: string): RecipeDef | undefined {
    return this.h.content.recipes[id];
  }

  recipeStatus(id: string): RecipeStatus {
    const r = this.recipe(id);
    if (!r || (r.unlock && !this.h.evaluate(r.unlock))) return 'locked';
    if (!this.inSeasonNow(r)) return 'season';
    if (r.display && this.displaysPlaced().length === 0) return 'equipment';
    // Já tem na vitrine: serve a fatia (ou o doce) sem preparar.
    if (r.display && this.displayPortions(r.id) > 0) return this.cleanFree(r.vessel) < 1 ? 'vessel' : 'available';
    // Dois jeitos (receita.alternative): basta um ter os equipamentos e, com eles, os ingredientes.
    const normal = r.steps.every((s) => this.stationsFor(s.equipment).length > 0);
    const alt = !!r.alternative && this.stationsFor(r.alternative.equipment).length > 0;
    if (!normal && !alt) return 'equipment';
    if (!(normal && this.ingredientsFor(r).ok) && !(alt && this.alternativeIngredients(r).ok)) return 'ingredients';
    if (this.cleanFree(r.vessel) < 1) return 'vessel';
    return 'available';
  }

  /** Primeiro equipamento que falta para a receita (para o quadro dizer qual). */
  missingEquipment(id: string): string | undefined {
    const r = this.recipe(id);
    if (r?.display && this.displaysPlaced().length === 0) return 'display';
    if (r?.alternative && this.stationsFor(r.alternative.equipment).length > 0) return undefined;
    return r?.steps.find((s) => this.stationsFor(s.equipment).length === 0)?.equipment;
  }

  unlockedRecipes(): RecipeDef[] {
    return Object.values(this.h.content.recipes).filter((r) => this.recipeStatus(r.id) !== 'locked');
  }

  /** Põe ou tira uma receita do quadro. */
  toggleMenu(recipeId: string): ServiceResult {
    if (this.st.menu.includes(recipeId)) {
      this.st.menu = this.st.menu.filter((id) => id !== recipeId);
    } else {
      const status = this.recipeStatus(recipeId);
      if (status === 'locked') return { ok: false, reason: 'not_unlocked' };
      if (status === 'season') return { ok: false, reason: 'out_of_season' };
      if (this.st.menu.length >= this.cfg.menuSlots) return { ok: false, reason: 'menu_full' };
      this.st.menu.push(recipeId);
    }
    this.h.bus.emit('menu.changed', { menu: [...this.st.menu] });
    this.h.advanceStory();
    return { ok: true };
  }

  /** Receitas do quadro que dá para pedir agora (as outras aparecem como esgotadas). */
  orderable(): RecipeDef[] {
    return this.st.menu.filter((id) => this.recipeStatus(id) === 'available').map((id) => this.recipe(id)!);
  }

  /** Preço de um pedido na qualidade em que sai. */
  priceOf(recipeId: string, quality: Quality = 'simple'): number {
    const base = this.recipe(recipeId)?.price ?? 0;
    return quality === 'premium' ? Math.round(base * this.cfg.premiumPriceMultiplier) : base;
  }

  // ---------- Capacidade e lugares ----------

  /** Já tem tantos clientes atendidos (fora da fila) quanto cabem? */
  private isFull(): boolean {
    return this.st.service.customers.filter((c) => c.stage !== 'queue').length >= this.capacity().total;
  }

  /** Esta receita pode ser servida neste tipo de lugar? (pela louça: service.json, servedAt) */
  servesAt(r: RecipeDef, kind: ServiceKind): boolean {
    return this.cfg.servedAt[r.vessel]?.includes(kind) ?? false;
  }

  /**
   * Quantos clientes cabem agora e de que forma: lugares (em pé e assentos) e louça que não está suja
   * (limpa + já servida), contadas por tipo. Só conta a louça que as receitas do quadro usam.
   */
  capacity(): CapacityView {
    const vessels: Record<Vessel, number> = { cup: 0, glass: 0, plate: 0 };
    for (const v of VESSELS) vessels[v] = this.st.dishes[v] ?? 0;
    for (const i of [...this.st.hands, ...this.st.surfaces.map((s) => s.item)]) if (i.kind === 'drink') vessels[i.vessel] += 1;
    for (const c of this.st.service.customers) {
      const v = c.stage === 'drinking' ? this.recipe(c.recipe ?? '')?.vessel : undefined;
      if (v) vessels[v] += 1;
    }
    const spots = this.spots();
    return capacityOf({
      vessels,
      standingSpots: spots.filter((s) => s.kind === 'standing').length,
      seats: spots.filter((s) => s.kind === 'table').length,
      servedAt: this.cfg.servedAt,
      // Louça das receitas do quadro (esgotar ingrediente não muda a capacidade); quadro vazio: toda a louça.
      menuVessels: new Set(this.st.menu.length > 0 ? this.st.menu.flatMap((id) => this.recipe(id)?.vessel ?? []) : VESSELS),
    });
  }

  /** Lugares de atendimento: em pé na frente do balcão; sentado numa cadeira ao lado de uma mesa. */
  spots(): { kind: ServiceKind; spot: Cell; dishAt: Cell }[] {
    const map = this.h.homeMap();
    const solid = solidGrid(map, this.h.content.catalog);
    const free = ([c, r]: Cell) => r >= 0 && c >= 0 && r < solid.length && c < solid[0]!.length && !solid[r]![c];
    const items = this.h.content.items;
    const withTag = (tag: string) => this.st.placed.filter((p) => items[p.item]?.tags.includes(tag));
    const out: { kind: ServiceKind; spot: Cell; dishAt: Cell }[] = [];
    const busyCounters = new Set(this.st.placed.filter((p) => items[p.item]?.placeOn).map((p) => `${p.at[0]},${p.at[1]}`));
    for (const p of withTag(this.cfg.standingTag)) {
      for (const [c, r] of this.cellsOfPlaced(p.item, p.at)) {
        if (busyCounters.has(`${c},${r}`)) continue;
        const below: Cell = [c, r + 1];
        if (free(below)) out.push({ kind: 'standing', spot: below, dishAt: [c, r] });
      }
    }
    // Mesa com algo em cima (um vaso): a bebida não tem onde ficar; aquela célula não serve de mesa.
    const tables = withTag(this.cfg.tableTag).flatMap((p) => this.cellsOfPlaced(p.item, p.at)).filter(([c, r]) => !busyCounters.has(`${c},${r}`));
    for (const chair of withTag(this.cfg.chairTag)) {
      const [c, r] = chair.at;
      const table = tables.find(([tc, tr]) => Math.abs(tc - c) + Math.abs(tr - r) === 1);
      if (table) out.push({ kind: 'table', spot: [c, r], dishAt: table });
    }
    return out;
  }

  private freeSpots(): { kind: ServiceKind; spot: Cell; dishAt: Cell }[] {
    const taken = this.st.service.customers.filter((c) => c.stage !== 'queue').map((c) => c.spot);
    const mine = this.h.playerSeat();
    if (mine) taken.push(mine);
    return this.spots().filter((s) => !taken.some((t) => same(t, s.spot)));
  }

  /** Um lugar livre que tenha pedido possível (em pé ou na mesa). */
  private usableSpot(): { kind: ServiceKind; spot: Cell; dishAt: Cell } | undefined {
    const recipes = this.orderable();
    return this.freeSpots().find((s) => recipes.some((r) => this.servesAt(r, s.kind)));
  }

  /**
   * Por que nenhum cliente novo entra, com o café aberto: quadro vazio ou tudo do quadro esgotado (o motivo mais
   * comum entre as receitas: louça, ingrediente ou equipamento). null = está entrando gente normalmente.
   */
  arrivalsBlocked(): 'empty_menu' | 'vessel' | 'ingredients' | 'equipment' | null {
    if (!this.isOpen()) return null;
    if (this.st.menu.length === 0) return 'empty_menu';
    if (this.orderable().length > 0) return null;
    const statuses = this.st.menu.map((id) => this.recipeStatus(id));
    return (['vessel', 'ingredients', 'equipment'] as const).find((st) => statuses.includes(st)) ?? 'equipment';
  }

  /** O atendimento já existe (marco/condição dos dados), aberto ou não agora. */
  enabled(): boolean {
    return this.h.evaluate(this.cfg.enabledWhen);
  }

  /** O atendimento está funcionando agora (marco/condição dos dados + horário escolhido)? */
  isOpen(): boolean {
    // A placa de um evento (feira de adoção, Dia do Gato...) na porta: hoje o atendimento não abre.
    if (festivalClosesCafe(this.st.festivals, this.h.content.festivals, this.st.day)) return false;
    // Natal: fecha mais cedo (data/festive.json: secretSanta.closeAt).
    const xmas = this.h.content.festive.secretSanta;
    if (isChristmas(this.h.content.seasons, xmas, this.st.day) && this.st.time >= parseClock(xmas.closeAt)) return false;
    // Noite das Abóboras: fecha mais cedo (data/festive.json: halloween.closeAt).
    const hw = this.h.content.festive.halloween;
    if (isHalloween(this.h.content.seasons, hw, this.st.day) && this.st.time >= parseClock(hw.closeAt)) return false;
    // Encontro da estação (piquenique, noite do sorvete): fecha mais cedo (data/festive.json: gatherings).
    const g = this.h.gatheringToday();
    if (g && this.st.time >= parseClock(g.closeAt)) return false;
    return this.enabled() && isOpenAt(this.schedule(), this.weekday(), this.st.time);
  }

  /** Hora do almoço agora (com o café aberto): não chega cliente novo; quem está na fila e quem já pediu termina, com a paciência parada. */
  lunchNow(): boolean {
    // Almoço desligado no app: acaba na hora (encurtar não é vantagem).
    if (!this.isOpen() || lunchStart(this.schedule(), this.cfg.schedule) === null) return false;
    const sv = this.st.service;
    const t = ((this.st.time % 1440) + 1440) % 1440;
    // Um almoço por dia: o de hoje já começou (e vale até o fim), mesmo que o horário tenha mudado depois.
    if (sv.lunch?.day === this.st.day) return t >= sv.lunch.from && t < sv.lunch.from + this.cfg.schedule.lunchMinutes;
    if (!inLunch(this.schedule(), this.cfg.schedule, this.st.time)) return false;
    sv.lunch = { day: this.st.day, from: parseClock(lunchStart(this.schedule(), this.cfg.schedule)!) };
    return true;
  }

  // ---------- Horário de funcionamento ----------

  /** O horário que vale: o escolhido (se ainda vale pelas regras) ou o padrão dos dados. */
  schedule(): Schedule {
    const s = this.st.schedule;
    return s && !scheduleProblem(s, this.cfg.schedule) ? s : this.cfg.schedule.default;
  }

  /** O atendimento abre neste dia do jogo (liberado, dia aberto no horário e sem evento fechando o café)? */
  opensOn(day: number): boolean {
    if (festivalClosesCafe(this.st.festivals, this.h.content.festivals, day)) return false;
    return this.enabled() && this.schedule().days[this.weekday(day)] === true;
  }

  /** Dia da semana de hoje (0 = segunda). */
  weekday(day = this.st.day): number {
    return weekdayOf(day, this.h.content.seasons.startWeekday);
  }

  /** Muda o horário (app "Horário"). Fechar mais cedo vale já: quem está na fila vai embora no próximo minuto. */
  setSchedule(s: Schedule): ServiceResult {
    const problem = scheduleProblem(s, this.cfg.schedule);
    if (problem) return { ok: false, reason: problem };
    this.st.schedule = { days: [...s.days], open: s.open, close: s.close, ...(s.lunch !== undefined ? { lunch: s.lunch } : {}) };
    this.h.bus.emit('schedule.changed', { schedule: this.st.schedule });
    return { ok: true };
  }

  /** Próxima abertura (dia do jogo e hora), quando está fechado agora. */
  nextOpening(): { day: number; open: string } | null {
    return nextOpening(this.schedule(), this.st.day, this.st.time, this.h.content.seasons.startWeekday);
  }

  // ---------- Relógio ----------

  /**
   * Ela está em frente à pia? A cena avisa a cada quadro. Lavar na pia é à mão: fora dela, a lavagem pausa (a
   * lava-louças lava sozinha). Padrão true (sem cena, como nos testes, a pia lava direto).
   */
  private sinkAttended = true;
  /** Minuto do último tick, para saber quanto tempo a lavagem ficou pausada. */
  private lastTickAt: number | null = null;

  setSinkAttended(attended: boolean): void {
    if (attended === this.sinkAttended) return;
    this.sinkAttended = attended;
    // Avisa (o balão do subconsciente troca "lavando" por "parada") só se há lavagem em andamento.
    if (this.st.sink.washing) this.h.bus.emit('sink.paused', { paused: !attended });
  }

  /** Lavando na pia, mas pausado (ela saiu da frente da pia). */
  sinkPaused(): boolean {
    return !!this.st.sink.washing && !this.sinkAttended;
  }

  /** A cada minuto de jogo: etapas ficam prontas, a pia lava, clientes esperam/consomem/vão embora, chegam novos. */
  tick(): void {
    const now = this.now();
    const passed = this.lastTickAt === null ? 0 : Math.max(0, now - this.lastTickAt);
    this.lastTickAt = now;
    const sv = this.st.service;
    // Almoço: a paciência de quem espera (na fila ou pelo pedido) fica parada; quem está consumindo segue.
    if (this.lunchNow()) for (const c of sv.customers) if (c.stage === 'queue' || c.stage === 'waiting') c.until += passed;
    // Etapas prontas: aparecem no equipamento (a última vira o pedido; as outras, massa para a próxima etapa).
    for (const prep of [...sv.preps]) {
      if (prep.readyAt > now) continue;
      const station = this.st.placed.find((p) => p.uid === prep.stationUid);
      const r = this.recipe(prep.recipe);
      if (!station || !r) {
        sv.preps = sv.preps.filter((p) => p !== prep);
        continue;
      }
      if (this.surfaceAt(station.at)) continue; // equipamento ocupado: espera tirarem o que está nele
      sv.preps = sv.preps.filter((p) => p !== prep);
      const last = prep.step >= r.steps.length - 1;
      if (last && r.batch) {
        this.st.surfaces.push({ at: [...station.at], item: { kind: 'cake', recipe: r.id, portions: r.batch.yields, quality: prep.quality } });
      } else if (last) {
        this.st.dishes[r.vessel] = (this.st.dishes[r.vessel] ?? 0) - 1;
        this.st.surfaces.push({ at: [...station.at], item: { kind: 'drink', recipe: r.id, vessel: r.vessel, quality: prep.quality } });
      } else {
        this.st.surfaces.push({ at: [...station.at], item: { kind: 'wip', recipe: r.id, step: prep.step + 1, quality: prep.quality } });
      }
      this.h.bus.emit('prep.ready', { stationUid: station.uid, recipeId: r.id, final: last });
    }
    // Pia: só lava com ela em frente; fora, o fim da lavagem anda junto com o relógio (pausa).
    const washing = this.st.sink.washing;
    if (washing && !this.sinkAttended) washing.readyAt += passed;
    if (washing && washing.readyAt <= now) {
      for (const v of VESSELS) this.st.dishes[v] = (this.st.dishes[v] ?? 0) + (washing.load[v] ?? 0);
      this.st.sink.washing = null;
      this.h.bus.emit('dish.washed', { count: loadCount(washing.load) });
    }
    // Consertos do Tião que terminaram: volta a funcionar, com o contador do zero e outro limite sorteado.
    const cfgBreak = this.cfg.breakdown;
    for (const [uid, w] of Object.entries(this.st.wear)) {
      if (w.repairUntil === undefined || w.repairUntil > now || !cfgBreak) continue;
      this.st.wear[uid] = { uses: 0, breaksAt: this.h.rng().int(cfgBreak.minUses, cfgBreak.maxUses) };
      this.h.bus.emit('equipment.repaired', { uid, itemId: this.itemOf(uid) });
    }
    // Lava-louças.
    for (const [uid, w] of Object.entries(this.st.washers)) {
      if (!w.washing || w.washing.readyAt > now) continue;
      for (const v of VESSELS) this.st.dishes[v] = (this.st.dishes[v] ?? 0) + (w.washing.load[v] ?? 0);
      const count = loadCount(w.washing.load);
      w.washing = null;
      this.h.bus.emit('dish.washed', { count });
      this.h.bus.emit('washer.changed', { uid, load: loadCount(w.load), washing: false });
    }
    // Clientes.
    for (const c of [...sv.customers]) {
      if ((c.stage === 'waiting' || c.stage === 'queue') && now >= c.until) this.leave(c, false, true);
      else if (c.stage === 'drinking' && now >= c.until) {
        // Avalia antes de deixar a xícara: a louça dele não conta como sujeira na nota dele.
        this.leave(c, true, true);
        this.leaveDish(c);
      }
    }
    // Fechou: quem estava na fila vai embora (sem bronca: o café fechou). Quem já está no lugar termina.
    if (!this.isOpen()) for (const c of sv.customers.filter((x) => x.stage === 'queue')) this.leave(c, true);
    // Fila: quem esperava ganha um lugar livre (se ainda cabe gente: lugares e louça).
    for (const c of sv.customers.filter((x) => x.stage === 'queue')) {
      const spot = this.isFull() ? undefined : this.usableSpot();
      if (!spot) break;
      this.seat(c, spot);
    }
    this.maybeSpawn(now);
  }

  private maybeSpawn(now: number): void {
    const sv = this.st.service;
    if (!this.isOpen()) return;
    // Almoço: por uma hora, ninguém novo chega (a fila e quem já pediu continuam, sem perder a paciência).
    if (this.lunchNow()) return;
    // Prejuízo: com gatos doentes demais, as pessoas não querem entrar (quem já está fica até o fim).
    if (this.h.customersAway()) return;
    if (sv.nextCustomerAt === null) sv.nextCustomerAt = now + this.cfg.firstArrivalMinutes;
    if (now < sv.nextCustomerAt) return;
    if (this.orderable().length === 0) return;
    // Lotado (lugares ou louça): quem chega espera na fila, se tiver vaga nela.
    const spot = this.isFull() ? undefined : this.usableSpot();
    const queueFree = this.cfg.queue.filter((q) => !sv.customers.some((c) => c.stage === 'queue' && same(c.spot, q)));
    if (!spot && queueFree.length === 0) return;
    const rng = this.h.rng();
    const pref = this.cfg.preferences;
    const start = queueFree[0] ?? this.cfg.queue[0]!;
    const c: Customer = {
      id: `c${sv.nextCustomerId++}`,
      look: rng.int(0, this.cfg.customerLooks.length - 1),
      stage: 'queue',
      kind: 'standing',
      spot: [...start],
      dishAt: [...start],
      recipe: null,
      until: now + this.cfg.patienceMinutes,
      favorite: rng.chance(pref.favoriteChance) && this.st.menu.length > 0 ? this.st.menu[rng.int(0, this.st.menu.length - 1)]! : null,
      wantsPremium: rng.chance(pref.premiumLoverChance),
    };
    sv.customers.push(c);
    if (spot) this.seat(c, spot);
    else this.h.bus.emit('customer.arrived', { customerId: c.id, recipeId: null });
    const [a, b] = this.cfg.arrivalEveryMinutes;
    sv.nextCustomerAt = now + rng.int(a, b);
  }

  /** Vai para o lugar e faz o pedido (do quadro, que dá para fazer, do tipo do lugar; o favorito pesa mais). */
  private seat(c: Customer, spot: { kind: ServiceKind; spot: Cell; dishAt: Cell }): void {
    const options = this.orderable().filter((r) => this.servesAt(r, spot.kind));
    if (options.length === 0) return;
    const rng = this.h.rng();
    const favorite = options.find((r) => r.id === c.favorite);
    const queued = c.stage === 'queue' ? this.used(c) : 0;
    c.waits = { queue: queued, seated: 0 };
    c.stage = 'waiting';
    c.kind = spot.kind;
    c.spot = [...spot.spot];
    c.dishAt = [...spot.dishAt];
    // O favorito pesa mais; o resto, pela procura do momento (quente no inverno e na chuva, gelado no verão).
    c.recipe = favorite && rng.chance(this.cfg.preferences.favoriteWeight) ? favorite.id : pickWeighted(rng, Object.fromEntries(options.map((r) => [r.id, this.demandWeight(r)])));
    c.until = this.now() + this.cfg.patienceMinutes;
    this.h.bus.emit('customer.arrived', { customerId: c.id, recipeId: c.recipe });
  }

  private leaveDish(c: Customer): void {
    const vessel = this.recipe(c.recipe ?? '')?.vessel;
    if (!vessel) return;
    const at = [c.dishAt, c.spot].find((cell) => !this.surfaceAt(cell)) ?? c.spot;
    this.st.surfaces.push({ at: [...at], item: { kind: 'dirty', vessel } });
  }

  /** Quanto da paciência da etapa atual ele já gastou (0 a 1). */
  private used(c: Customer): number {
    return Math.max(0, Math.min(1, 1 - (c.until - this.now()) / this.cfg.patienceMinutes));
  }

  /**
   * Vai embora. `review`: avalia (1 a 5 estrelas, src/core/review.ts) e a nota vira reputação; quem desiste (`happy`
   * false) dá a nota de desistência. Sem avaliação: o café fechou com ele na fila.
   */
  private leave(c: Customer, happy: boolean, review = false): void {
    this.st.service.customers = this.st.service.customers.filter((x) => x !== c);
    if (!review) {
      this.h.bus.emit('customer.left', { customerId: c.id, happy });
      return;
    }
    // Desistiu (a paciência acabou): conta nas estatísticas e quebra a sequência "ninguém sai de mãos vazias".
    if (!happy) recordGaveUp(this.st.stats);
    const cfg = this.cfg.review;
    const stars = reviewStars(cfg, c.waits ?? { queue: 0, seated: 0 }, this.h.hallDirt(), !happy);
    recordReview(this.st.stats, stars);
    const reputation = reviewReputation(cfg, stars);
    if (reputation !== 0) this.h.addReputation(reputation, `review:${stars}`);
    this.h.bus.emit('customer.left', { customerId: c.id, happy, stars, reputation });
  }

  /** Fim do dia: clientes vão embora (a louça em uso volta limpa), preparos param, o saco vai para o estoque e o gato fica em casa. */
  endOfDay(): void {
    const sv = this.st.service;
    for (const c of sv.customers) {
      const v = c.stage === 'drinking' ? this.recipe(c.recipe ?? '')?.vessel : undefined;
      if (v) this.st.dishes[v] = (this.st.dishes[v] ?? 0) + 1;
    }
    sv.customers = [];
    sv.preps = [];
    sv.nextCustomerAt = null;
    this.st.hands = this.st.hands.filter((x) => !exclusive(x));
  }

  // ---------- Ações da personagem ----------

  surfaceAt(at: Cell): SurfaceItem | undefined {
    return this.st.surfaces.find((s) => same(s.at, at));
  }

  /**
   * No equipamento: se ela traz a massa da etapa anterior, começa a próxima etapa; senão, começa a primeira etapa
   * do pedido mais antigo que este equipamento sabe começar e que ninguém está fazendo. Sem pedido, faz `extra`
   * (uma receita do cardápio que ela escolheu), se o equipamento ainda não tem um item sem dono.
   */
  prepare(stationUid: string, extra?: string): ServiceResult {
    const equipment = this.equipmentOf(stationUid);
    const sv = this.st.service;
    if (!equipment) return { ok: false, reason: 'nothing_to_prepare' };
    if (this.isBroken(stationUid)) return { ok: false, reason: 'broken' };
    if (sv.preps.some((p) => p.stationUid === stationUid)) return { ok: false, reason: 'station_busy' };
    const station = this.st.placed.find((p) => p.uid === stationUid)!;
    if (this.surfaceAt(station.at)) return { ok: false, reason: 'station_busy' };
    // Massa trazida na mão.
    const w = this.st.hands.findIndex((h) => h.kind === 'wip' && this.recipe(h.recipe)?.steps[h.step]?.equipment === equipment);
    if (w >= 0) {
      const [wip] = this.st.hands.splice(w, 1);
      if (wip!.kind !== 'wip') return { ok: false, reason: 'nothing_to_prepare' };
      const r = this.recipe(wip!.recipe)!;
      sv.preps.push({ stationUid, recipe: r.id, step: wip!.step, quality: wip!.quality ?? 'simple', readyAt: this.now() + r.steps[wip!.step]!.minutes });
      this.h.bus.emit('prep.started', { stationUid, recipeId: r.id });
      this.handsChanged();
      this.wearOut(stationUid);
      return { ok: true };
    }
    const pending = this.pendingFor(equipment);
    if (!pending && !extra) return { ok: false, reason: this.idleReason(equipment) };
    if (!pending && !this.extraRecipes(stationUid).includes(extra!)) return { ok: false, reason: this.idleReason(equipment) };
    const r = this.recipe(pending?.recipe ?? extra!)!;
    const ing = this.ingredientsAt(r, equipment);
    if (!ing.ok) return { ok: false, reason: 'no_ingredients' };
    if (!r.batch && this.cleanFree(r.vessel) < 1) return { ok: false, reason: 'no_vessel' };
    for (const [item, n] of ing.use) this.useDoses(item, n);
    sv.preps.push({ stationUid, recipe: r.id, step: 0, quality: ing.quality, readyAt: this.now() + r.steps[0]!.minutes });
    this.h.bus.emit('prep.started', { stationUid, recipeId: r.id });
    this.wearOut(stationUid);
    return { ok: true };
  }

  // ---------- Quebra e conserto (o Tião) ----------

  /** Conta um uso; quando chega no limite sorteado (breakdown.minUses a maxUses), o equipamento quebra. */
  private wearOut(uid: string): void {
    const cfg = this.cfg.breakdown;
    if (!cfg) return;
    const w = (this.st.wear[uid] ??= { uses: 0, breaksAt: this.h.rng().int(cfg.minUses, cfg.maxUses) });
    w.uses++;
    if (w.broken || w.uses < w.breaksAt) return;
    w.broken = true;
    this.h.bus.emit('equipment.broke', { uid, itemId: this.itemOf(uid) });
  }

  private itemOf(uid: string): string {
    return this.st.placed.find((p) => p.uid === uid)?.item ?? '';
  }

  /** Quebrado (ainda sem conserto pronto; com o Tião trabalhando também conta). */
  isBroken(uid: string): boolean {
    return !!this.st.wear[uid]?.broken;
  }

  /** O Tião está consertando agora. */
  isRepairing(uid: string): boolean {
    return this.st.wear[uid]?.repairUntil !== undefined;
  }

  /** Equipamentos quebrados no café (uids), para o aviso do balão. */
  brokenEquipment(): string[] {
    return Object.keys(this.st.wear).filter((uid) => this.isBroken(uid) && this.st.placed.some((p) => p.uid === uid));
  }

  /** Chama o Tião: ele vem na hora e conserta em breakdown.repairMinutes, por breakdown.repairPrice moedas. */
  callRepair(uid: string): ServiceResult {
    const cfg = this.cfg.breakdown;
    const w = this.st.wear[uid];
    if (!cfg || !w?.broken) return { ok: false, reason: 'nothing_here' };
    if (w.repairUntil !== undefined) return { ok: false, reason: 'station_busy' };
    if (this.st.money < cfg.repairPrice) return { ok: false, reason: 'no_money' };
    this.h.addMoney(-cfg.repairPrice, `repair:${this.itemOf(uid)}`);
    w.repairUntil = this.now() + cfg.repairMinutes;
    this.h.bus.emit('equipment.repair_started', { uid, itemId: this.itemOf(uid) });
    return { ok: true };
  }

  /** Quanto do conserto já foi (0 a 1), para a barra; undefined = ninguém consertando. */
  repairProgress(uid: string): number | undefined {
    const until = this.st.wear[uid]?.repairUntil;
    const cfg = this.cfg.breakdown;
    if (until === undefined || !cfg) return undefined;
    return Math.min(1, Math.max(0, 1 - (until - this.now()) / cfg.repairMinutes));
  }

  /** Quantos desta receita já estão a caminho: preparando, massa ou pronto (na mão, no balcão, na mesa). */
  private covered(recipe: string): number {
    return (
      this.st.service.preps.filter((p) => p.recipe === recipe).length * (this.recipe(recipe)?.batch?.yields ?? 1) +
      this.displayPortions(recipe) +
      [...this.st.hands, ...this.st.surfaces.map((s) => s.item)].filter((i) => (i.kind === 'drink' || i.kind === 'wip') && i.recipe === recipe).length
    );
  }

  /** Cliente esperando um pedido que começa neste equipamento e ainda não tem nada a caminho (preparando, massa ou pronto). */
  private pendingFor(equipment: string): Customer | undefined {
    const waiting = this.st.service.customers.filter((c) => c.stage === 'waiting' && c.recipe && this.startsAt(this.recipe(c.recipe), equipment));
    return waiting.find((c) => waiting.filter((x) => x.recipe === c.recipe).indexOf(c) >= this.covered(c.recipe!));
  }

  /** Itens sem dono das receitas que começam neste equipamento: a caminho além dos pedidos esperando. */
  extraCount(equipment: string): number {
    const waiting = this.st.service.customers.filter((c) => c.stage === 'waiting');
    return Object.values(this.h.content.recipes)
      .filter((r) => this.startsAt(r, equipment))
      .reduce((n, r) => n + Math.max(0, this.covered(r.id) - waiting.filter((c) => c.recipe === r.id).length), 0);
  }

  /**
   * Sem pedido: as receitas do cardápio (liberadas) que ela pode adiantar neste equipamento, na ordem do quadro.
   * Vazio se o equipamento já tem `extraPerEquipment` itens sem dono.
   */
  extraRecipes(stationUid: string): string[] {
    const equipment = this.equipmentOf(stationUid);
    if (!equipment || this.extraCount(equipment) >= this.cfg.extraPerEquipment) return [];
    return this.st.menu.filter((id) => this.startsAt(this.recipe(id), equipment) && this.recipeStatus(id) !== 'locked');
  }

  /**
   * Por que o equipamento não tem o que preparar: nenhuma receita dele liberada ainda, nenhuma no cardápio, já tem
   * um item sem dono dele, ou nenhum cliente pediu agora (aí ela pode escolher uma receita para adiantar).
   */
  private idleReason(equipment: string): 'equipment_locked' | 'equipment_off_menu' | 'extra_ready' | 'nothing_to_prepare' {
    const recipes = Object.values(this.h.content.recipes).filter((r) => this.startsAt(r, equipment));
    // Equipamento só de etapa do meio (o forno do pão de queijo): sem receita que comece nele.
    if (recipes.length === 0) return 'nothing_to_prepare';
    const unlocked = recipes.filter((r) => this.recipeStatus(r.id) !== 'locked');
    // Nenhuma receita que começa nele liberada: mas se ele já é etapa de uma liberada (o forno do pão de queijo), só
    // não tem nada a fazer agora.
    const midStep = Object.values(this.h.content.recipes).some(
      (r) => r.steps.slice(1).some((s) => s.equipment === equipment) && this.recipeStatus(r.id) !== 'locked',
    );
    if (unlocked.length === 0) return midStep ? 'nothing_to_prepare' : 'equipment_locked';
    if (!unlocked.some((r) => this.st.menu.includes(r.id))) return 'equipment_off_menu';
    if (this.extraCount(equipment) >= this.cfg.extraPerEquipment) return 'extra_ready';
    return 'nothing_to_prepare';
  }

  /**
   * O equipamento tem o que fazer agora? Pedido pronto em cima dele, massa na mão para ele ou cliente esperando um
   * pedido dele. Com vários ao alcance (cafeteira e bule lado a lado), o E vai no que tem trabalho.
   */
  stationHasWork(stationUid: string): boolean {
    const equipment = this.equipmentOf(stationUid);
    const station = this.st.placed.find((p) => p.uid === stationUid);
    if (!equipment || !station) return false;
    if (this.surfaceAt(station.at)) return true;
    if (this.isBroken(stationUid)) return !this.isRepairing(stationUid);
    if (this.st.service.preps.some((p) => p.stationUid === stationUid)) return false;
    if (this.st.hands.some((h) => h.kind === 'wip' && this.recipe(h.recipe)?.steps[h.step]?.equipment === equipment)) return true;
    return !!this.pendingFor(equipment);
  }

  /** Progresso de uma etapa (0 a 1), para a barra em cima do equipamento. */
  prepProgress(stationUid: string): number | undefined {
    const prep = this.st.service.preps.find((p) => p.stationUid === stationUid);
    const r = prep && this.recipe(prep.recipe);
    if (!prep || !r) return undefined;
    const minutes = r.steps[prep.step]?.minutes ?? 1;
    return Math.min(1, Math.max(0, 1 - (prep.readyAt - this.now()) / minutes));
  }

  /** Quanto cabe nas mãos agora (bandeja: só louça). */
  /** Por que não dá para pegar `item` agora (mãos cheias...), ou null. */
  holdProblem(item: HandItem): ServiceProblem | null {
    return this.canHold(item);
  }

  private canHold(item: HandItem): ServiceProblem | null {
    const hands = this.st.hands;
    if (hands.some(exclusive) || (exclusive(item) && hands.length > 0)) return 'hands_full';
    // Gato ou saco pesado com as mãos vazias: ela larga a bandeja (syncTray guarda quando as mãos mudam).
    if (exclusive(item)) return null;
    if (this.st.tray) {
      if (!onTray(item)) return 'not_on_tray';
      return hands.length < this.carry.tray.capacity ? null : 'hands_full';
    }
    return hands.length < this.carry.carryCapacity ? null : 'hands_full';
  }

  pickUp(at: Cell): ServiceResult {
    const s = this.surfaceAt(at);
    if (!s) return { ok: false, reason: 'nothing_here' };
    const problem = this.canHold(s.item);
    if (problem) return { ok: false, reason: problem };
    this.st.surfaces = this.st.surfaces.filter((x) => x !== s);
    this.st.hands.push(s.item);
    this.handsChanged();
    return { ok: true };
  }

  /** Dá para soltar aqui? Balcão, mesa ou equipamento (superfícies) ou chão livre, ao lado dela, sem nada em cima. */
  canPutDown(at: Cell, feet: readonly Cell[], allowFloor = true): boolean {
    if (!near(feet, at) || this.surfaceAt(at)) return false;
    if (this.st.service.customers.some((c) => same(c.spot, at))) return false;
    const items = this.h.content.items;
    const surfaceTags = [...this.cfg.surfaceTags, ...Object.values(this.cfg.equipment).map((e) => e.tag)];
    const onSurface = this.st.placed.some(
      (p) => items[p.item]?.tags.some((t) => surfaceTags.includes(t)) && this.cellsOfPlaced(p.item, p.at).some((c) => same(c, at)),
    );
    if (onSurface) return true;
    if (!allowFloor) return false;
    const solid = solidGrid(this.h.homeMap(), this.h.content.catalog);
    return !!solid[at[1]] && solid[at[1]]![at[0]] === false;
  }

  /** Solta o último objeto da mão (o gato e o saco têm ações próprias). `allowFloor`: false = só em superfície. */
  putDown(at: Cell, feet: readonly Cell[], allowFloor = true): ServiceResult {
    const item = this.st.hands[this.st.hands.length - 1];
    if (!item) return { ok: false, reason: 'hands_empty' };
    if ((exclusive(item) && item.kind !== 'cake') || !this.canPutDown(at, feet, allowFloor && item.kind !== 'cake')) return { ok: false, reason: 'cannot_put_here' };
    this.st.hands.pop();
    this.st.surfaces.push({ at: [...at], item });
    this.handsChanged();
    return { ok: true };
  }

  /** Cliente ao alcance que está esperando algo que ela tem na mão. */
  customerToServe(feet: readonly Cell[]): Customer | undefined {
    const drinks = this.st.hands.filter((i) => i.kind === 'drink');
    return this.st.service.customers.find(
      (c) => c.stage === 'waiting' && near(feet, c.spot) && drinks.some((d) => d.kind === 'drink' && d.recipe === c.recipe),
    );
  }

  /** Entrega o pedido: o cliente paga (premium paga mais) e, satisfeito, deixa gorjeta. */
  serve(customerId: string): ServiceResult {
    const c = this.st.service.customers.find((x) => x.id === customerId);
    if (!c || c.stage !== 'waiting') return { ok: false, reason: 'nothing_here' };
    const i = this.st.hands.findIndex((h) => h.kind === 'drink' && h.recipe === c.recipe);
    if (i < 0) return { ok: false, reason: 'wrong_order' };
    const [served] = this.st.hands.splice(i, 1);
    const quality: Quality = served!.kind === 'drink' ? served!.quality ?? 'simple' : 'simple';
    const r = this.recipe(c.recipe!)!;
    const patienceLeft = (c.until - this.now()) / this.cfg.patienceMinutes;
    c.waits = { queue: c.waits?.queue ?? 0, seated: this.used(c) };
    const satisfied = patienceLeft >= this.cfg.tipPatience && (!c.wantsPremium || quality === 'premium');
    const price = this.priceOf(r.id, quality);
    const tip = satisfied ? Math.max(1, Math.round(price * this.cfg.tipRate)) : 0;
    c.stage = 'drinking';
    c.until = this.now() + this.cfg.consumeMinutes[c.kind];
    this.st.service.served++;
    recordServed(this.st.stats);
    this.h.addMoney(price + tip, `sale:${r.id}`);
    this.h.bus.emit('customer.served', { customerId: c.id, recipeId: r.id, price, tip, quality });
    this.handsChanged();
    this.h.advanceStory();
    return { ok: true };
  }

  // ---------- Pia ----------

  sinkNear(feet: readonly Cell[]): boolean {
    return near(feet, this.sinkCell());
  }

  /** O que a pia faria com um E agora: receber a louça suja das mãos ou começar a lavar. */
  sinkAction(): 'deposit' | 'wash' | null {
    if (this.st.hands.some((h) => h.kind === 'dirty')) return 'deposit';
    if (this.st.hands.length === 0 && !this.st.sink.washing && loadCount(this.st.sink.load) > 0) return 'wash';
    return null;
  }

  /** Deixa na pia a louça suja das mãos (até a capacidade). */
  depositDirty(): ServiceResult {
    const dirty = this.st.hands.filter((i) => i.kind === 'dirty');
    if (dirty.length === 0) return { ok: false, reason: 'hands_empty' };
    let room = this.cfg.sinkCapacity - loadCount(this.st.sink.load);
    if (room <= 0) return { ok: false, reason: 'sink_full' };
    const kept: HandItem[] = [];
    for (const h of this.st.hands) {
      if (h.kind === 'dirty' && room > 0) {
        this.st.sink.load[h.vessel] = (this.st.sink.load[h.vessel] ?? 0) + 1;
        room--;
      } else kept.push(h);
    }
    this.st.hands = kept;
    this.h.bus.emit('sink.changed', { load: loadCount(this.st.sink.load) });
    this.handsChanged();
    return { ok: true };
  }

  /** Começa a lavar o que está na pia (leva minutos por peça; ela pode fazer outra coisa enquanto isso). */
  startWash(): ServiceResult {
    const n = loadCount(this.st.sink.load);
    if (n === 0) return { ok: false, reason: 'nothing_here' };
    if (this.st.sink.washing) return { ok: false, reason: 'station_busy' };
    this.st.sink.washing = { readyAt: this.now() + n * this.cfg.washMinutesPerDish, load: { ...this.st.sink.load } };
    this.st.sink.load = emptyLoad();
    this.h.bus.emit('sink.changed', { load: 0 });
    return { ok: true };
  }

  washProgress(): number | undefined {
    const w = this.st.sink.washing;
    if (!w) return undefined;
    const total = loadCount(w.load) * this.cfg.washMinutesPerDish;
    // Pausada (ela saiu da pia): a barra fica parada no último minuto lavado.
    const at = this.sinkPaused() && this.lastTickAt !== null ? this.lastTickAt : this.now();
    return Math.min(1, Math.max(0, 1 - (w.readyAt - at) / total));
  }

  sinkLoad(): number {
    return loadCount(this.st.sink.load);
  }

  // ---------- Lava-louças ----------

  /** Lava-louças (móvel com washer) ao alcance dos pés, no café (`target`: só a célula clicada). */
  washerNear(feet: readonly Cell[], target?: Cell): string | undefined {
    if (!this.h.atHome()) return undefined;
    return this.st.placed.find((p) => {
      if (!this.h.content.items[p.item]?.washer) return false;
      const cells = this.cellsOfPlaced(p.item, p.at);
      if (target && !cells.some(([c, r]) => c === target[0] && r === target[1])) return false;
      return cells.some((c) => near(feet, c));
    })?.uid;
  }

  private washerDef(uid: string): { capacity: number; cycleMinutes: number } | undefined {
    const placed = this.st.placed.find((p) => p.uid === uid);
    return placed ? this.h.content.items[placed.item]?.washer : undefined;
  }

  private washerState(uid: string): SinkState {
    return (this.st.washers[uid] ??= { load: emptyLoad(), washing: null });
  }

  /** O que a lava-louças faria com um E agora: receber a louça suja das mãos ou ligar (como a pia). */
  washerAction(uid: string): 'deposit' | 'wash' | null {
    if (!this.washerDef(uid)) return null;
    if (this.st.hands.some((h) => h.kind === 'dirty')) return 'deposit';
    const w = this.st.washers[uid];
    if (this.st.hands.length === 0 && w && !w.washing && loadCount(w.load) > 0) return 'wash';
    return null;
  }

  /** Põe na lava-louças a louça suja das mãos (até a capacidade; lavando, também dá para ir enchendo a próxima). */
  depositInWasher(uid: string): ServiceResult {
    const def = this.washerDef(uid);
    if (!def) return { ok: false, reason: 'nothing_here' };
    if (!this.st.hands.some((h) => h.kind === 'dirty')) return { ok: false, reason: 'hands_empty' };
    const w = this.washerState(uid);
    let room = def.capacity - loadCount(w.load);
    if (room <= 0) return { ok: false, reason: 'washer_full' };
    const kept: HandItem[] = [];
    for (const h of this.st.hands) {
      if (h.kind === 'dirty' && room > 0) {
        w.load[h.vessel] = (w.load[h.vessel] ?? 0) + 1;
        room--;
      } else kept.push(h);
    }
    this.st.hands = kept;
    this.h.bus.emit('washer.changed', { uid, load: loadCount(w.load), washing: !!w.washing });
    this.handsChanged();
    return { ok: true };
  }

  /** Liga a lava-louças: o ciclo dura cycleMinutes, com qualquer quantidade (ela pode fazer outra coisa). */
  startWasher(uid: string): ServiceResult {
    const def = this.washerDef(uid);
    const w = this.st.washers[uid];
    if (!def || !w || loadCount(w.load) === 0) return { ok: false, reason: 'nothing_here' };
    if (this.isBroken(uid)) return { ok: false, reason: 'broken' };
    if (w.washing) return { ok: false, reason: 'station_busy' };
    w.washing = { readyAt: this.now() + def.cycleMinutes, load: { ...w.load } };
    w.load = emptyLoad();
    this.h.bus.emit('washer.changed', { uid, load: 0, washing: true });
    this.wearOut(uid);
    return { ok: true };
  }

  /** Quanto falta do ciclo (0 a 1), para a barra em cima dela; undefined = desligada. */
  washerProgress(uid: string): number | undefined {
    const w = this.st.washers[uid]?.washing;
    const def = this.washerDef(uid);
    if (!w || !def) return undefined;
    return Math.min(1, Math.max(0, 1 - (w.readyAt - this.now()) / def.cycleMinutes));
  }

  /** Louça suja esperando na lava-louças (não conta a que está lavando). */
  washerLoad(uid: string): number {
    return loadCount(this.st.washers[uid]?.load ?? emptyLoad());
  }

  /** Tem louça dentro (esperando ou lavando)? Assim ela não pode ser guardada na mochila. */
  washerBusy(uid: string): boolean {
    const w = this.st.washers[uid];
    return !!w && (loadCount(w.load) > 0 || !!w.washing);
  }

  // ---------- Bandeja, mochila, peso e gato ----------

  /**
   * A bandeja acompanha a barra de itens: selecionada, ela está nas mãos (leva até `tray.capacity` louças); fora
   * dela, uma louça por vez. Com mais louça nas mãos do que cabe sem bandeja, ela só sai quando sobrar o que cabe
   * (nada cai no chão). Gato, saco pesado e item que não vai na bandeja nas mãos: não pega a bandeja.
   */
  syncTray(selected: boolean): void {
    const hands = this.st.hands;
    const want = selected ? (this.st.inventory[this.carry.tray.item] ?? 0) > 0 && hands.every(onTray) : this.st.tray && hands.length > this.carry.carryCapacity;
    if (want === !!this.st.tray) return;
    this.st.tray = want;
    this.handsChanged();
  }

  /**
   * O saco pesado selecionado na barra fica nas mãos (ocupa as mãos sozinho e deixa lenta); outro item selecionado,
   * ele volta a ser só da mochila. Com as mãos ocupadas (louça, gato), não pega. O saco continua contado na mochila.
   */
  syncHeavy(activeId: string | null): void {
    const heavy = activeId && this.isHeavy(activeId) ? activeId : null;
    const held = this.st.hands.find((h) => h.kind === 'heavy');
    if ((held?.kind === 'heavy' ? held.item : null) === heavy) return;
    if (held) this.st.hands = this.st.hands.filter((h) => h.kind !== 'heavy');
    if (heavy && this.st.hands.length === 0 && !this.st.tray) this.st.hands.push({ kind: 'heavy', item: heavy });
    else if (!held) return;
    this.handsChanged();
  }

  private isHeavy(itemId: string): boolean {
    return this.h.content.items[itemId]?.tags.includes(this.carry.heavy.tag) ?? false;
  }

  /** Pega ou guarda a bandeja (precisa tê-la na mochila; com ela, as mãos levam várias louças). */
  toggleTray(): ServiceResult {
    if (this.st.tray) {
      if (this.st.hands.length > 0) return { ok: false, reason: 'hands_full' };
      this.st.tray = false;
    } else {
      if ((this.st.inventory[this.carry.tray.item] ?? 0) < 1) return { ok: false, reason: 'no_tray' };
      if (this.st.hands.some((h) => !onTray(h))) return { ok: false, reason: 'hands_full' };
      this.st.tray = true;
    }
    this.handsChanged();
    return { ok: true };
  }

  /** Tira um item da mochila e põe na mão (ex.: petisco). */
  hold(itemId: string): ServiceResult {
    const problem = this.canHold({ kind: 'item', item: itemId });
    if (problem) return { ok: false, reason: problem };
    if ((this.st.inventory[itemId] ?? 0) < 1) return { ok: false, reason: 'nothing_here' };
    const left = this.st.inventory[itemId]! - 1;
    if (left > 0) this.st.inventory[itemId] = left;
    else delete this.st.inventory[itemId];
    this.st.hands.push({ kind: 'item', item: itemId });
    this.handsChanged();
    return { ok: true };
  }

  /** Guarda na mochila o item que está na mão (bebidas e louça não vão para a mochila). */
  stow(): ServiceResult {
    const i = this.st.hands.findIndex((h) => h.kind === 'item');
    if (i < 0) return { ok: false, reason: 'hands_empty' };
    const [h] = this.st.hands.splice(i, 1);
    if (h!.kind === 'item') this.st.inventory[h!.item] = (this.st.inventory[h!.item] ?? 0) + 1;
    this.handsChanged();
    return { ok: true };
  }

  /** Item pesado comprado: vai direto para as mãos (precisa estar com as mãos livres). */
  carryHeavy(itemId: string): ServiceResult {
    const problem = this.canHold({ kind: 'heavy', item: itemId });
    if (problem) return { ok: false, reason: problem };
    this.st.hands.push({ kind: 'heavy', item: itemId });
    this.handsChanged();
    return { ok: true };
  }

  /** No café, o saco vai para o estoque: vira as porções que ele rende (ex.: 5 rações). */
  storeHeavy(): ServiceResult {
    const i = this.st.hands.findIndex((h) => h.kind === 'heavy');
    if (i < 0) return { ok: false, reason: 'hands_empty' };
    if (!this.h.atHome()) return { ok: false, reason: 'not_at_home' };
    const [h] = this.st.hands.splice(i, 1);
    // O saco sai da mochila e vira as porções/trocas (storesAs); se houver outro, o próximo vai para a mão.
    if (h!.kind === 'heavy') {
      this.st.inventory[h!.item] = Math.max(0, (this.st.inventory[h!.item] ?? 0) - 1);
      if (this.st.inventory[h!.item] === 0) delete this.st.inventory[h!.item];
      this.storeItem(h!.item);
    }
    this.h.bus.emit('heavy.stored', { itemId: h!.kind === 'heavy' ? h!.item : '' });
    this.handsChanged();
    this.h.advanceStory();
    return { ok: true };
  }

  private storeItem(itemId: string): void {
    const to = this.h.content.items[itemId]?.storesAs;
    const id = to?.item ?? itemId;
    this.st.inventory[id] = (this.st.inventory[id] ?? 0) + (to?.qty ?? 1);
  }

  /** Pega o gato no colo (mãos livres, sem bandeja). */
  pickUpCat(catId: string): ServiceResult {
    if (!this.st.cats[catId]?.sheltered) return { ok: false, reason: 'nothing_here' };
    const problem = this.canHold({ kind: 'cat', catId });
    if (problem) return { ok: false, reason: problem };
    this.st.hands.push({ kind: 'cat', catId });
    this.handsChanged();
    return { ok: true };
  }

  /** Põe o gato no chão (por enquanto, só dentro do café: o veterinário ainda não existe). */
  putDownCat(): ServiceResult {
    const i = this.st.hands.findIndex((h) => h.kind === 'cat');
    if (i < 0) return { ok: false, reason: 'hands_empty' };
    if (!this.h.atHome()) return { ok: false, reason: 'not_at_home' };
    this.st.hands.splice(i, 1);
    this.handsChanged();
    return { ok: true };
  }

  /** Tira o gato do colo fora do café: ficou na clínica (internado). */
  releaseCarriedCat(): void {
    const i = this.st.hands.findIndex((h) => h.kind === 'cat');
    if (i < 0) return;
    this.st.hands.splice(i, 1);
    this.handsChanged();
  }

  /** O gato que está no colo (para a cena não desenhar ele no chão). */
  carriedCat(): string | undefined {
    const h = this.st.hands.find((x) => x.kind === 'cat');
    return h?.kind === 'cat' ? h.catId : undefined;
  }

  /** Dá ao gato o petisco que está na mão. */
  giveToCat(catId: string): ServiceResult {
    const i = this.st.hands.findIndex((h) => h.kind === 'item' && this.h.content.items[h.item]?.tags.includes('treat'));
    if (i < 0) return { ok: false, reason: 'not_a_treat' };
    this.st.hands.splice(i, 1);
    this.h.catAffection(catId, this.h.content.relationships.treatPoints);
    this.handsChanged();
    return { ok: true };
  }

  /** Velocidade da personagem com o que está nas mãos. */
  speed(): number {
    return speedFactor(this.st.hands, this.st.tray, this.carry);
  }

  /** Está carregando algo (nas mãos, na bandeja ou no colo)? Correr fica um pouco mais devagar. */
  carrying(): boolean {
    return this.st.hands.length > 0 || !!this.st.tray;
  }

  /** Quantos cabem nas mãos agora (para a interface). */
  handsCapacity(): number {
    return this.st.tray ? this.carry.tray.capacity : this.carry.carryCapacity;
  }
}

/** Nome da etapa atual de uma massa (para mostrar "Pão de queijo: forno"). */
export function wipStepEquipment(r: RecipeDef | undefined, step: number): string | undefined {
  return r?.steps[step]?.equipment;
}

export { loadCount };
