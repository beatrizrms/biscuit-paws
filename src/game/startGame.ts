// Começa uma partida (nova ou carregada) num slot e liga os saves: autosave contínuo (com intervalo mínimo)
// e o slot manual no fim de cada dia e quando a jogadora escolhe "Salvar" na pausa.
import type Phaser from 'phaser';
import { GameSession } from '../core/session';
import { AUTO_SLOT, type ManualSlot, type SlotId } from '../core/saveSlots';
import { newGameState, type PlayerState } from '../core/state';
import { buildPlayerTextures } from './playerLook';
import { content } from './content';
import { services } from './services';

/** Intervalo mínimo entre autosaves (ms). */
const AUTOSAVE_MS = 1500;

export type StartRequest =
  /** Jogo novo no slot (já confirmado se ele estava ocupado), com o nome e a aparência do criador. */
  | { mode: 'new'; slot: ManualSlot; player?: PlayerState }
  /** Carrega um slot (o autosave volta ao slot manual de origem). */
  | { mode: 'load'; from: SlotId };

export type StartResult = { ok: true } | { ok: false; error: string };

export async function startGame(scene: Phaser.Scene, req: StartRequest): Promise<StartResult> {
  const { saves } = services();
  let session: GameSession;
  let slot: ManualSlot;
  let isNew = false;
  if (req.mode === 'new') {
    slot = req.slot;
    const state = newGameState(content.economy.startingMoney, content.world.startMap);
    if (req.player) state.player = { ...req.player };
    session = new GameSession(content, state);
    isNew = true;
    await saves.write(slot, session.state);
  } else {
    const r = await saves.read(req.from);
    if (!r.ok) return { ok: false, error: r.error };
    r.warnings.forEach((w) => console.warn(`[save] ${w}`));
    session = new GameSession(content, r.state);
    slot = req.from === AUTO_SLOT ? await saves.autoOrigin() : req.from;
  }
  // A personagem: junta as camadas da aparência (caminhada e poses) antes de abrir o mundo.
  await buildPlayerTextures(scene, session.appearance());
  await saves.setCurrentSlot(slot);
  attachSaving(session, slot);
  // Veio da Home (ela clicou em Continuar/Jogar): o F5 já passou pelo menu, então o jogo não abre pausado.
  scene.scene.start('World', { session, isNew, slot, fromHome: scene.scene.key === 'MainMenu' });
  return { ok: true };
}

/** Autosave a cada mudança (no máximo um a cada AUTOSAVE_MS) e o slot manual no fim do dia. */
function attachSaving(session: GameSession, slot: ManualSlot): void {
  const { saves } = services();
  let timer: number | null = null;
  let dirty = false;
  const flush = () => {
    timer = null;
    if (!dirty) return;
    dirty = false;
    void saves.autosave(session.state, slot);
  };
  session.bus.onAny((name) => {
    if (name === 'dialogue.requested') return;
    dirty = true;
    if (timer === null) {
      flush();
      dirty = false;
      timer = window.setTimeout(flush, AUTOSAVE_MS);
    }
  });
  session.bus.on('day.ended', () => void saves.write(slot, session.state));
  // Fechou ou recarregou a página: grava o que ainda estava esperando o intervalo (o localStorage grava na hora).
  window.addEventListener('pagehide', () => {
    if (dirty) void saves.autosave(session.state, slot);
  });
}

/** Salva agora no slot manual (pausa: "Salvar"; antes de voltar ao menu). */
export async function saveNow(session: GameSession, slot: ManualSlot): Promise<void> {
  const { saves } = services();
  await saves.write(slot, session.state);
  await saves.autosave(session.state, slot);
}
