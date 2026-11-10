// npx tsx scripts/map-praca.ts: gera data/maps/minigame_praca.json: a praça do Confiança do gato (20x12, o tamanho da tela do mini game).
// Chão: tiles de transição grama -> pedregulhos (praca_<v>_<NW><NE><SW><SE>), escolhidos pelos cantos de cada célula,
// com a variação (v2/v3) sorteada por célula; a borda da grama ondula em trechos longos (curvas largas).
import { writeFileSync } from 'node:fs';

const COLS = 24, ROWS = 12; // o recorte da câmera é 20x12 (minigames.json: view); as 4 colunas a mais só completam o céu
let seed = 11;
const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);

// Vértices: true = grama.
const G: boolean[][] = Array.from({ length: ROWS + 1 }, () => Array<boolean>(COLS + 1).fill(false));
const edge: number[] = [];
for (let vx = 0, depth = 4; vx <= COLS; ) {
  const run = 3 + Math.floor(rnd() * 4);
  for (let k = 0; k < run && vx <= COLS; k++, vx++) edge.push(depth);
  depth = depth === 4 ? 5 : 4;
}
for (let vx = 0; vx <= COLS; vx++) for (let vy = 0; vy <= edge[vx]!; vy++) G[vy]![vx] = true;
// Canteiros de grama nos cantos de baixo (fecham o quadro).
const beds: [number, number, number][] = [[0, 3, 10], [0, 1, 9], [17, 20, 10], [19, 20, 9], [20, 24, 9]];
for (const [x0, x1, y0] of beds) for (let vx = x0; vx <= x1; vx++) for (let vy = y0; vy <= ROWS; vy++) G[vy]![vx] = true;

const legend: Record<string, string> = {};
const charOf: Record<string, string> = {};
const pool = [...'ABCDEFGHIJKLMNOPQRSUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'];
const ch = (tile: string): string => {
  if (!charOf[tile]) {
    const c = pool.shift()!;
    charOf[tile] = c;
    legend[c] = tile;
  }
  return charOf[tile];
};
const code = (g: boolean) => (g ? 'g' : 'p');
const floor: string[] = [];
const walls: string[] = [];
for (let r = 0; r < ROWS; r++) {
  let f = '', w = '';
  for (let c = 0; c < COLS; c++) {
    // Linhas 0 e 1: o céu (objeto); linha 2: a sebe (parede) com grama embaixo.
    if (r < 3) f += ch(`praca_v2_gggg`);
    else {
      const at = (y: number, x: number) => G[y]![x]!;
      const k = code(at(r, c)) + code(at(r, c + 1)) + code(at(r + 1, c)) + code(at(r + 1, c + 1));
      // Grama ou pedregulho puros são iguais nas duas variações (o mesmo tile de base): sempre a v2.
      const v = k === 'gggg' || k === 'pppp' ? 'v2' : rnd() < 0.5 ? 'v2' : 'v3';
      f += ch(`praca_${v}_${k}`);
    }
    w += r === 2 ? 'T' : '.';
  }
  floor.push(f);
  walls.push(w);
}
legend.T = 'yard_sebe_topo';

const obj = (id: string, tile: string, at: [number, number], extra: Record<string, unknown> = {}) => ({ id: `obj.praca_${id}`, tile, at, ...extra });
const map = {
  schemaVersion: 1,
  id: 'map.minigame_praca',
  tileSize: 32,
  size: { cols: COLS, rows: ROWS },
  background: '#a9d4ea',
  lighting: 'outdoor',
  legend,
  layers: { floor, walls },
  objects: [
    // Céu e cidade ao fundo
    obj('ceu_a', 'yard_fundo_ceu_telhados', [0, 0]),
    obj('ceu_b', 'yard_fundo_ceu_telhados', [6, 0]),
    obj('ceu_c', 'yard_fundo_ceu_telhados', [12, 0]),
    obj('ceu_d', 'yard_fundo_ceu_telhados', [18, 0]),
    // Árvores plantadas na grama, na frente da sebe (atrás dela o motor não esconde o tronco: os objetos ficam por
    // cima da parede; o fundo já tem árvores e casas).
    obj('arvore_1', 'prop_arvore', [2, 1]),
    obj('arvore_2', 'prop_arvore', [10, 1]),
    obj('arvore_3', 'prop_arvore', [13, 1]),
    // Postes na borda; os bancos nos recuos de grama (colunas 5-7 e 15-17 da borda), com o vaso de flores ao lado
    obj('poste_1', 'prop_poste', [0, 1]),
    obj('poste_2', 'prop_poste', [18, 1]),
    obj('banco_1', 'prop_banco', [5, 3]),
    obj('vaso_1', 'yard_vaso_baixo_flores', [7, 4]),
    obj('banco_2', 'prop_banco', [15, 3]),
    obj('vaso_2', 'yard_vaso_baixo_flores', [17, 4]),
  ],
  spawn: { player: [5, 7] },
};
// Formato do projeto: uma linha por linha do mapa, objetos em uma linha cada.
const j = (x: unknown) => JSON.stringify(x);
const out = `{
  "schemaVersion": 1,
  "_comment": "Praça do mini game Confiança do gato (decisão 155): céu e cidade, sebe com árvores, grama com borda em curvas e a calçada de pedregulhos (tiles de transição do PixelLab, praca_<variação>_<cantos NW NE SW SE>, g = grama, p = pedregulho). Gerado por um script com semente fixa; para mexer na borda, edite as letras do chão.",
  "id": "map.minigame_praca",
  "tileSize": 32,
  "size": { "cols": ${COLS}, "rows": ${ROWS} },
  "background": "#a9d4ea",
  "lighting": "outdoor",
  "legend": {
${Object.entries(legend).map(([k, v]) => `    ${j(k)}: ${j(v)}`).join(',\n')}
  },
  "layers": {
    "floor": [
${floor.map((l) => `      ${j(l)}`).join(',\n')}
    ],
    "walls": [
${walls.map((l) => `      ${j(l)}`).join(',\n')}
    ]
  },
  "objects": [
${map.objects.map((o) => `    ${j(o)}`).join(',\n')}
  ],
  "spawn": { "player": [5, 7] }
}
`;
writeFileSync('data/maps/minigame_praca.json', out);
console.log('ok', Object.keys(legend).length, 'letras');
