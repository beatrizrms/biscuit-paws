// Opções de som: música e sons ambientes, cada um com liga/desliga e volume. Aplica na hora e grava à parte do save.
// Usado na Home e na pausa do jogo.
import type { ChannelSettings, Settings } from '../../../core/settings';
import { hasAudioFiles } from '../../audio/AudioManager';
import { t } from '../../i18n';
import { services } from '../../services';
import { esc, popLayer, pushLayer, type MenuLayer } from './MenuKit';

export function openOptions(root: HTMLElement, onClose?: () => void): void {
  const { audio, saveSettings } = services();
  const settings: Settings = structuredClone(audio.getSettings());
  const hasFiles = hasAudioFiles();
  const el = document.createElement('div');
  el.className = 'menu-layer';
  const row = (ch: 'music' | 'ambient', c: ChannelSettings) => `
    <div class="menu-option" data-ch="${ch}">
      <span class="label">${esc(t(`options.${ch}`))}</span>
      <button class="menu-btn small toggle" aria-pressed="${c.on}">${c.on ? t('options.on') : t('options.off')}</button>
      <input type="range" min="0" max="100" step="5" value="${Math.round(c.volume * 100)}" aria-label="${esc(t(`options.${ch}`))} ${t('options.volume')}" ${c.on ? '' : 'disabled'} />
    </div>`;
  el.innerHTML = `<div class="menu-panel options">
    <h2>${t('options.title')}</h2>
    ${row('music', settings.music)}${row('ambient', settings.ambient)}
    ${hasFiles ? '' : `<p class="menu-note">${t('options.noFiles')}</p>`}
    <div class="menu-row"><button class="menu-btn close">${t('options.close')}</button></div>
  </div>`;
  root.appendChild(el);
  const apply = () => void saveSettings(structuredClone(settings));
  el.querySelectorAll<HTMLElement>('.menu-option').forEach((opt) => {
    const ch = opt.dataset.ch as 'music' | 'ambient';
    const toggle = opt.querySelector('.toggle') as HTMLButtonElement;
    const range = opt.querySelector('input') as HTMLInputElement;
    toggle.addEventListener('click', () => {
      settings[ch].on = !settings[ch].on;
      toggle.setAttribute('aria-pressed', String(settings[ch].on));
      toggle.textContent = settings[ch].on ? t('options.on') : t('options.off');
      range.disabled = !settings[ch].on;
      apply();
    });
    range.addEventListener('input', () => {
      settings[ch].volume = Number(range.value) / 100;
      apply();
    });
  });
  const layer: MenuLayer = { el, onBack: () => close() };
  const close = () => {
    popLayer(layer);
    onClose?.();
  };
  (el.querySelector('.close') as HTMLElement).addEventListener('click', close);
  pushLayer(layer);
}
