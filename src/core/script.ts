// Roteiros no mundo (data/scripts.json): personagens andam, acenam, falam, entram em lugares.
// Só dados e validação: quem executa é o jogo (ScriptRunner), que avisa a sessão no fim.
// Puro: sem Phaser, DOM ou window.
import type { Condition } from './content';
import type { Cell, Facing } from './map';

/** Qualquer passo pode ter `when` (condição da história): sem ela valer na hora, o passo é pulado. */
export type ScriptStep = ScriptAction & { when?: Condition };

type ScriptAction =
  | { npcSpawn: string; map: string; at: Cell; facing?: Facing }
  | { npcWalk: string; to: Cell }
  | { npcAnim: string; anim: string; ms: number }
  | { npcFace: string; facing: Facing }
  | { npcLeave: string }
  | { playerWalk: Cell }
  | { playerFace: Facing }
  | { dialogue: string }
  /** Muda de mapa com fade, levando a personagem (e os NPCs listados) para dentro. */
  | { enter: string; spawn: Cell; facing?: Facing; npcs?: { npc: string; at: Cell; facing?: Facing }[]; ifAway?: boolean }
  /** Mostra um item grande no centro da tela (ex.: a chave). */
  | { showItem: string }
  | { giveItem: string }
  | { wait: number }
  /** O NPC vai até o lado do gato (o gato fica sentado esperando). Ex.: o Joca fareja o gatinho. */
  | { npcToCat: string; cat: string }
  /** O gato vem até a célula e senta (espera chegar, no máximo alguns segundos). */
  | { catWalk: string; to: Cell }
  /** Balão de emoção em cima de alguém: "player", um NPC ou um gato. */
  | { emote: string; balloon: string; ms?: number }
  /** O cômodo aparece (a porta escondida surge, com o momento da descoberta). Ex.: o Tião acha a porta do quintal. */
  | { discoverRoom: string }
  /** Abre a porta de um cômodo com o item que ela pede (ex.: a chave enferrujada no cadeado do quintal). */
  | { openDoor: string }
  /**
   * Amigo secreto (data/festive.json): "give" = o roteiro para e ela vai entregar o presente (E em quem tirou);
   * "reaction" = a fala de quem recebeu; "receive" = ela ganha o presente de quem a tirou (mostrado grande).
   */
  | { secretSanta: 'give' | 'reaction' | 'receive' }
  /** Acerta o relógio ("HH:MM"; ex.: a ceia foi até tarde). Só para a frente: hora já passada não volta. */
  | { setTime: string }
  /** Fogos de artifício no céu por tantos ms (não espera: os passos seguintes rodam com os fogos estourando). */
  | { fireworks: number };

export interface ScriptsData {
  schemaVersion: 1;
  scripts: Record<string, { steps: ScriptStep[] }>;
}

export interface NpcDef {
  id: string;
  name: string;
  sheet: string;
  portrait?: string;
  frameWidth: number;
  frameHeight: number;
  columns: number;
  fps: number;
  /** Linha da folha para cada direção de caminhada (4 quadros cada). */
  walk: Record<Facing, number>;
  /** Animações extras: nome -> índices de quadro. */
  extras: Record<string, number[]>;
  /** Quadros por segundo das animações extras (padrão 3). */
  extrasFps?: number;
  /** Sentado (clientes na mesa): linha da folha para cada direção, `sitFrames` quadros cada (padrão 3). */
  sit?: Record<Facing, number>;
  sitFrames?: number;
  /** Pixels da folha por pixel do jogo (2 = arte em 64 px por tile, desenhada na metade). Sem isso, 1. */
  resolution?: number;
  /** Arte provisória (folha emprestada); entra na lista de arte pendente. */
  placeholder?: boolean;
}

export interface NpcsData {
  schemaVersion: 1;
  npcs: NpcDef[];
}

export interface ScriptRefs {
  npcs: ReadonlySet<string>;
  maps: ReadonlySet<string>;
  dialogues: ReadonlySet<string>;
  items: ReadonlySet<string>;
  cats: ReadonlySet<string>;
  balloons: ReadonlySet<string>;
  npcAnims: (npcId: string) => ReadonlySet<string>;
  rooms: ReadonlySet<string>;
  doors: ReadonlySet<string>;
}

export function validateScripts(data: ScriptsData, refs: ScriptRefs): string[] {
  const errors: string[] = [];
  for (const [id, script] of Object.entries(data.scripts)) {
    const where = (i: number) => `roteiro "${id}" passo ${i}`;
    if (!id.startsWith('scr.')) errors.push(`roteiro "${id}": id deve começar com "scr."`);
    script.steps.forEach((step, i) => {
      const npc = (npcId: string) => {
        if (!refs.npcs.has(npcId)) errors.push(`${where(i)}: NPC inexistente "${npcId}"`);
      };
      if ('npcSpawn' in step) {
        npc(step.npcSpawn);
        if (!refs.maps.has(step.map)) errors.push(`${where(i)}: mapa inexistente "${step.map}"`);
      } else if ('npcWalk' in step) npc(step.npcWalk);
      else if ('npcFace' in step) npc(step.npcFace);
      else if ('npcLeave' in step) npc(step.npcLeave);
      else if ('npcAnim' in step) {
        npc(step.npcAnim);
        if (refs.npcs.has(step.npcAnim) && !refs.npcAnims(step.npcAnim).has(step.anim)) {
          errors.push(`${where(i)}: animação "${step.anim}" não existe para "${step.npcAnim}"`);
        }
      } else if ('dialogue' in step) {
        if (!refs.dialogues.has(step.dialogue)) errors.push(`${where(i)}: fala inexistente "${step.dialogue}"`);
      } else if ('enter' in step) {
        if (!refs.maps.has(step.enter)) errors.push(`${where(i)}: mapa inexistente "${step.enter}"`);
        step.npcs?.forEach((n) => npc(n.npc));
      } else if ('npcToCat' in step) {
        npc(step.npcToCat);
        if (!refs.cats.has(step.cat)) errors.push(`${where(i)}: gato inexistente "${step.cat}"`);
      } else if ('catWalk' in step) {
        if (!refs.cats.has(step.catWalk)) errors.push(`${where(i)}: gato inexistente "${step.catWalk}"`);
      } else if ('emote' in step) {
        if (step.emote !== 'player' && !refs.npcs.has(step.emote) && !refs.cats.has(step.emote)) errors.push(`${where(i)}: ninguém chamado "${step.emote}"`);
        if (!refs.balloons.has(step.balloon)) errors.push(`${where(i)}: balão inexistente "${step.balloon}"`);
      } else if ('discoverRoom' in step) {
        if (!refs.rooms.has(step.discoverRoom)) errors.push(`${where(i)}: cômodo inexistente "${step.discoverRoom}"`);
      } else if ('fireworks' in step) {
        if (!(step.fireworks > 0)) errors.push(`${where(i)}: fireworks precisa de uma duração (ms)`);
      } else if ('setTime' in step) {
        if (!/^\d{1,2}:\d{2}$/.test(step.setTime)) errors.push(`${where(i)}: hora inválida "${step.setTime}"`);
      } else if ('secretSanta' in step) {
        if (!['give', 'reaction', 'receive'].includes(step.secretSanta)) errors.push(`${where(i)}: secretSanta inválido "${String(step.secretSanta)}"`);
      } else if ('openDoor' in step) {
        if (!refs.doors.has(step.openDoor)) errors.push(`${where(i)}: porta inexistente "${step.openDoor}"`);
      } else if ('showItem' in step || 'giveItem' in step) {
        const item = 'showItem' in step ? step.showItem : step.giveItem;
        if (!refs.items.has(item)) errors.push(`${where(i)}: item inexistente "${item}"`);
      }
    });
  }
  return errors;
}
