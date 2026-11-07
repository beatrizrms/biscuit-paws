# Arte e licença

## Pacotes usados
| Pacote | Autor | Uso |
| --- | --- | --- |
| Cat Cafe 32x32 Tileset & Interiors v1.0 | Leckie Pixel Studio (leckie1989) | Interior do café (em uso) |
| Cosy Cats 32x32 + Seasons Add-on | leckie1989 | Gatos animados (marco futuro) |
| Cosy UI Kit | leckie1989 | Interface (marco futuro) |
| Personagem provisória (gerada) | gerada para teste | Jogadora, folha 128 x 256 |

Regras de estilo: **tudo em 32 x 32**, mesmo artista, mesma paleta (`cosy-palette.gpl`). Não misturar 16 x 16 com 32 x 32: a densidade de pixel fica diferente. Escalar sempre com vizinho mais próximo (nearest).

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
Camadas do pacote `personagem_principal` em `public/assets/characters/player/` (decisão 045): folhas 128 x 256, quadros de **32 x 64**, 4 colunas x 4 linhas.
Linhas (de cima para baixo): `down`, `left`, `right`, `up`. Cada linha tem 4 quadros de caminhada.
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
| Personagem principal (`assets/_originais_pacotes/personagem_principal`) | gerado por código/IA na paleta Cosy | Importado por `npm run character` (`scripts/import-character.ts`) para `public/assets/characters/player/`: camadas 128x256 (corpo, olhos, calçado, calça, camisa, cabelo, acessórios) e 7 poses (bandeja, gato, varrer, limpar mesa, operar, mexer, lavar). O script confere se existe todo arquivo que alguma combinação usa |
| Fluxo do café, onda 1 (`assets/_originais_pacotes/fluxo_cafe_onda1`) | gerado por código/IA na paleta Cosy | Importado por `scripts/import-fluxo.ts`: cafeteira, balões do pedido, barra de progresso, quadro do cardápio (4/6/8), esgotado, moeda, louça 16x16 e ícones de comida e remédio. Bandeja e personagem carregando ficam para a Fase 2 |
| Louça (`assets/_originais_pacotes/louca`) | gerado por IA na paleta Cosy | 18 ícones 32x32 (reduzidos de 4x, peça por peça): xícara, prato, tigela, copo, copo alto, caneca e pilhas, limpos e sujos. Em uso: xícara, copo e prato |
| Pia (`assets/_originais_pacotes/pia`) | gerado por IA/código na paleta Cosy | Pia 32x32: vazia, com louça, lavando (4 quadros) e louça limpa |
| Equipamentos (`assets/_originais_pacotes/equipamentos`) | gerado por IA na paleta Cosy | Bule, liquidificador, espremedor, fogão e forno, 6 quadros 32x32 cada (parado, trabalhando, pronto); reduzido de uma imagem ampliada 4x. Em uso: bule e liquidificador |
| Cozinha e café (`assets/_originais_pacotes/cozinha_cafe`) | gerado por IA na paleta Cosy | A imagem veio sem escala única; a cafeteira (6 quadros) foi extraída da região em que o pixel é 3x3. O resto espera o PNG original |
| Correio (`assets/_originais_pacotes/correio`) | gerado por IA na paleta Cosy | Entregadora (folha 32x64 4x5 e retrato 64x64, reduzidos de uma imagem ampliada 4x) e furgão de lado (188x107, reduzido de 2x). Vista de frente e de trás ainda não usadas |
| Vassoura nova (`assets/_originais_pacotes/vassoura_nova`) | gerado por IA na paleta Cosy | Vassoura 32x32 nos pés da personagem, poeira e brilho (substitui a do pacote da corretora) |

Regras desses pacotes (LEIA-ME de cada um): uso no nosso jogo, pessoal ou comercial; **não redistribuir**; **declarar o uso de IA na página da Steam**.
Arquivos usados hoje: `public/assets/env/street/winter/*.png`, `public/assets/objects/dirt/tile_dirt.png` (fora do Git). Os JSONs de peças (nomes e posições) ficam em `data/tilesets/`.
Em uso também (originais em `assets/_originais_pacotes/`): `mercado_interior/` (mapa do mercado, convertido para `data/maps/market.json`), `catalogo_compras/` (ícones), `Cosy-Cats-32x32/` (leckie1989, mesma licença do Cat Cafe: Pebble = Tekinha, Marmalade = o gatinho de rua). Também: `celular/` (moldura ameixa e ícones do anúncio, `data/phone.json`). Ainda não usados: `opcoes_fachada.png`, `quintal_secreto/`, `tilesets_expansao/`.

## Organização das pastas e nomes
Auditoria em `docs/ASSET_AUDIT.md`; estrutura, convenção de nomes (inglês, `prefixo_assunto_estado_estação`), checklist para novos assets e o mapa da migração em `docs/ASSET_REORGANIZATION.md`. Arquivos que saíram da pasta do jogo sem uso ficam guardados em `assets/_fora_do_jogo/`. Itens de fato pequenos (louça nas mesas, moeda, ícones pequenos) podem ser 16x16 (decisão 046).
