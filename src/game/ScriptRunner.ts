// Executa os roteiros (data/scripts.json) passo a passo. Cada passo espera o anterior terminar
// (o NPC chegar, a fala fechar, a jogadora fechar a chave...). No fim, avisa a sessão.
import type { Cell, Facing } from '../core/map';
import type { ScriptStep } from '../core/script';
import type { GameSession } from '../core/session';

/** O que o roteiro precisa da cena (a WorldScene implementa). */
export interface ScriptStage {
  spawnNpc(npcId: string, at: Cell, facing?: Facing): void;
  npcWalk(npcId: string, to: Cell): Promise<void>;
  npcAct(npcId: string, anim: string, ms: number): Promise<void>;
  npcFace(npcId: string, facing: Facing): void;
  npcLeave(npcId: string): Promise<void>;
  playerWalk(to: Cell): Promise<void>;
  playerFace(facing: Facing): void;
  /** Muda de mapa com fade, levando a jogadora e os NPCs listados. */
  enter(mapId: string, spawn: Cell, facing: Facing, npcs: { npc: string; at: Cell; facing?: Facing }[]): Promise<void>;
  showItem(itemId: string): Promise<void>;
  /** Resolve quando nenhuma fala/cena/caixa estiver aberta. */
  untilIdle(): Promise<void>;
  wait(ms: number): Promise<void>;
}

export class ScriptRunner {
  private queue: string[] = [];
  private running = false;

  constructor(
    private session: GameSession,
    private stage: ScriptStage,
  ) {
    session.bus.on('script.requested', ({ scriptId }) => {
      this.queue.push(scriptId);
      void this.next();
    });
  }

  isRunning(): boolean {
    return this.running;
  }

  private async next(): Promise<void> {
    if (this.running) return;
    const id = this.queue.shift();
    if (!id) return;
    this.running = true;
    await this.stage.untilIdle(); // espera a fala que pediu o roteiro acabar
    for (const step of this.session.content.scripts[id]?.steps ?? []) await this.run(step);
    this.running = false;
    this.session.finishScript(id);
    void this.next();
  }

  private async run(step: ScriptStep): Promise<void> {
    const s = this.stage;
    if ('npcSpawn' in step) {
      if (step.map === this.session.location()) s.spawnNpc(step.npcSpawn, step.at, step.facing);
    } else if ('npcWalk' in step) await s.npcWalk(step.npcWalk, step.to);
    else if ('npcAnim' in step) await s.npcAct(step.npcAnim, step.anim, step.ms);
    else if ('npcFace' in step) s.npcFace(step.npcFace, step.facing);
    else if ('npcLeave' in step) await s.npcLeave(step.npcLeave);
    else if ('playerWalk' in step) await s.playerWalk(step.playerWalk);
    else if ('playerFace' in step) s.playerFace(step.playerFace);
    else if ('dialogue' in step) {
      this.session.say(step.dialogue);
      await s.untilIdle();
    } else if ('enter' in step) await s.enter(step.enter, step.spawn, step.facing ?? 'down', step.npcs ?? []);
    else if ('showItem' in step) await s.showItem(step.showItem);
    else if ('giveItem' in step) this.session.receiveItem(step.giveItem);
    else if ('wait' in step) await s.wait(step.wait);
  }
}
