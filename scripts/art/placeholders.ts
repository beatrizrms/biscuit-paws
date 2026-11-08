// npx tsx scripts/art/placeholders.ts [--preview <png>]
// Arte provisória desenhada por código (32 px, paleta Cosy), até a arte de verdade (PixelLab) chegar:
// a caixa de areia do gato e o cocô do dia 2. Folha: data/tilesets.json "placeholders" (peças em data/tilesets/placeholders.json).
import { Canvas, at, preview, rng, writeWithBackup } from './lib';
import { P } from './palette';

const T = 32;

/** Caixa de areia vista de cima/frente: bandeja rosa com areia clara dentro e uma pazinha. */
function litterBox(): Canvas {
  const c = new Canvas(T, T);
  c.rect(3, 12, 26, 15, at(P.rose, 3)); // borda/bandeja
  c.rect(3, 12, 26, 2, at(P.rose, 4));
  c.rect(3, 24, 26, 3, at(P.rose, 2)); // frente na sombra
  c.rect(5, 14, 22, 9, at(P.butter, 4)); // areia
  c.speckle(5, 14, 22, 9, at(P.butter, 3), 0.25, rng(7));
  c.speckle(5, 14, 22, 9, at(P.butter, 5), 0.12, rng(11));
  c.rect(20, 7, 2, 8, at(P.mint, 3)); // cabo da pazinha
  c.rect(18, 14, 6, 3, at(P.mint, 4)); // pá
  return c.outline();
}

/** Cocô de gato no chão: três bolinhas marrons com brilho, e moscas de mentirinha (só um pontinho). */
function poop(): Canvas {
  const c = new Canvas(T, T);
  c.ball(13, 22, 5, 3.5, P.coffee);
  c.ball(19, 21, 4, 3, P.coffee, 0.05);
  c.ball(16, 17, 3.5, 3, P.coffee, 0.1);
  c.px(15, 16, at(P.coffee, 4));
  c.px(12, 20, at(P.coffee, 4));
  c.outline();
  c.px(22, 12, at(P.metal, 1));
  c.px(10, 11, at(P.metal, 1));
  return c;
}

const sheet = new Canvas(2 * T, T);
sheet.blit(litterBox(), 0, 0);
sheet.blit(poop(), T, 0);
writeWithBackup(sheet, 'public/assets/objects/placeholders/tile_placeholders.png');
console.log('placeholders: public/assets/objects/placeholders/tile_placeholders.png (caixa de areia, cocô)');
const i = process.argv.indexOf('--preview');
if (i > 0) preview(sheet, 8, process.argv[i + 1]!);
