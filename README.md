# Biscuit Paws

Simulador 2D de café de gatos, no estilo Stardew Valley, para a Steam.
Phaser 3 + TypeScript + Vite. Resolução interna 640 x 360, escala inteira, grade de 32 px.

Estado atual: **Marco 0.5, a chegada.** Você compra a velha padaria vazia (sem balcão, paredes e piso gastos), começa com pouco dinheiro, compra e posiciona móveis, contrata o pintor e segue as primeiras metas da história. O jogo salva sozinho.

## Antes de rodar: a arte

A arte é licenciada e **não vai para o Git** (veja `docs/ART_AND_LICENSE.md`). Os pacotes ficam intactos em `assets/_originais_pacotes/<pacote>/`; o jogo carrega só `public/assets/`, organizado por função (`env/`, `interiors/`, `objects/`, `characters/`, `ui/`, `icons/`), com nomes no padrão de `docs/ASSET_REORGANIZATION.md`. Copie os arquivos para:

| Arquivo | Destino |
| --- | --- |
| `cat-cafe-tileset.png` (pacote Cat Cafe 32x32, pasta `tiles/`) | `public/assets/interiors/cafe/tile_cafe.png` |
| pacotes `ui_menus`, `inauguracao` e `audio` (zips) | `assets/_originais_pacotes/<pacote>/`, depois rode `npm run ui-audio` |
| pacote `rua_estacoes_tilesets` | `assets/_originais_pacotes/rua_estacoes_tilesets/`, depois rode `npm run seasons` |
| pacote `quintal_secreto` (zip) | `assets/_originais_pacotes/quintal_secreto/`, depois rode `npm run backyard` |
| pacote `personagem_principal` (zip) | `assets/_originais_pacotes/personagem_principal/`, depois rode `npm run character` (copia para `public/assets/characters/player/` e confere os arquivos) |

## Comandos

```bash
npm install
npm run dev         # abre o jogo em http://localhost:5173 (refaz data/tiles.json sozinho quando os dados de tiles mudam)
npm run art         # gera os tiles "velhos" a partir da folha do pacote (roda sozinho no dev e no build)
npm run art:placeholders  # arte provisória desenhada por código (caixa de areia, cocô); roda sozinho no dev
npm run check       # tipos + validação de todo o conteúdo (mapas, itens, história, falas)
npm run vet         # importa a clínica (Fernanda e interior) de assets/_originais_pacotes para public/assets
npm run pixellab    # junta a arte aprovada do PixelLab (assets/_pixellab) em folhas de 64 px em public/assets (café: móveis e cores novas)
npm run minigames   # importa a arte dos mini games de assets/_originais_pacotes/minigames para public/assets/minigames
npm test            # testes da lógica pura (Vitest)
npm run test:e2e    # teste de fumaça no navegador (Playwright)
npm run build       # build de produção em dist/
```

Na primeira vez que rodar o teste de fumaça, instale o navegador do Playwright: `npx playwright install chromium`.
Os prints do teste ficam em `test-results/`.

Controles:
- **Clique na sujeira** (de perto, com a vassoura ativa na barra): limpar. Manchas e rachaduras só saem quando o pintor reforma.
- **1 a 8 / roda do mouse:** escolher o item ativo na barra (embaixo da tela). **I:** mochila no centro da tela: a barra em cima e a grade embaixo. Selecione um item para ver o que ele faz; para pôr na barra, arraste até um espaço, ou selecione e aperte 1 a 8 (arrastar da barra para a grade tira da barra). Com a **ração** ativa, E na tigela enche; com o **petisco** ativo, E perto do gato dá o petisco.
- **Setas / WASD:** andar. Para entrar ou sair por uma porta, pare na frente dela e siga para cima.
- **C:** abre o celular direto no app **Market** (compra online, de qualquer lugar; chega em 1h na porta do café). Abas **Pet**, **Móveis**, **Eletro** (eletrodomésticos e eletrônicos), **Decor** e **Construção** (fachada, **Obras** dos cômodos e **Reforma** do pintor), cada item num cartão com a imagem. Clique para encomendar; item que já está na bolsa: clique para posicionar (só dentro do café).
- **Clique:** posicionar · **botão direito ou Esc:** cancelar (o item fica na bolsa)
- **Botão direito num móvel:** recolher e mudar de lugar
- **Espaço / Enter / clique:** avançar as falas
- **Mercado:** **E** numa prateleira põe itens no carrinho (+/−); **E** no caixa mostra o total e paga. Sair sem pagar não cobra nada (o carrinho fica até dormir).
- **Mini games** (pedidos da vila: "Gatinho fujão" abre o Gato em fuga; "Filhotes escondidos", da Dona Neusa, a partir de quando ela aparece, abre a Caça ao filhote na calçada em frente ao café; e, só em alguns dias (esporádicos), "Entrega relâmpago" do Seu Ademir, com um café, ao lado da lousa, e "Gato assustado" da Fernanda, com um petisco, perto da clínica): E no ponto do pedido abre o jogo. Dentro: setas/WASD, **E**/Espaço ou clique = ação, **Esc** = pausa, botão **Pular** (só parte das moedas). Jogos: **Gato em fuga** (`chase`) **Pescaria** (`fishing`: E ou clique na água lança, E fisga na mordida, segurar E ou o mouse mantém o indicador na zona verde) **Latte art** (`latte`: segure o mouse e desenhe por cima do contorno, ou setas + segurar E; Enter serve) e **Caça ao filhote** (`kitten_hunt`: clique num esconderijo, ou setas para escolher e E; cada erro dá a dica quente/frio; o difícil tem uma ninhada de 2 ou 3) e **Entrega relâmpago** (`delivery`: leve o pedido pela rua até a porta marcada; esbarrar em pedestre ou bicicleta para 1 s e estraga um pouco, e o café esfria/o bolo amassa com o tempo) e **Confiança do gato** (`trust`: sem cronômetro; segure → (ou E/Espaço/mouse) para chegar perto devagar, ← se afasta, **P** dá um petisco; se ele ficar alerta, pare; se bufar e você continuar andando, é um susto, e 3 sustos acabam o jogo) e **Match de adoção** (`adoption`: arraste cada gato do abrigo até o lugar de uma família; soltar num lugar ocupado troca, soltar na coluna tira; Enter confirma e cada par mostra boa/ok/ruim e o porquê; gatos, famílias e regras em `data/adoption.json`). A intro de cada jogo mostra um tutorial curto. Atalho de teste: `?jogar&minijogo=<id>&dificuldade=easy|normal|hard` na URL (ids: `chase`, `fishing`, `latte`, `kitten_hunt`, `delivery`, `trust`, `adoption`), ou os botões no painel de debug (F9).
- **M:** quadro do cardápio, com quantos clientes cabem (lugares e louça).
- **Dia 2:** um "presente" do gato no chão do salão. Recolha com a vassoura: ela se dá conta de que esqueceu a **caixa de areia** (Market, aba Pet) e a caminha.
- **Chegada de gatos** (`data/arrivals.json`): gatos chegam ao café de vários jeitos. Prontos: miado na porta (o gato espera na calçada; E nele e decida se ele entra), um vizinho traz o gato (aceitar dá corações ao vizinho) e o cartaz no mural do mercado / Vila Hoje (acolher ou não). Gato novo ganha nome na hora. Café cheio: o gato fica provisório (7 dias, até abrir vaga) ou vai para o abrigo da vila (entra na feira de adoção). As chegadas sorteadas começam depois do 3º gato; debug (F9): um botão por chegada.
- **Feira de adoção**, no quintal secreto (1 vez por estação, com mais de 8 gatos abrigados e o quintal pronto há pelo menos uma semana): a meta aparece sozinha no balão. Distribua os panfletos em 4 pontos da rua; a feira fica marcada para 3 dias depois (no Calendário). No dia: ponha a placa de fechado na porta do café (o atendimento não abre), decore o quintal (bandeirinhas na cerca viva e balões) e, na mesa da feira, no quintal, o **Match de adoção** com os gatos do café (os da história nunca saem; se faltar gato, vêm do abrigo da vila). Adoção boa: o gato ganha família e sai do café. Se o dia passar sem a feira, dá para organizar de novo. Debug (F9): "Feira: começar" (sem precisar dos gatos) e "Feira: ir ao dia".
- **Reputação felina** (embaixo do dinheiro, de 0 a 100): sobe com os mini games (conforme o resultado; a confiança do gato que falha tira um pouco) e com as adoções (boa vale mais que ok). Ao passar de 20, 40, 60 e 80 aparece um aviso com o nome do nível (os desbloqueios ainda virão). Valores em `data/reputation.json`, `data/minigames.json` e `data/adoption.json`. No painel de debug (F9): +10, zerar e o log dos últimos motivos.
- **Balão do subconsciente** (canto de cima): fica recolhido, só com o título da meta; clique para ver os detalhes (passos, rotina do dia, atendimento). Com o café aberto e ninguém podendo entrar (quadro vazio ou tudo esgotado: louça, ingrediente ou equipamento), aparece o motivo em vermelho, e um "!" mesmo recolhido. Depois de pagar, o cliente fica no lugar consumindo (20 min em pé, 40 na mesa): a barrinha em cima dele mostra quanto falta para ir embora.
- **P:** celular (depois do prólogo): tela de início com os apps **Market** (o mesmo da tecla C), **Horário** (dias da semana e horas em que o café abre; fora dele não entra cliente, e ela só vai para casa quando o último sair), **Calendário** (a estação em grade, hoje, dias fechados e os dias importantes: começo das estações, Natal, Ano Novo, inauguração), **Vila Hoje** (notícias e pedidos da vila) e **Meus gatos** (cada gato abrigado: personalidade, corações, saúde, doença e remédio, se comeu hoje e há quantos dias está no café).
- **Clínica da Fernanda** (fim da rua, a partir do dia 6): com o gato doente no colo (E perto dele), entre e aperte **E** na mesa de exame para a consulta (diagnóstico, receita de 1 a 7 dias e o preço; a primeira pode ser fiado). Em casa, com o **remédio** ativo na barra, **E** perto do gato dá a dose do dia. Cuidado: gato doente sem remédio por mais de 2 dias passa a doença para os outros, e com 2 ou mais gatos doentes os clientes deixam de entrar.

O jogo abre na tela inicial (Home): toque/clique, depois Continuar, Novo jogo, Carregar/recuperar saves, Opções e Créditos. No **Novo jogo**, depois do slot, vem **Sua personagem**: nome e aparência (pele, olhos, cabelo, roupa, parte de baixo, calçado, óculos e acessório), com prévia que gira, "Aleatório" e "Exemplos". Isso só se escolhe no início do jogo. O ano tem quatro estações de 30 dias: o jogo começa no inverno, e a inauguração do café só pode acontecer a partir da primavera (o inverno é o mês para reformar o salão e a fachada). O café cresce por cômodos, como recompensa de quem já toca o café: depois da inauguração (na primavera) e com 40 clientes atendidos, a Dona Neusa conta do **quartinho** atrás da parede (obra no Market, aba **Construção**). Com o quartinho reformado e 100 clientes, o gato leva até a porta com cadeado do **quintal secreto** (a chave estava no quartinho). Cômodo reformado libera funções: no quartinho, dormir no café. Esc no jogo abre a pausa (Continuar, Opções, Salvar, Voltar ao menu).

Atalhos para testar (pulam a Home): `http://localhost:5173/?novo` começa um jogo novo no slot 1; `?jogar` continua o save mais recente (ou começa um novo).

### Modo debug (só em `npm run dev`)
**F9** liga e desliga (ou abra `?debug=1`). Aparece um painel com: +100 moedas, pular falas, ver as caixas de colisão,
ver a grade (com a célula sob o mouse), jogo novo e os marcos já concluídos. As metas mostram as notas de desenvolvimento (`devNote`).
O debug tem **save próprio**: os truques não mexem no seu save normal. Nada do debug vai para o `npm run build`.

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

### Mudar a história, as falas, os preços
- `data/story.json`: marcos da história e metas do diário (condição -> efeito).
- `data/dialogue.json`: falas.
- `data/recipes.json`, `data/service.json`, `data/carry.json`: receitas, atendimento e mãos (tecla M: quadro do cardápio; I: mochila).
- `data/delivery.json`: correio (compras do Market chegam em 1h na porta do café).
- `data/jobs.json` e `data/news.json`: pedidos da vila (bicos) e o jornal "Vila Hoje" do celular (tecla P).
- `data/daynight.json`: cores do dia e da noite por hora e estação (o mapa diz se é `indoor` e onde ficam as `lights`).
- `data/items.json`: móveis do catálogo, nomes e preços.
- `data/maps/street.json`: a rua (fachadas, objetos, neve, porta do café). `data/world.json`: onde o jogo começa.
- `data/tilesets.json`: folhas extras de tiles (rua, neve, sujeira), com camada e solidez de cada peça. A arte pode ser de 32 ou 64 px por tile: vale o `tileSize` do JSON de peças em `data/tilesets/` (decisão 052). Folha com `replaces: true` troca só a imagem de tiles que já existem (mesmo nome e tamanho): é assim que a arte nova do PixelLab entra no café (decisão 065).
- `data/finishes.json`: acabamentos do pintor (pisos e papéis de parede) e preços. As superfícies reformáveis ficam no mapa (`surfaces`).
- `data/tiles.worn.json`: tiles velhos gerados do pacote (estilo de desgaste, troca de cores, variações).
- `data/economy.json`: dinheiro inicial.
- `data/ui_text.json`: textos da interface.

O formato está em `docs/DATA_CONTRACTS.md`. Rode `npm run check`: ele acusa referências quebradas (fala, item ou marco que não existe).

### Ajustar a personagem
`data/player.json`: velocidade, quadros por segundo e tamanho da caixa dos pés.

## Como o código está organizado

```
data/          conteúdo (mapas, tiles, itens, história, falas, personagem)
src/core/      regras puras, sem Phaser: mapa, movimento, sessão, história, posicionamento, save (testadas)
src/game/      Phaser: cenas, sprites, teclado; ui/ = interface em HTML por cima do canvas
src/platform/  armazenamento (hoje localStorage; no futuro, arquivos via Electron)
scripts/       gerador do catálogo e validador do conteúdo
tests/core/    testes unitários
tests/e2e/     teste de fumaça no navegador
docs/          história, arquitetura, contratos de dados, arte, roadmap, decisões
```

Três ideias principais:
1. **O `core` decide, o Phaser só desenha.** Por exemplo, quais células são sólidas e qual a profundidade de cada peça
   são calculadas em `src/core/map.ts`. A cena só cria as imagens e os corpos de colisão.
2. **Y-sort:** a profundidade de cada objeto é a coordenada Y da base dele, e a da personagem é a base dos pés.
   Quem está mais embaixo na tela é desenhado por cima.
3. **Tudo passa pela `GameSession`** (`src/core/session.ts`): comprar, posicionar, recolher. Ela avança a história
   e avisa o resto por eventos (`item.placed`, `dialogue.requested`...). A cena e a interface só escutam.

Em `npm run dev`, a cena fica acessível no console do navegador como `__biscuitPaws.cafe`
(por exemplo `__biscuitPaws.cafe.teleportPlayer(3, 3)` ou `__biscuitPaws.cafe.sessionState()`).

## Créditos
Veja `CREDITS.md`.
