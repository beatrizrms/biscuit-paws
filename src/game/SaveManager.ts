// Saves no armazenamento (src/platform/storage): 3 slots manuais + autosave, com backup da versão anterior,
// restaurar, apagar, exportar e importar. A validação é do núcleo (src/core/saveSlots).
import { knownIds, serializeSave } from '../core/save';
import {
  ALL_SLOTS,
  AUTO_SLOT,
  backupKey,
  inspectSave,
  mostRecent,
  readSave,
  type ManualSlot,
  type ReadResult,
  type SlotId,
  type SlotStatus,
} from '../core/saveSlots';
import type { GameState } from '../core/state';
import type { Storage } from '../platform/storage';
import { content } from './content';

/** Qual slot manual o autosave representa (para "Continuar" pelo autosave voltar ao mesmo slot). */
const AUTO_ORIGIN = 'auto.origin';
/** Último slot manual usado. */
const CURRENT = 'current-slot';

export class SaveManager {
  private known = knownIds(content);

  /** `prefix`: o modo debug usa slots próprios ("debug-"), para os truques não estragarem os saves de verdade. */
  constructor(
    private storage: Storage,
    private prefix = '',
  ) {}

  private key(k: string): string {
    return this.prefix + k;
  }

  /** Saves de antes dos slots: o modo debug guardava em "slot-debug"; vira o slot 1 do debug. */
  async migrateLegacy(): Promise<void> {
    if (!this.prefix) return; // o save normal já se chamava "slot1"
    const legacy = await this.storage.load('slot-debug');
    if (legacy && !(await this.storage.load(this.key('slot1')))) await this.storage.save(this.key('slot1'), legacy);
  }

  async status(slot: SlotId): Promise<SlotStatus> {
    return inspectSave(await this.storage.load(this.key(slot)), this.known);
  }

  async statuses(): Promise<Record<SlotId, SlotStatus>> {
    const entries = await Promise.all(ALL_SLOTS.map(async (s) => [s, await this.status(s)] as const));
    return Object.fromEntries(entries) as Record<SlotId, SlotStatus>;
  }

  /** O save mais recente que está bom (para "Continuar"). */
  async mostRecent(): Promise<SlotId | null> {
    return mostRecent(await this.statuses());
  }

  async hasBackup(slot: SlotId): Promise<boolean> {
    return inspectSave(await this.storage.load(this.key(backupKey(slot))), this.known).kind === 'ok';
  }

  /** Lê um slot (com migrações). Não joga erro: corrompido volta como { ok: false }. */
  async read(slot: SlotId): Promise<ReadResult> {
    const json = await this.storage.load(this.key(slot));
    if (!json) return { ok: false, error: 'vazio' };
    return readSave(json, this.known);
  }

  /** Grava o estado num slot; a versão que estava lá antes vira o backup. */
  async write(slot: SlotId, state: GameState, now = new Date()): Promise<void> {
    await this.writeJson(slot, serializeSave(state, now));
  }

  private async writeJson(slot: SlotId, json: string): Promise<void> {
    const previous = await this.storage.load(this.key(slot));
    if (previous && previous !== json) await this.storage.save(this.key(backupKey(slot)), previous);
    await this.storage.save(this.key(slot), json);
  }

  /** Autosave: grava no slot de autosave, lembrando de qual slot manual é a partida. Sem backup (grava o tempo todo). */
  async autosave(state: GameState, origin: ManualSlot, now = new Date()): Promise<void> {
    await this.storage.save(this.key(AUTO_SLOT), serializeSave(state, now));
    await this.storage.save(this.key(AUTO_ORIGIN), origin);
  }

  /** De qual slot manual veio o autosave (padrão: slot 1). */
  async autoOrigin(): Promise<ManualSlot> {
    const v = await this.storage.load(this.key(AUTO_ORIGIN));
    return v === 'slot2' || v === 'slot3' ? v : 'slot1';
  }

  async currentSlot(): Promise<ManualSlot> {
    const v = await this.storage.load(this.key(CURRENT));
    return v === 'slot2' || v === 'slot3' ? v : 'slot1';
  }

  async setCurrentSlot(slot: ManualSlot): Promise<void> {
    await this.storage.save(this.key(CURRENT), slot);
  }

  /** Volta o backup para o slot (o save atual, se existir, vira o novo backup: dá para desfazer). */
  async restoreBackup(slot: SlotId): Promise<boolean> {
    const bak = await this.storage.load(this.key(backupKey(slot)));
    if (!bak || inspectSave(bak, this.known).kind !== 'ok') return false;
    const current = await this.storage.load(this.key(slot));
    await this.storage.save(this.key(slot), bak);
    if (current) await this.storage.save(this.key(backupKey(slot)), current);
    return true;
  }

  /** Apaga o slot e o backup dele. */
  async remove(slot: SlotId): Promise<void> {
    await this.storage.remove(this.key(slot));
    await this.storage.remove(this.key(backupKey(slot)));
    if (slot === AUTO_SLOT) await this.storage.remove(this.key(AUTO_ORIGIN));
  }

  /** O save do slot como texto, para baixar num arquivo .json. */
  async exportJson(slot: SlotId): Promise<string | null> {
    return this.storage.load(this.key(slot));
  }

  /** Importa um arquivo para o slot: só aceita save válido (o que estava lá vira backup). */
  async importJson(slot: SlotId, json: string): Promise<{ ok: true } | { ok: false; error: string }> {
    const r = readSave(json, this.known);
    if (!r.ok) return { ok: false, error: r.error };
    await this.writeJson(slot, json);
    return { ok: true };
  }
}
