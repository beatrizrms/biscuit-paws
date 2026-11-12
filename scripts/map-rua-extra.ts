// npx tsx scripts/map-rua-extra.ts: gera data/maps/praca.json e data/maps/alley.json, os lugares novos da rua.
// Praça (entrada na rua depois do beco): céu e cidade ao fundo, sebe, um caminho de pedregulhos atravessando e a praça calçada
// no meio (tiles de transição parque_<v>_<cantos NW NE SW SE>, g = grama, p = pedregulho; neve no inverno), com árvores, bancos, postes e
// floreiras e o chafariz grande no centro; à esquerda o coreto e o parquinho (balanço e escorregador), à direita a banca
// de jornal e as barraquinhas (hot dog, pipoca); árvores na terra de 4 jeitos (grande, média, fina, jovem) espalhadas. Beco (ponta esquerda da rua): muros dos fundos das casas,
// chão de paralelepípedos (neve no inverno), lixeiras, caixotes e as caixinhas de papelão da colônia de gatos.
// Arte do PixelLab (folha pixellab_beco): o muro de tijolos, a caçamba, as portas dos fundos, o varal e o chafariz.
// Saídas pelas bordas: portas com direction (left/right) para a rua.
import { writeFileSync } from 'node:fs';

type Obj = { id: string; tile: string; at: [number, number]; inWall?: true; overlay?: string };
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
  const COLS = 30, ROWS = 16;
  let seed = 23;
  const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
  // Vértices: true = pedregulho. O caminho atravessa (linhas 7-8, da rua até a outra ponta) e a praça calçada no meio,
  // de cantos arredondados.
  const paved = (vx: number, vy: number) => {
    if (vy >= 7 && vy <= 9) return true;
    // 11 tiles de largura (colunas 10 a 20): o chafariz (3) fica no meio, na coluna 15.
    const inPlaza = vx >= 10 && vx <= 21 && vy >= 3 && vy <= 14;
    const corner = (vx === 10 || vx === 21) && (vy === 3 || vy === 14);
    return inPlaza && !corner;
  };
  const { legend, ch } = legendMaker();
  const floor: string[] = [];
  const walls: string[] = [];
  for (let r = 0; r < ROWS; r++) {
    let f = '', w = '';
    for (let c = 0; c < COLS; c++) {
      // Linhas 0 e 1: o céu (objeto); linha 2: a sebe (parede) com grama embaixo.
      if (r < 3) f += ch('parque_v2_gggg');
      else {
        const code = (x: number, y: number) => (paved(x, y) ? 'p' : 'g');
        const k = code(c, r) + code(c + 1, r) + code(c, r + 1) + code(c + 1, r + 1);
        const v = k === 'gggg' || k === 'pppp' ? 'v2' : rnd() < 0.5 ? 'v2' : 'v3';
        f += ch(`parque_${v}_${k}`);
      }
      w += r === 2 ? 'T' : '.';
    }
    floor.push(f);
    walls.push(w);
  }
  // A sebe com neve no inverno (parque_ muda com a estação).
  legend.T = 'parque_sebe_topo';
  // Neve do inverno por cima das coisas (overlay, some fora do inverno); as árvores já têm a dela no inverno.
  const SNOW: Record<string, string> = {
    prop_banco: 'snow_praca_banco',
    prop_poste: 'snow_praca_poste',
    prop_lixeira: 'snow_praca_lixeira',
    ...Object.fromEntries(['praca_chafariz', 'praca_coreto', 'praca_hotdog', 'praca_banca', 'praca_pipoca', 'praca_balanco', 'praca_escorregador', 'praca_canteiro', 'praca_bebedouro', 'yard_vaso_baixo_flores', 'decor_floreira'].map((t) => [t, `snow_${t}`])),
  };
  const obj = (id: string, tile: string, at: [number, number]): Obj => ({ id: `obj.praca_${id}`, tile, at, ...(SNOW[tile] ? { overlay: SNOW[tile] } : {}) });
  write('data/maps/praca.json', {
    comment:
      'A pracinha da vila (ponta direita da rua; gerada por scripts/map-rua-extra.ts, semente fixa): céu e cidade, sebe, o caminho de pedregulhos que atravessa e a praça calçada no meio (tiles parque_<variação>_<cantos NW NE SW SE>, g = grama, p = pedregulho; no inverno, neve). No centro, o chafariz grande; à esquerda o coreto e o parquinho; à direita a banca de jornal e os carrinhos de hot dog e pipoca; árvores na terra de 4 jeitos (mudam de cor com a estação). Saída pela esquerda (portas com direction left) para a rua.',
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
      obj('ceu_e', 'yard_fundo_ceu_telhados', [24, 0]),
      // A praça calçada: o chafariz no centro (coluna 15), bancos em volta com vasos de flores, canteiros no mesmo eixo e
      // postes nos cantos.
      obj('chafariz', 'praca_chafariz', [14, 7]),
      obj('banco_1', 'prop_banco', [11, 4]),
      obj('banco_2', 'prop_banco', [18, 4]),
      obj('banco_3', 'prop_banco', [11, 11]),
      obj('banco_4', 'prop_banco', [18, 11]),
      obj('flor_1', 'yard_vaso_baixo_flores', [10, 5]),
      obj('flor_2', 'yard_vaso_baixo_flores', [20, 5]),
      obj('flor_3', 'yard_vaso_baixo_flores', [10, 12]),
      obj('flor_4', 'yard_vaso_baixo_flores', [20, 12]),
      obj('canteiro_1', 'praca_canteiro', [14, 3]),
      obj('canteiro_2', 'praca_canteiro', [14, 12]),
      obj('poste_1', 'prop_poste', [8, 3]),
      obj('poste_2', 'prop_poste', [21, 3]),
      obj('poste_3', 'prop_poste', [8, 10]),
      obj('poste_4', 'prop_poste', [21, 10]),
      // Lado da entrada (esquerda): o coreto entre as árvores, o bebedouro, floreiras e a lixeira no caminho.
      obj('coreto', 'praca_coreto', [3, 3]),
      obj('arvore_1', 'prop_arvore_grande', [0, 2]),
      obj('arvore_2', 'prop_arvore_fina', [6, 3]),
      obj('arvore_3', 'prop_arvore_jovem_b', [5, 5]),
      obj('bebedouro', 'praca_bebedouro', [1, 5]),
      obj('floreira_1', 'decor_floreira', [3, 6]),
      obj('floreira_2', 'decor_floreira', [2, 9]),
      obj('lixeira_1', 'prop_lixeira', [7, 6]),
      // O parquinho embaixo, com árvores em volta e atrás.
      obj('balanco', 'praca_balanco', [1, 10]),
      obj('escorregador', 'praca_escorregador', [5, 10]),
      obj('arvore_4', 'prop_arvore_media_c', [0, 13]),
      obj('arvore_5', 'prop_arvore_grande_b', [3, 13]),
      obj('arvore_6', 'prop_arvore_jovem', [6, 14]),
      obj('arvore_7', 'prop_arvore_fina', [7, 12]),
      obj('arvore_14', 'prop_arvore_fina', [0, 9]),
      obj('arvore_15', 'prop_arvore_jovem_c', [4, 11]),
      obj('arvore_16', 'prop_arvore_jovem_b', [7, 9]),
      obj('arvore_17', 'prop_arvore_jovem_c', [2, 15]),
      // Embaixo da praça calçada: uma fileira de árvores na grama.
      obj('arvore_18', 'prop_arvore_fina', [10, 13]),
      obj('arvore_19', 'prop_arvore_jovem_b', [12, 15]),
      obj('arvore_20', 'prop_arvore_media', [17, 13]),
      obj('arvore_21', 'prop_arvore_jovem_c', [19, 15]),
      obj('arvore_22', 'prop_arvore_fina', [20, 13]),
      // Lado de lá (direita): a banca de jornal, o carrinho de hot dog e o de pipoca perto do caminho, um banco e árvores.
      obj('banca', 'praca_banca', [23, 3]),
      obj('hotdog', 'praca_hotdog', [26, 4]),
      obj('arvore_8', 'prop_arvore_fina', [28, 2]),
      obj('arvore_23', 'prop_arvore_jovem_c', [29, 4]),
      obj('lixeira_2', 'prop_lixeira', [23, 6]),
      obj('pipoca', 'praca_pipoca', [23, 9]),
      obj('banco_5', 'prop_banco', [25, 10]),
      obj('arvore_9', 'prop_arvore_grande_c', [27, 9]),
      obj('arvore_10', 'prop_arvore_media_b', [23, 12]),
      obj('arvore_11', 'prop_arvore_grande', [25, 13]),
      obj('arvore_12', 'prop_arvore_jovem', [28, 14]),
      obj('arvore_13', 'prop_arvore_fina', [29, 12]),
      obj('arvore_24', 'prop_arvore_jovem_b', [22, 15]),
    ],
    lights: [
      { at: [9, 3.45], radius: 46, color: '#ffe2a0' },
      { at: [22, 3.45], radius: 46, color: '#ffe2a0' },
      { at: [9, 10.45], radius: 46, color: '#ffe2a0' },
      { at: [22, 10.45], radius: 46, color: '#ffe2a0' },
    ],
    // Saída para a rua: as duas linhas do caminho, andando para a esquerda.
    doors: [
      { id: 'door.praca_street_a', at: [0, 7], to: 'map.street', direction: 'left', spawn: [41, 9], facing: 'down' },
      { id: 'door.praca_street_b', at: [0, 8], to: 'map.street', direction: 'left', spawn: [42, 9], facing: 'down' },
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
      // O chão do beco, todo de paralelepípedos (coberto de neve no inverno: beco_chao_ muda com a estação).
      else f += ch(rnd() < 0.55 ? 'beco_chao_a' : 'beco_chao_b');
      // Muro de tijolos dos fundos das casas: topo, meio (2 linhas) e rodapé.
      w += r === 2 ? 'T' : r === 3 || r === 4 ? 'M' : r === 5 ? 'R' : '.';
    }
    floor.push(f);
    walls.push(w);
  }
  legend.T = 'beco_muro_topo';
  legend.M = 'beco_muro_meio';
  legend.R = 'beco_muro_base';
  // Neve do inverno por cima das coisas (overlay, some fora do inverno); o topo do muro tem a dela no inverno.
  const SNOW: Record<string, string> = {
    beco_cacamba: 'snow_beco_cacamba',
    beco_porta: 'snow_beco_porta',
    prop_lixeira: 'snow_praca_lixeira',
    prop_poste: 'snow_praca_poste',
    prop_caixote_macas: 'snow_prop_caixote_macas',
    prop_caixote_laranjas: 'snow_prop_caixote_laranjas',
    prop_caixa_gato_manta: 'snow_prop_caixa_gato_manta',
    prop_caixa_gato_vazia: 'snow_prop_caixa_gato_vazia',
    prop_caixa_gato_olhos: 'snow_prop_caixa_gato_olhos',
  };
  const obj = (id: string, tile: string, at: [number, number]): Obj => ({ id: `obj.beco_${id}`, tile, at, ...(SNOW[tile] ? { overlay: SNOW[tile] } : {}) });
  write('data/maps/alley.json', {
    comment:
      'O beco atrás das casas (ponta esquerda da rua; gerado por scripts/map-rua-extra.ts): muro de tijolos com portas dos fundos e varal, chão de paralelepípedos (neve no inverno), caçamba, lixeiras, caixotes e as caixinhas de papelão da colônia de gatos (CED). Muro de tijolos, portas dos fundos, varal e caçamba (PixelLab). Saída pela direita (portas com direction right) para a rua.',
    id: 'map.alley',
    cols: COLS,
    rows: ROWS,
    background: '#3a3036',
    legend,
    floor,
    walls,
    objects: [
      // Portas dos fundos das casas, o varal pendurado no muro e um escorrido.
      { ...obj('porta_1', 'beco_porta', [10, 4]), inWall: true },
      { ...obj('porta_2', 'beco_porta', [19, 4]), inWall: true },
      obj('varal', 'beco_varal', [5, 3]),
      obj('escorrido', 'dirt_escorrido_parede', [14, 3]),
      // A caçamba, a lixeira e os caixotes encostados no muro.
      obj('cacamba', 'beco_cacamba', [1, 5]),
      obj('lixeira_1', 'prop_lixeira', [3, 6]),
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
      { id: 'door.alley_street_a', at: [21, 8], to: 'map.street', direction: 'right', spawn: [37, 9], facing: 'down' },
      { id: 'door.alley_street_b', at: [21, 9], to: 'map.street', direction: 'right', spawn: [38, 9], facing: 'down' },
    ],
    spawn: [20, 9],
  });
}
