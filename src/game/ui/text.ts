// Marcadores nos textos dos dados: {player} (nome da protagonista), {cat:cat.id} (nome do gato), {timer:id} (hora marcada).
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
    .replace(/\{timer:([\w.]+)\}/g, (_, id: string) => {
      const t = session.timerClock(id);
      return t === undefined ? '' : formatClock(t, 5);
    });
}
