// Como a página foi aberta (navegador). Num Electron/Steam, troca-se só este arquivo.

/** A página foi recarregada (F5), e não aberta de novo? No navegador, a entrada de navegação diz o tipo. */
export function pageWasReloaded(): boolean {
  const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
  return nav?.type === 'reload';
}
