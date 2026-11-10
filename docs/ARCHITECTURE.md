# Arquitetura

Objetivo: o jogo pode crescer por anos sem quebrar saves nem o código antigo.

## Camadas

```
data/            conteúdo em JSON (mapas, gatos, itens, falas)
src/core/        regras puras, sem Phaser/DOM/window
src/game/        Phaser: cenas, sprites, entrada, animação
src/platform/    armazenamento, arquivos (exportar/importar save) e saída (navegador hoje, Electron/Steam depois)
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
| `cat.sheltered` | gato é abrigado na loja (abre a caixa de nome) | `catId` |
| `cat.named` | a jogadora deu nome ao gato | `catId, name` |
| `cat.affection_changed` | corações entre a protagonista e um gato mudam | `catId, from, to` (corações) |
| `day.started` | amanheceu (ela chega de casa) | `day` |
| `day.ended` | fim do dia (ela vai para casa) | `day` (o dia que acabou), `reason` (`home`, `passOut`, `story`, `sleep`, `curfew`, `tired`), `earned`, `jobs` (resumo do dia) |
| `energy.changed` | a energia dela mudou (tarefa ou ao acordar) | `energy`, `max`, `level` (`ok`, `low`, `empty`) |
| `energy.recovered` | ela se recompôs (café ou brincadeira) | `source` (`coffee`, `play`), `amount` |
| `rest.changed` | sentou no sofá ou levantou | `uid` (o sofá; `null` = levantou), `full` (levantou porque encheu) |
| `curfew.soon` | falta pouco para a hora-limite (uma vez por dia) | `minutes` |
| `delivery.ordered` | compra no catálogo: vai pelo correio | `deliveryId, itemId, arrivesAt` |
| `delivery.arrived` | a caixa chegou na porta do café | `deliveryId, itemId` |
| `delivery.picked_up` | ela pegou as caixas da porta | `count` |
| `delivery.unpacked` | ela abriu uma caixa dentro do café | `deliveryId, itemId` |
| `job.accepted` | a jogadora aceitou um pedido da vila | `jobId` |
| `job.progress` | ela fez um ponto de um pedido | `jobId, pointId` |
| `job.completed` | pedido concluído e pago | `jobId, reward` |
| `cat.fed` | um gato comeu da tigela | `catId, itemId, bowlUid` |
| `customer.arrived` | cliente entrou (na fila: `recipeId` null) | `customerId, recipeId` |
| `customer.served` | pedido entregue: o cliente paga (e gorjeta, se satisfeito) | `customerId, recipeId, price, tip, quality` |
| `sink.changed` | louça entrou na pia ou começou a lavagem | `load` |
| `washer.changed` | lava-louças: louça entrou, ligou ou terminou o ciclo | `uid, load, washing` |
| `heavy.stored` | saco pesado guardado no estoque do café | `itemId` |
| `storage.changed` | um baú (a caixa pet) mudou: guardou, pegou ou empilhou (`count` positivo = entrou no baú) | `uid, count` |
| `customer.left` | cliente foi embora (`happy`: foi atendido) | `customerId, happy` |
| `menu.changed` | quadro do cardápio mudou | `menu` |
| `prep.started` / `prep.ready` | etapa começou / ficou pronta no equipamento (`final`: o pedido; senão, massa para a próxima etapa) | `stationUid, recipeId` (+ `final`) |
| `hands.changed` | algo entrou ou saiu das mãos | `count` |
| `dish.washed` | louça suja lavada na pia | `count` |
| `adoption.completed` | adoção concluída (fase futura) | `catId, customerId` |
| `game.started` | sessão começou (jogo novo ou carregado) | `isNew` |
| `map.entered` | a personagem entrou num mapa (porta) | `mapId` |
| `money.changed` | dinheiro mudou | `from, to, reason` |
| `item.bought` | item comprado (vai para o inventário) | `itemId, price` |
| `cart.changed` | carrinho do mercado mudou | `count, total` |
| `reputation.changed` | a reputação felina mudou | `from, to, amount, reason` |
| `reputation.threshold_reached` | passou de um limiar pela primeira vez (só o gancho) | `thresholdId, value` |
| `stats.day_closed` | o dia fechou nas estatísticas (antes da saúde do fim do dia) | `day, served, gaveUp, open, untreated` |
| `stats.streak_broken` | uma sequência de bom comportamento voltou a zero | `streak` (`no_gave_up` ou `cats_cared`) |
| `milestone.reached` | selo do café conquistado (uma vez; presentes já na mochila) | `milestoneId` |
| `festival.started` / `festival.progress` / `festival.scheduled` / `festival.missed` / `festival.finished` | etapas de um festival (feira de adoção, Dia do Gato...) | `festivalId` / `+ step, pointId` / `+ day` / `+ day` / `+ results, coins, reputation, adopted` |
| `arrival.queued` / `arrival.started` / `arrival.step` / `arrival.finished` | chegada de gato: na fila, começou, etapa, terminou (onde o gato ficou) | `arrivalId` / `+catId, model` / `step` / `outcome, placement` |
| `arrival.choice` | a chegada pergunta sim/não (a resposta volta por `session.answerArrival`) | `arrivalId, key` |
| `arrival.needs` / `arrival.need_met` | aceito, o gato espera as necessidades da condição (ração, cobertor, vet) / uma foi atendida | `arrivalId, needs` / `arrivalId, need, left` |
| `arrival.provisional_settled` / `arrival.provisional_expired` | gato provisório ficou de vez / foi para o abrigo da vila | `catId` |
| `cat.adopted` | match de adoção terminou: um gato e o veredito (boa: sai do café, se for de lá) | `catId, verdict, leftCafe` |
| `schedule.changed` | horário de funcionamento mudou (app Horário) | `schedule` |
| `cart.checked_out` | pagou no caixa | `lines, total` |
| `business.changed` | negócio mudou de estágio | `from, to` |
| `item.received` | a história deu um item (ex.: a chave) | `itemId` |
| `item.placed` | móvel posicionado no café | `itemId, uid, at` |
| `item.picked_up` | móvel recolhido de volta ao inventário | `itemId, uid` |
| `item.refunded` | item da bolsa devolvido com reembolso | `itemId, amount` |
| `dirt.cleaned` | a personagem limpou uma sujeira do café | `dirtId` |
| `surface.painted` | o pintor trocou o acabamento de uma superfície | `surfaceId, finishId, price` |
| `story.beat_completed` | marco da história concluído | `beatId` |
| `dialogue.requested` | o core pede para mostrar uma fala | `dialogueId` |
| `cutscene.requested` | o core pede para mostrar uma cena sem mapa | `cutsceneId` |
| `script.requested` | o core pede um roteiro no mundo (NPCs andam, falam...) | `scriptId` |
| `script.finished` | o roteiro terminou (marca `seen.<id>`) | `scriptId` |
| `cutscene.finished` | a cena terminou (marca a flag `seen.<id>`) | `cutsceneId` |

Nomes novos entram nesta tabela antes de serem usados.

## Plataforma
`src/platform/storage.ts` define a interface (`load(key)`, `save(key, json)`, `remove(key)`, `list()`), **assíncrona** (o Electron vai ler arquivos de forma assíncrona). Hoje a implementação usa `localStorage`. No empacotamento para a Steam (Electron), troca-se por arquivos em disco, sem mexer no `core`.

## Renderização
- Resolução interna 640 x 360, escala inteira.
- **Y-sort:** `depth` de cada sprite = coordenada Y da base do objeto. Para objetos de várias células, todas as células usam a base do objeto inteiro.
- Pisos ficam em `depth` 0, paredes em 1, objetos e personagens por y-sort.
- A caixa de colisão da personagem é a área dos pés (aprox. 16 x 10 px na base do quadro de 32 x 64).

## Testes
- **core:** Vitest. Cobrir expansão do mapa, células sólidas, migração de save, RNG.
- **e2e:** Playwright abre o jogo, tira print, anda contra a parede e verifica que não atravessou.
- **Regressão de save:** carregar todos os fixtures a cada execução.
