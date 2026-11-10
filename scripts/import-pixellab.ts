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
  build?: (variant: number) => PNG;
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
      // Sem a parede em U (edição do PixelLab sobre a peça já montada, por isso sem dy): a atendente fica do lado de baixo, de costas.
      caixa: { file: 'mercado_C/caixa_3x2_sem_parede.png', w: 3, h: 2 },
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
      // Sem a parede em U (edição do PixelLab sobre a peça já montada, por isso sem dy).
      vet_balcao_recepcao: { file: 'clinica/recepcao_3x2_sem_parede.png', w: 3, h: 2 },
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
      snow_facade_loja_menta: { file: '', w: 5, h: 8, build: () => winterDeco(snowCap(readPng(`${SRC}/fachadas/cafe_menta.png`), 2), [['wreath', 220, 318], ['garland', 92, 288]]) },
      snow_facade_loja_rosa: { file: '', w: 5, h: 8, build: () => winterDeco(snowCap(readPng(`${SRC}/fachadas/cafe_menta.png`), 2), [['wreath', 220, 318], ['garland', 92, 288]]) },
      snow_facade_loja_ceu: { file: '', w: 5, h: 8, build: () => winterDeco(snowCap(readPng(`${SRC}/fachadas/cafe_menta.png`), 2), [['wreath', 220, 318], ['garland', 92, 288]]) },
      snow_facade_loja_moveis: { file: '', w: 6, h: 8, build: () => winterDeco(snowCap(readPng(`${SRC}/fachadas/loja_moveis.png`), 3), [['wreath', 291, 318], ['lights', 90, 286], ['lights', 230, 286]]) },
      snow_facade_mercado: { file: '', w: 7, h: 8, build: () => winterDeco(snowCap(readPng(`${SRC}/fachadas/mercado.png`), 4), [['wreath', 350, 318]]) },
      snow_facade_casa_a: { file: '', w: 4, h: 8, build: () => winterDeco(snowCap(readPng(`${SRC}/fachadas/casa_a.png`), 5), [['wreath', 160, 318]]) },
      snow_facade_casa_b: { file: '', w: 4, h: 8, build: () => winterDeco(snowCap(readPng(`${SRC}/fachadas/casa_b.png`), 6), [['wreath', 56, 314]]) },
      snow_facade_casa_c: { file: '', w: 4, h: 8, build: () => winterDeco(snowCap(readPng(`${SRC}/fachadas/casa_c.png`), 7), [['wreath', 187, 318]]) },
    },
  },
  {
    // Chão da rua: a base é a mesma o ano todo; primavera e outono ganham pétalas e folhas por cima (por código).
    image: 'public/assets/env/street/tile_pixellab_rua_chao.png',
    pieces: 'data/tilesets/pixellab_rua_chao.json',
    columns: 8,
    auto: true,
    layout: {
      street_calcada_a: { file: 'rua/calcada.png', w: 1, h: 1, aliases: ['summer_street_calcada_a'] },
      spring_street_calcada_a: { file: '', w: 1, h: 1, build: () => scatter(readPng(`${SRC}/rua/calcada.png`), PETALS, 3) },
      autumn_street_calcada_a: { file: '', w: 1, h: 1, build: () => scatter(readPng(`${SRC}/rua/calcada.png`), LEAVES, 5) },
      street_calcada_b: { file: 'rua/calcada.png', w: 1, h: 1, aliases: ['summer_street_calcada_b'] },
      spring_street_calcada_b: { file: '', w: 1, h: 1, build: () => scatter(readPng(`${SRC}/rua/calcada.png`), PETALS, 8) },
      autumn_street_calcada_b: { file: '', w: 1, h: 1, build: () => scatter(readPng(`${SRC}/rua/calcada.png`), LEAVES, 9) },
      street_calcada_limpa: { file: 'rua/calcada.png', w: 1, h: 1, aliases: seasonal('calcada_limpa', 'street') },
      street_meio_fio: { file: '', w: 1, h: 1, build: () => smoothAsphalt(sliceRows(guiaAsfalto(), 0), 38), aliases: seasonal('meio_fio', 'street') },
      street_asfalto_a: { file: '', w: 1, h: 1, build: () => smoothAsphalt(sliceRows(guiaAsfalto(), TS), 0), aliases: seasonal('asfalto_a', 'street') },
      street_asfalto_b: { file: '', w: 1, h: 1, build: () => sliceRows(guiaAsfalto(), TS), aliases: seasonal('asfalto_b', 'street') },
      street_asfalto_faixa: { file: '', w: 1, h: 1, build: () => crosswalk(smoothAsphalt(sliceRows(guiaAsfalto(), TS), 0)), aliases: seasonal('asfalto_faixa', 'street') },
      snow_street_calcada_a: { file: '', w: 1, h: 1, build: () => snowGround(0.86, 21) },
      snow_street_calcada_b: { file: '', w: 1, h: 1, build: () => snowGround(0.8, 22) },
      snow_street_calcada_limpa: { file: '', w: 1, h: 1, build: () => snowGround(0.35, 23) },
      snow_street_meio_fio: { file: '', w: 1, h: 1, build: () => snowGround(0.9, 24, 26) },
      snow_street_asfalto_a: { file: '', w: 1, h: 1, build: () => snowPatches(0, 25) },
      snow_street_asfalto_b: { file: '', w: 1, h: 1, build: () => snowPatches(1, 26) },
      snow_street_asfalto_faixa: { file: '', w: 1, h: 1, build: () => snowPatches(1, 27) },
    },
  },
  {
    // Objetos da rua: trocam os antigos (mesmo espaço; poste, banco e lousa encaixados no espaço antigo).
    // Árvore e floreira mudam com a estação; o resto é igual o ano todo. Neve por cima desenhada por código.
    image: 'public/assets/env/street/tile_pixellab_rua_objetos.png',
    pieces: 'data/tilesets/pixellab_rua_objetos.json',
    columns: 12,
    auto: true,
    layout: {
      prop_poste: { file: '', w: 2, h: 4, build: () => posteArt(), aliases: seasonal('poste', 'prop') },
      snow_prop_poste: { file: '', w: 2, h: 4, build: () => snowCap(posteArt(), 31) },
      prop_banco: { file: '', w: 2, h: 2, build: () => benchArt(), aliases: seasonal('banco', 'prop') },
      snow_prop_banco: { file: '', w: 2, h: 2, build: () => snowCap(benchArt(), 32) },
      prop_lousa_cafe: { file: '', w: 1, h: 2, build: () => boardArt(), aliases: seasonal('lousa_cafe', 'prop') },
      snow_prop_lousa_cafe: { file: '', w: 1, h: 2, build: () => snowCap(boardArt(), 33) },
      prop_caixa_correio: { file: 'rua/caixa_correio_1x2.png', w: 1, h: 2, aliases: seasonal('caixa_correio', 'prop') },
      snow_prop_caixa_correio: { file: '', w: 1, h: 2, build: () => snowCap(readPng(`${SRC}/rua/caixa_correio_1x2.png`), 34) },
      prop_arvore: { file: 'rua/arvore_inverno.png', w: 2, h: 3 },
      spring_prop_arvore: { file: 'rua/arvore_primavera.png', w: 2, h: 3 },
      summer_prop_arvore: { file: 'rua/arvore_2x3.png', w: 2, h: 3 },
      autumn_prop_arvore: { file: 'rua/arvore_outono.png', w: 2, h: 3 },
      snow_prop_arvore: { file: '', w: 2, h: 3, build: () => snowCap(readPng(`${SRC}/rua/arvore_inverno.png`), 35, 2) },
      prop_lixeira: { file: 'rua/obj_5.png', w: 1, h: 1, dy: 4, aliases: seasonal('lixeira', 'prop') },
      snow_prop_lixeira: { file: '', w: 1, h: 1, dy: 4, build: () => snowCap(readPng(`${SRC}/rua/obj_5.png`), 36) },
      prop_caixote_macas: { file: 'mercado_A/obj_5.png', w: 1, h: 1, aliases: seasonal('caixote_macas', 'prop') },
      snow_prop_caixote_macas: { file: '', w: 1, h: 1, build: () => snowCap(readPng(`${SRC}/mercado_A/obj_5.png`), 37) },
      prop_caixote_laranjas: { file: 'mercado_A/obj_4.png', w: 1, h: 1, aliases: seasonal('caixote_laranjas', 'prop') },
      snow_prop_caixote_laranjas: { file: '', w: 1, h: 1, build: () => snowCap(readPng(`${SRC}/mercado_A/obj_4.png`), 38) },
      prop_vaso_planta: { file: 'rua/obj_15.png', w: 1, h: 1, dy: 6 },
      spring_prop_vaso_planta: { file: 'rua/sazonais/obj_0.png', w: 1, h: 1, dy: 6 },
      summer_prop_vaso_planta: { file: 'rua/sazonais/obj_3.png', w: 1, h: 1, dy: 4 },
      autumn_prop_vaso_planta: { file: 'rua/sazonais/obj_5.png', w: 1, h: 1, dy: 6 },
      snow_prop_vaso_planta: { file: '', w: 1, h: 1, dy: 6, build: () => snowCap(readPng(`${SRC}/rua/obj_15.png`), 39) },
      prop_mesa_terraco: { file: 'rua/mesa_terraco_2x1.png', w: 2, h: 1, aliases: seasonal('mesa_terraco', 'prop') },
      prop_abeto_natal: { file: 'rua/abeto_natal_1x2.png', w: 1, h: 2 },
      snow_monte_neve: { file: '', w: 1, h: 1, build: () => snowPile(71) },
      snow_prop_abeto_natal: { file: '', w: 1, h: 2, build: () => snowCap(readPng(`${SRC}/rua/abeto_natal_1x2.png`), 40, 2) },
      prop_caixa_gato_vazia: { file: 'rua/obj_0.png', w: 1, h: 1, dy: 6 },
      prop_caixa_gato_manta: { file: 'rua/obj_1.png', w: 1, h: 1, dy: 6 },
      prop_caixa_gato_olhos: { file: '', w: 1, h: 1, dy: 6, build: () => catEyes(readPng(`${SRC}/rua/obj_0.png`)) },
      snow_prop_caixa_gato_vazia: { file: '', w: 1, h: 1, dy: 6, build: () => snowCap(readPng(`${SRC}/rua/obj_0.png`), 41) },
      snow_prop_caixa_gato_manta: { file: '', w: 1, h: 1, dy: 6, build: () => snowCap(readPng(`${SRC}/rua/obj_1.png`), 42) },
      snow_prop_caixa_gato_olhos: { file: '', w: 1, h: 1, dy: 6, build: () => snowCap(readPng(`${SRC}/rua/obj_0.png`), 41) },
    },
  },
  {
    // Enfeites da estação na calçada (nomes novos): cada um troca de arte com a estação (trenó, hortênsia, cadeira de praia, folhas...).
    image: 'public/assets/env/street/tile_pixellab_rua_enfeites.png',
    pieces: 'data/tilesets/pixellab_rua_enfeites.json',
    columns: 8,
    auto: true,
    layout: {
      ...enfeite('a', 'sazonais/obj_11', 'sazonais/obj_2', 'sazonais/obj_4', 'sazonais/obj_6'),
      ...enfeite('b', 'obj_15', 'sazonais/obj_0', 'obj_8', 'sazonais/obj_7'),
      ...enfeite('c', 'obj_15', 'sazonais/obj_2', 'obj_15', 'sazonais/obj_8'),
      ...enfeite('d', 'obj_15', 'obj_15', 'sazonais/obj_3', 'sazonais/obj_5'),
    },
  },
  {
    // Quintal secreto: troca as peças antigas de mesmo tamanho (sebe, céu, grama, pedras, mesa, forno...).
    // Grama e pedras do quintal abandonado: secas por código (dryYard).
    image: 'public/assets/env/backyard/tile_pixellab_quintal.png',
    pieces: 'data/tilesets/pixellab_quintal.json',
    columns: 12,
    auto: true,
    layout: {
      yard_fundo_ceu_telhados: { file: '', w: 6, h: 2, build: () => compose(6 * TS, 2 * TS, [['quintal/fundo_skyline.png', 0, 0], ['quintal/fundo_skyline.png', 3 * TS, 0]]) },
      yard_sebe_topo: { file: '', w: 1, h: 1, build: () => seamlessCols(readPng(`${SRC}/quintal/sebe_fundo_3x1.png`)) },
      yard_sebe_meio_a: { file: '', w: 1, h: 1, build: () => seamlessCols(readPng(`${SRC}/quintal/sebe_fundo_3x1.png`)) },
      yard_sebe_meio_b: { file: '', w: 1, h: 1, build: () => seamlessCols(readPng(`${SRC}/quintal/sebe_fundo_3x1.png`)) },
      yard_sebe_base: { file: '', w: 1, h: 1, build: () => seamlessCols(readPng(`${SRC}/quintal/sebe_fundo_3x1.png`)) },
      yard_sebe_lateral: { file: '', w: 1, h: 1, build: () => seamlessRows(readPng(`${SRC}/quintal/sebe_lateral_1x3.png`), 20, 118) },
      yard_grama_a: { file: 'quintal/grama.png', w: 1, h: 1 },
      yard_grama_b: { file: 'quintal/grama.png', w: 1, h: 1 },
      yard_grama_c: { file: '', w: 1, h: 1, build: () => dryYard(readPng(`${SRC}/quintal/grama.png`), 3) },
      yard_pedra_a: { file: '', w: 1, h: 1, variants: 2, build: (v) => readPng(`${SRC}/quintal/${v ? 'pedras_b' : 'pedras_a'}.png`) },
      yard_pedra_b: { file: '', w: 1, h: 1, variants: 2, build: (v) => dryYard(readPng(`${SRC}/quintal/${v ? 'pedras_b' : 'pedras_a'}.png`), 5 + v) },
      yard_luzinhas_fio: { file: 'quintal/luzinhas_3x1.png', w: 3, h: 1 },
      yard_luminaria_parede_sebe: { file: 'quintal/obj_0.png', w: 1, h: 1 },
      yard_lampada_chao: { file: 'quintal/obj_2.png', w: 1, h: 1, dy: 4 },
      yard_vaso_arvore_a: { file: '', w: 1, h: 3, build: () => compose(TS, 3 * TS, [['quintal/vaso_arvore_a_1x2.png', 0, TS]]) },
      yard_vaso_arvore_b: { file: '', w: 1, h: 3, build: () => compose(TS, 3 * TS, [['quintal/vaso_arvore_b_1x2.png', 0, TS]]) },
      yard_vaso_baixo_flores: { file: 'quintal/obj_4.png', w: 1, h: 1, dy: 4 },
      yard_banquinho_ceramica: { file: 'quintal/obj_8.png', w: 1, h: 1, dy: 6 },
      yard_mesa_redonda_branca: { file: 'quintal/mesa_2x2.png', w: 2, h: 2 },
      yard_cadeira_vime: { file: 'quintal/cadeira_lado_dir.png', w: 1, h: 2, dy: 20 },
      yard_bancada_forno_pedra: { file: 'quintal/forno_2x2.png', w: 2, h: 2 },
    },
  },
  {
    // Quintal secreto: peças novas (sebe do fundo 3x1, pérgola com o forno, árvore, topiaria, bancos e cadeiras de lado...).
    image: 'public/assets/env/backyard/tile_pixellab_quintal_novos.png',
    pieces: 'data/tilesets/pixellab_quintal_novos.json',
    columns: 12,
    auto: true,
    layout: {
      pergola_forno: { file: '', w: 4, h: 3, build: () => pergolaForno() },
      arvore: { file: 'quintal/arvore_nova/arvore_3x4_v2.png', w: 3, h: 4, dy: 8 },
      topiaria: { file: 'quintal/topiaria_2x2.png', w: 2, h: 2, dy: 8 },
      dracena: { file: 'quintal/dracena_2x2.png', w: 2, h: 2, dy: 10 },
      cadeira_vime_esq: { file: 'quintal/cadeira_lado_esq.png', w: 1, h: 2, dy: 20 },
      espreguicadeira_lado: { file: 'quintal/espreguicadeira_lado.png', w: 1, h: 2, dy: 10 },
      espreguicadeira_lado_esp: { file: 'quintal/espreguicadeira_lado_esp.png', w: 1, h: 2, dy: 10 },
      banco_lado: { file: 'quintal/banco_lado_esq.png', w: 1, h: 2, dy: 6 },
      vaso_baixo_b: { file: 'quintal/obj_6.png', w: 1, h: 1, dy: 4 },
      vaso_baixo_c: { file: 'quintal/obj_5.png', w: 1, h: 1, dy: 4 },
    },
  },
  {
    // Cômodos do café (troca os provisórios desenhados por código): módulos do playground, cama, portas, mato e folhas.
    image: 'public/assets/interiors/cafe/tile_pixellab_comodos.png',
    pieces: 'data/tilesets/pixellab_comodos.json',
    columns: 8,
    auto: true,
    layout: {
      room_tunel: { file: 'comodos/tunel_2x1.png', w: 2, h: 1 },
      room_tora: { file: 'comodos/tora_2x1.png', w: 2, h: 1 },
      room_cama_quartinho: { file: 'comodos/cama_quartinho_2x1.png', w: 2, h: 1 },
      room_casinha: { file: 'louca_peixes/lote_B/obj_8.png', w: 1, h: 1, dy: 4 },
      room_cama_ao_sol: { file: 'louca_peixes/lote_B/obj_9.png', w: 1, h: 1, dy: 8 },
      room_mato: { file: 'louca_peixes/lote_B/obj_10.png', w: 1, h: 1, dy: 4 },
      room_folhas_secas: { file: 'fachadas/abandonado/obj_14.png', w: 1, h: 1 },
      room_parede_divisoria: { file: '', w: 1, h: 1, build: () => dividerWall() },
    },
  },
  {
    // Portas dos cômodos em 1x2 (portas sempre 1x2): nomes novos, a 1x1 antiga fica sem uso.
    image: 'public/assets/interiors/cafe/tile_pixellab_comodos_portas.png',
    pieces: 'data/tilesets/pixellab_comodos_portas.json',
    columns: 2,
    auto: true,
    layout: {
      room_porta_quarto: { file: '', w: 1, h: 2, dy: 6, build: () => tallDoor(11) },
      room_porta_quarto_cadeado: { file: '', w: 1, h: 2, dy: 6, build: () => tallDoor(12) },
    },
  },
  {
    // Inverno da veterinária (ela não tinha camada de neve): neve no telhado, guirlanda na porta e luzinhas no letreiro.
    image: 'public/assets/env/street/tile_pixellab_fachadas_inverno.png',
    pieces: 'data/tilesets/pixellab_fachadas_inverno.json',
    columns: 6,
    auto: true,
    layout: {
      snow_facade_veterinaria: { file: '', w: 6, h: 8, build: () => winterDeco(snowCap(readPng(`${SRC}/fachadas/veterinaria.png`), 8), [['wreath', 243, 314], ['lights', 70, 300], ['lights', 200, 300]]) },
    },
  },
  {
    // Provisórios (ph_*, desenhados por código em scripts/art/placeholders.ts): a arte nova troca a imagem pelo nome.
    image: 'public/assets/objects/pixellab/tile_pixellab_provisorios.png',
    pieces: 'data/tilesets/pixellab_provisorios.json',
    columns: 8,
    auto: true,
    layout: {
      ph_litter_box: { file: 'provisorios/obj_0.png', w: 1, h: 1, dy: 8 },
      ph_poop: { file: '', w: 1, h: 1, build: () => poopOnly() },
      ph_footprints: { file: 'provisorios/obj_2.png', w: 1, h: 1 },
      ph_fair_sign: { file: '', w: 1, h: 1, dy: 6, build: () => tinyText(readPng(`${SRC}/provisorios/obj_4.png`), ['FECH', 'ADO'], 29, 22) },
      ph_fair_bunting: { file: 'rua/sazonais/obj_1.png', w: 1, h: 1 },
      ph_fair_balloons: { file: 'provisorios/obj_5.png', w: 1, h: 1, dy: 6 },
      ph_fair_table: { file: '', w: 1, h: 1, dy: 4, build: () => heartSign(readPng(`${SRC}/provisorios/obj_6.png`), 28, 20) },
      // Armário da cozinha (despensa), 1x2: gerado no PixelLab com a estante do café como âncora (base encostada embaixo).
      ph_pantry_cabinet: { file: 'provisorios/pantry_cabinet.png', w: 1, h: 2 },
      // Porão (no lugar do quartinho): parede de pedra e piso de lajotas (tiles sem emenda) e a escadinha vista de cima,
      // 2x1, descendo para a direita (do salão para o porão). Gerados no PixelLab com a estante do café como âncora.
      ph_basement_wall: { file: 'provisorios/basement_wall.png', w: 1, h: 1 },
      ph_basement_floor: { file: 'provisorios/basement_floor.png', w: 1, h: 1 },
      ph_basement_stairs: { file: 'provisorios/basement_stairs.png', w: 2, h: 1 },
      // Ponto de montar a feira no quintal: caixotes empilhados com um pano xadrez.
      ph_fair_setup: { file: 'provisorios/fair_setup_crates.png', w: 1, h: 1, dy: 1 },
      // Janela do café com a cortina aberta (par da fechada, `window`): a cortina abre pela ação na janela.
      ph_window_open: { file: '02_cafe_2/janela_aberta_128.png', w: 2, h: 2 },
      // A mesma, com galhos tapando a vista: antes da limpeza pesada do quintal (curtainOvergrown no mapa).
      ph_window_branches: { file: '02_cafe_2/janela_aberta_galhos_128.png', w: 2, h: 2 },
    },
  },
  {
    // Montar a feira (fase 4f), gerados no PixelLab: cercadinho 2x2, cartaz 'adote' (edição da placa da feira) e mesa
    // de petiscos. Nomes novos fair_* (data/fair_setup.json).
    image: 'public/assets/objects/pixellab/tile_pixellab_feira.png',
    pieces: 'data/tilesets/pixellab_feira.json',
    columns: 4,
    auto: true,
    layout: {
      pen: { file: 'provisorios/fair_pen.png', w: 2, h: 2 },
      poster: { file: 'provisorios/fair_poster.png', w: 1, h: 1 },
      treats: { file: 'provisorios/fair_treats.png', w: 1, h: 1 },
    },
  },
  {
    // Upgrades dos gatos (gerados no PixelLab, automaticos/): pote de ração e caixa de areia automáticos e a caixa pet. Nomes pet_*.
    image: 'public/assets/objects/pixellab/tile_pixellab_pet.png',
    pieces: 'data/tilesets/pixellab_pet.json',
    columns: 2,
    auto: true,
    layout: {
      auto_feeder: { file: 'automaticos/comedouro_automatico.png', w: 1, h: 1 },
      auto_litter: { file: 'automaticos/caixa_areia_automatica.png', w: 1, h: 1 },
      // Coisas de gato aprovadas nos pedidos 04 a 06 e o ícone da caixa de areia (icones/loja), à venda na aba Pet.
      novelo_rosa: { file: '05_06_cafe/obj_5.png', w: 1, h: 1 },
      novelo_verde: { file: '05_06_cafe/obj_6.png', w: 1, h: 1 },
      novelo_creme: { file: '05_06_cafe/obj_7.png', w: 1, h: 1 },
      novelo_lilas: { file: '05_06_cafe/obj_15.png', w: 1, h: 1 },
      cesta_novelos: { file: '05_06_cafe/obj_14.png', w: 1, h: 1 },
      almofada_capitone: { file: '04_cafe_4/obj_6.png', w: 1, h: 1 },
      caixa_areia_verde: { file: 'icones/loja/obj_1.png', w: 1, h: 1 },
      // Caixa pet (baú dos itens dos gatos, 8 espaços): gerada em 2026-11-10, Pro Flash 64x64 com o pote como âncora.
      box: { file: 'automaticos/caixa_pet.png', w: 1, h: 1 },
    },
  },
  {
    // Eletrodomésticos de piso (gerados no PixelLab, cafe_equip/): a lava-louças. Nomes eletro_*.
    image: 'public/assets/objects/pixellab/tile_pixellab_eletro.png',
    pieces: 'data/tilesets/pixellab_eletro.json',
    columns: 4,
    auto: true,
    layout: {
      lava_loucas: { file: 'cafe_equip/lava_loucas.png', w: 1, h: 1 },
    },
  },
  {
    // Decorações do quarto (porão reformado), geradas no PixelLab (quarto/): nomes novos quarto_*.
    image: 'public/assets/objects/pixellab/tile_pixellab_quarto.png',
    pieces: 'data/tilesets/pixellab_quarto.json',
    columns: 8,
    auto: true,
    layout: {
      criado_madeira: { file: 'quarto/criado_madeira_1x1.png', w: 1, h: 1, dy: 6 },
      criado_creme: { file: 'quarto/criado_creme_1x1.png', w: 1, h: 1, dy: 6 },
      bau: { file: 'quarto/bau_1x1.png', w: 1, h: 1, dy: 8 },
      pufe_rosa: { file: 'quarto/pufe_rosa_1x1.png', w: 1, h: 1, dy: 5 },
      pufe_salvia: { file: 'quarto/pufe_salvia_1x1.png', w: 1, h: 1, dy: 5 },
      cesto_roupa: { file: 'quarto/cesto_roupa_1x1.png', w: 1, h: 1, dy: 6 },
      mesinha_lateral: { file: 'quarto/mesinha_lateral_1x1.png', w: 1, h: 1, dy: 6 },
      poltrona: { file: 'quarto/poltrona_1x1.png', w: 1, h: 1, dy: 2 },
      espelho: { file: 'quarto/espelho_1x1.png', w: 1, h: 1 },
      quadro_montanha: { file: 'quarto/quadro_montanha_1x1.png', w: 1, h: 1 },
      quadro_flores: { file: 'quarto/quadro_flores_1x1.png', w: 1, h: 1 },
      quadro_lua: { file: 'quarto/quadro_lua_1x1.png', w: 1, h: 1 },
      luzinhas: { file: 'quarto/luzinhas_parede_1x1.png', w: 1, h: 1 },
      relogio: { file: 'quarto/relogio_parede_1x1.png', w: 1, h: 1 },
      prateleira: { file: 'quarto/prateleira_parede_1x1.png', w: 1, h: 1 },
      porta_retrato: { file: 'quarto/porta_retrato_pata_1x1.png', w: 1, h: 1 },
      guarda_roupa: { file: 'quarto/guarda_roupa_largo_2x2.png', w: 2, h: 2, dy: 8 },
      comoda: { file: 'quarto/comoda_2x1.png', w: 2, h: 1, dy: 2 },
      escrivaninha: { file: 'quarto/escrivaninha_2x1.png', w: 2, h: 1, dy: 1 },
      luminaria: { file: 'quarto/luminaria_chao_1x2.png', w: 1, h: 2, dy: 2 },
      cabideiro: { file: 'quarto/cabideiro_1x2.png', w: 1, h: 2 },
      tapete_redondo: { file: 'quarto/tapete_redondo_2x2.png', w: 2, h: 2 },
    },
  },
  {
    // Decoração extra à venda no catálogo (sobras do lote dos provisórios): nomes novos decor_*.
    image: 'public/assets/objects/pixellab/tile_pixellab_decor.png',
    pieces: 'data/tilesets/pixellab_decor.json',
    columns: 6,
    auto: true,
    layout: {
      floreira: { file: 'provisorios/obj_10.png', w: 1, h: 1, dy: 6 },
      vaso_folhagem: { file: 'provisorios/obj_11.png', w: 1, h: 1, dy: 4 },
      regador: { file: 'provisorios/obj_12.png', w: 1, h: 1, dy: 8 },
      cesta_piquenique: { file: 'provisorios/obj_13.png', w: 1, h: 1, dy: 6 },
      lampiao: { file: 'provisorios/obj_14.png', w: 1, h: 1, dy: 4 },
      livros: { file: 'provisorios/obj_15.png', w: 1, h: 1, dy: 8 },
      obra_fita: { file: '', w: 1, h: 1, build: () => tapeBarrier() },
      // Cone da obra (PixelLab, Pro Flash 64x64 com o pote do lote 01 como âncora).
      obra_cone: { file: 'obra/cone_1x1.png', w: 1, h: 1, dy: 3 },
      // Decoração aprovada nos pedidos 02 a 06 e no mercado, à venda no Market (aba Decor; os expositores e o pote vão no balcão).
      planta_alta_b: { file: '02_cafe_2/planta_alta_b.png', w: 1, h: 2 },
      planta_alta_c: { file: '02_cafe_2/planta_alta_c.png', w: 1, h: 2 },
      cacto_bola: { file: '03_cafe_3/obj_0.png', w: 1, h: 1 },
      cacto_bracos: { file: '03_cafe_3/obj_1.png', w: 1, h: 1 },
      pendente_jiboia: { file: '05_06_cafe/obj_0.png', w: 1, h: 1 },
      pendente_perolas: { file: '05_06_cafe/obj_2.png', w: 1, h: 1 },
      pendente_hera: { file: '05_06_cafe/obj_8.png', w: 1, h: 1 },
      pendente_clorofito: { file: '05_06_cafe/obj_9.png', w: 1, h: 1 },
      pendente_coracao: { file: '05_06_cafe/obj_10.png', w: 1, h: 1 },
      vaso_suculenta: { file: '05_06_cafe/obj_3.png', w: 1, h: 1 },
      vaso_lirio: { file: '05_06_cafe/obj_11.png', w: 1, h: 1 },
      vaso_tulipas: { file: '04_cafe_4/obj_10.png', w: 1, h: 1 },
      vaso_lavanda: { file: '04_cafe_4/obj_11.png', w: 1, h: 1 },
      quadro_patinhas: { file: '05_06_cafe/obj_4.png', w: 1, h: 1 },
      quadro_coracao: { file: '05_06_cafe/obj_12.png', w: 1, h: 1 },
      quadro_gato: { file: '04_cafe_4/obj_15.png', w: 1, h: 1 },
      capacho_gato: { file: '04_cafe_4/obj_8.png', w: 1, h: 1 },
      tapete_b: { file: '01_cafe_1/tapete_b_192x128.png', w: 3, h: 2 },
      lousa_b: { file: '03_cafe_3/lousa_b.png', w: 2, h: 1 },
      lousa_c: { file: '03_cafe_3/lousa_c.png', w: 2, h: 1 },
      vitrine_vazia: { file: '03_cafe_3/vitrine_vazia_128x64.png', w: 2, h: 1 },
      geladeira_bebidas: { file: 'mercado_A/geladeira_bebidas.png', w: 1, h: 2 },
      expositor_a: { file: '03_cafe_3/obj_5.png', w: 1, h: 1 },
      expositor_b: { file: '03_cafe_3/obj_6.png', w: 1, h: 1 },
      expositor_c: { file: '03_cafe_3/obj_7.png', w: 1, h: 1 },
      pote_biscoitos: { file: '04_cafe_4/obj_1.png', w: 1, h: 1 },
      // Natal (pedido 09): enfeites de parede, de balcão e a poinsétia; à venda só no inverno.
      natal_guirlanda: { file: '09_natal/guirlanda.png', w: 1, h: 1 },
      natal_luzinhas: { file: '09_natal/luzinhas.png', w: 1, h: 1 },
      natal_meia: { file: '09_natal/meia_natal.png', w: 1, h: 1 },
      natal_poinsetia: { file: '09_natal/poinsetia.png', w: 1, h: 1 },
      natal_caneca: { file: '09_natal/caneca_natal.png', w: 1, h: 1 },
      natal_globo_gato: { file: '09_natal/globo_neve_gato.png', w: 1, h: 1 },
      natal_vela: { file: '09_natal/vela_natal.png', w: 1, h: 1 },
      natal_globo_cafe: { file: '09_natal/globo_neve_cafe.png', w: 1, h: 1 },
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
function seasonal(name: string, kind = 'facade'): string[] {
  return ['spring', 'summer', 'autumn'].map((s) => `${s}_${kind}_${name}`);
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
  L: ['#....', '#....', '#....', '#....', '#....', '#....', '#####'],
  Y: ['#...#', '#...#', '.#.#.', '..#..', '..#..', '..#..', '..#..'],
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

/** Guirlanda redonda (64 px) em meia escala, pela cor mais frequente de cada 2x2, com contorno escuro de 1 px. */
function smallWreath(): PNG {
  const src = readPng(`${SRC}/rua/sazonais/obj_9.png`);
  const out = blank(32, 32);
  for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) {
    const count = new Map<string, number>();
    let best = 't', n = 0;
    for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1]] as const) {
      const i = ((y * 2 + dy) * src.width + x * 2 + dx) * 4;
      const key = src.data[i + 3]! < 128 ? 't' : [0, 1, 2].map((c) => src.data[i + c]).join(',');
      const k = (count.get(key) ?? 0) + 1;
      count.set(key, k);
      if (k > n || (k === n && key !== 't')) { n = k; best = key; }
    }
    if (best !== 't') plot(out, x, y, best.split(',').map(Number) as [number, number, number]);
  }
  const solid = (x: number, y: number) => x >= 0 && y >= 0 && x < 32 && y < 32 && out.data[(y * 32 + x) * 4 + 3]! > 0;
  const edge: [number, number][] = [];
  for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) if (!solid(x, y) && (solid(x - 1, y) || solid(x + 1, y) || solid(x, y - 1) || solid(x, y + 1))) edge.push([x, y]);
  for (const [x, y] of edge) plot(out, x, y, [44, 56, 36]);
  return out;
}

type WinterDeco = ['wreath' | 'garland' | 'lights', number, number];

/**
 * Enfeites de Natal por cima da camada de neve da fachada (só aparecem no inverno): guirlanda na porta
 * (x = centro da porta, y = topo da porta), festão de pinho e luzinhas (x = centro, y = topo).
 */
function winterDeco(png: PNG, decos: WinterDeco[]): PNG {
  const art = { wreath: smallWreath(), garland: readPng(`${SRC}/rua/sazonais/obj_10.png`), lights: readPng(`${SRC}/rua/sazonais/obj_12.png`) };
  for (const [kind, cx, top] of decos) {
    const src = art[kind];
    const ox = cx - (src.width >> 1), oy = kind === 'wreath' ? top + 6 : top - 8;
    for (let y = 0; y < src.height; y++) for (let x = 0; x < src.width; x++) {
      const i = (y * src.width + x) * 4;
      if (src.data[i + 3]! < 128) continue;
      plot(png, ox + x, oy + y, [src.data[i]!, src.data[i + 1]!, src.data[i + 2]!]);
    }
  }
  return png;
}

/**
 * Neve do inverno por cima de uma fachada: uma camada sobre o contorno de cima (telhado, chaminé, platibanda),
 * com a borda de baixo ondulada (semente fixa) e uma sombra azulada. A imagem tem o tamanho da fachada.
 */
function snowCap(src: PNG, seed: number, maxDepth = 7): PNG {
  const out = blank(src.width, src.height);
  const rnd = () => (seed = (seed * 16807 + 11) % 2147483647) / 2147483647;
  const white: [number, number, number] = [250, 252, 255], shade: [number, number, number] = [196, 214, 234], line: [number, number, number] = [150, 170, 196];
  let depth = 4;
  for (let x = 0; x < src.width; x++) {
    let top = -1;
    for (let y = 0; y < src.height; y++) if (src.data[(y * src.width + x) * 4 + 3]! > 0) { top = y; break; }
    if (top < 0) continue;
    depth = Math.max(Math.min(3, maxDepth), Math.min(maxDepth, depth + (rnd() < 0.3 ? (rnd() < 0.5 ? -1 : 1) : 0)));
    const y0 = Math.max(0, top - 2);
    for (let y = y0; y < top + depth; y++) plot(out, x, y, y >= top + depth - 2 ? shade : white);
    plot(out, x, top + depth, line);
  }
  return out;
}

// ---------- Provisórios ----------

/**
 * Cocô do dia 2: só os montinhos (a geração veio com um pedaço de chão por baixo, que sai), na base do tile.
 * Cresce a partir do meio dos montinhos pelos pixels escuros (4 vizinhos) e tira os fiapos que sobram.
 */
function poopOnly(): PNG {
  const src = readPng(`${SRC}/provisorios/obj_1.png`);
  const W = src.width, H = src.height;
  const lum = (i: number) => (src.data[i * 4]! + src.data[i * 4 + 1]! + src.data[i * 4 + 2]!) / 3;
  const dark = (i: number) => src.data[i * 4 + 3]! > 0 && lum(i) < 128;
  const keep = new Set<number>();
  const stack: number[] = [];
  for (let y = 26; y < 38; y++) for (let x = 20; x < 46; x++) { const i = y * W + x; if (dark(i) && lum(i) > 80) { keep.add(i); stack.push(i); } }
  while (stack.length) {
    const i = stack.pop()!, x = i % W, y = (i / W) | 0;
    for (const [nx, ny] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]] as const) {
      const n = ny * W + nx;
      if (nx >= 0 && ny >= 0 && nx < W && ny < H && !keep.has(n) && dark(n)) { keep.add(n); stack.push(n); }
    }
  }
  // Fiapos (pedaços com menos de 15 pixels) saem.
  const seen = new Set<number>();
  for (const i of [...keep]) {
    if (seen.has(i)) continue;
    const part: number[] = [];
    for (const st = [i]; st.length; ) {
      const j = st.pop()!;
      if (seen.has(j) || !keep.has(j)) continue;
      seen.add(j); part.push(j);
      const x = j % W, y = (j / W) | 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) st.push((y + dy) * W + x + dx);
    }
    if (part.length < 15) for (const j of part) keep.delete(j);
  }
  const bottom = Math.max(...[...keep].map((i) => (i / W) | 0));
  const out = blank(W, H);
  const shift = H - 6 - bottom;
  for (const i of keep) src.data.copy(out.data, (i + shift * W) * 4, i * 4, i * 4 + 4);
  return out;
}

/** Letras 3x5 para placas pequenas (cavalete da feira). */
const TINY: Record<string, string[]> = {
  A: ['.#.', '#.#', '###', '#.#', '#.#'],
  C: ['.##', '#..', '#..', '#..', '.##'],
  D: ['##.', '#.#', '#.#', '#.#', '##.'],
  E: ['###', '#..', '##.', '#..', '###'],
  F: ['###', '#..', '##.', '#..', '#..'],
  H: ['#.#', '#.#', '###', '#.#', '#.#'],
  O: ['.#.', '#.#', '#.#', '#.#', '.#.'],
};

/** Escreve linhas curtas em letra 3x5 (marrom-escuro), cada linha centrada em cx, a partir de y0. */
function tinyText(png: PNG, lines: string[], cx: number, y0: number): PNG {
  lines.forEach((line, row) => {
    const w = line.length * 4 - 1;
    let x = cx - (w >> 1);
    for (const ch of line) {
      TINY[ch]!.forEach((r, ry) => [...r].forEach((c, rx) => { if (c === '#') plot(png, x + rx, y0 + row * 7 + ry, [92, 52, 40]); }));
      x += 4;
    }
  });
  return png;
}

/** Plaquinha "adote" da mesa da feira: um coração vermelho (o texto não cabe), centrado em (cx, cy). */
function heartSign(png: PNG, cx: number, cy: number): PNG {
  const heart = ['.#.#.', '#####', '#####', '.###.', '..#..'];
  heart.forEach((r, ry) => [...r].forEach((c, rx) => { if (c === '#') plot(png, cx - 2 + rx, cy - 2 + ry, rx === 1 && ry === 1 ? [240, 150, 150] : [206, 72, 80]); }));
  return png;
}

// ---------- Obras ----------

/** Fita de isolamento da obra (1 tile): duas estacas laranja com a fita listrada amarela e preta entre elas. */
function tapeBarrier(): PNG {
  const png = blank(TS, TS);
  const post = (x0: number) => {
    for (let y = 26; y < 62; y++) for (let x = x0; x < x0 + 5; x++) plot(png, x, y, x === x0 || x === x0 + 4 ? [120, 64, 36] : y % 10 < 5 ? [236, 132, 64] : [250, 240, 226]);
    for (let x = x0 - 2; x < x0 + 7; x++) plot(png, x, 61, [92, 60, 44]);
  };
  post(2); post(57);
  for (const y0 of [30, 44]) {
    for (let x = 4; x < 60; x++) for (let y = y0; y < y0 + 6; y++) {
      const edge = y === y0 || y === y0 + 5;
      plot(png, x, y, edge ? [92, 60, 44] : Math.floor((x + y) / 4) % 2 ? [250, 210, 64] : [52, 44, 40]);
    }
  }
  return png;
}

// ---------- Cômodos ----------

/** Porta 64x64 do lote B em 1x2: repete as linhas lisas do painel de cima (17 a 23) até a porta ter 128 px. */
function tallDoor(i: number): PNG {
  const src = readPng(`${SRC}/louca_peixes/lote_B/obj_${i}.png`);
  return pickRows(src, [...range(0, 24), ...Array.from({ length: 9 }, () => range(17, 23)).flat(), ...range(24, 63)]);
}

/** Parede divisória vista de cima (topo da parede entre os cômodos): reboco creme com borda de madeira dos dois lados. */
function dividerWall(): PNG {
  const png = blank(TS, TS);
  let seed = 61;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let y = 0; y < TS; y++) for (let x = 0; x < TS; x++) {
    const edge = x < 3 || x > TS - 4;
    const trim = x < 7 || x > TS - 8;
    const rgb: [number, number, number] = edge ? [92, 60, 44] : trim ? (x < 7 ? [178, 124, 82] : [150, 102, 68]) : rnd() < 0.05 ? [226, 212, 188] : [240, 228, 206];
    plot(png, x, y, rgb);
  }
  return png;
}

// ---------- Quintal secreto ----------

/** Um tile (64 linhas) da imagem que repete na vertical sem emenda: o trecho entre yMin e yMax cuja linha de cima mais parece a de baixo. */
function seamlessRows(src: PNG, yMin: number, yMax: number): PNG {
  const rowDiff = (a: number, b: number) => {
    let d = 0;
    for (let x = 0; x < src.width; x++) for (let c = 0; c < 4; c++) d += Math.abs(src.data[(a * src.width + x) * 4 + c]! - src.data[(b * src.width + x) * 4 + c]!);
    return d;
  };
  let best = yMin, bestD = Infinity;
  for (let y0 = yMin; y0 + TS <= yMax; y0++) {
    const d = rowDiff(y0, y0 + TS);
    if (d < bestD) { bestD = d; best = y0; }
  }
  return pickRows(src, range(best, best + TS - 1));
}

/** Um tile (64 colunas) da imagem que repete na horizontal sem emenda: o trecho cuja coluna da esquerda mais parece a seguinte à direita. */
function seamlessCols(src: PNG): PNG {
  const colDiff = (a: number, b: number) => {
    let d = 0;
    for (let y = 0; y < src.height; y++) for (let c = 0; c < 4; c++) d += Math.abs(src.data[(y * src.width + a) * 4 + c]! - src.data[(y * src.width + b) * 4 + c]!);
    return d;
  };
  let best = 0, bestD = Infinity;
  for (let x0 = 0; x0 + TS < src.width; x0++) {
    const d = colDiff(x0, x0 + TS);
    if (d < bestD) { bestD = d; best = x0; }
  }
  return columns(src, range(best, best + TS - 1));
}

/** Quintal abandonado: grama e pedras secas (verde puxado para palha) com pintinhas mais escuras. */
function dryYard(png: PNG, seed: number): PNG {
  recolor(png, { from: [60, 170], hue: 54, sat: 0.62, light: 0.02 });
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < png.data.length; i += 4) {
    if (rnd() >= 0.04) continue;
    for (let c = 0; c < 3; c++) png.data[i + c] = Math.round(png.data[i + c]! * 0.8);
  }
  return png;
}

/** Pérgola (4x3) com o forno de pedra embaixo, numa peça só (os dois dividem as mesmas células). */
function pergolaForno(): PNG {
  return compose(4 * TS, 3 * TS, [['quintal/forno_2x2.png', TS, 0], ['quintal/pergola_4x3.png', 8, 0]]);
}

// ---------- Chão e objetos da rua ----------

/** Poste (1x3) no espaço do antigo (2x4): no meio das duas colunas, com a base embaixo. */
function posteArt(): PNG {
  return compose(2 * TS, 4 * TS, [['rua/poste_1x3.png', TS / 2, TS]]);
}

/** Banco (2x1) no espaço do antigo (2x2): na linha de baixo. */
function benchArt(): PNG {
  return compose(2 * TS, 2 * TS, [['rua/banco_2x1.png', 0, TS]]);
}

/** Lousa do café (1x1) no espaço da antiga (1x2): na linha de baixo. */
function boardArt(): PNG {
  return compose(TS, 2 * TS, [['piloto01/obj_15.png', 0, TS]]);
}

/** Enfeite da calçada que troca com a estação: base (inverno), primavera, verão, outono e a neve do inverno. */
function enfeite(id: string, winter: string, spring: string, summer: string, autumn: string): Record<string, Piece> {
  const name = `prop_enfeite_${id}`;
  const piece = (file: string): Piece => ({ file: `rua/${file}.png`, w: 1, h: 1, dy: 4 });
  return {
    [name]: piece(winter),
    [`spring_${name}`]: piece(spring),
    [`summer_${name}`]: piece(summer),
    [`autumn_${name}`]: piece(autumn),
    [`snow_${name}`]: { file: '', w: 1, h: 1, dy: 4, build: () => snowCap(readPng(`${SRC}/rua/${winter}.png`), id.charCodeAt(0)) },
  };
}

const PETALS: [number, number, number][] = [[246, 196, 210], [255, 226, 232], [236, 170, 190]];
const LEAVES: [number, number, number][] = [[214, 120, 52], [232, 162, 64], [184, 82, 48], [204, 140, 60]];

/** Pétalas ou folhas caídas por cima do chão (pedacinhos de 2 a 3 pixels, semente fixa). */
function scatter(png: PNG, colors: [number, number, number][], seed: number): PNG {
  const rnd = () => (seed = (seed * 16807 + 7) % 2147483647) / 2147483647;
  for (let n = 0; n < (colors === LEAVES ? 22 : 12); n++) {
    const x = Math.floor(rnd() * 60) + 1, y = Math.floor(rnd() * 60) + 1;
    const c = colors[Math.floor(rnd() * colors.length)]!;
    const shade: [number, number, number] = [c[0] * 0.72, c[1] * 0.72, c[2] * 0.72];
    plot(png, x, y, c); plot(png, x + 1, y, c); plot(png, x + 2, y, c); plot(png, x, y + 1, shade); plot(png, x + 1, y + 1, c);
    if (rnd() < 0.5) plot(png, x + 1, y + 1, c);
  }
  return png;
}

/** Guia e asfalto gerados (64x128), com os cinzas puxados para um tom mais quente, da paleta da rua. */
function guiaAsfalto(): PNG {
  const png = readPng(`${SRC}/rua/guia_asfalto/gerado_64x128.png`);
  for (let i = 0; i < png.data.length; i += 4) {
    png.data[i] = Math.min(255, png.data[i]! + 8);
    png.data[i + 1] = Math.min(255, png.data[i + 1]! + 3);
    png.data[i + 2] = Math.max(0, png.data[i + 2]! - 6);
  }
  return png;
}

/**
 * Asfalto liso: tira as rachaduras e pedrinhas (pixels bem mais escuros ou claros que o asfalto)
 * das linhas a partir de y0, trocando por grão do próprio asfalto (semente fixa). Assim o tile repetido não forma grade.
 */
function smoothAsphalt(png: PNG, y0: number): PNG {
  const lum = (i: number) => (png.data[i]! + png.data[i + 1]! + png.data[i + 2]!) / 3;
  const grain: number[] = [];
  for (let y = y0; y < png.height; y++) for (let x = 0; x < png.width; x++) {
    const i = (y * png.width + x) * 4, l = lum(i);
    if (l >= 125 && l <= 141) grain.push(i);
  }
  let seed = 101;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let y = y0; y < png.height; y++) for (let x = 0; x < png.width; x++) {
    const i = (y * png.width + x) * 4, l = lum(i);
    if (l < 122 || l > 146) { const g = grain[Math.floor(rnd() * grain.length)]!; png.data.copy(png.data, i, g, g + 4); }
  }
  return png;
}

/** Faixa de pedestres: barras brancas um pouco gastas sobre o asfalto. */
function crosswalk(png: PNG): PNG {
  let seed = 17;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (const x0 of [6, 27, 48]) {
    for (let y = 2; y < 62; y++) for (let x = x0; x < x0 + 11; x++) if (rnd() > 0.07) plot(png, x, y, [232, 230, 222]);
  }
  return png;
}

/**
 * Neve sobre o chão (camada por cima, inverno): manchas de neve cobrindo cerca de `cover` do tile,
 * com borda azulada; `rows` limita às linhas de cima (meio-fio).
 */
function snowGround(cover: number, seed: number, rows = TS): PNG {
  const out = blank(TS, TS);
  const rnd = () => (seed = (seed * 16807 + 3) % 2147483647) / 2147483647;
  const cell = 8, grid = TS / cell + 1;
  const g = Array.from({ length: grid * grid }, () => rnd());
  const at = (x: number, y: number) => {
    const gx = x / cell, gy = y / cell, x0 = Math.floor(gx), y0 = Math.floor(gy), fx = gx - x0, fy = gy - y0;
    const v = (i: number, j: number) => g[Math.min(grid - 1, y0 + j) * grid + Math.min(grid - 1, x0 + i)]!;
    return (v(0, 0) * (1 - fx) + v(1, 0) * fx) * (1 - fy) + (v(0, 1) * (1 - fx) + v(1, 1) * fx) * fy;
  };
  const on = (x: number, y: number) => y < rows && at(x, y) < cover;
  for (let y = 0; y < TS; y++) for (let x = 0; x < TS; x++) {
    if (!on(x, y)) continue;
    const edge = !on(x, y + 1) || !on(x - 1, y) || !on(x + 1, y);
    plot(out, x, y, edge ? [204, 220, 238] : rnd() < 0.05 ? [232, 240, 250] : [248, 251, 255]);
  }
  return out;
}

/** Poucas manchas redondas de neve (asfalto no inverno), com borda azulada. */
function snowPatches(count: number, seed: number): PNG {
  const out = blank(TS, TS);
  const rnd = () => (seed = (seed * 16807 + 5) % 2147483647) / 2147483647;
  for (let n = 0; n < count; n++) {
    const cx = 8 + rnd() * 48, cy = 8 + rnd() * 48, rx = 3 + rnd() * 4, ry = 1.5 + rnd() * 1.5;
    for (let y = Math.floor(cy - ry); y <= cy + ry; y++) for (let x = Math.floor(cx - rx); x <= cx + rx; x++) {
      const d = ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2;
      if (d <= 1) plot(out, x, y, d > 0.6 ? [204, 220, 238] : [246, 250, 255]);
    }
  }
  return out;
}

/** Monte de neve na guia (inverno): um morrinho branco com sombra azulada e borda de baixo reta. */
function snowPile(seed: number): PNG {
  const out = blank(TS, TS);
  const rnd = () => (seed = (seed * 16807 + 9) % 2147483647) / 2147483647;
  const cx = TS / 2, base = TS - 3, rx = 28, ry = 24;
  for (let y = base - ry - 2; y <= base; y++) for (let x = 2; x < TS - 2; x++) {
    const d = ((x - cx) / rx) ** 2 + ((y - base) / ry) ** 2;
    if (d > 1 + rnd() * 0.08) continue;
    const edge = d > 0.86 || y === base;
    plot(out, x, y, edge ? [150, 170, 196] : y > base - 4 || x > cx + 8 ? [204, 220, 238] : [248, 251, 255]);
  }
  return out;
}

/** Caixa de papelão com dois olhinhos brilhando lá dentro (um gato escondido). */
function catEyes(png: PNG): PNG {
  for (const ex of [27, 35]) {
    plot(png, ex, 24, [226, 214, 96]); plot(png, ex + 1, 24, [226, 214, 96]);
    plot(png, ex, 25, [226, 214, 96]); plot(png, ex + 1, 25, [40, 30, 20]);
  }
  return png;
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
  let png: PNG = p.build ? p.build(variant) : PNG.sync.read(readFileSync(`${SRC}/${p.file}`));
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

// ---------- Ícones (64 px) ----------
/** Peças do lote de louça/peixes que não são ícones (viram tiles dos cômodos ou esconderijos do mini game). */
const ICON_SKIP = new Set(['casinha_gato', 'cama_ao_sol', 'mato', 'porta_fechada', 'porta_cadeado', 'esconderijo_cesto', 'esconderijo_caixote', 'esconderijo_vaso']);
// Os 4 lotes de icones/ (obj_N.png na ordem de escolhas.json) numa folha de 8 colunas, na mesma ordem.
// data/icons.json aponta os ícones para esta folha (sheet "pixellab", tileSize 64).
{
  const lots = JSON.parse(readFileSync(`${SRC}/icones/escolhas.json`, 'utf8')) as Record<string, unknown>;
  const louca = JSON.parse(readFileSync(`${SRC}/louca_peixes/escolhas.json`, 'utf8')) as Record<'lote_A' | 'lote_B', string[]>;
  const names = [
    ...(['loja', 'ingredientes', 'bebidas', 'comidas'] as const).flatMap((lot) => (lots[lot] as string[]).map((name, i) => ({ name, file: `${SRC}/icones/${lot}/obj_${i}.png` }))),
    ...(['lote_A', 'lote_B'] as const).flatMap((lot) => louca[lot].map((name, i) => ({ name, file: `${SRC}/louca_peixes/${lot}/obj_${i}.png` }))).filter(({ name }) => !ICON_SKIP.has(name)),
    ...([['mantinha', 7], ['caixa_bilhete', 8], ['pegadas_lama', 3]] as const).map(([name, i]) => ({ name, file: `${SRC}/provisorios/obj_${i}.png` })),
    // Chaves e vassoura na arte nova (icones_chave_vassoura/escolhas.json).
    ...(['chave_padaria', 'chave_enferrujada', 'vassoura'] as const).map((name) => ({ name, file: `${SRC}/icones_chave_vassoura/${name}.png` })),
    // Varinha e escova (itens dos cuidados) e o balão "se recompondo" (energia), gerados depois.
    ...(['varinha', 'escova', 'recompondo'] as const).map((name) => ({ name, file: `${SRC}/icones_extra/${name}.png` })),
    // Biscoito de patinha (receita bônus dos selos): o disco verde com pata do pedido 04 (aprovado como almofada, sem uso).
    { name: 'biscoito_patinha', file: `${SRC}/04_cafe_4/obj_5.png` },
    // Confeitaria (receitas da vitrine): fatias, bolos inteiros, croissants, cupcakes, macarons e biscoitos de peixe dos
    // pedidos 03 e 04, e as amêndoas e a fatia de matcha do pedido 07 (escolhas.json).
    ...([
      ['fatia_morango', '03_cafe_3/obj_2'], ['fatia_chocolate', '03_cafe_3/obj_3'], ['fatia_limao', '03_cafe_3/obj_4'],
      ['bolo_morango', '03_cafe_3/obj_8'], ['bolo_chocolate_gatinho', '03_cafe_3/obj_9'], ['bolo_matcha', '03_cafe_3/obj_10'],
      ['croissant', '03_cafe_3/obj_11'], ['croissant_amendoa', '03_cafe_3/obj_12'], ['pain_au_chocolat', '03_cafe_3/obj_13'],
      ['cupcake_gatinho', '03_cafe_3/obj_14'], ['cupcake_baunilha', '03_cafe_3/obj_15'],
      ['macarons_pilha', '04_cafe_4/obj_12'], ['macarons_piramide', '04_cafe_4/obj_13'], ['macarons_gatinho', '04_cafe_4/obj_14'],
      ['biscoito_peixe_laranja', '04_cafe_4/obj_2'], ['biscoito_peixe_glace', '04_cafe_4/obj_3'], ['biscoito_peixe_rosa', '04_cafe_4/obj_4'],
      ['amendoa', '07_confeitaria/amendoa'], ['fatia_matcha', '07_confeitaria/fatia_matcha'],
    ] as const).map(([name, file]) => ({ name, file: `${SRC}/${file}.png` })),
    // Cardápio das estações (pedido 08): os especiais, a abóbora, o panetone (Natal) e a rabanada (Ano Novo).
    ...(['chocolate_quente', 'cha_camomila_mel', 'torta_morango', 'fatia_torta_morango', 'cha_gelado_frutas_vermelhas', 'sorvete_morango', 'cha_gelado_limao', 'pao_de_mel', 'latte_abobora', 'abobora', 'panetone', 'fatia_panetone', 'rabanada'] as const).map((name) => ({ name, file: `${SRC}/08_estacoes/${name}.png` })),
    // Natal (pedido 09): os presentes que não são enfeite (o cachecol do Tião e os biscoitos do Joca).
    ...(['cachecol', 'biscoito_osso'] as const).map((name) => ({ name, file: `${SRC}/09_natal/${name}.png` })),
  ];
  const cols = 8;
  const out = new PNG({ width: cols * TS, height: Math.ceil(names.length / cols) * TS });
  names.forEach(({ file }, i) => paste(out, readPng(file), i % cols, Math.floor(i / cols)));
  const image = 'public/assets/icons/sheets/icon_sheet_pixellab.png';
  writeFileSync(image, PNG.sync.write(out));
  console.log(`${image}: ${names.length} ícones`);
}

// ---------- Vassoura na mão (64x128, para a pose de ação da personagem; data/tools.json: broom.hold) ----------
{
  const dir = 'public/assets/objects/tools';
  mkdirSync(dir, { recursive: true });
  writeFileSync(`${dir}/broom_hold.png`, PNG.sync.write(readPng(`${SRC}/icones_chave_vassoura/vassoura_mao.png`)));
  console.log(`${dir}/broom_hold.png: vassoura na mão`);
}

// ---------- Esconderijos da Caça ao filhote (64 px, quadro 0 parado) ----------
// src/game/minigames/assets.ts (KITTEN_HUNT) carrega estes arquivos; sem eles o jogo desenha retângulos.
{
  const dir = 'public/assets/minigames/hunt';
  mkdirSync(dir, { recursive: true });
  for (const [file, i] of [['hide_basket', 13], ['hide_crate', 14], ['hide_pot', 15]] as const) {
    writeFileSync(`${dir}/${file}.png`, PNG.sync.write(readPng(`${SRC}/louca_peixes/lote_B/obj_${i}.png`)));
  }
  console.log(`${dir}: 3 esconderijos`);
}

// ---------- Peixes da Pescaria (folha 3 x 2 de 64 px, na ordem de "icon" em data/minigames.json) ----------
{
  const order = [2, 3, 4, 5, 6, 7]; // lote_B: prateado, sardinha, atum, salmão, dourado, bota velha
  const out = new PNG({ width: 3 * TS, height: 2 * TS });
  order.forEach((i, k) => paste(out, readPng(`${SRC}/louca_peixes/lote_B/obj_${i}.png`), k % 3, Math.floor(k / 3)));
  writeFileSync('public/assets/minigames/fishing/icons_fish_pixellab.png', PNG.sync.write(out));
  console.log('public/assets/minigames/fishing/icons_fish_pixellab.png: 6 peixes');
}

// ---------- Entrega relâmpago: bicicleta (128 x 128, 2x2, de lado, para a direita) e porta da casa (64 x 128) ----------
{
  const dir = 'public/assets/minigames/delivery';
  mkdirSync(dir, { recursive: true });
  writeFileSync(`${dir}/obstacle_bike.png`, PNG.sync.write(readPng(`${SRC}/provisorios/ciclista_opcoes/estilo_npc.png`)));
  writeFileSync(`${dir}/goal_door.png`, PNG.sync.write(readPng(`${SRC}/lote01/door64x128.png`)));
  console.log(`${dir}: bicicleta e porta`);
}

// ---------- Furgão de entregas (3x3: 192 x 192, de lado; desenhado em meia escala: data/delivery.json van.scale) ----------
// Branco e azul royal; letreiro "DELIVERY" por código. A versão para a esquerda é a imagem espelhada com o texto escrito depois.
{
  const van = () => pickRows(readPng(`${SRC}/furgao/delivery_192.png`), [...Array.from({ length: 32 }, () => 0), ...range(0, 159)]);
  const mirror = (png: PNG) => columns(png, range(0, png.width - 1).reverse());
  const ink: [number, number, number] = [36, 72, 168], shade: [number, number, number] = [206, 214, 230];
  const dir = 'public/assets/objects/vehicles';
  mkdirSync(dir, { recursive: true });
  writeFileSync(`${dir}/obj_van_pixellab_right.png`, PNG.sync.write(signText(van(), 'DELIVERY', [14, 84, 116, 132], ink, shade)));
  writeFileSync(`${dir}/obj_van_pixellab_left.png`, PNG.sync.write(signText(mirror(van()), 'DELIVERY', [75, 84, 177, 132], ink, shade)));
  console.log(`${dir}: furgão para a direita e para a esquerda`);
}

// ---------- Remédio escondido: tigela com comida (192 x 128), comprimido (48 x 24) e tubo de pasta (48 x 48) ----------
// Desenhados em meia escala na cena (src/game/minigames/assets.ts: PILL); fontes em assets/_pixellab/minigames/pill.
{
  const dir = 'public/assets/minigames/pill';
  mkdirSync(dir, { recursive: true });
  for (const f of ['bowl', 'capsule', 'tube']) writeFileSync(`${dir}/${f}.png`, PNG.sync.write(readPng(`${SRC}/minigames/pill/${f}.png`)));
  console.log(`${dir}: tigela, comprimido e tubo`);
}

// ---------- Banho e escovação: toalha (192 x 64, desenhada em 3x), nó de pelo (32 x 32) e escova (48 x 24) ----------
// src/game/minigames/assets.ts: GROOMING; fontes em assets/_pixellab/minigames/grooming.
{
  const dir = 'public/assets/minigames/grooming';
  mkdirSync(dir, { recursive: true });
  for (const f of ['towel', 'mat', 'brush']) writeFileSync(`${dir}/${f}.png`, PNG.sync.write(readPng(`${SRC}/minigames/grooming/${f}.png`)));
  console.log(`${dir}: toalha, nó de pelo e escova`);
}

// ---------- Varinha: o pompom com penas da ponta (32 x 32) ----------
{
  const dir = 'public/assets/minigames/wand';
  mkdirSync(dir, { recursive: true });
  writeFileSync(`${dir}/toy.png`, PNG.sync.write(readPng(`${SRC}/minigames/wand/toy.png`)));
  console.log(`${dir}/toy.png: pompom da varinha`);
}

// ---------- Pescaria: água (4 quadros de 64, o mesmo tile deslocado: balança devagar), cais (192 x 128) e boia ----------
// Boia: 4 quadros de 32 (0 boiando, 1 um pixel abaixo, 2 afundando: a metade de baixo some, 3 no ar = 0).
{
  const dir = 'public/assets/minigames/fishing';
  const shift = (src: PNG, dx: number, dy: number): PNG => {
    const out = new PNG({ width: src.width, height: src.height });
    for (let y = 0; y < src.height; y++) {
      for (let x = 0; x < src.width; x++) {
        const sx = (((x - dx) % src.width) + src.width) % src.width;
        const sy = (((y - dy) % src.height) + src.height) % src.height;
        const i = (sy * src.width + sx) * 4;
        const o = (y * src.width + x) * 4;
        for (let k = 0; k < 4; k++) out.data[o + k] = src.data[i + k]!;
      }
    }
    return out;
  };
  const strip = (frames: PNG[]): PNG => {
    const w = frames[0]!.width;
    const out = new PNG({ width: w * frames.length, height: frames[0]!.height });
    frames.forEach((f, i) => PNG.bitblt(f, out, 0, 0, w, f.height, i * w, 0));
    return out;
  };
  const water = readPng(`${SRC}/minigames/fishing/water.png`);
  writeFileSync(`${dir}/anim_water_pixellab.png`, PNG.sync.write(strip([water, shift(water, 2, 1), shift(water, 4, 2), shift(water, 2, 1)])));
  writeFileSync(`${dir}/tile_pier_pixellab.png`, PNG.sync.write(readPng(`${SRC}/minigames/fishing/pier.png`)));
  const bob = readPng(`${SRC}/minigames/fishing/bobber.png`);
  let bottom = 0;
  for (let y = 0; y < bob.height; y++) for (let x = 0; x < bob.width; x++) if (bob.data[(y * bob.width + x) * 4 + 3]! > 40) bottom = y;
  // Sem o wrap: a boia é deslocada para baixo e corta na linha da água (a base dela).
  const down = (dy: number, clip = Infinity) => {
    const out = new PNG({ width: bob.width, height: bob.height });
    for (let y = bob.height - 1; y >= dy; y--) {
      if (y >= clip) continue;
      for (let x = 0; x < bob.width; x++) {
        const i = ((y - dy) * bob.width + x) * 4;
        const o = (y * bob.width + x) * 4;
        for (let k = 0; k < 4; k++) out.data[o + k] = bob.data[i + k]!;
      }
    }
    return out;
  };
  writeFileSync(`${dir}/anim_bobber_pixellab.png`, PNG.sync.write(strip([bob, down(1), down(5, bottom - 1), bob])));
  console.log(`${dir}: água, cais e boia`);
}

// ---------- Latte art: xícara vista de cima (192 x 192; o meio do café em data/minigames.json: cupCenter) e jarra (48 x 48) ----------
{
  const dir = 'public/assets/minigames/latte';
  mkdirSync(dir, { recursive: true });
  writeFileSync(`${dir}/obj_cup_pixellab.png`, PNG.sync.write(readPng(`${SRC}/minigames/latte/cup.png`)));
  writeFileSync(`${dir}/obj_pitcher_pixellab.png`, PNG.sync.write(readPng(`${SRC}/minigames/latte/pitcher.png`)));
  console.log(`${dir}: xícara e jarra`);
}
