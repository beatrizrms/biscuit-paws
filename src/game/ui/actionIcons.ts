// Ícones dos botões de ação da mochila (posicionar, pôr na barra, comer...): pixel art em SVG, 12 x 12, numa cor só
// (a do texto do botão). O nome da ação fica no title e no aria-label.

/** "#" pinta; "." é transparente. */
const ICONS: Record<string, string[]> = {
  // Setas para os quatro lados: mudar de lugar no café.
  place: [
    '.....##.....',
    '....####....',
    '.....##.....',
    '.....##.....',
    '.#...##...#.',
    '############',
    '############',
    '.#...##...#.',
    '.....##.....',
    '.....##.....',
    '....####....',
    '.....##.....',
  ],
  // Seta descendo até a barra de espaços.
  toBar: [
    '.....##.....',
    '.....##.....',
    '.....##.....',
    '...######...',
    '....####....',
    '.....##.....',
    '............',
    '############',
    '#..#....#..#',
    '#..#....#..#',
    '############',
    '............',
  ],
  // Mochila: pôr na mochila (de qualquer lugar).
  toBag: [
    '....####....',
    '...#....#...',
    '..########..',
    '.#........#.',
    '.#........#.',
    '.#.######.#.',
    '.#.#....#.#.',
    '.#.######.#.',
    '.#........#.',
    '.#........#.',
    '.##########.',
    '............',
  ],
  // Garfo e faca.
  eat: [
    '#.#.#....##.',
    '#.#.#...###.',
    '#.#.#...###.',
    '#####...###.',
    '.###....###.',
    '..#.....###.',
    '..#......#..',
    '..#......#..',
    '..#......#..',
    '..#......#..',
    '..#......#..',
    '..#......#..',
  ],
  // Mão aberta: segurar (o petisco).
  hold: [
    '....#.#.....',
    '..#.#.#.#...',
    '..#.#.#.#...',
    '..#.#.#.#...',
    '..#######.#.',
    '..#######.#.',
    '..#########.',
    '..########..',
    '...#######..',
    '...######...',
    '....#####...',
    '....#####...',
  ],
  // Armário (despensa) com seta entrando.
  pantry: [
    '.....##.....',
    '...######...',
    '....####....',
    '.....##.....',
    '############',
    '#....##....#',
    '#....##....#',
    '#...#..#...#',
    '#....##....#',
    '#....##....#',
    '############',
    '.#........#.',
  ],
  // Caixa com seta entrando: guardar na caixa pet.
  boxIn: [
    '.....##.....',
    '.....##.....',
    '...######...',
    '....####....',
    '.....##.....',
    '#..........#',
    '############',
    '#..........#',
    '#...####...#',
    '#..........#',
    '#..........#',
    '############',
  ],
  // Caixa aberta (abas para cima): abrir a caixa de enfeites.
  openBox: [
    '............',
    '##........##',
    '.##......##.',
    '..#......#..',
    '############',
    '#..........#',
    '#..........#',
    '#...####...#',
    '#..........#',
    '#..........#',
    '############',
    '............',
  ],
  // Bandeja.
  tray: [
    '............',
    '............',
    '............',
    '.....##.....',
    '....####....',
    '...#....#...',
    '..#......#..',
    '############',
    '.##########.',
    '............',
    '............',
    '............',
  ],
  // Carrinho do Market no losango de atalhos (QuickMenu). PLACEHOLDER(arte): desenhado por código.
  cart: [
    '#...........',
    '.#..........',
    '.##########.',
    '.#........#.',
    '..#......#..',
    '..#......#..',
    '..########..',
    '..#.........',
    '..#########.',
    '............',
    '...##...##..',
    '...##...##..',
  ],
};

export type ActionIcon = keyof typeof ICONS;

/** Ícones com arte do PixelLab (assets/ui/actions, 32 x 32): no lugar do desenho por código. */
const ART: Partial<Record<ActionIcon, string>> = {
  place: 'assets/ui/actions/place.png',
  pantry: 'assets/ui/actions/to_pantry.png',
  toBag: 'assets/ui/actions/to_bag.png',
};

/** O ícone: a arte do PixelLab, se houver; senão o SVG (12 x 12 pixels da arte, desenhado em `px`), na cor do texto. */
export function actionIconSvg(name: ActionIcon, px = 12): string {
  const art = ART[name];
  if (art) return `<img class="action-icon art" src="${art}" alt="" aria-hidden="true" />`;
  const rows = ICONS[name] ?? [];
  const rects: string[] = [];
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) if (row[x] === '#') rects.push(`<rect x="${x}" y="${y}" width="1" height="1"/>`);
  });
  return `<svg class="action-icon" width="${px}" height="${px}" viewBox="0 0 12 12" shape-rendering="crispEdges" fill="currentColor" aria-hidden="true">${rects.join('')}</svg>`;
}
