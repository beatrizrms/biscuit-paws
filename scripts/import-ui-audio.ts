// npx tsx scripts/import-ui-audio.ts (npm run ui-audio): copia, dos pacotes em assets/_originais_pacotes
// (fora do Git) para public/assets (também fora do Git), com nomes em inglês (docs/ASSET_REORGANIZATION.md):
// - ui_menus: botões e painéis (molduras de 9 partes), faixas de título e o ícone do carrinho;
// - inauguracao: a cena da inauguração (fita fechada e cortada);
// - audio: músicas, jingles, sons ambientes e efeitos (.ogg e .mp3).
import { copyFileSync, existsSync, mkdirSync, readdirSync } from 'node:fs';

const SRC = 'assets/_originais_pacotes';
const OUT = 'public/assets';
const copy = (from: string, to: string) => {
  mkdirSync(to.slice(0, to.lastIndexOf('/')), { recursive: true });
  copyFileSync(from, to);
};

// Cores e estados do pacote -> inglês.
const COLORS: Record<string, string> = { rosa: 'pink', creme: 'cream', menta: 'mint', ameixa: 'plum', madeira: 'wood', lavanda: 'lavender', ouro: 'gold' };
const STATES: Record<string, string> = { normal: 'normal', hover: 'hover', pressed: 'pressed', desabilitado: 'disabled' };

for (const f of readdirSync(`${SRC}/ui_menus/botoes`)) {
  const m = /^botao_(\w+?)_(\w+)\.png$/.exec(f);
  if (m && COLORS[m[1]!] && STATES[m[2]!]) copy(`${SRC}/ui_menus/botoes/${f}`, `${OUT}/ui/menu/ui_button_${COLORS[m[1]!]}_${STATES[m[2]!]}.png`);
}
for (const f of readdirSync(`${SRC}/ui_menus/paineis`)) {
  const panel = /^painel_(\w+)\.png$/.exec(f);
  const ribbon = /^faixa_titulo_(\w+)\.png$/.exec(f);
  if (panel && COLORS[panel[1]!]) copy(`${SRC}/ui_menus/paineis/${f}`, `${OUT}/ui/menu/ui_panel_${COLORS[panel[1]!]}.png`);
  if (ribbon && COLORS[ribbon[1]!]) copy(`${SRC}/ui_menus/paineis/${f}`, `${OUT}/ui/menu/ui_ribbon_${COLORS[ribbon[1]!]}.png`);
}
const CART: Record<string, string> = { 'carrinho_32.png': 'icon_cart_empty.png', 'carrinho_cheio_32.png': 'icon_cart_full.png', 'carrinho_com_selo_32.png': 'icon_cart_badge.png', 'carrinho_16.png': 'icon_cart_16.png' };
for (const [from, to] of Object.entries(CART)) copy(`${SRC}/ui_menus/hud/${from}`, `${OUT}/ui/hud/${to}`);

copy(`${SRC}/inauguracao/inauguracao_640x360.png`, `${OUT}/ui/scenes/scene_inauguration_ribbon_pink.png`);
copy(`${SRC}/inauguracao/inauguracao_cortada_640x360.png`, `${OUT}/ui/scenes/scene_inauguration_cut_pink.png`);

// Áudio: o nome do pacote (em português) vira a chave em inglês de data/audio.json.
const AUDIO: Record<string, [string, string]> = {
  musica_menu: ['music', 'music_menu'],
  musica_cafe_dia: ['music', 'music_cafe_day'],
  musica_noite: ['music', 'music_night'],
  jingle_inauguracao: ['music', 'jingle_inauguration'],
  jingle_sucesso: ['music', 'jingle_success'],
  jingle_dia_novo: ['music', 'jingle_new_day'],
  jingle_fim_do_dia: ['music', 'jingle_day_end'],
  amb_rua_dia: ['ambient', 'amb_street_day'],
  amb_cafe_movimento: ['ambient', 'amb_cafe_busy'],
  amb_noite_grilos: ['ambient', 'amb_night_crickets'],
  amb_chuva: ['ambient', 'amb_rain'],
  amb_relogio_sala: ['ambient', 'amb_clock_room'],
  sino_porta: ['sfx', 'sfx_door_bell'],
  pedido_novo: ['sfx', 'sfx_new_order'],
  pegar_item: ['sfx', 'sfx_pick_up'],
  soltar_item: ['sfx', 'sfx_put_down'],
  moeda: ['sfx', 'sfx_coin'],
  sucesso: ['sfx', 'sfx_success'],
  erro: ['sfx', 'sfx_error'],
  clique_ui: ['sfx', 'sfx_ui_click'],
  abrir_menu: ['sfx', 'sfx_menu_open'],
  fechar_menu: ['sfx', 'sfx_menu_close'],
  cafeteira_preparando_loop: ['sfx', 'sfx_coffee_brewing_loop'],
  cafeteira_pronta: ['sfx', 'sfx_coffee_ready'],
  pia_agua_loop: ['sfx', 'sfx_sink_water_loop'],
  vassoura: ['sfx', 'sfx_broom'],
  fogao_chiado_loop: ['sfx', 'sfx_stove_sizzle_loop'],
  forno_ding: ['sfx', 'sfx_oven_ding'],
  louca_tilintar: ['sfx', 'sfx_dishes_clink'],
  passo_leve: ['sfx', 'sfx_step'],
  miau_1: ['sfx', 'sfx_meow_1'],
  miau_2: ['sfx', 'sfx_meow_2'],
  miau_filhote: ['sfx', 'sfx_meow_kitten'],
  ronronar_loop: ['sfx', 'sfx_purr_loop'],
};
const FOLDER: Record<string, string> = { music: 'musica', ambient: 'ambiente', sfx: 'sfx' };
let n = 0;
const missing: string[] = [];
for (const [pack, [kind, key]] of Object.entries(AUDIO)) {
  for (const ext of ['ogg', 'mp3']) {
    const from = `${SRC}/audio/${FOLDER[kind]}/${pack}.${ext}`;
    if (!existsSync(from)) {
      missing.push(`${pack}.${ext}`);
      continue;
    }
    copy(from, `${OUT}/audio/${kind}/${key}.${ext}`);
    n++;
  }
}
console.log(`✓ interface (menus, carrinho, inauguração) e ${n} arquivos de áudio${missing.length ? ` (faltam: ${missing.join(', ')})` : ''}`);
