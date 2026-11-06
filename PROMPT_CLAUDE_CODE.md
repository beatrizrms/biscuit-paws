# Prompt inicial para o Claude Code

> Cole o texto abaixo na primeira mensagem do Claude Code, com a pasta do projeto aberta.
> Antes, coloque neste projeto os arquivos `CLAUDE.md` e a pasta `docs/` deste kit.
> Coloque também a arte nos caminhos indicados na seção "Arte" (ela não vem no kit por causa da licença).

---

Você vai me ajudar a construir um jogo 2D chamado **Cat Café** (um simulador de café de gatos, no estilo Stardew Valley), para ser publicado na Steam.

Eu sou desenvolvedora web (JS/TS), sem experiência em jogos. Quero que você escreva e teste o código, e me explique as decisões em linguagem simples. Eu respondo em português, e você também.

## Antes de escrever qualquer código

1. Leia `CLAUDE.md` e todos os arquivos em `docs/`. Eles são a fonte da verdade sobre história, arquitetura, formato de dados, arte e roadmap.
2. Me diga em poucas linhas o que entendeu e proponha um plano para o **Marco 0** (abaixo). Se algo nos documentos estiver ambíguo ou contraditório, pergunte antes de seguir.
3. Só depois comece a implementar.

## Stack (já decidida, não mude sem me consultar)

- **Phaser 3 + TypeScript + Vite.**
- Resolução interna **640 x 360**, escala inteira (pixel art nítida, `pixelArt: true`, `roundPixels: true`).
- Grade de **32 x 32** px.
- Física: Phaser Arcade.
- Empacotamento para a Steam (Electron) fica para um marco futuro. Não implemente agora, mas não crie nada que o impeça (veja a abstração de plataforma em `docs/ARCHITECTURE.md`).

## Marco 0: "o café andável"

Objetivo: abrir o jogo no navegador (`npm run dev`) e ver o café montado, com a personagem andando e colidindo.

Critérios de aceite:

- [ ] O mapa vem de um **arquivo de dados** (`data/maps/cafe_main.json`, formato em `docs/DATA_CONTRACTS.md`), e não de coordenadas escritas no código.
- [ ] Os tiles são referenciados **por nome** (`floor_wood_a`, `counter_left`...), usando o catálogo gerado a partir de `tiles.csv`. Nunca por número de linha ou coluna espalhado pelo código.
- [ ] O mapa tem 16 x 11 células, como o desenho em `docs/DATA_CONTRACTS.md`, e inclui as peças de várias células (janela, porta, sofá, árvore de gato...).
- [ ] A personagem (folha 128 x 256, quadros de 32 x 64, linhas: baixo, esquerda, direita, cima) anda com **setas e WASD**, com animação de caminhada de 4 quadros e parada no primeiro quadro.
- [ ] Colisão com as paredes e com os objetos sólidos listados em `docs/ART_AND_LICENSE.md`. A caixa de colisão da personagem é só a área dos **pés**, e não o corpo todo.
- [ ] **Ordenação por profundidade (y-sort):** a personagem passa atrás do balcão quando está acima dele, e na frente quando está abaixo.
- [ ] A lógica pura (carregar o mapa, expandir peças de várias células, calcular células sólidas) fica em `src/core/`, **sem importar o Phaser**, e tem testes.
- [ ] `npm run check` valida o mapa: nomes de tiles que existem, posições dentro dos limites, objetos que não se sobrepõem.
- [ ] Um teste de fumaça com Playwright abre o jogo, tira um print, anda contra a parede e confirma que a personagem não a atravessou.
- [ ] `README.md` com como rodar, testar e onde mexer para mudar o mapa.

Fora do Marco 0 (não faça agora): gatos, clientes, dinheiro, ciclo do dia, save, menus, som, estações.

## Como quero que você trabalhe

- **Rode e olhe o resultado.** Depois de cada etapa visual, abra o jogo com o Playwright, tire um print e confira com o desenho do café. Não diga que está pronto sem ter visto.
- Faça mudanças pequenas e commite com mensagens claras (em português, no imperativo).
- Se encontrar um problema de arte (peça que não combina, tile estranho), descreva e me pergunte, em vez de improvisar.
- Respeite a licença da arte (`docs/ART_AND_LICENSE.md`): nada de commitar os PNGs em repositório público.
- No fim de cada etapa, escreva em 3 a 5 linhas o que mudou e como eu testo.

## Arte (onde estão os arquivos)

Copie para o projeto, em `public/assets/`:

| Arquivo | Origem na minha máquina | Destino no projeto |
| --- | --- | --- |
| Folha de tiles | `C:\Users\bibi_\Downloads\Cat-Cafe-32x32-Tileset\Cat-Cafe-32x32\tiles\cat-cafe-tileset.png` | `public/assets/tiles/cat-cafe-tileset.png` |
| Catálogo dos tiles | `...\Cat-Cafe-32x32\tiles\tiles.csv` | `data/tiles.csv` |
| Personagem provisória | `mulher_placeholder_32x64.png` (do zip que recebi) | `public/assets/characters/mulher_placeholder_32x64.png` |

Se algum destes arquivos faltar quando você precisar, pare e me peça.
