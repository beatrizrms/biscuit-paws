// Janelas com o controle de videogame: um destaque verde anda pelo que dá para clicar na janela de cima (Market,
// mochila, cardápio, celular, caixas de escolha) e vai para o mais perto na direção apertada; o A clica nele. Não
// precisa de nada nas janelas: vale o que já é botão ou tem a mãozinha do mouse (cursor: pointer).

/** As janelas onde o destaque anda (a de cima é a última na página). */
const LAYERS = '.panel.catalog, .phone-ui, .confirm-layer';
const BASE = 'button, a[href], input, select, textarea, [tabindex]:not([tabindex="-1"])';
/** Fechar e voltar: nunca o destaque de quando a janela abre. */
const CLOSE = '.close, .p-close, .p-back';

export type Dir = 'up' | 'down' | 'left' | 'right';

function visible(el: HTMLElement): boolean {
  if (el.getClientRects().length === 0) return false;
  const r = el.getBoundingClientRect();
  return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden';
}

/** A janela de cima aberta agora (só as do seletor, quando há), ou null. */
export function topLayer(only = LAYERS): HTMLElement | null {
  const all = [...document.querySelectorAll<HTMLElement>(only)].filter(visible);
  return all[all.length - 1] ?? null;
}

/** O que dá para clicar na janela: botões e campos, e o que mostra a mãozinha (o de fora, não os pedaços dele). */
function targets(layer: HTMLElement): HTMLElement[] {
  const out: HTMLElement[] = [];
  for (const el of layer.querySelectorAll<HTMLElement>('*')) {
    if (el.matches(BASE)) {
      if (!(el as HTMLButtonElement).disabled && visible(el)) out.push(el);
      continue;
    }
    if (el.closest('button')) continue;
    if (getComputedStyle(el).cursor !== 'pointer') continue;
    const parent = el.parentElement;
    if (parent && parent !== layer && getComputedStyle(parent).cursor === 'pointer') continue;
    if (visible(el)) out.push(el);
  }
  return out;
}

function center(r: DOMRect): { x: number; y: number } {
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}

class PadNav {
  private current: HTMLElement | null = null;
  /** Onde o destaque estava (a janela redesenha depois de um clique: o novo fica no mesmo lugar). */
  private lastAt: { x: number; y: number } | null = null;
  private layer: HTMLElement | null = null;

  /** A cada quadro com o controle: segue a janela de cima e mantém um destaque nela; null tira o destaque. */
  sync(layer: HTMLElement | null): void {
    if (layer !== this.layer) {
      this.layer = layer;
      this.lastAt = null;
      this.set(null);
    }
    if (!layer) return;
    if (this.current && this.current.isConnected && layer.contains(this.current) && visible(this.current)) return;
    const list = targets(layer);
    if (list.length === 0) return this.set(null);
    this.set(this.lastAt ? this.nearest(list, this.lastAt) : list.find((el) => !el.matches(CLOSE)) ?? list[0]!);
  }

  /** O direcional: vai para o mais perto naquela direção (o que está mais alinhado ganha). */
  move(dir: Dir): void {
    if (!this.layer || !this.current) return;
    const from = center(this.current.getBoundingClientRect());
    let best: HTMLElement | null = null;
    let bestScore = Infinity;
    for (const el of targets(this.layer)) {
      if (el === this.current || el.contains(this.current) || this.current.contains(el)) continue;
      const to = center(el.getBoundingClientRect());
      const dx = to.x - from.x;
      const dy = to.y - from.y;
      const along = dir === 'left' ? -dx : dir === 'right' ? dx : dir === 'up' ? -dy : dy;
      if (along <= 2) continue;
      const score = along + 3 * Math.abs(dir === 'left' || dir === 'right' ? dy : dx);
      if (score < bestScore) {
        bestScore = score;
        best = el;
      }
    }
    if (best) this.set(best);
  }

  /** O A: clica no destacado. Devolve false sem nada para clicar (aí o A vira o Enter). */
  press(): boolean {
    if (!this.current) return false;
    const el = this.current;
    if (el.matches('input[type="text"], textarea')) el.focus();
    else el.click();
    return true;
  }

  /** LB/RB: a aba anterior ou a seguinte (as abas são os [data-tab]), quando a janela tem abas. */
  tab(step: 1 | -1): boolean {
    if (!this.layer) return false;
    const tabs = [...this.layer.querySelectorAll<HTMLElement>('[data-tab]')].filter(visible);
    if (tabs.length < 2) return false;
    const on = tabs.findIndex((t) => t.classList.contains('on') || t.classList.contains('active') || t.getAttribute('aria-selected') === 'true');
    tabs[(Math.max(0, on) + step + tabs.length) % tabs.length]!.click();
    return true;
  }

  /** O B no celular: dentro de um app, volta para a tela inicial (em vez de fechar). */
  back(): boolean {
    const back = this.layer?.querySelector<HTMLElement>('.p-back');
    if (!back || !visible(back)) return false;
    back.click();
    return true;
  }

  private nearest(list: HTMLElement[], at: { x: number; y: number }): HTMLElement {
    let best = list[0]!;
    let bestD = Infinity;
    for (const el of list) {
      const c = center(el.getBoundingClientRect());
      const d = Math.hypot(c.x - at.x, c.y - at.y);
      if (d < bestD) {
        bestD = d;
        best = el;
      }
    }
    return best;
  }

  private set(el: HTMLElement | null): void {
    if (el === this.current) return;
    this.current?.classList.remove('pad-focus');
    this.current = el;
    if (!el) return;
    el.classList.add('pad-focus');
    el.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    this.lastAt = center(el.getBoundingClientRect());
  }
}

/** O destaque das janelas (um só). */
export const padNav = new PadNav();
