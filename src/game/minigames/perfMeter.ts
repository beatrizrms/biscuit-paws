// Medidor dos mini games (só no debug): para achar travadas que só acontecem num aparelho (a varinha no iPhone).
// Mostra, a cada 1/4 de segundo, por relógios diferentes, quem parou: o JavaScript inteiro (o próprio medidor para),
// os quadros do navegador (requestAnimationFrame) ou os quadros do jogo (update da cena). Mais o maior intervalo
// entre quadros, o áudio (bloqueado até tocar na tela, no iPhone) e se a página tem foco. E os toques: quantos chegam
// à página (antes de tudo), quantos chegam ao jogo (Phaser), se o dedo está apertado para o jogo e onde, e o último
// toque cancelado pelo navegador (o iPhone cancela quando acha que é rolagem ou gesto).
import type Phaser from 'phaser';

export function startPerfMeter(scene: Phaser.Scene, parent: HTMLElement): () => void {
  const el = document.createElement('div');
  el.className = 'mg-perf';
  parent.appendChild(el);
  const t0 = performance.now();
  let raf = 0;
  let rafId = 0;
  let lastRaf = performance.now();
  let worstRaf = 0;
  let worstAt = 0;
  const onRaf = (t: number) => {
    raf++;
    const gap = t - lastRaf;
    if (gap > worstRaf) {
      worstRaf = gap;
      worstAt = (t - t0) / 1000;
    }
    lastRaf = t;
    rafId = requestAnimationFrame(onRaf);
  };
  rafId = requestAnimationFrame(onRaf);
  let updates = 0;
  const onUpdate = () => updates++;
  scene.events.on('update', onUpdate);
  // Toques: na página (captura, antes de qualquer elemento) e no jogo.
  const pageTouches = { down: 0, move: 0, cancel: 0, lastCancel: 0 };
  const onPage = (e: PointerEvent) => {
    if (e.type === 'pointerdown') pageTouches.down++;
    else if (e.type === 'pointermove') pageTouches.move++;
    else {
      pageTouches.cancel++;
      pageTouches.lastCancel = performance.now();
    }
  };
  for (const t of ['pointerdown', 'pointermove', 'pointercancel'] as const) window.addEventListener(t, onPage, true);
  const gameTouches = { down: 0, move: 0 };
  const onDown = () => gameTouches.down++;
  const onMove = () => gameTouches.move++;
  scene.input.on('pointerdown', onDown);
  scene.input.on('pointermove', onMove);
  let lastTick = performance.now();
  let worstTick = 0;
  // Os quadros do último segundo (janela que anda), para o "fps" de verdade.
  const window1s: { at: number; raf: number; upd: number }[] = [];
  const tick = () => {
    const now = performance.now();
    worstTick = Math.max(worstTick, now - lastTick);
    lastTick = now;
    window1s.push({ at: now, raf, upd: updates });
    while (window1s.length > 1 && now - window1s[0]!.at > 1000) window1s.shift();
    const first = window1s[0]!;
    const sound = scene.sound as Phaser.Sound.BaseSoundManager & { context?: AudioContext };
    el.textContent = [
      `t ${((now - t0) / 1000).toFixed(1)}s`,
      `rAF ${raf - first.raf}/s`,
      `jogo ${updates - first.upd}/s`,
      `pior quadro ${Math.round(worstRaf)}ms em ${worstAt.toFixed(1)}s`,
      `pior relógio ${Math.round(worstTick)}ms`,
      `som ${sound.locked ? 'bloqueado' : 'livre'}${sound.context ? ` (${sound.context.state})` : ''}`,
      `foco ${document.hasFocus() ? 'sim' : 'não'} · ${document.visibilityState}`,
    ].join(' · ');
    const p = scene.input.activePointer;
    const cancelAgo = pageTouches.lastCancel ? ` (há ${((now - pageTouches.lastCancel) / 1000).toFixed(1)}s)` : '';
    el.textContent += `\npágina ↓${pageTouches.down} ~${pageTouches.move} ✕${pageTouches.cancel}${cancelAgo} · jogo ↓${gameTouches.down} ~${gameTouches.move} · dedo ${p.isDown ? 'apertado' : 'solto'} ${Math.round(p.x)},${Math.round(p.y)}`;
  };
  const timer = window.setInterval(tick, 250);
  return () => {
    window.clearInterval(timer);
    cancelAnimationFrame(rafId);
    scene.events.off('update', onUpdate);
    for (const t of ['pointerdown', 'pointermove', 'pointercancel'] as const) window.removeEventListener(t, onPage, true);
    scene.input.off('pointerdown', onDown);
    scene.input.off('pointermove', onMove);
    el.remove();
  };
}
