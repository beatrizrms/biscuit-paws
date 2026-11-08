// Caixa de nome: abre quando um gato novo é abrigado. Sugere um nome e deixa a jogadora trocar.
import type { GameSession } from '../../core/session';
import { content, uiText } from '../content';

export class NamingBox {
  private el: HTMLElement;
  private input: HTMLInputElement;
  private queue: string[] = [];
  private catId: string | null = null;
  private attempt = 0;

  constructor(
    root: HTMLElement,
    private session: GameSession,
    private onChange: () => void,
    private onProblem: (reason: 'invalid_name' | 'not_sheltered') => void,
  ) {
    this.el = document.createElement('div');
    this.el.className = 'naming-layer';
    this.el.innerHTML = `
      <form class="panel naming">
        <h2>${uiText.naming.title}</h2>
        <div class="naming-cat"></div>
        <label>${uiText.naming.prompt}<input name="catName" maxlength="14" autocomplete="off" /></label>
        <div class="naming-buttons">
          <button type="button" class="another">${uiText.naming.another}</button>
          <button type="submit" class="confirm">${uiText.naming.confirm}</button>
        </div>
      </form>`;
    root.appendChild(this.el);
    this.input = this.el.querySelector('input') as HTMLInputElement;
    (this.el.querySelector('.another') as HTMLElement).addEventListener('click', () => {
      this.attempt++;
      this.input.value = this.session.suggestCatName(this.catId!, this.attempt);
      this.input.focus();
    });
    (this.el.querySelector('form') as HTMLFormElement).addEventListener('submit', (e) => {
      e.preventDefault();
      this.confirm();
    });
    // Teclas digitadas aqui não podem andar com a personagem nem abrir o catálogo.
    this.input.addEventListener('keydown', (e) => e.stopPropagation());
    session.bus.on('cat.sheltered', ({ catId }) => {
      if (this.session.state.cats[catId]?.name) return; // gato com nome fixo
      this.queue.push(catId);
      if (!this.catId) this.next();
    });
  }

  isOpen(): boolean {
    return this.catId !== null;
  }

  /** Para testes e debug: confirma com o nome que estiver na caixa. */
  confirm(): void {
    if (!this.catId) return;
    const catId = this.catId;
    // Fecha antes de avisar a sessão: a fala que a história pede em seguida já pode aparecer.
    this.catId = null;
    const result = this.session.nameCat(catId, this.input.value);
    if (!result.ok) {
      this.catId = catId;
      return this.onProblem(result.reason as 'invalid_name' | 'not_sheltered');
    }
    this.el.classList.remove('open');
    this.onChange();
    this.next();
  }

  private next(): void {
    const id = this.queue.shift();
    if (!id) return;
    this.catId = id;
    this.attempt = 0;
    this.input.value = this.session.suggestCatName(id, 0);
    const cat = this.session.catDef(id)!;
    const sprites = content.catSprites;
    const sit = sprites.animations.find((a) => a.name === 'sit')!;
    (this.el.querySelector('.naming-cat') as HTMLElement).innerHTML = `<div class="cs-cat" style="background-image:url(${
      sprites.variants[cat.variant]
    });background-position-y:${-sit.row * sprites.frameSize}px;--frames:${sit.frames};--frame-size:${sprites.frameSize}px;animation-duration:${
      sit.frames / sit.fps
    }s;animation-timing-function:steps(${sit.frames});transform:scale(3)"></div>`;
    this.el.classList.add('open');
    this.onChange();
    window.setTimeout(() => this.input.select(), 50);
  }
}
