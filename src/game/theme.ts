// As cores da interface (src/game/ui/theme.css) para o que o Phaser desenha (texto, retângulos): uma fonte só.

/** A cor de uma variável de theme.css ("#rrggbb"); sem ela (antes do CSS carregar), `fallback`. */
export function themeColor(name: string, fallback: string): string {
  if (typeof document === 'undefined') return fallback;
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
}

/** A mesma, como número (0xrrggbb) para retângulos e gráficos do Phaser. */
export function themeHex(name: string, fallback: string): number {
  return parseInt(themeColor(name, fallback).replace('#', ''), 16);
}
