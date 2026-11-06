# CLAUDE.md: Biscuit Paws

Jogo 2D de simulação, estilo Stardew Valley, tema café de gatos, para a Steam.
Leia `docs/` antes de mexer no código. Este arquivo é o resumo das regras.

## Idioma
- Conversa, documentação e mensagens de commit: **português**.
- Código, nomes de variáveis e IDs de conteúdo: **inglês**.

## Stack
- Phaser 3 + TypeScript + Vite. Resolução interna 640 x 360, escala inteira, grade de 32 px.
- Testes da lógica pura: Vitest. Teste visual/fumaça: Playwright.

## Comandos
- `npm run dev`: servidor de desenvolvimento.
- `npm run build`: build de produção.
- `npm run check`: tipos + validação dos dados (mapas, catálogos).
- `npm test`: testes unitários.

## Regras de arquitetura (não quebre sem me consultar)
1. **Núcleo puro separado do motor.** `src/core/` não importa Phaser, DOM nem `window`. Toda regra do jogo (afeto dos gatos, economia, ciclo do dia, save) mora aqui e é testável.
2. **O Phaser só desenha e lê entrada.** `src/game/` chama o núcleo, não decide regras.
3. **Conteúdo é dado.** Mapas, gatos, itens e falas ficam em `data/*.json`, nunca escritos no código.
4. **IDs estáveis.** Todo conteúdo tem um ID (`cat.mimi`, `item.latte`) que **nunca é reaproveitado nem renomeado**. O save só guarda IDs e números.
5. **Saves versionados** com `schemaVersion` e migrações. Mantenha um save antigo de exemplo nos testes (`tests/fixtures/`).
6. **Eventos nomeados** entre sistemas (`day.ended`, `cat.sheltered`...). Veja `docs/ARCHITECTURE.md`.
7. **Aleatoriedade com semente** (RNG injetado), para os testes serem repetíveis.
8. **Plataforma abstraída:** armazenamento e saída do jogo passam por `src/platform/`, para trocar navegador por Electron/Steam depois.

## Arte e licença
- Só pixel art 32 x 32 do mesmo artista (leckie1989). Não misture 16 x 16 com 32 x 32.
- **Nunca** commitar os PNGs em repositório público. Mantenha `public/assets/` no `.gitignore` se o repositório for público.
- Mantenha `CREDITS.md` atualizado.
- Detalhes em `docs/ART_AND_LICENSE.md`.

## Como trabalhar
- Plano curto antes de implementar. Perguntar quando houver ambiguidade.
- Depois de qualquer mudança visual, **abrir no navegador (Playwright), tirar print e conferir**.
- Mudanças pequenas, commits claros.
- Definição de pronto: roda, passa em `npm run check` e `npm test`, tem print conferido e README atualizado.
