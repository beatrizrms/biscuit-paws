// Pedidos da vila (bicos) e o jornal do celular ("Vila Hoje"). Puro: sem Phaser, DOM ou window.
// Um pedido tem passos; cada passo pede que a personagem visite pontos do mapa (tecla E ou clique de perto).
// Quem decide aceitar, avançar e pagar é a GameSession; aqui ficam os tipos, a validação e as escolhas do dia.
import type { Cell } from './map';
import { createRng } from './rng';

/** Ponto de um pedido: um lugar do mapa onde ela faz algo. */
export interface JobPoint {
  id: string;
  map: string;
  at: Cell;
  /** Distância máxima (em células) entre os pés e o ponto (padrão 1). */
  reach?: number;
  /** "press": só apertar E; "sweep": varre com a vassoura; "minigame": abre um mini game (o ponto conta se der certo). */
  action: 'press' | 'sweep' | 'minigame';
  /** Com action "minigame": qual jogo, em que dificuldade e, se o jogo usa, com que item (o café da entrega, o petisco). */
  minigame?: { id: string; difficulty: 'easy' | 'normal' | 'hard'; itemId?: string };
  /** Tile desenhado no ponto enquanto ele estiver pendente (ex.: monte de neve). */
  marker?: string;
  /** Quadro de data/emotes.json desenhado no ponto enquanto pendente, no lugar do "!" (ex.: a caixa para pegar). */
  sprite?: string;
  /** Item que ela recebe ao fazer o ponto (ex.: a caixa da entrega). */
  gives?: string;
  /** Item que ela entrega ao fazer o ponto (precisa ter). */
  takes?: string;
}

export interface JobStep {
  /** Texto que a jogadora vê no balão. */
  text: string;
  /** Pontos que precisam ser feitos (em qualquer ordem) para o passo valer. */
  points: string[];
}

export interface JobDef {
  id: string;
  title: string;
  /** Quem pede (morador, loja). */
  giver: string;
  description: string;
  /** Mapa principal do pedido (para a lista). */
  location: string;
  /** Moedas pagas ao concluir. */
  reward: number;
  /**
   * daily: pode ser feito uma vez por dia; once: uma vez no jogo; sporadic: aparece só em alguns dias (sorteio
   * pelo dia, com a chance de `chance`) e, nesses dias, uma vez.
   */
  repeat: 'daily' | 'once' | 'sporadic';
  /** sporadic: chance (0 a 1) de aparecer num dia. */
  chance?: number;
  /** Condição para aparecer (ex.: depois do prólogo). Usa as condições da história. */
  available?: Record<string, unknown>;
  steps: JobStep[];
}

export interface JobsData {
  schemaVersion: 1;
  /** Quantos pedidos ao mesmo tempo (1 nos primeiros dias). */
  maxActive: number;
  points: JobPoint[];
  jobs: JobDef[];
}

/**
 * Pedido esporádico aparece neste dia? Sorteio com semente do id e do dia: o mesmo dia dá sempre a mesma
 * resposta (abrir e fechar o jogo não muda) e cada pedido sorteia separado.
 */
export function sporadicToday(jobId: string, day: number, chance: number): boolean {
  let h = 0;
  for (const ch of jobId) h = (h * 31 + ch.charCodeAt(0)) | 0;
  return createRng((h ^ (day * 2654435761)) >>> 0).next() < chance;
}

/** Notícia do "Vila Hoje": fixa num dia (`day`) ou do sorteio a partir de um dia (`fromDay`). */
export interface NewsItem {
  id: string;
  headline: string;
  text: string;
  day?: number;
  fromDay?: number;
}

export interface NewsData {
  schemaVersion: 1;
  /** Nome do app no celular. */
  app: string;
  items: NewsItem[];
}

/** Notícias de um dia: as marcadas para aquele dia; sem nenhuma, uma do sorteio (sempre a mesma para o dia). */
export function newsForDay(data: NewsData, day: number): NewsItem[] {
  const fixed = data.items.filter((n) => n.day === day);
  if (fixed.length > 0) return fixed;
  const pool = data.items.filter((n) => n.day === undefined && (n.fromDay ?? 1) <= day);
  if (pool.length === 0) return [];
  const rng = createRng(day * 7919 + 13);
  return [pool[rng.int(0, pool.length - 1)]!];
}

export function validateJobs(
  jobs: JobsData,
  news: NewsData,
  refs: { maps: ReadonlySet<string>; items: ReadonlySet<string>; tiles: ReadonlySet<string>; sprites: ReadonlySet<string> },
): string[] {
  const errors: string[] = [];
  if (!(jobs.maxActive >= 1)) errors.push('jobs: maxActive precisa ser 1 ou mais');
  const pointIds = new Set<string>();
  for (const p of jobs.points) {
    const where = `jobs: ponto "${p.id}"`;
    if (!p.id.startsWith('pt.')) errors.push(`${where}: id deve começar com "pt."`);
    if (pointIds.has(p.id)) errors.push(`${where}: id repetido`);
    pointIds.add(p.id);
    if (!refs.maps.has(p.map)) errors.push(`${where}: mapa inexistente "${p.map}"`);
    if (!['press', 'sweep', 'minigame'].includes(p.action)) errors.push(`${where}: ação inválida "${p.action}"`);
    if (p.action === 'minigame' && !p.minigame) errors.push(`${where}: action "minigame" precisa de "minigame": { id, difficulty }`);
    if (p.marker && !refs.tiles.has(p.marker)) errors.push(`${where}: tile inexistente "${p.marker}"`);
    if (p.sprite && !refs.sprites.has(p.sprite)) errors.push(`${where}: quadro inexistente em emotes.json "${p.sprite}"`);
    for (const item of [p.gives, p.takes]) if (item && !refs.items.has(item)) errors.push(`${where}: item inexistente "${item}"`);
  }
  const jobIds = new Set<string>();
  for (const j of jobs.jobs) {
    const where = `jobs: "${j.id}"`;
    if (!j.id.startsWith('job.')) errors.push(`${where}: id deve começar com "job."`);
    if (jobIds.has(j.id)) errors.push(`${where}: id repetido`);
    jobIds.add(j.id);
    if (!refs.maps.has(j.location)) errors.push(`${where}: mapa inexistente "${j.location}"`);
    if (!(j.reward > 0)) errors.push(`${where}: recompensa precisa ser positiva`);
    if (!['daily', 'once', 'sporadic'].includes(j.repeat)) errors.push(`${where}: repeat inválido "${j.repeat}"`);
    if (j.repeat === 'sporadic' && !(j.chance !== undefined && j.chance > 0 && j.chance <= 1)) errors.push(`${where}: sporadic precisa de chance entre 0 e 1`);
    if (j.steps.length === 0) errors.push(`${where}: sem passos`);
    for (const s of j.steps) {
      if (s.points.length === 0) errors.push(`${where}: passo sem pontos`);
      for (const p of s.points) if (!pointIds.has(p)) errors.push(`${where}: ponto inexistente "${p}"`);
    }
  }
  const newsIds = new Set<string>();
  for (const n of news.items) {
    if (!n.id.startsWith('news.')) errors.push(`news: id "${n.id}" deve começar com "news."`);
    if (newsIds.has(n.id)) errors.push(`news: id repetido "${n.id}"`);
    newsIds.add(n.id);
    if (!n.headline || !n.text) errors.push(`news: "${n.id}" sem manchete ou texto`);
  }
  return errors;
}
