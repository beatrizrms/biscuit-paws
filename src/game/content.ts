// Junta os arquivos de data/ num Content para a sessão de jogo.
import tilesJson from '../../data/tiles.json';
import cafeJson from '../../data/maps/cafe_main.json';
import itemsJson from '../../data/items.json';
import economyJson from '../../data/economy.json';
import storyJson from '../../data/story.json';
import dialogueJson from '../../data/dialogue.json';
import uiTextJson from '../../data/ui_text.json';
import { buildContent, type Content, type RawContent } from '../core/content';

export const content: Content = buildContent({
  catalog: tilesJson,
  map: cafeJson,
  items: itemsJson,
  economy: economyJson,
  story: storyJson,
  dialogue: dialogueJson,
} as unknown as RawContent);

export const uiText = uiTextJson;
