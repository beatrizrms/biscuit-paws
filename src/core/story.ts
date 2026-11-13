// Motor da história: avalia condições e diz quais marcos e metas estão ativos.
// Puro: sem Phaser, DOM ou window. Quem aplica os efeitos é a GameSession.
import type { Beat, Condition, ItemDef, StoryData } from './content';
import type { DirtSpot } from './map';
import { deliveredCount, nowAbs, ownedCount, placedCount, type GameState } from './state';
import { parseClock } from './time';
import { stageAtLeast } from './business';
import { isRenovated } from './construction';
import { atLeast as roomAtLeast, roomState, type RoomsData } from './rooms';
import { firstDayOf, type SeasonsData, seasonOf } from './calendar';

/** O que as condições precisam saber além do estado. */
export interface StoryContext {
  items: Record<string, ItemDef>;
  /** Sujeira do café (toda, limpa ou não). */
  dirt: DirtSpot[];
  /** Superfícies que a reforma precisa (data/business.json). */
  requiredSurfaces: readonly string[];
  /** Cômodos (estado inicial de quem o save ainda não mudou). */
  rooms: RoomsData;
  /** Calendário (condição fromSeason). */
  seasons: SeasonsData;
  /** O selo vale agora, mesmo que a conferida ainda não tenha anotado (condição milestone). */
  milestoneMet?: (id: string) => boolean;
  /** Quantos gatos podem ir à feira de adoção agora (condição fairCats). */
  fairCats?: () => number;
  /** O evento de hoje já está montado: placa, decoração e a feira nos caixotes (condição festivalMounted). */
  festivalMounted?: () => boolean;
  /** O amigo vem para o amigo secreto deste ano (condição santaGuest). */
  santaGuest?: (npc: string) => boolean;
  /** O amigo vem para a festa de Halloween deste ano (condição halloweenGuest). */
  halloweenGuest?: (npc: string) => boolean;
  /** O cômodo do café em que ela está agora (fora do café ou sem posição: undefined). */
  playerRoom?: () => string | undefined;
}

/** Esta sujeira (das que saem com faxina) já foi limpa? "*" = toda a do salão (saves antigos; cômodos novos não contam). */
export function isCleaned(state: GameState, d: DirtSpot): boolean {
  return state.cleaned.includes(d.id) || (state.cleaned.includes('*') && !d.tags.includes('room') && !d.when);
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
  // Comprado = na bolsa, posicionado ou já encomendado pelo correio.
  // Item que não fica na mochila (a chave da padaria) conta pela marca de que chegou.
  if ('owned' in c) return ownedCount(state, c.owned) + deliveredCount(state, c.owned) + (state.flags[`received.${c.owned}`] ? 1 : 0) >= (c.gte ?? 1);
  if ('money' in c) return state.money >= c.money.gte;
  if ('day' in c) return state.day >= c.day.gte;
  if ('clock' in c) return state.time >= parseClock(c.clock.gte);
  if ('location' in c) return state.location === c.location;
  if ('menu' in c) return state.menu.length >= c.menu.gte;
  if ('served' in c) return state.service.served >= c.served.gte;
  if ('santaGuest' in c) return !!ctx.santaGuest?.(c.santaGuest);
  if ('halloweenGuest' in c) return !!ctx.halloweenGuest?.(c.halloweenGuest);
  if ('playerRoom' in c) return ctx.playerRoom?.() === c.playerRoom;
  if ('carryingCat' in c) return state.hands.some((h) => h.kind === 'cat');
  if ('season' in c) return seasonOf(ctx.seasons, state.day) === c.season;
  if ('milestone' in c) return state.milestones.reached[c.milestone] !== undefined || !!ctx.milestoneMet?.(c.milestone);
  if ('daysSince' in c) {
    const on = state.story.completedOn[c.daysSince.beat];
    return on !== undefined && state.day - on >= c.daysSince.gte;
  }
  if ('nextDay' in c) {
    if (!state.story.completed.includes(c.nextDay)) return false;
    return state.day > (state.story.completedOn[c.nextDay] ?? 0);
  }
  if ('timer' in c) return state.timers[c.timer] !== undefined && nowAbs(state) >= state.timers[c.timer]!;
  if ('ownedTag' in c) {
    const tagged = Object.values(ctx.items).filter((i) => i.tags.includes(c.ownedTag));
    return tagged.reduce((n, i) => n + ownedCount(state, i.id) + deliveredCount(state, i.id), 0) >= (c.gte ?? 1);
  }
  if ('received' in c) return ownedCount(state, c.received) >= 1;
  if ('delivery' in c) return ownedCount(state, c.delivery) + deliveredCount(state, c.delivery, c.stage) >= (c.gte ?? 1);
  if ('deliveryTag' in c) {
    const tagged = Object.values(ctx.items).filter((i) => i.tags.includes(c.deliveryTag));
    return tagged.reduce((n, i) => n + ownedCount(state, i.id) + deliveredCount(state, i.id, c.stage), 0) >= (c.gte ?? 1);
  }
  if ('business' in c) return stageAtLeast(state.business, c.business);
  if ('renovated' in c) return isRenovated(state.construction);
  if ('room' in c) return roomAtLeast(roomState(ctx.rooms, state, c.room), c.atLeast);
  if ('fromSeason' in c) return state.day >= firstDayOf(ctx.seasons, c.fromSeason);
  if ('festivalToday' in c) {
    const f = state.festivals;
    return (f.active?.id === c.festivalToday && f.active.day === state.day) || (f.heldOn?.id === c.festivalToday && f.heldOn.day === state.day);
  }
  if ('cats' in c) return Object.values(state.cats).filter((x) => x.sheltered).length >= c.cats.gte;
  if ('fairCats' in c) return (ctx.fairCats?.() ?? 0) >= c.fairCats.gte;
  if ('festivalMounted' in c) return ctx.festivalMounted?.() ?? false;
  if ('catsReady' in c) {
    const cats = Object.values(state.cats).filter((x) => x.sheltered);
    return cats.length > 0 && cats.every((x) => !x.sickness && x.repro?.known === 'neutered');
  }
  throw new Error(`Condição desconhecida: ${JSON.stringify(c)}`);
}

const isCompleted = (beat: Beat, state: GameState) => state.story.completed.includes(beat.id);

/**
 * Marcos ativos, na ordem do arquivo: não concluídos, com todos os "after" concluídos e o "start" valendo.
 * Um marco exclusivo ativo segura os seguintes (uma quest por vez).
 */
export function activeBeats(story: StoryData, state: GameState, ctx: StoryContext): Beat[] {
  const active: Beat[] = [];
  for (const b of story.beats) {
    if (isCompleted(b, state)) continue;
    if (!(b.after ?? []).every((dep) => state.story.completed.includes(dep))) continue;
    if (b.start && !evaluate(b.start, state, ctx)) continue;
    active.push(b);
    if (b.exclusive) break;
  }
  return active;
}

/** Um marco ativo termina quando a condição e todos os passos da meta valem. */
export function isBeatSatisfied(beat: Beat, state: GameState, ctx: StoryContext): boolean {
  const stepsDone = (beat.goal?.steps ?? []).every((s) => evaluate(s.when, state, ctx));
  return stepsDone && (beat.when ? evaluate(beat.when, state, ctx) : true);
}

export interface GoalView {
  beatId: string;
  title: string;
  /** Passos sem ordem (qualquer um primeiro): o balão mostra todos iguais, sem um em destaque. */
  together?: boolean;
  /** progress: [feitos, total] quando o passo conta coisas (ex.: teias limpas). */
  /** waitUntil: momento absoluto em que o passo conclui sozinho (o balão oferece "Esperar"). */
  /** doneToday: o passo é de todo dia (doses) e o de hoje já foi; não há o que fazer agora. */
  steps: { text: string; done: boolean; detail?: string; icon?: string; devNote?: string; progress?: [number, number]; doneToday?: boolean; waitUntil?: number }[];
}

/** Quanto de um passo já foi feito, quando dá para contar (hoje: faxina). */
function progressOf(c: Condition, state: GameState, ctx: StoryContext): [number, number] | undefined {
  if (!('cleaned' in c)) return undefined;
  const spots = ctx.dirt.filter((d) => !d.clearedBy && d.tags.includes(c.cleaned));
  return [spots.filter((d) => isCleaned(state, d)).length, spots.length];
}

/** Metas para mostrar no diário. */
export function currentGoals(story: StoryData, state: GameState, ctx: StoryContext): GoalView[] {
  return activeBeats(story, state, ctx)
    .filter((b) => b.goal)
    .map((b) => ({
      beatId: b.id,
      title: b.goal!.title,
      ...(b.goal!.together ? { together: true } : {}),
      steps: b.goal!.steps.map((s) => {
        // Receita de um gato: as doses dadas de todas, e se a de hoje já foi.
        const treatment = s.doses ? state.cats[s.doses]?.sickness?.treatment : undefined;
        return {
          text: s.text,
          done: evaluate(s.when, state, ctx),
          ...(s.detail ? { detail: s.detail } : {}),
          ...(s.icon ? { icon: s.icon } : {}),
          devNote: s.devNote,
          progress: treatment ? ([treatment.dosesGiven, treatment.days] as [number, number]) : progressOf(s.when, state, ctx),
          ...(treatment ? { doneToday: treatment.lastDoseDay === state.day } : {}),
          waitUntil: 'timer' in s.when ? state.timers[s.when.timer] : undefined,
        };
      }),
    }));
}
