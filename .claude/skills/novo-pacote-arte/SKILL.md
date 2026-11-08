---
name: novo-pacote-arte
description: Recebe um pacote de arte novo (pasta ou zip) e o coloca no Biscuit Paws seguindo as regras do projeto - original intacto em assets/_originais_pacotes, checagem técnica (grade 32, paleta Cosy, densidade de pixel, fundo, nomes), comparação visual com o que já existe, cópia para public/assets com nomes no padrão e registro em dados e docs. Use quando a usuária trouxer arte nova, um pacote gerado por IA ou pedir para importar/avaliar assets.
---

# Novo pacote de arte

Regras de fundo: `CLAUDE.md` (seção Arte e licença), `docs/ART_AND_LICENSE.md`, convenção e checklist em `docs/ASSET_REORGANIZATION.md` (seções 2 e 7), decisão 046 em `docs/DECISIONS.md`.

## 1. Guardar o original (nunca editar)
- Destino: `assets/_originais_pacotes/<nome_do_pacote>/` (snake_case, sem acento). Zip: extrair ali; o zip em si não precisa ficar.
- Ler o LEIA-ME/README do pacote inteiro: tamanho de quadro, ordem das linhas, licença, se é IA.
- Nada daqui vai para o Git (`assets/` está no `.gitignore`). Conferir com `git check-ignore -v <arquivo>`.

## 2. Checagem técnica (script)
```bash
node .claude/skills/novo-pacote-arte/check-art.mjs assets/_originais_pacotes/<pacote>
```
Rodar na raiz do projeto (usa o `pngjs` do projeto). Mostra, por imagem: dimensões, grade 32, quadros prováveis, fundo, % de pixels fora da paleta Cosy, densidade (pixel 2x/4x = arte ampliada), nome fora do padrão e duplicatas (pixels idênticos), com previews/demos separados.

Como ler o resultado:
| Aviso | O que fazer |
|---|---|
| fora da grade 32 | objeto do mundo: completar o canvas até múltiplo de 32, base embaixo. UI pode ficar fora. 16x16 só para item de fato pequeno (decisão 046). |
| pixel 2x/4x | veio ampliado: reduzir por amostragem (vizinho mais próximo) e conferir de novo. |
| fora da paleta > 25% | avisar a usuária; propor quantizar para `cosy-palette.gpl` (as paletas estão em `assets/_originais_pacotes/Cat-Cafe-32x32/` e `Cosy-Cats-32x32/`). |
| cantos opacos | só é ok em piso, parede, retrato com moldura e preview. |
| duplicata | usar uma só. |

## 3. Comparação visual (obrigatória)
Montar uma prancha ampliada 3-4x (vizinho mais próximo) com as peças novas **ao lado** do que vai aparecer junto no jogo: personagem 32x64 (`public/assets/characters/npcs/npc_gabi.png`, quadro 0), um gato (`characters/cats/cat_marmalade.png`), uma cadeira/mesa do café (`interiors/cafe/tile_cafe.png`) e o objeto equivalente se já existir (ex.: outra xícara, outra porta). Abrir a imagem com Read e conferir: escala, perspectiva 3/4 de frente, contorno (marrom-escuro, 1 px, não preto), estados completos (limpo/sujo, aberto/fechado...), as 4 estações se for externo. O script pode gerar a prancha:
```bash
node .claude/skills/novo-pacote-arte/check-art.mjs <pasta> --prancha <saida.png> <arquivo1.png> <arquivo2.png#x,y,w,h> ...
```
(`#x,y,w,h` recorta um quadro de uma folha; caminhos relativos à raiz do projeto.) Salvar a prancha no scratchpad, não no projeto.

Se algo destoar, **mostrar à usuária antes de importar** (tabela curta: peça | problema | sugestão).

## 4. Levar para o jogo
- Copiar (ou montar folha) só o que o jogo vai usar para `public/assets/<função>/` com nome no padrão: `prefixo_assunto[_variante][_estado][_estação].png`, em inglês. Prefixos: `tile_ obj_ anim_ chr_ npc_ cat_ ui_ icon_ fx_ bgm_ amb_ sfx_`. Pastas: `env/ interiors/ objects/ characters/ ui/ icons/ fx/ audio/`.
- Se precisar recortar, montar folha ou renomear em lote, fazer um `scripts/import-<pacote>.ts` (modelo: `scripts/import-fluxo.ts`) para dar para rodar de novo quando o pacote mudar; registrar no `package.json` se for usado sempre.
- Previews, demos, `_rotulado`, `_2x`, `_4x` ficam só no original.

## 5. Registrar
- Dados em `data/*.json` com IDs estáveis em inglês (nunca renomear ID existente). Tilesets: JSON de peças em `data/tilesets/` + entrada em `data/tilesets.json`.
- `docs/ART_AND_LICENSE.md`: linha na tabela de pacotes (origem, se é IA, o que está em uso).
- `CREDITS.md` se tiver autor. Uso de IA: lembrar que vai declarado na Steam (decisão 020).
- Rodar `npm run check`; depois `/conferir-visual` e, no fim, `/fechar-tarefa`.
