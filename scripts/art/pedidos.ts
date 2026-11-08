// npx tsx scripts/art/pedidos.ts
// Monta os pedidos de arte para um gerador de imagem (ChatGPT): para cada lote de peças,
// um molde 1024x1024 (fundo magenta, arte atual de cada peça já no lugar e no tamanho certos),
// o texto do pedido e um layout.json para converter a resposta de volta (scripts/art/converter.ts, a fazer).
// Saída em pedidos_arte/ (fora do Git) + pedidos_arte.zip. Não muda nada do jogo.
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { PNG } from 'pngjs';

const OUT = 'pedidos_arte';
const MAGENTA = [255, 0, 255] as const;
/** Onde o objeto fica no jogo (muda como ele encosta na área do tile). */
type Place = 'chao' | 'sobre' | 'parede' | 'piso' | 'pendurado' | 'icone' | 'fachada';
type Piece = { name: string; label: string; image: string; x: number; y: number; w: number; h: number; place: Place }; // w/h em tiles de 32
const PLACE_TAG: Record<Place, string> = {
  chao: '[chão]', sobre: '[sobre balcão/mesa]', parede: '[parede]', piso: '[piso]', pendurado: '[pendurado]', icone: '[ícone]', fachada: '[fachada]',
};
// Comidas, bebidas e coisas que ficam em cima de balcão ou mesa; coisas penduradas no teto.
const SOBRE = /^(cake_|cupcake|macarons|cookie_jar|latte|tea_cup|teapot|milkshake|croissant|fish_biscuits|coffee_machine|caixa_registradora|leitor_codigo)/;
const PENDURADO = /^(plant_hanging|luminaria_teto|luzinhas_fio|luminaria)$/;
const layerToPlace = (layer: string | undefined): Place => (layer === 'floor' ? 'piso' : layer === 'wall' ? 'parede' : 'chao');
const placeOf = (name: string, layer: string | undefined): Place => (PENDURADO.test(name) ? 'pendurado' : SOBRE.test(name) ? 'sobre' : layerToPlace(layer));
type Group = { id: string; title: string; scale: 4 | 2; context: string; pieces: Piece[] };

const read = <T>(p: string) => JSON.parse(readFileSync(p, 'utf8')) as T;
const pngCache = new Map<string, PNG>();
const png = (p: string) => { if (!pngCache.has(p)) pngCache.set(p, PNG.sync.read(readFileSync(`public/${p}`))); return pngCache.get(p)!; };
const human = (n: string) => n.replace(/_/g, ' ');

// ---------- de onde vêm as peças ----------
type TilesetJson = { pieces: Record<string, { col: number; row: number; w_tiles?: number; h_tiles?: number }> };
type SheetDef = { id: string; image: string; pieces: string; layer?: string; overrides?: Record<string, { layer?: string }> };
const tilesets = read<{ sheets: SheetDef[] }>('data/tilesets.json').sheets;
function fromTileset(id: string, skip: RegExp, label: (n: string) => string = human, force?: Place): Piece[] {
  const s = tilesets.find((t) => t.id === id);
  if (!s) throw new Error(`folha ${id} não encontrada`);
  const j = read<TilesetJson>(`data/tilesets/${s.pieces}`);
  return Object.entries(j.pieces)
    .filter(([n]) => !skip.test(n))
    .map(([n, v]) => ({ name: n, label: label(n), image: s.image, x: v.col, y: v.row, w: v.w_tiles ?? 1, h: v.h_tiles ?? 1, place: force ?? placeOf(n, s.overrides?.[n]?.layer ?? s.layer) }));
}

const CAFE_PT: Record<string, string> = {
  floor_rug: 'tapete grande com franja', doormat: 'capacho', window: 'janela com cortinas', door: 'porta de madeira verde com placa',
  menu_board: 'lousa do cardápio na parede', wall_clock: 'relógio de parede com orelhas de gato', picture_paw: 'quadro com pata de gato', wall_shelf: 'prateleira de parede com potes e livros',
  coffee_machine: 'máquina de espresso', display_case: 'vitrine de doces com vidro', cake_whole: 'bolo inteiro no prato', cake_slice: 'fatia de bolo no prato', cupcake: 'cupcake',
  macarons: 'macarons no prato', cookie_jar: 'pote de biscoitos', latte: 'xícara de latte com pires', tea_cup: 'xícara de chá com pires', teapot: 'bule de chá',
  milkshake: 'milkshake com canudo', croissant: 'croissants no prato', fish_biscuits: 'biscoitos de peixe no prato', cake_stand: 'boleira de dois andares',
  table_round: 'mesa redonda de madeira', chair_front: 'cadeira de madeira com assento estofado, vista de frente', chair_back: 'a mesma cadeira vista de costas',
  chair_left: 'a mesma cadeira de perfil, virada para a esquerda', chair_right: 'a mesma cadeira de perfil, virada para a direita', sofa: 'sofá de veludo',
  bookshelf: 'estante com livros', cat_tree: 'árvore de gato com plataformas e casinha', cat_condo: 'torre de gato com dois andares e buracos', scratch_post: 'arranhador de sisal',
  cushion_pink: 'almofada de chão rosa', cushion_mint: 'almofada de chão menta', cushion_sky: 'almofada de chão azul', cushion_lav: 'almofada de chão lilás', cushion_butter: 'almofada de chão amarela',
  cat_bed: 'caminha de gato redonda', food_bowl: 'tigela de ração', water_bowl: 'tigela de água', yarn_balls: 'novelos de lã', plant_pot: 'planta em vaso de barro',
  plant_tall: 'planta alta em vaso', plant_hanging: 'planta pendurada', cactus: 'cacto em vaso', flower_vase: 'vaso com flores',
};
const tileMeta = read<{ tiles: Record<string, { layer?: string }> }>('data/tiles.meta.json').tiles;
function cafePieces(): Piece[] {
  const csv = readFileSync('data/tiles.csv', 'utf8').trim().split(/\r?\n/).slice(1);
  return csv
    .map((l) => l.split(','))
    .filter(([n]) => !/^(floor_wood|floor_check|floor_tile|wall_|counter_)/.test(n!))
    .map(([n, c, r, w, h]) => ({ name: n!, label: CAFE_PT[n!] ?? human(n!), image: 'assets/interiors/cafe/tile_cafe.png', x: +c!, y: +r!, w: +w!, h: +h!, place: placeOf(n!, tileMeta[n!]?.layer) }));
}

type IconsJson = { image: string; columns: number; sheets: Record<string, { image: string }>; icons: Record<string, { col: number; row: number; sheet?: string }> };
const icons = read<IconsJson>('data/icons.json');
function iconPieces(sheet: string | undefined): Piece[] {
  return Object.entries(icons.icons)
    .filter(([, v]) => v.sheet === sheet)
    .map(([n, v]) => ({ name: n, label: `ícone: ${human(n)}`, image: sheet ? icons.sheets[sheet]!.image : icons.image, x: v.col, y: v.row, w: 1, h: 1, place: 'icone' as Place }));
}

// ---------- os grupos (o que vai para o gerador) ----------
const SEASON_PT: Record<string, string> = { winter: 'inverno (com o que for de inverno, mas SEM neve por cima: a neve é outra camada)', spring: 'primavera', summer: 'verão', autumn: 'outono' };
const groups: Group[] = [
  { id: 'cafe', title: 'Café: móveis e objetos', scale: 4, context: 'interior de um café de gatos aconchegante', pieces: cafePieces() },
  { id: 'mercado', title: 'Mercado: prateleiras e objetos', scale: 4, context: 'interior de um mercadinho de bairro com seção pet', pieces: fromTileset('market', /^(chao_|parede_|balcao_)/) },
  { id: 'clinica', title: 'Clínica veterinária: móveis e objetos', scale: 4, context: 'interior de uma clínica veterinária pequena e acolhedora', pieces: fromTileset('vet_clinic', /^(parede_|piso_)/) },
  { id: 'quintal', title: 'Quintal: móveis e plantas', scale: 4, context: 'quintal secreto com jardim', pieces: [...fromTileset('backyard_hedge', /^(sebe_|grama_|pedra_|fundo_|brilho_)/), ...fromTileset('backyard_brick', /^(tijolo_|grama_|pedra_|raios_)/)] },
  { id: 'comodos', title: 'Cômodos: portas e coisas de gato', scale: 4, context: 'cômodos do café (quartinho e quintal)', pieces: fromTileset('rooms_placeholder', /^(parede_|mato|folhas_)/) },
  { id: 'sujeira', title: 'Café abandonado: sujeira sólida', scale: 4, context: 'café abandonado e sujo', pieces: fromTileset('dirt', /^(teia_|poeira_|mancha_|escorrido|particulas|raio_)/) },
  ...(['winter', 'spring', 'summer', 'autumn'] as const).map((s): Group => ({
    id: `rua_objetos_${s}`, title: `Rua (${s}): objetos`, scale: 4, context: `rua de uma vila pequena no ${SEASON_PT[s]}`,
    pieces: fromTileset(s === 'winter' ? 'street_props' : `street_props_${s}`, /^pegadas$/),
  })),
  ...(['winter', 'spring', 'summer', 'autumn'] as const).map((s): Group => ({
    id: `rua_fachadas_${s}`, title: `Rua (${s}): fachadas`, scale: 2, context: `fachadas de prédios de uma vila pequena no ${SEASON_PT[s]}`,
    pieces: [...fromTileset(s === 'winter' ? 'street_facades' : `street_facades_${s}`, /^$/, human, 'fachada'), ...(s === 'winter' ? fromTileset('street_vet', /^$/, human, 'fachada') : [])],
  })),
  { id: 'icones_loja', title: 'Ícones: loja do mercado', scale: 4, context: 'ícones de itens de inventário', pieces: iconPieces(undefined) },
  { id: 'icones_ingredientes', title: 'Ícones: ingredientes', scale: 4, context: 'ícones de itens de inventário', pieces: iconPieces('materia_prima') },
  { id: 'icones_bebidas', title: 'Ícones: bebidas e caixas', scale: 4, context: 'ícones de itens de inventário', pieces: iconPieces('bebidas') },
  { id: 'icones_comidas', title: 'Ícones: comidas, remédio e bandeja', scale: 4, context: 'ícones de itens de inventário', pieces: iconPieces('fluxo') },
];

// ---------- empacotar em lotes (grade 8x8 em 4x; 16x16 em 2x) ----------
type Placed = Piece & { cx: number; cy: number };
function pack(pieces: Piece[], cols: number, maxPieces: number): Placed[][] {
  const views = (p: Piece) => (/^chair_/.test(p.name) ? 0 : 1); // vistas do mesmo móvel vão juntas
  const todo = [...pieces].sort((a, b) => b.h - a.h || b.w - a.w || views(a) - views(b) || a.name.split('_')[0]!.localeCompare(b.name.split('_')[0]!));
  const batches: Placed[][] = [];
  while (todo.length) {
    const used = Array.from({ length: cols }, () => Array<boolean>(cols).fill(false));
    const batch: Placed[] = [];
    for (let i = 0; i < todo.length && batch.length < maxPieces; ) {
      const p = todo[i]!;
      let spot: [number, number] | null = null;
      for (let y = 0; y + p.h <= cols && !spot; y++)
        for (let x = 0; x + p.w <= cols && !spot; x++) {
          let free = true;
          for (let j = 0; j < p.h && free; j++) for (let k = 0; k < p.w && free; k++) if (used[y + j]![x + k]) free = false;
          if (free) spot = [x, y];
        }
      if (!spot) { i++; continue; }
      for (let j = 0; j < p.h; j++) for (let k = 0; k < p.w; k++) used[spot[1] + j]![spot[0] + k] = true;
      batch.push({ ...p, cx: spot[0], cy: spot[1] });
      todo.splice(i, 1);
    }
    if (!batch.length) throw new Error(`peça grande demais: ${todo[0]!.name}`);
    batches.push(batch);
  }
  return batches;
}

const BASE = (g: Group, scale: number) => {
  const tile = 32 * scale;
  return `Crie uma folha de sprites em pixel art no MESMO estilo da folha de referência anexada
(${g.context}; visão de frente em 3/4; luz vindo de cima à esquerda; contorno marrom-escuro;
cores quentes e saturadas; volume com o topo dos móveis visível).

TAMANHO É O MAIS IMPORTANTE:
- Neste jogo, 1 tile = ${tile} x ${tile} px nesta imagem. Cada objeto tem um tamanho fixo em tiles (lista abaixo) e
  deve ocupar exatamente esse tamanho, encostando a base embaixo. Ex.: um objeto de 1 x 2 tiles tem ${tile} px de
  largura e ${tile * 2} px de altura. Uma porta e uma estante são da altura de uma pessoa (2 tiles); uma xícara é pequena.
- Todos os objetos na mesma escala de pixel: cada pixel da arte é um quadrado de ${scale === 4 ? '2 x 2' : '1 x 1'} px em toda a imagem.

FORMATO:
- Imagem quadrada de 1024 x 1024 px, entregue em PNG.
- Fundo de cor única, magenta puro #FF00FF, liso. Sem xadrez, sem textura, sem sombra no fundo, sem moldura.
- Objetos separados por pelo menos 16 px de magenta; nenhum objeto encostado em outro. A posição na imagem é livre.
- Pixel art com bordas duras: sem desfoque, sem brilho difuso, sem sombra projetada no fundo.
- Sem texto, números ou legendas.
- Desenhe só os objetos da lista (o molde anexado mostra o que é cada um). Se sobrar espaço, acrescente variações
  dos MESMOS objetos (outra cor ou estampa), no mesmo tamanho em tiles.
- Objetos com várias vistas (ex.: cadeira de frente, de costas e de lado) devem ser o MESMO móvel visto de lados diferentes.

ONDE CADA OBJETO FICA (a etiqueta vem na lista):
- [chão]: em pé no chão; a base encosta na borda de baixo da área do objeto.
- [sobre balcão/mesa]: fica em cima de um balcão ou mesa. Desenhe SÓ o objeto, sem móvel embaixo, pequeno
  (ocupando uns 2/3 da área), com a base encostada na borda de baixo; o jogo coloca ele em cima do tampo.
- [parede]: preso na parede, visto de frente; sem pés e sem sombra no chão; centralizado na área (portas encostam na borda de baixo).
- [piso]: deitado no chão, plano (tapete, capacho), visto um pouco de cima, ocupando a área toda.
- [pendurado]: pendurado no teto; o fio ou a corrente sai da borda de cima da área e o objeto fica na metade de cima.
- [ícone]: ícone de inventário; centralizado, ocupando uns 80% da área, sem sombra.
- [fachada]: prédio inteiro visto de frente, ocupando a área toda, com a base na borda de baixo (sem calçada).
`;
};

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });
let n = 0;
const index: string[] = [];
for (const g of groups) {
  const cols = g.scale === 4 ? 8 : 16;
  const batches = pack(g.pieces, cols, g.scale === 4 ? 16 : 3);
  batches.forEach((batch, bi) => {
    n++;
    const dir = `${OUT}/pedidos/${String(n).padStart(2, '0')}_${g.id}${batches.length > 1 ? `_${bi + 1}` : ''}`;
    mkdirSync(dir, { recursive: true });
    const cell = 32 * g.scale;
    const img = new PNG({ width: 1024, height: 1024 });
    for (let i = 0; i < img.data.length; i += 4) img.data.set([...MAGENTA, 255], i);
    for (const p of batch) {
      const src = png(p.image);
      for (let y = 0; y < p.h * 32 * g.scale; y++)
        for (let x = 0; x < p.w * 32 * g.scale; x++) {
          const si = ((p.y * 32 + Math.floor(y / g.scale)) * src.width + p.x * 32 + Math.floor(x / g.scale)) * 4;
          if (!src.data[si + 3]) continue;
          const di = ((p.cy * cell + y) * 1024 + p.cx * cell + x) * 4;
          img.data[di] = src.data[si]!; img.data[di + 1] = src.data[si + 1]!; img.data[di + 2] = src.data[si + 2]!; img.data[di + 3] = 255;
        }
    }
    writeFileSync(`${dir}/molde.png`, PNG.sync.write(img));
    const list = [...batch].sort((a, b) => a.cy - b.cy || a.cx - b.cx)
      .map((p) => `- ${p.label}: ${p.w} x ${p.h} tile${p.w * p.h > 1 ? 's' : ''} (${p.w * 32 * g.scale} x ${p.h * 32 * g.scale} px) ${PLACE_TAG[p.place]}`)
      .join('\n');
    writeFileSync(`${dir}/pedido.txt`, `${g.title}${batches.length > 1 ? ` (parte ${bi + 1} de ${batches.length})` : ''}\nAnexe: molde.png (deste pedido, mostra o que é cada objeto) e a folha de referência de estilo.\n\n${BASE(g, g.scale)}\nOBJETOS (largura x altura em tiles):\n${list}\n`);
    writeFileSync(`${dir}/layout.json`, JSON.stringify({ scale: g.scale, cell, pieces: batch.map((p) => ({ name: p.name, sheet: p.image, src: [p.x, p.y, p.w, p.h], cell: [p.cx, p.cy], place: p.place })) }, null, 2));
    index.push(`| ${dir.split('/').pop()} | ${g.title}${batches.length > 1 ? ` (${bi + 1}/${batches.length})` : ''} | ${batch.length} | ${g.scale}x |`);
  });
}

// folhas atuais (referência), sem a arte do leckie1989 (licença proíbe usar com IA)
const sheets = [
  'interiors/cafe/tile_cafe.png', 'interiors/market/tile_market.png', 'interiors/vet_clinic/tile_vet_clinic.png', 'interiors/cafe/tile_rooms_placeholder.png',
  'env/backyard/tile_backyard_hedge.png', 'env/backyard/tile_backyard_brick.png', 'objects/dirt/tile_dirt.png',
  'objects/furniture/tile_counter_wood.png', 'objects/equipment/anim_coffee_maker.png', 'objects/equipment/anim_kitchen_equipment.png', 'objects/equipment/anim_sink.png',
  'objects/dishes/tile_dishes_16.png', 'icons/sheets/icon_sheet_dishes.png', 'icons/sheets/icon_sheet_shop.png', 'icons/sheets/icon_sheet_ingredients.png',
  'icons/sheets/icon_sheet_drinks.png', 'icons/sheets/icon_sheet_food.png',
  ...['winter', 'spring', 'summer', 'autumn'].flatMap((s) => [`env/street/${s}/tile_street_facades_${s}.png`, `env/street/${s}/tile_street_props_${s}.png`, `env/street/${s}/tile_street_ground_${s}.png`]),
  'env/street/winter/tile_street_vet_clinic_winter.png',
];
for (const s of sheets) if (existsSync(`public/assets/${s}`)) cpSync(`public/assets/${s}`, `${OUT}/folhas_atuais/${s.split('/').pop()}`);

writeFileSync(`${OUT}/LEIA-ME.md`, readFileSync('scripts/art/pedidos-leia-me.md', 'utf8').replace('{{INDICE}}', `| Pasta | O quê | Peças | Escala |\n|---|---|---|---|\n${index.join('\n')}`).replace('{{TOTAL}}', String(n)));
rmSync(`${OUT}.zip`, { force: true });
execSync(`powershell -NoProfile -Command "Compress-Archive -Path '${OUT}/*' -DestinationPath '${OUT}.zip'"`);
console.log(`✓ ${n} pedidos em ${OUT}/ e ${OUT}.zip`);
