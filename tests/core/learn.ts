// Nos testes que montam o estado direto (sem passar os dias): ela aprende de uma vez as receitas que já valem.
import type { GameSession } from '../../src/core/session';

/** As receitas da fila (as que já valem, na época) entram como aprendidas, sem o limite por dia. */
export function learnRecipes(session: GameSession): GameSession {
  for (const r of session.service.recipesToLearn()) session.state.flags[`recipe.known.${r.id}`] = true;
  return session;
}
