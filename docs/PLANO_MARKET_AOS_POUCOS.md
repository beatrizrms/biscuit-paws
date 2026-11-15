# Plano: o Market mostra as coisas aos poucos

Pedido de 2026-11-15, depois de um teste com outra pessoa: no começo o Market tem coisa demais e ela se perde.
Hoje há 235 itens à venda e **148 não têm requisito nenhum**: aparecem todos desde o primeiro dia.

## Ideia

O Market mostra só o que a meta da vez pede, mais o básico dos gatos. O resto vai entrando conforme a história anda,
com um aviso curto ("Chegou coisa nova no Market") e a etiqueta **Novo** nos cartões (já existe para receitas no
cardápio).

| Etapa (o que libera) | O que entra no Market |
|---|---|
| Começo (o primeiro gato) | Tigela de água, tigela de ração, ração, caixa de areia, areia, caminha |
| Meta da cafeteira | Balcão (módulo único) e a cafeteira |
| Meta da mesa e cadeira | Mesa redonda e cadeira (as que servem juntas) |
| Primeiro cliente (café aberto) | Os outros equipamentos de bebida, louça, vitrine, mais mesas e cadeiras |
| Reparos com o Tião | Pisos, papel de parede, fachada (aba Construção) |
| Inauguração | Decoração (plantas, quadros, tapetes), os outros balcões e mesas |
| Depois (conquistas, como hoje) | Máquinas, robôs, playground, itens de estação |

A aba só aparece quando tem algo dentro (as abas da estação já fazem isso).

## Como fazer (sem mexer em IDs nem no save)

1. **Dados:** cada item ganha a etapa em que entra no Market (`market.from`: uma condição, como as de hoje em
   `requires`, apontando para o marco da história). Quem já comprou continua com o item; o save não muda.
2. **Tabela para aprovar:** os 148 itens sem requisito, cada um com a etapa proposta (gerada dos dados, em docs/).
   A Beatriz aprova ou move itens de etapa antes de qualquer mudança.
3. **Aviso e "Novo":** quando uma etapa libera itens, um aviso só ("Chegou coisa nova no Market") e a etiqueta Novo
   nos cartões até ela abrir o Market.
4. **Saves antigos:** quem já passou de uma etapa vê tudo dela na hora (a condição já vale).
5. **Testes:** no começo do jogo, o Market só tem o básico dos gatos; cada meta libera os itens dela; o item da meta
   da vez sempre está à venda (para nenhuma meta ficar impossível).

## Decidido (2026-11-15)

- O mercado da vila (a loja física) também mostra aos poucos, com as mesmas etapas.

- A etiqueta **Novo** fica **2 dias** (do jogo) no item; regra geral, vale também para as receitas novas do cardápio.
