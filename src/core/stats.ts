// Estatísticas do café (o "raio X" do app Café em números e a base dos selos): o dia em andamento, um registro
// curto por dia fechado, totais do jogo e as sequências de bom comportamento. Puro: sem Phaser, DOM ou window.
// O total de clientes atendidos já mora em service.served; gatos já abrigados são as entradas de state.cats.

/** Quantos dias fechados ficam no save (o gráfico mostra os últimos 14; a média usa os últimos 7). */
export const STATS_HISTORY_DAYS = 28;
/** A média da semana: os últimos 7 dias fechados, divididos só pelos que o café abriu. */
export const STATS_WEEK_DAYS = 7;

/** Quantas avaliações de cliente ficam no save (a nota do café usa as últimas review.averageOf). */
export const REVIEWS_KEPT = 200;

/** Sequências de bom comportamento (dias seguidos sem recaída). */
export const STREAKS = ['no_gave_up', 'cats_cared'] as const;
export type StreakId = (typeof STREAKS)[number];

export interface Streak {
  current: number;
  /** A melhor sequência já feita (nunca diminui). */
  best: number;
}

/** Um dia fechado. */
export interface DayStats {
  day: number;
  /** O atendimento abria neste dia (liberado, dia aberto no horário e sem evento fechando o café). */
  open: boolean;
  served: number;
  /** Clientes que desistiram (a paciência acabou). Quem sai porque o café fechou não conta. */
  gaveUp: number;
  /** Moedas ganhas no dia (vendas, gorjetas, pedidos da vila...). */
  earned: number;
  /** Doses de ingrediente gastas no preparo: itemId -> doses. */
  doses: Record<string, number>;
  /** Gatos abrigados no fim do dia. */
  cats: number;
  /** Gatos que amanheceram doentes e terminaram o dia sem a dose de remédio do dia. */
  untreated: number;
}

/** No save (v27). */
export interface StatsState {
  /** O dia em andamento. sickAtStart: gatos doentes ao amanhecer (só eles precisam do remédio hoje). */
  today: { served: number; gaveUp: number; doses: Record<string, number>; sickAtStart: string[] };
  /** Os últimos STATS_HISTORY_DAYS dias fechados, do mais antigo ao mais novo. */
  days: DayStats[];
  /** Totais do jogo (a partir do save v27; antes disso só havia o total de atendidos). */
  totals: { openDays: number; gaveUp: number; doses: Record<string, number> };
  streaks: Record<StreakId, Streak>;
  /** As últimas REVIEWS_KEPT avaliações (1 a 5 estrelas), da mais antiga à mais nova. Saves antigos: vazio. */
  reviews: number[];
}

export function newStats(): StatsState {
  return {
    today: { served: 0, gaveUp: 0, doses: {}, sickAtStart: [] },
    days: [],
    totals: { openDays: 0, gaveUp: 0, doses: {} },
    streaks: { no_gave_up: { current: 0, best: 0 }, cats_cared: { current: 0, best: 0 } },
    reviews: [],
  };
}

export function recordServed(s: StatsState): void {
  s.today.served++;
}

export function recordGaveUp(s: StatsState): void {
  s.today.gaveUp++;
  s.totals.gaveUp++;
}

/** Guarda a nota de quem saiu (a nota do café é a média das últimas). */
export function recordReview(s: StatsState, stars: number): void {
  s.reviews.push(stars);
  if (s.reviews.length > REVIEWS_KEPT) s.reviews.splice(0, s.reviews.length - REVIEWS_KEPT);
}

/** Nota do café: média das últimas `last` avaliações (null sem nenhuma) e quantas entraram na conta. */
export function reviewAverage(s: StatsState, last: number): { average: number | null; count: number } {
  const recent = s.reviews.slice(-last);
  return { average: recent.length ? recent.reduce((a, b) => a + b, 0) / recent.length : null, count: recent.length };
}

export function recordDoses(s: StatsState, itemId: string, n: number): void {
  if (n <= 0) return;
  s.today.doses[itemId] = (s.today.doses[itemId] ?? 0) + n;
  s.totals.doses[itemId] = (s.totals.doses[itemId] ?? 0) + n;
}

function bump(st: Streak): void {
  st.current++;
  st.best = Math.max(st.best, st.current);
}

/**
 * Fecha o dia: guarda o registro, soma o dia aberto e anda as sequências. Dia que não conta não quebra:
 * - no_gave_up: conta o dia com cliente atendido e ninguém desistindo; um cliente que desistiu zera.
 * - cats_cared: conta o dia com gato abrigado e todos os doentes da manhã com o remédio do dia; um sem zera.
 * Devolve o registro e as sequências que quebraram agora (tinham pelo menos 1 dia).
 */
export function closeDay(
  s: StatsState,
  day: { day: number; open: boolean; earned: number; cats: number; untreated: number },
): { record: DayStats; broken: StreakId[] } {
  const t = s.today;
  const record: DayStats = { ...day, served: t.served, gaveUp: t.gaveUp, doses: { ...t.doses } };
  s.days.push(record);
  if (s.days.length > STATS_HISTORY_DAYS) s.days.splice(0, s.days.length - STATS_HISTORY_DAYS);
  if (day.open) s.totals.openDays++;

  const broken: StreakId[] = [];
  const step = (id: StreakId, breaks: boolean, counts: boolean) => {
    const st = s.streaks[id];
    if (breaks) {
      if (st.current > 0) broken.push(id);
      st.current = 0;
    } else if (counts) bump(st);
  };
  step('no_gave_up', t.gaveUp > 0, t.served > 0);
  step('cats_cared', day.untreated > 0, day.cats > 0);

  s.today = { served: 0, gaveUp: 0, doses: {}, sickAtStart: [] };
  return { record, broken };
}

/** O que o app mostra. Médias: null quando o café não abriu nenhum dia da semana. */
export interface StatsView {
  servedTotal: number;
  servedToday: number;
  /** Dias abertos entre os últimos 7 dias fechados. */
  weekOpenDays: number;
  weekServedPerDay: number | null;
  weekEarnedPerDay: number | null;
  /** Doses por dia aberto na semana, por ingrediente (só os que foram gastos), do mais gasto ao menos. */
  weekDosesPerDay: { itemId: string; perDay: number }[];
  openDaysTotal: number;
  gaveUpTotal: number;
  reputation: number;
  catsNow: number;
  catsEver: number;
  streaks: Record<StreakId, Streak>;
  /** Os últimos 14 dias fechados (para o gráfico), do mais antigo ao mais novo. */
  chart: { day: number; open: boolean; served: number }[];
}

export function statsView(
  s: StatsState,
  ctx: { day: number; servedTotal: number; reputation: number; catsNow: number; catsEver: number },
): StatsView {
  const week = s.days.filter((d) => d.day >= ctx.day - STATS_WEEK_DAYS && d.day < ctx.day && d.open);
  const n = week.length;
  const avg = (sum: number) => (n > 0 ? sum / n : null);
  const doses: Record<string, number> = {};
  for (const d of week) for (const [id, q] of Object.entries(d.doses)) doses[id] = (doses[id] ?? 0) + q;
  return {
    servedTotal: ctx.servedTotal,
    servedToday: s.today.served,
    weekOpenDays: n,
    weekServedPerDay: avg(week.reduce((a, d) => a + d.served, 0)),
    weekEarnedPerDay: avg(week.reduce((a, d) => a + d.earned, 0)),
    weekDosesPerDay:
      n > 0
        ? Object.entries(doses)
            .map(([itemId, q]) => ({ itemId, perDay: q / n }))
            .sort((a, b) => b.perDay - a.perDay || a.itemId.localeCompare(b.itemId))
        : [],
    openDaysTotal: s.totals.openDays,
    gaveUpTotal: s.totals.gaveUp,
    reputation: ctx.reputation,
    catsNow: ctx.catsNow,
    catsEver: ctx.catsEver,
    streaks: { no_gave_up: { ...s.streaks.no_gave_up }, cats_cared: { ...s.streaks.cats_cared } },
    chart: s.days.slice(-14).map((d) => ({ day: d.day, open: d.open, served: d.served })),
  };
}

const count = (v: unknown): number => (typeof v === 'number' && Number.isInteger(v) && v >= 0 ? v : 0);
const doseMap = (v: unknown, known: (id: string) => boolean): Record<string, number> =>
  Object.fromEntries(Object.entries((v ?? {}) as Record<string, unknown>).filter(([id, q]) => known(id) && count(q) > 0).map(([id, q]) => [id, count(q)]));

/** Leitura do save: campos quebrados voltam ao zero; ingredientes que sumiram dos dados são esquecidos. */
export function normalizeStats(v: unknown, knownItem: (id: string) => boolean): StatsState {
  const x = (v ?? {}) as Partial<StatsState>;
  const base = newStats();
  const t = (x.today ?? {}) as Partial<StatsState['today']>;
  const streak = (st: unknown): Streak => {
    const o = (st ?? {}) as Partial<Streak>;
    const current = count(o.current);
    return { current, best: Math.max(current, count(o.best)) };
  };
  return {
    today: {
      served: count(t.served),
      gaveUp: count(t.gaveUp),
      doses: doseMap(t.doses, knownItem),
      sickAtStart: Array.isArray(t.sickAtStart) ? t.sickAtStart.filter((id): id is string => typeof id === 'string') : [],
    },
    days: (Array.isArray(x.days) ? x.days : [])
      .filter((d): d is DayStats => !!d && Number.isInteger(d.day) && d.day >= 1)
      .slice(-STATS_HISTORY_DAYS)
      .map((d) => ({
        day: d.day,
        open: d.open === true,
        served: count(d.served),
        gaveUp: count(d.gaveUp),
        earned: typeof d.earned === 'number' && Number.isFinite(d.earned) ? d.earned : 0,
        doses: doseMap(d.doses, knownItem),
        cats: count(d.cats),
        untreated: count(d.untreated),
      })),
    totals: { openDays: count(x.totals?.openDays), gaveUp: count(x.totals?.gaveUp), doses: doseMap(x.totals?.doses, knownItem) },
    streaks: x.streaks ? { no_gave_up: streak(x.streaks.no_gave_up), cats_cared: streak(x.streaks.cats_cared) } : base.streaks,
    reviews: (Array.isArray(x.reviews) ? x.reviews : []).filter((n): n is number => Number.isInteger(n) && n >= 1 && n <= 5).slice(-REVIEWS_KEPT),
  };
}
