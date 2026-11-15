// "Como jogar" (menu inicial e pausa): os controles, na versão do controle em uso (teclado ou toque), com um botão
// para ver a outra; e os itens que precisam estar ativos na barra. Os textos ficam em data/i18n (howTo), cada linha
// como "controle | o que faz". Os textos do jogo não falam de tecla nem de clique: é aqui que isso mora.
import { t, tList } from '../../i18n';
import { touch } from '../../touch';
import { esc, popLayer, pushLayer, type MenuLayer } from './MenuKit';

type Mode = 'keys' | 'touch';

function rows(key: string): string {
  return tList(key)
    .map((line) => {
      const [control, what] = line.split('|').map((s) => s.trim());
      return `<li><b>${esc(control ?? '')}</b><span>${esc(what ?? '')}</span></li>`;
    })
    .join('');
}

export function openHowTo(root: HTMLElement, onClose?: () => void): void {
  const el = document.createElement('div');
  el.className = 'menu-layer';
  let mode: Mode = touch.mode === 'touch' ? 'touch' : 'keys';
  const render = () => {
    const other: Mode = mode === 'touch' ? 'keys' : 'touch';
    el.innerHTML = `<div class="menu-panel howto"><h2>${t('howTo.title')}</h2>
      <p class="howto-mode">${t(mode === 'touch' ? 'howTo.touchTitle' : 'howTo.keysTitle')}</p>
      <ul class="howto-list">${rows(mode === 'touch' ? 'howTo.touch' : 'howTo.keys')}</ul>
      <p class="howto-mode">${t('howTo.activeTitle')}</p>
      <ul class="howto-list">${rows('howTo.active')}</ul>
      <div class="menu-row"><button class="menu-btn switch">${t(other === 'touch' ? 'howTo.showTouch' : 'howTo.showKeys')}</button>
      <button class="menu-btn close">${t('howTo.close')}</button></div></div>`;
    (el.querySelector('.close') as HTMLElement).addEventListener('click', close);
    (el.querySelector('.switch') as HTMLElement).addEventListener('click', () => {
      mode = other;
      render();
      (el.querySelector('.switch') as HTMLElement | null)?.focus();
    });
  };
  root.appendChild(el);
  const layer: MenuLayer = { el, onBack: () => close() };
  const close = () => {
    popLayer(layer);
    onClose?.();
  };
  render();
  pushLayer(layer);
  // O foco vai para um botão do fim e o painel rolava até ele: abre sempre do topo (o título à vista).
  window.setTimeout(() => el.querySelector('.howto')?.scrollTo({ top: 0 }), 20);
}
