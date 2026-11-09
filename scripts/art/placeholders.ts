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

// PLACEHOLDER(arte): porão (no lugar do quartinho): parede de pedra, piso de lajotas e a escadinha da entrada.
/** Porão: parede de blocos de pedra cinza-amarronzada, fiadas desencontradas. */
function basementWall(): Canvas {
  const c = new Canvas(T, T);
  c.rect(0, 0, T, T, at(P.metal, 2));
  for (let row = 0; row < 4; row++) {
    const y = row * 8;
    const off = row % 2 ? 0 : 8;
    for (let x = -off; x < T; x += 16) {
      c.rect(Math.max(0, x + 1), y + 1, Math.min(14, T - Math.max(0, x + 1)), 6, at(P.metal, row % 2 ? 3 : 2));
      c.hline(Math.max(0, x + 1), y + 1, Math.min(14, T - Math.max(0, x + 1)), at(P.metal, 4));
    }
    c.hline(0, y, T, at(P.metal, 0));
  }
  return c;
}
/** Porão: piso de lajotas grandes, escuro. */
function basementFloor(): Canvas {
  const c = new Canvas(T, T);
  c.rect(0, 0, T, T, at(P.coffee, 2));
  for (const [x, y, w, h] of [[1, 1, 14, 14], [17, 1, 14, 14], [1, 17, 14, 14], [17, 17, 14, 14]] as const) {
    c.rect(x, y, w, h, at(P.metal, 2));
    c.hline(x, y, w, at(P.metal, 3));
  }
  c.speckle(0, 0, T, T, at(P.metal, 1), 0.06, rng(23));
  return c;
}
/**
 * Porão: escadinha na passagem entre o salão e o porão, 2 tiles (64x32): oito degraus de pedra descendo da esquerda
 * (o salão, claro) para a direita (o porão, escuro), cada um um tom mais fundo; o espelho de cada degrau em sombra.
 */
function basementStairs(): Canvas {
  const c = new Canvas(T * 2, T);
  const steps = 8;
  const w = (T * 2) / steps;
  for (let i = 0; i < steps; i++) {
    const x = i * w;
    // Degradê: tom 5 (claro) no primeiro, até 0 (quase preto) no último.
    const shade = Math.round(5 - (i * 5) / (steps - 1));
    c.rect(x, 0, w, T, at(P.metal, shade)); // pisada
    c.vline(x, 0, T, at(P.chalk, Math.min(3, Math.floor(i / 2)))); // espelho: a quina escura
    c.vline(x + w - 1, 0, T, at(P.metal, Math.min(5, shade + 1))); // a borda, clara
  }
  // Paredinhas laterais em cima e embaixo.
  c.rect(0, 0, T * 2, 3, at(P.metal, 1));
  c.rect(0, T - 3, T * 2, 3, at(P.metal, 1));
  return c;
}

/** Porta dos fundos (o jardim), de frente, 1x2: madeira com almofadas e maçaneta. */
function backDoor(): Canvas {
  const c = new Canvas(T, T * 2);
  c.rect(5, 6, 22, 58, at(P.oak, 2)); // batente
  c.rect(7, 8, 18, 56, at(P.oak, 3)); // folha
  c.rect(9, 12, 14, 18, at(P.oak, 4));
  c.rect(9, 36, 14, 22, at(P.oak, 4));
  c.rect(10, 13, 12, 3, at(P.oak, 5));
  c.rect(21, 34, 2, 3, at(P.gold, 3)); // maçaneta
  c.rect(4, 62, 24, 2, at(P.metal, 2)); // soleira
  return c.outline();
}

/** Cadeado com corrente, por cima da porta trancada. */
function padlock(): Canvas {
  const c = new Canvas(T, T);
  for (let x = 6; x < 26; x += 3) c.rect(x, 9 + ((x / 3) % 2), 2, 2, at(P.metal, 3)); // corrente
  c.rect(12, 14, 9, 8, at(P.gold, 3)); // corpo
  c.rect(12, 14, 9, 2, at(P.gold, 4));
  c.rect(14, 10, 1, 5, at(P.metal, 2)); // haste
  c.rect(18, 10, 1, 5, at(P.metal, 2));
  c.rect(14, 10, 5, 1, at(P.metal, 2));
  c.px(16, 18, at(P.walnut, 0)); // fechadura
  return c.outline();
}

/** Feira: o ponto de montar (caixotes empilhados com um cercadinho dobrado e um rolo de cartaz). */
function fairSetup(): Canvas {
  const c = new Canvas(T, T);
  c.rect(3, 16, 14, 12, at(P.oak, 3)); // caixote de baixo
  c.rect(3, 16, 14, 2, at(P.oak, 4));
  c.vline(10, 18, 10, at(P.oak, 2));
  c.rect(6, 6, 10, 10, at(P.oak, 3)); // caixote de cima
  c.rect(6, 6, 10, 2, at(P.oak, 4));
  for (let x = 19; x < 29; x += 3) c.vline(x, 12, 16, at(P.cream, 4)); // grade do cercadinho dobrado
  c.hline(18, 13, 11, at(P.cream, 2));
  c.hline(18, 26, 11, at(P.cream, 2));
  c.rect(20, 4, 3, 9, at(P.rose, 3)); // rolo do cartaz
  return c.outline();
}

// Ordem das peças na folha (data/tilesets/placeholders.json): caixa, cocô, placa, bandeirinhas, balões, mesa, pegadas,
// parede do porão, piso do porão, cadeado; a porta dos fundos (1x2) por último, ocupando as duas linhas; a escada (2x1) na
// segunda linha, embaixo das primeiras; ao lado dela, o ponto de montar a feira.
const pieces = [litterBox(), poop(), fairSign(), fairBunting(), fairBalloons(), fairTable(), footprints(), basementWall(), basementFloor(), padlock()];
const sheet = new Canvas((pieces.length + 1) * T, T * 2);
pieces.forEach((piece, i) => sheet.blit(piece, i * T, 0));
sheet.blit(backDoor(), pieces.length * T, 0);
sheet.blit(basementStairs(), 0, T); // 2x1, na segunda linha
sheet.blit(fairSetup(), 2 * T, T); // o ponto de montar a feira, ao lado da escada
writeWithBackup(sheet, 'public/assets/objects/placeholders/tile_placeholders.png');

/** Ícone do cobertor de gato (item.cat_blanket): mantinha xadrez dobrada. */
function blanketIcon(): Canvas {
  const c = new Canvas(T, T);
  c.rect(5, 9, 22, 16, at(P.rose, 3));
  for (let x = 5; x < 27; x += 4) c.vline(x, 9, 16, at(P.rose, 4));
  for (let y = 9; y < 25; y += 4) c.hline(5, y, 22, at(P.cream, 5));
  c.rect(5, 21, 22, 4, at(P.rose, 2)); // a dobra
  return c.outline();
}
writeWithBackup(blanketIcon(), 'public/assets/objects/placeholders/icon_blanket.png');

// PLACEHOLDER(arte): ícones da varinha (item.cat_wand) e da escova (item.cat_brush), 32x32 (lista em assets-pendentes).
/** Varinha de penas: cabo de madeira na diagonal, fio e o pompom com penas na ponta. */
function wandIcon(): Canvas {
  const c = new Canvas(T, T);
  c.line(5, 28, 19, 10, at(P.pine, 2)); // cabo
  c.line(6, 28, 20, 10, at(P.pine, 4));
  c.line(20, 10, 23, 15, at(P.cream, 1)); // fio
  c.ellipse(21, 19, 2, 4, at(P.sky, 3)); // penas
  c.ellipse(25, 19, 2, 4, at(P.butter, 3));
  c.ellipse(23, 17, 2, 4, at(P.rose, 3));
  c.ball(23, 22, 3, 3, P.red); // pompom
  return c.outline();
}
/** Escova de pelo: cabo de madeira e as cerdas claras. */
function brushIcon(): Canvas {
  const c = new Canvas(T, T);
  c.rect(6, 12, 20, 9, at(P.oak, 3)); // corpo
  c.rect(6, 12, 20, 2, at(P.oak, 4));
  c.rect(12, 21, 8, 7, at(P.oak, 2)); // cabo
  for (let x = 7; x < 26; x += 2) c.vline(x, 7, 5, at(P.cream, 4)); // cerdas
  return c.outline();
}
writeWithBackup(wandIcon(), 'public/assets/objects/placeholders/icon_wand.png');
writeWithBackup(brushIcon(), 'public/assets/objects/placeholders/icon_brush.png');
console.log('placeholders: public/assets/objects/placeholders/tile_placeholders.png (caixa de areia, cocô, feira)');
const i = process.argv.indexOf('--preview');
if (i > 0) preview(sheet, 8, process.argv[i + 1]!);
