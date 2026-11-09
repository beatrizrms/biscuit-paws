// Junta os arquivos de data/ num Content para a sessão de jogo.
import tilesJson from '../../data/tiles.json';
import cafeJson from '../../data/maps/cafe_main.json';
import streetJson from '../../data/maps/street.json';
import worldJson from '../../data/world.json';
import itemsJson from '../../data/items.json';
import finishesJson from '../../data/finishes.json';
import economyJson from '../../data/economy.json';
import storyJson from '../../data/story.json';
import dialogueJson from '../../data/dialogue.json';
import uiTextJson from '../../data/ui_text.json';
import catsJson from '../../data/cats.json';
import catSpritesJson from '../../data/cat_sprites.json';
import cutscenesJson from '../../data/cutscenes.json';
import relationshipsJson from '../../data/relationships.json';
import shopsJson from '../../data/shops.json';
import iconsJson from '../../data/icons.json';
import npcsJson from '../../data/npcs.json';
import scriptsJson from '../../data/scripts.json';
import dayNightJson from '../../data/daynight.json';
import recipesJson from '../../data/recipes.json';
import serviceJson from '../../data/service.json';
import carryJson from '../../data/carry.json';
import serviceArtJson from '../../data/service_art.json';
import emotesJson from '../../data/emotes.json';
import jobsJson from '../../data/jobs.json';
import newsJson from '../../data/news.json';
import deliveryJson from '../../data/delivery.json';
import healthJson from '../../data/health.json';
import minigamesJson from '../../data/minigames.json';
import minigameChaseJson from '../../data/maps/minigame_chase.json';
import businessJson from '../../data/business.json';
import characterJson from '../../data/character.json';
import roomsJson from '../../data/rooms.json';
import seasonsJson from '../../data/seasons.json';
import adoptionJson from '../../data/adoption.json';
import reputationJson from '../../data/reputation.json';
import catProfilesJson from '../../data/cat_profiles.json';
import arrivalsJson from '../../data/arrivals.json';
import festivalsJson from '../../data/festivals.json';
import fairSetupJson from '../../data/fair_setup.json';
import costumeJson from '../../data/costume.json';
import photoJson from '../../data/photo.json';
import phoneJson from '../../data/phone.json';
import toolsJson from '../../data/tools.json';
import marketJson from '../../data/maps/market.json';
import vetClinicJson from '../../data/maps/vet_clinic.json';
import { buildContent, type Content, type RawContent } from '../core/content';

export const content: Content = buildContent({
  catalog: tilesJson,
  maps: [cafeJson, streetJson, marketJson, vetClinicJson, minigameChaseJson],
  world: worldJson,
  items: itemsJson,
  finishes: finishesJson,
  economy: economyJson,
  story: storyJson,
  dialogue: dialogueJson,
  cats: catsJson,
  catSprites: catSpritesJson,
  cutscenes: cutscenesJson,
  relationships: relationshipsJson,
  shops: shopsJson,
  icons: iconsJson,
  npcs: npcsJson,
  scripts: scriptsJson,
  dayNight: dayNightJson,
  recipes: recipesJson,
  service: serviceJson,
  carry: carryJson,
  emotes: emotesJson,
  jobs: jobsJson,
  news: newsJson,
  delivery: deliveryJson,
  health: healthJson,
  minigames: minigamesJson,
  business: businessJson,
  character: characterJson,
  rooms: roomsJson,
  seasons: seasonsJson,
  adoption: adoptionJson,
  reputation: reputationJson,
  catProfiles: catProfilesJson,
  arrivals: arrivalsJson,
  festivals: festivalsJson,
  fairSetup: fairSetupJson,
  costume: costumeJson,
  photo: photoJson,
} as unknown as RawContent);

/** Arte do atendimento (quadro, balões, barra, louça no mundo, moeda). */
export const serviceArt = serviceArtJson as unknown as {
  boards: Record<string, { image: string; size: [number, number]; slots: { icon: [number, number, number, number]; price: [number, number, number, number] }[] }>;
  soldOut: { veil: string; mark: string };
  bubble: { normal: string; impatient: string; furious: string; iconSlot: [number, number, number, number]; impatientBelow: number; furiousBelow: number; scale: number; waiting: string[] };
  progress: string[];
  coin: string;
  readyMarker: string[];
  trayIcons: string[];
  handAnchor: Record<'down' | 'left' | 'right' | 'up', [number, number]>;
  dishes: { image: string; tile: number; rows: Record<string, number>; cols: Record<'clean' | 'full' | 'dirty', number> };
};

/** Balões de emoção (16x16) sobre personagens, gatos e NPCs. */
export const emotes = emotesJson as unknown as { image: string; frames: Record<string, [number, number, number, number]> };

export const uiText = uiTextJson;

/** Vassoura (quadros e tempos). */
export const broom = toolsJson.broom as unknown as {
  image: string;
  /** Vassoura na mão: segue as mãos da pose de ação (pontos em pixels da arte). */
  hold: { image: string; resolution: number; grip: [number, number]; handHeight: number; handDx: number[] };
  sweepMs: number;
  sweepFps: number;
  frames: Record<string, [number, number, number, number]>;
};

/** Usar um item da barra: tempos da animação (ícone na mão). */
export const itemUse = toolsJson.use as unknown as { pickMs: number; moveMs: number; pourMs: number; giveMs: number; grains: number; grainColor: string };

/** Celular das cenas (moldura e ícones). */
export const phone = phoneJson as unknown as { frame: string; size: [number, number]; screen: { x: number; y: number; w: number; h: number }; status: string; notification: string; apps: Record<string, string> };
