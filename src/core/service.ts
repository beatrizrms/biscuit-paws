// Atendimento do café: cardápio, pedidos, preparo nos equipamentos, mãos, louça e clientes.
// Puro: sem Phaser, DOM ou window. O tempo é o relógio do jogo (minutos absolutos, nowAbs).
// A cena só desenha: lê este estado e chama as ações (pegar, soltar, preparar, servir, lavar).
import type { Condition, Content } from './content';
import type { EventBus } from './events';
import { cellsOf, solidGrid, type Cell, type MapData } from './map';
import type { Rng } from './rng';
import { speedFactor, vesselOf, type HandItem, type SurfaceItem } from './carry';
import { VESSELS, type RecipeDef, type RecipeStatus, type ServiceKind, type Vessel } from './recipes';
import { nowAbs, type GameState } from './state';
import { parseClock } from './time';

/** Cliente no café. `spot`: onde fica; `dishAt`: onde deixa a louça suja. */
export interface Customer {
  id: string;
  /** Índice da cor (service.json: customerTints). */
  look: number;
  stage: 'queue' | 'waiting' | 'drinking';
  kind: ServiceKind;
  spot: Cell;
  dishAt: Cell;
  /** Pedido (null enquanto está na fila). */
  recipe: string | null;
  /** waiting: até quando espera; drinking: quando termina. */
  until: number;
}

/** Bebida sendo feita num equipamento posicionado. */
export interface Prep {
  stationUid: string;
  recipe: string;
  readyAt: number;
}

export interface ServiceState {
  customers: Customer[];
  preps: Prep[];
  nextCustomerAt: number | null;
  nextCustomerId: number;
  /** Clientes atendidos (o total do jogo). */
  served: number;
}

export function newServiceState(): ServiceState {
  return { customers: [], preps: [], nextCustomerAt: null, nextCustomerId: 1, served: 0 };
}

export type ServiceProblem =
  | 'not_unlocked'
  | 'menu_full'
  | 'hands_full'
  | 'hands_empty'
  | 'nothing_to_prepare'
  | 'station_busy'
  | 'no_ingredients'
  | 'no_vessel'
  | 'cannot_put_here'
  | 'nothing_here'
  | 'wrong_order'
  | 'not_a_treat';

export type ServiceResult = { ok: true } | { ok: false; reason: ServiceProblem };

/** O que o atendimento precisa da sessão. */
export interface ServiceHost {
  state: GameState;
  content: Content;
  bus: EventBus;
  rng(): Rng;
  /** Mapa do café (com os móveis da jogadora). */
  homeMap(): MapData;
  evaluate(c: Condition): boolean;
  addMoney(delta: number, reason: string): void;
  advanceStory(): void;
  catAffection(catId: string, points: number): void;
}

const near = (feet: readonly Cell[], at: Cell, reach = 1) => feet.some((f) => Math.max(Math.abs(f[0] - at[0]), Math.abs(f[1] - at[1])) <= reach);
const same = (a: Cell, b: Cell) => a[0] === b[0] && a[1] === b[1];

export class CafeService {
  constructor(private h: ServiceHost) {}

  private get st(): GameState {
    return this.h.state;
  }
  private get cfg() {
    return this.h.content.service;
  }
  private now(): number {
    return nowAbs(this.st);
  }

  // ---------- Ingredientes (doses) ----------

  /** Doses disponíveis: pacotes fechados na mochila x rendimento + o que sobrou do pacote aberto. */
  doses(itemId: string): number {
    const servings = this.h.content.items[itemId]?.servings ?? 1;
    return (this.st.inventory[itemId] ?? 0) * servings + (this.st.pantryOpen[itemId] ?? 0);
  }

  private useDoses(itemId: string, n: number): void {
    const servings = this.h.content.items[itemId]?.servings ?? 1;
    for (let i = 0; i < n; i++) {
      if ((this.st.pantryOpen[itemId] ?? 0) === 0) {
        // Abre um pacote novo.
        const left = (this.st.inventory[itemId] ?? 0) - 1;
        if (left > 0) this.st.inventory[itemId] = left;
        else delete this.st.inventory[itemId];
        this.st.pantryOpen[itemId] = servings;
      }
      this.st.pantryOpen[itemId]! -= 1;
      if (this.st.pantryOpen[itemId] === 0) delete this.st.pantryOpen[itemId];
    }
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

  /** Louça limpa que ainda não está separada para um preparo. */
  cleanFree(v: Vessel): number {
    const reserved = this.st.service.preps.filter((p) => this.recipe(p.recipe)?.vessel === v).length;
    return (this.st.dishes[v] ?? 0) - reserved;
  }

  /** Louça suja espalhada (mãos e superfícies). */
  dirtyCount(): number {
    const all = [...this.st.hands, ...this.st.surfaces.map((s) => s.item)];
    return all.filter((i) => i.kind === 'dirty').length;
  }

  /** O presente da Gabi (ou outro item com "dishes") entra no estoque de louça limpa. */
  stockDishes(itemId: string): void {
    const dishes = this.h.content.items[itemId]?.dishes;
    if (!dishes || this.st.flags[`dishes.stocked.${itemId}`]) return;
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
    if (this.stationsFor(r.equipment).length === 0) return 'equipment';
    if (Object.entries(r.ingredients).some(([item, n]) => this.doses(item) < n)) return 'ingredients';
    if (this.cleanFree(r.vessel) < 1) return 'vessel';
    return 'available';
  }

  unlockedRecipes(): RecipeDef[] {
    return Object.values(this.h.content.recipes).filter((r) => this.recipeStatus(r.id) !== 'locked');
  }

  /** Põe ou tira uma receita do quadro. */
  toggleMenu(recipeId: string): ServiceResult {
    if (this.st.menu.includes(recipeId)) {
      this.st.menu = this.st.menu.filter((id) => id !== recipeId);
    } else {
      if (this.recipeStatus(recipeId) === 'locked') return { ok: false, reason: 'not_unlocked' };
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

  // ---------- Capacidade e lugares ----------

  /** Quantos clientes cabem agora: o teto dos dados, limitado pela louça que não está suja. */
  capacity(): number {
    const clean = VESSELS.reduce((n, v) => n + (this.st.dishes[v] ?? 0), 0);
    const inUse = [...this.st.hands, ...this.st.surfaces.map((s) => s.item)].filter((i) => i.kind === 'drink').length +
      this.st.service.customers.filter((c) => c.stage === 'drinking').length;
    return Math.min(this.cfg.maxCustomers, clean + inUse);
  }

  /** Lugares de atendimento: em pé na frente do balcão; sentado numa cadeira ao lado de uma mesa. */
  spots(): { kind: ServiceKind; spot: Cell; dishAt: Cell }[] {
    const map = this.h.homeMap();
    const solid = solidGrid(map, this.h.content.catalog);
    const free = ([c, r]: Cell) => r >= 0 && c >= 0 && r < solid.length && c < solid[0]!.length && !solid[r]![c];
    const items = this.h.content.items;
    const withTag = (tag: string) => this.st.placed.filter((p) => items[p.item]?.tags.includes(tag));
    const out: { kind: ServiceKind; spot: Cell; dishAt: Cell }[] = [];
    for (const p of withTag(this.cfg.standingTag)) {
      for (const [c, r] of this.cellsOfPlaced(p.item, p.at)) {
        const below: Cell = [c, r + 1];
        if (free(below)) out.push({ kind: 'standing', spot: below, dishAt: [c, r] });
      }
    }
    const tables = withTag(this.cfg.tableTag).flatMap((p) => this.cellsOfPlaced(p.item, p.at));
    for (const chair of withTag(this.cfg.chairTag)) {
      const [c, r] = chair.at;
      const table = tables.find(([tc, tr]) => Math.abs(tc - c) + Math.abs(tr - r) === 1);
      if (table) out.push({ kind: 'table', spot: [c, r], dishAt: table });
    }
    return out;
  }

  private freeSpots(): { kind: ServiceKind; spot: Cell; dishAt: Cell }[] {
    const taken = this.st.service.customers.filter((c) => c.stage !== 'queue').map((c) => c.spot);
    return this.spots().filter((s) => !taken.some((t) => same(t, s.spot)));
  }

  /** O atendimento está funcionando agora (marco/condição dos dados + horário)? */
  isOpen(): boolean {
    if (!this.h.evaluate(this.cfg.enabledWhen)) return false;
    const t = this.st.time;
    return t >= parseClock(this.cfg.open.from) && t < parseClock(this.cfg.open.until);
  }

  // ---------- Relógio ----------

  /** A cada minuto de jogo: bebidas ficam prontas, clientes esperam/consomem/vão embora, chegam novos. */
  tick(): void {
    const now = this.now();
    const sv = this.st.service;
    // Preparos prontos: a bebida aparece no equipamento.
    for (const prep of [...sv.preps]) {
      if (prep.readyAt > now) continue;
      const station = this.st.placed.find((p) => p.uid === prep.stationUid);
      const r = this.recipe(prep.recipe);
      if (!station || !r) {
        sv.preps = sv.preps.filter((p) => p !== prep);
        continue;
      }
      if (this.surfaceAt(station.at)) continue; // equipamento ocupado: espera tirarem a bebida
      sv.preps = sv.preps.filter((p) => p !== prep);
      for (const [item, n] of Object.entries(r.ingredients)) this.useDoses(item, n);
      this.st.dishes[r.vessel] = (this.st.dishes[r.vessel] ?? 0) - 1;
      this.st.surfaces.push({ at: [...station.at], item: { kind: 'drink', recipe: r.id, vessel: r.vessel } });
      this.h.bus.emit('prep.ready', { stationUid: station.uid, recipeId: r.id });
    }
    // Clientes.
    for (const c of [...sv.customers]) {
      if (c.stage === 'waiting' && now >= c.until) this.leave(c, false);
      else if (c.stage === 'drinking' && now >= c.until) {
        this.leaveDish(c);
        this.leave(c, true);
      }
    }
    // Fila: quem esperava ganha um lugar livre.
    for (const c of sv.customers.filter((x) => x.stage === 'queue')) {
      const spot = this.freeSpots()[0];
      if (!spot) break;
      this.seat(c, spot);
    }
    this.maybeSpawn(now);
  }

  private maybeSpawn(now: number): void {
    const sv = this.st.service;
    if (!this.isOpen()) return;
    if (sv.nextCustomerAt === null) sv.nextCustomerAt = now + this.cfg.firstArrivalMinutes;
    if (now < sv.nextCustomerAt) return;
    if (sv.customers.length >= this.capacity() || this.orderable().length === 0) return;
    const spot = this.freeSpots()[0];
    const queueFree = this.cfg.queue.filter((q) => !sv.customers.some((c) => c.stage === 'queue' && same(c.spot, q)));
    if (!spot && queueFree.length === 0) return;
    const rng = this.h.rng();
    const c: Customer = {
      id: `c${sv.nextCustomerId++}`,
      look: rng.int(0, this.cfg.customerTints.length - 1),
      stage: 'queue',
      kind: 'standing',
      spot: [...(queueFree[0] ?? this.cfg.queue[0]!)],
      dishAt: [...(queueFree[0] ?? this.cfg.queue[0]!)],
      recipe: null,
      until: now + this.cfg.patienceMinutes,
    };
    sv.customers.push(c);
    if (spot) this.seat(c, spot);
    else this.h.bus.emit('customer.arrived', { customerId: c.id, recipeId: null });
    const [a, b] = this.cfg.arrivalEveryMinutes;
    sv.nextCustomerAt = now + rng.int(a, b);
  }

  /** Vai para o lugar e faz o pedido (só o que está no quadro e dá para fazer, do tipo do lugar). */
  private seat(c: Customer, spot: { kind: ServiceKind; spot: Cell; dishAt: Cell }): void {
    const options = this.orderable().filter((r) => r.service === spot.kind);
    if (options.length === 0) return;
    const rng = this.h.rng();
    c.stage = 'waiting';
    c.kind = spot.kind;
    c.spot = [...spot.spot];
    c.dishAt = [...spot.dishAt];
    c.recipe = options[rng.int(0, options.length - 1)]!.id;
    c.until = this.now() + this.cfg.patienceMinutes;
    this.h.bus.emit('customer.arrived', { customerId: c.id, recipeId: c.recipe });
  }

  private leaveDish(c: Customer): void {
    const vessel = this.recipe(c.recipe ?? '')?.vessel;
    if (!vessel) return;
    const at = [c.dishAt, c.spot].find((cell) => !this.surfaceAt(cell)) ?? c.spot;
    this.st.surfaces.push({ at: [...at], item: { kind: 'dirty', vessel } });
  }

  private leave(c: Customer, happy: boolean): void {
    this.st.service.customers = this.st.service.customers.filter((x) => x !== c);
    this.h.bus.emit('customer.left', { customerId: c.id, happy });
  }

  /** Fim do dia: clientes vão embora (a louça em uso volta limpa) e os preparos param. */
  endOfDay(): void {
    const sv = this.st.service;
    for (const c of sv.customers) {
      const v = c.stage === 'drinking' ? this.recipe(c.recipe ?? '')?.vessel : undefined;
      if (v) this.st.dishes[v] = (this.st.dishes[v] ?? 0) + 1;
    }
    sv.customers = [];
    sv.preps = [];
    sv.nextCustomerAt = null;
  }

  // ---------- Ações da personagem ----------

  surfaceAt(at: Cell): SurfaceItem | undefined {
    return this.st.surfaces.find((s) => same(s.at, at));
  }

  /** Começa a preparar, no equipamento, o pedido mais antigo que ele sabe fazer e que ninguém está fazendo. */
  prepare(stationUid: string): ServiceResult {
    const equipment = this.equipmentOf(stationUid);
    const sv = this.st.service;
    if (!equipment) return { ok: false, reason: 'nothing_to_prepare' };
    if (sv.preps.some((p) => p.stationUid === stationUid)) return { ok: false, reason: 'station_busy' };
    const station = this.st.placed.find((p) => p.uid === stationUid)!;
    if (this.surfaceAt(station.at)) return { ok: false, reason: 'station_busy' };
    // Pedidos ainda sem bebida: espera - (preparando + prontas nas mãos/superfícies).
    const covered = (recipe: string) =>
      sv.preps.filter((p) => p.recipe === recipe).length +
      [...this.st.hands, ...this.st.surfaces.map((s) => s.item)].filter((i) => i.kind === 'drink' && i.recipe === recipe).length;
    const waiting = sv.customers.filter((c) => c.stage === 'waiting' && c.recipe && this.recipe(c.recipe)?.equipment === equipment);
    const pending = waiting.find((c) => waiting.filter((w) => w.recipe === c.recipe).indexOf(c) >= covered(c.recipe!));
    if (!pending) return { ok: false, reason: 'nothing_to_prepare' };
    const r = this.recipe(pending.recipe!)!;
    if (Object.entries(r.ingredients).some(([item, n]) => this.doses(item) < n)) return { ok: false, reason: 'no_ingredients' };
    if (this.cleanFree(r.vessel) < 1) return { ok: false, reason: 'no_vessel' };
    sv.preps.push({ stationUid, recipe: r.id, readyAt: this.now() + r.prepMinutes });
    this.h.bus.emit('prep.started', { stationUid, recipeId: r.id });
    return { ok: true };
  }

  /** Progresso de um preparo (0 a 1), para a barra em cima do equipamento. */
  prepProgress(stationUid: string): number | undefined {
    const prep = this.st.service.preps.find((p) => p.stationUid === stationUid);
    const r = prep && this.recipe(prep.recipe);
    if (!prep || !r) return undefined;
    return Math.min(1, Math.max(0, 1 - (prep.readyAt - this.now()) / r.prepMinutes));
  }

  pickUp(at: Cell): ServiceResult {
    const s = this.surfaceAt(at);
    if (!s) return { ok: false, reason: 'nothing_here' };
    if (this.st.hands.length >= this.h.content.carry.carryCapacity) return { ok: false, reason: 'hands_full' };
    this.st.surfaces = this.st.surfaces.filter((x) => x !== s);
    this.st.hands.push(s.item);
    this.h.bus.emit('hands.changed', { count: this.st.hands.length });
    return { ok: true };
  }

  /** Dá para soltar aqui? Balcão, mesa ou equipamento (superfícies) ou chão livre, ao lado dela, sem nada em cima. */
  canPutDown(at: Cell, feet: readonly Cell[]): boolean {
    if (!near(feet, at) || this.surfaceAt(at)) return false;
    if (this.st.service.customers.some((c) => same(c.spot, at))) return false;
    const items = this.h.content.items;
    const surfaceTags = [...this.cfg.surfaceTags, ...Object.values(this.cfg.equipment).map((e) => e.tag)];
    const onSurface = this.st.placed.some(
      (p) => items[p.item]?.tags.some((t) => surfaceTags.includes(t)) && this.cellsOfPlaced(p.item, p.at).some((c) => same(c, at)),
    );
    if (onSurface) return true;
    const solid = solidGrid(this.h.homeMap(), this.h.content.catalog);
    return !!solid[at[1]] && solid[at[1]]![at[0]] === false;
  }

  putDown(at: Cell, feet: readonly Cell[]): ServiceResult {
    const item = this.st.hands[this.st.hands.length - 1];
    if (!item) return { ok: false, reason: 'hands_empty' };
    if (!this.canPutDown(at, feet)) return { ok: false, reason: 'cannot_put_here' };
    this.st.hands.pop();
    this.st.surfaces.push({ at: [...at], item });
    this.h.bus.emit('hands.changed', { count: this.st.hands.length });
    return { ok: true };
  }

  /** Cliente ao alcance que está esperando o que ela tem na mão. */
  customerToServe(feet: readonly Cell[]): Customer | undefined {
    const drinks = this.st.hands.filter((i) => i.kind === 'drink');
    return this.st.service.customers.find(
      (c) => c.stage === 'waiting' && near(feet, c.spot) && drinks.some((d) => d.kind === 'drink' && d.recipe === c.recipe),
    );
  }

  /** Entrega o pedido: o cliente paga e começa a consumir. */
  serve(customerId: string): ServiceResult {
    const c = this.st.service.customers.find((x) => x.id === customerId);
    if (!c || c.stage !== 'waiting') return { ok: false, reason: 'nothing_here' };
    const i = this.st.hands.findIndex((h) => h.kind === 'drink' && h.recipe === c.recipe);
    if (i < 0) return { ok: false, reason: 'wrong_order' };
    this.st.hands.splice(i, 1);
    const r = this.recipe(c.recipe!)!;
    c.stage = 'drinking';
    c.until = this.now() + this.cfg.consumeMinutes[c.kind];
    this.st.service.served++;
    this.h.addMoney(r.price, `sale:${r.id}`);
    this.h.bus.emit('customer.served', { customerId: c.id, recipeId: r.id, price: r.price });
    this.h.bus.emit('hands.changed', { count: this.st.hands.length });
    this.h.advanceStory();
    return { ok: true };
  }

  sinkNear(feet: readonly Cell[]): boolean {
    return near(feet, this.cfg.sink);
  }

  /** Na pia: toda a louça suja das mãos volta limpa para o estoque. */
  wash(): ServiceResult {
    const dirty = this.st.hands.filter((i) => i.kind === 'dirty');
    if (dirty.length === 0) return { ok: false, reason: 'hands_empty' };
    for (const d of dirty) {
      const v = vesselOf(d)!;
      this.st.dishes[v] = (this.st.dishes[v] ?? 0) + 1;
    }
    this.st.hands = this.st.hands.filter((i) => i.kind !== 'dirty');
    this.h.bus.emit('dish.washed', { count: dirty.length });
    this.h.bus.emit('hands.changed', { count: this.st.hands.length });
    return { ok: true };
  }

  /** Tira um item da mochila e põe na mão (ex.: petisco). */
  hold(itemId: string): ServiceResult {
    if (this.st.hands.length >= this.h.content.carry.carryCapacity) return { ok: false, reason: 'hands_full' };
    if ((this.st.inventory[itemId] ?? 0) < 1) return { ok: false, reason: 'nothing_here' };
    const left = this.st.inventory[itemId]! - 1;
    if (left > 0) this.st.inventory[itemId] = left;
    else delete this.st.inventory[itemId];
    this.st.hands.push({ kind: 'item', item: itemId });
    this.h.bus.emit('hands.changed', { count: this.st.hands.length });
    return { ok: true };
  }

  /** Guarda na mochila o item que está na mão (bebidas e louça não vão para a mochila). */
  stow(): ServiceResult {
    const i = this.st.hands.findIndex((h) => h.kind === 'item');
    if (i < 0) return { ok: false, reason: 'hands_empty' };
    const [h] = this.st.hands.splice(i, 1);
    if (h!.kind === 'item') this.st.inventory[h!.item] = (this.st.inventory[h!.item] ?? 0) + 1;
    this.h.bus.emit('hands.changed', { count: this.st.hands.length });
    return { ok: true };
  }

  /** Dá ao gato o petisco que está na mão. */
  giveToCat(catId: string): ServiceResult {
    const i = this.st.hands.findIndex((h) => h.kind === 'item' && this.h.content.items[h.item]?.tags.includes('treat'));
    if (i < 0) return { ok: false, reason: 'not_a_treat' };
    this.st.hands.splice(i, 1);
    this.h.catAffection(catId, this.h.content.relationships.treatPoints);
    this.h.bus.emit('hands.changed', { count: this.st.hands.length });
    return { ok: true };
  }

  /** Velocidade da personagem com o que está nas mãos. */
  speed(): number {
    return speedFactor(this.st.hands.length, this.h.content.carry);
  }
}
