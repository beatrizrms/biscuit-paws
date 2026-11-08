// npx tsx scripts/import-fluxo.ts: copia e monta as folhas do pacote "Fluxo do café, onda 1"
// (assets/_originais_pacotes/fluxo_cafe_onda1, fora do Git) para public/assets (também fora do Git),
// já com os nomes da convenção (docs/ASSET_REORGANIZATION.md).
// Não muda os arquivos originais. Rode de novo se o pacote for atualizado.
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { PNG } from 'pngjs';

const SRC = 'assets/_originais_pacotes/fluxo_cafe_onda1/fluxo_cafe';
const OUT = 'public/assets';
for (const d of ['icons/sheets', 'ui/hud']) mkdirSync(`${OUT}/${d}`, { recursive: true });

/** Junta imagens do mesmo tamanho lado a lado, numa folha com `columns` colunas. */
function sheet(files: string[], size: number, columns: number, out: string): void {
  const rows = Math.ceil(files.length / columns);
  const png = new PNG({ width: columns * size, height: rows * size });
  files.forEach((f, n) => {
    const img = PNG.sync.read(readFileSync(f));
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const i = (y * img.width + x) * 4;
        const o = ((Math.floor(n / columns) * size + y) * png.width + (n % columns) * size + x) * 4;
        for (let k = 0; k < 4; k++) png.data[o + k] = img.data[i + k]!;
      }
    }
  });
  writeFileSync(out, PNG.sync.write(png));
}

// Cafeteira, balcões e louça 16x16 agora são desenhados por scripts/art/kitchen.ts (estilo novo, decisão 051).

// Ícones de comida e o remédio (32x32), numa folha só.
export const FOOD_ICONS = ['pao', 'pao_de_queijo', 'bolo_fatia', 'biscoito', 'remedio', 'cafe_preto', 'cafe_com_leite', 'cha', 'suco'];
const TRAYS = ['bandeja_vazia', 'bandeja_1_itens', 'bandeja_2_itens', 'bandeja_3_itens'];
sheet([...FOOD_ICONS.map((n) => `${SRC}/icones/${n}.png`), ...TRAYS.map((n) => `${SRC}/bandeja/${n}.png`)], 32, FOOD_ICONS.length + TRAYS.length, `${OUT}/icons/sheets/icon_sheet_food.png`);

// Marcador que pulsa no balcão.
for (const i of [1, 2]) copyFileSync(`${SRC}/estacoes/balcao_marcador_${i}.png`, `${OUT}/ui/hud/ui_ready_marker_${i}.png`);

// Interface (nome no pacote -> nome no jogo).
const ui: Record<string, string> = {
  balao_pedido: 'ui_order_bubble',
  balao_pedido_impaciente: 'ui_order_bubble_impatient',
  balao_pedido_furioso: 'ui_order_bubble_furious',
  balao_aguardando_1: 'ui_waiting_bubble_1',
  balao_aguardando_2: 'ui_waiting_bubble_2',
  balao_aguardando_3: 'ui_waiting_bubble_3',
  cardapio_4_slots: 'ui_menu_board_4',
  cardapio_6_slots: 'ui_menu_board_6',
  cardapio_8_slots: 'ui_menu_board_8',
  marca_esgotado: 'ui_sold_out_mark',
  slot_esgotado_veu: 'ui_sold_out_veil',
  moeda_16: 'ui_coin_16',
  ...Object.fromEntries(Array.from({ length: 9 }, (_, i) => [`barra_progresso_${i}`, `ui_progress_bar_${i}`])),
};
for (const [from, to] of Object.entries(ui)) copyFileSync(`${SRC}/ui/${from}.png`, `${OUT}/ui/hud/${to}.png`);
console.log(`fluxo do café: ${FOOD_ICONS.length} ícones e ${Object.keys(ui).length} peças de interface`);
