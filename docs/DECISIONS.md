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
