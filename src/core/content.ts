// Tipos do conteúdo em data/*.json e validação das referências entre eles.
// Puro: sem Phaser, DOM ou window.
import { validateReview } from './review';
import { validateStorage, type StorageDef } from './storage';
import { validateCats, type CatDef, type CatsData, type CatSpritesData } from './cats';
import { validateFestivals, type FestivalDef, type FestivalsData } from './festival';
import { validateFairSetup, type FairSetupData, type FairSetupParams } from './fairSetup';
import { validateCostume, type CostumeData, type CostumeParams } from './costume';
import { validatePhoto, type PhotoData, type PhotoParams } from './photo';
import { cutsceneTexts, validateCutscenes, type CutsceneDef, type CutscenesData } from './cutscene';
import { validateScripts, type NpcDef, type NpcsData, type ScriptsData, type ScriptStep } from './script';
import { reachableCells, solidGrid, validateMap, type Cell, type MapData, type SurfaceDef, type SurfaceKind } from './map';
import { validateDayNight, type DayNightConfig } from './time';
import { validateCharacter, type CharacterData } from './appearance';
import { ROOM_STATES, validateRooms, type RoomsData, type RoomState } from './rooms';
import { validateSeasons, type SeasonsData } from './calendar';
import { BUSINESS_STAGES, validateBusiness, type BusinessData, type BusinessStage } from './business';
import { validateConstruction, type ConstructionData } from './construction';
import { NO_UPGRADES, validateUpgrades, type UpgradesData } from './upgrades';
import { validateRecipes, type CarryConfig, type RecipeDef, type RecipesData, type ServiceConfig, type Vessel } from './recipes';
import { validateJobs, type JobDef, type JobPoint, type JobsData, type NewsData } from './jobs';
import { validateHealth, type HealthConfig } from './health';
import { validateMiniGames, type MiniGamesConfig } from './minigame';
import { validateFishTable } from './fishing';
import { validateAdoption, validateCafeTraits, type AdoptionData } from './adoption';
import { validateArrivals, type ArrivalsData } from './arrivals';
import { validateCatProfiles, type CatProfilesData } from './catGen';
import { validateReputation, type ReputationConfig } from './reputation';
import { milestoneRefs, validateMilestones, type MilestonesData } from './milestones';

/** data/festive.json: a caixa de enfeites de Natal. */
export interface FestiveData {
  schemaVersion: 1;
  box: { item: string; tag: string; opensIn: string };
}
import { validateDelivery } from './delivery';
import { validateHideouts } from './kittenHunt';
import { validateLattePatterns } from './latte';
import type { RelationshipsConfig } from './relationships';
import type { TileCatalog } from './tiles';
import { validateScheduleRules } from './schedule';

/** furniture: vai para o café (catálogo). consumable: ração, remédio... key: chaves. */
/** fixture: peça de lugar fixo (ex.: a lousa da porta). Compra uma vez e aparece sozinha no mapa. */
/** gift: presente da história (não se compra nem se devolve). */
export type ItemKind = 'furniture' | 'consumable' | 'key' | 'tool' | 'fixture' | 'gift';

export interface ItemDef {
  id: string;
  name: string;
  price: number;
  /** Sem kind = furniture. */
  kind?: ItemKind;
  /** Tile do móvel no café (obrigatório para furniture). */
  tile?: string;
  /** Condição para poder comprar (ex.: itens de gato só depois de ter um gato). */
  requires?: Condition;
  /** Ícone (data/icons.json), para itens que não são móveis. */
  icon?: string;
  /** Imagem própria do ícone (ex.: a chave), quando não está na folha de ícones. */
  iconImage?: string;
  /** Quadro de data/emotes.json desenhado acima da cabeça dela enquanto tiver o item (ex.: a caixa de uma entrega). */
  carrySprite?: string;
  /** Uso a partir da barra (item ativo): "food_bowl" = encher a tigela; "litter_box" = pôr areia na caixa; "cat" = dar ao gato (petisco); "wand"/"brush" = abrir o cuidado no gato (varinha, escova). */
  use?: ItemUse;
  /** Ração: multiplica a saúde que o gato ganha no fim do dia por ter comido (health.json: daily.fed). Padrão 1. */
  healthMultiplier?: number;
  /** Ingredientes: doses que um pacote rende (padrão 1). */
  servings?: number;
  /** Vai em cima de outro móvel com esta tag (ex.: a cafeteira em cima do balcão, tag "bar"). */
  placeOn?: string;
  /** Vitrine: guarda `slots` doces (receitas com display); com algo dentro, desenha `fullTile` no lugar de `tile`. */
  display?: { slots: number; fullTile?: string };
  /** Só à venda nestas estações (a fruta fresca da época); sem o campo, o ano todo. */
  seasons?: string[];
  /** Só pode ser posicionado neste cômodo (ex.: módulos do playground no quintal). */
  room?: string;
  /** Lava-louças: quantas peças cabem e quanto dura um ciclo (qualquer quantidade). E deposita a louça suja / liga. */
  washer?: { capacity: number; cycleMinutes: number };
  /** Baú (a caixa pet): espaços e tags aceitas; E no móvel abre o baú dele (src/core/storage.ts). */
  storage?: StorageDef;
  /** Saco pesado: ao guardar no café, vira estas porções (ex.: 5 rações simples). */
  storesAs?: { item: string; qty: number };
  /** Conjunto de louça: quanto entra no estoque limpo ao receber (ex.: o presente da Gabi). */
  dishes?: Partial<Record<Vessel, number>>;
  /**
   * false: ao receber, não vai para a mochila (a chave da padaria só aparece na entrega; o presente da Gabi vira louça).
   * Fica a marca received.<id>, e a condição "owned" conta com ela (a porta do café pede a chave).
   */
  inBag?: boolean;
  tags: string[];
  deprecated?: boolean;
  /** Texto curto do que o item faz (loja, Market e mochila). */
  description?: string;
  /** Giro de cor (graus) no desenho do móvel: o mesmo tile com outra cor (ex.: o pote automático). */
  hue?: number;
  /** Automático (pote de ração, caixa de areia): guarda até tantos dias e serve sozinho, um por dia. */
  autoDays?: number;
}

/** Lojas (data/shops.json): o que cada uma vende. */
export interface ShopsData {
  schemaVersion: 1;
  shops: Record<string, { name: string; items: string[] }>;
}

/** Ícones dos itens (data/icons.json, do pacote catalogo_compras). */
export interface IconsData {
  schemaVersion: 1;
  image: string;
  tileSize: number;
  columns: number;
  /** Outras folhas de ícones (o ícone aponta com `sheet`); tileSize da folha quando não é o padrão (arte nova em 64 px). */
  sheets?: Record<string, { image: string; columns: number; tileSize?: number }>;
  /** hue: giro de cor (graus) do mesmo ícone (ex.: os sacos de 10 kg). */
  icons: Record<string, { col: number; row: number; sheet?: string; hue?: number }>;
}

export interface ItemsData {
  schemaVersion: 1;
  items: ItemDef[];
  /** Assistência técnica: grupos de peças que trocam entre si no lugar (src/core/upgrades.ts). */
  upgrades?: UpgradesData;
}

/** Acabamento que o pintor aplica numa superfície (piso, papel de parede, lambri). */
export interface FinishDef {
  id: string;
  name: string;
  tile: string;
  kind: SurfaceKind;
  price: number;
}

export interface FinishesData {
  schemaVersion: 1;
  /** Flag que libera o pintor (sem ela, a seção Reforma não aparece). */
  unlockFlag?: string;
  finishes: FinishDef[];
  /** A fachada do café na rua como superfície do pintor: o acabamento troca o tile deste objeto deste mapa. */
  facade?: { surface: SurfaceDef; map: string; object: string };
  /** Obras com o construtor (reparos e troca de acabamento por área; src/core/construction.ts). */
  construction: ConstructionData;
}

export interface EconomyData {
  schemaVersion: 1;
  startingMoney: number;
  currency: string;
  /** Fração do preço devolvida ao devolver um item da bolsa (0 a 1). */
  refundRate: number;
}

/** Condição de história, escrita em JSON. */
/** Onde um item da barra é usado. */
export type ItemUse = 'food_bowl' | 'litter_box' | 'cat' | 'medicine' | 'wand' | 'brush';
export const ITEM_USES: readonly ItemUse[] = ['food_bowl', 'litter_box', 'cat', 'medicine', 'wand', 'brush'];

export type Condition =
  | { all: Condition[] }
  | { any: Condition[] }
  | { not: Condition }
  | { flag: string }
  | { beat: string }
  | { placed: string; gte?: number }
  /** Quantos móveis posicionados têm esta tag (ex.: "chair" conta cadeiras de qualquer tipo). */
  | { placedTag: string; gte?: number }
  | { owned: string; gte?: number }
  /** A personagem já entrou neste mapa. */
  | { visited: string }
  /** A jogadora já deu nome a este gato. */
  | { catNamed: string }
  /** Toda a sujeira do café com esta tag (das que saem com faxina) já foi limpa. */
  | { cleaned: string }
  | { money: { gte: number } }
  /** A partir de um dia (ex.: { gte: 2 }). */
  | { day: { gte: number } }
  /** A partir de uma hora do dia ("08:30"). */
  | { clock: { gte: string } }
  /** A personagem está neste mapa agora. */
  | { location: string }
  /** Receitas no quadro do cardápio. */
  | { menu: { gte: number } }
  /** Clientes atendidos (no jogo todo). */
  | { served: { gte: number } }
  /** Já está com ela (caixa aberta: na bolsa ou posicionado). Encomendas não contam. */
  | { received: string }
  /** Entregas deste item que já chegaram a uma etapa ("door": na porta; "inside": dentro do café). Abertas contam. */
  | { delivery: string; stage: 'door' | 'carried' | 'inside'; gte?: number }
  /** O mesmo, por tag (ex.: as duas mesas chegaram). */
  | { deliveryTag: string; stage: 'door' | 'carried' | 'inside'; gte?: number }
  /** O marco já terminou num dia anterior (começa no dia seguinte). */
  | { nextDay: string }
  /** Já se passaram pelo menos `gte` dias desde que o marco terminou (ex.: a feira, uma semana depois do quintal). */
  | { daysSince: { beat: string; gte: number } }
  /** O relógio marcado chegou (ex.: a hora da chegada da Gabi). */
  | { timer: string }
  /** Quantos itens com esta tag ela tem (na bolsa + posicionados). */
  | { ownedTag: string; gte?: number }
  /** O negócio já chegou a este estágio (inaugurado também conta como funcionamento parcial). */
  | { business: BusinessStage }
  /** Reforma completa: os dois reparos do construtor feitos (interno e da fachada; data/finishes.json construction). */
  | { renovated: true }
  /** O cômodo já chegou a este estado (data/rooms.json). */
  | { room: string; atLeast: RoomState }
  /** Gatos abrigados. */
  | { cats: { gte: number } }
  /** A partir da primeira vez que esta estação chega (data/seasons.json). Ex.: a inauguração, na primavera. */
  | { fromSeason: string }
  /** O selo do café já foi conquistado (data/milestones.json). Só selos de quantidade podem segurar a história. */
  | { milestone: string }
  /** A estação de hoje (ex.: a guirlanda da Dona Neusa, só no inverno). */
  | { season: string };

export type Effect =
  | { dialogue: string }
  | { setFlag: string }
  | { addMoney: number }
  | { cutscene: string }
  | { giveItem: string }
  /** Abriga um gato no café (abre a caixa de nome). */
  | { shelterCat: string }
  /** Adoece um gato abrigado com uma doença sorteada (ex.: o primeiro gato no dia 6). */
  | { makeSick: string }
  /** Termina o dia (a protagonista vai para casa; amanhece no dia seguinte). */
  | { endDay: true }
  /** Roteiro no mundo (data/scripts.json): ex.: a corretora mostra a padaria. */
  | { script: string }
  /** Acerta o relógio (ex.: a chegada é às "08:00" do dia seguinte aos pensamentos). */
  | { setTime: string }
  /** Marca um relógio: daqui a `minutes` minutos de jogo (condição { timer }). */
  | { startTimer: string; minutes: number }
  /** Avança o negócio (ex.: a inauguração). Nunca volta. */
  | { setBusiness: BusinessStage }
  /** Descobre um cômodo (com o momento dele: fala + destaque). Ex.: um vizinho conta. */
  | { discoverRoom: string };

export interface GoalStep {
  /** Texto que a jogadora vê: curto, começando pelo verbo. */
  text: string;
  /** Linha menor embaixo do passo da vez (o como, o quando). */
  detail?: string;
  /** Ícone do passo (data/icons.json). */
  icon?: string;
  /** Receita deste gato: o balão mostra as doses (bolinhas) e se já tomou hoje. */
  doses?: string;
  /** Nota de desenvolvimento: só aparece no modo debug. */
  devNote?: string;
  when: Condition;
}

export interface Beat {
  id: string;
  act: number;
  /** Marcos que precisam estar concluídos antes deste começar. */
  after?: string[];
  /** Condição para o marco COMEÇAR (aparecer no balão). Ex.: { nextDay: "story.x" }. */
  start?: Condition;
  /**
   * Exclusivo: enquanto estiver ativo, os marcos seguintes do arquivo não começam
   * (uma quest por vez, nos primeiros dias). Sem a flag, marcos correm em paralelo.
   */
  exclusive?: boolean;
  /** Condição extra para concluir. Se houver meta, todos os passos também precisam valer. */
  when?: Condition;
  /** Meta visível no diário enquanto o marco estiver ativo. */
  goal?: { title: string; steps: GoalStep[] };
  effects: Effect[];
}

export interface StoryData {
  schemaVersion: 1;
  beats: Beat[];
}

export interface DialogueLine {
  speaker: string;
  text: string;
  /** NPC que fala (mostra o retrato dele). */
  npc?: string;
}

export interface DialogueData {
  schemaVersion: 1;
  dialogues: Record<string, { lines: DialogueLine[] }>;
}

/** data/world.json: onde o jogo começa e qual mapa é o café (onde se decora e reforma). */
export interface WorldData {
  schemaVersion: 1;
  /** Tutorial: quantas vezes a dica "E" aparece em cada tipo de coisa antes de sumir de vez. */
  hintTimes: number;
  /** Tipos de dica com outro número de vezes (ex.: a cortina, só uma). */
  hintTimesBy?: Record<string, number>;
  startMap: string;
  homeMap: string;
  /** Estação atual (dados de todas já existem; o prólogo é no inverno). */
  season: string;
  /** Onde ela aparece de manhã, vindo de casa. */
  morning: { map: string; spawn: Cell };
  /** Portas do café onde ela pode encerrar o dia (a partir de dayNight.goHomeFrom). */
  goHomeDoors: string[];
  /** Quantas poeiras do café voltam a cada manhã (rotina de varrer). */
  dailyDirt: number;
  /** Pixels que um equipamento sobe quando está em cima do balcão. */
  counterLift?: number;
  /** Ação -> item que precisa estar ativo na barra (sweep: varrer sujeira e neve). */
  tools: { sweep: string };
  /**
   * Onde ela dorme. null = em casa, fora do mapa (transição "Você foi para casa").
   * Ponto de extensão: quando o quartinho do café for destrancado, vira o id desse mapa.
   */
  sleepMap: string | null;
  /**
   * Colisão da base dos móveis: quanto da célula de baixo bloqueia, de baixo para cima (0.5 = a metade de baixo;
   * 1 = a célula inteira). Paredes e pisos sólidos bloqueiam a célula inteira. Sem isso, 1.
   */
  objectBaseDepth?: number;
  /** Tiles não sólidos que a personagem não atravessa (potes, caminhas); os gatos continuam usando. */
  playerBlockTiles?: string[];
}

/** Todo o conteúdo que uma sessão de jogo precisa. */
export interface Content {
  catalog: TileCatalog;
  /** O mapa do café (onde se decora e reforma). */
  map: MapData;
  /** Todos os mapas, por id (inclui o café). */
  maps: Record<string, MapData>;
  world: WorldData;
  items: Record<string, ItemDef>;
  finishes: Record<string, FinishDef>;
  /** Flag que libera o pintor. */
  painterUnlockFlag?: string;
  construction: ConstructionData;
  /** Assistência técnica (upgrade de móvel no lugar). */
  upgrades: UpgradesData;
  economy: EconomyData;
  story: StoryData;
  dialogue: DialogueData;
  cats: Record<string, CatDef>;
  catSprites: CatSpritesData;
  cutscenes: Record<string, CutsceneDef>;
  relationships: RelationshipsConfig;
  shops: ShopsData['shops'];
  icons: IconsData;
  npcs: Record<string, NpcDef>;
  scripts: Record<string, { steps: ScriptStep[] }>;
  dayNight: DayNightConfig;
  recipes: Record<string, RecipeDef>;
  service: ServiceConfig;
  carry: CarryConfig;
  delivery: DeliveryConfig;
  health: HealthConfig;
  minigames: MiniGamesConfig;
  business: BusinessData;
  character: CharacterData;
  rooms: RoomsData;
  seasons: SeasonsData;
  /** Match de adoção: gatos do abrigo, famílias e regras (data/adoption.json). */
  adoption: AdoptionData;
  /** Reputação felina: valor inicial, limiares (data/reputation.json). */
  reputation: ReputationConfig;
  /** Selos do café: trilhas e metas (data/milestones.json). */
  milestones: MilestonesData;
  /** Datas festivas: a caixa de enfeites de Natal (data/festive.json). */
  festive: FestiveData;
  /** Perfis de gato (personalidades, condições, sorteio de gatos gerados: data/cat_profiles.json). */
  catProfiles: CatProfilesData;
  /** Chegadas de gatos (data/arrivals.json). */
  arrivals: ArrivalsData;
  /** Eventos de festival (data/festivals.json). */
  festivals: FestivalDef[];
  /** Montar a feira (data/fair_setup.json). */
  fairSetup: FairSetupData;
  /** Concurso de fantasia (data/costume.json). */
  costume: CostumeData;
  /** Foto perfeita (data/photo.json). */
  photo: PhotoData;
  /** A fachada do café (superfície do pintor na rua), se configurada. */
  facade: FinishesData['facade'] | null;
  jobs: Record<string, JobDef>;
  jobPoints: Record<string, JobPoint>;
  maxActiveJobs: number;
  news: NewsData;
}


export interface RawContent {
  catalog: TileCatalog;
  maps: MapData[];
  world: WorldData;
  items: ItemsData;
  finishes: FinishesData;
  economy: EconomyData;
  story: StoryData;
  dialogue: DialogueData;
  cats: CatsData;
  catSprites: CatSpritesData;
  cutscenes: CutscenesData;
  relationships: RelationshipsConfig;
  shops: ShopsData;
  icons: IconsData;
  npcs: NpcsData;
  scripts: ScriptsData;
  dayNight: DayNightConfig;
  recipes: RecipesData;
  service: ServiceConfig;
  carry: CarryConfig;
  emotes: { frames: Record<string, unknown> };
  jobs: JobsData;
  news: NewsData;
  delivery: DeliveryConfig;
  health: HealthConfig;
  minigames: MiniGamesConfig;
  business: BusinessData;
  character: CharacterData;
  rooms: RoomsData;
  seasons: SeasonsData;
  adoption: AdoptionData;
  reputation: ReputationConfig;
  milestones: MilestonesData;
  festive: FestiveData;
  catProfiles: CatProfilesData;
  arrivals: ArrivalsData;
  festivals: FestivalsData;
  fairSetup: FairSetupData;
  costume: CostumeData;
  photo: PhotoData;
}

/** Correio (data/delivery.json). */
export interface DeliveryConfig {
  schemaVersion: 1;
  /** Minutos de jogo entre o pedido e a chegada. */
  minutes: number;
  /** O correio só entrega nesse horário; fora dele, chega no dia seguinte, em `from`. */
  from: string;
  until: string;
  /** Quantas compras podem estar a caminho ou na porta (depois disso, o catálogo pede para retirar). */
  maxPending: number;
  /** Onde as caixas ficam empilhadas na rua e dentro do café. */
  door: { map: string; at: Cell };
  inside: { at: Cell };
  /** NPC que entrega e o furgão (vistas de lado). */
  carrier: string;
  /** Imagens do furgão de lado; scale: 0,5 para a arte em 64 px (decisão 052), 1 para a antiga. */
  van: { left: string; right: string; scale?: number };
  /** Ícone (data/icons.json) da caixa de papelão: na pilha da porta, na chegada e nas mãos. */
  parcelIcon: string;
}

export function buildContent(raw: RawContent): Content {
  const maps: Record<string, MapData> = {};
  for (const m of raw.maps) maps[m.id] = m;
  const home = maps[raw.world.homeMap];
  if (!home) throw new Error(`world.json: homeMap "${raw.world.homeMap}" não existe`);
  const items: Record<string, ItemDef> = {};
  for (const item of raw.items.items) items[item.id] = item;
  const finishes: Record<string, FinishDef> = {};
  for (const finish of raw.finishes.finishes) finishes[finish.id] = finish;
  return { catalog: raw.catalog, map: home, maps, world: raw.world, items, finishes, painterUnlockFlag: raw.finishes.unlockFlag, construction: raw.finishes.construction, upgrades: raw.items.upgrades ?? NO_UPGRADES, economy: raw.economy, story: raw.story, dialogue: raw.dialogue,
    cats: Object.fromEntries(raw.cats.cats.map((c) => [c.id, c])), catSprites: raw.catSprites, cutscenes: raw.cutscenes.cutscenes, relationships: raw.relationships,
    shops: raw.shops.shops, icons: raw.icons,
    npcs: Object.fromEntries(raw.npcs.npcs.map((n) => [n.id, n])), scripts: raw.scripts.scripts, dayNight: raw.dayNight, recipes: Object.fromEntries(raw.recipes.recipes.map((r) => [r.id, r])), service: raw.service, carry: raw.carry, jobs: Object.fromEntries(raw.jobs.jobs.map((j) => [j.id, j])), jobPoints: Object.fromEntries(raw.jobs.points.map((p) => [p.id, p])), maxActiveJobs: raw.jobs.maxActive, news: raw.news, delivery: raw.delivery, health: raw.health, minigames: raw.minigames, business: raw.business, character: raw.character, rooms: raw.rooms, seasons: raw.seasons, adoption: raw.adoption, reputation: raw.reputation, milestones: raw.milestones, festive: raw.festive, catProfiles: raw.catProfiles, arrivals: raw.arrivals, festivals: raw.festivals.festivals, fairSetup: raw.fairSetup, costume: raw.costume, photo: raw.photo, facade: raw.finishes.facade ?? null };
}

/** Palavras de bastidor que não podem aparecer em textos da jogadora (use "devNote"). */
const DEV_WORDS = /\b(marcos?|debug|placeholder)\b/i;
const DEV_MARKERS = /\b(TODO|FIXME|WIP)\b/; // só em maiúsculas: "todo dia" é português comum

/** Confere IDs, prefixos e referências cruzadas. Lista vazia = tudo certo. */
export function validateContent(raw: RawContent): string[] {
  const errors = raw.maps.flatMap((m) => validateMap(m, raw.catalog));
  const err = (msg: string) => errors.push(msg);
  const playerText = (where: string, text: string) => {
    if (DEV_WORDS.test(text) || DEV_MARKERS.test(text)) err(`${where}: texto da jogadora parece nota de desenvolvimento ("${text}"); use "devNote"`);
  };

  // Mapas e portas
  const mapIds = new Set<string>();
  for (const m of raw.maps) {
    if (!m.id.startsWith('map.')) err(`mapa: id "${m.id}" deve começar com "map."`);
    if (mapIds.has(m.id)) err(`mapa: id repetido "${m.id}"`);
    mapIds.add(m.id);
  }
  if (!mapIds.has(raw.world.startMap)) err(`world: startMap "${raw.world.startMap}" não existe`);
  if (!mapIds.has(raw.world.homeMap)) err(`world: homeMap "${raw.world.homeMap}" não existe`);
  if (!raw.items.items.some((i) => i.id === raw.world.tools?.sweep && i.kind === 'tool')) err(`world: tools.sweep "${raw.world.tools?.sweep}" não é uma ferramenta (kind "tool") de items.json`);
  if (!mapIds.has(raw.world.morning.map)) err(`world: morning.map "${raw.world.morning.map}" não existe`);
  for (const d of raw.world.goHomeDoors) if (!(raw.maps.find((m) => m.id === raw.world.homeMap)?.doors ?? []).some((x) => x.id === d)) err(`world: goHomeDoors "${d}" não é porta do café`);
  {
    const dv = raw.delivery;
    if (!(dv.minutes > 0) || !(dv.maxPending >= 1)) err('delivery: minutes e maxPending precisam ser positivos');
    errors.push(...validateDayNight({ ...raw.dayNight, dayStart: dv.from, passOut: dv.until }).filter((e) => e.includes('hora inválida')).map((e) => `delivery: ${e}`));
    if (!mapIds.has(dv.door.map)) err(`delivery: mapa inexistente "${dv.door.map}"`);
    if (!raw.npcs.npcs.some((n) => n.id === dv.carrier)) err(`delivery: NPC inexistente "${dv.carrier}"`);
  }
  errors.push(...validateMiniGames(raw.minigames, { maps: mapIds, icons: new Set(Object.keys(raw.icons.icons)) }));
  for (const g of Object.values(raw.minigames.games)) if (g.fish) errors.push(...validateFishTable(g.fish, { items: new Set(raw.items.items.map((i) => i.id)) }));
  for (const g of Object.values(raw.minigames.games)) {
    if (!g.patterns) continue;
    const used = Object.values(g.difficulties).flatMap((d) => (d.patterns as string[] | undefined) ?? []);
    errors.push(...validateLattePatterns(g.patterns, g.guideSize ?? 128, used));
  }
  for (const g of Object.values(raw.minigames.games)) {
    if (!g.hideouts) continue;
    const most = Math.max(...Object.values(g.difficulties).map((d) => Number(d.hideouts ?? 0)));
    errors.push(...validateHideouts(g.hideouts, new Set(g.hideoutKinds ?? []), most));
    if (!g.heat?.length || !(Number(g.heatRange) > 0)) err('minigames: kitten_hunt precisa de heat e heatRange');
  }
  for (const g of Object.values(raw.minigames.games)) {
    if (!g.items || !g.obstacles) continue;
    const most = Math.max(...Object.values(g.difficulties).map((d) => Number(d.obstacles ?? 0)));
    errors.push(...validateDelivery(g.items, g.obstacles, most, new Set(Object.keys(raw.icons.icons))));
  }
  errors.push(...validateReputation(raw.reputation));
  {
    const box = raw.festive.box;
    const item = raw.items.items.find((i) => i.id === box.item);
    if (!item) err(`festive: a caixa "${box.item}" não existe`);
    else if ((item.kind ?? 'furniture') === 'furniture') err(`festive: a caixa "${box.item}" não pode ser móvel`);
    if (!raw.seasons.order.includes(box.opensIn)) err(`festive: estação inexistente "${box.opensIn}"`);
    if (!raw.items.items.some((i) => i.tags.includes(box.tag))) err(`festive: nenhum item tem a tag "${box.tag}"`);
  }
  {
    const ids: Record<string, Set<string>> = {
      recipe: new Set(raw.recipes.recipes.map((r) => r.id)),
      room: new Set(raw.rooms.rooms.map((r) => r.id)),
      item: new Set(raw.items.items.map((i) => i.id)),
      event: new Set(raw.festivals.festivals.map((f) => f.id)),
      gift: new Set(raw.items.items.map((i) => i.id)),
    };
    // Nada da história, dos cômodos ou dos eventos pode esperar um selo de sequência.
    const storyRefs = milestoneRefs([raw.story, raw.rooms, raw.festivals, raw.business]);
    errors.push(...validateMilestones(raw.milestones, (kind, id) => !!ids[kind]?.has(id), storyRefs));
  }
  const adoptGame = raw.minigames.games.adoption;
  errors.push(...validateCafeTraits(raw.adoption.fair, raw.adoption.traits));
  if (adoptGame) errors.push(...validateAdoption(raw.adoption, { variants: new Set(Object.keys(raw.catSprites.variants)), maxPairs: Math.max(...Object.values(adoptGame.difficulties).map((d) => Number(d.pairs ?? 0))) }));
  for (const [id, g] of Object.entries(raw.minigames.games)) {
    for (const t of [...(g.backdrop?.floor ?? []), g.backdrop?.rug]) if (t && !raw.catalog.tiles[t]) err(`minigames: "${id}" usa no fundo um tile inexistente "${t}"`);
    const k = g.backdrop?.rugScale;
    if (k !== undefined && !(Number.isInteger(k) && k >= 1)) err(`minigames: "${id}": backdrop.rugScale deve ser um inteiro >= 1`);
  }
  for (const [id, g] of Object.entries(raw.minigames.games)) if (g.treatItem && !raw.items.items.some((i) => i.id === g.treatItem)) err(`minigames: "${id}" usa petisco inexistente "${g.treatItem}"`);
  for (const p of raw.jobs.points) if (p.minigame && !raw.minigames.games[p.minigame.id]) err(`jobs: ponto "${p.id}" abre um mini game inexistente "${p.minigame.id}"`);
  // O item do ponto: na entrega, um item de entrega (minigames.json: items); nos outros, um item do jogo (o petisco).
  for (const p of raw.jobs.points) {
    const item = p.minigame?.itemId;
    if (!item) continue;
    const game = raw.minigames.games[p.minigame!.id];
    const ok = game?.items ? game.items.some((i) => i.id === item) : raw.items.items.some((i) => i.id === item);
    if (!ok) err(`jobs: ponto "${p.id}" abre o mini game com item inexistente "${item}"`);
  }
  errors.push(...validateHealth(raw.health, { items: new Set(raw.items.items.map((i) => i.id)), maps: mapIds, npcs: new Set(raw.npcs.npcs.map((n) => n.id)) }));
  errors.push(...validateJobs(raw.jobs, raw.news, { maps: mapIds, items: new Set(raw.items.items.map((i) => i.id)), tiles: new Set(Object.keys(raw.catalog.tiles)), sprites: new Set(Object.keys(raw.emotes.frames)), icons: new Set(Object.keys(raw.icons.icons)) }));
  for (const i of raw.items.items) if (i.use && !ITEM_USES.includes(i.use)) err(`items: "${i.id}" use inválido "${i.use}"`);
  errors.push(...validateUpgrades(raw.items.upgrades ?? NO_UPGRADES, Object.fromEntries(raw.items.items.map((i) => [i.id, i])), raw.catalog));
  for (const i of raw.items.items) if (i.carrySprite && !(i.carrySprite in raw.emotes.frames)) err(`items: "${i.id}" carrySprite inexistente em emotes.json "${i.carrySprite}"`);
  // Todo ponto de pedido precisa ser alcançável a pé a partir do spawn do mapa (ele ou um vizinho).
  for (const p of raw.jobs.points) {
    const m = raw.maps.find((x) => x.id === p.map);
    if (!m) continue;
    // Portas que levam a outro ponto do próprio mapa (salão -> jardim) também contam como caminho.
    const jumps = (m.doors ?? []).filter((d) => d.to === m.id).map((d) => ({ from: d.at, to: d.spawn }));
    const reach = reachableCells(solidGrid(m, raw.catalog), m.spawn.player, jumps);
    const [c, r] = p.at;
    if (![[c, r], [c + 1, r], [c - 1, r], [c, r + 1], [c, r - 1]].some(([x, y]) => reach[y!]?.[x!])) err(`jobs: ponto "${p.id}" em (${c},${r}) de "${p.map}" não dá para alcançar a pé`);
  }
  if (raw.world.sleepMap !== null && !mapIds.has(raw.world.sleepMap)) err(`world: sleepMap "${raw.world.sleepMap}" não existe`);
  for (const tile of raw.world.playerBlockTiles ?? []) if (!raw.catalog.tiles[tile]) err(`world: playerBlockTiles: tile "${tile}" não existe`);
  errors.push(...validateDayNight(raw.dayNight));
  const restore = raw.dayNight.energy.restore;
  for (const id of restore.coffee.recipes) if (!raw.recipes.recipes.some((r) => r.id === id)) err(`daynight: energy.restore.coffee: receita "${id}" não existe`);
  for (const tile of Object.keys(restore.seat.tiles)) if (!raw.catalog.tiles[tile]) err(`daynight: energy.restore.seat: tile "${tile}" não existe`);
  for (const m of raw.maps) {
    for (const n of m.npcs ?? []) {
      const def = raw.npcs.npcs.find((x) => x.id === n.npc);
      if (!def) {
        err(`${m.id}: NPC inexistente "${n.npc}"`);
        continue;
      }
      for (const a of [n.anim, n.idle?.anim, n.busy?.anim]) if (a && !def.extras[a]) err(`${m.id}: ${n.npc} não tem a animação "${a}"`);
      if (n.idle && !(n.idle.pauseMs[0] >= 0 && n.idle.pauseMs[1] >= n.idle.pauseMs[0])) err(`${m.id}: ${n.npc}: idle.pauseMs inválido`);
      if (n.busy && !(m.interactions ?? []).some((i) => i.id === n.busy!.interaction)) err(`${m.id}: ${n.npc}: interação "${n.busy.interaction}" não existe no mapa`);
    }
    for (const door of m.doors ?? []) {
      const target = raw.maps.find((t) => t.id === door.to);
      if (!target) err(`${m.id}: porta "${door.id}" leva a "${door.to}", que não existe`);
      else {
        const [c, r] = door.spawn;
        if (c < 0 || r < 0 || c >= target.size.cols || r >= target.size.rows) err(`${m.id}: porta "${door.id}" chega fora de "${door.to}"`);
      }
    }
  }
  const home = raw.maps.find((m) => m.id === raw.world.homeMap);
  const doorChecks: { where: string; requires?: Condition; locked?: string; intercept?: { when: Condition; cutscene?: string; script?: string } }[] = raw.maps.flatMap((m) =>
    (m.doors ?? []).map((d) => ({
      where: `${m.id}: porta "${d.id}"`,
      requires: d.requires as Condition | undefined,
      locked: d.locked,
      intercept: d.intercept as { when: Condition; cutscene?: string; script?: string } | undefined,
    })),
  );

  // Gatos e cenas
  errors.push(...validateCats(raw.cats, raw.catSprites));
  const catIds = new Set(raw.cats.cats.map((c) => c.id));
  const animations = new Set(raw.catSprites.animations.map((a) => a.name));
  errors.push(...validateCutscenes(raw.cutscenes, catIds, animations));
  const cutsceneIds = new Set(Object.keys(raw.cutscenes.cutscenes));
  const npcIds = new Set(raw.npcs.npcs.map((n) => n.id));
  const scriptIds = new Set(Object.keys(raw.scripts.scripts));
  for (const n of raw.npcs.npcs) if (!n.id.startsWith('npc.')) err(`npc: id "${n.id}" deve começar com "npc."`);
  errors.push(
    ...validateScripts(raw.scripts, {
      npcs: npcIds,
      maps: new Set(raw.maps.map((m) => m.id)),
      dialogues: new Set(Object.keys(raw.dialogue.dialogues)),
      items: new Set(raw.items.items.map((i) => i.id)),
      cats: catIds,
      balloons: new Set(Object.keys(raw.emotes.frames)),
      npcAnims: (id) => new Set(Object.keys(raw.npcs.npcs.find((n) => n.id === id)?.extras ?? {})),
      rooms: new Set(raw.rooms.rooms.map((r) => r.id)),
      doors: new Set(raw.rooms.doors.map((d) => d.id)),
    }),
  );
  for (const [id, d] of Object.entries(raw.dialogue.dialogues)) {
    for (const l of d.lines) if (l.npc && !npcIds.has(l.npc)) err(`dialogue "${id}": NPC inexistente "${l.npc}"`);
  }

  const itemIds = new Set<string>();
  for (const item of raw.items.items) {
    if (!item.id.startsWith('item.')) err(`items: id "${item.id}" deve começar com "item."`);
    if (itemIds.has(item.id)) err(`items: id repetido "${item.id}"`);
    itemIds.add(item.id);
    const kind = item.kind ?? 'furniture';
    if (!['furniture', 'consumable', 'key', 'tool', 'fixture', 'gift'].includes(kind)) err(`items: "${item.id}" tem kind inválido`);
    if (kind === 'furniture' && !item.tile) err(`items: "${item.id}" é móvel e precisa de tile`);
    // A condição pode estar dentro de all/any (ex.: a placa: inaugurado e recebida).
    if (kind === 'fixture' && !raw.maps.some((m) => m.objects.some((o) => JSON.stringify(o.when ?? {}).includes(`"received":"${item.id}"`))))
      err(`items: "${item.id}" é peça fixa e nenhum objeto de mapa aparece com ela (when: { received })`);
    if (item.tile && !raw.catalog.tiles[item.tile]) err(`items: "${item.id}" usa tile inexistente "${item.tile}"`);
    if (!Number.isInteger(item.price) || item.price < 0) err(`items: "${item.id}" tem preço inválido`);
  }

  const LAYER_OF: Record<SurfaceKind, string> = { floor: 'floor', wall: 'wall', wainscot: 'wall', facade: 'wall' };
  const finishIds = new Set<string>();
  for (const f of raw.finishes.finishes) {
    if (!f.id.startsWith('finish.')) err(`finishes: id "${f.id}" deve começar com "finish."`);
    if (finishIds.has(f.id)) err(`finishes: id repetido "${f.id}"`);
    finishIds.add(f.id);
    const tile = raw.catalog.tiles[f.tile];
    if (!tile) err(`finishes: "${f.id}" usa tile inexistente "${f.tile}"`);
    else if (tile.layer !== LAYER_OF[f.kind]) err(`finishes: "${f.id}" é ${f.kind}, mas o tile "${f.tile}" é da camada "${tile.layer}"`);
    if (!Number.isInteger(f.price) || f.price < 0) err(`finishes: "${f.id}" tem preço inválido`);
  }
  const surfaceIds = new Set<string>();
  const facade = raw.finishes.facade;
  if (facade) {
    surfaceIds.add(facade.surface.id);
    const fmap = raw.maps.find((m) => m.id === facade.map);
    if (!fmap) err(`finishes: fachada em mapa inexistente "${facade.map}"`);
    else if (!fmap.objects.some((o) => o.id === facade.object)) err(`finishes: fachada: objeto inexistente "${facade.object}" em "${facade.map}"`);
    if (facade.surface.kind !== 'facade') err('finishes: a superfície da fachada precisa ser kind "facade"');
  }
  for (const d of home?.dirt ?? []) {
    if (d.clearedBy && !(home?.surfaces ?? []).some((s) => s.id === d.clearedBy)) err(`mapa: sujeira "${d.id}" sai com "${d.clearedBy}", que não existe`);
  }
  for (const s of home?.surfaces ?? []) {
    if (!s.id.startsWith('surface.')) err(`mapa: superfície "${s.id}" deve começar com "surface."`);
    if (surfaceIds.has(s.id)) err(`mapa: superfície repetida "${s.id}"`);
    surfaceIds.add(s.id);
    if (!home!.legend[s.legend]) err(`mapa: superfície "${s.id}" usa a letra "${s.legend}", que não está na legenda`);
    if (!raw.finishes.finishes.some((f) => f.kind === s.kind)) err(`mapa: nenhum acabamento serve para "${s.id}" (${s.kind})`);
  }
  errors.push(...validateConstruction(raw.finishes.construction, { npcs: new Set(raw.npcs.npcs.map((n) => n.id)), finishes: finishIds, surfaces: surfaceIds }));

  if (!Number.isInteger(raw.economy.startingMoney) || raw.economy.startingMoney < 0) {
    err('economy: startingMoney inválido');
  }
  if (!(raw.economy.refundRate >= 0 && raw.economy.refundRate <= 1)) err('economy: refundRate deve ficar entre 0 e 1');

  const itemTags = new Set(raw.items.items.flatMap((i) => i.tags));
  const dialogueIds = new Set(Object.keys(raw.dialogue.dialogues));
  for (const id of dialogueIds) {
    if (!id.startsWith('dlg.')) err(`dialogue: id "${id}" deve começar com "dlg."`);
    if ((raw.dialogue.dialogues[id]?.lines.length ?? 0) === 0) err(`dialogue: "${id}" não tem falas`);
  }

  const beatIds = new Set<string>();
  for (const beat of raw.story.beats) {
    if (!beat.id.startsWith('story.')) err(`story: id "${beat.id}" deve começar com "story."`);
    if (beatIds.has(beat.id)) err(`story: id repetido "${beat.id}"`);
    beatIds.add(beat.id);
  }

  const timerIds = new Set(raw.story.beats.flatMap((b) => b.effects.flatMap((e) => ('startTimer' in e ? [e.startTimer] : []))));
  const checkCondition = (where: string, c: Condition): void => {
    if ('all' in c) c.all.forEach((x) => checkCondition(where, x));
    else if ('any' in c) c.any.forEach((x) => checkCondition(where, x));
    else if ('not' in c) checkCondition(where, c.not);
    else if ('cleaned' in c) {
      if (!(home?.dirt ?? []).some((d) => !d.clearedBy && d.tags.includes(c.cleaned))) err(`${where}: nenhuma sujeira com a tag "${c.cleaned}"`);
    } else if ('catNamed' in c) {
      if (!catIds.has(c.catNamed)) err(`${where}: gato inexistente "${c.catNamed}"`);
    } else if ('daysSince' in c) {
      if (!beatIds.has(c.daysSince.beat)) err(`${where}: marco inexistente "${c.daysSince.beat}"`);
      if (!(c.daysSince.gte >= 0)) err(`${where}: daysSince.gte precisa ser 0 ou mais`);
    } else if ('nextDay' in c) {
      if (!beatIds.has(c.nextDay)) err(`${where}: marco inexistente "${c.nextDay}"`);
    } else if ('ownedTag' in c) {
      if (!itemTags.has(c.ownedTag)) err(`${where}: nenhum item tem a tag "${c.ownedTag}"`);
    } else if ('timer' in c) {
      if (!timerIds.has(c.timer)) err(`${where}: nenhum efeito marca o relógio "${c.timer}"`);
    } else if ('received' in c) {
      if (!itemIds.has(c.received)) err(`${where}: item inexistente "${c.received}"`);
    } else if ('delivery' in c) {
      if (!itemIds.has(c.delivery)) err(`${where}: item inexistente "${c.delivery}"`);
    } else if ('deliveryTag' in c) {
      if (!itemTags.has(c.deliveryTag)) err(`${where}: nenhum item tem a tag "${c.deliveryTag}"`);
    } else if ('location' in c) {
      if (!mapIds.has(c.location)) err(`${where}: mapa inexistente "${c.location}"`);
    } else if ('clock' in c) {
      if (!/^\d{1,2}:\d{2}$/.test(c.clock.gte)) err(`${where}: hora inválida "${c.clock.gte}"`);
    } else if ('visited' in c) {
      if (!mapIds.has(c.visited)) err(`${where}: mapa inexistente "${c.visited}"`);
    } else if ('beat' in c) {
      if (!beatIds.has(c.beat)) err(`${where}: marco inexistente "${c.beat}"`);
    } else if ('season' in c) {
      if (!raw.seasons.order.includes(c.season)) err(`${where}: estação inexistente "${c.season}"`);
    } else if ('milestone' in c) {
      if (!raw.milestones.milestones.some((m) => m.id === c.milestone)) err(`${where}: selo inexistente "${c.milestone}"`);
    } else if ('fromSeason' in c) {
      if (!raw.seasons.order.includes(c.fromSeason)) err(`${where}: estação inexistente "${c.fromSeason}"`);
    } else if ('room' in c) {
      if (!raw.rooms.rooms.some((r) => r.id === c.room)) err(`${where}: cômodo inexistente "${c.room}"`);
      if (!(ROOM_STATES as readonly string[]).includes(c.atLeast)) err(`${where}: estado de cômodo inválido "${c.atLeast}"`);
    } else if ('business' in c) {
      if (!(BUSINESS_STAGES as readonly string[]).includes(c.business)) err(`${where}: estágio do negócio inválido "${c.business}"`);
    } else if ('placedTag' in c) {
      if (!itemTags.has(c.placedTag)) err(`${where}: nenhum item tem a tag "${c.placedTag}"`);
    } else if ('placed' in c || 'owned' in c) {
      const id = 'placed' in c ? c.placed : c.owned;
      if (!itemIds.has(id)) err(`${where}: item inexistente "${id}"`);
    }
  };

  for (const job of raw.jobs.jobs) if (job.available) checkCondition(`jobs: "${job.id}"`, job.available as Condition);
  for (const item of raw.items.items) {
    if (item.requires) checkCondition(`items: "${item.id}"`, item.requires);
    if (item.icon && !raw.icons.icons[item.icon]) err(`items: "${item.id}" usa ícone inexistente "${item.icon}"`);
  }
  errors.push(...validateRecipes(raw.recipes, raw.service, raw.carry, { items: itemIds, icons: new Set(Object.keys(raw.icons.icons)), itemTags, seasons: new Set(raw.seasons.order) }));
  for (const r of raw.recipes.recipes) if (r.unlock) checkCondition(`recipes: "${r.id}"`, r.unlock);
  checkCondition('service: enabledWhen', raw.service.enabledWhen);
  checkCondition('business: softOpenWhen', raw.business.softOpenWhen);
  if (raw.business.upgradesWhen) checkCondition('business: upgradesWhen', raw.business.upgradesWhen);
  if (raw.business.upgradeTag && !raw.items.items.some((i) => i.tags.includes(raw.business.upgradeTag!))) err(`business: nenhum item tem a tag de upgrade "${raw.business.upgradeTag}"`);
  for (const r of raw.rooms.rooms) {
    if (r.discover?.when) checkCondition(`rooms: "${r.id}" discover`, r.discover.when);
    if (r.restore?.when) checkCondition(`rooms: "${r.id}" restore`, r.restore.when);
  }
  errors.push(...validateBusiness(raw.business, surfaceIds));
  errors.push(...validateReview(raw.service.review));
  errors.push(...validateCharacter(raw.character));
  errors.push(...validateScheduleRules(raw.service.schedule, raw.seasons.startWeekday));
  // Chegadas de gatos e perfis (personalidades, condições, gatos gerados).
  const variants = new Set(Object.keys(raw.catSprites.variants));
  errors.push(
    ...validateCatProfiles(raw.catProfiles, {
      variants,
      catPersonalities: raw.cats.cats.map((c) => c.personality),
      items: new Set(raw.items.items.map((i) => i.id)),
      points: new Set(raw.jobs.points.map((p) => p.id)),
      maps: mapIds,
    }),
  );
  errors.push(
    ...validateArrivals(
      raw.arrivals,
      {
        maps: mapIds,
        seasons: new Set(raw.seasons.order),
        weather: new Set(Object.values(raw.seasons.weather ?? {}).flatMap((w) => Object.keys(w))),
        cats: new Set(raw.cats.cats.map((c) => c.id)),
        personalities: new Set(Object.keys(raw.catProfiles.personalities)),
        conditions: new Set(Object.keys(raw.catProfiles.conditions)),
        variants,
        npcs: npcIds,
        dialogues: dialogueIds,
        cutscenes: new Set(Object.keys(raw.cutscenes.cutscenes)),
        scripts: scriptIds,
        points: new Set(raw.jobs.points.map((p) => p.id)),
        minigames: new Set(Object.keys(raw.minigames.games)),
        items: new Set(raw.items.items.map((i) => i.id)),
      },
      (where, c) => checkCondition(where, c as Condition),
    ),
  );
  errors.push(
    ...validateFestivals(raw.festivals, {
      points: new Set(raw.jobs.points.map((p) => p.id)),
      tiles: new Set(Object.keys(raw.catalog.tiles)),
      games: new Set(Object.keys(raw.minigames.games)),
      dialogues: dialogueIds,
      thresholds: new Set(raw.reputation.thresholds.map((t) => t.id)),
      seasons: new Set(raw.seasons.order),
    }),
  );
  errors.push(...validateFairSetup(raw.fairSetup, raw.minigames.games.fair_setup?.difficulties as Record<string, FairSetupParams> | undefined, raw.catalog.tiles));
  errors.push(
    ...validateCostume(
      raw.costume,
      { thresholds: new Set(raw.reputation.thresholds.map((t) => t.id)) },
      raw.minigames.games.costume?.difficulties as Record<string, CostumeParams> | undefined,
    ),
  );
  errors.push(
    ...validatePhoto(
      raw.photo,
      new Set(raw.catSprites.animations.map((a) => a.name)),
      raw.minigames.games.photo?.difficulties as Record<string, PhotoParams> | undefined,
    ),
  );
  // A atividade abre o mini game do ponto dela: os dois precisam bater.
  for (const f of raw.festivals.festivals)
    for (const x of f.activities) {
      const pt = raw.jobs.points.find((p) => p.id === x.point);
      if (pt && (pt.action !== 'minigame' || pt.minigame?.id !== x.game)) errors.push(`festivals: "${f.id}": o ponto "${x.point}" não abre o mini game "${x.game}"`);
    }
  for (const f of raw.festivals.festivals) if (f.when !== undefined) checkCondition(`festivals: "${f.id}"`, f.when as Condition);
  for (const e of raw.seasons.events ?? []) if (e.hideWhen) checkCondition(`seasons: evento "${e.id}"`, e.hideWhen as Condition);
  errors.push(...validateSeasons(raw.seasons, { maps: mapIds, tiles: new Set(Object.keys(raw.catalog.tiles)) }));
  errors.push(
    ...validateRooms(raw.rooms, {
      cols: home?.size.cols ?? 0,
      rows: home?.size.rows ?? 0,
      items: itemIds,
      tiles: new Set(Object.keys(raw.catalog.tiles)),
      dialogues: dialogueIds,
      beats: beatIds,
      dirtTags: new Set((home?.dirt ?? []).flatMap((d) => d.tags)),
    }),
  );
  for (const item of raw.items.items) if (item.room && !raw.rooms.rooms.some((r) => r.id === item.room)) err(`items: "${item.id}" só vai em cômodo inexistente "${item.room}"`);
  for (const d of home?.dirt ?? []) {
    if (d.gives && !itemIds.has(d.gives)) err(`mapa: sujeira "${d.id}" esconde item inexistente "${d.gives}"`);
    if (d.foundDialogue && !dialogueIds.has(d.foundDialogue)) err(`mapa: sujeira "${d.id}" com fala inexistente "${d.foundDialogue}"`);
    if (d.when) checkCondition(`mapa: sujeira "${d.id}"`, d.when as Condition);
  }
  for (const id of raw.service.customerLooks) if (!npcIds.has(id)) err(`service: customerLooks tem NPC inexistente "${id}"`);
  for (const item of raw.items.items) {
    if (item.healthMultiplier !== undefined && !(item.healthMultiplier > 0)) err(`items: "${item.id}" healthMultiplier inválido`);
    if (item.servings !== undefined && !(Number.isInteger(item.servings) && item.servings >= 1)) err(`items: "${item.id}" servings inválido`);
    if (item.placeOn && !itemTags.has(item.placeOn)) err(`items: "${item.id}" vai em cima de "${item.placeOn}", tag que nenhum item tem`);
    if (item.storesAs && (!itemIds.has(item.storesAs.item) || !(item.storesAs.qty >= 1))) err(`items: "${item.id}" storesAs inválido`);
    if (item.storesAs && !item.tags.includes(raw.carry.heavy.tag)) err(`items: "${item.id}" tem storesAs mas não é pesado (tag "${raw.carry.heavy.tag}")`);
    if (item.washer && !(Number.isInteger(item.washer.capacity) && item.washer.capacity >= 1 && item.washer.cycleMinutes > 0)) err(`items: "${item.id}" washer: capacity (inteiro >= 1) e cycleMinutes (> 0)`);
    if (item.storage) {
      validateStorage(item.id, item.storage).forEach((e) => err(`items: ${e}`));
      if ((item.kind ?? 'furniture') !== 'furniture') err(`items: "${item.id}" tem storage mas não é móvel`);
      for (const tag of item.storage.accepts ?? []) if (!itemTags.has(tag)) err(`items: "${item.id}" storage aceita a tag "${tag}", que nenhum item tem`);
    }
  }
  for (const [id, icon] of Object.entries(raw.icons.icons)) {
    if (icon.sheet && !raw.icons.sheets?.[icon.sheet]) err(`icons: "${id}" usa folha inexistente "${icon.sheet}"`);
  }
  for (const [id, shop] of Object.entries(raw.shops.shops)) {
    if (!id.startsWith('shop.')) err(`shops: id "${id}" deve começar com "shop."`);
    playerText(`shop "${id}"`, shop.name);
    for (const item of shop.items) if (!itemIds.has(item)) err(`shops: "${id}" vende item inexistente "${item}"`);
  }
  for (const m of raw.maps) {
    for (const it of m.interactions ?? []) {
      if ('shop' in it.action && !raw.shops.shops[it.action.shop]) err(`${m.id}: interação "${it.id}" abre loja inexistente "${it.action.shop}"`);
      if ('curtain' in it.action) {
        const { curtain, dialogue } = it.action;
        const obj = m.objects.find((o) => o.id === curtain);
        if (!obj?.curtainOpen) err(`${m.id}: interação "${it.id}" abre a cortina de "${curtain}", que não existe ou não tem curtainOpen`);
        else if (!raw.catalog.tiles[obj.curtainOpen]) err(`${m.id}: "${curtain}" com curtainOpen inexistente "${obj.curtainOpen}"`);
        const wild = obj?.curtainOvergrown;
        if (wild && !raw.catalog.tiles[wild.tile]) err(`${m.id}: "${curtain}" com curtainOvergrown.tile inexistente "${wild.tile}"`);
        if (wild && !raw.rooms.rooms.some((r) => r.id === wild.room)) err(`${m.id}: "${curtain}" com curtainOvergrown.room inexistente "${wild.room}"`);
        const alt = it.action.dialogueAlt;
        if (alt && !raw.dialogue.dialogues[alt.dialogue]) err(`${m.id}: interação "${it.id}" com fala alternativa inexistente "${alt.dialogue}"`);
        if (dialogue && !raw.dialogue.dialogues[dialogue]) err(`${m.id}: interação "${it.id}" com fala inexistente "${dialogue}"`);
      }
      if ('hours' in it.action) {
        const door = (m.doors ?? []).find((d) => d.id === (it.action as { hours: string }).hours);
        if (!door) err(`${m.id}: plaquinha "${it.id}" de porta inexistente neste mapa`);
        else if (!door.hours && door.to !== raw.world.homeMap) err(`${m.id}: plaquinha "${it.id}": a porta "${door.id}" não tem horário (nem é a do café)`);
      }
      if ('shelf' in it.action) {
        const shop = raw.shops.shops[it.action.shelf];
        if (!shop) err(`${m.id}: prateleira "${it.id}" de loja inexistente "${it.action.shelf}"`);
        else {
          const tags = it.action.tags;
          if (!shop.items.some((id) => raw.items.items.find((x) => x.id === id)?.tags.some((t) => tags.includes(t)))) err(`${m.id}: prateleira "${it.id}" não tem nenhum item com as tags ${tags.join(', ')}`);
        }
      }
    }
  }
  for (const d of doorChecks) {
    if (d.intercept) {
      checkCondition(d.where, d.intercept.when);
      const { cutscene, script } = d.intercept;
      if ((cutscene === undefined) === (script === undefined)) err(`${d.where}: intercept precisa de "cutscene" ou de "script" (um dos dois)`);
      if (cutscene !== undefined && !cutsceneIds.has(cutscene)) err(`${d.where}: cena inexistente "${cutscene}"`);
      if (script !== undefined && !scriptIds.has(script)) err(`${d.where}: roteiro inexistente "${script}"`);
    }
    if (d.requires) checkCondition(d.where, d.requires);
    if (d.locked && !dialogueIds.has(d.locked)) err(`${d.where}: fala de trancada inexistente "${d.locked}"`);
  }

  for (const beat of raw.story.beats) {
    const where = `story "${beat.id}"`;
    for (const dep of beat.after ?? []) if (!beatIds.has(dep)) err(`${where}: "after" aponta para "${dep}", que não existe`);
    if (beat.when) checkCondition(where, beat.when);
    if (beat.start) checkCondition(where, beat.start);
    beat.goal?.steps.forEach((s) => {
      checkCondition(where, s.when);
      if (s.icon && !raw.icons.icons[s.icon]) err(`${where}: ícone inexistente "${s.icon}"`);
      if (s.doses && !raw.cats.cats.some((c) => c.id === s.doses)) err(`${where}: doses de um gato inexistente "${s.doses}"`);
    });
    for (const effect of beat.effects) {
      if ('dialogue' in effect && !dialogueIds.has(effect.dialogue)) err(`${where}: fala inexistente "${effect.dialogue}"`);
      if ('cutscene' in effect && !cutsceneIds.has(effect.cutscene)) err(`${where}: cena inexistente "${effect.cutscene}"`);
      if ('giveItem' in effect && !itemIds.has(effect.giveItem)) err(`${where}: item inexistente "${effect.giveItem}"`);
      if ('setTime' in effect && !/^\d{1,2}:\d{2}$/.test(effect.setTime)) err(`${where}: hora inválida "${effect.setTime}"`);
      if ('discoverRoom' in effect && !raw.rooms.rooms.some((r) => r.id === effect.discoverRoom)) err(`${where}: cômodo inexistente "${effect.discoverRoom}"`);
      if ('setBusiness' in effect && !(BUSINESS_STAGES as readonly string[]).includes(effect.setBusiness)) err(`${where}: estágio do negócio inválido "${effect.setBusiness}"`);
      if ('startTimer' in effect && !(effect.minutes > 0)) err(`${where}: relógio "${effect.startTimer}" sem minutos`);
      if ('script' in effect && !scriptIds.has(effect.script)) err(`${where}: roteiro inexistente "${effect.script}"`);
      if ('shelterCat' in effect && !catIds.has(effect.shelterCat)) err(`${where}: gato inexistente "${effect.shelterCat}"`);
      if ('makeSick' in effect && !catIds.has(effect.makeSick)) err(`${where}: gato inexistente "${effect.makeSick}"`);
      // Gato de lembrança (a Tekinha) só existe nas memórias da protagonista: não é abrigado nem adoece.
      for (const id of ['shelterCat' in effect ? effect.shelterCat : null, 'makeSick' in effect ? effect.makeSick : null]) {
        if (id && raw.cats.cats.find((c) => c.id === id)?.memory) err(`${where}: "${id}" é um gato de lembrança e não pode ser abrigado nem adoecer`);
      }
    }
  }

  // Textos que a jogadora vê não podem ter notas de desenvolvimento (playerText, declarado no início).
  raw.items.items.forEach((i) => playerText(`item "${i.id}"`, i.name));
  raw.finishes.finishes.forEach((f) => playerText(`finish "${f.id}"`, f.name));
  (home?.surfaces ?? []).forEach((s) => playerText(`surface "${s.id}"`, s.name));
  for (const beat of raw.story.beats) {
    if (beat.goal) playerText(`story "${beat.id}"`, beat.goal.title);
    beat.goal?.steps.forEach((s) => [s.text, s.detail].forEach((t) => t && playerText(`story "${beat.id}"`, t)));
  }
  for (const [id, d] of Object.entries(raw.dialogue.dialogues)) d.lines.forEach((l) => playerText(`dialogue "${id}"`, l.text));
  for (const [id, cs] of Object.entries(raw.cutscenes.cutscenes)) cutsceneTexts(cs).forEach((t) => playerText(`cutscene "${id}"`, t));

  return errors;
}
