// O sistema de chegadas na sessão (como o CafeService): põe chegadas na fila, começa a da vez quando não há outro
// evento exclusivo, cria o gato (fixo ou gerado), e no fim abriga o gato conforme a vaga: no café, provisório
// (café cheio, com prazo) ou no abrigo da vila (entra na feira de adoção). As etapas de cada modelo (seguir a pista,
// mini game, escolha) vêm a partir da etapa (b); aqui ficam o ciclo e as regras de vaga e ritmo.
// Puro: sem Phaser, DOM ou window.
import { stepsOf } from './arrivalModels';
import { arrivalsToQueue, nextGap, triggerHolds, visibleTrail, type ArrivalDef, type ArrivalStep } from './arrivals';
import type { JobPoint } from './jobs';
import { generateCat } from './catGen';
import { seasonOf, weatherOf } from './calendar';
import type { Content } from './content';
import type { EventBus } from './events';
import { createRng, type Rng } from './rng';
import type { GameState } from './state';

/** Id do ponto do encontro (não é um ponto de data/jobs.json: existe só durante a chegada). */
export const meetPointId = (arrivalId: string) => `arrival:${arrivalId}`;
/** Id do destino do guia (gato_leva). */
export const destPointId = (arrivalId: string) => `arrival:${arrivalId}:dest`;

/** Onde o gato foi parar no fim da chegada. */
export type Placement = 'sheltered' | 'provisional' | 'shelter_pool' | null;

export interface ArrivalHost {
  state: GameState;
  content: Content;
  bus: EventBus;
  evaluate(condition: unknown): boolean;
  /** Gatos do café que podem guiar (gato_leva): abrigados de vez. */
  guideCats(): string[];
  /** Minuto absoluto agora (dia * 1440 + hora). */
  now(): number;
  /** Gatos que ocupam vaga no café (abrigados, inclusive os provisórios) e a capacidade dos cômodos abertos. */
  shelteredCount(): number;
  capacity(): number;
  /** Algum evento exclusivo da história em andamento (a chegada espera). */
  exclusiveActive(): boolean;
  reputation(): number;
  /** Abriga o gato no café com a condição de chegada (saúde, doença, fome). */
  shelterCat(catId: string, condition: string, provisionalUntil?: number): void;
  addMoney(delta: number, reason: string): void;
  /** Pontos de relação (corações) de `from` por `to`. */
  addPoints(from: string, to: string, delta: number): void;
}

export class ArrivalSystem {
  private rngCalls = 0;

  constructor(private h: ArrivalHost) {}

  private get st() {
    return this.h.state.arrivals;
  }
  private get data() {
    return this.h.content.arrivals;
  }
  /** Sorteio com semente do dia e de quantas vezes já sorteou (repetível nos testes). */
  private rng(): Rng {
    return createRng(this.h.state.day * 7907 + this.st.seq * 131 + this.rngCalls++);
  }

  def(id: string): ArrivalDef | undefined {
    return this.data.arrivals.find((a) => a.id === id);
  }

  /** A chegada em andamento, com a definição. */
  active(): { def: ArrivalDef; catId: string; condition: string; step: number; leaderId?: string; startedAt: number } | null {
    const a = this.st.active;
    const def = a ? this.def(a.id) : undefined;
    return a && def ? { def, catId: a.catId, condition: a.condition, step: a.step, startedAt: a.startedAt ?? this.h.now(), ...(a.leaderId ? { leaderId: a.leaderId } : {}) } : null;
  }

  /** Pegadas visíveis agora (a neve cobre com o tempo: seguir cedo é mais fácil). */
  trailNow(): [number, number][] {
    const a = this.active();
    if (!a?.def.place.trail) return [];
    return visibleTrail(a.def.place.trail, a.def.place.fadeMinutes, this.h.now() - a.startedAt);
  }

  /** O sorteio automático já vale (depois dos gatos escritos à mão)? */
  autoOn(): boolean {
    return this.data.autoStartWhen === undefined || this.h.evaluate(this.data.autoStartWhen);
  }

  /** O que os gatilhos olham agora. */
  private context() {
    const s = this.h.state;
    const seasons = this.h.content.seasons;
    return {
      day: s.day,
      time: s.time,
      season: seasonOf(seasons, s.day),
      weather: weatherOf(seasons, s.day),
      cats: this.h.shelteredCount(),
      reputation: this.h.reputation(),
      evaluate: (c: unknown) => this.h.evaluate(c),
    };
  }

  /** A cada mudança (a sessão chama junto da história): enfileira o que valer e começa a da vez. */
  tick(): void {
    const auto = this.autoOn();
    if (auto && this.st.nextOn === null) this.st.nextOn = this.h.state.day + nextGap(this.data, this.h.state.day, this.rng());
    for (const id of arrivalsToQueue(this.data, this.st, this.context(), this.rng(), auto)) {
      this.st.queue.push(id);
      this.h.bus.emit('arrival.queued', { arrivalId: id });
    }
    this.tryStart();
  }

  /** Começa a primeira da fila, se nada exclusivo está acontecendo (e, se ela adia com o café cheio, se há vaga). */
  private tryStart(): void {
    if (this.st.active || this.h.exclusiveActive()) return;
    const full = this.h.shelteredCount() >= this.h.capacity();
    // gato_leva precisa de um gato do café para guiar.
    const i = this.st.queue.findIndex((id) => {
      const def = this.def(id);
      return def && !(def.whenFull === 'postpone' && full) && !(def.model === 'gato_leva' && this.h.guideCats().length === 0);
    });
    if (i < 0) return;
    const [id] = this.st.queue.splice(i, 1);
    this.start(this.def(id!)!);
  }

  /** Cria o gato (fixo ou gerado) e marca a chegada como em andamento. */
  private start(def: ArrivalDef): void {
    const s = this.h.state;
    let catId: string;
    let condition = def.condition ?? 'healthy';
    if ('id' in def.cat) catId = def.cat.id;
    else {
      this.st.seq++;
      const gen = generateCat(this.rng(), this.h.content.catProfiles, def.cat.generate, this.st.seq);
      s.catDefs[gen.def.id] = gen.def;
      catId = gen.def.id;
      condition = def.condition ?? gen.condition;
    }
    const guides = def.model === 'gato_leva' ? this.h.guideCats() : [];
    const leaderId = guides.length > 0 ? guides[this.rng().int(0, guides.length - 1)] : undefined;
    this.st.active = { id: def.id, catId, condition, startedOn: s.day, startedAt: this.h.now(), step: 0, ...(leaderId ? { leaderId } : {}) };
    this.st.last[def.id] = s.day;
    this.h.bus.emit('arrival.started', { arrivalId: def.id, catId, model: def.model });
    this.enterStep();
  }

  // ---------- Etapas (os modelos dão as padrão: arrivalModels.ts) ----------

  /** A etapa da vez (ou null: acabaram). */
  currentStep(): ArrivalStep | null {
    const a = this.active();
    return a ? (stepsOf(a.def)[a.step] ?? null) : null;
  }

  /**
   * Entra na etapa da vez: fala segue sozinha; cena, roteiro e pergunta pedem à interface e esperam; ir até o
   * lugar, pista e cartaz esperam a protagonista. Sem mais etapas: o gato foi aceito.
   */
  private enterStep(): void {
    for (let guard = 0; guard < 100; guard++) {
      const a = this.st.active;
      if (!a) return;
      const step = this.currentStep();
      if (!step) {
        this.finish('accepted');
        return;
      }
      this.h.bus.emit('arrival.step', { arrivalId: a.id, step: a.step });
      if ('dialogue' in step) {
        this.h.bus.emit('dialogue.requested', { dialogueId: step.dialogue });
        a.step++;
        continue;
      }
      if ('cutscene' in step) this.h.bus.emit('cutscene.requested', { cutsceneId: step.cutscene });
      else if ('script' in step) this.h.bus.emit('script.requested', { scriptId: step.script });
      else if ('choice' in step) this.h.bus.emit('arrival.choice', { arrivalId: a.id, key: step.choice });
      return;
    }
  }

  /** Passa para a próxima etapa. */
  private advance(): void {
    const a = this.st.active;
    if (!a) return;
    a.step++;
    this.enterStep();
  }

  /** Pontos no mapa que esta chegada pede agora (ir até o lugar, ou a pista). */
  pendingPoints(mapId: string): JobPoint[] {
    const a = this.active();
    const step = this.currentStep();
    if (!a || !step) return [];
    if ('meet' in step && a.def.place.map === mapId && a.def.place.at) return [{ id: meetPointId(a.def.id), map: mapId, at: a.def.place.at, action: 'press' }];
    const route = a.def.place.route;
    if ('lead' in step && a.def.place.map === mapId && route && route.length > 0) return [{ id: destPointId(a.def.id), map: mapId, at: route[route.length - 1]!, action: 'press' }];
    if ('clue' in step) {
      const p = this.h.content.jobPoints[step.clue];
      return p && p.map === mapId ? [p] : [];
    }
    return [];
  }

  /** Ela apertou E num ponto: é desta chegada? (o lugar do encontro ou a pista da vez) */
  interact(pointId: string): boolean {
    const a = this.active();
    const step = this.currentStep();
    if (!a || !step) return false;
    if (('meet' in step && pointId === meetPointId(a.def.id)) || ('lead' in step && pointId === destPointId(a.def.id)) || ('clue' in step && step.clue === pointId)) {
      this.advance();
      return true;
    }
    return false;
  }

  /** Uma cena ou roteiro terminou: se era a etapa da vez, segue. */
  stepFinished(what: { cutscene?: string; script?: string }): void {
    const step = this.currentStep();
    if (!step) return;
    if (('cutscene' in step && step.cutscene === what.cutscene) || ('script' in step && step.script === what.script)) this.advance();
  }

  /** Resposta da pergunta (ou do cartaz): sim segue; não, a chegada acaba recusada. */
  answer(yes: boolean): void {
    const step = this.currentStep();
    if (!step || !('choice' in step || 'poster' in step)) return;
    if (yes) this.advance();
    else this.finish('declined');
  }

  /**
   * Fim da chegada. Aceito: o gato entra no café (se houver vaga), fica provisório ou vai para o abrigo da vila,
   * conforme whenFull; o resultado (afeto, vizinho, moedas) vale. Recusado ou não deu: o gato gerado some.
   */
  finish(outcome: 'accepted' | 'declined' | 'failed'): Placement {
    const a = this.st.active;
    const def = a ? this.def(a.id) : undefined;
    if (!a || !def) return null;
    const s = this.h.state;
    this.st.active = null;
    let placement: Placement = null;
    if (outcome === 'accepted') {
      const full = this.h.shelteredCount() >= this.h.capacity();
      if (!full) placement = 'sheltered';
      else placement = def.whenFull === 'adoption' ? 'shelter_pool' : 'provisional';
      if (placement === 'shelter_pool') this.st.shelterPool.push(a.catId);
      else this.h.shelterCat(a.catId, a.condition, placement === 'provisional' ? s.day + this.data.provisional.days : undefined);
      const r = def.result ?? {};
      if (r.startPoints) this.h.addPoints('player', a.catId, r.startPoints);
      if (r.npc) this.h.addPoints('player', r.npc.id, r.npc.points);
      if (r.money) this.h.addMoney(r.money, `arrival:${def.id}`);
    } else if (s.catDefs[a.catId] && !s.cats[a.catId]) delete s.catDefs[a.catId];
    if (def.kind === 'random') this.st.nextOn = s.day + nextGap(this.data, s.day, this.rng());
    this.h.bus.emit('arrival.finished', { arrivalId: def.id, catId: a.catId, outcome, placement });
    this.tryStart();
    return placement;
  }

  /**
   * Virada do dia: provisório vira de casa quando abre vaga; o prazo vencido sem vaga leva o gato para o abrigo da
   * vila (entra na próxima feira de adoção).
   */
  dayEnded(newDay: number): void {
    const s = this.h.state;
    const provisional = Object.entries(s.cats).filter(([, c]) => c.sheltered && c.provisionalUntil !== undefined);
    for (const [id, cat] of provisional) {
      const permanent = Object.values(s.cats).filter((c) => c.sheltered && c.provisionalUntil === undefined).length;
      if (permanent < this.h.capacity()) {
        delete cat.provisionalUntil;
        this.h.bus.emit('arrival.provisional_settled', { catId: id });
      } else if (newDay > cat.provisionalUntil!) {
        cat.sheltered = false;
        delete cat.provisionalUntil;
        this.st.shelterPool.push(id);
        this.h.bus.emit('arrival.provisional_expired', { catId: id });
      }
    }
  }

  /** Debug e testes: põe uma chegada na fila agora (ignora o gatilho, respeita a vez). */
  queueNow(arrivalId: string): boolean {
    const def = this.def(arrivalId);
    if (!def || this.st.queue.includes(arrivalId) || this.st.active?.id === arrivalId) return false;
    this.st.queue.push(arrivalId);
    this.tryStart();
    return true;
  }

  /** O gatilho desta chegada vale agora? (debug) */
  triggerNow(arrivalId: string): boolean {
    const def = this.def(arrivalId);
    return !!def && triggerHolds(def.trigger, this.context());
  }
}
