// Concurso de fantasia (fase 4g): a protagonista escolhe um gato do café e uma peça por lugar (cabeça, pescoço,
// costas) entre as liberadas. O tema do dia é sorteado. A pontuação junta o tema (etiquetas das peças que batem com as
// do tema), a harmonia (cores iguais ou que combinam, estilo coerente) e um bônus pequeno de variedade (mais de uma
// cor). Os concorrentes (NPCs) tiram uma nota sorteada numa faixa da dificuldade; o resultado é a colocação.
// Conteúdo em data/costume.json. Puro: sem Phaser, DOM ou window.
import type { Rng } from './rng';
import type { Outcome } from './minigame';

export type CostumeSlot = 'head' | 'neck' | 'back';
export const COSTUME_SLOTS: readonly CostumeSlot[] = ['head', 'neck', 'back'];

export interface CostumePiece {
  id: string;
  slot: CostumeSlot;
  name: string;
  /** O desenho (a cena desenha cada forma; data/costume.json: shapes). */
  shape: string;
  color: string;
  style: string;
  /** Temas da peça (flor, estrela, mar...). */
  themes: string[];
  /** Liberada ao alcançar este limiar de reputação; sem isso, já vem liberada. */
  unlockReputation?: string;
}

export interface CostumeTheme {
  id: string;
  name: string;
  /** Etiquetas que o júri procura (cores, estilos ou temas das peças). */
  tags: string[];
}

export interface CostumeData {
  schemaVersion: 1;
  /** Onde cada lugar fica no gato sentado de frente (px do quadro de 32) e se vai atrás dele (costas). */
  slots: Record<CostumeSlot, { name: string; anchor: [number, number]; behind?: boolean }>;
  /** Cores: o nome na tela e o tom do desenho. */
  colors: Record<string, { name: string; hex: string }>;
  /** Pares de cores que combinam (além de cores iguais). */
  colorPairs: [string, string][];
  pieces: CostumePiece[];
  themes: CostumeTheme[];
  /** Pesos: por etiqueta do tema em cada peça (até themeCap por peça), por par de cores que combina, estilo igual em todas, variedade. */
  scoring: { theme: number; themeCap: number; color: number; style: number; variety: number };
  /** Nomes dos concorrentes (gato e dono, na tela). */
  rivals: { cat: string; owner: string }[];
  /** Moedas a mais por colocação (1, 2, 3). */
  prizes: Record<'1' | '2' | '3', number>;
}

/** minigames.json: costume.difficulties. */
export interface CostumeParams {
  /** Tempo para montar (0 = sem tempo). */
  seconds: number;
  rivals: number;
  /** Faixa da nota dos concorrentes (0 a 100). */
  rivalRange: [number, number];
}

export type Outfit = Partial<Record<CostumeSlot, string>>;

/** Peças liberadas com os limiares de reputação já alcançados. */
export function unlockedPieces(data: CostumeData, reached: readonly string[]): CostumePiece[] {
  return data.pieces.filter((p) => !p.unlockReputation || reached.includes(p.unlockReputation));
}

export function drawTheme(data: CostumeData, rng: Rng): CostumeTheme {
  return data.themes[rng.int(0, data.themes.length - 1)]!;
}

const piecesOf = (data: CostumeData, o: Outfit) => COSTUME_SLOTS.map((s) => data.pieces.find((p) => p.id === o[s])).filter((p): p is CostumePiece => !!p);

const match = (data: CostumeData, a: string, b: string) => a === b || data.colorPairs.some(([x, y]) => (x === a && y === b) || (x === b && y === a));

export interface CostumeScore {
  theme: number;
  harmony: number;
  variety: number;
  /** 0 a 100. */
  score: number;
}

/** A nota da fantasia neste tema. */
export function scoreOutfit(data: CostumeData, theme: CostumeTheme, o: Outfit): CostumeScore {
  const s = data.scoring;
  const pieces = piecesOf(data, o);
  const themeRaw = pieces.reduce((n, p) => n + Math.min(s.themeCap, [p.color, p.style, ...p.themes].filter((t) => theme.tags.includes(t)).length) * s.theme, 0);
  let pairs = 0;
  for (let i = 0; i < pieces.length; i++) for (let j = i + 1; j < pieces.length; j++) if (match(data, pieces[i]!.color, pieces[j]!.color)) pairs++;
  const style = pieces.length >= 2 && pieces.every((p) => p.style === pieces[0]!.style) ? s.style : 0;
  const harmony = pairs * s.color + style;
  const variety = new Set(pieces.map((p) => p.color)).size >= 2 ? s.variety : 0;
  const n = COSTUME_SLOTS.length;
  const max = n * s.themeCap * s.theme + ((n * (n - 1)) / 2) * s.color + s.style + s.variety;
  return { theme: themeRaw, harmony, variety, score: Math.round((100 * (themeRaw + harmony + variety)) / max) };
}

export interface ContestEntry {
  cat: string;
  owner: string;
  score: number;
  player: boolean;
}

/** Os concorrentes da vez (nomes sem repetir, notas na faixa) e o ranking com a protagonista (empate fica com ela). */
export function runContest(data: CostumeData, p: CostumeParams, rng: Rng, player: { cat: string; owner: string; score: number }): ContestEntry[] {
  const pool = [...data.rivals];
  const entries: ContestEntry[] = [{ ...player, player: true }];
  for (let i = 0; i < p.rivals && pool.length > 0; i++) {
    const r = pool.splice(rng.int(0, pool.length - 1), 1)[0]!;
    entries.push({ ...r, score: rng.int(p.rivalRange[0], p.rivalRange[1]), player: false });
  }
  return entries.sort((a, b) => b.score - a.score || Number(b.player) - Number(a.player));
}

/** 1º = perfeito; pódio (2º, 3º) = deu certo; fora do pódio = não deu. */
export function contestOutcome(rank: number): Outcome {
  return rank === 1 ? 'great' : rank <= 3 ? 'ok' : 'fail';
}

export function validateCostume(data: CostumeData, refs: { thresholds: ReadonlySet<string>; shapes?: ReadonlySet<string> }, difficulties?: Record<string, CostumeParams>): string[] {
  const errors: string[] = [];
  const err = (m: string) => errors.push(`costume: ${m}`);
  const ids = new Set<string>();
  for (const p of data.pieces) {
    if (!p.id.startsWith('costume.')) err(`peça "${p.id}" deve começar com "costume."`);
    if (ids.has(p.id)) err(`peça repetida "${p.id}"`);
    ids.add(p.id);
    if (!COSTUME_SLOTS.includes(p.slot)) err(`peça "${p.id}" num lugar desconhecido "${p.slot}"`);
    if (!data.colors[p.color]) err(`peça "${p.id}" com cor desconhecida "${p.color}"`);
    if (refs.shapes && !refs.shapes.has(p.shape)) err(`peça "${p.id}" com forma sem desenho "${p.shape}"`);
    if (p.unlockReputation && !refs.thresholds.has(p.unlockReputation)) err(`peça "${p.id}": limiar inexistente "${p.unlockReputation}"`);
  }
  for (const s of COSTUME_SLOTS) {
    if (!data.slots[s]) err(`falta o lugar "${s}"`);
    if (!data.pieces.some((p) => p.slot === s && !p.unlockReputation)) err(`o lugar "${s}" precisa de uma peça liberada desde o começo`);
  }
  for (const [a, b] of data.colorPairs) if (!data.colors[a] || !data.colors[b]) err(`par de cores desconhecido "${a}"/"${b}"`);
  const tags = new Set(data.pieces.flatMap((p) => [p.color, p.style, ...p.themes]));
  const tids = new Set<string>();
  for (const t of data.themes) {
    if (!t.id.startsWith('theme.')) err(`tema "${t.id}" deve começar com "theme."`);
    if (tids.has(t.id)) err(`tema repetido "${t.id}"`);
    tids.add(t.id);
    for (const tag of t.tags) if (!tags.has(tag)) err(`tema "${t.id}": nenhuma peça tem "${tag}"`);
  }
  if (data.themes.length === 0) err('precisa de pelo menos um tema');
  for (const [d, p] of Object.entries(difficulties ?? {})) {
    if (p.rivals > data.rivals.length) err(`${d}: ${p.rivals} concorrentes e só ${data.rivals.length} nomes`);
    if (!(p.rivalRange[0] <= p.rivalRange[1])) err(`${d}: rivalRange invertida`);
  }
  return errors;
}
