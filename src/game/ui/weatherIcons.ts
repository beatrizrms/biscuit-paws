// Ícone do clima do dia no HUD (ao lado da data): pixel art em SVG, 12 x 12.
// PLACEHOLDER(arte): desenhados por código; trocar por ícones da folha (data/icons.json) quando a arte existir.

/** Cada letra é uma cor da paleta; "." é transparente. */
const PALETTE: Record<string, string> = {
  s: '#7fa8d6', y: '#f2c14e', o: '#e08a3a', w: '#ffffff', g: '#c8d3e0', d: '#8d9bb0', b: '#6fa3d8', l: '#d9783b', r: '#c4502f', k: '#a07a5a', c: '#e9eef5',
};

const ICONS: Record<string, string[]> = {
  sun: [
    '.....y......',
    '..y..y..y...',
    '...y.y.y....',
    '....ooo.....',
    '.yyoyyyoyy..',
    '...oyyyo....',
    '...oyyyo....',
    '....ooo.....',
    '...y.y.y....',
    '..y..y..y...',
    '.....y......',
    '............',
  ],
  rain: [
    '............',
    '....ggg.....',
    '..ggcccgg...',
    '.gcccccccg..',
    'gccccccccg..',
    'gddddddddg..',
    '.gggggggg...',
    '..b...b..b..',
    '.b...b..b...',
    '....b...b...',
    '...b...b....',
    '............',
  ],
  snow: [
    '............',
    '.....s......',
    '..s..s..s...',
    '...s.s.s....',
    '....sss.....',
    '.sssswssss..',
    '....sss.....',
    '...s.s.s....',
    '..s..s..s...',
    '.....s......',
    '............',
    '............',
  ],
  wind: [
    '............',
    '.ggggggg....',
    '........g...',
    '..ggggg..g..',
    '.......g.g..',
    '...ll..g....',
    '..lrrl......',
    '..lrl.ggggg.',
    '...k.......g',
    '..k.....ggg.',
    '............',
    '............',
  ],
};

/** O SVG do ícone (ou vazio, se o clima não tiver ícone). */
export function weatherIconSvg(weather: string, px = 14): string {
  const rows = ICONS[weather];
  if (!rows) return '';
  const rects = rows
    .flatMap((row, y) => [...row].map((ch, x) => (PALETTE[ch] ? `<rect x="${x}" y="${y}" width="1" height="1" fill="${PALETTE[ch]}"/>` : '')))
    .join('');
  return `<svg class="weather-icon" width="${px}" height="${px}" viewBox="0 0 12 12" shape-rendering="crispEdges" aria-hidden="true">${rects}</svg>`;
}
