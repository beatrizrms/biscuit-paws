// npx tsx scripts/map-rua-extra.ts: gera data/maps/praca.json e data/maps/alley.json, os lugares novos da rua.
// Praça (ponta direita da rua): céu e cidade ao fundo, sebe, um caminho de pedregulhos atravessando e a praça calçada
// no meio (tiles de transição praca_<v>_<cantos NW NE SW SE>, g = grama, p = pedregulho), com árvores, bancos, postes e
// floreiras; a topiária do centro guarda o lugar do chafariz. Beco (ponta esquerda da rua): muros dos fundos das casas,
// chão de asfalto com terra, lixeiras, caixotes e as caixinhas de papelão da colônia de gatos.
// PLACEHOLDER(arte): o beco usa peças provisórias (parede do mercado no lugar do muro de tijolos); a praça, a topiária
// no lugar do chafariz. Saídas pelas bordas: portas com direction (left/right) para a rua.
import { writeFileSync } from 'node:fs';

type Obj = { id: string; tile: string; at: [number, number] };
const j = (x: unknown) => JSON.stringify(x);

/** Monta o JSON no formato do projeto (uma linha por linha do mapa, objetos e portas em uma linha cada). */
function write(file: string, m: { comment: string; id: string; cols: number; rows: number; background: string; legend: Record<string, string>; floor: string[]; walls: string[]; objects: Obj[]; lights: unknown[]; doors: unknown[]; spawn: [number, number] }): void {
  const out = `{
  "schemaVersion": 1,
  "_comment": ${j(m.comment)},
  "id": ${j(m.id)},
  "tileSize": 32,
  "size": { "cols": ${m.cols}, "rows": ${m.rows} },
  "background": ${j(m.background)},
  "lighting": "outdoor",
  "lights": [
${m.lights.map((l) => `    ${j(l)}`).join(',\n')}
  ],
  "legend": {
${Object.entries(m.legend).map(([k, v]) => `    ${j(k)}: ${j(v)}`).join(',\n')}
  },
  "layers": {
    "floor": [
${m.floor.map((l) => `      ${j(l)}`).join(',\n')}
    ],
    "walls": [
${m.walls.map((l) => `      ${j(l)}`).join(',\n')}
    ]
  },
  "objects": [
${m.objects.map((o) => `    ${j(o)}`).join(',\n')}
  ],
  "spawn": { "player": ${j(m.spawn)} },
  "doors": [
${m.doors.map((d) => `    ${j(d)}`).join(',\n')}
  ]
}
`;
  writeFileSync(file, out);
}

/** Letras da legenda, na ordem em que os tiles aparecem. */
function legendMaker() {
  const legend: Record<string, string> = {};
  const charOf: Record<string, string> = {};
  const pool = [...'ABCDEFGHIJKLMNOPQRSUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'];
  const ch = (tile: string): string => {
    if (!charOf[tile]) {
      const c = pool.shift()!;
      charOf[tile] = c;
      legend[c] = tile;
    }
    return charOf[tile]!;
  };
  return { legend, ch };
}

// ---------- Praça ----------
{
  const COLS = 24, ROWS = 13;
  let seed = 23;
  const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
  // Vértices: true = pedregulho. O caminho atravessa (linhas 7-8, da rua até a outra ponta) e a praça calçada no meio,
  // de cantos arredondados.
  const paved = (vx: number, vy: number) => {
    if (vy >= 7 && vy <= 9) return true;
    const inPlaza = vx >= 8 && vx <= 16 && vy >= 4 && vy <= 11;
    const corner = (vx === 8 || vx === 16) && (vy === 4 || vy === 11);
    return inPlaza && !corner;
  };
  const { legend, ch } = legendMaker();
  const floor: string[] = [];
  const walls: string[] = [];
  for (let r = 0; r < ROWS; r++) {
    let f = '', w = '';
    for (let c = 0; c < COLS; c++) {
      // Linhas 0 e 1: o céu (objeto); linha 2: a sebe (parede) com grama embaixo.
      if (r < 3) f += ch('praca_v2_gggg');
      else {
        const code = (x: number, y: number) => (paved(x, y) ? 'p' : 'g');
        const k = code(c, r) + code(c + 1, r) + code(c, r + 1) + code(c + 1, r + 1);
        const v = k === 'gggg' || k === 'pppp' ? 'v2' : rnd() < 0.5 ? 'v2' : 'v3';
        f += ch(`praca_${v}_${k}`);
      }
      w += r === 2 ? 'T' : '.';
    }
    floor.push(f);
    walls.push(w);
  }
  legend.T = 'yard_sebe_topo';
  const obj = (id: string, tile: string, at: [number, number]): Obj => ({ id: `obj.praca_${id}`, tile, at });
  write('data/maps/praca.json', {
    comment:
      'A pracinha da vila (ponta direita da rua; gerada por scripts/map-rua-extra.ts, semente fixa): céu e cidade, sebe, o caminho de pedregulhos que atravessa e a praça calçada no meio (tiles praca_<variação>_<cantos NW NE SW SE>, g = grama, p = pedregulho). A topiária do centro guarda o lugar do chafariz (PLACEHOLDER(arte)). Saída pela esquerda (portas com direction left) para a rua.',
    id: 'map.praca',
    cols: COLS,
    rows: ROWS,
    background: '#a9d4ea',
    legend,
    floor,
    walls,
    objects: [
      obj('ceu_a', 'yard_fundo_ceu_telhados', [0, 0]),
      obj('ceu_b', 'yard_fundo_ceu_telhados', [6, 0]),
      obj('ceu_c', 'yard_fundo_ceu_telhados', [12, 0]),
      obj('ceu_d', 'yard_fundo_ceu_telhados', [18, 0]),
      // Árvores na grama dos cantos (as de cima na frente da sebe).
      obj('arvore_1', 'prop_arvore', [1, 1]),
      obj('arvore_2', 'prop_arvore', [4, 2]),
      obj('arvore_3', 'prop_arvore', [19, 2]),
      obj('arvore_4', 'prop_arvore', [21, 1]),
      obj('arvore_5', 'prop_arvore', [2, 9]),
      obj('arvore_6', 'prop_arvore', [20, 9]),
      // Postes nos cantos da praça calçada.
      obj('poste_1', 'prop_poste', [6, 3]),
      obj('poste_2', 'prop_poste', [16, 3]),
      // Bancos em volta do centro (em cima e embaixo), com floreiras ao lado.
      obj('banco_1', 'prop_banco', [9, 4]),
      obj('banco_2', 'prop_banco', [13, 4]),
      obj('banco_3', 'prop_banco', [9, 10]),
      obj('banco_4', 'prop_banco', [13, 10]),
      obj('flor_1', 'yard_vaso_baixo_flores', [8, 5]),
      obj('flor_2', 'yard_vaso_baixo_flores', [15, 5]),
      obj('flor_3', 'yard_vaso_baixo_flores', [8, 10]),
      obj('flor_4', 'yard_vaso_baixo_flores', [15, 10]),
      // O centro da praça: o lugar do chafariz (por enquanto, a topiária).
      obj('centro', 'yard_topiaria', [11, 6]),
      // Floreiras na grama, perto da entrada.
      obj('floreira_1', 'decor_floreira', [1, 6]),
      obj('floreira_2', 'decor_floreira', [3, 6]),
    ],
    lights: [
      { at: [7, 3.45], radius: 46, color: '#ffe2a0' },
      { at: [17, 3.45], radius: 46, color: '#ffe2a0' },
    ],
    // Saída para a rua: as duas linhas do caminho, andando para a esquerda.
    doors: [
      { id: 'door.praca_street_a', at: [0, 7], to: 'map.street', direction: 'left', spawn: [34, 9], facing: 'left' },
      { id: 'door.praca_street_b', at: [0, 8], to: 'map.street', direction: 'left', spawn: [34, 10], facing: 'left' },
    ],
    spawn: [1, 8],
  });
}

// ---------- Beco ----------
{
  const COLS = 22, ROWS = 11;
  let seed = 7;
  const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
  const { legend, ch } = legendMaker();
  const floor: string[] = [];
  const walls: string[] = [];
  for (let r = 0; r < ROWS; r++) {
    let f = '', w = '';
    for (let c = 0; c < COLS; c++) {
      // Em cima do muro: o céu escuro entre os prédios (o fundo do mapa).
      if (r < 2) f += '.';
      else if (r < 6) f += ch('street_asfalto_a');
      else if (r === 6) f += ch(rnd() < 0.7 ? 'street_terra_a' : 'street_terra_b');
      else f += ch(rnd() < 0.55 ? 'street_asfalto_a' : 'street_asfalto_b');
      // Muro dos fundos das casas: topo, meio (2 linhas) e rodapé (PLACEHOLDER(arte): parede do mercado).
      w += r === 2 ? 'T' : r === 3 || r === 4 ? 'M' : r === 5 ? 'R' : '.';
    }
    floor.push(f);
    walls.push(w);
  }
  legend.T = 'market_parede_topo';
  legend.M = 'market_parede_meio';
  legend.R = 'market_parede_rodape';
  const obj = (id: string, tile: string, at: [number, number]): Obj => ({ id: `obj.beco_${id}`, tile, at });
  write('data/maps/alley.json', {
    comment:
      'O beco atrás das casas (ponta esquerda da rua; gerado por scripts/map-rua-extra.ts): muros dos fundos, chão de asfalto com terra, lixeiras, caixotes e as caixinhas de papelão da colônia de gatos (CED). PLACEHOLDER(arte): o muro usa a parede do mercado até ganhar a de tijolos. Saída pela direita (portas com direction right) para a rua.',
    id: 'map.alley',
    cols: COLS,
    rows: ROWS,
    background: '#3a3036',
    legend,
    floor,
    walls,
    objects: [
      // Escorridos no muro.
      obj('escorrido_1', 'dirt_escorrido_parede', [5, 3]),
      obj('escorrido_2', 'dirt_escorrido_parede', [12, 3]),
      // Lixeiras e caixotes encostados no muro.
      obj('lixeira_1', 'prop_lixeira', [2, 6]),
      obj('lixeira_2', 'prop_lixeira', [3, 6]),
      obj('caixote_1', 'prop_caixote_macas', [8, 6]),
      obj('caixote_2', 'prop_caixote_laranjas', [9, 6]),
      obj('lixeira_3', 'prop_lixeira', [18, 6]),
      // A colônia: caixinhas de papelão (abrigo) num canto mais quieto.
      obj('abrigo_1', 'prop_caixa_gato_manta', [12, 6]),
      obj('abrigo_2', 'prop_caixa_gato_vazia', [13, 6]),
      obj('abrigo_3', 'prop_caixa_gato_olhos', [14, 6]),
      // Um poste velho perto da saída.
      obj('poste', 'prop_poste', [16, 3]),
    ],
    lights: [{ at: [17, 3.45], radius: 40, color: '#ffd59a' }],
    // Saída para a rua: andando para a direita, nas linhas de baixo do beco.
    doors: [
      { id: 'door.alley_street_a', at: [21, 8], to: 'map.street', direction: 'right', spawn: [1, 9], facing: 'right' },
      { id: 'door.alley_street_b', at: [21, 9], to: 'map.street', direction: 'right', spawn: [1, 10], facing: 'right' },
    ],
    spawn: [20, 9],
  });
}
