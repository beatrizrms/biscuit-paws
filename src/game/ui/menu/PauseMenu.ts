// Pausa dentro do jogo (Esc): Continuar, Opções, Salvar, Voltar ao menu.
import { t } from '../../i18n';
import { confirmBox, popLayer, pushLayer, type MenuLayer } from './MenuKit';
import { openOptions } from './OptionsPanel';

export interface PauseHandlers {
  save(): Promise<string>;
  toMenu(): Promise<void>;
  onClose(): void;
}

export function openPause(root: HTMLElement, handlers: PauseHandlers): () => void {
  const el = document.createElement('div');
  el.className = 'menu-layer menu-pause';
  el.innerHTML = `<div class="menu-panel pause"><h2>${t('pause.title')}</h2>
    <button class="menu-btn big" data-act="resume">${t('pause.resume')}</button>
    <button class="menu-btn big" data-act="options">${t('pause.options')}</button>
    <button class="menu-btn big" data-act="save">${t('pause.save')}</button>
    <button class="menu-btn big" data-act="menu">${t('pause.toMenu')}</button>
    <p class="menu-note saved"></p></div>`;
  root.appendChild(el);
  const layer: MenuLayer = { el, onBack: () => close() };
  const close = () => {
    popLayer(layer);
    handlers.onClose();
  };
  const on = (act: string, fn: () => void) => (el.querySelector(`[data-act="${act}"]`) as HTMLElement).addEventListener('click', fn);
  on('resume', close);
  on('options', () => openOptions(root));
  on('save', () =>
    void handlers.save().then((slot) => {
      (el.querySelector('.saved') as HTMLElement).textContent = t('pause.saved', { slot });
    }),
  );
  on('menu', () =>
    void confirmBox(root, t('confirm.toMenu')).then((yes) => {
      if (yes) void handlers.toMenu();
    }),
  );
  pushLayer(layer);
  return close;
}
