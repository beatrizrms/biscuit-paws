# Revisão de conflitos de eventos

Revisão dos sistemas que disparam cenas, falas ou mudanças de mapa, procurando os que se cruzam no mesmo dia ou na mesma
hora. Testes dos pares em `tests/core/conflicts.test.ts`.

## Fase 1: quem dispara o quê

| Sistema | Quando dispara | O que trava ou muda | Se não acontece |
|---|---|---|---|
| História (`data/story.json`) | Na ordem do arquivo; o primeiro passo **exclusivo** ativo segura os de depois | Exclusivo ativo segura também as chegadas de gato (fora as urgentes) e as cenas da CED (`exclusiveActive`) | Espera a condição |
| Chegadas de gato (`arrivalSystem.ts`) | Fila; começa a da vez sem passo exclusivo ativo e com vaga no café | Pontos na rua, cenas, gato novo no café | Fica na fila |
| Clínica (`clinicFlow.ts`) | De manhã: a Fernanda devolve o gato castrado no café | Cena dela no café; caixinha ou cercadinho | — |
| CED (`ced.ts`) | Condição + cena livre (ela no salão, sem exclusivo) | Cenas no café | Espera |
| Eventos (`festival.ts`) | Ideia por condição/data; um por vez; no dia: placa até 12h, decoração, atividades | Café fechado; peças no quintal; plateia depois de montado | Perdido: volta ao começo (não no mesmo dia) |
| Plateia (`festivalCrowd.ts`) | Dia do evento, tudo montado, até 20h | NPCs no quintal (clientes e amigos) | — |
| Natal, Halloween, Ano Novo | Datas fixas; festa no café ou na rua à noite | NPCs amigos em cena; luzes | — |
| Passeios de vizinhos (`neighborWalks.ts`) | Horário e sorteio do dia (Neusa de manhã na rua, Gabi no almoço na praça, Jacque de tarde na rua) | NPC andando no mapa | — |
| Obra / Tião (`construction.ts`) | Expediente 8h até o fim, no cômodo da obra | NPC no mapa, área isolada | — |
| Correio (`delivery.ts`) | Dia e hora da entrega | Furgão na rua, caixa na porta | — |
| Hora-limite e desmaio | Meia-noite (ou 2h na véspera de folga); desmaio | Fim do dia | — |
| Estações e inverno | Dia do ano | Peças da estação, neve por cima ao ar livre | — |
| Peças automáticas | Árvores do quintal ao reformar, decoração e placa do evento, marcadores de pedido, poças de neve | Objetos no mapa | — |

## Fase 2: pares testados

| Par | Resultado |
|---|---|
| Passo exclusivo esperando × resto do jogo | **Corrigido.** `story.jacque_meet` ficava ativo da inauguração até a 1ª feira e `story.secret_garden` por 30 dias: nesse tempo nenhum gato chegava (e a feira precisa de 9), nem cenas da CED. Agora têm `start` e só ficam ativos quando estão para acontecer. |
| Feira de adoção × Dia do Gato (um evento por vez) | **Corrigido.** Panfletos começados perto do verão 8 faziam o Dia do Gato daquele ano não acontecer. Agora a feira não começa se um evento com data, já liberado, cai antes dela (prep + 7 dias). |
| Plateia × festas e cenas com os amigos | **Corrigido.** Em dia de festa, os amigos ficam fora da plateia. A plateia só mexe nos bonecos dela: se um roteiro chama a mesma pessoa, a plateia não apaga nem move o boneco da cena. |
| Plateia × passeios | **Corrigido.** Quem está na plateia não sai passeando na rua ou na praça (não fica em dois lugares). |
| Passeio × cena com o mesmo NPC | **Corrigido.** O passeio parava e tirava do mapa o boneco que a cena tinha posto no lugar (ficava parado para sempre). Agora só mexe no próprio boneco. |
| Árvores do quintal × móveis de um save antigo | **Corrigido antes** (o save do dia 155): vão para o lugar livre mais perto. |
| Quintal cheio de móveis × evento montado × estações × neve × plateia | Ok (teste com o quintal cheio em cada estação). |
| Mapas de fora em cada estação | Ok. |
| Roteiros no quintal × plateia | Ok: só a chegada da Jacque usa o quintal, com as células dela reservadas. |
| Ano Novo na rua × passeios | Ok: horários diferentes (fogos 23h30; passeios de dia). |
| Chegada de gato × feira | Ok: só vai à feira gato castrado confirmado, sem doença, fora do cercadinho. |

## Riscos que ficam (para a fase 3)

- **Panfletos demorados:** a feira começada com folga, mas com os panfletos levando mais de 7 dias, ainda pode empurrar o dia dela para cima do Dia do Gato.
- **Evento perdido:** depois de perdido pelo prazo, não recomeça no mesmo dia. Mas isso não fica no save: recarregando o jogo no mesmo dia, a ideia volta.
- **Decoração e atividades à noite:** não têm horário limite (pergunta em aberto).
- **Plateia na chuva:** a plateia fica no quintal mesmo com chuva.
