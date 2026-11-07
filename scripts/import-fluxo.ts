// npx tsx scripts/import-fluxo.ts: copia e monta as folhas do pacote "Fluxo do café, onda 1"
// (assets/fluxo_cafe_onda1, fora do Git) para public/assets (também fora do Git).
// Não muda os arquivos originais. Rode de novo se o pacote for atualizado.
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { PNG } from 'pngjs';

const SRC = 'assets/fluxo_cafe_onda1/fluxo_cafe';
const OUT = 'public/assets/fluxo';
mkdirSync(`${OUT}/ui`, { recursive: true });

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

// Cafeteira: parada, preparando 1..4, pronta (mesma ordem da folha usada pelo jogo).
sheet(
  ['ociosa', 'preparando_1', 'preparando_2', 'preparando_3', 'preparando_4', 'pronta'].map((n) => `${SRC}/estacoes/cafeteira_${n}.png`),
  32,
  6,
  'public/assets/equipment/cafeteira_spritesheet.png',
);

// Ícones de comida e o remédio (32x32), numa folha só.
export const FOOD_ICONS = ['pao', 'pao_de_queijo', 'bolo_fatia', 'biscoito', 'remedio', 'cafe_preto', 'cafe_com_leite', 'cha', 'suco'];
const TRAYS = ['bandeja_vazia', 'bandeja_1_itens', 'bandeja_2_itens', 'bandeja_3_itens'];
sheet([...FOOD_ICONS.map((n) => `${SRC}/icones/${n}.png`), ...TRAYS.map((n) => `${SRC}/bandeja/${n}.png`)], 32, FOOD_ICONS.length + TRAYS.length, 'public/assets/icons/fluxo_icones.png');

// Balcões (esquerda, meio, direita) e o marcador que pulsa.
sheet(['esq', 'meio', 'dir'].map((n) => `${SRC}/estacoes/balcao_${n}.png`), 32, 3, `${OUT}/balcoes.png`);
for (const n of ['balcao_marcador_1', 'balcao_marcador_2']) copyFileSync(`${SRC}/estacoes/${n}.png`, `${OUT}/ui/${n}.png`);

// Louça 16x16 (limpa, cheia, suja x xícara, prato, copo) e a interface.
copyFileSync(`${SRC}/louca/louca_tileset_16.png`, `${OUT}/louca_16.png`);
const ui = [
  'balao_pedido', 'balao_pedido_impaciente', 'balao_pedido_furioso', 'balao_aguardando_1', 'balao_aguardando_2', 'balao_aguardando_3',
  'cardapio_4_slots', 'cardapio_6_slots', 'cardapio_8_slots', 'marca_esgotado', 'slot_esgotado_veu', 'moeda_16', 'etiqueta_preco',
  ...Array.from({ length: 9 }, (_, i) => `barra_progresso_${i}`),
];
for (const n of ui) copyFileSync(`${SRC}/ui/${n}.png`, `${OUT}/ui/${n}.png`);
console.log(`fluxo do café: cafeteira, ${FOOD_ICONS.length} ícones, louça 16 e ${ui.length} peças de interface`);
