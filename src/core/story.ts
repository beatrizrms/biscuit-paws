// Motor da história: avalia condições e diz quais marcos e metas estão ativos.
// Puro: sem Phaser, DOM ou window. Quem aplica os efeitos é a GameSession.
import type { Beat, Condition, ItemDef, StoryData } from './content';
import type { DirtSpot } from './map';
import { ownedCount, placedCount, type GameState } from './state';

/** O que as condições precisam saber além do estado. */
export interface StoryContext {
  items: Record<string, ItemDef>;
  /** Sujeira do café (toda, limpa ou não). */
  dirt: DirtSpot[];
}

/** Esta sujeira (das que saem com faxina) já foi limpa? "*" = toda (saves antigos). */
export function isCleaned(state: GameState, d: DirtSpot): boolean {
  return state.cleaned.includes(d.id) || state.cleaned.includes('*');
}

export function evaluate(c: Condition, state: GameState, ctx: StoryContext): boolean {
  if ('all' in c) return c.all.every((x) => evaluate(x, state, ctx));
  if ('any' in c) return c.any.some((x) => evaluate(x, state, ctx));
  if ('not' in c) return !evaluate(c.not, state, ctx);
  if ('flag' in c) return state.flags[c.flag] === true;
  if ('beat' in c) return state.story.completed.includes(c.beat);
  if ('visited' in c) return state.visited.includes(c.visited);
  if ('catNamed' in c) return (state.cats[c.catNamed]?.name ?? '') !== '';
  if ('cleaned' in c) return ctx.dirt.filter((d) => !d.clearedBy && d.tags.includes(c.cleaned)).every((d) => isCleaned(state, d));
  if ('placedTag' in c) {
    const count = state.placed.filter((p) => ctx.items[p.item]?.tags.includes(c.placedTag)).length;
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
export function isBeatSatisfied(beat: Beat, state: GameState, ctx: StoryContext): boolean {
  const stepsDone = (beat.goal?.steps ?? []).every((s) => evaluate(s.when, state, ctx));
  return stepsDone && (beat.when ? evaluate(beat.when, state, ctx) : true);
}

export interface GoalView {
  beatId: string;
  title: string;
  /** progress: [feitos, total] quando o passo conta coisas (ex.: teias limpas). */
  steps: { text: string; done: boolean; devNote?: string; progress?: [number, number] }[];
}

/** Quanto de um passo já foi feito, quando dá para contar (hoje: faxina). */
function progressOf(c: Condition, state: GameState, ctx: StoryContext): [number, number] | undefined {
  if (!('cleaned' in c)) return undefined;
  const spots = ctx.dirt.filter((d) => !d.clearedBy && d.tags.includes(c.cleaned));
  return [spots.filter((d) => isCleaned(state, d)).length, spots.length];
}

/** Metas para mostrar no diário. */
export function currentGoals(story: StoryData, state: GameState, ctx: StoryContext): GoalView[] {
  return activeBeats(story, state)
    .filter((b) => b.goal)
    .map((b) => ({
      beatId: b.id,
      title: b.goal!.title,
      steps: b.goal!.steps.map((s) => ({ text: s.text, done: evaluate(s.when, state, ctx), devNote: s.devNote, progress: progressOf(s.when, state, ctx) })),
    }));
}
