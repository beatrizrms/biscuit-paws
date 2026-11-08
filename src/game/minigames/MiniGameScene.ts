// Base de todo mini game: instruções (introMs) -> jogando -> resultado, com cronômetro, Esc para pausar e
// "Pular" (recompensa reduzida). Cada jogo só monta o mundo (buildGame), joga (updateGame) e chama finish().
// A interface (instruções, cronômetro, pausa, resultado) é HTML por cima do canvas, com a mesma moldura dos menus,
// para não depender do zoom da câmera (decisão 052) e ficar nítida em qualquer escala.
import Phaser from 'phaser';
import { Countdown, makeResult, type MiniGameParams, type MiniGameResult, type Outcome } from '../../core/minigame';
import { createRng, type Rng } from '../../core/rng';
import { content, uiText } from '../content';
import { setupCamera } from '../screen';
import { MiniGameControls } from './controls';

/** O que a cena recebe de quem abriu (o registro monta). */
export interface MiniGameLaunch {
  params: MiniGameParams;
  /** Estação do mundo agora (a arena segue a estação). */
  season: string;
  /** Variante do Cosy Cats do gato envolvido (o que foge, o que pesca junto...). */
  catVariant: string;
  /** Semente do sorteio (aleatoriedade repetível, regra 7). */
  seed: number;
  done: (result: MiniGameResult) => void;
}

type Phase = 'intro' | 'playing' | 'paused' | 'result';

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

export abstract class MiniGameScene extends Phaser.Scene {
  protected launch!: MiniGameLaunch;
  protected controls!: MiniGameControls;
  protected rng!: Rng;
  protected timer: Countdown | null = null;
  protected phase: Phase = 'intro';
  private layer: HTMLElement | null = null;
  private hud: HTMLElement | null = null;
  private result: MiniGameResult | null = null;

  constructor(
    readonly gameId: string,
    sceneKey: string,
  ) {
    super(sceneKey);
  }

  init(data: MiniGameLaunch): void {
    this.launch = data;
    this.phase = 'intro';
    this.timer = null;
    this.result = null;
    this.rng = createRng(data.seed);
  }

  create(): void {
    setupCamera(this);
    this.controls = new MiniGameControls(this);
    this.controls.onPause(() => this.togglePause());
    this.buildLayer();
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.removeLayer());
    this.buildGame();
    this.showIntro();
  }

  update(_time: number, delta: number): void {
    if (this.phase !== 'playing') return;
    this.timer?.tick(delta);
    if (this.phase !== 'playing') return; // o fim do tempo pode ter acabado o jogo
    this.updateGame(delta);
    this.renderHud();
  }

  // ---------- O que cada jogo faz ----------

  /** Monta o mundo do jogo (antes das instruções). */
  protected abstract buildGame(): void;
  /** Começou a valer: crie o cronômetro aqui (startTimer). */
  protected abstract startGame(): void;
  /** A cada quadro, só enquanto joga. */
  protected abstract updateGame(deltaMs: number): void;

  /** Definição do jogo em data/minigames.json. */
  protected get def() {
    return content.minigames.games[this.gameId]!;
  }

  protected startTimer(seconds: number, onEnd: () => void): void {
    this.timer = new Countdown(seconds * 1000, onEnd);
  }

  /** Acabou: mostra o resultado (as moedas vêm do núcleo, pelos dados). */
  protected finish(outcome: Outcome, score: number, skipped = false): void {
    if (this.phase === 'result') return;
    this.timer?.stop();
    this.physics.pause();
    this.result = makeResult(content.minigames, this.gameId, this.launch.params.difficulty, outcome, score, skipped);
    this.phase = 'result';
    this.showResult(this.result);
  }

  // ---------- Fases ----------

  private showIntro(): void {
    const t = uiText.minigames;
    this.physics.pause();
    this.overlay(`<h2>${esc(this.def.name)}</h2><p>${esc(this.def.instructions)}</p>
      <p class="mg-difficulty">${esc(t.difficulty[this.launch.params.difficulty])}</p>
      <button class="menu-btn" data-act="start">${t.start}</button>`);
    // Instruções por introMs e começa sozinho; ou antes, pelo botão / E / Espaço.
    this.time.delayedCall(content.minigames.introMs, () => this.begin());
    this.controls.onAction(() => this.phase === 'intro' && this.begin());
  }

  private begin(): void {
    if (this.phase !== 'intro') return;
    this.overlay(null);
    this.phase = 'playing';
    this.physics.resume();
    this.startGame();
    this.renderHud();
  }

  private togglePause(): void {
    const t = uiText.minigames;
    if (this.phase === 'playing') {
      this.phase = 'paused';
      this.timer?.pause();
      this.physics.pause();
      this.anims.pauseAll();
      this.overlay(`<h2>${t.paused}</h2><p>${t.pausedHint}</p>
        <button class="menu-btn" data-act="resume">${t.resume}</button>
        <button class="menu-btn" data-act="skip">${this.skipLabel()}</button>`);
    } else if (this.phase === 'paused') {
      this.overlay(null);
      this.timer?.resume();
      this.physics.resume();
      this.anims.resumeAll();
      this.phase = 'playing';
    }
  }

  private skipLabel(): string {
    const coins = makeResult(content.minigames, this.gameId, this.launch.params.difficulty, 'ok', 0, true).coinsEarned;
    return uiText.minigames.skip.replace('{coins}', String(coins));
  }

  private showResult(r: MiniGameResult): void {
    const t = uiText.minigames;
    const title = r.skipped ? t.skipped : t.outcome[r.outcome];
    const coins = r.coinsEarned > 0 ? t.coins.replace('{coins}', String(r.coinsEarned)) : t.noCoins;
    this.renderHud();
    this.overlay(`<h2 class="mg-${r.outcome}">${esc(title)}</h2><p>${esc(this.resultText(r))}</p><p class="mg-coins">${esc(coins)}</p>
      <button class="menu-btn" data-act="close">${t.continue}</button>`);
    this.controls.onAction(() => this.phase === 'result' && this.close());
  }

  /** Frase do resultado (cada jogo pode dizer o que quiser: "Sobraram 20 s", "Pescou um salmão"...). */
  protected resultText(_r: MiniGameResult): string {
    return '';
  }

  private close(): void {
    if (!this.result) return;
    const r = this.result;
    this.result = null;
    this.launch.done(r);
  }

  // ---------- Interface (HTML por cima do canvas) ----------

  private buildLayer(): void {
    const root = document.getElementById('ui')!;
    root.classList.add('minigame-on');
    this.layer = document.createElement('div');
    this.layer.className = 'minigame-layer';
    this.layer.innerHTML = `<div class="mg-hud"><span class="mg-name">${esc(this.def.name)}</span><span class="mg-time"></span>
      <button class="menu-btn mg-skip" data-act="skip">${this.skipLabel()}</button></div><div class="mg-overlay"></div>`;
    root.appendChild(this.layer);
    this.hud = this.layer.querySelector('.mg-time');
    this.layer.addEventListener('click', (e) => {
      const act = (e.target as HTMLElement).closest<HTMLElement>('[data-act]')?.dataset.act;
      if (act === 'start') this.begin();
      else if (act === 'resume') this.togglePause();
      else if (act === 'skip' && this.phase !== 'result') this.finish('ok', 0, true);
      else if (act === 'close') this.close();
    });
  }

  private overlay(html: string | null): void {
    const o = this.layer?.querySelector<HTMLElement>('.mg-overlay');
    if (!o) return;
    o.innerHTML = html ? `<div class="panel mg-panel">${html}</div>` : '';
    o.classList.toggle('open', !!html);
    this.layer!.querySelector<HTMLElement>('.mg-skip')!.hidden = this.phase === 'result';
  }

  private renderHud(): void {
    if (!this.hud) return;
    const s = this.timer ? Math.ceil(this.timer.remainingMs() / 1000) : 0;
    this.hud.textContent = this.timer ? `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}` : '';
    this.hud.classList.toggle('low', !!this.timer && this.timer.remainingShare() < 0.2);
  }

  private removeLayer(): void {
    this.layer?.remove();
    this.layer = null;
    document.getElementById('ui')?.classList.remove('minigame-on');
  }
}
