// Receitas, cardápio e configuração do atendimento (data/recipes.json, data/service.json, data/carry.json).
// Puro: sem Phaser, DOM ou window. Quem decide se dá para fazer é o CafeService (service.ts).
import { dayInSeason, seasonOf, type SeasonsData } from './calendar';
import type { ReviewConfig } from './review';
import type { Cell } from './map';
import type { Condition } from './content';
import type { ScheduleRules } from './schedule';

/** Louça: xícara, copo, prato. */
export type Vessel = 'cup' | 'glass' | 'plate';
export const VESSELS: readonly Vessel[] = ['cup', 'glass', 'plate'];

/** Em pé (no balcão) ou sentado (mesa + cadeira + prato). */
export type ServiceKind = 'standing' | 'table';

/** Qualidade do que sai da cozinha: premium quando todos os ingredientes trocáveis são os melhores. */
export type Quality = 'simple' | 'premium';

/** Uma etapa do preparo: num equipamento, por um tempo. Entre etapas, ela leva a massa de um equipamento ao outro. */
export interface RecipeStep {
  equipment: string;
  minutes: number;
}

export interface RecipeDef {
  id: string;
  name: string;
  /** Ícone (data/icons.json). */
  icon: string;
  /** Ingrediente -> doses (um pacote rende `servings` doses, em items.json). */
  ingredients: Record<string, number>;
  /** Trocas premium: ingrediente simples -> o melhor (ex.: pó de café -> café em grãos). */
  premium?: Record<string, string>;
  /** Etapas, em ordem (café: cafeteira; pão de queijo: fogão e depois forno). */
  steps: RecipeStep[];
  /** A louça diz onde o cliente consome (service.json: servedAt): xícara/copo em pé ou na mesa; prato só na mesa. */
  vessel: Vessel;
  /** Preço de venda (premium multiplica, ver service.json). */
  price: number;
  /** Condição para aparecer no quadro (marco, equipamento comprado, cômodo restaurado...). */
  unlock?: Condition;
  /**
   * Outro jeito de fazer, só em receitas de uma etapa: noutro equipamento, com os próprios ingredientes, e sai sempre
   * premium (o suco de fruta fresca no espremedor; no liquidificador continua a polpa).
   */
  alternative?: { equipment: string; ingredients: Record<string, number> };
  /** Confeitaria: só entra no cardápio com uma vitrine no café (os doces ficam guardados nela até sair a fatia). */
  display?: boolean;
  /**
   * Fornada: o preparo rende o bolo inteiro (sem louça), que vai para a vitrine e vale `yields` fatias; o cliente
   * pede a fatia (esta receita). `name` e `icon`: o bolo inteiro.
   */
  batch?: { yields: number; name: string; icon: string };
  /** Quente ou gelada: os clientes pedem mais conforme a estação e o clima (service.json: demand). */
  temp?: 'hot' | 'cold';
  /** Só entra no cardápio nestas estações (sem o campo: o ano todo). */
  seasons?: string[];
  /** Só entra no cardápio nestes dias (ex.: a semana do Natal); `name` aparece no quadro e nos avisos. */
  window?: { season: string; from: number; to: number; name: string };
}

/** A receita está na época hoje? (estações e janela de dias; sem nada, o ano todo) */
export function inSeason(r: RecipeDef, seasons: SeasonsData, day: number): boolean {
  const season = seasonOf(seasons, day);
  if (r.seasons && !r.seasons.includes(season)) return false;
  if (r.window) {
    const d = dayInSeason(seasons, day);
    if (r.window.season !== season || d < r.window.from || d > r.window.to) return false;
  }
  return true;
}

/** Receitas em que o item é a troca premium (ex.: café em grãos no café preto), na ordem dos dados. */
export function premiumIn(recipes: Record<string, RecipeDef>, itemId: string): RecipeDef[] {
  return Object.values(recipes).filter((r) => Object.values(r.premium ?? {}).includes(itemId) || (r.alternative && itemId in r.alternative.ingredients));
}

export interface RecipesData {
  schemaVersion: 3;
  recipes: RecipeDef[];
}

/** Peso da procura por temperatura (hot/cold) numa estação ou num clima; o que não está aqui pesa 1. */
export type DemandWeights = Partial<Record<'hot' | 'cold', number>>;

export interface ServiceConfig {
  /** Os clientes pedem mais quente no inverno e na chuva, mais gelado no verão (multiplica o sorteio do pedido). */
  demand?: { seasons?: Record<string, DemandWeights>; weather?: Record<string, DemandWeights> };
  /** Avaliação ao sair (estrelas) e a reputação de cada nota (src/core/review.ts). */
  review: ReviewConfig;
  schemaVersion: 1;
  /** Quantos itens cabem no quadro do cardápio. */
  menuSlots: number;
  /**
   * Onde cada louça pode ser servida. Regra da casa: beber (xícara, copo) em pé ou na mesa; comer (prato) só na mesa.
   * A capacidade (capacity.ts) sai daqui, dos lugares e da louça: não há teto fixo.
   */
  servedAt: Record<Vessel, ServiceKind[]>;
  /** Horário de funcionamento: o padrão e as regras do app "Horário" (a jogadora escolhe; fica no save). */
  schedule: ScheduleRules;
  /** O primeiro cliente do dia chega depois de tantos minutos; os outros, num intervalo sorteado. */
  firstArrivalMinutes: number;
  arrivalEveryMinutes: [number, number];
  /** Quanto tempo o cliente espera o pedido antes de ir embora. */
  patienceMinutes: number;
  /** Lista de compras: ingrediente do cardápio com menos doses que isto é anotado (botão do cardápio). */
  shoppingListBelow: number;
  /** Sem pedido, ela pode adiantar uma receita; cada equipamento (o da 1ª etapa) só tem até tantos itens sem dono. */
  extraPerEquipment: number;
  /** Quebra: depois de minUses a maxUses usos (sorteado por equipamento); o Tião conserta na hora (preço e minutos). */
  breakdown?: { minUses: number; maxUses: number; repairPrice: number; repairMinutes: number };
  /** Quanto tempo ele fica consumindo. */
  consumeMinutes: Record<ServiceKind, number>;
  /** Quando o atendimento funciona (ex.: depois das cadeiras, com cafeteira, mesa e cadeira). */
  enabledWhen: Condition;
  /** Fila: onde esperam quando não há lugar livre (células do café). */
  queue: Cell[];
  /** Pia (célula do café). */
  sink: Cell;
  /** Armário da cozinha (despensa): a célula da frente, onde ela guarda os ingredientes e vê o que tem. */
  pantry: Cell;
  /** O armário e a pia como móveis dela (mudam de lugar): onde ficam num jogo novo e a célula da ação a partir do canto. */
  fixtures?: { item: string; at: Cell; use: Cell; role: 'pantry' | 'sink' }[];
  /** Quanta louça cabe na pia e quantos minutos leva cada peça. */
  sinkCapacity: number;
  washMinutesPerDish: number;
  /** Equipamentos: chave -> nome e tag do móvel posicionado que faz o papel. */
  equipment: Record<string, { name: string; tag: string }>;
  /** Tags dos móveis que são superfícies (balcão, mesa) e onde o cliente fica em pé. */
  surfaceTags: string[];
  standingTag: string;
  tableTag: string;
  chairTag: string;
  /** Louça: nome e ícones (limpa e suja). */
  vessels: Record<Vessel, { name: string; icon: string; dirtyIcon: string; dirtyName: string }>;
  /** NPCs que podem aparecer como cliente (sorteados). */
  customerLooks: string[];
  /** Premium vende mais caro. */
  premiumPriceMultiplier: number;
  /** Gorjeta (fração do preço) quando o cliente fica satisfeito: atendido com paciência de sobra e na qualidade que gosta. */
  tipRate: number;
  tipPatience: number;
  /** Preferências sorteadas: um favorito do quadro e gostar de premium. */
  preferences: { favoriteChance: number; favoriteWeight: number; premiumLoverChance: number };
}

export interface CarryConfig {
  schemaVersion: 1;
  /** Quantos objetos cabem nas mãos. */
  carryCapacity: number;
  /** Quanto cada objeto na mão tira da velocidade (0.1 = 10%). */
  speedPenaltyPerItem: number;
  /** Bandeja: o item da mochila, quanta louça leva e a velocidade com ela. */
  tray: { item: string; capacity: number; speedFactor: number };
  /** Itens pesados (tag): ocupam as mãos sozinhos e deixam lenta. */
  heavy: { tag: string; speedFactor: number };
  /** Gato no colo. */
  cat: { speedFactor: number };
}

/** Por que uma receita não pode ser pedida agora. */
export type RecipeStatus = 'available' | 'locked' | 'season' | 'equipment' | 'ingredients' | 'vessel';

export function validateRecipes(
  recipes: RecipesData,
  service: ServiceConfig,
  carry: CarryConfig,
  refs: { items: ReadonlySet<string>; icons: ReadonlySet<string>; itemTags: ReadonlySet<string>; seasons?: ReadonlySet<string> },
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
    for (const [base, better] of Object.entries(r.premium ?? {})) {
      if (!(base in r.ingredients)) errors.push(`${where}: troca premium de "${base}", que não é ingrediente`);
      if (!refs.items.has(better)) errors.push(`${where}: item premium inexistente "${better}"`);
    }
    if (r.alternative) {
      if (r.steps.length !== 1) errors.push(`${where}: alternative só em receita de uma etapa`);
      if (!service.equipment[r.alternative.equipment]) errors.push(`${where}: equipamento inexistente "${r.alternative.equipment}" (alternative)`);
      if (r.alternative.equipment === r.steps[0]?.equipment) errors.push(`${where}: alternative no mesmo equipamento da etapa`);
      if (Object.keys(r.alternative.ingredients).length === 0) errors.push(`${where}: alternative sem ingredientes`);
      for (const [item, n] of Object.entries(r.alternative.ingredients)) {
        if (!refs.items.has(item)) errors.push(`${where}: item inexistente "${item}" (alternative)`);
        if (!Number.isInteger(n) || n < 1) errors.push(`${where}: doses inválidas de "${item}" (alternative)`);
      }
    }
    if (r.batch) {
      if (!r.display) errors.push(`${where}: fornada (batch) precisa de display (a vitrine guarda o bolo)`);
      if (!Number.isInteger(r.batch.yields) || r.batch.yields < 2) errors.push(`${where}: batch.yields precisa ser 2 ou mais`);
      if (!refs.icons.has(r.batch.icon)) errors.push(`${where}: ícone do bolo inteiro inexistente "${r.batch.icon}"`);
    }
    for (const s of r.seasons ?? []) if (refs.seasons && !refs.seasons.has(s)) errors.push(`${where}: estação inexistente "${s}"`);
    if (r.window) {
      if (refs.seasons && !refs.seasons.has(r.window.season)) errors.push(`${where}: janela numa estação inexistente "${r.window.season}"`);
      if (!(r.window.from >= 1 && r.window.to >= r.window.from)) errors.push(`${where}: janela de dias inválida`);
    }
    if (r.temp && r.temp !== 'hot' && r.temp !== 'cold') errors.push(`${where}: temp precisa ser hot ou cold`);
    if (r.steps.length === 0) errors.push(`${where}: sem etapas`);
    for (const s of r.steps) {
      if (!service.equipment[s.equipment]) errors.push(`${where}: equipamento inexistente "${s.equipment}"`);
      if (!(s.minutes > 0)) errors.push(`${where}: etapa sem tempo`);
    }
    if (!VESSELS.includes(r.vessel)) errors.push(`${where}: louça inválida "${r.vessel}"`);
    if (!(r.price > 0)) errors.push(`${where}: preço precisa ser positivo`);
  }
  if (!(service.menuSlots >= 1)) errors.push('service: menuSlots precisa ser 1 ou mais');
  if (!Number.isInteger(service.extraPerEquipment) || service.extraPerEquipment < 0) errors.push('service: extraPerEquipment precisa ser um inteiro, 0 ou mais');
  const b = service.breakdown;
  if (b && !(Number.isInteger(b.minUses) && b.minUses >= 1 && Number.isInteger(b.maxUses) && b.maxUses >= b.minUses && b.repairPrice >= 0 && b.repairMinutes > 0)) {
    errors.push('service: breakdown precisa de minUses >= 1, maxUses >= minUses (inteiros), repairPrice >= 0 e repairMinutes > 0');
  }
  for (const v of VESSELS) {
    const at = service.servedAt?.[v] ?? [];
    if (at.length === 0 || at.some((k) => !['standing', 'table'].includes(k))) errors.push(`service: servedAt "${v}" precisa de "standing" e/ou "table"`);
  }
  if (!(service.sinkCapacity >= 1) || !(service.washMinutesPerDish > 0)) errors.push('service: sinkCapacity e washMinutesPerDish precisam ser positivos');
  if (!(service.premiumPriceMultiplier >= 1) || !(service.tipRate >= 0)) errors.push('service: premiumPriceMultiplier >= 1 e tipRate >= 0');
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
  if (!refs.items.has(carry.tray.item) || !(carry.tray.capacity >= 1)) errors.push('carry: bandeja inválida');
  if (!refs.itemTags.has(carry.heavy.tag)) errors.push(`carry: nenhum item tem a tag de pesado "${carry.heavy.tag}"`);
  return errors;
}
