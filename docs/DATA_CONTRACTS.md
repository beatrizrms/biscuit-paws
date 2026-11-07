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
- `kind`: `furniture` (padrão; vai para o catálogo e precisa de `tile`), `consumable` (ração, remédio) ou `key` (não se compra nem se devolve).
- `price`: preço de compra, em moedas (inteiro).
- `tile`: nome no catálogo de tiles. A camada do tile (`floor`, `wall`, `object`) decide onde o móvel pode ficar.
- Tags usadas hoje: `for:cats`, `for:guests`, `decor` (seções do catálogo, definidas em `data/ui_text.json`) e `table`, `chair` (contadas pela história).

### Campos opcionais do mapa (rua, portas)

```jsonc
{
  "background": "#a9d4ea",                 // cor atrás do mapa (o céu da rua)
  "layers": { "floor": [...], "walls": [...], "overlay": [...] },   // overlay: por cima do piso (neve na calçada)
  "objects": [
    { "id": "obj.bench", "tile": "prop_banco", "at": [5, 8], "overlay": "snow_prop_banco" }   // neve por cima, mesmo tamanho
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
Itens podem ter `iconImage` (ex.: a chave) e `kind: "tool"` (não se compra nem se devolve).

## Mundo (`data/world.json`)

```jsonc
{ "schemaVersion": 1, "startMap": "map.street", "homeMap": "map.cafe_main" }
```

`startMap`: onde um jogo novo começa. `homeMap`: o café, único mapa onde dá para decorar e reformar.

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

Condições (também `{ "visited": "map.id" }`, `{ "catNamed": "cat.id" }`): `{ "all": [...] }`, `{ "any": [...] }`, `{ "not": ... }`, `{ "flag": "id" }`, `{ "beat": "story.id" }`,
`{ "placed": "item.id", "gte": n }`, `{ "placedTag": "tag", "gte": n }`, `{ "owned": "item.id", "gte": n }`, `{ "money": { "gte": n } }`.

Os efeitos são aplicados antes do evento `story.beat_completed`, para a interface saber que uma fala abriu e segurar o dinheiro e o diário até ela acabar.

Efeitos: `{ "endDay": true }` (fim do dia), `{ "shelterCat": "cat.id" }` (abriga e abre a caixa de nome), `{ "giveItem": "item.id" }`, `{ "cutscene": "cs.id" }`, `{ "dialogue": "dlg.id" }`, `{ "setFlag": "id" }`, `{ "addMoney": n }`.

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
  "schemaVersion": 3,
  "savedAt": "2026-12-01T10:00:00Z",
  "day": 3,
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
  "cleaned": ["dirt.web_window_left"]                         // v3: sujeiras já limpas ("*" = todas)
}
```

Histórico de versões: **v1** (primeiro save) -> **v2** (entra `finishes`; o migrador põe `{}`) -> **v3** (entram `location`, `visited`, `cleaned`; saves antigos ficam dentro do café, já limpo) -> **v4** (`cats` com nome e mapa; `relationships`). Fixtures: `tests/fixtures/save_v1.json` a `save_v4.json`.

Regras:
- Hoje o save fica no `localStorage` (chave `biscuit-paws:slot1`), via `src/platform/`. Abrir o jogo com `?novo` na URL começa um jogo novo.
- Só IDs e números/booleanos/strings simples.
- Mudou algo: suba `schemaVersion`, escreva `migrate_vN_to_vN+1`, guarde um fixture da versão antiga em `tests/fixtures/`.
- IDs que sumirem dos dados de conteúdo não podem quebrar o carregamento: ignore e registre um aviso.
