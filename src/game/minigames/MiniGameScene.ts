// Base de todo mini game: instruções (introMs) -> jogando -> resultado, com cronômetro, Esc para pausar e
// "Pular" (recompensa reduzida). Cada jogo só monta o mundo (buildGame), joga (updateGame) e chama finish().
// A interface (instruções, cronômetro, pausa, resultado) é HTML por cima do canvas, com a mesma moldura dos menus,
// para não depender do zoom da câmera (decisão 052) e ficar nítida em qualquer escala.
import Phaser from 'phaser';
import { Countdown, makeResult, type MiniGameParams, type MiniGameResult, type Outcome } from '../../core/minigame';
import { createRng, type Rng } from '../../core/rng';
import { frameOf } from '../../core/tiles';
import { content, uiText } from '../content';
import { GAME_HEIGHT, GAME_WIDTH, setupCamera } from '../screen';
import { addTileImage } from '../tileArt';
import { iconHtml } from '../ui/ShopPanel';
import { MiniGameControls } from './controls';
import { keyless, touch } from '../touch';

/** O que a cena recebe de quem abriu (o registro monta). */
export interface MiniGameLaunch {
  params: MiniGameParams;
  /** Estação do mundo agora (a arena segue a estação). */
  season: string;
  /** Variante do gato envolvido (o que foge, o que pesca junto...). */
  catVariant: string;
  /** Remédio escondido: quanto dura a distração do gato pelo jeito dele (1 = normal). */
  pillWindow?: number;
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
    // Zoom do motor (decisão 052) a partir do centro: centrar na área lógica 640 x 360. Quem segue alguém
    // (a fuga) troca isso no buildGame.
    setupCamera(this).centerOn(GAME_WIDTH / 2, GAME_HEIGHT / 2);
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

  /** Fundo com os tiles do mundo (data/minigames.json: backdrop), atrás de tudo. Sem backdrop, fica a cor da câmera. */
  protected drawBackdrop(): void {
    const b = this.def.backdrop;
    if (!b) return;
    const cat = content.catalog;
    const ts = cat.tileSize;
    // Close (floorScale): os tiles ampliados, do mesmo tamanho do gato grande e do tapete.
    const fk = b.floorScale ?? 1;
    const step = ts * fk;
    for (let r = 0; r * step < GAME_HEIGHT; r++) {
      for (let c = 0; c * step < GAME_WIDTH; c++) {
        const t = cat.tiles[b.floor[r % b.floor.length]!]!;
        const img = addTileImage(this, c * step, r * step, t.sheet, frameOf(cat, t)).setDepth(-1000);
        img.setScale(img.scaleX * fk);
      }
    }
    const rug = b.rug ? cat.tiles[b.rug] : undefined;
    if (!rug) return;
    const [cx, cy] = b.rugAt ?? [GAME_WIDTH / 2, GAME_HEIGHT / 2];
    const k = b.rugScale ?? 1;
    const left = Math.round(cx - (rug.w * ts * k) / 2);
    const top = Math.round(cy - (rug.h * ts * k) / 2);
    for (let dy = 0; dy < rug.h; dy++) {
      for (let dx = 0; dx < rug.w; dx++) {
        const img = addTileImage(this, left + dx * ts * k, top + dy * ts * k, rug.sheet, frameOf(cat, rug, dx, dy)).setDepth(-999);
        img.setScale(img.scaleX * k);
      }
    }
  }

  /** Definição do jogo em data/minigames.json. */
  protected get def() {
    return content.minigames.games[this.gameId]!;
  }

  /** Cronômetro opcional: sem `seconds` (dificuldade sem timeSec, ex.: a confiança do gato), o jogo não tem tempo. */
  protected startTimer(seconds: number | undefined, onEnd: () => void): void {
    this.timer = seconds ? new Countdown(seconds * 1000, onEnd) : null;
  }

  /** Acabou: mostra o resultado (as moedas vêm do núcleo, pelos dados). */
  protected finish(outcome: Outcome, score: number, skipped = false, extra: Parameters<typeof makeResult>[6] = {}): void {
    if (this.phase === 'result') return;
    this.timer?.stop();
    this.physics.pause();
    this.result = makeResult(content.minigames, this.gameId, this.launch.params.difficulty, outcome, score, skipped, extra);
    this.phase = 'result';
    this.showResult(this.result);
  }

  // ---------- Fases ----------

  private showIntro(): void {
    const t = uiText.minigames;
    this.physics.pause();
    this.overlay(`<h2>${esc(this.def.name)}</h2>${this.tutorialHtml()}
      <p class="mg-difficulty">${esc(t.difficulty[this.launch.params.difficulty])}</p>
      <button class="menu-btn" data-act="start">${t.start}</button>`);
    // Começa pelo botão / E / Espaço. Com introMs > 0, começa sozinho depois desse tempo; 0 espera a jogadora ler.
    if (content.minigames.introMs > 0) this.time.delayedCall(content.minigames.introMs, () => this.begin());
    this.controls.onAction(() => this.phase === 'intro' && this.begin());
  }

  /** Tutorial da intro (data/minigames.json: tutorial): ícone e 1 a 3 linhas; sem ele, o texto de instruções. */
  private tutorialHtml(): string {
    const tut = this.def.tutorial;
    if (!tut) return `<p>${esc(this.def.instructions)}</p>`;
    // No celular, as linhas do toque (touchLines), quando o jogo tem.
    const lines = touch.mode === 'touch' && tut.touchLines ? tut.touchLines : tut.lines;
    return `<div class="mg-tutorial">${tut.icon ? `<span class="mg-tut-icon">${iconHtml(tut.icon, 32)}</span>` : ''}<ol>${lines.map((l) => `<li>${esc(l)}</li>`).join('')}</ol></div>`;
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
    this.overlay(`<h2 class="mg-${r.outcome}">${esc(title)}</h2>${this.resultHtml(r) ?? `<p>${esc(this.resultText(r))}</p>`}<p class="mg-coins">${esc(coins)}</p>
      <button class="menu-btn" data-act="close">${t.continue}</button>`);
    this.controls.onAction(() => this.phase === 'result' && this.close());
  }

  /** Frase do resultado (cada jogo pode dizer o que quiser: "Sobraram 20 s", "Pescou um salmão"...). */
  protected resultText(_r: MiniGameResult): string {
    return '';
  }

  /** Resultado montado em HTML (já escapado), no lugar da frase, para quem precisa de mais que texto (o match de adoção). */
  protected resultHtml(_r: MiniGameResult): string | null {
    return null;
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
    this.layer.innerHTML = `<div class="mg-hud"><span class="mg-name">${esc(this.def.name)}</span><span class="mg-info"></span><span class="mg-time"></span>
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

  /** Linha de informação no topo, ao lado do nome (tentativas, filhotes achados, qualidade...). */
  protected setHudInfo(text: string): void {
    const el = this.layer?.querySelector<HTMLElement>('.mg-info');
    if (el && el.textContent !== text) el.textContent = text;
  }

  /** Botão extra no topo (ex.: "Servir" da latte art), ao lado do Pular. Some na tela de resultado. */
  protected hudButton(label: string, onClick: () => void): HTMLButtonElement {
    const b = document.createElement('button');
    b.className = 'menu-btn mg-skip mg-extra';
    b.textContent = keyless(label);
    b.addEventListener('click', (e) => {
      e.stopPropagation();
      if (this.phase === 'playing') onClick();
    });
    this.layer?.querySelector('.mg-hud')?.insertBefore(b, this.layer.querySelector('.mg-skip'));
    return b;
  }

  private overlay(html: string | null): void {
    const o = this.layer?.querySelector<HTMLElement>('.mg-overlay');
    if (!o) return;
    o.innerHTML = html ? `<div class="panel mg-panel" data-game="${this.gameId}">${keyless(html)}</div>` : '';
    o.classList.toggle('open', !!html);
    this.layer!.querySelectorAll<HTMLElement>('.mg-skip').forEach((b) => (b.hidden = this.phase === 'result'));
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
