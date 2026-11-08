// npx tsx scripts/import-minigames.ts: copia o pacote dos mini games (assets/_originais_pacotes/minigames, fora do Git)
// para public/assets/minigames (também fora do Git), com os nomes da convenção (docs/ASSET_REORGANIZATION.md).
// Cenário vem da pasta tile64 (64 px por tile: desenhado na metade, decisão 052); interface e latte art ficam
// nas medidas próprias do pacote (LEIA-ME dele). Não muda os originais. Rode de novo se o pacote for atualizado.
import { copyFileSync, existsSync, mkdirSync } from 'node:fs';

const SRC = 'assets/_originais_pacotes/minigames';
const OUT = 'public/assets/minigames';

/** Pacote -> nome no jogo (as chaves de textura em src/game/minigames/assets.ts usam estes nomes). */
const FILES: Record<string, string> = {
  'tile64/fuga/esconderijo_caixa.png': 'chase/anim_hide_box.png',
  'tile64/fuga/esconderijo_lixeira.png': 'chase/anim_hide_trash.png',
  'tile64/fuga/esconderijo_arbusto.png': 'chase/anim_hide_bush.png',
  'tile64/fuga/esconderijo_carro.png': 'chase/anim_hide_car.png',
  'tile64/fuga/poeira.png': 'chase/anim_dust.png',
  'fuga/seta.png': 'chase/ui_arrow.png',
  'fuga/alertas.png': 'chase/ui_alerts.png',
  'tile64/pescaria/agua.png': 'fishing/anim_water.png',
  'tile64/pescaria/boia.png': 'fishing/anim_bobber.png',
  'tile64/pescaria/cais.png': 'fishing/tile_pier.png',
  'pescaria/barra_timing.png': 'fishing/ui_timing_bar.png',
  'pescaria/peixes.png': 'fishing/icons_fish.png',
  'latte/xicara.png': 'latte/obj_cup.png',
  'latte/jarra.png': 'latte/obj_pitcher.png',
  'latte/guia_coracao.png': 'latte/ui_guide_heart.png',
  'latte/guia_pata.png': 'latte/ui_guide_paw.png',
  'latte/guia_estrela.png': 'latte/ui_guide_star.png',
  'latte/guia_folha.png': 'latte/ui_guide_leaf.png',
};

let n = 0;
for (const [from, to] of Object.entries(FILES)) {
  if (!existsSync(`${SRC}/${from}`)) throw new Error(`falta no pacote: ${from}`);
  mkdirSync(`${OUT}/${to.split('/')[0]}`, { recursive: true });
  copyFileSync(`${SRC}/${from}`, `${OUT}/${to}`);
  n++;
}
console.log(`✓ mini games: ${n} arquivos em ${OUT}`);
