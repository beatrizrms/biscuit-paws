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
| Chegada da Jacque × chegadas de gato | **Corrigido.** O passo da história da chegada da Jacque ficava ativo (e exclusivo) da inauguração até o dia da 1ª feira, e enquanto isso nenhum gato novo chegava (e a feira precisa de 9). Agora ele só fica ativo no dia da feira. |
| Cena do jardim secreto × chegadas de gato | **Corrigido.** A cena que desbloqueia o jardim (a corretora, a Dona Neusa e o Tião) acontece 30 dias depois de abrir o quarto dos fundos, com a chave. O passo dela ficava ativo (e exclusivo) durante esses 30 dias de espera, segurando as chegadas de gato. Agora ele só fica ativo no dia em que a cena pode acontecer. Isso não tem nada a ver com os eventos. |
| Ordem: jardim antes dos eventos | **Garantido.** O desbloqueio do jardim não depende de evento nenhum; os três eventos pedem o quintal reformado (a feira de adoção agora pede direto, além dos 7 dias). Teste: tudo pronto para a feira, menos o quintal, e ela não começa. |
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

## Fase 3: situações incoerentes

Verificações automáticas nos textos e nas regras (marcadores sem trocar, gênero, horário das cenas, quem aparece antes
de ser apresentado, gatos que saíram).

| Situação | Resultado |
|---|---|
| Marcador cru na tela | **Corrigido.** Na consulta, a linha do remédio mostrava "Remédio (3 x {each})". |
| Gato sempre no masculino | **Corrigido.** Avisos sobre um gato usavam sempre "ele": sarou ("voltou a ser ele mesmo"), descuido ("esquecido... dele"), chegada assustada, ganhar a confiança ("E nele"), doença contagiosa ("isolado", "solto"), doente sem clínica ("cuidar melhor dele"), a comida da chegada ("Ele comeu...") e a entrega da Fernanda sem cercadinho. Agora seguem o sexo do gato ({sex:ele\|ela}). |
| Dona Neusa de madrugada | **Corrigido.** A visita dela vinha no exato momento da cafeteira montada, a qualquer hora. Agora é um passo próprio, das 7h às 20h (save que já teve a visita não vê de novo). |
| Jacque à noite | **Corrigido.** A chegada dela na feira só acontece das 9h às 19h. |
| Protagonista com gênero errado | Ok: as falas e avisos dela são neutros ou usam {g:...}. |
| Gente antes de ser apresentada | Ok: Ano Novo, amigo secreto, Halloween, plateia e passeios só chamam quem ela já conhece. |
| Gato adotado em listas e cuidados | Ok: tudo filtra os gatos abrigados. |

### Para decidir (design)

- **Decoração e atividades à noite:** a placa tem prazo (12h); a decoração e os mini games não.
- **Plateia na chuva:** a plateia fica no quintal mesmo com chuva ou neve caindo.
- **Evento perdido e recarregar:** perdido pelo prazo, não recomeça no mesmo dia; mas recarregando o jogo no mesmo dia, a ideia volta (isso não fica no save).
- **Panfletos demorados:** a feira começada com folga, com os panfletos levando mais de 7 dias, ainda pode cair em cima do Dia do Gato.
- **Dia do Gato e Concurso de fofura iguais:** os dois têm só o desfile e a foto; mudam a data, a decoração e a recompensa.
- **Sebe lateral do quintal sem neve** no inverno (a do fundo tem).

As decisões acima foram tomadas e aplicadas: eventos até as 20h com luz fixa no quintal, sem chuva em dia de evento no
quintal, "Reiniciar o dia" na pausa, a feira repetida pelos panfletos do Market, o Dia do Gato com desfile e foto como
atividades e neve na sebe lateral.

## Fase 4: saves reais e pontos críticos

Em `tests/core/realSaves.test.ts`. Cada save carrega como no jogo, deixa os dias correrem até a hora-limite (as cenas
terminam na hora), passa pelas quatro estações e confere **todos os mapas** (café, rua, praça, beco, mercado, clínica e os
dos mini games) a cada 90 minutos de jogo.

| Caso | Resultado |
|---|---|
| Save real do dia 154 (`tests/fixtures/save_real_dia154.json`) | Ok. Também rodado por 125 dias (`SWEEP_DAYS=125 npx vitest run tests/core/realSaves.test.ts`) e no navegador: todos os mapas nas quatro estações, sem erro no console. |
| Save real do dia 155 (`save_real_dia155.json`, o que dava "Mapa inválido") | Ok (o conserto dos móveis dos cômodos, da fase 2, segue valendo). |
| Véspera do Dia do Gato, véspera de Natal, último dia de cada estação, véspera de Ano Novo do 2º ano | Ok, com 12 gatos e o quintal mobiliado. |

## Fase 5: rede de proteção

| O quê | Como |
|---|---|
| Save com móvel em conflito | Ao carregar, o jogo confere o mapa do café. Móvel da jogadora em cima de outra peça, fora do mapa ou com a base numa parede volta para a mochila, um por vez, até o mapa ficar válido. O que estava dentro da caixa de pet volta junto. Um aviso lista os móveis (evento `save.repaired`). Antes, o café inteiro deixava de abrir. |
| Dia caótico (`tests/core/safetyNet.test.ts`) | 30 dias seguidos com chuva forçada, gato novo a cada 3 dias, encomenda todo dia (as caixas se acumulam na porta), obra no piso do salão e evento no quintal montado a cada 5 dias, com plateia. Falha se um dia não termina, se um evento fica de um dia para o outro ou se algum mapa fica inválido em qualquer hora. Passou sem nada a corrigir. |
