// npm run art (parte 2): desenha por código as peças que ainda não têm arte (placeholders) na paleta Cosy,
// em public/assets/placeholders/placeholders.png. Trocar pela arte de verdade quando chegar (data/tilesets.json).
// Hoje: a pia do café (32 x 32).
import { mkdirSync, writeFileSync } from 'node:fs';
import { PNG } from 'pngjs';

type RGB = [number, number, number];
const TS = 32;
const C = {
  ink: [60, 42, 50],
  cream: [255, 244, 224],
  steel1: [217, 212, 214],
  steel2: [169, 159, 166],
  steel3: [122, 110, 118],
  water: [160, 206, 226],
  wood: [127, 75, 51],
  wood2: [92, 52, 40],
} satisfies Record<string, RGB>;

const png = new PNG({ width: TS, height: TS });
const set = (x: number, y: number, c: RGB) => {
  const i = (y * TS + x) * 4;
  png.data[i] = c[0];
  png.data[i + 1] = c[1];
  png.data[i + 2] = c[2];
  png.data[i + 3] = 255;
};
const rect = (x0: number, y0: number, w: number, h: number, c: RGB) => {
  for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) set(x, y, c);
};
const outline = (x0: number, y0: number, w: number, h: number, c: RGB) => {
  for (let x = x0; x < x0 + w; x++) {
    set(x, y0, c);
    set(x, y0 + h - 1, c);
  }
  for (let y = y0; y < y0 + h; y++) {
    set(x0, y, c);
    set(x0 + w - 1, y, c);
  }
};

// Gabinete de madeira.
rect(2, 14, 28, 17, C.wood);
rect(4, 18, 11, 11, C.wood2);
rect(17, 18, 11, 11, C.wood2);
outline(2, 14, 28, 17, C.ink);
// Tampo de inox com a cuba.
rect(1, 9, 30, 6, C.steel1);
outline(1, 9, 30, 6, C.ink);
rect(6, 10, 20, 4, C.steel3);
rect(7, 11, 18, 2, C.water);
// Torneira.
rect(15, 3, 2, 7, C.steel2);
rect(15, 3, 7, 2, C.steel2);
rect(20, 5, 2, 2, C.steel3);
outline(14, 2, 4, 8, C.ink);
set(21, 7, C.water);

mkdirSync('public/assets/placeholders', { recursive: true });
writeFileSync('public/assets/placeholders/placeholders.png', PNG.sync.write(png));
console.log('placeholders.png: pia');
