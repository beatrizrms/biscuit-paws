# Plano de polimento: tirar a cara de amador

Diagnóstico de novembro de 2026, a partir de prints do jogo (tela inicial, abertura, café, diálogo, balão de metas,
celular, Market, rua, mercado, clínica e celular deitado) e dos prints da Beatriz. A arte isolada é boa (fachadas,
móveis do café); o que pesa é a **falta de um padrão geral**: cada parte veio de uma fonte e de um momento diferentes
(pacotes Cosy em 32 px, lotes do PixelLab em 64 px, CSS da interface, desenhos por código), e nada amarra o conjunto.

## Diagnóstico

### 1. Falta de um padrão geral (a causa de quase tudo abaixo)
- Não existe um guia que diga como cada coisa deve ser: proporção dos personagens, contorno, paleta, escala dos
  objetos, como um item fica na mão, fonte, cores e tamanhos da interface, ícones, ritmo das animações, tom dos textos.
- Cada lote novo segue o pedido do momento; o resultado são peças boas que não parecem do mesmo jogo.

### 2. Tipografia
- HUD, balão de metas, diálogos, celular e título usam a mesma fonte de sistema, sem relação com o pixel art.
- O título "Biscuit Paws" não tem logo: é a fonte com sombra.

### 3. Interface solta e por cima do jogo
- A faixa fixa de teclas ("Setas/WASD: andar · R: correr · E: interagir…") cobre o chão o tempo todo.
- Hora, moedas, nota e energia em três caixinhas empilhadas; a barra de itens no topo, em cima da parede; o
  subconsciente em outro canto. Painéis se sobrepõem (o balão de metas por cima do celular).
- A caixa de diálogo ocupa um quarto da tela, com muito espaço vazio.
- No celular deitado: botões retangulares só com texto ("Cel", "Mover") e a barra de itens cheia de quadrados vazios.
- Os painéis abrem e fecham de uma vez, sem transição.

### 4. Personagens: proporções diferentes
- Uns NPCs são mais cabeçudos que outros, e o avatar da jogadora é o mais cabeçudo de todos.
- Origem: a Gabi, a Dona Neusa e os clientes vieram de pacotes gerados em 32x64; a protagonista (manequim com roupas
  e penteados em camadas) e outros NPCs vieram do PixelLab em 64x128, cada lote com a sua proporção e o seu traço
  (alguns com rosto e sombreado mais "anime").
- Escala entre personagens e bichos: a personagem tem uns 2 tiles de altura; o gato, menos de meio tile.
- A cor da pele da protagonista "mancha" a roupa. Causa: a troca de tom de pele (`scripts/import-mannequin.ts`,
  máscara da roupa) decide pele por cor; do pescoço para baixo, todo pixel com cor parecida com a do rosto vira pele, e
  roupas em bege, creme ou marrom claro entram junto. A correção é marcar a pele pela forma (uma máscara desenhada por
  quadro, ou o corpo do manequim numa cor-chave), não pela cor.

### 5. Objetos na mão fora do lugar
- A vassoura e a bandeja não encaixam na mão dos personagens (a bandeja já foi subida para o peito, mas o problema é
  geral).
- Causa provável: o item na mão é desenhado com um deslocamento fixo por direção, e não preso a um ponto da mão em
  cada quadro da animação. Quando o braço balança ou a pose muda, o item fica no ar.

### 6. Objetos fora do estilo
- Carro azul liso, comedouro automático de plástico branco, clínica cinza-azulada: sem o contorno marrom e fora da
  paleta quente dos móveis.
- Ícones misturados: pixel art, desenhos em CSS (relógio e calendário do celular) e emoji (📝 em "anotar o que falta").

### 7. Mapas vazios, em grade e repetidos
- Grandes áreas de chão liso (café, clínica, mercado); no mercado e na clínica a grade do piso aparece e reforça a
  sensação de tabuleiro.
- Móveis em fileiras alinhadas e simétricas; paredes e cantos vazios.
- Mercado: os caixotes de fruta são cópias exatas em formação.

### 8. Pouco movimento
- NPCs surgem do nada e andam em ângulos retos; parados, ficam congelados (sem respirar, piscar, olhar em volta).
- Servir, limpar e ganhar moedas não têm resposta visual (vapor, brilho, moedinhas saltando).

### 9. Texto demais
- Quase tudo é explicado por frases (balão, avisos, faixa de teclas). Jogos polidos mostram mais por ícone e animação.

### 10. Primeira impressão
- Tela inicial: o título em fonte de sistema e "Toque ou clique para começar" numa pílula.
- Abertura: fundo escuro com estrelas e uma caixa de texto. Os primeiros minutos são os de menos polimento.

## O guia de padrão (a escrever primeiro)

Um documento curto (`docs/GUIA_DE_ESTILO.md`) que vira a regra para tudo o que entra no jogo, com exemplos:

| Área | O que o guia define |
|---|---|
| Personagens | Altura em tiles (pessoa adulta, criança, gato, cachorro); cabeça em proporção ao corpo (uma medida só para todos); estilo do rosto; contorno e sombreado |
| Itens na mão | Ponto da mão em cada quadro de cada pose (âncora), o tamanho do item na mão, de que lado ele fica em cada direção |
| Objetos e cenário | Contorno (cor e espessura), paleta (as cores permitidas), luz de cima à esquerda, escala em tiles (porta, balcão, vaso, carro) |
| Mapas | Densidade mínima de objetos por área, variação do piso, nada de cópia exata lado a lado, cantinhos em vez de fileiras |
| Interface | Uma família de fontes (números e textos), cores em tokens, tamanhos de texto, cantos, sombras, um estilo de botão, um estilo de painel, um conjunto de ícones |
| Movimento | Velocidade de caminhada, quadros por segundo das animações, tempo das transições da interface, quando há partícula |
| Texto | Tom, tamanho máximo de frase, quando usar ícone em vez de frase (junto do `PLANO_TEXTOS_METAS.md`) |

## Plano (do mais rápido e de maior efeito ao mais trabalhoso)

| Fase | O quê | Esforço |
|---|---|---|
| 0. Guia de padrão | Feito: `docs/GUIA_DE_ESTILO.md` (decisão 273), com as referências de cabeça escolhidas pela Beatriz e `npm run lineup` para comparar | baixo |
| 1. Interface e tipografia | Feito: fonte (Pixelify Sans + Nunito, decisão 270); faixa de teclas só no prólogo; HUD num painel só; nome de quem fala dentro da caixa, alinhado ao texto; emoji do cardápio trocado por ícone; entrada curta dos painéis (decisão 271). Depois: caixa de fala menor e centrada, e os ícones dos apps do celular em pixel art no lugar dos desenhos em CSS (decisão 272). Fase concluída | baixo (código) |
| 2. Personagens | Por último (decisão da Beatriz). Medida escolhida (guia, seção 2). Refazer: a protagonista (com o cabelo gerado sobre a cabeça, a pele por cor-chave e uma pose própria de varrer, com uma mão acima da outra no cabo), a corretora, a Gabi, a Dona Neusa e os clientes 02, 05 e 08; faltam conferir Jacque, entregadora e clientes 06 e 07 | médio a alto (PixelLab) |
| 3. Itens na mão | Feito (decisão 274): `npm run hands` mede as mãos por roupa, pose, direção e quadro; bandeja, louça, gato, caixas e vassoura presos a elas. Rodar de novo quando a protagonista for refeita | médio (dados e código) |
| 4. Coesão dos objetos | Passar os objetos fora do estilo pelo contorno e pela paleta; trocar os ícones avulsos | médio (PixelLab e scripts) |
| 5. Logo e tela inicial | Logo desenhado; menu com a rua animada; abertura com cena em vez de só texto | médio |
| 6. Mapas com vida | Feito (decisões 277 e 278): piso novo sem grade, clínica em cantinhos, mercado com corredores, praça e beco sem nada solto, neve da rua natural. O café fica como está (o piso velho é proposital) | médio |
| 7. Movimento | Feito (decisão 275): NPCs em linha reta e na diagonal quando dá; parados respirando; câmera suave; moedinhas e vapor ao servir (varrer já tinha poeira e brilho) | médio |
| 8. Texto | Feito (decisão 276): explicações longas encurtadas; faixas de teclas com as teclas desenhadas e uma palavra; preço com a moeda | baixo a médio |

Ordem combinada (nov/2026): 0, 1, 3, 6, 7 e 8 feitas; depois 6, 4 e 5; os personagens (2) por último. Ordem sugerida antes: 0 e 1 primeiro (mudam a primeira impressão sem arte nova), depois 2 e 3 (o que mais se nota em
movimento), e o resto em seguida. Cada fase com print antes e depois.
