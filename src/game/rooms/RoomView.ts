// Cômodos na tela (só no mapa do café): escuro nos cômodos ocultos e meio escuro nos descobertos
// e ainda fechados, destaque pulsando na porta/chave do momento de descoberta, os limites da câmera
// (só o que ela já conhece) e as áreas ao ar livre (luz de fora). As regras moram em src/core/rooms.ts.
import Phaser from 'phaser';
import { isOpen, roomAt, visibleArea } from '../../core/rooms';
import type { Cell } from '../../core/map';
import type { GameSession } from '../../core/session';

const FOG_DEPTH = 140_000;
const HIGHLIGHT_DEPTH = 140_001;
/** Escuro de cômodo oculto e de cômodo descoberto (dá para ver pela fresta). */
const FOG_ALPHA = { locked: 1, discovered: 0.8 } as const;
const FOG_COLOR = 0x140e0b;

export interface PixelRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export class RoomView {
  private fog: Phaser.GameObjects.Rectangle[] = [];
  /** O escuro em volta de um lugar à parte (o quintal), para a sobra da tela não mostrar o vizinho do mapa. */
  private isolation: Phaser.GameObjects.Rectangle[] = [];

  constructor(
    private scene: Phaser.Scene,
    private session: GameSession,
    private tileSize: number,
  ) {}

  private rectOf(from: readonly [number, number], to: readonly [number, number]): PixelRect {
    const ts = this.tileSize;
    return { x: from[0] * ts, y: from[1] * ts, w: (to[0] - from[0] + 1) * ts, h: (to[1] - from[1] + 1) * ts };
  }

  /** Redesenha o escuro (chamar depois de reconstruir o mapa do café). `home`: está no café. */
  refresh(home: boolean): void {
    this.fog.forEach((f) => f.destroy());
    this.fog = [];
    if (!home) return;
    for (const room of this.session.rooms()) {
      const s = this.session.roomState(room.id);
      if (s !== 'locked' && s !== 'discovered') continue;
      // Cobre o cômodo e a parede do lado (a passagem ainda fechada fica visível no meio-escuro).
      const r = this.rectOf([room.area.from[0], room.area.from[1]], [room.area.to[0], room.area.to[1]]);
      this.fog.push(this.scene.add.rectangle(r.x, r.y, r.w, r.h, FOG_COLOR, FOG_ALPHA[s]).setOrigin(0).setDepth(FOG_DEPTH));
    }
  }

  /** Até onde a câmera vai (pixels): os cômodos que ela já conhece. */
  cameraArea(at?: Cell): PixelRect | null {
    const rooms = this.session.content.rooms;
    // Num lugar à parte (o quintal): só ele. No café: os cômodos vizinhos abertos, sem os lugares à parte.
    const here = at ? roomAt(rooms, at) : undefined;
    if (here?.separateView) return this.rectOf(here.area.from, here.area.to);
    const a = visibleArea({ ...rooms, rooms: rooms.rooms.filter((r) => !r.separateView) }, this.session.state);
    return a ? this.rectOf(a.from, a.to) : null;
  }

  /**
   * Num lugar à parte (o quintal, mais estreito que a tela): escurece tudo em volta dele, com a cor do fundo do mapa,
   * para a sobra da tela não mostrar a parede e o porão do lado no mapa. null: tira.
   */
  isolate(rect: PixelRect | null, color: number): void {
    this.isolation.forEach((r) => r.destroy());
    this.isolation = [];
    if (!rect) return;
    const far = 4000;
    const parts: [number, number, number, number][] = [
      [rect.x - far, rect.y - far, far, rect.h + 2 * far],
      [rect.x + rect.w, rect.y - far, far, rect.h + 2 * far],
      [rect.x, rect.y - far, rect.w, far],
      [rect.x, rect.y + rect.h, rect.w, far],
    ];
    this.isolation = parts.map(([x, y, w, h]) => this.scene.add.rectangle(x, y, w, h, color, 1).setOrigin(0).setDepth(FOG_DEPTH));
  }

  /** O lugar à parte em que ela está (o quintal), ou null. */
  separateArea(at: Cell): PixelRect | null {
    const here = roomAt(this.session.content.rooms, at);
    return here?.separateView ? this.rectOf(here.area.from, here.area.to) : null;
  }

  /** Áreas ao ar livre abertas (o quintal): recebem a luz de fora. */
  outdoorAreas(): PixelRect[] {
    return this.session
      .rooms()
      .filter((r) => r.outdoor && isOpen(this.session.roomState(r.id)))
      .map((r) => this.rectOf(r.area.from, r.area.to));
  }

  /** Destaque pulsando numa célula (a porta ou a chave do momento), por `ms`. */
  highlight(cell: readonly [number, number], ms = 2600): void {
    const ts = this.tileSize;
    const box = this.scene.add
      .rectangle(cell[0] * ts + ts / 2, cell[1] * ts + ts / 2, ts + 6, ts + 6)
      .setStrokeStyle(3, 0xffe2a0, 1)
      .setDepth(HIGHLIGHT_DEPTH);
    const glow = this.scene.add
      .rectangle(cell[0] * ts + ts / 2, cell[1] * ts + ts / 2, ts, ts, 0xffe2a0, 0.35)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(HIGHLIGHT_DEPTH);
    this.scene.tweens.add({ targets: [box, glow], alpha: 0.25, duration: 420, yoyo: true, repeat: Math.max(0, Math.round(ms / 840) - 1) });
    this.scene.time.delayedCall(ms, () => {
      box.destroy();
      glow.destroy();
    });
  }
}
