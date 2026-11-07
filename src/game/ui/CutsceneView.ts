// Mostra as cenas sem mapa (data/cutscenes.json) em HTML, por cima do jogo.
// Só apresenta: quando a cena acaba, avisa a sessão (finishCutscene), que segue a história.
import type { CutsceneDef, CutsceneStep } from '../../core/cutscene';
import type { GameSession } from '../../core/session';
import { content, phone, uiText } from '../content';

const TYPE_SPEED_MS = 26;
const CAT_SCALE = 5;

export class CutsceneView {
  private el: HTMLElement;
  private stage: HTMLElement;
  private textBox: HTMLElement;
  private queue: string[] = [];
  private playing: { id: string; def: CutsceneDef; index: number } | null = null;
  private typing: { full: string; target: HTMLElement; timer: number } | null = null;

  constructor(
    root: HTMLElement,
    private session: GameSession,
    /** Chamado quando a cena abre ou fecha (a interface atualiza dicas, etc.). */
    private onChange: () => void,
  ) {
    this.el = document.createElement('div');
    this.el.className = 'cutscene';
    this.el.innerHTML = `
      <div class="cs-snow"></div>
      <div class="cs-stage"></div>
      <div class="cs-text"><span class="speaker"></span><span class="text"></span></div>
      <div class="cs-hint">${uiText.hintDialogue}</div>`;
    root.appendChild(this.el);
    this.stage = this.el.querySelector('.cs-stage') as HTMLElement;
    this.textBox = this.el.querySelector('.cs-text') as HTMLElement;

    this.el.addEventListener('click', () => this.advance());
    window.addEventListener('keydown', (e) => {
      if (!this.isOpen()) return;
      if (e.code === 'Space' || e.code === 'Enter') {
        e.preventDefault();
        this.advance();
      }
    });
  }

  /** Modo debug: fecha a cena atual e as da fila, como se tivessem terminado. */
  skipAll(): void {
    if (this.typing) window.clearInterval(this.typing.timer);
    this.typing = null;
    while (this.playing) this.finish();
  }

  isOpen(): boolean {
    return this.playing !== null;
  }

  /** Toca a cena (ou põe na fila, se outra estiver tocando). */
  request(id: string): void {
    this.queue.push(id);
    if (!this.playing) this.next();
  }

  private next(): void {
    const id = this.queue.shift();
    if (!id) return;
    const def = content.cutscenes[id];
    if (!def) return this.session.finishCutscene(id);
    this.playing = { id, def, index: -1 };
    this.el.style.background = def.background;
    this.el.classList.toggle('snowing', def.snow === true);
    this.el.classList.add('open');
    this.stage.innerHTML = '';
    this.onChange();
    this.advance();
  }

  /** Completa o texto que está sendo escrito ou vai para o próximo passo. */
  private advance(): void {
    if (!this.playing) return;
    if (this.typing) {
      window.clearInterval(this.typing.timer);
      this.typing.target.textContent = this.typing.full;
      this.typing = null;
      return;
    }
    // Passos sem texto (gato, celular, esconder) emendam no próximo passo com texto.
    let step: CutsceneStep | undefined;
    do {
      this.playing.index++;
      step = this.playing.def.steps[this.playing.index];
      if (step) this.show(step);
    } while (step && step.type !== 'text' && step.type !== 'card');
    if (!step) this.finish();
  }

  private show(step: CutsceneStep): void {
    switch (step.type) {
      case 'text':
        this.textBox.classList.add('visible');
        this.textBox.classList.toggle('narrator', step.speaker === '');
        (this.textBox.querySelector('.speaker') as HTMLElement).textContent = step.speaker;
        this.type(this.textBox.querySelector('.text') as HTMLElement, step.text);
        break;
      case 'card':
        this.textBox.classList.remove('visible');
        this.stage.innerHTML = '<div class="cs-card"></div>';
        this.type(this.stage.querySelector('.cs-card') as HTMLElement, step.text);
        break;
      case 'cat':
        this.stage.innerHTML = this.catHtml(step.cat, step.animation, step.caption);
        break;
      case 'phone':
        this.stage.innerHTML = this.phoneHtml(step);
        break;
      case 'hide':
        this.stage.innerHTML = '';
        break;
    }
  }

  /** O celular do pacote: conteúdo por baixo, na área da tela; a moldura por cima. */
  private phoneHtml(step: Extract<CutsceneStep, { type: 'phone' }>): string {
    const [w, h] = phone.size;
    const s = phone.screen;
    const icon = step.appIcon ? phone.apps[step.appIcon] : undefined;
    return `<div class="cs-phone" style="width:${w}px;height:${h}px">
      <div class="screen" style="left:${s.x}px;top:${s.y}px;width:${s.w}px;height:${s.h}px">
        <img class="status" src="${phone.status}" alt="" />
        <div class="app">${icon ? `<img src="${icon}" alt="" />` : ''}<span>${esc(step.app)}</span></div>
        <div class="ad"><strong>${esc(step.title)}</strong>${step.lines.map((l) => `<span>${esc(l)}</span>`).join('')}</div>
      </div>
      <img class="frame" src="${phone.frame}" alt="" />
    </div>`;
  }

  /** Um gato animado com os quadros da folha do Cosy Cats (CSS, sem Phaser). */
  private catHtml(catId: string, animation: string, caption?: string): string {
    const cat = content.cats[catId];
    const sprites = content.catSprites;
    const anim = sprites.animations.find((a) => a.name === animation);
    if (!cat || !anim) return '';
    const size = sprites.frameSize;
    const style = [
      `background-image:url(${sprites.variants[cat.variant]})`,
      `background-position-y:${-anim.row * size}px`,
      `--frames:${anim.frames}`,
      `--frame-size:${size}px`,
      `animation-duration:${anim.frames / anim.fps}s`,
      `animation-timing-function:steps(${anim.frames})`,
      `transform:scale(${CAT_SCALE})`,
    ].join(';');
    return `<div class="cs-cat-wrap"><div class="cs-glow"></div><div class="cs-cat" style="${style}"></div>${
      caption ? `<div class="cs-caption">${esc(caption)}</div>` : ''
    }</div>`;
  }

  private type(target: HTMLElement, full: string): void {
    target.textContent = '';
    let shown = 0;
    const typing = {
      full,
      target,
      timer: window.setInterval(() => {
        shown++;
        target.textContent = full.slice(0, shown);
        if (shown >= full.length) {
          window.clearInterval(typing.timer);
          this.typing = null;
        }
      }, TYPE_SPEED_MS),
    };
    this.typing = typing;
  }

  private finish(): void {
    const id = this.playing!.id;
    this.playing = null;
    this.el.classList.remove('open');
    this.textBox.classList.remove('visible');
    this.stage.innerHTML = '';
    this.onChange();
    this.session.finishCutscene(id);
    this.next();
  }
}

function esc(text: string): string {
  return text.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
}
