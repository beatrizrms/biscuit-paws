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

## Tabela das etapas (para aprovar)

Hoje aparecem cedo **163 itens**: 134 sem requisito nenhum e 29 que só esperam ter um gato. Proposta, na ordem da
história (Market e mercado da vila iguais). Os itens de Natal e Halloween ficam como estão (já seguem a estação), e os
que já têm requisito (conquistas, cômodos) também.

| Etapa (quando entra) | Itens |
|---|---|
| **1. Primeiro gato** ("Água e comida") | Tigela de água, Tigela de ração, Ração simples |
| **2. Tudo que um gatinho precisa** (depois do cocô) | Caixa de areia, Areia, Caminha de gato |
| **3. Uma cafeteira** | Cafeteira, Balcão pequeno, Pó de café, Filtros de papel · e os cuidados básicos: Escova de pelo, Varinha de penas, Petisco de biscoito, Novelos, Arranhador |
| **4. Mesa e cadeira** | Mesa redonda, Cadeira |
| **5. Café aberto** (depois do primeiro cliente) | Equipamentos: Bule com fogareiro, Espremedor, Liquidificador, Forno, Fogão, Vitrine de doces · Louça: Xícaras, Copos, Pratos, Bandeja · Móveis de cliente: Mesa quadrada, Mesa quadrada grande, Mesa oval larga, Mesa alta redonda, Mesa alta quadrada, Bancada de parede, Balcão com caixa, Balcão verde pequeno, Balcão de ripas pequeno · Ingredientes: chás (caixas, saquinhos, lata), café em grãos (saco e a granel), frutas e polpas, açúcar, mel, leite, leite em pó, farinha, ovos, manteiga, chocolate, amêndoas, sal, óleo, calabresa, carne, frango · Gatos: Ração premium, Saco de ração, Ração 10 kg, Saco de areia, Areia 10 kg, Recovery, Cobertor de gato, Cercadinho de recuperação, Caixa de areia verde, Caixa pet, Caminha rosa, Caminha lilás, as 5 almofadas, Almofada capitonê, Toquinha, Arranhador de papelão, os 4 novelos avulsos, Cesta de novelos |
| **6. Inauguração** | Decoração: os 14 vasos e plantas, as 6 plantas penduradas, os 9 quadros e enfeites de parede (quadros, relógio, lousa, prateleira), os 3 tapetes, Estante de livros, Pilha de livros, Lampião, Regador, Cesta de piquenique · Sala: os 3 sofás e as 4 poltronas · Café: Geladeira de bebidas, Expositor de doces, de cupcakes e de macarons, Pote de biscoitos · Gatos: Pote de ração automático, Caixa de areia automática |

Ao entrar, cada item fica com a etiqueta **Novo** por 2 dias do jogo (regra geral, também para receitas novas), e um
aviso só por etapa: "Chegou coisa nova no Market".
