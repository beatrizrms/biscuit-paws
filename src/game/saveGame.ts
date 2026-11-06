// Liga a sessão ao armazenamento: carrega no começo e salva a cada mudança.
import { parseSave, serializeSave } from '../core/save';
import { GameSession } from '../core/session';
import { newGameState } from '../core/state';
import type { Storage } from '../platform/storage';
import { content } from './content';

/** Carrega o save (ou começa um jogo novo) e passa a salvar automaticamente. */
export async function openSession(
  storage: Storage,
  slot: string,
  forceNew = false,
): Promise<{ session: GameSession; isNew: boolean }> {
  if (forceNew) await storage.remove(slot);
  const json = await storage.load(slot);
  let session: GameSession | null = null;

  if (json) {
    try {
      const { state, warnings } = parseSave(json, new Set(Object.keys(content.items)));
      warnings.forEach((w) => console.warn(`[save] ${w}`));
      session = new GameSession(content, state);
    } catch (e) {
      // Save ilegível: não apaga; guarda uma cópia e começa de novo.
      console.error('[save] não foi possível carregar; começando um jogo novo', e);
      await storage.save(`${slot}.broken-${Date.now()}`, json);
    }
  }
  const isNew = session === null;
  session ??= new GameSession(content, newGameState(content.economy.startingMoney));

  session.bus.onAny((name) => {
    if (name === 'dialogue.requested') return;
    void storage.save(slot, serializeSave(session.state, new Date()));
  });
  return { session, isNew };
}
