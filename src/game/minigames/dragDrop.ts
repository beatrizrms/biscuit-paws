// Arrastar e soltar reutilizável dos mini games (o Match de adoção usa): itens arrastáveis e áreas de soltar.
// O helper só cuida da mecânica e dos estados; a cena desenha (callbacks) e decide o que o soltar significa.
// Estados da área durante o arraste: 'idle' (nada em cima), 'valid' (dá para soltar aqui), 'invalid' (não aceita).
// Soltar fora de uma área, ou numa que não aceita, devolve o item para onde ele estava (tween curto).
import Phaser from 'phaser';

export type ZoneState = 'idle' | 'valid' | 'invalid';
export type ItemState = 'idle' | 'hover' | 'dragging';

type Draggable = Phaser.GameObjects.GameObject & Phaser.GameObjects.Components.Transform & Phaser.GameObjects.Components.Depth;

export interface DropZoneSpec {
  id: string;
  /** Área em coordenadas do mundo (o centro do item precisa cair dentro). */
  rect: Phaser.Geom.Rectangle;
  /** Aceita este item? (sem função: aceita qualquer um) */
  accepts?: (itemId: string) => boolean;
}

export interface DragDropOptions {
  /** Soltou numa área que aceita: a cena decide onde o item fica (ex.: encaixa no lugar da família). */
  onDrop(itemId: string, zoneId: string): void;
  onZoneState?(zoneId: string, state: ZoneState): void;
  onItemState?(itemId: string, state: ItemState): void;
  /** Duração da volta para casa (ms). */
  returnMs?: number;
}

/** Profundidade do item enquanto arrasta (por cima de tudo da cena). */
const DRAG_DEPTH = 9_000;

export class DragDrop {
  private items = new Map<string, { obj: Draggable; home: { x: number; y: number }; depth: number }>();
  private zones: DropZoneSpec[] = [];
  private zoneStates = new Map<string, ZoneState>();
  private enabled = true;

  constructor(
    private scene: Phaser.Scene,
    private opts: DragDropOptions,
  ) {
    const input = scene.input;
    input.on('dragstart', (_p: Phaser.Input.Pointer, obj: Draggable) => {
      const it = this.entry(obj);
      if (!it || !this.enabled) return;
      obj.setDepth(DRAG_DEPTH);
      this.opts.onItemState?.(it.id, 'dragging');
    });
    // dragX/dragY já vêm no espaço do mundo (o Phaser desfaz o zoom da câmera).
    input.on('drag', (_p: Phaser.Input.Pointer, obj: Draggable, x: number, y: number) => {
      const it = this.entry(obj);
      if (!it || !this.enabled) return;
      obj.setPosition(x, y);
      this.refreshZones(it.id, x, y);
    });
    input.on('dragend', (_p: Phaser.Input.Pointer, obj: Draggable) => {
      const it = this.entry(obj);
      if (!it) return;
      const zone = this.zoneAt(obj.x, obj.y);
      this.clearZones();
      obj.setDepth(it.depth);
      this.opts.onItemState?.(it.id, 'idle');
      if (this.enabled && zone && (zone.accepts?.(it.id) ?? true)) this.opts.onDrop(it.id, zone.id);
      else this.sendHome(it.id);
    });
    input.on('gameobjectover', (_p: Phaser.Input.Pointer, obj: Draggable) => {
      const it = this.entry(obj);
      if (it && this.enabled) this.opts.onItemState?.(it.id, 'hover');
    });
    input.on('gameobjectout', (_p: Phaser.Input.Pointer, obj: Draggable) => {
      const it = this.entry(obj);
      if (it && this.enabled && obj.depth !== DRAG_DEPTH) this.opts.onItemState?.(it.id, 'idle');
    });
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      for (const ev of ['dragstart', 'drag', 'dragend', 'gameobjectover', 'gameobjectout']) input.off(ev);
    });
  }

  /** Torna o objeto arrastável; a posição atual vira a "casa" para onde ele volta. */
  addItem(id: string, obj: Draggable): void {
    if (!obj.input) (obj as unknown as Phaser.GameObjects.Image).setInteractive({ useHandCursor: true });
    this.scene.input.setDraggable(obj, true);
    this.items.set(id, { obj, home: { x: obj.x, y: obj.y }, depth: obj.depth });
  }

  addZone(zone: DropZoneSpec): void {
    this.zones.push(zone);
    this.zoneStates.set(zone.id, 'idle');
  }

  /** Nova casa do item (ex.: encaixou na família; um arraste depois volta para cá se for inválido). */
  setHome(id: string, x: number, y: number): void {
    const it = this.items.get(id);
    if (it) it.home = { x, y };
  }

  /** Volta o item para a casa (com tween). */
  sendHome(id: string): void {
    const it = this.items.get(id);
    if (!it) return;
    this.scene.tweens.add({ targets: it.obj, x: it.home.x, y: it.home.y, duration: this.opts.returnMs ?? 180, ease: 'Quad.Out' });
  }

  /** Liga/desliga (ex.: depois de confirmar, nada mais se mexe). */
  setEnabled(on: boolean): void {
    this.enabled = on;
    for (const it of this.items.values()) this.scene.input.setDraggable(it.obj, on);
  }

  private entry(obj: Draggable): { id: string; depth: number } | undefined {
    for (const [id, it] of this.items) if (it.obj === obj) return { id, depth: it.depth };
    return undefined;
  }

  private zoneAt(x: number, y: number): DropZoneSpec | undefined {
    return this.zones.find((z) => z.rect.contains(x, y));
  }

  private refreshZones(itemId: string, x: number, y: number): void {
    const over = this.zoneAt(x, y);
    for (const z of this.zones) {
      const state: ZoneState = z !== over ? 'idle' : (z.accepts?.(itemId) ?? true) ? 'valid' : 'invalid';
      if (this.zoneStates.get(z.id) === state) continue;
      this.zoneStates.set(z.id, state);
      this.opts.onZoneState?.(z.id, state);
    }
  }

  private clearZones(): void {
    for (const z of this.zones) {
      if (this.zoneStates.get(z.id) === 'idle') continue;
      this.zoneStates.set(z.id, 'idle');
      this.opts.onZoneState?.(z.id, 'idle');
    }
  }
}
