// Motor da história: avalia condições e diz quais marcos e metas estão ativos.
// Puro: sem Phaser, DOM ou window. Quem aplica os efeitos é a GameSession.
import type { Beat, Condition, ItemDef, StoryData } from './content';
import { ownedCount, placedCount, type GameState } from './state';

export function evaluate(c: Condition, state: GameState, items: Record<string, ItemDef>): boolean {
  if ('all' in c) return c.all.every((x) => evaluate(x, state, items));
  if ('any' in c) return c.any.some((x) => evaluate(x, state, items));
  if ('not' in c) return !evaluate(c.not, state, items);
  if ('flag' in c) return state.flags[c.flag] === true;
  if ('beat' in c) return state.story.completed.includes(c.beat);
  if ('placedTag' in c) {
    const count = state.placed.filter((p) => items[p.item]?.tags.includes(c.placedTag)).length;
    return count >= (c.gte ?? 1);
  }
  if ('placed' in c) return placedCount(state, c.placed) >= (c.gte ?? 1);
  if ('owned' in c) return ownedCount(state, c.owned) >= (c.gte ?? 1);
  if ('money' in c) return state.money >= c.money.gte;
  throw new Error(`Condição desconhecida: ${JSON.stringify(c)}`);
}

const isCompleted = (beat: Beat, state: GameState) => state.story.completed.includes(beat.id);

/** Marcos liberados (todos os "after" concluídos) e ainda não concluídos, na ordem do arquivo. */
export function activeBeats(story: StoryData, state: GameState): Beat[] {
  return story.beats.filter(
    (b) => !isCompleted(b, state) && (b.after ?? []).every((dep) => state.story.completed.includes(dep)),
  );
}

/** Um marco ativo termina quando a condição e todos os passos da meta valem. */
export function isBeatSatisfied(beat: Beat, state: GameState, items: Record<string, ItemDef>): boolean {
  const stepsDone = (beat.goal?.steps ?? []).every((s) => evaluate(s.when, state, items));
  return stepsDone && (beat.when ? evaluate(beat.when, state, items) : true);
}

export interface GoalView {
  beatId: string;
  title: string;
  steps: { text: string; done: boolean; devNote?: string }[];
}

/** Metas para mostrar no diário. */
export function currentGoals(story: StoryData, state: GameState, items: Record<string, ItemDef>): GoalView[] {
  return activeBeats(story, state)
    .filter((b) => b.goal)
    .map((b) => ({
      beatId: b.id,
      title: b.goal!.title,
      steps: b.goal!.steps.map((s) => ({ text: s.text, done: evaluate(s.when, state, items), devNote: s.devNote })),
    }));
}
