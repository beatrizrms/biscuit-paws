# Pedidos de arte para o ChatGPT: Biscuit Paws

São {{TOTAL}} pedidos. Cada pasta em `pedidos/` é **um pedido** (uma conversa ou uma mensagem no ChatGPT).

## Como fazer cada pedido
1. Abra a pasta do pedido (ex.: `pedidos/01_cafe_1`).
2. No ChatGPT, anexe **duas imagens**:
   - `molde.png` da pasta: a arte atual de cada peça já no lugar e no tamanho certos, sobre fundo magenta;
   - a **folha de referência de estilo**: a imagem do café que o ChatGPT gerou e que aprovamos.
3. Cole o texto de `pedido.txt` inteiro.
4. Confira a resposta antes de baixar:
   - tem 1024 x 1024?
   - o fundo é magenta liso, **sem xadrez**?
   - cada objeto continua no mesmo lugar do molde?
   - os pixels são quadradinhos iguais, sem borrão?
   
   Se algo falhar, peça de novo: "Refaça respeitando o formato: fundo magenta #FF00FF liso, cada pixel um quadrado exato de 4x4, objetos nas mesmas posições do molde."
5. Baixe em **PNG** (não JPG, nem WEBP se der para escolher). Salve com o nome da pasta, ex.: `01_cafe_1.png`.
6. Me mande as imagens. O nome do arquivo me diz qual `layout.json` usar. Eu converto, limpo, ponho no jogo e te mostro antes de trocar.

## Dicas
- Faça **um pedido por vez** e confira. Se o primeiro sair bom, mantenha a mesma conversa nos seguintes, para o estilo ficar igual.
- Peças do mesmo objeto (ex.: cadeira de frente, de costas e de lado) estão no mesmo pedido de propósito: peça que **pareçam a mesma cadeira**.
- Nos pedidos da rua de **inverno**, as peças vão **sem neve por cima**. A neve é uma camada separada, e eu refaço por código em cima da arte nova.
- As fachadas vão em escala **2x** (cada pixel da arte = quadrado de 2x2), porque são grandes. O texto do pedido já diz isso.

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
