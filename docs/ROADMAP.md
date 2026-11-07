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
- [x] Primeiro ato: cantinho quente -> lugar para sentar -> visita da Dona Lurdes -> miado lá fora
- [x] Save automático (antecipado do Marco 3)
- [x] Loja começa velha (tiles gerados do pacote) e sem balcão; balcão vendido em peças
- [x] Pintor: escolher piso e papel de parede (loja velha -> reformada); save v2

## Marco 0.6: a rua e o subconsciente
- [x] Rua do café (inverno) com fachadas, objetos e neve; o jogo começa nela
- [x] Portas entre a rua e o café; câmera segue a personagem
- [x] Metas como subconsciente (balão de pensamento, 1ª pessoa)
- [x] Pintor liberado pela Dona Lurdes; devolução de itens da bolsa
- [x] Sujeira no café velho: faxina por clique; manchas e rachaduras saem com a reforma
- [ ] Outras estações da rua (dados já preparados)

## Prólogo (em andamento)
- [x] Cenas sem mapa: Natal, lembrança da Tekinha (Pebble), anúncio no celular
- [x] Chegada na rua: o lugar horrível, os vizinhos que não gostam de gatos
- [x] Compra e chave (porta trancada sem a chave)
- [x] O miado: gatinho na porta, caixa de nome, ele entra e fica (itens de gato só depois dele)
- [x] Água e ração: mercado (mercado_interior) e compra no caixa
- [x] Alimentar e primeiro coração
- [x] Cartão final e fim do dia
- [x] Dia 2: ligação e visita da Gabi (com o Joca), conjunto de louças
- [x] Dona Lurdes entra no café (NPC)
- [x] Mercado com matéria-prima (café, chá, frutas, despensa); receitas como dados
- [ ] Preparar bebidas no balcão (receitas)
- [x] Anúncio com os gatos; uma quest por vez nos primeiros dias (cafeteira -> Dona Neusa; mesas -> Gabi; cadeiras)
- [x] Tela inicial (Home), menu principal, pausa; 3 slots + autosave com backup, exportar/importar, saves corrompidos; opções de som (2 canais)
- [ ] Criador de personagem (pacote personagem_principal) no Novo jogo
- [ ] Músicas e sons ambientes (canais prontos)
- [x] Atendimento, Fase 1: quadro do cardápio (M), mochila (I), mãos, preparo com barra, clientes em pé, louça suja e pia, capacidade pela louça
- [ ] Atendimento, Fase 2: bandeja, itens pesados, gato no veterinário, forno, pia como estação, qualidade e preferências
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
- [ ] Sprites dos gatos (Cosy Cats): andar, sentar, dormir
- [ ] `data/cats.json` e entidade Gato (IA simples: vagar, descansar)
- [ ] Gatos sentam em almofadas e caminhas
- [ ] Evento `cat.sheltered`
- [ ] Continuação da história: encontrar o gato que mia lá fora (`cat.first_found`)

## Marco 2: dia, frio e abrigo
- [x] Ciclo do dia (manhã, dia, noite)
- [ ] Rua curta com gatos de rua para encontrar e abrigar
- [ ] Frio: gatos aquecidos x com frio; meta suave até a noite de Natal
- [x] `day.ended` / `day.started`

## Marco 3: save e load
- [x] Save versionado, migrações, fixture v1 (feito no Marco 0.5)
- [x] Armazenamento via `src/platform/` (feito no Marco 0.5)
- [ ] Vários slots e tela de "continuar / jogo novo"

## Marco 4: clientes e café aberto
- [ ] Clientes humanos, pedidos, servir, dinheiro e gorjeta
- [ ] Afeto do gato afeta paciência e gorjeta (`cat.affection_changed`)

## Marco 5: reforma e decoração
- [ ] Loja abandonada -> reformada
- [x] Compra e posicionamento de móveis (feito no Marco 0.5)

## Marco 6: vizinhança
- [ ] Vizinhos com preconceito que muda com o tempo
- [ ] Vizinha idosa e a história da padaria

## Marco 7: empacotar para a Steam
- [ ] Electron + integração Steamworks
- [ ] Salvar em arquivos
- [ ] Ícone, créditos, página da loja

## Depois
- Adoção de gatos (`adoption.completed`)
- Estações: primavera, verão, outono
- Mais humanos e arte de exterior
