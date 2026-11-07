// Receitas, cardápio e configuração do atendimento (data/recipes.json, data/service.json, data/carry.json).
// Puro: sem Phaser, DOM ou window. Quem decide se dá para fazer é o CafeService (service.ts).
import type { Cell } from './map';
import type { Condition } from './content';

/** Louça: xícara, copo, prato. */
export type Vessel = 'cup' | 'glass' | 'plate';
export const VESSELS: readonly Vessel[] = ['cup', 'glass', 'plate'];

/** Em pé (no balcão) ou sentado (mesa + cadeira + prato). */
export type ServiceKind = 'standing' | 'table';

export interface RecipeDef {
  id: string;
  name: string;
  /** Ícone (data/icons.json). */
  icon: string;
  /** Ingrediente -> doses (um pacote rende `servings` doses, em items.json). */
  ingredients: Record<string, number>;
  /** Equipamento (chave em service.json: equipment). */
  equipment: string;
  vessel: Vessel;
  service: ServiceKind;
  /** Minutos de jogo no equipamento. */
  prepMinutes: number;
  /** Preço de venda, em moedas. */
  price: number;
  /** Condição para aparecer no quadro (marco, equipamento comprado, cômodo restaurado...). */
  unlock?: Condition;
}

export interface RecipesData {
  schemaVersion: 2;
  recipes: RecipeDef[];
}

export interface ServiceConfig {
  schemaVersion: 1;
  /** Quantos itens cabem no quadro do cardápio. */
  menuSlots: number;
  /** Teto de clientes ao mesmo tempo (a louça limpa também limita). */
  maxCustomers: number;
  /** Horário em que entram clientes. */
  open: { from: string; until: string };
  /** O primeiro cliente do dia chega depois de tantos minutos; os outros, num intervalo sorteado. */
  firstArrivalMinutes: number;
  arrivalEveryMinutes: [number, number];
  /** Quanto tempo o cliente espera o pedido antes de ir embora. */
  patienceMinutes: number;
  /** Quanto tempo ele fica consumindo. */
  consumeMinutes: Record<ServiceKind, number>;
  /** Quando o atendimento funciona (ex.: depois das cadeiras, com cafeteira, mesa e cadeira). */
  enabledWhen: Condition;
  /** Fila: onde esperam quando não há lugar livre (células do café). */
  queue: Cell[];
  /** Pia (célula do café): a louça suja volta limpa. */
  sink: Cell;
  /** Equipamentos: chave -> nome e tag do móvel posicionado que faz o papel. */
  equipment: Record<string, { name: string; tag: string }>;
  /** Tags dos móveis que são superfícies (balcão, mesa) e onde o cliente fica em pé. */
  surfaceTags: string[];
  standingTag: string;
  tableTag: string;
  chairTag: string;
  /** Louça: nome e ícones (limpa e suja). */
  vessels: Record<Vessel, { name: string; icon: string; dirtyIcon: string }>;
  /** NPCs que podem aparecer como cliente (sorteados). */
  customerLooks: string[];
}

export interface CarryConfig {
  schemaVersion: 1;
  /** Quantos objetos cabem nas mãos. */
  carryCapacity: number;
  /** Quanto cada objeto na mão tira da velocidade (0.1 = 10%). */
  speedPenaltyPerItem: number;
}

/** Por que uma receita não pode ser pedida agora. */
export type RecipeStatus = 'available' | 'locked' | 'equipment' | 'ingredients' | 'vessel';

export function validateRecipes(
  recipes: RecipesData,
  service: ServiceConfig,
  carry: CarryConfig,
  refs: { items: ReadonlySet<string>; icons: ReadonlySet<string>; itemTags: ReadonlySet<string> },
): string[] {
  const errors: string[] = [];
  const ids = new Set<string>();
  for (const r of recipes.recipes) {
    const where = `recipes: "${r.id}"`;
    if (!r.id.startsWith('recipe.')) errors.push(`${where}: id deve começar com "recipe."`);
    if (ids.has(r.id)) errors.push(`${where}: id repetido`);
    ids.add(r.id);
    if (!refs.icons.has(r.icon)) errors.push(`${where}: ícone inexistente "${r.icon}"`);
    if (Object.keys(r.ingredients).length === 0) errors.push(`${where}: sem ingredientes`);
    for (const [item, n] of Object.entries(r.ingredients)) {
      if (!refs.items.has(item)) errors.push(`${where}: item inexistente "${item}"`);
      if (!Number.isInteger(n) || n < 1) errors.push(`${where}: doses inválidas de "${item}"`);
    }
    if (!service.equipment[r.equipment]) errors.push(`${where}: equipamento inexistente "${r.equipment}"`);
    if (!VESSELS.includes(r.vessel)) errors.push(`${where}: louça inválida "${r.vessel}"`);
    if (!['standing', 'table'].includes(r.service)) errors.push(`${where}: serviço inválido "${r.service}"`);
    // Regra da casa: em pé só com xícara ou copo; comer (prato) só na mesa.
    if (r.service === 'standing' && r.vessel === 'plate') errors.push(`${where}: em pé não usa prato`);
    if (r.vessel === 'plate' && r.service !== 'table') errors.push(`${where}: prato só na mesa`);
    if (!(r.prepMinutes > 0) || !(r.price > 0)) errors.push(`${where}: tempo e preço precisam ser positivos`);
  }
  if (!(service.menuSlots >= 1) || !(service.maxCustomers >= 1)) errors.push('service: menuSlots e maxCustomers precisam ser 1 ou mais');
  for (const [key, eq] of Object.entries(service.equipment)) {
    if (!refs.itemTags.has(eq.tag)) errors.push(`service: equipamento "${key}" usa tag que nenhum item tem ("${eq.tag}")`);
  }
  for (const tag of [service.standingTag, service.tableTag, service.chairTag, ...service.surfaceTags]) {
    if (!refs.itemTags.has(tag)) errors.push(`service: nenhum item tem a tag "${tag}"`);
  }
  for (const v of VESSELS) {
    const def = service.vessels[v];
    if (!def || !refs.icons.has(def.icon) || !refs.icons.has(def.dirtyIcon)) errors.push(`service: louça "${v}" sem ícones válidos (limpa e suja)`);
  }
  if (service.customerLooks.length === 0) errors.push('service: customerLooks vazio');
  if (!(carry.carryCapacity >= 1) || !(carry.speedPenaltyPerItem >= 0)) errors.push('carry: carryCapacity >= 1 e speedPenaltyPerItem >= 0');
  return errors;
}
