---
name: conferir-visual
description: Abre o Biscuit Paws no navegador (Playwright), visita todos os mapas de data/maps, tira um print de cada um e lista imagens que não carregaram e erros da página; depois os prints são abertos e conferidos. Use depois de qualquer mudança visual (arte, mapas, UI, assets), como pede o CLAUDE.md, ou quando a usuária pedir para ver/conferir o jogo.
---

# Conferir visual

## 1. Servidor
- Ver se já há um rodando: `curl -s -o /dev/null -w "%{http_code}" http://localhost:5173` (200 = sim). Pode ser o da usuária; não derrubar.
- Se não houver: `npm run dev` **em segundo plano** (Bash com run_in_background). Esperar responder antes de seguir. Ao terminar, parar só o servidor que você mesma subiu.

## 2. Prints
```bash
node .claude/skills/conferir-visual/conferir.mjs
```
- Começa um jogo novo (`?jogar` com contexto limpo), passa as falas e cenas, entra em cada mapa pelo gancho de depuração `window.__biscuitPaws.cafe.goTo` e grava `test-results/visual/NN-<mapa>.png` (fora do Git), mais `00-abertura.png`.
- Só alguns mapas: `node .claude/skills/conferir-visual/conferir.mjs test-results/visual map.market map.street`.
- Sai com código 1 se algum arquivo deu 404/erro ou a página teve erro: **isso é falha**, investigar antes de seguir (caminho em `data/*.json` errado, arquivo faltando em `public/assets/`).
- Para um estado específico (ex.: café reformado, balcão posicionado), use o painel de depuração do jogo (F9 ou `?debug` na URL) ou escreva um passo extra baseado em `tests/e2e/smoke.spec.ts`, que já tem helpers (`skipDialogue`, `enterCafe`, `session.buy/place`).

## 3. Conferir de verdade
Abrir **cada** print com Read e olhar, não só confiar no "✓":
- nada faltando (quadrado preto/verde do Phaser = textura ausente), nada cortado ou fora do lugar;
- o que mudou aparece como esperado; escala e alinhamento na grade de 32 (pés na base do tile);
- HUD legível (barra, relógio, moedas) e sem sobreposição estranha;
- se mexeu em arte: comparar com a prancha da skill `/novo-pacote-arte`.

## 4. Relatar
Dizer em uma ou duas linhas o que foi conferido e o que estava errado (com o nome do print). Se a usuária estiver em outro aparelho, enviar o print relevante com SendUserFile.
