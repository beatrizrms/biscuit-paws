// Créditos (placeholder simples: as linhas vêm do arquivo de textos).
import { t, tList } from '../../i18n';
import { esc, popLayer, pushLayer, type MenuLayer } from './MenuKit';

export function openCredits(root: HTMLElement, onClose?: () => void): void {
  const el = document.createElement('div');
  el.className = 'menu-layer';
  el.innerHTML = `<div class="menu-panel credits"><h2>${t('credits.title')}</h2>
    ${tList('credits.lines').map((l) => `<p>${esc(l)}</p>`).join('')}
    <div class="menu-row"><button class="menu-btn close">${t('credits.close')}</button></div></div>`;
  root.appendChild(el);
  const layer: MenuLayer = { el, onBack: () => close() };
  const close = () => {
    popLayer(layer);
    onClose?.();
  };
  (el.querySelector('.close') as HTMLElement).addEventListener('click', close);
  pushLayer(layer);
}
