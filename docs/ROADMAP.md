# Roadmap

Marque as caixas conforme concluir. Cada marco precisa de print conferido, testes e README atualizado.

## Marco 0: o café andável
- [x] Projeto Phaser + TS + Vite, resolução 640 x 360, escala inteira
- [x] Catálogo de tiles gerado de `tiles.csv`
- [x] Mapa carregado de `data/maps/cafe_main.json`
- [x] Peças de várias células (janela, porta, sofá, árvore de gato)
- [x] Personagem animada (setas e WASD)
- [x] Colisão com caixa nos pés e células sólidas
- [x] Y-sort (passar atrás e na frente do balcão)
- [x] `npm run check`, testes do core e teste de fumaça (Playwright)
- [x] README

## Marco 0.5: a chegada (história, dinheiro, decoração)
- [x] Abertura: a compra da padaria vazia
- [x] Dinheiro inicial (`data/economy.json`) e catálogo de móveis com preços (`data/items.json`)
- [x] Comprar, posicionar (piso, parede, objeto) e recolher móveis
- [x] Motor da história (`data/story.json`) com metas no diário e falas (`data/dialogue.json`)
- [x] Primeiro ato: cantinho quente -> lugar para sentar -> visita da Dona Neusa -> miado lá fora
- [x] Save automático (antecipado do Marco 3)
- [x] Loja começa velha (tiles gerados do pacote) e sem balcão; balcão vendido em peças
- [x] Pintor: escolher piso e papel de parede (loja velha -> reformada); save v2

## Marco 0.6: a rua e o subconsciente
- [x] Rua do café (inverno) com fachadas, objetos e neve; o jogo começa nela
- [x] Portas entre a rua e o café; câmera segue a personagem
- [x] Metas como subconsciente (balão de pensamento, 1ª pessoa)
- [x] Pintor liberado pela Dona Neusa; devolução de itens da bolsa
- [x] Sujeira no café velho: faxina por clique; manchas e rachaduras saem com a reforma
- [x] Outras estações da rua: calendário de 30 dias por estação, a rua muda (sem neve fora do inverno)

## Prólogo (em andamento)
- [x] Cenas sem mapa: Natal, lembrança da Tekinha (Pebble), anúncio no celular
- [x] Chegada na rua: o lugar horrível, os vizinhos que não gostam de gatos
- [x] Compra e chave (porta trancada sem a chave)
- [x] O miado: gatinho na porta, caixa de nome, ele entra e fica (itens de gato só depois dele)
- [x] Água e ração: mercado (mercado_interior) e compra no caixa
- [x] Alimentar e primeiro coração
- [x] Cartão final e fim do dia
- [x] Dia 2: ligação e visita da Gabi (com o Joca), conjunto de louças
- [x] Dona Neusa entra no café (NPC)
- [x] Mercado com matéria-prima (café, chá, frutas, despensa); receitas como dados
- [x] Preparar bebidas no balcão (receitas; feito no Atendimento, Fase 1)
- [x] Anúncio com os gatos; uma quest por vez nos primeiros dias (cafeteira -> Dona Neusa; mesas -> Gabi; cadeiras)
- [x] Tela inicial (Home), menu principal, pausa; 3 slots + autosave com backup, exportar/importar, saves corrompidos; opções de som (2 canais)
- [x] Criador de personagem (pacote personagem_principal) no Novo jogo: nome, aparência e 7 poses
- [x] Músicas (dia e noite), sons ambientes, jingles e efeitos ligados aos eventos
- [x] Atendimento, Fase 1: quadro do cardápio (M), mochila (I), mãos, preparo com barra, clientes em pé, louça suja e pia, capacidade pela louça
- [x] Atendimento, Fase 2: bandeja, itens pesados, gato no colo, forno, pia como estação, qualidade e preferências (o veterinário ficou em item próprio)
- [x] Usar itens da barra com animação (ração na tigela, petisco no gato); evolução das receitas por clientes atendidos
- [x] Saúde dos gatos, doenças fictícias e a clínica da Fernanda (dia 6): consulta, receita de 1 a 7 dias, remédio diário e fiado
- [ ] Clínica nas outras estações (a fachada já existe nas 4; a rua só tem o inverno)
- [x] Correio: compras do catálogo chegam em 1h (furgão, entregadora, caixas na porta, abrir no salão)
- [x] Pedidos da vila (bicos), jornal "Vila Hoje" no celular e mural do mercado
- [x] Barra de itens (1 a 8) e mochila em grade; varrer exige a vassoura ativa
- [x] Carrinho no mercado (prateleiras + caixa), estágios do negócio (parcial -> inauguração com placa), capacidade por lugares e louça
- [x] Mais pedidos diários (8): entregas com a caixa visível, neve no mercado, caixotes
- [x] Passagem dos dias: ~16 min por dia, ir para casa depois das 17h, resumo do dia, rotina (comida e poeira)
- [ ] Gatos de rua anunciados no jornal (Marco 2)
- [x] Ciclo dia/noite (cor por hora e estação, luzes dos postes e vitrines, relógio no HUD, "Você foi para casa")
- [x] Ato 1 reorganizado (itens de gato só depois do gato; cantinho quente = caminha + almofada)

## Marco 1: gatos no café
- [x] Sprites dos gatos (Cosy Cats): andar, sentar, dormir
- [x] `data/cats.json` e entidade Gato (IA simples: vagar, sentar, dormir)
- [ ] Gatos procuram almofadas e caminhas para sentar e dormir (hoje sentam e dormem em qualquer lugar)
- [x] Evento `cat.sheltered`
- [x] App "Meus gatos" no celular (P): personalidade, corações, se comeu hoje e dias no café
- [x] Continuação da história: encontrar o gato que mia lá fora (feito no prólogo: "O miado", `story.meow`)

## Marco 2: dia, frio e abrigo
- [x] Ciclo do dia (manhã, dia, noite)
- [ ] Rua curta com gatos de rua para encontrar e abrigar
- [ ] Frio: gatos aquecidos x com frio; meta suave até a noite de Natal
- [x] `day.ended` / `day.started`

## Marco 3: save e load
- [x] Save versionado, migrações, fixture v1 (feito no Marco 0.5)
- [x] Armazenamento via `src/platform/` (feito no Marco 0.5)
- [x] Vários slots e tela de "continuar / jogo novo" (feito na Home: 3 slots + autosave)

## Marco 4: clientes e café aberto
- [x] Clientes humanos, pedidos, servir, dinheiro e gorjeta (feito no Atendimento)
- [ ] Afeto do gato afeta paciência e gorjeta (`cat.affection_changed`)

## Marco 5: reforma e decoração
- [x] Loja abandonada -> reformada (pintor; a reforma completa libera a inauguração)
- [x] Compra e posicionamento de móveis (feito no Marco 0.5)

## Expansão do café
- [x] Cômodos por dados (`data/rooms.json`): planta contínua, descoberta com momento, obra, limpeza e reforma; save v13
- [x] Quartinho: dormir no café
- [x] Quintal secreto: chave, porta com cadeado, variantes de visual, luz de fora
- [ ] Playground no quintal com gatos de verdade usando os módulos (hoje: afeto diário; falta a IA dos gatos ir até eles)
- [ ] Cozinha, sótão e porão (dados prontos para entrar)

## Marco 6: vizinhança
- [ ] Vizinhos com preconceito que muda com o tempo
- [ ] Vizinha idosa e a história da padaria (a Dona Neusa já aparece; falta o arco dela)

## Marco 7: empacotar para a Steam
- [ ] Electron + integração Steamworks
- [ ] Salvar em arquivos (a camada `src/platform/` já está pronta para a troca)
- [ ] Ícone e página da loja (`CREDITS.md` já existe; declarar o uso de IA na arte)

## Arte pendente
- [x] Moldura de botão e de painel (9 partes) nos menus
- [ ] Logo do título com o nome Biscuit Paws
- [x] Arte da inauguração (cena na primavera)
- [ ] Arte da inauguração nas cores menta e céu da fachada (hoje usa a rosa)
- [ ] Fachada da clínica veterinária na primavera, no verão e no outono (hoje fica a de inverno)
- [x] Ícone do carrinho no HUD
- [ ] Pose da personagem carregando saco pesado (o pacote não tem; o saco é desenhado na mão)
- [x] Manequim do PixelLab (64 px) como personagem no jogo, para ver as poses (decisão 075)
- [x] Personagem em 64 px com roupas e cabelos em camadas sobre o manequim, oficial no criador (decisões 077, 083 e 087)

## Depois
- Adoção de gatos (`adoption.completed`)
- Estações: primavera, verão, outono
- Mais humanos e arte de exterior
