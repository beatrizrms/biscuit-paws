# Game Design: Biscuit Paws

> Documento vivo. Registre mudanças de rumo em `DECISIONS.md`.

## Pitch
Você ama gatos e comprou, com suas economias, uma padaria abandonada para transformá-la em um café de gatos. A história começa no **inverno natalino**, com gatos de rua congelando. Antes de reformar qualquer coisa, você precisa encontrá-los e abrigá-los na loja.

## Pilares
1. **Aconchego.** Sem fracasso punitivo: o jogo convida, não castiga.
2. **Gatos como personagens.** Cada gato tem personalidade, afeto e história.
3. **Comunidade.** A vizinhança começa desconfiada dos gatos de rua e vai mudando de ideia.
4. **Progresso visível.** O café melhora a cada dia: reforma, decoração, novos moradores.

## Tom e regras de narrativa
- **Sem fiscal/inspetor** como antagonista. A pressão é o próprio **inverno**.
- Meta suave: manter os gatos aquecidos até a **noite de Natal**. É um objetivo, **não uma condição de derrota**.
- Vizinhos têm preconceito com gatos de rua, mas aceitam uma chance e acabam gostando.
- Uma vizinha idosa lembra da loja como padaria, e isso rende falas e uma pista de história.

## Mundo
- Mapa inicial: **uma única rua curta** da **Vila das Baunilhas** (o bairro onde a protagonista nasceu), com a loja e poucos vizinhos.
- Clientes são **humanos**. Os **gatos vivem no café** (não são clientes).
- A loja tem ao menos duas fases: **abandonada** e **reformada**, feitas com a mesma planta.

## Ciclo de jogo (loop)
1. **Manhã:** procurar gatos de rua e abrigar na loja (início do jogo).
2. **Dia:** cuidar dos gatos (comida, água, cama, carinho), reformar e decorar.
3. **Abertura:** receber clientes, servir bebidas e doces, ganhar dinheiro e gorjetas (clientes que fazem carinho em gatos aguentam esperar mais e dão mais gorjeta).
4. **Noite:** fechar o dia, salvar, ver o que mudou.
5. **Adoção** (fase posterior): clientes podem adotar gatos, o que gera um evento e uma lembrança.

## Começo da história (Ato 1, "A chegada")
Rascunho; os textos ficam em `data/dialogue.json` e os marcos em `data/story.json`.
1. **Abertura:** dezembro, neve na Vila das Baunilhas, o bairro onde ela nasceu. Com as economias de uma vida, você compra a velha padaria da esquina, vazia. Sobram 150 moedas.
2. **Um cantinho quente:** caminha, tigela de água e tigela de ração (para o gato que ainda vai chegar).
3. **Um lugar para sentar:** uma mesa e duas cadeiras.
4. **Dona Lurdes:** a vizinha idosa aparece, lembra da padaria do seu Antônio, desconfia dos gatos de rua, mas deixa 50 moedas "para o começo".
5. **Um miado lá fora:** gancho para o Marco 1 (o primeiro gato).

O dinheiro inicial é apertado de propósito: dá para cumprir o ato e sobra pouco para decorar.

## Estações (em fases)
- **Fase 1:** só o inverno natalino (história inicial).
- **Fase 2:** primavera e verão, com novos visuais, clientes e eventos.
- **Fase 3:** outono e festivais.
- A estrutura de dados deve aceitar estações desde o início (campo `season` e `tags`), mesmo que só o inverno exista.

## Fora de escopo por ora
Multijogador, combate, mod tools, tradução para outros idiomas (preparar textos como dados, mas só PT-BR agora).
