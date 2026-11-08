// npx tsx scripts/art/pedidos.ts
// Monta os pedidos de arte para um gerador de imagem (ChatGPT), na escala nova (64 px de arte por tile, decisão 052):
// - PROMPT_CHATGPT.md: todas as regras e a lista completa de pedidos (anexar uma vez e pedir "faça o pedido 01");
// - pedidos/NN_xxx/: pedido.txt (o mesmo pedido sozinho), molde.png (arte atual de cada item, para saber o que é) e
//   layout.json (para converter a resposta de volta);
// - folhas_atuais/: as folhas de hoje, só para consulta.
// Saída em pedidos_arte/ (fora do Git) + pedidos_arte.zip. Não muda nada do jogo.
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { PNG } from 'pngjs';

const OUT = 'pedidos_arte';
const ART_TILE = 64; // pixels de arte por tile no jogo
const MAGENTA = [255, 0, 255] as const;

/** Onde o item fica no jogo (muda como ele encosta na área do tile). */
type Place = 'chao' | 'sobre' | 'balcao' | 'parede' | 'piso' | 'pendurado' | 'icone' | 'fachada';
type Piece = { name: string; label: string; image: string; x: number; y: number; w: number; h: number; place: Place }; // w/h em tiles
const TAG: Record<Place, string> = {
  chao: '[chão]', sobre: '[SOBRE balcão/mesa: item pequeno]', balcao: '[BALCÃO modular]', parede: '[parede]', piso: '[piso]',
  pendurado: '[pendurado]', icone: '[ícone]', fachada: '[fachada]',
};
// Itens pequenos que ficam em cima de balcão ou mesa; coisas penduradas no teto.
const SOBRE = /^(cake_|cupcake|macarons|cookie_jar|latte|tea_cup|teapot|milkshake|croissant|fish_biscuits|coffee_machine|caixa_registradora|leitor_codigo|balanca|negatoscopio)/;
const PENDURADO = /^(plant_hanging|luminaria_teto|luzinhas_fio|luminaria)$/;
const BALCAO = /^(balcao_|counter_|bar_balcao_)/;
const layerToPlace = (layer: string | undefined): Place => (layer === 'floor' ? 'piso' : layer === 'wall' ? 'parede' : 'chao');
const placeOf = (name: string, layer: string | undefined): Place =>
  BALCAO.test(name) ? 'balcao' : PENDURADO.test(name) ? 'pendurado' : SOBRE.test(name) ? 'sobre' : layerToPlace(layer);

/** imgTile: px por tile na imagem pedida; variants: quantas variações de cor por item; maxItems: itens diferentes por pedido. */
type Group = { id: string; title: string; context: string; pieces: Piece[]; imgTile: 128 | 64; variants: 1 | 3; maxItems: number };

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

const LABEL_PT: Record<string, string> = {
  floor_rug: 'tapete grande com franja', doormat: 'capacho', window: 'janela com cortinas', door: 'porta de madeira com vidro e placa',
  menu_board: 'lousa do cardápio na parede', wall_clock: 'relógio de parede com orelhas de gato', picture_paw: 'quadro com pata de gato', wall_shelf: 'prateleira de parede com potes e livros',
  coffee_machine: 'máquina de espresso pequena', display_case: 'vitrine de doces com vidro (altura de balcão)', cake_whole: 'bolo inteiro no prato', cake_slice: 'fatia de bolo no prato',
  cupcake: 'cupcake', macarons: 'macarons no prato', cookie_jar: 'pote de biscoitos', latte: 'xícara de latte com pires', tea_cup: 'xícara de chá com pires', teapot: 'bule de chá',
  milkshake: 'milkshake com canudo', croissant: 'croissants no prato', fish_biscuits: 'biscoitos de peixe no prato', cake_stand: 'boleira de dois andares com doces',
  table_round: 'mesa redonda de madeira', chair_front: 'cadeira de madeira com assento estofado, vista de frente', chair_back: 'a mesma cadeira vista de costas',
  chair_left: 'a mesma cadeira de perfil, virada para a esquerda', chair_right: 'a mesma cadeira de perfil, virada para a direita', sofa: 'sofá de veludo',
  bookshelf: 'estante com livros', cat_tree: 'árvore de gato com plataformas e casinha', cat_condo: 'torre de gato com dois andares e buracos', scratch_post: 'arranhador de sisal',
  cushion_pink: 'almofada de chão', cat_bed: 'caminha de gato redonda', food_bowl: 'tigela de ração', water_bowl: 'tigela de água', yarn_balls: 'novelos de lã',
  plant_pot: 'planta em vaso de barro', plant_tall: 'planta alta em vaso', plant_hanging: 'planta pendurada', cactus: 'cacto em vaso', flower_vase: 'vaso com flores',
  counter_single: 'balcão: peça única curta (acabamento nas duas pontas)', counter_register: 'balcão: peça do meio com uma caixa registradora em cima',
  balcao_esq: 'balcão: ponta esquerda', balcao_meio: 'balcão: peça do meio (sem borda dos lados; se repete)', balcao_dir: 'balcão: ponta direita',
};
const label = (n: string) => LABEL_PT[n] ?? human(n);
const tileMeta = read<{ tiles: Record<string, { layer?: string }> }>('data/tiles.meta.json').tiles;
function cafePieces(): Piece[] {
  const csv = readFileSync('data/tiles.csv', 'utf8').trim().split(/\r?\n/).slice(1);
  return csv
    .map((l) => l.split(','))
    // pisos e paredes ficam por código; as almofadas são uma peça só (as cores viram as variações);
    // as pontas e o meio do balcão vêm da folha de balcões (são os que o jogo usa)
    .filter(([n]) => !/^(floor_wood|floor_check|floor_tile|wall_|counter_(left|mid|right)$|cushion_(mint|sky|lav|butter))/.test(n!))
    .map(([n, c, r, w, h]) => ({ name: n!, label: label(n!), image: 'assets/interiors/cafe/tile_cafe.png', x: +c!, y: +r!, w: +w!, h: +h!, place: placeOf(n!, tileMeta[n!]?.layer) }));
}

type IconsJson = { image: string; columns: number; sheets: Record<string, { image: string }>; icons: Record<string, { col: number; row: number; sheet?: string }> };
const icons = read<IconsJson>('data/icons.json');
function iconPieces(sheet: string | undefined): Piece[] {
  return Object.entries(icons.icons)
    .filter(([, v]) => v.sheet === sheet)
    .map(([n, v]) => ({ name: n, label: `ícone: ${human(n)}`, image: sheet ? icons.sheets[sheet]!.image : icons.image, x: v.col, y: v.row, w: 1, h: 1, place: 'icone' as Place }));
}

// ---------- os grupos (o que vai para o gerador) ----------
const SEASON_PT: Record<string, string> = { winter: 'inverno (SEM neve por cima: a neve é outra camada)', spring: 'primavera', summer: 'verão', autumn: 'outono' };
const objects = (id: string, title: string, context: string, pieces: Piece[]): Group => ({ id, title, context, pieces, imgTile: 128, variants: 3, maxItems: 8 });
const groups: Group[] = [
  objects('cafe', 'Café: móveis, balcão e objetos', 'interior de um café de gatos aconchegante', [...cafePieces(), ...fromTileset('counters', /^$/, label)]),
  objects('mercado', 'Mercado: prateleiras, balcão e objetos', 'interior de um mercadinho de bairro com seção pet', fromTileset('market', /^(chao_|parede_)/, label)),
  objects('clinica', 'Clínica veterinária: móveis e objetos', 'interior de uma clínica veterinária pequena e acolhedora', fromTileset('vet_clinic', /^(parede_|piso_)/, label)),
  objects('quintal', 'Quintal: móveis e plantas', 'quintal secreto com jardim', [...fromTileset('backyard_hedge', /^(sebe_|grama_|pedra_|fundo_|brilho_)/), ...fromTileset('backyard_brick', /^(tijolo_|grama_|pedra_|raios_)/)]),
  objects('comodos', 'Cômodos: portas e coisas de gato', 'cômodos do café (quartinho e quintal)', fromTileset('rooms_placeholder', /^(parede_|mato|folhas_)/)),
  { id: 'sujeira', title: 'Café abandonado: sujeira sólida', context: 'café abandonado e sujo', pieces: fromTileset('dirt', /^(teia_|poeira_|mancha_|escorrido|particulas|raio_)/), imgTile: 128, variants: 1, maxItems: 12 },
  ...(['winter', 'spring', 'summer', 'autumn'] as const).map((s) =>
    objects(`rua_objetos_${s}`, `Rua (${s}): objetos`, `rua de uma vila pequena no ${SEASON_PT[s]}`, fromTileset(s === 'winter' ? 'street_props' : `street_props_${s}`, /^pegadas$/)),
  ),
  ...(['winter', 'spring', 'summer', 'autumn'] as const).map((s): Group => ({
    id: `rua_fachadas_${s}`, title: `Rua (${s}): fachadas`, context: `fachadas de prédios de uma vila pequena no ${SEASON_PT[s]}`, imgTile: 64, variants: 1, maxItems: 2,
    pieces: [...fromTileset(s === 'winter' ? 'street_facades' : `street_facades_${s}`, /^$/, human, 'fachada'), ...(s === 'winter' ? fromTileset('street_vet', /^$/, human, 'fachada') : [])],
  })),
  { id: 'icones_loja', title: 'Ícones: loja do mercado', context: 'ícones de itens de inventário', pieces: iconPieces(undefined), imgTile: 128, variants: 1, maxItems: 16 },
  { id: 'icones_ingredientes', title: 'Ícones: ingredientes', context: 'ícones de itens de inventário', pieces: iconPieces('materia_prima'), imgTile: 128, variants: 1, maxItems: 16 },
  { id: 'icones_bebidas', title: 'Ícones: bebidas e caixas', context: 'ícones de itens de inventário', pieces: iconPieces('bebidas'), imgTile: 128, variants: 1, maxItems: 16 },
  { id: 'icones_comidas', title: 'Ícones: comidas, remédio e bandeja', context: 'ícones de itens de inventário', pieces: iconPieces('fluxo'), imgTile: 128, variants: 1, maxItems: 16 },
];

// ---------- empacotar em lotes: cada item ocupa w x h tiles vezes o número de variações (lado a lado) ----------
type Placed = Piece & { cx: number; cy: number; v: number };
/** Peças do mesmo balcão (0) e vistas da mesma cadeira (1) vão juntas: cada conjunto cabe inteiro num pedido. */
const together = (p: Piece) => (BALCAO.test(p.name) && p.w === 1 ? 0 : /^chair_/.test(p.name) ? 1 : 2);
function pack(g: Group): Placed[][] {
  const cols = 1024 / g.imgTile;
  const todo = [...g.pieces].sort((a, b) => together(a) - together(b) || b.h - a.h || b.w - a.w || a.name.localeCompare(b.name));
  const batches: Placed[][] = [];
  while (todo.length) {
    const used = Array.from({ length: cols }, () => Array<boolean>(cols).fill(false));
    const batch: Placed[] = [];
    for (let i = 0; i < todo.length && batch.length < g.maxItems; ) {
      const p = todo[i]!;
      // um conjunto que não cabe inteiro no que sobra deste pedido vai para o próximo
      const set = together(p);
      if (set < 2 && !batch.some((b) => together(b) === set)) {
        const size = todo.filter((t) => together(t) === set).length;
        if (batch.length + size > g.maxItems) { i++; continue; }
      }
      const v = Math.max(1, Math.min(g.variants, Math.floor(cols / p.w)));
      const W = p.w * v;
      let spot: [number, number] | null = null;
      for (let y = 0; y + p.h <= cols && !spot; y++)
        for (let x = 0; x + W <= cols && !spot; x++) {
          let free = true;
          for (let j = 0; j < p.h && free; j++) for (let k = 0; k < W && free; k++) if (used[y + j]![x + k]) free = false;
          if (free) spot = [x, y];
        }
      if (!spot) { i++; continue; }
      for (let j = 0; j < p.h; j++) for (let k = 0; k < W; k++) used[spot[1] + j]![spot[0] + k] = true;
      batch.push({ ...p, cx: spot[0], cy: spot[1], v });
      todo.splice(i, 1);
    }
    if (!batch.length) throw new Error(`peça grande demais: ${todo[0]!.name}`);
    batches.push(batch);
  }
  return batches;
}

// ---------- textos ----------
const RULES = `REGRAS (valem para todos os pedidos)

1. ESTILO: pixel art no mesmo estilo da folha de referência anexada: visão de frente em 3/4, luz vindo de cima à
   esquerda, contorno marrom-escuro, cores quentes e saturadas, volume com o topo dos móveis visível.

2. ESCALA (o mais importante): no jogo, 1 tile = ${ART_TILE} x ${ART_TILE} pixels de arte.
   - Nos pedidos de objetos e ícones, desenhe cada pixel da arte como um quadrado de 2 x 2 px: 1 tile = 128 x 128 px na imagem.
   - Nos pedidos de fachadas, desenhe cada pixel como 1 x 1 px: 1 tile = 64 x 64 px na imagem.
   - Cada item tem um tamanho fixo em tiles (na lista) e ocupa exatamente esse tamanho, com a base encostada embaixo.
     Ex.: um item de 1 x 2 tiles tem 128 x 256 px na imagem. Porta e estante têm a altura de uma pessoa (2 tiles).
   - A mesma escala de pixel em TODA a imagem.

3. FORMATO: imagem quadrada de 1024 x 1024 px, em PNG. Fundo de cor única, magenta puro #FF00FF, liso: sem xadrez,
   sem textura, sem sombra no fundo, sem moldura. Itens separados por pelo menos 16 px de magenta, nenhum encostado
   em outro. A posição dos itens na imagem é livre. Bordas duras, sem desfoque nem brilho difuso. Sem texto.

4. VARIAÇÕES: para cada item da lista, desenhe de 2 a 3 variações de cor ou acabamento, lado a lado, com o MESMO
   formato e o MESMO tamanho. Exceções: [ícone], [fachada] e a sujeira: só 1 versão.
   Itens com várias vistas (ex.: cadeira de frente, de costas e de lado) são o MESMO móvel: cada cor aparece em todas as vistas.

5. ONDE CADA ITEM FICA (a etiqueta vem na lista):
   - [chão]: em pé no chão; base encostada na borda de baixo da área do item.
   - [SOBRE balcão/mesa: item pequeno]: utensílio, louça, comida, máquina pequena, caixa registradora. É um item PEQUENO
     que o jogo coloca EM CIMA de um balcão ou mesa. Desenhe só o item: sem mesa ou balcão embaixo, sem sombra no chão,
     centralizado, ocupando no máximo 2/3 da largura do tile, com a base encostada na borda de baixo.
   - [BALCÃO modular]: peças do mesmo balcão. Todas com a MESMA altura, a mesma profundidade e o mesmo tampo.
     O TAMPO É LISO E PLANO (madeira ou pedra lisa, sem objetos, sem toalha, sem desenho), porque o jogo coloca coisas
     em cima (cafeteira, bolo, xícaras, registradora). As peças encaixam lado a lado formando um balcão grande:
     a ponta esquerda tem acabamento só à esquerda, a ponta direita só à direita, e a peça do meio não tem borda nos
     lados e pode se repetir quantas vezes for preciso, sem emenda aparente. Nas variações de cor, faça o conjunto
     inteiro (ponta esquerda, meio, ponta direita) em cada cor.
   - [parede]: preso na parede, visto de frente; sem pés e sem sombra no chão; centralizado (portas encostam embaixo).
   - [piso]: deitado no chão, plano (tapete, capacho), visto um pouco de cima, ocupando a área toda.
   - [pendurado]: pendurado no teto; o fio sai da borda de cima da área e o item fica na metade de cima.
   - [ícone]: ícone de inventário; centralizado, ocupando uns 80% da área, sem sombra.
   - [fachada]: prédio inteiro visto de frente, ocupando a área toda, base na borda de baixo (sem calçada).

6. AJUSTES: quando eu pedir para refazer um item, gere uma imagem NOVA só com esse item (e as variações dele),
   seguindo todas estas regras. Não redesenhe os outros itens nem a imagem anterior. Não precisa ficar tudo numa
   imagem só: eu recorto cada item separadamente.

7. Desenhe só o que está na lista do pedido. O molde (se anexado) mostra a arte atual de cada item, só para você
   saber o que é; não copie o estilo dele, use o estilo da referência.`;

function itemLine(p: Placed): string {
  const px = `${p.w * 128} x ${p.h * 128} px`;
  const vars = p.v > 1 ? `, ${p.v} variações de cor` : '';
  return `- ${p.label}: ${p.w} x ${p.h} tile${p.w * p.h > 1 ? 's' : ''} (${px}${vars}) ${TAG[p.place]}`;
}
function itemLineFacade(p: Placed): string {
  return `- ${p.label}: ${p.w} x ${p.h} tiles (${p.w * 64} x ${p.h * 64} px) ${TAG[p.place]}`;
}

// ---------- gerar ----------
rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });
let n = 0;
const index: string[] = [];
const master: string[] = [];
for (const g of groups) {
  const batches = pack(g);
  batches.forEach((batch, bi) => {
    n++;
    const code = String(n).padStart(2, '0');
    const name = `${code}_${g.id}${batches.length > 1 ? `_${bi + 1}` : ''}`;
    const dir = `${OUT}/pedidos/${name}`;
    mkdirSync(dir, { recursive: true });
    // molde: a arte atual de cada item (uma vez), ampliada para a escala da imagem pedida
    const k = g.imgTile / 32;
    const img = new PNG({ width: 1024, height: 1024 });
    for (let i = 0; i < img.data.length; i += 4) img.data.set([...MAGENTA, 255], i);
    for (const p of batch) {
      const src = png(p.image);
      for (let y = 0; y < p.h * g.imgTile; y++)
        for (let x = 0; x < p.w * g.imgTile; x++) {
          const si = ((p.y * 32 + Math.floor(y / k)) * src.width + p.x * 32 + Math.floor(x / k)) * 4;
          if (!src.data[si + 3]) continue;
          const di = ((p.cy * g.imgTile + y) * 1024 + p.cx * g.imgTile + x) * 4;
          img.data[di] = src.data[si]!; img.data[di + 1] = src.data[si + 1]!; img.data[di + 2] = src.data[si + 2]!; img.data[di + 3] = 255;
        }
    }
    writeFileSync(`${dir}/molde.png`, PNG.sync.write(img));
    const rank = (s: string) => s.replace(/(esq|left)/, '1').replace(/(meio|mid|register)/, '2').replace(/(dir|right)/, '3');
    const lines = [...batch].sort((a, b) => together(a) - together(b) || rank(a.name).localeCompare(rank(b.name))).map((p) => (g.imgTile === 64 ? itemLineFacade(p) : itemLine(p))).join('\n');
    const head = `PEDIDO ${code}: ${g.title}${batches.length > 1 ? ` (parte ${bi + 1} de ${batches.length})` : ''}\nCenário: ${g.context}.\nEscala: ${g.imgTile === 128 ? '1 tile = 128 x 128 px (cada pixel da arte = 2 x 2 px)' : '1 tile = 64 x 64 px (cada pixel da arte = 1 x 1 px)'}.\n\nITENS (largura x altura em tiles):\n${lines}`;
    master.push(head);
    writeFileSync(`${dir}/pedido.txt`, `${head}\n\n${RULES}\n`);
    writeFileSync(`${dir}/layout.json`, JSON.stringify({ code, imgTile: g.imgTile, artTile: ART_TILE, pieces: batch.map((p) => ({ name: p.name, sheet: p.image, src: [p.x, p.y, p.w, p.h], place: p.place, variants: p.v })) }, null, 2));
    index.push(`| ${code} | ${g.title}${batches.length > 1 ? ` (${bi + 1}/${batches.length})` : ''} | ${batch.length} | ${g.imgTile === 128 ? 'objetos (128 px por tile)' : 'fachadas (64 px por tile)'} |`);
  });
}

writeFileSync(`${OUT}/PROMPT_CHATGPT.md`, `# Biscuit Paws: pedidos de arte

Você vai gerar folhas de sprites para o jogo Biscuit Paws, um jogo de café de gatos em pixel art.
Leia este arquivo inteiro antes de começar. Junto com ele vai a FOLHA DE REFERÊNCIA DE ESTILO (imagem).
Eu vou pedir um pedido por vez, por exemplo: "Faça o pedido 01". Gere UMA imagem por pedido, seguindo as regras.

${RULES}

---

# Lista completa de pedidos (${n})

${master.join('\n\n---\n\n')}
`);

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

writeFileSync(`${OUT}/LEIA-ME.md`, readFileSync('scripts/art/pedidos-leia-me.md', 'utf8').replace('{{INDICE}}', `| Pedido | O quê | Itens | Tipo |\n|---|---|---|---|\n${index.join('\n')}`).replaceAll('{{TOTAL}}', String(n)));
rmSync(`${OUT}.zip`, { force: true });
execSync(`powershell -NoProfile -Command "Compress-Archive -Path '${OUT}/*' -DestinationPath '${OUT}.zip'"`);
console.log(`✓ ${n} pedidos em ${OUT}/ e ${OUT}.zip`);
