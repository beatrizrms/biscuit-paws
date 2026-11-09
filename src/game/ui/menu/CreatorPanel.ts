// Criar personagem (Novo jogo, depois do slot): nome e aparência, com prévia animada que gira.
// Mouse, toque e teclado (setas para cima/baixo trocam de linha; para os lados trocam a opção).
// As regras (opções, vestido sem parte de baixo, sorteio) moram em src/core/appearance.ts.
import type Phaser from 'phaser';
import { cleanPlayerName, creatorOptions, cycle, hidesBottom, isBald, LAYER_KEYS, layerFiles, randomAppearance, type Appearance } from '../../../core/appearance';
import { DEFAULT_PRONOUN, PRONOUNS, type Pronoun } from '../../../core/pronoun';
import { createRng } from '../../../core/rng';
import type { PlayerState } from '../../../core/state';
import { content } from '../../content';
import { t } from '../../i18n';
import { composeLayers, drawLayers, previewAnimates } from '../../playerLook';
import { esc, popLayer, pushLayer, type MenuLayer } from './MenuKit';

const C = content.character;
const PREVIEW_SCALE = 3;
const DIRS = ['down', 'left', 'up', 'right'] as const; // ordem de girar
const ROW_OF: Record<(typeof DIRS)[number], number> = { down: 0, left: 1, right: 2, up: 3 };

/** Manequim em camadas (decisão 077): menos linhas (só o que tem arte ou cor) e prévia na arte de 64 px. */
const L = C.mannequin?.layers;
const M = C.mannequin;
/** Quadro da prévia (pixels da folha) e a escala para a tela (a arte do manequim tem `resolution` pixels por pixel do jogo). */
const FRAME = L && M ? { w: M.frameWidth, h: M.frameHeight, scale: PREVIEW_SCALE / M.resolution } : { w: C.sheet.frameWidth, h: C.sheet.frameHeight, scale: PREVIEW_SCALE };

/** As linhas da tela, na ordem (t('creator.<key>') é o rótulo). */
const ALL_ROWS: (keyof Appearance)[] = ['skin', 'eyes', 'hairStyle', 'hairColor', 'top', 'topColor', 'bottom', 'bottomColor', 'shoes', 'shoesColor', 'glasses', 'head'];
const ROWS: readonly (keyof Appearance)[] = L ? LAYER_KEYS : ALL_ROWS;
const label = (key: keyof Appearance) => t(L && key === 'bottomColor' ? 'creator.bottomColorLayers' : `creator.${key}`);

export interface CreatorHandlers {
  onDone(player: PlayerState): void;
  onBack(): void;
}

export function openCreator(root: HTMLElement, textures: Phaser.Textures.TextureManager, handlers: CreatorHandlers): void {
  let look: Appearance = { ...C.default };
  let name = '';
  // Ela ou ele: só muda o gênero de algumas falas ({g:feminino|masculino}); a aparência é livre.
  let pronoun: Pronoun = DEFAULT_PRONOUN;
  let dirIndex = 0;
  let presetIndex = -1;
  let column = 0;
  const rng = createRng(Date.now() >>> 0);

  const el = document.createElement('div');
  el.className = 'menu-layer menu-creator';
  el.innerHTML = `<div class="menu-panel creator">
      <h2>${t('creator.title')}</h2>
      <div class="creator-body">
        <div class="creator-preview">
          <canvas class="frame${L ? ' mannequin' : ''}" width="${FRAME.w * FRAME.scale}" height="${FRAME.h * FRAME.scale}"></canvas>
          <p class="creator-note" hidden>${t('creator.previewOnly')}</p>
          <div class="menu-row turn"><button class="menu-btn small" data-act="turn-left" aria-label="${t('creator.turnLeft')}">⟲</button><button class="menu-btn small" data-act="turn-right" aria-label="${t('creator.turnRight')}">⟳</button></div>
          <div class="menu-row"><button class="menu-btn small" data-act="random">${t('creator.random')}</button><button class="menu-btn small" data-act="preset">${t('creator.preset')}</button></div>
        </div>
        <div class="creator-options">
          <label class="creator-name">${t('creator.name')}<input type="text" maxlength="14" autocomplete="off" spellcheck="false" placeholder="${esc(t('creator.namePlaceholder'))}" /></label>
          <div class="creator-pronoun" role="radiogroup" aria-label="${t('creator.pronoun')}"><span>${t('creator.pronoun')}</span>${PRONOUNS.map((p) => `<button class="menu-btn small" role="radio" data-pronoun="${p}">${t(`creator.pronoun_${p}`)}</button>`).join('')}</div>
          <div class="creator-rows"></div>
        </div>
      </div>
      <p class="creator-error" role="alert"></p>
      <div class="menu-row"><button class="menu-btn" data-act="back">${t('creator.back')}</button><button class="menu-btn primary" data-act="done">${t('creator.done')}</button></div>
    </div>`;
  root.appendChild(el);

  // Folha montada fora da página; a prévia mostra um quadro dela. No manequim em camadas, a peça só de frente vira um quadro parado.
  let sheet = document.createElement('canvas');
  sheet.width = C.sheet.frameWidth * C.sheet.columns;
  sheet.height = C.sheet.frameHeight * C.sheet.rows.length;
  let still = false;
  const note = el.querySelector('.creator-note') as HTMLElement;
  const frame = el.querySelector('canvas.frame') as HTMLCanvasElement;
  const rowsEl = el.querySelector('.creator-rows') as HTMLElement;
  const input = el.querySelector('.creator-name input') as HTMLInputElement;
  const error = el.querySelector('.creator-error') as HTMLElement;

  const visible = (key: keyof Appearance) => {
    if ((key === 'bottom' || key === 'bottomColor') && hidesBottom(C, look)) return false;
    if (key === 'hairColor' && isBald(look)) return false;
    return true;
  };

  const renderRows = () => {
    const focused = (document.activeElement as HTMLElement | null)?.dataset.cycle;
    rowsEl.innerHTML = ROWS.filter(visible)
      .map((key) => {
        const opt = creatorOptions(C, key).find((o) => o.id === look[key]);
        return `<div class="creator-row"><span class="label">${label(key)}</span>
          <button class="arrow" data-step="-1" data-key="${key}" tabindex="-1" aria-label="${t('creator.prev')}">‹</button>
          <button class="value" data-cycle="${key}">${esc(opt?.name ?? '')}</button>
          <button class="arrow" data-step="1" data-key="${key}" tabindex="-1" aria-label="${t('creator.next')}">›</button></div>`;
      })
      .join('');
    if (focused) (rowsEl.querySelector(`[data-cycle="${focused}"]`) as HTMLElement | null)?.focus();
  };

  const redrawSheet = () => {
    if (L) {
      still = !previewAnimates(look);
      sheet = composeLayers(textures, look, still ? 'front' : 'walk', false);
      note.hidden = !still;
      return;
    }
    const ctx = sheet.getContext('2d')!;
    ctx.clearRect(0, 0, sheet.width, sheet.height);
    drawLayers(ctx, textures, layerFiles(C, look));
  };

  const drawFrame = () => {
    const ctx = frame.getContext('2d')!;
    const { w, h, scale } = FRAME;
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, frame.width, frame.height);
    const [col, row] = still ? [0, 0] : [column, ROW_OF[DIRS[dirIndex]!]];
    ctx.drawImage(sheet, col * w, row * h, w, h, 0, 0, w * scale, h * scale);
  };

  const changed = () => {
    redrawSheet();
    drawFrame();
    renderRows();
  };

  const change = (key: keyof Appearance, step: 1 | -1) => {
    look = cycle(C, look, key, step);
    changed();
  };

  // Prévia andando (4 passos, 8 por segundo).
  const timer = window.setInterval(() => {
    column = (column + 1) % C.sheet.columns;
    drawFrame();
  }, 125);

  const finish = (done: boolean) => {
    if (done) {
      const clean = cleanPlayerName(name);
      if (!clean) {
        error.textContent = t('creator.nameRequired');
        input.focus();
        return;
      }
      window.clearInterval(timer);
      popLayer(layer);
      handlers.onDone({ name: clean, appearance: { ...look }, pronoun });
      return;
    }
    window.clearInterval(timer);
    popLayer(layer);
    handlers.onBack();
  };

  el.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>('button');
    if (!b) return;
    if (b.dataset.step) return change(b.dataset.key as keyof Appearance, Number(b.dataset.step) === 1 ? 1 : -1);
    if (b.dataset.cycle) return change(b.dataset.cycle as keyof Appearance, 1);
    if (b.dataset.pronoun) {
      pronoun = b.dataset.pronoun as Pronoun;
      return showPronoun();
    }
    const act = b.dataset.act;
    if (act === 'turn-left' || act === 'turn-right') {
      dirIndex = (dirIndex + (act === 'turn-right' ? 1 : DIRS.length - 1)) % DIRS.length;
      drawFrame();
    } else if (act === 'random') {
      look = randomAppearance(C, rng);
      changed();
    } else if (act === 'preset') {
      presetIndex = (presetIndex + 1) % C.presets.length;
      look = { ...C.presets[presetIndex]! };
      changed();
    } else if (act === 'done') finish(true);
    else if (act === 'back') finish(false);
  });
  // Setas para os lados numa linha: troca a opção (o MenuKit deixa passar, ver data-cycle).
  el.addEventListener('keydown', (e) => {
    const key = (document.activeElement as HTMLElement | null)?.dataset.cycle as keyof Appearance | undefined;
    if (!key || (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight')) return;
    e.preventDefault();
    change(key, e.key === 'ArrowRight' ? 1 : -1);
  });
  input.addEventListener('input', () => {
    name = input.value;
    error.textContent = '';
  });
  input.addEventListener('keydown', (e) => {
    // As letras do nome não vão para outros atalhos (Esc continua com o menu: volta).
    e.stopPropagation();
    if (e.key === 'Enter') finish(true);
  });

  const showPronoun = () =>
    el.querySelectorAll<HTMLButtonElement>('[data-pronoun]').forEach((b) => {
      const on = b.dataset.pronoun === pronoun;
      b.classList.toggle('on', on);
      b.setAttribute('aria-checked', String(on));
    });
  showPronoun();

  const layer: MenuLayer = { el, onBack: () => finish(false) };
  changed();
  pushLayer(layer, input);
}
