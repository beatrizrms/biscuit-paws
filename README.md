# Biscuit Paws

Simulador 2D de café de gatos, no estilo Stardew Valley, para a Steam.
Phaser 3 + TypeScript + Vite. Resolução interna 640 x 360, escala inteira, grade de 32 px.

Estado atual: **Marco 0.5, a chegada.** Você compra a velha padaria vazia (sem balcão, paredes e piso gastos), começa com pouco dinheiro, compra e posiciona móveis, contrata o pintor e segue as primeiras metas da história. O jogo salva sozinho.

## Antes de rodar: a arte

A arte é licenciada e **não vai para o Git** (veja `docs/ART_AND_LICENSE.md`). Copie os arquivos para:

| Arquivo | Destino |
| --- | --- |
| `cat-cafe-tileset.png` (pacote Cat Cafe 32x32, pasta `tiles/`) | `public/assets/tiles/cat-cafe-tileset.png` |
| `mulher_placeholder_32x64.png` (zip da personagem provisória) | `public/assets/characters/mulher_placeholder_32x64.png` |

## Comandos

```bash
npm install
npm run dev         # abre o jogo em http://localhost:5173
npm run art         # gera os tiles "velhos" a partir da folha do pacote (roda sozinho no dev e no build)
npm run check       # tipos + validação de todo o conteúdo (mapas, itens, história, falas)
npm test            # testes da lógica pura (Vitest)
npm run test:e2e    # teste de fumaça no navegador (Playwright)
npm run build       # build de produção em dist/
```

Na primeira vez que rodar o teste de fumaça, instale o navegador do Playwright: `npx playwright install chromium`.
Os prints do teste ficam em `test-results/`.

Controles:
- **Clique na sujeira** (de perto, com a vassoura ativa na barra): limpar. Manchas e rachaduras só saem quando o pintor reforma.
- **1 a 8 / roda do mouse:** escolher o item ativo na barra (embaixo da tela). **I:** mochila em grade; clique num item para pôr no espaço ativo.
- **Setas / WASD:** andar. Para entrar ou sair por uma porta, pare na frente dela e siga para cima.
- **C:** catálogo: móveis, balcão e **Reforma (pintor)** (clique num item para comprar e já posicionar; num acabamento, para o pintor aplicar)
- **Clique:** posicionar · **botão direito ou Esc:** cancelar (o item fica na bolsa)
- **Botão direito num móvel:** recolher e mudar de lugar
- **Espaço / Enter / clique:** avançar as falas
- **Mercado:** **E** numa prateleira põe itens no carrinho (+/−); **E** no caixa mostra o total e paga. Sair sem pagar não cobra nada (o carrinho fica até dormir).
- **M:** quadro do cardápio, com quantos clientes cabem (lugares e louça).

O jogo abre na tela inicial (Home): toque/clique, depois Continuar, Novo jogo, Carregar/recuperar saves, Opções e Créditos. Esc no jogo abre a pausa (Continuar, Opções, Salvar, Voltar ao menu).

Atalhos para testar (pulam a Home): `http://localhost:5173/?novo` começa um jogo novo no slot 1; `?jogar` continua o save mais recente (ou começa um novo).

### Modo debug (só em `npm run dev`)
**F9** liga e desliga (ou abra `?debug=1`). Aparece um painel com: +100 moedas, pular falas, ver as caixas de colisão,
ver a grade (com a célula sob o mouse), jogo novo e os marcos já concluídos. As metas mostram as notas de desenvolvimento (`devNote`).
O debug tem **save próprio**: os truques não mexem no seu save normal. Nada do debug vai para o `npm run build`.

## Onde mexer

### Mudar o mapa do café
Edite `data/maps/cafe_main.json` e rode `npm run check`.

- `legend`: letra -> nome do tile (`"M": "floor_wood_a"`).
- `layers.floor` e `layers.walls`: uma string por linha, 16 caracteres cada. `.` = vazio.
- `objects`: móveis e enfeites. `at` é `[coluna, linha]` do canto superior esquerdo. O tamanho vem do catálogo.
- `spawn.player`: célula onde a personagem começa.

O formato completo está em `docs/DATA_CONTRACTS.md`. Se algo estiver errado, o `check` diz o quê e onde
(nome inexistente, peça fora do mapa, objetos sobrepostos, móvel dentro da parede...).

### Mudar se um tile é sólido ou em que camada fica
Edite `data/tiles.meta.json`. Cada tile tem:
- `solid`: bloqueia a personagem. Peças altas bloqueiam só a última linha (a base), como em Stardew.
- `layer`: `floor` (plano, embaixo de tudo, como o tapete), `wall` (preso à parede) ou `object` (entra no y-sort).

`data/tiles.csv` é cópia do pacote e não deve ser editado. `data/tiles.json` é gerado (`npm run tiles`) e fica fora do Git.

### Mudar a história, as falas, os preços
- `data/story.json`: marcos da história e metas do diário (condição -> efeito).
- `data/dialogue.json`: falas.
- `data/recipes.json`, `data/service.json`, `data/carry.json`: receitas, atendimento e mãos (tecla M: quadro do cardápio; I: mochila).
- `data/delivery.json`: correio (compras do catálogo chegam em 1h na porta do café).
- `data/jobs.json` e `data/news.json`: pedidos da vila (bicos) e o jornal "Vila Hoje" do celular (tecla P).
- `data/daynight.json`: cores do dia e da noite por hora e estação (o mapa diz se é `indoor` e onde ficam as `lights`).
- `data/items.json`: móveis do catálogo, nomes e preços.
- `data/maps/street.json`: a rua (fachadas, objetos, neve, porta do café). `data/world.json`: onde o jogo começa.
- `data/tilesets.json`: folhas extras de tiles (rua, neve, sujeira), com camada e solidez de cada peça.
- `data/finishes.json`: acabamentos do pintor (pisos e papéis de parede) e preços. As superfícies reformáveis ficam no mapa (`surfaces`).
- `data/tiles.worn.json`: tiles velhos gerados do pacote (estilo de desgaste, troca de cores, variações).
- `data/economy.json`: dinheiro inicial.
- `data/ui_text.json`: textos da interface.

O formato está em `docs/DATA_CONTRACTS.md`. Rode `npm run check`: ele acusa referências quebradas (fala, item ou marco que não existe).

### Ajustar a personagem
`data/player.json`: velocidade, quadros por segundo e tamanho da caixa dos pés.

## Como o código está organizado

```
data/          conteúdo (mapas, tiles, itens, história, falas, personagem)
src/core/      regras puras, sem Phaser: mapa, movimento, sessão, história, posicionamento, save (testadas)
src/game/      Phaser: cenas, sprites, teclado; ui/ = interface em HTML por cima do canvas
src/platform/  armazenamento (hoje localStorage; no futuro, arquivos via Electron)
scripts/       gerador do catálogo e validador do conteúdo
tests/core/    testes unitários
tests/e2e/     teste de fumaça no navegador
docs/          história, arquitetura, contratos de dados, arte, roadmap, decisões
```

Três ideias principais:
1. **O `core` decide, o Phaser só desenha.** Por exemplo, quais células são sólidas e qual a profundidade de cada peça
   são calculadas em `src/core/map.ts`. A cena só cria as imagens e os corpos de colisão.
2. **Y-sort:** a profundidade de cada objeto é a coordenada Y da base dele, e a da personagem é a base dos pés.
   Quem está mais embaixo na tela é desenhado por cima.
3. **Tudo passa pela `GameSession`** (`src/core/session.ts`): comprar, posicionar, recolher. Ela avança a história
   e avisa o resto por eventos (`item.placed`, `dialogue.requested`...). A cena e a interface só escutam.

Em `npm run dev`, a cena fica acessível no console do navegador como `__biscuitPaws.cafe`
(por exemplo `__biscuitPaws.cafe.teleportPlayer(3, 3)` ou `__biscuitPaws.cafe.sessionState()`).

## Créditos
Veja `CREDITS.md`.
