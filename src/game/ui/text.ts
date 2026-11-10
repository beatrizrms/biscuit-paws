// Marcadores nos textos dos dados: {g:feminino|masculino} (pelo pronome escolhido no criador), {player} (nome da protagonista), {cat:cat.id} (nome do gato), {timer:id} (hora marcada), {daysUntil:spring} (dias até a estação),
// {santa:name} / {santa:hint} / {santa:giver} (o amigo secreto do ano: quem ela tirou, a dica, quem a tirou),
// {arrival:condition} / {arrival:personality} / {arrival:npc} / {arrival:leader} (a chegada de gato em andamento: como chega,
// o jeito, quem trouxe, o gato do café que guia).
import type { GameSession } from '../../core/session';
import { formatClock } from '../../core/time';
import { genderText } from '../../core/pronoun';
import { uiText } from '../content';

export function fillNames(session: GameSession, text: string): string {
  const name = session.playerName();
  // Gênero primeiro (as formas são texto puro: sem outros marcadores dentro).
  return genderText(text, session.playerPronoun())
    // Save de antes do criador (sem nome): o vocativo some com a vírgula ("Cheguei, {player}!" -> "Cheguei!").
    .replace(/,\s*\{player\}/g, (m) => (name ? m : ''))
    .replace(/\{player\}/g, () => name || uiText.playerFallback)
    .replace(/\{cat:([\w.]+)\}/g, (_, id: string) => session.catName(id))
    .replace(/\{arrival:(\w+)\}/g, (_, what: string) => arrivalText(session, what))
    .replace(/\{santa:(\w+)\}/g, (_, what: string) => santaText(session, what))
    .replace(/\{daysUntil:(\w+)\}/g, (_, season: string) => String(session.daysUntil(season)))
    .replace(/\{timer:([\w.]+)\}/g, (_, id: string) => {
      const t = session.timerClock(id);
      return t === undefined ? '' : formatClock(t, 5);
    });
}

/** Amigo secreto: quem ela tirou ("a Dona Neusa"), a dica do gosto e quem a tirou. */
function santaText(session: GameSession, what: string): string {
  const s = session.secretSanta();
  if (!s) return '';
  if (what === 'name') return s.friend.name;
  if (what === 'hint') return s.friend.hint;
  if (what === 'giver') return session.content.festive.secretSanta.friends.find((f) => f.npc === s.record.giver)?.name ?? '';
  return '';
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
  if (what === 'leader') return a.leaderId ? session.catName(a.leaderId) : '';
  return '';
}
