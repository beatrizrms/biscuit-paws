// Modelos de chegada: cada modelo dá as etapas padrão de uma chegada (os dados podem trocar por `steps`).
// Puro: sem Phaser, DOM ou window. Um modelo sem etapas aqui ainda não pode ser usado em data/arrivals.json.
import type { ArrivalDef, ArrivalModel, ArrivalStep } from './arrivals';

/** Etapas padrão de cada modelo já feito (os outros vêm nas próximas etapas). */
const TEMPLATES: Partial<Record<ArrivalModel, ArrivalStep[]>> = {
  // O gato espera na entrada: ela vai até ele, a cena mostra o gato, e ela decide se deixa entrar.
  na_porta: [{ meet: true }, { cutscene: 'cs.arrival_door' }, { choice: 'take_in' }],
  // Um morador aparece com o gato no colo: ela vai até ele e decide (aceitar dá corações ao vizinho).
  vizinho_traz: [{ meet: true }, { choice: 'neighbor_offer' }],
  // Cartaz no mural do mercado (e no Vila Hoje): acolher ou não.
  mural: [{ poster: true }],
};

/** Modelos que já têm etapas (os dados só podem usar estes). */
export function modelReady(model: ArrivalModel): boolean {
  return TEMPLATES[model] !== undefined;
}

/** As etapas desta chegada: as dos dados, ou as padrão do modelo. */
export function stepsOf(def: ArrivalDef): ArrivalStep[] {
  return def.steps.length > 0 ? def.steps : (TEMPLATES[def.model] ?? []);
}

/** O que o modelo mostra no mapa enquanto ela não chega até o lugar (etapa meet). */
export function actorsOf(def: ArrivalDef): { cat: boolean; npc: string | null } {
  return { cat: def.model === 'na_porta' || def.model === 'vizinho_traz', npc: def.model === 'vizinho_traz' ? (def.result?.npc?.id ?? null) : null };
}
