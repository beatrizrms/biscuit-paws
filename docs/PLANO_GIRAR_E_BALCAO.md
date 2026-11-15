# Plano: um item só por móvel (girar a cadeira, balcão que se completa)

Pedido de 2026-11-15: hoje o mesmo móvel aparece várias vezes no Market, uma por posição.

## O que existe hoje

- **Cadeira:** 4 itens (de frente, de costas, esquerda, direita).
- **Balcão:** 3 cores (madeira, A, B), cada uma com 4 módulos (esquerda, meio, direita, único) = 12 itens, mais o
  balcão com caixa registradora.
- **Outros com direção:** banqueta do balcão de parede (frente, esquerda, direita), cadeira de vime e espreguiçadeira
  do quintal (normal e virada para a esquerda).

## Como vai ficar

**Girar (cadeira, banqueta, cadeira de vime, espreguiçadeira):**
- O Market vende um item só (ex.: "Cadeira").
- Com o móvel na mão (posicionando ou mudando de lugar), **girar** troca a direção: no teclado uma tecla (proposta:
  **G**, porque o R já é correr), no celular um botão **Girar** ao lado de Soltar.
- Por dentro, girar troca entre os itens que já existem (chair_front → chair_right → chair_back → chair_left). Por isso
  **nenhum ID muda** e os saves antigos continuam iguais. Guardar na mochila volta sempre para o item principal.

**Balcão que se completa:**
- O Market vende só o **módulo único** de cada cor.
- Posicionado sozinho, ele é o módulo único. Com outro balcão da mesma cor encostado do lado, o desenho escolhe o
  pedaço certo: ponta esquerda, meio ou ponta direita, para formar o balcão inteiro.
- O desenho é decidido na hora de desenhar (pelos vizinhos), não no save. Ao tirar um módulo, os vizinhos voltam a
  fechar a ponta sozinhos.
- O que vai em cima (cafeteira, bule, louça) continua igual: todo módulo é um balcão.

## Etapas

1. **Dados:** as famílias de móveis (`variants`): a ordem do girar e qual é o item principal (o que fica à venda).
   Os outros itens da família saem do Market, mas continuam existindo.
2. **Núcleo (src/core):** girar (troca o item posicionado pelo próximo da família, se couber no lugar) e o balcão
   (dado um módulo e os vizinhos, qual pedaço desenhar). Com testes, inclusive um save antigo com chair_left e
   counter_mid.
3. **Jogo:** a tecla e o botão Girar; o fantasma de posicionar já mostra a direção nova; a dica do rodapé.
4. **Mochila e Market:** um cartão só por família; quem já tinha os itens antigos na mochila continua com eles (podem
   ser posicionados e girados normalmente).
5. **Conferir:** prints do balcão com 1, 2, 3 e 4 módulos, de cada cor, e da cadeira girando no PC e no celular.

## Decidido (2026-11-15)

- O balcão com caixa registradora continua um item à parte (fora da família).
- Balcões de cores diferentes encostados **não** se juntam: cada um fecha a própria ponta.

- Girar: tecla **G** no teclado e um botão **Girar** no celular (ao lado de Soltar, só com o móvel na mão).
