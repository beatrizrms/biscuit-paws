# Biscuit Paws

Simulador 2D de café de gatos, no estilo Stardew Valley, para a Steam.
Phaser 3 + TypeScript + Vite. Resolução interna 640 x 360, escala inteira, grade de 32 px.

Estado atual: **Marco 0, o café andável.** O café aparece montado e a personagem anda e colide.

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
npm run check       # tipos + validação dos mapas
npm test            # testes da lógica pura (Vitest)
npm run test:e2e    # teste de fumaça no navegador (Playwright)
npm run build       # build de produção em dist/
```

Na primeira vez que rodar o teste de fumaça, instale o navegador do Playwright: `npx playwright install chromium`.
Os prints do teste ficam em `test-results/`.

Controles: setas ou WASD.

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

### Ajustar a personagem
`data/player.json`: velocidade, quadros por segundo e tamanho da caixa dos pés.

## Como o código está organizado

```
data/          conteúdo (mapas, catálogo de tiles, personagem)
src/core/      regras puras, sem Phaser: catálogo, mapa, movimento (testadas)
src/game/      Phaser: cenas, sprites, teclado
scripts/       gerador do catálogo e validador dos mapas
tests/core/    testes unitários
tests/e2e/     teste de fumaça no navegador
docs/          história, arquitetura, contratos de dados, arte, roadmap, decisões
```

Duas ideias principais:
1. **O `core` decide, o Phaser só desenha.** Por exemplo, quais células são sólidas e qual a profundidade de cada peça
   são calculadas em `src/core/map.ts`. A cena só cria as imagens e os corpos de colisão.
2. **Y-sort:** a profundidade de cada objeto é a coordenada Y da base dele, e a da personagem é a base dos pés.
   Quem está mais embaixo na tela é desenhado por cima.

Em `npm run dev`, a cena fica acessível no console do navegador como `__biscuitPaws.cafe`
(por exemplo `__biscuitPaws.cafe.teleportPlayer(3, 3)`).

## Créditos
Veja `CREDITS.md`.
