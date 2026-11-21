// Ícones dos botões, desenhados pixel a pixel aqui mesmo (12 x 12; '#' é tinta). Viram máscara em CSS (.ico): a cor
// é a do texto do botão, então o mesmo desenho serve no botão creme, no verde e no de perigo (decisão 306).

const PIXELS = {
  play: [
    '............',
    '...#........',
    '...##.......',
    '...###......',
    '...####.....',
    '...#####....',
    '...#####....',
    '...####.....',
    '...###......',
    '...##.......',
    '...#........',
    '............',
  ],
  trash: [
    '....####....',
    '.##########.',
    '............',
    '..########..',
    '..#.#..#.#..',
    '..#.#..#.#..',
    '..#.#..#.#..',
    '..#.#..#.#..',
    '..#.#..#.#..',
    '..#.#..#.#..',
    '..########..',
    '............',
  ],
  // Exportar: a seta sai da bandeja (o save vai para um arquivo).
  export: [
    '.....##.....',
    '....####....',
    '...######...',
    '..##.##.##..',
    '.....##.....',
    '.....##.....',
    '.....##.....',
    '............',
    '#..........#',
    '#..........#',
    '############',
    '............',
  ],
  // Importar: a seta entra na bandeja (um arquivo vira o save).
  import: [
    '.....##.....',
    '.....##.....',
    '.....##.....',
    '..##.##.##..',
    '...######...',
    '....####....',
    '.....##.....',
    '............',
    '#..........#',
    '#..........#',
    '############',
    '............',
  ],
  // Recuperar o backup: a seta que volta.
  restore: [
    '............',
    '...#........',
    '..##........',
    '.##########.',
    '..##......#.',
    '...#......#.',
    '..........#.',
    '..........#.',
    '..#########.',
    '............',
    '............',
    '............',
  ],
} as const;

export type IconName = keyof typeof PIXELS;

/** O desenho como SVG (um retângulo por pixel, sem suavizar), pronto para url(). */
function svg(rows: readonly string[]): string {
  const rects: string[] = [];
  rows.forEach((row, y) => [...row].forEach((c, x) => c === '#' && rects.push(`<rect x="${x}" y="${y}" width="1" height="1"/>`)));
  const body = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 12 12" shape-rendering="crispEdges">${rects.join('')}</svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(body)}")`;
}

const URLS = Object.fromEntries(Object.entries(PIXELS).map(([k, rows]) => [k, svg(rows)])) as Record<IconName, string>;

/** O ícone para pôr dentro de um botão (decorativo: o nome vai no aria-label/title do botão). */
export function icon(name: IconName): string {
  return `<i class="ico" aria-hidden="true" style="--ico: ${URLS[name].replace(/"/g, '&quot;')}"></i>`;
}
