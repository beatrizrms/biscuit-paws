# Arquitetura

Objetivo: o jogo pode crescer por anos sem quebrar saves nem o código antigo.

## Camadas

```
data/            conteúdo em JSON (mapas, gatos, itens, falas)
src/core/        regras puras, sem Phaser/DOM/window
src/game/        Phaser: cenas, sprites, entrada, animação
src/platform/    armazenamento e saída (navegador hoje, Electron/Steam depois)
tests/           unitários (core) + fumaça visual (Playwright)
scripts/         validadores e geradores (catálogo de tiles, check do mapa)
```

Dependências só descem: `game` -> `core` -> `data`. O `core` nunca importa `game`.

## Estrutura de pastas

```
cat-cafe-game/
  CLAUDE.md
  README.md
  CREDITS.md
  data/
    tiles.csv                 (cópia do pack; gera tiles.json)
    tiles.json                (gerado)
    maps/cafe_main.json
    cats.json
    items.json
  docs/
  public/assets/              (arte; fora do Git se o repositório for público)
  scripts/
    build-tiles.ts            (tiles.csv -> tiles.json)
    check-map.ts              (valida mapas)
  src/
    core/
      tiles.ts                (catálogo por nome)
      map.ts                  (expande peças de várias células, calcula sólidos)
      events.ts               (barramento de eventos tipado)
      rng.ts                  (RNG com semente)
      save.ts                 (versão + migrações)
    game/
      main.ts                 (config do Phaser)
      scenes/BootScene.ts
      scenes/CafeScene.ts
      entities/Player.ts
    platform/
      storage.ts              (interface) + localStorage.ts
  tests/
    core/*.test.ts
    fixtures/save_v1.json
    e2e/smoke.spec.ts
```

## Contratos que precisam durar
1. **IDs estáveis.** `cat.mimi`, `item.latte`, `map.cafe_main`. Nunca reaproveitar, nunca renomear. Para aposentar, marque `"deprecated": true`.
2. **Dados com versão.** Todo JSON de conteúdo tem `schemaVersion`. Mudou o formato: suba a versão e escreva um migrador.
3. **Save só com IDs e números.** Nada de objetos do Phaser, nada de caminhos de arquivo.
4. **Save versionado.** `save.schemaVersion` + funções `migrate_vN_to_vN+1`. Cada versão antiga tem um **fixture** em `tests/fixtures/` que precisa continuar carregando.
5. **Eventos nomeados** (tabela abaixo). Sistemas conversam por eventos, não se chamam diretamente.
6. **RNG com semente.** Nada de `Math.random()` no `core`. Injete `rng`.
7. **`tags` em tudo** (itens, gatos, falas): `season:winter`, `rarity:common`... Permite filtrar sem mudar o formato.

## Eventos (barramento tipado)

| Evento | Quando dispara | Dados |
| --- | --- | --- |
| `cat.sheltered` | gato é abrigado na loja | `catId` |
| `cat.affection_changed` | afeto de um gato muda | `catId, from, to` |
| `day.ended` | fim do dia | `day` |
| `customer.served` | cliente atendido | `customerId, tip` |
| `adoption.completed` | adoção concluída (fase futura) | `catId, customerId` |

Nomes novos entram nesta tabela antes de serem usados.

## Plataforma
`src/platform/storage.ts` define a interface (`load(key)`, `save(key, json)`, `list()`). Hoje a implementação usa `localStorage`. No empacotamento para a Steam (Electron), troca-se por arquivos em disco, sem mexer no `core`.

## Renderização
- Resolução interna 640 x 360, escala inteira.
- **Y-sort:** `depth` de cada sprite = coordenada Y da base do objeto. Para objetos de várias células, todas as células usam a base do objeto inteiro.
- Pisos ficam em `depth` 0, paredes em 1, objetos e personagens por y-sort.
- A caixa de colisão da personagem é a área dos pés (aprox. 16 x 10 px na base do quadro de 32 x 64).

## Testes
- **core:** Vitest. Cobrir expansão do mapa, células sólidas, migração de save, RNG.
- **e2e:** Playwright abre o jogo, tira print, anda contra a parede e verifica que não atravessou.
- **Regressão de save:** carregar todos os fixtures a cada execução.
