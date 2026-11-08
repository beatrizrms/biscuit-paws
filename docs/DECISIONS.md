# Decisões (ADR curto)

Formato: data, decisão, motivo, consequência. Nunca apague: se mudar de ideia, adicione uma nova entrada.

## 001. 2D, não 3D
Motivo: custo de arte e de produção bem menor; combina com o estilo Stardew Valley.

## 002. Arte pronta (pixel art 32 x 32, leckie1989)
Motivo: não temos artista. Consequência: tudo em 32 x 32; licença proíbe compartilhar os arquivos.

## 003. Godot foi tentado e abandonado (nov/2026)
Motivo: o editor visual exigia muitos cliques em painéis, e a IA não enxerga a tela do usuário. Os problemas se acumularam em depurar a interface, e não no jogo.
Consequência: migrar para **Phaser 3 + TypeScript + Vite**, tudo em código e dados, que a IA consegue escrever, rodar e verificar sozinha.

## 004. Phaser 3 + TypeScript + Vite
Motivo: stack web (a desenvolvedora é de web), tudo em texto, testável com Playwright. Steam via Electron em marco futuro.
Consequência: empacotamento e algumas peças de motor (colisão, câmera) são nossas, e não vêm prontas como no Godot.

## 005. Mapas e conteúdo como dados, por nome de tile
Motivo: evolução sem quebrar compatibilidade; permitir trocar arte sem tocar no código.

## 006. Sem fiscal como antagonista; o inverno é a pressão
Motivo: tom aconchegante. Meta suave (aquecer os gatos até o Natal), sem derrota.

## 007. Clientes humanos; gatos vivem no café
Motivo: clareza do loop e do papel dos gatos.

## 008. Estações em fases, mas dados preparados desde já
Motivo: não quebrar saves quando entrarem novas estações (`tags`, `season`).

## 009. Nome oficial: Biscuit Paws (nov/2026)
Motivo: decisão da desenvolvedora. "Cat Café" era nome provisório.
Consequência: o jogo, a janela e a documentação usam "Biscuit Paws". O nome do pacote de arte (Cat Cafe 32x32) não muda.

## 010. Colisão só na base das peças altas, como em Stardew Valley (nov/2026)
Motivo: peças com mais de uma linha (árvore de gato, estante, planta alta) têm a parte de cima "em pé". A personagem pode passar atrás delas; o y-sort cuida do desenho.
Consequência: uma peça sólida bloqueia só a **última linha** de células (a base no chão). Paredes continuam sólidas por inteiro.

## 011. Camada de desenho no catálogo (nov/2026)
Motivo: tapete e capacho são planos (não podem cobrir a personagem) e enfeites de parede ficam presos à parede.
Consequência: `data/tiles.meta.json` (nosso) define `solid` e `layer` (`floor`, `wall`, `object`) de cada tile. `tiles.csv` fica igual ao do pacote. `build-tiles` junta os dois em `data/tiles.json`. Só a camada `object` entra no y-sort.

## 012. Bordas do mapa são limite (nov/2026)
Motivo: o desenho do café não tem paredes nas laterais nem embaixo.
Consequência: a personagem colide com os limites do mapa, além das células sólidas.

## 013. Interface em HTML por cima do canvas (nov/2026)
Motivo: texto desenhado num canvas de 640 x 360 fica borrado ou serrilhado. Em HTML fica nítido em qualquer escala, e é a área de conforto da desenvolvedora.
Consequência: `src/game/ui/` usa HTML + CSS (cores da paleta Cosy) num `#ui` escalado junto com o canvas. Mostra o estado da sessão e repassa cliques; não decide regras. Quando o Cosy UI Kit entrar, as molduras podem virar `border-image`.

## 014. História como dados: condição -> efeito (nov/2026)
Motivo: escrever e reordenar a história sem mexer em código.
Consequência: `data/story.json` (marcos, metas), `data/dialogue.json` (falas). O motor (`src/core/story.ts`) só avalia condições; a `GameSession` aplica os efeitos. Formato em `DATA_CONTRACTS.md`.

## 015. A loja começa vazia; móveis são da jogadora (nov/2026)
Motivo: o começo da história é a compra da padaria vazia, e decorar é parte central do jogo.
Consequência: `data/maps/cafe_main.json` tem só o prédio (paredes, piso, janelas, porta, balcão). Móveis comprados ficam no save (`placed`) e são somados ao mapa por `withPlaced`.

## 016. Save antecipado (era o Marco 3) (nov/2026)
Motivo: sem save, os móveis e o dinheiro sumiriam ao recarregar.
Consequência: save v1 com fixture em `tests/fixtures/save_v1.json`, armazenamento assíncrono em `src/platform/`, salvamento automático a cada mudança.

## 017. Modo debug só no desenvolvimento, com save separado (nov/2026)
Motivo: testar com atalhos (dinheiro, pular falas, ver colisão) sem que nada disso chegue à jogadora nem estrague o save "de verdade".
Consequência: F9 (ou `?debug=1`) liga/desliga em `npm run dev`. O debug usa o slot de save `slot-debug`; o normal usa `slot1`. O painel é carregado por import dinâmico e o Vite o remove do build; o plugin `stripDevNotes` (vite.config.ts) tira os `devNote` dos JSON no build. Notas para a equipe vão em `devNote`, nunca no texto da jogadora; o `npm run check` acusa "marco", "debug", "TODO"... em textos da jogadora.

## 018. A loja começa velha e sem balcão (nov/2026)
Motivo: a história começa numa padaria abandonada; montar o balcão e reformar fazem parte do progresso.
Consequência: o mapa base usa os tiles velhos (`*_old`, gerados por `npm run art`) e não tem balcão. As peças do balcão estão no catálogo (seção "Balcão", tag `counter`). O piso de madeira velha marca onde ficava o antigo balcão.

## 019. Pintor fica pronto na hora; save v2 (nov/2026)
Motivo: ainda não há ciclo do dia (Marco 2).
Consequência: `GameSession.paint` aplica o acabamento na hora e emite `surface.painted`. Quando houver dia, dá para trocar por "pronto amanhã" sem mudar o formato dos dados. O save subiu para v2 (campo `finishes`), com migrador da v1 e fixtures das duas versões.

## 021. Metas como subconsciente (nov/2026)
Motivo: o "diário" soava como lista de tarefas; o tom do jogo é íntimo e aconchegante.
Consequência: o painel vira um balão de pensamento ("subconsciente") e os textos das metas em `data/story.json` são escritos como pensamentos dela, em 1ª pessoa.

## 022. Sem renda, nada de ficar presa: pintor depois da Dona Lurdes e devolução total (nov/2026)
Motivo: antes dos clientes (Marco 4) não há como ganhar dinheiro; gastar tudo cedo travava a primeira meta.
Consequência: o pintor só aparece com a flag `painter.available` (`data/finishes.json: unlockFlag`), dada pela visita da Dona Lurdes, que indica o sobrinho pintor. Itens da bolsa podem ser devolvidos com `refundRate` (`data/economy.json`, hoje 1 = 100%). Quando houver renda, dá para baixar o reembolso só nos dados.

## 023. O jogo começa na rua; vários mapas com portas (nov/2026)
Motivo: a história começa diante da padaria velha, e a vizinhança é parte do jogo.
Consequência: `data/maps/street.json` (30 x 11, inverno) com as fachadas e objetos do pacote da rua; `data/world.json` diz onde começar e qual mapa é o café. O catálogo de tiles aceita várias folhas (`data/tilesets.json`). Uma única `WorldScene` troca de mapa pelas portas (sem reiniciar interface nem save) e a câmera segue a personagem quando o mapa é mais largo que a tela. O catálogo (C) só abre dentro do café. Save v3 (`location`, `visited`, `cleaned`).

## 024. Faxina por clique; manchas saem com a reforma (nov/2026)
Motivo: dar sensação de progresso no café abandonado e um motivo para chamar o pintor.
Consequência: sujeira em `dirt` no mapa do café (pacote sujeira, gerado por IA). Teias, poeira, papéis, cacos e o balde saem com clique de perto (meta "Uma boa faxina", antes do cantinho quente). Manchas na parede, rachaduras e o buraco de rato têm `clearedBy` e somem quando a superfície é reformada. Saves antigos vêm com `cleaned: ["*"]` (já limpos).

## 025. Bairro: Vila das Baunilhas (nov/2026)
Motivo: decisão da desenvolvedora (prólogo novo: o bairro onde a protagonista nasceu).
Consequência: o bairro do jogo é a Vila das Baunilhas; "Rua das Amoras" saiu das falas. O nome do jogo continua Biscuit Paws (decisão 009, definitiva).

## 026. Prólogo com cenas em HTML; gatos do Cosy Cats; nome escolhido pela jogadora (nov/2026)
Motivo: o prólogo tem momentos sem mapa (pensamentos, celular); a Tekinha e os gatos de rua precisam de sprites; cada gato novo é especial.
Consequência: `data/cutscenes.json` + `CutsceneView` (HTML por cima do jogo, mundo pausado). Tekinha = Misty (só lembrança); o gatinho de rua = Marmalade. Gatos têm id permanente (`cat.first_stray`); ao abrigar um gato novo abre uma caixa de nome com sugestão (`nameSuggestions`), e o nome vai para o save.

## 027. Itens de gato só depois do primeiro gato; gatos andam sozinhos (nov/2026)
Motivo: comprar caminha e tigelas antes de existir gato não fazia sentido na história.
Consequência: itens com `requires` (núcleo recusa a compra com `locked`; o catálogo esconde). A porta de dentro tem `intercept`: depois da faxina mostra o gatinho (`cs.meow_door`), que é abrigado, recebe nome (caixa com sugestão) e passeia pelo café (`nextCatGoal` no núcleo, com RNG). Corações genéricos por par (`relationships`). Save v4.

## 028. Mercado com caixa por interação (nov/2026)
Motivo: no prólogo não há ração; ela precisa ir ao mercado. Também prepara o sistema de interação (veterinário, vizinhos, gatos).
Consequência: `data/maps/market.json` convertido da cena do `mercado_interior` (20 x 12; entrada embaixo, porta com `direction: down`). Pontos de interação no mapa (tecla E ou clique de perto); o caixa abre a loja (`data/shops.json`) com ícones do `catalogo_compras`. Itens consumíveis (ração, petisco, areia) compram-se só ali. A câmera segue a personagem também na vertical quando o mapa é mais alto que a tela.

## 029. Fim do prólogo: alimentar, coração, cartão e fim do dia (nov/2026)
Motivo: fechar o prólogo como no roteiro, com o primeiro vínculo e o cartão "menos um gatinho...".
Consequência: tigela de ração (tag `food_bowl`) usada com E ou clique de perto gasta uma ração (tag `food`) e dá `feedPoints` de afeto. O efeito `endDay` passa o dia (`day.ended`); por enquanto ela "vai para casa" só no texto e amanhece no café. Cenas pedidas durante uma fala esperam a fala acabar (fila única na interface). O cantinho quente do Ato 1 virou caminha + almofada (as tigelas são do prólogo).

## 030. Tekinha usa o Pebble (nov/2026)
Motivo: pedido da desenvolvedora (lembra mais a gatinha dela).
Consequência: `cat.tekinha` passa da variante `misty` para `pebble` (Cosy Cats). A decisão 026 continua valendo no resto.

## 031. A corretora entrega a chave; roteiros no mundo (nov/2026)
Motivo: a compra precisava acontecer em cena, com uma pessoa, e não só em narração.
Consequência: `data/scripts.json` + `ScriptRunner` (NPCs andam, acenam, falam; todos entram com fade; item grande no centro). Primeiro NPC: a corretora (pacote `corretora_e_vassoura`, gerado por IA). A chave vem do roteiro, não mais da fala de chegada. O marco `story.enter_bakery` (id mantido) agora conclui quando o roteiro termina.

## 032. Varrer com a vassoura (nov/2026)
Motivo: limpar com um clique seco não dava sensação de trabalho; o pacote traz a vassoura animada.
Consequência: a corretora entrega `item.broom` (ferramenta). Clicar na sujeira de perto confere no núcleo (`cleanProblem`), toca a varrida (vassoura na mão, poeira, brilho, ~1,5 s, `data/tools.json`) e só então limpa. A personagem fica parada enquanto varre.

## 033. Ciclo dia/noite por cor e luzes (nov/2026)
Motivo: o prólogo precisa de noite de inverno; o dia precisa terminar (ir para casa) sem quarto ainda.
Consequência: `data/daynight.json` com horas-chave e ajuste por estação (inverno escurece às 17h15 e é mais azul). Uma camada de cor em MULTIPLY cobre o mundo e as luzes do mapa (`lights`) somam brilho com ADD conforme escurece; mapas `indoor` recebem a cor mais fraca. O relógio anda 0,7 min por segundo, parado em falas e cenas. Às 2h o dia acaba sozinho. Fim do dia: tela "Você foi para casa." e ela amanhece na rua às 7h (`world.morning`); `world.sleepMap` é o gancho para o quartinho. Save v5 (`time`).

## 034. A lousa da porta é comprada no catálogo online (nov/2026)
Motivo: pedido da desenvolvedora; a loja velha não deveria já ter a lousa do café.
Consequência: a lousa saiu da rua e virou `item.cafe_sign` (kind `fixture`, seção "Fachada"). Comprada, aparece sozinha na porta (objeto do mapa com `when`). O catálogo diz que é compra online e a entrega chega no café. A meta da faxina mostra quantas teias e sujeiras faltam (ex.: 1/4).

## 035. Dia 2: a Gabi e o Joca; Dona Lurdes em cena (nov/2026)
Motivo: pedido da desenvolvedora (mais marcos no dia 2) e novos pacotes de arte.
Consequência: marcos `story.gabi_call` (7h15 do dia 2, ligação no celular) e `story.gabi_visit` (a partir das 8h30, com ela no café): o Joca fareja o gatinho e a Gabi dá o conjunto de louças (`item.dishes_set`, kind `gift`). Condições `day`, `clock`, `location`. A Dona Lurdes deixou de ser só texto: entra no café por roteiro (`scr.lurdes_visit`). O mercado vende 19 itens de matéria-prima; as receitas ficam em `data/recipes.json` para o preparo futuro. Vassoura trocada pela do pacote `vassoura_nova`.

## 036. Primeiros dias: uma quest por vez, dinheiro com pedidos da vila (nov/2026)
Motivo: pedido da desenvolvedora. Os gatos entram pela história desde o anúncio; o dinheiro tem que vir aos poucos; uma coisa por vez no começo; a espera da Gabi não podia depender de uma ação impossível.
Consequência:
- O anúncio fala da "grande população de gatos" e ela deduz o problema; a fala do vizinho saiu da chegada.
- Ordem: cantinho quente (só a caminha) -> cafeteira (180) -> Dona Neusa (ex-Lurdes: `npc.neusa`, `scr.neusa_visit`; ela dá 50 e indica o pintor) -> no dia seguinte, mesas (60 cada) -> a Gabi liga e chega 90 min depois (`startTimer` + `{ timer }`, botão "Esperar"; chega onde ela estiver) -> cadeiras (sem evento).
- Marcos `exclusive` e `start`; condições `nextDay`, `timer`, `ownedTag`. `story.first_seats` e `npc.lurdes`/`scr.lurdes_visit` foram aposentados (nunca reaproveitar esses ids).
- Pedidos da vila em dados (`data/jobs.json`), jornal "Vila Hoje" no celular (`data/news.json`) e mural no mercado.
- Dia mais curto (1,2 min/s, ~16 min), ir para casa na porta do café depois das 17h, resumo do dia, desmaio às 2h acorda às 10h. Só falas, cenas e transições pausam o relógio; catálogo, loja e celular não (era um dos motivos da espera da Gabi parecer travada).
- Rotina: comida uma vez por dia e poeira que volta. Save v6.

## 037. Compras do catálogo chegam pelo correio (nov/2026)
Motivo: pedido da desenvolvedora; comprar e posicionar na hora não combinava com "comprando online".
Consequência: `data/delivery.json`; o catálogo encomenda (1h, das 9h às 18h, no máximo 3 caixas a caminho ou na porta). O furgão e a entregadora (pacote `correio`, gerado por IA na paleta Cosy; a folha veio ampliada 4x e o furgão 2x, reduzidos por amostragem) deixam as caixas empilhadas na porta; ela pega, leva para dentro e abre uma de cada vez. A Dona Neusa vem quando a caixa da cafeteira entra no café; a Gabi liga quando as duas mesas chegam na porta. Condições `received`, `delivery`, `deliveryTag`; `owned` conta encomendas. Save v7.

## 038. Atendimento, Fase 1: cardápio, mãos e louça (nov/2026)
Motivo: pedido da desenvolvedora (cardápio e itens carregáveis, em duas fases).
Consequência: `src/core/recipes.ts` (tipos e validação), `carry.ts` (mãos), `service.ts` (CafeService: cardápio, pedidos, preparo, louça, clientes; puro, com RNG com semente). Chá com bule e suco com liquidificador (pacote `equipamentos`, gerado por IA na paleta Cosy, 6 quadros animados); pia do pacote `pia` (antes um placeholder gerado por código). A louça da Gabi são 6 peças no total. O primeiro cliente só vem depois das cadeiras, com cafeteira, mesa e cadeira; a quest "O primeiro cliente" abre o café (`cafe.open`). Clientes provisórios: o sprite da personagem tingido. Doses por pacote (`servings`). Save v8.

## 039. Tela inicial, slots de save com backup e som (nov/2026)
Motivo: pedido da desenvolvedora (Home, menu principal, saves recuperáveis, opções de som).
Consequência: cenas Boot (barra de carregamento) -> MainMenu (rua no inverno ao entardecer, neve, postes acesos) -> World. Menus em HTML (`src/game/ui/menu/`) com teclado, mouse e toque. Saves: 3 slots manuais + autosave, backup da versão anterior, restaurar, exportar/importar .json (validado), corrompido não trava (`src/core/saveSlots.ts`, `src/game/SaveManager.ts`, `src/platform/files.ts`). O campo de versão continua `schemaVersion`. Slot manual grava no fim do dia e no "Salvar" da pausa; o autosave grava sempre. Som em dois canais com fade (`src/game/audio/AudioManager.ts`), sem arquivos ainda. Textos em `data/i18n/pt-BR.json`. O criador de personagem (pacote `personagem_principal`) fica para a próxima etapa, chamado pelo "Novo jogo".

## 040. Barra de itens e mochila em grade; varrer exige a vassoura ativa (nov/2026)
Motivo: ao clicar na neve, nada indicava qual item ela usava; pedido da desenvolvedora por uma mochila visual onde se escolhe o item da ação.
Consequência: barra fixa de 8 espaços embaixo da tela (teclas 1 a 8, roda do mouse, clique; some durante falas e cenas). A mochila (I) virou uma grade de ícones; clicar num item põe no espaço ativo (troca de lugar se já estava na barra). Varrer (sujeira do café e neve dos pedidos) só funciona com a vassoura no espaço ativo, regra no núcleo (`cleanProblem`, `doJobPoint`). Clicar num ponto de pedido de longe avisa "mais perto". Save v10 (`hotbar`). Apertar E, conversar e o resto continuam sem exigir item.

## 041. Mais pedidos da vila para juntar a cafeteira (nov/2026)
Motivo: jogando, os 4 pedidos diários não davam para a cafeteira (180) mais o balcão (25), ainda mais com dois deles presos atrás do vaso da rua.
Consequência: 8 pedidos diários depois do prólogo (entre 20 e 35 moedas cada): duas entregas novas (casa de tijolos e casa do fim da rua), neve na porta do mercado e caixotes do mercado. Um teste garante folga de 50 moedas sobre cafeteira + balcão num dia de pedidos. A caixa das entregas aparece no estoque (`sprite` do ponto) e acima da cabeça dela enquanto leva (`carrySprite` do item). A barra de itens sobe para o topo quando a personagem chega perto da beira de baixo da tela, para não tampar o chão.

## 042. Carrinho no mercado, estágios do negócio e capacidade pela louça (nov/2026)
Motivo: pedido da desenvolvedora (compras estilo e-commerce; placa só na inauguração; a Gabi dá a louça inicial; comer só sentado).
Consequência: prateleiras põem no carrinho e o caixa cobra tudo de uma vez; o carrinho fica ao sair do mercado, esvazia ao dormir e não vai para o save. `state.business` (save v11): fechado -> funcionamento parcial (cafeteira, 1 mesa, 1 cadeira, sem placa) -> inaugurado (marco story.inauguration: reforma completa + placa). Sai o teto fixo `maxCustomers`: a capacidade vem dos lugares e da louça por tipo (`servedAt`: beber em pé ou sentado, comer só sentado). A Gabi dá 6 xícaras, 6 copos e 6 pratos. Café, chá e suco do mercado continuam sendo os ingredientes que já existiam (ícones do pacote matéria-prima).

## 043. Usar itens da barra e evolução das receitas (nov/2026)
Motivo: a ração ia da mochila para a tigela sem a personagem fazer nada; e o quadro mostrava tudo logo de cara (pedido: começar com poucos itens e ir expandindo).
Consequência: itens com `use` (ração, petisco) entram sozinhos na barra; alimentar exige a ração ativa (a escolhida é a que vai, simples ou premium) e o petisco ativo vai direto ao gato. A cena toca a animação (ícone na mão, inclina, grãos caindo) e só então o núcleo confirma, como na varrida. Receitas destrancam por clientes atendidos, com aviso; o equipamento e os ingredientes aparecem no catálogo e no mercado junto com a receita que usa eles. As flags `recipe.*` antigas (nada acendia) saíram. Veterinário fica no roadmap.

## 044. Mochila em grade de espaços, ligada à barra (nov/2026)
Motivo: a mochila em cartões com nome e textos ficava poluída e parecia separada da barra (pedido da desenvolvedora, opção A de três).
Consequência: painel no centro com a barra (1 a 8) em cima e a grade da mochila embaixo, só ícone e quantidade; móveis guardados também entram na grade (miniatura do tile). Uma linha de detalhes mostra nome, para que serve e as ações (pôr na barra no primeiro espaço livre, tirar da barra, posicionar, segurar, bandeja). Arrastar da mochila para um espaço põe ali; dentro da barra troca; da barra para a grade tira. Com um item selecionado, 1 a 8 põe naquele espaço. A barra só ganha sozinha o que acabou de chegar: o que ela tirou de propósito não volta. Sem save novo (a barra já está no v10).

## 045. Personagem principal personalizável, com nome e poses (nov/2026)
Motivo: pedido da desenvolvedora (usar o pacote personagem_principal; escolher atributos no menu).
Consequência: Novo jogo -> slot -> criar personagem (nome + aparência, só no início do jogo) -> prólogo. A aparência vai para o save (v12) só como IDs; o jogo monta a folha das camadas ao começar. Sai a personagem provisória. As 7 poses do pacote entram já: bandeja e gato no colo andando; varrer, lavar, operar equipamento, mexer no fogão e recolher louça como animações curtas. O nome aparece nas falas ({player}).

## 046. Assets organizados por função, nomes em inglês e 16x16 só para itens pequenos (nov/2026)
Motivo: auditoria dos assets (`docs/ASSET_AUDIT.md`): pastas por pacote de entrega, nomes misturando português e inglês, sobras sem uso em `public/assets/`.
Consequência: os pacotes ficam intactos em `assets/_originais_pacotes/`; `public/assets/` passa a ter só o que o jogo carrega, por função (`env/`, `interiors/`, `objects/`, `characters/`, `ui/`, `icons/`), com nomes `prefixo_assunto_estado_estação` em inglês (`docs/ASSET_REORGANIZATION.md`). Sobras sem uso vão para `assets/_fora_do_jogo/` (guardadas, não apagadas). As camadas do criador de personagem mantêm os nomes do pacote (são os `asset` de `data/character.json`). A migração é feita por `scripts/migrate-assets.ts` (simulação por padrão, `--apply`, `--undo` pelo log em `assets/_migracao/`). Exceção à grade de 32: itens de fato pequenos (louça nas mesas, moeda, ícones pequenos) podem ser 16x16, desde que o pixel tenha o mesmo tamanho do resto (nada ampliado). A senhorinha se chama Dona Neusa em todo lugar. Próximo passo (outro pedido): dados citarem IDs de asset (`art.*`) via `data/assets.json`.

## 047. App "Meus gatos" no celular (nov/2026)
Motivo: pedido da desenvolvedora: ver os gatos abrigados e a relação com cada um.
Consequência: o celular (P) ganhou apps no topo: "Vila Hoje" (como antes) e "Meus gatos". Cada gato abrigado tem uma ficha com o gato sentado e animado (Cosy Cats, linha "sit"), nome, personalidade (textos em ui_text.json: cats.personalities), corações (0 a 10, "3/10"), se comeu hoje e há quantos dias está no café. A Tekinha, que é só lembrança, não aparece. Núcleo: `session.catProfiles()`. Save v13: `cats[].shelteredOn` (o migrador põe 1).

## 048. Saúde dos gatos e a clínica da Fernanda no dia 6 (nov/2026)
Motivo: pedido da desenvolvedora: barra de saúde, gato doente precisa de consulta, remédio por alguns dias e a clínica chegando no meio da primeira semana.
Consequência: saúde de 0 a 100 (`data/health.json`), que cai por descuido (dia sem comer), por eventos aleatórios (depois do dia 9, com a clínica aberta) e em gatos que já chegam doentes (`arrivesSick`); abaixo de 30, doença fictícia sorteada com semente. No dia 6, ao entrar no café, o primeiro gato adoece e a Fernanda chega (roteiro `scr.fernanda_visit`); a meta "Gatinho doente" é exclusiva e pausa a corrente principal até ele sarar (uma quest por vez). A clínica fica no fim da rua (rua com 36 colunas; porta trancada até `clinic.open`), com interior próprio (`map.vet_clinic`) e a Fernanda fixa ao lado da mesa de exame (campo novo `npcs` no mapa). Consulta com o gato no colo: diagnóstico, receita de 1 a 7 dias sorteados, consulta + remédio pagos na saída; a primeira pode ser fiado (metade de cada ganho paga). Remédio é item da barra (`use: "medicine"`), uma dose por dia. "Meus gatos" mostra a barra de saúde e a doença. Save v13 (junto com `shelteredOn`). Ninguém morre: é um jogo aconchegante.
Prejuízo (pedido da desenvolvedora): gato doente sem tratamento há mais de 2 dias passa a doença para os outros (50% por gato por dia); com 2 ou mais gatos doentes, nenhum cliente novo entra no café. Em tratamento não transmite, para a jogadora sempre poder conter o contágio levando à clínica (`contagion.onlyUntreated` nos dados).

## 049. Cômodos do café: planta contínua, descoberta, obra e reforma (nov/2026)
Motivo: pedido da desenvolvedora (expansão do café: quartinho e quintal secreto, sistema por dados).
Consequência: o café vira um mapa só com áreas por cômodo (`data/rooms.json`); a câmera é contínua dentro dele e só mostra o que ela conhece. Estados locked -> discovered -> abandoned -> restored, com gatilhos de descoberta e um momento (fala + câmera + destaque). Dois custos: abrir (obra) e terminar a reforma (depois de limpar). Capacidade de gatos = soma dos cômodos abertos; a de clientes é só informação. Dormir no café com o quartinho reformado. Ritmo (pedido da desenvolvedora): cômodos só depois da inauguração e de o café ter movimento (clientes atendidos, dias); são recompensas que facilitam a vida, não o começo do jogo. Quintal com variante visual por dados (sebe por padrão). Save v14 (`rooms`, `doors`).

## 050. Estações de 30 dias; inauguração na primavera; pele da interface e áudio (nov/2026)
Motivo: pedido da desenvolvedora: o inverno é o mês para organizar e reformar ("será que em 1 mês eu consigo inaugurar essa loja?"); a arte da inauguração é de primavera. Chegaram também a arte dos menus e o áudio.
Consequência: calendário por dados (30 dias por estação, sem mudar o save); a rua troca de folhas com a estação; a fachada do café entra no pintor (a cor dela aparece na rua e escolhe a arte da inauguração, quando houver); a inauguração exige a primavera, com cena própria e jingle. Os cômodos deixam de pedir dias (a inauguração já é na primavera). Menus com molduras de 9 partes do pacote (sem logo por enquanto: o do pacote diz "CAT CAFE"). Áudio por dados: músicas de dia e de noite, ambientes, jingles e efeitos ligados a eventos.

## 051. Estilo visual novo, desenhado por código; itens assentados; cadeiras de lado (nov/2026)
Motivo: feedback de que o gráfico estava "muito quadrado"; referência enviada pela desenvolvedora (interior aconchegante com volume, luz de um lado e paleta quente).
Consequência: a arte passa a ser redesenhada por scripts em `scripts/art/` (paleta em `palette.ts`, primitivas em `lib.ts`): volume com tampo visível, luz de cima à esquerda, contorno marrom-escuro, madeira escura e acentos pastel. Cada folha mantém o mesmo tamanho e as mesmas posições, então mapas e dados não mudam; a folha anterior fica em `assets/_estilo_antigo/`. Fase 1: folha do café (`npm run art:cafe`); piso xadrez trocado por ladrilho pequeno de pouco contraste, para não marcar a grade. Itens que pareciam flutuar: sujeira aceita `lift` (negativo desce; o buraco de rato encosta no rodapé) e a registradora e o leitor do mercado sobem para o tampo do balcão. Cadeiras de perfil (`item.chair_left`, `item.chair_right`) com a tag `chair`, contadas como lugar. Próximas fases: balcões/equipamentos/louça, rua nas 4 estações, mercado e clínica, sujeira/ícones/interface e, por último, personagens e gatos.

## 052. Arte em 64 px por tile: canvas de 1280 x 720 com a lógica em 640 x 360 (nov/2026)
Motivo: a arte gerada no novo estilo perde o detalhe quando reduzida para 32 px por tile (comparação com 32 e 64 px); a desenvolvedora escolheu 64.
Consequência: `src/game/screen.ts` define `RENDER_SCALE` (2): o canvas tem 1280 x 720 e a câmera de cada cena usa zoom 2, então mapas, colisão, posições, saves e a interface HTML continuam em 640 x 360 e tile de 32. Objetos fixos na tela e rolagem direta da câmera usam `SCREEN_OFFSET_X/Y` (o zoom é a partir do centro, que é o que o seguir e os limites da câmera do Phaser suportam). Os testes de navegador abrem o jogo com `?escala=1` (sem placa de vídeo, 1280 x 720 cai para ~30 quadros/s) e têm 60 s de limite; a conferência visual roda em escala 2. Cada folha tem uma resolução (1 = 32 px, 2 = 64 px), tirada do `tileSize` do JSON de peças em `data/tilesets/` (32 ou 64; outro valor é erro do `npm run check`). Mapas, itens e saves continuam em tiles; o Phaser carrega a folha com quadros de 64 e desenha cada um na escala 0.5 (`src/game/tileArt.ts`), inclusive o fantasma de posicionar e as animações de equipamento e pia. As miniaturas HTML já usam tamanho fixo e não mudam. As folhas vão sendo trocadas uma a uma; a primeira em 64 px é o lote de teste do PixelLab (`npm run pixellab`).

## 053. Mini games: framework e o primeiro, Gato em fuga (nov/2026)
Motivo: pedido da desenvolvedora: mini games disparados por missões, com recompensa em moedas (fase 1: Gato em fuga, Pescaria e Latte art; começar pelo framework e pela fuga).
Consequência: regras no núcleo (`src/core/minigame.ts`: contrato de resultado, dificuldade, cronômetro `Countdown` avançado pela cena, moedas pelos dados; `src/core/chase.ts`: decisões do gato e resultado), números em `data/minigames.json`. Na tela, `MiniGameScene` (instruções -> jogando -> resultado, Esc pausa, "Pular" com 25% das moedas de "ok") e `MiniGameRegistry` (abre por id por cima do mundo, que fica pausado, e devolve o resultado); a interface deles é HTML com a moldura dos menus (nítida em qualquer escala). Controles passam por `MiniGameControls` (teclado e mouse hoje; gamepad depois entra só ali). Arte do pacote em 64 px desenhada na metade; o que faltar vira placeholder pela chave, sem mexer na lógica. A arena da fuga é um mapa de dados (segue a estação). Missão: ponto de pedido `action: "minigame"` (o ponto conta se não falhar); primeiro pedido: "Gatinho fujão" (`job.runaway_cat`). Atalho de teste: `?minijogo=chase&dificuldade=...` e botões no painel de debug.

## 054. Pescaria (nov/2026)
Motivo: segundo mini game da fase 1.
Consequência: lançar (E ou clique na água) -> esperar (boia balança) -> mordida ("!" e som; E dentro de biteWindowMs) -> barra de timing: segurar sobe o indicador, soltar cai; dentro da zona verde (o peixe, que se move) o progresso enche. Pescou: great com precisão >= greatAccuracy. Sorteio por raridade e física da barra no núcleo (`src/core/fishing.ts`, com semente), tabela de peixes nos dados; o peixe vira item (`item.fish_*`, ícones da folha do pacote) e vai para a mochila, e o valor dele soma às moedas (`makeResult` com `bonusCoins`/`itemId`; pular não traz peixe). Perdeu o peixe, lança de novo enquanto houver tempo. A cena base agora centra a câmera na área lógica (zoom da decisão 052). Placeholder: a pose da personagem pescando (o pacote não tem): ela fica na pose normal, virada para a água, com a vara desenhada por código. Ainda sem pedido no mundo (falta um lugar com água no mapa).

## 055. Latte art (nov/2026)
Motivo: terceiro mini game da fase 1.
Consequência: xícara vista de cima com um contorno-guia semitransparente (coração, patinha, estrela, folha) desenhado dos pontos dos dados (o `guias_pontos.json` do pacote, simplificado para um ponto a cada ~3 px); a jogadora desenha segurando o mouse (ou setas + E). Servir (Enter, botão ou fim do tempo) dá a nota no núcleo (`src/core/latte.ts`: cobertura do contorno e precisão do traço) -> 0 a 3 estrelas -> gorjeta somada às moedas. A xícara aparece no dobro da medida do pacote (`cupScale: 1`): na medida dele o contorno teria ~50 px e não dá para desenhar com o mouse. Correção junto: o ponteiro numa cena aberta por cima do mundo vinha em pixels do canvas; `MiniGameControls` converte pela câmera (vale para clicar no esconderijo e na água também). A cena base ganhou `hudButton` (o "Servir").

## 056. Catálogo vira o app Market do celular (nov/2026)
Motivo: o catálogo era uma lista estreita só de texto, difícil de ler; e comprar online combina com o celular.
Consequência: o celular (P) ganhou a moldura do pacote (`data/phone.json`, esticada pelas bordas com border-image, para a tela ficar maior sem borrar), barra de status e tela de início com os apps Vila Hoje, Meus gatos e Market. C abre direto no Market, em qualquer lugar (compra online); posicionar um item da bolsa continua só dentro do café. As abas ficam em `ui_text.json: market.tabs` (Pet = para os gatos; Móveis = balcão e vitrine + clientes; Eletro = tag `equipment`: cafeteira, bule, fogão, forno...; Decor; Construção = fachada + Obras + Reforma), cada uma com grupos por tag (`except` tira tags de um grupo). Cada item é um cartão em grade de 2 colunas com a miniatura recortada da própria folha de tiles (`ui/thumbs.ts`), nome, preço e estado (na bolsa, a caminho). A lógica do catálogo saiu do `GameUi` para `ui/MarketApp.ts`; o mural do mercado continua um painel simples.

## 057. Horário de funcionamento, calendário e a caixa de areia (nov/2026)
Motivo: o café abria num horário fixo, sem a jogadora saber nem escolher; ela podia ir para casa com clientes lá dentro; não havia como ver os dias importantes; e faltava a caixa de areia do gato.
Consequência: app **Horário** no celular, como um agendador: dias da semana e horas de abrir e fechar (de 30 em 30 min, entre 6h e 22h, pelo menos 2 h; regras em `service.json: schedule`), guardado no save (v15). Fora do horário não entra cliente novo e a fila vai embora; quem já está no lugar termina. Ela só encerra o dia (porta ou cama do quartinho) quando o último cliente sair (`goHomeProblem: customers_inside`); o desmaio das 2h continua valendo. App **Calendário**: a estação em grade (segunda a domingo; o jogo começa numa quarta), hoje, dias fechados pelo horário e marcações de `seasons.json` (começo das estações, Natal, Ano Novo, a inauguração); lista dos próximos 60 dias. O HUD mostra o dia da semana. **Caixa de areia**: no dia 2 aparece um cocô no salão (sujeira com `when`); recolher com a vassoura dispara a fala da "esquecida" e a meta "Um cantinho quente" pede a caixa de areia (Market, aba Pet, 15 moedas) e a caminha. Arte provisória desenhada por código (`npm run art:placeholders`), até a do PixelLab.
