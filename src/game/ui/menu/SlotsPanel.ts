// Tela de slots. "load": carregar, restaurar backup, exportar, importar e apagar (com confirmação).
// "new": escolher o slot do jogo novo (confirma antes de sobrescrever um slot ocupado).
// Save corrompido não trava: aparece como "corrompido" com restaurar backup ou apagar.
import { AUTO_SLOT, MANUAL_SLOTS, type ManualSlot, type SlotId, type SlotStatus } from '../../../core/saveSlots';
import { downloadText, pickTextFile } from '../../../platform/files';
import { gameInfo, t } from '../../i18n';
import { services } from '../../services';
import { confirmBox, esc, menuToast, popLayer, pushLayer, slotName, slotText, type MenuLayer } from './MenuKit';

export interface SlotsHandlers {
  /** Jogar um slot (modo load). */
  onPlay(slot: SlotId): void;
  /** Começar o jogo novo neste slot (modo new, já confirmado). */
  onNewGame(slot: ManualSlot): void;
  onClose?(): void;
}

export function openSlots(root: HTMLElement, mode: 'load' | 'new', handlers: SlotsHandlers): void {
  const { saves } = services();
  const el = document.createElement('div');
  el.className = 'menu-layer';
  root.appendChild(el);
  const layer: MenuLayer = { el, onBack: () => close() };
  const close = () => {
    popLayer(layer);
    handlers.onClose?.();
  };
  const slots: SlotId[] = mode === 'load' ? [...MANUAL_SLOTS, AUTO_SLOT] : [...MANUAL_SLOTS];

  const render = async (focusSlot?: SlotId) => {
    const statuses = await saves.statuses();
    const backups = Object.fromEntries(await Promise.all(slots.map(async (s) => [s, await saves.hasBackup(s)] as const))) as Record<SlotId, boolean>;
    const card = (slot: SlotId, status: SlotStatus) => {
      const { line, date } = slotText(status);
      const b = (action: string, label: string, extra = '') => `<button class="menu-btn small" data-action="${action}" data-slot="${slot}" ${extra}>${esc(label)}</button>`;
      const actions: string[] = [];
      if (mode === 'new') actions.push(b('new', t('slots.useSlot')));
      else {
        if (status.kind === 'ok') actions.push(b('play', t('slots.play')));
        if (backups[slot]) actions.push(b('restore', t('slots.restore')));
        if (status.kind === 'ok') actions.push(b('export', t('slots.export')));
        if (slot !== AUTO_SLOT) actions.push(b('import', t('slots.import')));
        if (status.kind !== 'empty') actions.push(b('delete', t('slots.delete')));
      }
      return `<div class="menu-slot ${status.kind}">
        <div class="slot-head"><b>${esc(slotName(slot))}</b>${backups[slot] && mode === 'load' ? `<span class="tag">${t('slot.backup')}</span>` : ''}</div>
        <div class="slot-line">${esc(line)}</div>
        ${date ? `<div class="slot-date">${esc(date)}</div>` : ''}
        ${status.kind === 'corrupt' ? `<div class="slot-warn">${t('slots.corruptHelp')}</div>` : ''}
        <div class="menu-row">${actions.join('')}</div>
      </div>`;
    };
    el.innerHTML = `<div class="menu-panel slots">
      <h2>${t(mode === 'load' ? 'slots.titleLoad' : 'slots.titleNew')}</h2>
      ${slots.map((s) => card(s, statuses[s])).join('')}
      <div class="menu-row"><button class="menu-btn back">${t('slots.back')}</button></div>
    </div>`;
    (el.querySelector('.back') as HTMLElement).addEventListener('click', close);
    el.querySelectorAll<HTMLButtonElement>('[data-action]').forEach((btn) =>
      btn.addEventListener('click', () => void act(btn.dataset.action!, btn.dataset.slot as SlotId, statuses)),
    );
    const focus = focusSlot ? el.querySelector<HTMLElement>(`[data-slot="${focusSlot}"]`) : null;
    (focus ?? el.querySelector<HTMLElement>('[data-action]'))?.focus();
  };

  const act = async (action: string, slot: SlotId, statuses: Record<SlotId, SlotStatus>) => {
    const name = slotName(slot);
    if (action === 'play') {
      popLayer(layer);
      handlers.onPlay(slot);
    } else if (action === 'new') {
      if (statuses[slot].kind !== 'empty' && !(await confirmBox(root, t('confirm.overwrite', { slot: name })))) return;
      popLayer(layer);
      handlers.onNewGame(slot as ManualSlot);
    } else if (action === 'restore') {
      if (!(await confirmBox(root, t('confirm.restore', { slot: name })))) return;
      if (await saves.restoreBackup(slot)) menuToast(root, t('slots.restored', { slot: name }));
      await render(slot);
    } else if (action === 'delete') {
      if (!(await confirmBox(root, t('confirm.delete', { slot: name })))) return;
      await saves.remove(slot);
      menuToast(root, t('slots.deleted', { slot: name }));
      await render(slot);
    } else if (action === 'export') {
      const json = await saves.exportJson(slot);
      if (!json) return;
      const day = statuses[slot].kind === 'ok' ? `-dia${statuses[slot].summary.day}` : '';
      downloadText(`${gameInfo.title.toLowerCase().replace(/\W+/g, '-')}-${slot}${day}.json`, json);
      menuToast(root, t('slots.exported', { slot: name }));
    } else if (action === 'import') {
      const json = await pickTextFile();
      if (json === null) return;
      if (statuses[slot].kind !== 'empty' && !(await confirmBox(root, t('confirm.importOver', { slot: name })))) return;
      const r = await saves.importJson(slot, json);
      menuToast(root, r.ok ? t('slots.importOk', { slot: name }) : t('slots.importInvalid', { error: r.error }));
      await render(slot);
    }
  };

  pushLayer(layer);
  void render();
}
