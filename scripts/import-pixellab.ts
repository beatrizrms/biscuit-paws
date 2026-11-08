// npx tsx scripts/import-pixellab.ts (npm run pixellab): junta numa folha de 64 px (resolução 2, decisão 052)
// as peças geradas no PixelLab e aprovadas, e escreve o JSON de peças.
// Os PNGs baixados ficam em assets/_pixellab/<pasta>/ e a folha vai para public/assets (os dois fora do Git).
// Cada peça encosta a base no fim das suas células: `dy` desce o desenho quando sobra margem embaixo.
// Folhas com `auto` arrumam as peças sozinhas (da esquerda para a direita, `columns` tiles por linha).
// `recolor` troca uma faixa de matiz por outra (cores alternativas por código, decisão 065);
// `mirror` espelha; `over` desenha outra imagem por cima (ex.: registradora sobre o balcão);
// `rows` remonta a peça com linhas escolhidas da origem; `wear` faz a versão velha (piso e parede antes da reforma).
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { PNG } from 'pngjs';

const TS = 64;
const SRC = 'assets/_pixellab';

interface Recolor {
  /** Faixa de matiz de origem, em graus (pode dar a volta: [330, 20]). */
  from: [number, number];
  /** Matiz novo, em graus. */
  hue: number;
  /** Multiplica a saturação (padrão 1). */
  sat?: number;
  /** Soma à luminosidade, de -1 a 1 (padrão 0). */
  light?: number;
}

interface Piece {
  /** Arquivo em assets/_pixellab (ou vazio quando a peça é desenhada por `build`). */
  file: string;
  /** Desenha a peça por código (teias grandes, raio de sol, poeira montada com pedaços). */
  build?: () => PNG;
  w: number;
  h: number;
  col?: number;
  row?: number;
  dy?: number;
  mirror?: boolean;
  /** Uma troca ou várias (cada pixel usa a primeira faixa em que cai, olhando a cor original). */
  recolor?: Recolor | Recolor[];
  /** Outros nomes com a mesma imagem (ex.: as versões por estação, quando a arte é a mesma o ano todo). */
  aliases?: string[];
  over?: { file: string; dx: number; dy: number };
  /** Monta a peça com estas linhas da origem, na ordem (ex.: esticar o lambri repetindo as tábuas). */
  rows?: number[];
  /** Versão velha (antes da reforma): mais escura, desbotada e com pintinhas de sujeira. */
  wear?: boolean;
  /** Quantas variações seguidas na linha (com wear: cada uma com outra semente de sujeira). */
  variants?: number;
  /** Linhas de arte acima da peça, sem ocupar a célula (a imagem tem h + rise tiles de altura). */
  rise?: number;
}

interface Sheet {
  image: string;
  pieces: string;
  columns: number;
  rows?: number;
  auto?: boolean;
  layout: Record<string, Piece>;
}

const range = (a: number, b: number) => Array.from({ length: b - a + 1 }, (_, i) => a + i);

const PINK: [number, number] = [330, 25];
const GREEN: [number, number] = [70, 170];

const SHEETS: Sheet[] = [
  {
    image: 'public/assets/objects/pixellab/tile_pixellab_lote01.png',
    pieces: 'data/tilesets/pixellab_lote01.json',
    columns: 4,
    rows: 2,
    layout: {
      door_closed: { file: 'lote01/door64x128.png', col: 0, row: 0, w: 1, h: 2, dy: 3 },
      door_open: { file: 'lote01/door64x128_aberta.png', col: 1, row: 0, w: 1, h: 2, dy: 3 },
      cookie_jar_a_full: { file: 'lote01/obj_7.png', col: 2, row: 0, w: 1, h: 1 },
      cookie_jar_a_empty: { file: 'lote01/obj_7_vazio.png', col: 2, row: 1, w: 1, h: 1 },
      cookie_jar_b_full: { file: 'lote01/obj_9.png', col: 3, row: 0, w: 1, h: 1 },
      cookie_jar_b_empty: { file: 'lote01/obj_9_vazio.png', col: 3, row: 1, w: 1, h: 1 },
    },
  },
  {
    // Arte nova do café: os nomes são os tiles que já existem (tilesets.json: replaces).
    image: 'public/assets/objects/pixellab/tile_pixellab_cafe.png',
    pieces: 'data/tilesets/pixellab_cafe.json',
    columns: 12,
    auto: true,
    layout: {
      cat_tree: { file: '01_cafe_1/arvore_gato_vazia.png', w: 2, h: 3 },
      floor_rug: { file: '01_cafe_1/tapete_a_vazio.png', w: 3, h: 2 },
      cat_condo: { file: '01_cafe_1/torre_gato_vazia.png', w: 2, h: 2 },
      window: { file: '02_cafe_2/janela_fechada_128.png', w: 2, h: 2 },
      bookshelf: { file: '02_cafe_2/estante_64x128.png', w: 1, h: 2 },
      plant_tall: { file: '02_cafe_2/planta_alta_a.png', w: 1, h: 2 },
      door: { file: 'lote01/door64x128.png', w: 1, h: 2, dy: 3 },
      sofa: { file: '03_cafe_3/sofa_128x64.png', w: 2, h: 1, recolor: { from: PINK, hue: 150, sat: 0.7 } },
      display_case: { file: '03_cafe_3/vitrine_cheia_128x64.png', w: 2, h: 1 },
      menu_board: { file: '03_cafe_3/lousa_a.png', w: 2, h: 1 },
      table_round: { file: 'piloto01/obj_7.png', w: 1, h: 1 },
      chair_front: { file: '02_cafe_2/cadeira_frente.png', w: 1, h: 1 },
      chair_left: { file: '02_cafe_2/cadeira_esq.png', w: 1, h: 1 },
      chair_right: { file: '02_cafe_2/cadeira_dir.png', w: 1, h: 1 },
      chair_back: { file: '02_cafe_2/cadeira_costas.png', w: 1, h: 1 },
      plant_pot: { file: 'piloto01/obj_13.png', w: 1, h: 1 },
      plant_hanging: { file: '05_06_cafe/obj_1.png', w: 1, h: 1 },
      cat_bed: { file: 'piloto01/obj_9.png', w: 1, h: 1 },
      food_bowl: { file: 'lote01/obj_0.png', w: 1, h: 1 },
      water_bowl: { file: 'lote01/obj_3.png', w: 1, h: 1 },
      cushion_pink: { file: 'piloto01/obj_8.png', w: 1, h: 1 },
      cushion_mint: { file: 'piloto01/obj_8.png', w: 1, h: 1, recolor: { from: PINK, hue: 150, sat: 0.7 } },
      cushion_sky: { file: 'piloto01/obj_8.png', w: 1, h: 1, recolor: { from: PINK, hue: 205, sat: 0.8 } },
      cushion_lav: { file: 'piloto01/obj_8.png', w: 1, h: 1, recolor: { from: PINK, hue: 265, sat: 0.7 } },
      cushion_butter: { file: 'piloto01/obj_8.png', w: 1, h: 1, recolor: { from: PINK, hue: 42, sat: 1.5, light: -0.06 } },
      picture_paw: { file: 'piloto01/obj_14.png', w: 1, h: 1 },
      flower_vase: { file: 'piloto01/obj_12.png', w: 1, h: 1 },
      yarn_balls: { file: '05_06_cafe/obj_13.png', w: 1, h: 1 },
      scratch_post: { file: 'piloto01/obj_10.png', w: 1, h: 1 },
      cactus: { file: 'piloto01/obj_5.png', w: 1, h: 1 },
      doormat: { file: '04_cafe_4/obj_7.png', w: 1, h: 1 },
      counter_left: { file: '', w: 1, h: 1, build: () => counterPiece('m1', 'left') },
      counter_mid: { file: '', w: 1, h: 1, build: () => counterPiece('m1', 'mid') },
      counter_right: { file: '', w: 1, h: 1, build: () => counterPiece('m1', 'right') },
      counter_single: { file: '', w: 1, h: 1, build: () => counterPiece('m1', 'single') },
      counter_register: { file: '', w: 1, h: 1, rise: 1, build: () => raised(counterPiece('m1', 'mid'), 1), over: { file: 'mercado_A/obj_0.png', dx: 0, dy: TS - 27 } },
      bar_balcao_esq: { file: '', w: 1, h: 1, build: () => counterPiece('m1', 'left') },
      bar_balcao_meio: { file: '', w: 1, h: 1, build: () => counterPiece('m1', 'mid') },
      bar_balcao_dir: { file: '', w: 1, h: 1, build: () => counterPiece('m1', 'right') },
      wall_shelf: { file: 'cafe_superficies/prateleira_2x1.png', w: 2, h: 1 },
      wall_clock: { file: 'cafe_superficies/relogio.png', w: 1, h: 1 },
    },
  },
  {
    // Pisos e paredes do café (acabamentos do pintor e as versões velhas, antes da reforma).
    image: 'public/assets/interiors/cafe/tile_pixellab_cafe_superficies.png',
    pieces: 'data/tilesets/pixellab_cafe_superficies.json',
    columns: 6,
    auto: true,
    layout: {
      floor_wood_a: { file: 'cafe_superficies/tile_0.png', w: 1, h: 1 },
      floor_wood_b: { file: 'cafe_superficies/tile_1.png', w: 1, h: 1 },
      floor_check_pink: { file: 'cafe_superficies/tile_2.png', w: 1, h: 1 },
      floor_tile_mint: { file: 'cafe_superficies/tile_3.png', w: 1, h: 1 },
      wall_stripe_pink: { file: 'cafe_superficies/tile_4.png', w: 1, h: 1 },
      wall_dots_cream: { file: 'cafe_superficies/tile_5.png', w: 1, h: 1 },
      wall_mint: { file: 'cafe_superficies/tile_6.png', w: 1, h: 1 },
      wall_wainscot: { file: 'cafe_superficies/tile_7.png', w: 1, h: 1, rows: [...range(26, 33), ...range(34, 63), ...range(34, 59)] },
      floor_wood_old: { file: 'cafe_superficies/tile_0.png', w: 1, h: 1, wear: true, variants: 4 },
      floor_check_old: { file: 'cafe_superficies/tile_2.png', w: 1, h: 1, wear: true, variants: 4 },
      wall_stripe_old: { file: 'cafe_superficies/tile_4.png', w: 1, h: 1, wear: true, variants: 4 },
      wall_wainscot_old: { file: 'cafe_superficies/tile_7.png', w: 1, h: 1, rows: [...range(26, 33), ...range(34, 63), ...range(34, 59)], wear: true, variants: 4 },
    },
  },
  {
    // Cores novas do café (itens novos): nomes novos, não trocam nada.
    image: 'public/assets/objects/pixellab/tile_pixellab_cafe_cores.png',
    pieces: 'data/tilesets/pixellab_cafe_cores.json',
    columns: 6,
    auto: true,
    layout: {
      sofa_rosa: { file: '03_cafe_3/sofa_128x64.png', w: 2, h: 1 },
      sofa_ceu: { file: '03_cafe_3/sofa_128x64.png', w: 2, h: 1, recolor: { from: PINK, hue: 205, sat: 0.8 } },
      cat_bed_rosa: { file: 'piloto01/obj_9.png', w: 1, h: 1, recolor: { from: GREEN, hue: 350, sat: 1.9, light: 0.03 } },
      cat_bed_lilas: { file: 'piloto01/obj_9.png', w: 1, h: 1, recolor: { from: GREEN, hue: 268, sat: 1.7, light: 0.03 } },
      counter_a_left: { file: '', w: 1, h: 1, build: () => counterPiece('a', 'left') },
      counter_a_mid: { file: '', w: 1, h: 1, build: () => counterPiece('a', 'mid') },
      counter_a_right: { file: '', w: 1, h: 1, build: () => counterPiece('a', 'right') },
      counter_a_single: { file: '', w: 1, h: 1, build: () => counterPiece('a', 'single') },
      counter_b_left: { file: '', w: 1, h: 1, build: () => counterPiece('b', 'left') },
      counter_b_mid: { file: '', w: 1, h: 1, build: () => counterPiece('b', 'mid') },
      counter_b_right: { file: '', w: 1, h: 1, build: () => counterPiece('b', 'right') },
      counter_b_single: { file: '', w: 1, h: 1, build: () => counterPiece('b', 'single') },
      // Base da pia do jogo (eq_pia): peça única do modelo 1 com a cuba; as tiras de animação partem dela.
      sink_counter_m1: { file: '', w: 1, h: 1, build: () => withSink(counterPiece('m1', 'single')) },
    },
  },
  {
    // Sujeira do café (antes da faxina): troca a arte das peças dirt_* (mesmos nomes e tamanhos).
    // Reaproveita as peças do café abandonado e as sujeiras do PixelLab; teias grandes e raio de sol por código.
    image: 'public/assets/objects/dirt/tile_dirt_pixellab.png',
    pieces: 'data/tilesets/sujeira_pixellab.json',
    columns: 8,
    auto: true,
    layout: {
      dirt_raio_de_sol: { file: '', w: 2, h: 3, build: () => sunbeam(128, 192) },
      dirt_teia_canto_grande_esq: { file: '', w: 2, h: 2, build: () => web(128, 112, false) },
      dirt_teia_canto_grande_dir: { file: '', w: 2, h: 2, build: () => web(128, 112, true) },
      dirt_teia_janela: { file: '', w: 2, h: 2, build: () => windowWebs() },
      dirt_poeira_densa: { file: '', w: 2, h: 2, build: () => compose(128, 128, [['cafe_sujeira/obj_0.png', 0, 4], ['cafe_sujeira/obj_8.png', 60, 10], ['cafe_sujeira/obj_1.png', 30, 56], ['cafe_sujeira/obj_0.png', 66, 62]]) },
      dirt_poeira_c: { file: '', w: 2, h: 1, build: () => compose(128, 64, [['cafe_sujeira/obj_0.png', 0, 0], ['cafe_sujeira/obj_8.png', 62, 2]]) },
      dirt_teia_fio_aranha: { file: 'cafe_sujeira/fio_aranha.png', w: 1, h: 2, recolor: { from: [0, 360], hue: 30, sat: 0.08 } },
      dirt_escorrido_parede: { file: '', w: 1, h: 2, build: () => clearTop(readPng(`${SRC}/cafe_sujeira/escorrido.png`), 12) },
      dirt_teia_canto_esq: { file: 'fachadas/abandonado/obj_6.png', w: 1, h: 1 },
      dirt_teia_canto_dir: { file: 'fachadas/abandonado/obj_6.png', w: 1, h: 1, mirror: true },
      dirt_poeira_a: { file: 'cafe_sujeira/obj_0.png', w: 1, h: 1 },
      dirt_poeira_b: { file: 'cafe_sujeira/obj_1.png', w: 1, h: 1 },
      dirt_mancha_agua: { file: 'fachadas/abandonado/obj_4.png', w: 1, h: 1 },
      dirt_mancha_bolor: { file: 'fachadas/abandonado/obj_11.png', w: 1, h: 1 },
      dirt_mancha_fuligem: { file: 'cafe_sujeira/obj_6.png', w: 1, h: 1 },
      dirt_rachadura_a: { file: 'fachadas/abandonado/obj_2.png', w: 1, h: 1 },
      dirt_rachadura_b: { file: 'fachadas/abandonado/obj_3.png', w: 1, h: 1 },
      dirt_vidro_quebrado: { file: 'fachadas/abandonado/obj_8.png', w: 1, h: 1 },
      dirt_papeis_chao: { file: 'cafe_sujeira/obj_2.png', w: 1, h: 1 },
      dirt_folhas_secas: { file: 'fachadas/abandonado/obj_14.png', w: 1, h: 1 },
      dirt_buraco_rato: { file: '', w: 1, h: 1, build: () => holeOnly(readPng(`${SRC}/cafe_sujeira/obj_10.png`)) },
      dirt_balde_goteira: { file: 'cafe_sujeira/obj_4.png', w: 1, h: 1 },
      dirt_particulas_poeira: { file: 'cafe_sujeira/obj_5.png', w: 1, h: 1 },
    },
  },
  {
    // Mercado: troca as peças antigas de mesmo tamanho (parede, piso, janela, geladeiras, carrinho, placas...).
    image: 'public/assets/interiors/market/tile_pixellab_market.png',
    pieces: 'data/tilesets/pixellab_market.json',
    columns: 8,
    auto: true,
    layout: {
      market_parede_topo: { file: '', w: 1, h: 1, build: () => sliceRows(readPng(`${SRC}/mercado_C/parede.png`), 0) },
      market_parede_meio: { file: '', w: 1, h: 1, build: () => sliceRows(readPng(`${SRC}/mercado_C/parede.png`), 0) },
      market_parede_rodape: { file: '', w: 1, h: 1, build: () => sliceRows(readPng(`${SRC}/mercado_C/parede.png`), TS) },
      market_chao_a: { file: 'mercado_A/piso_pequeno.png', w: 1, h: 1 },
      market_chao_b: { file: 'mercado_A/piso_pequeno.png', w: 1, h: 1 },
      market_chao_aisle: { file: 'mercado_A/piso_pequeno.png', w: 1, h: 1 },
      market_chao_pet: { file: 'mercado_A/piso_pequeno.png', w: 1, h: 1 },
      market_janela: { file: 'mercado_A/janela_fechada.png', w: 1, h: 2 },
      market_porta: { file: 'mercado_A/porta_fechada.png', w: 1, h: 2 },
      market_geladeira_bebidas: { file: 'mercado_C/geladeira_64.png', w: 1, h: 2, dy: 5 },
      market_geladeira_pet: { file: 'mercado_C/geladeira_64.png', w: 1, h: 2, dy: 5 },
      market_caixa_registradora: { file: 'mercado_A/obj_0.png', w: 1, h: 1 },
      market_carrinho: { file: 'mercado_A/obj_9.png', w: 1, h: 1, dy: 3 },
      market_cestas: { file: 'mercado_A/obj_11.png', w: 1, h: 1, dy: 4 },
      market_lixeira: { file: 'mercado_A/obj_13.png', w: 1, h: 1, dy: 6 },
      market_luminaria: { file: 'mercado_A/obj_15.png', w: 1, h: 1 },
      market_placa_mercearia: { file: 'mercado_C/placa_mercado.png', w: 3, h: 1 },
      market_placa_pet: { file: 'mercado_C/placa_pet.png', w: 2, h: 1 },
      market_placa_ofertas: { file: '', w: 3, h: 1, build: () => jobBoard() },
      market_capacho: { file: '04_cafe_4/obj_9.png', w: 1, h: 1 },
    },
  },
  {
    // Mercado: peças grandes novas (gôndolas 3x2, bancas de frutas 3x1, caixa 3x2) e cestas/carrinhos.
    image: 'public/assets/interiors/market/tile_pixellab_market_novos.png',
    pieces: 'data/tilesets/pixellab_market_novos.json',
    columns: 6,
    auto: true,
    layout: {
      gondola_mercearia: { file: 'mercado_C/gondola_mercearia.png', w: 3, h: 2 },
      gondola_pet: { file: '', w: 3, h: 2, build: () => withLeftPost(readPng(`${SRC}/mercado_C/gondola_pet.png`), 175, 182) },
      caixa: { file: 'mercado_C/caixa_3x2.png', w: 3, h: 2, dy: 12 },
      banca_a: { file: 'mercado_C/banca_a.png', w: 3, h: 1 },
      banca_b: { file: 'mercado_C/banca_b.png', w: 3, h: 1 },
      carrinhos_fila: { file: 'mercado_A/obj_10.png', w: 1, h: 1, dy: 3 },
      cestas_vime: { file: 'mercado_A/obj_12.png', w: 1, h: 1, dy: 4 },
    },
  },
  {
    // Clínica: troca as peças antigas de mesmo tamanho (parede, piso, armário, recepção, mesa de exame, gaiolas...).
    image: 'public/assets/interiors/vet_clinic/tile_pixellab_vet.png',
    pieces: 'data/tilesets/pixellab_vet.json',
    columns: 8,
    auto: true,
    layout: {
      vet_parede_papel_topo: { file: '', w: 1, h: 1, build: () => sliceRows(readPng(`${SRC}/clinica/parede_azul.png`), 0) },
      vet_parede_papel: { file: '', w: 1, h: 1, build: () => sliceRows(readPng(`${SRC}/clinica/parede_azul.png`), 0) },
      vet_parede_azulejo: { file: '', w: 1, h: 1, build: () => sliceRows(readPng(`${SRC}/clinica/parede_azul.png`), TS) },
      vet_piso_xadrez: { file: 'clinica/piso.png', w: 1, h: 1 },
      vet_tapete_entrada: { file: '', w: 3, h: 1, build: () => compose(3 * TS, TS, [['04_cafe_4/obj_7.png', TS, 0], ['04_cafe_4/obj_7.png', 2 * TS, 0]]) },
      vet_armario_medicamentos: { file: 'clinica/armario_2x2.png', w: 2, h: 2 },
      vet_balcao_recepcao: { file: 'clinica/recepcao_3x2.png', w: 3, h: 2, dy: 10 },
      vet_mesa_exame: { file: 'clinica/mesa_exame_2x2.png', w: 2, h: 2, dy: 4 },
      vet_gaiola_vazia: { file: 'clinica/gaiolas_2x2.png', w: 2, h: 2, dy: 8 },
      vet_gaiola_gato: { file: 'clinica/gaiolas_2x2.png', w: 2, h: 2, dy: 8 },
      vet_gaiola_cachorro: { file: 'clinica/gaiolas_2x2.png', w: 2, h: 2, dy: 8 },
      vet_banco_espera: { file: 'clinica/banco_espera_2x1.png', w: 2, h: 1, dy: 3 },
      vet_placa_recepcao: { file: 'clinica/placa_recepcao_2x1.png', w: 2, h: 1 },
      vet_planta_vaso: { file: '02_cafe_2/planta_alta_a.png', w: 1, h: 2 },
      vet_porta_consultorio: { file: 'clinica/porta_azul.png', w: 1, h: 2 },
      vet_balanca: { file: 'clinica/obj_0.png', w: 1, h: 1, dy: 8 },
      vet_carrinho_instrumentos: { file: 'clinica/obj_1.png', w: 1, h: 1, dy: 4 },
      vet_negatoscopio: { file: 'clinica/obj_2.png', w: 1, h: 1 },
      vet_luminaria_teto: { file: 'clinica/obj_4.png', w: 1, h: 1 },
      vet_placa_cruz_vet: { file: 'clinica/obj_5.png', w: 1, h: 1 },
      vet_quadro_avisos: { file: 'clinica/obj_7.png', w: 1, h: 1 },
      vet_cartaz_cachorro: { file: 'clinica/obj_9.png', w: 1, h: 1 },
      vet_cartaz_gato: { file: 'clinica/obj_11.png', w: 1, h: 1 },
      vet_lixeira_pedal: { file: 'clinica/obj_13.png', w: 1, h: 1, dy: 4 },
    },
  },
  {
    // Clínica: peças novas (janela azul 1x2, bancada com pia 3x1, banho, bancos de lado, caixa de transporte...).
    image: 'public/assets/interiors/vet_clinic/tile_pixellab_vet_novos.png',
    pieces: 'data/tilesets/pixellab_vet_novos.json',
    columns: 6,
    auto: true,
    layout: {
      janela_azul: { file: 'clinica/janela_azul.png', w: 1, h: 2 },
      bancada_pia: { file: 'clinica/bancada_pia_3x1.png', w: 3, h: 1, dy: 3 },
      banho: { file: 'clinica/banho_2x1.png', w: 2, h: 1 },
      banco_lado_dir: { file: 'clinica/banco_lado_dir_1x2.png', w: 1, h: 2, dy: 8 },
      banco_lado_esq: { file: 'clinica/banco_lado_esq_1x2.png', w: 1, h: 2, dy: 8 },
      caixa_transporte: { file: 'clinica/obj_3.png', w: 1, h: 1, dy: 4 },
      primeiros_socorros: { file: 'clinica/obj_14.png', w: 1, h: 1, dy: 4 },
    },
  },
  {
    // Fachadas da rua: trocam as antigas (mesmos nomes e tamanhos). A arte é a mesma o ano todo (rua agnóstica):
    // as versões por estação apontam para a mesma imagem. Letreiros escritos por código (signText).
    image: 'public/assets/env/street/tile_pixellab_fachadas.png',
    pieces: 'data/tilesets/pixellab_fachadas.json',
    columns: 12,
    auto: true,
    layout: {
      facade_loja_velha: { file: 'fachadas/loja_velha.png', w: 5, h: 8 },
      facade_loja_menta: { file: '', w: 5, h: 8, build: () => cafeFacade(), aliases: seasonal('loja_menta') },
      facade_loja_rosa: { file: '', w: 5, h: 8, build: () => cafeFacade(CAFE_ROSA), aliases: seasonal('loja_rosa') },
      facade_loja_ceu: { file: '', w: 5, h: 8, build: () => cafeFacade(CAFE_CEU), aliases: seasonal('loja_ceu') },
      facade_loja_moveis: { file: '', w: 6, h: 8, build: () => signText(readPng(`${SRC}/fachadas/loja_moveis.png`), 'MÓVEIS', [22, 267, 362, 293], [252, 238, 212], [70, 36, 24]), aliases: seasonal('loja_moveis') },
      facade_mercado: { file: '', w: 7, h: 8, build: () => signText(readPng(`${SRC}/fachadas/mercado.png`), 'MERCADO', [20, 268, 428, 295], [200, 52, 70], [250, 226, 214]), aliases: seasonal('mercado') },
      facade_veterinaria: { file: '', w: 6, h: 8, build: () => signText(readPng(`${SRC}/fachadas/veterinaria.png`), 'VETERINÁRIA', [20, 264, 310, 292], [70, 120, 84], [236, 218, 204]) },
      facade_casa_a: { file: 'fachadas/casa_a.png', w: 4, h: 8, aliases: seasonal('casa_a') },
      facade_casa_b: { file: 'fachadas/casa_b.png', w: 4, h: 8, aliases: seasonal('casa_b') },
      facade_casa_c: { file: 'fachadas/casa_c.png', w: 4, h: 8, aliases: seasonal('casa_c') },
    },
  },
  {
    // Neve sobre as fachadas novas (inverno): desenhada por código em cima do contorno do telhado.
    image: 'public/assets/env/street/tile_pixellab_fachadas_neve.png',
    pieces: 'data/tilesets/pixellab_fachadas_neve.json',
    columns: 12,
    auto: true,
    layout: {
      snow_facade_loja_velha: { file: '', w: 5, h: 8, build: () => snowCap(readPng(`${SRC}/fachadas/loja_velha.png`), 1) },
      snow_facade_loja_menta: { file: '', w: 5, h: 8, build: () => snowCap(readPng(`${SRC}/fachadas/cafe_menta.png`), 2) },
      snow_facade_loja_rosa: { file: '', w: 5, h: 8, build: () => snowCap(readPng(`${SRC}/fachadas/cafe_menta.png`), 2) },
      snow_facade_loja_ceu: { file: '', w: 5, h: 8, build: () => snowCap(readPng(`${SRC}/fachadas/cafe_menta.png`), 2) },
      snow_facade_loja_moveis: { file: '', w: 6, h: 8, build: () => snowCap(readPng(`${SRC}/fachadas/loja_moveis.png`), 3) },
      snow_facade_mercado: { file: '', w: 7, h: 8, build: () => snowCap(readPng(`${SRC}/fachadas/mercado.png`), 4) },
      snow_facade_casa_a: { file: '', w: 4, h: 8, build: () => snowCap(readPng(`${SRC}/fachadas/casa_a.png`), 5) },
      snow_facade_casa_b: { file: '', w: 4, h: 8, build: () => snowCap(readPng(`${SRC}/fachadas/casa_b.png`), 6) },
      snow_facade_casa_c: { file: '', w: 4, h: 8, build: () => snowCap(readPng(`${SRC}/fachadas/casa_c.png`), 7) },
    },
  },
];

/**
 * Mural de pedidos do mercado (3x1): a moldura da lousa do café, com o fundo limpo
 * (sem os desenhos de café) e papéis de pedido pregados.
 */
function jobBoard(): PNG {
  const lousa = readPng(`${SRC}/03_cafe_3/lousa_a.png`);
  const green: [number, number, number] = [57, 66, 57];
  for (let y = 14; y <= 52; y++) for (let x = 15; x <= 112; x++) plot(lousa, x, y, green);
  const paper: [number, number, number] = [244, 232, 204], edge: [number, number, number] = [98, 49, 25], ink: [number, number, number] = [176, 150, 118];
  const pins: [number, number, number][] = [[201, 84, 72], [96, 138, 170], [214, 170, 72], [201, 84, 72], [120, 156, 100]];
  ([[22, 19, 16, 22], [42, 23, 18, 20], [64, 18, 16, 24], [84, 22, 18, 21]] as const).forEach(([x0, y0, w, h], k) => {
    for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) {
      plot(lousa, x, y, x === x0 || y === y0 || x === x0 + w - 1 || y === y0 + h - 1 ? edge : paper);
    }
    for (let l = 0; l < 3; l++) line(lousa, x0 + 3, y0 + 7 + l * 4, x0 + w - 4 - (l === 2 ? 4 : 0), y0 + 7 + l * 4, ink);
    plot(lousa, x0 + (w >> 1), y0 + 2, pins[k]!); plot(lousa, x0 + (w >> 1) + 1, y0 + 2, pins[k]!);
    plot(lousa, x0 + (w >> 1), y0 + 3, pins[k]!); plot(lousa, x0 + (w >> 1) + 1, y0 + 3, pins[k]!);
  });
  const out = blank(3 * TS, TS);
  for (let y = 0; y < TS; y++) lousa.data.copy(out.data, (y * out.width + 32) * 4, y * lousa.width * 4, (y + 1) * lousa.width * 4);
  return out;
}

/** A gôndola pet veio sem a coluna da esquerda: ela é a da direita (colunas a..b) espelhada, e o resto anda para a direita. */
function withLeftPost(src: PNG, a: number, b: number): PNG {
  const post = b - a + 1;
  const cols = [...range(a, b).reverse(), ...range(1, src.width - post)];
  return columns(src, cols);
}

// ---------- Fachadas da rua ----------

/** Nomes das versões por estação de uma fachada (a arte nova é a mesma o ano todo). */
function seasonal(name: string): string[] {
  return ['spring', 'summer', 'autumn'].map((s) => `${s}_facade_${name}`);
}

// Cores do café por código, a partir da menta (decisão 065): o verde vira a cor nova e o rosa (porta, toldo) vira o contraste.
const MINT: [number, number] = [125, 180];
const ROSE: [number, number] = [320, 358];
const CAFE_ROSA: Recolor[] = [{ from: MINT, hue: 342, sat: 0.9, light: 0.02 }, { from: ROSE, hue: 155, sat: 0.75 }];
const CAFE_CEU: Recolor[] = [{ from: MINT, hue: 208, sat: 0.95 }, { from: ROSE, hue: 44, sat: 1.3, light: 0.02 }];

function cafeFacade(colors?: Recolor[]): PNG {
  const png = readPng(`${SRC}/fachadas/cafe_menta.png`);
  if (colors) recolor(png, colors);
  return signText(png, 'CAFÉ', [22, 265, 298, 294], [250, 240, 214], [34, 52, 44]);
}

/** Letras 5x7 (I tem 3 de largura); o acento agudo fica nas 2 linhas de cima. */
const FONT: Record<string, string[]> = {
  A: ['.###.', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
  C: ['.####', '#....', '#....', '#....', '#....', '#....', '.####'],
  D: ['####.', '#...#', '#...#', '#...#', '#...#', '#...#', '####.'],
  E: ['#####', '#....', '#....', '####.', '#....', '#....', '#####'],
  F: ['#####', '#....', '#....', '####.', '#....', '#....', '#....'],
  I: ['###', '.#.', '.#.', '.#.', '.#.', '.#.', '###'],
  M: ['#...#', '##.##', '#.#.#', '#.#.#', '#...#', '#...#', '#...#'],
  N: ['#...#', '##..#', '#.#.#', '#..##', '#...#', '#...#', '#...#'],
  O: ['.###.', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
  R: ['####.', '#...#', '#...#', '####.', '#.#..', '#..#.', '#...#'],
  S: ['.####', '#....', '#....', '.###.', '....#', '....#', '####.'],
  T: ['#####', '..#..', '..#..', '..#..', '..#..', '..#..', '..#..'],
  V: ['#...#', '#...#', '#...#', '#...#', '#...#', '.#.#.', '..#..'],
};
const ACUTE = ['...#.', '..#..'];
const PLAIN: Record<string, string> = { 'É': 'E', 'Á': 'A', 'Ó': 'O' };

/**
 * Escreve o texto do letreiro (letras por código, não por IA), centrado na caixa [x0, y0, x1, y1],
 * na maior escala inteira que couber, com sombra de 1 pixel na cor `shadow`.
 */
function signText(png: PNG, text: string, [x0, y0, x1, y1]: [number, number, number, number], ink: [number, number, number], shadow: [number, number, number]): PNG {
  const glyphs = [...text].map((ch) => ({ rows: FONT[PLAIN[ch] ?? ch]!, accent: ch in PLAIN }));
  const accent = glyphs.some((g) => g.accent);
  const width = (k: number) => glyphs.reduce((w, g) => w + g.rows[0]!.length * k, 0) + (glyphs.length - 1) * k + k;
  const height = (k: number) => (7 + (accent ? 3 : 0)) * k + k;
  let k = 4;
  while (k > 1 && (width(k) > x1 - x0 - 8 || height(k) > y1 - y0 - 4)) k--;
  let x = x0 + Math.floor((x1 - x0 + 1 - width(k)) / 2);
  const top = y0 + Math.floor((y1 - y0 + 1 - height(k)) / 2) + (accent ? 3 * k : 0);
  const cell = (cx: number, cy: number, rgb: [number, number, number]) => {
    for (let dy = 0; dy < k; dy++) for (let dx = 0; dx < k; dx++) plot(png, cx + dx, cy + dy, rgb);
  };
  const draw = (gx: number, g: (typeof glyphs)[number], rgb: [number, number, number], off: number) => {
    g.rows.forEach((row, ry) => [...row].forEach((c, rx) => { if (c === '#') cell(gx + rx * k + off, top + ry * k + off, rgb); }));
    if (g.accent) {
      const ax = gx + Math.floor((g.rows[0]!.length - 5) / 2) * k;
      ACUTE.forEach((row, ry) => [...row].forEach((c, rx) => { if (c === '#') cell(ax + rx * k + off, top - (3 - ry) * k + off, rgb); }));
    }
  };
  for (const g of glyphs) {
    draw(x, g, shadow, k);
    draw(x, g, ink, 0);
    x += (g.rows[0]!.length + 1) * k;
  }
  return png;
}

/**
 * Neve do inverno por cima de uma fachada: uma camada sobre o contorno de cima (telhado, chaminé, platibanda),
 * com a borda de baixo ondulada (semente fixa) e uma sombra azulada. A imagem tem o tamanho da fachada.
 */
function snowCap(src: PNG, seed: number): PNG {
  const out = blank(src.width, src.height);
  const rnd = () => (seed = (seed * 16807 + 11) % 2147483647) / 2147483647;
  const white: [number, number, number] = [250, 252, 255], shade: [number, number, number] = [196, 214, 234], line: [number, number, number] = [150, 170, 196];
  let depth = 4;
  for (let x = 0; x < src.width; x++) {
    let top = -1;
    for (let y = 0; y < src.height; y++) if (src.data[(y * src.width + x) * 4 + 3]! > 0) { top = y; break; }
    if (top < 0) continue;
    depth = Math.max(3, Math.min(7, depth + (rnd() < 0.3 ? (rnd() < 0.5 ? -1 : 1) : 0)));
    const y0 = Math.max(0, top - 2);
    for (let y = y0; y < top + depth; y++) plot(out, x, y, y >= top + depth - 2 ? shade : white);
    plot(out, x, top + depth, line);
  }
  return out;
}

/** Um tile (64 px) da imagem, começando na linha y0. */
function sliceRows(src: PNG, y0: number): PNG {
  return pickRows(src, range(y0, y0 + TS - 1));
}

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h * 60, s, l];
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1));
  return [Math.round(f(0) * 255), Math.round(f(8) * 255), Math.round(f(4) * 255)];
}

const inRange = (h: number, [a, b]: [number, number]) => (a <= b ? h >= a && h <= b : h >= a || h <= b);

function recolor(png: PNG, rcs: Recolor | Recolor[]): void {
  const list = Array.isArray(rcs) ? rcs : [rcs];
  for (let i = 0; i < png.data.length; i += 4) {
    if (!png.data[i + 3]) continue;
    const [h, s, l] = rgbToHsl(png.data[i]!, png.data[i + 1]!, png.data[i + 2]!);
    const rc = list.find((c) => inRange(h, c.from));
    if (s < 0.12 || !rc) continue;
    const [r, g, b] = hslToRgb(rc.hue, Math.min(1, s * (rc.sat ?? 1)), Math.max(0, Math.min(1, l + (rc.light ?? 0))));
    png.data[i] = r; png.data[i + 1] = g; png.data[i + 2] = b;
  }
}

function load(p: Piece, variant = 0): PNG {
  let png: PNG = p.build ? p.build() : PNG.sync.read(readFileSync(`${SRC}/${p.file}`));
  const h = p.h + (p.rise ?? 0);
  if (png.width !== p.w * TS || png.height !== h * TS) {
    throw new Error(`${p.file}: ${png.width}x${png.height}, esperado ${p.w * TS}x${h * TS} (${p.w}x${h} tiles)`);
  }
  if (p.rows) png = pickRows(png, p.rows);
  if (p.recolor) recolor(png, p.recolor);
  if (p.wear) wear(png, 7 + variant * 101);
  if (p.over) {
    const o = PNG.sync.read(readFileSync(`${SRC}/${p.over.file}`));
    for (let y = 0; y < o.height; y++) for (let x = 0; x < o.width; x++) {
      const X = x + p.over.dx, Y = y + p.over.dy;
      if (X < 0 || Y < 0 || X >= png.width || Y >= png.height) continue;
      const s = (y * o.width + x) * 4, d = (Y * png.width + X) * 4, a = o.data[s + 3]! / 255;
      if (!a) continue;
      for (let c = 0; c < 3; c++) png.data[d + c] = Math.round(o.data[s + c]! * a + png.data[d + c]! * (1 - a));
      png.data[d + 3] = Math.max(png.data[d + 3]!, o.data[s + 3]!);
    }
  }
  return png;
}

/** A peça com `rise` tiles vazios em cima (para desenhar o que sobe acima dela). */
function raised(png: PNG, rise: number): PNG {
  const out = new PNG({ width: png.width, height: png.height + rise * TS });
  png.data.copy(out.data, rise * TS * png.width * 4);
  return out;
}

/** Nova imagem com as linhas escolhidas da origem (mesma largura). */
function pickRows(src: PNG, rows: number[]): PNG {
  const out = new PNG({ width: src.width, height: rows.length });
  rows.forEach((sy, y) => src.data.copy(out.data, y * src.width * 4, sy * src.width * 4, (sy + 1) * src.width * 4));
  return out;
}

/** Piso/parede velhos: mais escuros e desbotados, com pintinhas de sujeira (semente fixa: sempre igual). */
function wear(png: PNG, seed = 7): void {
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < png.data.length; i += 4) {
    const r = png.data[i]!, g = png.data[i + 1]!, b = png.data[i + 2]!, l = (r + g + b) / 3;
    const dirt = rnd() < 0.04 ? 0.78 : 1;
    png.data[i] = Math.round((r * 0.7 + l * 0.3) * 0.86 * dirt + 6);
    png.data[i + 1] = Math.round((g * 0.7 + l * 0.3) * 0.84 * dirt + 4);
    png.data[i + 2] = Math.round((b * 0.7 + l * 0.3) * 0.8 * dirt);
  }
}

/** Arruma as peças em linhas de `columns` tiles, na ordem da lista. */
function autoLayout(sheet: Sheet): number {
  let col = 0, row = 0, rowH = 0;
  for (const p of Object.values(sheet.layout)) {
    if (col + p.w * (p.variants ?? 1) > sheet.columns) { row += rowH; col = 0; rowH = 0; }
    p.col = col; p.row = row;
    col += p.w * (p.variants ?? 1); rowH = Math.max(rowH, p.h + (p.rise ?? 0));
  }
  return row + rowH;
}


// ---------- Balcões de tampo fundo (3 modelos, decisão 065) ----------
// Cada modelo veio como um balcão de 3 tiles (192x64). As peças saem fatiando nos painéis da frente,
// repetindo/tirando colunas de dentro do painel para dar 64 px (como no balcão antigo do café).
// O modelo 1 veio com a pia na ponta esquerda: o tampo dela é refeito com o tampo do meio.
interface CounterModel { file: string; p1r: number; p2r: number; hasSink?: boolean; slats?: boolean }
const BT = 'balcao_teste';
const COUNTERS: Record<string, CounterModel> = {
  m1: { file: `${BT}/modelo1_com_pia.png`, p1r: 61, p2r: 121, hasSink: true },
  a: { file: `${BT}/balcao_pia_var_a_sem_pia.png`, p1r: 62, p2r: 120 },
  b: { file: `${BT}/balcao_pia_var_b_sem_pia.png`, p1r: 63, p2r: 127, slats: true },
};
const SINK = { file: `${BT}/modelo1_com_pia.png`, x0: 15, x1: 52, y0: 2, y1: 32 };

const isSinkPixel = (d: Buffer, i: number) => {
  const r = d[i]!, g = d[i + 1]!, b = d[i + 2]!, mx = Math.max(r, g, b), mn = Math.min(r, g, b);
  return d[i + 3]! > 0 && ((mx - mn < 24 && mx > 55) || (r + g + b) / 3 < 70);
};

/** Imagem do modelo sem a pia (o tampo sob a pia vem da mesma linha, 64 px à direita). */
function counterStrip(m: CounterModel): PNG {
  const png = readPng(`${SRC}/${m.file}`);
  if (m.hasSink) {
    for (let y = SINK.y0; y <= SINK.y1; y++) for (let x = SINK.x0; x <= SINK.x1; x++) {
      const i = (y * png.width + x) * 4;
      if (isSinkPixel(png.data, i)) png.data.copy(png.data, i, i + 64 * 4, i + 64 * 4 + 4);
    }
  }
  return png;
}

function columns(src: PNG, cols: number[]): PNG {
  const out = new PNG({ width: cols.length, height: src.height });
  cols.forEach((sx, x) => { for (let y = 0; y < src.height; y++) src.data.copy(out.data, (y * cols.length + x) * 4, (y * src.width + sx) * 4, (y * src.width + sx) * 4 + 4); });
  return out;
}

/** Fatia um modelo em ponta esquerda, meio, ponta direita e peça única (64 px cada). */
function counterPiece(model: string, part: 'left' | 'mid' | 'right' | 'single'): PNG {
  const m = COUNTERS[model]!, src = counterStrip(m), W = src.width;
  if (m.slats) return columns(src, { left: range(0, 63), mid: range(64, 127), right: range(128, 191), single: [...range(0, 31), ...range(W - 32, W - 1)] }[part]);
  const fit = (cols: number[], center: number) => {
    while (cols.length < 64) cols.splice(cols.indexOf(center) + 1, 0, center);
    while (cols.length > 64) cols.splice(cols.indexOf(center), 1);
    return cols;
  };
  const left = fit(range(0, m.p1r), Math.round(m.p1r / 2));
  const mid = fit(range(m.p1r + 1, m.p2r), Math.round((m.p1r + m.p2r) / 2));
  const right = fit(range(m.p2r + 1, W - 1), Math.round((m.p2r + W) / 2));
  return columns(src, { left, mid, right, single: [...range(0, 31), ...range(W - 32, W - 1)] }[part]);
}

/** Cola a cuba e a torneira do modelo 1 no meio de uma peça. */
function withSink(tile: PNG, dx = -2): PNG {
  const s = readPng(`${SRC}/${SINK.file}`);
  for (let y = SINK.y0; y <= SINK.y1; y++) for (let x = SINK.x0; x <= SINK.x1; x++) {
    const i = (y * s.width + x) * 4;
    if (!isSinkPixel(s.data, i)) continue;
    const X = x + dx; if (X < 0 || X >= tile.width) continue;
    s.data.copy(tile.data, (y * tile.width + X) * 4, i, i + 4);
  }
  return tile;
}

// ---------- Sujeira desenhada por código ----------

function readPng(path: string): PNG {
  return PNG.sync.read(readFileSync(path));
}

/** Só o buraco preto da peça (o miolo preto, cada linha preenchida de ponta a ponta), encostado na base do tile. */
function holeOnly(src: PNG): PNG {
  const W = src.width, H = src.height;
  const dark = (i: number) => src.data[i * 4 + 3]! > 0 && (src.data[i * 4]! + src.data[i * 4 + 1]! + src.data[i * 4 + 2]!) / 3 < 10;
  let seed = -1;
  for (let y = H - 1; y >= 0 && seed < 0; y--) if (dark(y * W + (W >> 1))) seed = y * W + (W >> 1);
  const keep = new Set<number>([seed]);
  for (const stack = [seed]; stack.length; ) {
    const i = stack.pop()!, x = i % W, y = (i / W) | 0;
    for (const [nx, ny] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]] as const) {
      const n = ny * W + nx;
      if (nx >= 0 && ny >= 0 && nx < W && ny < H && !keep.has(n) && dark(n)) { keep.add(n); stack.push(n); }
    }
  }
  const span = new Map<number, [number, number]>();
  for (const i of keep) {
    const x = i % W, y = (i / W) | 0, [a, b] = span.get(y) ?? [x, x];
    span.set(y, [Math.min(a, x), Math.max(b, x)]);
  }
  const bottom = Math.max(...span.keys());
  const out = blank(W, H);
  for (const [y, [a, b]] of span) for (let x = a; x <= b; x++) src.data.copy(out.data, ((y + H - 1 - bottom) * W + x) * 4, seed * 4, seed * 4 + 4);
  return out;
}

function blank(w: number, h: number): PNG {
  return new PNG({ width: w, height: h });
}

function plot(png: PNG, x: number, y: number, rgb: [number, number, number], a = 255): void {
  if (x < 0 || y < 0 || x >= png.width || y >= png.height) return;
  const d = (y * png.width + x) * 4;
  png.data[d] = rgb[0]; png.data[d + 1] = rgb[1]; png.data[d + 2] = rgb[2]; png.data[d + 3] = Math.max(png.data[d + 3]!, a);
}

function line(png: PNG, x0: number, y0: number, x1: number, y1: number, rgb: [number, number, number], a = 255): void {
  x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
  const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  for (;;) {
    plot(png, x0, y0, rgb, a);
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) { err += dy; x0 += sx; }
    if (e2 <= dx) { err += dx; y0 += sy; }
  }
}

/** Teia de canto: raios saindo do canto de cima e fios em arco (pontos dos raios ligados). */
function web(w: number, r: number, mirror: boolean): PNG {
  const png = blank(w, w);
  const light: [number, number, number] = [214, 210, 202], dark: [number, number, number] = [150, 146, 140];
  const spokes = [0, 14, 30, 46, 62, 78, 90].map((d) => (d * Math.PI) / 180);
  const pt = (ang: number, rad: number): [number, number] => {
    const x = Math.cos(ang) * rad, y = Math.sin(ang) * rad;
    return [mirror ? w - 1 - x : x, y];
  };
  for (const a of spokes) { const [x, y] = pt(a, r); line(png, mirror ? w - 1 : 0, 0, x, y, dark, 230); }
  for (const rad of [18, 34, 52, 72, 94]) {
    if (rad > r) break;
    for (let i = 0; i < spokes.length - 1; i++) {
      const [x0, y0] = pt(spokes[i]!, rad - 3 + (i % 2) * 4), [x1, y1] = pt(spokes[i + 1]!, rad + 1 - (i % 2) * 3);
      line(png, x0, y0, x1, y1, i % 2 ? light : dark, 210);
    }
  }
  return png;
}

/** Teias na janela: duas teias pequenas nos cantos de cima e alguns fios soltos. */
function windowWebs(): PNG {
  const png = blank(128, 128), l = web(128, 46, false), rr = web(128, 46, true);
  for (let i = 0; i < png.data.length; i += 4) for (const src of [l, rr]) if (src.data[i + 3]) src.data.copy(png.data, i, i, i + 4);
  const grey: [number, number, number] = [196, 192, 186];
  line(png, 46, 2, 70, 60, grey, 180); line(png, 82, 4, 60, 70, grey, 170); line(png, 64, 0, 64, 90, grey, 150);
  return png;
}

/** Raio de sol: faixa diagonal de luz quente, transparente, com pontinhos de poeira. */
function sunbeam(w: number, h: number): PNG {
  const png = blank(w, h);
  let seed = 11;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const left = 10 + y * 0.42, right = 64 + y * 0.42;
    if (x < left || x > right) continue;
    const edge = Math.min(x - left, right - x);
    const a = Math.min(70, 18 + edge * 2.2) * (1 - y / h * 0.45);
    plot(png, x, y, [255, 236, 170], Math.round(a));
    if (rnd() < 0.006) plot(png, x, y, [255, 250, 225], 200);
  }
  return png;
}

/** Junta pedaços (arquivo, x, y) numa peça maior. */
function compose(w: number, h: number, parts: [string, number, number][]): PNG {
  const png = blank(w, h);
  for (const [file, ox, oy] of parts) {
    const src = readPng(`${SRC}/${file}`);
    for (let y = 0; y < src.height; y++) for (let x = 0; x < src.width; x++) {
      const s = (y * src.width + x) * 4;
      if (!src.data[s + 3]) continue;
      const X = ox + x, Y = oy + y;
      if (X < 0 || Y < 0 || X >= w || Y >= h) continue;
      src.data.copy(png.data, (Y * w + X) * 4, s, s + 4);
    }
  }
  return png;
}

/** Apaga as primeiras linhas (o Pixen desenhou um xadrez de fundo no topo do escorrido). */
function clearTop(png: PNG, rows: number): PNG {
  png.data.fill(0, 0, rows * png.width * 4);
  return png;
}

// Equipamentos e pia: tiras de animação no mesmo arranjo das folhas antigas (parado, preparo, pronto),
// para o jogo continuar igual (tilesets.json: animation). Os quadros de preparo vêm do animate_image do PixelLab;
// o "pronto" é o último quadro com um brilho desenhado por código; a pia ganha louça suja/limpa por cima.
const EQ = `${SRC}/cafe_equip`;

function paste(dst: PNG, src: PNG, col: number, row: number, dx = 0, dy = 0): void {
  for (let y = 0; y < src.height; y++) for (let x = 0; x < src.width; x++) {
    const X = col * TS + x + dx, Y = row * TS + y + dy;
    if (X < col * TS || Y < row * TS || X >= (col + 1) * TS || Y >= (row + 1) * TS) continue;
    const s = (y * src.width + x) * 4, d = (Y * dst.width + X) * 4, a = src.data[s + 3]! / 255;
    if (!a) continue;
    for (let c = 0; c < 3; c++) dst.data[d + c] = Math.round(src.data[s + c]! * a + dst.data[d + c]! * (1 - a) * (dst.data[d + 3]! / 255));
    dst.data[d + 3] = Math.max(dst.data[d + 3]!, src.data[s + 3]!);
  }
}

/** Brilho de "pronto": estrelinha amarela no canto de cima à direita da célula. */
function sparkle(dst: PNG, col: number, row: number): void {
  const cx = col * TS + 54, cy = row * TS + 8;
  const px = (x: number, y: number, rgb: [number, number, number]) => {
    const d = (y * dst.width + x) * 4;
    dst.data[d] = rgb[0]; dst.data[d + 1] = rgb[1]; dst.data[d + 2] = rgb[2]; dst.data[d + 3] = 255;
  };
  for (let k = -4; k <= 4; k++) { px(cx + k, cy, [255, 236, 150]); px(cx, cy + k, [255, 236, 150]); }
  for (let k = -2; k <= 2; k++) { px(cx + k, cy, [255, 250, 220]); px(cx, cy + k, [255, 250, 220]); }
  px(cx, cy, [255, 255, 255]);
}

/** Copia do quadro parado as linhas de cima (o PixelLab desenhou um pão em cima do forno; só a janela anima). */
function keepTop(frame: PNG, base: PNG, rows: number): PNG {
  const out = PNG.sync.read(PNG.sync.write(frame));
  base.data.copy(out.data, 0, 0, rows * base.width * 4);
  return out;
}


interface Strip { image: string; pieces: string; columns: number; rows: { name: string; frames: (dst: PNG, row: number) => void }[] }

const anim = (name: string, i: number) => readPng(`${EQ}/anim_${name}_${i}.png`);
/** Linha padrão: parado, 4 de preparo, pronto (último de preparo + brilho). */
const equipRow = (name: string, work = [1, 2, 3, 4], fix?: (f: PNG) => PNG, ready?: number) => (dst: PNG, row: number) => {
  const f = (i: number) => (fix ? fix(anim(name, i)) : anim(name, i));
  paste(dst, anim(name, 0), 0, row);
  work.forEach((w, k) => paste(dst, f(w), 1 + k, row));
  paste(dst, f(ready ?? work[work.length - 1]!), 5, row);
  sparkle(dst, 5, row);
};

const STRIPS: Strip[] = [
  {
    image: 'public/assets/objects/equipment/anim_kitchen_equipment_pixellab.png',
    pieces: 'data/tilesets/equipamentos.json',
    columns: 6,
    rows: [
      { name: 'bule', frames: equipRow('bule') },
      { name: 'liquidificador', frames: equipRow('liquidificador') },
      { name: 'espremedor', frames: equipRow('espremedor') },
      { name: 'fogao', frames: equipRow('fogao') },
      { name: 'forno', frames: equipRow('forno', [1, 2, 3, 2], (f) => keepTop(f, anim('forno', 0), 22), 3) },
    ],
  },
  { image: 'public/assets/objects/equipment/anim_coffee_maker_pixellab.png', pieces: 'data/tilesets/cafeteira.json', columns: 6, rows: [{ name: 'cafeteira', frames: equipRow('espresso') }] },
  {
    image: 'public/assets/objects/equipment/anim_sink_pixellab.png',
    pieces: 'data/tilesets/pia.json',
    columns: 7,
    rows: [{
      name: 'pia',
      // 0 vazia, 1 louça suja, 2-5 lavando, 6 louça limpa (tilesets.json: work [2,5], dirty 1, clean 6).
      frames: (dst, row) => {
        const base = anim('piam1', 0);
        paste(dst, base, 0, row);
        paste(dst, base, 1, row); paste(dst, readPng(`${EQ}/obj_7.png`), 1, row, 2, -6);
        [1, 2, 3, 4].forEach((w, k) => paste(dst, anim('piam1', w), 2 + k, row));
        paste(dst, base, 6, row); paste(dst, readPng(`${EQ}/obj_8.png`), 6, row, -4, -6);
      },
    }],
  },
];

for (const sheet of SHEETS) {
  const rows = sheet.auto ? autoLayout(sheet) : sheet.rows!;
  const out = new PNG({ width: sheet.columns * TS, height: rows * TS });
  const pieces: Record<string, { col: number; row: number; w_tiles: number; h_tiles: number; variants?: number; rise?: number }> = {};
  for (const [name, p] of Object.entries(sheet.layout)) {
    for (let v = 0; v < (p.variants ?? 1); v++) {
      const png = load(p, v);
      const dy = p.dy ?? 0;
      for (let y = 0; y + dy < png.height; y++) {
        for (let x = 0; x < png.width; x++) {
          const sx = p.mirror ? png.width - 1 - x : x;
          const src = (y * png.width + sx) * 4;
          const dst = ((p.row! * TS + y + dy) * out.width + (p.col! + v * p.w) * TS + x) * 4;
          png.data.copy(out.data, dst, src, src + 4);
        }
      }
    }
    pieces[name] = { col: p.col!, row: p.row!, w_tiles: p.w, h_tiles: p.h, ...(p.variants ? { variants: p.variants } : {}), ...(p.rise ? { rise: p.rise } : {}) };
    for (const alias of p.aliases ?? []) pieces[alias] = pieces[name]!;
  }
  mkdirSync(sheet.image.slice(0, sheet.image.lastIndexOf('/')), { recursive: true });
  writeFileSync(sheet.image, PNG.sync.write(out));
  writeFileSync(sheet.pieces, JSON.stringify({ tileSize: TS, columns: sheet.columns, rows, pieces }, null, 1) + '\n');
  console.log(`${sheet.image}: ${Object.keys(pieces).length} peças`);
}

for (const strip of STRIPS) {
  const out = new PNG({ width: strip.columns * TS, height: strip.rows.length * TS });
  const pieces: Record<string, { col: number; row: number; w_tiles: number; h_tiles: number; first_tile_id: number }> = {};
  strip.rows.forEach((r, row) => {
    r.frames(out, row);
    pieces[r.name] = { col: 0, row, w_tiles: 1, h_tiles: 1, first_tile_id: row * strip.columns };
  });
  writeFileSync(strip.image, PNG.sync.write(out));
  writeFileSync(strip.pieces, JSON.stringify({ tileSize: TS, columns: strip.columns, rows: strip.rows.length, pieces }, null, 1) + '\n');
  console.log(`${strip.image}: ${strip.rows.length} linha(s) de animação`);
}
