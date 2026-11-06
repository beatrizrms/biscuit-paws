// Sessão de jogo: o único lugar que muda o estado. O Phaser chama estas ações
// e escuta os eventos. Puro: sem Phaser, DOM ou window.
import type { Content, Effect } from './content';
import { EventBus } from './events';
import type { Cell, MapData } from './map';
import { placedItemAt, placementProblem, withPlaced, type PlaceProblem } from './placement';
import type { GameState } from './state';
import { activeBeats, currentGoals, isBeatSatisfied, type GoalView } from './story';

export type ActionResult =
  | { ok: true }
  | { ok: false; reason: 'unknown_item' | 'no_money' | 'not_in_inventory' | 'not_found' | PlaceProblem };

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

  /** Mapa do café com os móveis da jogadora. */
  mapData(): MapData {
    return withPlaced(this.content.map, this.state.placed, this.content.items);
  }

  goals(): GoalView[] {
    return currentGoals(this.content.story, this.state, this.content.items);
  }

  /** Compra um item: desconta o preço e põe no inventário. */
  buy(itemId: string): ActionResult {
    const item = this.content.items[itemId];
    if (!item || item.deprecated) return { ok: false, reason: 'unknown_item' };
    if (this.state.money < item.price) return { ok: false, reason: 'no_money' };
    this.changeMoney(-item.price, `buy:${itemId}`);
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
      this.bus.emit('story.beat_completed', { beatId: next.id });
      next.effects.forEach((e) => this.applyEffect(e));
    }
    throw new Error('História em laço infinito');
  }

  private applyEffect(effect: Effect): void {
    if ('dialogue' in effect) this.bus.emit('dialogue.requested', { dialogueId: effect.dialogue });
    else if ('setFlag' in effect) this.state.flags[effect.setFlag] = true;
    else if ('addMoney' in effect) this.changeMoney(effect.addMoney, 'story');
  }

  private changeMoney(delta: number, reason: string): void {
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
