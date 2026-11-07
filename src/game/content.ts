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
import phoneJson from '../../data/phone.json';
import toolsJson from '../../data/tools.json';
import marketJson from '../../data/maps/market.json';
import { buildContent, type Content, type RawContent } from '../core/content';

export const content: Content = buildContent({
  catalog: tilesJson,
  maps: [cafeJson, streetJson, marketJson],
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
} as unknown as RawContent);

export const uiText = uiTextJson;

/** Vassoura (quadros e tempos). */
export const broom = toolsJson.broom as unknown as {
  image: string;
  handle: [number, number];
  sweepMs: number;
  sweepFps: number;
  frames: Record<string, [number, number, number, number]>;
};

/** Celular das cenas (moldura e ícones). */
export const phone = phoneJson as unknown as { frame: string; size: [number, number]; screen: { x: number; y: number; w: number; h: number }; status: string; notification: string; apps: Record<string, string> };
