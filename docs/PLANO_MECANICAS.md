# Plano: as mecânicas que faltam

Pedido de 2026-11-25: implementar o que falta do ROADMAP, começando pelas mecânicas. A arte espera (personagens em 8
direções, protagonista, placeholders): nada aqui precisa de arte nova. Onde faltaria um desenho, usamos o que já existe.

Os itens estão em quatro blocos:

- **A. Só código:** não precisam de decisão sua.
- **B. Mecânicas com proposta:** cada uma tem uma proposta e a pergunta que falta responder.
- **C. História:** precisam de roteiro. Eu proponho o esqueleto e você escreve ou aprova as falas.
- **D. Lançamento.**

Cada item vira uma tarefa própria, com o seu commit, testes do assunto, print conferido e decisão em DECISIONS.md.
As regras de sempre valem para todos: nada trava o jogo, os eventos só avisam, as metas não revelam lugares e os
textos não têm gênero.

## A. Só código (feito: decisão 309)

| # | Item | O que fazer | Tamanho |
|---|---|---|---|
| A1 | Cliente atravessando móveis (QA B2) | Já existe o desvio dos móveis (`Customer.walkTo` com caminho). Falta o caso **sem caminho**: hoje ele cai no andar em L e passa por cima. Mudança: um lugar sem caminho da porta não é oferecido ao cliente (`session` já sabe isso: `cafeArrivals` + `findPath`), e quem já estava indo escolhe outro lugar ou vai embora sem nota ruim. Teste: lugar fechado por móveis | pequeno |
| A2 | Playground do quintal | Conferir no jogo se os gatos vão ao quintal e usam os módulos (túnel, casinha, tora, cama ao sol, árvore). Pôr a tigela de água no quintal (a que já existe no Market) | pequeno |
| A3 | Testes do navegador | 9 de 20 falham por coordenadas antigas do mercado. Trocar coordenadas fixas por posição lida do mapa (mais estável). Rodar numa porta própria, não no 5173 | médio |
| A4 | Robô de teste | Ensinar a jogar o remédio escondido, a tirar o gato do cercadinho e a gastar moedas (Market e mercado), para os números de economia e ritmo valerem | médio |

## B. Mecânicas com proposta

### B1. O afeto dos gatos muda a paciência e a gorjeta (feito: decisão 310)

**Proposta:** gato feliz deixa o cliente feliz.

- Um gato com **5 ou mais corações**, no mesmo cômodo do cliente e a até 3 tiles dele, dá **+20% de paciência**.
  Com mais de um gato assim, o bônus para em +30%.
- Com um gato desses perto ao ser servido, a **gorjeta sobe 50%**, e um coraçãozinho aparece sobre o cliente
  (emote que já existe).
- Os números ficam em `data/service.json` (`catBonus`), para ajustar depois de jogar.
- Teste: o mesmo cliente com e sem o gato perto.

**Pergunta:** por **proximidade**, como na proposta, ou pela **média de corações** de todos os gatos do café?
A proximidade é mais visível e faz a disposição dos móveis importar. Recomendo esta.

### B2. Frio no inverno (feito, jeito A: decisão 310)

**Proposta:** o frio vale para os gatos de rua que chegam no inverno. O café não esfria.

- O gato de rua aceito no inverno entra **com frio**: ícone de floquinho na ficha do "Meus gatos" e um aviso.
- Ele se aquece dormindo num lugar quente (caminha, almofada ou cobertor; tag `warm`) por umas horas do jogo. Sem lugar
  quente, a alegria cai devagar, sem doença nem fuga.
- Meta suave no balão, sem prazo duro: "Aqueça os gatos" até o Natal. No Natal, uma fala se todos estiverem quentes.
- Estado no save (gato `cold`), com migração.

**Pergunta:** só os gatos que chegam, ou o café também esfria (precisando de aquecedor, lareira...)? Recomendo **só
os que chegam**: o café esfriando é mais uma tarefa diária no começo, que já tem muita coisa.

### B3. Gatos de rua anunciados no jornal (feito: decisão 311)

**Proposta:** quando uma chegada de gato começa, o "Vila Hoje" do dia ganha uma notinha vaga, sem dizer onde
("Moradores contam que um gatinho anda pela vila nessas noites frias"). Ler a notícia não muda nada, só dá o clima.
Usa `data/news.json`, com uma frase por tipo de chegada.

**Pergunta:** nenhuma. Só aprovar as frases, que eu escrevo no padrão.

### B4. Prêmio da conquista "Primeira CED" (feito: vale-castração, decisão 310)

**Proposta:** um item de decoração exclusivo que já tem arte, entregue na mochila (`reward: gift`), mais reputação.
Eu levanto 3 opções de itens que ainda não estão à venda para você escolher.

**Pergunta:** qual item. Ou prefere outra coisa, como uma receita?

### B5. Recompensas por coração (amizade) (feito: decisão 312)

**Proposta:** cada amigo dá algo em 3 degraus, usando o que já existe:

| Corações | Recompensa |
|---|---|
| 3 | Uma **receita** ligada à pessoa (Dona Neusa: um doce de padaria; Gabi: uma bebida; Tião: um café forte...) |
| 6 | Um **presente** de item que ela gosta de dar (decoração ou planta), entregue com uma fala |
| 10 | Um **favor**: desconto fixo no que a pessoa vende ou faz (Tião: obras; Fernanda: consultas) ou uma visita especial ao café |

**Pergunta:** gosta dos degraus? Quer escolher você o que cada pessoa dá? Eu monto a tabela por pessoa para você
aprovar.

### B6. Cozinha e sótão

O sistema de cômodos já existe: hoje há salão, porão e quintal. Falta decidir **para que servem**, e cada um precisa
de um espaço no mapa (com os pisos e paredes que já temos).

**Proposta:**

- **Cozinha:** as estações de preparo saem do salão e ganham espaço. A despensa fica maior. Libera as receitas de
  forno "grandes" (fornadas com mais porções).
- **Sótão:** mais lugar para gatos (+5 na capacidade) e um cantinho de descanso para gatos tímidos, que ficam menos
  estressados lá.
- Os dois chegam por conquista, depois do porão, como recompensa do café andando.

**Pergunta:** são essas as funções? Este é o item mais longo do bloco B (mapa, dados, obra do Tião, testes).

## C. História (precisa de roteiro)

Para cada um, eu proponho o esqueleto: quando acontece, quem está e o que muda no jogo. Você escreve as falas ou
aprova as minhas.

| # | Item | Esqueleto proposto |
|---|---|---|
| C1 | Arco da Dona Neusa e da padaria | 3 ou 4 momentos ao longo do ano. Ela conta do seu Antônio. A jogadora acha algo dele no porão (uma lata de receitas). Ela ensina a receita do pão do seu Antônio, que vira receita do cardápio. No fim, uma festa ou uma fala de despedida do passado. Usa cenas, marcos e receitas que já existem |
| C2 | Vizinhos com preconceito | Uma **aceitação da vila** (0 a 100), que sobe com reputação, adoções, feiras e a CED. Dois ou três vizinhos desconfiados (clientes e moradores que já existem) têm falas em 3 fases: contra, curiosos, a favor. Na última, um deles adota um gato. Sem punição: a aceitação só muda falas e notícias |
| C3 | Camila e Núbia no jogo | A arte já está pronta, sem diagonal; elas entram como os outros NPCs. **Camila**, da ONG, chega pela CED (ela organiza a campanha com você) e vira amiga, com gostos e posts na SocialVilla. **Núbia** aparece em todos os eventos e festas, adora os gatos e, num momento da história, se muda para a vila (vira moradora, com passeio próprio) |
| C4 | Primavera com mais conteúdo | Um evento fixo da estação (ex.: festa das flores na praça), manchetes novas para o jornal, 2 ou 3 pedidos da vila de primavera e receitas da estação. Mesmo formato do Halloween e do Natal |
| C5 | A pessoa contratada (ajudante) | Já decidido que é alguém novo na vila. Falta nome e jeito, e precisa de **arte nova**: fica para depois da arte |

## D. Lançamento

| # | Item | O que fazer |
|---|---|---|
| D1 | Electron | Empacotar o jogo como aplicativo de computador. A camada `src/platform/` troca o armazenamento do navegador por arquivos. Dá para fazer já, sem a Steam |
| D2 | Saves em arquivo | Junto com D1: pasta de saves do sistema, mesmo formato e migrações. Teste com o save antigo de exemplo |
| D3 | Steamworks | Conquistas da Steam ligadas às conquistas do café, salvamento na nuvem. Precisa da conta de desenvolvedor e do app ID |
| D4 | Página da loja | Textos, prints, a declaração do uso de IA na arte. Fica para quando a arte fechar |

## Ordem sugerida

1. **Rápidos, para limpar:** A1, B3, B4 e A2.
2. **Mecânicas que mudam o jogo:** B1 (afeto) e depois B2 (frio).
3. **Gente nova e história:** C3 (Camila e Núbia), C1 (Dona Neusa), C2 (vizinhos) e C4 (primavera).
4. **Sistemas maiores:** B5 (corações) e B6 (cozinha e sótão).
5. **Antes de lançar:** A3, A4, D1 e D2. D3 e D4 no fim.

## O que preciso de você para começar

- **B1:** proximidade ou média.
- **B2:** só os gatos que chegam, ou o café também esfria.
- **B4:** qual prêmio.
- **Bloco C:** se aprova os esqueletos e se prefere escrever as falas ou revisar as minhas.

A1, A2, B3 (com as frases para aprovar) e A3 posso começar já.
