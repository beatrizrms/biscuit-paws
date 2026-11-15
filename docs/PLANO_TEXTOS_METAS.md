# Plano: revisar os textos das metas (títulos e passos)

Pedido de 2026-11-15: as explicações do balão do subconsciente estão confusas e redundantes (exemplo: "Uma cafeteira").
Este é o plano. Nada muda nos dados antes da aprovação da tabela "antes / depois" (etapa 3).

## O que está errado hoje (exemplo: "Uma cafeteira")

| Problema | No exemplo |
|---|---|
| O passo em destaque explica tudo de uma vez: meta, preço, onde ganhar dinheiro, atalho | "Juntar 205 moedas com pedidos da vila (mural do mercado ou celular, tecla P): a cafeteira (180) e um balcão para ela (25)." |
| Os passos seguintes repetem o que o primeiro já disse | "Encomendar um balcão pelo Market (C)" e "Encomendar a cafeteira pelo Market (C)" repetem o balcão e a cafeteira |
| Atalho de teclado no texto (no celular não existe tecla) | "(C)", "tecla P", "(tecla M)" |
| Lugar e caminho do menu no texto (às vezes revela o que era para procurar: [[nao-revelar-lugares]]) | "(Market, aba Construção, em Fachada)" |
| Passo que é a soma de outros | "Montar o balcão e pôr a cafeteira em cima dele" depois de comprar os dois |
| No debug, a nota de desenvolvimento (vermelha) aparece no meio do passo e quebra o texto em coluna | "Abrir as caixas no salão; a cafeteira só vai em cima de um balcão livre (placeOn: bar)." |

## Regras propostas (para todas as metas)

1. **Título:** 1 a 3 palavras, o objetivo ("Uma cafeteira", "O porão"). Sem pontuação.
2. **Passo:** uma ação curta no infinitivo, até ~50 caracteres. Uma coisa por passo. Sem preço, sem atalho, sem caminho de menu.
3. **Detalhe (opcional, só o passo da vez):** uma linha de ajuda quando a ação não é óbvia. É aqui que pode entrar
   "no Market" ou o valor, se ajudar; nunca o lugar de algo que é para ela procurar.
4. **Atalhos** saem dos textos. Se precisar, o jogo mostra a tecla certa (no PC) ou nada (no celular), como já faz com "(E)".
5. **Números** só quando contam progresso, e aí vão nas bolinhas (2/3), não no texto.
6. **Notas de desenvolvimento** (devNote) ficam fora do card: no debug, numa linha pequena embaixo do passo, nunca ao lado.
7. **Tom:** a voz da protagonista, neutra em gênero ([[textos-sem-genero]]), sem explicar regras do jogo.

Exemplo, só para mostrar o tamanho (a versão final vai na tabela da etapa 3):

| Antes | Depois |
|---|---|
| Juntar 205 moedas com pedidos da vila (mural do mercado ou celular, tecla P): a cafeteira (180) e um balcão para ela (25). | **Juntar 205 moedas** · detalhe: "Os pedidos da vila pagam bem (mural do mercado ou celular)." |
| Encomendar um balcão pelo Market (C). / Encomendar a cafeteira pelo Market (C). | **Comprar um balcão e a cafeteira** |
| Montar o balcão e pôr a cafeteira em cima dele. | **Montar a cafeteira em cima do balcão** |

## Etapas

1. **Levantar todos os textos** (planilha em docs/, gerada dos dados): as 15 metas da história (38 passos, 10 notas de
   desenvolvimento) em data/story.json, e também o que aparece no mesmo balão: metas de saúde (remédio), pedidos da vila
   (jobs), encontros da estação, preparativos da inauguração, rotina do dia ("hoje") e os avisos de café parado.
2. **Marcar os problemas** de cada texto pelas regras acima (repetido, longo, atalho, revela lugar, soma de passos).
3. **Tabela "antes / depois"** de todas as metas, para a Beatriz aprovar (pode vir em partes: ato 1, ato 2, rotina).
4. **Aplicar** nos dados (só texto; IDs e condições não mudam) e ajustar o balão: devNote embaixo do passo no debug;
   o "detalhe" só no passo da vez.
5. **Conferir** no celular e no PC (prints do balão em 3 ou 4 metas) e rodar `npm run check` e `npm test`
   (os testes que comparam texto de passo mudam junto).

## Decidido (2026-11-15, plano da Beatriz)

1. **Regra:** só a ação e o objeto, no **imperativo** ("Compre", "Encha", "Encomende"), em metas, falas, cenas, notícias
   e tarefas do dia. Saem tecla, clique, botão e caminho de menu ("aba Pet", "em Fachada"); ficam a dica do E em cima
   das coisas e a linha de controles do rodapé. Um teste acusa tecla, clique ou "aba X" nesses textos.
   Na interface também: "clique no item da mochila ou arraste até a caixa" vira "Guarde o {item} na caixa pet".
2. **"Como jogar":** no menu de pausa **e** no menu inicial; versões teclado e toque (a do controle em uso).
3. **Missões só com ações** (tabela abaixo). "Um cantinho quente" vira **"Tudo que um gatinho precisa"**, com o passo
   novo "Compre areia e encha a caixa" (muda a condição: precisa trocar a areia).
4. **Correções:** tarefa diária "Troque a areia da caixa" na lista "hoje"; brinquedos numa linha só ("{gato} quer
   brincar", "...: compre uma varinha", "...: compre mais brinquedos"); a fala do cocô termina em "Vou resolver isso
   agora mesmo!" (saem a caminha e o frio).
5. **Verificação:** testes do assunto e a suíte completa antes do commit; prints do balão do começo e do "Como jogar".

## Tabela antes / depois: metas da história (para aprovar)

| Meta | Antes | Depois |
|---|---|---|
| Uma boa faxina | Tirar essas teias dos cantos. | Tire as teias dos cantos |
| | Varrer a poeira, os papéis e os cacos. | Varra a poeira, os papéis e os cacos |
| Esse miado... | Vem da porta da frente. Vou ver. | Veja quem está miando na porta |
| Água e comida | Uma tigela de água para {gato}. | Compre uma tigela de água |
| | Não tenho ração... preciso ir ao mercado. | Compre ração |
| | E uma tigela para a ração. | Compre uma tigela de ração |
| Hora de comer | Escolher a ração na barra e encher a tigela de {gato}. | Encha a tigela de {gato} |
| Gatinho doente | Ver se a obra no fim da rua já virou a clínica veterinária. | Procure a clínica veterinária da vila |
| | Buscar {gato} no café e levar no colo até a clínica da Fernanda. | Leve {gato} no colo até a clínica |
| | Dar o remédio para {gato} · detalhe: Uma dose por dia, até acabar a receita. | Dê o remédio a {gato} · detalhe: uma dose por dia, até acabar |
| Que cheiro é esse? | Recolher o "presente" de {gato} com a vassoura. | Varra o "presente" de {gato} |
| **Tudo que um gatinho precisa** (antes: Um cantinho quente) | Uma caixa de areia no café (Market, aba Pet). | Compre uma caixa de areia |
| | (novo) | Compre areia e encha a caixa |
| | Uma caminha macia para {gato} (Market, aba Pet). | Compre uma caminha |
| Uma cafeteira | Juntar 205 moedas com pedidos da vila (mural do mercado ou celular, tecla P): a cafeteira (180) e um balcão para ela (25). | Junte 205 moedas fazendo trabalhos para a vila |
| | Encomendar a cafeteira pelo Market (C). | Encomende uma cafeteira |
| | Encomendar um balcão pelo Market (C). | Encomende um balcão |
| | Montar o balcão e pôr a cafeteira em cima dele. | Monte o balcão com a cafeteira em cima |
| Mesa e cadeira | Juntar 75 moedas para uma mesa e uma cadeira. | Junte 75 moedas fazendo trabalhos para a vila |
| | Encomendar uma mesa pelo Market (C). | Encomende uma mesa |
| | Encomendar uma cadeira pelo Market (C). | Encomende uma cadeira |
| A visita da Gabi | A Gabi chega às {hora}. | Espere a Gabi: ela chega às {hora} |
| O primeiro cliente | Um balcão para servir em pé. | **(sai: a mesa e a cadeira já bastam)** |
| | Montar o cardápio no quadro (tecla M). | Monte o cardápio |
| | Atender o primeiro cliente: preparar, entregar e lavar a louça. | Atenda o primeiro cliente |
| O porão | Pagar a obra para abrir o acesso ao porão (Market, aba Construção). | Pague a obra para abrir o porão |
| | Limpar o porão. | Limpe o porão |
| | Terminar a reforma (Market, aba Construção). | Termine a reforma do porão |
| O quintal secreto | Achar a chave do cadeado. | Ache a chave do cadeado |
| | Abrir a porta com a chave (E na porta). | Abra a porta com a chave |
| | Limpar o quintal (folhas e mato). | Limpe o quintal |
| | Terminar a reforma (Market, aba Construção). | Termine a reforma do quintal |
| A inauguração | Fazer os reparos de dentro e de fora do café com o Tião (Market, aba Construção). | Faça os reparos do café com o Tião |
| | Com os reparos prontos, encomendar a lousa do café (Market, aba Construção, em Fachada) e abrir a caixa. | Encomende a lousa do café |
| | Inaugurar no dia 26, logo depois do Natal ({faltam}). Sem tudo pronto até lá, no primeiro dia pronto depois (entre 8h e 18h), fora dos dias de festa (como o Ano Novo). | Inaugure o café dia 26 |
| (opcionais) | Colar 3 cartazes da inauguração pela vila. | Cole 3 cartazes pela vila |
| | Convidar 3 amigos (conversar com eles). | Convide 3 amigos |
| | Montar o cardápio da estreia (3 receitas no quadro). | Monte o cardápio da estreia (3 receitas) |
| | Enfeitar o café com 3 plantas. | Enfeite o café com 3 plantas |

Próximas partes da tabela: tarefas do dia ("hoje"), avisos do balão, notícias e as falas e cenas que citam tecla ou
aba (ligações da Gabi e do Tião, o primeiro cliente).

## Parte 2: tarefas do dia, avisos, notícias e falas (para aprovar)

Também decidido: o botão **Menu** do celular passa a se chamar **Cardápio** (feito). Por isso, nos avisos, "quadro"
vira "cardápio".

### Tarefas do dia ("hoje")

| Antes | Depois |
|---|---|
| Ração para os gatos | Encha a tigela de ração |
| Comida para {gato} | Dê comida a {gato} |
| Ganhar a confiança de {gato} (E nele/nela) | Ganhe a confiança de {gato} |
| Levar {gato} à clínica para a consulta de entrada | Leve {gato} à clínica para a consulta de entrada |
| Buscar {gato} na clínica | Busque {gato} na clínica |
| Levar {gato} à clínica: o pontinho inflamou | Leve {gato} à clínica: o pontinho inflamou |
| Recovery para os gatos do cercadinho (E no cercadinho) | Dê Recovery aos gatos do cercadinho |
| Varrer a poeira do dia | Varra a poeira do dia |
| Guardar na despensa: {itens} | Guarde na despensa: {itens} |
| (novo) | Troque a areia da caixa |
| Cocô no chão: varrer e trocar a areia da caixa | Varra o cocô e troque a areia |
| Escovar {gato}: o pelo está sujo | Escove {gato}: o pelo está sujo |
| Escovar {gato}: comprar uma escova (mercado, Cuidados) | Escove {gato}: compre uma escova |
| Brincar com {gato}: anda sem ânimo | Brinque com {gato}: anda sem ânimo |
| Brincar com {gato}: comprar uma varinha (mercado, Brinquedos) | Brinque com {gato}: compre uma varinha |
| Dar o remédio de hoje para {gato} | Dê o remédio de hoje a {gato} |
| Remédio de {gato}: passar na clínica | Remédio de {gato}: passe na clínica |
| {gato} está sem comer desde ontem: comprar ração | {gato} está sem comer desde ontem: compre ração |
| {gato} quer brincar: a varinha | {gato} quer brincar |
| {gato} quer brincar: comprar uma varinha (mercado, Brinquedos) | {gato} quer brincar: compre uma varinha |
| Brinquedos para os gatos (1 a cada 3): Market, aba Pet | (junta na linha de cima) {gato} quer brincar: compre mais brinquedos |
| **Pedido:** {trabalho} | **Trabalho:** {trabalho} |
| Gatos doentes sem tratamento: clientes não entram | (fica: é aviso, não ação) |

### Avisos do balão

| Antes | Depois |
|---|---|
| Ninguém entra: o quadro está vazio. Ponha receitas (M). | Ninguém entra: o cardápio está vazio. Monte o cardápio. |
| Ninguém entra: tudo do quadro esgotado. Lave a louça na pia. | Ninguém entra: tudo do cardápio esgotado. Lave a louça. |
| Ninguém entra: tudo do quadro esgotado. Faltam ingredientes (mercado). | Ninguém entra: tudo do cardápio esgotado. Compre ingredientes. |
| Ninguém entra: tudo do quadro esgotado. Falta equipamento. | Ninguém entra: tudo do cardápio esgotado. Falta equipamento. |
| {trilha}: {n} de {meta}. Recompensa: {tipo} (no celular, Café em números, aba Conquistas). | {trilha}: {n} de {meta}. Recompensa: {tipo}. |

### Notícias (dicas do celular)

| Antes | Depois |
|---|---|
| …com frio, de um cobertor (mercado, Cuidados); ferido, da clínica. | …com frio, de um cobertor; ferido, da clínica. |
| Cada cômodo aberto e reformado aumenta quantos gatos cabem no café. O Market (aba Construção) mostra quantos cabem agora. | Cada cômodo aberto e reformado aumenta quantos gatos cabem no café. |

### Falas e cenas

| Onde | Antes | Depois |
|---|---|---|
| Entrando no café (1ª vez) | Clique na sujeira perto de você para varrer. Para sair, vá até a porta e siga em frente. | Vou começar varrendo essa sujeira. |
| Depois de dar nome ao gato | Aperte C para abrir o Market no celular. O mercado fica ali na rua: no caixa, aperte E. | Posso encomendar pelo celular ou passar no mercado da vila. |
| Antes da primeira ração | Chegue perto da tigela de ração e aperte E (ou clique nela). | (sai: a dica do E em cima da tigela já mostra) |
| Dona Neusa, depois das moedas | Agora dá para chamar o Tião pelo Market (C), na aba Construção. Primeiro, os reparos: o de dentro e o da fachada. | Agora dá para chamar o Tião. Primeiro, os reparos: o de dentro e o da fachada. |
| Achou o porão | Com uma obra dá para abrir a passagem (Market, aba Construção). | Com uma obra dá para abrir a passagem. |
| Porta do porão fechada | …Preciso pagar a obra para abrir (Market, aba Construção). | …Preciso pagar a obra para abrir. |
| Quintal reformado | O resto eu monto do meu jeito (Market, aba Decor). | O resto eu monto do meu jeito. |
| | Com 10 gatos no abrigo, dá para montar um playground (Market, aba Pet). | Com 10 gatos no abrigo, dá para montar um playground. |
| Amigo secreto de Natal | Os presentes de Natal estão no Market, na aba Natal. Até o dia 25! | Os presentes de Natal já estão à venda. Até o dia 25! |
| Noite das Abóboras | Os enfeites e os presentes estão no Market, na aba Halloween. … | Os enfeites e os presentes já estão à venda. … |
| Limpeza do quintal sem dinheiro | (…Quando juntar, peço pelo Market, na aba Construção.) | (…Quando juntar, eu peço.) |
| Cena: lembrete dos reparos | Vou ver isso hoje mesmo (Market, aba Construção). | Vou ver isso hoje mesmo! |
| Cena: lembrete da lousa | Só falta a lousa lá fora: encomenda pelo Market, na aba Construção. | Só falta a lousa lá fora. |

### Interface

| Antes | Depois |
|---|---|
| Caixa pet vazia: "Vazia. Guarde aqui ração, areia, petiscos, brinquedos e cuidados dos gatos: clique no item da mochila ou arraste até a caixa." | "Vazia. Guarde aqui ração, areia, petiscos, brinquedos e cuidados dos gatos." |
| Botão de guardar na caixa (nome no ícone): "guardar na caixa" | "Guarde o {item} na caixa pet" |
