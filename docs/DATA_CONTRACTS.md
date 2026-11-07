# Contratos de dados

Todos os arquivos em `data/` têm `schemaVersion` e IDs estáveis (veja `ARCHITECTURE.md`).

## Mapa (`data/maps/*.json`)

Esquema versão 1:

```jsonc
{
  "schemaVersion": 1,
  "id": "map.cafe_main",
  "tileSize": 32,
  "size": { "cols": 16, "rows": 11 },

  // Letra usada nas camadas de grade -> nome do tile no catálogo
  "legend": {
    "P": "wall_stripe_pink",
    "R": "wall_wainscot",
    "X": "floor_check_pink",
    "M": "floor_wood_a"
  },

  // Cada linha tem exatamente "cols" caracteres. "." = vazio.
  "layers": {
    "floor": [ "...", "..." ],
    "walls": [ "...", "..." ]
  },

  // Peças que podem ocupar várias células. A origem é o canto superior esquerdo.
  "objects": [
    { "id": "obj.counter_left", "tile": "counter_left", "at": [0, 4] }
  ],

  "spawn": { "player": [8, 8] }
}
```

Regras:
- `tile` é sempre o **nome** do catálogo (`tiles.json`, gerado de `tiles.csv`).
- O tamanho de cada peça (`width_tiles` x `height_tiles`) vem do catálogo, e não do mapa.
- `id` de objeto é único dentro do mapa e estável.
- Solidez: vem do catálogo (`solid: true`) ou das camadas de parede. O mapa não repete essa informação.
- Validar em `npm run check`: nomes existentes, dentro dos limites, sem sobreposição de objetos sólidos, linhas com o comprimento certo.

### Café inicial (16 x 11)

Legenda: P parede rosa, R rodapé, X xadrez rosa, M madeira, B balcão, T mesa, c cadeira, V vaso.

```text
coluna:  0 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15
linha 0  P P P P P P P P P P P  P  P  P  P  P
linha 1  P P P P P P P P P P P  P  P  P  P  P
linha 2  R R R R R R R R R R R  R  R  R  R  R
linha 3  X X X X X X X X M M M  M  M  M  M  M
linha 4  B B B B B B B B M M V  M  M  M  M  M
linha 5  M M M M M M M M M M M  M  M  M  M  M
linha 6  M M M M M M M M M M M  M  M  M  M  M
linha 7  M M M c T c M M M M M  M  M  M  M  M
linha 8  M M M M M M M M M M M  M  M  M  M  M
linha 9  M M M M M M M M M M M  M  M  M  M  M
linha 10 M M M M M M M M M M M  M  M  M  M  M
```

Balcão: `counter_left` em (0,4), `counter_mid` em (1..6,4), `counter_right` em (7,4).
Mesa `table_round` em (4,7), cadeiras `chair_front` em (3,7) e `chair_back` em (5,7), `plant_pot` em (10,4).

**Atualização (decisão 015):** o mapa base agora é a **loja vazia**: só as peças do prédio (janelas, porta, capacho e balcão). Mesa, cadeiras, vaso e o resto são comprados e posicionados pela jogadora, e ficam no save (`placed`), não no mapa.

Peças extras sugeridas (decoração, no mesmo estilo): janelas `window` (2x2) e `door` (1x2) na parede, `menu_board`, `wall_clock`, `picture_paw`, `sofa`, `cat_tree`, `bookshelf`, `rug`. Confira posições no print antes de fixar.

## Gatos (`data/cats.json`)

```jsonc
{
  "schemaVersion": 1,
  "cats": [
    {
      "id": "cat.mimi",
      "name": "Mimi",
      "personality": "shy",
      "tags": ["season:winter", "origin:street"],
      "likes": ["item.fish_biscuits"],
      "deprecated": false
    }
  ]
}
```

## Itens (`data/items.json`)

```jsonc
{
  "schemaVersion": 1,
  "items": [
    { "id": "item.cat_bed", "name": "Caminha de gato", "price": 25, "tile": "cat_bed", "tags": ["furniture", "for:cats"] },
    { "id": "item.latte", "name": "Latte", "price": 12, "tile": "latte", "tags": ["drink"] }
  ]
}
```

- Tags com função: `food_bowl` (tigela onde se põe ração: E ou clique de perto), `food` (consumível que enche a tigela).
- `requires` (opcional): condição para poder comprar. Os itens de gato têm `{ "flag": "has.cat" }` (só depois do primeiro gato).
- `kind`: `furniture` (padrão; vai para o catálogo e precisa de `tile`), `consumable` (ração, remédio) ou `key` (não se compra nem se devolve). `fixture`: peça de lugar fixo (ex.: `item.cafe_sign`, a lousa): compra-se uma vez no catálogo, sem devolução, e aparece sozinha no mapa pelo objeto que tem `"when": { "received": "item.id" }` (depois que a caixa do correio é aberta).
- `price`: preço de compra, em moedas (inteiro).
- `tile`: nome no catálogo de tiles. A camada do tile (`floor`, `wall`, `object`) decide onde o móvel pode ficar.
- Tags usadas hoje: `for:cats`, `for:guests`, `decor` (seções do catálogo, definidas em `data/ui_text.json`) e `table`, `chair` (contadas pela história).

### Campos opcionais do mapa (rua, portas)

```jsonc
{
  "background": "#a9d4ea",                 // cor atrás do mapa (o céu da rua)
  "layers": { "floor": [...], "walls": [...], "overlay": [...] },   // overlay: por cima do piso (neve na calçada)
  "objects": [
    { "id": "obj.bench", "tile": "prop_banco", "at": [5, 8], "overlay": "snow_prop_banco" },  // neve por cima, mesmo tamanho
    { "id": "obj.chalkboard", "tile": "prop_lousa_cafe", "at": [16, 8], "when": { "received": "item.cafe_sign" } }  // só depois de chegar e ser aberta
  ],
  "doors": [
    { "id": "door.cafe", "at": [17, 8], "to": "map.cafe_main", "spawn": [14, 4], "facing": "down" }
  ]
}
```

Porta: andar **para cima** na célula `at` leva ao mapa `to`, na célula `spawn`. Opcional: `"intercept": { "when": condição, "cutscene": "cs.id" }` (em vez de atravessar, mostra a cena; ex.: o gatinho na porta), `"requires"` (condição, ex.: `{ "owned": "item.key_bakery" }`) e `"locked"` (fala mostrada quando trancada). Depois de passar, só outra porta funciona quando a seta para cima for solta.
Pisos marcados como sólidos (asfalto, água) bloqueiam como paredes.

### Sujeira do café (`dirt`, no mapa)

```jsonc
"dirt": [
  { "id": "dirt.web_window", "tile": "dirt_teia_janela", "at": [10, 0], "tags": ["web"] },
  { "id": "dirt.stain_water", "tile": "dirt_mancha_agua", "at": [4, 1], "tags": ["stain"], "clearedBy": "surface.wallpaper" }
]
```

Sem `clearedBy`: sai com faxina (clique, a até 2 células da personagem; fica em `cleaned` no save). Com `clearedBy`: só some quando o pintor reforma aquela superfície.
Condição de história: `{ "cleaned": "web" }` = toda a sujeira com essa tag (das que saem com faxina) já foi limpa.

## Cenas sem mapa (`data/cutscenes.json`)

```jsonc
"cs.prologue_thoughts": {
  "background": "#241c33", "snow": true,
  "steps": [
    { "type": "text", "speaker": "", "text": "Véspera de Natal..." },
    { "type": "cat", "cat": "cat.tekinha", "animation": "sleep", "caption": "Tekinha" },
    { "type": "hide" },
    { "type": "phone", "mode": "lock", "app": "Classificados", "title": "VENDE-SE...", "lines": [], "time": "23:47", "date": "Quarta-feira, 24 de dezembro" },  // tela de bloqueio com notificação
    { "type": "phone", "app": "Classificados", "title": "VENDE-SE...", "lines": ["..."] },
    { "type": "card", "text": "NESSA NOITE..." }
  ]
}
```

A história dispara com o efeito `{ "cutscene": "cs.id" }`. Ao terminar, a flag `seen.cs.id` fica marcada (use em `when`).

## Gatos (`data/cats.json`, `data/cat_sprites.json`)

`id` é permanente; o nome escolhido pela jogadora fica no save. Gatos sem `name` fixo precisam de `nameSuggestions` (caixa de nome ao abrigar).
`variant`: folha do Cosy Cats (`cat_sprites.json`: 6 colunas x 7 linhas de 32x32; animações sit, walk_*, sleep, play). `memory: true`: só aparece em lembranças (Tekinha).

## Lojas e ícones (`data/shops.json`, `data/icons.json`)

```jsonc
{ "schemaVersion": 1, "shops": { "shop.market": { "name": "Mercado da Vila", "items": ["item.cat_food_basic", "..."] } } }
```

O preço vem de `items.json`. Itens consumíveis têm `icon` (nome em `data/icons.json`, folha do pacote `catalogo_compras`).
No mapa, `"interactions": [{ "id": "int.market_cashier", "at": [13, 9], "reach": 2, "action": { "shop": "shop.market" } }]`:
tecla **E** perto (até `reach` células) ou clique na célula abre a loja.
Portas aceitam `"direction"` (padrão `up`): a saída do mercado é `down` (a frente do cômodo é aberta).

## Roteiros e NPCs (`data/scripts.json`, `data/npcs.json`)

Roteiro = lista de passos executados em ordem; cada um espera o anterior terminar:
`npcSpawn`, `npcWalk`, `npcAnim` (extras do NPC: acenar, segurando_chaves...), `npcFace`, `npcLeave`, `playerWalk`, `playerFace`,
`dialogue` (espera a fala fechar), `enter` (fade para outro mapa levando a personagem e NPCs), `showItem` (item grande no centro), `giveItem`, `wait`.
A história dispara com `{ "script": "scr.id" }`; ao terminar, flag `seen.scr.id`.
NPCs: folha 32x64, `walk` (linha por direção), `extras` (quadros), `portrait` (aparece nas falas com `"npc": "npc.id"`).
A vassoura fica em `data/tools.json` (quadros, ponto do cabo, tempo de varrer).
Itens podem ter `iconImage` (ex.: a chave), `kind: "tool"` (não se compra nem se devolve) e `carrySprite` (quadro de `data/emotes.json` desenhado acima da cabeça dela enquanto tiver o item; ex.: a caixa de uma entrega).

## Mundo (`data/world.json`)

```jsonc
{
  "schemaVersion": 1,
  "startMap": "map.street",
  "homeMap": "map.cafe_main",
  "season": "winter",                                  // estação atual (escolhe as cores do dia/noite)
  "morning": { "map": "map.street", "spawn": [16, 9] }, // onde ela aparece de manhã, vindo de casa
  "sleepMap": null,                                     // onde dorme; null = em casa, fora do mapa
  "goHomeDoors": ["door.street"],                       // portas do café onde ela pode encerrar o dia
  "dailyDirt": 2                                        // poeiras (tag "daily") que voltam a cada manhã
}
```

`startMap`: onde um jogo novo começa. `homeMap`: o café, único mapa onde dá para decorar e reformar.
`sleepMap` é o ponto de extensão para o quartinho do café: hoje o fim do dia mostra "Você foi para casa." e ela amanhece em `morning`.

## Dia e noite (`data/daynight.json`)

```jsonc
{
  "schemaVersion": 1,
  "minutesPerSecond": 1.2,     // minutos de jogo por segundo real (um dia ≈ 16 min; o relógio para só em falas, cenas e transições)
  "dayStart": "07:00",         // hora em que ela chega de manhã
  "passOut": "26:00",          // 2h da madrugada: ela desmaia de sono e o dia acaba
  "goHomeFrom": "17:00",       // a partir daí, a porta do café pergunta se ela quer encerrar o dia
  "wakeAfterPassOut": "10:00", // se desmaiou, o dia seguinte começa mais tarde
  "indoorStrength": 0.35,      // mapas "indoor" recebem só 55% da cor
  "keyframes": [{ "time": "07:00", "color": "#ffe8d0" }, { "time": "12:00", "color": "#ffffff" }],
  "seasons": { "winter": { "keyframes": [...] } }   // troca as horas-chave numa estação (inverno: escurece cedo e mais frio)
}
```

A cor do momento é interpolada entre as horas-chave (`src/core/time.ts`, `tintAt`) e pintada em MULTIPLY sobre o mundo.
Horas depois da meia-noite usam 24+ (`"26:00"`). Cores pedidas: manhã `#ffe8d0`, meio-dia `#ffffff`, tarde `#ffd9a8`, entardecer `#c9a0c8`, noite `#4a5a9a` (nunca preto puro).

No mapa: `"lighting": "outdoor" | "indoor"` e `"lights": [{ "at": [x, y], "radius": 46, "color": "#ffe2a0" }]`
(posição em células, pode ter fração; raio em pixels). As luzes brilham com ADD e acendem conforme escurece.

## Folhas extras de tiles (`data/tilesets.json`)

Cada folha nova (rua, neve, sujeira) aponta para a imagem em `public/` e para um JSON de peças em `data/tilesets/`
(`col`, `row`, `w_tiles`, `h_tiles`). Os nomes no catálogo ganham um prefixo (`street_`, `facade_`, `prop_`, `snow_...`, `dirt_`).
`layer` e `solid` valem para a folha toda; `overrides` muda peças específicas. Fachadas são camada `wall` (fundo, sólidas na base).

## Reforma: superfícies (no mapa) e acabamentos (`data/finishes.json`)

O mapa lista as **superfícies** que o pintor pode trocar. Cada uma é uma letra da legenda: todas as células com essa letra mudam juntas.

```jsonc
// em data/maps/cafe_main.json (campo opcional)
"surfaces": [
  { "id": "surface.hall_floor", "name": "Piso do salão", "legend": "M", "kind": "floor" },
  { "id": "surface.wallpaper", "name": "Papel de parede", "legend": "P", "kind": "wall" }
]
```

Os **acabamentos** são o que o pintor vende. `kind` diz em que superfície serve (`floor`, `wall`, `wainscot`).

```jsonc
{
  "schemaVersion": 1,
  "finishes": [
    { "id": "finish.wood_planks", "name": "Tábuas de madeira", "tile": "floor_wood_b", "kind": "floor", "price": 60 }
  ]
}
```

Sem reforma, a superfície usa o tile da legenda (o velho). O `npm run check` confere letras, camadas dos tiles e IDs.

## Economia (`data/economy.json`)

```jsonc
{ "schemaVersion": 1, "startingMoney": 150, "currency": "moedas" }
```

## História (`data/story.json`)

A história é uma lista de **marcos** (`beats`). Cada marco tem uma condição e efeitos: *quando X, faça Y*.

```jsonc
{
  "schemaVersion": 1,
  "beats": [
    {
      "id": "story.first_seats",          // estável, começa com "story."
      "act": 1,
      "after": ["story.warm_corner"],     // só começa depois destes
      "goal": {                           // meta mostrada no diário enquanto o marco está ativo
        "title": "Um lugar para sentar",
        "steps": [
          { "text": "Coloque uma mesa", "when": { "placedTag": "table" } },
          { "text": "Coloque duas cadeiras", "when": { "placedTag": "chair", "gte": 2 } }
        ]
      },
      "when": { "money": { "gte": 0 } },  // opcional: condição extra
      "effects": [{ "dialogue": "dlg.neighbor_visit" }, { "setFlag": "met.old_neighbor" }, { "addMoney": 50 }]
    }
  ]
}
```

Cada passo pode ter `"devNote"`: nota para a equipe, que só aparece no modo debug e é removida do build de produção. Nunca escreva bastidores ("no próximo marco", "TODO") no `text`; o `npm run check` acusa.

Um marco termina quando todos os `after` estão concluídos, todos os passos da meta valem e o `when` vale. Marcos concluídos nunca voltam atrás.

Campos de ordem (v6):
- `"start"`: condição para o marco **começar** (aparecer no balão). Ex.: `{ "nextDay": "story.coffee_machine" }` (só no dia seguinte).
- `"exclusive": true`: enquanto o marco estiver ativo, os seguintes do arquivo não começam (uma quest por vez, nos primeiros dias). Marcos sem a flag correm em paralelo: é assim que a fase seguinte vai ter várias quests ao mesmo tempo, só mudando os dados.

Condições (também `{ "visited": "map.id" }`, `{ "catNamed": "cat.id" }`): `{ "all": [...] }`, `{ "any": [...] }`, `{ "not": ... }`, `{ "flag": "id" }`, `{ "beat": "story.id" }`,
`{ "placed": "item.id", "gte": n }`, `{ "placedTag": "tag", "gte": n }`, `{ "owned": "item.id", "gte": n }`, `{ "money": { "gte": n } }`.

Os efeitos são aplicados antes do evento `story.beat_completed`, para a interface saber que uma fala abriu e segurar o dinheiro e o diário até ela acabar.

Condições do relógio e do lugar: `{ "day": { "gte": 2 } }`, `{ "clock": { "gte": "08:30" } }`, `{ "location": "map.cafe_main" }` (o relógio reavalia a história a cada minuto de jogo), `{ "nextDay": "story.id" }` (o marco terminou num dia anterior), `{ "timer": "gabi.arrival" }` (o relógio marcado chegou), `{ "ownedTag": "table", "gte": 2 }` (itens com a tag, na bolsa ou posicionados). `owned` e `ownedTag` contam também o que já foi **encomendado** pelo correio. `{ "received": "item.id" }`: só o que já chegou e foi aberto. `{ "delivery": "item.id", "stage": "door" | "carried" | "inside", "gte": 1 }` e `{ "deliveryTag": "table", "stage": "door", "gte": 2 }`: a entrega já chegou àquela etapa (abertas contam).

Efeitos: `{ "endDay": true }` (fim do dia), `{ "setTime": "08:00" }` (acerta o relógio), `{ "startTimer": "gabi.arrival", "minutes": 90 }` (marca um relógio; um passo com `{ "timer": ... }` mostra o botão "Esperar" e o texto pode usar `{timer:gabi.arrival}` para a hora), `{ "shelterCat": "cat.id" }` (abriga e abre a caixa de nome), `{ "giveItem": "item.id" }`, `{ "cutscene": "cs.id" }`, `{ "dialogue": "dlg.id" }`, `{ "setFlag": "id" }`, `{ "addMoney": n }`.

## Falas (`data/dialogue.json`)

```jsonc
{
  "schemaVersion": 1,
  "dialogues": {
    "dlg.intro": { "lines": [{ "speaker": "", "text": "Dezembro..." }, { "speaker": "Você", "text": "..." }] }
  }
}
```

`speaker` vazio = narração (aparece em itálico). `{cat:cat.id}` no texto vira o nome que a jogadora deu ao gato.

## Corações (`data/relationships.json`)

`pointsPerHeart`, `maxHearts` e `feedPoints` (pontos ao comer da tigela). Os pontos ficam no save em `relationships`, por par (`"player|cat.first_stray": 120`); os corações são calculados. Serve para gato, vizinho, cliente e NPC↔gato.

## Textos da interface (`data/ui_text.json`)

Dicas, seções do catálogo e mensagens de erro. Ficam em dados para facilitar uma tradução futura.

## Save

```jsonc
{
  "schemaVersion": 5,
  "savedAt": "2026-12-01T10:00:00Z",
  "day": 3,
  "time": 1050,                                      // v5: minutos desde 00:00 (17:30)
  "money": 120,
  "flags": { "met.old_neighbor": true },
  "inventory": { "item.cushion_pink": 1 },           // comprados e não posicionados
  "placed": [{ "uid": "p1", "item": "item.cat_bed", "at": [12, 9] }],
  "nextUid": 2,                                      // uids nunca se repetem
  "story": { "completed": ["story.intro"] },
  "cats": {
    "cat.mimi": { "sheltered": true, "affection": 4 }
  },
  "finishes": { "surface.hall_floor": "finish.wood_planks" },  // v2: reforma do pintor
  "cats": { "cat.first_stray": { "sheltered": true, "name": "Pipoca", "map": "map.cafe_main" } },  // v4
  "relationships": { "player|cat.first_stray": 120 },                                     // v4
  "location": "map.street",                                  // v3: onde a personagem está
  "visited": ["map.street", "map.cafe_main"],                 // v3: mapas onde já entrou
  "cleaned": ["dirt.web_window_left"],                        // v3: sujeiras já limpas ("*" = todas)
  "hotbar": { "slots": ["item.broom", null, null, null, null, null, null, null], "active": 0 }  // v10: barra de itens
}
```

Histórico de versões: **v1** (primeiro save) -> **v2** (entra `finishes`; o migrador põe `{}`) -> **v3** (entram `location`, `visited`, `cleaned`; saves antigos ficam dentro do café, já limpo) -> **v4** (`cats` com nome e mapa; `relationships`) -> **v5** (`time`, hora do dia; saves antigos ficam às 8h) -> **v6** (`story.completedOn`, `timers`, `today`, `jobs`, `cats[].fedOn`) -> **v7** (`deliveries`: compras do catálogo pelo correio) -> **v8** (`menu`, `pantryOpen`, `dishes`, `hands`, `surfaces`, `service`: atendimento) -> **v9** (`tray`, `sink`, etapas de preparo e preferências) -> **v10** (`hotbar`: 8 espaços com IDs de itens e o espaço ativo; o migrador põe a barra vazia e a vassoura entra sozinha ao abrir). Fixtures: `tests/fixtures/save_v1.json` a `save_v10.json`.

Barra de itens (`src/core/hotbar.ts`): vão para a barra itens da mochila que não são móveis nem fixos. Ferramenta (`kind: "tool"`) entra sozinha no primeiro espaço livre. Item que acabou deixa o espaço vazio na tela. `world.tools.sweep` diz qual item precisa estar no espaço ativo para varrer sujeira e neve (sem ele: `needs_broom`).

Regras:
- Hoje o save fica no `localStorage`, via `src/platform/`: slots `biscuit-paws:slot1..slot3` (manuais) e `biscuit-paws:auto` (autosave), cada um com backup da versão anterior em `<slot>.bak`; `auto.origin` (de qual slot manual veio o autosave) e `current-slot`. O modo debug usa os mesmos nomes com prefixo `debug-`. `?novo` na URL começa um jogo novo no slot 1 (pula a Home); `?jogar` continua o mais recente.
- Quando grava: autosave a cada mudança (no máximo 1 a cada 1,5 s, e na hora de fechar a página); o slot manual no fim de cada dia e no "Salvar" da pausa. A versão do save continua no campo `schemaVersion` (decisão: não renomear para `saveVersion`).
- Save corrompido não trava: a tela de saves mostra "corrompido" e oferece restaurar o backup ou apagar. Importar (arquivo .json) passa pela mesma validação e migrações (`src/core/saveSlots.ts: readSave`).
- Só IDs e números/booleanos/strings simples.
- Mudou algo: suba `schemaVersion`, escreva `migrate_vN_to_vN+1`, guarde um fixture da versão antiga em `tests/fixtures/`.
- IDs que sumirem dos dados de conteúdo não podem quebrar o carregamento: ignore e registre um aviso.

## Receitas (`data/recipes.json`)

```jsonc
{ "id": "recipe.black_coffee", "name": "Café preto", "icon": "cafe_preto", "ingredients": { "item.coffee_ground": 1, "item.paper_filter": 1 } }
```

Ainda sem mecânica de preparo: os ingredientes são itens `consumable` com a tag `ingredient` (vendidos no mercado, em seções pela tag `coffee`, `tea`, `fruit`, `pantry`; títulos em `ui_text.shop.sections`).

## Ícones (`data/icons.json`) e balões (`data/emotes.json`)

Ícone: `{ "col": 0, "row": 0, "sheet": "materia_prima" }`; sem `sheet`, usa a folha padrão (`image`). Folhas extras em `sheets`.
Balões 16x16 (`exclamation`, `heart`, `plus1`) usados nos roteiros: `{ "emote": "npc.joca" | "player" | "cat.id", "balloon": "heart", "ms": 1100 }`.
Outros passos de roteiro: `{ "catWalk": "cat.id", "to": [11, 5] }` (o gato vem e senta) e `{ "npcToCat": "npc.joca", "cat": "cat.id" }` (o NPC vai até o lado do gato).
Itens `kind: "gift"`: presentes da história (ex.: `item.dishes_set`, da Gabi); não se compram nem se devolvem.
Celular em ligação: passo `{ "type": "phone", "mode": "call", "app": "Gabi", "title": "chamando...", "caller": "npc.gabi", "lines": [] }`.

## Pedidos da vila (`data/jobs.json`) e jornal (`data/news.json`)

```jsonc
{
  "maxActive": 1,                         // quantos pedidos ao mesmo tempo
  "points": [
    { "id": "pt.snow_1", "map": "map.street", "at": [7, 8], "action": "sweep", "marker": "snow_monte_neve" },
    { "id": "pt.parcel_pickup", "map": "map.market", "at": [18, 7], "action": "press", "gives": "item.parcel" }
  ],
  "jobs": [
    {
      "id": "job.clear_snow", "title": "Tirar a neve da calçada", "giver": "Loja de Móveis",
      "description": "...", "location": "map.street", "reward": 30,
      "repeat": "daily",                    // daily: uma vez por dia; once: uma vez no jogo
      "available": { "beat": "story.prologue_end" },
      "steps": [{ "text": "Varrer 3 montes de neve...", "points": ["pt.snow_1", "pt.snow_2", "pt.snow_3"] }]
    }
  ]
}
```

Ponto: `press` (E ou clique de perto) ou `sweep` (varre com a vassoura). `marker`: tile desenhado enquanto o ponto está pendente. `sprite`: quadro de `data/emotes.json` desenhado no chão do ponto no lugar do "!" (ex.: a caixa para pegar no estoque). `gives`/`takes`: item recebido/entregue (itens com a tag `job` somem no fim do dia). Os passos vão em ordem; os pontos de um passo, em qualquer ordem. Pedido pela metade não passa para o dia seguinte. O `npm run check` exige que todo ponto (ou um vizinho dele) seja alcançável a pé a partir do spawn do mapa: cuidado com dois objetos sólidos que só se tocam na diagonal, porque eles fecham a passagem.
Aceitar: no celular (tecla P, app "Vila Hoje") ou no mural do mercado (interação `{ "action": { "board": true } }`).

Jornal: `{ "id": "news.x", "headline": "...", "text": "...", "day": 2 }` (fixa num dia) ou `"fromDay": 4` (sorteio: uma por dia, sempre a mesma para aquele dia).

## Rotina do dia

Depois do prólogo, o balão mostra "hoje": comida para cada gato do café (uma vez por dia; `cats[].fedOn`) e a poeira que voltou (sujeiras com a tag `daily`, `world.dailyDirt` por manhã). O fim do dia (`day.ended`) leva o resumo: moedas ganhas (sem devoluções), pedidos feitos e os corações dos gatos.

## Correio (`data/delivery.json`)

```jsonc
{
  "minutes": 60,                       // o pedido chega 1 hora (de jogo) depois
  "from": "09:00", "until": "18:00",   // horário do correio; fora dele, chega amanhã às 09:00
  "maxPending": 3,                     // caixas a caminho + na porta; depois disso o catálogo pede para retirar
  "door": { "map": "map.street", "at": [15, 8] },   // pilha na porta do café (rua)
  "inside": { "at": [15, 4] },                     // pilha dentro do salão
  "carrier": "npc.mail_carrier",
  "van": { "left": "assets/vehicles/furgao_esquerda.png", "right": "assets/vehicles/furgao_direita.png" }
}
```

Compra no catálogo = encomenda: desconta na hora, a caixa chega na porta (o furgão e a entregadora aparecem se ela estiver na rua). Etapas: `shipping` -> `door` (E perto da pilha: pega todas) -> `carried` (caixas na cabeça) -> `inside` (ao entrar no café) -> abrir (E na pilha do salão): o item vai para a bolsa e, se for móvel, já para a mão. Compras no caixa do mercado continuam na hora.

## Atendimento (Fase 1): receitas, cardápio, mãos e louça

`data/recipes.json` (schemaVersion 2):

```jsonc
{
  "id": "recipe.black_coffee", "name": "Café preto", "icon": "cafe_preto",
  "ingredients": { "item.coffee_ground": 1, "item.paper_filter": 1 },   // doses
  "equipment": "coffee_machine",        // chave em service.json: equipment (cafeteira, bule, liquidificador)
  "vessel": "cup",                      // cup (xícara), glass (copo), plate (prato)
  "service": "standing",                // standing: em pé no balcão (xícara/copo); table: mesa + cadeira + prato
  "prepMinutes": 10, "price": 12,
  "unlock": { "flag": "recipe.cafe_latte" }   // opcional: condição para aparecer no quadro
}
```

`data/service.json`: `menuSlots` (4), `maxCustomers` (6), horário (`open`), chegada (`firstArrivalMinutes`, `arrivalEveryMinutes`), `patienceMinutes`, `consumeMinutes`, `enabledWhen` (condição: depois das cadeiras, com cafeteira + mesa + cadeira; ou `cafe.open`), `queue` (células da fila), `sink` (pia), `equipment` (chave -> tag do móvel), `standingTag` (`bar`: balcões onde o cliente fica em pé), `tableTag`, `chairTag`, `surfaceTags`, `vessels` (nome e ícone), `customerTints` (clientes provisórios).

`data/carry.json`: `carryCapacity` (1 na Fase 1) e `speedPenaltyPerItem`.

Itens: `servings` (doses por pacote; pó de café 10) e `dishes` (conjunto de louça: `item.dishes_set` = 2 xícaras + 2 copos + 2 pratos, 6 no total).

Regras:
- **Esgotado**: falta equipamento posicionado, dose de ingrediente ou louça limpa livre. Aparece no quadro e não é pedido.
- **Capacidade** = mínimo entre `maxCustomers` e a louça que não está suja (limpa + em uso).
- **Ciclo**: cliente chega (em pé na frente de um balcão `bar`, ou na fila) e pede algo do quadro -> E no equipamento prepara o pedido mais antigo (barra de progresso; ingredientes e louça saem quando fica pronto) -> E pega -> E perto do cliente entrega (ele paga) -> consome -> deixa a louça suja no balcão (ou na mesa) -> E pega -> E na pia lava (volta para o estoque limpo).
- **Mãos x mochila**: mochila = `inventory` (abstrato, tecla I). Mãos = `hands` (bebida, louça suja, item como petisco). Soltar: balcão, mesa, equipamento ou chão livre, ao lado dela, uma coisa por célula.

Condições novas: `{ "menu": { "gte": 1 } }` (receitas no quadro), `{ "served": { "gte": 1 } }` (clientes atendidos).

Arte do atendimento (`data/service_art.json`, só a interface usa): quadro do cardápio por número de slots (imagem + posição do ícone e do preço de cada slot), véu e marca de esgotado, balão do pedido (normal, impaciente abaixo de `impatientBelow` da paciência, furioso abaixo de `furiousBelow`; ícone no `iconSlot`), balão "aguardando" (fila), barra de progresso (9 quadros), moeda e louça 16x16 no mundo (linha por louça, coluna limpa/cheia/suja). Os arquivos vêm de `scripts/import-fluxo.ts`. Clientes: `service.json: customerLooks` (NPCs `npc.customer_01..10`).

Móveis em cima de outros: `"placeOn": "bar"` no item (cafeteira, bule, liquidificador, fogão, forno) — só pode ser posicionado numa célula com um balcão (tag `bar`) livre; é desenhado `world.counterLift` pixels acima (no tampo). O balcão com algo em cima não pode ser recolhido e não vira lugar de cliente em pé. Sem nenhum balcão livre, o item nem vai para a mão: fica na mochila com um aviso.

## Home, textos, som e configurações

- `data/game.json`: `title` (o nome mostrado na Home) e `locale`.
- `data/i18n/pt-BR.json`: textos da Home, saves, opções, créditos e pausa. Outro idioma: outro arquivo com as mesmas chaves (`t("home.continue")`, com `{nome}` para valores).
- `data/audio.json`: dois canais, `music` e `ambient`; cada faixa tem `file` (caminho em public/, `null` = ainda sem arquivo: o canal fica pronto e mudo) e `loop`. `scenes`: música e ambiente da Home e de cada mapa. `fadeMs`: transição.
- Configurações de som (`biscuit-paws:settings`, à parte do save, valem para todos os slots): `{ version, music: { on, volume }, ambient: { on, volume } }`. Aplicadas já na Home. O áudio só toca depois do primeiro toque/clique (o navegador exige).
