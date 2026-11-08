// npx tsx scripts/art/placeholders.ts [--preview <png>]
// Arte provisória desenhada por código (32 px, paleta Cosy), até a arte de verdade (PixelLab) chegar:
// a caixa de areia do gato, o cocô do dia 2, a feira de adoção (placa, bandeirinhas, balões e a mesa) e as pegadas. Folha: data/tilesets.json "placeholders" (peças em data/tilesets/placeholders.json).
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

/** Feira: placa de cavalete "fechado para a feira" (rosa, com uma patinha). */
function fairSign(): Canvas {
  const c = new Canvas(T, T);
  c.line(9, 30, 13, 8, at(P.walnut, 3));
  c.line(22, 30, 18, 8, at(P.walnut, 3));
  c.rect(7, 6, 18, 14, at(P.cream, 5));
  c.rect(7, 6, 18, 3, at(P.rose, 3));
  for (const [x, y] of [[13, 14], [16, 12], [19, 14]] as const) c.rect(x, y, 2, 2, at(P.rose, 2));
  c.rect(14, 15, 5, 3, at(P.rose, 2));
  return c.outline();
}

/** Feira: varal de bandeirinhas coloridas. */
function fairBunting(): Canvas {
  const c = new Canvas(T, T);
  c.line(1, 6, 30, 6, at(P.walnut, 2));
  const flags = [P.rose, P.butter, P.mint, P.sky, P.lilac];
  flags.forEach((r, i) => {
    const x = 2 + i * 6;
    for (let k = 0; k < 5; k++) c.hline(x + Math.floor(k / 2), 7 + k, 5 - k, at(r, 3));
  });
  return c.outline();
}

/** Feira: três balões amarrados. */
function fairBalloons(): Canvas {
  const c = new Canvas(T, T);
  c.line(16, 30, 10, 14, at(P.metal, 2));
  c.line(16, 30, 16, 12, at(P.metal, 2));
  c.line(16, 30, 22, 14, at(P.metal, 2));
  c.ball(10, 9, 5, 6, P.rose);
  c.ball(22, 9, 5, 6, P.sky);
  c.ball(16, 6, 5, 6, P.butter);
  return c.outline();
}

/** Feira: mesa com toalha rosa e uma plaquinha "adote". */
function fairTable(): Canvas {
  const c = new Canvas(T, T);
  c.rect(3, 12, 26, 14, at(P.rose, 3));
  c.rect(3, 12, 26, 3, at(P.rose, 4));
  for (let x = 4; x < 28; x += 4) c.vline(x, 16, 9, at(P.rose, 2));
  c.rect(11, 5, 10, 7, at(P.cream, 5));
  c.rect(14, 7, 4, 3, at(P.rose, 2));
  return c.outline();
}

/** Chegada pegadas: duas patinhas na neve (cinza-azulado, meio apagadas). */
function footprints(): Canvas {
  const c = new Canvas(T, T);
  const paw = (x: number, y: number) => {
    c.ellipse(x, y, 2.5, 2, at(P.sky, 1));
    for (const [dx, dy] of [[-2, -3], [0, -4], [2, -3]] as const) c.px(x + dx, y + dy, at(P.sky, 1));
  };
  paw(11, 12);
  paw(20, 22);
  return c;
}

// Ordem das peças na folha (data/tilesets/placeholders.json): caixa, cocô, placa, bandeirinhas, balões, mesa, pegadas.
const pieces = [litterBox(), poop(), fairSign(), fairBunting(), fairBalloons(), fairTable(), footprints()];
const sheet = new Canvas(pieces.length * T, T);
pieces.forEach((piece, i) => sheet.blit(piece, i * T, 0));
writeWithBackup(sheet, 'public/assets/objects/placeholders/tile_placeholders.png');
console.log('placeholders: public/assets/objects/placeholders/tile_placeholders.png (caixa de areia, cocô, feira)');
const i = process.argv.indexOf('--preview');
if (i > 0) preview(sheet, 8, process.argv[i + 1]!);
