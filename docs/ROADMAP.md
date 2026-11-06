# Roadmap

Marque as caixas conforme concluir. Cada marco precisa de print conferido, testes e README atualizado.

## Marco 0: o café andável
- [ ] Projeto Phaser + TS + Vite, resolução 640 x 360, escala inteira
- [ ] Catálogo de tiles gerado de `tiles.csv`
- [ ] Mapa carregado de `data/maps/cafe_main.json`
- [ ] Peças de várias células (janela, porta, sofá, árvore de gato)
- [ ] Personagem animada (setas e WASD)
- [ ] Colisão com caixa nos pés e células sólidas
- [ ] Y-sort (passar atrás e na frente do balcão)
- [ ] `npm run check`, testes do core e teste de fumaça (Playwright)
- [ ] README

## Marco 1: gatos no café
- [ ] Sprites dos gatos (Cosy Cats): andar, sentar, dormir
- [ ] `data/cats.json` e entidade Gato (IA simples: vagar, descansar)
- [ ] Gatos sentam em almofadas e caminhas
- [ ] Evento `cat.sheltered`

## Marco 2: dia, frio e abrigo
- [ ] Ciclo do dia (manhã, dia, noite)
- [ ] Rua curta com gatos de rua para encontrar e abrigar
- [ ] Frio: gatos aquecidos x com frio; meta suave até a noite de Natal
- [ ] `day.ended`

## Marco 3: save e load
- [ ] Save versionado, migrações, fixture v1
- [ ] Armazenamento via `src/platform/`

## Marco 4: clientes e café aberto
- [ ] Clientes humanos, pedidos, servir, dinheiro e gorjeta
- [ ] Afeto do gato afeta paciência e gorjeta (`cat.affection_changed`)

## Marco 5: reforma e decoração
- [ ] Loja abandonada -> reformada
- [ ] Compra e posicionamento de móveis

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
