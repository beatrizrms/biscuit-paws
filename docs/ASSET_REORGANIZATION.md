# Proposta de reorganização dos assets: Biscuit Paws

> Data: 2026-11-07. **Aplicado em 2026-11-07** (decisão 046), exceto o passo 2 (IDs `art.*`), que fica para outro pedido. Base: [ASSET_AUDIT.md](ASSET_AUDIT.md).
> Para aplicar: aprovar este documento (e as decisões da seção 0), salvar o script da seção 6 em `scripts/migrate-assets.ts`, rodar em simulação, revisar, rodar com `--apply`.

## 0. Decisões antes de aplicar
| # | Pergunta | Situação |
|---|---|---|
| D1 | Nomes de arquivo em inglês ou português? | **Decidido: inglês** (`obj_cup_dirty`). O mapa já está assim. |
| D2 | Louça 16x16 (xícara, prato e copo nas mesas, moeda, 2 ícones) pode continuar 16x16? | **Decidido: sim, para itens de fato pequenos**, desde que o pixel tenha o mesmo tamanho do resto (nada ampliado). Registrar em `DECISIONS.md` na migração. |
| D3 | Nome da senhorinha | **Decidido: Dona Neusa.** Os dados já usam esse nome; falta corrigir "Dona Lurdes" em `docs/ART_AND_LICENSE.md` e `docs/GAME_DESIGN.md`. |
| D4 | Porta do café: verde por dentro, rosa por fora | **Decidido: o mais simples = deixar como está** (nenhuma arte nova). Inconsistência nº 10 da auditoria rebaixada para Baixa. |

## 1. Estrutura nova (por função, não por pacote)
Duas camadas, como já é hoje, mas com papéis claros:

| Pasta | Papel | No Git? |
|---|---|---|
| `assets/_originais_pacotes/<pacote>/` | Pacotes **exatamente como chegaram** (inclui previews, demos, LEIA-ME, licenças). Nunca editar. É daqui que se volta atrás. | Não (licença sem redistribuição) |
| `assets/_migracao/` | Log da migração (para `--undo`). | Não |
| `assets/_fora_do_jogo/` | Arquivos que estavam em `public/assets/` sem uso: saem da pasta do jogo, mas são guardados (não apagados). | Não |
| `public/assets/` | **Só o que o jogo carrega**, organizado por função, nomes no padrão. Arquivos gerados por script também ficam aqui (marcados no manifesto). | Não |
| `data/assets.json` *(passo 2)* | Manifesto: ID estável do asset → caminho, tamanho do quadro, origem (pacote/arquivo), se é gerado. | **Sim** (só texto) |

```
public/assets/
├─ env/                     ambientes externos
│  ├─ street/{winter,spring,summer,autumn}/   tile_street_ground_winter.png, tile_street_facades_snow_winter.png …
│  └─ backyard/{winter,spring,summer,autumn}/ (quintal, quando entrar)
├─ interiors/               pisos/paredes/peças fixas por cômodo
│  ├─ cafe/  market/  kitchen/  bedroom/  attic/  clinic/
├─ objects/                 coisas colocáveis ou interativas
│  ├─ furniture/  equipment/  dishes/  food/  cat_care/  dirt/  tools/  vehicles/  decor_seasonal/
├─ characters/
│  ├─ player/               camadas do criador (pastas do pacote: corpo/, cabelo/, poses/…)
│  ├─ cats/                 cat_<variante>.png
│  ├─ npcs/                 npc_<id>.png, npc_<id>_portrait.png
│  └─ customers/            npc_customer_NN.png
├─ ui/{menu,hud,phone,dialogue}/
├─ icons/{items,sheets}/
├─ fx/                      poeira, brilho, neve, partículas, emotes
└─ audio/{music,ambient,sfx}/
```

## 2. Convenção de nomes
**Formato:** `<prefixo>_<assunto>[_<variante>][_<estado>][_<estação>].png`, tudo `snake_case`, minúsculas, sem acento, sem hífen, sem versão (`_v2`) e sem tamanho no nome (exceto a exceção 16 px: `_16`).

| Prefixo | Uso | Exemplo |
|---|---|---|
| `tile_` | folha em grade 32 de pisos/paredes/terreno/peças fatiadas | `tile_street_ground_winter.png` |
| `obj_` | objeto avulso (1 imagem) | `obj_cup_dirty.png`, `obj_van_left.png` |
| `anim_` | folha de animação de objeto | `anim_coffee_maker.png`, `anim_sink.png` |
| `chr_` | protagonista (camadas do pacote mantêm o nome original, ver seção 3) | `chr_player_portrait.png` |
| `npc_` | NPC (nome = ID do NPC sem `npc.`) | `npc_gabi.png`, `npc_gabi_portrait.png` |
| `cat_` | folha de gato (nome = variante) | `cat_marmalade.png` |
| `ui_` | interface | `ui_order_bubble_impatient.png` |
| `icon_` | ícone avulso ou folha de ícones (`icon_sheet_`) | `icon_key.png`, `icon_sheet_food.png` |
| `fx_` | efeito/partícula/sobreposição | `fx_dust_1.png`, `fx_sunbeam.png` |
| `bgm_` / `amb_` / `sfx_` | música / ambiente / efeito sonoro | `bgm_cafe.ogg`, `sfx_meow_1.ogg` |

**Sufixos de estado (nessa ordem):** `_clean` `_full` `_dirty` · `_on` `_off` · `_open` `_closed` `_locked` · `_idle` `_working` `_ready` · `_worn` (velho/abandonado) · `_snow` (camada de neve).
**Sufixos de estação (sempre por último):** `_spring` `_summer` `_autumn` `_winter`. Peça sem estação = não muda com a estação.

### IDs estáveis de asset
- Todo asset carregado tem um ID `art.<nome_do_arquivo_sem_extensão>` (ex.: `art.npc_gabi`, `art.tile_street_ground_winter`) registrado em `data/assets.json`.
- O ID **nunca muda nem é reaproveitado**, como os IDs de conteúdo (regra 4). Se o arquivo precisar de outro nome ou pasta, muda só o `path` no manifesto.
- **Passo 1 (este documento):** mover e renomear; o script troca os caminhos nos dados.
- **Passo 2 (depois, outro pedido):** os dados passam a citar o ID em vez do caminho (`"sheet": "art.npc_gabi"`), o `BootScene` lê o manifesto, e `npm run check` valida que todo `art.*` citado existe e que todo arquivo em `public/assets/` está no manifesto. O save não muda (o save já guarda só IDs de conteúdo).

Exemplo de entrada do manifesto:
```json
{ "id": "art.npc_gabi", "path": "assets/characters/npcs/npc_gabi.png", "frame": [32, 64], "grid": [4, 5],
  "source": "gabi_e_joca/gabi_spritesheet.png", "generated": false, "ai": true }
```

## 3. Mapa de migração
Revise e edite a coluna "Novo" à vontade: **o script lê esta tabela** (entre os marcadores). Arquivos sem uso vão para `assets/_fora_do_jogo/` (guardados, não apagados). `characters/player/` fica onde está: `src/core/appearance.ts` monta os caminhos das camadas com os nomes das pastas e arquivos do pacote, que são os `asset` de `data/character.json`; renomear exigiria mudar código e dados do criador, sem ganho.

<!-- MAPA:INICIO -->
| Atual | Novo caminho/nome | Motivo |
|---|---|---|
| `public/assets/cats/biscuit.png` | `public/assets/characters/cats/cat_biscuit.png` | nome da variante do Cosy Cats (já é ID em cat_sprites.json) |
| `public/assets/cats/custard.png` | `public/assets/characters/cats/cat_custard.png` | nome da variante do Cosy Cats (já é ID em cat_sprites.json) |
| `public/assets/cats/domino.png` | `public/assets/characters/cats/cat_domino.png` | nome da variante do Cosy Cats (já é ID em cat_sprites.json) |
| `public/assets/cats/freckle.png` | `public/assets/characters/cats/cat_freckle.png` | nome da variante do Cosy Cats (já é ID em cat_sprites.json) |
| `public/assets/cats/hazel.png` | `public/assets/characters/cats/cat_hazel.png` | nome da variante do Cosy Cats (já é ID em cat_sprites.json) |
| `public/assets/cats/marmalade.png` | `public/assets/characters/cats/cat_marmalade.png` | nome da variante do Cosy Cats (já é ID em cat_sprites.json) |
| `public/assets/cats/midnight.png` | `public/assets/characters/cats/cat_midnight.png` | nome da variante do Cosy Cats (já é ID em cat_sprites.json) |
| `public/assets/cats/misty.png` | `public/assets/characters/cats/cat_misty.png` | nome da variante do Cosy Cats (já é ID em cat_sprites.json) |
| `public/assets/cats/patches.png` | `public/assets/characters/cats/cat_patches.png` | nome da variante do Cosy Cats (já é ID em cat_sprites.json) |
| `public/assets/cats/pebble.png` | `public/assets/characters/cats/cat_pebble.png` | nome da variante do Cosy Cats (já é ID em cat_sprites.json) |
| `public/assets/cats/snowdrop.png` | `public/assets/characters/cats/cat_snowdrop.png` | nome da variante do Cosy Cats (já é ID em cat_sprites.json) |
| `public/assets/cats/toffee.png` | `public/assets/characters/cats/cat_toffee.png` | nome da variante do Cosy Cats (já é ID em cat_sprites.json) |
| `public/assets/characters/mulher_placeholder_32x64.png` | `assets/_fora_do_jogo/characters/mulher_placeholder_32x64.png` | sem uso desde o criador de personagem (f08aec4) (sai da pasta do jogo; guardado, não apagado) |
| `public/assets/dirt/sujeira_tileset.png` | `public/assets/objects/dirt/tile_dirt.png` | sujeira é camada de objetos |
| `public/assets/equipment/cafeteira_spritesheet.png` | `public/assets/objects/equipment/anim_coffee_maker.png` | gerada por import-fluxo; prefixo anim_ = folha animada |
| `public/assets/equipment/equipamentos_spritesheet.png` | `public/assets/objects/equipment/anim_kitchen_equipment.png` | convenção de nomes |
| `public/assets/equipment/pia_sheet.png` | `public/assets/objects/equipment/anim_sink.png` | convenção de nomes |
| `public/assets/fluxo/balcoes.png` | `public/assets/objects/furniture/tile_counter_wood.png` | gerada por import-fluxo; "fluxo" é nome de entrega, não função |
| `public/assets/fluxo/louca_16.png` | `public/assets/objects/dishes/tile_dishes_16.png` | louça do mundo; _16 marca a exceção de tamanho |
| `public/assets/fluxo/ui/balao_aguardando_1.png` | `public/assets/ui/hud/ui_waiting_bubble_1.png` | convenção de nomes |
| `public/assets/fluxo/ui/balao_aguardando_2.png` | `public/assets/ui/hud/ui_waiting_bubble_2.png` | convenção de nomes |
| `public/assets/fluxo/ui/balao_aguardando_3.png` | `public/assets/ui/hud/ui_waiting_bubble_3.png` | convenção de nomes |
| `public/assets/fluxo/ui/balao_pedido.png` | `public/assets/ui/hud/ui_order_bubble.png` | convenção de nomes |
| `public/assets/fluxo/ui/balao_pedido_furioso.png` | `public/assets/ui/hud/ui_order_bubble_furious.png` | convenção de nomes |
| `public/assets/fluxo/ui/balao_pedido_impaciente.png` | `public/assets/ui/hud/ui_order_bubble_impatient.png` | convenção de nomes |
| `public/assets/fluxo/ui/balcao_marcador_1.png` | `public/assets/ui/hud/ui_ready_marker_1.png` | convenção de nomes |
| `public/assets/fluxo/ui/balcao_marcador_2.png` | `public/assets/ui/hud/ui_ready_marker_2.png` | convenção de nomes |
| `public/assets/fluxo/ui/barra_progresso_0.png` | `public/assets/ui/hud/ui_progress_bar_0.png` | convenção de nomes |
| `public/assets/fluxo/ui/barra_progresso_1.png` | `public/assets/ui/hud/ui_progress_bar_1.png` | convenção de nomes |
| `public/assets/fluxo/ui/barra_progresso_2.png` | `public/assets/ui/hud/ui_progress_bar_2.png` | convenção de nomes |
| `public/assets/fluxo/ui/barra_progresso_3.png` | `public/assets/ui/hud/ui_progress_bar_3.png` | convenção de nomes |
| `public/assets/fluxo/ui/barra_progresso_4.png` | `public/assets/ui/hud/ui_progress_bar_4.png` | convenção de nomes |
| `public/assets/fluxo/ui/barra_progresso_5.png` | `public/assets/ui/hud/ui_progress_bar_5.png` | convenção de nomes |
| `public/assets/fluxo/ui/barra_progresso_6.png` | `public/assets/ui/hud/ui_progress_bar_6.png` | convenção de nomes |
| `public/assets/fluxo/ui/barra_progresso_7.png` | `public/assets/ui/hud/ui_progress_bar_7.png` | convenção de nomes |
| `public/assets/fluxo/ui/barra_progresso_8.png` | `public/assets/ui/hud/ui_progress_bar_8.png` | convenção de nomes |
| `public/assets/fluxo/ui/cardapio_4_slots.png` | `public/assets/ui/hud/ui_menu_board_4.png` | convenção de nomes |
| `public/assets/fluxo/ui/cardapio_6_slots.png` | `public/assets/ui/hud/ui_menu_board_6.png` | convenção de nomes |
| `public/assets/fluxo/ui/cardapio_8_slots.png` | `public/assets/ui/hud/ui_menu_board_8.png` | convenção de nomes |
| `public/assets/fluxo/ui/etiqueta_preco.png` | `assets/_fora_do_jogo/fluxo/ui/etiqueta_preco.png` | copiada pelo import e nunca usada (sai da pasta do jogo; guardado, não apagado) |
| `public/assets/fluxo/ui/marca_esgotado.png` | `public/assets/ui/hud/ui_sold_out_mark.png` | convenção de nomes |
| `public/assets/fluxo/ui/moeda_16.png` | `public/assets/ui/hud/ui_coin_16.png` | convenção de nomes |
| `public/assets/fluxo/ui/slot_esgotado_veu.png` | `public/assets/ui/hud/ui_sold_out_veil.png` | convenção de nomes |
| `public/assets/icons/catalogo_icones.png` | `public/assets/icons/sheets/icon_sheet_shop.png` | convenção de nomes |
| `public/assets/icons/fluxo_icones.png` | `public/assets/icons/sheets/icon_sheet_food.png` | gerada por import-fluxo |
| `public/assets/icons/itens_bebidas_tileset.png` | `public/assets/icons/sheets/icon_sheet_drinks.png` | também é a folha dos emotes (separar depois em fx/) |
| `public/assets/icons/louca_tileset.png` | `public/assets/icons/sheets/icon_sheet_dishes.png` | convenção de nomes |
| `public/assets/icons/materia_prima_tileset.png` | `public/assets/icons/sheets/icon_sheet_ingredients.png` | convenção de nomes |
| `public/assets/market/mercado_interior_tileset.png` | `public/assets/interiors/market/tile_market.png` | por cômodo |
| `public/assets/npc/clientes/cliente_01_homem_negro_barba_oculos.png` | `public/assets/characters/customers/npc_customer_01.png` | descrição física sai do nome (fica em npcs.json) |
| `public/assets/npc/clientes/cliente_02_mulher_negra_black_power.png` | `public/assets/characters/customers/npc_customer_02.png` | descrição física sai do nome (fica em npcs.json) |
| `public/assets/npc/clientes/cliente_03_homem_ruivo_bone.png` | `public/assets/characters/customers/npc_customer_03.png` | descrição física sai do nome (fica em npcs.json) |
| `public/assets/npc/clientes/cliente_04_mulher_asiatica_cabelo_longo.png` | `public/assets/characters/customers/npc_customer_04.png` | descrição física sai do nome (fica em npcs.json) |
| `public/assets/npc/clientes/cliente_05_homem_asiatico_oculos_escritorio.png` | `public/assets/characters/customers/npc_customer_05.png` | descrição física sai do nome (fica em npcs.json) |
| `public/assets/npc/clientes/cliente_06_mulher_loira_rabo_esportiva.png` | `public/assets/characters/customers/npc_customer_06.png` | descrição física sai do nome (fica em npcs.json) |
| `public/assets/npc/clientes/cliente_07_homem_idoso_grisalho_bigode.png` | `public/assets/characters/customers/npc_customer_07.png` | descrição física sai do nome (fica em npcs.json) |
| `public/assets/npc/clientes/cliente_08_mulher_latina_cacheada.png` | `public/assets/characters/customers/npc_customer_08.png` | descrição física sai do nome (fica em npcs.json) |
| `public/assets/npc/clientes/cliente_09_homem_pardo_careca_barba_xadrez.png` | `public/assets/characters/customers/npc_customer_09.png` | descrição física sai do nome (fica em npcs.json) |
| `public/assets/npc/clientes/cliente_10_mulher_hijab_vestido.png` | `public/assets/characters/customers/npc_customer_10.png` | descrição física sai do nome (fica em npcs.json) |
| `public/assets/npc/corretora_retrato_64.png` | `public/assets/characters/npcs/npc_realtor_portrait.png` | convenção de nomes |
| `public/assets/npc/corretora_spritesheet.png` | `public/assets/characters/npcs/npc_realtor.png` | nome = ID do NPC (npc.realtor) |
| `public/assets/npc/entregadora_retrato_64.png` | `public/assets/characters/npcs/npc_mail_carrier_portrait.png` | convenção de nomes |
| `public/assets/npc/entregadora_spritesheet.png` | `public/assets/characters/npcs/npc_mail_carrier.png` | convenção de nomes |
| `public/assets/npc/gabi_caixa.gif` | `assets/_fora_do_jogo/npc/gabi_caixa.gif` | sem uso; fica só no original (sai da pasta do jogo; guardado, não apagado) |
| `public/assets/npc/gabi_retrato_64.png` | `public/assets/characters/npcs/npc_gabi_portrait.png` | convenção de nomes |
| `public/assets/npc/gabi_spritesheet.png` | `public/assets/characters/npcs/npc_gabi.png` | convenção de nomes |
| `public/assets/npc/icone_chave.png` | `public/assets/icons/items/icon_key.png` | ícone não é NPC |
| `public/assets/npc/senhorinha_retrato_64.png` | `public/assets/characters/npcs/npc_neusa_portrait.png` | convenção de nomes |
| `public/assets/npc/senhorinha_spritesheet.png` | `public/assets/characters/npcs/npc_neusa.png` | nome = ID (npc.neusa); nome exibido a decidir |
| `public/assets/npc/spitz_spritesheet.png` | `public/assets/characters/npcs/npc_joca.png` | nome = ID (npc.joca) |
| `public/assets/phone/app_classificados.png` | `public/assets/ui/phone/ui_phone_app_classifieds.png` | convenção de nomes |
| `public/assets/phone/celular_ameixa_tela_transparente.png` | `public/assets/ui/phone/ui_phone_frame_plum.png` | convenção de nomes |
| `public/assets/phone/notificacao_bolinha.png` | `public/assets/ui/phone/ui_phone_notification.png` | convenção de nomes |
| `public/assets/phone/status_sinal_wifi_bateria.png` | `public/assets/ui/phone/ui_phone_status.png` | convenção de nomes |
| `public/assets/placeholders/placeholders.png` | `assets/_fora_do_jogo/placeholders/placeholders.png` | sem referência; remover da pasta do jogo (sai da pasta do jogo; guardado, não apagado) |
| `public/assets/street/winter/chao_winter.png` | `public/assets/env/street/winter/tile_street_ground_winter.png` | ambiente/rua/estação; nome em inglês |
| `public/assets/street/winter/fachadas_winter.png` | `public/assets/env/street/winter/tile_street_facades_winter.png` | convenção de nomes |
| `public/assets/street/winter/neve_chao_winter.png` | `public/assets/env/street/winter/tile_street_ground_snow_winter.png` | camada de neve = sufixo _snow |
| `public/assets/street/winter/neve_fachadas_winter.png` | `public/assets/env/street/winter/tile_street_facades_snow_winter.png` | convenção de nomes |
| `public/assets/street/winter/neve_monte_winter.png` | `public/assets/env/street/winter/tile_street_snow_piles_winter.png` | convenção de nomes |
| `public/assets/street/winter/neve_objetos_winter.png` | `public/assets/env/street/winter/tile_street_props_snow_winter.png` | convenção de nomes |
| `public/assets/street/winter/objetos_winter.png` | `public/assets/env/street/winter/tile_street_props_winter.png` | convenção de nomes |
| `public/assets/tiles/cat-cafe-tileset-ext.png` | `public/assets/interiors/cafe/tile_cafe_worn.png` | gerada por `npm run art`; nome diz o que é |
| `public/assets/tiles/cat-cafe-tileset.png` | `public/assets/interiors/cafe/tile_cafe.png` | folha base do café (fonte do script de desgaste) |
| `public/assets/tools/vassoura_encostada.png` | `assets/_fora_do_jogo/tools/vassoura_encostada.png` | sem uso (pode voltar como obj_broom_leaning se o design pedir) (sai da pasta do jogo; guardado, não apagado) |
| `public/assets/tools/vassoura_icone.png` | `public/assets/icons/items/icon_broom.png` | convenção de nomes |
| `public/assets/tools/vassoura_spritesheet.png` | `assets/_fora_do_jogo/tools/vassoura_spritesheet.png` | vassoura antiga sem uso (sai da pasta do jogo; guardado, não apagado) |
| `public/assets/tools/vassoura_v2_spritesheet.png` | `public/assets/objects/tools/anim_broom.png` | sem versão no nome |
| `public/assets/vehicles/furgao_direita.png` | `public/assets/objects/vehicles/obj_van_right.png` | convenção de nomes |
| `public/assets/vehicles/furgao_esquerda.png` | `public/assets/objects/vehicles/obj_van_left.png` | convenção de nomes |
| `public/assets/characters/player/` | (fica onde está) | camadas do criador em uso; src/core/appearance.ts monta os caminhos com os nomes das pastas do pacote (corpo/, poses/…), e data/character.json tem basePath |
| `assets/Cat-Cafe-32x32/` | `assets/_originais_pacotes/Cat-Cafe-32x32/` | original intacto, fora do Git |
| `assets/catalogo_compras/` | `assets/_originais_pacotes/catalogo_compras/` | original intacto, fora do Git |
| `assets/celular/` | `assets/_originais_pacotes/celular/` | original intacto, fora do Git |
| `assets/celular.zip` | `assets/_originais_pacotes/celular.zip` | zip duplicado; mover junto (ou apagar com aprovação) |
| `assets/clientes/` | `assets/_originais_pacotes/clientes/` | original intacto, fora do Git |
| `assets/correio/` | `assets/_originais_pacotes/correio/` | original intacto, fora do Git |
| `assets/corretora_e_vassoura/` | `assets/_originais_pacotes/corretora_e_vassoura/` | original intacto, fora do Git |
| `assets/Cosy-Cats-32x32/` | `assets/_originais_pacotes/Cosy-Cats-32x32/` | original intacto, fora do Git |
| `assets/cozinha_cafe/` | `assets/_originais_pacotes/cozinha_cafe/` | original intacto, fora do Git |
| `assets/equipamentos/` | `assets/_originais_pacotes/equipamentos/` | original intacto, fora do Git |
| `assets/fluxo_cafe_onda1/` | `assets/_originais_pacotes/fluxo_cafe_onda1/` | original intacto, fora do Git |
| `assets/gabi_e_joca/` | `assets/_originais_pacotes/gabi_e_joca/` | original intacto, fora do Git |
| `assets/itens_bebidas/` | `assets/_originais_pacotes/itens_bebidas/` | original intacto, fora do Git |
| `assets/louca/` | `assets/_originais_pacotes/louca/` | original intacto, fora do Git |
| `assets/materia_prima/` | `assets/_originais_pacotes/materia_prima/` | original intacto, fora do Git |
| `assets/mercado_interior/` | `assets/_originais_pacotes/mercado_interior/` | original intacto, fora do Git |
| `assets/mulher_placeholder_32x64.png` | `assets/_originais_pacotes/mulher_placeholder_32x64.png` | original intacto, fora do Git |
| `assets/opcoes_fachada.png` | `assets/_originais_pacotes/opcoes_fachada.png` | original intacto, fora do Git |
| `assets/personagem_principal/` | `assets/_originais_pacotes/personagem_principal/` | original intacto, fora do Git |
| `assets/pia/` | `assets/_originais_pacotes/pia/` | original intacto, fora do Git |
| `assets/quintal_secreto/` | `assets/_originais_pacotes/quintal_secreto/` | original intacto, fora do Git |
| `assets/rua_estacoes_tilesets/` | `assets/_originais_pacotes/rua_estacoes_tilesets/` | original intacto, fora do Git |
| `assets/senhorinha/` | `assets/_originais_pacotes/senhorinha/` | original intacto, fora do Git |
| `assets/sujeira_cafe_abandonado/` | `assets/_originais_pacotes/sujeira_cafe_abandonado/` | original intacto, fora do Git |
| `assets/tilesets_expansao/` | `assets/_originais_pacotes/tilesets_expansao/` | original intacto, fora do Git |
| `assets/vassoura_nova/` | `assets/_originais_pacotes/vassoura_nova/` | original intacto, fora do Git |
<!-- MAPA:FIM -->

Sobre os arquivos que **não estão** no mapa (os 1.858 de `assets/`): vão inteiros, por pasta de pacote, para `assets/_originais_pacotes/` (últimas linhas da tabela). Peças que forem entrar no jogo depois (outras estações, quintal, expansão, louça 32 cheia...) ganham linha nova neste mapa quando a fase chegar, já com o nome no padrão.

## 4. Originais e `.gitignore`
- Conferido: `.gitignore` tem `assets/` (cobre `assets/_originais_pacotes/` e `assets/_migracao/`), `public/assets/`, `*.png` e `*.zip`. `git check-ignore` confirma para `assets/_originais_pacotes/x.png` e `public/assets/x.png`. `git ls-files` não lista nenhuma imagem.
- Recomendo **acrescentar** (quando aprovar) `*.gif`, `*.ogg`, `*.mp3`, `*.wav` ao `.gitignore`: hoje um GIF ou áudio fora dessas pastas entraria no Git.
- `data/assets.json` fica versionado (é só texto, sem arte).

## 5. Atlas de textura (spritesheets empacotados)
| | Prós | Contras |
|---|---|---|
| Atlas (ex.: TexturePacker/free-tex-packer → JSON Hash do Phaser) | Menos requisições e trocas de textura (melhor em WebGL); um carregamento por grupo; corte de transparência reduz memória | Mais um passo de build; nomes de quadro passam a ser strings; folhas animadas em grade e `spritesheet()` do Phaser deixam de valer direto; diffs menos legíveis; é obra derivada (fica fora do Git, como hoje) |

| Onde | Recomendação |
|---|---|
| Ícones (`icon_sheet_*` + ícones avulsos `icon_broom`, `icon_key`) | **Sim**: um `atlas_icons` (pequeno, usado no HUD e na mochila). |
| UI do HUD (balões, barras, marcadores, moeda, cardápios) | **Sim**: `atlas_hud` (hoje são 24 imagens soltas carregadas uma a uma). |
| Camadas do personagem | **Não empacotar**: compor na hora numa RenderTexture (como o LEIA-ME sugere) e carregar só as camadas escolhidas. |
| Tilesets (rua, café, mercado, sujeira) | **Não**: já são folhas em grade; tilemap precisa de grade fixa. |
| Gatos e NPCs | **Não por enquanto**: folhas em grade + carregamento sob demanda já resolvem. Reavaliar com mais de ~30 personagens. |
| Gerar como? | Script `npm run atlas` com `pngjs` (como os outros), a partir do manifesto, saída em `public/assets/atlas/`. Só depois do passo 2. |

## 6. Script de migração (não executado)
Salvar como `scripts/migrate-assets.ts` **depois da aprovação**. Padrão = simulação. Ele:
1. lê o mapa da seção 3 deste arquivo;
2. valida (origem existe, destino livre, nomes no padrão, sem dois arquivos para o mesmo destino) e para em qualquer erro;
3. lista os arquivos de `data/`, `src/`, `scripts/`, `tests/` e `index.html` cujas referências serão reescritas (`public/assets/x` e `assets/x`);
4. lista o que precisa de ajuste manual (caminhos montados com template, ex.: `${OUT}/ui/...` em `scripts/import-fluxo.ts`);
5. com `--apply`: exige `data/src/scripts/tests` sem mudanças pendentes, move os pacotes para `_originais_pacotes/`, move os arquivos do jogo, reescreve as referências e grava `assets/_migracao/log.json`;
6. `--undo` desfaz pelo log.

Depois de aplicar: `npm run check`, `npm test`, `npm run test:e2e` e print conferido (regra do CLAUDE.md). Ajustar também os caminhos citados em `docs/ART_AND_LICENSE.md` e no README.

```ts
// npx tsx scripts/migrate-assets.ts            -> simulação (dry-run, padrão): só mostra o que faria
// npx tsx scripts/migrate-assets.ts --apply    -> move os arquivos e reescreve as referências
// npx tsx scripts/migrate-assets.ts --undo     -> desfaz usando assets/_migracao/log.json
// O mapa vem da tabela entre <!-- MAPA:INICIO --> e <!-- MAPA:FIM --> em docs/ASSET_REORGANIZATION.md.
import { execSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

type Move = { from: string; to: string; dir: boolean };
const APPLY = process.argv.includes('--apply');
const UNDO = process.argv.includes('--undo');
const LOG = 'assets/_migracao/log.json';
const SCAN_DIRS = ['data', 'src', 'scripts', 'tests'];
const SCAN_EXT = /\.(json|ts|css|html)$/;
const NAME_OK = /^[a-z0-9_]+(\.[a-z0-9]+)?$/;

function readMap(): Move[] {
  const md = readFileSync('docs/ASSET_REORGANIZATION.md', 'utf8');
  const block = md.split('<!-- MAPA:INICIO -->')[1]?.split('<!-- MAPA:FIM -->')[0];
  if (!block) throw new Error('Mapa não encontrado no documento.');
  const moves: Move[] = [];
  for (const line of block.split('\n')) {
    const cells = line.split('|').map((c) => c.trim());
    const [from, to] = [cells[1], cells[2]].map((c) => c?.match(/^`([^`]+)`/)?.[1]);
    if (!from || !to) continue; // cabeçalho ou linha sem destino ("sai da pasta do jogo")
    const dir = from.endsWith('/') || from.includes('/*.png');
    moves.push({ from: from.replace(/\/\*\.png.*$/, '/'), to: to.replace(/\/\*\.png$/, '/'), dir });
  }
  return moves;
}

function walk(d: string): string[] {
  if (!existsSync(d)) return [];
  return readdirSync(d).flatMap((n) => (statSync(join(d, n)).isDirectory() ? walk(join(d, n)) : [join(d, n).replace(/\\/g, '/')]));
}

/** Formas em que um caminho aparece no código: "public/assets/x" e "assets/x" (relativo a public/). */
function forms(p: string): string[] {
  return p.startsWith('public/') ? [p, p.slice('public/'.length)] : [p];
}

function validate(moves: Move[]): string[] {
  const errors: string[] = [];
  const targets = new Set<string>();
  for (const m of moves) {
    if (!existsSync(m.from.replace(/\/$/, ''))) errors.push(`origem não existe: ${m.from}`);
    if (!m.to.startsWith('assets/_originais_pacotes/') && existsSync(m.to.replace(/\/$/, ''))) errors.push(`destino já existe: ${m.to}`);
    if (targets.has(m.to)) errors.push(`dois arquivos para o mesmo destino: ${m.to}`);
    targets.add(m.to);
    const base = m.to.replace(/\/$/, '').split('/').pop()!;
    if (!m.dir && !NAME_OK.test(base)) errors.push(`nome fora do padrão: ${m.to}`);
  }
  return errors;
}

function rewrite(moves: Move[], write: boolean): { file: string; count: number }[] {
  // Caminhos mais longos primeiro, para uma pasta não engolir um arquivo dela.
  const pairs = moves
    .flatMap((m) => forms(m.from).map((f, i) => [f, forms(m.to)[i] ?? m.to] as const))
    .sort((a, b) => b[0].length - a[0].length);
  const report: { file: string; count: number }[] = [];
  for (const file of SCAN_DIRS.flatMap(walk).concat(['index.html']).filter((f) => SCAN_EXT.test(f) && existsSync(f))) {
    let text = readFileSync(file, 'utf8');
    let count = 0;
    for (const [a, b] of pairs) {
      // "assets/x" não pode casar dentro de "public/assets/x" (esse já foi trocado pelo par longo).
      const re = new RegExp(`(?<![\\w/-])${a.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'g');
      text = text.replace(re, () => (count++, b));
    }
    if (count) {
      report.push({ file, count });
      if (write) writeFileSync(file, text);
    }
  }
  return report;
}

/** Caminhos montados com template (`${OUT}/ui/...`) não são trocados automaticamente. */
function dynamicRefs(): string[] {
  return SCAN_DIRS.flatMap(walk)
    .filter((f) => f.endsWith('.ts') && readFileSync(f, 'utf8').includes('assets/'))
    .flatMap((f) => readFileSync(f, 'utf8').split('\n').map((l, i) => [f, i + 1, l] as const))
    .filter(([, , l]) => /\$\{[^}]+\}\/[^`]*\.(png|gif)/.test(l) || /=\s*'(public\/)?assets\/[^']*'/.test(l))
    .map(([f, n, l]) => `${f}:${n}  ${l.trim()}`);
}

function move(from: string, to: string): void {
  mkdirSync(dirname(to.replace(/\/$/, '')), { recursive: true });
  renameSync(from.replace(/\/$/, ''), to.replace(/\/$/, ''));
}

if (UNDO) {
  const log = JSON.parse(readFileSync(LOG, 'utf8')) as { moves: Move[] };
  for (const m of [...log.moves].reverse()) move(m.to, m.from);
  rewrite(log.moves.map((m) => ({ from: m.to, to: m.from, dir: m.dir })), true);
  console.log(`Desfeito: ${log.moves.length} movimentos. Rode npm run check && npm test.`);
  process.exit(0);
}

const moves = readMap();
const errors = validate(moves);
const refs = rewrite(moves, false);
console.log(`${APPLY ? 'APLICANDO' : 'SIMULAÇÃO (nada é alterado)'}: ${moves.length} movimentos`);
for (const m of moves) console.log(`  ${m.from}  ->  ${m.to}`);
console.log(`\nReferências a reescrever:`);
for (const r of refs) console.log(`  ${r.file}: ${r.count}`);
const dyn = dynamicRefs();
if (dyn.length) console.log(`\nAjustar à mão (caminho montado em template):\n  ${dyn.join('\n  ')}`);
if (errors.length) {
  console.error(`\nERROS (nada foi feito):\n  ${errors.join('\n  ')}`);
  process.exit(1);
}
if (!APPLY) process.exit(0);

const dirty = execSync('git status --porcelain -- data src scripts tests', { encoding: 'utf8' }).trim();
if (dirty) {
  console.error('Há mudanças não commitadas em data/src/scripts/tests. Faça commit antes, para poder comparar o diff da migração.');
  process.exit(1);
}
// Pacotes primeiro (os originais ficam intactos), depois os arquivos do jogo.
const ordered = [...moves].sort((a, b) => Number(b.to.startsWith('assets/_originais_pacotes/')) - Number(a.to.startsWith('assets/_originais_pacotes/')));
for (const m of ordered) move(m.from, m.to);
rewrite(moves, true);
mkdirSync(dirname(LOG), { recursive: true });
writeFileSync(LOG, JSON.stringify({ date: new Date().toISOString(), moves: ordered }, null, 2));
console.log(`\nFeito. Log para desfazer: ${LOG}. Agora: npm run check && npm test && npm run test:e2e, e conferir um print.`);
```

**Ajustes manuais já conhecidos** (o script vai listá-los): `scripts/import-fluxo.ts` (constantes `SRC`/`OUT` e caminhos com `${OUT}`; também deixa de copiar `etiqueta_preco`), nenhum outro: `build-worn-tiles.ts` lê os caminhos de `data/tiles.meta.json` e `data/tiles.worn.json` (reescritos pelo script) e `data/tiles.json` é regenerado por `npm run tiles`.

## 7. Checklist para novos assets
| ✔ | Item |
|---|---|
| ☐ | **Tamanho na grade:** objeto do mundo com canvas em múltiplos de 32 (1x1, 1x2, 2x2…), base do objeto na última linha de pixels, centralizado. Humanos 32x64. Exceções só as registradas (louça 16, UI). |
| ☐ | **Densidade 1x:** um pixel da arte = um pixel do arquivo. Se veio ampliado, reduzir por amostragem e conferir (sem blocos 2x2). |
| ☐ | **Paleta:** só cores de `cosy-palette.gpl`/`cosy-cats-palette.gpl` (rodar a checagem de paleta; tolerância: nenhum pixel a mais de 24 de distância). |
| ☐ | **Contorno e luz:** contorno marrom-escuro da paleta (não preto puro), 1 px; sombra no chão como o Cat Cafe (oval cinza sob o objeto, sem direção) ou nenhuma, igual para o conjunto; visão de frente 3/4. |
| ☐ | **Fundo transparente** (exceto pisos/paredes e retratos com moldura). Sem semitransparência fora de efeitos. |
| ☐ | **Escala:** comparar lado a lado com a personagem (32x64), uma cadeira e um gato antes de aceitar. |
| ☐ | **Estados completos:** limpo/cheio/sujo, ligado/desligado, aberto/fechado/trancado, novo/velho, conforme o objeto. Mesmo canvas e mesma posição em todos os estados. |
| ☐ | **Estações:** se o objeto fica ao ar livre, as 4 estações com a mesma silhueta e posição (neve como camada `_snow` separada). |
| ☐ | **Encaixe:** autotile (47/16) ou peças de parede/piso testadas emendadas, sem costura. |
| ☐ | **Nome** no padrão da seção 2, inglês, sem versão nem tamanho. |
| ☐ | **Onde registrar:** original intacto em `assets/_originais_pacotes/<pacote>/`; cópia/corte em `public/assets/<função>/`; entrada em `data/assets.json` (passo 2); conteúdo em `data/*.json` com ID estável; `CREDITS.md`; tabela de pacotes em `docs/ART_AND_LICENSE.md` (marcar se é IA, decisão 020). |
| ☐ | **Preview/demo** do pacote não vai para `public/assets/`. |
| ☐ | **Conferência:** `npm run check`, abrir no navegador (Playwright), print conferido. |
