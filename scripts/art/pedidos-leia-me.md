# Pedidos de arte para o ChatGPT: Biscuit Paws

São {{TOTAL}} pedidos. Cada pasta em `pedidos/` é **um pedido** (uma conversa ou uma mensagem no ChatGPT).

## Como fazer cada pedido
1. Abra a pasta do pedido (ex.: `pedidos/01_cafe_1`).
2. No ChatGPT, anexe **duas imagens**:
   - `molde.png` da pasta: mostra o que é cada objeto e o tamanho dele no jogo (a posição na resposta pode ser livre);
   - a **folha de referência de estilo**: a imagem do café que o ChatGPT gerou e que aprovamos.
3. Cole o texto de `pedido.txt` inteiro.
4. Confira a resposta antes de baixar:
   - o fundo é magenta liso, **sem xadrez**, e os objetos não se encostam?
   - **o tamanho bate?** Porta, estante e janela altas (2 tiles); árvore de gato com 2 x 3; xícara pequena. Compare com o molde.
   - os objetos da mesma vista (cadeira de frente, de costas, de lado) parecem o mesmo móvel?
   
   Se algo falhar, peça de novo: "Refaça respeitando o tamanho em tiles de cada objeto (1 tile = 128 px), fundo magenta #FF00FF liso e objetos separados."
5. Baixe em **PNG**. Não use JPG nem WEBP: a compressão deixa um contorno roxo em volta dos objetos. Salve com o nome da pasta, ex.: `01_cafe_1.png`.
6. Me mande as imagens. O nome do arquivo me diz qual `layout.json` usar. Eu converto, limpo, ponho no jogo e te mostro antes de trocar.

## Dicas
- Faça **um pedido por vez** e confira. Se o primeiro sair bom, mantenha a mesma conversa nos seguintes, para o estilo ficar igual.
- Peças do mesmo objeto (ex.: cadeira de frente, de costas e de lado) estão no mesmo pedido de propósito: peça que **pareçam a mesma cadeira**.
- Nos pedidos da rua de **inverno**, as peças vão **sem neve por cima**. A neve é uma camada separada, e eu refaço por código em cima da arte nova.
- A posição dos objetos na imagem é livre: eu recorto cada um automaticamente pelo fundo magenta. O que importa é o **tamanho em tiles** e a **mesma escala** em toda a imagem.
- Variações (outra cor ou estampa do mesmo objeto) são bem-vindas se sobrar espaço; viram opções novas no catálogo.
- As fachadas são grandes, então nelas 1 tile = 64 px (o texto do pedido já diz isso).

## O que NÃO está nos pedidos (e por quê)
| O quê | Por quê | Quem faz |
|---|---|---|
| Pisos, paredes, lambri, chão e calçada da rua, grama, tijolo, sebe | Precisam emendar sem costura com o vizinho; gerador de imagem não garante isso | Eu, por código |
| Balcões (esquerda, meio, direita) | As peças encaixam lado a lado | Eu, por código |
| Cafeteira, bule, liquidificador, fogão, forno, pia (animados) | Cada um tem 6 a 7 quadros que precisam ser idênticos, mudando só o detalhe | Eu, por código |
| Teias, poeira, manchas, raios de sol, brilhos | São translúcidos; o fundo magenta não guarda transparência | Eu, por código |
| Neve por cima (inverno) | Camada separada que precisa casar pixel a pixel com a arte de baixo | Eu, por código |
| Louça (xícara, prato, copo) | Acabei de refazer no estilo novo, em 16 e 32 px | Já feito |
| Gatos | Arte do leckie1989 (Cosy Cats): **a licença proíbe usar com IA**. Não envie essas imagens para o ChatGPT | Decidir depois |
| Personagens e NPCs | Ainda estamos decidindo o estilo (teste de mulher e homem) | Decidir depois |
| Botões e painéis da interface | Molduras de 9 partes que precisam de cantos exatos | Depois, se precisar |

## Pasta `folhas_atuais/`
As folhas como estão hoje no jogo, só para consulta. Não tem arte do leckie1989.

## Índice dos pedidos
{{INDICE}}
