# QA: jogar "errado"

Cenários de uma jogadora que quer achar brechas: não faz o que o jogo pede, faz na ordem errada, tenta tirar vantagem.
Novembro de 2026, sobre o main de 13/11 (51d97df).

## Como rodar

- `npx tsx scripts/qa/brechas.ts`: cada brecha reproduzida no núcleo, com **ABERTA** ou **fechada**. Rodar depois de cada correção.
- `npx tsx scripts/qa/jogar-errado.ts <perfil> [dias]`: joga um ano (120 dias) e lista dias com momentos grandes juntos, trechos sem nada para fazer e metas paradas. Log completo em `test-results/qa/<perfil>.json` (fora do Git).
  - `parada`: jogo novo, ela não faz nada.
  - `largada`: meio do jogo (depois da inauguração), ela abandona o café.
  - `completa`: tudo liberado; ela só vive os dias.

## Cenários para jogar à mão

| # | Cenário | O que observar |
|---|---------|----------------|
| 1 | Com cliente esperando, abrir o app Horário e mudar o almoço para a meia hora atual, várias vezes no dia | A paciência para; o cliente nunca desiste |
| 2 | Com fila grande, mudar o fechamento para a hora atual e reabrir logo depois | A fila vai embora sem nota ruim |
| 3 | Ignorar a Dona Neusa quando ela traz o 2º gato (dia 8 em diante) | A chegada fica parada para sempre; nenhum outro gato vem |
| 4 | Começar a feira de adoção 5 dias antes do Natal, do Ano Novo, do Halloween ou do sorteio (inverno 18) | Dois eventos no mesmo dia |
| 5 | Pôr móveis nas 3 células em volta da entrada, por dentro | Ela entra e fica presa na porta |
| 6 | Devolver um presente de selo (tapete de patinhas, caminha lilás...) na mochila | Vira moedas pelo preço cheio |
| 7 | Não alimentar nem dar remédio ao gato por semanas | Nada acontece além de perder corações |
| 8 | Terminar a história e jogar a primavera e o verão | Dias seguidos sem cena, evento nem meta |
| 9 | Encher a mochila de presentes de Natal e devolver tudo | Moedas por presentes recebidos |

## Achados

Gravidade: **alta** = trava o progresso ou quebra uma regra central; **média** = brecha que dá vantagem; **baixa** = estranho, mas tem saída.

### Alta

**A1. A chegada do 2º gato espera para sempre e trava todas as outras.** Ela começa no dia 8 (a Dona Neusa traz o gato) e fica na etapa 0 até a jogadora ir lá. Não tem prazo, não aparece no balão (`goals()` vazio) e só avisa uma vez, no começo. Enquanto isso, nenhuma outra chegada começa (uma por vez). O 3º gato só vem com 2 gatos, e as chegadas sorteadas só com 3. Resultado: quem ignora a Dona Neusa fica com 1 gato para sempre, e a feira de adoção (9 gatos), os selos de gatos e boa parte do jogo nunca chegam. Reproduzido: dia 45, a chegada continua no dia 8, 1 gato, 0 metas.
*Sugestão:* a chegada ativa aparece no balão do subconsciente ("A Dona Neusa está com um gatinho para você"); depois de X dias sem resposta, ela vai embora (`provisional_expired` já existe para outros casos) e a próxima pode começar; as chegadas roteirizadas do 2º e 3º gato voltam a tentar dias depois.

**A2. Almoço empurrado congela a paciência para sempre** (veio da decisão 166, almoço com paciência parada). O app Horário aceita mudar o almoço a qualquer hora, quantas vezes ela quiser. Movendo para a meia hora atual, o cliente esperou 4 horas com a paciência em 90 min, e a nota não cai.
*Sugestão:* uma mudança de almoço vale a partir do dia seguinte (como uma regra de horário), ou só um almoço por dia (se o de hoje já começou, não muda mais hoje).

**A3. Feira de adoção no mesmo dia de uma data fixa.** A feira (sem data, 5 dias de preparo) só evita outras festas do calendário (`festivals.json`). Não evita o sorteio do amigo secreto (inverno 18), o Natal (inverno 25, o café fecha às 12h e tem a ceia às 19h), o Ano Novo (inverno 30, fogos) nem o Halloween (outono 30). Confirmado com a regra do próprio jogo: as 4 datas aceitam a feira.
*Sugestão:* as datas de `festive.json` entram na mesma conta de "dias ocupados" da feira (`festivalCanStart`), e a ideia da feira espera passar.

**A4. Depois da história, a primavera e o verão ficam vazios.** Perfil `completa` (história toda feita, cômodos reformados): depois do Ano Novo, **88 dias seguidos** (primavera 1 a outono 28) sem cena, evento nem meta no balão. Só aparecem as tarefas do dia e os pedidos da vila. O que existe nesse período depende de condições: o Dia do Gato (verão 8) precisa de 20 de reputação, e a feira precisa de 9 gatos. A primavera não tem nenhum evento fixo; o outono só tem o Halloween no último dia.
*Sugestão:* um evento fixo por estação (primavera e verão principalmente); uma meta de longo prazo sempre no balão quando a história acaba (o próximo selo, a próxima reforma, "chegar a 20 de reputação para o Dia do Gato"); visitas dos amigos com pedidos.

### Média

**M1. Fechar mais cedo esvazia a fila sem nota ruim.** Com a fila cheia, ela muda o fechamento para a hora atual: a fila vai embora "sem bronca" (o café fechou) e ela reabre na hora. Escapa das avaliações ruins de quem ia desistir.
*Sugestão:* a mesma regra do A2 (mudança de horário vale a partir do dia seguinte), ou quem sai da fila porque o café fechou antes da hora dá a nota de desistência.

**M2. Gato largado não tem consequência.** Sem comida e sem remédio por 60 dias: saúde 0, doente o tempo todo, continua no café. O descuido só tira corações, e quando chegam a 0 não acontece mais nada. Os clientes só somem com vários gatos doentes.
*Sugestão (decisão de design):* com saúde 0 por X dias, a clínica ou a Dona Neusa leva o gato (com uma fala); ou a reputação cai a cada dia com gato doente sem tratamento.

**M3. Presentes viram dinheiro.** A devolução paga 100% do preço (`refundRate: 1`) de qualquer item que não seja chave, ferramenta, peça fixa ou presente (`kind`). Os presentes de selo (tapete de patinhas 60, caminha lilás 25, vaso, relógio), os presentes do amigo secreto e os enfeites que voltam da caixa todo inverno são móveis comuns: dá para devolver e ficar com as moedas.
*Sugestão:* item recebido de graça fica marcado como presente (não devolve), ou a devolução paga só o que foi pago (registrar o preço de compra no inventário).

### Baixa

**B1. Dá para fechar a entrada do café por dentro.** Três móveis em volta da célula onde ela chega da rua ([13,9], [15,9], [14,8]) e ela fica presa na porta. Tem saída (os móveis estão encostados nela e dá para mover), mas os gatos também perdem o caminho para a porta.
*Sugestão:* a célula de chegada de cada porta e uma vizinha livre entram nas células reservadas de `checkPlacement`; ou conferir com `findPath` que a porta continua ligada ao resto do cômodo.

**B2. Cliente atravessa móveis.** Os clientes andam em L até o lugar (sem `findPath`): com o caminho fechado, eles passam por cima dos móveis.

**B3. Dia 30 do inverno empilha.** O aviso do evento, o Ano Novo e o roteiro dos fogos chegam juntos; é o esperado, mas se a feira cair no mesmo dia (A3), são três coisas.

## O que não deu brecha

- Varrer: com o robô aspirador, a rotina conta como feita (esperado).
- Café com T: o intervalo de 1 h vale também depois de carregar o save (`lastCoffeeAt`).
- Sorteio do amigo secreto e convite do Halloween: têm janela (inverno 18 a 24; outono 24 a 29), a primeira entrada no café nesse período serve.
- Nenhum dia "travou" nos 3 perfis: o dia sempre termina sozinho na hora-limite.
- Comprar e devolver sem usar não dá lucro (devolve o mesmo que pagou).
