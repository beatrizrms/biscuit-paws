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
- [x] Cenas sem mapa: Natal, lembrança da Tekinha (Misty), anúncio no celular
- [x] Chegada na rua: o lugar horrível, os vizinhos que não gostam de gatos
- [x] Compra e chave (porta trancada sem a chave)
- [x] O miado: gatinho na porta, caixa de nome, ele entra e fica (itens de gato só depois dele)
- [x] Água e ração: mercado (mercado_interior) e compra no caixa
- [ ] Alimentar e primeiro coração
- [ ] Cartão final e fim do dia
- [ ] Ato 1 reorganizado (itens de gato só depois do gato)

## Marco 1: gatos no café
- [ ] Sprites dos gatos (Cosy Cats): andar, sentar, dormir
- [ ] `data/cats.json` e entidade Gato (IA simples: vagar, descansar)
- [ ] Gatos sentam em almofadas e caminhas
- [ ] Evento `cat.sheltered`
- [ ] Continuação da história: encontrar o gato que mia lá fora (`cat.first_found`)

## Marco 2: dia, frio e abrigo
- [ ] Ciclo do dia (manhã, dia, noite)
- [ ] Rua curta com gatos de rua para encontrar e abrigar
- [ ] Frio: gatos aquecidos x com frio; meta suave até a noite de Natal
- [ ] `day.ended`

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
