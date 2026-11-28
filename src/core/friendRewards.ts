// Recompensas por coração na amizade (decisão 312): em 3, 6 e 10 corações a pessoa dá algo em troca. Uma receita (que
// ela ama: a pista do gosto), um presente que já existe no jogo e um favor que dura para sempre. Entregue na próxima
// conversa; sem conversa até a virada do dia, chega como mensagem na SocialVilla (o presente vai para a mochila).
// Puro: sem Phaser, DOM ou window.

/** O favor dos 10 corações. weekday: 0 = segunda ... 6 = domingo. */
export type FriendPerk =
  /** Toda semana, nesse dia, deixa itens na porta do café. */
  | { kind: 'weekly_item'; weekday: number; items: Record<string, number> }
  /** Toda semana, nesse dia e a partir dessa hora, um grupo de clientes chega junto. */
  | { kind: 'rush'; weekday: number; at: string; customers: number }
  /** Desconto (share) na mão de obra de toda obra. */
  | { kind: 'builder_discount'; share: number }
  /** Um vale-castração no começo de cada estação. */
  | { kind: 'neuter_voucher' }
  /** Famílias a mais em cada adoção da feira. */
  | { kind: 'extra_family'; families: number };

export interface FriendReward {
  hearts: number;
  /** Receita que ela ensina (libera antes da conquista). Já tem: ganha os ingredientes de `fallbackBatches` porções. */
  recipe?: string;
  /** Itens que ela dá (vão para a mochila). */
  items?: Record<string, number>;
  perk?: FriendPerk;
  /** A fala da entrega (e a mensagem da SocialVilla, se ela não encontrar a pessoa). */
  text: string;
}

/** Quantas vezes os ingredientes da receita ela ganha quando já sabe fazer. */
export const RECIPE_FALLBACK_TIMES = 2;

/** As recompensas que já valem (corações alcançados) e ainda não foram entregues, na ordem dos corações. */
export function pendingRewards(rewards: readonly FriendReward[] | undefined, heartsNow: number, given: readonly number[] | undefined): FriendReward[] {
  return (rewards ?? []).filter((r) => r.hearts <= heartsNow && !(given ?? []).includes(r.hearts)).sort((a, b) => a.hearts - b.hearts);
}

/** Os favores já ganhos de todos os amigos (dados + degraus entregues). */
export function activePerks(friends: readonly { npc: string; rewards?: FriendReward[] }[], given: (npc: string) => readonly number[] | undefined): { npc: string; perk: FriendPerk }[] {
  return friends.flatMap((f) => (f.rewards ?? []).filter((r) => r.perk && (given(f.npc) ?? []).includes(r.hearts)).map((r) => ({ npc: f.npc, perk: r.perk! })));
}

/** A flag que libera a receita ensinada (recipes.json: unlock com `any`, a conquista ou esta flag). */
export function taughtFlag(recipeId: string): string {
  return `taught.${recipeId}`;
}

export function validateFriendRewards(
  npc: string,
  rewards: readonly FriendReward[] | undefined,
  refs: { items: ReadonlySet<string>; recipes: ReadonlySet<string>; maxHearts: number; recipeUnlock: (id: string) => unknown },
): string[] {
  const errors: string[] = [];
  const seen = new Set<number>();
  for (const r of rewards ?? []) {
    const where = `friendship ${npc}: recompensa de ${r.hearts} corações`;
    if (!Number.isInteger(r.hearts) || r.hearts < 1 || r.hearts > refs.maxHearts) errors.push(`${where}: corações fora de 1 a ${refs.maxHearts}`);
    if (seen.has(r.hearts)) errors.push(`${where}: repetida`);
    seen.add(r.hearts);
    if (!r.text?.trim()) errors.push(`${where}: sem fala`);
    if (!r.recipe && !r.items && !r.perk) errors.push(`${where}: não dá nada`);
    if (r.recipe) {
      if (!refs.recipes.has(r.recipe)) errors.push(`${where}: receita inexistente "${r.recipe}"`);
      // A receita precisa aceitar a flag de ensinada (senão ela ensina e nada muda).
      else if (!JSON.stringify(refs.recipeUnlock(r.recipe) ?? null).includes(`"${taughtFlag(r.recipe)}"`)) errors.push(`${where}: a receita "${r.recipe}" precisa de unlock com { "flag": "${taughtFlag(r.recipe)}" }`);
    }
    for (const [id, n] of Object.entries(r.items ?? {})) {
      if (!refs.items.has(id)) errors.push(`${where}: item inexistente "${id}"`);
      if (!(Number.isInteger(n) && n >= 1)) errors.push(`${where}: quantidade inválida de "${id}"`);
    }
    const p = r.perk;
    if (p) {
      if ((p.kind === 'weekly_item' || p.kind === 'rush') && !(Number.isInteger(p.weekday) && p.weekday >= 0 && p.weekday <= 6)) errors.push(`${where}: weekday de 0 a 6`);
      if (p.kind === 'weekly_item') for (const id of Object.keys(p.items)) if (!refs.items.has(id)) errors.push(`${where}: item inexistente "${id}"`);
      if (p.kind === 'rush' && !(Number.isInteger(p.customers) && p.customers >= 1)) errors.push(`${where}: customers inválido`);
      if (p.kind === 'rush' && !/^\d\d:\d\d$/.test(p.at)) errors.push(`${where}: at no formato HH:MM`);
      if (p.kind === 'builder_discount' && !(p.share > 0 && p.share < 1)) errors.push(`${where}: share entre 0 e 1`);
      if (p.kind === 'extra_family' && !(Number.isInteger(p.families) && p.families >= 1)) errors.push(`${where}: families inválido`);
    }
  }
  return errors;
}
