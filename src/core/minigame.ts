// Mini games: o contrato de resultado, a dificuldade, o cronômetro e as moedas (data/minigames.json).
// Puro: sem Phaser, DOM ou window. A cena só joga e diz como foi (outcome + score); quanto vale é daqui.
import type { FishDef } from './fishing';
import { validateGrooming, type MatDef, type ZoneDef } from './grooming';
import type { AdoptCat } from './adoption';
import type { DeliveryItem, ObstacleRoute } from './delivery';
import type { HeatLevel, Hideout } from './kittenHunt';
import type { LattePattern } from './latte';

export type Difficulty = 'easy' | 'normal' | 'hard';
export const DIFFICULTIES: readonly Difficulty[] = ['easy', 'normal', 'hard'];

export type Outcome = 'fail' | 'ok' | 'great';

/** O que todo mini game devolve para quem chamou. */
export interface MiniGameResult {
  gameId: string;
  outcome: Outcome;
  /** Pontuação do jogo (ex.: segundos que sobraram, peso do peixe, % do desenho). */
  score: number;
  coinsEarned: number;
  /** Pulou (recompensa reduzida). */
  skipped: boolean;
  /** O que veio junto (ex.: o peixe pescado): vai para a mochila. */
  itemId?: string;
  /** Match de adoção: cada gato e como ficou (a sessão avisa e, nas boas, tira o gato do café se ele for de lá). */
  adoptions?: { catId: string; verdict: 'good' | 'ok' | 'bad' }[];
  /** Montar a feira: os gatos levados (acomodados), os visitantes e as famílias a mais no match. */
  fairSetup?: FairSetupOutcome;
  /** Concurso de fantasia: o gato, o tema e a colocação. */
  contest?: ContestOutcome;
  /** Foto perfeita: a melhor foto da rodada. */
  photo?: PhotoOutcome;
}

export interface PhotoOutcome {
  pose: string;
  score: number;
  catIds: string[];
}

export interface ContestOutcome {
  catId: string;
  theme: string;
  rank: number;
}

export interface FairSetupOutcome {
  cats: string[];
  visitors: number;
  extraFamilies: number;
}

/** Com o que o mini game foi aberto: dificuldade, gato envolvido, item de missão, ponto de pedido... */
export interface MiniGameParams {
  difficulty: Difficulty;
  catId?: string;
  itemId?: string;
  /** Ponto de pedido da vila que este jogo conclui (se der certo). */
  jobPoint?: string;
  /** Match de adoção na feira: os gatos do café que entram na partida (o resto vem do abrigo). */
  adoptCats?: AdoptCat[];
  /** Match de adoção depois de montar a feira: famílias a mais (os visitantes interessados). */
  extraFamilies?: number;
  /** Concurso de fantasia e foto perfeita: os gatos do café que participam; no concurso, as peças liberadas (ids de data/costume.json). */
  contestCats?: { id: string; name: string; variant: string }[];
  costumePieces?: string[];
}

/** Tutorial da intro: 1 a 3 linhas curtas e um ícone (chave de data/icons.json). */
export interface MiniGameTutorial {
  icon?: string;
  lines: string[];
  /** As mesmas linhas para o celular (o direcional, o E e o dedo no lugar de teclas e mouse). */
  touchLines?: string[];
}

/** Máximo de linhas no tutorial (mais que isso ninguém lê em 2 segundos). */
export const TUTORIAL_MAX_LINES = 3;

export interface MiniGameDef {
  name: string;
  instructions: string;
  /** Tutorial mostrado na intro (sem ele, aparece `instructions`). */
  tutorial?: MiniGameTutorial;
  /** Reputação felina pelo resultado (pular não vale nada; fail pode ser negativo). */
  reputation?: Partial<Record<Outcome, number>>;
  /** Mapa da arena, quando o jogo usa um (ex.: a rua da fuga). */
  map?: string;
  /**
   * Fundo com os tiles do mundo (no lugar da cor chapada): `floor` cobre a tela (com mais de um, alterna por linha) e
   * `rug` (um tile maior, ex.: o tapete) vai centrado em `rugAt` (px lógicos, 640 x 360), `rugScale` vezes maior
   * (inteiro: a arena da varinha é o tapete em 4x).
   */
  backdrop?: { floor: string[]; rug?: string; rugAt?: [number, number]; rugScale?: number };
  rewards: Record<Difficulty, { ok: number; great: number }>;
  /** Parâmetros do jogo por dificuldade (cada jogo define os seus). */
  difficulties: Record<Difficulty, Record<string, unknown>>;
  /** Pescaria: a tabela de peixes. */
  fish?: FishDef[];
  /** Efeitos sonoros (data/audio.json: sfx) por momento do jogo. */
  sounds?: Record<string, string>;
  /** Latte art: os padrões e onde o contorno fica na xícara. */
  patterns?: LattePattern[];
  guideSize?: number;
  cupCenter?: [number, number];
  guideScale?: number;
  cupScale?: number;
  milkWidth?: number;
  /** Caça ao filhote: os esconderijos possíveis, os tipos com arte, a dica de calor e o pedaço da arena na tela. */
  hideouts?: Hideout[];
  hideoutKinds?: string[];
  heat?: HeatLevel[];
  heatRange?: number;
  /** Escovação: os emaranhados e as zonas do corpo (pixels do sprite de lado) e quanto o gato é ampliado. */
  mats?: MatDef[];
  zones?: ZoneDef[];
  /** Os nós e as zonas no gato da arte nova (folha de 64 px; o corpo fica noutro lugar do quadro). */
  art64?: { mats: MatDef[]; zones: ZoneDef[]; bodyScale?: number };
  bodyScale?: number;
  /** Área de jogo em px lógicos (x, y, largura, altura), quando o jogo é numa tela fixa sem mapa (ex.: a varinha). */
  arena?: [number, number, number, number];
  /** Parte da arena mostrada (coluna, linha, largura, altura em células), quando a tela é fixa. */
  view?: [number, number, number, number];
  /** Entrega relâmpago: saída, porta de entrega (células), itens, rotas dos obstáculos e o esbarrão. */
  start?: [number, number];
  goal?: [number, number];
  goalRadius?: number;
  items?: DeliveryItem[];
  obstacles?: ObstacleRoute[];
  stunMs?: number;
  /** Raio do esbarrão por tipo de obstáculo (px lógicos) e a folga depois de um tropeço (ms). */
  hitRadius?: Record<string, number>;
  graceMs?: number;
  /** Confiança do gato: onde o gato fica (célula) e o item que vale um petisco a mais (params.itemId). */
  catAt?: [number, number];
  treatItem?: string;
}

export interface MiniGamesConfig {
  schemaVersion: 1;
  introMs: number;
  skipRewardShare: number;
  games: Record<string, MiniGameDef>;
}

/** Moedas de um resultado: as do outcome na dificuldade; pular vale skipRewardShare das de "ok". */
export function coinsFor(cfg: MiniGamesConfig, gameId: string, difficulty: Difficulty, outcome: Outcome, skipped = false): number {
  const r = cfg.games[gameId]?.rewards[difficulty];
  if (!r) return 0;
  if (skipped) return Math.round(r.ok * cfg.skipRewardShare);
  return outcome === 'fail' ? 0 : r[outcome];
}

/**
 * Monta o resultado com as moedas certas (a cena nunca decide quanto vale). `extra`: o que o jogo achou
 * (o valor do peixe soma às moedas e o item vai para a mochila); pular não traz nada disso.
 */
export function makeResult(
  cfg: MiniGamesConfig,
  gameId: string,
  difficulty: Difficulty,
  outcome: Outcome,
  score: number,
  skipped = false,
  extra: { bonusCoins?: number; itemId?: string; adoptions?: MiniGameResult['adoptions']; fairSetup?: FairSetupOutcome; contest?: ContestOutcome; photo?: PhotoOutcome } = {},
): MiniGameResult {
  const won = !skipped && outcome !== 'fail';
  const coinsEarned = coinsFor(cfg, gameId, difficulty, outcome, skipped) + (won ? extra.bonusCoins ?? 0 : 0);
  // As adoções valem mesmo quando a partida não deu (as boas foram boas); pular não adota ninguém.
  return {
    gameId,
    outcome: skipped ? 'ok' : outcome,
    score,
    coinsEarned,
    skipped,
    ...(won && extra.itemId ? { itemId: extra.itemId } : {}),
    ...(!skipped && extra.adoptions?.length ? { adoptions: extra.adoptions } : {}),
    ...(!skipped && extra.fairSetup ? { fairSetup: extra.fairSetup } : {}),
    ...(!skipped && extra.contest ? { contest: extra.contest } : {}),
    ...(!skipped && extra.photo ? { photo: extra.photo } : {}),
  };
}

/** Parâmetros de um jogo numa dificuldade, já tipados por quem chama. */
export function paramsOf<T>(cfg: MiniGamesConfig, gameId: string, difficulty: Difficulty): T {
  const def = cfg.games[gameId];
  if (!def) throw new Error(`mini game inexistente "${gameId}"`);
  return def.difficulties[difficulty] as T;
}

/**
 * Contagem regressiva em milissegundos, avançada por quem a usa (a cena chama tick a cada quadro).
 * Não usa relógio próprio: pausar é só parar de chamar tick, e os testes avançam o tempo à mão.
 */
export class Countdown {
  private left: number;
  private paused = false;
  private ended = false;

  constructor(
    readonly totalMs: number,
    private onEnd: () => void = () => {},
  ) {
    this.left = totalMs;
  }

  tick(dtMs: number): void {
    if (this.paused || this.ended) return;
    this.left = Math.max(0, this.left - dtMs);
    if (this.left === 0) {
      this.ended = true;
      this.onEnd();
    }
  }

  pause(): void {
    this.paused = true;
  }

  resume(): void {
    this.paused = false;
  }

  /** Para de vez (o jogo acabou por outro motivo): não chama onEnd. */
  stop(): void {
    this.ended = true;
  }

  isPaused(): boolean {
    return this.paused;
  }

  remainingMs(): number {
    return this.left;
  }

  /** Fração do tempo que sobrou (1 = cheio, 0 = acabou). */
  remainingShare(): number {
    return this.totalMs > 0 ? this.left / this.totalMs : 0;
  }
}

export function validateMiniGames(cfg: MiniGamesConfig, refs: { maps: ReadonlySet<string>; icons?: ReadonlySet<string> }): string[] {
  const errors: string[] = [];
  const err = (m: string) => errors.push(`minigames: ${m}`);
  if (!(cfg.introMs >= 0)) err('introMs precisa ser 0 ou mais');
  if (!(cfg.skipRewardShare >= 0 && cfg.skipRewardShare <= 1)) err('skipRewardShare entre 0 e 1');
  for (const [id, g] of Object.entries(cfg.games)) {
    if (g.map && !refs.maps.has(g.map)) err(`"${id}": mapa inexistente "${g.map}"`);
    if (g.tutorial) {
      const n = g.tutorial.lines.length;
      if (n < 1 || n > TUTORIAL_MAX_LINES) err(`"${id}": tutorial precisa de 1 a ${TUTORIAL_MAX_LINES} linhas`);
      const t = g.tutorial.touchLines?.length;
      if (t !== undefined && (t < 1 || t > TUTORIAL_MAX_LINES)) err(`"${id}": touchLines do tutorial precisa de 1 a ${TUTORIAL_MAX_LINES} linhas`);
      if (g.tutorial.icon && refs.icons && !refs.icons.has(g.tutorial.icon)) err(`"${id}": ícone do tutorial inexistente "${g.tutorial.icon}"`);
    }
    for (const [o, v] of Object.entries(g.reputation ?? {})) if (!Number.isFinite(v)) err(`"${id}": reputation.${o} precisa ser um número`);
    for (const d of DIFFICULTIES) {
      if (!g.difficulties[d]) err(`"${id}": falta a dificuldade "${d}"`);
      const r = g.rewards[d];
      if (!r || !(r.ok >= 0) || !(r.great >= r.ok)) err(`"${id}": rewards.${d} precisa de ok >= 0 e great >= ok`);
    }
    const matCounts = DIFFICULTIES.map((d) => Number(g.difficulties[d]?.mats ?? 0));
    if (g.mats || g.zones) errors.push(...validateGrooming(g.mats ?? [], g.zones ?? [], matCounts));
    if (g.art64) errors.push(...validateGrooming(g.art64.mats, g.art64.zones, matCounts).map((e) => `art64: ${e}`));
  }
  return errors;
}
