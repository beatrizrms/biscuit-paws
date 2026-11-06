// Gatos: definições (data/cats.json) e sprites (data/cat_sprites.json). Puro: sem Phaser, DOM ou window.

export interface CatDef {
  id: string;
  /** Nome fixo (ex.: Tekinha). Sem nome fixo, a jogadora escolhe ao abrigar. */
  name?: string;
  /** Variante do Cosy Cats (folha de sprites). */
  variant: string;
  personality: string;
  /** Sugestões para a caixa de nome. */
  nameSuggestions?: string[];
  /** Só aparece em lembranças (não vive no café). */
  memory?: boolean;
  tags: string[];
}

export interface CatsData {
  schemaVersion: 1;
  cats: CatDef[];
}

export interface CatSpritesData {
  schemaVersion: 1;
  frameSize: number;
  columns: number;
  animations: { name: string; row: number; frames: number; fps: number }[];
  variants: Record<string, string>;
}

export function validateCats(data: CatsData, sprites: CatSpritesData): string[] {
  const errors: string[] = [];
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

export type CatGoal = { kind: 'walk'; to: [number, number] } | { kind: 'sit'; seconds: number } | { kind: 'sleep'; seconds: number };

/**
 * O que o gato faz a seguir: andar até uma célula livre perto, sentar ou cochilar.
 * Puro e com RNG injetado (repetível nos testes).
 */
export function nextCatGoal(
  rng: { next(): number; int(min: number, max: number): number },
  at: [number, number],
  solid: boolean[][],
): CatGoal {
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
