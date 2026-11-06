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
