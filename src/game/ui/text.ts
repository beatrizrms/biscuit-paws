// Marcadores nos textos dos dados: {player} (nome da protagonista), {cat:cat.id} (nome do gato), {timer:id} (hora marcada), {daysUntil:spring} (dias até a estação),
// {arrival:condition} / {arrival:personality} / {arrival:npc} (a chegada de gato em andamento: como chega, o jeito, quem trouxe).
import type { GameSession } from '../../core/session';
import { formatClock } from '../../core/time';
import { uiText } from '../content';

export function fillNames(session: GameSession, text: string): string {
  const name = session.playerName();
  return text
    // Save de antes do criador (sem nome): o vocativo some com a vírgula ("Cheguei, {player}!" -> "Cheguei!").
    .replace(/,\s*\{player\}/g, (m) => (name ? m : ''))
    .replace(/\{player\}/g, () => name || uiText.playerFallback)
    .replace(/\{cat:([\w.]+)\}/g, (_, id: string) => session.catName(id))
    .replace(/\{arrival:(\w+)\}/g, (_, what: string) => arrivalText(session, what))
    .replace(/\{daysUntil:(\w+)\}/g, (_, season: string) => String(session.daysUntil(season)))
    .replace(/\{timer:([\w.]+)\}/g, (_, id: string) => {
      const t = session.timerClock(id);
      return t === undefined ? '' : formatClock(t, 5);
    });
}

/** Texto da chegada em andamento: condição e jeito (em minúscula: entram no meio da frase) ou o vizinho que trouxe. */
function arrivalText(session: GameSession, what: string): string {
  const a = session.arrivals.active();
  if (!a) return '';
  if (what === 'condition') return (uiText.cats.conditions[a.condition as keyof typeof uiText.cats.conditions] ?? '').toLowerCase();
  if (what === 'personality') {
    const p = session.catDef(a.catId)?.personality ?? '';
    return (uiText.cats.personalities[p as keyof typeof uiText.cats.personalities] ?? '').toLowerCase();
  }
  if (what === 'npc') return session.content.npcs[a.def.result?.npc?.id ?? '']?.name ?? '';
  return '';
}
