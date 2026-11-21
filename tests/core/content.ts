// Carrega o conteúdo real de data/ para os testes.
import { readFileSync, readdirSync } from 'node:fs';
import { loadCatalogFromDisk } from '../../scripts/catalog-node';
import { buildContent, type Content, type RawContent } from '../../src/core/content';
import type { MapData } from '../../src/core/map';

const read = <T>(path: string) => JSON.parse(readFileSync(path, 'utf8')) as T;

export function rawContent(): RawContent {
  return {
    catalog: loadCatalogFromDisk(),
    maps: readdirSync('data/maps')
      .filter((f) => f.endsWith('.json'))
      .map((f) => read<MapData>(`data/maps/${f}`)),
    world: read('data/world.json'),
    items: read('data/items.json'),
    finishes: read('data/finishes.json'),
    economy: read('data/economy.json'),
    story: read('data/story.json'),
    dialogue: read('data/dialogue.json'),
    cats: read('data/cats.json'),
    catSprites: read('data/cat_sprites.json'),
    cutscenes: read('data/cutscenes.json'),
    relationships: read('data/relationships.json'),
    shops: read('data/shops.json'),
    icons: read('data/icons.json'),
    npcs: read('data/npcs.json'),
    scripts: read('data/scripts.json'),
    dayNight: read('data/daynight.json'),
    recipes: read('data/recipes.json'),
    service: read('data/service.json'),
    carry: read('data/carry.json'),
    emotes: read('data/emotes.json'),
    jobs: read('data/jobs.json'),
    news: read('data/news.json'),
    delivery: read('data/delivery.json'),
    health: read('data/health.json'),
    minigames: read('data/minigames.json'),
    business: read('data/business.json'),
    character: read('data/character.json'),
    rooms: read('data/rooms.json'),
    seasons: read('data/seasons.json'),
    adoption: read('data/adoption.json'),
    reputation: read('data/reputation.json'),
    milestones: read('data/milestones.json'),
    festive: read('data/festive.json'),
    requests: read('data/requests.json'),
    catProfiles: read('data/cat_profiles.json'),
    clinic: read('data/clinic.json'),
    vetText: read('data/vet_text.json'),
    ced: read('data/ced.json'),
    cedText: read('data/ced_text.json'),
    friendship: read('data/friendship.json'),
    arrivals: read('data/arrivals.json'),
    festivals: read('data/festivals.json'),
    fairSetup: read('data/fair_setup.json'),
    costume: read('data/costume.json'),
    photo: read('data/photo.json'),
  };
}

/**
 * O conteúdo de data/. Sem as etapas do Market aos poucos (items.json: marketStages), a não ser que peça: a maioria
 * dos testes monta o jogo direto (compra uma mesa num save novo), sem passar pela história. Os testes da história do
 * começo e os do Market aos poucos pedem as etapas.
 */
export function loadContent(opts: { marketStages?: boolean; jobOffers?: boolean } = {}): Content {
  const raw = rawContent();
  // Sem o sorteio dos pedidos do dia (jobs.json: offersPerDay), a não ser que peça: os testes aceitam o pedido que querem.
  if (!opts.jobOffers) raw.jobs = { ...raw.jobs, offersPerDay: undefined };
  if (!opts.marketStages) raw.items = { ...raw.items, marketStages: [] };
  return buildContent(raw);
}
