// Atendimento do café: cardápio, pedidos, preparo nos equipamentos (em etapas), mãos e bandeja, itens pesados,
// gato no colo, louça e pia, clientes com preferências. Puro: sem Phaser, DOM ou window.
// O tempo é o relógio do jogo (minutos absolutos, nowAbs). A cena só desenha e chama as ações.
import type { Condition, Content } from './content';
import type { EventBus } from './events';
import { cellsOf, solidGrid, type Cell, type MapData } from './map';
import type { Rng } from './rng';
import { exclusive, onTray, speedFactor, vesselOf, type HandItem, type SurfaceItem } from './carry';
import { VESSELS, type Quality, type RecipeDef, type RecipeStatus, type ServiceKind, type Vessel } from './recipes';
import { capacityOf, type CapacityView } from './capacity';
import { nowAbs, type GameState } from './state';
import { parseClock } from './time';

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
}

export function newServiceState(): ServiceState {
  return { customers: [], preps: [], nextCustomerAt: null, nextCustomerId: 1, served: 0 };
}

export const emptyLoad = (): Record<Vessel, number> => ({ cup: 0, glass: 0, plate: 0 });

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
  | 'not_a_treat'
  | 'not_on_tray'
  | 'no_tray'
  | 'sink_full'
  | 'not_at_home';

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
    const wips = [...this.st.hands, ...this.st.surfaces.map((s) => s.item)].filter((i) => i.kind === 'wip' && this.recipe(i.recipe)?.vessel === v);
    return this.st.service.preps.filter((p) => this.recipe(p.recipe)?.vessel === v).length + wips.length;
  }

  /** Louça limpa que ainda não está separada para um preparo. */
  cleanFree(v: Vessel): number {
    return (this.st.dishes[v] ?? 0) - this.reserved(v);
  }

  /** Louça suja espalhada (mãos, superfícies e esperando na pia). */
  dirtyCount(): number {
    const all = [...this.st.hands, ...this.st.surfaces.map((s) => s.item)];
    return all.filter((i) => i.kind === 'dirty').length + loadCount(this.st.sink.load) + loadCount(this.st.sink.washing?.load ?? emptyLoad());
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
    if (r.steps.some((s) => this.stationsFor(s.equipment).length === 0)) return 'equipment';
    if (!this.ingredientsFor(r).ok) return 'ingredients';
    if (this.cleanFree(r.vessel) < 1) return 'vessel';
    return 'available';
  }

  /** Primeiro equipamento que falta para a receita (para o quadro dizer qual). */
  missingEquipment(id: string): string | undefined {
    return this.recipe(id)?.steps.find((s) => this.stationsFor(s.equipment).length === 0)?.equipment;
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

  /** Um lugar livre que tenha pedido possível (em pé ou na mesa). */
  private usableSpot(): { kind: ServiceKind; spot: Cell; dishAt: Cell } | undefined {
    const recipes = this.orderable();
    return this.freeSpots().find((s) => recipes.some((r) => this.servesAt(r, s.kind)));
  }

  /** O atendimento está funcionando agora (marco/condição dos dados + horário)? */
  isOpen(): boolean {
    if (!this.h.evaluate(this.cfg.enabledWhen)) return false;
    const t = this.st.time;
    return t >= parseClock(this.cfg.open.from) && t < parseClock(this.cfg.open.until);
  }

  // ---------- Relógio ----------

  /** A cada minuto de jogo: etapas ficam prontas, a pia lava, clientes esperam/consomem/vão embora, chegam novos. */
  tick(): void {
    const now = this.now();
    const sv = this.st.service;
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
      if (last) {
        this.st.dishes[r.vessel] = (this.st.dishes[r.vessel] ?? 0) - 1;
        this.st.surfaces.push({ at: [...station.at], item: { kind: 'drink', recipe: r.id, vessel: r.vessel, quality: prep.quality } });
      } else {
        this.st.surfaces.push({ at: [...station.at], item: { kind: 'wip', recipe: r.id, step: prep.step + 1, quality: prep.quality } });
      }
      this.h.bus.emit('prep.ready', { stationUid: station.uid, recipeId: r.id, final: last });
    }
    // Pia.
    const washing = this.st.sink.washing;
    if (washing && washing.readyAt <= now) {
      for (const v of VESSELS) this.st.dishes[v] = (this.st.dishes[v] ?? 0) + (washing.load[v] ?? 0);
      this.st.sink.washing = null;
      this.h.bus.emit('dish.washed', { count: loadCount(washing.load) });
    }
    // Clientes.
    for (const c of [...sv.customers]) {
      if (c.stage === 'waiting' && now >= c.until) this.leave(c, false);
      else if (c.stage === 'drinking' && now >= c.until) {
        this.leaveDish(c);
        this.leave(c, true);
      }
    }
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
    c.stage = 'waiting';
    c.kind = spot.kind;
    c.spot = [...spot.spot];
    c.dishAt = [...spot.dishAt];
    c.recipe = favorite && rng.chance(this.cfg.preferences.favoriteWeight) ? favorite.id : options[rng.int(0, options.length - 1)]!.id;
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
    for (const h of this.st.hands.filter((x) => x.kind === 'heavy')) if (h.kind === 'heavy') this.storeItem(h.item);
    this.st.hands = this.st.hands.filter((x) => !exclusive(x));
  }

  // ---------- Ações da personagem ----------

  surfaceAt(at: Cell): SurfaceItem | undefined {
    return this.st.surfaces.find((s) => same(s.at, at));
  }

  /**
   * No equipamento: se ela traz a massa da etapa anterior, começa a próxima etapa; senão, começa a primeira etapa
   * do pedido mais antigo que este equipamento sabe começar e que ninguém está fazendo.
   */
  prepare(stationUid: string): ServiceResult {
    const equipment = this.equipmentOf(stationUid);
    const sv = this.st.service;
    if (!equipment) return { ok: false, reason: 'nothing_to_prepare' };
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
      return { ok: true };
    }
    // Pedidos ainda sem nada a caminho: espera - (preparando + massas + prontos).
    const covered = (recipe: string) =>
      sv.preps.filter((p) => p.recipe === recipe).length +
      [...this.st.hands, ...this.st.surfaces.map((s) => s.item)].filter((i) => (i.kind === 'drink' || i.kind === 'wip') && i.recipe === recipe).length;
    const waiting = sv.customers.filter((c) => c.stage === 'waiting' && c.recipe && this.recipe(c.recipe)?.steps[0]?.equipment === equipment);
    const pending = waiting.find((c) => waiting.filter((x) => x.recipe === c.recipe).indexOf(c) >= covered(c.recipe!));
    if (!pending) return { ok: false, reason: 'nothing_to_prepare' };
    const r = this.recipe(pending.recipe!)!;
    const ing = this.ingredientsFor(r);
    if (!ing.ok) return { ok: false, reason: 'no_ingredients' };
    if (this.cleanFree(r.vessel) < 1) return { ok: false, reason: 'no_vessel' };
    for (const [item, n] of ing.use) this.useDoses(item, n);
    sv.preps.push({ stationUid, recipe: r.id, step: 0, quality: ing.quality, readyAt: this.now() + r.steps[0]!.minutes });
    this.h.bus.emit('prep.started', { stationUid, recipeId: r.id });
    return { ok: true };
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
    if (hands.some(exclusive) || (exclusive(item) && (hands.length > 0 || this.st.tray))) return 'hands_full';
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

  /** Solta o último objeto da mão (o gato e o saco têm ações próprias). */
  putDown(at: Cell, feet: readonly Cell[]): ServiceResult {
    const item = this.st.hands[this.st.hands.length - 1];
    if (!item) return { ok: false, reason: 'hands_empty' };
    if (exclusive(item) || !this.canPutDown(at, feet)) return { ok: false, reason: 'cannot_put_here' };
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
    const satisfied = patienceLeft >= this.cfg.tipPatience && (!c.wantsPremium || quality === 'premium');
    const price = this.priceOf(r.id, quality);
    const tip = satisfied ? Math.max(1, Math.round(price * this.cfg.tipRate)) : 0;
    c.stage = 'drinking';
    c.until = this.now() + this.cfg.consumeMinutes[c.kind];
    this.st.service.served++;
    this.h.addMoney(price + tip, `sale:${r.id}`);
    this.h.bus.emit('customer.served', { customerId: c.id, recipeId: r.id, price, tip, quality });
    this.handsChanged();
    this.h.advanceStory();
    return { ok: true };
  }

  // ---------- Pia ----------

  sinkNear(feet: readonly Cell[]): boolean {
    return near(feet, this.cfg.sink);
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
    return Math.min(1, Math.max(0, 1 - (w.readyAt - this.now()) / total));
  }

  sinkLoad(): number {
    return loadCount(this.st.sink.load);
  }

  // ---------- Bandeja, mochila, peso e gato ----------

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
    if (h!.kind === 'heavy') this.storeItem(h!.item);
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
