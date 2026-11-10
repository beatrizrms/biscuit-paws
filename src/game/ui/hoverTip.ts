// Dica de hover: com o mouse parado 1,5 segundo em cima de um elemento com data-tip, aparece um balão com o texto
// (para que serve o item, no mercado e no app Market). Sai ao tirar o mouse, clicar ou rolar a lista.

/** Quanto tempo o mouse fica em cima antes do balão aparecer. */
export const TIP_DELAY_MS = 1500;

/** Largura e altura da tela da UI (pixels do jogo, #ui). */
const UI_W = 640;
const UI_H = 360;

const wired = new WeakSet<HTMLElement>();

/** Liga as dicas dentro de `container` (uma vez só; os elementos com data-tip podem ser redesenhados à vontade). */
export function hoverTips(container: HTMLElement): void {
  if (wired.has(container)) return;
  wired.add(container);
  let target: HTMLElement | null = null;
  let timer = 0;
  let tip: HTMLElement | null = null;
  const hide = () => {
    window.clearTimeout(timer);
    tip?.remove();
    tip = null;
  };
  const show = (el: HTMLElement) => {
    const ui = el.closest<HTMLElement>('#ui');
    const text = el.dataset.tip;
    if (!ui || !text || !el.isConnected) return;
    tip = document.createElement('div');
    tip.className = 'hover-tip';
    tip.textContent = text;
    ui.appendChild(tip);
    // O #ui é escalado: converte a posição da tela para pixels do jogo.
    const u = ui.getBoundingClientRect();
    const k = u.width / UI_W;
    const r = el.getBoundingClientRect();
    const box = { left: (r.left - u.left) / k, top: (r.top - u.top) / k, right: (r.right - u.left) / k, bottom: (r.bottom - u.top) / k };
    const w = tip.offsetWidth;
    const h = tip.offsetHeight;
    const x = Math.max(2, Math.min(UI_W - w - 2, (box.left + box.right) / 2 - w / 2));
    const y = box.bottom + 2 + h <= UI_H - 2 ? box.bottom + 2 : Math.max(2, box.top - 2 - h);
    tip.style.left = `${Math.round(x)}px`;
    tip.style.top = `${Math.round(y)}px`;
  };
  container.addEventListener('pointerover', (e) => {
    const el = (e.target as HTMLElement).closest<HTMLElement>('[data-tip]');
    if (el === target) return;
    hide();
    target = el && container.contains(el) ? el : null;
    if (target) {
      const t = target;
      timer = window.setTimeout(() => show(t), TIP_DELAY_MS);
    }
  });
  container.addEventListener('pointerleave', () => {
    hide();
    target = null;
  });
  container.addEventListener('pointerdown', hide);
  container.addEventListener('scroll', hide, true);
}
