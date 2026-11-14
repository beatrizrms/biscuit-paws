# Proposta: o ritmo do café e o ajudante

Status: **em andamento.** Feito: a procura pela reputação (seção 1, a tabela abaixo; medido nos testes: ~12 clientes por dia com reputação 0 e ~23 com 85). As máquinas antigas também vêm por conquista: lava-louças com 120 clientes desde a inauguração e robô aspirador com 200. O resto continua para decidir.

## O problema

Com o café crescendo, atender pode ficar repetitivo ou trabalhoso demais. Ao mesmo tempo, o jogo é livre: a jogadora
decide quantas mesas, quanta louça e quanto tempo o café abre. Travar móveis até um certo momento iria contra isso.

## O que o jogo faz hoje

- O número de clientes não depende das mesas. Eles chegam um por vez, a cada 25 a 50 minutos de jogo (sorteado), das
  9h às 18h, com 1 hora de almoço. Dá uns **12 a 13 por dia** depois da inauguração e uns **6 a 7** antes (o intervalo
  dobra).
- Mais mesas e louça não trazem mais gente: só deixam mais gente ao mesmo tempo e a fila menor.
- A reputação (0 a 100, com os níveis Notada na vila 20, De confiança 40, Xodó dos gatos 60 e Lenda felina 80) não
  mudava quantos clientes vêm (agora muda: seção 1).
- Já existe automação pequena: lava-louças (200), alimentador automático (150), caixa de areia automática (180) e o
  robô aspirador (600). A aba **Assistência** do Market já existe.
- Receita de um dia cheio: ~12 clientes × ~13 moedas ≈ **150 a 170 moedas**, mais gorjetas.

Conclusão: o ritmo **já é controlado pelo jogo**, não pela quantidade de móveis. Não precisa travar nada.

## A proposta em uma frase

O trabalho cresce com a fama do café (reputação), a jogadora controla o quanto quer encarar (horário e cardápio) e,
quando o café já está movimentado, ganha a opção de um ajudante: primeiro uma máquina, depois uma pessoa, que ela
escolhe o que vai fazer e paga por dia.

## 1. A procura cresce com a reputação

O intervalo entre clientes passa a ser multiplicado por um fator da reputação:

| Reputação | Nível | Intervalo | Clientes por dia (aprox.) |
|---|---|---|---|
| 0 a 19 | (início) | × 1,0 | 12 |
| 20 a 39 | Notada na vila | × 0,85 | 14 |
| 40 a 59 | De confiança | × 0,7 | 17 |
| 60 a 79 | Xodó dos gatos | × 0,6 | 20 |
| 80 a 100 | Lenda felina | × 0,5 | 24 |

- A pressão aparece para quem cresce. Quem prefere um café calmo controla pelo horário (abrir menos horas), pelo
  almoço e por um cardápio curto, que já existem.
- Opcional: um interruptor no app Horário, **"Movimento: tranquilo / normal / cheio"**, que multiplica o fator
  (× 1,4 / × 1 / × 0,8). Dá à jogadora o controle explícito do ritmo, sem travar nada.
- Os números ficam em `data/service.json` (fácil de ajustar no teste).

## 2. O ajudante em duas etapas

### Etapa 1: a máquina (libera com um selo de clientes)

- **Quando:** selo **"100 clientes atendidos"** (milestone.customers_100). Nessa altura ela já atendeu bastante à mão e
  sente o trabalho; é o "regador automático" do Stardew: um prêmio para o cansaço que ela já conhece.
- **O quê (uma, à escolha, no Market > Assistência):**
  - **Robô garçom:** leva a louça suja das mesas até a pia ou o lava-louças.
  - **Cafeteira de autoatendimento:** clientes em pé no balcão se servem do café preto e do chá sozinhos (só as bebidas
    simples; o resto continua com ela).
- **Custo:** compra única (~400 a 600 moedas) e uma pequena manutenção (quebra como os equipamentos e chama o Tião).
- Arte: um objeto por máquina (PixelLab, como o robô aspirador).

### Etapa 2: a pessoa (libera com reputação e história)

- **Quando:** reputação **De confiança (40)** e o **quintal aberto**. Chega por uma cena: alguém da vila pede emprego
  (sugestão: um jovem que já aparece como cliente, ou um parente da Dona Neusa ou da Gabi; a definir).
- **Ela escolhe a função** (troca quando quiser, no celular):
  - **Caixa e entrega:** pega o pedido pronto no balcão e leva ao cliente.
  - **Louça:** recolhe e lava tudo.
  - **Preparo:** prepara as receitas simples (bebidas); as de forno continuam com ela.
- **Salário por dia** em que o café abre: **~35 moedas** (uns 20% da receita do dia). Dia fechado, não paga. Sem
  dinheiro no fim do dia, o ajudante avisa e não vem no dia seguinte (sem castigo maior).
- **Ritmo humano:** é mais lento que ela (anda e faz em uns 70% da velocidade dela) e tem horário (sai no almoço). Ajuda,
  mas não faz o jogo sozinho.
- **Laço:** pontos de relação como os vizinhos (conversa por dia), e falas sobre os gatos. Combina com o tom do jogo.
- Arte: um personagem 64x128 (caminhada, segurando bandeja).

## 3. Por que assim

- **Não trava nada:** mesas, louça e móveis continuam livres. Quem limita é a reputação, o espaço e o dinheiro.
- **A ajuda chega quando o trabalho pesa:** a procura sobe com a fama; o ajudante libera mais ou menos no mesmo ponto.
- **É escolha, com custo:** quem gosta de atender pode fazer tudo sozinha a vida toda.
- **A recompensa é o tempo para os gatos:** o jogo é sobre eles. O ajudante libera tempo para cuidar, para a feira, a
  CED e os amigos. Não é "menos cliques", é "mais tempo para o que importa".

## 4. Ordem sugerida para fazer

1. ~~Procura pela reputação~~ **feito** (`data/service.json: reputationArrival`).
2. ~~O interruptor "Movimento"~~ não vai ter (decisão dela).
2. O interruptor "Movimento" no app Horário (opcional).
3. ~~A máquina~~ **feito:** o robô garçom (conquista Bandeja cheia, 100 clientes; arte provisória).
4. A pessoa (NPC novo, cena de chegada, as três funções, salário).

## Para decidir

1. ~~A procura sobe com a reputação?~~ Sim, feito com os fatores da tabela (ajustar depois de jogar).
2. Quer o interruptor "Movimento: tranquilo / normal / cheio"?
3. A máquina: robô garçom, cafeteira de autoatendimento, ou as duas (uma de cada vez)?
4. Selo da máquina em 100 clientes? E a pessoa em reputação 40 com o quintal aberto?
5. Quem é o ajudante (alguém novo ou alguém já conhecido)?
6. Salário de ~35 por dia está bom?
