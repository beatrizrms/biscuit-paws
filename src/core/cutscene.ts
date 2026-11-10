// Cenas sem mapa (prólogo, cartões). Só dados e validação: quem mostra é a interface.
// Puro: sem Phaser, DOM ou window.

/** Nas cenas, o gato da chegada em andamento (o jogo troca pelo id dele). */
export const ARRIVAL_CAT = 'arrival';

export type CutsceneStep =
  | { type: 'text'; speaker: string; text: string }
  | { type: 'cat'; cat: string; animation: string; caption?: string; /** Quadros por segundo só nesta cena (sem: o da animação). */ fps?: number }
  | { type: 'hide' }
  | {
      type: 'phone';
      app: string;
      title: string;
      lines: string[];
      /** Ícone do app (chave em data/phone.json: apps). */
      appIcon?: string;
      /** "lock": tela de bloqueio vibrando com a notificação; "app" (padrão): o anúncio aberto. */
      mode?: 'lock' | 'app' | 'call';
      /** Quem liga (modo "call"): NPC com retrato. */
      caller?: string;
      /** Hora e data da tela de bloqueio. */
      time?: string;
      date?: string;
    }
  | { type: 'card'; text: string }
  /**
   * Imagem de tela cheia (ex.: a inauguração). `byFacade`: imagem por acabamento da fachada (a cor que ela escolheu);
   * sem a da cor, vale `image`. `sound`: chave de data/audio.json tocada ao aparecer (jingle).
   */
  | { type: 'image'; image: string; byFacade?: Record<string, string>; sound?: string };

export interface CutsceneDef {
  /** Cor de fundo da cena. */
  background: string;
  /** Neve caindo por cima. */
  snow?: boolean;
  steps: CutsceneStep[];
}

export interface CutscenesData {
  schemaVersion: 1;
  cutscenes: Record<string, CutsceneDef>;
}

/** Flag que a sessão marca quando a cena termina (as condições da história usam isso). */
export function seenFlag(cutsceneId: string): string {
  return `seen.${cutsceneId}`;
}

/** Problemas nas cenas. `catIds`/`animations`: o que existe nos dados dos gatos. */
export function validateCutscenes(data: CutscenesData, catIds: ReadonlySet<string>, animations: ReadonlySet<string>): string[] {
  const errors: string[] = [];
  for (const [id, cs] of Object.entries(data.cutscenes)) {
    const where = `cutscene "${id}"`;
    if (!id.startsWith('cs.')) errors.push(`${where}: id deve começar com "cs."`);
    if (cs.steps.length === 0) errors.push(`${where}: sem passos`);
    cs.steps.forEach((step, i) => {
      if (step.type === 'cat') {
        // "arrival": o gato da chegada em andamento (data/arrivals.json), que pode ser gerado.
        if (step.cat !== ARRIVAL_CAT && !catIds.has(step.cat)) errors.push(`${where} passo ${i}: gato inexistente "${step.cat}"`);
        if (!animations.has(step.animation)) errors.push(`${where} passo ${i}: animação inexistente "${step.animation}"`);
        if (step.fps !== undefined && !(step.fps > 0)) errors.push(`${where} passo ${i}: fps precisa ser maior que 0`);
      }
      if (step.type === 'phone' && step.mode === 'call' && !step.caller) errors.push(`${where} passo ${i}: ligação sem caller`);
      if (step.type === 'phone' && step.mode !== 'lock' && step.mode !== 'call' && step.lines.length === 0) errors.push(`${where} passo ${i}: anúncio sem texto`);
    });
  }
  return errors;
}

/** Textos que a jogadora lê numa cena (para a checagem de notas de bastidor). */
export function cutsceneTexts(cs: CutsceneDef): string[] {
  return cs.steps.flatMap((s) =>
    s.type === 'text' || s.type === 'card' ? [s.text] : s.type === 'phone' ? [s.title, ...s.lines] : s.type === 'cat' && s.caption ? [s.caption] : [],
  );
}
