# Tutorial: organizar os personagens no PixelLab (8 direções)

Escrito em 21/11/2026, para fazer no site do PixelLab quando as gerações renovarem (08/12).
Os nomes dos botões no site podem estar um pouco diferentes do que está aqui: o tutorial segue o que cada
ferramenta faz.

## O objetivo

Cada personagem fica assim no PixelLab:

- **Uma base de 8 direções:** sul, sudeste, leste, nordeste, norte, noroeste, oeste e sudoeste.
- **Uma animação por movimento, com todas as direções dentro dela.** Por exemplo, `walk` tem as 8 direções no
  mesmo grupo. Nada de `andar` com sul e leste e `andar_costas` com o norte à parte.
- **Nomes iguais em todos os personagens**, para o import do jogo achar tudo sozinho:

| Animação | Nome | Direções |
|---|---|---|
| Andar | `walk` | as 8 |
| Acenar | `wave` | as 8 (ou só `south`, se quiser economizar) |
| Segurar algo (mãos juntas na frente do peito) | `hold` | as 8 (ou só `south`) |
| Outras poses (martelar, carregar caixa...) | um nome curto em inglês | as que fizerem sentido |

## Regras de todos os personagens

- **View:** low top-down (a câmera do jogo: de frente e um pouco de cima).
- **Tamanho:** o mesmo da base antiga (112 x 128 nos refeitos no padrão da cliente 04; 128 x 128 nos outros).
- **Contorno:** single color outline (marrom-escuro fino).
- **Mãos sempre vazias.** Nunca cite um objeto no texto (bandeja, caixa, café): a IA desenha o objeto junto. O
  jogo desenha os objetos por cima.
- **Caminhada:** use o mesmo modelo (template) em todas as direções. Nos refeitos, use `walking` (6 quadros). Se
  uma direção sair errada, gere de novo **só ela, dentro da mesma animação**. Não crie uma animação nova.
- **Tag:** `biscuit paws` em todos.

## Parte 1. Refazer os 10 personagens de 4 direções

Estes têm a base de só 4 direções. A base não ganha direções novas: é preciso criar um personagem novo a partir da
frente já aprovada (o rosto, a roupa e as cores continuam os mesmos).

| Personagem no PixelLab | ID | O que tem hoje |
|---|---|---|
| nubia | `853e47e7-6fcf-4c53-a181-bdfafd413bc4` | andar (S, L), andar_costas (N), acenar (S) |
| camila | `54ee58af-2ab9-419b-9858-79ababf1e3d1` | andar (S, L), andar_costas (N), acenar (S) |
| gabi_v3 | `c8a32846-c486-4cd5-8fd2-4b297090fde6` | andar (O, S, L), andar_costas (N), acenar, segurando_caixa, segurando_cafe (S) |
| neusa_v2 | `bc2824e1-5e63-48b2-883a-49a2c8faea3e` | 6 animações em 4 direções |
| corretora_v2 | `4d9f5fa7-808c-40e5-961e-76c6768e29f6` | 6 animações em 4 direções |
| jacque_v2 | `66d3f630-4726-438c-ac62-41f5ba62a88f` | 5 animações em 4 direções |
| cliente02_v2 | `d523b808-0e23-46a8-9069-0c1f7f2a2497` | 11 animações em 4 direções |
| cliente05_v2 | `57cc0eef-49c9-4285-b472-50d583264b31` | 10 animações em 4 direções |
| cliente07_v2 | `83e81c8a-63b8-40a3-b745-ac248a509642` | 7 animações em 4 direções |
| cliente08_v2 | `a1b8ce7f-1913-4014-91a7-f3f0fa79556b` | 9 animações em 4 direções |

### Passo a passo (um personagem)

1. **Pegue a frente aprovada.** Abra o personagem antigo e baixe a rotação **south**. É a referência: ela precisa
   estar de frente, olhando para a câmera.
2. **Crie o personagem novo a partir dela.** Em criar personagem, escolha a opção a partir de uma imagem de
   referência (modo v3), suba a south e preencha:
   - Directions: **8**
   - View: **low top-down**
   - Size: igual ao antigo (112 x 128)
   - Description: copie a descrição do personagem antigo (está na página dele). Ajuda a IA a manter os detalhes
     de costas e de lado.
   - Nome: o mesmo do antigo, sem o "_v2" (`nubia`, `camila`, `gabi`, `neusa`...).
   - Custo: cerca de **2 gerações**.
3. **Confira as 8 rotações** antes de animar (veja a lista de conferência no fim). Se uma vier errada, refaça a base
   agora: animar em cima de uma base ruim gasta mais.
4. **Andar.** Anime com o modelo **walking** e marque as **8 direções de uma vez**. O nome da animação é `walk`.
   - Custo: em torno de **1 a 3 gerações por direção**. O site mostra o valor antes de confirmar.
   - Confira as 8. Se uma sair errada (o norte de frente, por exemplo), gere de novo **só aquela direção dentro de
     `walk`**.
5. **Acenar.** Animação personalizada (custom), texto: `friendly wave hello with ONE hand, the other arm relaxed`.
   Escolha as direções. Nome: `wave`.
   - Para completar direções depois, adicione-as à **mesma** animação `wave`.
   - Custo: em torno de **3 gerações por direção**.
6. **Segurar** (só nos personagens que já tinham): animação personalizada, texto:
   `standing still, both hands together in front of the chest, elbows down, empty hands`. Nome: `hold`. Mesmas
   regras do acenar.
7. **Os clientes** têm outras poses (sentar, comer, beber...). Refaça só as que o jogo usa e me pergunte antes:
   eu confiro no código quais são.
8. **Não apague o antigo ainda.** Quando eu importar o novo e você aprovar no jogo, aí sim apague o personagem
   antigo.

Custo por personagem: base 2 + andar 8 a 24 + acenar 3 (só sul) a 24 (8 direções) = **cerca de 13 a 50 gerações**.

### Cuidados por personagem

- **Jacque:** o piercing vai no **septo** (embaixo do nariz), não na boca. A versão v2 já saiu certa: use a south
  dela como referência e confira o piercing nas 8 rotações.
- **Núbia:** a calça veio rosada ou cinza na caminhada da outra vez. Confira se ficou creme em todas as direções.
- **Camila:** no aceno antigo, o 2º quadro tinha um borrão cinza. Confira os quadros do aceno.
- **Gabi:** `segurando_caixa` e `segurando_cafe` viram uma pose só, `hold` (mãos vazias). A caixa e o café o jogo
  desenha.

## Parte 2. Só completar as diagonais da caminhada

Estes já têm a base de 8 direções. Falta a caminhada nas diagonais (sudeste, nordeste, noroeste, sudoeste).

| Personagem no PixelLab | ID | Caminhada hoje |
|---|---|---|
| Construtor (Tião) | `09105eec-6bf9-4764-a539-2ecf9c11766b` | `construtor_walk`, 4 direções, modelo walking-4-frames |
| Atendente do mercado | `e30b9e5a-ba8f-4a55-8f2d-0acfa909766d` | conferir |
| Cliente 01 | `2981d831-324c-4709-82c8-f7a50568ef4f` | conferir |
| Cliente 03 | `d5747333-223a-4f6d-8e0d-8b17fefb1926` | conferir |
| Cliente 04 | `6f5dbdb2-3ea2-4d7f-aef7-f11afddac2aa` | conferir |
| Cliente 06 | `d59f2d46-f23b-4781-b0d8-7f4f42ba7933` | conferir |
| Cliente 09 | `af4303de-cafc-4548-8d1b-d51cc45cc1d2` | conferir |
| Cliente 10 | `fc07c1fb-acd3-4c1a-9873-2e4c1876d518` | conferir |
| Entregadora | `1a6d52c0-7cc4-4acd-9548-8b2248176d8a` | conferir |
| Fernanda | `9cdadd98-79e5-4b5e-a8c1-8898606bad6b` | conferir |

### Passo a passo

1. Abra o personagem e a animação de andar que já existe.
2. **Adicione as 4 diagonais dentro dela**, com o **mesmo modelo** das outras direções. No Tião é
   `walking-4-frames`; nos outros, veja qual está escrito na animação. Modelo diferente dá número de quadros
   diferente, e a caminhada fica desencontrada.
3. Confira as 4 diagonais.
4. Se quiser padronizar os nomes, renomeie a animação para `walk`.

Custo: cerca de **4 a 12 gerações por personagem**.

## O que fica fora deste tutorial

- **A protagonista.** Ela é montada em camadas: manequim, cada cabelo e cada roupa ("Manequim", "Cabelo ...",
  "Roupa ...", "Peca ..."), todos com as mesmas poses quadro a quadro. Diagonal nela precisa ser gerada pelo
  mesmo método, junto comigo, senão as camadas não encaixam. Não mexa nesses personagens no site.
- **Gatos** ("gato_ruivo..."): os gatos do jogo são do pacote Cosy Cats e ficam em 4 direções.
- **Joca** (64 x 64) e os personagens de teste (warrior woman, old man bald, blonde farmer, bear): não fazem parte
  do padrão atual. Confira comigo antes de mexer.

## Lista de conferência (cada personagem)

- [ ] As 8 rotações são a mesma pessoa: rosto, cabelo, roupa e cores iguais à frente aprovada.
- [ ] O **norte** está **de costas** (sem rosto), e o nordeste e o noroeste mostram o rosto só de perfil, de trás.
- [ ] Oeste e leste olham mesmo para os lados certos (não espelhados ao contrário).
- [ ] O tamanho da figura é igual ao do antigo: a cabeça na mesma altura e os pés encostando embaixo.
- [ ] Em `walk`, todas as direções têm o mesmo número de quadros.
- [ ] O aceno é com **uma** mão só.
- [ ] As mãos estão vazias (nada de caixa, xícara ou bandeja desenhada).
- [ ] Nenhuma mancha ou borrão solto em volta da figura em nenhum quadro.
- [ ] As animações estão no grupo certo, com os nomes `walk`, `wave`, `hold`.

## Quando terminar

Me avise quais personagens ficaram prontos. Eu baixo, importo para o jogo (`scripts/import-npcs.ts`), confiro a
escala ao lado dos outros e te mando os prints. Só depois disso apague as versões antigas no PixelLab.

O código das 8 direções no jogo (a personagem e os NPCs andando na diagonal, usando o desenho de lado enquanto a
diagonal não existir) pode ser feito antes, sem gastar geração.
