// Home: "toque para começar" (libera o áudio), título e botões: Continuar (com resumo), Novo jogo,
// Carregar/recuperar, Opções, Créditos. Mouse, teclado (setas + Enter + Esc) e toque.
import type Phaser from 'phaser';
import type { ManualSlot, SlotId } from '../../../core/saveSlots';
import type { PlayerState } from '../../../core/state';
import { openCreator } from './CreatorPanel';
import { gameInfo, t } from '../../i18n';
import { services } from '../../services';
import { openCredits } from './CreditsPanel';
import { esc, menuToast, pushLayer, popLayer, slotName, slotText, type MenuLayer } from './MenuKit';
import { openOptions } from './OptionsPanel';
import { openSlots } from './SlotsPanel';

export interface MainMenuHandlers {
  play(slot: SlotId): Promise<{ ok: true } | { ok: false; error: string }>;
  /** Jogo novo no slot, com o nome e a aparência escolhidos no criador. */
  newGame(slot: ManualSlot, player: PlayerState): void;
  /** Texturas do jogo (as camadas da personagem, para a prévia do criador). */
  textures: Phaser.Textures.TextureManager;
  /** O primeiro gesto (libera o áudio). */
  started(): void;
}

export class MainMenu {
  private el: HTMLElement;
  private layer: MenuLayer;
  private pushed = false;

  constructor(
    private root: HTMLElement,
    private handlers: MainMenuHandlers,
  ) {
    this.el = document.createElement('div');
    this.el.className = 'menu-home';
    root.appendChild(this.el);
    this.layer = { el: this.el };
    this.showTapToStart();
  }

  destroy(): void {
    if (this.pushed) popLayer(this.layer);
    this.el.remove();
  }

  /** Primeiro toque: o navegador libera o áudio e a música da Home começa. */
  private showTapToStart(): void {
    this.el.innerHTML = `<h1 class="menu-title">${esc(gameInfo.title)}</h1><button class="menu-tap">${t('home.tapToStart')}</button>`;
    const go = () => {
      window.removeEventListener('keydown', onKey);
      this.handlers.started();
      void this.render();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') go();
    };
    window.addEventListener('keydown', onKey);
    (this.el.querySelector('.menu-tap') as HTMLElement).addEventListener('click', go);
  }

  private async render(): Promise<void> {
    const { saves } = services();
    const recent = await saves.mostRecent();
    const status = recent ? await saves.status(recent) : null;
    const summary = recent && status ? slotText(status) : null;
    this.el.innerHTML = `
      <h1 class="menu-title">${esc(gameInfo.title)}</h1>
      <div class="menu-buttons">
        <button class="menu-btn big" data-act="continue" ${recent ? '' : 'disabled'}>
          ${t('home.continue')}
          <span class="sub">${recent && summary ? esc(`${slotName(recent)} · ${summary.line}`) : t('home.noSave')}</span>
          ${summary?.date ? `<span class="sub">${esc(summary.date)}</span>` : ''}
        </button>
        <button class="menu-btn big" data-act="new">${t('home.newGame')}</button>
        <button class="menu-btn big" data-act="load">${t('home.load')}</button>
        <button class="menu-btn big" data-act="options">${t('home.options')}</button>
        <button class="menu-btn big" data-act="credits">${t('home.credits')}</button>
      </div>
      <p class="menu-hint">${t('home.hint')}</p>`;
    const again = () => void this.render();
    const on = (act: string, fn: () => void) => (this.el.querySelector(`[data-act="${act}"]`) as HTMLElement).addEventListener('click', fn);
    on('continue', () => recent && void this.play(recent));
    on('new', () => void this.newGame());
    on('load', () => openSlots(this.root, 'load', { onPlay: (s) => void this.play(s), onNewGame: (s) => this.create(s), onClose: again }));
    on('options', () => openOptions(this.root, again));
    on('credits', () => openCredits(this.root, again));
    const first = this.el.querySelector<HTMLElement>('[data-act]:not([disabled])');
    if (!this.pushed) {
      this.pushed = true;
      pushLayer(this.layer, first);
    } else window.setTimeout(() => first?.focus(), 0);
  }

  private async play(slot: SlotId): Promise<void> {
    const r = await this.handlers.play(slot);
    if (!r.ok) {
      menuToast(this.root, t('slots.importInvalid', { error: r.error }));
      void this.render();
    }
  }

  /** Sem saves: começa no slot 1. Com saves: escolhe o slot (confirma se ocupado). */
  private async newGame(): Promise<void> {
    const statuses = await services().saves.statuses();
    const anyManual = (['slot1', 'slot2', 'slot3'] as const).some((s) => statuses[s].kind !== 'empty');
    if (!anyManual) return this.create('slot1');
    openSlots(this.root, 'new', { onPlay: () => undefined, onNewGame: (s) => this.create(s), onClose: () => void this.render() });
  }

  /** Criar personagem; "voltar" volta para a Home. */
  private create(slot: ManualSlot): void {
    openCreator(this.root, this.handlers.textures, { onDone: (player) => this.handlers.newGame(slot, player), onBack: () => void this.render() });
  }
}
