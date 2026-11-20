// "Como jogar" (menu inicial e pausa): os controles em blocos curtos (andar, usar, barra, janelas, móveis), com
// abas para toque, teclado e controle de videogame (abre na do controle em uso), e os itens que precisam estar
// ativos na barra. As teclas e os botões aparecem desenhados. Os textos ficam em data/i18n (howTo), cada linha como
// "controle | o que faz" (mais de um controle: "A / B"). Os textos do jogo não falam de tecla nem de clique: é aqui
// que isso mora.
import { t, tList } from '../../i18n';
import { touch } from '../../touch';
import { esc, popLayer, pushLayer, type MenuLayer } from './MenuKit';

type Mode = 'touch' | 'keys' | 'pad';
const MODES: Mode[] = ['touch', 'keys', 'pad'];
const SECTIONS = ['move', 'use', 'bar', 'windows', 'furniture'] as const;
/** Os botões coloridos do controle (layout do Xbox). */
const FACE = new Set(['A', 'B', 'X', 'Y']);

/** Um controle desenhado: tecla em relevo, botão redondo do controle ou botão de toque. */
function chip(control: string, mode: Mode): string {
  if (mode === 'pad' && FACE.has(control)) return `<kbd class="ht-face ht-${control.toLowerCase()}">${esc(control)}</kbd>`;
  return `<kbd class="ht-${mode}">${esc(control)}</kbd>`;
}

function rows(key: string, mode: Mode): string {
  return tList(key)
    .map((line) => {
      const [controls, what] = line.split('|').map((s) => s.trim());
      const keys = (controls ?? '').split(' / ').map((c) => chip(c, mode)).join('<i>/</i>');
      return `<li><span class="ht-keys">${keys}</span><span class="ht-what">${esc(what ?? '')}</span></li>`;
    })
    .join('');
}

export function openHowTo(root: HTMLElement, onClose?: () => void): void {
  const el = document.createElement('div');
  el.className = 'menu-layer';
  let mode: Mode = touch.mode;
  const render = () => {
    const tabs = MODES.map((m) => `<button class="menu-btn ht-tab${m === mode ? ' on' : ''}" data-mode="${m}" aria-pressed="${m === mode}">${esc(t(`howTo.modes.${m}`))}</button>`).join('');
    const blocks = SECTIONS.map((s) => {
      const list = rows(`howTo.${mode}.${s}`, mode);
      return list ? `<section class="ht-card"><h3>${esc(t(`howTo.sections.${s}`))}</h3><ul>${list}</ul></section>` : '';
    }).join('');
    const active = tList('howTo.active')
      .map((line) => {
        const [item, what] = line.split('|').map((s) => s.trim());
        return `<li><b>${esc(item ?? '')}</b> ${esc(what ?? '')}</li>`;
      })
      .join('');
    el.innerHTML = `<div class="menu-panel howto"><h2>${t('howTo.title')}</h2>
      <div class="ht-tabs" role="group">${tabs}</div>
      <div class="ht-grid">${blocks}</div>
      <section class="ht-card ht-active"><h3>${esc(t('howTo.activeTitle'))}</h3><ul>${active}</ul></section>
      <div class="menu-row"><button class="menu-btn close">${t('howTo.close')}</button></div></div>`;
    (el.querySelector('.close') as HTMLElement).addEventListener('click', close);
    el.querySelectorAll<HTMLElement>('[data-mode]').forEach((b) =>
      b.addEventListener('click', () => {
        mode = b.dataset.mode as Mode;
        render();
        el.querySelector<HTMLElement>(`[data-mode="${mode}"]`)?.focus();
      }),
    );
  };
  root.appendChild(el);
  const layer: MenuLayer = { el, onBack: () => close() };
  const close = () => {
    popLayer(layer);
    onClose?.();
  };
  render();
  // O foco começa na aba aberta (setas para os lados trocam de aba; Enter ou A escolhe).
  pushLayer(layer, el.querySelector<HTMLElement>('.ht-tab.on'));
  window.setTimeout(() => el.querySelector('.howto')?.scrollTo({ top: 0 }), 20);
}
