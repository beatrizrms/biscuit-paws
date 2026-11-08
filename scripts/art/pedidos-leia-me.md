# Pedidos de arte para o ChatGPT: Biscuit Paws

São {{TOTAL}} pedidos, na escala nova do jogo: **1 tile = 64 x 64 pixels de arte**.

## Como usar (sem mandar um por um)
1. Abra uma conversa nova no ChatGPT e anexe **duas coisas**:
   - o arquivo **`PROMPT_CHATGPT.md`** deste zip: tem todas as regras e a lista completa dos {{TOTAL}} pedidos;
   - a **folha de referência de estilo**: a imagem do café que o ChatGPT gerou e que aprovamos.
2. Escreva: **"Leia o PROMPT_CHATGPT.md e a referência. Faça o pedido 01."**
3. Quando a imagem vier, confira (abaixo) e baixe em **PNG**. Salve com o número do pedido, ex.: `01.png`.
4. Na mesma conversa: **"Faça o pedido 02."** E assim por diante.
5. Me mande as imagens (pode ser várias de uma vez). O número no nome me diz qual pedido é.

Os moldes (`pedidos/NN_xxx/molde.png`) são opcionais: mostram a arte atual de cada item, se o ChatGPT não entender o que é algum.

## Conferir cada imagem
- Fundo magenta liso, **sem xadrez**, e os itens não se encostam.
- **Tamanho:** porta, estante e janela altas (2 tiles); árvore de gato com 2 x 3; xícaras e comidas pequenas.
- **De 2 a 3 variações** de cada item (de cor ou de modelo, como diz a lista), lado a lado (menos ícones, fachadas e sujeira).
- **Estados** (tigela vazia/cheia, luminária apagada/acesa, porta fechada/aberta, planta viçosa/murcha...): um embaixo
  do outro, o mesmo objeto na mesma posição, e cada variação em todos os estados.

O `PLANO_PIXELLAB.md` lista item por item as variações, os estados e quantos sprites saem no fim.
- **Balcões:** tampo liso, sem nada em cima, e as peças com a mesma altura.
- **Itens de pôr em cima** (louça, comida, utensílios, registradora): pequenos e sem mesa embaixo.

## Se um item sair errado (importante)
**Não peça para ele "ajustar" a imagem**: ele redesenha tudo e estraga o que estava bom.
Peça só o item errado, numa imagem nova:

> "Refaça só o item *cadeira vista de costas* do pedido 01, em imagem nova, seguindo as regras. Não mude os outros."

Eu recorto cada item separado e posso juntar itens de imagens diferentes. Então não precisa sair tudo certo de uma vez.

## O que NÃO está nos pedidos (e por quê)
| O quê | Por quê | Quem faz |
|---|---|---|
| Pisos, paredes, lambri, chão e calçada da rua, grama, tijolo, sebe | Precisam emendar sem costura com o vizinho; gerador de imagem não garante isso | Eu, por código |
| Cafeteira, bule, liquidificador, fogão, forno, pia (animados) | Cada um tem 6 a 7 quadros que precisam ser idênticos, mudando só o detalhe | Eu, por código |
| Teias, poeira, manchas, raios de sol, brilhos | São translúcidos; o fundo magenta não guarda transparência | Eu, por código |
| Neve por cima (inverno) | Camada separada que precisa casar pixel a pixel com a arte de baixo | Eu, por código |
| Louça (xícara, prato, copo) | Refeita no estilo novo | Eu, por código |
| Gatos | Arte do leckie1989 (Cosy Cats): **a licença proíbe usar com IA**. Não envie essas imagens ao ChatGPT | Decidir depois |
| Personagens e NPCs | Estilo em decisão (teste de mulher e homem) | Decidir depois |
| Botões e painéis da interface | Molduras de 9 partes que precisam de cantos exatos | Depois, se precisar |

## Pasta `folhas_atuais/`
As folhas como estão hoje no jogo, só para consulta. Não tem arte do leckie1989.

## Índice dos pedidos
{{INDICE}}
