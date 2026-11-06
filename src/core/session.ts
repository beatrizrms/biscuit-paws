// Sessão de jogo: o único lugar que muda o estado. O Phaser chama estas ações
// e escuta os eventos. Puro: sem Phaser, DOM ou window.
import type { Content, Effect } from './content';
import { EventBus } from './events';
import type { Cell, MapData, SurfaceDef } from './map';
import { placedItemAt, placementProblem, withPlaced, type PlaceProblem } from './placement';
import type { GameState } from './state';
import { activeBeats, currentGoals, isBeatSatisfied, type GoalView } from './story';

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

  /** Mapa do café com a reforma do pintor e os móveis da jogadora. */
  mapData(): MapData {
    const base = this.content.map;
    const legend = { ...base.legend };
    for (const surface of base.surfaces ?? []) {
      const finish = this.content.finishes[this.state.finishes[surface.id] ?? ''];
      if (finish) legend[surface.legend] = finish.tile;
    }
    return withPlaced({ ...base, legend }, this.state.placed, this.content.items);
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
    if (!this.content.items[itemId]) return { ok: false, reason: 'unknown_item' };
    if ((this.state.inventory[itemId] ?? 0) < 1) return { ok: false, reason: 'not_in_inventory' };
    this.removeFromInventory(itemId);
    const amount = this.refundValue(itemId);
    this.addMoney(amount, `refund:${itemId}`);
    this.bus.emit('item.refunded', { itemId, amount });
    this.advanceStory();
    return { ok: true };
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
    return currentGoals(this.content.story, this.state, this.content.items);
  }

  /** Compra um item: desconta o preço e põe no inventário. */
  buy(itemId: string): ActionResult {
    const item = this.content.items[itemId];
    if (!item || item.deprecated) return { ok: false, reason: 'unknown_item' };
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
      const next = activeBeats(this.content.story, this.state).find((b) => isBeatSatisfied(b, this.state, this.content.items));
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
