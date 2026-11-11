# Arte e licença

## Pacotes usados
| Pacote | Autor | Uso |
| --- | --- | --- |
| Cat Cafe 32x32 Tileset & Interiors v1.0 | Leckie Pixel Studio (leckie1989) | Interior do café (em uso) |
| Cosy Cats 32x32 + Seasons Add-on | leckie1989 | Saiu do jogo (decisão 179): os gatos são todos do PixelLab |
| Cosy UI Kit | leckie1989 | Interface (marco futuro) |
| Personagem provisória (gerada) | gerada para teste | Jogadora, folha 128 x 256 |

Regras de estilo (originais): tudo em 32 x 32, mesmo artista, mesma paleta (`cosy-palette.gpl`). **Hoje** os ambientes, móveis e ícones estão na arte nova em **64 px por tile** (decisões 052 e 065, seção "Arte nova do PixelLab" no fim deste arquivo); os gatos e as pessoas continuam em 32 px até a sessão de personagens terminar. Não misturar densidades de pixel dentro de um mesmo grupo. Escalar sempre com vizinho mais próximo (nearest).

## Licença (Cat Cafe 32x32)
- **Pode:** usar em jogos comerciais e não comerciais, modificar, usar em trailers e marketing do jogo. Crédito é apreciado, não obrigatório.
- **Não pode:** revender, redistribuir, sublicenciar ou compartilhar os assets (originais ou modificados), sozinhos ou dentro de outro pacote, template ou toolkit. Não pode alegar autoria. Não pode usar para treinar, ajustar ou avaliar modelos de IA.
- Sem garantia.

Consequências para o projeto:
1. Repositório **privado**, ou `public/assets/` no `.gitignore`.
2. Manter `CREDITS.md` com autor e link.
3. **Não** enviar os PNGs a ferramentas que os usem para treinar IA. Tarefas de implementação (ler o arquivo para montar o jogo) são normais.
4. Os termos dos pacotes Cosy Cats e Cosy UI Kit ainda precisam ser lidos antes de usá-los.

## Folha de tiles
`public/assets/interiors/cafe/tile_cafe.png` (no pacote: `tiles/cat-cafe-tileset.png`): 8 colunas x 11 linhas de 32 x 32 px (256 x 352).
Coluna e linha contam a partir de 0. O índice do quadro no Phaser é `linha * 8 + coluna`.

## Catálogo (gerado de `tiles.csv`)
Largura e altura estão em tiles. Em peças de várias células, a origem é o canto superior esquerdo.
A coluna "Sólido" é a nossa decisão de colisão, e não vem do pacote. Mantenha a lista no catálogo gerado (`tiles.json`), e não espalhada pelo código.

| Nome | Coluna | Linha | Largura | Altura | Sólido |
| --- | --- | --- | --- | --- | --- |
| `floor_wood_a` | 0 | 0 | 1 | 1 | não |
| `floor_wood_b` | 1 | 0 | 1 | 1 | não |
| `floor_check_pink` | 2 | 0 | 1 | 1 | não |
| `floor_tile_mint` | 3 | 0 | 1 | 1 | não |
| `floor_rug` | 4 | 0 | 3 | 2 | não |
| `doormat` | 7 | 0 | 1 | 1 | não |
| `wall_stripe_pink` | 0 | 1 | 1 | 1 | sim |
| `wall_dots_cream` | 1 | 1 | 1 | 1 | sim |
| `wall_mint` | 2 | 1 | 1 | 1 | sim |
| `wall_wainscot` | 3 | 1 | 1 | 1 | sim |
| `wall_top_trim` | 7 | 1 | 1 | 1 | sim |
| `window` | 0 | 2 | 2 | 2 | não |
| `door` | 2 | 2 | 1 | 2 | não |
| `menu_board` | 3 | 2 | 2 | 1 | não |
| `wall_clock` | 5 | 2 | 1 | 1 | não |
| `picture_paw` | 6 | 2 | 1 | 1 | não |
| `wall_shelf` | 3 | 3 | 2 | 1 | não |
| `counter_left` | 7 | 2 | 1 | 1 | sim |
| `counter_mid` | 5 | 3 | 1 | 1 | sim |
| `counter_right` | 6 | 3 | 1 | 1 | sim |
| `counter_single` | 7 | 3 | 1 | 1 | sim |
| `counter_register` | 0 | 4 | 1 | 1 | sim |
| `coffee_machine` | 1 | 4 | 1 | 1 | sim |
| `display_case` | 2 | 4 | 2 | 1 | sim |
| `cake_whole` | 4 | 4 | 1 | 1 | não |
| `cake_slice` | 5 | 4 | 1 | 1 | não |
| `cupcake` | 6 | 4 | 1 | 1 | não |
| `macarons` | 7 | 4 | 1 | 1 | não |
| `cookie_jar` | 0 | 5 | 1 | 1 | não |
| `latte` | 1 | 5 | 1 | 1 | não |
| `tea_cup` | 2 | 5 | 1 | 1 | não |
| `teapot` | 3 | 5 | 1 | 1 | não |
| `milkshake` | 4 | 5 | 1 | 1 | não |
| `croissant` | 5 | 5 | 1 | 1 | não |
| `fish_biscuits` | 6 | 5 | 1 | 1 | não |
| `cake_stand` | 7 | 5 | 1 | 1 | não |
| `table_round` | 0 | 6 | 1 | 1 | sim |
| `chair_front` | 1 | 6 | 1 | 1 | não |
| `chair_back` | 2 | 6 | 1 | 1 | não |
| `sofa` | 3 | 6 | 2 | 1 | sim |
| `bookshelf` | 5 | 6 | 1 | 2 | sim |
| `cat_tree` | 6 | 6 | 2 | 3 | sim |
| `cat_condo` | 0 | 7 | 2 | 2 | sim |
| `scratch_post` | 2 | 7 | 1 | 1 | sim |
| `cushion_pink` | 3 | 7 | 1 | 1 | não |
| `cushion_mint` | 4 | 7 | 1 | 1 | não |
| `cushion_sky` | 2 | 8 | 1 | 1 | não |
| `cushion_lav` | 3 | 8 | 1 | 1 | não |
| `cushion_butter` | 4 | 8 | 1 | 1 | não |
| `cat_bed` | 5 | 8 | 1 | 1 | não |
| `food_bowl` | 0 | 9 | 1 | 1 | não |
| `water_bowl` | 1 | 9 | 1 | 1 | não |
| `yarn_balls` | 2 | 9 | 1 | 1 | não |
| `plant_pot` | 3 | 9 | 1 | 1 | sim |
| `plant_tall` | 4 | 9 | 1 | 2 | sim |
| `plant_hanging` | 5 | 9 | 1 | 1 | não |
| `cactus` | 6 | 9 | 1 | 1 | sim |
| `flower_vase` | 7 | 9 | 1 | 1 | não |

Ficam sem colisão: chão, tapete, capacho, cadeiras, almofadas, caminha, tigelas, novelo, comidas, bebidas, vaso de flores, planta pendurada, porta, janela e quadros (estes ficam sobre a parede, que já é sólida). Se a personagem precisar entrar pela porta no futuro, ela será tratada num marco próprio.

Comidas e bebidas têm fundo transparente e ficam centradas no tile: colocar sobre balcão/mesa numa camada de decoração.

## Personagem
Manequim do PixelLab com roupa e cabelo em camadas (decisões 077, 083 e 087), em `public/assets/characters/player_mannequin/` (de `npm run mannequin`): quadros de **80 x 128** em **64 px por tile** (resolução 2), 4 colunas x 4 linhas (`down`, `left`, `right`, `up`). Peças: 6 roupas e 10 penteados, cada um com caminhada, parada, bandeja, colo e ação; só pele e cabelo mudam de cor. Os originais e os personagens do PixelLab (cor-chave verde nos cabelos) ficam em `assets/_pixellab/personagens/protagonista/manequim/`.
O pacote antigo `personagem_principal` (camadas de 32 x 64, decisão 045) saiu do jogo; o original continua em `assets/_originais_pacotes/personagem_principal/`.
A folha provisória antiga (`mulher_placeholder_32x64.png`) saiu do jogo e está guardada em `assets/_fora_do_jogo/characters/`.
Humanos na grade de 32 px devem ter 32 x 48 ou 32 x 64.

## Lacunas de arte (decidir depois)
- Outros humanos (clientes, vizinhos) em estilo compatível com 32 x 48/64.
- Rua com neve e exteriores (o pacote de café cobre só o interior).
- Versão "abandonada" da loja.

## Créditos (`CREDITS.md`)
```
Cat Cafe 32x32 Tileset & Interiors, Leckie Pixel Studio (leckie1989): https://leckie1989.itch.io/cat-cafe-32x32-tileset-interiors
Cosy Cats 32x32: https://leckie1989.itch.io/cosy-cats-32x32-animated-cat-sprites
Cosy UI Kit: https://leckie1989.itch.io/cosy-ui-kit-soft-pixel-interface
```

## Tiles derivados ("velhos")
A licença permite **modificar** os assets. Versões gastas de pisos e paredes são **geradas por script** a partir dos tiles do pacote
(nada é desenhado do zero, para manter o traço e a paleta do leckie1989):

- Lista em `data/tiles.worn.json`: nome novo, tile de origem, estilo de desgaste, número de variações e pesos.
- `npm run art` (roda junto com `npm run dev` e `npm run build`) gera `public/assets/interiors/cafe/tile_cafe_worn.png`:
  a folha original + linhas novas embaixo. **Também fica fora do Git** (é obra derivada; a licença proíbe redistribuir).
- O desgaste usa só cores da paleta Cosy e semente fixa (sai igual toda vez).
- Cada célula do mapa escolhe uma variação pelos pesos (a 0 é a mais leve), para o chão velho não virar padrão repetido.

## Pacotes gerados por IA (decisão 020)
| Pacote | Origem | Uso |
| --- | --- | --- |
| Rua e vila, 4 estações (`assets/_originais_pacotes/rua_estacoes_tilesets`) | gerado por código/IA na paleta do Cat Cafe | Rua do café (hoje: inverno) |
| Sujeira do café abandonado (`assets/_originais_pacotes/sujeira_cafe_abandonado`) | gerado por código/IA na paleta do Cat Cafe | Teias, poeira e manchas no café velho |
| Gabi e o Joca (`assets/_originais_pacotes/gabi_e_joca`) | gerado por IA na paleta Cosy | NPCs do dia 2: folha 32x64 da Gabi (4x5), retrato 64x64, GIF com a caixa (ainda não usado); Joca, spitz 32x32 (4 colunas, 6 linhas) |
| Senhorinha (`assets/_originais_pacotes/senhorinha`) | gerado por IA na paleta Cosy | Dona Neusa: folha 32x64 (4x5) e retrato 64x64. Chegou ampliada 4x pelo chat; reduzida ao tamanho real por amostragem (o original ampliado fica junto) |
| Matéria-prima (`assets/_originais_pacotes/materia_prima`) | gerado por código/IA na paleta Cosy | 19 ícones 32x32 vendidos no mercado (café, chá, frutas, polpas, despensa) |
| Itens e bebidas (`assets/_originais_pacotes/itens_bebidas`) | gerado por código/IA na paleta Cosy | Ícones de bebidas (receitas), caixas, presente (conjunto de louças) e balões 16x16 (!, coração, +1) |
| Clientes (`assets/_originais_pacotes/clientes`) | gerado por código/IA na paleta Cosy | 10 clientes, folhas 128x256 (32x64, 4 direções x 4 quadros) |
| Menus (`assets/_originais_pacotes/ui_menus`) | gerado por código/IA na paleta Cosy | `npm run ui-audio` -> `public/assets/ui/menu/` (botões em 4 cores x 4 estados, painéis, faixas) e `public/assets/ui/hud/` (carrinho). O logo do pacote ("CAT CAFE") não é usado |
| Inauguração (`assets/_originais_pacotes/inauguracao`) | gerado por código/IA | `npm run ui-audio` -> `public/assets/ui/scenes/` (fita fechada e cortada, fachada rosa, primavera) |
| Áudio (`assets/_originais_pacotes/audio`) | sintetizado por código | `npm run ui-audio` -> `public/assets/audio/{music,ambient,sfx}/` (.ogg e .mp3) |
| Rua: primavera, verão, outono (`assets/_originais_pacotes/rua_estacoes_tilesets`) | gerado por código/IA | `npm run seasons` -> `public/assets/env/street/<estação>/` |
| Quintal secreto (`assets/_originais_pacotes/quintal_secreto`) | gerado por código/IA na paleta Cosy | Importado por `npm run backyard` (`scripts/import-backyard.ts`) para `public/assets/env/backyard/`: variante A (sebe) e B (tijolo, peças juntadas numa folha). O mesmo script desenha os provisórios dos cômodos em `public/assets/interiors/cafe/tile_rooms_placeholder.png` (parede divisória, portas, cama do quartinho, mato, túnel, casinha, tora, cama ao sol) |
| Personagem principal antiga (`assets/_originais_pacotes/personagem_principal`) | gerado por código/IA na paleta Cosy | **Fora do jogo** desde a decisão 087 (a personagem é o manequim do PixelLab); original guardado |
| Fluxo do café, onda 1 (`assets/_originais_pacotes/fluxo_cafe_onda1`) | gerado por código/IA na paleta Cosy | Importado por `scripts/import-fluxo.ts`: cafeteira, balões do pedido, barra de progresso, quadro do cardápio (4/6/8), esgotado, moeda, louça 16x16 e ícones de comida e remédio. Bandeja e personagem carregando ficam para a Fase 2 |
| Louça (`assets/_originais_pacotes/louca`) | gerado por IA na paleta Cosy | 18 ícones 32x32 (reduzidos de 4x, peça por peça): xícara, prato, tigela, copo, copo alto, caneca e pilhas, limpos e sujos. Em uso: xícara, copo e prato |
| Pia (`assets/_originais_pacotes/pia`) | gerado por IA/código na paleta Cosy | Pia 32x32: vazia, com louça, lavando (4 quadros) e louça limpa |
| Equipamentos (`assets/_originais_pacotes/equipamentos`) | gerado por IA na paleta Cosy | Bule, liquidificador, espremedor, fogão e forno, 6 quadros 32x32 cada (parado, trabalhando, pronto); reduzido de uma imagem ampliada 4x. Em uso: bule e liquidificador |
| Cozinha e café (`assets/_originais_pacotes/cozinha_cafe`) | gerado por IA na paleta Cosy | A imagem veio sem escala única; a cafeteira (6 quadros) foi extraída da região em que o pixel é 3x3. O resto espera o PNG original |
| Correio (`assets/_originais_pacotes/correio`) | gerado por IA na paleta Cosy | Entregadora (folha 32x64 4x5 e retrato 64x64, reduzidos de uma imagem ampliada 4x) e furgão de lado (188x107, reduzido de 2x). Vista de frente e de trás ainda não usadas |
| Veterinária, fachada (`assets/_originais_pacotes/veterinaria`) | gerado por código/IA na paleta Cosy | Fachada 192x256 (6x8 tiles) nas 4 estações e cruz avulsa. Em uso: inverno, em `public/assets/env/street/winter/tile_street_vet_clinic_winter.png` |
| Mini games (`assets/_originais_pacotes/minigames`) | gerado por IA (prompts em `prompts.txt` do pacote) | Importado por `npm run minigames` (`scripts/import-minigames.ts`) para `public/assets/minigames/`: cenário da pasta `tile64` (64 px por tile, desenhado na metade, decisão 052) e interface/latte nas medidas próprias. Pendente no pacote: as poses da personagem pescando |
| Veterinária, interior (`assets/_originais_pacotes/veterinaria_interior`) | gerado por código/IA na paleta Cosy | Importado por `npm run vet` (`scripts/import-vet.ts`): 4 tiles (piso xadrez, parede papel com e sem moldura, azulejo) e 23 peças juntados numa folha 8x9 (`public/assets/interiors/vet_clinic/tile_vet_clinic.png`, `data/tilesets/vet_clinic.json`) |
| Médica veterinária (`assets/_originais_pacotes/veterinaria_medica`) | gerado por código/IA na paleta Cosy | A Fernanda: folha 128x256 (32x64, 4 direções) e retrato 64x64, copiados por `npm run vet` para `public/assets/characters/npcs/`. Sem uso desde nov/2026: o jogo usa a Fernanda do PixelLab (caminhada e retrato), montada por `npm run npcs` |
| PixelLab, lote 01 (`assets/_pixellab/lote01`) | gerado por IA no PixelLab (assinatura Tier 1), em 64 px por tile | `npm run pixellab` (`scripts/import-pixellab.ts`) -> `public/assets/objects/pixellab/tile_pixellab_lote01.png` (resolução 2): porta 1x2 fechada e aberta, potes de biscoito A e B cheios e vazios (nomes `pl1_*`). Ainda não usados nos mapas. Os candidatos não escolhidos e as folhas ampliadas ficam na mesma pasta |
| Vassoura nova (`assets/_originais_pacotes/vassoura_nova`) | gerado por IA na paleta Cosy | Vassoura 32x32 nos pés da personagem, poeira e brilho (substitui a do pacote da corretora) |

Regras desses pacotes (LEIA-ME de cada um): uso no nosso jogo, pessoal ou comercial; **não redistribuir**; **declarar o uso de IA na página da Steam**.
Arquivos usados hoje: `public/assets/env/street/winter/*.png`, `public/assets/objects/dirt/tile_dirt.png` (fora do Git). Os JSONs de peças (nomes e posições) ficam em `data/tilesets/`.
Em uso também (originais em `assets/_originais_pacotes/`): `mercado_interior/` (mapa do mercado, convertido para `data/maps/market.json`), `catalogo_compras/` (ícones), `Cosy-Cats-32x32/` (leckie1989, mesma licença do Cat Cafe: Pebble = Tekinha, Marmalade = o gatinho de rua). Também: `celular/` (moldura ameixa e ícones do anúncio, `data/phone.json`). Ainda não usados: `opcoes_fachada.png`, `quintal_secreto/`, `tilesets_expansao/`.

## Organização das pastas e nomes
Auditoria em `docs/ASSET_AUDIT.md`; estrutura, convenção de nomes (inglês, `prefixo_assunto_estado_estação`), checklist para novos assets e o mapa da migração em `docs/ASSET_REORGANIZATION.md`. Arquivos que saíram da pasta do jogo sem uso ficam guardados em `assets/_fora_do_jogo/`. Itens de fato pequenos (louça nas mesas, moeda, ícones pequenos) podem ser 16x16 (decisão 046).

## Estilo novo desenhado por código (decisão 051)
Arte original nossa, gerada por `scripts/art/` (sem IA e sem pacote de terceiros). Mesmas posições das folhas antigas; as antigas ficam em `assets/_estilo_antigo/` (fora do Git). Pronto: folha do café (`npm run art:cafe`, 60 peças, inclui cadeiras de lado); balcão de madeira, cafeteira, equipamentos, pia e louça 16/32 (`npm run art:kitchen`; o `import-fluxo.ts` não grava mais essas folhas). Regras: paleta de `scripts/art/palette.ts`, luz de cima à esquerda, contorno marrom-escuro de 1 px, volume (tampo visível) nos móveis.

## Arte nova do PixelLab (decisão 065, nov/2026)
Gerada por IA no PixelLab (https://www.pixellab.ai, assinatura Tier 1) em **64 px por tile**, desenhada em meia escala no grid de 32 (decisão 052). Os pedidos, as escolhas e o que foi ajustado por código ficam em `assets/_pixellab/<pasta>/escolhas.json` (fora do Git). `npm run pixellab` (`scripts/import-pixellab.ts`) monta as folhas em `public/assets/` e os JSONs de peças em `data/tilesets/`.

| Onde | Folhas | Observação |
| --- | --- | --- |
| Café | `pixellab_cafe`, `pixellab_cafe_superficies`, `pixellab_cafe_cores`, `pixellab_sujeira`, tiras `*_pixellab.png` (equipamentos, espresso, pia) | troca a arte dos tiles antigos (`replaces`); cores e balcões A/B como itens novos |
| Cômodos | `pixellab_comodos`, `pixellab_comodos_portas` | módulos do playground, cama, mato; parede divisória por código; portas 1x2 |
| Mercado | `pixellab_market`, `pixellab_market_novos` | layout novo do mapa |
| Clínica | `pixellab_vet`, `pixellab_vet_novos` | layout novo do mapa |
| Rua | `pixellab_fachadas`, `pixellab_fachadas_neve`, `pixellab_rua_chao`, `pixellab_rua_objetos`, `pixellab_rua_enfeites` | arte igual o ano todo; a estação vem por cima (neve, folhas, pétalas, enfeites) |
| Quintal | `pixellab_quintal`, `pixellab_quintal_novos` | a variante de tijolo saiu |
| Ícones | folha `pixellab` de `data/icons.json` (64 px) | todos os ícones do jogo |
| Chaves e vassoura | `icones_chave_vassoura/` (escolhas.json): ícones `chave_padaria` (latão com sininho: no começo ainda não é um café de gatos), `chave_enferrujada`, `vassoura` na folha `pixellab`; `broom_hold.png` (64x128) é a vassoura na mão | a vassoura na mão segue as mãos da pose de ação (`data/tools.json: broom.hold`); substituem `icon_key.png`, `icon_broom.png` e a vassoura antiga ao varrer (a poeira continua a antiga) |
| Mini games | `minigames/hunt/hide_*.png`, `minigames/fishing/icons_fish_pixellab.png` | esconderijos da Caça ao filhote e peixes da Pescaria |
| Despensa | `ph_pantry_cabinet` na folha `pixellab_provisorios` (fonte `assets/_pixellab/provisorios/pantry_cabinet.png`) | armário da cozinha 1x2, madeira clean, uma peça só; 6 gerações (Pro Flash com a estante do café como âncora); descido 6 px para a base encostar embaixo |
| Montar a feira | `pixellab_feira` (`fair_pen` cercadinho 2x2, `fair_poster` cartaz "adote", `fair_treats` mesa de petiscos; fontes em `assets/_pixellab/provisorios/fair_*.png`) | 12 gerações (Pro Flash com a mesa da feira como âncora de estilo; o cartaz é edição da placa da feira, com uma sobra "IN" apagada à mão); o resto do tabuleiro usa o quintal, a caixa de transporte da clínica e a mesa da feira |
| Caixa do mercado e balcão da clínica sem a parede em U | `mercado_C/caixa_3x2_sem_parede.png` e `clinica/recepcao_3x2_sem_parede.png` (em `pixellab_market_novos` e `pixellab_vet`) | 1 geração cada (edição `edit_image_pixen` da peça já montada, por isso sem `dy`): a parede de trás saiu; o resto igual |
| Decorações do quarto | `pixellab_quarto` (fontes em `assets/_pixellab/quarto/`, nomes `quarto_*`) | 22 peças, 52 gerações: lote 1x1 de 16 (criados-mudos, baú, pufes, cesto, mesinha, poltrona, espelho, quadros, luzinhas, relógio, prateleira, porta-retrato; pote do lote 01 como âncora) e Pro Flash para guarda-roupa 2x2 (refeito mais largo), cômoda e escrivaninha 2x1, luminária e cabideiro 1x2, tapete redondo 2x2 (cama do quartinho como âncora). Itens da aba Cômodos, liberados com o porão reformado |
| Cone da obra | `decor_obra_cone` na folha `pixellab_decor` (fonte `assets/_pixellab/obra/cone_1x1.png`) | 5 gerações (Pro Flash 64x64, pote do lote 01 como âncora); descido 3 px para a base encostar embaixo. Fica ao lado do Tião nos dias de obra |
| Caixa pet | `pet_box` na folha `pixellab_pet` (fonte `assets/_pixellab/automaticos/caixa_pet.png`) | 5 gerações (Pro Flash 64x64, pote do lote 01 como âncora; 1 imagem neutra, sem texto) |
| Lava-louças | `eletro_lava_loucas` na folha `pixellab_eletro` (fonte `assets/_pixellab/cafe_equip/lava_loucas.png`) | 5 gerações (Pro Flash 64x64, a pia como âncora) |
| Praça do Confiança do gato | folha `pixellab_praca` (fontes `assets/_pixellab/praca/transicao_v2.png` e `v3`, com os cantos em `.json`) | 75 gerações: 3 tilesets de transição grama -> calçada de pedregulhos (`create_topdown_tileset` pro, 64 px, Wang por cantos); a v1 (borda recortada) ficou guardada, v2 e v3 (borda sutil, os mesmos pedregulho e grama) estão no jogo |
| Atendente do mercado | `assets/_pixellab/personagens/atendente` (personagem 128 px; animações `atendente_idle` e `atendente_scan`, só de costas) -> `npc_market_clerk.png` por `npm run npcs` | 3 gerações o personagem + 2 cada animação (v3, 4 quadros): à toa vira a cabeça; no caixa, as mãos na máquina |
| Mini games (remédio, escovação, varinha, pescaria, latte) | `assets/_pixellab/minigames/<jogo>/` -> `public/assets/minigames/<jogo>/` por `npm run pixellab` (chaves em `src/game/minigames/assets.ts`) | 69 gerações (Pro Flash com recorte da estante do café como âncora): tigela, comprimido, tubo; toalha, nó de pelo, escova; pompom; cais, boia, água (tile de 64 sem emenda; os 4 quadros são o tile deslocado); xícara, jarra. Quadros da boia montados por código. A pasta do remédio e a barra da pescaria são desenhadas por código. Fundos: pisos e tapete do café (`backdrop` em `data/minigames.json`), sem gerar |
| Porão, feira e ícones | `ph_basement_wall`, `ph_basement_floor`, `ph_basement_stairs` (2x1, vista de cima) e `ph_fair_setup` (caixotes) na folha `pixellab_provisorios` (fontes em `assets/_pixellab/provisorios/`); ícones `varinha`, `escova`, `recompondo` na folha de 64 px (`assets/_pixellab/icones_extra/`) | 47 gerações (a primeira escadinha, de lado, foi refeita vista de cima: +6). Porta de madeira e corrente com cadeado gerados e guardados em `assets/_pixellab/reserva/`, sem uso por enquanto |
| Gatos (o ruivo, o Botinhas) | `assets/_pixellab/gatos/` (personagens `gato_ruivo_sentado` e `gato_ruivo_em_pe`, 64 px, e poses soltas do Pro Flash) -> `public/assets/characters/cats/cat_ruivo.png` por `npm run gatos` (layout do Cosy Cats em 64 px, resolução 2) | 52 gerações o ruivo + ~25 por pelagem (frajola, preto, siamês, tricolor, escaminha, cinza, branco, tigrado, blue point, red point, creme, lynx point; referência repintada + transfer_outfit sobre os quadros do ruivo): o gato de teste (Pro Flash, o Joca sentado como âncora de estilo), as rotações, sentado, andar (cima refeito em v3), dormir (2 poses das fotos da usuária; a respiração é por código), bote (agachado e pata erguida + v3 entre os dois), comer (v3, mastigando) e estranhar (costas arqueadas). Do zero: nada do Cosy Cats foi usado como referência |
| Castração: cercadinho e caixinha | `assets/_pixellab/clinica/cercadinho_recuperacao.png` (3x2, 192x128) e `caixinha_transporte.png` (1x1, 64x64) -> folha `tile_pixellab_vet_novos` (`vet_cercadinho`, `vet_caixinha_gato`) por `npm run pixellab` | 11 gerações (Pro Flash, a caixa pet como âncora): o cercadinho vazio (cerca baixa, portãozinho, manta) e a caixinha com a silhueta escura de um gato, sem pelagem. A cerca da frente é redesenhada por código por cima dos gatos lá dentro. Ícone da latinha Recovery: `lata_recovery` (`assets/_pixellab/icones_extra/lata_recovery.png`, Pro Flash 64x64 com a escova como âncora, 5 gerações) |

Feito por código em cima da arte gerada (sem gerar de novo): letreiros (fonte de pixel), cores alternativas (café rosa e céu, sofás, caminhas), versões velhas e secas, neve, pétalas e folhas, balcões fatiados, portas esticadas pelo painel liso, asfalto sem rachaduras repetidas.

**Ainda fora da arte nova:**
- Gatos: 13 pelagens na arte nova, usadas por todos os gatos do jogo (o Cosy Cats saiu, decisão 179). Os novos são feitos do zero no PixelLab: **nunca** usar a arte do Cosy Cats como referência (licença).
- NPCs e clientes: sessão de personagens em andamento (`assets/_pixellab/personagens`). A personagem principal já está na arte nova (manequim em camadas, decisão 087).
- Interface (menus, HUD, celular, balões de atendimento, louça 16 px na mão) e os pacotes dos mini games (Gato em fuga, Pescaria, Latte art, Entrega).
- Lençol sobre móvel (sujeira do café abandonado) e os provisórios por código da lista de pendências (caixa de areia, cocô, pegadas, peças da feira de adoção).

**Folhas antigas:** continuam no `tilesets.json` só como lista de nomes (a arte nova troca a imagem pelo nome). Uma folha que ficou sem nenhum tile sai do catálogo e o jogo não a baixa (`buildCatalog`).

**Licença:** antes do lançamento, ler os termos do PixelLab (https://pixellab.ai/termsofservice) e confirmar o uso comercial das imagens geradas na assinatura (pendente). Regras nossas: não redistribuir os PNGs (ficam fora do Git, em `assets/` e `public/assets/`), **declarar o uso de IA na página da Steam**, e nunca enviar arte de pacotes do leckie1989 (Cat Cafe, Cosy Cats) como referência para o PixelLab.

### Declaração de IA na página da Steam (texto proposto)
Formulário "AI Generated Content Disclosure", conteúdo **pré-gerado**:

> PT: Grande parte da arte do jogo (ambientes, móveis, fachadas, objetos e ícones) foi gerada com ferramentas de IA (PixelLab) a partir das nossas descrições e depois revisada, editada e ajustada à mão e por código pela equipe: recortes, cores alternativas, letreiros, versões gastas e sazonais. Gatos animados são de um pacote comercial de pixel art feito por um artista (Leckie Pixel Studio). Músicas e efeitos sonoros foram sintetizados por código. O jogo não gera conteúdo com IA durante a partida.
>
> EN: Most of the game's art (environments, furniture, storefronts, props and icons) was created with AI tools (PixelLab) from our own descriptions, then reviewed, edited and adjusted by hand and by code by the team: slicing, alternate colors, sign lettering, worn and seasonal versions. The animated cats come from a commercial pixel art pack made by an artist (Leckie Pixel Studio). Music and sound effects were synthesized by code. The game does not generate any AI content while it is being played.

Revisar este texto quando a sessão de personagens terminar (personagem e NPCs também passam a ser gerados no PixelLab).
