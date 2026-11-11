// Gatos: definições (data/cats.json) e sprites (data/cat_sprites.json). Puro: sem Phaser, DOM ou window.
import type { FixedRepro } from './repro';

export interface CatDef {
  id: string;
  /** Nome fixo (ex.: Tekinha). Sem nome fixo, a jogadora escolhe ao abrigar. */
  name?: string;
  /** Variante (pelagem: folha de sprites em data/cat_sprites.json). */
  variant: string;
  personality: string;
  /** Sugestões para a caixa de nome. */
  nameSuggestions?: string[];
  /** Só aparece em lembranças (não vive no café). */
  memory?: boolean;
  /** Já chega doente ao ser abrigado (doença sorteada de data/health.json). */
  arrivesSick?: boolean;
  /** Traços na feira de adoção (data/adoption.json: traits); sem eles, vem da personalidade (fair.personalityFrom). */
  adoptionTraits?: Record<string, string>;
  /** Estado reprodutivo fixo (os gatos escritos à mão: tutorial previsível). Sem ele, sorteado na chegada (repro.ts). */
  repro?: FixedRepro;
  tags: string[];
}

export interface CatsData {
  schemaVersion: 1;
  /** O que os gatos fazem nos objetos deles, pelo tile (catSpots). */
  objectUses?: Record<string, CatObjectSpot[]>;
  cats: CatDef[];
}

export interface CatSpritesData {
  schemaVersion: 1;
  frameSize: number;
  columns: number;
  /** optional: só algumas folhas têm a linha (as de 64 px); sem ela, quem pede a animação usa sit. */
  animations: { name: string; row: number; frames: number; fps: number; optional?: boolean }[];
  variants: Record<string, string>;
  /** Pixels da folha por pixel do jogo, por variante (2 = arte em 64 px; quadro de frameSize x 2). Sem entrada, 1. */
  resolutions?: Record<string, number>;
}

/** Resolução da folha de uma variante (1 = folha em 32 px; 2 = arte em 64 px, a de todos os gatos hoje). */
export function catResolution(sprites: CatSpritesData, variant: string): number {
  return sprites.resolutions?.[variant] ?? 1;
}

export function validateCats(data: CatsData, sprites: CatSpritesData): string[] {
  const errors: string[] = [];
  for (const [tile, list] of Object.entries(data.objectUses ?? {})) {
    for (const u of list) {
      if (!['sleep', 'play', 'sit'].includes(u.action)) errors.push(`objectUses "${tile}": ação inválida "${u.action}"`);
      if (!u.cell === !u.px) errors.push(`objectUses "${tile}": cada lugar tem cell ou px (um dos dois)`);
      if (!sprites.animations.some((an) => an.name === u.action)) errors.push(`objectUses "${tile}": o Cosy Cats não tem a animação "${u.action}"`);
    }
  }
  for (const [variant, r] of Object.entries(sprites.resolutions ?? {})) {
    if (!sprites.variants[variant]) errors.push(`cat_sprites: resolução para variante inexistente "${variant}"`);
    if (r !== 1 && r !== 2) errors.push(`cat_sprites: resolução de "${variant}" deve ser 1 ou 2`);
  }
  const ids = new Set<string>();
  for (const cat of data.cats) {
    const where = `gato "${cat.id}"`;
    if (!cat.id.startsWith('cat.')) errors.push(`${where}: id deve começar com "cat."`);
    if (ids.has(cat.id)) errors.push(`${where}: id repetido`);
    ids.add(cat.id);
    if (!sprites.variants[cat.variant]) errors.push(`${where}: variante inexistente "${cat.variant}"`);
    if (!cat.name && !(cat.nameSuggestions?.length)) errors.push(`${where}: sem nome fixo precisa de nameSuggestions`);
  }
  return errors;
}

/** Nome válido? Tira espaços das pontas; 1 a 14 letras; sem < > (vai para HTML). */
export function cleanCatName(raw: string): string | null {
  const name = raw.trim().replace(/\s+/g, ' ');
  if (name.length < 1 || name.length > 14 || /[<>]/.test(name)) return null;
  return name;
}

/** Sugestão de nome (a tentativa 0 é a primeira; "outra sugestão" passa para a próxima). */
export function suggestCatName(cat: CatDef, attempt: number): string {
  const list = cat.nameSuggestions ?? [];
  if (list.length === 0) return cat.name ?? '';
  return list[((attempt % list.length) + list.length) % list.length]!;
}

export type CatGoal =
  | { kind: 'walk'; to: [number, number] }
  | { kind: 'sit'; seconds: number }
  | { kind: 'sleep'; seconds: number }
  | { kind: 'use'; spot: CatSpot; seconds: number };

export type CatAction = 'sleep' | 'play' | 'sit';

/**
 * Um lugar de um objeto dos gatos (data/cats.json objectUses, pelo tile): `cell` = célula onde ele fica (relativa à
 * origem do objeto; ex.: a caminha, ou ao lado do arranhador); `px` = em cima do objeto (pixels do jogo a partir do
 * canto do objeto; ex.: a plataforma da árvore), aonde ele chega pela célula livre na frente. `toward`: com `cell` ao lado
 * do objeto, chega tantos px mais perto dele e fica virado para ele (encostado no arranhador).
 */
export interface CatObjectSpot {
  action: CatAction;
  cell?: [number, number];
  px?: [number, number];
  toward?: number;
}

/** Um lugar pronto no mapa: a célula aonde ele anda e, se for em cima do objeto, onde desenhar e com que profundidade. */
export interface CatSpot {
  id: string;
  action: CatAction;
  cell: [number, number];
  perch?: { x: number; y: number; baseY: number };
  /** Virado para este lado enquanto usa (encostado num objeto ao lado). */
  face?: 'left' | 'right';
}

/** Quanto tempo (segundos) ele fica em cada ação num objeto. */
/** Chance de ir a um objeto (quando há um perto) e a distância máxima (células, andando em linha reta). */
export const SPOT_CHANCE = 0.4;
export const SPOT_REACH = 12;

export const SPOT_SECONDS: Record<CatAction, [number, number]> = { sleep: [15, 30], play: [6, 10], sit: [6, 12] };

/** Os lugares dos objetos dos gatos que estão no mapa (só os que dá para alcançar: célula livre). */
export function catSpots(
  objects: readonly { id: string; tile: string; at: [number, number] }[],
  tiles: Record<string, { w: number; h: number }>,
  uses: Record<string, CatObjectSpot[]>,
  solid: boolean[][],
  tileSize: number,
): CatSpot[] {
  const free = ([c, r]: [number, number]) => solid[r]?.[c] === false;
  const out: CatSpot[] = [];
  for (const o of objects) {
    const list = uses[o.tile];
    const def = tiles[o.tile];
    if (!list || !def) continue;
    const [c0, r0] = o.at;
    list.forEach((u, i) => {
      const id = `${o.id}#${i}`;
      if (u.cell) {
        const cell: [number, number] = [c0 + u.cell[0], r0 + u.cell[1]];
        if (!free(cell)) return;
        // Em cima do próprio objeto (caminha, almofada, novelos): desenhado na frente dele, não por baixo.
        const inside = u.cell[0] >= 0 && u.cell[0] < def.w && u.cell[1] >= 0 && u.cell[1] < def.h;
        if (!inside && u.toward && u.cell[1] >= 0 && u.cell[1] < def.h && (u.cell[0] < 0 || u.cell[0] >= def.w)) {
          // Ao lado do objeto: encosta nele (perto dos pés de sempre, só mais para o lado dele) e olha para ele.
          const face = u.cell[0] < 0 ? 'right' : 'left';
          const y = (cell[1] + 1) * tileSize - 6;
          out.push({ id, action: u.action, cell, face, perch: { x: cell[0] * tileSize + tileSize / 2 + (face === 'right' ? u.toward : -u.toward), y, baseY: y } });
          return;
        }
        out.push({ id, action: u.action, cell, ...(inside ? { perch: { x: cell[0] * tileSize + tileSize / 2, y: (cell[1] + 1) * tileSize - 8, baseY: (r0 + def.h) * tileSize } } : {}) });
        return;
      }
      if (!u.px) return;
      // Em cima: chega pela célula livre logo abaixo do objeto mais perto do lugar (ou de um lado).
      const want = c0 + Math.floor(u.px[0] / tileSize);
      const below = Array.from({ length: def.w }, (_, k) => [c0 + k, r0 + def.h] as [number, number]).sort((a, b) => Math.abs(a[0] - want) - Math.abs(b[0] - want));
      const cell = [...below, [c0 - 1, r0 + def.h - 1] as [number, number], [c0 + def.w, r0 + def.h - 1] as [number, number]].find(free);
      if (cell) out.push({ id, action: u.action, cell, perch: { x: c0 * tileSize + u.px[0], y: r0 * tileSize + u.px[1], baseY: (r0 + def.h) * tileSize } });
    });
  }
  return out;
}


/**
 * O que o gato faz a seguir: ir a um objeto dele perto (`spots`, que nenhum outro esteja usando), andar até uma
 * célula livre perto, sentar ou cochilar.
 * Puro e com RNG injetado (repetível nos testes).
 */
export function nextCatGoal(
  rng: { next(): number; int(min: number, max: number): number },
  at: [number, number],
  solid: boolean[][],
  spots: readonly CatSpot[] = [],
  taken: ReadonlySet<string> = new Set(),
): CatGoal {
  // Às vezes vai até um objeto dele perto (caminha, arranhador, árvore) que ninguém está usando.
  const near = spots.filter((p) => !taken.has(p.id) && Math.abs(p.cell[0] - at[0]) + Math.abs(p.cell[1] - at[1]) <= SPOT_REACH);
  if (near.length > 0 && rng.next() < SPOT_CHANCE) {
    const spot = near[rng.int(0, near.length - 1)]!;
    const [min, max] = SPOT_SECONDS[spot.action];
    return { kind: 'use', spot, seconds: rng.int(min, max) };
  }
  const roll = rng.next();
  if (roll < 0.25) return { kind: 'sit', seconds: rng.int(2, 5) };
  if (roll < 0.35) return { kind: 'sleep', seconds: rng.int(6, 12) };
  for (let tries = 0; tries < 12; tries++) {
    const c = at[0] + rng.int(-4, 4);
    const r = at[1] + rng.int(-3, 3);
    if (solid[r]?.[c] === false && (c !== at[0] || r !== at[1])) return { kind: 'walk', to: [c, r] };
  }
  return { kind: 'sit', seconds: 2 };
}
