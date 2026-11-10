// Pescaria: sorteio do peixe por raridade e a barra de timing. Puro: a cena só desenha e diz se o botão
// está seguro; a física da barra é daqui, para os testes repetirem a mesma partida com a mesma semente.
import type { Outcome } from './minigame';
import type { Rng } from './rng';

export type Rarity = 'junk' | 'common' | 'uncommon' | 'rare' | 'legendary';
export const RARITIES: readonly Rarity[] = ['junk', 'common', 'uncommon', 'rare', 'legendary'];

/** Um peixe da tabela (data/minigames.json: games.fishing.fish). */
export interface FishDef {
  id: string;
  name: string;
  rarity: Rarity;
  /** Velocidade da zona verde (fração da barra por segundo). */
  speed: number;
  /** Tamanho da zona verde (fração da barra). */
  zone: number;
  /** Moedas extras ao pescar. */
  value: number;
  /** Item que vai para a mochila. */
  item: string;
  /** Quadro do ícone na folha de peixes (3 x 2). */
  icon: number;
}

/** Parâmetros por dificuldade. */
export interface FishingParams {
  timeSec: number;
  /** Quanto a boia espera até a mordida [min, max] (ms). */
  waitMs: [number, number];
  /** Tempo para fisgar depois da mordida (ms). */
  biteWindowMs: number;
  /** Peso de cada raridade no sorteio. */
  rarityWeights: Record<Rarity, number>;
  /** Multiplicam a tabela: zona menor e peixe mais rápido no difícil. */
  zoneScale: number;
  speedScale: number;
  /** Progresso por segundo dentro e fora da zona (a barra vai de 0 a 1). */
  progressGain: number;
  progressLoss: number;
  startProgress: number;
  /** Segurar sobe o indicador; soltar, ele cai (frações da barra por segundo²). */
  lift: number;
  gravity: number;
  /** Fração do tempo dentro da zona para "great". */
  greatAccuracy: number;
}

/** Sorteia o peixe: primeiro a raridade (pelos pesos), depois um peixe dela. Raridade sem peixe não entra. */
export function rollFish(rng: Rng, table: readonly FishDef[], weights: Record<Rarity, number>): FishDef {
  const present = RARITIES.filter((r) => (weights[r] ?? 0) > 0 && table.some((f) => f.rarity === r));
  const total = present.reduce((n, r) => n + weights[r], 0);
  let roll = rng.next() * total;
  let rarity = present[present.length - 1]!;
  for (const r of present) {
    roll -= weights[r];
    if (roll < 0) {
      rarity = r;
      break;
    }
  }
  const pool = table.filter((f) => f.rarity === rarity);
  return pool[rng.int(0, pool.length - 1)]!;
}

/** A barra durante a puxada. Posições de 0 (embaixo) a 1 (em cima). */
export interface ReelState {
  /** Indicador da jogadora. */
  indicator: number;
  indicatorVel: number;
  /** Centro da zona verde (o peixe) e para onde ela vai. */
  zone: number;
  zoneTarget: number;
  /** Tamanho da zona (já com a escala da dificuldade). */
  zoneSize: number;
  progress: number;
  /** Tempo total puxando e quanto dele dentro da zona (para o "great"). */
  elapsed: number;
  inside: number;
  status: 'reeling' | 'caught' | 'escaped';
}

export function startReel(fish: FishDef, p: FishingParams, rng: Rng): ReelState {
  const zoneSize = Math.min(0.9, fish.zone * p.zoneScale);
  return { indicator: 0.5, indicatorVel: 0, zone: 0.5, zoneTarget: rng.next(), zoneSize, progress: p.startProgress, elapsed: 0, inside: 0, status: 'reeling' };
}

/** Avança a barra `dt` segundos. `holding`: a jogadora está segurando (botão ou E). */
export function stepReel(s: ReelState, dt: number, holding: boolean, fish: FishDef, p: FishingParams, rng: Rng): ReelState {
  if (s.status !== 'reeling') return s;
  // Indicador: segurar acelera para cima, soltar cai. Ele é o meio da caixa da jogadora (do tamanho da zona): a caixa
  // bate na ponta da barra e para ali, sem passar dela (o indicador fica a meia caixa das pontas).
  const edge = s.zoneSize / 2;
  let vel = s.indicatorVel + (holding ? p.lift : -p.gravity) * dt;
  let indicator = s.indicator + vel * dt;
  if (indicator <= edge || indicator >= 1 - edge) {
    indicator = Math.min(1 - edge, Math.max(edge, indicator));
    vel = 0;
  }
  // Zona (o peixe): vai até um alvo sorteado; chegando, sorteia outro. Peixe raro é mais rápido (tabela).
  const half = s.zoneSize / 2;
  const speed = fish.speed * p.speedScale;
  let zone = s.zone;
  let zoneTarget = s.zoneTarget;
  const step = speed * dt;
  if (Math.abs(zoneTarget - zone) <= step) {
    zone = zoneTarget;
    zoneTarget = half + rng.next() * (1 - 2 * half);
  } else zone += Math.sign(zoneTarget - zone) * step;
  zone = Math.min(1 - half, Math.max(half, zone));
  // Dentro da zona enche o progresso; fora, esvazia.
  const isInside = Math.abs(indicator - zone) <= half;
  const progress = Math.min(1, Math.max(0, s.progress + (isInside ? p.progressGain : -p.progressLoss) * dt));
  const status = progress >= 1 ? 'caught' : progress <= 0 ? 'escaped' : 'reeling';
  return { ...s, indicator, indicatorVel: vel, zone, zoneTarget, progress, elapsed: s.elapsed + dt, inside: s.inside + (isInside ? dt : 0), status };
}

/** Pescou: great com boa precisão (tempo dentro da zona); senão ok. Não pescou: fail. */
export function fishingOutcome(caught: boolean, s: Pick<ReelState, 'elapsed' | 'inside'>, greatAccuracy: number): Outcome {
  if (!caught) return 'fail';
  const accuracy = s.elapsed > 0 ? s.inside / s.elapsed : 0;
  return accuracy >= greatAccuracy ? 'great' : 'ok';
}

export function validateFishTable(table: readonly FishDef[], refs: { items: ReadonlySet<string> }): string[] {
  const errors: string[] = [];
  const ids = new Set<string>();
  for (const f of table) {
    const where = `minigames: peixe "${f.id}"`;
    if (ids.has(f.id)) errors.push(`${where}: id repetido`);
    ids.add(f.id);
    if (!RARITIES.includes(f.rarity)) errors.push(`${where}: raridade inválida "${f.rarity}"`);
    if (!(f.zone > 0 && f.zone < 1)) errors.push(`${where}: zone entre 0 e 1`);
    if (!(f.speed > 0)) errors.push(`${where}: speed precisa ser positivo`);
    if (!refs.items.has(f.item)) errors.push(`${where}: item inexistente "${f.item}"`);
  }
  return errors;
}
