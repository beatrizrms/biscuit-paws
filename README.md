# Biscuit Paws

Simulador 2D de café de gatos, no estilo Stardew Valley, para a Steam.
Phaser 3 + TypeScript + Vite. Resolução interna 640 x 360, escala inteira, grade de 32 px.

Estado atual: **Marco 0.5, a chegada.** Você compra a velha padaria vazia (sem balcão, paredes e piso gastos), começa com pouco dinheiro, compra e posiciona móveis, chama o Tião para as obras e segue as primeiras metas da história. O jogo salva sozinho.

## Antes de rodar: a arte

A arte é licenciada e **não vai para o Git** (veja `docs/ART_AND_LICENSE.md`). Os pacotes ficam intactos em `assets/_originais_pacotes/<pacote>/`; o jogo carrega só `public/assets/`, organizado por função (`env/`, `interiors/`, `objects/`, `characters/`, `ui/`, `icons/`), com nomes no padrão de `docs/ASSET_REORGANIZATION.md`. Copie os arquivos para:

| Arquivo | Destino |
| --- | --- |
| `cat-cafe-tileset.png` (pacote Cat Cafe 32x32, pasta `tiles/`) | `public/assets/interiors/cafe/tile_cafe.png` |
| pacotes `ui_menus`, `inauguracao` e `audio` (zips) | `assets/_originais_pacotes/<pacote>/`, depois rode `npm run ui-audio` |
| pacote `rua_estacoes_tilesets` | `assets/_originais_pacotes/rua_estacoes_tilesets/`, depois rode `npm run seasons` |
| pacote `quintal_secreto` (zip) | `assets/_originais_pacotes/quintal_secreto/`, depois rode `npm run backyard` |

## Comandos

```bash
npm install
npm run dev         # abre o jogo em http://localhost:5173 (refaz data/tiles.json sozinho quando os dados de tiles mudam)
npm run art         # gera os tiles "velhos" a partir da folha do pacote (roda sozinho no dev e no build)
npm run art:placeholders  # arte provisória desenhada por código (caixa de areia, cocô); roda sozinho no dev
npm run check       # tipos + validação de todo o conteúdo (mapas, itens, história, falas)
npm run vet         # importa a clínica (Fernanda e interior) de assets/_originais_pacotes para public/assets
npm run mannequin   # monta as peças da personagem (manequim, roupas e cabelos do PixelLab, 64 px) em public/assets/characters/player_mannequin
npm run npcs        # monta as folhas dos NPCs na arte nova (Gabi, Corretora, Dona Neusa, Entregadora, Fernanda só com a caminhada, o Joca e os 10 clientes com caminhada e sentado) em public/assets/characters/npcs/v64
npm run pixellab    # junta a arte aprovada do PixelLab (assets/_pixellab) em folhas de 64 px em public/assets (café, cômodos, mercado, clínica, rua, quintal, ícones e mini games)
npm run minigames   # importa a arte dos mini games de assets/_originais_pacotes/minigames para public/assets/minigames
npm test            # testes da lógica pura (Vitest)
npm run test:e2e    # teste de fumaça no navegador (Playwright)
npm run build       # build de produção em dist/
```

Na primeira vez que rodar o teste de fumaça, instale o navegador do Playwright: `npx playwright install chromium`.
Os prints do teste ficam em `test-results/`.

Controles:
- **E perto da sujeira, ou clique nela** (de perto, com a vassoura ativa na barra): limpar. Manchas e rachaduras só saem com o reparo interno do Tião.
- **1 a 8 / roda do mouse:** escolher o item ativo na barra (embaixo da tela). **I:** mochila no centro da tela: a barra em cima e a grade embaixo. Selecione um item para ver o que ele faz; para pôr na barra, arraste até um espaço, ou selecione e aperte 1 a 8 (arrastar da barra para a grade tira da barra). Com a **ração** ativa, E na tigela enche (uma porção serve todos os gatos do dia); com a **areia** ativa, E na caixa de areia troca a areia (todo dia; sem areia limpa, a higiene dos gatos cai); com o **petisco** ativo, E perto do gato dá o petisco. Upgrades no Market: **pote de ração** e **caixa de areia automáticos** guardam até 10 dias e servem sozinhos (abasteça com a ração/areia na barra; os sacos de 10 kg rendem 10 dias).
- **Cuidados dos gatos:** cada gato tem alegria e higiene, que caem um pouco a cada dia. Quando algo está baixo, um balãozinho aparece em cima dele no café (remédio, sujo ou triste). Os mini games de cuidado (varinha, escova, remédio escondido) sobem os dois. **Varinha de penas** (18 moedas, prateleira pet do mercado): com ela ativa na barra, E perto de um gato do café abre **Brincar com a varinha**: o mouse é a ponta; mude de rumo e de ritmo para empolgar; reta constante ou rápido demais, ele enjoa; pare perto dele e ele se agacha e dá o bote (balance de leve durante o agachar: bônus). A dificuldade vem do jeito do gato. **Escova de pelo** (15 moedas, mesma prateleira): E no gato abre **Banho e escovação**: o gato grande, de lado, com nós de pelo; segure e arraste a escova sobre cada nó até sumir (só o vaivém conta, clicar não). Barriga, cauda e patas são sensíveis e gastam a paciência dele; costas e bochechas ele adora e a paciência volta um pouco. Paciência zerada, ele foge. Sobe a higiene (e um pouco a alegria). **Remédio:** com o remédio da receita na mão, E no gato doente abre **Remédio escondido**: primeiro cubra o comprimido com a pasta (segure e arraste, até 100%) e aperte E (Pronto); depois ofereça (E) quando ele estiver de costas, distraído. De frente com "!", ele vê e desconfia; o "?" tremendo avisa que ele vai virar. Oferecer com o comprimido aparecendo também dá desconfiança; cheia, ele recusa e foge (dá para tentar de novo). Deu certo, a dose do dia vai. Gato desconfiado (tímido, rabugento) se distrai por menos tempo.
- **Luz e sombra de ambiente:** sem mudar a arte, cada objeto no chão e quem anda tem uma sombra macia embaixo, a parede escurece de leve onde encontra o piso, as janelas do café jogam luz quente no chão de dia (some à noite) e as bordas da tela têm uma vinheta leve. Números em `data/daynight.json: ambience`.
- **Falas do narrador** (sem personagem): quadro lavanda, texto em itálico e negrito; nas cenas, faixa lilás.
- **Dica E:** chegando perto de algo que dá para usar (balcão, prateleira, pedido, cliente, gato, sujeira com a vassoura na mão...), uma plaquinha "E" com a ação aparece em cima ("E Varrer", "E Ver a prateleira"...). É um tutorial: depois de 3 usos de cada tipo de coisa, a dica daquele tipo some.
- **Setas / WASD:** andar. **Segurar R:** correr (1,6x; carregando algo, corre um pouco menos: 1,3x por cima da velocidade de carregar; sem custo). Para entrar ou sair por uma porta, pare na frente dela e siga para cima.
- **C:** abre o celular direto no app **Market** (compra online, de qualquer lugar; chega em 1h na porta do café). Abas **Pet**, **Móveis**, **Eletro** (eletrodomésticos e eletrônicos), **Decor** e **Construção** (**Obras** dos cômodos e as **obras do Tião**: reparo interno e da fachada, depois trocar o acabamento de uma área marcada no café, uma obra por vez; ele liga com o orçamento, recebe adiantado e vem no dia seguinte), cada item num cartão com a imagem. Como no mercado, clicar põe o item no **pedido** (de novo, mais um; o − tira) e a barra embaixo mostra o total: só compra ao **Confirmar compra** (sem dinheiro para tudo, não compra nada; Limpar esvazia). Item que já está na bolsa: clique para posicionar (só dentro do café).
- **Clique:** posicionar · **botão direito ou Esc:** cancelar (o item fica na bolsa)
- **Botão direito num móvel:** mudar de lugar sem passar pela mochila. O que está em cima (a cafeteira no balcão, a louça e os pedidos) vai junto; o original fica esmaecido até soltar. **Clique:** soltar · **Q:** guardar na mochila (com o que está em cima) · **botão direito ou Esc:** cancelar (nada muda). **Shift + botão direito:** pega só a peça de cima (ex.: trocar a cafeteira de balcão).
- **Espaço / Enter / clique:** avançar as falas
- **Mercado:** **E** numa prateleira põe itens no carrinho (+/−); **E** no caixa mostra o total e paga. Sair sem pagar não cobra nada (o carrinho fica até dormir).
- **Mini games** (pedidos da vila: "Gatinho fujão" abre o Gato em fuga; "Filhotes escondidos", da Dona Neusa, a partir de quando ela aparece, abre a Caça ao filhote na calçada em frente ao café; e, só em alguns dias (esporádicos), "Entrega relâmpago" do Seu Ademir, com um café, ao lado da lousa, e "Gato assustado" da Fernanda, com um petisco, perto da clínica): E no ponto do pedido abre o jogo. Dentro: setas/WASD, **E**/Espaço ou clique = ação, **Esc** = pausa, botão **Pular** (só parte das moedas). Jogos: **Gato em fuga** (`chase`) **Pescaria** (`fishing`: E ou clique na água lança, E fisga na mordida, segurar E ou o mouse mantém o indicador na zona verde) **Latte art** (`latte`: segure o mouse e desenhe por cima do contorno, ou setas + segurar E; Enter serve) e **Caça ao filhote** (`kitten_hunt`: clique num esconderijo, ou setas para escolher e E; cada erro dá a dica quente/frio; o difícil tem uma ninhada de 2 ou 3) e **Entrega relâmpago** (`delivery`: leve o pedido pela rua até a porta marcada; esbarrar em pedestre ou bicicleta para 1 s e estraga um pouco, e o café esfria/o bolo amassa com o tempo) e **Confiança do gato** (`trust`: sem cronômetro; segure → (ou E/Espaço/mouse) para chegar perto devagar, ← se afasta, **P** dá um petisco; se ele ficar alerta, pare; se bufar e você continuar andando, é um susto, e 3 sustos acabam o jogo) e **Match de adoção** (`adoption`: arraste cada gato do abrigo até o lugar de uma família; soltar num lugar ocupado troca, soltar na coluna tira; Enter confirma e cada par mostra boa/ok/ruim e o porquê; gatos, famílias e regras em `data/adoption.json`). A intro de cada jogo mostra um tutorial curto. Atalho de teste: `?jogar&minijogo=<id>&dificuldade=easy|normal|hard` na URL (ids: `chase`, `fishing`, `latte`, `kitten_hunt`, `delivery`, `trust`, `adoption`), ou os botões no painel de debug (F9).
- **M:** quadro do cardápio, com quantos clientes cabem (lugares e louça). O botão **anotar o que falta** põe na lista de compras (app **Notas** do celular) os ingredientes do cardápio que acabaram ou estão acabando; ao comprar, o item some da lista.
- **Dia 2:** um "presente" do gato no chão do salão. Recolha com a vassoura: ela se dá conta de que esqueceu a **caixa de areia** (Market, aba Pet) e a caminha.
- **Chegada de gatos** (`data/arrivals.json`): gatos chegam ao café de vários jeitos. Prontos: miado na porta (o gato espera na calçada; E nele e decida se ele entra), um vizinho traz o gato (aceitar dá corações ao vizinho), o cartaz no mural do mercado / Vila Hoje (acolher ou não), pegadas na neve (siga cedo: a neve cobre as pegadas; o gato escondido aparece de perto) um gato do café que leva até outro (siga; ele espera se você ficar para trás), gato preso no poste (Confiança do gato até ele descer), ninhada (Caça ao filhote; a mãe e os filhotes entram juntos), miado dentro do café (procure e ganhe a confiança), caixa que mia na porta (com bilhete; pergunte no mercado e na clínica) e gato ferido (urgente: pegue e corra com ele até a clínica). Nos mini games das chegadas, se não der, dá para tentar de novo. Gato novo ganha nome na hora. Café cheio: o gato fica provisório (7 dias, até abrir vaga) ou vai para o abrigo da vila (entra na feira de adoção). Os 3 primeiros gatos são escritos à mão (o do prólogo; a Dona Neusa traz o 2º no dia 8; pegadas na neve levam ao 3º no dia 12); as chegadas sorteadas começam depois. No gato no poste, os vizinhos dão dicas: quem você ouve muda a dificuldade e ganha corações. O gato carteiro (tímido) aparece no fim da tarde perto da caixa de correio: deixe ração (1 por dia) e, a cada dia, ele chega mais perto; depois de 3, ele aceita entrar. Antes de entrar, o gato aceito precisa do que a condição pede: com fome, ração (E no gato); com frio, um cobertor (prateleira pet do mercado); ferido, a consulta com a Fernanda na clínica (20 moedas; o gato ferido urgente já é cuidado ao chegar lá correndo). O balão mostra o que falta. Debug (F9), linha **História**: pular introdução (conclui o prólogo, com o gato já nomeado e o café varrido), concluir marco (o próximo, sem esperar a condição), concluir história e abrir cômodos (todos descobertos, abertos e reformados). As falas e cenas dos marcos pulados não aparecem. Linha Chegadas: um botão por chegada, clima forçado, +1 h, +1 dia, café cheio, gerar gato (personalidade e condição) e gatilhos agora.
- **Eventos no quintal** (`data/festivals.json`): a ideia é dela (uma fala) e a meta aparece no balão. **Feira de adoção** (a cada 30 dias, com mais de 8 gatos abrigados e o quintal pronto há uma semana): panfletos em 4 pontos da rua; a feira fica marcada para 3 dias depois (no Calendário). **Dia do Gato** (verão 8, com a reputação "Notada na vila" e o quintal reformado; a ideia vem 3 dias antes; depois da feira, o desfile de fantasia e a foto perfeita). **Concurso de fofura** (primavera 20, com "De confiança" e o quintal reformado): o desfile de fantasia e a foto perfeita. No dia: a placa de fechado na porta do café (o atendimento não abre), a decoração do quintal e as atividades, em ordem: **Montar a feira** (nos caixotes do quintal: o quintal visto de cima; ponha a mesa da feira, caixas de transporte, cercadinho, cartaz e mesa de petiscos, e escolha os gatos do café que vão, acomodando cada um numa caixa ou cercadinho; pontos por gatos acomodados, caminho livre do portão até tudo, cartaz perto do portão e petiscos perto dos gatos; mais pontos = mais visitantes = até 2 famílias a mais no match) e a mesa com o **Match de adoção** com os gatos escolhidos (os da história nunca saem; se faltar gato, vêm do abrigo da vila). **Concurso de fantasia** (nos balões do quintal): escolha um gato do café e uma peça para a cabeça, o pescoço e as costas; o tema do dia é sorteado; o júri dá nota pelo tema, pelas cores que combinam, pelo estilo igual e por não ser tudo da mesma cor, contra três concorrentes da vila; 1º lugar é perfeito, e o pódio dá moedas a mais. Algumas peças só aparecem com mais reputação. **Foto perfeita** (na frente do forno do quintal): o mouse é o visor; os gatos andam e trocam de pose, e às vezes, sentados, fazem a pose fofa (brilho piscando perto das orelhas) por um instante; fotografe nela, com o gato no centro e, se der, os dois juntos; poucas fotos, vale a melhor, e a melhor de sempre fica guardada. No fim, um resumo: resultado de cada atividade, adoções, moedas e reputação. Se o dia passar, dá para organizar de novo. Debug (F9), linha **Eventos**: um botão por evento (começa já, sem condição nem data) e "Ir ao dia do evento".
- **Reputação felina** (embaixo do dinheiro, de 0 a 100): sobe com os mini games (conforme o resultado; a confiança do gato que falha tira um pouco) e com as adoções (boa vale mais que ok). Ao passar de 20, 40, 60 e 80 aparece um aviso com o nome do nível (os desbloqueios ainda virão). Valores em `data/reputation.json`, `data/minigames.json` e `data/adoption.json`. No painel de debug (F9): +10, zerar e o log dos últimos motivos.
- **Balão do subconsciente** (canto de cima): fica recolhido, só com o título da meta; clique para ver os detalhes (passos, rotina do dia, atendimento). Com o café aberto e ninguém podendo entrar (quadro vazio ou tudo esgotado: louça, ingrediente ou equipamento), aparece o motivo em vermelho, e um "!" mesmo recolhido. Depois de pagar, o cliente fica no lugar consumindo (20 min em pé, 40 na mesa): a barrinha em cima dele, com o ícone do que ele está tomando, mostra quanto falta para ir embora. Cada etapa tem a barra dela, que recomeça cheia: na fila (em pé, embaixo do balão de espera), sentado esperando o pedido (no balão) e tomando. Na fila também acaba a paciência: ele desiste. **Avaliação:** quem sai dá de 1 a 5 estrelas, que sobem em cima dele com a reputação: começa em 5 e perde pela espera em pé, pela espera sentado e pela sujeira do salão (sujeira que sai com a vassoura e louça suja nas mesas); quem desiste dá 1. 5★ +2 de reputação, 4★ +1, 3★ 0, 2★ −1, 1★ −2.
- **P:** celular (depois do prólogo; o saldo de moedas fica na barra de cima, porque o celular cobre as moedas do HUD): tela de início com os apps **Market** (o mesmo da tecla C), **Horário** (dias da semana e horas em que o café abre; fora dele não entra cliente, e ela só vai para casa quando o último sair), **Calendário** (a estação em grade, hoje, dias fechados e os dias importantes: começo das estações, Natal, Ano Novo, inauguração), **Vila Hoje** (notícias e pedidos da vila) e **Meus gatos** (cada gato abrigado: personalidade, corações, saúde, alegria, higiene, doença e remédio, se comeu hoje e há quantos dias está no café).
- **Clínica da Fernanda** (fim da rua, a partir do dia 6): no dia 6 o primeiro gato adoece; na porta da obra do fim da rua ela descobre que a clínica inaugurou naquele dia, entra e pergunta à Fernanda se pode trazer o gato. Com o gato doente no colo (ele vai deitado nos braços, em qualquer mapa) (E perto dele), entre e aperte **E** na mesa de exame para a consulta (diagnóstico, receita de 1 a 7 dias e o preço; a primeira pode ser fiado). Em casa, com o **remédio** ativo na barra, **E** perto do gato dá a dose do dia. Cuidado: gato doente sem remédio por mais de 2 dias passa a doença para os outros, e com 2 ou mais gatos doentes os clientes deixam de entrar.

O jogo abre na tela inicial (Home): toque/clique, depois Continuar, Novo jogo, Carregar/recuperar saves, Opções e Créditos. No **Novo jogo**, depois do slot, vem **Sua personagem**: nome, pronome (**Ela** ou **Ele**: as poucas falas que têm gênero seguem essa escolha; o resto é escrito sem gênero) e aparência (pele, olhos, cabelo, roupa, parte de baixo, calçado, óculos e acessório), com prévia que gira, "Aleatório" e "Exemplos". Isso só se escolhe no início do jogo. O ano tem quatro estações de 30 dias: o jogo começa no inverno, e a inauguração do café só pode acontecer a partir da primavera (o inverno é o mês para reformar o salão e a fachada). O café cresce por cômodos, como recompensa de quem já toca o café: depois da inauguração (na primavera) e com 40 clientes atendidos, a Dona Neusa conta do **porão** (obra no Market, aba **Construção**): a porta fica na parede da direita do salão e uma escadinha desce para ele. Com o porão reformado e 100 clientes, o gato leva até a porta com cadeado na parede dos fundos (a de cima) do salão, que dá no **quintal secreto** (a chave estava no porão); a saída do quintal fica embaixo, no capacho. Cômodo reformado libera funções: no porão, dormir no café. Esc no jogo abre a pausa (Continuar, Opções, Salvar, Voltar ao menu).

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
- `data/finishes.json`: acabamentos (pisos, papéis de parede, lambri, cores da fachada) e as obras do construtor (`construction`: reparos, preço por tile, horas). As superfícies reformáveis ficam no mapa (`surfaces`).
- `data/tiles.worn.json`: tiles velhos gerados do pacote (estilo de desgaste, troca de cores, variações).
- `data/economy.json`: dinheiro inicial.
- `data/ui_text.json`: textos da interface.

O formato está em `docs/DATA_CONTRACTS.md`. Rode `npm run check`: ele acusa referências quebradas (fala, item ou marco que não existe).

### Ajustar a personagem
`data/player.json`: velocidade, quadros por segundo e tamanho da caixa dos pés.

**A personagem** é o manequim do PixelLab (arte em 64 px) com roupa e cabelo em camadas (decisões 077, 083 e 087). No Novo jogo, "Sua personagem" escolhe nome, pronome, pele (clara, morena, parda, negra), penteado (longo, chanel, coque, rabo de cavalo, cacheado, afro, curto, afro curto, social, topete ou sem cabelo), cor do cabelo e roupa (moletom, camiseta, camisa de gola, vestido, blazer, casaco de inverno). As roupas ficam nas cores do desenho; pele e cabelo mudam de cor por código. Todas as peças andam e fazem as poses (bandeja, colo, ação); bandeja, gato e vassoura são desenhados pelo jogo. As peças saem de `npm run mannequin`.

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
