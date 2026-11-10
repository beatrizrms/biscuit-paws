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

Opcional: `arrivesSick: true` (já chega doente; ver Saúde).

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
    { "id": "obj.chalkboard", "tile": "prop_lousa_cafe", "at": [16, 8], "when": { "all": [{ "business": "inaugurated" }, { "received": "item.cafe_sign" }] } }  // só depois da inauguração
  ],
  "doors": [
    { "id": "door.cafe", "at": [17, 8], "to": "map.cafe_main", "spawn": [14, 4], "facing": "down" }
  ]
}
```

Porta: andar **para cima** na célula `at` leva ao mapa `to`, na célula `spawn`. Opcional: `"intercept": { "when": condição, "cutscene": "cs.id" }` ou `{ "when": condição, "script": "scr.id" }` (em vez de atravessar, mostra a cena, ex.: o gatinho na porta, ou roda um roteiro no mundo, ex.: a clínica que inaugurou, que leva para dentro com o passo `enter`; o roteiro marca `seen.scr.id` no fim, e a condição costuma usar isso para não repetir), `"requires"` (condição, ex.: `{ "owned": "item.key_bakery" }`), `"locked"` (fala mostrada quando trancada) e `"hours"` (estabelecimento: `{ name, days: [7, segunda a domingo], open, close }`; fora do horário não entra, o intercept não roda e sai o evento `door.closed` com quando abre; quem já está dentro termina; trancada pela história, vale a fala de trancada). Depois de passar, só outra porta funciona quando a seta para cima for solta.
Pisos marcados como sólidos (asfalto, água) bloqueiam como paredes.

### Sujeira do café (`dirt`, no mapa)

```jsonc
"dirt": [
  { "id": "dirt.web_window", "tile": "dirt_teia_janela", "at": [10, 0], "tags": ["web"] },
  { "id": "dirt.stain_water", "tile": "dirt_mancha_agua", "at": [4, 1], "tags": ["stain"], "clearedBy": "surface.wallpaper" }
]
```

Sem `clearedBy`: sai com faxina (clique, a até 2 células da personagem; fica em `cleaned` no save). Com `clearedBy`: só some quando aquela superfície tem acabamento novo (o reparo interno faz isso em todas). Com `when` (condição): só aparece a partir dela e fica fora do "tudo limpo" (`"*"`) dos saves antigos (ex.: `dirt.cat_poop`, o cocô do dia 2, até ser recolhido). Se a célula tiver um móvel da jogadora, ela vai para a célula livre mais próxima.
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
No mapa, `"interactions"`, com tecla **E** perto (até `reach` células) ou clique na célula:
- `{ "shelf": "shop.market", "tags": ["pet"] }`: **prateleira**. Mostra os itens da loja com essas tags, com `+`/`−` para pôr no **carrinho**. Nada é cobrado.
- `{ "shop": "shop.market" }`: **caixa**. Mostra o carrinho, o total de itens e de moedas, o dinheiro dela e o botão de pagar. Sem dinheiro, avisa quanto falta (o botão fica desligado) e dá para tirar itens ali.

Carrinho (`src/core/cart.ts` + `session.addToCart/removeFromCart/checkout`): a compra é tudo ou nada, no caixa. Ferramenta e peça fixa: 1 só; saco pesado: 1 por compra (vai para as mãos, que precisam estar livres). O carrinho **fica** ao sair do mercado (dá para buscar dinheiro e voltar; o HUD lembra "Carrinho: n · total"), **esvazia ao dormir** e **não vai para o save** (nada foi pago). Eventos `cart.changed` e `cart.checked_out`; cada unidade paga também emite `item.bought`.
Portas aceitam `"direction"` (padrão `up`): a saída do mercado é `down` (a frente do cômodo é aberta).

## Roteiros e NPCs (`data/scripts.json`, `data/npcs.json`)

Roteiro = lista de passos executados em ordem; cada um espera o anterior terminar:
`npcSpawn`, `npcWalk`, `npcAnim` (extras do NPC: acenar, segurando_chaves...), `npcFace`, `npcLeave`, `playerWalk`, `playerFace`,
`dialogue` (espera a fala fechar), `enter` (fade para outro mapa levando a personagem e NPCs), `showItem` (item grande no centro), `giveItem`, `wait`.
A história dispara com `{ "script": "scr.id" }`; ao terminar, flag `seen.scr.id`.
NPCs: folha 32x64, `walk` (linha por direção), `extras` (quadros), `portrait` (aparece nas falas com `"npc": "npc.id"`). Arte nova (PixelLab, `npm run npcs`): `resolution: 2`, quadros 112x128 (pessoas) ou 64x64 (o Joca). Clientes: `sit` (linha do sentado por direção, `sitFrames` quadros, padrão 3): na mesa, o cliente senta virado para a mesa e a cadeira do mapa fica por baixo (na cadeira de costas, por cima dele). Kits do import (`scripts/import-npcs.ts`): completo (caminhada, acenar, segurar), só caminhada, cliente (caminhada e sentado) e cachorro.
A vassoura fica em `data/tools.json` (quadros, ponto do cabo, tempo de varrer).
Itens podem ter `iconImage` (ex.: a chave), `kind: "tool"` (não se compra nem se devolve) e `carrySprite` (quadro de `data/emotes.json` desenhado acima da cabeça dela enquanto tiver o item; ex.: a caixa de uma entrega). `use` diz o que o item faz quando está ativo na barra: `"food_bowl"` (ração: encher a tigela; a escolhida, simples ou premium), `"litter_box"` (areia: pôr na caixa de areia) ou `"cat"` (petisco: dar ao gato). `description` (texto curto na prateleira, no Market e na mochila), `hue` (giro de cor em graus: o mesmo tile ou ícone com outra cor, como os sacos de 10 kg; nos ícones, `hue` em `data/icons.json`), `autoDays` (automático: guarda até tantos dias) e `upgrades` (upgrade de outro móvel: só vai em cima dele, que vira o novo no mesmo lugar e não volta para a mochila; ex.: o pote automático sobre a tigela comum). Tigela e caixa de areia (`src/core/petcare.ts`): uma porção de ração por dia serve todos os gatos do café; a caixa precisa de areia todo dia, e no fim de um dia sem areia limpa a higiene dos gatos cai mais `health.json: care.litterMissed`. Automáticos (pote de ração e caixa de areia, `autoDays: 10`): E com a ração/areia na barra guarda a da mochila (até o limite; outra ração só depois de acabar a de antes); no fim do dia, se ninguém encheu a tigela/trocou a areia, gastam uma; com 2 dias ou menos, avisa. O estoque fica no móvel (`placed[].stock`, `stockItem`; caixa comum: `refilledOn`). Itens com `use` entram sozinhos na barra, como as ferramentas. Tempos da animação de usar (ícone na mão, despejar, dar) em `data/tools.json: use`.

## Mundo (`data/world.json`)

```jsonc
{
  "schemaVersion": 1,
  "hintTimes": 3,                                       // tutorial: quantas vezes a dica "E" aparece em cada tipo de coisa
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
`sleepMap` é o ponto de extensão para dormir fora de casa (hoje quem faz isso é o porão reformado, pelo cômodo com `sleep`): hoje o fim do dia mostra "Você foi para casa." e ela amanhece em `morning`.

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

**Luz e sombra de ambiente** (`ambience`, `src/core/ambience.ts` + `src/game/AmbienceLayer.ts`): por cima da arte, sem mudar os PNGs. `shadowAlpha`, `shadowHeight`, `shadowWidth` (da largura da base desenhada): sombra de contato encostada na base desenhada de cada objeto no chão (medida nos pixels da arte, não na célula) (camada `object`, sem `lift`; inclui os móveis colocados) e, com `actorShadow.person` / `cat` (largura em px), embaixo de quem anda. `edgeSize`, `edgeAlpha`: faixa escura onde a parede (camada `walls` do mapa) encontra o piso, em cima e dos lados das paredes verticais. `windowTiles`, `windowLength` (células), `windowSkew` (px), `windowColor`, `windowAlpha`: luz quente das janelas no piso, só em mapas `lighting: indoor`, forte de dia e apagada à noite (segue o escuro da cor de fora). `vignetteAlpha`: escurecido nas bordas da tela. Tudo fica acima do piso e abaixo dos objetos.

## Folhas extras de tiles (`data/tilesets.json`)

Cada folha nova (rua, neve, sujeira) aponta para a imagem em `public/` e para um JSON de peças em `data/tilesets/`
(`col`, `row`, `w_tiles`, `h_tiles`). Os nomes no catálogo ganham um prefixo (`street_`, `facade_`, `prop_`, `snow_...`, `dirt_`).
`layer` e `solid` valem para a folha toda; `overrides` muda peças específicas. Fachadas são camada `wall` (fundo, sólidas na base).

## Reforma: superfícies (no mapa) e acabamentos (`data/finishes.json`)

O mapa lista as **superfícies** que o construtor pode trocar. Cada uma é uma letra da legenda. O acabamento da superfície vale para todas as células dela; uma obra por área (troca de acabamento) grava o acabamento por célula (`construction.cells` no save), por cima.

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

**Obras** (`finishes.json: construction`, `src/core/construction.ts`): `npc` (o construtor), `hoursPerTile`, `hoursPerDay`, `laborPerTile`, `materialPerTile` (por kind: floor, wall, wainscot), `repairs.inside` (`price`, `days`, `finishes`: superfície -> acabamento original novo, `site`: onde ele trabalha), `repairs.outside` (`price`, `days`, `site` com `map`), `facadeDays`, `tapeTile` (a fita da área isolada). Uma obra por vez; o `price` do acabamento só vale para a cor da fachada (as outras pagam por tile).

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
          { "text": "Coloque duas cadeiras", "when": { "placedTag": "chair", "gte": 2 } },
          // opcionais: detail (linha menor embaixo do passo da vez), icon (data/icons.json) e doses (o gato da
          // receita: o balão mostra as doses em bolinhas e "hoje: feito")
          { "text": "Dar o remédio para {cat:cat.first_stray}", "detail": "Uma dose por dia, até acabar a receita.", "icon": "remedio", "doses": "cat.first_stray", "when": { "flag": "vet.cured" } }
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
- `"start"`: condição para o marco **começar** (aparecer no balão). Ex.: `{ "nextDay": "story.coffee_machine" }` (só no dia seguinte). Também `{ "daysSince": { "beat": "story.backyard", "gte": 7 } }`: pelo menos 7 dias depois de o marco terminar.
- `"exclusive": true`: enquanto o marco estiver ativo, os seguintes do arquivo não começam (uma quest por vez, nos primeiros dias). Marcos sem a flag correm em paralelo: é assim que a fase seguinte vai ter várias quests ao mesmo tempo, só mudando os dados.

Condições (também `{ "visited": "map.id" }`, `{ "catNamed": "cat.id" }`): `{ "all": [...] }`, `{ "any": [...] }`, `{ "not": ... }`, `{ "flag": "id" }`, `{ "beat": "story.id" }`,
`{ "placed": "item.id", "gte": n }`, `{ "placedTag": "tag", "gte": n }`, `{ "owned": "item.id", "gte": n }`, `{ "money": { "gte": n } }`.

Os efeitos são aplicados antes do evento `story.beat_completed`, para a interface saber que uma fala abriu e segurar o dinheiro e o diário até ela acabar.

Condições do relógio e do lugar: `{ "day": { "gte": 2 } }`, `{ "clock": { "gte": "08:30" } }`, `{ "location": "map.cafe_main" }` (o relógio reavalia a história a cada minuto de jogo), `{ "nextDay": "story.id" }` (o marco terminou num dia anterior), `{ "timer": "gabi.arrival" }` (o relógio marcado chegou), `{ "ownedTag": "table", "gte": 2 }` (itens com a tag, na bolsa ou posicionados). `owned` e `ownedTag` contam também o que já foi **encomendado** pelo correio. `{ "received": "item.id" }`: só o que já chegou e foi aberto. `{ "delivery": "item.id", "stage": "door" | "carried" | "inside", "gte": 1 }` e `{ "deliveryTag": "table", "stage": "door", "gte": 2 }`: a entrega já chegou àquela etapa (abertas contam).

Efeitos: `{ "endDay": true }` (fim do dia), `{ "setTime": "08:00" }` (acerta o relógio), `{ "startTimer": "gabi.arrival", "minutes": 90 }` (marca um relógio; um passo com `{ "timer": ... }` mostra o botão "Esperar" e o texto pode usar `{timer:gabi.arrival}` para a hora), `{ "shelterCat": "cat.id" }` (abriga e abre a caixa de nome), `{ "giveItem": "item.id" }`, `{ "cutscene": "cs.id" }`, `{ "dialogue": "dlg.id" }`, `{ "setFlag": "id" }`, `{ "addMoney": n }`.

## Falas (`data/dialogue.json`)

**Gênero da protagonista:** escreva com o mínimo de gênero possível ("você", primeira pessoa, "Que cabeça a minha!" em vez de "Esquecida!"). Quando não dá, use `{g:feminino|masculino}` ("Bom dia, {g:querida|querido}!"): a forma vem do pronome escolhido no criador (`player.pronoun`, `src/core/pronoun.ts`). As formas são texto puro (sem outros marcadores dentro). Só vale em textos que passam por `fillNames` (`src/game/ui/text.ts`): hoje `dialogue.json`, `cutscenes.json` e `news.json`; o teste `tests/core/pronoun.test.ts` acusa marcador quebrado ou fora desses arquivos.

```jsonc
{
  "schemaVersion": 1,
  "dialogues": {
    "dlg.intro": { "lines": [{ "speaker": "", "text": "Dezembro..." }, { "speaker": "Você", "text": "..." }] }
  }
}
```

`speaker` vazio = narração (aparece em itálico). `{cat:cat.id}` no texto vira o nome que a jogadora deu ao gato.

## Saúde dos gatos e clínica (`data/health.json`)

Saúde de 0 a `max` (gato novo: `start`). No fim do dia: `daily.fed` se comeu, `daily.hungry` se não comeu (descuido), `daily.sickUntreated` a mais se está doente sem a dose do dia. Abaixo de `sickBelow` adoece: doença sorteada de `diseases` (fictícias, ids `disease.*`) e a saúde cai para `sickHealth`. `randomIllness`: chance por gato por dia de adoecer à toa, a partir de `fromDay` e só com a flag `requiresFlag` (`clinic.open`). Gato com `arrivesSick: true` em `cats.json` já chega doente. `contagion`: um gato doente há mais de `afterDays` dias (sem tratamento, se `onlyUntreated`) passa a mesma doença; no fim do dia, cada gato saudável do mesmo lugar pega com `chancePerDay` (evento `cat.infected`). `customers.stopAtSickCats`: com tantos gatos doentes, nenhum cliente novo entra no café (quem já está fica); a rotina "HOJE" avisa e a manhã começa com o evento `customers.away`. Efeito de história `{ "makeSick": "cat.x" }` adoece um gato (o dia 6). Sorteios com semente (dia + gato): `src/core/health.ts`.

Consulta (`session.consultQuote` / `consult`): na clínica (`clinic.map`), com o gato no colo e doente; receita de `prescription.minDays` a `maxDays` dias sorteados; custa `prices.consult` + `prices.medicinePerDay` por dia; o remédio (`medicine.item`, `use: "medicine"`) vai para a mochila (um por dia). `credit`: a primeira consulta sem dinheiro fica fiado (`state.debt`, flag `vet.credit_used`); `repayShare` de cada ganho paga a dívida. Dose (`medicateCat`): uma por dia, com o remédio ativo na barra; cada dose cura `medicine.healPerDose`; tomou todas, sara (flag `vet.cured`). Flags da história: `clinic.open`, `vet.consulted`, `vet.cured`.

Cuidados (`care`, `src/core/care.ts`): felicidade e higiene de 0 a `care.max` por gato (`cats[].happiness`, `cats[].hygiene`; gato novo: `care.start`). No fim do dia caem `care.daily`. Abaixo de `care.low`, um balão em cima do gato no café avisa (remédio, sujo, triste, nessa ordem; por enquanto é a única consequência). `care.bubbles[necessidade]`: a arte do balão, `{ icon }` (ícone da folha dentro do balão de pedido dos clientes, em meia escala) ou `{ emote }` (um balão pronto de `emotes.json`). `care.gains[jogo]`: quanto um mini game de cuidado com o gato (`params.catId`) sobe cada atributo, por resultado (`ok`, `great`); falhar ou pular não sobe. "Precisa de remédio" não é campo: é o gato doente com receita e a dose de hoje pendente.

Mapas podem ter `npcs` fixos (`[{ "npc": "npc.fernanda", "at": [13, 7], "facing": "up" }]`) e a interação `{ "action": { "vet": true } }` (a consulta).

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
  "finishes": { "surface.hall_floor": "finish.wood_planks" },  // v2: acabamento da superfície (reparo interno, cor da fachada)
  "construction": { "repaired": ["inside"], "quote": null, "job": null, "askPending": false, "cells": { "9,6": "finish.wood_planks" } },  // v25: obras
  "cats": { "cat.first_stray": { "sheltered": true, "name": "Pipoca", "map": "map.cafe_main" } },  // v4
  "relationships": { "player|cat.first_stray": 120 },                                     // v4
  "location": "map.street",                                  // v3: onde a personagem está
  "visited": ["map.street", "map.cafe_main"],                 // v3: mapas onde já entrou
  "cleaned": ["dirt.web_window_left"],                        // v3: sujeiras já limpas ("*" = todas)
  "hotbar": { "slots": ["item.broom", null, null, null, null, null, null, null], "active": 0 }  // v10: barra de itens
}
```

Histórico de versões: **v1** (primeiro save) -> **v2** (entra `finishes`; o migrador põe `{}`) -> **v3** (entram `location`, `visited`, `cleaned`; saves antigos ficam dentro do café, já limpo) -> **v4** (`cats` com nome e mapa; `relationships`) -> **v5** (`time`, hora do dia; saves antigos ficam às 8h) -> **v6** (`story.completedOn`, `timers`, `today`, `jobs`, `cats[].fedOn`) -> **v7** (`deliveries`: compras do catálogo pelo correio) -> **v8** (`menu`, `pantryOpen`, `dishes`, `hands`, `surfaces`, `service`: atendimento) -> **v9** (`tray`, `sink`, etapas de preparo e preferências) -> **v10** (`hotbar`: 8 espaços com IDs de itens e o espaço ativo; o migrador põe a barra vazia e a vassoura entra sozinha ao abrir) -> **v11** (`business`: `closed` | `soft_open` | `inaugurated`; o migrador põe `closed` e, ao abrir, a sessão passa para `soft_open` se o café já tem o mínimo) -> **v12** (`player`: `{ name, appearance }`; o migrador põe `{ name: "", appearance: null }` = sem nome e aparência padrão) -> **v13** (`cats[].shelteredOn`: dia em que o gato foi abrigado; `cats[].health` e `cats[].sickness` (`{ disease, since, treatment: { days, dosesGiven, lastDoseDay } | null }`); `debt`: o fiado da clínica. O migrador põe `shelteredOn: 1`, `health: 80`, `sickness: null` e `debt: 0`; doença que sumiu dos dados deixa o gato saudável, com aviso) -> **v14** (`rooms` e `doors`: estado de cada cômodo e passagem; só o que mudou do `initial` de `data/rooms.json`; o migrador põe `{}`) -> **v15** (`schedule`: horário de funcionamento escolhido no app Horário, `{ days: boolean[7], open, close }` (0 = segunda); `null` = o padrão de `service.json`; o migrador põe `null`, e formato quebrado ou fora das regras volta ao padrão). -> **v16** (`reputation`: `{ value, reached, log }`, a reputação felina; o migrador põe `null` e a leitura usa o `start` de `data/reputation.json`). -> **v17** (`fair`: `{ stage, day, done, lastSeason, heldOn }`, a feira de adoção; o migrador põe `null` e a leitura deixa parada). -> **v18** (`arrivals`: `{ active, queue, last, nextOn, seq, shelterPool }`; `catDefs`: definições dos gatos gerados (contam como gatos conhecidos ao carregar); `cats[].provisionalUntil` (provisório, café cheio); o migrador põe vazio) -> **v19** (`hintUses`: quantas vezes ela usou o E em cada tipo de coisa, para o tutorial da dica "E"; os tipos são as chaves de `ui_text.json: hints`; o migrador põe `{}` e o tutorial recomeça). -> **v20** (`cats[].happiness`, `cats[].hygiene`: cuidados, 0 a 100; o migrador põe 70 nos dois; valor quebrado some e a leitura usa `health.json: care.start`). -> **v21** (`player.pronoun`: `she` | `he`, escolhido no criador; o migrador põe `she`, como o jogo foi escrito até aqui). -> **v22** (`festivals`: `{ active: { id, stage: prep|scheduled, day, done, results } | null, last: { [id]: dia }, heldOn: { id, day } | null }` no lugar de `fair`; o migrador converte a feira em `fest.adoption_fair`; evento que sumiu dos dados é esquecido, com aviso). -> **v23** (`bestPhoto`: `{ pose, score, catIds, day } | null`, a melhor foto da foto perfeita; o migrador põe `null`; gato que sumiu sai da lista). (v24 e v25: veja `src/core/save.ts`.) -> **v26** (`pantry`: `{ [itemId]: pacotes }`, a despensa; as receitas usam as doses daqui e de `pantryOpen`; o migrador põe `null` e a leitura passa para a despensa os ingredientes (tag `ingredient`) que estavam na mochila, para o café não parar). Fixtures: `tests/fixtures/save_v1.json` a `save_v26.json`.

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

## Mini games (`data/minigames.json`)

`introMs` (instruções antes de começar), `skipRewardShare` (pular paga essa fração das moedas de "ok"). Cada jogo em `games.<id>`: `name`, `instructions`, `rewards` por dificuldade (`easy`/`normal`/`hard`: `{ ok, great }`; "fail" não paga) e `difficulties` com os parâmetros do jogo. Resultado (`src/core/minigame.ts`): `{ gameId, outcome: "fail" | "ok" | "great", score, coinsEarned, skipped }`; as moedas sempre vêm dos dados (`makeResult`), nunca da cena. `session.finishMiniGame(result, params)` paga e, com `params.jobPoint`, conta o ponto do pedido se não falhou (evento `minigame.finished`).

Gato em fuga (`chase`): `map` (arena: `data/maps/minigame_chase.json`, segue a estação como a rua), `catSpawn`, `spots` (células possíveis de esconderijo: `box`, `trash`, `bush`, `car`) e, por dificuldade, `timeSec`, `catSpeed`, `turnEveryMs`, `hideChance`, `hidingSpots`, `hideMs`, `noticeRadius`, `catchRadius`, `greatTimeShare`.

Pescaria (`fishing`): `fish` (tabela: `id`, `name`, `rarity` = junk/common/uncommon/rare/legendary, `speed` e `zone` em frações da barra, `value` = moedas extras, `item` = vai para a mochila, `icon` = quadro da folha de peixes) e `sounds` (efeitos de `data/audio.json`: `bite`, `catch`, `escape`). Por dificuldade: `timeSec`, `waitMs`, `biteWindowMs`, `rarityWeights`, `zoneScale`, `speedScale`, `progressGain`, `progressLoss`, `startProgress`, `lift`, `gravity`, `greatAccuracy` (fração do tempo dentro da zona). O resultado traz o `itemId` do peixe (a sessão põe na mochila) e o valor dele soma às moedas. Sorteio e física da barra: `src/core/fishing.ts`.

Latte art (`latte`): `patterns` (cada um: `id`, `name`, `lines` = linhas de pontos `[x, y]` de 0 a `guideSize`; padrão novo = outra entrada, sem código), `guideSize`, `cupCenter` (centro do café na arte da xícara), `guideScale`, `cupScale` (xícara na tela; 1 = o dobro da medida do pacote, para dar para desenhar), `milkWidth`. Por dificuldade: `timeSec`, `patterns` (quais sorteia), `tolerance`, `starAt` (nota mínima para 1, 2 e 3 estrelas), `tipPerStar` (gorjeta, soma às moedas) e `coverageWeight`. Nota (`src/core/latte.ts`): cobertura do contorno e precisão do traço; 0 estrelas = fail, 1-2 = ok, 3 = great.

Todo jogo pode ter `tutorial` (`{ "icon": "<icons.json>", "lines": [1 a 3 linhas] }`), mostrado na intro; sem `timeSec` na dificuldade, não há cronômetro.

Caça ao filhote (`kitten_hunt`): `map` + `view` (`[col, row, largura, altura]`: o pedaço da arena na tela fixa), `hideouts` (`{ id, kind, at }` em células), `hideoutKinds` (tipos com arte: caixa, lixeira, arbusto e carro do Gato em fuga; cesto, caixote e vaso provisórios), `heatRange` (células em que o calor chega a 0), `heat` (`{ min, label, color, rate }`: o nível da dica e o tom do miado), `sounds` (`hint`, `found`). Por dificuldade: `hideouts` (quantos aparecem), `tries`, `kittens` (`[mín, máx]`), `greatTries`, `timeSec` (opcional). Regra: `src/core/kittenHunt.ts`.

Entrega relâmpago (`delivery`): `map`, `start` e `goal` (células), `goalRadius` (px), `stunMs`, `graceMs`, `hitRadius` (`{ pedestrian, bike }`, px), `sounds` (`bump`, `arrive`), `items` (`{ id, name, icon, verb, decayPerSec, hitLoss }`: qualidade de 0 a 100) e `obstacles` (`{ kind: pedestrian|bike, path: [[c,r],[c,r]], speed }`: vai e volta). Por dificuldade: `obstacles` (quantas rotas, as primeiras), `speedScale`, `decayScale`, `timeSec` (opcional), `greatQuality` (0,5). O mini game pode ser aberto com `itemId` (id de um item de entrega) para escolher o pedido. Regra: `src/core/delivery.ts`.

Confiança do gato (`trust`): `map`, `view`, `catAt` (célula do gato), `treatItem` (item que vale um petisco a mais quando passado em `params.itemId`), `sounds` (`hiss`, `scare`, `trust` (ronronar em repetição), `treat`, `done`). Sem `timeSec`. Por dificuldade: distâncias (`startDistance`, `nearDistance`, `minDistance`), `approachSpeed`, `backSpeed`, tensão (`tensionRate`, `farTension`, `relaxRate`, `alertAt`, `hissAt`), confiança (`gainPerSec`, `movingGain`), sustos (`scareLoss`, `scarePushback`, `maxScares`, `scareCooldownMs`) e petiscos (`treats`, `treatGain`, `treatSec`, `treatCalm`). Regra: `src/core/trust.ts`.

Match de adoção (`adoption`, em `minigames.json` só nome, tutorial, sons e dificuldades `pairs` (3/4/5) e `okAt`). O conteúdo fica em **`data/adoption.json`**: `traits` (grupo -> valor -> nome na tela), `cats` (`{ id: "adopt.*", name, variant, traits: { personality, age, coat } }`), `families` (`{ id: "fam.*", name, description, scores: { "grupo.valor": pontos }, notes: { "grupo.valor": "porquê" } }`), `verdicts` (`goodAt`, `badAt`), `reputation` (`good`, `ok`, `bad`: por adoção) e `protectedCats` (gatos do café que nunca saem por adoção). Regra: `src/core/adoption.ts`; evento `cat.adopted` (`catId, verdict, leftCafe`). `adoption.json: fair`: `personalityFrom` (personalidade do gato do café -> jeito) e `defaultTraits`, para os gatos do café na mesa de uma feira. Gatos do café podem ter `adoptionTraits` em `cats.json`.

**Festivais** (`data/festivals.json`, regra em `src/core/festival.ts`; a feira de adoção é um deles): `festivals[]` com `id` (`fest.*`), `name`, `idea` (fala da protagonista quando o evento fica disponível), `unlockReputation` (limiar de `reputation.json`), `when` (condição das metas), `date` (`{ season, day, noticeDays }`: a ideia vem `noticeDays` antes, o evento é na data), `cooldownDays` (intervalo entre edições), `prep` (`{ points, daysAfter }`: pontos de `jobs.json` em qualquer ordem; o dia fica marcado `daysAfter` depois; sem `prep`, já fica marcado), `closePoint` (`{ point, tile }`: a placa, fecha o atendimento no dia), `decorations` (`{ point, tile }[]`: o tile aparece no mapa depois de feito, até o fim do dia), `activities` (`{ point, game }[]`, em ordem: o ponto precisa abrir o mini game `game`; com `adoption`, os gatos do café vão para a mesa), `rewards` (`{ coins, reputation }`, no fim) e `texts` (`prep`, `close`, `decor`, `activities: { game: texto }`: as linhas do balão). Eventos: `festival.started` (`festivalId`), `festival.progress` (`festivalId, step: prep|close|decor|ready, pointId`), `festival.scheduled` (`festivalId, day`), `festival.missed` (`festivalId, day`), `festival.finished` (`festivalId, results, coins, reputation, adopted`). Textos de interface em `ui_text.json: festival`.

**Foto perfeita** (`photo`, regra em `src/core/photo.ts`): `data/photo.json` com `arena` (onde os gatos andam, px lógicos), `frame` (`w`, `h` do visor), `poses` (`walk|sit|play|loaf|cute`: `name`, `anim` do Cosy Cats, `moment` 0 a 1, `weight`, `duration` [min, max] s), `cuteChance` e `scoring` (`moment`, `framing`, `pair`: somam 100). Em `minigames.json`, `photo.difficulties`: `cats` (1 ou 2), `shots`, `cuteWindow` (s), `speed`, `okAt`, `greatAt`. Os gatos vêm de `params.contestCats`. Resultado: `MiniGameResult.photo` (`pose`, `score`, `catIds`), guardado na atividade do festival (`results[].photo`) e, se for a melhor, em `bestPhoto`; evento `photo.best`.

**Concurso de fantasia** (`costume`, regra em `src/core/costume.ts`): `data/costume.json` com `slots` (`head|neck|back`: `name`, `anchor` em px do quadro de 32 do gato sentado de frente, `behind`), `colors` (`{ name, hex }`), `colorPairs`, `pieces` (`{ id: "costume.*", slot, name, shape, color, style, themes, unlockReputation? }`), `themes` (`{ id: "theme.*", name, tags }`), `scoring` (`theme`, `themeCap`, `color`, `style`, `variety`), `rivals` (`{ cat, owner }`) e `prizes` (moedas por colocação 1, 2, 3). Em `minigames.json`, `costume.difficulties`: `seconds` (0 = sem tempo), `rivals`, `rivalRange`. Parâmetros: `params.contestCats` (gatos do café) e `params.costumePieces` (ids liberados). Resultado: `MiniGameResult.contest` (`catId`, `theme`, `rank`), guardado na atividade do festival (`results[].contest`).

**Montar a feira** (`fair_setup`, regra em `src/core/fairSetup.ts`): `data/fair_setup.json` com `board` (`cols`, `rows`, `gate`: células do portão, `blocked`: o que já está no quintal), `items` (uma peça de cada tipo `table|carrier|pen|sign|treats`: `{ id: "fair.*", kind, name, size: [w, h], capacity?, tile?, topTile? }`; só caixa e cercadinho têm `capacity`; `tile` é a arte do catálogo, com a base embaixo da área da peça), `board.floor`, `board.gateFloor` e `board.decor` (`{ tile, at }`, só desenho; as células precisam estar em `blocked`), `scoring` (`housed`, `access`, `sign`, `treats`: pesos que somam 100; `signNear`, `treatsNear`: distâncias em células contando a diagonal, 0 = encostado), `visitors` (`max`, `families: [{ at, extra }]`) e `maxFamilies`. Em `minigames.json`, `fair_setup.difficulties`: `cats` (quantos levar), `stock` (peças por tipo), `okAt`, `greatAt` (pontos de 0 a 100). Resultado: `MiniGameResult.fairSetup` (`cats`, `visitors`, `extraFamilies`), guardado na atividade do festival (`festivals.active.results[].setup`); a mesa de adoção recebe os gatos escolhidos (`params.adoptCats`) e `params.extraFamilies`.

## Reputação felina (`data/reputation.json`)

`start` (jogo novo e saves antigos), `max` (100), `logSize` (registros de motivo guardados), `thresholds` (`{ id: "rep.*", at, name }`: ao passar subindo, evento `reputation.threshold_reached` uma vez). Quanto vale: `reputation` (`{ fail?, ok?, great? }`) em cada jogo de `minigames.json` e `reputation` (`good`, `ok`, `bad`) por adoção em `adoption.json`. Regra: `src/core/reputation.ts`; na sessão, `addReputation(amount, reason)` e `reputation()`; evento `reputation.changed`.

Pedido que abre um mini game: ponto com `"action": "minigame"` e `"minigame": { "id": "chase", "difficulty": "normal", "itemId"?: "..." }` (ex.: `job.runaway_cat`; `itemId`: o pedido da entrega ou o petisco da confiança).

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
      "repeat": "daily",                    // daily: uma vez por dia; once: uma vez no jogo; sporadic: só nos dias sorteados (com "chance": 0 a 1)
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
  "van": { "left": "assets/objects/vehicles/obj_van_left.png", "right": "assets/objects/vehicles/obj_van_right.png" }
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
  // a louça (vessel) diz onde é servida: service.json, servedAt
  "prepMinutes": 10, "price": 12,
  "unlock": { "served": { "gte": 25 } }   // opcional: condição para aparecer no quadro
}
```

Evolução das receitas: o café abre só com o café preto; as outras destrancam por clientes atendidos (`served`): chá preto 6, suco de laranja 15, latte 25, pão de queijo 35, chá verde 45, suco de morango 55, limonada 65, bolo 80. Ao destrancar, um aviso aparece uma vez (evento `recipe.unlocked`, flag `recipe.known.<id>`; na abertura de um save só marca, sem aviso). Equipamentos (tags de `service.json: equipment`) e ingredientes (tag `ingredient`) só aparecem no catálogo e no mercado quando alguma receita destrancada usa eles; ingrediente que nenhuma receita usa fica escondido.

`data/service.json`: `menuSlots` (4), `servedAt` (onde cada louça pode ser servida: xícara e copo `["standing", "table"]`, prato `["table"]`), horário (`schedule`: `default` com `days` (segunda a domingo), `open` e `close`; `earliest`/`latest`, `stepMinutes`, `minHours`: as regras do app Horário; fora do horário não entra cliente novo, a fila vai embora e quem já está no lugar termina; ela só encerra o dia quando o último cliente sair), chegada (`firstArrivalMinutes`, `arrivalEveryMinutes`), `patienceMinutes`, `shoppingListBelow` (lista de compras: ingrediente do cardápio com menos doses que isto, contando a troca premium, é anotado pelo botão do cardápio; save v24: `shoppingList`, IDs na ordem, somem no `item.bought`), `consumeMinutes`, `review` (avaliação ao sair, `src/core/review.ts`: `start`; `queue`, `seated` e `dirt` são faixas `{ over, minus }` (a maior alcançada tira `minus` estrelas; espera em fração da paciência gasta, sujeira em contagem); `gaveUp` (nota de quem desiste); `reputation` (`"1"` a `"5"`: reputação por nota); o evento `customer.left` leva `stars` e `reputation`), `enabledWhen` (`{ "business": "soft_open" }`: a partir do funcionamento parcial), `queue` (células da fila), `sink` (pia), `pantry` (a célula da frente do armário da cozinha, a despensa: E ali abre a despensa e guarda os ingredientes da mochila), `equipment` (chave -> tag do móvel), `standingTag` (`bar`: balcões onde o cliente fica em pé), `tableTag`, `chairTag`, `surfaceTags`, `vessels` (nome e ícone), `customerTints` (clientes provisórios).

`data/carry.json`: `carryCapacity` (1 na Fase 1) e `speedPenaltyPerItem`. Bandeja (`tray.item`): vale quando está **selecionada na barra de itens** (`service.syncTray`); com ela, leva até `tray.capacity` louças; sem ela, uma por vez. Com mais louça nas mãos do que cabe sem bandeja, ela só sai quando sobrar o que cabe. Gato ou saco pesado com as mãos vazias: larga a bandeja. No jogo, bandeja ou louça na mão aparecem sempre como a bandeja nas mãos com uma louça em cima (o número não aparece).

Itens: `servings` (doses por pacote; pó de café 10) e `dishes` (conjunto de louça: `item.dishes_set`, presente da Gabi = 6 xícaras + 6 copos + 6 pratos).

Regras:
- **Esgotado**: falta equipamento posicionado, dose de ingrediente ou louça limpa livre. Aparece no quadro e não é pedido.
- **Capacidade** (`src/core/capacity.ts`), sem teto fixo: cada cliente ocupa um lugar (em pé na frente de um balcão, ou cadeira junto de mesa) e uma peça de louça. Quem fica em pé só usa louça servida em pé (beber: xícara ou copo); quem senta usa qualquer uma servida na mesa (comer: prato só sentado). Louça contada por tipo: limpa + já servida (a suja não conta), só a das receitas do quadro (quadro vazio: toda). O resultado diz o total, o máximo em pé, o máximo sentado e se dá para comer; aparece no quadro do cardápio (M). Lotado, quem chega espera na fila.
- **Ciclo**: cliente chega (em pé na frente de um balcão `bar`, ou na fila) e pede algo do quadro -> E no equipamento prepara o pedido mais antigo (barra de progresso; ingredientes e louça saem quando fica pronto) -> E pega -> E perto do cliente entrega (ele paga) -> consome -> deixa a louça suja no balcão (ou na mesa) -> E pega -> E na pia lava (volta para o estoque limpo).
- **Mãos x mochila**: mochila = `inventory` (abstrato, tecla I). Mãos = `hands` (bebida, louça suja, item como petisco). Soltar: balcão, mesa, equipamento ou chão livre, ao lado dela, uma coisa por célula.

Condições novas: `{ "menu": { "gte": 1 } }` (receitas no quadro), `{ "served": { "gte": 1 } }` (clientes atendidos).

Arte do atendimento (`data/service_art.json`, só a interface usa): quadro do cardápio por número de slots (imagem + posição do ícone e do preço de cada slot), véu e marca de esgotado, balão do pedido (normal, impaciente abaixo de `impatientBelow` da paciência, furioso abaixo de `furiousBelow`; ícone no `iconSlot`; `scale`: tamanho no mundo; `patienceBar`: barra de paciência em cima do balão, encolhe até o cliente desistir, cor pelo humor), `dishIcons` (louça na mão e no balcão na arte nova: pedido pronto = ícone da receita, suja = `dirty[louça]`, `scale` = tamanho em relação ao ícone), `trayHand` (meio da bandeja em relação à mão, por direção), balão "aguardando" (fila), barra de progresso (9 quadros), moeda e louça 16x16 no mundo (linha por louça, coluna limpa/cheia/suja). Os arquivos vêm de `scripts/import-fluxo.ts`. Clientes: `service.json: customerLooks` (NPCs `npc.customer_01..10`).

Móveis em cima de outros: `"placeOn": "bar"` no item (cafeteira, bule, liquidificador, fogão, forno) — só pode ser posicionado numa célula com um balcão (tag `bar`) livre; é desenhado `world.counterLift` pixels acima (no tampo). O balcão com algo em cima não pode ser recolhido e não vira lugar de cliente em pé. Sem nenhum balcão livre, o item nem vai para a mão: fica na mochila com um aviso.

## Home, textos, som e configurações

- `data/game.json`: `title` (o nome mostrado na Home) e `locale`.
- `data/i18n/pt-BR.json`: textos da Home, saves, opções, créditos e pausa. Outro idioma: outro arquivo com as mesmas chaves (`t("home.continue")`, com `{nome}` para valores).
- `data/audio.json`: dois canais, `music` e `ambient`; cada faixa tem `file` (caminho em public/, `null` = ainda sem arquivo: o canal fica pronto e mudo) e `loop`. `scenes`: música e ambiente da Home e de cada mapa. `fadeMs`: transição.
- Configurações de som (`biscuit-paws:settings`, à parte do save, valem para todos os slots): `{ version, music: { on, volume }, ambient: { on, volume } }`. Aplicadas já na Home. O áudio só toca depois do primeiro toque/clique (o navegador exige).

## Negócio: estágios e inauguração (`data/business.json`)

```jsonc
{
  "schemaVersion": 1,
  "softOpenWhen": { "all": [{ "beat": "story.chairs" }, { "placed": "item.coffee_machine" }, { "placedTag": "table" }, { "placedTag": "chair" }] },
  "requiredSurfaces": ["surface.wallpaper", "surface.wainscot", "surface.hall_floor", "surface.counter_floor"]
}
```

- `state.business` (save v11): `closed` (fechado) -> `soft_open` (funcionamento parcial: atende com o mínimo e já ganha dinheiro, **sem placa**) -> `inaugurated` (com placa). Só avança: tirar a mesa depois não fecha o café. Evento `business.changed`.
- `closed` -> `soft_open`: sozinho, quando `softOpenWhen` vale (a sessão confere sempre que a história é reavaliada).
- `soft_open` -> `inaugurated`: efeito `{ "setBusiness": "inaugurated" }`, do marco `story.inauguration` (depois do primeiro cliente). As metas são: reforma completa (`{ "renovated": true }`: os dois reparos do construtor, interno e externo) e a placa recebida.
- A placa (`item.cafe_sign`) tem `"requires": { "renovated": true }`: só aparece à venda depois da reforma. Na fachada, a lousa só aparece inaugurado.
- Condições: `{ "business": "soft_open" }` (já chegou a esse estágio; inaugurado conta) e `{ "renovated": true }`.

## Personagem principal (`data/character.json`)

- Escolhida só no início do jogo: Novo jogo -> slot -> **Sua personagem** (nome obrigatório, até 14 letras; pronome ela/ele) -> prólogo. Não muda depois.
- **Manequim em camadas** (decisões 077, 083 e 087): o manequim do PixelLab (64 px por tile) com a **roupa** (figura inteira, nas cores do desenho) e o **cabelo** por cima. Só **pele** e **cor do cabelo** mudam (por código, `src/core/recolor.ts`). O criador mostra `skin, hairStyle, hairColor, top` (`CREATOR_KEYS`) e só as opções com arte ou cor (`creatorOptions`).
- Opções com **IDs em inglês e estáveis** (o save guarda só eles): `skins`, `hair` (`styles` com `none` = careca, `colors`), `top` (`styles`). `eyes`, `top.colors`, `bottom`, `shoes` e `accessories` são do criador antigo: os IDs continuam nos dados para os saves antigos, mas não têm efeito.
- Save (v12): `state.player = { name, appearance, pronoun }`; `appearance` tem `skin, eyes, hairStyle, hairColor, top, topColor, bottom, bottomColor, shoes, shoesColor, glasses, head`. `null` = `default` dos dados. Escolha que sumiu dos dados volta ao padrão ao carregar; escolha que existe mas não tem arte (ex.: roupa do criador antigo) usa a peça de reserva.
- `mannequin`: `basePath` (em public/), `resolution` (2 = arte em 64 px; o sprite é desenhado na escala 1/resolution e a caixa dos pés de `player.json` é multiplicada por ela), `frameWidth` x `frameHeight` (80 x 128), `anims` (`walk, idle, tray, carry, work`), `poseAnim` (animação de cada pose do jogo), `outfits` e `hair` (ID -> `true` = todas as animações; `false` = só a imagem de frente: o criador mostra, parada, e no jogo vale `fallback`), `ramps.skin` e `ramps.hair` (ID -> `[matiz, saturação, luz mínima, luz máxima]`).
- Arquivos (de `npm run mannequin`, em `basePath`): `outfit_<id>_<anim>.png` + `_mask.png` (canal vermelho: 1 = pele, achada pela paleta do rosto e longe das cores da roupa), `hair_<id>_<anim>.png` (só os fios, com a base do cabelo longo por baixo até as orelhas) e `_front` de cada peça para a prévia. Folhas com 4 colunas e linhas baixo, esquerda, direita, cima.
- `poses`: `tray` e `cat` **andam** (a bandeja e o gato no colo são desenhados pelo jogo; caixas nas mãos usam a pose `cat`); `sweep`, `wash`, `operate`, `stir` e `wipe_table` são **paradas** e usam a animação de ação (`actionMs` = quanto dura; varrer segue a vassoura). As mãos do manequim estão sempre vazias.
- `presets`: os exemplos do botão "Exemplos" (só com opções do criador). "Aleatório" sorteia com RNG injetado entre as opções do criador.
- Textos: `{player}` nas falas vira o nome dela (falas dela usam `"speaker": "{player}"`). Sem nome (save antigo), `", {player}"` some com a vírgula e o falante vira "Você" (`ui_text.playerFallback`).
- Peça nova: gerar no PixelLab com o mesmo movimento do manequim, pôr os quadros em `assets/_pixellab/personagens/protagonista/manequim/`, registrar em `scripts/import-mannequin.ts` (`FULL` ou `FRONT`) e no `data/character.json` (`top.styles`/`hair.styles` + `mannequin.outfits`/`hair`), e rodar `npm run mannequin`.

## Cômodos do café (`data/rooms.json`)

O café é **um mapa só** (`data/maps/cafe_main.json`, 44 x 11): Salão (colunas 0-15) | parede | Porão (17-24; o antigo quartinho, mesmo ID `room.back_room`, com a escadinha de 2 tiles na passagem) | parede | Quintal secreto (26-43). Salão e porão são contínuos (sem fade). O quintal não tem passagem pela parede: a porta dele fica na parede de cima do salão (os fundos), e quem leva até lá são as portas do mapa que apontam para o próprio mapa (`door.to_backyard` e `door.from_backyard` em `cafe_main.json`, com `requires` do quintal aberto); a validação de alcance conta essas portas como caminho. A câmera só vai até onde ela conhece (cômodos não ocultos).

- **Cômodo** (`rooms[]`): `id` estável (`room.*`), `name`, `initial` (estado num jogo novo), `area` (células, inclusive), `outdoor` (luz de fora), `discover`, `unlock`, `restore`, `capacity` (`cats`, `customers`), `features`, `sleep` (cama e onde acorda), `look` / `variants` + `variant`.
- **Estados:** `locked` (oculto, escuro) -> `discovered` (ela sabe; meio-escuro; a passagem vira porta fechada) -> `abandoned` (aberto, sujo) -> `restored` (reformado). Só avançam.
- **Ritmo:** os cômodos vêm depois do café andar sozinho. Quartinho: inauguração (que só acontece a partir da primavera) + `{ "served": { "gte": 40 } }`; quintal: quartinho reformado + 100 clientes. Quando existirem "nível de clientes" e "desafios diários", basta trocar estas condições em `discover.when`.
- **Descoberta** (`discover`): `trigger` = `key_found` | `cat_leads` | `neighbor_tells` | `renovation` (muda só a cena: `cat_leads` põe o gato miando na porta), `when` (condição; automático), `dialogue` e `highlight` (porta que pulsa, com a câmera indo até ela). O efeito `{ "discoverRoom": "room.x" }` descobre por uma fala/marco.
- **Abrir** (`unlock`): `cost` (obra paga no catálogo, seção Obras), `minCats`, `beats`. Porta com `requires.item` (a chave) abre com **E** na porta, se ela tiver o item (`consumesItem` gasta).
- **Reformar** (`restore`): limpar toda a sujeira com `dirtTag` e pagar `cost` (Obras); ou sozinho quando `when` valer (o salão: `{ "renovated": true }`). A sujeira de cômodo fechado não aparece nem se limpa; no mapa, a dos cômodos tem a tag `room` (o "\*" de saves antigos não a limpa). Sujeira com `gives` esconde um item (a chave), com `foundDialogue`.
- **Visual** (`look`, e `variants[variant]` por cima): `legend` e `legendByState` trocam o tile de letras do mapa; `objects` e `objectsByState` põem peças. Quintal: `variant` = `hedge` (sebe; a variante de tijolo saiu na arte nova, decisão 065).
- **Passagens** (`doors[]`): `id` (`door.*`), `at`, `from`, `to`, `initial` (`hidden` | `locked` | `open`), `tiles.hidden` (parece parede; sem ele, escondida não desenha nada), `tiles.locked`, `tiles.open` (sem ele, aberta é chão; com ele, a porta continua desenhada, como a do jardim) e `tiles.lockedOverlay` (por cima, trancada: o cadeado). Porta no vão de uma parede divisória: a célula dela e as dos dois lados não aceitam móveis; porta embutida na parede de cima: ela, a célula de cima e a da frente. Objeto do mapa com `inWall` pode ter a base na parede (porta embutida).
- **Capacidade de gatos** = soma de `capacity.cats` dos cômodos abertos (aparece no catálogo). `capacity.customers` é só informação: o atendimento não tem teto fixo.
- **Funcionalidades** (com o cômodo reformado): `sleep` = a cama oferece "dormir no café" depois de `goHomeFrom`; ela acorda em `sleep.wake` (também depois de desmaiar), e a porta da fachada não manda mais para casa. `playground` = módulos (itens com a tag de `playground.tag` e `"room": "room.backyard"`, liberados por `requires`: quintal reformado e `{ "cats": { "gte": 10 } }`) dão `pointsPerModulePerDay` de afeto a cada gato por dia.
- Itens com `room` só podem ser posicionados naquele cômodo. Condições novas: `{ "room": "room.x", "atLeast": "abandoned" }`, `{ "cats": { "gte": 10 } }`.
- **Novo cômodo** (cozinha, sótão, porão...): área livre no mapa (parede divisória e passagem) + uma entrada em `rooms` e em `doors`. Arte: `npm run backyard` importa o quintal e desenha os provisórios.

## Calendário e estações (`data/seasons.json`)

- `daysPerSeason` (30), `order` (inverno, primavera, verão, outono; o jogo começa na primeira, véspera de Natal), `names` (no HUD: "Inverno 12 · dom"). A estação sai de `state.day`: o save não guarda nada novo.
- `startWeekday`: dia da semana do dia 1 (0 = segunda; 2 = quarta, a véspera de Natal). Usado no HUD, no app Horário e no Calendário.
- App **Calendário**: `seasonStarts` (título do primeiro dia de cada estação) e `events` (`{ "id": "cal.*", "title", "day" | "fromSeason", "everyYear"?, "hideWhen"? }`): Natal e Ano Novo todo ano, a inauguração (`fromSeason: spring`, some depois de `story.inauguration`). `session.calendar(from, to)` junta tudo (`src/core/calendar.ts: calendarEntries`).
- `maps`: mapas que mudam com a estação (a rua). Tiles com os `prefixes` ganham o da estação (`street_calcada_a` -> `spring_street_calcada_a`); peças com `snowPrefix` (neve, montes, a neve por cima de objetos) somem fora do inverno; o que não existe na estação (abeto de Natal, pegadas) some. A cor do dia e da noite usa a estação do dia (`daynight.json: seasons`).
- Condição `{ "fromSeason": "spring" }`: a partir da primeira vez que a estação chega (dia 31). Texto `{daysUntil:spring}`: dias que faltam.
- **Inauguração** (`story.inauguration`): reforma completa (agora com a fachada) + placa + `fromSeason: spring`. No inverno a meta mostra quantos dias faltam. Ao inaugurar, a cena `cs.inauguration`.
- **Fachada** (`finishes.json: facade`): a superfície `surface.facade` (kind `facade`) troca o tile do objeto `obj.facade_cafe` da rua (menta, rosa, céu; com neve no inverno). A cor vem do reparo externo (e de uma obra de pintura depois).
- Arte: `npm run seasons` importa a rua de primavera, verão e outono.

## Cenas: passo de imagem (`data/cutscenes.json`)

`{ "type": "image", "image": "assets/ui/scenes/...png", "byFacade": { "finish.facade_pink": "..." }, "sound": "inauguration" }`: imagem de tela cheia; `byFacade` escolhe pela cor da fachada (sem arte da cor, vale `image`); `sound`: jingle de `audio.json` ao aparecer. Passo sem texto: emenda no próximo.

## Áudio v2 (`data/audio.json`)

- Grupos: `music` e `jingles` (volume "Música" das Opções), `ambient` e `sfx` (volume "Sons ambientes"). Faixa: `file` ([ogg, mp3]; null = mudo), `loop`, `gain` (mixagem).
- `scenes`: por lugar, `day` e `night` (de `nightFrom` a `nightUntil`) com música e ambiente; `busyAmbient`: burburinho quando há clientes no café.
- `events`: evento do núcleo -> `sfx` ou `jingle` (ex.: `customer.served` -> moeda, `day.started` -> jingle do dia novo). `loops`: cafeteira/liquidificador/bule, fogão/forno, pia e gato no colo tocam em repetição enquanto acontecem (`src/game/audio/SoundEvents.ts`).
- Menus: clique, abrir e fechar; avisos de problema: som de erro. Arte e som: `npm run ui-audio`.

## Chegada de gatos (`data/arrivals.json`, `data/cat_profiles.json`)

- **arrivals.json**: `pacing.phases` (`{ untilDay?, everyDays: [mín, máx] }`: intervalo entre chegadas sorteadas), `autoStartWhen` (condição; hoje 3 gatos), `queueMax`, `provisional.days` e `arrivals`. Cada chegada: `id` ("arr.*"), `model` (na_porta, pegadas, preso, vizinho_traz, gato_leva, ninhada, dentro_do_cafe, entrega, em_perigo, mural), `kind` (scripted | random), `repeatable`, `minGapDays`, `weight`, `trigger` (`days` [de, até], `hours` [de, até], `seasons`, `weather`, `cats` {gte, lte}, `reputation` {gte}, `when`: condição da história), `place` (`{ kind: cafe_door|street|roof|market|backyard|inside_cafe|clinic, map?, at?, trail?, fadeMinutes?, route? }`: `trail` e `fadeMinutes` nas pegadas; `route` no gato_leva, o fim é onde o gato novo espera), `clue` (meow|footprints|neighbor|poster|leader|noise|inside|box|danger|litter|routine|none), `priority` (fura a fila e os marcos exclusivos), `litter` (filhotes juntos), `cat` (`{ id }` de cats.json ou `{ generate: { personality?, condition?, variant? } }`), `condition`, `steps` (vazio = as do modelo, `src/core/arrivalModels.ts`; ou `{ meet: true }` (ir até `place`), `{ dialogue }`, `{ cutscene }` (o passo de gato `"cat": "arrival"` mostra o gato da chegada), `{ script }`, `{ clue: ponto }`, `{ minigame: { id, difficulty (easy|normal|hard|auto), itemId? } }` (ponto no `place.at`; tenta de novo se não der), `{ choice: chave de ui_text arrivals.choices }`, `{ poster: true }`, `{ feed: { times, item, hours: [de, até] } }` (gato carteiro: vários dias; uma refeição por dia, cada uma uma célula mais perto em `place.route`), `{ ask: [{ npc, tip, difficulty, points }] }` (dicas dos vizinhos: a escolhida vira a dificuldade "auto" do mini game seguinte e dá `points` a quem ajudou)), `result` (`startPoints`, `npc: { id, points }`, `money`, `reputation`) e `whenFull` (provisional | adoption | postpone).
- **cat_profiles.json**: `personalities` (`{ trust: easy|normal|hard, heartsToTrust, pillWindow? }`; `trust` também é a dificuldade dos cuidados (varinha, escova, remédio); `pillWindow`: quanto dura a distração no remédio escondido (1 = normal, desconfiado menos); toda personalidade de cats.json precisa de perfil), `conditions` (`{ health, sick?, hungry?, needs: [food|vet|warmth], age?: kitten|senior }`), `needs` (como atender cada necessidade antes de o gato entrar: `food.items` e `warmth.items`, qualquer um deles, E no gato; `vet: { point, cost }`, falar no ponto pagando), `needsPlace` (`{ map, at }`: onde o gato espera quando a chegada não tem lugar), `generated` (`variants`, `names`, `personalityWeights`, `conditionWeights`, `coat` por variante). Nomes na tela: `ui_text.json: cats.personalities`, `cats.conditions`.
- **Clima** (`seasons.json: weather`): pesos por estação (`snow`, `rain`, `sun`), sorteado por dia (`weatherOf`), sem nada no save.
- Modelos prontos: `na_porta` (meet -> cs.arrival_door -> choice take_in), `vizinho_traz` (meet -> choice neighbor_offer; precisa de `result.npc`), `mural` (poster), `pegadas` (meet no esconderijo -> choice; precisa de `place.trail`), `gato_leva` (meet -> `{ lead: true }` -> choice; precisa de `place.route` e de um gato do café para guiar), `preso` (trust auto -> choice; `place.lift` desenha o gato no alto), `ninhada` (meet -> kitten_hunt hard -> choice take_in_litter; `litter`: filhotes juntos), `dentro_do_cafe` (kitten_hunt easy -> trust auto -> choice), `entrega` (meet -> cs.arrival_box -> choice keep_box_cat; os dados acrescentam pistas), `em_perigo` (chase easy -> delivery normal com `hurt_cat`; use `priority`). Textos: `ui_text.json: arrivals` (pista, metas, perguntas, cartaz, fim), com os marcadores `{arrival:condition}`, `{arrival:personality}`, `{arrival:npc}`, `{arrival:leader}`.
- Eventos: `arrival.queued`, `arrival.choice` (`arrivalId, key`), `arrival.started` (`arrivalId, catId, model`), `arrival.step`, `arrival.finished` (`outcome`: accepted|declined|failed; `placement`: sheltered|provisional|shelter_pool|null), `arrival.provisional_settled`, `arrival.provisional_expired`.

### Como acrescentar uma chegada

Uma chegada nova é só dado em `data/arrivals.json` (e textos em `ui_text.json: arrivals` / falas em `dialogue.json`). Escolha o modelo, o gatilho, o lugar e o gato; deixe `steps` vazio para as etapas padrão do modelo, ou escreva as suas (`meet`, `dialogue`, `cutscene`, `script`, `clue`, `ask`, `minigame`, `choice`, `poster`, `lead`). `npm run check` acusa o que faltar. Moldes para as próximas ideias:

- **Gato da moradora idosa**: `vizinho_traz` com `result.npc` = a moradora (NPC novo em npcs.json), `cat.generate.condition: "senior"`, uma fala em `steps` (`meet` -> `dialogue` -> `choice: neighbor_offer`), `whenFull: "provisional"`.
- **Gato que conhece o prédio e leva a um cômodo escondido**: `gato_leva` com `place.map: "map.cafe_main"` e `place.route` até a porta do cômodo; o gatilho pode pedir `{ "room": "room.x", "atLeast": "discovered" }` em `when`; o efeito no cômodo vem da história (data/rooms.json).
- **Tempestade de neve**: qualquer modelo com `trigger.weather: ["snow"]` e `seasons: ["winter"]`; para urgência, `priority: true` e `condition: "cold"`.
- **Gata prenhe**: `ninhada` com `litter` (filhotes) e um gatilho de vários dias (`days: [de, até]`), ou `na_porta` com `condition: "hungry"`; quando houver gestação, um campo novo no gato (`litterIn: dias`) e o efeito na virada do dia (ArrivalSystem.dayEnded).
- **Gato que só confia em um NPC**: `preso` (ou `dentro_do_cafe`) com uma etapa `ask` em que só a dica desse NPC tem `difficulty: "easy"` e bons `points`; ou `script` com o NPC chegando antes do mini game.
