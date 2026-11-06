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
