# Auditoria de assets: Biscuit Paws

> Data: 2026-11-07. Fase **somente de análise**: nenhum asset foi movido, renomeado, apagado ou alterado.
> Proposta de reorganização em [ASSET_REORGANIZATION.md](ASSET_REORGANIZATION.md). Nada dela é aplicado sem aprovação.
> **Atualização (mesmo dia):** depois da análise entrou o commit `f08aec4` (criador de personagem). As tabelas foram regeradas: as 622 camadas de `characters/player/` estão em uso e o placeholder da jogadora deixou de ser usado.

## Como foi feito
| Etapa | Método |
|---|---|
| Inventário | Script Node + `pngjs` (fora do projeto) leu **todos os 2.570 arquivos** de `assets/` (1.858) e `public/assets/` (712): caminho, formato, dimensões, KB, MD5 do arquivo e dos pixels, transparência dos cantos, cores. |
| Paleta | Cada pixel opaco comparado com a cor mais próxima de `cosy-palette.gpl` + `cosy-cats-palette.gpl` (163 cores). "Fora da paleta" = mais de 25% dos pixels a uma distância RGB > 24 da cor mais próxima (diferença visível, não só arredondamento). |
| Densidade de pixel | Detecta imagens ampliadas (blocos 2x2/3x3/4x4 uniformes em > 97% da área). |
| Duplicatas | MD5 dos pixels (mesmo conteúdo, mesmo com arquivo diferente) + nomes quase iguais + comparação visual. |
| Uso no código | Busca de caminhos em `data/*.json`, `data/maps`, `data/tilesets`, `src/**`, `scripts/**`; leitura de `BootScene.ts`, `WorldScene.ts`, `GameUi.ts`, `CutsceneView.ts`, `import-fluxo.ts`, `build-worn-tiles.ts`; nomes de tiles usados nos mapas e em `items.json`/`finishes.json`. Cada arquivo de pacote foi ligado à cópia em `public/assets/` pelo MD5 dos pixels. |
| Coerência visual | Pranchas comparativas ampliadas 3–4x (vizinho mais próximo) com objetos que aparecem juntos; abertas e conferidas uma a uma. Também abertas: `sample-cafe.png`, `interior_frente_demo.png`, `quintal_secreto_dia.png`, as 4 estações da rua. |

**Legenda de status:** *em uso* (carregado e exibido) · *fonte de importação* (um script lê e gera o arquivo em uso) · *carregado, nunca exibido* · *referenciado nos dados, não carregado* · *sem referência* · *preview/demo* (não é asset de jogo) · *duplicata/peça solta* (o mesmo desenho já está numa folha usada) · *metadado* (JSON/MD/licença).

**Não verificado:** nada ficou ilegível (0 erros de leitura em 2.489 imagens). Os 15 GIFs tiveram só dimensões e nº de quadros lidos (não foram abertos quadro a quadro). A paleta dos pacotes gerados por IA foi medida contra a Cosy; os LEIA-ME dizem "paleta do Cat Cafe", mas a medição mostra desvio em vários (tabela 6).

## Achados principais
1. **Nenhuma referência quebrada**: todos os 85 caminhos citados em dados/código existem em `public/assets/`.
2. **1.382 de 2.570 arquivos estão em uso** (+24 fontes de importação), sendo 1.244 as camadas do criador de personagem (pacote + cópia em `public/`). 768 são peças soltas/quadros que duplicam folhas já usadas, 112 são previews/demos e 180 não têm referência.
3. **`public/assets/` tem 6 sobras sem referência**: vassoura antiga (2), `placeholders.png`, `gabi_caixa.gif`, `etiqueta_preco.png` e o placeholder da jogadora.
4. **O balcão do café mistura dois pacotes** (marrom do fluxo + rosa do Cat Cafe) no mesmo móvel: é a inconsistência mais visível hoje.
5. **Humanos fora da paleta Cosy** (clientes, personagem principal, NPCs): 10–30% dos pixels longe da paleta, contorno e rosto diferentes entre clientes e NPCs com nome.
6. **A jogadora já usa as camadas do criador de personagem** (`f08aec4`); o placeholder `mulher_placeholder_32x64.png` ficou sem uso.
7. **Áudio: 0 arquivos.** `data/audio.json` tem todos os `file: null`.
8. **Nome da senhorinha diverge**: `data/npcs.json` e falas dizem "Dona Neusa"; `ART_AND_LICENSE.md` e o design dizem "Dona Lurdes". **Decidido: Dona Neusa**; falta corrigir os dois docs.
9. `.gitignore` cobre `assets/`, `public/assets/`, `*.png` e `*.zip`; `git ls-files` não lista nenhuma imagem. OK.

## 1. Resumo geral

| Pacote | Arquivos | Imagens | KB | Em uso | Fonte de importação | Carregado, não exibido | Ref. nos dados, não carregado | Sem referência | Preview/demo | Duplicata/peça solta | Metadado | Imagens com problema técnico |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| (raiz de assets/) | 3 | 2 | 53 | 0 | 0 | 0 | 0 | 1 | 1 | 1 | 0 | 1 |
| Cat-Cafe-32x32 | 69 | 62 | 103 | 0 | 1 | 0 | 0 | 0 | 3 | 58 | 7 | 4 |
| catalogo_compras | 34 | 32 | 27 | 1 | 0 | 0 | 0 | 0 | 1 | 30 | 2 | 1 |
| celular | 21 | 19 | 23 | 4 | 0 | 0 | 0 | 14 | 1 | 0 | 2 | 10 |
| clientes | 24 | 22 | 76 | 10 | 0 | 0 | 0 | 10 | 2 | 0 | 2 | 10 |
| correio | 6 | 6 | 35 | 3 | 0 | 1 | 0 | 0 | 2 | 0 | 0 | 5 |
| corretora_e_vassoura | 44 | 40 | 472 | 4 | 0 | 0 | 0 | 12 | 4 | 20 | 4 | 3 |
| Cosy-Cats-32x32 | 485 | 480 | 1384 | 1 | 0 | 0 | 11 | 0 | 24 | 444 | 5 | 0 |
| cozinha_cafe | 2 | 2 | 19 | 0 | 0 | 0 | 0 | 1 | 1 | 0 | 0 | 1 |
| equipamentos | 2 | 2 | 21 | 1 | 0 | 0 | 0 | 0 | 1 | 0 | 0 | 1 |
| fluxo_cafe_onda1 | 87 | 80 | 74 | 24 | 22 | 0 | 0 | 11 | 4 | 19 | 7 | 39 |
| gabi_e_joca | 5 | 4 | 49 | 3 | 0 | 0 | 0 | 1 | 0 | 0 | 1 | 0 |
| itens_bebidas | 2 | 1 | 4 | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 1 | 0 |
| louca | 2 | 2 | 9 | 1 | 0 | 0 | 0 | 0 | 1 | 0 | 0 | 1 |
| materia_prima | 5 | 3 | 6 | 1 | 0 | 0 | 0 | 0 | 0 | 2 | 2 | 1 |
| mercado_interior | 59 | 56 | 132 | 1 | 0 | 0 | 0 | 0 | 3 | 52 | 3 | 0 |
| personagem_principal | 629 | 624 | 732 | 622 | 0 | 0 | 0 | 0 | 2 | 0 | 5 | 232 |
| pia | 11 | 9 | 9 | 1 | 0 | 0 | 0 | 0 | 1 | 7 | 2 | 0 |
| public/assets | 712 | 712 | 1066 | 693 | 1 | 1 | 11 | 6 | 0 | 0 | 0 | 265 |
| quintal_secreto | 61 | 58 | 295 | 0 | 0 | 0 | 0 | 55 | 3 | 0 | 3 | 17 |
| rua_estacoes_tilesets | 200 | 174 | 2673 | 7 | 0 | 0 | 0 | 9 | 47 | 111 | 26 | 42 |
| senhorinha | 3 | 3 | 41 | 2 | 0 | 0 | 0 | 0 | 1 | 0 | 0 | 1 |
| sujeira_cafe_abandonado | 28 | 26 | 52 | 1 | 0 | 0 | 0 | 0 | 1 | 24 | 2 | 1 |
| tilesets_expansao | 74 | 69 | 466 | 0 | 0 | 0 | 0 | 60 | 9 | 0 | 5 | 3 |
| vassoura_nova | 2 | 1 | 2 | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 1 | 0 |
| **Total** | **2570** | **2489** | **7822** | **1382** | **24** | **2** | **22** | **180** | **112** | **768** | **80** | **638** |

Observações da tabela 1: "em uso" nos pacotes conta o arquivo cuja cópia idêntica em `public/assets/` é exibida. `public/assets` aparece separado porque é o que o jogo carrega. "Imagens com problema técnico" soma tudo da tabela 6 (fora da grade, fundo opaco suspeito, fora da paleta, densidade 2x, nome fora do padrão), inclusive arquivos sem uso.

## 2. Inventário completo

Uma linha por arquivo. Exceção: pastas de camadas/quadros com centenas de arquivos do mesmo tamanho (camadas do personagem principal, quadros e tiras do Cosy Cats) estão **agrupadas por pasta**, com contagem, dimensões (todas conferidas) e status; os arquivos individuais estão listados na tabela 4 quando sem uso.

<details><summary>Abrir inventário (958 linhas)</summary>

| Pacote | Arquivo | Formato | Dimensões | KB | Grade 32? | Quadros (tamanho · qtd) | Status de uso | Observações |
|---|---|---|---|---|---|---|---|---|
| Cat-Cafe-32x32 | `assets/Cat-Cafe-32x32/cosy-palette.gpl` | gpl | — | 0.7 | — |  | metadado | metadado/licença |
| Cat-Cafe-32x32 | `assets/Cat-Cafe-32x32/LICENCE.txt` | txt | — | 0.6 | — |  | metadado | metadado/licença |
| Cat-Cafe-32x32 | `assets/Cat-Cafe-32x32/objects/bookshelf.png` | png | 32x64 | 0.5 | sim |  | duplicata/peça solta | peça solta; o jogo usa a folha cat-cafe-tileset |
| Cat-Cafe-32x32 | `assets/Cat-Cafe-32x32/objects/cactus.png` | png | 32x32 | 0.3 | sim |  | duplicata/peça solta | peça solta; o jogo usa a folha cat-cafe-tileset |
| Cat-Cafe-32x32 | `assets/Cat-Cafe-32x32/objects/cake_slice.png` | png | 32x32 | 0.3 | sim |  | duplicata/peça solta | peça solta; o jogo usa a folha cat-cafe-tileset |
| Cat-Cafe-32x32 | `assets/Cat-Cafe-32x32/objects/cake_stand.png` | png | 32x32 | 0.4 | sim |  | duplicata/peça solta | peça solta; o jogo usa a folha cat-cafe-tileset |
| Cat-Cafe-32x32 | `assets/Cat-Cafe-32x32/objects/cake_whole.png` | png | 32x32 | 0.4 | sim |  | duplicata/peça solta | peça solta; o jogo usa a folha cat-cafe-tileset |
| Cat-Cafe-32x32 | `assets/Cat-Cafe-32x32/objects/cat_bed.png` | png | 32x32 | 0.4 | sim |  | duplicata/peça solta | peça solta; o jogo usa a folha cat-cafe-tileset |
| Cat-Cafe-32x32 | `assets/Cat-Cafe-32x32/objects/cat_condo.png` | png | 64x64 | 0.7 | sim |  | duplicata/peça solta | peça solta; o jogo usa a folha cat-cafe-tileset |
| Cat-Cafe-32x32 | `assets/Cat-Cafe-32x32/objects/cat_tree.png` | png | 64x96 | 1 | sim |  | duplicata/peça solta | peça solta; o jogo usa a folha cat-cafe-tileset |
| Cat-Cafe-32x32 | `assets/Cat-Cafe-32x32/objects/chair_back.png` | png | 32x32 | 0.3 | sim |  | duplicata/peça solta | peça solta; o jogo usa a folha cat-cafe-tileset |
| Cat-Cafe-32x32 | `assets/Cat-Cafe-32x32/objects/chair_front.png` | png | 32x32 | 0.3 | sim |  | duplicata/peça solta | peça solta; o jogo usa a folha cat-cafe-tileset |
| Cat-Cafe-32x32 | `assets/Cat-Cafe-32x32/objects/coffee_machine.png` | png | 32x32 | 0.3 | sim |  | duplicata/peça solta | peça solta; o jogo usa a folha cat-cafe-tileset |
| Cat-Cafe-32x32 | `assets/Cat-Cafe-32x32/objects/cookie_jar.png` | png | 32x32 | 0.4 | sim |  | duplicata/peça solta | peça solta; o jogo usa a folha cat-cafe-tileset |
| Cat-Cafe-32x32 | `assets/Cat-Cafe-32x32/objects/counter_left.png` | png | 32x32 | 0.2 | sim |  | duplicata/peça solta | peça solta; o jogo usa a folha cat-cafe-tileset |
| Cat-Cafe-32x32 | `assets/Cat-Cafe-32x32/objects/counter_mid.png` | png | 32x32 | 0.2 | sim |  | duplicata/peça solta | peça solta; o jogo usa a folha cat-cafe-tileset |
| Cat-Cafe-32x32 | `assets/Cat-Cafe-32x32/objects/counter_register.png` | png | 32x32 | 0.2 | sim |  | duplicata/peça solta | peça solta; o jogo usa a folha cat-cafe-tileset |
| Cat-Cafe-32x32 | `assets/Cat-Cafe-32x32/objects/counter_right.png` | png | 32x32 | 0.2 | sim |  | duplicata/peça solta | peça solta; o jogo usa a folha cat-cafe-tileset |
| Cat-Cafe-32x32 | `assets/Cat-Cafe-32x32/objects/counter_single.png` | png | 32x32 | 0.2 | sim |  | duplicata/peça solta | peça solta; o jogo usa a folha cat-cafe-tileset |
| Cat-Cafe-32x32 | `assets/Cat-Cafe-32x32/objects/croissant.png` | png | 32x32 | 0.5 | sim |  | duplicata/peça solta | peça solta; o jogo usa a folha cat-cafe-tileset |
| Cat-Cafe-32x32 | `assets/Cat-Cafe-32x32/objects/cupcake.png` | png | 32x32 | 0.4 | sim |  | duplicata/peça solta | peça solta; o jogo usa a folha cat-cafe-tileset |
| Cat-Cafe-32x32 | `assets/Cat-Cafe-32x32/objects/cushion_butter.png` | png | 32x32 | 0.3 | sim |  | duplicata/peça solta | peça solta; o jogo usa a folha cat-cafe-tileset |
| Cat-Cafe-32x32 | `assets/Cat-Cafe-32x32/objects/cushion_lav.png` | png | 32x32 | 0.3 | sim |  | duplicata/peça solta | peça solta; o jogo usa a folha cat-cafe-tileset |
| Cat-Cafe-32x32 | `assets/Cat-Cafe-32x32/objects/cushion_mint.png` | png | 32x32 | 0.3 | sim |  | duplicata/peça solta | peça solta; o jogo usa a folha cat-cafe-tileset |
| Cat-Cafe-32x32 | `assets/Cat-Cafe-32x32/objects/cushion_pink.png` | png | 32x32 | 0.3 | sim |  | duplicata/peça solta | peça solta; o jogo usa a folha cat-cafe-tileset |
| Cat-Cafe-32x32 | `assets/Cat-Cafe-32x32/objects/cushion_sky.png` | png | 32x32 | 0.3 | sim |  | duplicata/peça solta | peça solta; o jogo usa a folha cat-cafe-tileset |
| Cat-Cafe-32x32 | `assets/Cat-Cafe-32x32/objects/display_case.png` | png | 64x32 | 0.4 | sim |  | duplicata/peça solta | peça solta; o jogo usa a folha cat-cafe-tileset |
| Cat-Cafe-32x32 | `assets/Cat-Cafe-32x32/objects/door.png` | png | 32x64 | 0.5 | sim |  | duplicata/peça solta | peça solta; o jogo usa a folha cat-cafe-tileset |
| Cat-Cafe-32x32 | `assets/Cat-Cafe-32x32/objects/doormat.png` | png | 32x32 | 0.2 | sim |  | duplicata/peça solta | peça solta; o jogo usa a folha cat-cafe-tileset |
| Cat-Cafe-32x32 | `assets/Cat-Cafe-32x32/objects/fish_biscuits.png` | png | 32x32 | 0.3 | sim |  | duplicata/peça solta | peça solta; o jogo usa a folha cat-cafe-tileset |
| Cat-Cafe-32x32 | `assets/Cat-Cafe-32x32/objects/floor_check_pink.png` | png | 32x32 | 0.2 | sim |  | duplicata/peça solta | peça solta; o jogo usa a folha cat-cafe-tileset |
| Cat-Cafe-32x32 | `assets/Cat-Cafe-32x32/objects/floor_rug.png` | png | 96x64 | 0.5 | sim |  | duplicata/peça solta | peça solta; o jogo usa a folha cat-cafe-tileset |
| Cat-Cafe-32x32 | `assets/Cat-Cafe-32x32/objects/floor_tile_mint.png` | png | 32x32 | 0.2 | sim |  | duplicata/peça solta | peça solta; o jogo usa a folha cat-cafe-tileset |
| Cat-Cafe-32x32 | `assets/Cat-Cafe-32x32/objects/floor_wood_a.png` | png | 32x32 | 0.2 | sim |  | duplicata/peça solta | peça solta; o jogo usa a folha cat-cafe-tileset |
| Cat-Cafe-32x32 | `assets/Cat-Cafe-32x32/objects/floor_wood_b.png` | png | 32x32 | 0.2 | sim |  | duplicata/peça solta | peça solta; o jogo usa a folha cat-cafe-tileset |
| Cat-Cafe-32x32 | `assets/Cat-Cafe-32x32/objects/flower_vase.png` | png | 32x32 | 0.4 | sim |  | duplicata/peça solta | peça solta; o jogo usa a folha cat-cafe-tileset |
| Cat-Cafe-32x32 | `assets/Cat-Cafe-32x32/objects/food_bowl.png` | png | 32x32 | 0.3 | sim |  | duplicata/peça solta | peça solta; o jogo usa a folha cat-cafe-tileset |
| Cat-Cafe-32x32 | `assets/Cat-Cafe-32x32/objects/latte.png` | png | 32x32 | 0.3 | sim |  | duplicata/peça solta | peça solta; o jogo usa a folha cat-cafe-tileset |
| Cat-Cafe-32x32 | `assets/Cat-Cafe-32x32/objects/macarons.png` | png | 32x32 | 0.4 | sim |  | duplicata/peça solta | peça solta; o jogo usa a folha cat-cafe-tileset |
| Cat-Cafe-32x32 | `assets/Cat-Cafe-32x32/objects/menu_board.png` | png | 64x32 | 0.3 | sim |  | duplicata/peça solta | peça solta; o jogo usa a folha cat-cafe-tileset |
| Cat-Cafe-32x32 | `assets/Cat-Cafe-32x32/objects/milkshake.png` | png | 32x32 | 0.3 | sim |  | duplicata/peça solta | peça solta; o jogo usa a folha cat-cafe-tileset |
| Cat-Cafe-32x32 | `assets/Cat-Cafe-32x32/objects/picture_paw.png` | png | 32x32 | 0.2 | sim |  | duplicata/peça solta | peça solta; o jogo usa a folha cat-cafe-tileset |
| Cat-Cafe-32x32 | `assets/Cat-Cafe-32x32/objects/plant_hanging.png` | png | 32x32 | 0.4 | sim |  | duplicata/peça solta | peça solta; o jogo usa a folha cat-cafe-tileset |
| Cat-Cafe-32x32 | `assets/Cat-Cafe-32x32/objects/plant_pot.png` | png | 32x32 | 0.4 | sim |  | duplicata/peça solta | peça solta; o jogo usa a folha cat-cafe-tileset |
| Cat-Cafe-32x32 | `assets/Cat-Cafe-32x32/objects/plant_tall.png` | png | 32x64 | 0.7 | sim |  | duplicata/peça solta | peça solta; o jogo usa a folha cat-cafe-tileset |
| Cat-Cafe-32x32 | `assets/Cat-Cafe-32x32/objects/scratch_post.png` | png | 32x32 | 0.4 | sim |  | duplicata/peça solta | peça solta; o jogo usa a folha cat-cafe-tileset |
| Cat-Cafe-32x32 | `assets/Cat-Cafe-32x32/objects/sofa.png` | png | 64x32 | 0.4 | sim |  | duplicata/peça solta | peça solta; o jogo usa a folha cat-cafe-tileset |
| Cat-Cafe-32x32 | `assets/Cat-Cafe-32x32/objects/table_round.png` | png | 32x32 | 0.4 | sim |  | duplicata/peça solta | peça solta; o jogo usa a folha cat-cafe-tileset |
| Cat-Cafe-32x32 | `assets/Cat-Cafe-32x32/objects/teapot.png` | png | 32x32 | 0.4 | sim |  | duplicata/peça solta | peça solta; o jogo usa a folha cat-cafe-tileset |
| Cat-Cafe-32x32 | `assets/Cat-Cafe-32x32/objects/tea_cup.png` | png | 32x32 | 0.3 | sim |  | duplicata/peça solta | peça solta; o jogo usa a folha cat-cafe-tileset |
| Cat-Cafe-32x32 | `assets/Cat-Cafe-32x32/objects/wall_clock.png` | png | 32x32 | 0.5 | sim |  | duplicata/peça solta | peça solta; o jogo usa a folha cat-cafe-tileset |
| Cat-Cafe-32x32 | `assets/Cat-Cafe-32x32/objects/wall_dots_cream.png` | png | 32x32 | 0.1 | sim |  | duplicata/peça solta | peça solta; o jogo usa a folha cat-cafe-tileset |
| Cat-Cafe-32x32 | `assets/Cat-Cafe-32x32/objects/wall_mint.png` | png | 32x32 | 0.1 | sim |  | duplicata/peça solta | peça solta; o jogo usa a folha cat-cafe-tileset |
| Cat-Cafe-32x32 | `assets/Cat-Cafe-32x32/objects/wall_shelf.png` | png | 64x32 | 0.4 | sim |  | duplicata/peça solta | peça solta; o jogo usa a folha cat-cafe-tileset |
| Cat-Cafe-32x32 | `assets/Cat-Cafe-32x32/objects/wall_stripe_pink.png` | png | 32x32 | 0.1 | sim |  | duplicata/peça solta | peça solta; o jogo usa a folha cat-cafe-tileset |
| Cat-Cafe-32x32 | `assets/Cat-Cafe-32x32/objects/wall_top_trim.png` | png | 32x32 | 0.1 | sim |  | duplicata/peça solta | peça solta; o jogo usa a folha cat-cafe-tileset |
| Cat-Cafe-32x32 | `assets/Cat-Cafe-32x32/objects/wall_wainscot.png` | png | 32x32 | 0.2 | sim |  | duplicata/peça solta | peça solta; o jogo usa a folha cat-cafe-tileset |
| Cat-Cafe-32x32 | `assets/Cat-Cafe-32x32/objects/water_bowl.png` | png | 32x32 | 0.2 | sim |  | duplicata/peça solta | peça solta; o jogo usa a folha cat-cafe-tileset |
| Cat-Cafe-32x32 | `assets/Cat-Cafe-32x32/objects/window.png` | png | 64x64 | 0.6 | sim |  | duplicata/peça solta | peça solta; o jogo usa a folha cat-cafe-tileset |
| Cat-Cafe-32x32 | `assets/Cat-Cafe-32x32/objects/yarn_balls.png` | png | 32x32 | 0.5 | sim |  | duplicata/peça solta | peça solta; o jogo usa a folha cat-cafe-tileset |
| Cat-Cafe-32x32 | `assets/Cat-Cafe-32x32/preview/cat-cafe-tileset_2x.png` | png | 512x704 | 17.6 | sim | grade 32 · 16x22 | preview/demo | preview/demo/referência; nome fora de snake_case |
| Cat-Cafe-32x32 | `assets/Cat-Cafe-32x32/preview/sample-cafe.png` | png | 512x352 | 16.5 | sim |  | preview/demo | preview/demo/referência; nome fora de snake_case |
| Cat-Cafe-32x32 | `assets/Cat-Cafe-32x32/preview/sample-cafe_2x.png` | png | 1024x704 | 24.5 | sim |  | preview/demo | preview/demo/referência; nome fora de snake_case |
| Cat-Cafe-32x32 | `assets/Cat-Cafe-32x32/README.txt` | txt | — | 2 | — |  | metadado | metadado/licença |
| Cat-Cafe-32x32 | `assets/Cat-Cafe-32x32/tiled/cat-cafe.tsx` | tsx | — | 0.2 | — |  | metadado | metadado/licença |
| Cat-Cafe-32x32 | `assets/Cat-Cafe-32x32/tiled/sample-cafe.tmx` | tmx | — | 2.6 | — |  | metadado | metadado/licença |
| Cat-Cafe-32x32 | `assets/Cat-Cafe-32x32/tiles/cat-cafe-tileset.png` | png | 256x352 | 13.3 | sim | grade 32 · 8x11 | fonte de importação | cópia em public/assets/tiles/cat-cafe-tileset.png; lido por scripts/build-worn-tiles.ts; o jogo carrega a versão -ext; nome fora de snake_case |
| Cat-Cafe-32x32 | `assets/Cat-Cafe-32x32/tiles/tiles.csv` | csv | — | 1.3 | — |  | metadado | metadado/licença |
| Cat-Cafe-32x32 | `assets/Cat-Cafe-32x32/tiles/tiles.json` | json | — | 4 | — |  | metadado | metadado/licença |
| catalogo_compras | `assets/catalogo_compras/pack/catalogo/catalogo_icones.json` | json | — | 1.4 | — |  | metadado | metadado/licença |
| catalogo_compras | `assets/catalogo_compras/pack/catalogo/catalogo_icones.png` | png | 160x96 | 2.9 | sim | grade 32 · 5x3 | em uso | cópia em public/assets/icons/catalogo_icones.png |
| catalogo_compras | `assets/catalogo_compras/pack/catalogo/catalogo_rotulado.png` | png | 640x426 | 11.7 | **não** |  | preview/demo | preview/demo/referência; fora da grade 32/16 |
| catalogo_compras | `assets/catalogo_compras/pack/catalogo/icones/areia.png` | png | 32x32 | 0.3 | sim |  | duplicata/peça solta | peça solta; o jogo usa catalogo_icones |
| catalogo_compras | `assets/catalogo_compras/pack/catalogo/icones/areia_64.png` | png | 64x64 | 0.4 | sim |  | duplicata/peça solta | ampliação 2x de ícone (não usada) |
| catalogo_compras | `assets/catalogo_compras/pack/catalogo/icones/caixa_areia.png` | png | 32x32 | 0.3 | sim |  | duplicata/peça solta | peça solta; o jogo usa catalogo_icones |
| catalogo_compras | `assets/catalogo_compras/pack/catalogo/icones/caixa_areia_64.png` | png | 64x64 | 0.4 | sim |  | duplicata/peça solta | ampliação 2x de ícone (não usada) |
| catalogo_compras | `assets/catalogo_compras/pack/catalogo/icones/calabresa.png` | png | 32x32 | 0.3 | sim |  | duplicata/peça solta | peça solta; o jogo usa catalogo_icones |
| catalogo_compras | `assets/catalogo_compras/pack/catalogo/icones/calabresa_64.png` | png | 64x64 | 0.4 | sim |  | duplicata/peça solta | ampliação 2x de ícone (não usada) |
| catalogo_compras | `assets/catalogo_compras/pack/catalogo/icones/carne.png` | png | 32x32 | 0.4 | sim |  | duplicata/peça solta | peça solta; o jogo usa catalogo_icones |
| catalogo_compras | `assets/catalogo_compras/pack/catalogo/icones/carne_64.png` | png | 64x64 | 0.5 | sim |  | duplicata/peça solta | ampliação 2x de ícone (não usada) |
| catalogo_compras | `assets/catalogo_compras/pack/catalogo/icones/chocolate.png` | png | 32x32 | 0.2 | sim |  | duplicata/peça solta | peça solta; o jogo usa catalogo_icones |
| catalogo_compras | `assets/catalogo_compras/pack/catalogo/icones/chocolate_64.png` | png | 64x64 | 0.4 | sim |  | duplicata/peça solta | ampliação 2x de ícone (não usada) |
| catalogo_compras | `assets/catalogo_compras/pack/catalogo/icones/farinha.png` | png | 32x32 | 0.3 | sim |  | duplicata/peça solta | peça solta; o jogo usa catalogo_icones |
| catalogo_compras | `assets/catalogo_compras/pack/catalogo/icones/farinha_64.png` | png | 64x64 | 0.4 | sim |  | duplicata/peça solta | ampliação 2x de ícone (não usada) |
| catalogo_compras | `assets/catalogo_compras/pack/catalogo/icones/frango.png` | png | 32x32 | 0.4 | sim |  | duplicata/peça solta | peça solta; o jogo usa catalogo_icones |
| catalogo_compras | `assets/catalogo_compras/pack/catalogo/icones/frango_64.png` | png | 64x64 | 0.5 | sim |  | duplicata/peça solta | ampliação 2x de ícone (não usada) |
| catalogo_compras | `assets/catalogo_compras/pack/catalogo/icones/leite.png` | png | 32x32 | 0.3 | sim |  | duplicata/peça solta | peça solta; o jogo usa catalogo_icones |
| catalogo_compras | `assets/catalogo_compras/pack/catalogo/icones/leite_64.png` | png | 64x64 | 0.4 | sim |  | duplicata/peça solta | ampliação 2x de ícone (não usada) |
| catalogo_compras | `assets/catalogo_compras/pack/catalogo/icones/manteiga.png` | png | 32x32 | 0.3 | sim |  | duplicata/peça solta | peça solta; o jogo usa catalogo_icones |
| catalogo_compras | `assets/catalogo_compras/pack/catalogo/icones/manteiga_64.png` | png | 64x64 | 0.4 | sim |  | duplicata/peça solta | ampliação 2x de ícone (não usada) |
| catalogo_compras | `assets/catalogo_compras/pack/catalogo/icones/oleo.png` | png | 32x32 | 0.3 | sim |  | duplicata/peça solta | peça solta; o jogo usa catalogo_icones |
| catalogo_compras | `assets/catalogo_compras/pack/catalogo/icones/oleo_64.png` | png | 64x64 | 0.4 | sim |  | duplicata/peça solta | ampliação 2x de ícone (não usada) |
| catalogo_compras | `assets/catalogo_compras/pack/catalogo/icones/ovos.png` | png | 32x32 | 0.3 | sim |  | duplicata/peça solta | peça solta; o jogo usa catalogo_icones |
| catalogo_compras | `assets/catalogo_compras/pack/catalogo/icones/ovos_64.png` | png | 64x64 | 0.4 | sim |  | duplicata/peça solta | ampliação 2x de ícone (não usada) |
| catalogo_compras | `assets/catalogo_compras/pack/catalogo/icones/petisco_biscoito.png` | png | 32x32 | 0.3 | sim |  | duplicata/peça solta | peça solta; o jogo usa catalogo_icones |
| catalogo_compras | `assets/catalogo_compras/pack/catalogo/icones/petisco_biscoito_64.png` | png | 64x64 | 0.4 | sim |  | duplicata/peça solta | ampliação 2x de ícone (não usada) |
| catalogo_compras | `assets/catalogo_compras/pack/catalogo/icones/racao_premium.png` | png | 32x32 | 0.3 | sim |  | duplicata/peça solta | peça solta; o jogo usa catalogo_icones |
| catalogo_compras | `assets/catalogo_compras/pack/catalogo/icones/racao_premium_64.png` | png | 64x64 | 0.5 | sim |  | duplicata/peça solta | ampliação 2x de ícone (não usada) |
| catalogo_compras | `assets/catalogo_compras/pack/catalogo/icones/racao_simples.png` | png | 32x32 | 0.3 | sim |  | duplicata/peça solta | peça solta; o jogo usa catalogo_icones |
| catalogo_compras | `assets/catalogo_compras/pack/catalogo/icones/racao_simples_64.png` | png | 64x64 | 0.4 | sim |  | duplicata/peça solta | ampliação 2x de ícone (não usada) |
| catalogo_compras | `assets/catalogo_compras/pack/catalogo/icones/sal.png` | png | 32x32 | 0.3 | sim |  | duplicata/peça solta | peça solta; o jogo usa catalogo_icones |
| catalogo_compras | `assets/catalogo_compras/pack/catalogo/icones/sal_64.png` | png | 64x64 | 0.4 | sim |  | duplicata/peça solta | ampliação 2x de ícone (não usada) |
| catalogo_compras | `assets/catalogo_compras/pack/catalogo/LEIA-ME.md` | md | — | 0.4 | — |  | metadado | metadado/licença |
| celular | `assets/celular/pack/celular/celular.json` | json | — | 0.5 | — |  | metadado | metadado/licença |
| celular | `assets/celular/pack/celular/celular_preview.png` | png | 900x768 | 9.4 | **não** |  | preview/demo | preview/demo/referência; fora da grade 32/16 |
| celular | `assets/celular/pack/celular/icones/app_banco.png` | png | 32x32 | 0.4 | sim |  | sem referência | nenhuma referência |
| celular | `assets/celular/pack/celular/icones/app_classificados.png` | png | 32x32 | 0.3 | sim |  | em uso | cópia em public/assets/phone/app_classificados.png |
| celular | `assets/celular/pack/celular/icones/app_contatos.png` | png | 32x32 | 0.3 | sim |  | sem referência | nenhuma referência; fora da paleta (28.1% dos px) |
| celular | `assets/celular/pack/celular/icones/app_gatos.png` | png | 32x32 | 0.4 | sim |  | sem referência | nenhuma referência |
| celular | `assets/celular/pack/celular/icones/app_ligacoes.png` | png | 32x32 | 0.4 | sim |  | sem referência | nenhuma referência; fora da paleta (70.8% dos px) |
| celular | `assets/celular/pack/celular/icones/app_mapa.png` | png | 32x32 | 0.4 | sim |  | sem referência | nenhuma referência |
| celular | `assets/celular/pack/celular/icones/app_mensagens.png` | png | 32x32 | 0.3 | sim |  | sem referência | nenhuma referência; fora da paleta (52.4% dos px) |
| celular | `assets/celular/pack/celular/icones/celular_tocando_1.png` | png | 32x48 | 0.5 | **não** | 32x48 · 1 | sem referência | nenhuma referência; fora da grade 32 (múltiplo de 16) |
| celular | `assets/celular/pack/celular/icones/celular_tocando_2.png` | png | 32x48 | 0.4 | **não** | 32x48 · 1 | sem referência | nenhuma referência; fora da grade 32 (múltiplo de 16) |
| celular | `assets/celular/pack/celular/icones/notificacao_bolinha.png` | png | 16x16 | 0.2 | **não** |  | em uso | cópia em public/assets/phone/notificacao_bolinha.png; fora da grade 32 (múltiplo de 16) |
| celular | `assets/celular/pack/celular/icones/status_sinal_wifi_bateria.png` | png | 48x8 | 0.2 | **não** |  | em uso | cópia em public/assets/phone/status_sinal_wifi_bateria.png; fora da grade 32/16 |
| celular | `assets/celular/pack/celular/LEIA-ME.md` | md | — | 0.7 | — |  | metadado | metadado/licença |
| celular | `assets/celular/pack/celular/molduras/celular_ameixa_9slice_48.png` | png | 48x48 | 0.5 | **não** |  | sem referência | nenhuma referência; fora da grade 32 (múltiplo de 16) |
| celular | `assets/celular/pack/celular/molduras/celular_ameixa_tela_apagada.png` | png | 160x256 | 1.4 | sim |  | sem referência | nenhuma referência |
| celular | `assets/celular/pack/celular/molduras/celular_ameixa_tela_escura.png` | png | 160x256 | 1.4 | sim |  | sem referência | nenhuma referência |
| celular | `assets/celular/pack/celular/molduras/celular_ameixa_tela_transparente.png` | png | 160x256 | 1.4 | sim |  | em uso | cópia em public/assets/phone/celular_ameixa_tela_transparente.png |
| celular | `assets/celular/pack/celular/molduras/celular_creme_tela_transparente.png` | png | 160x256 | 1.4 | sim |  | sem referência | nenhuma referência |
| celular | `assets/celular/pack/celular/molduras/celular_menta_tela_transparente.png` | png | 160x256 | 1.4 | sim |  | sem referência | nenhuma referência |
| celular | `assets/celular/pack/celular/molduras/celular_rosa_tela_transparente.png` | png | 160x256 | 1.4 | sim |  | sem referência | nenhuma referência; fora da paleta (69.7% dos px) |
| (raiz de assets/) | `assets/celular.zip` | zip | — | 21.7 | — |  | duplicata/peça solta | zip do pacote celular (24 arquivos, já extraído na pasta celular/) |
| clientes | `assets/clientes/clientes/clientes.json` | json | — | 1.2 | — |  | metadado | metadado/licença |
| clientes | `assets/clientes/clientes/clientes_preview.png` | png | 1310x260 | 7 | **não** |  | preview/demo | preview/demo/referência; fora da grade 32/16 |
| clientes | `assets/clientes/clientes/clientes_todos_sheets.png` | png | 1280x256 | 27.6 | sim | grade 32 · 40x8 | preview/demo | preview/demo/referência |
| clientes | `assets/clientes/clientes/cliente_01_homem_negro_barba_oculos.png` | png | 128x256 | 3.4 | sim | 32x64 · 4x4 (16) | em uso | cópia em public/assets/npc/clientes/cliente_01_homem_negro_barba_oculos.png |
| clientes | `assets/clientes/clientes/cliente_01_homem_negro_barba_oculos_parado.png` | png | 32x64 | 0.6 | sim |  | sem referência | nenhuma referência |
| clientes | `assets/clientes/clientes/cliente_02_mulher_negra_black_power.png` | png | 128x256 | 3.6 | sim | 32x64 · 4x4 (16) | em uso | cópia em public/assets/npc/clientes/cliente_02_mulher_negra_black_power.png; fora da paleta (28.8% dos px) |
| clientes | `assets/clientes/clientes/cliente_02_mulher_negra_black_power_parado.png` | png | 32x64 | 0.6 | sim |  | sem referência | nenhuma referência; fora da paleta (31.5% dos px) |
| clientes | `assets/clientes/clientes/cliente_03_homem_ruivo_bone.png` | png | 128x256 | 3.5 | sim | 32x64 · 4x4 (16) | em uso | cópia em public/assets/npc/clientes/cliente_03_homem_ruivo_bone.png; fora da paleta (27.2% dos px) |
| clientes | `assets/clientes/clientes/cliente_03_homem_ruivo_bone_parado.png` | png | 32x64 | 0.6 | sim |  | sem referência | nenhuma referência |
| clientes | `assets/clientes/clientes/cliente_04_mulher_asiatica_cabelo_longo.png` | png | 128x256 | 3.4 | sim | 32x64 · 4x4 (16) | em uso | cópia em public/assets/npc/clientes/cliente_04_mulher_asiatica_cabelo_longo.png |
| clientes | `assets/clientes/clientes/cliente_04_mulher_asiatica_cabelo_longo_parado.png` | png | 32x64 | 0.6 | sim |  | sem referência | nenhuma referência |
| clientes | `assets/clientes/clientes/cliente_05_homem_asiatico_oculos_escritorio.png` | png | 128x256 | 3.3 | sim | 32x64 · 4x4 (16) | em uso | cópia em public/assets/npc/clientes/cliente_05_homem_asiatico_oculos_escritorio.png |
| clientes | `assets/clientes/clientes/cliente_05_homem_asiatico_oculos_escritorio_parado.png` | png | 32x64 | 0.6 | sim |  | sem referência | nenhuma referência |
| clientes | `assets/clientes/clientes/cliente_06_mulher_loira_rabo_esportiva.png` | png | 128x256 | 3.6 | sim | 32x64 · 4x4 (16) | em uso | cópia em public/assets/npc/clientes/cliente_06_mulher_loira_rabo_esportiva.png; fora da paleta (32% dos px) |
| clientes | `assets/clientes/clientes/cliente_06_mulher_loira_rabo_esportiva_parado.png` | png | 32x64 | 0.6 | sim |  | sem referência | nenhuma referência; fora da paleta (26.5% dos px) |
| clientes | `assets/clientes/clientes/cliente_07_homem_idoso_grisalho_bigode.png` | png | 128x256 | 3.4 | sim | 32x64 · 4x4 (16) | em uso | cópia em public/assets/npc/clientes/cliente_07_homem_idoso_grisalho_bigode.png |
| clientes | `assets/clientes/clientes/cliente_07_homem_idoso_grisalho_bigode_parado.png` | png | 32x64 | 0.6 | sim |  | sem referência | nenhuma referência |
| clientes | `assets/clientes/clientes/cliente_08_mulher_latina_cacheada.png` | png | 128x256 | 3.4 | sim | 32x64 · 4x4 (16) | em uso | cópia em public/assets/npc/clientes/cliente_08_mulher_latina_cacheada.png |
| clientes | `assets/clientes/clientes/cliente_08_mulher_latina_cacheada_parado.png` | png | 32x64 | 0.6 | sim |  | sem referência | nenhuma referência |
| clientes | `assets/clientes/clientes/cliente_09_homem_pardo_careca_barba_xadrez.png` | png | 128x256 | 3.3 | sim | 32x64 · 4x4 (16) | em uso | cópia em public/assets/npc/clientes/cliente_09_homem_pardo_careca_barba_xadrez.png; fora da paleta (27.9% dos px) |
| clientes | `assets/clientes/clientes/cliente_09_homem_pardo_careca_barba_xadrez_parado.png` | png | 32x64 | 0.6 | sim |  | sem referência | nenhuma referência; fora da paleta (31.2% dos px) |
| clientes | `assets/clientes/clientes/cliente_10_mulher_hijab_vestido.png` | png | 128x256 | 3 | sim | 32x64 · 4x4 (16) | em uso | cópia em public/assets/npc/clientes/cliente_10_mulher_hijab_vestido.png; fora da paleta (62.1% dos px) |
| clientes | `assets/clientes/clientes/cliente_10_mulher_hijab_vestido_parado.png` | png | 32x64 | 0.6 | sim |  | sem referência | nenhuma referência; fora da paleta (58.2% dos px) |
| clientes | `assets/clientes/clientes/LEIA-ME.md` | md | — | 0.5 | — |  | metadado | metadado/licença |
| correio | `assets/correio/entregadora_original_4x.png` | png | 778x1280 | 14.7 | **não** |  | preview/demo | preview/demo/referência; fora da grade 32/16 |
| correio | `assets/correio/entregadora_retrato_64.png` | png | 64x64 | 0.7 | sim |  | em uso | cópia em public/assets/npc/entregadora_retrato_64.png |
| correio | `assets/correio/entregadora_spritesheet.png` | png | 128x320 | 8.6 | sim | 32x64 · 4x5 (20) | em uso | cópia em public/assets/npc/entregadora_spritesheet.png; fora da paleta (30.4% dos px) |
| correio | `assets/correio/furgao_direita.png` | png | 188x106 | 2.2 | **não** |  | carregado, nunca exibido | cópia em public/assets/vehicles/furgao_direita.png; carregado como van_right e nunca usado; fora da grade 32/16; pixel 2x (densidade diferente) |
| correio | `assets/correio/furgao_esquerda.png` | png | 188x107 | 2.3 | **não** |  | em uso | cópia em public/assets/vehicles/furgao_esquerda.png; fora da grade 32/16; pixel 2x (densidade diferente) |
| correio | `assets/correio/furgao_original_2x.png` | png | 926x522 | 6.3 | **não** |  | preview/demo | preview/demo/referência; fora da grade 32/16 |
| corretora_e_vassoura | `assets/corretora_e_vassoura/pack/personagens/corretora_andando.gif` | gif | 384x192 | 16.5 | sim | GIF · 6 quadros | preview/demo | preview/demo/referência |
| corretora_e_vassoura | `assets/corretora_e_vassoura/pack/personagens/corretora_preview_4x.png` | png | 778x1280 | 13.3 | **não** |  | preview/demo | preview/demo/referência; fora da grade 32/16 |
| corretora_e_vassoura | `assets/corretora_e_vassoura/pack/personagens/corretora_retrato_64.png` | png | 64x64 | 0.6 | sim |  | em uso | cópia em public/assets/npc/corretora_retrato_64.png |
| corretora_e_vassoura | `assets/corretora_e_vassoura/pack/personagens/corretora_spritesheet.json` | json | — | 0.5 | — |  | metadado | metadado/licença |
| corretora_e_vassoura | `assets/corretora_e_vassoura/pack/personagens/corretora_spritesheet.png` | png | 128x320 | 4.9 | sim | 32x64 · 4x5 (20) | em uso | cópia em public/assets/npc/corretora_spritesheet.png |
| corretora_e_vassoura | `assets/corretora_e_vassoura/pack/personagens/frames/corretora_baixo_0.png` | png | 32x64 | 0.7 | sim |  | duplicata/peça solta | quadros soltos da corretora |
| corretora_e_vassoura | `assets/corretora_e_vassoura/pack/personagens/frames/corretora_baixo_1.png` | png | 32x64 | 0.7 | sim |  | duplicata/peça solta | quadros soltos da corretora |
| corretora_e_vassoura | `assets/corretora_e_vassoura/pack/personagens/frames/corretora_baixo_2.png` | png | 32x64 | 0.7 | sim |  | duplicata/peça solta | quadros soltos da corretora |
| corretora_e_vassoura | `assets/corretora_e_vassoura/pack/personagens/frames/corretora_baixo_3.png` | png | 32x64 | 0.8 | sim |  | duplicata/peça solta | quadros soltos da corretora |
| corretora_e_vassoura | `assets/corretora_e_vassoura/pack/personagens/frames/corretora_cima_0.png` | png | 32x64 | 0.5 | sim |  | duplicata/peça solta | quadros soltos da corretora |
| corretora_e_vassoura | `assets/corretora_e_vassoura/pack/personagens/frames/corretora_cima_1.png` | png | 32x64 | 0.5 | sim |  | duplicata/peça solta | quadros soltos da corretora |
| corretora_e_vassoura | `assets/corretora_e_vassoura/pack/personagens/frames/corretora_cima_2.png` | png | 32x64 | 0.5 | sim |  | duplicata/peça solta | quadros soltos da corretora |
| corretora_e_vassoura | `assets/corretora_e_vassoura/pack/personagens/frames/corretora_cima_3.png` | png | 32x64 | 0.6 | sim |  | duplicata/peça solta | quadros soltos da corretora |
| corretora_e_vassoura | `assets/corretora_e_vassoura/pack/personagens/frames/corretora_direita_0.png` | png | 32x64 | 0.5 | sim |  | duplicata/peça solta | quadros soltos da corretora |
| corretora_e_vassoura | `assets/corretora_e_vassoura/pack/personagens/frames/corretora_direita_1.png` | png | 32x64 | 0.5 | sim |  | duplicata/peça solta | quadros soltos da corretora |
| corretora_e_vassoura | `assets/corretora_e_vassoura/pack/personagens/frames/corretora_direita_2.png` | png | 32x64 | 0.5 | sim |  | duplicata/peça solta | quadros soltos da corretora |
| corretora_e_vassoura | `assets/corretora_e_vassoura/pack/personagens/frames/corretora_direita_3.png` | png | 32x64 | 0.6 | sim |  | duplicata/peça solta | quadros soltos da corretora |
| corretora_e_vassoura | `assets/corretora_e_vassoura/pack/personagens/frames/corretora_esquerda_0.png` | png | 32x64 | 0.5 | sim |  | duplicata/peça solta | quadros soltos da corretora |
| corretora_e_vassoura | `assets/corretora_e_vassoura/pack/personagens/frames/corretora_esquerda_1.png` | png | 32x64 | 0.5 | sim |  | duplicata/peça solta | quadros soltos da corretora |
| corretora_e_vassoura | `assets/corretora_e_vassoura/pack/personagens/frames/corretora_esquerda_2.png` | png | 32x64 | 0.5 | sim |  | duplicata/peça solta | quadros soltos da corretora |
| corretora_e_vassoura | `assets/corretora_e_vassoura/pack/personagens/frames/corretora_esquerda_3.png` | png | 32x64 | 0.6 | sim |  | duplicata/peça solta | quadros soltos da corretora |
| corretora_e_vassoura | `assets/corretora_e_vassoura/pack/personagens/frames/corretora_extra_0.png` | png | 32x64 | 0.7 | sim |  | duplicata/peça solta | quadros soltos da corretora |
| corretora_e_vassoura | `assets/corretora_e_vassoura/pack/personagens/frames/corretora_extra_1.png` | png | 32x64 | 0.7 | sim |  | duplicata/peça solta | quadros soltos da corretora |
| corretora_e_vassoura | `assets/corretora_e_vassoura/pack/personagens/frames/corretora_extra_2.png` | png | 32x64 | 0.8 | sim |  | duplicata/peça solta | quadros soltos da corretora |
| corretora_e_vassoura | `assets/corretora_e_vassoura/pack/personagens/frames/corretora_extra_3.png` | png | 32x64 | 0.8 | sim |  | duplicata/peça solta | quadros soltos da corretora |
| corretora_e_vassoura | `assets/corretora_e_vassoura/pack/personagens/icone_chave.png` | png | 32x32 | 0.3 | sim |  | em uso | cópia em public/assets/npc/icone_chave.png |
| corretora_e_vassoura | `assets/corretora_e_vassoura/pack/personagens/LEIA-ME.md` | md | — | 0.5 | — |  | metadado | metadado/licença |
| corretora_e_vassoura | `assets/corretora_e_vassoura/pack/personagens/placa_vende_se.png` | png | 32x64 | 0.3 | sim |  | sem referência | nenhuma referência |
| corretora_e_vassoura | `assets/corretora_e_vassoura/pack/vassoura/frames/brilho_limpo_1.png` | png | 32x32 | 0.2 | sim |  | sem referência | vassoura antiga (substituída por vassoura_nova) |
| corretora_e_vassoura | `assets/corretora_e_vassoura/pack/vassoura/frames/brilho_limpo_2.png` | png | 32x32 | 0.2 | sim |  | sem referência | vassoura antiga (substituída por vassoura_nova) |
| corretora_e_vassoura | `assets/corretora_e_vassoura/pack/vassoura/frames/brilho_limpo_3.png` | png | 32x32 | 0.2 | sim |  | sem referência | vassoura antiga (substituída por vassoura_nova) |
| corretora_e_vassoura | `assets/corretora_e_vassoura/pack/vassoura/frames/poeira_1.png` | png | 32x32 | 0.2 | sim |  | sem referência | vassoura antiga (substituída por vassoura_nova) |
| corretora_e_vassoura | `assets/corretora_e_vassoura/pack/vassoura/frames/poeira_2.png` | png | 32x32 | 0.2 | sim |  | sem referência | vassoura antiga (substituída por vassoura_nova) |
| corretora_e_vassoura | `assets/corretora_e_vassoura/pack/vassoura/frames/poeira_3.png` | png | 32x32 | 0.3 | sim |  | sem referência | vassoura antiga (substituída por vassoura_nova) |
| corretora_e_vassoura | `assets/corretora_e_vassoura/pack/vassoura/frames/vassoura_parada.png` | png | 64x64 | 0.7 | sim |  | sem referência | vassoura antiga (substituída por vassoura_nova); fora da paleta (25.7% dos px) |
| corretora_e_vassoura | `assets/corretora_e_vassoura/pack/vassoura/frames/vassoura_varrer_1.png` | png | 64x64 | 1 | sim |  | sem referência | vassoura antiga (substituída por vassoura_nova) |
| corretora_e_vassoura | `assets/corretora_e_vassoura/pack/vassoura/frames/vassoura_varrer_2.png` | png | 64x64 | 1 | sim |  | sem referência | vassoura antiga (substituída por vassoura_nova) |
| corretora_e_vassoura | `assets/corretora_e_vassoura/pack/vassoura/LEIA-ME.md` | md | — | 0.5 | — |  | metadado | metadado/licença |
| corretora_e_vassoura | `assets/corretora_e_vassoura/pack/vassoura/vassoura_demo_limpeza.gif` | gif | 576x384 | 405.1 | sim | GIF · 26 quadros | preview/demo | preview/demo/referência |
| corretora_e_vassoura | `assets/corretora_e_vassoura/pack/vassoura/vassoura_encostada.png` | png | 32x64 | 0.9 | sim |  | sem referência | cópia em public/assets/tools/vassoura_encostada.png; nenhuma referência |
| corretora_e_vassoura | `assets/corretora_e_vassoura/pack/vassoura/vassoura_icone.png` | png | 32x32 | 0.7 | sim |  | em uso | cópia em public/assets/tools/vassoura_icone.png |
| corretora_e_vassoura | `assets/corretora_e_vassoura/pack/vassoura/vassoura_preview_4x.png` | png | 768x676 | 8.4 | **não** |  | preview/demo | preview/demo/referência; fora da grade 32/16 |
| corretora_e_vassoura | `assets/corretora_e_vassoura/pack/vassoura/vassoura_spritesheet.json` | json | — | 0.7 | — |  | metadado | metadado/licença |
| corretora_e_vassoura | `assets/corretora_e_vassoura/pack/vassoura/vassoura_spritesheet.png` | png | 192x128 | 2.8 | sim | misto 64x64 + 32x32 (ver JSON) | sem referência | cópia em public/assets/tools/vassoura_spritesheet.png; nenhuma referência |
| Cosy-Cats-32x32 | `assets/Cosy-Cats-32x32/animations.csv` | csv | — | 0.1 | — |  | metadado | metadado/licença |
| Cosy-Cats-32x32 | `assets/Cosy-Cats-32x32/animations.json` | json | — | 1.5 | — |  | metadado | metadado/licença |
| Cosy-Cats-32x32 | `assets/Cosy-Cats-32x32/cosy-cats-palette.gpl` | gpl | — | 2 | — |  | metadado | metadado/licença |
| Cosy-Cats-32x32 | `assets/Cosy-Cats-32x32/LICENCE.txt` | txt | — | 0.6 | — |  | metadado | metadado/licença |
| Cosy-Cats-32x32 | `assets/Cosy-Cats-32x32/README.txt` | txt | — | 1.7 | — |  | metadado | metadado/licença |
| Cosy-Cats-32x32 | `assets/Cosy-Cats-32x32/sheets/biscuit.png` | png | 192x224 | 6.2 | sim | 32x32 · 6x7 (30 usados) | referenciado nos dados, não carregado | cópia em public/assets/cats/biscuit.png; listado em cat_sprites.json; nenhum gato usa a variante |
| Cosy-Cats-32x32 | `assets/Cosy-Cats-32x32/sheets/custard.png` | png | 192x224 | 7.4 | sim | 32x32 · 6x7 (30 usados) | referenciado nos dados, não carregado | cópia em public/assets/cats/custard.png; listado em cat_sprites.json; nenhum gato usa a variante |
| Cosy-Cats-32x32 | `assets/Cosy-Cats-32x32/sheets/domino.png` | png | 192x224 | 5.6 | sim | 32x32 · 6x7 (30 usados) | referenciado nos dados, não carregado | cópia em public/assets/cats/domino.png; listado em cat_sprites.json; nenhum gato usa a variante |
| Cosy-Cats-32x32 | `assets/Cosy-Cats-32x32/sheets/freckle.png` | png | 192x224 | 7.3 | sim | 32x32 · 6x7 (30 usados) | referenciado nos dados, não carregado | cópia em public/assets/cats/freckle.png; listado em cat_sprites.json; nenhum gato usa a variante |
| Cosy-Cats-32x32 | `assets/Cosy-Cats-32x32/sheets/hazel.png` | png | 192x224 | 7.4 | sim | 32x32 · 6x7 (30 usados) | referenciado nos dados, não carregado | cópia em public/assets/cats/hazel.png; listado em cat_sprites.json; nenhum gato usa a variante |
| Cosy-Cats-32x32 | `assets/Cosy-Cats-32x32/sheets/marmalade.png` | png | 192x224 | 7.6 | sim | 32x32 · 6x7 (30 usados) | em uso | cópia em public/assets/cats/marmalade.png; gato Marmalade (cat.first_stray) |
| Cosy-Cats-32x32 | `assets/Cosy-Cats-32x32/sheets/midnight.png` | png | 192x224 | 5.5 | sim | 32x32 · 6x7 (30 usados) | referenciado nos dados, não carregado | cópia em public/assets/cats/midnight.png; listado em cat_sprites.json; nenhum gato usa a variante |
| Cosy-Cats-32x32 | `assets/Cosy-Cats-32x32/sheets/misty.png` | png | 192x224 | 5.5 | sim | 32x32 · 6x7 (30 usados) | referenciado nos dados, não carregado | cópia em public/assets/cats/misty.png; listado em cat_sprites.json; nenhum gato usa a variante |
| Cosy-Cats-32x32 | `assets/Cosy-Cats-32x32/sheets/patches.png` | png | 192x224 | 7.9 | sim | 32x32 · 6x7 (30 usados) | referenciado nos dados, não carregado | cópia em public/assets/cats/patches.png; listado em cat_sprites.json; nenhum gato usa a variante |
| Cosy-Cats-32x32 | `assets/Cosy-Cats-32x32/sheets/pebble.png` | png | 192x224 | 7.4 | sim | 32x32 · 6x7 (30 usados) | referenciado nos dados, não carregado | cópia em public/assets/cats/pebble.png; Tekinha: memory=true, não é carregada |
| Cosy-Cats-32x32 | `assets/Cosy-Cats-32x32/sheets/snowdrop.png` | png | 192x224 | 5.7 | sim | 32x32 · 6x7 (30 usados) | referenciado nos dados, não carregado | cópia em public/assets/cats/snowdrop.png; listado em cat_sprites.json; nenhum gato usa a variante |
| Cosy-Cats-32x32 | `assets/Cosy-Cats-32x32/sheets/toffee.png` | png | 192x224 | 9.4 | sim | 32x32 · 6x7 (30 usados) | referenciado nos dados, não carregado | cópia em public/assets/cats/toffee.png; listado em cat_sprites.json; nenhum gato usa a variante |
| cozinha_cafe | `assets/cozinha_cafe/cafeteira_spritesheet.png` | png | 192x32 | 1.4 | sim | 32x32 · 6 | sem referência | versão antiga; substituída pela cafeteira do fluxo |
| cozinha_cafe | `assets/cozinha_cafe/cozinha_cafe_original.png` | png | 1500x848 | 17.6 | **não** |  | preview/demo | preview/demo/referência; fora da grade 32/16 |
| equipamentos | `assets/equipamentos/equipamentos_original.png` | png | 778x640 | 8.9 | **não** |  | preview/demo | preview/demo/referência; fora da grade 32/16 |
| equipamentos | `assets/equipamentos/equipamentos_spritesheet.png` | png | 192x160 | 11.7 | sim | 32x32 · 6x5 (30) | em uso | cópia em public/assets/equipment/equipamentos_spritesheet.png |
| fluxo_cafe_onda1 | `assets/fluxo_cafe_onda1/fluxo_cafe/bandeja/bandeja_1_itens.png` | png | 32x32 | 0.3 | sim |  | fonte de importação | fonte de scripts/import-fluxo.ts (resultado em uso) |
| fluxo_cafe_onda1 | `assets/fluxo_cafe_onda1/fluxo_cafe/bandeja/bandeja_2_itens.png` | png | 32x32 | 0.3 | sim |  | fonte de importação | fonte de scripts/import-fluxo.ts (resultado em uso) |
| fluxo_cafe_onda1 | `assets/fluxo_cafe_onda1/fluxo_cafe/bandeja/bandeja_3_itens.png` | png | 32x32 | 0.3 | sim |  | fonte de importação | fonte de scripts/import-fluxo.ts (resultado em uso) |
| fluxo_cafe_onda1 | `assets/fluxo_cafe_onda1/fluxo_cafe/bandeja/bandeja_vazia.png` | png | 32x32 | 0.2 | sim |  | fonte de importação | fonte de scripts/import-fluxo.ts (resultado em uso) |
| fluxo_cafe_onda1 | `assets/fluxo_cafe_onda1/fluxo_cafe/estacoes/balcao_dir.png` | png | 32x32 | 0.2 | sim |  | fonte de importação | fonte de scripts/import-fluxo.ts (resultado em uso) |
| fluxo_cafe_onda1 | `assets/fluxo_cafe_onda1/fluxo_cafe/estacoes/balcao_esq.png` | png | 32x32 | 0.2 | sim |  | fonte de importação | fonte de scripts/import-fluxo.ts (resultado em uso) |
| fluxo_cafe_onda1 | `assets/fluxo_cafe_onda1/fluxo_cafe/estacoes/balcao_marcador_1.png` | png | 32x32 | 0.2 | sim |  | em uso | cópia em public/assets/fluxo/ui/balcao_marcador_1.png |
| fluxo_cafe_onda1 | `assets/fluxo_cafe_onda1/fluxo_cafe/estacoes/balcao_marcador_2.png` | png | 32x32 | 0.2 | sim |  | em uso | cópia em public/assets/fluxo/ui/balcao_marcador_2.png |
| fluxo_cafe_onda1 | `assets/fluxo_cafe_onda1/fluxo_cafe/estacoes/balcao_meio.png` | png | 32x32 | 0.2 | sim |  | fonte de importação | fonte de scripts/import-fluxo.ts (resultado em uso) |
| fluxo_cafe_onda1 | `assets/fluxo_cafe_onda1/fluxo_cafe/estacoes/cafeteira_ociosa.png` | png | 32x32 | 0.3 | sim |  | fonte de importação | fonte de scripts/import-fluxo.ts (resultado em uso) |
| fluxo_cafe_onda1 | `assets/fluxo_cafe_onda1/fluxo_cafe/estacoes/cafeteira_preparando_1.png` | png | 32x32 | 0.4 | sim |  | fonte de importação | fonte de scripts/import-fluxo.ts (resultado em uso) |
| fluxo_cafe_onda1 | `assets/fluxo_cafe_onda1/fluxo_cafe/estacoes/cafeteira_preparando_2.png` | png | 32x32 | 0.4 | sim |  | fonte de importação | fonte de scripts/import-fluxo.ts (resultado em uso) |
| fluxo_cafe_onda1 | `assets/fluxo_cafe_onda1/fluxo_cafe/estacoes/cafeteira_preparando_3.png` | png | 32x32 | 0.4 | sim |  | fonte de importação | fonte de scripts/import-fluxo.ts (resultado em uso) |
| fluxo_cafe_onda1 | `assets/fluxo_cafe_onda1/fluxo_cafe/estacoes/cafeteira_preparando_4.png` | png | 32x32 | 0.4 | sim |  | fonte de importação | fonte de scripts/import-fluxo.ts (resultado em uso) |
| fluxo_cafe_onda1 | `assets/fluxo_cafe_onda1/fluxo_cafe/estacoes/cafeteira_pronta.png` | png | 32x32 | 0.5 | sim |  | fonte de importação | fonte de scripts/import-fluxo.ts (resultado em uso) |
| fluxo_cafe_onda1 | `assets/fluxo_cafe_onda1/fluxo_cafe/estacoes/demo_balcao.png` | png | 160x64 | 1 | sim |  | preview/demo | preview/demo/referência |
| fluxo_cafe_onda1 | `assets/fluxo_cafe_onda1/fluxo_cafe/icones/biscoito.png` | png | 32x32 | 0.4 | sim |  | fonte de importação | fonte de scripts/import-fluxo.ts (resultado em uso) |
| fluxo_cafe_onda1 | `assets/fluxo_cafe_onda1/fluxo_cafe/icones/bolo_fatia.png` | png | 32x32 | 0.3 | sim |  | fonte de importação | fonte de scripts/import-fluxo.ts (resultado em uso) |
| fluxo_cafe_onda1 | `assets/fluxo_cafe_onda1/fluxo_cafe/icones/cafe_com_leite.png` | png | 32x32 | 0.4 | sim |  | fonte de importação | fonte de scripts/import-fluxo.ts (resultado em uso) |
| fluxo_cafe_onda1 | `assets/fluxo_cafe_onda1/fluxo_cafe/icones/cafe_preto.png` | png | 32x32 | 0.3 | sim |  | fonte de importação | fonte de scripts/import-fluxo.ts (resultado em uso) |
| fluxo_cafe_onda1 | `assets/fluxo_cafe_onda1/fluxo_cafe/icones/cha.png` | png | 32x32 | 0.4 | sim |  | fonte de importação | fonte de scripts/import-fluxo.ts (resultado em uso) |
| fluxo_cafe_onda1 | `assets/fluxo_cafe_onda1/fluxo_cafe/icones/ingredientes/acucar_pacote.png` | png | 32x32 | 0.3 | sim |  | duplicata/peça solta | mesmo desenho do ícone de materia_prima (quase idêntico) |
| fluxo_cafe_onda1 | `assets/fluxo_cafe_onda1/fluxo_cafe/icones/ingredientes/filtro_papel.png` | png | 32x32 | 0.3 | sim |  | duplicata/peça solta | mesmo desenho do ícone de materia_prima (quase idêntico) |
| fluxo_cafe_onda1 | `assets/fluxo_cafe_onda1/fluxo_cafe/icones/ingredientes/graos_cafe_saco.png` | png | 32x32 | 0.4 | sim |  | duplicata/peça solta | mesmo desenho do ícone de materia_prima (quase idêntico) |
| fluxo_cafe_onda1 | `assets/fluxo_cafe_onda1/fluxo_cafe/icones/ingredientes/leite_po_lata.png` | png | 32x32 | 0.3 | sim |  | duplicata/peça solta | mesmo desenho do ícone de materia_prima (quase idêntico) |
| fluxo_cafe_onda1 | `assets/fluxo_cafe_onda1/fluxo_cafe/icones/ingredientes/polpa_laranja.png` | png | 32x32 | 0.3 | sim |  | duplicata/peça solta | mesmo desenho do ícone de materia_prima (quase idêntico) |
| fluxo_cafe_onda1 | `assets/fluxo_cafe_onda1/fluxo_cafe/icones/ingredientes/polpa_limao.png` | png | 32x32 | 0.3 | sim |  | duplicata/peça solta | mesmo desenho do ícone de materia_prima (quase idêntico) |
| fluxo_cafe_onda1 | `assets/fluxo_cafe_onda1/fluxo_cafe/icones/ingredientes/polpa_morango.png` | png | 32x32 | 0.3 | sim |  | duplicata/peça solta | mesmo desenho do ícone de materia_prima (quase idêntico) |
| fluxo_cafe_onda1 | `assets/fluxo_cafe_onda1/fluxo_cafe/icones/ingredientes/po_cafe_pacote.png` | png | 32x32 | 0.3 | sim |  | duplicata/peça solta | mesmo desenho do ícone de materia_prima (quase idêntico) |
| fluxo_cafe_onda1 | `assets/fluxo_cafe_onda1/fluxo_cafe/icones/ingredientes/saquinho_cha_preto.png` | png | 32x32 | 0.3 | sim |  | duplicata/peça solta | mesmo desenho do ícone de materia_prima (quase idêntico) |
| fluxo_cafe_onda1 | `assets/fluxo_cafe_onda1/fluxo_cafe/icones/ingredientes/saquinho_cha_verde.png` | png | 32x32 | 0.3 | sim |  | duplicata/peça solta | mesmo desenho do ícone de materia_prima (quase idêntico) |
| fluxo_cafe_onda1 | `assets/fluxo_cafe_onda1/fluxo_cafe/icones/pao.png` | png | 32x32 | 0.3 | sim |  | fonte de importação | fonte de scripts/import-fluxo.ts (resultado em uso) |
| fluxo_cafe_onda1 | `assets/fluxo_cafe_onda1/fluxo_cafe/icones/pao_de_queijo.png` | png | 32x32 | 0.4 | sim |  | fonte de importação | fonte de scripts/import-fluxo.ts (resultado em uso) |
| fluxo_cafe_onda1 | `assets/fluxo_cafe_onda1/fluxo_cafe/icones/remedio.png` | png | 32x32 | 0.3 | sim |  | fonte de importação | fonte de scripts/import-fluxo.ts (resultado em uso) |
| fluxo_cafe_onda1 | `assets/fluxo_cafe_onda1/fluxo_cafe/icones/suco.png` | png | 32x32 | 0.4 | sim |  | fonte de importação | fonte de scripts/import-fluxo.ts (resultado em uso); fora da paleta (35% dos px) |
| fluxo_cafe_onda1 | `assets/fluxo_cafe_onda1/fluxo_cafe/LEIA-ME.md` | md | — | 1.2 | — |  | metadado | metadado/licença |
| fluxo_cafe_onda1 | `assets/fluxo_cafe_onda1/fluxo_cafe/louca/copo_cheia.png` | png | 16x16 | 0.2 | **não** |  | duplicata/peça solta | peça solta; o jogo usa louca_tileset_16; fora da grade 32 (múltiplo de 16) |
| fluxo_cafe_onda1 | `assets/fluxo_cafe_onda1/fluxo_cafe/louca/copo_limpa.png` | png | 16x16 | 0.1 | **não** |  | duplicata/peça solta | peça solta; o jogo usa louca_tileset_16; fora da grade 32 (múltiplo de 16) |
| fluxo_cafe_onda1 | `assets/fluxo_cafe_onda1/fluxo_cafe/louca/copo_suja.png` | png | 16x16 | 0.2 | **não** |  | duplicata/peça solta | peça solta; o jogo usa louca_tileset_16; fora da grade 32 (múltiplo de 16) |
| fluxo_cafe_onda1 | `assets/fluxo_cafe_onda1/fluxo_cafe/louca/louca_tileset_16.json` | json | — | 0.1 | — |  | metadado | metadado/licença |
| fluxo_cafe_onda1 | `assets/fluxo_cafe_onda1/fluxo_cafe/louca/louca_tileset_16.png` | png | 48x48 | 0.7 | **não** | 16x16 · 3x3 | em uso | cópia em public/assets/fluxo/louca_16.png; fora da grade 32 (múltiplo de 16) |
| fluxo_cafe_onda1 | `assets/fluxo_cafe_onda1/fluxo_cafe/louca/prato_cheia.png` | png | 16x16 | 0.2 | **não** |  | duplicata/peça solta | peça solta; o jogo usa louca_tileset_16; fora da grade 32 (múltiplo de 16) |
| fluxo_cafe_onda1 | `assets/fluxo_cafe_onda1/fluxo_cafe/louca/prato_limpa.png` | png | 16x16 | 0.1 | **não** |  | duplicata/peça solta | peça solta; o jogo usa louca_tileset_16; fora da grade 32 (múltiplo de 16) |
| fluxo_cafe_onda1 | `assets/fluxo_cafe_onda1/fluxo_cafe/louca/prato_suja.png` | png | 16x16 | 0.2 | **não** |  | duplicata/peça solta | peça solta; o jogo usa louca_tileset_16; fora da grade 32 (múltiplo de 16) |
| fluxo_cafe_onda1 | `assets/fluxo_cafe_onda1/fluxo_cafe/louca/xicara_cheia.png` | png | 16x16 | 0.2 | **não** |  | duplicata/peça solta | peça solta; o jogo usa louca_tileset_16; fora da grade 32 (múltiplo de 16) |
| fluxo_cafe_onda1 | `assets/fluxo_cafe_onda1/fluxo_cafe/louca/xicara_limpa.png` | png | 16x16 | 0.2 | **não** |  | duplicata/peça solta | peça solta; o jogo usa louca_tileset_16; fora da grade 32 (múltiplo de 16) |
| fluxo_cafe_onda1 | `assets/fluxo_cafe_onda1/fluxo_cafe/louca/xicara_suja.png` | png | 16x16 | 0.2 | **não** |  | duplicata/peça solta | peça solta; o jogo usa louca_tileset_16; fora da grade 32 (múltiplo de 16) |
| fluxo_cafe_onda1 | `assets/fluxo_cafe_onda1/fluxo_cafe/personagem_carregando/exemplo_item_na_mao.png` | png | 128x256 | 1.5 | sim | 32x64 · 4x4 (16) | preview/demo | preview/demo/referência |
| fluxo_cafe_onda1 | `assets/fluxo_cafe_onda1/fluxo_cafe/personagem_carregando/gabi_carrega_bandeja.png` | png | 128x256 | 3.8 | sim | 32x64 · 4x4 (16) | sem referência | nenhuma referência |
| fluxo_cafe_onda1 | `assets/fluxo_cafe_onda1/fluxo_cafe/personagem_carregando/gabi_carrega_gato.png` | png | 128x256 | 3.9 | sim | 32x64 · 4x4 (16) | sem referência | nenhuma referência |
| fluxo_cafe_onda1 | `assets/fluxo_cafe_onda1/fluxo_cafe/personagem_carregando/gabi_carrega_item.png` | png | 128x256 | 3.6 | sim | 32x64 · 4x4 (16) | sem referência | nenhuma referência |
| fluxo_cafe_onda1 | `assets/fluxo_cafe_onda1/fluxo_cafe/personagem_carregando/gabi_carrega_saco_pesado.png` | png | 128x256 | 3.6 | sim | 32x64 · 4x4 (16) | sem referência | nenhuma referência |
| fluxo_cafe_onda1 | `assets/fluxo_cafe_onda1/fluxo_cafe/personagem_carregando/personagem_carregando.json` | json | — | 1.4 | — |  | metadado | metadado/licença |
| fluxo_cafe_onda1 | `assets/fluxo_cafe_onda1/fluxo_cafe/personagem_carregando/preview_carregando.png` | png | 1064x512 | 13.3 | **não** |  | preview/demo | preview/demo/referência; fora da grade 32/16 |
| fluxo_cafe_onda1 | `assets/fluxo_cafe_onda1/fluxo_cafe/preview_onda1.png` | png | 1500x848 | 17.6 | **não** |  | preview/demo | preview/demo/referência; fora da grade 32/16 |
| fluxo_cafe_onda1 | `assets/fluxo_cafe_onda1/fluxo_cafe/ui/balao_aguardando_1.png` | png | 24x22 | 0.2 | **não** |  | em uso | cópia em public/assets/fluxo/ui/balao_aguardando_1.png; fora da grade 32/16 |
| fluxo_cafe_onda1 | `assets/fluxo_cafe_onda1/fluxo_cafe/ui/balao_aguardando_2.png` | png | 24x22 | 0.2 | **não** |  | em uso | cópia em public/assets/fluxo/ui/balao_aguardando_2.png; fora da grade 32/16 |
| fluxo_cafe_onda1 | `assets/fluxo_cafe_onda1/fluxo_cafe/ui/balao_aguardando_3.png` | png | 24x22 | 0.2 | **não** |  | em uso | cópia em public/assets/fluxo/ui/balao_aguardando_3.png; fora da grade 32/16 |
| fluxo_cafe_onda1 | `assets/fluxo_cafe_onda1/fluxo_cafe/ui/balao_pedido.json` | json | — | 0.1 | — |  | metadado | metadado/licença |
| fluxo_cafe_onda1 | `assets/fluxo_cafe_onda1/fluxo_cafe/ui/balao_pedido.png` | png | 40x44 | 0.2 | **não** |  | em uso | cópia em public/assets/fluxo/ui/balao_pedido.png; fora da grade 32/16 |
| fluxo_cafe_onda1 | `assets/fluxo_cafe_onda1/fluxo_cafe/ui/balao_pedido_furioso.png` | png | 40x44 | 0.2 | **não** |  | em uso | cópia em public/assets/fluxo/ui/balao_pedido_furioso.png; fora da grade 32/16 |
| fluxo_cafe_onda1 | `assets/fluxo_cafe_onda1/fluxo_cafe/ui/balao_pedido_impaciente.png` | png | 40x44 | 0.2 | **não** |  | em uso | cópia em public/assets/fluxo/ui/balao_pedido_impaciente.png; fora da grade 32/16 |
| fluxo_cafe_onda1 | `assets/fluxo_cafe_onda1/fluxo_cafe/ui/barra_progresso_0.png` | png | 34x8 | 0.1 | **não** |  | em uso | cópia em public/assets/fluxo/ui/barra_progresso_0.png; fora da grade 32/16; pixel 4x (densidade diferente) |
| fluxo_cafe_onda1 | `assets/fluxo_cafe_onda1/fluxo_cafe/ui/barra_progresso_1.png` | png | 34x8 | 0.1 | **não** |  | em uso | cópia em public/assets/fluxo/ui/barra_progresso_1.png; fora da grade 32/16 |
| fluxo_cafe_onda1 | `assets/fluxo_cafe_onda1/fluxo_cafe/ui/barra_progresso_2.png` | png | 34x8 | 0.1 | **não** |  | em uso | cópia em public/assets/fluxo/ui/barra_progresso_2.png; fora da grade 32/16 |
| fluxo_cafe_onda1 | `assets/fluxo_cafe_onda1/fluxo_cafe/ui/barra_progresso_3.png` | png | 34x8 | 0.1 | **não** |  | em uso | cópia em public/assets/fluxo/ui/barra_progresso_3.png; fora da grade 32/16 |
| fluxo_cafe_onda1 | `assets/fluxo_cafe_onda1/fluxo_cafe/ui/barra_progresso_4.png` | png | 34x8 | 0.1 | **não** |  | em uso | cópia em public/assets/fluxo/ui/barra_progresso_4.png; fora da grade 32/16 |
| fluxo_cafe_onda1 | `assets/fluxo_cafe_onda1/fluxo_cafe/ui/barra_progresso_5.png` | png | 34x8 | 0.1 | **não** |  | em uso | cópia em public/assets/fluxo/ui/barra_progresso_5.png; fora da grade 32/16 |
| fluxo_cafe_onda1 | `assets/fluxo_cafe_onda1/fluxo_cafe/ui/barra_progresso_6.png` | png | 34x8 | 0.1 | **não** |  | em uso | cópia em public/assets/fluxo/ui/barra_progresso_6.png; fora da grade 32/16 |
| fluxo_cafe_onda1 | `assets/fluxo_cafe_onda1/fluxo_cafe/ui/barra_progresso_7.png` | png | 34x8 | 0.1 | **não** |  | em uso | cópia em public/assets/fluxo/ui/barra_progresso_7.png; fora da grade 32/16 |
| fluxo_cafe_onda1 | `assets/fluxo_cafe_onda1/fluxo_cafe/ui/barra_progresso_8.png` | png | 34x8 | 0.1 | **não** |  | em uso | cópia em public/assets/fluxo/ui/barra_progresso_8.png; fora da grade 32/16 |
| fluxo_cafe_onda1 | `assets/fluxo_cafe_onda1/fluxo_cafe/ui/cardapio_4_slots.json` | json | — | 0.5 | — |  | metadado | metadado/licença |
| fluxo_cafe_onda1 | `assets/fluxo_cafe_onda1/fluxo_cafe/ui/cardapio_4_slots.png` | png | 192x84 | 0.8 | **não** |  | em uso | cópia em public/assets/fluxo/ui/cardapio_4_slots.png; fora da grade 32/16 |
| fluxo_cafe_onda1 | `assets/fluxo_cafe_onda1/fluxo_cafe/ui/cardapio_6_slots.json` | json | — | 0.8 | — |  | metadado | metadado/licença |
| fluxo_cafe_onda1 | `assets/fluxo_cafe_onda1/fluxo_cafe/ui/cardapio_6_slots.png` | png | 148x138 | 1 | **não** |  | em uso | cópia em public/assets/fluxo/ui/cardapio_6_slots.png; fora da grade 32/16 |
| fluxo_cafe_onda1 | `assets/fluxo_cafe_onda1/fluxo_cafe/ui/cardapio_8_slots.json` | json | — | 1 | — |  | metadado | metadado/licença |
| fluxo_cafe_onda1 | `assets/fluxo_cafe_onda1/fluxo_cafe/ui/cardapio_8_slots.png` | png | 192x138 | 1.2 | **não** |  | em uso | cópia em public/assets/fluxo/ui/cardapio_8_slots.png; fora da grade 32/16 |
| fluxo_cafe_onda1 | `assets/fluxo_cafe_onda1/fluxo_cafe/ui/etiqueta_preco.png` | png | 40x16 | 0.3 | **não** |  | sem referência | cópia em public/assets/fluxo/ui/etiqueta_preco.png; nenhuma referência; fora da grade 32/16 |
| fluxo_cafe_onda1 | `assets/fluxo_cafe_onda1/fluxo_cafe/ui/icone_bandeja.png` | png | 16x16 | 0.2 | **não** |  | sem referência | nenhuma referência; fora da grade 32 (múltiplo de 16) |
| fluxo_cafe_onda1 | `assets/fluxo_cafe_onda1/fluxo_cafe/ui/icone_louca_suja.png` | png | 32x32 | 0.4 | sim |  | sem referência | nenhuma referência |
| fluxo_cafe_onda1 | `assets/fluxo_cafe_onda1/fluxo_cafe/ui/icone_mao.png` | png | 16x16 | 0.2 | **não** |  | sem referência | nenhuma referência; fora da grade 32 (múltiplo de 16) |
| fluxo_cafe_onda1 | `assets/fluxo_cafe_onda1/fluxo_cafe/ui/marca_esgotado.png` | png | 44x18 | 0.2 | **não** |  | em uso | cópia em public/assets/fluxo/ui/marca_esgotado.png; fora da grade 32/16 |
| fluxo_cafe_onda1 | `assets/fluxo_cafe_onda1/fluxo_cafe/ui/moeda_16.png` | png | 16x16 | 0.3 | **não** |  | em uso | cópia em public/assets/fluxo/ui/moeda_16.png; fora da grade 32 (múltiplo de 16) |
| fluxo_cafe_onda1 | `assets/fluxo_cafe_onda1/fluxo_cafe/ui/moeda_32.png` | png | 32x32 | 0.4 | sim |  | sem referência | nenhuma referência |
| fluxo_cafe_onda1 | `assets/fluxo_cafe_onda1/fluxo_cafe/ui/slot_esgotado_veu.png` | png | 36x36 | 0.1 | **não** |  | em uso | cópia em public/assets/fluxo/ui/slot_esgotado_veu.png; fora da grade 32/16 |
| fluxo_cafe_onda1 | `assets/fluxo_cafe_onda1/fluxo_cafe/ui/slot_mao_selecionado.png` | png | 36x36 | 0.2 | **não** |  | sem referência | nenhuma referência; fora da grade 32/16; pixel 4x (densidade diferente) |
| fluxo_cafe_onda1 | `assets/fluxo_cafe_onda1/fluxo_cafe/ui/slot_mao_vazio.png` | png | 36x36 | 0.2 | **não** |  | sem referência | nenhuma referência; fora da grade 32/16; pixel 4x (densidade diferente) |
| gabi_e_joca | `assets/gabi_e_joca/gabi_caixa.gif` | gif | 288x288 | 38.4 | sim | GIF · 15 quadros | sem referência | cópia em public/assets/npc/gabi_caixa.gif; nenhuma referência |
| gabi_e_joca | `assets/gabi_e_joca/gabi_retrato_64.png` | png | 64x64 | 0.6 | sim |  | em uso | cópia em public/assets/npc/gabi_retrato_64.png |
| gabi_e_joca | `assets/gabi_e_joca/gabi_spritesheet.png` | png | 128x320 | 4.8 | sim | 32x64 · 4x5 (20) | em uso | cópia em public/assets/npc/gabi_spritesheet.png |
| gabi_e_joca | `assets/gabi_e_joca/spitz_spritesheet.json` | json | — | 0.6 | — |  | metadado | metadado/licença |
| gabi_e_joca | `assets/gabi_e_joca/spitz_spritesheet.png` | png | 128x192 | 4.3 | sim | 32x32 · 4x6 (24) | em uso | cópia em public/assets/npc/spitz_spritesheet.png |
| itens_bebidas | `assets/itens_bebidas/itens_bebidas_tileset.json` | json | — | 1.3 | — |  | metadado | metadado/licença |
| itens_bebidas | `assets/itens_bebidas/itens_bebidas_tileset.png` | png | 192x96 | 2.7 | sim | grade 32 · 6x3 | em uso | cópia em public/assets/icons/itens_bebidas_tileset.png |
| louca | `assets/louca/louca_original.png` | png | 1064x408 | 5.3 | **não** |  | preview/demo | preview/demo/referência; fora da grade 32/16 |
| louca | `assets/louca/louca_tileset.png` | png | 256x96 | 3.4 | sim | grade 32 · 8x3 | em uso | cópia em public/assets/icons/louca_tileset.png |
| materia_prima | `assets/materia_prima/fruta_laranja.png` | png | 32x32 | 0.4 | sim |  | duplicata/peça solta | peça solta; o jogo usa materia_prima_tileset |
| materia_prima | `assets/materia_prima/fruta_limao.png` | png | 32x32 | 0.3 | sim |  | duplicata/peça solta | peça solta; o jogo usa materia_prima_tileset; fora da paleta (77.1% dos px) |
| materia_prima | `assets/materia_prima/LEIA-ME.md` | md | — | 0.5 | — |  | metadado | metadado/licença |
| materia_prima | `assets/materia_prima/materia_prima_tileset.json` | json | — | 1 | — |  | metadado | metadado/licença |
| materia_prima | `assets/materia_prima/materia_prima_tileset.png` | png | 192x128 | 3.3 | sim | grade 32 · 6x4 | em uso | cópia em public/assets/icons/materia_prima_tileset.png |
| mercado_interior | `assets/mercado_interior/pack/mercado_interior/LEIA-ME.md` | md | — | 0.9 | — |  | metadado | metadado/licença |
| mercado_interior | `assets/mercado_interior/pack/mercado_interior/mercado_interior_cena.json` | json | — | 17.3 | — |  | metadado | metadado/licença |
| mercado_interior | `assets/mercado_interior/pack/mercado_interior/mercado_interior_cena.png` | png | 640x384 | 17.5 | sim |  | preview/demo | preview/demo/referência |
| mercado_interior | `assets/mercado_interior/pack/mercado_interior/mercado_interior_cena_2x.png` | png | 1280x768 | 24.8 | sim |  | preview/demo | preview/demo/referência |
| mercado_interior | `assets/mercado_interior/pack/mercado_interior/mercado_interior_rotulado.png` | png | 1024x448 | 38 | sim |  | preview/demo | preview/demo/referência |
| mercado_interior | `assets/mercado_interior/pack/mercado_interior/mercado_interior_tileset.json` | json | — | 5.6 | — |  | metadado | metadado/licença |
| mercado_interior | `assets/mercado_interior/pack/mercado_interior/mercado_interior_tileset.png` | png | 512x224 | 10.8 | sim | grade 32 · 16x7 | em uso | cópia em public/assets/market/mercado_interior_tileset.png |
| mercado_interior | `assets/mercado_interior/pack/mercado_interior/pecas/aquario.png` | png | 32x32 | 0.3 | sim |  | duplicata/peça solta | peça solta; o jogo usa mercado_interior_tileset |
| mercado_interior | `assets/mercado_interior/pack/mercado_interior/pecas/arranhador.png` | png | 32x32 | 0.2 | sim |  | duplicata/peça solta | peça solta; o jogo usa mercado_interior_tileset |
| mercado_interior | `assets/mercado_interior/pack/mercado_interior/pecas/arvore_gato.png` | png | 32x64 | 0.4 | sim |  | duplicata/peça solta | peça solta; o jogo usa mercado_interior_tileset |
| mercado_interior | `assets/mercado_interior/pack/mercado_interior/pecas/balcao_dir.png` | png | 32x32 | 0.2 | sim |  | duplicata/peça solta | peça solta; o jogo usa mercado_interior_tileset |
| mercado_interior | `assets/mercado_interior/pack/mercado_interior/pecas/balcao_esq.png` | png | 32x32 | 0.2 | sim |  | duplicata/peça solta | peça solta; o jogo usa mercado_interior_tileset |
| mercado_interior | `assets/mercado_interior/pack/mercado_interior/pecas/balcao_meio.png` | png | 32x32 | 0.2 | sim |  | duplicata/peça solta | peça solta; o jogo usa mercado_interior_tileset |
| mercado_interior | `assets/mercado_interior/pack/mercado_interior/pecas/banco_caixa.png` | png | 32x32 | 0.2 | sim |  | duplicata/peça solta | peça solta; o jogo usa mercado_interior_tileset |
| mercado_interior | `assets/mercado_interior/pack/mercado_interior/pecas/caixa_registradora.png` | png | 32x32 | 0.3 | sim |  | duplicata/peça solta | peça solta; o jogo usa mercado_interior_tileset |
| mercado_interior | `assets/mercado_interior/pack/mercado_interior/pecas/caixote_bananas.png` | png | 32x32 | 0.4 | sim |  | duplicata/peça solta | peça solta; o jogo usa mercado_interior_tileset |
| mercado_interior | `assets/mercado_interior/pack/mercado_interior/pecas/caixote_laranjas.png` | png | 32x32 | 0.3 | sim |  | duplicata/peça solta | peça solta; o jogo usa mercado_interior_tileset |
| mercado_interior | `assets/mercado_interior/pack/mercado_interior/pecas/caixote_macas.png` | png | 32x32 | 0.3 | sim |  | duplicata/peça solta | peça solta; o jogo usa mercado_interior_tileset |
| mercado_interior | `assets/mercado_interior/pack/mercado_interior/pecas/caixote_tomates.png` | png | 32x32 | 0.3 | sim |  | duplicata/peça solta | peça solta; o jogo usa mercado_interior_tileset |
| mercado_interior | `assets/mercado_interior/pack/mercado_interior/pecas/caixote_verdes.png` | png | 32x32 | 0.4 | sim |  | duplicata/peça solta | peça solta; o jogo usa mercado_interior_tileset |
| mercado_interior | `assets/mercado_interior/pack/mercado_interior/pecas/cama_pet_lilas.png` | png | 32x32 | 0.3 | sim |  | duplicata/peça solta | peça solta; o jogo usa mercado_interior_tileset |
| mercado_interior | `assets/mercado_interior/pack/mercado_interior/pecas/cama_pet_rosa.png` | png | 32x32 | 0.3 | sim |  | duplicata/peça solta | peça solta; o jogo usa mercado_interior_tileset |
| mercado_interior | `assets/mercado_interior/pack/mercado_interior/pecas/capacho.png` | png | 32x32 | 0.2 | sim |  | duplicata/peça solta | peça solta; o jogo usa mercado_interior_tileset |
| mercado_interior | `assets/mercado_interior/pack/mercado_interior/pecas/carrinho.png` | png | 32x32 | 0.3 | sim |  | duplicata/peça solta | peça solta; o jogo usa mercado_interior_tileset |
| mercado_interior | `assets/mercado_interior/pack/mercado_interior/pecas/cestas.png` | png | 32x32 | 0.2 | sim |  | duplicata/peça solta | peça solta; o jogo usa mercado_interior_tileset |
| mercado_interior | `assets/mercado_interior/pack/mercado_interior/pecas/cesto_brinquedos.png` | png | 32x32 | 0.3 | sim |  | duplicata/peça solta | peça solta; o jogo usa mercado_interior_tileset |
| mercado_interior | `assets/mercado_interior/pack/mercado_interior/pecas/chao_a.png` | png | 32x32 | 0.1 | sim |  | duplicata/peça solta | peça solta; o jogo usa mercado_interior_tileset |
| mercado_interior | `assets/mercado_interior/pack/mercado_interior/pecas/chao_aisle.png` | png | 32x32 | 0.2 | sim |  | duplicata/peça solta | peça solta; o jogo usa mercado_interior_tileset |
| mercado_interior | `assets/mercado_interior/pack/mercado_interior/pecas/chao_b.png` | png | 32x32 | 0.1 | sim |  | duplicata/peça solta | peça solta; o jogo usa mercado_interior_tileset |
| mercado_interior | `assets/mercado_interior/pack/mercado_interior/pecas/chao_pet.png` | png | 32x32 | 0.2 | sim |  | duplicata/peça solta | peça solta; o jogo usa mercado_interior_tileset |
| mercado_interior | `assets/mercado_interior/pack/mercado_interior/pecas/chao_sombra.png` | png | 32x32 | 0.1 | sim |  | duplicata/peça solta | peça solta; o jogo usa mercado_interior_tileset |
| mercado_interior | `assets/mercado_interior/pack/mercado_interior/pecas/gato_no_cesto.png` | png | 32x32 | 0.4 | sim |  | duplicata/peça solta | peça solta; o jogo usa mercado_interior_tileset |
| mercado_interior | `assets/mercado_interior/pack/mercado_interior/pecas/geladeira_bebidas.png` | png | 32x64 | 0.6 | sim |  | duplicata/peça solta | peça solta; o jogo usa mercado_interior_tileset |
| mercado_interior | `assets/mercado_interior/pack/mercado_interior/pecas/geladeira_pet.png` | png | 32x64 | 0.7 | sim |  | duplicata/peça solta | peça solta; o jogo usa mercado_interior_tileset |
| mercado_interior | `assets/mercado_interior/pack/mercado_interior/pecas/janela.png` | png | 32x64 | 0.3 | sim |  | duplicata/peça solta | peça solta; o jogo usa mercado_interior_tileset |
| mercado_interior | `assets/mercado_interior/pack/mercado_interior/pecas/leitor_codigo.png` | png | 32x32 | 0.2 | sim |  | duplicata/peça solta | peça solta; o jogo usa mercado_interior_tileset |
| mercado_interior | `assets/mercado_interior/pack/mercado_interior/pecas/lixeira.png` | png | 32x32 | 0.2 | sim |  | duplicata/peça solta | peça solta; o jogo usa mercado_interior_tileset |
| mercado_interior | `assets/mercado_interior/pack/mercado_interior/pecas/luminaria.png` | png | 32x32 | 0.3 | sim |  | duplicata/peça solta | peça solta; o jogo usa mercado_interior_tileset |
| mercado_interior | `assets/mercado_interior/pack/mercado_interior/pecas/parede_lado_dir.png` | png | 32x32 | 0.1 | sim |  | duplicata/peça solta | peça solta; o jogo usa mercado_interior_tileset |
| mercado_interior | `assets/mercado_interior/pack/mercado_interior/pecas/parede_lado_esq.png` | png | 32x32 | 0.1 | sim |  | duplicata/peça solta | peça solta; o jogo usa mercado_interior_tileset |
| mercado_interior | `assets/mercado_interior/pack/mercado_interior/pecas/parede_meio.png` | png | 32x32 | 0.1 | sim |  | duplicata/peça solta | peça solta; o jogo usa mercado_interior_tileset |
| mercado_interior | `assets/mercado_interior/pack/mercado_interior/pecas/parede_rodape.png` | png | 32x32 | 0.2 | sim |  | duplicata/peça solta | peça solta; o jogo usa mercado_interior_tileset |
| mercado_interior | `assets/mercado_interior/pack/mercado_interior/pecas/parede_topo.png` | png | 32x32 | 0.1 | sim |  | duplicata/peça solta | peça solta; o jogo usa mercado_interior_tileset |
| mercado_interior | `assets/mercado_interior/pack/mercado_interior/pecas/placa_caixa.png` | png | 64x32 | 0.3 | sim |  | duplicata/peça solta | peça solta; o jogo usa mercado_interior_tileset |
| mercado_interior | `assets/mercado_interior/pack/mercado_interior/pecas/placa_mercearia.png` | png | 96x32 | 0.3 | sim |  | duplicata/peça solta | peça solta; o jogo usa mercado_interior_tileset |
| mercado_interior | `assets/mercado_interior/pack/mercado_interior/pecas/placa_ofertas.png` | png | 96x32 | 0.3 | sim |  | duplicata/peça solta | peça solta; o jogo usa mercado_interior_tileset |
| mercado_interior | `assets/mercado_interior/pack/mercado_interior/pecas/placa_pet.png` | png | 64x32 | 0.3 | sim |  | duplicata/peça solta | peça solta; o jogo usa mercado_interior_tileset |
| mercado_interior | `assets/mercado_interior/pack/mercado_interior/pecas/planta.png` | png | 32x32 | 0.3 | sim |  | duplicata/peça solta | peça solta; o jogo usa mercado_interior_tileset |
| mercado_interior | `assets/mercado_interior/pack/mercado_interior/pecas/porta.png` | png | 32x64 | 0.4 | sim |  | duplicata/peça solta | peça solta; o jogo usa mercado_interior_tileset |
| mercado_interior | `assets/mercado_interior/pack/mercado_interior/pecas/prateleira_mercearia_bebidas.png` | png | 32x64 | 0.6 | sim |  | duplicata/peça solta | peça solta; o jogo usa mercado_interior_tileset |
| mercado_interior | `assets/mercado_interior/pack/mercado_interior/pecas/prateleira_mercearia_enlatados.png` | png | 32x64 | 0.6 | sim |  | duplicata/peça solta | peça solta; o jogo usa mercado_interior_tileset |
| mercado_interior | `assets/mercado_interior/pack/mercado_interior/pecas/prateleira_mercearia_padaria.png` | png | 32x64 | 0.7 | sim |  | duplicata/peça solta | peça solta; o jogo usa mercado_interior_tileset |
| mercado_interior | `assets/mercado_interior/pack/mercado_interior/pecas/prateleira_mercearia_secos.png` | png | 32x64 | 0.7 | sim |  | duplicata/peça solta | peça solta; o jogo usa mercado_interior_tileset |
| mercado_interior | `assets/mercado_interior/pack/mercado_interior/pecas/prateleira_pet_areia.png` | png | 32x64 | 0.6 | sim |  | duplicata/peça solta | peça solta; o jogo usa mercado_interior_tileset |
| mercado_interior | `assets/mercado_interior/pack/mercado_interior/pecas/prateleira_pet_brinquedos.png` | png | 32x64 | 0.6 | sim |  | duplicata/peça solta | peça solta; o jogo usa mercado_interior_tileset |
| mercado_interior | `assets/mercado_interior/pack/mercado_interior/pecas/prateleira_pet_petiscos.png` | png | 32x64 | 0.6 | sim |  | duplicata/peça solta | peça solta; o jogo usa mercado_interior_tileset |
| mercado_interior | `assets/mercado_interior/pack/mercado_interior/pecas/prateleira_pet_racao.png` | png | 32x64 | 0.6 | sim |  | duplicata/peça solta | peça solta; o jogo usa mercado_interior_tileset |
| mercado_interior | `assets/mercado_interior/pack/mercado_interior/pecas/prateleira_vazia.png` | png | 32x64 | 0.3 | sim |  | duplicata/peça solta | peça solta; o jogo usa mercado_interior_tileset |
| mercado_interior | `assets/mercado_interior/pack/mercado_interior/pecas/sacos_racao.png` | png | 32x32 | 0.3 | sim |  | duplicata/peça solta | peça solta; o jogo usa mercado_interior_tileset |
| (raiz de assets/) | `assets/mulher_placeholder_32x64.png` | png | 128x256 | 3.1 | sim | 32x64 · 4x4 (16) | sem referência | cópia em public/assets/characters/mulher_placeholder_32x64.png; nenhuma referência |
| (raiz de assets/) | `assets/opcoes_fachada.png` | png | 1360x552 | 27.7 | **não** |  | preview/demo | preview/demo/referência; fora da grade 32/16 |
| personagem_principal | `assets/personagem_principal/personagem_principal/exemplos_de_configuracao.json` | json | — | 2 | — |  | metadado | metadado/licença |
| personagem_principal | `assets/personagem_principal/personagem_principal/LEIA-ME.md` | md | — | 1.3 | — |  | metadado | metadado/licença |
| personagem_principal | `assets/personagem_principal/personagem_principal/personagem_principal.json` | json | — | 1.7 | — |  | metadado | metadado/licença |
| personagem_principal | `assets/personagem_principal/personagem_principal/preview_exemplos.png` | png | 1114x542 | 12.6 | **não** |  | preview/demo | preview/demo/referência; fora da grade 32/16 |
| pia | `assets/pia/pia/LEIA-ME.md` | md | — | 0.2 | — |  | metadado | metadado/licença |
| pia | `assets/pia/pia/pia_com_louca.png` | png | 32x32 | 0.5 | sim |  | duplicata/peça solta | quadro solto; o jogo usa pia_sheet |
| pia | `assets/pia/pia/pia_lavando_1.png` | png | 32x32 | 0.6 | sim |  | duplicata/peça solta | quadro solto; o jogo usa pia_sheet |
| pia | `assets/pia/pia/pia_lavando_2.png` | png | 32x32 | 0.6 | sim |  | duplicata/peça solta | quadro solto; o jogo usa pia_sheet |
| pia | `assets/pia/pia/pia_lavando_3.png` | png | 32x32 | 0.6 | sim |  | duplicata/peça solta | quadro solto; o jogo usa pia_sheet |
| pia | `assets/pia/pia/pia_lavando_4.png` | png | 32x32 | 0.6 | sim |  | duplicata/peça solta | quadro solto; o jogo usa pia_sheet |
| pia | `assets/pia/pia/pia_louca_limpa.png` | png | 32x32 | 0.5 | sim |  | duplicata/peça solta | quadro solto; o jogo usa pia_sheet |
| pia | `assets/pia/pia/pia_preview_5x.png` | png | 1120x160 | 3.3 | sim |  | preview/demo | preview/demo/referência |
| pia | `assets/pia/pia/pia_sheet.json` | json | — | 0.2 | — |  | metadado | metadado/licença |
| pia | `assets/pia/pia/pia_sheet.png` | png | 224x32 | 1.6 | sim | 32x32 · 7 | em uso | cópia em public/assets/equipment/pia_sheet.png |
| pia | `assets/pia/pia/pia_vazia.png` | png | 32x32 | 0.4 | sim |  | duplicata/peça solta | quadro solto; o jogo usa pia_sheet |
| quintal_secreto | `assets/quintal_secreto/pack/quintal_secreto/LEIA-ME.md` | md | — | 1.2 | — |  | metadado | metadado/licença |
| quintal_secreto | `assets/quintal_secreto/pack/quintal_secreto/pecas/bancada_forno_pedra.png` | png | 64x64 | 0.5 | sim |  | sem referência | nenhuma referência |
| quintal_secreto | `assets/quintal_secreto/pack/quintal_secreto/pecas/banco_rustico_vasos.png` | png | 64x64 | 0.7 | sim |  | sem referência | nenhuma referência |
| quintal_secreto | `assets/quintal_secreto/pack/quintal_secreto/pecas/banquinho_ceramica.png` | png | 32x32 | 0.3 | sim |  | sem referência | nenhuma referência |
| quintal_secreto | `assets/quintal_secreto/pack/quintal_secreto/pecas/brilho_quente_32.png` | png | 32x32 | 0.7 | sim |  | sem referência | nenhuma referência |
| quintal_secreto | `assets/quintal_secreto/pack/quintal_secreto/pecas/brilho_quente_64.png` | png | 64x64 | 1.7 | sim |  | sem referência | nenhuma referência |
| quintal_secreto | `assets/quintal_secreto/pack/quintal_secreto/pecas/cadeira_vime.png` | png | 32x64 | 0.4 | sim |  | sem referência | nenhuma referência |
| quintal_secreto | `assets/quintal_secreto/pack/quintal_secreto/pecas/espreguicadeira.png` | png | 64x32 | 0.3 | sim |  | sem referência | nenhuma referência |
| quintal_secreto | `assets/quintal_secreto/pack/quintal_secreto/pecas/fundo_ceu_telhados.png` | png | 192x64 | 1 | sim |  | sem referência | nenhuma referência |
| quintal_secreto | `assets/quintal_secreto/pack/quintal_secreto/pecas/grama_a.png` | png | 32x32 | 0.4 | sim |  | sem referência | nenhuma referência |
| quintal_secreto | `assets/quintal_secreto/pack/quintal_secreto/pecas/grama_b.png` | png | 32x32 | 0.4 | sim |  | sem referência | nenhuma referência |
| quintal_secreto | `assets/quintal_secreto/pack/quintal_secreto/pecas/grama_c.png` | png | 32x32 | 0.4 | sim |  | sem referência | nenhuma referência |
| quintal_secreto | `assets/quintal_secreto/pack/quintal_secreto/pecas/lampada_chao.png` | png | 32x32 | 0.2 | sim |  | sem referência | nenhuma referência |
| quintal_secreto | `assets/quintal_secreto/pack/quintal_secreto/pecas/luminaria_parede_sebe.png` | png | 32x32 | 0.2 | sim |  | sem referência | nenhuma referência |
| quintal_secreto | `assets/quintal_secreto/pack/quintal_secreto/pecas/luzinhas_fio.png` | png | 96x32 | 0.4 | sim |  | sem referência | nenhuma referência |
| quintal_secreto | `assets/quintal_secreto/pack/quintal_secreto/pecas/mesa_redonda_branca.png` | png | 64x64 | 0.5 | sim |  | sem referência | nenhuma referência |
| quintal_secreto | `assets/quintal_secreto/pack/quintal_secreto/pecas/pedra_a.png` | png | 32x32 | 0.3 | sim |  | sem referência | nenhuma referência |
| quintal_secreto | `assets/quintal_secreto/pack/quintal_secreto/pecas/pedra_b.png` | png | 32x32 | 0.3 | sim |  | sem referência | nenhuma referência |
| quintal_secreto | `assets/quintal_secreto/pack/quintal_secreto/pecas/pergola_cobertura.png` | png | 96x64 | 0.3 | sim |  | sem referência | nenhuma referência |
| quintal_secreto | `assets/quintal_secreto/pack/quintal_secreto/pecas/sebe_base.png` | png | 32x32 | 0.5 | sim |  | sem referência | nenhuma referência; fora da paleta (55.8% dos px) |
| quintal_secreto | `assets/quintal_secreto/pack/quintal_secreto/pecas/sebe_lateral.png` | png | 32x32 | 0.5 | sim |  | sem referência | nenhuma referência; fora da paleta (66.1% dos px) |
| quintal_secreto | `assets/quintal_secreto/pack/quintal_secreto/pecas/sebe_lateral_topo.png` | png | 32x32 | 0.5 | sim |  | sem referência | nenhuma referência; fora da paleta (67.8% dos px) |
| quintal_secreto | `assets/quintal_secreto/pack/quintal_secreto/pecas/sebe_meio_a.png` | png | 32x32 | 0.5 | sim |  | sem referência | nenhuma referência; fora da paleta (73.6% dos px) |
| quintal_secreto | `assets/quintal_secreto/pack/quintal_secreto/pecas/sebe_meio_b.png` | png | 32x32 | 0.6 | sim |  | sem referência | nenhuma referência; fora da paleta (73.6% dos px) |
| quintal_secreto | `assets/quintal_secreto/pack/quintal_secreto/pecas/sebe_topo.png` | png | 32x32 | 0.6 | sim |  | sem referência | nenhuma referência; fora da paleta (70.8% dos px) |
| quintal_secreto | `assets/quintal_secreto/pack/quintal_secreto/pecas/vaso_arvore_a.png` | png | 32x96 | 0.8 | sim |  | sem referência | nenhuma referência |
| quintal_secreto | `assets/quintal_secreto/pack/quintal_secreto/pecas/vaso_arvore_b.png` | png | 32x96 | 0.8 | sim |  | sem referência | nenhuma referência |
| quintal_secreto | `assets/quintal_secreto/pack/quintal_secreto/pecas/vaso_baixo_flores.png` | png | 32x32 | 0.3 | sim |  | sem referência | nenhuma referência |
| quintal_secreto | `assets/quintal_secreto/pack/quintal_secreto/quintal_secreto_dia.png` | png | 704x416 | 32.4 | sim |  | sem referência | nenhuma referência; cantos opacos: fundo não transparente? |
| quintal_secreto | `assets/quintal_secreto/pack/quintal_secreto/quintal_secreto_entardecer.png` | png | 704x416 | 48.8 | sim |  | sem referência | nenhuma referência; cantos opacos: fundo não transparente?; fora da paleta (28.1% dos px) |
| quintal_secreto | `assets/quintal_secreto/pack/quintal_secreto/quintal_secreto_pecas_rotulado.png` | png | 1100x508 | 29.3 | **não** |  | preview/demo | preview/demo/referência; fora da grade 32/16 |
| quintal_secreto | `assets/quintal_secreto/pack/quintal_secreto/quintal_secreto_tileset.json` | json | — | 2.3 | — |  | metadado | metadado/licença |
| quintal_secreto | `assets/quintal_secreto/pack/quintal_secreto/quintal_secreto_tileset.png` | png | 512x224 | 11.4 | sim | grade 32 · 16x7 | sem referência | nenhuma referência |
| quintal_secreto | `assets/quintal_secreto/pack/quintal_secreto/variante_tijolo/pecas/arbusto_lima.png` | png | 32x32 | 0.5 | sim |  | sem referência | nenhuma referência; fora da paleta (89% dos px) |
| quintal_secreto | `assets/quintal_secreto/pack/quintal_secreto/variante_tijolo/pecas/arvore_grande_a.png` | png | 96x128 | 1.8 | sim |  | sem referência | nenhuma referência |
| quintal_secreto | `assets/quintal_secreto/pack/quintal_secreto/variante_tijolo/pecas/arvore_grande_b.png` | png | 96x128 | 1.9 | sim |  | sem referência | nenhuma referência |
| quintal_secreto | `assets/quintal_secreto/pack/quintal_secreto/variante_tijolo/pecas/canteiro_azul.png` | png | 32x48 | 0.6 | **não** |  | sem referência | nenhuma referência; fora da grade 32 (múltiplo de 16) |
| quintal_secreto | `assets/quintal_secreto/pack/quintal_secreto/variante_tijolo/pecas/dracena_espinhosa.png` | png | 64x64 | 0.8 | sim |  | sem referência | nenhuma referência; fora da paleta (41.9% dos px) |
| quintal_secreto | `assets/quintal_secreto/pack/quintal_secreto/variante_tijolo/pecas/grama_a.png` | png | 32x32 | 0.5 | sim |  | sem referência | nenhuma referência |
| quintal_secreto | `assets/quintal_secreto/pack/quintal_secreto/variante_tijolo/pecas/grama_b.png` | png | 32x32 | 0.5 | sim |  | sem referência | nenhuma referência |
| quintal_secreto | `assets/quintal_secreto/pack/quintal_secreto/variante_tijolo/pecas/janela_lua.png` | png | 64x64 | 0.7 | sim |  | sem referência | nenhuma referência |
| quintal_secreto | `assets/quintal_secreto/pack/quintal_secreto/variante_tijolo/pecas/pedra_irregular_a.png` | png | 32x32 | 0.3 | sim |  | sem referência | nenhuma referência |
| quintal_secreto | `assets/quintal_secreto/pack/quintal_secreto/variante_tijolo/pecas/pedra_irregular_b.png` | png | 32x32 | 0.3 | sim |  | sem referência | nenhuma referência |
| quintal_secreto | `assets/quintal_secreto/pack/quintal_secreto/variante_tijolo/pecas/pedra_irregular_c.png` | png | 32x32 | 0.4 | sim |  | sem referência | nenhuma referência |
| quintal_secreto | `assets/quintal_secreto/pack/quintal_secreto/variante_tijolo/pecas/pilar_branco.png` | png | 32x96 | 0.5 | sim |  | sem referência | nenhuma referência |
| quintal_secreto | `assets/quintal_secreto/pack/quintal_secreto/variante_tijolo/pecas/raios_de_sol.png` | png | 192x128 | 0.8 | sim |  | sem referência | nenhuma referência; pixel 2x (densidade diferente) |
| quintal_secreto | `assets/quintal_secreto/pack/quintal_secreto/variante_tijolo/pecas/sebe_aparada_escura.png` | png | 32x48 | 0.6 | **não** |  | sem referência | nenhuma referência; fora da grade 32 (múltiplo de 16) |
| quintal_secreto | `assets/quintal_secreto/pack/quintal_secreto/variante_tijolo/pecas/sebe_aparada_verde.png` | png | 32x48 | 0.6 | **não** |  | sem referência | nenhuma referência; fora da grade 32 (múltiplo de 16) |
| quintal_secreto | `assets/quintal_secreto/pack/quintal_secreto/variante_tijolo/pecas/sebe_baixa_lima.png` | png | 32x48 | 0.5 | **não** |  | sem referência | nenhuma referência; fora da grade 32 (múltiplo de 16); fora da paleta (89.1% dos px) |
| quintal_secreto | `assets/quintal_secreto/pack/quintal_secreto/variante_tijolo/pecas/tijolo_base.png` | png | 32x32 | 0.2 | sim |  | sem referência | nenhuma referência |
| quintal_secreto | `assets/quintal_secreto/pack/quintal_secreto/variante_tijolo/pecas/tijolo_meio_a.png` | png | 32x32 | 0.2 | sim |  | sem referência | nenhuma referência |
| quintal_secreto | `assets/quintal_secreto/pack/quintal_secreto/variante_tijolo/pecas/tijolo_meio_b.png` | png | 32x32 | 0.2 | sim |  | sem referência | nenhuma referência |
| quintal_secreto | `assets/quintal_secreto/pack/quintal_secreto/variante_tijolo/pecas/tijolo_topo.png` | png | 32x32 | 0.2 | sim |  | sem referência | nenhuma referência |
| quintal_secreto | `assets/quintal_secreto/pack/quintal_secreto/variante_tijolo/pecas/topiaria_redonda.png` | png | 64x64 | 1 | sim |  | sem referência | nenhuma referência |
| quintal_secreto | `assets/quintal_secreto/pack/quintal_secreto/variante_tijolo/pecas/topiaria_redonda_b.png` | png | 64x64 | 1 | sim |  | sem referência | nenhuma referência |
| quintal_secreto | `assets/quintal_secreto/pack/quintal_secreto/variante_tijolo/pecas/vaso_parede.png` | png | 32x32 | 0.3 | sim |  | sem referência | nenhuma referência |
| quintal_secreto | `assets/quintal_secreto/pack/quintal_secreto/variante_tijolo/pedra_autotile47.json` | json | — | 0.7 | — |  | metadado | metadado/licença |
| quintal_secreto | `assets/quintal_secreto/pack/quintal_secreto/variante_tijolo/pedra_irregular_sobre_grama_autotile47.png` | png | 256x192 | 7.1 | sim | 32x32 · autotile 47 (8x6) | sem referência | nenhuma referência |
| quintal_secreto | `assets/quintal_secreto/pack/quintal_secreto/variante_tijolo/quintal_tijolo_dia.png` | png | 704x416 | 39.5 | sim |  | sem referência | nenhuma referência |
| quintal_secreto | `assets/quintal_secreto/pack/quintal_secreto/variante_tijolo/quintal_tijolo_dia_2x.png` | png | 1408x832 | 61.2 | sim |  | preview/demo | preview/demo/referência |
| quintal_secreto | `assets/quintal_secreto/pack/quintal_secreto/variante_tijolo/quintal_tijolo_pecas_rotulado.png` | png | 1100x636 | 32.9 | **não** |  | preview/demo | preview/demo/referência; fora da grade 32/16 |
| rua_estacoes_tilesets | `assets/rua_estacoes_tilesets/pack/autumn/door_frames/shop_door_ceu_3frames.png` | png | 96x104 | 0.9 | **não** | 32x104 · 3 | duplicata/peça solta | versão solta da pasta da estação; o jogo usa pack/tilesets/; fora da grade 32/16 |
| rua_estacoes_tilesets | `assets/rua_estacoes_tilesets/pack/autumn/door_frames/shop_door_menta_3frames.png` | png | 96x104 | 1 | **não** | 32x104 · 3 | duplicata/peça solta | versão solta da pasta da estação; o jogo usa pack/tilesets/; fora da grade 32/16 |
| rua_estacoes_tilesets | `assets/rua_estacoes_tilesets/pack/autumn/door_frames/shop_door_rosa_3frames.png` | png | 96x104 | 1 | **não** | 32x104 · 3 | duplicata/peça solta | versão solta da pasta da estação; o jogo usa pack/tilesets/; fora da grade 32/16 |
| rua_estacoes_tilesets | `assets/rua_estacoes_tilesets/pack/autumn/facades/furniture_shop.png` | png | 192x256 | 5.1 | sim | grade 32 · 6x8 | duplicata/peça solta | versão solta da pasta da estação; o jogo usa pack/tilesets/ |
| rua_estacoes_tilesets | `assets/rua_estacoes_tilesets/pack/autumn/facades/house_a.png` | png | 128x256 | 4.6 | sim | 32x64 · 4x4 (16) | duplicata/peça solta | versão solta da pasta da estação; o jogo usa pack/tilesets/ |
| rua_estacoes_tilesets | `assets/rua_estacoes_tilesets/pack/autumn/facades/house_b.png` | png | 128x256 | 3.7 | sim | 32x64 · 4x4 (16) | duplicata/peça solta | versão solta da pasta da estação; o jogo usa pack/tilesets/ |
| rua_estacoes_tilesets | `assets/rua_estacoes_tilesets/pack/autumn/facades/house_c.png` | png | 128x256 | 4.7 | sim | 32x64 · 4x4 (16) | duplicata/peça solta | versão solta da pasta da estação; o jogo usa pack/tilesets/ |
| rua_estacoes_tilesets | `assets/rua_estacoes_tilesets/pack/autumn/facades/market.png` | png | 224x256 | 6.8 | sim | grade 32 · 7x8 | duplicata/peça solta | versão solta da pasta da estação; o jogo usa pack/tilesets/ |
| rua_estacoes_tilesets | `assets/rua_estacoes_tilesets/pack/autumn/facades/shop_ceu.png` | png | 160x256 | 4.6 | sim | grade 32 · 5x8 | duplicata/peça solta | versão solta da pasta da estação; o jogo usa pack/tilesets/ |
| rua_estacoes_tilesets | `assets/rua_estacoes_tilesets/pack/autumn/facades/shop_menta.png` | png | 160x256 | 4.7 | sim | grade 32 · 5x8 | duplicata/peça solta | versão solta da pasta da estação; o jogo usa pack/tilesets/ |
| rua_estacoes_tilesets | `assets/rua_estacoes_tilesets/pack/autumn/facades/shop_rosa.png` | png | 160x256 | 4.6 | sim | grade 32 · 5x8 | duplicata/peça solta | versão solta da pasta da estação; o jogo usa pack/tilesets/ |
| rua_estacoes_tilesets | `assets/rua_estacoes_tilesets/pack/autumn/preview/opcoes_fachada_autumn.png` | png | 1024x536 | 15.5 | **não** | grade 32 · 32x16 | preview/demo | preview/demo/referência; fora da grade 32/16 |
| rua_estacoes_tilesets | `assets/rua_estacoes_tilesets/pack/autumn/preview/rua_autumn_ceu_2x.png` | png | 1920x704 | 69.5 | sim | grade 32 · 60x22 | preview/demo | preview/demo/referência |
| rua_estacoes_tilesets | `assets/rua_estacoes_tilesets/pack/autumn/preview/rua_autumn_menta_2x.png` | png | 1920x704 | 69.5 | sim | grade 32 · 60x22 | preview/demo | preview/demo/referência |
| rua_estacoes_tilesets | `assets/rua_estacoes_tilesets/pack/autumn/preview/rua_autumn_rosa_2x.png` | png | 1920x704 | 69.4 | sim | grade 32 · 60x22 | preview/demo | preview/demo/referência |
| rua_estacoes_tilesets | `assets/rua_estacoes_tilesets/pack/autumn/props/bench.png` | png | 64x40 | 0.3 | **não** | grade 32 · 2x1 | duplicata/peça solta | versão solta da pasta da estação; o jogo usa pack/tilesets/; fora da grade 32/16 |
| rua_estacoes_tilesets | `assets/rua_estacoes_tilesets/pack/autumn/props/bin.png` | png | 32x32 | 0.2 | sim |  | duplicata/peça solta | versão solta da pasta da estação; o jogo usa pack/tilesets/ |
| rua_estacoes_tilesets | `assets/rua_estacoes_tilesets/pack/autumn/props/chalkboard_cafe.png` | png | 32x48 | 0.4 | **não** |  | duplicata/peça solta | versão solta da pasta da estação; o jogo usa pack/tilesets/; fora da grade 32 (múltiplo de 16) |
| rua_estacoes_tilesets | `assets/rua_estacoes_tilesets/pack/autumn/props/crate_apples.png` | png | 32x32 | 0.2 | sim |  | duplicata/peça solta | versão solta da pasta da estação; o jogo usa pack/tilesets/ |
| rua_estacoes_tilesets | `assets/rua_estacoes_tilesets/pack/autumn/props/crate_oranges.png` | png | 32x32 | 0.2 | sim |  | duplicata/peça solta | versão solta da pasta da estação; o jogo usa pack/tilesets/ |
| rua_estacoes_tilesets | `assets/rua_estacoes_tilesets/pack/autumn/props/ground_cover.png` | png | 32x32 | 0.5 | sim |  | duplicata/peça solta | versão solta da pasta da estação; o jogo usa pack/tilesets/; fora da paleta (25.4% dos px) |
| rua_estacoes_tilesets | `assets/rua_estacoes_tilesets/pack/autumn/props/lamp_post.png` | png | 64x128 | 0.9 | sim | grade 32 · 2x4 | duplicata/peça solta | versão solta da pasta da estação; o jogo usa pack/tilesets/ |
| rua_estacoes_tilesets | `assets/rua_estacoes_tilesets/pack/autumn/props/mailbox.png` | png | 32x48 | 0.3 | **não** |  | duplicata/peça solta | versão solta da pasta da estação; o jogo usa pack/tilesets/; fora da grade 32 (múltiplo de 16) |
| rua_estacoes_tilesets | `assets/rua_estacoes_tilesets/pack/autumn/props/overlay_particles.png` | png | 128x128 | 0.7 | sim | grade 32 · 4x4 | duplicata/peça solta | versão solta da pasta da estação; o jogo usa pack/tilesets/ |
| rua_estacoes_tilesets | `assets/rua_estacoes_tilesets/pack/autumn/props/parasol_table.png` | png | 57x75 | 0.7 | **não** |  | duplicata/peça solta | versão solta da pasta da estação; o jogo usa pack/tilesets/; fora da grade 32/16 |
| rua_estacoes_tilesets | `assets/rua_estacoes_tilesets/pack/autumn/props/planter.png` | png | 32x32 | 0.4 | sim |  | duplicata/peça solta | versão solta da pasta da estação; o jogo usa pack/tilesets/ |
| rua_estacoes_tilesets | `assets/rua_estacoes_tilesets/pack/autumn/props/props_atlas.json` | json | — | 1 | — |  | metadado | metadado/licença |
| rua_estacoes_tilesets | `assets/rua_estacoes_tilesets/pack/autumn/props/props_atlas.png` | png | 256x304 | 6.3 | **não** | grade 32 · 8x9 | duplicata/peça solta | versão solta da pasta da estação; o jogo usa pack/tilesets/; fora da grade 32 (múltiplo de 16) |
| rua_estacoes_tilesets | `assets/rua_estacoes_tilesets/pack/autumn/props/pumpkins.png` | png | 32x32 | 0.3 | sim |  | duplicata/peça solta | versão solta da pasta da estação; o jogo usa pack/tilesets/ |
| rua_estacoes_tilesets | `assets/rua_estacoes_tilesets/pack/autumn/props/terrace_table.png` | png | 52x28 | 0.4 | **não** |  | duplicata/peça solta | versão solta da pasta da estação; o jogo usa pack/tilesets/; fora da grade 32/16 |
| rua_estacoes_tilesets | `assets/rua_estacoes_tilesets/pack/autumn/props/tree.png` | png | 64x96 | 1.3 | sim | grade 32 · 2x3 | duplicata/peça solta | versão solta da pasta da estação; o jogo usa pack/tilesets/ |
| rua_estacoes_tilesets | `assets/rua_estacoes_tilesets/pack/autumn/scenes/rua_autumn_ceu.png` | png | 960x352 | 48 | sim | grade 32 · 30x11 | preview/demo | preview/demo/referência |
| rua_estacoes_tilesets | `assets/rua_estacoes_tilesets/pack/autumn/scenes/rua_autumn_menta.png` | png | 960x352 | 48 | sim | grade 32 · 30x11 | preview/demo | preview/demo/referência |
| rua_estacoes_tilesets | `assets/rua_estacoes_tilesets/pack/autumn/scenes/rua_autumn_rosa.png` | png | 960x352 | 47.9 | sim | grade 32 · 30x11 | preview/demo | preview/demo/referência |
| rua_estacoes_tilesets | `assets/rua_estacoes_tilesets/pack/autumn/tiles/ground_tiles.csv` | csv | — | 0.3 | — |  | metadado | metadado/licença |
| rua_estacoes_tilesets | `assets/rua_estacoes_tilesets/pack/autumn/tiles/ground_tileset.png` | png | 256x64 | 4.2 | sim | grade 32 · 8x2 | duplicata/peça solta | versão solta da pasta da estação; o jogo usa pack/tilesets/ |
| rua_estacoes_tilesets | `assets/rua_estacoes_tilesets/pack/estacoes_menta.png` | png | 960x1438 | 189.4 | **não** | grade 32 · 30x44 | preview/demo | preview/demo/referência; fora da grade 32/16 |
| rua_estacoes_tilesets | `assets/rua_estacoes_tilesets/pack/LEIA-ME.md` | md | — | 1.2 | — |  | metadado | metadado/licença |
| rua_estacoes_tilesets | `assets/rua_estacoes_tilesets/pack/rua_layout.json` | json | — | 0.6 | — |  | metadado | metadado/licença |
| rua_estacoes_tilesets | `assets/rua_estacoes_tilesets/pack/spring/door_frames/shop_door_ceu_3frames.png` | png | 96x104 | 0.9 | **não** | 32x104 · 3 | duplicata/peça solta | versão solta da pasta da estação; o jogo usa pack/tilesets/; fora da grade 32/16 |
| rua_estacoes_tilesets | `assets/rua_estacoes_tilesets/pack/spring/door_frames/shop_door_menta_3frames.png` | png | 96x104 | 0.9 | **não** | 32x104 · 3 | duplicata/peça solta | versão solta da pasta da estação; o jogo usa pack/tilesets/; fora da grade 32/16 |
| rua_estacoes_tilesets | `assets/rua_estacoes_tilesets/pack/spring/door_frames/shop_door_rosa_3frames.png` | png | 96x104 | 1 | **não** | 32x104 · 3 | duplicata/peça solta | versão solta da pasta da estação; o jogo usa pack/tilesets/; fora da grade 32/16 |
| rua_estacoes_tilesets | `assets/rua_estacoes_tilesets/pack/spring/facades/furniture_shop.png` | png | 192x256 | 5.4 | sim | grade 32 · 6x8 | duplicata/peça solta | versão solta da pasta da estação; o jogo usa pack/tilesets/ |
| rua_estacoes_tilesets | `assets/rua_estacoes_tilesets/pack/spring/facades/house_a.png` | png | 128x256 | 4.8 | sim | 32x64 · 4x4 (16) | duplicata/peça solta | versão solta da pasta da estação; o jogo usa pack/tilesets/ |
| rua_estacoes_tilesets | `assets/rua_estacoes_tilesets/pack/spring/facades/house_b.png` | png | 128x256 | 3.7 | sim | 32x64 · 4x4 (16) | duplicata/peça solta | versão solta da pasta da estação; o jogo usa pack/tilesets/ |
| rua_estacoes_tilesets | `assets/rua_estacoes_tilesets/pack/spring/facades/house_c.png` | png | 128x256 | 4.8 | sim | 32x64 · 4x4 (16) | duplicata/peça solta | versão solta da pasta da estação; o jogo usa pack/tilesets/ |
| rua_estacoes_tilesets | `assets/rua_estacoes_tilesets/pack/spring/facades/market.png` | png | 224x256 | 7 | sim | grade 32 · 7x8 | duplicata/peça solta | versão solta da pasta da estação; o jogo usa pack/tilesets/ |
| rua_estacoes_tilesets | `assets/rua_estacoes_tilesets/pack/spring/facades/shop_ceu.png` | png | 160x256 | 4.8 | sim | grade 32 · 5x8 | duplicata/peça solta | versão solta da pasta da estação; o jogo usa pack/tilesets/ |
| rua_estacoes_tilesets | `assets/rua_estacoes_tilesets/pack/spring/facades/shop_menta.png` | png | 160x256 | 4.8 | sim | grade 32 · 5x8 | duplicata/peça solta | versão solta da pasta da estação; o jogo usa pack/tilesets/ |
| rua_estacoes_tilesets | `assets/rua_estacoes_tilesets/pack/spring/facades/shop_rosa.png` | png | 160x256 | 4.8 | sim | grade 32 · 5x8 | duplicata/peça solta | versão solta da pasta da estação; o jogo usa pack/tilesets/ |
| rua_estacoes_tilesets | `assets/rua_estacoes_tilesets/pack/spring/preview/opcoes_fachada_spring.png` | png | 1024x536 | 15.9 | **não** | grade 32 · 32x16 | preview/demo | preview/demo/referência; fora da grade 32/16 |
| rua_estacoes_tilesets | `assets/rua_estacoes_tilesets/pack/spring/preview/rua_spring_ceu_2x.png` | png | 1920x704 | 69.2 | sim | grade 32 · 60x22 | preview/demo | preview/demo/referência |
| rua_estacoes_tilesets | `assets/rua_estacoes_tilesets/pack/spring/preview/rua_spring_menta_2x.png` | png | 1920x704 | 68.8 | sim | grade 32 · 60x22 | preview/demo | preview/demo/referência |
| rua_estacoes_tilesets | `assets/rua_estacoes_tilesets/pack/spring/preview/rua_spring_rosa_2x.png` | png | 1920x704 | 68.6 | sim | grade 32 · 60x22 | preview/demo | preview/demo/referência |
| rua_estacoes_tilesets | `assets/rua_estacoes_tilesets/pack/spring/props/bench.png` | png | 64x40 | 0.3 | **não** | grade 32 · 2x1 | duplicata/peça solta | versão solta da pasta da estação; o jogo usa pack/tilesets/; fora da grade 32/16 |
| rua_estacoes_tilesets | `assets/rua_estacoes_tilesets/pack/spring/props/bin.png` | png | 32x32 | 0.2 | sim |  | duplicata/peça solta | versão solta da pasta da estação; o jogo usa pack/tilesets/ |
| rua_estacoes_tilesets | `assets/rua_estacoes_tilesets/pack/spring/props/chalkboard_cafe.png` | png | 32x48 | 0.4 | **não** |  | duplicata/peça solta | versão solta da pasta da estação; o jogo usa pack/tilesets/; fora da grade 32 (múltiplo de 16) |
| rua_estacoes_tilesets | `assets/rua_estacoes_tilesets/pack/spring/props/crate_apples.png` | png | 32x32 | 0.2 | sim |  | duplicata/peça solta | versão solta da pasta da estação; o jogo usa pack/tilesets/ |
| rua_estacoes_tilesets | `assets/rua_estacoes_tilesets/pack/spring/props/crate_oranges.png` | png | 32x32 | 0.2 | sim |  | duplicata/peça solta | versão solta da pasta da estação; o jogo usa pack/tilesets/ |
| rua_estacoes_tilesets | `assets/rua_estacoes_tilesets/pack/spring/props/ground_cover.png` | png | 32x32 | 0.3 | sim |  | duplicata/peça solta | versão solta da pasta da estação; o jogo usa pack/tilesets/ |
| rua_estacoes_tilesets | `assets/rua_estacoes_tilesets/pack/spring/props/lamp_post.png` | png | 64x128 | 0.9 | sim | grade 32 · 2x4 | duplicata/peça solta | versão solta da pasta da estação; o jogo usa pack/tilesets/ |
| rua_estacoes_tilesets | `assets/rua_estacoes_tilesets/pack/spring/props/mailbox.png` | png | 32x48 | 0.3 | **não** |  | duplicata/peça solta | versão solta da pasta da estação; o jogo usa pack/tilesets/; fora da grade 32 (múltiplo de 16) |
| rua_estacoes_tilesets | `assets/rua_estacoes_tilesets/pack/spring/props/overlay_particles.png` | png | 128x128 | 0.5 | sim | grade 32 · 4x4 | duplicata/peça solta | versão solta da pasta da estação; o jogo usa pack/tilesets/ |
| rua_estacoes_tilesets | `assets/rua_estacoes_tilesets/pack/spring/props/parasol_table.png` | png | 57x75 | 0.7 | **não** |  | duplicata/peça solta | versão solta da pasta da estação; o jogo usa pack/tilesets/; fora da grade 32/16 |
| rua_estacoes_tilesets | `assets/rua_estacoes_tilesets/pack/spring/props/planter.png` | png | 32x32 | 0.4 | sim |  | duplicata/peça solta | versão solta da pasta da estação; o jogo usa pack/tilesets/ |
| rua_estacoes_tilesets | `assets/rua_estacoes_tilesets/pack/spring/props/props_atlas.json` | json | — | 1 | — |  | metadado | metadado/licença |
| rua_estacoes_tilesets | `assets/rua_estacoes_tilesets/pack/spring/props/props_atlas.png` | png | 256x304 | 5.6 | **não** | grade 32 · 8x9 | duplicata/peça solta | versão solta da pasta da estação; o jogo usa pack/tilesets/; fora da grade 32 (múltiplo de 16) |
| rua_estacoes_tilesets | `assets/rua_estacoes_tilesets/pack/spring/props/terrace_table.png` | png | 52x28 | 0.4 | **não** |  | duplicata/peça solta | versão solta da pasta da estação; o jogo usa pack/tilesets/; fora da grade 32/16 |
| rua_estacoes_tilesets | `assets/rua_estacoes_tilesets/pack/spring/props/tree.png` | png | 64x96 | 1.3 | sim | grade 32 · 2x3 | duplicata/peça solta | versão solta da pasta da estação; o jogo usa pack/tilesets/ |
| rua_estacoes_tilesets | `assets/rua_estacoes_tilesets/pack/spring/scenes/rua_spring_ceu.png` | png | 960x352 | 47.9 | sim | grade 32 · 30x11 | preview/demo | preview/demo/referência |
| rua_estacoes_tilesets | `assets/rua_estacoes_tilesets/pack/spring/scenes/rua_spring_menta.png` | png | 960x352 | 47.8 | sim | grade 32 · 30x11 | preview/demo | preview/demo/referência |
| rua_estacoes_tilesets | `assets/rua_estacoes_tilesets/pack/spring/scenes/rua_spring_rosa.png` | png | 960x352 | 47.5 | sim | grade 32 · 30x11 | preview/demo | preview/demo/referência |
| rua_estacoes_tilesets | `assets/rua_estacoes_tilesets/pack/spring/tiles/ground_tiles.csv` | csv | — | 0.3 | — |  | metadado | metadado/licença |
| rua_estacoes_tilesets | `assets/rua_estacoes_tilesets/pack/spring/tiles/ground_tileset.png` | png | 256x64 | 3.9 | sim | grade 32 · 8x2 | duplicata/peça solta | versão solta da pasta da estação; o jogo usa pack/tilesets/ |
| rua_estacoes_tilesets | `assets/rua_estacoes_tilesets/pack/summer/door_frames/shop_door_ceu_3frames.png` | png | 96x104 | 0.9 | **não** | 32x104 · 3 | duplicata/peça solta | versão solta da pasta da estação; o jogo usa pack/tilesets/; fora da grade 32/16 |
| rua_estacoes_tilesets | `assets/rua_estacoes_tilesets/pack/summer/door_frames/shop_door_menta_3frames.png` | png | 96x104 | 0.9 | **não** | 32x104 · 3 | duplicata/peça solta | versão solta da pasta da estação; o jogo usa pack/tilesets/; fora da grade 32/16 |
| rua_estacoes_tilesets | `assets/rua_estacoes_tilesets/pack/summer/door_frames/shop_door_rosa_3frames.png` | png | 96x104 | 0.9 | **não** | 32x104 · 3 | duplicata/peça solta | versão solta da pasta da estação; o jogo usa pack/tilesets/; fora da grade 32/16 |
| rua_estacoes_tilesets | `assets/rua_estacoes_tilesets/pack/summer/facades/furniture_shop.png` | png | 192x256 | 5.3 | sim | grade 32 · 6x8 | duplicata/peça solta | versão solta da pasta da estação; o jogo usa pack/tilesets/ |
| rua_estacoes_tilesets | `assets/rua_estacoes_tilesets/pack/summer/facades/house_a.png` | png | 128x256 | 4.7 | sim | 32x64 · 4x4 (16) | duplicata/peça solta | versão solta da pasta da estação; o jogo usa pack/tilesets/ |
| rua_estacoes_tilesets | `assets/rua_estacoes_tilesets/pack/summer/facades/house_b.png` | png | 128x256 | 3.7 | sim | 32x64 · 4x4 (16) | duplicata/peça solta | versão solta da pasta da estação; o jogo usa pack/tilesets/ |
| rua_estacoes_tilesets | `assets/rua_estacoes_tilesets/pack/summer/facades/house_c.png` | png | 128x256 | 4.8 | sim | 32x64 · 4x4 (16) | duplicata/peça solta | versão solta da pasta da estação; o jogo usa pack/tilesets/ |
| rua_estacoes_tilesets | `assets/rua_estacoes_tilesets/pack/summer/facades/market.png` | png | 224x256 | 6.9 | sim | grade 32 · 7x8 | duplicata/peça solta | versão solta da pasta da estação; o jogo usa pack/tilesets/ |
| rua_estacoes_tilesets | `assets/rua_estacoes_tilesets/pack/summer/facades/shop_ceu.png` | png | 160x256 | 4.8 | sim | grade 32 · 5x8 | duplicata/peça solta | versão solta da pasta da estação; o jogo usa pack/tilesets/ |
| rua_estacoes_tilesets | `assets/rua_estacoes_tilesets/pack/summer/facades/shop_menta.png` | png | 160x256 | 4.8 | sim | grade 32 · 5x8 | duplicata/peça solta | versão solta da pasta da estação; o jogo usa pack/tilesets/ |
| rua_estacoes_tilesets | `assets/rua_estacoes_tilesets/pack/summer/facades/shop_rosa.png` | png | 160x256 | 4.8 | sim | grade 32 · 5x8 | duplicata/peça solta | versão solta da pasta da estação; o jogo usa pack/tilesets/ |
| rua_estacoes_tilesets | `assets/rua_estacoes_tilesets/pack/summer/preview/opcoes_fachada_summer.png` | png | 1024x536 | 16 | **não** | grade 32 · 32x16 | preview/demo | preview/demo/referência; fora da grade 32/16 |
| rua_estacoes_tilesets | `assets/rua_estacoes_tilesets/pack/summer/preview/rua_summer_ceu_2x.png` | png | 1920x704 | 64.8 | sim | grade 32 · 60x22 | preview/demo | preview/demo/referência |
| rua_estacoes_tilesets | `assets/rua_estacoes_tilesets/pack/summer/preview/rua_summer_menta_2x.png` | png | 1920x704 | 64.8 | sim | grade 32 · 60x22 | preview/demo | preview/demo/referência |
| rua_estacoes_tilesets | `assets/rua_estacoes_tilesets/pack/summer/preview/rua_summer_rosa_2x.png` | png | 1920x704 | 64.8 | sim | grade 32 · 60x22 | preview/demo | preview/demo/referência |
| rua_estacoes_tilesets | `assets/rua_estacoes_tilesets/pack/summer/props/bench.png` | png | 64x40 | 0.3 | **não** | grade 32 · 2x1 | duplicata/peça solta | versão solta da pasta da estação; o jogo usa pack/tilesets/; fora da grade 32/16 |
| rua_estacoes_tilesets | `assets/rua_estacoes_tilesets/pack/summer/props/bin.png` | png | 32x32 | 0.2 | sim |  | duplicata/peça solta | versão solta da pasta da estação; o jogo usa pack/tilesets/ |
| rua_estacoes_tilesets | `assets/rua_estacoes_tilesets/pack/summer/props/chalkboard_cafe.png` | png | 32x48 | 0.4 | **não** |  | duplicata/peça solta | versão solta da pasta da estação; o jogo usa pack/tilesets/; fora da grade 32 (múltiplo de 16) |
| rua_estacoes_tilesets | `assets/rua_estacoes_tilesets/pack/summer/props/crate_apples.png` | png | 32x32 | 0.2 | sim |  | duplicata/peça solta | versão solta da pasta da estação; o jogo usa pack/tilesets/ |
| rua_estacoes_tilesets | `assets/rua_estacoes_tilesets/pack/summer/props/crate_oranges.png` | png | 32x32 | 0.2 | sim |  | duplicata/peça solta | versão solta da pasta da estação; o jogo usa pack/tilesets/ |
| rua_estacoes_tilesets | `assets/rua_estacoes_tilesets/pack/summer/props/ground_cover.png` | png | 32x32 | 0.3 | sim |  | duplicata/peça solta | versão solta da pasta da estação; o jogo usa pack/tilesets/ |
| rua_estacoes_tilesets | `assets/rua_estacoes_tilesets/pack/summer/props/lamp_post.png` | png | 64x128 | 0.9 | sim | grade 32 · 2x4 | duplicata/peça solta | versão solta da pasta da estação; o jogo usa pack/tilesets/ |
| rua_estacoes_tilesets | `assets/rua_estacoes_tilesets/pack/summer/props/mailbox.png` | png | 32x48 | 0.3 | **não** |  | duplicata/peça solta | versão solta da pasta da estação; o jogo usa pack/tilesets/; fora da grade 32 (múltiplo de 16) |
| rua_estacoes_tilesets | `assets/rua_estacoes_tilesets/pack/summer/props/overlay_particles.png` | png | 128x128 | 0.3 | sim | grade 32 · 4x4 | duplicata/peça solta | versão solta da pasta da estação; o jogo usa pack/tilesets/ |
| rua_estacoes_tilesets | `assets/rua_estacoes_tilesets/pack/summer/props/parasol_table.png` | png | 57x75 | 0.7 | **não** |  | duplicata/peça solta | versão solta da pasta da estação; o jogo usa pack/tilesets/; fora da grade 32/16 |
| rua_estacoes_tilesets | `assets/rua_estacoes_tilesets/pack/summer/props/planter.png` | png | 32x32 | 0.3 | sim |  | duplicata/peça solta | versão solta da pasta da estação; o jogo usa pack/tilesets/ |
| rua_estacoes_tilesets | `assets/rua_estacoes_tilesets/pack/summer/props/props_atlas.json` | json | — | 1 | — |  | metadado | metadado/licença |
| rua_estacoes_tilesets | `assets/rua_estacoes_tilesets/pack/summer/props/props_atlas.png` | png | 256x304 | 5.2 | **não** | grade 32 · 8x9 | duplicata/peça solta | versão solta da pasta da estação; o jogo usa pack/tilesets/; fora da grade 32 (múltiplo de 16) |
| rua_estacoes_tilesets | `assets/rua_estacoes_tilesets/pack/summer/props/terrace_table.png` | png | 52x28 | 0.4 | **não** |  | duplicata/peça solta | versão solta da pasta da estação; o jogo usa pack/tilesets/; fora da grade 32/16 |
| rua_estacoes_tilesets | `assets/rua_estacoes_tilesets/pack/summer/props/tree.png` | png | 64x96 | 1.2 | sim | grade 32 · 2x3 | duplicata/peça solta | versão solta da pasta da estação; o jogo usa pack/tilesets/ |
| rua_estacoes_tilesets | `assets/rua_estacoes_tilesets/pack/summer/scenes/rua_summer_ceu.png` | png | 960x352 | 44.5 | sim | grade 32 · 30x11 | preview/demo | preview/demo/referência |
| rua_estacoes_tilesets | `assets/rua_estacoes_tilesets/pack/summer/scenes/rua_summer_menta.png` | png | 960x352 | 44.6 | sim | grade 32 · 30x11 | preview/demo | preview/demo/referência |
| rua_estacoes_tilesets | `assets/rua_estacoes_tilesets/pack/summer/scenes/rua_summer_rosa.png` | png | 960x352 | 44.6 | sim | grade 32 · 30x11 | preview/demo | preview/demo/referência |
| rua_estacoes_tilesets | `assets/rua_estacoes_tilesets/pack/summer/tiles/ground_tiles.csv` | csv | — | 0.3 | — |  | metadado | metadado/licença |
| rua_estacoes_tilesets | `assets/rua_estacoes_tilesets/pack/summer/tiles/ground_tileset.png` | png | 256x64 | 3.5 | sim | grade 32 · 8x2 | duplicata/peça solta | versão solta da pasta da estação; o jogo usa pack/tilesets/ |
| rua_estacoes_tilesets | `assets/rua_estacoes_tilesets/pack/tilesets/chao_autumn.json` | json | — | 1.3 | — |  | metadado | metadado/licença |
| rua_estacoes_tilesets | `assets/rua_estacoes_tilesets/pack/tilesets/chao_autumn.png` | png | 256x64 | 4.2 | sim | grade 32 · 8x2 | sem referência | estação ainda não usada (Fase 2/3) |
| rua_estacoes_tilesets | `assets/rua_estacoes_tilesets/pack/tilesets/chao_autumn_rotulado.png` | png | 512x128 | 10.7 | sim | grade 32 · 16x4 | preview/demo | preview/demo/referência |
| rua_estacoes_tilesets | `assets/rua_estacoes_tilesets/pack/tilesets/chao_spring.json` | json | — | 1.3 | — |  | metadado | metadado/licença |
| rua_estacoes_tilesets | `assets/rua_estacoes_tilesets/pack/tilesets/chao_spring.png` | png | 256x64 | 3.9 | sim | grade 32 · 8x2 | sem referência | estação ainda não usada (Fase 2/3) |
| rua_estacoes_tilesets | `assets/rua_estacoes_tilesets/pack/tilesets/chao_spring_rotulado.png` | png | 512x128 | 10.7 | sim | grade 32 · 16x4 | preview/demo | preview/demo/referência |
| rua_estacoes_tilesets | `assets/rua_estacoes_tilesets/pack/tilesets/chao_summer.json` | json | — | 1.3 | — |  | metadado | metadado/licença |
| rua_estacoes_tilesets | `assets/rua_estacoes_tilesets/pack/tilesets/chao_summer.png` | png | 256x64 | 3.5 | sim | grade 32 · 8x2 | sem referência | estação ainda não usada (Fase 2/3) |
| rua_estacoes_tilesets | `assets/rua_estacoes_tilesets/pack/tilesets/chao_summer_rotulado.png` | png | 512x128 | 9.8 | sim | grade 32 · 16x4 | preview/demo | preview/demo/referência |
| rua_estacoes_tilesets | `assets/rua_estacoes_tilesets/pack/tilesets/chao_winter.json` | json | — | 1.3 | — |  | metadado | metadado/licença |
| rua_estacoes_tilesets | `assets/rua_estacoes_tilesets/pack/tilesets/chao_winter.png` | png | 256x64 | 3.2 | sim | grade 32 · 8x2 | em uso | cópia em public/assets/street/winter/chao_winter.png |
| rua_estacoes_tilesets | `assets/rua_estacoes_tilesets/pack/tilesets/chao_winter_rotulado.png` | png | 512x128 | 9.5 | sim | grade 32 · 16x4 | preview/demo | preview/demo/referência |
| rua_estacoes_tilesets | `assets/rua_estacoes_tilesets/pack/tilesets/fachadas_autumn.json` | json | — | 0.9 | — |  | metadado | metadado/licença |
| rua_estacoes_tilesets | `assets/rua_estacoes_tilesets/pack/tilesets/fachadas_autumn.png` | png | 512x768 | 35.1 | sim | grade 32 · 16x24 | sem referência | estação ainda não usada (Fase 2/3) |
| rua_estacoes_tilesets | `assets/rua_estacoes_tilesets/pack/tilesets/fachadas_autumn_rotulado.png` | png | 1024x1536 | 66.4 | sim | grade 32 · 32x48 | preview/demo | preview/demo/referência |
| rua_estacoes_tilesets | `assets/rua_estacoes_tilesets/pack/tilesets/fachadas_spring.json` | json | — | 0.9 | — |  | metadado | metadado/licença |
| rua_estacoes_tilesets | `assets/rua_estacoes_tilesets/pack/tilesets/fachadas_spring.png` | png | 512x768 | 36.2 | sim | grade 32 · 16x24 | sem referência | estação ainda não usada (Fase 2/3) |
| rua_estacoes_tilesets | `assets/rua_estacoes_tilesets/pack/tilesets/fachadas_spring_rotulado.png` | png | 1024x1536 | 68.2 | sim | grade 32 · 32x48 | preview/demo | preview/demo/referência |
| rua_estacoes_tilesets | `assets/rua_estacoes_tilesets/pack/tilesets/fachadas_summer.json` | json | — | 0.9 | — |  | metadado | metadado/licença |
| rua_estacoes_tilesets | `assets/rua_estacoes_tilesets/pack/tilesets/fachadas_summer.png` | png | 512x768 | 36.1 | sim | grade 32 · 16x24 | sem referência | estação ainda não usada (Fase 2/3) |
| rua_estacoes_tilesets | `assets/rua_estacoes_tilesets/pack/tilesets/fachadas_summer_rotulado.png` | png | 1024x1536 | 68 | sim | grade 32 · 32x48 | preview/demo | preview/demo/referência |
| rua_estacoes_tilesets | `assets/rua_estacoes_tilesets/pack/tilesets/fachadas_winter.json` | json | — | 1 | — |  | metadado | metadado/licença |
| rua_estacoes_tilesets | `assets/rua_estacoes_tilesets/pack/tilesets/fachadas_winter.png` | png | 512x1024 | 44.2 | sim | grade 32 · 16x32 | em uso | cópia em public/assets/street/winter/fachadas_winter.png |
| rua_estacoes_tilesets | `assets/rua_estacoes_tilesets/pack/tilesets/fachadas_winter_rotulado.png` | png | 1024x2048 | 83.1 | sim | grade 32 · 32x64 | preview/demo | preview/demo/referência |
| rua_estacoes_tilesets | `assets/rua_estacoes_tilesets/pack/tilesets/neve_chao_winter.json` | json | — | 0.8 | — |  | metadado | metadado/licença |
| rua_estacoes_tilesets | `assets/rua_estacoes_tilesets/pack/tilesets/neve_chao_winter.png` | png | 256x32 | 0.7 | sim | grade 32 · 8x1 | em uso | cópia em public/assets/street/winter/neve_chao_winter.png |
| rua_estacoes_tilesets | `assets/rua_estacoes_tilesets/pack/tilesets/neve_chao_winter_rotulado.png` | png | 512x64 | 3.7 | sim | grade 32 · 16x2 | preview/demo | preview/demo/referência |
| rua_estacoes_tilesets | `assets/rua_estacoes_tilesets/pack/tilesets/neve_fachadas_winter.json` | json | — | 1 | — |  | metadado | metadado/licença |
| rua_estacoes_tilesets | `assets/rua_estacoes_tilesets/pack/tilesets/neve_fachadas_winter.png` | png | 512x1024 | 7.5 | sim | grade 32 · 16x32 | em uso | cópia em public/assets/street/winter/neve_fachadas_winter.png |
| rua_estacoes_tilesets | `assets/rua_estacoes_tilesets/pack/tilesets/neve_fachadas_winter_rotulado.png` | png | 1024x2048 | 29.2 | sim | grade 32 · 32x64 | preview/demo | preview/demo/referência |
| rua_estacoes_tilesets | `assets/rua_estacoes_tilesets/pack/tilesets/neve_monte_winter.json` | json | — | 0.2 | — |  | metadado | metadado/licença |
| rua_estacoes_tilesets | `assets/rua_estacoes_tilesets/pack/tilesets/neve_monte_winter.png` | png | 128x32 | 0.3 | sim | grade 32 · 4x1 | em uso | cópia em public/assets/street/winter/neve_monte_winter.png |
| rua_estacoes_tilesets | `assets/rua_estacoes_tilesets/pack/tilesets/neve_monte_winter_rotulado.png` | png | 256x64 | 1.3 | sim | grade 32 · 8x2 | preview/demo | preview/demo/referência |
| rua_estacoes_tilesets | `assets/rua_estacoes_tilesets/pack/tilesets/neve_objetos_winter.json` | json | — | 1.4 | — |  | metadado | metadado/licença |
| rua_estacoes_tilesets | `assets/rua_estacoes_tilesets/pack/tilesets/neve_objetos_winter.png` | png | 512x128 | 1.3 | sim | grade 32 · 16x4 | em uso | cópia em public/assets/street/winter/neve_objetos_winter.png |
| rua_estacoes_tilesets | `assets/rua_estacoes_tilesets/pack/tilesets/neve_objetos_winter_rotulado.png` | png | 1024x256 | 7.7 | sim | grade 32 · 32x8 | preview/demo | preview/demo/referência |
| rua_estacoes_tilesets | `assets/rua_estacoes_tilesets/pack/tilesets/objetos_autumn.json` | json | — | 1.4 | — |  | metadado | metadado/licença |
| rua_estacoes_tilesets | `assets/rua_estacoes_tilesets/pack/tilesets/objetos_autumn.png` | png | 512x160 | 5.6 | sim | grade 32 · 16x5 | sem referência | estação ainda não usada (Fase 2/3) |
| rua_estacoes_tilesets | `assets/rua_estacoes_tilesets/pack/tilesets/objetos_autumn_rotulado.png` | png | 1024x320 | 14.5 | sim | grade 32 · 32x10 | preview/demo | preview/demo/referência |
| rua_estacoes_tilesets | `assets/rua_estacoes_tilesets/pack/tilesets/objetos_spring.json` | json | — | 1.3 | — |  | metadado | metadado/licença |
| rua_estacoes_tilesets | `assets/rua_estacoes_tilesets/pack/tilesets/objetos_spring.png` | png | 512x160 | 4.9 | sim | grade 32 · 16x5 | sem referência | estação ainda não usada (Fase 2/3) |
| rua_estacoes_tilesets | `assets/rua_estacoes_tilesets/pack/tilesets/objetos_spring_rotulado.png` | png | 1024x320 | 13.1 | sim | grade 32 · 32x10 | preview/demo | preview/demo/referência |
| rua_estacoes_tilesets | `assets/rua_estacoes_tilesets/pack/tilesets/objetos_summer.json` | json | — | 1.3 | — |  | metadado | metadado/licença |
| rua_estacoes_tilesets | `assets/rua_estacoes_tilesets/pack/tilesets/objetos_summer.png` | png | 512x160 | 4.8 | sim | grade 32 · 16x5 | sem referência | estação ainda não usada (Fase 2/3) |
| rua_estacoes_tilesets | `assets/rua_estacoes_tilesets/pack/tilesets/objetos_summer_rotulado.png` | png | 1024x320 | 13.2 | sim | grade 32 · 32x10 | preview/demo | preview/demo/referência |
| rua_estacoes_tilesets | `assets/rua_estacoes_tilesets/pack/tilesets/objetos_winter.json` | json | — | 1.6 | — |  | metadado | metadado/licença |
| rua_estacoes_tilesets | `assets/rua_estacoes_tilesets/pack/tilesets/objetos_winter.png` | png | 512x160 | 4.8 | sim | grade 32 · 16x5 | em uso | cópia em public/assets/street/winter/objetos_winter.png |
| rua_estacoes_tilesets | `assets/rua_estacoes_tilesets/pack/tilesets/objetos_winter_rotulado.png` | png | 1024x320 | 14.2 | sim | grade 32 · 32x10 | preview/demo | preview/demo/referência |
| rua_estacoes_tilesets | `assets/rua_estacoes_tilesets/pack/winter/door_frames/shop_door_ceu_3frames.png` | png | 96x104 | 1 | **não** | 32x104 · 3 | duplicata/peça solta | versão solta da pasta da estação; o jogo usa pack/tilesets/; fora da grade 32/16 |
| rua_estacoes_tilesets | `assets/rua_estacoes_tilesets/pack/winter/door_frames/shop_door_menta_3frames.png` | png | 96x104 | 1.1 | **não** | 32x104 · 3 | duplicata/peça solta | versão solta da pasta da estação; o jogo usa pack/tilesets/; fora da grade 32/16 |
| rua_estacoes_tilesets | `assets/rua_estacoes_tilesets/pack/winter/door_frames/shop_door_rosa_3frames.png` | png | 96x104 | 1 | **não** | 32x104 · 3 | duplicata/peça solta | versão solta da pasta da estação; o jogo usa pack/tilesets/; fora da grade 32/16 |
| rua_estacoes_tilesets | `assets/rua_estacoes_tilesets/pack/winter/door_frames/shop_door_velha_3frames.png` | png | 96x104 | 1.4 | **não** | 32x104 · 3 | duplicata/peça solta | versão solta da pasta da estação; o jogo usa pack/tilesets/; fora da grade 32/16 |
| rua_estacoes_tilesets | `assets/rua_estacoes_tilesets/pack/winter/facades/furniture_shop.png` | png | 192x256 | 5.8 | sim | grade 32 · 6x8 | duplicata/peça solta | versão solta da pasta da estação; o jogo usa pack/tilesets/ |
| rua_estacoes_tilesets | `assets/rua_estacoes_tilesets/pack/winter/facades/house_a.png` | png | 128x256 | 5 | sim | 32x64 · 4x4 (16) | duplicata/peça solta | versão solta da pasta da estação; o jogo usa pack/tilesets/ |
| rua_estacoes_tilesets | `assets/rua_estacoes_tilesets/pack/winter/facades/house_b.png` | png | 128x256 | 4 | sim | 32x64 · 4x4 (16) | duplicata/peça solta | versão solta da pasta da estação; o jogo usa pack/tilesets/ |
| rua_estacoes_tilesets | `assets/rua_estacoes_tilesets/pack/winter/facades/house_c.png` | png | 128x256 | 5.1 | sim | 32x64 · 4x4 (16) | duplicata/peça solta | versão solta da pasta da estação; o jogo usa pack/tilesets/ |
| rua_estacoes_tilesets | `assets/rua_estacoes_tilesets/pack/winter/facades/market.png` | png | 224x256 | 7.7 | sim | grade 32 · 7x8 | duplicata/peça solta | versão solta da pasta da estação; o jogo usa pack/tilesets/ |
| rua_estacoes_tilesets | `assets/rua_estacoes_tilesets/pack/winter/facades/shop_ceu.png` | png | 160x256 | 4.9 | sim | grade 32 · 5x8 | duplicata/peça solta | versão solta da pasta da estação; o jogo usa pack/tilesets/ |
| rua_estacoes_tilesets | `assets/rua_estacoes_tilesets/pack/winter/facades/shop_menta.png` | png | 160x256 | 4.9 | sim | grade 32 · 5x8 | duplicata/peça solta | versão solta da pasta da estação; o jogo usa pack/tilesets/ |
| rua_estacoes_tilesets | `assets/rua_estacoes_tilesets/pack/winter/facades/shop_rosa.png` | png | 160x256 | 4.9 | sim | grade 32 · 5x8 | duplicata/peça solta | versão solta da pasta da estação; o jogo usa pack/tilesets/ |
| rua_estacoes_tilesets | `assets/rua_estacoes_tilesets/pack/winter/facades/shop_velha.png` | png | 160x256 | 8.3 | sim | grade 32 · 5x8 | duplicata/peça solta | versão solta da pasta da estação; o jogo usa pack/tilesets/ |
| rua_estacoes_tilesets | `assets/rua_estacoes_tilesets/pack/winter/preview/opcoes_fachada_winter.png` | png | 1360x536 | 27.7 | **não** | grade 32 · 42x16 | preview/demo | preview/demo/referência; fora da grade 32/16 |
| rua_estacoes_tilesets | `assets/rua_estacoes_tilesets/pack/winter/preview/rua_winter_ceu_2x.png` | png | 1920x704 | 70.1 | sim | grade 32 · 60x22 | preview/demo | preview/demo/referência |
| rua_estacoes_tilesets | `assets/rua_estacoes_tilesets/pack/winter/preview/rua_winter_menta_2x.png` | png | 1920x704 | 70.1 | sim | grade 32 · 60x22 | preview/demo | preview/demo/referência |
| rua_estacoes_tilesets | `assets/rua_estacoes_tilesets/pack/winter/preview/rua_winter_rosa_2x.png` | png | 1920x704 | 70 | sim | grade 32 · 60x22 | preview/demo | preview/demo/referência |
| rua_estacoes_tilesets | `assets/rua_estacoes_tilesets/pack/winter/preview/rua_winter_velha_2x.png` | png | 1920x704 | 76.3 | sim | grade 32 · 60x22 | preview/demo | preview/demo/referência |
| rua_estacoes_tilesets | `assets/rua_estacoes_tilesets/pack/winter/props/bench.png` | png | 64x40 | 0.6 | **não** | grade 32 · 2x1 | duplicata/peça solta | versão solta da pasta da estação; o jogo usa pack/tilesets/; fora da grade 32/16 |
| rua_estacoes_tilesets | `assets/rua_estacoes_tilesets/pack/winter/props/bin.png` | png | 32x32 | 0.3 | sim |  | duplicata/peça solta | versão solta da pasta da estação; o jogo usa pack/tilesets/ |
| rua_estacoes_tilesets | `assets/rua_estacoes_tilesets/pack/winter/props/box_blanket.png` | png | 32x32 | 0.3 | sim |  | duplicata/peça solta | versão solta da pasta da estação; o jogo usa pack/tilesets/ |
| rua_estacoes_tilesets | `assets/rua_estacoes_tilesets/pack/winter/props/box_cat_eyes.png` | png | 32x32 | 0.3 | sim |  | duplicata/peça solta | versão solta da pasta da estação; o jogo usa pack/tilesets/ |
| rua_estacoes_tilesets | `assets/rua_estacoes_tilesets/pack/winter/props/box_empty.png` | png | 32x32 | 0.3 | sim |  | duplicata/peça solta | versão solta da pasta da estação; o jogo usa pack/tilesets/ |
| rua_estacoes_tilesets | `assets/rua_estacoes_tilesets/pack/winter/props/chalkboard_cafe.png` | png | 32x48 | 0.4 | **não** |  | duplicata/peça solta | versão solta da pasta da estação; o jogo usa pack/tilesets/; fora da grade 32 (múltiplo de 16) |
| rua_estacoes_tilesets | `assets/rua_estacoes_tilesets/pack/winter/props/crate_apples.png` | png | 32x32 | 0.3 | sim |  | duplicata/peça solta | versão solta da pasta da estação; o jogo usa pack/tilesets/ |
| rua_estacoes_tilesets | `assets/rua_estacoes_tilesets/pack/winter/props/crate_oranges.png` | png | 32x32 | 0.3 | sim |  | duplicata/peça solta | versão solta da pasta da estação; o jogo usa pack/tilesets/ |
| rua_estacoes_tilesets | `assets/rua_estacoes_tilesets/pack/winter/props/fir_tree.png` | png | 32x64 | 0.7 | sim |  | duplicata/peça solta | versão solta da pasta da estação; o jogo usa pack/tilesets/ |
| rua_estacoes_tilesets | `assets/rua_estacoes_tilesets/pack/winter/props/ground_cover.png` | png | 32x32 | 0.3 | sim |  | duplicata/peça solta | versão solta da pasta da estação; o jogo usa pack/tilesets/ |
| rua_estacoes_tilesets | `assets/rua_estacoes_tilesets/pack/winter/props/lamp_post.png` | png | 64x128 | 0.9 | sim | grade 32 · 2x4 | duplicata/peça solta | versão solta da pasta da estação; o jogo usa pack/tilesets/ |
| rua_estacoes_tilesets | `assets/rua_estacoes_tilesets/pack/winter/props/mailbox.png` | png | 32x48 | 0.4 | **não** |  | duplicata/peça solta | versão solta da pasta da estação; o jogo usa pack/tilesets/; fora da grade 32 (múltiplo de 16) |
| rua_estacoes_tilesets | `assets/rua_estacoes_tilesets/pack/winter/props/overlay_particles.png` | png | 128x128 | 0.4 | sim | grade 32 · 4x4 | duplicata/peça solta | versão solta da pasta da estação; o jogo usa pack/tilesets/ |
| rua_estacoes_tilesets | `assets/rua_estacoes_tilesets/pack/winter/props/paw_prints.png` | png | 32x32 | 0.2 | sim |  | duplicata/peça solta | versão solta da pasta da estação; o jogo usa pack/tilesets/ |
| rua_estacoes_tilesets | `assets/rua_estacoes_tilesets/pack/winter/props/planter.png` | png | 32x32 | 0.4 | sim |  | duplicata/peça solta | versão solta da pasta da estação; o jogo usa pack/tilesets/ |
| rua_estacoes_tilesets | `assets/rua_estacoes_tilesets/pack/winter/props/props_atlas.json` | json | — | 1.2 | — |  | metadado | metadado/licença |
| rua_estacoes_tilesets | `assets/rua_estacoes_tilesets/pack/winter/props/props_atlas.png` | png | 256x336 | 6.3 | **não** | grade 32 · 8x10 | duplicata/peça solta | versão solta da pasta da estação; o jogo usa pack/tilesets/; fora da grade 32 (múltiplo de 16) |
| rua_estacoes_tilesets | `assets/rua_estacoes_tilesets/pack/winter/props/terrace_table.png` | png | 52x28 | 0.4 | **não** |  | duplicata/peça solta | versão solta da pasta da estação; o jogo usa pack/tilesets/; fora da grade 32/16 |
| rua_estacoes_tilesets | `assets/rua_estacoes_tilesets/pack/winter/props/tree.png` | png | 64x96 | 1.2 | sim | grade 32 · 2x3 | duplicata/peça solta | versão solta da pasta da estação; o jogo usa pack/tilesets/ |
| rua_estacoes_tilesets | `assets/rua_estacoes_tilesets/pack/winter/scenes/rua_winter_ceu.png` | png | 960x352 | 48.8 | sim | grade 32 · 30x11 | preview/demo | preview/demo/referência |
| rua_estacoes_tilesets | `assets/rua_estacoes_tilesets/pack/winter/scenes/rua_winter_menta.png` | png | 960x352 | 48.9 | sim | grade 32 · 30x11 | preview/demo | preview/demo/referência |
| rua_estacoes_tilesets | `assets/rua_estacoes_tilesets/pack/winter/scenes/rua_winter_rosa.png` | png | 960x352 | 48.8 | sim | grade 32 · 30x11 | preview/demo | preview/demo/referência |
| rua_estacoes_tilesets | `assets/rua_estacoes_tilesets/pack/winter/scenes/rua_winter_velha.png` | png | 960x352 | 53.6 | sim | grade 32 · 30x11 | preview/demo | preview/demo/referência |
| rua_estacoes_tilesets | `assets/rua_estacoes_tilesets/pack/winter/tiles/ground_tiles.csv` | csv | — | 0.3 | — |  | metadado | metadado/licença |
| rua_estacoes_tilesets | `assets/rua_estacoes_tilesets/pack/winter/tiles/ground_tileset.png` | png | 256x64 | 3.6 | sim | grade 32 · 8x2 | duplicata/peça solta | versão solta da pasta da estação; o jogo usa pack/tilesets/ |
| senhorinha | `assets/senhorinha/senhorinha_original_4x.png` | png | 778x1280 | 31.6 | **não** |  | preview/demo | preview/demo/referência; fora da grade 32/16 |
| senhorinha | `assets/senhorinha/senhorinha_retrato_64.png` | png | 64x64 | 0.8 | sim |  | em uso | cópia em public/assets/npc/senhorinha_retrato_64.png |
| senhorinha | `assets/senhorinha/senhorinha_spritesheet.png` | png | 128x320 | 8.5 | sim | 32x64 · 4x5 (20) | em uso | cópia em public/assets/npc/senhorinha_spritesheet.png |
| sujeira_cafe_abandonado | `assets/sujeira_cafe_abandonado/pack/sujeira/balde_goteira.png` | png | 32x32 | 0.2 | sim |  | duplicata/peça solta | peça solta; o jogo usa sujeira_tileset |
| sujeira_cafe_abandonado | `assets/sujeira_cafe_abandonado/pack/sujeira/buraco_rato.png` | png | 32x32 | 0.2 | sim |  | duplicata/peça solta | peça solta; o jogo usa sujeira_tileset |
| sujeira_cafe_abandonado | `assets/sujeira_cafe_abandonado/pack/sujeira/escorrido_parede.png` | png | 32x64 | 0.3 | sim |  | duplicata/peça solta | peça solta; o jogo usa sujeira_tileset |
| sujeira_cafe_abandonado | `assets/sujeira_cafe_abandonado/pack/sujeira/folhas_secas.png` | png | 32x32 | 0.2 | sim |  | duplicata/peça solta | peça solta; o jogo usa sujeira_tileset |
| sujeira_cafe_abandonado | `assets/sujeira_cafe_abandonado/pack/sujeira/LEIA-ME.md` | md | — | 0.8 | — |  | metadado | metadado/licença |
| sujeira_cafe_abandonado | `assets/sujeira_cafe_abandonado/pack/sujeira/lencol_sobre_movel.png` | png | 64x32 | 0.4 | sim |  | duplicata/peça solta | peça solta; o jogo usa sujeira_tileset |
| sujeira_cafe_abandonado | `assets/sujeira_cafe_abandonado/pack/sujeira/mancha_agua.png` | png | 32x32 | 0.3 | sim |  | duplicata/peça solta | peça solta; o jogo usa sujeira_tileset |
| sujeira_cafe_abandonado | `assets/sujeira_cafe_abandonado/pack/sujeira/mancha_bolor.png` | png | 32x32 | 0.4 | sim |  | duplicata/peça solta | peça solta; o jogo usa sujeira_tileset; fora da paleta (62.5% dos px) |
| sujeira_cafe_abandonado | `assets/sujeira_cafe_abandonado/pack/sujeira/mancha_fuligem.png` | png | 32x32 | 0.3 | sim |  | duplicata/peça solta | peça solta; o jogo usa sujeira_tileset |
| sujeira_cafe_abandonado | `assets/sujeira_cafe_abandonado/pack/sujeira/papeis_chao.png` | png | 32x32 | 0.2 | sim |  | duplicata/peça solta | peça solta; o jogo usa sujeira_tileset |
| sujeira_cafe_abandonado | `assets/sujeira_cafe_abandonado/pack/sujeira/particulas_poeira.png` | png | 32x32 | 0.1 | sim |  | duplicata/peça solta | peça solta; o jogo usa sujeira_tileset |
| sujeira_cafe_abandonado | `assets/sujeira_cafe_abandonado/pack/sujeira/poeira_a.png` | png | 32x32 | 0.5 | sim |  | duplicata/peça solta | peça solta; o jogo usa sujeira_tileset |
| sujeira_cafe_abandonado | `assets/sujeira_cafe_abandonado/pack/sujeira/poeira_b.png` | png | 32x32 | 0.6 | sim |  | duplicata/peça solta | peça solta; o jogo usa sujeira_tileset |
| sujeira_cafe_abandonado | `assets/sujeira_cafe_abandonado/pack/sujeira/poeira_c.png` | png | 64x32 | 1 | sim |  | duplicata/peça solta | peça solta; o jogo usa sujeira_tileset |
| sujeira_cafe_abandonado | `assets/sujeira_cafe_abandonado/pack/sujeira/poeira_densa.png` | png | 64x64 | 2.4 | sim |  | duplicata/peça solta | peça solta; o jogo usa sujeira_tileset |
| sujeira_cafe_abandonado | `assets/sujeira_cafe_abandonado/pack/sujeira/rachadura_a.png` | png | 32x32 | 0.2 | sim |  | duplicata/peça solta | peça solta; o jogo usa sujeira_tileset |
| sujeira_cafe_abandonado | `assets/sujeira_cafe_abandonado/pack/sujeira/rachadura_b.png` | png | 32x32 | 0.2 | sim |  | duplicata/peça solta | peça solta; o jogo usa sujeira_tileset |
| sujeira_cafe_abandonado | `assets/sujeira_cafe_abandonado/pack/sujeira/raio_de_sol.png` | png | 64x96 | 0.6 | sim |  | duplicata/peça solta | peça solta; o jogo usa sujeira_tileset |
| sujeira_cafe_abandonado | `assets/sujeira_cafe_abandonado/pack/sujeira/sujeira_rotulado.png` | png | 768x448 | 25.6 | sim |  | preview/demo | preview/demo/referência |
| sujeira_cafe_abandonado | `assets/sujeira_cafe_abandonado/pack/sujeira/sujeira_tileset.json` | json | — | 2.6 | — |  | metadado | metadado/licença |
| sujeira_cafe_abandonado | `assets/sujeira_cafe_abandonado/pack/sujeira/sujeira_tileset.png` | png | 384x224 | 11.4 | sim | grade 32 · 12x7 | em uso | cópia em public/assets/dirt/sujeira_tileset.png |
| sujeira_cafe_abandonado | `assets/sujeira_cafe_abandonado/pack/sujeira/teia_canto_dir.png` | png | 32x32 | 0.4 | sim |  | duplicata/peça solta | peça solta; o jogo usa sujeira_tileset |
| sujeira_cafe_abandonado | `assets/sujeira_cafe_abandonado/pack/sujeira/teia_canto_esq.png` | png | 32x32 | 0.4 | sim |  | duplicata/peça solta | peça solta; o jogo usa sujeira_tileset |
| sujeira_cafe_abandonado | `assets/sujeira_cafe_abandonado/pack/sujeira/teia_canto_grande_dir.png` | png | 64x64 | 0.8 | sim |  | duplicata/peça solta | peça solta; o jogo usa sujeira_tileset |
| sujeira_cafe_abandonado | `assets/sujeira_cafe_abandonado/pack/sujeira/teia_canto_grande_esq.png` | png | 64x64 | 0.8 | sim |  | duplicata/peça solta | peça solta; o jogo usa sujeira_tileset |
| sujeira_cafe_abandonado | `assets/sujeira_cafe_abandonado/pack/sujeira/teia_fio_aranha.png` | png | 32x64 | 0.2 | sim |  | duplicata/peça solta | peça solta; o jogo usa sujeira_tileset |
| sujeira_cafe_abandonado | `assets/sujeira_cafe_abandonado/pack/sujeira/teia_janela.png` | png | 64x64 | 1.1 | sim |  | duplicata/peça solta | peça solta; o jogo usa sujeira_tileset |
| sujeira_cafe_abandonado | `assets/sujeira_cafe_abandonado/pack/sujeira/vidro_quebrado.png` | png | 32x32 | 0.2 | sim |  | duplicata/peça solta | peça solta; o jogo usa sujeira_tileset |
| tilesets_expansao | `assets/tilesets_expansao/pack/tilesets_expansao/cerca/cerca_16.json` | json | — | 0.2 | — |  | metadado | metadado/licença |
| tilesets_expansao | `assets/tilesets_expansao/pack/tilesets_expansao/cerca/cerca_16.png` | png | 256x64 | 0.9 | sim | 32x32 · autotile 16 | sem referência | nenhuma referência |
| tilesets_expansao | `assets/tilesets_expansao/pack/tilesets_expansao/demo/exterior_frente_inverno.png` | png | 1280x640 | 61.7 | sim | grade 32 · 40x20 | preview/demo | preview/demo/referência |
| tilesets_expansao | `assets/tilesets_expansao/pack/tilesets_expansao/demo/exterior_frente_primavera.png` | png | 1280x640 | 68.8 | sim | grade 32 · 40x20 | preview/demo | preview/demo/referência |
| tilesets_expansao | `assets/tilesets_expansao/pack/tilesets_expansao/demo/interior_frente_demo.png` | png | 1088x448 | 37.3 | sim | grade 32 · 34x14 | preview/demo | preview/demo/referência |
| tilesets_expansao | `assets/tilesets_expansao/pack/tilesets_expansao/demo/interior_frente_demo_50.png` | png | 544x224 | 11.4 | sim | grade 32 · 17x7 | preview/demo | preview/demo/referência |
| tilesets_expansao | `assets/tilesets_expansao/pack/tilesets_expansao/demo/mapa_continuo_demo.png` | png | 1280x832 | 97.6 | sim | grade 32 · 40x26 | preview/demo | preview/demo/referência |
| tilesets_expansao | `assets/tilesets_expansao/pack/tilesets_expansao/demo/mapa_continuo_demo_50.png` | png | 640x416 | 30.7 | sim | grade 32 · 20x13 | preview/demo | preview/demo/referência |
| tilesets_expansao | `assets/tilesets_expansao/pack/tilesets_expansao/LEIA-ME.md` | md | — | 0.9 | — |  | metadado | metadado/licença |
| tilesets_expansao | `assets/tilesets_expansao/pack/tilesets_expansao/paredes/arandela.png` | png | 32x32 | 0.2 | sim |  | sem referência | nenhuma referência |
| tilesets_expansao | `assets/tilesets_expansao/pack/tilesets_expansao/paredes/borda_frontal.png` | png | 32x32 | 0.1 | sim |  | sem referência | nenhuma referência |
| tilesets_expansao | `assets/tilesets_expansao/pack/tilesets_expansao/paredes/divisoria_fim_frente.png` | png | 32x64 | 0.3 | sim |  | sem referência | nenhuma referência |
| tilesets_expansao | `assets/tilesets_expansao/pack/tilesets_expansao/paredes/divisoria_meio.png` | png | 32x32 | 0.1 | sim |  | sem referência | nenhuma referência |
| tilesets_expansao | `assets/tilesets_expansao/pack/tilesets_expansao/paredes/divisoria_topo.png` | png | 32x32 | 0.2 | sim |  | sem referência | nenhuma referência |
| tilesets_expansao | `assets/tilesets_expansao/pack/tilesets_expansao/paredes/janela_cortina_rosa.png` | png | 64x64 | 0.5 | sim | grade 32 · 2x2 | sem referência | nenhuma referência |
| tilesets_expansao | `assets/tilesets_expansao/pack/tilesets_expansao/paredes/lambri.png` | png | 32x32 | 0.2 | sim |  | sem referência | nenhuma referência |
| tilesets_expansao | `assets/tilesets_expansao/pack/tilesets_expansao/paredes/papel_parede.png` | png | 32x32 | 0.2 | sim |  | sem referência | nenhuma referência |
| tilesets_expansao | `assets/tilesets_expansao/pack/tilesets_expansao/paredes/papel_parede_moldura.png` | png | 32x32 | 0.2 | sim |  | sem referência | nenhuma referência |
| tilesets_expansao | `assets/tilesets_expansao/pack/tilesets_expansao/paredes/paredes_frente.json` | json | — | 0.5 | — |  | metadado | metadado/licença |
| tilesets_expansao | `assets/tilesets_expansao/pack/tilesets_expansao/paredes/parede_frente_janela.png` | png | 32x32 | 0.3 | sim |  | sem referência | nenhuma referência |
| tilesets_expansao | `assets/tilesets_expansao/pack/tilesets_expansao/paredes/parede_frente_liso.png` | png | 32x32 | 0.2 | sim |  | sem referência | nenhuma referência |
| tilesets_expansao | `assets/tilesets_expansao/pack/tilesets_expansao/paredes/parede_frente_porta_aberta.png` | png | 32x32 | 0.2 | sim |  | sem referência | nenhuma referência |
| tilesets_expansao | `assets/tilesets_expansao/pack/tilesets_expansao/paredes/parede_frente_porta_escura.png` | png | 32x32 | 0.2 | sim |  | sem referência | nenhuma referência |
| tilesets_expansao | `assets/tilesets_expansao/pack/tilesets_expansao/paredes/parede_frente_porta_trancada.png` | png | 32x32 | 0.3 | sim |  | sem referência | nenhuma referência |
| tilesets_expansao | `assets/tilesets_expansao/pack/tilesets_expansao/paredes/parede_frente_quadro.png` | png | 32x32 | 0.3 | sim |  | sem referência | nenhuma referência |
| tilesets_expansao | `assets/tilesets_expansao/pack/tilesets_expansao/paredes/parede_topo.json` | json | — | 1.1 | — |  | metadado | metadado/licença |
| tilesets_expansao | `assets/tilesets_expansao/pack/tilesets_expansao/paredes/parede_topo.png` | png | 256x192 | 4.7 | sim | grade 32 · 8x6 | sem referência | nenhuma referência |
| tilesets_expansao | `assets/tilesets_expansao/pack/tilesets_expansao/paredes/piso_xadrez_a.png` | png | 32x32 | 0.2 | sim |  | sem referência | nenhuma referência |
| tilesets_expansao | `assets/tilesets_expansao/pack/tilesets_expansao/paredes/piso_xadrez_b.png` | png | 32x32 | 0.2 | sim |  | sem referência | nenhuma referência |
| tilesets_expansao | `assets/tilesets_expansao/pack/tilesets_expansao/paredes/porta_verde.png` | png | 32x64 | 0.3 | sim |  | sem referência | nenhuma referência |
| tilesets_expansao | `assets/tilesets_expansao/pack/tilesets_expansao/paredes/porta_verde_aberta.png` | png | 32x64 | 0.2 | sim |  | sem referência | nenhuma referência |
| tilesets_expansao | `assets/tilesets_expansao/pack/tilesets_expansao/paredes/porta_verde_placa.png` | png | 32x64 | 0.4 | sim |  | sem referência | nenhuma referência |
| tilesets_expansao | `assets/tilesets_expansao/pack/tilesets_expansao/paredes/porta_verde_trancada.png` | png | 32x64 | 0.4 | sim |  | sem referência | nenhuma referência |
| tilesets_expansao | `assets/tilesets_expansao/pack/tilesets_expansao/paredes/quadro.png` | png | 32x32 | 0.2 | sim |  | sem referência | nenhuma referência |
| tilesets_expansao | `assets/tilesets_expansao/pack/tilesets_expansao/paredes/relogio_parede.png` | png | 32x32 | 0.3 | sim |  | sem referência | nenhuma referência |
| tilesets_expansao | `assets/tilesets_expansao/pack/tilesets_expansao/paredes/sombra_lambri.png` | png | 32x32 | 0.1 | sim |  | sem referência | nenhuma referência |
| tilesets_expansao | `assets/tilesets_expansao/pack/tilesets_expansao/paredes_rotulado.png` | png | 1100x300 | 12.6 | **não** | grade 32 · 34x9 | preview/demo | preview/demo/referência; fora da grade 32/16 |
| tilesets_expansao | `assets/tilesets_expansao/pack/tilesets_expansao/pecas_rotulado.png` | png | 1100x450 | 15.8 | **não** | grade 32 · 34x14 | preview/demo | preview/demo/referência; fora da grade 32/16 |
| tilesets_expansao | `assets/tilesets_expansao/pack/tilesets_expansao/pisos/cadeado.png` | png | 32x32 | 0.2 | sim |  | sem referência | nenhuma referência |
| tilesets_expansao | `assets/tilesets_expansao/pack/tilesets_expansao/pisos/escada_baixo.png` | png | 32x32 | 0.3 | sim |  | sem referência | nenhuma referência |
| tilesets_expansao | `assets/tilesets_expansao/pack/tilesets_expansao/pisos/passagem.png` | png | 32x32 | 0.2 | sim |  | sem referência | nenhuma referência |
| tilesets_expansao | `assets/tilesets_expansao/pack/tilesets_expansao/pisos/piso_abandonado_a.png` | png | 32x32 | 0.5 | sim |  | sem referência | nenhuma referência |
| tilesets_expansao | `assets/tilesets_expansao/pack/tilesets_expansao/pisos/piso_abandonado_b.png` | png | 32x32 | 0.5 | sim |  | sem referência | nenhuma referência |
| tilesets_expansao | `assets/tilesets_expansao/pack/tilesets_expansao/pisos/piso_cozinha.png` | png | 32x32 | 0.1 | sim |  | sem referência | nenhuma referência |
| tilesets_expansao | `assets/tilesets_expansao/pack/tilesets_expansao/pisos/piso_desconhecido.png` | png | 32x32 | 0.2 | sim |  | sem referência | nenhuma referência |
| tilesets_expansao | `assets/tilesets_expansao/pack/tilesets_expansao/pisos/piso_madeira_a.png` | png | 32x32 | 0.3 | sim |  | sem referência | nenhuma referência |
| tilesets_expansao | `assets/tilesets_expansao/pack/tilesets_expansao/pisos/piso_madeira_b.png` | png | 32x32 | 0.3 | sim |  | sem referência | nenhuma referência |
| tilesets_expansao | `assets/tilesets_expansao/pack/tilesets_expansao/pisos/piso_madeira_escura.png` | png | 32x32 | 0.2 | sim |  | sem referência | nenhuma referência |
| tilesets_expansao | `assets/tilesets_expansao/pack/tilesets_expansao/pisos/tapete_3x3.png` | png | 96x96 | 0.9 | sim | grade 32 · 3x3 | sem referência | nenhuma referência |
| tilesets_expansao | `assets/tilesets_expansao/pack/tilesets_expansao/quintal/arvore_gato_externa.png` | png | 32x64 | 0.3 | sim |  | sem referência | nenhuma referência |
| tilesets_expansao | `assets/tilesets_expansao/pack/tilesets_expansao/quintal/cama_ao_sol.png` | png | 32x32 | 0.3 | sim |  | sem referência | nenhuma referência |
| tilesets_expansao | `assets/tilesets_expansao/pack/tilesets_expansao/quintal/casinha_gato.png` | png | 32x32 | 0.2 | sim |  | sem referência | nenhuma referência |
| tilesets_expansao | `assets/tilesets_expansao/pack/tilesets_expansao/quintal/floreira.png` | png | 32x32 | 0.4 | sim |  | sem referência | nenhuma referência |
| tilesets_expansao | `assets/tilesets_expansao/pack/tilesets_expansao/quintal/tigela_agua.png` | png | 32x32 | 0.2 | sim |  | sem referência | nenhuma referência |
| tilesets_expansao | `assets/tilesets_expansao/pack/tilesets_expansao/quintal/tora_arranhador.png` | png | 32x32 | 0.2 | sim |  | sem referência | nenhuma referência |
| tilesets_expansao | `assets/tilesets_expansao/pack/tilesets_expansao/quintal/tunel_gato.png` | png | 64x32 | 0.3 | sim | grade 32 · 2x1 | sem referência | nenhuma referência |
| tilesets_expansao | `assets/tilesets_expansao/pack/tilesets_expansao/terrenos/agua_sobre_grama_autumn.png` | png | 256x192 | 6.7 | sim | 32x32 · autotile 47 (8x6) | sem referência | nenhuma referência |
| tilesets_expansao | `assets/tilesets_expansao/pack/tilesets_expansao/terrenos/agua_sobre_grama_spring.png` | png | 256x192 | 6.7 | sim | 32x32 · autotile 47 (8x6) | sem referência | nenhuma referência |
| tilesets_expansao | `assets/tilesets_expansao/pack/tilesets_expansao/terrenos/agua_sobre_grama_summer.png` | png | 256x192 | 6.6 | sim | 32x32 · autotile 47 (8x6) | sem referência | nenhuma referência |
| tilesets_expansao | `assets/tilesets_expansao/pack/tilesets_expansao/terrenos/agua_sobre_grama_winter.png` | png | 256x192 | 6.1 | sim | 32x32 · autotile 47 (8x6) | sem referência | nenhuma referência |
| tilesets_expansao | `assets/tilesets_expansao/pack/tilesets_expansao/terrenos/autotile47.json` | json | — | 1.1 | — |  | metadado | metadado/licença |
| tilesets_expansao | `assets/tilesets_expansao/pack/tilesets_expansao/terrenos/calcada_sobre_grama_autumn.png` | png | 256x192 | 7.7 | sim | 32x32 · autotile 47 (8x6) | sem referência | nenhuma referência |
| tilesets_expansao | `assets/tilesets_expansao/pack/tilesets_expansao/terrenos/calcada_sobre_grama_spring.png` | png | 256x192 | 7.7 | sim | 32x32 · autotile 47 (8x6) | sem referência | nenhuma referência |
| tilesets_expansao | `assets/tilesets_expansao/pack/tilesets_expansao/terrenos/calcada_sobre_grama_summer.png` | png | 256x192 | 7.4 | sim | 32x32 · autotile 47 (8x6) | sem referência | nenhuma referência |
| tilesets_expansao | `assets/tilesets_expansao/pack/tilesets_expansao/terrenos/calcada_sobre_grama_winter.png` | png | 256x192 | 7.4 | sim | 32x32 · autotile 47 (8x6) | sem referência | nenhuma referência |
| tilesets_expansao | `assets/tilesets_expansao/pack/tilesets_expansao/terrenos/grama_autumn.png` | png | 32x32 | 0.5 | sim |  | sem referência | nenhuma referência; fora da paleta (97.9% dos px) |
| tilesets_expansao | `assets/tilesets_expansao/pack/tilesets_expansao/terrenos/grama_spring.png` | png | 32x32 | 0.5 | sim |  | sem referência | nenhuma referência |
| tilesets_expansao | `assets/tilesets_expansao/pack/tilesets_expansao/terrenos/grama_summer.png` | png | 32x32 | 0.4 | sim |  | sem referência | nenhuma referência |
| tilesets_expansao | `assets/tilesets_expansao/pack/tilesets_expansao/terrenos/grama_winter.png` | png | 32x32 | 0.4 | sim |  | sem referência | nenhuma referência |
| tilesets_expansao | `assets/tilesets_expansao/pack/tilesets_expansao/terrenos/terra_sobre_grama_autumn.png` | png | 256x192 | 8.5 | sim | 32x32 · autotile 47 (8x6) | sem referência | nenhuma referência |
| tilesets_expansao | `assets/tilesets_expansao/pack/tilesets_expansao/terrenos/terra_sobre_grama_preview_4x.png` | png | 1024x768 | 19.2 | sim | grade 32 · 32x24 | preview/demo | preview/demo/referência |
| tilesets_expansao | `assets/tilesets_expansao/pack/tilesets_expansao/terrenos/terra_sobre_grama_spring.png` | png | 256x192 | 8 | sim | 32x32 · autotile 47 (8x6) | sem referência | nenhuma referência |
| tilesets_expansao | `assets/tilesets_expansao/pack/tilesets_expansao/terrenos/terra_sobre_grama_summer.png` | png | 256x192 | 7.9 | sim | 32x32 · autotile 47 (8x6) | sem referência | nenhuma referência |
| tilesets_expansao | `assets/tilesets_expansao/pack/tilesets_expansao/terrenos/terra_sobre_grama_winter.png` | png | 256x192 | 7.9 | sim | 32x32 · autotile 47 (8x6) | sem referência | nenhuma referência |
| vassoura_nova | `assets/vassoura_nova/vassoura_spritesheet.json` | json | — | 0.5 | — |  | metadado | metadado/licença |
| vassoura_nova | `assets/vassoura_nova/vassoura_spritesheet.png` | png | 288x32 | 1.1 | sim | 32x32 · 9 | em uso | cópia em public/assets/tools/vassoura_v2_spritesheet.png |
| public/assets | `public/assets/cats/biscuit.png` | png | 192x224 | 6.2 | sim | 32x32 · 6x7 (30 usados) | referenciado nos dados, não carregado | listado em cat_sprites.json; nenhum gato usa a variante |
| public/assets | `public/assets/cats/custard.png` | png | 192x224 | 7.4 | sim | 32x32 · 6x7 (30 usados) | referenciado nos dados, não carregado | listado em cat_sprites.json; nenhum gato usa a variante |
| public/assets | `public/assets/cats/domino.png` | png | 192x224 | 5.6 | sim | 32x32 · 6x7 (30 usados) | referenciado nos dados, não carregado | listado em cat_sprites.json; nenhum gato usa a variante |
| public/assets | `public/assets/cats/freckle.png` | png | 192x224 | 7.3 | sim | 32x32 · 6x7 (30 usados) | referenciado nos dados, não carregado | listado em cat_sprites.json; nenhum gato usa a variante |
| public/assets | `public/assets/cats/hazel.png` | png | 192x224 | 7.4 | sim | 32x32 · 6x7 (30 usados) | referenciado nos dados, não carregado | listado em cat_sprites.json; nenhum gato usa a variante |
| public/assets | `public/assets/cats/marmalade.png` | png | 192x224 | 7.6 | sim | 32x32 · 6x7 (30 usados) | em uso | gato Marmalade (cat.first_stray) |
| public/assets | `public/assets/cats/midnight.png` | png | 192x224 | 5.5 | sim | 32x32 · 6x7 (30 usados) | referenciado nos dados, não carregado | listado em cat_sprites.json; nenhum gato usa a variante |
| public/assets | `public/assets/cats/misty.png` | png | 192x224 | 5.5 | sim | 32x32 · 6x7 (30 usados) | referenciado nos dados, não carregado | listado em cat_sprites.json; nenhum gato usa a variante |
| public/assets | `public/assets/cats/patches.png` | png | 192x224 | 7.9 | sim | 32x32 · 6x7 (30 usados) | referenciado nos dados, não carregado | listado em cat_sprites.json; nenhum gato usa a variante |
| public/assets | `public/assets/cats/pebble.png` | png | 192x224 | 7.4 | sim | 32x32 · 6x7 (30 usados) | referenciado nos dados, não carregado | Tekinha: memory=true, não é carregada |
| public/assets | `public/assets/cats/snowdrop.png` | png | 192x224 | 5.7 | sim | 32x32 · 6x7 (30 usados) | referenciado nos dados, não carregado | listado em cat_sprites.json; nenhum gato usa a variante |
| public/assets | `public/assets/cats/toffee.png` | png | 192x224 | 9.4 | sim | 32x32 · 6x7 (30 usados) | referenciado nos dados, não carregado | listado em cat_sprites.json; nenhum gato usa a variante |
| public/assets | `public/assets/characters/mulher_placeholder_32x64.png` | png | 128x256 | 3.1 | sim | 32x64 · 4x4 (16) | sem referência | nenhuma referência |
| public/assets | `public/assets/dirt/sujeira_tileset.png` | png | 384x224 | 11.4 | sim | grade 32 · 12x7 | em uso |  |
| public/assets | `public/assets/equipment/cafeteira_spritesheet.png` | png | 192x32 | 1.6 | sim | 32x32 · 6 | em uso |  |
| public/assets | `public/assets/equipment/equipamentos_spritesheet.png` | png | 192x160 | 11.7 | sim | 32x32 · 6x5 (30) | em uso |  |
| public/assets | `public/assets/equipment/pia_sheet.png` | png | 224x32 | 1.6 | sim | 32x32 · 7 | em uso |  |
| public/assets | `public/assets/fluxo/balcoes.png` | png | 96x32 | 0.4 | sim | grade 32 · 3x1 | em uso |  |
| public/assets | `public/assets/fluxo/louca_16.png` | png | 48x48 | 0.7 | **não** | 16x16 · 3x3 | em uso | fora da grade 32 (múltiplo de 16) |
| public/assets | `public/assets/fluxo/ui/balao_aguardando_1.png` | png | 24x22 | 0.2 | **não** |  | em uso | fora da grade 32/16 |
| public/assets | `public/assets/fluxo/ui/balao_aguardando_2.png` | png | 24x22 | 0.2 | **não** |  | em uso | fora da grade 32/16 |
| public/assets | `public/assets/fluxo/ui/balao_aguardando_3.png` | png | 24x22 | 0.2 | **não** |  | em uso | fora da grade 32/16 |
| public/assets | `public/assets/fluxo/ui/balao_pedido.png` | png | 40x44 | 0.2 | **não** |  | em uso | fora da grade 32/16 |
| public/assets | `public/assets/fluxo/ui/balao_pedido_furioso.png` | png | 40x44 | 0.2 | **não** |  | em uso | fora da grade 32/16 |
| public/assets | `public/assets/fluxo/ui/balao_pedido_impaciente.png` | png | 40x44 | 0.2 | **não** |  | em uso | fora da grade 32/16 |
| public/assets | `public/assets/fluxo/ui/balcao_marcador_1.png` | png | 32x32 | 0.2 | sim |  | em uso |  |
| public/assets | `public/assets/fluxo/ui/balcao_marcador_2.png` | png | 32x32 | 0.2 | sim |  | em uso |  |
| public/assets | `public/assets/fluxo/ui/barra_progresso_0.png` | png | 34x8 | 0.1 | **não** |  | em uso | fora da grade 32/16; pixel 4x (densidade diferente) |
| public/assets | `public/assets/fluxo/ui/barra_progresso_1.png` | png | 34x8 | 0.1 | **não** |  | em uso | fora da grade 32/16 |
| public/assets | `public/assets/fluxo/ui/barra_progresso_2.png` | png | 34x8 | 0.1 | **não** |  | em uso | fora da grade 32/16 |
| public/assets | `public/assets/fluxo/ui/barra_progresso_3.png` | png | 34x8 | 0.1 | **não** |  | em uso | fora da grade 32/16 |
| public/assets | `public/assets/fluxo/ui/barra_progresso_4.png` | png | 34x8 | 0.1 | **não** |  | em uso | fora da grade 32/16 |
| public/assets | `public/assets/fluxo/ui/barra_progresso_5.png` | png | 34x8 | 0.1 | **não** |  | em uso | fora da grade 32/16 |
| public/assets | `public/assets/fluxo/ui/barra_progresso_6.png` | png | 34x8 | 0.1 | **não** |  | em uso | fora da grade 32/16 |
| public/assets | `public/assets/fluxo/ui/barra_progresso_7.png` | png | 34x8 | 0.1 | **não** |  | em uso | fora da grade 32/16 |
| public/assets | `public/assets/fluxo/ui/barra_progresso_8.png` | png | 34x8 | 0.1 | **não** |  | em uso | fora da grade 32/16 |
| public/assets | `public/assets/fluxo/ui/cardapio_4_slots.png` | png | 192x84 | 0.8 | **não** |  | em uso | fora da grade 32/16 |
| public/assets | `public/assets/fluxo/ui/cardapio_6_slots.png` | png | 148x138 | 1 | **não** |  | em uso | fora da grade 32/16 |
| public/assets | `public/assets/fluxo/ui/cardapio_8_slots.png` | png | 192x138 | 1.2 | **não** |  | em uso | fora da grade 32/16 |
| public/assets | `public/assets/fluxo/ui/etiqueta_preco.png` | png | 40x16 | 0.3 | **não** |  | sem referência | nenhuma referência; fora da grade 32/16 |
| public/assets | `public/assets/fluxo/ui/marca_esgotado.png` | png | 44x18 | 0.2 | **não** |  | em uso | fora da grade 32/16 |
| public/assets | `public/assets/fluxo/ui/moeda_16.png` | png | 16x16 | 0.3 | **não** |  | em uso | fora da grade 32 (múltiplo de 16) |
| public/assets | `public/assets/fluxo/ui/slot_esgotado_veu.png` | png | 36x36 | 0.1 | **não** |  | em uso | fora da grade 32/16 |
| public/assets | `public/assets/icons/catalogo_icones.png` | png | 160x96 | 2.9 | sim | grade 32 · 5x3 | em uso |  |
| public/assets | `public/assets/icons/fluxo_icones.png` | png | 416x32 | 3.9 | sim | grade 32 · 13x1 | em uso |  |
| public/assets | `public/assets/icons/itens_bebidas_tileset.png` | png | 192x96 | 2.7 | sim | grade 32 · 6x3 | em uso |  |
| public/assets | `public/assets/icons/louca_tileset.png` | png | 256x96 | 3.4 | sim | grade 32 · 8x3 | em uso |  |
| public/assets | `public/assets/icons/materia_prima_tileset.png` | png | 192x128 | 3.3 | sim | grade 32 · 6x4 | em uso |  |
| public/assets | `public/assets/market/mercado_interior_tileset.png` | png | 512x224 | 10.8 | sim | grade 32 · 16x7 | em uso |  |
| public/assets | `public/assets/npc/clientes/cliente_01_homem_negro_barba_oculos.png` | png | 128x256 | 3.4 | sim | 32x64 · 4x4 (16) | em uso |  |
| public/assets | `public/assets/npc/clientes/cliente_02_mulher_negra_black_power.png` | png | 128x256 | 3.6 | sim | 32x64 · 4x4 (16) | em uso | fora da paleta (28.8% dos px) |
| public/assets | `public/assets/npc/clientes/cliente_03_homem_ruivo_bone.png` | png | 128x256 | 3.5 | sim | 32x64 · 4x4 (16) | em uso | fora da paleta (27.2% dos px) |
| public/assets | `public/assets/npc/clientes/cliente_04_mulher_asiatica_cabelo_longo.png` | png | 128x256 | 3.4 | sim | 32x64 · 4x4 (16) | em uso |  |
| public/assets | `public/assets/npc/clientes/cliente_05_homem_asiatico_oculos_escritorio.png` | png | 128x256 | 3.3 | sim | 32x64 · 4x4 (16) | em uso |  |
| public/assets | `public/assets/npc/clientes/cliente_06_mulher_loira_rabo_esportiva.png` | png | 128x256 | 3.6 | sim | 32x64 · 4x4 (16) | em uso | fora da paleta (32% dos px) |
| public/assets | `public/assets/npc/clientes/cliente_07_homem_idoso_grisalho_bigode.png` | png | 128x256 | 3.4 | sim | 32x64 · 4x4 (16) | em uso |  |
| public/assets | `public/assets/npc/clientes/cliente_08_mulher_latina_cacheada.png` | png | 128x256 | 3.4 | sim | 32x64 · 4x4 (16) | em uso |  |
| public/assets | `public/assets/npc/clientes/cliente_09_homem_pardo_careca_barba_xadrez.png` | png | 128x256 | 3.3 | sim | 32x64 · 4x4 (16) | em uso | fora da paleta (27.9% dos px) |
| public/assets | `public/assets/npc/clientes/cliente_10_mulher_hijab_vestido.png` | png | 128x256 | 3 | sim | 32x64 · 4x4 (16) | em uso | fora da paleta (62.1% dos px) |
| public/assets | `public/assets/npc/corretora_retrato_64.png` | png | 64x64 | 0.6 | sim |  | em uso |  |
| public/assets | `public/assets/npc/corretora_spritesheet.png` | png | 128x320 | 4.9 | sim | 32x64 · 4x5 (20) | em uso |  |
| public/assets | `public/assets/npc/entregadora_retrato_64.png` | png | 64x64 | 0.7 | sim |  | em uso |  |
| public/assets | `public/assets/npc/entregadora_spritesheet.png` | png | 128x320 | 8.6 | sim | 32x64 · 4x5 (20) | em uso | fora da paleta (30.4% dos px) |
| public/assets | `public/assets/npc/gabi_caixa.gif` | gif | 288x288 | 38.4 | sim | GIF · 15 quadros | sem referência | nenhuma referência |
| public/assets | `public/assets/npc/gabi_retrato_64.png` | png | 64x64 | 0.6 | sim |  | em uso |  |
| public/assets | `public/assets/npc/gabi_spritesheet.png` | png | 128x320 | 4.8 | sim | 32x64 · 4x5 (20) | em uso |  |
| public/assets | `public/assets/npc/icone_chave.png` | png | 32x32 | 0.3 | sim |  | em uso |  |
| public/assets | `public/assets/npc/senhorinha_retrato_64.png` | png | 64x64 | 0.8 | sim |  | em uso |  |
| public/assets | `public/assets/npc/senhorinha_spritesheet.png` | png | 128x320 | 8.5 | sim | 32x64 · 4x5 (20) | em uso |  |
| public/assets | `public/assets/npc/spitz_spritesheet.png` | png | 128x192 | 4.3 | sim | 32x32 · 4x6 (24) | em uso |  |
| public/assets | `public/assets/phone/app_classificados.png` | png | 32x32 | 0.3 | sim |  | em uso |  |
| public/assets | `public/assets/phone/celular_ameixa_tela_transparente.png` | png | 160x256 | 1.4 | sim |  | em uso |  |
| public/assets | `public/assets/phone/notificacao_bolinha.png` | png | 16x16 | 0.2 | **não** |  | em uso | fora da grade 32 (múltiplo de 16) |
| public/assets | `public/assets/phone/status_sinal_wifi_bateria.png` | png | 48x8 | 0.2 | **não** |  | em uso | fora da grade 32/16 |
| public/assets | `public/assets/placeholders/placeholders.png` | png | 32x32 | 0.3 | sim |  | sem referência | nenhuma referência |
| public/assets | `public/assets/street/winter/chao_winter.png` | png | 256x64 | 3.2 | sim | grade 32 · 8x2 | em uso |  |
| public/assets | `public/assets/street/winter/fachadas_winter.png` | png | 512x1024 | 44.2 | sim | grade 32 · 16x32 | em uso |  |
| public/assets | `public/assets/street/winter/neve_chao_winter.png` | png | 256x32 | 0.7 | sim | grade 32 · 8x1 | em uso |  |
| public/assets | `public/assets/street/winter/neve_fachadas_winter.png` | png | 512x1024 | 7.5 | sim | grade 32 · 16x32 | em uso |  |
| public/assets | `public/assets/street/winter/neve_monte_winter.png` | png | 128x32 | 0.3 | sim | grade 32 · 4x1 | em uso |  |
| public/assets | `public/assets/street/winter/neve_objetos_winter.png` | png | 512x128 | 1.3 | sim | grade 32 · 16x4 | em uso |  |
| public/assets | `public/assets/street/winter/objetos_winter.png` | png | 512x160 | 4.8 | sim | grade 32 · 16x5 | em uso |  |
| public/assets | `public/assets/tiles/cat-cafe-tileset-ext.png` | png | 256x416 | 26.3 | sim | grade 32 · 8x13 | em uso | nome fora de snake_case |
| public/assets | `public/assets/tiles/cat-cafe-tileset.png` | png | 256x352 | 13.3 | sim | grade 32 · 8x11 | fonte de importação | lido por scripts/build-worn-tiles.ts; o jogo carrega a versão -ext; nome fora de snake_case |
| public/assets | `public/assets/tools/vassoura_encostada.png` | png | 32x64 | 0.9 | sim |  | sem referência | nenhuma referência |
| public/assets | `public/assets/tools/vassoura_icone.png` | png | 32x32 | 0.7 | sim |  | em uso |  |
| public/assets | `public/assets/tools/vassoura_spritesheet.png` | png | 192x128 | 2.8 | sim | misto 64x64 + 32x32 (ver JSON) | sem referência | nenhuma referência |
| public/assets | `public/assets/tools/vassoura_v2_spritesheet.png` | png | 288x32 | 1.1 | sim | 32x32 · 9 | em uso |  |
| public/assets | `public/assets/vehicles/furgao_direita.png` | png | 188x106 | 2.2 | **não** |  | carregado, nunca exibido | carregado como van_right e nunca usado; fora da grade 32/16; pixel 2x (densidade diferente) |
| public/assets | `public/assets/vehicles/furgao_esquerda.png` | png | 188x107 | 2.3 | **não** |  | em uso | fora da grade 32/16; pixel 2x (densidade diferente) |
| Cosy-Cats-32x32 | `assets/Cosy-Cats-32x32/frames/biscuit/*` (**30 arquivos**, agrupados) | png | 32x32 | 17 (total) | sim |  | duplicata/peça solta |  |
| Cosy-Cats-32x32 | `assets/Cosy-Cats-32x32/frames/custard/*` (**30 arquivos**, agrupados) | png | 32x32 | 20 (total) | sim |  | duplicata/peça solta |  |
| Cosy-Cats-32x32 | `assets/Cosy-Cats-32x32/frames/domino/*` (**30 arquivos**, agrupados) | png | 32x32 | 15 (total) | sim |  | duplicata/peça solta |  |
| Cosy-Cats-32x32 | `assets/Cosy-Cats-32x32/frames/freckle/*` (**30 arquivos**, agrupados) | png | 32x32 | 18 (total) | sim |  | duplicata/peça solta |  |
| Cosy-Cats-32x32 | `assets/Cosy-Cats-32x32/frames/hazel/*` (**30 arquivos**, agrupados) | png | 32x32 | 20 (total) | sim |  | duplicata/peça solta |  |
| Cosy-Cats-32x32 | `assets/Cosy-Cats-32x32/frames/marmalade/*` (**30 arquivos**, agrupados) | png | 32x32 | 20 (total) | sim |  | duplicata/peça solta |  |
| Cosy-Cats-32x32 | `assets/Cosy-Cats-32x32/frames/midnight/*` (**30 arquivos**, agrupados) | png | 32x32 | 15 (total) | sim |  | duplicata/peça solta |  |
| Cosy-Cats-32x32 | `assets/Cosy-Cats-32x32/frames/misty/*` (**30 arquivos**, agrupados) | png | 32x32 | 15 (total) | sim |  | duplicata/peça solta |  |
| Cosy-Cats-32x32 | `assets/Cosy-Cats-32x32/frames/patches/*` (**30 arquivos**, agrupados) | png | 32x32 | 20 (total) | sim |  | duplicata/peça solta |  |
| Cosy-Cats-32x32 | `assets/Cosy-Cats-32x32/frames/pebble/*` (**30 arquivos**, agrupados) | png | 32x32 | 20 (total) | sim |  | duplicata/peça solta |  |
| Cosy-Cats-32x32 | `assets/Cosy-Cats-32x32/frames/snowdrop/*` (**30 arquivos**, agrupados) | png | 32x32 | 15 (total) | sim |  | duplicata/peça solta |  |
| Cosy-Cats-32x32 | `assets/Cosy-Cats-32x32/frames/toffee/*` (**30 arquivos**, agrupados) | png | 32x32 | 24 (total) | sim |  | duplicata/peça solta |  |
| Cosy-Cats-32x32 | `assets/Cosy-Cats-32x32/gifs/biscuit/*` (**1 arquivos**, agrupados) | gif | 128x128 | 69 (total) | sim | GIF · 62 quadros | preview/demo |  |
| Cosy-Cats-32x32 | `assets/Cosy-Cats-32x32/gifs/custard/*` (**1 arquivos**, agrupados) | gif | 128x128 | 70 (total) | sim | GIF · 64 quadros | preview/demo |  |
| Cosy-Cats-32x32 | `assets/Cosy-Cats-32x32/gifs/domino/*` (**1 arquivos**, agrupados) | gif | 128x128 | 60 (total) | sim | GIF · 60 quadros | preview/demo |  |
| Cosy-Cats-32x32 | `assets/Cosy-Cats-32x32/gifs/freckle/*` (**1 arquivos**, agrupados) | gif | 128x128 | 67 (total) | sim | GIF · 62 quadros | preview/demo |  |
| Cosy-Cats-32x32 | `assets/Cosy-Cats-32x32/gifs/hazel/*` (**1 arquivos**, agrupados) | gif | 128x128 | 70 (total) | sim | GIF · 62 quadros | preview/demo |  |
| Cosy-Cats-32x32 | `assets/Cosy-Cats-32x32/gifs/marmalade/*` (**1 arquivos**, agrupados) | gif | 128x128 | 70 (total) | sim | GIF · 64 quadros | preview/demo |  |
| Cosy-Cats-32x32 | `assets/Cosy-Cats-32x32/gifs/midnight/*` (**1 arquivos**, agrupados) | gif | 128x128 | 60 (total) | sim | GIF · 60 quadros | preview/demo |  |
| Cosy-Cats-32x32 | `assets/Cosy-Cats-32x32/gifs/misty/*` (**1 arquivos**, agrupados) | gif | 128x128 | 60 (total) | sim | GIF · 60 quadros | preview/demo |  |
| Cosy-Cats-32x32 | `assets/Cosy-Cats-32x32/gifs/patches/*` (**1 arquivos**, agrupados) | gif | 128x128 | 72 (total) | sim | GIF · 60 quadros | preview/demo |  |
| Cosy-Cats-32x32 | `assets/Cosy-Cats-32x32/gifs/pebble/*` (**1 arquivos**, agrupados) | gif | 128x128 | 70 (total) | sim | GIF · 64 quadros | preview/demo |  |
| Cosy-Cats-32x32 | `assets/Cosy-Cats-32x32/gifs/snowdrop/*` (**1 arquivos**, agrupados) | gif | 128x128 | 60 (total) | sim | GIF · 60 quadros | preview/demo |  |
| Cosy-Cats-32x32 | `assets/Cosy-Cats-32x32/gifs/toffee/*` (**1 arquivos**, agrupados) | gif | 128x128 | 80 (total) | sim | GIF · 60 quadros | preview/demo |  |
| Cosy-Cats-32x32 | `assets/Cosy-Cats-32x32/sheets_4x/biscuit/*` (**1 arquivos**, agrupados) | png | 768x896 | 13 (total) | sim | grade 32 · 24x28 | preview/demo |  |
| Cosy-Cats-32x32 | `assets/Cosy-Cats-32x32/sheets_4x/custard/*` (**1 arquivos**, agrupados) | png | 768x896 | 15 (total) | sim | grade 32 · 24x28 | preview/demo |  |
| Cosy-Cats-32x32 | `assets/Cosy-Cats-32x32/sheets_4x/domino/*` (**1 arquivos**, agrupados) | png | 768x896 | 13 (total) | sim | grade 32 · 24x28 | preview/demo |  |
| Cosy-Cats-32x32 | `assets/Cosy-Cats-32x32/sheets_4x/freckle/*` (**1 arquivos**, agrupados) | png | 768x896 | 15 (total) | sim | grade 32 · 24x28 | preview/demo |  |
| Cosy-Cats-32x32 | `assets/Cosy-Cats-32x32/sheets_4x/hazel/*` (**1 arquivos**, agrupados) | png | 768x896 | 15 (total) | sim | grade 32 · 24x28 | preview/demo |  |
| Cosy-Cats-32x32 | `assets/Cosy-Cats-32x32/sheets_4x/marmalade/*` (**1 arquivos**, agrupados) | png | 768x896 | 15 (total) | sim | grade 32 · 24x28 | preview/demo |  |
| Cosy-Cats-32x32 | `assets/Cosy-Cats-32x32/sheets_4x/midnight/*` (**1 arquivos**, agrupados) | png | 768x896 | 12 (total) | sim | grade 32 · 24x28 | preview/demo |  |
| Cosy-Cats-32x32 | `assets/Cosy-Cats-32x32/sheets_4x/misty/*` (**1 arquivos**, agrupados) | png | 768x896 | 12 (total) | sim | grade 32 · 24x28 | preview/demo |  |
| Cosy-Cats-32x32 | `assets/Cosy-Cats-32x32/sheets_4x/patches/*` (**1 arquivos**, agrupados) | png | 768x896 | 16 (total) | sim | grade 32 · 24x28 | preview/demo |  |
| Cosy-Cats-32x32 | `assets/Cosy-Cats-32x32/sheets_4x/pebble/*` (**1 arquivos**, agrupados) | png | 768x896 | 15 (total) | sim | grade 32 · 24x28 | preview/demo |  |
| Cosy-Cats-32x32 | `assets/Cosy-Cats-32x32/sheets_4x/snowdrop/*` (**1 arquivos**, agrupados) | png | 768x896 | 12 (total) | sim | grade 32 · 24x28 | preview/demo |  |
| Cosy-Cats-32x32 | `assets/Cosy-Cats-32x32/sheets_4x/toffee/*` (**1 arquivos**, agrupados) | png | 768x896 | 19 (total) | sim | grade 32 · 24x28 | preview/demo |  |
| Cosy-Cats-32x32 | `assets/Cosy-Cats-32x32/strips/biscuit/*` (**7 arquivos**, agrupados) | png | 192x32, 128x32 | 7 (total) | sim | 32x32 · 6, 32x32 · 4 | duplicata/peça solta |  |
| Cosy-Cats-32x32 | `assets/Cosy-Cats-32x32/strips/custard/*` (**7 arquivos**, agrupados) | png | 192x32, 128x32 | 9 (total) | sim | 32x32 · 6, 32x32 · 4 | duplicata/peça solta |  |
| Cosy-Cats-32x32 | `assets/Cosy-Cats-32x32/strips/domino/*` (**7 arquivos**, agrupados) | png | 192x32, 128x32 | 7 (total) | sim | 32x32 · 6, 32x32 · 4 | duplicata/peça solta |  |
| Cosy-Cats-32x32 | `assets/Cosy-Cats-32x32/strips/freckle/*` (**7 arquivos**, agrupados) | png | 192x32, 128x32 | 8 (total) | sim | 32x32 · 6, 32x32 · 4 | duplicata/peça solta |  |
| Cosy-Cats-32x32 | `assets/Cosy-Cats-32x32/strips/hazel/*` (**7 arquivos**, agrupados) | png | 192x32, 128x32 | 9 (total) | sim | 32x32 · 6, 32x32 · 4 | duplicata/peça solta |  |
| Cosy-Cats-32x32 | `assets/Cosy-Cats-32x32/strips/marmalade/*` (**7 arquivos**, agrupados) | png | 192x32, 128x32 | 9 (total) | sim | 32x32 · 6, 32x32 · 4 | duplicata/peça solta |  |
| Cosy-Cats-32x32 | `assets/Cosy-Cats-32x32/strips/midnight/*` (**7 arquivos**, agrupados) | png | 192x32, 128x32 | 6 (total) | sim | 32x32 · 6, 32x32 · 4 | duplicata/peça solta |  |
| Cosy-Cats-32x32 | `assets/Cosy-Cats-32x32/strips/misty/*` (**7 arquivos**, agrupados) | png | 192x32, 128x32 | 7 (total) | sim | 32x32 · 6, 32x32 · 4 | duplicata/peça solta |  |
| Cosy-Cats-32x32 | `assets/Cosy-Cats-32x32/strips/patches/*` (**7 arquivos**, agrupados) | png | 192x32, 128x32 | 9 (total) | sim | 32x32 · 6, 32x32 · 4 | duplicata/peça solta |  |
| Cosy-Cats-32x32 | `assets/Cosy-Cats-32x32/strips/pebble/*` (**7 arquivos**, agrupados) | png | 192x32, 128x32 | 9 (total) | sim | 32x32 · 6, 32x32 · 4 | duplicata/peça solta |  |
| Cosy-Cats-32x32 | `assets/Cosy-Cats-32x32/strips/snowdrop/*` (**7 arquivos**, agrupados) | png | 192x32, 128x32 | 7 (total) | sim | 32x32 · 6, 32x32 · 4 | duplicata/peça solta |  |
| Cosy-Cats-32x32 | `assets/Cosy-Cats-32x32/strips/toffee/*` (**7 arquivos**, agrupados) | png | 192x32, 128x32 | 11 (total) | sim | 32x32 · 6, 32x32 · 4 | duplicata/peça solta |  |
| personagem_principal | `assets/personagem_principal/personagem_principal/acessorio/*` (**14 arquivos**, agrupados) | png | 128x256 | 11 (total) | sim | 32x64 · 4x4 (16) | em uso | fora da paleta (parte dos arquivos) |
| personagem_principal | `assets/personagem_principal/personagem_principal/cabelo/*` (**64 arquivos**, agrupados) | png | 128x256 | 78 (total) | sim | 32x64 · 4x4 (16) | em uso | fora da paleta (parte dos arquivos) |
| personagem_principal | `assets/personagem_principal/personagem_principal/calca/*` (**18 arquivos**, agrupados) | png | 128x256 | 16 (total) | sim | 32x64 · 4x4 (16) | em uso | fora da paleta (parte dos arquivos) |
| personagem_principal | `assets/personagem_principal/personagem_principal/calcado/*` (**10 arquivos**, agrupados) | png | 128x256 | 8 (total) | sim | 32x64 · 4x4 (16) | em uso | fora da paleta (parte dos arquivos) |
| personagem_principal | `assets/personagem_principal/personagem_principal/camisa/*` (**56 arquivos**, agrupados) | png | 128x256 | 68 (total) | sim | 32x64 · 4x4 (16) | em uso | fora da paleta (parte dos arquivos) |
| personagem_principal | `assets/personagem_principal/personagem_principal/corpo/*` (**6 arquivos**, agrupados) | png | 128x256 | 11 (total) | sim | 32x64 · 4x4 (16) | em uso |  |
| personagem_principal | `assets/personagem_principal/personagem_principal/olhos/*` (**5 arquivos**, agrupados) | png | 128x256 | 3 (total) | sim | 32x64 · 4x4 (16) | em uso | fora da paleta (parte dos arquivos) |
| personagem_principal | `assets/personagem_principal/personagem_principal/poses/bandeja/camisa/*` (**56 arquivos**, agrupados) | png | 128x256 | 64 (total) | sim | 32x64 · 4x4 (16) | em uso | fora da paleta (parte dos arquivos) |
| personagem_principal | `assets/personagem_principal/personagem_principal/poses/bandeja/corpo/*` (**6 arquivos**, agrupados) | png | 128x256 | 11 (total) | sim | 32x64 · 4x4 (16) | em uso |  |
| personagem_principal | `assets/personagem_principal/personagem_principal/poses/bandeja/prop/*` (**2 arquivos**, agrupados) | png | 128x256 | 1 (total) | sim | 32x64 · 4x4 (16) | em uso |  |
| personagem_principal | `assets/personagem_principal/personagem_principal/poses/gato/camisa/*` (**56 arquivos**, agrupados) | png | 128x256 | 65 (total) | sim | 32x64 · 4x4 (16) | em uso | fora da paleta (parte dos arquivos) |
| personagem_principal | `assets/personagem_principal/personagem_principal/poses/gato/corpo/*` (**6 arquivos**, agrupados) | png | 128x256 | 11 (total) | sim | 32x64 · 4x4 (16) | em uso |  |
| personagem_principal | `assets/personagem_principal/personagem_principal/poses/gato/prop/*` (**8 arquivos**, agrupados) | png | 128x256 | 6 (total) | sim | 32x64 · 4x4 (16) | em uso |  |
| personagem_principal | `assets/personagem_principal/personagem_principal/poses/lavar/camisa/*` (**56 arquivos**, agrupados) | png | 128x256 | 58 (total) | sim | 32x64 · 4x4 (16) | em uso | fora da paleta (parte dos arquivos) |
| personagem_principal | `assets/personagem_principal/personagem_principal/poses/lavar/corpo/*` (**6 arquivos**, agrupados) | png | 128x256 | 9 (total) | sim | 32x64 · 4x4 (16) | em uso |  |
| personagem_principal | `assets/personagem_principal/personagem_principal/poses/lavar/prop/*` (**1 arquivos**, agrupados) | png | 128x256 | 1 (total) | sim | 32x64 · 4x4 (16) | em uso |  |
| personagem_principal | `assets/personagem_principal/personagem_principal/poses/*` (**3 arquivos**, agrupados) | md, json, png | —, 1364x320 | 16 (total) | **não** |  | metadado, preview/demo | fora da grade 32/16 |
| personagem_principal | `assets/personagem_principal/personagem_principal/poses/limpar_mesa/camisa/*` (**56 arquivos**, agrupados) | png | 128x256 | 61 (total) | sim | 32x64 · 4x4 (16) | em uso | fora da paleta (parte dos arquivos) |
| personagem_principal | `assets/personagem_principal/personagem_principal/poses/limpar_mesa/corpo/*` (**6 arquivos**, agrupados) | png | 128x256 | 10 (total) | sim | 32x64 · 4x4 (16) | em uso |  |
| personagem_principal | `assets/personagem_principal/personagem_principal/poses/limpar_mesa/prop/*` (**1 arquivos**, agrupados) | png | 128x256 | 1 (total) | sim | 32x64 · 4x4 (16) | em uso | fora da paleta (parte dos arquivos) |
| personagem_principal | `assets/personagem_principal/personagem_principal/poses/mexer/camisa/*` (**56 arquivos**, agrupados) | png | 128x256 | 60 (total) | sim | 32x64 · 4x4 (16) | em uso | fora da paleta (parte dos arquivos) |
| personagem_principal | `assets/personagem_principal/personagem_principal/poses/mexer/corpo/*` (**6 arquivos**, agrupados) | png | 128x256 | 10 (total) | sim | 32x64 · 4x4 (16) | em uso |  |
| personagem_principal | `assets/personagem_principal/personagem_principal/poses/mexer/prop/*` (**1 arquivos**, agrupados) | png | 128x256 | 1 (total) | sim | 32x64 · 4x4 (16) | em uso |  |
| personagem_principal | `assets/personagem_principal/personagem_principal/poses/operar/camisa/*` (**56 arquivos**, agrupados) | png | 128x256 | 57 (total) | sim | 32x64 · 4x4 (16) | em uso | fora da paleta (parte dos arquivos) |
| personagem_principal | `assets/personagem_principal/personagem_principal/poses/operar/corpo/*` (**6 arquivos**, agrupados) | png | 128x256 | 10 (total) | sim | 32x64 · 4x4 (16) | em uso |  |
| personagem_principal | `assets/personagem_principal/personagem_principal/poses/varrer/camisa/*` (**56 arquivos**, agrupados) | png | 128x256 | 57 (total) | sim | 32x64 · 4x4 (16) | em uso | fora da paleta (parte dos arquivos) |
| personagem_principal | `assets/personagem_principal/personagem_principal/poses/varrer/corpo/*` (**6 arquivos**, agrupados) | png | 128x256 | 9 (total) | sim | 32x64 · 4x4 (16) | em uso |  |
| personagem_principal | `assets/personagem_principal/personagem_principal/poses/varrer/prop/*` (**2 arquivos**, agrupados) | png | 128x256 | 1 (total) | sim | 32x64 · 4x4 (16) | em uso | fora da paleta (parte dos arquivos) |
| public/assets | `public/assets/characters/player/acessorio/*` (**14 arquivos**, agrupados) | png | 128x256 | 11 (total) | sim | 32x64 · 4x4 (16) | em uso | fora da paleta (parte dos arquivos) |
| public/assets | `public/assets/characters/player/cabelo/*` (**64 arquivos**, agrupados) | png | 128x256 | 78 (total) | sim | 32x64 · 4x4 (16) | em uso | fora da paleta (parte dos arquivos) |
| public/assets | `public/assets/characters/player/calca/*` (**18 arquivos**, agrupados) | png | 128x256 | 16 (total) | sim | 32x64 · 4x4 (16) | em uso | fora da paleta (parte dos arquivos) |
| public/assets | `public/assets/characters/player/calcado/*` (**10 arquivos**, agrupados) | png | 128x256 | 8 (total) | sim | 32x64 · 4x4 (16) | em uso | fora da paleta (parte dos arquivos) |
| public/assets | `public/assets/characters/player/camisa/*` (**56 arquivos**, agrupados) | png | 128x256 | 68 (total) | sim | 32x64 · 4x4 (16) | em uso | fora da paleta (parte dos arquivos) |
| public/assets | `public/assets/characters/player/corpo/*` (**6 arquivos**, agrupados) | png | 128x256 | 11 (total) | sim | 32x64 · 4x4 (16) | em uso |  |
| public/assets | `public/assets/characters/player/olhos/*` (**5 arquivos**, agrupados) | png | 128x256 | 3 (total) | sim | 32x64 · 4x4 (16) | em uso | fora da paleta (parte dos arquivos) |
| public/assets | `public/assets/characters/player/poses/bandeja/camisa/*` (**56 arquivos**, agrupados) | png | 128x256 | 64 (total) | sim | 32x64 · 4x4 (16) | em uso | fora da paleta (parte dos arquivos) |
| public/assets | `public/assets/characters/player/poses/bandeja/corpo/*` (**6 arquivos**, agrupados) | png | 128x256 | 11 (total) | sim | 32x64 · 4x4 (16) | em uso |  |
| public/assets | `public/assets/characters/player/poses/bandeja/prop/*` (**2 arquivos**, agrupados) | png | 128x256 | 1 (total) | sim | 32x64 · 4x4 (16) | em uso |  |
| public/assets | `public/assets/characters/player/poses/gato/camisa/*` (**56 arquivos**, agrupados) | png | 128x256 | 65 (total) | sim | 32x64 · 4x4 (16) | em uso | fora da paleta (parte dos arquivos) |
| public/assets | `public/assets/characters/player/poses/gato/corpo/*` (**6 arquivos**, agrupados) | png | 128x256 | 11 (total) | sim | 32x64 · 4x4 (16) | em uso |  |
| public/assets | `public/assets/characters/player/poses/gato/prop/*` (**8 arquivos**, agrupados) | png | 128x256 | 6 (total) | sim | 32x64 · 4x4 (16) | em uso |  |
| public/assets | `public/assets/characters/player/poses/lavar/camisa/*` (**56 arquivos**, agrupados) | png | 128x256 | 58 (total) | sim | 32x64 · 4x4 (16) | em uso | fora da paleta (parte dos arquivos) |
| public/assets | `public/assets/characters/player/poses/lavar/corpo/*` (**6 arquivos**, agrupados) | png | 128x256 | 9 (total) | sim | 32x64 · 4x4 (16) | em uso |  |
| public/assets | `public/assets/characters/player/poses/lavar/prop/*` (**1 arquivos**, agrupados) | png | 128x256 | 1 (total) | sim | 32x64 · 4x4 (16) | em uso |  |
| public/assets | `public/assets/characters/player/poses/limpar_mesa/camisa/*` (**56 arquivos**, agrupados) | png | 128x256 | 61 (total) | sim | 32x64 · 4x4 (16) | em uso | fora da paleta (parte dos arquivos) |
| public/assets | `public/assets/characters/player/poses/limpar_mesa/corpo/*` (**6 arquivos**, agrupados) | png | 128x256 | 10 (total) | sim | 32x64 · 4x4 (16) | em uso |  |
| public/assets | `public/assets/characters/player/poses/limpar_mesa/prop/*` (**1 arquivos**, agrupados) | png | 128x256 | 1 (total) | sim | 32x64 · 4x4 (16) | em uso | fora da paleta (parte dos arquivos) |
| public/assets | `public/assets/characters/player/poses/mexer/camisa/*` (**56 arquivos**, agrupados) | png | 128x256 | 60 (total) | sim | 32x64 · 4x4 (16) | em uso | fora da paleta (parte dos arquivos) |
| public/assets | `public/assets/characters/player/poses/mexer/corpo/*` (**6 arquivos**, agrupados) | png | 128x256 | 10 (total) | sim | 32x64 · 4x4 (16) | em uso |  |
| public/assets | `public/assets/characters/player/poses/mexer/prop/*` (**1 arquivos**, agrupados) | png | 128x256 | 1 (total) | sim | 32x64 · 4x4 (16) | em uso |  |
| public/assets | `public/assets/characters/player/poses/operar/camisa/*` (**56 arquivos**, agrupados) | png | 128x256 | 57 (total) | sim | 32x64 · 4x4 (16) | em uso | fora da paleta (parte dos arquivos) |
| public/assets | `public/assets/characters/player/poses/operar/corpo/*` (**6 arquivos**, agrupados) | png | 128x256 | 10 (total) | sim | 32x64 · 4x4 (16) | em uso |  |
| public/assets | `public/assets/characters/player/poses/varrer/camisa/*` (**56 arquivos**, agrupados) | png | 128x256 | 57 (total) | sim | 32x64 · 4x4 (16) | em uso | fora da paleta (parte dos arquivos) |
| public/assets | `public/assets/characters/player/poses/varrer/corpo/*` (**6 arquivos**, agrupados) | png | 128x256 | 9 (total) | sim | 32x64 · 4x4 (16) | em uso |  |
| public/assets | `public/assets/characters/player/poses/varrer/prop/*` (**2 arquivos**, agrupados) | png | 128x256 | 1 (total) | sim | 32x64 · 4x4 (16) | em uso | fora da paleta (parte dos arquivos) |

</details>

## 3. Inconsistências visuais

Severidade: **Alta** = aparece junto na tela hoje ou bloqueia a próxima fase · **Média** = vai aparecer junto quando a fase chegar · **Baixa** = cosmético/variação aceitável.

| # | Asset A | Asset B | Problema | Referência sugerida | Ação recomendada | Severidade |
|---|---|---|---|---|---|---|
| 1 | `fluxo/balcoes.png` (balcão marrom com gavetas; `item.counter_left/mid/right`) | `counter_single`, `counter_register`, `display_case` (Cat Cafe, rosa listrado, tampo creme) | Mesmo balcão do café com dois estilos: as pontas e o meio são de madeira, o caixa e a vitrine são rosa. | Cat Cafe (artista de referência; combina com paredes/pisos do café) | Trocar os 3 itens para `counter_left/mid/right` do Cat Cafe (já estão na folha, custo zero) **ou** pedir caixa e vitrine marrons ao gerador do fluxo. Ajustar `balcao_marcador_*` ao balcão escolhido. | Alta |
| 2 | `mulher_placeholder_32x64.png` (jogadora antiga) | Gabi, clientes, `personagem_principal` | Corpo mais fino e alto, sem bochecha rosada, contorno fino. | `personagem_principal` | **Resolvido** pelo criador de personagem (`f08aec4`); o placeholder sai da pasta do jogo. | — |
| 3 | Humanos: `clientes/*`, `personagem_principal/*`, `gabi`, `senhorinha`, `entregadora`, `corretora` | Cosy Cats e Cat Cafe | Fora da paleta Cosy (10–30% dos pixels, distância média 13–16), pele e roupas com tons próprios. Clientes: contorno mais escuro e sem blush; NPCs com nome: blush rosa e cabeça mais larga. | Paleta `cosy-palette.gpl`; rosto dos NPCs com nome (Gabi) | Quantizar todos os humanos para a paleta (script, sem redesenho) e padronizar cor do contorno e o blush dos clientes. | Alta |
| 4 | `vehicles/furgao_*.png` | todo o resto | Densidade de pixel 2x (pixels com o dobro do tamanho): reduzido pela metade de um original 4x, mas ficou em 2x. | Grade 1x | Refazer o furgão em densidade 1x (ex.: 128x96, base alinhada à grade). | Alta |
| 5 | `fluxo/louca_16.png` (xícara 16x16 nas mesas) | `louca_tileset.png` (32x32) e ícones de bebida (`itens_bebidas`, `fluxo_icones`) | A mesma xícara em 3 tamanhos/desenhos: 16 px (mundo), ~26 px (louça 32), ~22–24 px (ícones). Prato 16 é oval em 3/4; prato 32 é uma barra achatada (outra perspectiva). | Mundo: louça 16 (escala certa sobre `table_round`). Ícones/HUD: louça 32 | Regra: no mundo, louça 16x16; na mão/HUD, 32x32. Redesenhar pratos 32 em 3/4 oval como os 16. | Média |
| 6 | Bule: `eq_bule` (equipamentos, menta sobre base rosa) | `teapot` (Cat Cafe, menta com círculo rosa) e bule do `itens_bebidas` (rosa) | Três bules diferentes; o ícone de receita não parece o equipamento. | `equipamentos_spritesheet` (em uso, animado) | Refazer o ícone de bule de `itens_bebidas` com o desenho do equipamento; não usar o `teapot` do Cat Cafe como decoração. | Média |
| 7 | `coffee_machine` (Cat Cafe, cinza compacta) | `eq_cafeteira` (fluxo, rosa, 6 quadros) | Duas cafeteiras; o tile do Cat Cafe tem o mesmo nome do item `item.coffee_machine` mas nunca é exibido. | Cafeteira do fluxo | Não usar o tile `coffee_machine`; documentar no catálogo para evitar confusão. | Baixa |
| 8 | Vassouras: `vassoura_v2` (32x32, ~16 px) | `vassoura` antiga (64x64) e prop de `poses/varrer` | Três vassouras; a nova é pequena perto da personagem de ~52 px; a das poses já vem alinhada ao corpo. | Prop de `personagem_principal/poses/varrer` | Ao fazer o criador, usar a pose `varrer` e aposentar `vassoura_v2` e a antiga. | Média |
| 9 | `npc/spitz_spritesheet.png` (Joca) | Cosy Cats | Contorno preto puro (os gatos usam marrom-escuro), e o cão é maior que os gatos adultos. | Cosy Cats | Recolorir o contorno para o marrom da paleta; reduzir 2–4 px de altura. | Média |
| 10 | Porta do café **por fora** (`shop_*` da rua: porta rosa) | Porta **por dentro** (`door` do Cat Cafe: verde com placa) | A mesma porta muda de cor ao entrar. | Decidir uma (sugestão: verde, já usada dentro e na `porta_verde` da expansão) | Ajustar a porta das fachadas `shop_*` (ou a interna). | Baixa (decidido: deixar como está) |
| 11 | Pisos de madeira Cat Cafe (`floor_wood_a/b`) | `piso_madeira_a/b` (tilesets_expansao) | Tábuas de largura e brilho diferentes; ~80% dos pixels fora da paleta exata. Na rolagem contínua salão→cozinha, a emenda fica visível. | Cat Cafe | Gerar os pisos dos novos cômodos a partir do Cat Cafe (como já é feito com os pisos gastos). | Média |
| 12 | Quintal secreto (A e B): sebes, gramas, móveis | Cat Cafe / rua | Sem contorno escuro, textura ruidosa nas sebes, verdes fora da paleta (sebes 56–74%, `arbusto_lima` 89%); `mesa_redonda_branca` (64x64) parece esfera/luminária; móveis pequenos para a área. | Rua (`objetos_*`) e terrenos da expansão | Refazer sebes e gramas na paleta com contorno; refazer a mesa redonda em 3/4. | Média |
| 13 | Grama: `quintal_secreto/grama_a`, `variante_tijolo/grama_a`, `terrenos/grama_summer`, grama de `chao_*` (rua) | entre si | Quatro verdes diferentes para o mesmo chão. | `terrenos/grama_*` (4 estações + autotile 47) | Padronizar todo chão de grama nos terrenos da expansão. | Média |
| 14 | Árvore de gato: `cat_tree` (Cat Cafe, lilás 2x3) | `market_arvore_gato` (mercado, bege 1x2) e `arvore_gato_externa` | O que a prateleira pet mostra não é o que se compra/coloca no café. Mesmo para arranhador, caminha e tigela de água (3 desenhos cada). | Cat Cafe (é o que vira item) | Nas prateleiras/vitrines do mercado, usar miniaturas dos itens Cat Cafe; deixar as versões externas só no quintal. | Baixa |
| 15 | `fluxo_cafe_onda1/icones/ingredientes/*` | `materia_prima_tileset` | Mesmo desenho (pó, grãos, filtro, saquinhos, polpas, açúcar, leite em pó), pixels quase iguais. | `materia_prima` (em uso) | Arquivar os de `fluxo/ingredientes`. | Baixa |
| 16 | `bolo_fatia`, `pao`, `biscoito` (fluxo, em uso) | `cake_slice`, `croissant`, `cookie_jar` (Cat Cafe, sem uso) | Comidas com desenho diferente; hoje não aparecem juntas. | Fluxo (em uso, com bandeja) | Não usar as comidas do Cat Cafe como decoração do balcão, ou refazê-las. | Baixa |
| 17 | `window` (Cat Cafe 2x2) | `janela_cortina_rosa` (expansão 2x2) | Duas janelas quase iguais (cortina ondulada x reta). | Cat Cafe | Usar uma só nos interiores. | Baixa |
| 18 | Retratos 64x64 | Sprites 32x64 | Retratos com blocos grandes e rosto simplificado; aceitável para diálogo. | — | Revisar quando houver mais retratos. | Baixa |
| 19 | Sombras projetadas | entre pacotes | Não há sombras em direções conflitantes; a diferença é presença/ausência: `table_round` (Cat Cafe) e poucos objetos têm sombra oval cinza no chão, os pacotes de IA quase nunca têm. | Cat Cafe | Decidir "sombra oval sob móveis de chão" para todos ou para nenhum. | Baixa |
| 20 | Rua: 4 estações | entre si | **Coerente**: fachadas, árvores, postes e chão mantêm posição, tamanho e contorno nas 4 estações; o inverno tem a neve em camada separada como o LEIA-ME promete. Só o outono tem `pumpkins` e só o inverno tem a loja velha e as caixas de gato, de propósito. | — | Nenhuma. | — |
| 21 | Paredes Cat Cafe | Paredes da expansão | **Compatíveis**: ambas usam 2 linhas de papel + 1 de lambri (3 tiles de altura), visão de frente. | — | Nenhuma; só manter a mesma altura nos novos cômodos. | — |

## 4. Assets não utilizados ou duplicados

Agrupado por pasta quando há muitos arquivos do mesmo caso. "Arquivar" = ficar só em `assets/_originais_pacotes/` (não vai para o jogo); "apagar" só onde o arquivo é 100% regenerável ou repetido.

| Arquivo(s) | Status | Motivo | Sugestão |
|---|---|---|---|
| `assets/Cat-Cafe-32x32/objects/`: 58 arquivos (bookshelf.png, cactus.png, cake_slice.png, cake_stand.png, …) | duplicata/peça solta | peça solta; o jogo usa a folha cat-cafe-tileset | arquivar (fica no original do pacote) |
| `assets/Cat-Cafe-32x32/preview/cat-cafe-tileset_2x.png`<br>`assets/Cat-Cafe-32x32/preview/sample-cafe.png`<br>`assets/Cat-Cafe-32x32/preview/sample-cafe_2x.png` | preview/demo | preview/demo/referência | arquivar (`_referencia/`) |
| `assets/Cosy-Cats-32x32/frames/biscuit/`: 30 arquivos (play_0.png, play_1.png, play_2.png, play_3.png, …) | duplicata/peça solta | quadro/tira derivado das sheets | arquivar (fica no original do pacote) |
| `assets/Cosy-Cats-32x32/frames/custard/`: 30 arquivos (play_0.png, play_1.png, play_2.png, play_3.png, …) | duplicata/peça solta | quadro/tira derivado das sheets | arquivar (fica no original do pacote) |
| `assets/Cosy-Cats-32x32/frames/domino/`: 30 arquivos (play_0.png, play_1.png, play_2.png, play_3.png, …) | duplicata/peça solta | quadro/tira derivado das sheets | arquivar (fica no original do pacote) |
| `assets/Cosy-Cats-32x32/frames/freckle/`: 30 arquivos (play_0.png, play_1.png, play_2.png, play_3.png, …) | duplicata/peça solta | quadro/tira derivado das sheets | arquivar (fica no original do pacote) |
| `assets/Cosy-Cats-32x32/frames/hazel/`: 30 arquivos (play_0.png, play_1.png, play_2.png, play_3.png, …) | duplicata/peça solta | quadro/tira derivado das sheets | arquivar (fica no original do pacote) |
| `assets/Cosy-Cats-32x32/frames/marmalade/`: 30 arquivos (play_0.png, play_1.png, play_2.png, play_3.png, …) | duplicata/peça solta | quadro/tira derivado das sheets | arquivar (fica no original do pacote) |
| `assets/Cosy-Cats-32x32/frames/midnight/`: 30 arquivos (play_0.png, play_1.png, play_2.png, play_3.png, …) | duplicata/peça solta | quadro/tira derivado das sheets | arquivar (fica no original do pacote) |
| `assets/Cosy-Cats-32x32/frames/misty/`: 30 arquivos (play_0.png, play_1.png, play_2.png, play_3.png, …) | duplicata/peça solta | quadro/tira derivado das sheets | arquivar (fica no original do pacote) |
| `assets/Cosy-Cats-32x32/frames/patches/`: 30 arquivos (play_0.png, play_1.png, play_2.png, play_3.png, …) | duplicata/peça solta | quadro/tira derivado das sheets | arquivar (fica no original do pacote) |
| `assets/Cosy-Cats-32x32/frames/pebble/`: 30 arquivos (play_0.png, play_1.png, play_2.png, play_3.png, …) | duplicata/peça solta | quadro/tira derivado das sheets | arquivar (fica no original do pacote) |
| `assets/Cosy-Cats-32x32/frames/snowdrop/`: 30 arquivos (play_0.png, play_1.png, play_2.png, play_3.png, …) | duplicata/peça solta | quadro/tira derivado das sheets | arquivar (fica no original do pacote) |
| `assets/Cosy-Cats-32x32/frames/toffee/`: 30 arquivos (play_0.png, play_1.png, play_2.png, play_3.png, …) | duplicata/peça solta | quadro/tira derivado das sheets | arquivar (fica no original do pacote) |
| `assets/Cosy-Cats-32x32/gifs/`: 12 arquivos (biscuit.gif, custard.gif, domino.gif, freckle.gif, …) | preview/demo | preview/demo/referência | arquivar (`_referencia/`) |
| `assets/Cosy-Cats-32x32/sheets_4x/`: 12 arquivos (biscuit_4x.png, custard_4x.png, domino_4x.png, freckle_4x.png, …) | preview/demo | preview/demo/referência | arquivar (`_referencia/`) |
| `assets/Cosy-Cats-32x32/sheets/pebble.png` | referenciado nos dados, não carregado | cópias em public/assets/cats/; Tekinha: memory=true, não é carregada | manter (gatos futuros); carregar só quando um gato usar |
| `assets/Cosy-Cats-32x32/sheets/`: 10 arquivos (biscuit.png, custard.png, domino.png, freckle.png, …) | referenciado nos dados, não carregado | cópias em public/assets/cats/; listado em cat_sprites.json; nenhum gato usa a variante | manter (gatos futuros); carregar só quando um gato usar |
| `assets/Cosy-Cats-32x32/strips/biscuit/`: 7 arquivos (play.png, sit.png, sleep.png, walk_down.png, …) | duplicata/peça solta | quadro/tira derivado das sheets | arquivar (fica no original do pacote) |
| `assets/Cosy-Cats-32x32/strips/custard/`: 7 arquivos (play.png, sit.png, sleep.png, walk_down.png, …) | duplicata/peça solta | quadro/tira derivado das sheets | arquivar (fica no original do pacote) |
| `assets/Cosy-Cats-32x32/strips/domino/`: 7 arquivos (play.png, sit.png, sleep.png, walk_down.png, …) | duplicata/peça solta | quadro/tira derivado das sheets | arquivar (fica no original do pacote) |
| `assets/Cosy-Cats-32x32/strips/freckle/`: 7 arquivos (play.png, sit.png, sleep.png, walk_down.png, …) | duplicata/peça solta | quadro/tira derivado das sheets | arquivar (fica no original do pacote) |
| `assets/Cosy-Cats-32x32/strips/hazel/`: 7 arquivos (play.png, sit.png, sleep.png, walk_down.png, …) | duplicata/peça solta | quadro/tira derivado das sheets | arquivar (fica no original do pacote) |
| `assets/Cosy-Cats-32x32/strips/marmalade/`: 7 arquivos (play.png, sit.png, sleep.png, walk_down.png, …) | duplicata/peça solta | quadro/tira derivado das sheets | arquivar (fica no original do pacote) |
| `assets/Cosy-Cats-32x32/strips/midnight/`: 7 arquivos (play.png, sit.png, sleep.png, walk_down.png, …) | duplicata/peça solta | quadro/tira derivado das sheets | arquivar (fica no original do pacote) |
| `assets/Cosy-Cats-32x32/strips/misty/`: 7 arquivos (play.png, sit.png, sleep.png, walk_down.png, …) | duplicata/peça solta | quadro/tira derivado das sheets | arquivar (fica no original do pacote) |
| `assets/Cosy-Cats-32x32/strips/patches/`: 7 arquivos (play.png, sit.png, sleep.png, walk_down.png, …) | duplicata/peça solta | quadro/tira derivado das sheets | arquivar (fica no original do pacote) |
| `assets/Cosy-Cats-32x32/strips/pebble/`: 7 arquivos (play.png, sit.png, sleep.png, walk_down.png, …) | duplicata/peça solta | quadro/tira derivado das sheets | arquivar (fica no original do pacote) |
| `assets/Cosy-Cats-32x32/strips/snowdrop/`: 7 arquivos (play.png, sit.png, sleep.png, walk_down.png, …) | duplicata/peça solta | quadro/tira derivado das sheets | arquivar (fica no original do pacote) |
| `assets/Cosy-Cats-32x32/strips/toffee/`: 7 arquivos (play.png, sit.png, sleep.png, walk_down.png, …) | duplicata/peça solta | quadro/tira derivado das sheets | arquivar (fica no original do pacote) |
| `assets/catalogo_compras/pack/catalogo/icones/`: 15 arquivos (areia_64.png, caixa_areia_64.png, calabresa_64.png, carne_64.png, …) | duplicata/peça solta | ampliação 2x de ícone (não usada) | apagar (gerável a qualquer momento) |
| `assets/catalogo_compras/pack/catalogo/icones/`: 15 arquivos (areia.png, caixa_areia.png, calabresa.png, carne.png, …) | duplicata/peça solta | peça solta; o jogo usa catalogo_icones | arquivar (fica no original do pacote) |
| `assets/catalogo_compras/pack/catalogo/catalogo_rotulado.png` | preview/demo | preview/demo/referência | arquivar (`_referencia/`) |
| `assets/celular/pack/celular/icones/`: 8 arquivos (app_banco.png, app_contatos.png, app_gatos.png, app_ligacoes.png, …) | sem referência | nenhuma referência | revisar: manter se previsto no design, senão arquivar |
| `assets/celular/pack/celular/molduras/celular_ameixa_9slice_48.png`<br>`assets/celular/pack/celular/molduras/celular_ameixa_tela_apagada.png`<br>`assets/celular/pack/celular/molduras/celular_ameixa_tela_escura.png`<br>`assets/celular/pack/celular/molduras/celular_creme_tela_transparente.png`<br>`assets/celular/pack/celular/molduras/celular_menta_tela_transparente.png`<br>`assets/celular/pack/celular/molduras/celular_rosa_tela_transparente.png` | sem referência | nenhuma referência | revisar: manter se previsto no design, senão arquivar |
| `assets/celular/pack/celular/celular_preview.png` | preview/demo | preview/demo/referência | arquivar (`_referencia/`) |
| `assets/clientes/clientes/clientes_preview.png`<br>`assets/clientes/clientes/clientes_todos_sheets.png` | preview/demo | preview/demo/referência | arquivar (`_referencia/`) |
| `assets/clientes/clientes/`: 10 arquivos (cliente_01_homem_negro_barba_oculos_parado.png, cliente_02_mulher_negra_black_power_parado.png, cliente_03_homem_ruivo_bone_parado.png, cliente_04_mulher_asiatica_cabelo_longo_parado.png, …) | sem referência | nenhuma referência | revisar: manter se previsto no design, senão arquivar |
| `assets/correio/furgao_direita.png` | carregado, nunca exibido | cópias em public/assets/vehicles/; carregado como van_right e nunca usado | manter e usar no retorno do furgão, ou parar de carregar |
| `assets/correio/entregadora_original_4x.png`<br>`assets/correio/furgao_original_2x.png` | preview/demo | preview/demo/referência | arquivar (`_referencia/`) |
| `assets/corretora_e_vassoura/pack/personagens/frames/`: 20 arquivos (corretora_baixo_0.png, corretora_baixo_1.png, corretora_baixo_2.png, corretora_baixo_3.png, …) | duplicata/peça solta | quadros soltos da corretora | arquivar (fica no original do pacote) |
| `assets/corretora_e_vassoura/pack/personagens/corretora_andando.gif`<br>`assets/corretora_e_vassoura/pack/personagens/corretora_preview_4x.png` | preview/demo | preview/demo/referência | arquivar (`_referencia/`) |
| `assets/corretora_e_vassoura/pack/personagens/placa_vende_se.png` | sem referência | nenhuma referência | revisar: manter se previsto no design, senão arquivar |
| `assets/corretora_e_vassoura/pack/vassoura/frames/`: 9 arquivos (brilho_limpo_1.png, brilho_limpo_2.png, brilho_limpo_3.png, poeira_1.png, …) | sem referência | vassoura antiga (substituída por vassoura_nova) | arquivar |
| `assets/corretora_e_vassoura/pack/vassoura/vassoura_demo_limpeza.gif`<br>`assets/corretora_e_vassoura/pack/vassoura/vassoura_preview_4x.png` | preview/demo | preview/demo/referência | arquivar (`_referencia/`) |
| `assets/corretora_e_vassoura/pack/vassoura/vassoura_encostada.png`<br>`assets/corretora_e_vassoura/pack/vassoura/vassoura_spritesheet.png` | sem referência | cópias em public/assets/tools/; nenhuma referência | revisar: manter se previsto no design, senão arquivar |
| `assets/cozinha_cafe/cozinha_cafe_original.png` | preview/demo | preview/demo/referência | arquivar (`_referencia/`) |
| `assets/cozinha_cafe/cafeteira_spritesheet.png` | sem referência | versão antiga; substituída pela cafeteira do fluxo | arquivar |
| `assets/equipamentos/equipamentos_original.png` | preview/demo | preview/demo/referência | arquivar (`_referencia/`) |
| `assets/fluxo_cafe_onda1/fluxo_cafe/estacoes/demo_balcao.png` | preview/demo | preview/demo/referência | arquivar (`_referencia/`) |
| `assets/fluxo_cafe_onda1/fluxo_cafe/icones/ingredientes/`: 10 arquivos (acucar_pacote.png, filtro_papel.png, graos_cafe_saco.png, leite_po_lata.png, …) | duplicata/peça solta | mesmo desenho do ícone de materia_prima (quase idêntico) | apagar após confirmar (duplicado) |
| `assets/fluxo_cafe_onda1/fluxo_cafe/louca/`: 9 arquivos (copo_cheia.png, copo_limpa.png, copo_suja.png, prato_cheia.png, …) | duplicata/peça solta | peça solta; o jogo usa louca_tileset_16 | arquivar (fica no original do pacote) |
| `assets/fluxo_cafe_onda1/fluxo_cafe/personagem_carregando/exemplo_item_na_mao.png`<br>`assets/fluxo_cafe_onda1/fluxo_cafe/personagem_carregando/preview_carregando.png` | preview/demo | preview/demo/referência | arquivar (`_referencia/`) |
| `assets/fluxo_cafe_onda1/fluxo_cafe/personagem_carregando/gabi_carrega_bandeja.png`<br>`assets/fluxo_cafe_onda1/fluxo_cafe/personagem_carregando/gabi_carrega_gato.png`<br>`assets/fluxo_cafe_onda1/fluxo_cafe/personagem_carregando/gabi_carrega_item.png`<br>`assets/fluxo_cafe_onda1/fluxo_cafe/personagem_carregando/gabi_carrega_saco_pesado.png` | sem referência | nenhuma referência | revisar: manter se previsto no design, senão arquivar |
| `assets/fluxo_cafe_onda1/fluxo_cafe/ui/etiqueta_preco.png` | sem referência | cópias em public/assets/fluxo/ui/; nenhuma referência | revisar: manter se previsto no design, senão arquivar |
| `assets/fluxo_cafe_onda1/fluxo_cafe/ui/icone_bandeja.png`<br>`assets/fluxo_cafe_onda1/fluxo_cafe/ui/icone_louca_suja.png`<br>`assets/fluxo_cafe_onda1/fluxo_cafe/ui/icone_mao.png`<br>`assets/fluxo_cafe_onda1/fluxo_cafe/ui/moeda_32.png`<br>`assets/fluxo_cafe_onda1/fluxo_cafe/ui/slot_mao_selecionado.png`<br>`assets/fluxo_cafe_onda1/fluxo_cafe/ui/slot_mao_vazio.png` | sem referência | nenhuma referência | revisar: manter se previsto no design, senão arquivar |
| `assets/fluxo_cafe_onda1/fluxo_cafe/preview_onda1.png` | preview/demo | preview/demo/referência | arquivar (`_referencia/`) |
| `assets/gabi_e_joca/gabi_caixa.gif` | sem referência | cópias em public/assets/npc/; nenhuma referência | revisar: manter se previsto no design, senão arquivar |
| `assets/louca/louca_original.png` | preview/demo | preview/demo/referência | arquivar (`_referencia/`) |
| `assets/materia_prima/fruta_laranja.png`<br>`assets/materia_prima/fruta_limao.png` | duplicata/peça solta | peça solta; o jogo usa materia_prima_tileset | arquivar (fica no original do pacote) |
| `assets/mercado_interior/pack/mercado_interior/pecas/`: 52 arquivos (aquario.png, arranhador.png, arvore_gato.png, balcao_dir.png, …) | duplicata/peça solta | peça solta; o jogo usa mercado_interior_tileset | arquivar (fica no original do pacote) |
| `assets/mercado_interior/pack/mercado_interior/mercado_interior_cena.png`<br>`assets/mercado_interior/pack/mercado_interior/mercado_interior_cena_2x.png`<br>`assets/mercado_interior/pack/mercado_interior/mercado_interior_rotulado.png` | preview/demo | preview/demo/referência | arquivar (`_referencia/`) |
| `assets/personagem_principal/personagem_principal/poses/preview_poses.png` | preview/demo | preview/demo/referência | arquivar (`_referencia/`) |
| `assets/personagem_principal/personagem_principal/preview_exemplos.png` | preview/demo | preview/demo/referência | arquivar (`_referencia/`) |
| `assets/pia/pia/`: 7 arquivos (pia_com_louca.png, pia_lavando_1.png, pia_lavando_2.png, pia_lavando_3.png, …) | duplicata/peça solta | quadro solto; o jogo usa pia_sheet | arquivar (fica no original do pacote) |
| `assets/pia/pia/pia_preview_5x.png` | preview/demo | preview/demo/referência | arquivar (`_referencia/`) |
| `assets/quintal_secreto/pack/quintal_secreto/pecas/`: 27 arquivos (bancada_forno_pedra.png, banco_rustico_vasos.png, banquinho_ceramica.png, brilho_quente_32.png, …) | sem referência | nenhuma referência | revisar: manter se previsto no design, senão arquivar |
| `assets/quintal_secreto/pack/quintal_secreto/variante_tijolo/pecas/`: 23 arquivos (arbusto_lima.png, arvore_grande_a.png, arvore_grande_b.png, canteiro_azul.png, …) | sem referência | nenhuma referência | revisar: manter se previsto no design, senão arquivar |
| `assets/quintal_secreto/pack/quintal_secreto/variante_tijolo/quintal_tijolo_dia_2x.png`<br>`assets/quintal_secreto/pack/quintal_secreto/variante_tijolo/quintal_tijolo_pecas_rotulado.png` | preview/demo | preview/demo/referência | arquivar (`_referencia/`) |
| `assets/quintal_secreto/pack/quintal_secreto/variante_tijolo/pedra_irregular_sobre_grama_autotile47.png`<br>`assets/quintal_secreto/pack/quintal_secreto/variante_tijolo/quintal_tijolo_dia.png` | sem referência | nenhuma referência | revisar: manter se previsto no design, senão arquivar |
| `assets/quintal_secreto/pack/quintal_secreto/quintal_secreto_pecas_rotulado.png` | preview/demo | preview/demo/referência | arquivar (`_referencia/`) |
| `assets/quintal_secreto/pack/quintal_secreto/quintal_secreto_dia.png`<br>`assets/quintal_secreto/pack/quintal_secreto/quintal_secreto_entardecer.png`<br>`assets/quintal_secreto/pack/quintal_secreto/quintal_secreto_tileset.png` | sem referência | nenhuma referência | revisar: manter se previsto no design, senão arquivar |
| `assets/rua_estacoes_tilesets/pack/autumn/door_frames/shop_door_ceu_3frames.png`<br>`assets/rua_estacoes_tilesets/pack/autumn/door_frames/shop_door_menta_3frames.png`<br>`assets/rua_estacoes_tilesets/pack/autumn/door_frames/shop_door_rosa_3frames.png` | duplicata/peça solta | versão solta da pasta da estação; o jogo usa pack/tilesets/ | arquivar (fica no original do pacote) |
| `assets/rua_estacoes_tilesets/pack/autumn/facades/`: 8 arquivos (furniture_shop.png, house_a.png, house_b.png, house_c.png, …) | duplicata/peça solta | versão solta da pasta da estação; o jogo usa pack/tilesets/ | arquivar (fica no original do pacote) |
| `assets/rua_estacoes_tilesets/pack/autumn/preview/opcoes_fachada_autumn.png`<br>`assets/rua_estacoes_tilesets/pack/autumn/preview/rua_autumn_ceu_2x.png`<br>`assets/rua_estacoes_tilesets/pack/autumn/preview/rua_autumn_menta_2x.png`<br>`assets/rua_estacoes_tilesets/pack/autumn/preview/rua_autumn_rosa_2x.png` | preview/demo | preview/demo/referência | arquivar (`_referencia/`) |
| `assets/rua_estacoes_tilesets/pack/autumn/props/`: 15 arquivos (bench.png, bin.png, chalkboard_cafe.png, crate_apples.png, …) | duplicata/peça solta | versão solta da pasta da estação; o jogo usa pack/tilesets/ | arquivar (fica no original do pacote) |
| `assets/rua_estacoes_tilesets/pack/autumn/scenes/rua_autumn_ceu.png`<br>`assets/rua_estacoes_tilesets/pack/autumn/scenes/rua_autumn_menta.png`<br>`assets/rua_estacoes_tilesets/pack/autumn/scenes/rua_autumn_rosa.png` | preview/demo | preview/demo/referência | arquivar (`_referencia/`) |
| `assets/rua_estacoes_tilesets/pack/autumn/tiles/ground_tileset.png` | duplicata/peça solta | versão solta da pasta da estação; o jogo usa pack/tilesets/ | arquivar (fica no original do pacote) |
| `assets/rua_estacoes_tilesets/pack/spring/door_frames/shop_door_ceu_3frames.png`<br>`assets/rua_estacoes_tilesets/pack/spring/door_frames/shop_door_menta_3frames.png`<br>`assets/rua_estacoes_tilesets/pack/spring/door_frames/shop_door_rosa_3frames.png` | duplicata/peça solta | versão solta da pasta da estação; o jogo usa pack/tilesets/ | arquivar (fica no original do pacote) |
| `assets/rua_estacoes_tilesets/pack/spring/facades/`: 8 arquivos (furniture_shop.png, house_a.png, house_b.png, house_c.png, …) | duplicata/peça solta | versão solta da pasta da estação; o jogo usa pack/tilesets/ | arquivar (fica no original do pacote) |
| `assets/rua_estacoes_tilesets/pack/spring/preview/opcoes_fachada_spring.png`<br>`assets/rua_estacoes_tilesets/pack/spring/preview/rua_spring_ceu_2x.png`<br>`assets/rua_estacoes_tilesets/pack/spring/preview/rua_spring_menta_2x.png`<br>`assets/rua_estacoes_tilesets/pack/spring/preview/rua_spring_rosa_2x.png` | preview/demo | preview/demo/referência | arquivar (`_referencia/`) |
| `assets/rua_estacoes_tilesets/pack/spring/props/`: 14 arquivos (bench.png, bin.png, chalkboard_cafe.png, crate_apples.png, …) | duplicata/peça solta | versão solta da pasta da estação; o jogo usa pack/tilesets/ | arquivar (fica no original do pacote) |
| `assets/rua_estacoes_tilesets/pack/spring/scenes/rua_spring_ceu.png`<br>`assets/rua_estacoes_tilesets/pack/spring/scenes/rua_spring_menta.png`<br>`assets/rua_estacoes_tilesets/pack/spring/scenes/rua_spring_rosa.png` | preview/demo | preview/demo/referência | arquivar (`_referencia/`) |
| `assets/rua_estacoes_tilesets/pack/spring/tiles/ground_tileset.png` | duplicata/peça solta | versão solta da pasta da estação; o jogo usa pack/tilesets/ | arquivar (fica no original do pacote) |
| `assets/rua_estacoes_tilesets/pack/summer/door_frames/shop_door_ceu_3frames.png`<br>`assets/rua_estacoes_tilesets/pack/summer/door_frames/shop_door_menta_3frames.png`<br>`assets/rua_estacoes_tilesets/pack/summer/door_frames/shop_door_rosa_3frames.png` | duplicata/peça solta | versão solta da pasta da estação; o jogo usa pack/tilesets/ | arquivar (fica no original do pacote) |
| `assets/rua_estacoes_tilesets/pack/summer/facades/`: 8 arquivos (furniture_shop.png, house_a.png, house_b.png, house_c.png, …) | duplicata/peça solta | versão solta da pasta da estação; o jogo usa pack/tilesets/ | arquivar (fica no original do pacote) |
| `assets/rua_estacoes_tilesets/pack/summer/preview/opcoes_fachada_summer.png`<br>`assets/rua_estacoes_tilesets/pack/summer/preview/rua_summer_ceu_2x.png`<br>`assets/rua_estacoes_tilesets/pack/summer/preview/rua_summer_menta_2x.png`<br>`assets/rua_estacoes_tilesets/pack/summer/preview/rua_summer_rosa_2x.png` | preview/demo | preview/demo/referência | arquivar (`_referencia/`) |
| `assets/rua_estacoes_tilesets/pack/summer/props/`: 14 arquivos (bench.png, bin.png, chalkboard_cafe.png, crate_apples.png, …) | duplicata/peça solta | versão solta da pasta da estação; o jogo usa pack/tilesets/ | arquivar (fica no original do pacote) |
| `assets/rua_estacoes_tilesets/pack/summer/scenes/rua_summer_ceu.png`<br>`assets/rua_estacoes_tilesets/pack/summer/scenes/rua_summer_menta.png`<br>`assets/rua_estacoes_tilesets/pack/summer/scenes/rua_summer_rosa.png` | preview/demo | preview/demo/referência | arquivar (`_referencia/`) |
| `assets/rua_estacoes_tilesets/pack/summer/tiles/ground_tileset.png` | duplicata/peça solta | versão solta da pasta da estação; o jogo usa pack/tilesets/ | arquivar (fica no original do pacote) |
| `assets/rua_estacoes_tilesets/pack/tilesets/`: 16 arquivos (chao_autumn_rotulado.png, chao_spring_rotulado.png, chao_summer_rotulado.png, chao_winter_rotulado.png, …) | preview/demo | preview/demo/referência | arquivar (`_referencia/`) |
| `assets/rua_estacoes_tilesets/pack/tilesets/`: 9 arquivos (chao_autumn.png, chao_spring.png, chao_summer.png, fachadas_autumn.png, …) | sem referência | estação ainda não usada (Fase 2/3) | manter (Fase 2/3) |
| `assets/rua_estacoes_tilesets/pack/winter/door_frames/shop_door_ceu_3frames.png`<br>`assets/rua_estacoes_tilesets/pack/winter/door_frames/shop_door_menta_3frames.png`<br>`assets/rua_estacoes_tilesets/pack/winter/door_frames/shop_door_rosa_3frames.png`<br>`assets/rua_estacoes_tilesets/pack/winter/door_frames/shop_door_velha_3frames.png` | duplicata/peça solta | versão solta da pasta da estação; o jogo usa pack/tilesets/ | arquivar (fica no original do pacote) |
| `assets/rua_estacoes_tilesets/pack/winter/facades/`: 9 arquivos (furniture_shop.png, house_a.png, house_b.png, house_c.png, …) | duplicata/peça solta | versão solta da pasta da estação; o jogo usa pack/tilesets/ | arquivar (fica no original do pacote) |
| `assets/rua_estacoes_tilesets/pack/winter/preview/opcoes_fachada_winter.png`<br>`assets/rua_estacoes_tilesets/pack/winter/preview/rua_winter_ceu_2x.png`<br>`assets/rua_estacoes_tilesets/pack/winter/preview/rua_winter_menta_2x.png`<br>`assets/rua_estacoes_tilesets/pack/winter/preview/rua_winter_rosa_2x.png`<br>`assets/rua_estacoes_tilesets/pack/winter/preview/rua_winter_velha_2x.png` | preview/demo | preview/demo/referência | arquivar (`_referencia/`) |
| `assets/rua_estacoes_tilesets/pack/winter/props/`: 18 arquivos (bench.png, bin.png, box_blanket.png, box_cat_eyes.png, …) | duplicata/peça solta | versão solta da pasta da estação; o jogo usa pack/tilesets/ | arquivar (fica no original do pacote) |
| `assets/rua_estacoes_tilesets/pack/winter/scenes/rua_winter_ceu.png`<br>`assets/rua_estacoes_tilesets/pack/winter/scenes/rua_winter_menta.png`<br>`assets/rua_estacoes_tilesets/pack/winter/scenes/rua_winter_rosa.png`<br>`assets/rua_estacoes_tilesets/pack/winter/scenes/rua_winter_velha.png` | preview/demo | preview/demo/referência | arquivar (`_referencia/`) |
| `assets/rua_estacoes_tilesets/pack/winter/tiles/ground_tileset.png` | duplicata/peça solta | versão solta da pasta da estação; o jogo usa pack/tilesets/ | arquivar (fica no original do pacote) |
| `assets/rua_estacoes_tilesets/pack/estacoes_menta.png` | preview/demo | preview/demo/referência | arquivar (`_referencia/`) |
| `assets/senhorinha/senhorinha_original_4x.png` | preview/demo | preview/demo/referência | arquivar (`_referencia/`) |
| `assets/sujeira_cafe_abandonado/pack/sujeira/`: 24 arquivos (balde_goteira.png, buraco_rato.png, escorrido_parede.png, folhas_secas.png, …) | duplicata/peça solta | peça solta; o jogo usa sujeira_tileset | arquivar (fica no original do pacote) |
| `assets/sujeira_cafe_abandonado/pack/sujeira/sujeira_rotulado.png` | preview/demo | preview/demo/referência | arquivar (`_referencia/`) |
| `assets/tilesets_expansao/pack/tilesets_expansao/cerca/cerca_16.png` | sem referência | nenhuma referência | revisar: manter se previsto no design, senão arquivar |
| `assets/tilesets_expansao/pack/tilesets_expansao/demo/exterior_frente_inverno.png`<br>`assets/tilesets_expansao/pack/tilesets_expansao/demo/exterior_frente_primavera.png`<br>`assets/tilesets_expansao/pack/tilesets_expansao/demo/interior_frente_demo.png`<br>`assets/tilesets_expansao/pack/tilesets_expansao/demo/interior_frente_demo_50.png`<br>`assets/tilesets_expansao/pack/tilesets_expansao/demo/mapa_continuo_demo.png`<br>`assets/tilesets_expansao/pack/tilesets_expansao/demo/mapa_continuo_demo_50.png` | preview/demo | preview/demo/referência | arquivar (`_referencia/`) |
| `assets/tilesets_expansao/pack/tilesets_expansao/paredes/`: 25 arquivos (arandela.png, borda_frontal.png, divisoria_fim_frente.png, divisoria_meio.png, …) | sem referência | nenhuma referência | revisar: manter se previsto no design, senão arquivar |
| `assets/tilesets_expansao/pack/tilesets_expansao/pisos/`: 11 arquivos (cadeado.png, escada_baixo.png, passagem.png, piso_abandonado_a.png, …) | sem referência | nenhuma referência | revisar: manter se previsto no design, senão arquivar |
| `assets/tilesets_expansao/pack/tilesets_expansao/quintal/`: 7 arquivos (arvore_gato_externa.png, cama_ao_sol.png, casinha_gato.png, floreira.png, …) | sem referência | nenhuma referência | revisar: manter se previsto no design, senão arquivar |
| `assets/tilesets_expansao/pack/tilesets_expansao/terrenos/terra_sobre_grama_preview_4x.png` | preview/demo | preview/demo/referência | arquivar (`_referencia/`) |
| `assets/tilesets_expansao/pack/tilesets_expansao/terrenos/`: 16 arquivos (agua_sobre_grama_autumn.png, agua_sobre_grama_spring.png, agua_sobre_grama_summer.png, agua_sobre_grama_winter.png, …) | sem referência | nenhuma referência | revisar: manter se previsto no design, senão arquivar |
| `assets/tilesets_expansao/pack/tilesets_expansao/paredes_rotulado.png`<br>`assets/tilesets_expansao/pack/tilesets_expansao/pecas_rotulado.png` | preview/demo | preview/demo/referência | arquivar (`_referencia/`) |
| `assets/celular.zip` | duplicata/peça solta | zip do pacote celular (24 arquivos, já extraído na pasta celular/) | apagar (já extraído) |
| `assets/opcoes_fachada.png` | preview/demo | preview/demo/referência | arquivar (`_referencia/`) |
| `assets/mulher_placeholder_32x64.png` | sem referência | cópias em public/assets/characters/; nenhuma referência | revisar: manter se previsto no design, senão arquivar |
| `public/assets/cats/pebble.png` | referenciado nos dados, não carregado | Tekinha: memory=true, não é carregada | manter (gatos futuros); carregar só quando um gato usar |
| `public/assets/cats/`: 10 arquivos (biscuit.png, custard.png, domino.png, freckle.png, …) | referenciado nos dados, não carregado | listado em cat_sprites.json; nenhum gato usa a variante | manter (gatos futuros); carregar só quando um gato usar |
| `public/assets/characters/mulher_placeholder_32x64.png` | sem referência | nenhuma referência | revisar: manter se previsto no design, senão arquivar |
| `public/assets/fluxo/ui/etiqueta_preco.png` | sem referência | nenhuma referência | revisar: manter se previsto no design, senão arquivar |
| `public/assets/npc/gabi_caixa.gif` | sem referência | nenhuma referência | revisar: manter se previsto no design, senão arquivar |
| `public/assets/placeholders/placeholders.png` | sem referência | nenhuma referência | revisar: manter se previsto no design, senão arquivar |
| `public/assets/tools/vassoura_encostada.png`<br>`public/assets/tools/vassoura_spritesheet.png` | sem referência | nenhuma referência | revisar: manter se previsto no design, senão arquivar |
| `public/assets/vehicles/furgao_direita.png` | carregado, nunca exibido | carregado como van_right e nunca usado | manter e usar no retorno do furgão, ou parar de carregar |

## 5. Assets faltando

Prioridade: **P0** bloqueia o jogo (prólogo/Ato 1) · **P1** necessário para a próxima fase (roadmap) · **P2** desejável.

| Item | Para que serve | Prioridade | Tamanho sugerido |
|---|---|---|---|
| Balcão do café num estilo só (caixa + vitrine marrons, ou pontas rosas) | Corrigir inconsistência nº 1 (o balcão aparece desde o dia 1) | P0 | 32x32 por peça (caixa 1x1, vitrine 2x1) |
| ~~Jogadora final (criador de personagem)~~ | Feito em `f08aec4` | — | — |
| Logo "Biscuit Paws" | Home/menu principal, página da Steam | P0 | 256x96 (exibido 1x na tela 640x360) + versão 2x para a Steam |
| Botões e painéis de UI (9-slice), ícones de menu (som, opções, salvar, sair, voltar) | Home, pausa, opções; hoje tudo é CSS. O *Cosy UI Kit* citado na documentação **não está em `assets/`** | P0 | 9-slice 48x48 (canto 16); ícones 16x16 e 32x32 |
| Efeitos sonoros: miado, comer, moeda, porta, passos, cafeteira, clique de UI | Feedback do prólogo (miado na porta é um marco da história) | P0 | OGG/MP3 curtos, 44,1 kHz |
| Músicas `home`, `street`, `cafe` e ambientes `winter_wind`, `snow`, `street` | Canais já prontos em `data/audio.json` (todos `null`) | P1 | OGG em loop, 1–2 min |
| Operadora do caixa do mercado | O caixa cobra o carrinho (`cashier` nos textos); hoje sem NPC | P1 | 32x64, 4x5 + retrato 64x64 |
| Veterinária(o) + clínica (piso, parede, maca, balcão, armário) | Roadmap: "levar o gato no colo até a clínica (mapa, NPC e arte)" | P1 | NPC 32x64 4x5 + retrato 64x64; tiles 32x32 |
| Remédios variados (vermífugo, antipulgas, vacina, pomada) e caixa de transporte | Hoje só existe `remedio` | P1 | ícones 32x32; caixa de transporte 32x32 (mundo) |
| Gatos: comer, beber, receber carinho/ronronar, doente, dormir na caminha | O Cosy Cats só tem sit/walk/sleep/play; alimentar é marco do prólogo | P1 | 32x32, 4 quadros por animação, mesma folha 6 colunas |
| Vizinhos (2–3 NPCs com nome, desconfiados de gatos) | Pilar "Comunidade"; hoje só a senhorinha | P1 | 32x64, 4x5 + retratos 64x64 |
| Sobrinho pintor | Ato 1: libera a reforma | P1 | 32x64, 4x5 (+ quadro "pintando") + retrato |
| Funcionário(a) do café | Design citado no pedido | P2 | 32x64, 4x5 + retrato |
| Decoração de Natal interna (árvore, guirlanda, pisca-pisca, meia) | O prólogo é na véspera de Natal; só a rua tem abeto | P1 | árvore 32x64 ou 64x96; guirlanda 32x32; pisca-pisca 96x32 |
| Cozinha: armário, geladeira, bancada de preparo, prateleira de estoque | Fluxo onda 2 (LEIA-ME do fluxo); piso de cozinha já existe | P1 | 32x32 / 32x64 (geladeira) |
| Sótão: piso, parede inclinada, janela redonda, baú, caixas, escada de acesso | Cômodo previsto, **nenhuma peça existe** | P2 | tiles 32x32; janela 64x64 |
| Quartinho: cama, guarda-roupa, abajur, tapete | Cômodo previsto; só existe o piso "desconhecido" | P2 | cama 64x64, guarda-roupa 32x64 |
| Playground modular: plataformas, pontes, rampas, poste com conexões em 4 lados | O quintal tem 7 peças soltas que não se encaixam | P2 | módulos 32x32 com encaixe por grade; altos 32x64 |
| Quintal nas 4 estações (neve sobre sebe, folhas secas, flores) | Estações em fases; o quintal só tem versão dia/entardecer | P2 | mesma grade das peças atuais |
| Janelas acesas à noite nas fachadas e halo de poste | Ciclo dia/noite (hoje as luzes são um círculo gerado no código) | P2 | sobreposição por fachada (mesmo tamanho da fachada), halo 64x64 ADD |
| Louça 32 "cheia" (xícara, copo, prato) | A louça 32 só tem limpa/suja; a 16 tem limpa/cheia/suja | P2 | 32x32 |
| Protagonista carregando saco pesado / caixa / item na mão | O fluxo só tem a Gabi carregando; a protagonista tem bandeja e gato | P1 | camadas 128x256 da pose |
| Tekinha "anjinho" (asas/auréola sobre a Pebble) | Cena 1 do prólogo (lembrança) | P2 | 32x32 sobreposição na folha Pebble |
| Cursor e ícone do executável | Steam/Electron | P2 | cursor 16x16; ícone 256x256 |

## 6. Problemas técnicos

### 6.1 Resumo
| Tipo | Ocorrências | Onde | Ação |
|---|---|---|---|
| Referências quebradas | **0** | — | — |
| Fora da grade 32 (assets de jogo) | louça 16x16 (múltiplo de 16, intencional), UI do fluxo (balões 40x44 e 24x22, barra 34x8, slots 36x36, marca 44x18, etiqueta 40x16, cardápios 192x84/148x138/192x138), `furgao_*` 188x106/107, props da rua (`bench` 64x40, `mailbox` 32x48, `chalkboard_cafe` 32x48, `parasol_table` 57x75, `terrace_table` 52x28), `door_frames` 96x104, `props_atlas` 256x304/336, `canteiro_azul`/`sebe_*` do quintal B 32x48, `celular_tocando` 32x48, `status_sinal_wifi_bateria` 48x8 | ver 6.2 | UI pode ficar fora da grade (regra vale para mundo). Objetos do mundo: completar o canvas até múltiplo de 32 com fundo transparente, base alinhada embaixo. |
| Mistura 16 x 16 com 32 x 32 | louça 16 no mundo; `moeda_16`; `icone_mao`/`icone_bandeja` 16x16 | `fluxo/*` | **Decidido:** 16x16 permitido para itens de fato pequenos, com pixel do mesmo tamanho do resto. Registrar em `DECISIONS.md`. |
| Densidade de pixel diferente | `furgao_esquerda/direita` (2x) | `public/assets/vehicles` | Refazer em 1x. |
| Fundo não transparente (suspeito) | retratos 64x64 (fundo rosa, intencional para o diálogo); `cliente_*`/`corretora`/`senhorinha` previews; `demo_balcao` | — | Retratos: OK se o fundo for parte do quadro do diálogo; senão, recortar. |
| Fora da paleta Cosy | humanos (clientes, personagem principal, NPCs), sebes/gramas do quintal, `grama_autumn` dos terrenos (98%), `mancha_bolor`, `fruta_limao` (77%), molduras e ícones do celular | ver 6.2 | Script de quantização para a paleta (mantém o desenho). |
| Nomes fora do padrão | `Cat-Cafe-32x32`, `Cosy-Cats-32x32` (hífens e maiúsculas), `cat-cafe-tileset*.png` (hífens), mistura de inglês (`shop_menta`, `bench`) e português (`fachadas_winter`, `balcao_esq`), `fachadas_winter` mistura as duas línguas, `cliente_09_homem_pardo_careca_barba_xadrez` (descrição física no nome), `vassoura_v2` (versão no nome), `louca_16` vs `louca_tileset_16` | todos os pacotes | Convenção em ASSET_REORGANIZATION.md. |
| Arquivos gerados que parecem fonte | `public/assets/tiles/cat-cafe-tileset-ext.png`, `public/assets/equipment/cafeteira_spritesheet.png`, `public/assets/icons/fluxo_icones.png`, `public/assets/fluxo/balcoes.png` não existem em `assets/` | `public/assets` | Registrar no manifesto quais arquivos são gerados por script (não editar à mão). |
| Sobras em `public/assets` | `tools/vassoura_spritesheet.png`, `tools/vassoura_encostada.png`, `placeholders/placeholders.png`, `npc/gabi_caixa.gif`, `fluxo/ui/etiqueta_preco.png` (copiado pelo import, nunca usado), `characters/mulher_placeholder_32x64.png` | `public/assets` | Tirar da pasta do jogo (ficam nos originais). |
| Carregado e nunca exibido | `van_right` (`furgao_direita.png`) | `BootScene.ts:64` | Usar na volta do furgão ou parar de carregar. |
| Carregado por lista, sem uso | 10 folhas de gato em `data/cat_sprites.json` (só Marmalade é carregado; Pebble é lembrança) | `data/cat_sprites.json` | OK: o Boot já carrega só as variantes usadas. |
| Duplicata exata | `cozinha_cafe/cozinha_cafe_original.png` = `fluxo_cafe_onda1/.../preview_onda1.png`; `celular.zip` = pasta `celular/`; props iguais em spring/summer/autumn (`bench`, `bin`, `mailbox`, `crate_*`, `parasol_table`, `terrace_table` também no inverno); `*/tiles/ground_tileset.png` = `tilesets/chao_*.png`; quadros 1 = 3 nas caminhadas do Cosy e da corretora (normal em ciclo de caminhada) | — | Arquivar as cópias. |

### 6.2 Lista por arquivo (gerada; exclui previews e as pastas agrupadas)

<details><summary>Abrir lista (150 arquivos)</summary>

| Arquivo | Problema | Dimensões; status |
|---|---|---|
| `assets/Cat-Cafe-32x32/tiles/cat-cafe-tileset.png` | nome fora de snake_case | 256x352; fonte de importação |
| `assets/celular/pack/celular/icones/app_contatos.png` | fora da paleta (28.1% dos px) | 32x32; sem referência |
| `assets/celular/pack/celular/icones/app_ligacoes.png` | fora da paleta (70.8% dos px) | 32x32; sem referência |
| `assets/celular/pack/celular/icones/app_mensagens.png` | fora da paleta (52.4% dos px) | 32x32; sem referência |
| `assets/celular/pack/celular/icones/celular_tocando_1.png` | fora da grade 32 (múltiplo de 16) | 32x48; sem referência |
| `assets/celular/pack/celular/icones/celular_tocando_2.png` | fora da grade 32 (múltiplo de 16) | 32x48; sem referência |
| `assets/celular/pack/celular/icones/notificacao_bolinha.png` | fora da grade 32 (múltiplo de 16) | 16x16; em uso |
| `assets/celular/pack/celular/icones/status_sinal_wifi_bateria.png` | fora da grade 32/16 | 48x8; em uso |
| `assets/celular/pack/celular/molduras/celular_ameixa_9slice_48.png` | fora da grade 32 (múltiplo de 16) | 48x48; sem referência |
| `assets/celular/pack/celular/molduras/celular_rosa_tela_transparente.png` | fora da paleta (69.7% dos px) | 160x256; sem referência |
| `assets/clientes/clientes/cliente_02_mulher_negra_black_power.png` | fora da paleta (28.8% dos px) | 128x256; em uso |
| `assets/clientes/clientes/cliente_02_mulher_negra_black_power_parado.png` | fora da paleta (31.5% dos px) | 32x64; sem referência |
| `assets/clientes/clientes/cliente_03_homem_ruivo_bone.png` | fora da paleta (27.2% dos px) | 128x256; em uso |
| `assets/clientes/clientes/cliente_06_mulher_loira_rabo_esportiva.png` | fora da paleta (32% dos px) | 128x256; em uso |
| `assets/clientes/clientes/cliente_06_mulher_loira_rabo_esportiva_parado.png` | fora da paleta (26.5% dos px) | 32x64; sem referência |
| `assets/clientes/clientes/cliente_09_homem_pardo_careca_barba_xadrez.png` | fora da paleta (27.9% dos px) | 128x256; em uso |
| `assets/clientes/clientes/cliente_09_homem_pardo_careca_barba_xadrez_parado.png` | fora da paleta (31.2% dos px) | 32x64; sem referência |
| `assets/clientes/clientes/cliente_10_mulher_hijab_vestido.png` | fora da paleta (62.1% dos px) | 128x256; em uso |
| `assets/clientes/clientes/cliente_10_mulher_hijab_vestido_parado.png` | fora da paleta (58.2% dos px) | 32x64; sem referência |
| `assets/correio/entregadora_spritesheet.png` | fora da paleta (30.4% dos px) | 128x320; em uso |
| `assets/correio/furgao_direita.png` | fora da grade 32/16; pixel 2x (densidade diferente) | 188x106; carregado, nunca exibido |
| `assets/correio/furgao_esquerda.png` | fora da grade 32/16; pixel 2x (densidade diferente) | 188x107; em uso |
| `assets/corretora_e_vassoura/pack/vassoura/frames/vassoura_parada.png` | fora da paleta (25.7% dos px) | 64x64; sem referência |
| `assets/fluxo_cafe_onda1/fluxo_cafe/icones/suco.png` | fora da paleta (35% dos px) | 32x32; fonte de importação |
| `assets/fluxo_cafe_onda1/fluxo_cafe/louca/copo_cheia.png` | fora da grade 32 (múltiplo de 16) | 16x16; duplicata/peça solta |
| `assets/fluxo_cafe_onda1/fluxo_cafe/louca/copo_limpa.png` | fora da grade 32 (múltiplo de 16) | 16x16; duplicata/peça solta |
| `assets/fluxo_cafe_onda1/fluxo_cafe/louca/copo_suja.png` | fora da grade 32 (múltiplo de 16) | 16x16; duplicata/peça solta |
| `assets/fluxo_cafe_onda1/fluxo_cafe/louca/louca_tileset_16.png` | fora da grade 32 (múltiplo de 16) | 48x48; em uso |
| `assets/fluxo_cafe_onda1/fluxo_cafe/louca/prato_cheia.png` | fora da grade 32 (múltiplo de 16) | 16x16; duplicata/peça solta |
| `assets/fluxo_cafe_onda1/fluxo_cafe/louca/prato_limpa.png` | fora da grade 32 (múltiplo de 16) | 16x16; duplicata/peça solta |
| `assets/fluxo_cafe_onda1/fluxo_cafe/louca/prato_suja.png` | fora da grade 32 (múltiplo de 16) | 16x16; duplicata/peça solta |
| `assets/fluxo_cafe_onda1/fluxo_cafe/louca/xicara_cheia.png` | fora da grade 32 (múltiplo de 16) | 16x16; duplicata/peça solta |
| `assets/fluxo_cafe_onda1/fluxo_cafe/louca/xicara_limpa.png` | fora da grade 32 (múltiplo de 16) | 16x16; duplicata/peça solta |
| `assets/fluxo_cafe_onda1/fluxo_cafe/louca/xicara_suja.png` | fora da grade 32 (múltiplo de 16) | 16x16; duplicata/peça solta |
| `assets/fluxo_cafe_onda1/fluxo_cafe/ui/balao_aguardando_1.png` | fora da grade 32/16 | 24x22; em uso |
| `assets/fluxo_cafe_onda1/fluxo_cafe/ui/balao_aguardando_2.png` | fora da grade 32/16 | 24x22; em uso |
| `assets/fluxo_cafe_onda1/fluxo_cafe/ui/balao_aguardando_3.png` | fora da grade 32/16 | 24x22; em uso |
| `assets/fluxo_cafe_onda1/fluxo_cafe/ui/balao_pedido.png` | fora da grade 32/16 | 40x44; em uso |
| `assets/fluxo_cafe_onda1/fluxo_cafe/ui/balao_pedido_furioso.png` | fora da grade 32/16 | 40x44; em uso |
| `assets/fluxo_cafe_onda1/fluxo_cafe/ui/balao_pedido_impaciente.png` | fora da grade 32/16 | 40x44; em uso |
| `assets/fluxo_cafe_onda1/fluxo_cafe/ui/barra_progresso_0.png` | fora da grade 32/16; pixel 4x (densidade diferente) | 34x8; em uso |
| `assets/fluxo_cafe_onda1/fluxo_cafe/ui/barra_progresso_1.png` | fora da grade 32/16 | 34x8; em uso |
| `assets/fluxo_cafe_onda1/fluxo_cafe/ui/barra_progresso_2.png` | fora da grade 32/16 | 34x8; em uso |
| `assets/fluxo_cafe_onda1/fluxo_cafe/ui/barra_progresso_3.png` | fora da grade 32/16 | 34x8; em uso |
| `assets/fluxo_cafe_onda1/fluxo_cafe/ui/barra_progresso_4.png` | fora da grade 32/16 | 34x8; em uso |
| `assets/fluxo_cafe_onda1/fluxo_cafe/ui/barra_progresso_5.png` | fora da grade 32/16 | 34x8; em uso |
| `assets/fluxo_cafe_onda1/fluxo_cafe/ui/barra_progresso_6.png` | fora da grade 32/16 | 34x8; em uso |
| `assets/fluxo_cafe_onda1/fluxo_cafe/ui/barra_progresso_7.png` | fora da grade 32/16 | 34x8; em uso |
| `assets/fluxo_cafe_onda1/fluxo_cafe/ui/barra_progresso_8.png` | fora da grade 32/16 | 34x8; em uso |
| `assets/fluxo_cafe_onda1/fluxo_cafe/ui/cardapio_4_slots.png` | fora da grade 32/16 | 192x84; em uso |
| `assets/fluxo_cafe_onda1/fluxo_cafe/ui/cardapio_6_slots.png` | fora da grade 32/16 | 148x138; em uso |
| `assets/fluxo_cafe_onda1/fluxo_cafe/ui/cardapio_8_slots.png` | fora da grade 32/16 | 192x138; em uso |
| `assets/fluxo_cafe_onda1/fluxo_cafe/ui/etiqueta_preco.png` | fora da grade 32/16 | 40x16; sem referência |
| `assets/fluxo_cafe_onda1/fluxo_cafe/ui/icone_bandeja.png` | fora da grade 32 (múltiplo de 16) | 16x16; sem referência |
| `assets/fluxo_cafe_onda1/fluxo_cafe/ui/icone_mao.png` | fora da grade 32 (múltiplo de 16) | 16x16; sem referência |
| `assets/fluxo_cafe_onda1/fluxo_cafe/ui/marca_esgotado.png` | fora da grade 32/16 | 44x18; em uso |
| `assets/fluxo_cafe_onda1/fluxo_cafe/ui/moeda_16.png` | fora da grade 32 (múltiplo de 16) | 16x16; em uso |
| `assets/fluxo_cafe_onda1/fluxo_cafe/ui/slot_esgotado_veu.png` | fora da grade 32/16 | 36x36; em uso |
| `assets/fluxo_cafe_onda1/fluxo_cafe/ui/slot_mao_selecionado.png` | fora da grade 32/16; pixel 4x (densidade diferente) | 36x36; sem referência |
| `assets/fluxo_cafe_onda1/fluxo_cafe/ui/slot_mao_vazio.png` | fora da grade 32/16; pixel 4x (densidade diferente) | 36x36; sem referência |
| `assets/materia_prima/fruta_limao.png` | fora da paleta (77.1% dos px) | 32x32; duplicata/peça solta |
| `assets/quintal_secreto/pack/quintal_secreto/pecas/sebe_base.png` | fora da paleta (55.8% dos px) | 32x32; sem referência |
| `assets/quintal_secreto/pack/quintal_secreto/pecas/sebe_lateral.png` | fora da paleta (66.1% dos px) | 32x32; sem referência |
| `assets/quintal_secreto/pack/quintal_secreto/pecas/sebe_lateral_topo.png` | fora da paleta (67.8% dos px) | 32x32; sem referência |
| `assets/quintal_secreto/pack/quintal_secreto/pecas/sebe_meio_a.png` | fora da paleta (73.6% dos px) | 32x32; sem referência |
| `assets/quintal_secreto/pack/quintal_secreto/pecas/sebe_meio_b.png` | fora da paleta (73.6% dos px) | 32x32; sem referência |
| `assets/quintal_secreto/pack/quintal_secreto/pecas/sebe_topo.png` | fora da paleta (70.8% dos px) | 32x32; sem referência |
| `assets/quintal_secreto/pack/quintal_secreto/quintal_secreto_dia.png` | cantos opacos: fundo não transparente? | 704x416; sem referência |
| `assets/quintal_secreto/pack/quintal_secreto/quintal_secreto_entardecer.png` | cantos opacos: fundo não transparente?; fora da paleta (28.1% dos px) | 704x416; sem referência |
| `assets/quintal_secreto/pack/quintal_secreto/variante_tijolo/pecas/arbusto_lima.png` | fora da paleta (89% dos px) | 32x32; sem referência |
| `assets/quintal_secreto/pack/quintal_secreto/variante_tijolo/pecas/canteiro_azul.png` | fora da grade 32 (múltiplo de 16) | 32x48; sem referência |
| `assets/quintal_secreto/pack/quintal_secreto/variante_tijolo/pecas/dracena_espinhosa.png` | fora da paleta (41.9% dos px) | 64x64; sem referência |
| `assets/quintal_secreto/pack/quintal_secreto/variante_tijolo/pecas/raios_de_sol.png` | pixel 2x (densidade diferente) | 192x128; sem referência |
| `assets/quintal_secreto/pack/quintal_secreto/variante_tijolo/pecas/sebe_aparada_escura.png` | fora da grade 32 (múltiplo de 16) | 32x48; sem referência |
| `assets/quintal_secreto/pack/quintal_secreto/variante_tijolo/pecas/sebe_aparada_verde.png` | fora da grade 32 (múltiplo de 16) | 32x48; sem referência |
| `assets/quintal_secreto/pack/quintal_secreto/variante_tijolo/pecas/sebe_baixa_lima.png` | fora da grade 32 (múltiplo de 16); fora da paleta (89.1% dos px) | 32x48; sem referência |
| `assets/rua_estacoes_tilesets/pack/autumn/door_frames/shop_door_ceu_3frames.png` | fora da grade 32/16 | 96x104; duplicata/peça solta |
| `assets/rua_estacoes_tilesets/pack/autumn/door_frames/shop_door_menta_3frames.png` | fora da grade 32/16 | 96x104; duplicata/peça solta |
| `assets/rua_estacoes_tilesets/pack/autumn/door_frames/shop_door_rosa_3frames.png` | fora da grade 32/16 | 96x104; duplicata/peça solta |
| `assets/rua_estacoes_tilesets/pack/autumn/props/bench.png` | fora da grade 32/16 | 64x40; duplicata/peça solta |
| `assets/rua_estacoes_tilesets/pack/autumn/props/chalkboard_cafe.png` | fora da grade 32 (múltiplo de 16) | 32x48; duplicata/peça solta |
| `assets/rua_estacoes_tilesets/pack/autumn/props/ground_cover.png` | fora da paleta (25.4% dos px) | 32x32; duplicata/peça solta |
| `assets/rua_estacoes_tilesets/pack/autumn/props/mailbox.png` | fora da grade 32 (múltiplo de 16) | 32x48; duplicata/peça solta |
| `assets/rua_estacoes_tilesets/pack/autumn/props/parasol_table.png` | fora da grade 32/16 | 57x75; duplicata/peça solta |
| `assets/rua_estacoes_tilesets/pack/autumn/props/props_atlas.png` | fora da grade 32 (múltiplo de 16) | 256x304; duplicata/peça solta |
| `assets/rua_estacoes_tilesets/pack/autumn/props/terrace_table.png` | fora da grade 32/16 | 52x28; duplicata/peça solta |
| `assets/rua_estacoes_tilesets/pack/spring/door_frames/shop_door_ceu_3frames.png` | fora da grade 32/16 | 96x104; duplicata/peça solta |
| `assets/rua_estacoes_tilesets/pack/spring/door_frames/shop_door_menta_3frames.png` | fora da grade 32/16 | 96x104; duplicata/peça solta |
| `assets/rua_estacoes_tilesets/pack/spring/door_frames/shop_door_rosa_3frames.png` | fora da grade 32/16 | 96x104; duplicata/peça solta |
| `assets/rua_estacoes_tilesets/pack/spring/props/bench.png` | fora da grade 32/16 | 64x40; duplicata/peça solta |
| `assets/rua_estacoes_tilesets/pack/spring/props/chalkboard_cafe.png` | fora da grade 32 (múltiplo de 16) | 32x48; duplicata/peça solta |
| `assets/rua_estacoes_tilesets/pack/spring/props/mailbox.png` | fora da grade 32 (múltiplo de 16) | 32x48; duplicata/peça solta |
| `assets/rua_estacoes_tilesets/pack/spring/props/parasol_table.png` | fora da grade 32/16 | 57x75; duplicata/peça solta |
| `assets/rua_estacoes_tilesets/pack/spring/props/props_atlas.png` | fora da grade 32 (múltiplo de 16) | 256x304; duplicata/peça solta |
| `assets/rua_estacoes_tilesets/pack/spring/props/terrace_table.png` | fora da grade 32/16 | 52x28; duplicata/peça solta |
| `assets/rua_estacoes_tilesets/pack/summer/door_frames/shop_door_ceu_3frames.png` | fora da grade 32/16 | 96x104; duplicata/peça solta |
| `assets/rua_estacoes_tilesets/pack/summer/door_frames/shop_door_menta_3frames.png` | fora da grade 32/16 | 96x104; duplicata/peça solta |
| `assets/rua_estacoes_tilesets/pack/summer/door_frames/shop_door_rosa_3frames.png` | fora da grade 32/16 | 96x104; duplicata/peça solta |
| `assets/rua_estacoes_tilesets/pack/summer/props/bench.png` | fora da grade 32/16 | 64x40; duplicata/peça solta |
| `assets/rua_estacoes_tilesets/pack/summer/props/chalkboard_cafe.png` | fora da grade 32 (múltiplo de 16) | 32x48; duplicata/peça solta |
| `assets/rua_estacoes_tilesets/pack/summer/props/mailbox.png` | fora da grade 32 (múltiplo de 16) | 32x48; duplicata/peça solta |
| `assets/rua_estacoes_tilesets/pack/summer/props/parasol_table.png` | fora da grade 32/16 | 57x75; duplicata/peça solta |
| `assets/rua_estacoes_tilesets/pack/summer/props/props_atlas.png` | fora da grade 32 (múltiplo de 16) | 256x304; duplicata/peça solta |
| `assets/rua_estacoes_tilesets/pack/summer/props/terrace_table.png` | fora da grade 32/16 | 52x28; duplicata/peça solta |
| `assets/rua_estacoes_tilesets/pack/winter/door_frames/shop_door_ceu_3frames.png` | fora da grade 32/16 | 96x104; duplicata/peça solta |
| `assets/rua_estacoes_tilesets/pack/winter/door_frames/shop_door_menta_3frames.png` | fora da grade 32/16 | 96x104; duplicata/peça solta |
| `assets/rua_estacoes_tilesets/pack/winter/door_frames/shop_door_rosa_3frames.png` | fora da grade 32/16 | 96x104; duplicata/peça solta |
| `assets/rua_estacoes_tilesets/pack/winter/door_frames/shop_door_velha_3frames.png` | fora da grade 32/16 | 96x104; duplicata/peça solta |
| `assets/rua_estacoes_tilesets/pack/winter/props/bench.png` | fora da grade 32/16 | 64x40; duplicata/peça solta |
| `assets/rua_estacoes_tilesets/pack/winter/props/chalkboard_cafe.png` | fora da grade 32 (múltiplo de 16) | 32x48; duplicata/peça solta |
| `assets/rua_estacoes_tilesets/pack/winter/props/mailbox.png` | fora da grade 32 (múltiplo de 16) | 32x48; duplicata/peça solta |
| `assets/rua_estacoes_tilesets/pack/winter/props/props_atlas.png` | fora da grade 32 (múltiplo de 16) | 256x336; duplicata/peça solta |
| `assets/rua_estacoes_tilesets/pack/winter/props/terrace_table.png` | fora da grade 32/16 | 52x28; duplicata/peça solta |
| `assets/sujeira_cafe_abandonado/pack/sujeira/mancha_bolor.png` | fora da paleta (62.5% dos px) | 32x32; duplicata/peça solta |
| `assets/tilesets_expansao/pack/tilesets_expansao/terrenos/grama_autumn.png` | fora da paleta (97.9% dos px) | 32x32; sem referência |
| `public/assets/fluxo/louca_16.png` | fora da grade 32 (múltiplo de 16) | 48x48; em uso |
| `public/assets/fluxo/ui/balao_aguardando_1.png` | fora da grade 32/16 | 24x22; em uso |
| `public/assets/fluxo/ui/balao_aguardando_2.png` | fora da grade 32/16 | 24x22; em uso |
| `public/assets/fluxo/ui/balao_aguardando_3.png` | fora da grade 32/16 | 24x22; em uso |
| `public/assets/fluxo/ui/balao_pedido.png` | fora da grade 32/16 | 40x44; em uso |
| `public/assets/fluxo/ui/balao_pedido_furioso.png` | fora da grade 32/16 | 40x44; em uso |
| `public/assets/fluxo/ui/balao_pedido_impaciente.png` | fora da grade 32/16 | 40x44; em uso |
| `public/assets/fluxo/ui/barra_progresso_0.png` | fora da grade 32/16; pixel 4x (densidade diferente) | 34x8; em uso |
| `public/assets/fluxo/ui/barra_progresso_1.png` | fora da grade 32/16 | 34x8; em uso |
| `public/assets/fluxo/ui/barra_progresso_2.png` | fora da grade 32/16 | 34x8; em uso |
| `public/assets/fluxo/ui/barra_progresso_3.png` | fora da grade 32/16 | 34x8; em uso |
| `public/assets/fluxo/ui/barra_progresso_4.png` | fora da grade 32/16 | 34x8; em uso |
| `public/assets/fluxo/ui/barra_progresso_5.png` | fora da grade 32/16 | 34x8; em uso |
| `public/assets/fluxo/ui/barra_progresso_6.png` | fora da grade 32/16 | 34x8; em uso |
| `public/assets/fluxo/ui/barra_progresso_7.png` | fora da grade 32/16 | 34x8; em uso |
| `public/assets/fluxo/ui/barra_progresso_8.png` | fora da grade 32/16 | 34x8; em uso |
| `public/assets/fluxo/ui/cardapio_4_slots.png` | fora da grade 32/16 | 192x84; em uso |
| `public/assets/fluxo/ui/cardapio_6_slots.png` | fora da grade 32/16 | 148x138; em uso |
| `public/assets/fluxo/ui/cardapio_8_slots.png` | fora da grade 32/16 | 192x138; em uso |
| `public/assets/fluxo/ui/etiqueta_preco.png` | fora da grade 32/16 | 40x16; sem referência |
| `public/assets/fluxo/ui/marca_esgotado.png` | fora da grade 32/16 | 44x18; em uso |
| `public/assets/fluxo/ui/moeda_16.png` | fora da grade 32 (múltiplo de 16) | 16x16; em uso |
| `public/assets/fluxo/ui/slot_esgotado_veu.png` | fora da grade 32/16 | 36x36; em uso |
| `public/assets/npc/clientes/cliente_02_mulher_negra_black_power.png` | fora da paleta (28.8% dos px) | 128x256; em uso |
| `public/assets/npc/clientes/cliente_03_homem_ruivo_bone.png` | fora da paleta (27.2% dos px) | 128x256; em uso |
| `public/assets/npc/clientes/cliente_06_mulher_loira_rabo_esportiva.png` | fora da paleta (32% dos px) | 128x256; em uso |
| `public/assets/npc/clientes/cliente_09_homem_pardo_careca_barba_xadrez.png` | fora da paleta (27.9% dos px) | 128x256; em uso |
| `public/assets/npc/clientes/cliente_10_mulher_hijab_vestido.png` | fora da paleta (62.1% dos px) | 128x256; em uso |
| `public/assets/npc/entregadora_spritesheet.png` | fora da paleta (30.4% dos px) | 128x320; em uso |
| `public/assets/phone/notificacao_bolinha.png` | fora da grade 32 (múltiplo de 16) | 16x16; em uso |
| `public/assets/phone/status_sinal_wifi_bateria.png` | fora da grade 32/16 | 48x8; em uso |
| `public/assets/tiles/cat-cafe-tileset-ext.png` | nome fora de snake_case | 256x416; em uso |
| `public/assets/tiles/cat-cafe-tileset.png` | nome fora de snake_case | 256x352; fonte de importação |
| `public/assets/vehicles/furgao_direita.png` | fora da grade 32/16; pixel 2x (densidade diferente) | 188x106; carregado, nunca exibido |
| `public/assets/vehicles/furgao_esquerda.png` | fora da grade 32/16; pixel 2x (densidade diferente) | 188x107; em uso |

</details>
