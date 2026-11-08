// Checagem técnica de um pacote de arte (rodar na raiz do projeto).
//   node .claude/skills/novo-pacote-arte/check-art.mjs <pasta>
//   node .claude/skills/novo-pacote-arte/check-art.mjs <pasta> --prancha <saida.png> <img[#x,y,w,h]> ...
// Só lê os arquivos do pacote; a prancha é gravada onde for pedido.
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';

const { PNG } = createRequire(join(process.cwd(), 'package.json'))('pngjs');
const PALETTES = [
  'assets/_originais_pacotes/Cat-Cafe-32x32/cosy-palette.gpl',
  'assets/_originais_pacotes/Cosy-Cats-32x32/cosy-cats-palette.gpl',
];
const PREVIEW = /(preview|rotulado|_2x\.|_4x\.|original|demo|cena|scenes|todos|exemplo)/i;
const NAME_OK = /^[a-z0-9_]+\.[a-z0-9]+$/;
const FAR = 24; // distância RGB a partir da qual a cor é visivelmente outra

const [dir, flag, out, ...items] = process.argv.slice(2);
if (!dir) {
  console.error('uso: node .claude/skills/novo-pacote-arte/check-art.mjs <pasta> [--prancha saida.png img...]');
  process.exit(1);
}
const read = (p) => PNG.sync.read(readFileSync(p));

if (flag === '--prancha') {
  prancha(out, items);
  process.exit(0);
}

const palette = PALETTES.filter(existsSync).flatMap((f) =>
  readFileSync(f, 'utf8').split(/\r?\n/).map((l) => l.trim().match(/^(\d+)\s+(\d+)\s+(\d+)/)).filter(Boolean).map((m) => [+m[1], +m[2], +m[3]]),
);
if (!palette.length) console.warn('! paletas Cosy não encontradas; checagem de paleta desligada');
const nearCache = new Map();
function near(c) {
  if (nearCache.has(c)) return nearCache.get(c);
  const r = c >> 16, g = (c >> 8) & 255, b = c & 255;
  let m = Infinity;
  for (const p of palette) m = Math.min(m, (p[0] - r) ** 2 + (p[1] - g) ** 2 + (p[2] - b) ** 2);
  m = Math.sqrt(m);
  nearCache.set(c, m);
  return m;
}

/** Maior k (2..4) em que a imagem é feita de blocos k x k iguais: arte ampliada. */
function pixelScale({ width: w, height: h, data }) {
  let best = 1;
  for (const k of [2, 3, 4]) {
    if (w < k * 4 || h < k * 4) continue;
    let total = 0, uniform = 0;
    for (let y = 0; y + k <= h; y += k) {
      for (let x = 0; x + k <= w; x += k) {
        const b = data.readUInt32BE((y * w + x) * 4);
        if ((b & 255) === 0) continue;
        total++;
        let same = true;
        for (let yy = 0; yy < k && same; yy++) for (let xx = 0; xx < k; xx++) if (data.readUInt32BE(((y + yy) * w + x + xx) * 4) !== b) { same = false; break; }
        if (same) uniform++;
      }
    }
    if (total && uniform / total > 0.97) best = k;
  }
  return best;
}

function frames(w, h) {
  if (w === 128 && h === 256) return '32x64 · 4x4';
  if (w === 128 && h === 320) return '32x64 · 4x5';
  if (w > 32 && h === 32 && w % 32 === 0) return `32x32 · ${w / 32}`;
  if (w > 64 && w % 32 === 0 && h % 32 === 0) return `grade 32 · ${w / 32}x${h / 32}`;
  return '';
}

function walk(d) {
  return readdirSync(d).flatMap((n) => (statSync(join(d, n)).isDirectory() ? walk(join(d, n)) : [join(d, n)]));
}

const rows = [];
const byPixels = new Map();
for (const f of walk(dir).filter((f) => /\.png$/i.test(f))) {
  const rel = f.replace(/\\/g, '/');
  const name = rel.split('/').pop();
  const img = read(f);
  const { width: w, height: h, data } = img;
  let opaque = 0, far = 0;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] === 0) continue;
    opaque++;
    if (palette.length && near((data[i] << 16) | (data[i + 1] << 8) | data[i + 2]) > FAR) far++;
  }
  const px = (x, y) => data.readUInt32BE((y * w + x) * 4);
  const corners = [px(0, 0), px(w - 1, 0), px(0, h - 1), px(w - 1, h - 1)];
  const hash = createHash('md5').update(data).update(`${w}x${h}`).digest('hex');
  byPixels.set(hash, [...(byPixels.get(hash) ?? []), rel]);
  const warn = [];
  if (w % 32 || h % 32) warn.push(w % 16 || h % 16 ? 'fora da grade 32/16' : 'fora da grade 32 (16 ok só p/ item pequeno)');
  const scale = pixelScale(img);
  if (scale > 1) warn.push(`pixel ${scale}x (ampliada)`);
  if (corners.every((c) => (c & 255) === 255)) warn.push('cantos opacos (fundo?)');
  const farPct = opaque ? Math.round((100 * far) / opaque) : 0;
  if (farPct > 25) warn.push(`fora da paleta ${farPct}%`);
  if (!NAME_OK.test(name)) warn.push('nome fora de snake_case');
  rows.push({ rel, w, h, kb: (statSync(f).size / 1024).toFixed(1), fr: frames(w, h), preview: PREVIEW.test(rel), warn });
}

const print = (list) => {
  console.log('| Arquivo | Dimensões | KB | Quadros | Avisos |\n|---|---|---|---|---|');
  for (const r of list) console.log(`| ${r.rel} | ${r.w}x${r.h} | ${r.kb} | ${r.fr} | ${r.warn.join('; ') || 'ok'} |`);
};
const game = rows.filter((r) => !r.preview);
console.log(`\n## Peças (${game.length})\n`);
print(game);
const prev = rows.filter((r) => r.preview);
if (prev.length) console.log(`\n## Previews/demos (não vão para o jogo): ${prev.map((r) => r.rel.split('/').pop()).join(', ')}`);
const dups = [...byPixels.values()].filter((v) => v.length > 1);
if (dups.length) console.log(`\n## Duplicatas (mesmos pixels)\n${dups.map((v) => '- ' + v.join(' = ')).join('\n')}`);
const withWarn = game.filter((r) => r.warn.length).length;
console.log(`\nResumo: ${game.length} peças, ${withWarn} com aviso, ${prev.length} previews, ${dups.length} grupos duplicados.`);

/** Junta imagens ampliadas 4x (vizinho mais próximo) lado a lado, sobre fundo xadrez, para comparar. */
function prancha(outFile, list) {
  const S = 4, G = 6;
  const parts = list.map((it) => {
    const [p, crop] = it.split('#');
    const img = read(p);
    const [x, y, w, h] = crop ? crop.split(',').map(Number) : [0, 0, img.width, img.height];
    return { img, x, y, w, h };
  });
  const W = parts.reduce((a, p) => a + p.w * S + G, G);
  const H = Math.max(...parts.map((p) => p.h)) * S + 2 * G;
  const o = new PNG({ width: W, height: H });
  for (let i = 0; i < o.data.length; i += 4) {
    const px = (i / 4) % W, py = Math.floor(i / 4 / W);
    const v = ((px >> 3) + (py >> 3)) & 1 ? 200 : 184;
    o.data.set([v, v - 6, v - 12, 255], i);
  }
  let ox = G;
  for (const p of parts) {
    const oy = H - G - p.h * S; // base alinhada embaixo, como no jogo
    for (let y = 0; y < p.h * S; y++) {
      for (let x = 0; x < p.w * S; x++) {
        const sx = p.x + Math.floor(x / S), sy = p.y + Math.floor(y / S);
        const si = (sy * p.img.width + sx) * 4, a = p.img.data[si + 3] / 255;
        if (!a) continue;
        const di = ((oy + y) * W + ox + x) * 4;
        for (let k = 0; k < 3; k++) o.data[di + k] = Math.round(p.img.data[si + k] * a + o.data[di + k] * (1 - a));
      }
    }
    ox += p.w * S + G;
  }
  writeFileSync(outFile, PNG.sync.write(o));
  console.log(`prancha: ${outFile} (${W}x${H}), ordem: ${list.join(', ')}`);
}
