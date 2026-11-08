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
  // Pegadas na calçada levam ao esconderijo (place.at): ela segue, acha o gato encolhido e decide.
  pegadas: [{ meet: true }, { choice: 'take_in' }],
  // Um gato do café aparece miando (place.at), ela segue o caminho dele (place.route) até o gato novo e decide.
  gato_leva: [{ meet: true }, { lead: true }, { choice: 'take_in' }],
  // Preso num lugar sem saída (poste, telhado, caixa): acalmar até ele descer (Confiança do gato) e decidir.
  preso: [{ minigame: { id: 'trust', difficulty: 'auto' } }, { choice: 'take_in' }],
  // Gata com filhotes em lugar perigoso: achar os filhotes um a um (Caça ao filhote) e acolher a família.
  ninhada: [{ meet: true }, { minigame: { id: 'kitten_hunt', difficulty: 'hard' } }, { choice: 'take_in_litter' }],
  // Entrou no café por uma brecha: procurar pelo som (Caça ao filhote) e ganhar a confiança dele.
  dentro_do_cafe: [{ minigame: { id: 'kitten_hunt', difficulty: 'easy' } }, { minigame: { id: 'trust', difficulty: 'auto' } }, { choice: 'take_in' }],
  // Uma caixa que mia na porta (com bilhete): ler, perguntar pela vila (pistas nos dados) e decidir.
  entrega: [{ meet: true }, { cutscene: 'cs.arrival_box' }, { choice: 'keep_box_cat' }],
  // Gato ferido fugindo: pegar (Gato em fuga) e correr com ele até a clínica (Entrega relâmpago). Sem pergunta: precisa de ajuda.
  em_perigo: [{ minigame: { id: 'chase', difficulty: 'easy' } }, { minigame: { id: 'delivery', difficulty: 'normal', itemId: 'hurt_cat' } }],
};

/** Modelos que já têm etapas (os dados só podem usar estes). */
export function modelReady(model: ArrivalModel): boolean {
  return TEMPLATES[model] !== undefined;
}

/** As etapas desta chegada: as dos dados, ou as padrão do modelo. */
export function stepsOf(def: ArrivalDef): ArrivalStep[] {
  return def.steps.length > 0 ? def.steps : (TEMPLATES[def.model] ?? []);
}

/**
 * O que o modelo mostra no mapa enquanto ela não chega até o lugar (etapa meet): o gato novo (escondido = só
 * aparece de perto), o vizinho, as pegadas e o gato do café que guia.
 */
export function actorsOf(def: ArrivalDef): { cat: boolean; hidden: boolean; npc: string | null; trail: boolean; leader: boolean; parcel: boolean } {
  return {
    cat: ['na_porta', 'vizinho_traz', 'pegadas', 'preso', 'ninhada', 'em_perigo'].includes(def.model),
    parcel: def.model === 'entrega',
    hidden: def.model === 'pegadas',
    npc: def.model === 'vizinho_traz' ? (def.result?.npc?.id ?? null) : null,
    trail: def.model === 'pegadas',
    leader: def.model === 'gato_leva',
  };
}
