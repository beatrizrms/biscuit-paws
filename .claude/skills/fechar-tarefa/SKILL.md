---
name: fechar-tarefa
description: Fecha uma tarefa do Biscuit Paws seguindo a definição de pronto do CLAUDE.md - roda check e testes, confere o visual se algo visível mudou, atualiza README/DECISIONS/ROADMAP/docs, separa os arquivos da tarefa de mudanças de outras conversas e faz um commit claro em português. Use quando a tarefa estiver terminada ou a usuária pedir para fechar, finalizar ou commitar.
---

# Fechar tarefa

Definição de pronto (CLAUDE.md): roda, passa em `npm run check` e `npm test`, tem print conferido e README atualizado.

## 1. O que é desta tarefa
- `git status --short` e `git diff --stat`. **Pode haver outras conversas trabalhando nesta mesma pasta.** Separar o que esta conversa mudou do que não é dela (arquivos que você não tocou, ou trechos de outra funcionalidade). Na dúvida, perguntar antes de incluir.
- Nunca commitar arte: `assets/`, `public/assets/`, `*.png`, `*.gif`, `*.zip`, áudio. Conferir com `git status --short --ignored` se algo escapou do `.gitignore`.

## 2. Verificar
```bash
npm run check
npm test
```
- Mudou algo visível (arte, mapa, UI, cena)? Rodar `/conferir-visual` e olhar os prints.
- Mexeu em fluxo de jogo (história, mercado, atendimento, save)? Rodar também `npm run test:e2e` (≈4 min). Se um teste falhar só na suíte inteira, rodar ele sozinho (`npx playwright test -g "<nome>"`) antes de concluir que é instável, e dizer isso no relato.
- Save mudou de formato? Conferir `schemaVersion`, migração e um save antigo de exemplo em `tests/fixtures/` (regra 5).
- Falhou: corrigir ou relatar com a saída. Não commitar vermelho sem a usuária pedir.

## 3. Documentar
- `README.md`: estado atual, comandos e controles se mudaram.
- `docs/DECISIONS.md`: nova entrada numerada (`## NNN. Título (mês/ano)`, com **Motivo** e **Consequência**) se houve decisão de design/arquitetura. Não reescrever entradas antigas (são histórico).
- `docs/ROADMAP.md`: marcar o que foi feito.
- Outros docs afetados (`DATA_CONTRACTS.md` para formato de dados, `ART_AND_LICENSE.md` e `CREDITS.md` para arte).

## 4. Commit
- Só os arquivos da tarefa: `git add <arquivos>` (não `git add -A` se houver mudanças de outras conversas).
- Mensagem em português: título curto no imperativo/resumo (≤ 72 caracteres), linha em branco, tópicos do que mudou e por quê, linha com o que foi verificado. Terminar com a linha de coautoria pedida pelo sistema.
- Um commit por assunto; se a tarefa misturou dois assuntos, dois commits.
- Não fazer push nem abrir PR sem pedido.

## 5. Relatar
Em poucas linhas: o que foi feito, o que foi verificado (check, testes, prints), o hash do commit e o que ficou pendente ou foi deixado de fora (ex.: arquivos de outra conversa).
