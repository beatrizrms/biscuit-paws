// Sessão de jogo: o único lugar que muda o estado. O Phaser chama estas ações
// e escuta os eventos. Puro: sem Phaser, DOM ou window.
import type { Condition, Content, Effect } from './content';
import { seenFlag } from './cutscene';
import { cleanCatName, suggestCatName } from './cats';
import { addPoints, hearts, PLAYER } from './relationships';
import { EventBus } from './events';
import type { Cell, MapData, MapDoor, SurfaceDef } from './map';
import { placedItemAt, placementProblem, withPlaced, type PlaceProblem } from './placement';
import type { GameState } from './state';
import { activeBeats, currentGoals, evaluate, isBeatSatisfied, isCleaned, type GoalView, type StoryContext } from './story';
import { cellsOf, type DirtSpot } from './map';

export type ActionResult =
  | { ok: true }
  | {
      ok: false;
      reason:
        | 'unknown_item'
        | 'no_money'
        | 'not_in_inventory'
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
        | PlaceProblem;
    };

export class GameSession {
  readonly bus = new EventBus();

  constructor(
    readonly content: Content,
    readonly state: GameState,
  ) {}

  /** Começa a sessão: avisa quem escuta e dispara os marcos que já valem (ex.: a abertura). */
  start(isNew: boolean): void {
    this.bus.emit('game.started', { isNew });
    this.advanceStory();
  }

  /** O item já pode ser comprado? (ex.: coisas de gato só depois de ter um gato) */
  itemUnlocked(itemId: string): boolean {
    const item = this.content.items[itemId];
    return !!item && (!item.requires || evaluate(item.requires, this.state, this.storyContext()));
  }

  /** Esta porta, agora, mostra uma cena em vez de deixar passar? Devolve o id da cena. */
  doorIntercept(door: MapDoor): string | undefined {
    const i = door.intercept;
    if (!i || !evaluate(i.when as Condition, this.state, this.storyContext())) return undefined;
    this.bus.emit('cutscene.requested', { cutsceneId: i.cutscene });
    return i.cutscene;
  }

  // ---------- Gatos ----------

  /** Gatos abrigados (ids). */
  shelteredCats(): string[] {
    return Object.keys(this.state.cats).filter((id) => this.state.cats[id]!.sheltered);
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
      return other;
    }
    const base = this.content.map;
    const legend = { ...base.legend };
    for (const surface of base.surfaces ?? []) {
      const finish = this.content.finishes[this.state.finishes[surface.id] ?? ''];
      if (finish) legend[surface.legend] = finish.tile;
    }
    return withPlaced({ ...base, legend, dirt: this.visibleDirt() }, this.state.placed, this.content.items);
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
    if (!refundable || (refundable.kind ?? 'furniture') === 'key') return { ok: false, reason: 'unknown_item' };
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
    const d = this.visibleDirt().find((x) => x.id === dirtId);
    if (!d) return { ok: false, reason: 'not_found' };
    if (d.clearedBy) return { ok: false, reason: 'needs_repair' };
    const def = this.content.catalog.tiles[d.tile]!;
    if (from.length > 0) {
      const near = cellsOf(d.at, def).some(([c, r]) => from.some(([fc, fr]) => Math.max(Math.abs(c - fc), Math.abs(r - fr)) <= reach));
      if (!near) return { ok: false, reason: 'too_far' };
    }
    this.state.cleaned.push(d.id);
    this.bus.emit('dirt.cleaned', { dirtId: d.id });
    this.advanceStory();
    return { ok: true };
  }

  private storyContext(): StoryContext {
    return { items: this.content.items, dirt: this.content.map.dirt ?? [] };
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

  /** Compra um item: desconta o preço e põe no inventário. */
  buy(itemId: string): ActionResult {
    const item = this.content.items[itemId];
    if (!item || item.deprecated) return { ok: false, reason: 'unknown_item' };
    if ((item.kind ?? 'furniture') === 'key') return { ok: false, reason: 'unknown_item' };
    if (!this.itemUnlocked(itemId)) return { ok: false, reason: 'locked' };
    if (this.state.money < item.price) return { ok: false, reason: 'no_money' };
    this.addMoney(-item.price, `buy:${itemId}`);
    this.state.inventory[itemId] = (this.state.inventory[itemId] ?? 0) + 1;
    this.bus.emit('item.bought', { itemId, price: item.price });
    this.advanceStory();
    return { ok: true };
  }

  /** Diz se o item pode ficar em `at`, sem mudar nada. */
  checkPlacement(itemId: string, at: Cell, reserved: readonly Cell[] = []): PlaceProblem | null {
    const def = this.content.catalog.tiles[this.content.items[itemId]?.tile ?? ''];
    if (!def) return 'out_of_bounds';
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
      const next = activeBeats(this.content.story, this.state).find((b) => isBeatSatisfied(b, this.state, this.storyContext()));
      if (!next) return;
      this.state.story.completed.push(next.id);
      // Efeitos antes do aviso: quem escuta já sabe que uma fala foi aberta (o HUD espera ela acabar).
      next.effects.forEach((e) => this.applyEffect(e));
      this.bus.emit('story.beat_completed', { beatId: next.id });
    }
    throw new Error('História em laço infinito');
  }

  private applyEffect(effect: Effect): void {
    if ('dialogue' in effect) this.bus.emit('dialogue.requested', { dialogueId: effect.dialogue });
    else if ('cutscene' in effect) this.bus.emit('cutscene.requested', { cutsceneId: effect.cutscene });
    else if ('shelterCat' in effect) {
      const id = effect.shelterCat;
      this.state.cats[id] = { sheltered: true, name: this.content.cats[id]?.name ?? '', map: this.content.map.id };
      this.bus.emit('cat.sheltered', { catId: id });
    } else if ('giveItem' in effect) {
      this.state.inventory[effect.giveItem] = (this.state.inventory[effect.giveItem] ?? 0) + 1;
      this.bus.emit('item.received', { itemId: effect.giveItem });
    }
    else if ('setFlag' in effect) this.state.flags[effect.setFlag] = true;
    else if ('addMoney' in effect) this.addMoney(effect.addMoney, 'story');
  }

  /** Soma (ou desconta) dinheiro. Usado pela história, pelas compras e pelo modo debug. */
  addMoney(delta: number, reason: string): void {
    const from = this.state.money;
    this.state.money = from + delta;
    this.bus.emit('money.changed', { from, to: this.state.money, reason });
  }

  private removeFromInventory(itemId: string): void {
    const left = (this.state.inventory[itemId] ?? 0) - 1;
    if (left > 0) this.state.inventory[itemId] = left;
    else delete this.state.inventory[itemId];
  }
}
