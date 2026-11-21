// A fonte do jogo: Monogram (datagoblin, CC0), uma fonte pixel de grade exata: em 16 px, cada pixel dela é 1 px (a
// maiúscula tem 7 de altura e toda letra ocupa 6 de largura). Ela só fica nítida quando o pixel dela cai num número
// inteiro de pixels da tela; no meio do caminho, o contorno borra (decisão 305).

/** A família, para os textos do Phaser (os da interface vêm do ui.css). */
export const FONT = 'Monogram, monospace';

/**
 * O degrau nítido dos textos do Phaser (px do mundo) para um tamanho pedido: 8, 16, 24 ou 32. No canvas de 1280 x 720,
 * o pixel da fonte cai em 1, 2, 3 ou 4 pixels inteiros, como o pixel da arte.
 */
export function monoSize(px: number): number {
  return px <= 10 ? 8 : px <= 20 ? 16 : px <= 24 ? 24 : 32;
}

/**
 * Os quatro degraus de letra da interface (px do jogo), para a escala da tela (o zoom inteiro vezes a densidade de
 * pixels do aparelho): cada degrau pede um tamanho de pixel da fonte (em px do jogo) e é arredondado para o número
 * inteiro de pixels da tela mais perto. --t1: etiquetas e textos curtos; --t2: falas e textos de leitura; --t3 e --t4:
 * títulos.
 */
export function fontSteps(screenScale: number): Record<'--t1' | '--t2' | '--t3' | '--t4', string> {
  const size = (fontPixel: number): string => {
    const screenPixels = Math.max(1, Math.round(screenScale * fontPixel));
    return `${+((16 * screenPixels) / screenScale).toFixed(3)}px`;
  };
  return { '--t1': size(0.67), '--t2': size(1), '--t3': size(1.5), '--t4': size(2) };
}

let style: HTMLStyleElement | null = null;

/** Aplica os degraus para a escala atual (main.ts, a cada mudança de tamanho da tela). */
export function applyFontSteps(zoom: number): void {
  style ??= document.head.appendChild(document.createElement('style'));
  const steps = fontSteps(zoom * (window.devicePixelRatio || 1));
  style.textContent = `:root { ${Object.entries(steps).map(([k, v]) => `${k}: ${v};`).join(' ')} }`;
}
