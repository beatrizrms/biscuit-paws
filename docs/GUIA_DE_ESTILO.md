# Guia de estilo: Biscuit Paws

A regra para tudo o que entra no jogo, seja arte, interface, movimento ou texto. Nasceu do diagnóstico de
`PLANO_POLIMENTO.md` (fase 0). O jogo tinha peças boas que não pareciam do mesmo jogo porque não havia um padrão.
Antes de gerar arte, desenhar uma tela ou escrever um aviso, confira aqui. Se algo novo não couber, decida com a
Beatriz e registre neste guia.

## 1. Escala

| O quê | Tamanho |
|---|---|
| Tile | 64 px de arte = 32 px lógicos (`resolution: 2` nas folhas novas) |
| Pessoa adulta | 2 tiles de altura. Quadro 112x128 (NPCs) ou 80x128 (protagonista); a figura ocupa de 115 a 120 px dos 128, com os pés no fundo do quadro |
| Gato | Quadro 64x64; sentado, ~42x52 px, com os pés a ~5 px da base. Toda pose do mesmo gato tem o mesmo tamanho de cabeça |
| Porta | Sempre 1x2 |
| Móveis, vasos, plantas, estantes | No máximo 2 tiles de altura |
| 3 tiles de altura | Só o que é maior que uma pessoa: árvore grande, poste, pérgola, fachada |

Toda arte sai no tamanho exato em tiles (w*64 x h*64), com a base encostada embaixo. Depois de gerar, meça a área
ocupada antes de usar.

## 2. Personagens

- **Base de todo personagem (decisão 281): o quadro de frente da cliente 04** (`npc.customer_04`). Personagem novo ou refeito
  é uma edição dele (troca cabelo, rosto e roupa); a frente é aprovada antes de girar e animar.
- **A edição da base não pode apagar a personalidade (decisão 286).** Pedir sombreado e pose "exatamente" iguais aos da
  base, mais uma expressão neutra, deixa a pessoa limpa e genérica. Antes de refazer alguém com caráter forte (marcas,
  roupa surrada, expressão, corpo), veja se o problema não se resolve por código (contorno, cor); se for gerar, ponha na
  ficha os traços que fazem a pessoa ser quem é e peça a mesma proporção da base, não o mesmo acabamento.
- **Ficha antes de gerar** (aprovada pela Beatriz antes de gastar qualquer geração). Cada item com cor em hex quando
  possível, tirada da arte que já existe:
  - **Quem:** nome, idade aproximada, jeito (calma, animada, séria).
  - **Pele:** tom e hex.
  - **Cabelo:** cor e hex, comprimento (até onde chega: ombro, peito, cintura), tipo (liso, ondulado, cacheado), franja,
    penteado, acessórios.
  - **Rosto:** traços que distinguem (óculos, sardas, barba, bigode, rugas), expressão.
  - **Roupa:** cada peça com cor e hex (parte de cima, de baixo, sapato) e o que NÃO pode ter (uniforme escolar, laço,
    meia até o joelho...).
  - **Corpo:** sempre o da cliente 04 (altura, cabeça, ombros); diferenças só se pedidas (mais baixa, mais forte).
  - **Base e referências:** a imagem que vai ser editada (a cliente 04, ou o retrato da Fernanda para retratos) e a
    imagem de referência das cores (a figura já aprovada da pessoa), enviada junto na edição, não só escrita no texto.
  - **Poses e animações:** quais, em quais direções, o que segura.
  - **Custo:** por etapa e o total.
- **Proporção da cabeça: uma só para todos.** As referências, escolhidas pela Beatriz em novembro de 2026, são o
  **Tião** (`npc.builder`), a **Fernanda** e os clientes **01, 03, 04, 09 e 10**. A cabeça e o rosto de qualquer
  personagem novo devem ficar do tamanho dos deles. Ficaram fora do padrão, com o rosto maior: a protagonista, a
  corretora, a Gabi, a Dona Neusa e os clientes 02, 05 e 08. Na fase 2 todos foram refeitos (decisões 281 a 285), menos
  a protagonista, que fica para depois. A entregadora e os clientes 03, 06 e 09 ficam como estão. Antes de
  aprovar, compare o personagem novo com as referências lado a lado (`npm run lineup`).
- **Rosto:** traço simples, com olhos pequenos e sem brilho grande. Nada de rosto "anime" de olhos enormes.
- **Contorno e luz:** contorno marrom-escuro fino, de 1 px; 3 a 4 tons por material; luz de cima à esquerda.
- **Pele:** é marcada pela forma, nunca pela cor. A troca de tom de pele da protagonista usa um corpo numa cor-chave
  (ou uma máscara desenhada), para não "manchar" roupas bege e marrons.
- **Cabelo da protagonista:** é gerado já em cima da cabeça, no mesmo pedido, nunca como camada solta. Cabelo solto
  desencaixa nas animações.
- **Direções:** baixo, cima e lado; o outro lado é espelhado.

## 3. Itens na mão

- O item segurado (vassoura, bandeja, gato no colo, saco) fica preso a um **ponto da mão marcado em cada quadro** de
  cada pose. Nunca use um deslocamento fixo por direção.
- O item na mão tem o tamanho do objeto de verdade, em relação à pessoa. Uma bandeja ocupa mais ou menos a largura do
  tronco.
- Andando para baixo, o item fica na frente do corpo. Para cima, fica atrás (desenhado antes do corpo). De lado, o
  item vira junto (a bandeja em perspectiva, espelhada para o lado em que ela olha).
- Nada atravessa o corpo nem cobre o rosto. Um cabo longo (vassoura) vai inteiro na frente, inclinado para passar ao
  lado da cabeça.
- **Pegada da vassoura (para quando a protagonista for refeita):** gerar uma pose própria de varrer, e não reaproveitar
  a pose genérica de ação. As duas mãos ficam no cabo, **uma mais para cima que a outra**: a de cima perto do ombro e a
  de baixo na altura da cintura. O cabo cruza o corpo na diagonal, por fora, e as cerdas encostam no chão ao lado dos
  pés. A referência da Beatriz (nov/2026) é um boneco de frente segurando a vassoura assim. Com essa pose, a vassoura
  ganha dois pontos de mão (de cima e de baixo) em `data/hand_anchors.json`, no lugar de um só.

## 4. Objetos e cenário

- **Texto de estilo dos pedidos ao PixelLab**, igual em todos: "cozy cat café pixel art, 3/4 front top-down view,
  warm pastel palette (honey wood, cream, beige, sage green, soft pink), thin dark-brown outline, 3-4 tone shading per
  material with 1px highlights on top edges, light from top-left, rounded chunky shapes, rich small details, cute
  paw-print accents".
- **Âncora de estilo:** `assets/_pixellab/lote01/obj_7.png`, o pote de biscoitos.
- **Contorno fora do padrão** (preto, cinza ou sem contorno): não precisa gerar de novo. Ponha a peça em `OUTLINE_RECOLOR` ou
  `OUTLINE_ADD` (`scripts/import-pixellab.ts`) e rode o import da folha (decisão 280). Plantas e folhagem, não.
- **Paleta quente.** Cinza-azulado, azul liso e branco de plástico só aparecem com sombra quente e contorno marrom. Um
  objeto sem contorno marrom destoa.
- **Móveis e objetos sempre vazios:** sem gatos, pessoas ou coisas em cima. O conteúdo entra por camada no jogo.
- **Cores alternativas por troca de paleta**, em código. Não gere a mesma peça em várias cores.
- **Estados** (cheio/vazio, aberto/fechado) por edição da peça aprovada, para manter o mesmo desenho.

## 5. Mapas

- **Nada de grandes áreas de chão liso.** Cada sala tem tapete, mancha de luz, variação do piso ou um objeto a cada
  poucos tiles.
- **A grade do piso não pode aparecer.** Use pisos com variação, sem linha forte em toda borda de tile.
- **Cantos e paredes ocupados:** quadros, prateleiras, plantas, luminárias.
- **Arrume em cantinhos, não em fileiras simétricas.** Grupos de 2 a 4 peças, com algum desalinhamento.
- **Nunca a mesma peça repetida lado a lado sem variação.** Alterne o modelo, espelhe ou mude o conteúdo.
- **Nada solto (decisão 277).** Toda peça encosta em outra ou na parede, formando fileiras contínuas (`shiftX` emenda as que
  não ocupam a célula toda); ilhas com corredores de pelo menos 1,5 tile em volta, para a personagem passar; coisas
  pequenas (cestos, potes) ficam juntas de uma peça maior, nunca no meio do chão. Sem placas penduradas no meio da sala.
- **Perspectiva da nossa câmera (de frente, um pouco de cima):** na parede do fundo e nas ilhas, o que tem frente
  (prateleiras, geladeiras), virado para a câmera. Nas paredes dos lados, só o que se lê por cima (bancas inclinadas de
  hortifrúti, caixotes, freezers abertos): uma geladeira de perfil vira um painel liso. Peça de lado sai do
  `create_8_direction_object` com a peça de frente como referência (endireitar a frente antes, se ela vier torta).
- **Mercado:** prateleiras do corredor em fileiras horizontais, com o expositor de perfil fechando as pontas; o hortifrúti
  numa estante contínua na parede da esquerda e numa ilha à direita.

## 6. Interface

- **Fonte:** Monogram em tudo (decisão 305), embutida. Os tamanhos só em degraus: `var(--t1)` (etiquetas e textos
  curtos), `var(--t2)` (falas e leitura), `var(--t3)` e `var(--t4)` (títulos); `line-height` em 0.875, 1 ou 1.125;
  sem `letter-spacing` e sem negrito. No Phaser, `FONT` e `monoSize` de `src/game/fonts.ts` (8, 16, 24 ou 32 px).
- **Cores:** só os tokens de `src/game/ui/theme.css` (`--c-paper`, `--c-wood`, `--c-terra`...). Nunca uma cor solta
  no CSS. O Phaser lê os mesmos tokens por `themeColor`/`themeHex`.
- **Painel:** fundo papel (`--panel-bg`), borda madeira de 2 px (`--panel-edge`), cantos arredondados e sombra sólida
  embaixo (`box-shadow: 0 3px 0`). É um estilo só para todos os painéis.
- **Ícones:** sempre pixel art (as folhas de ícone pelo `iconHtml`). Nada de emoji nem desenho em CSS.
- **Por cima do jogo, só o essencial:** a HUD num painel só (hora, moedas, nota, energia), o balão de metas e a barra
  de itens. A faixa de teclas aparece só no prólogo.

## 7. Movimento

| O quê | Valor |
|---|---|
| Andar da protagonista | 80 px/s; correr ×1,6 (`data/player.json`) |
| Andar dos NPCs | 70 px/s; gatos, 40 px/s |
| Quadros por segundo | Andar 8 fps; sentar/respirar 2 a 3 fps; balões e marcadores 3 fps |
| Transição dos painéis | 0,12 a 0,14 s, com entrada curta (`panel-in`, `pop-in`); desligada com `prefers-reduced-motion` |

- **NPCs** entram andando pela porta ou pela borda, nunca surgem do nada. Andam por caminhos naturais, em diagonal
  quando livre, sem voltas desnecessárias.
- **Ninguém fica congelado.** Personagem parado respira ou pisca.
- **Toda ação importante tem resposta visual:** servir (vapor), limpar (brilho), ganhar moedas (moedinhas saltando),
  acertar uma meta (brilho no balão).

## 8. Texto

- **Curto, com o verbo no início e no imperativo:** "Limpe o porão", "Receba mais 2 gatos no café". As palavras da
  Beatriz definem o conteúdo e o padrão de escrita fica com quem escreve, a não ser que ela diga que é literal.
- **Neutro de gênero.** Quando não der, use `{g:feminino|masculino}`.
- **Metas e dicas não dizem onde achar as coisas.** Procurar faz parte do jogo.
- **Ícone no lugar de frase** sempre que o ícone bastar: preço com moeda, capacidade como "X/Y".
- **Teclas desenhadas, não frases:** faixa de teclas no formato "Enter: Pôr · G: Girar · Esc: Cancelar" (uma palavra por
  ação), que `keyHint.ts` desenha como teclas. O que não é tecla (arrastar, clicar) fica como texto, sem ":".
- Detalhes do balão de metas em `PLANO_TEXTOS_METAS.md`.
