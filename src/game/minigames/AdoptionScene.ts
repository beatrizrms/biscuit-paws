// Match de adoção: cartões de gatos do abrigo à esquerda, famílias com um lugar vazio à direita. Arraste cada
// gato até o lugar de uma família (soltar num lugar ocupado troca; soltar de volta na coluna tira) e confirme.
// Ao confirmar, cada família mostra se ficou boa, ok ou ruim, e o resultado lista o porquê de cada par.
// Regras e conteúdo: data/adoption.json + src/core/adoption.ts. Arrastar: dragDrop.ts (framework da fase 2).
import Phaser from 'phaser';
import { adoptionOutcome, judge, setupMatch, type AdoptCat, type AdoptionParams, type FamilyProfile, type Judgement } from '../../core/adoption';
import type { MiniGameResult } from '../../core/minigame';
import { paramsOf } from '../../core/minigame';
import { content, uiText } from '../content';
import { catTexture } from '../entities/Cat';
import { services } from '../services';
import { loadCatVariants } from './assets';
import { DragDrop, type ZoneState } from './dragDrop';
import { MiniGameScene } from './MiniGameScene';

export const ADOPTION_SCENE = 'MiniGame.adoption';

// Layout em px lógicos (tela de 640 x 360). Os cartões de gato cabem no lugar da família.
const CARD_W = 132;
const CAT_X = 90;
const FAMILY_X = 330;
const FAMILY_W = 290;
const TOP = 68;
/** Linha cheia (até 5 famílias); com famílias a mais (a feira montada), as linhas e os cartões encolhem para caber. */
const ROW = 56;
const BOTTOM = 344;
/** Espera depois de confirmar, para ler os vereditos no tabuleiro antes do resultado. */
const REVIEW_MS = 1800;

const C = { card: 0xfff7e6, edge: 0x7f4b33, slot: 0xf6e2c4, valid: 0x68ad8a, invalid: 0xd9475d, good: 0x68ad8a, ok: 0xe0a94e, bad: 0xd9475d };
const textStyle = (size: number, color = '#3b2a32', bold = false): Phaser.Types.GameObjects.Text.TextStyle => ({
  fontFamily: 'Trebuchet MS, sans-serif',
  fontSize: `${size}px`,
  fontStyle: bold ? 'bold' : 'normal',
  color,
  resolution: 4,
});

interface SlotView {
  family: FamilyProfile;
  x: number;
  y: number;
  frame: Phaser.GameObjects.Graphics;
  badge: Phaser.GameObjects.Text;
  catId: string | null;
}

export class AdoptionScene extends MiniGameScene {
  private p!: AdoptionParams;
  private cats: AdoptCat[] = [];
  private slots: SlotView[] = [];
  private cards = new Map<string, Phaser.GameObjects.Container>();
  private homes = new Map<string, { x: number; y: number }>();
  private drag!: DragDrop;
  private judgements: Judgement[] = [];
  private confirmed = false;
  private row = ROW;
  private cardH = ROW - 6;

  constructor() {
    super('adoption', ADOPTION_SCENE);
  }

  preload(): void {
    loadCatVariants(this, [...content.adoption.cats, ...(this.launch.params.adoptCats ?? [])].map((c) => c.variant));
  }

  protected buildGame(): void {
    this.p = paramsOf<AdoptionParams>(content.minigames, 'adoption', this.launch.params.difficulty);
    // Na feira, os gatos do café entram primeiro (params.adoptCats); o resto vem do abrigo da vila.
    const match = setupMatch(this.rng, content.adoption, this.p.pairs, this.launch.params.adoptCats ?? [], this.launch.params.extraFamilies ?? 0);
    const rows = Math.max(match.families.length, match.cats.length);
    this.row = Math.min(ROW, Math.floor((BOTTOM - TOP) / rows));
    this.cardH = this.row - 6;
    this.cats = match.cats;
    this.slots = [];
    this.cards.clear();
    this.homes.clear();
    this.judgements = [];
    this.confirmed = false;
    this.cameras.main.setBackgroundColor('#e9d3b4');

    this.drag = new DragDrop(this, {
      onDrop: (catId, zoneId) => this.drop(catId, zoneId),
      onZoneState: (zoneId, state) => this.paintSlot(this.slots.find((s) => s.family.id === zoneId), state),
      onItemState: (catId, state) => this.cards.get(catId)?.setScale(state === 'idle' ? 1 : 1.04),
    });
    // A coluna dos gatos também é uma área: soltar ali tira o gato da família.
    this.drag.addZone({ id: 'column', rect: new Phaser.Geom.Rectangle(CAT_X - CARD_W / 2 - 10, TOP - this.cardH / 2 - 10, CARD_W + 20, this.row * this.p.pairs + 10) });

    match.families.forEach((f, i) => this.buildFamily(f, i));
    this.cats.forEach((c, i) => this.buildCat(c, i));
    this.input.keyboard!.on('keydown-ENTER', this.confirm, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.input.keyboard?.off('keydown-ENTER', this.confirm, this));
    this.hudButton(uiText.minigames.adoption.confirm, () => this.confirm());
    this.updateInfo();
  }

  protected startGame(): void {
    this.startTimer(undefined, () => {}); // sem tempo: é para ler com calma
  }

  protected updateGame(): void {}

  protected resultText(r: MiniGameResult): string {
    if (r.skipped) return '';
    const t = uiText.minigames.adoption;
    const count = (v: string) => this.judgements.filter((j) => j.verdict === v).length;
    const lines = this.judgements.map((j) => {
      const cat = this.cats.find((c) => c.id === j.catId)!;
      const family = this.slots.find((s) => s.family.id === j.familyId)!.family;
      const reason = j.trait ? t.reason.replace('{trait}', this.traitName(j.trait)).replace('{note}', j.note ?? '') : t.noReason;
      return t.line.replace('{cat}', cat.name).replace('{family}', family.name).replace('{verdict}', t.verdict[j.verdict]).replace('{reason}', reason);
    });
    return [...lines, t.summary.replace('{good}', String(count('good'))).replace('{ok}', String(count('ok'))).replace('{bad}', String(count('bad')))].join('\n');
  }

  // ---------- Montagem ----------

  private buildFamily(f: FamilyProfile, i: number): void {
    const y = TOP + i * this.row;
    const left = FAMILY_X;
    const slotX = left + CARD_W / 2 + 4;
    const bg = this.add.graphics();
    bg.fillStyle(C.card, 1).fillRoundedRect(left, y - this.cardH / 2 - 2, FAMILY_W, this.cardH + 4, 6).lineStyle(1, C.edge, 1).strokeRoundedRect(left, y - this.cardH / 2 - 2, FAMILY_W, this.cardH + 4, 6);
    const textX = left + CARD_W + 12;
    this.add.text(textX, y - 20, f.name, textStyle(8.5, '#5c3428', true));
    this.add.text(textX, y - 8, f.description, { ...textStyle(7, '#5a4048'), wordWrap: { width: FAMILY_W - CARD_W - 18 } });
    const frame = this.add.graphics();
    this.add.text(slotX, y, uiText.minigames.adoption.slot, textStyle(6.5, '#a99fa6')).setOrigin(0.5);
    const badge = this.add.text(left + FAMILY_W - 6, y - this.cardH / 2 + 1, '', textStyle(7, '#ffffff', true)).setOrigin(1, 0).setDepth(10).setVisible(false);
    const slot: SlotView = { family: f, x: slotX, y, frame, badge, catId: null };
    this.slots.push(slot);
    this.paintSlot(slot, 'idle');
    this.drag.addZone({ id: f.id, rect: new Phaser.Geom.Rectangle(slotX - CARD_W / 2, y - this.cardH / 2, CARD_W, this.cardH) });
  }

  private buildCat(cat: AdoptCat, i: number): void {
    const x = CAT_X;
    const y = TOP + i * this.row;
    const bg = this.add.graphics();
    bg.fillStyle(0xffffff, 1).fillRoundedRect(-CARD_W / 2, -this.cardH / 2, CARD_W, this.cardH, 5).lineStyle(1, C.edge, 1).strokeRoundedRect(-CARD_W / 2, -this.cardH / 2, CARD_W, this.cardH, 5);
    // O gato sentado (Cosy Cats); variante sem folha carregada usa a do gato da missão.
    const tex = this.textures.exists(catTexture(cat.variant)) ? catTexture(cat.variant) : catTexture(this.launch.catVariant);
    const sprite = this.add.sprite(-CARD_W / 2 + 18, 4, tex, 0);
    const name = this.add.text(-CARD_W / 2 + 36, -this.cardH / 2 + 4, cat.name, textStyle(8.5, '#5c3428', true));
    const traits = Object.entries(cat.traits).map(([g, v]) => content.adoption.traits[g]?.[v] ?? v);
    // Cartão baixo (famílias a mais): os traços em linha, quebrando onde precisar, para caber.
    const compact = this.cardH < 46;
    const chips = this.add.text(-CARD_W / 2 + 36, -this.cardH / 2 + 17, traits.join(compact ? ' · ' : '\n'), {
      ...textStyle(6.5, '#5a4048'),
      lineSpacing: -1,
      ...(compact ? { wordWrap: { width: CARD_W - 40 } } : {}),
    });
    const card = this.add.container(x, y, [bg, sprite, name, chips]).setSize(CARD_W, this.cardH).setDepth(5);
    card.setInteractive({ useHandCursor: true });
    this.cards.set(cat.id, card);
    this.homes.set(cat.id, { x, y });
    this.drag.addItem(cat.id, card);
  }

  // ---------- Arrastar ----------

  private drop(catId: string, zoneId: string): void {
    const card = this.cards.get(catId)!;
    const from = this.slots.find((s) => s.catId === catId);
    if (zoneId === 'column') {
      if (from) from.catId = null;
      this.moveCard(catId, this.homes.get(catId)!);
    } else {
      const to = this.slots.find((s) => s.family.id === zoneId)!;
      // Lugar ocupado: o gato que estava ali troca de lugar com este (ou volta para a coluna).
      if (to.catId && to.catId !== catId) {
        const other = to.catId;
        if (from) {
          from.catId = other;
          this.moveCard(other, { x: from.x, y: from.y });
        } else this.moveCard(other, this.homes.get(other)!);
      } else if (from && from !== to) from.catId = null;
      to.catId = catId;
      this.moveCard(catId, { x: to.x, y: to.y });
      this.sfx(this.def.sounds?.drop);
    }
    card.setScale(1);
    this.updateInfo();
  }

  private moveCard(catId: string, at: { x: number; y: number }): void {
    this.drag.setHome(catId, at.x, at.y);
    this.drag.sendHome(catId);
  }

  private paintSlot(slot: SlotView | undefined, state: ZoneState): void {
    if (!slot) return;
    const x = slot.x - CARD_W / 2;
    const y = slot.y - this.cardH / 2;
    const edge = state === 'valid' ? C.valid : state === 'invalid' ? C.invalid : 0xc9b08e;
    slot.frame.clear().fillStyle(C.slot, 1).fillRoundedRect(x, y, CARD_W, this.cardH, 5).lineStyle(state === 'idle' ? 1 : 2, edge, 1).strokeRoundedRect(x, y, CARD_W, this.cardH, 5);
  }

  private updateInfo(): void {
    const placed = this.slots.filter((s) => s.catId).length;
    this.setHudInfo(uiText.minigames.adoption.hud.replace('{placed}', String(placed)).replace('{total}', String(this.cats.length)));
  }

  // ---------- Confirmar ----------

  private confirm(): void {
    if (this.phase !== 'playing' || this.confirmed) return;
    // Com famílias a mais, sobra lugar vazio: basta cada gato ter uma família.
    if (this.slots.filter((s) => s.catId).length < this.cats.length) return this.float(uiText.minigames.adoption.hud.replace('{placed}', String(this.slots.filter((s) => s.catId).length)).replace('{total}', String(this.cats.length)));
    this.confirmed = true;
    this.drag.setEnabled(false);
    const t = uiText.minigames.adoption;
    this.judgements = this.slots.filter((s) => s.catId).map((s) => judge(content.adoption, this.cats.find((c) => c.id === s.catId)!, s.family));
    for (const j of this.judgements) {
      const slot = this.slots.find((s) => s.family.id === j.familyId)!;
      const color = C[j.verdict];
      slot.badge.setText(` ${t.verdict[j.verdict]} `).setBackgroundColor(`#${color.toString(16).padStart(6, '0')}`).setVisible(true);
      this.cards.get(j.catId)!.setAlpha(1);
    }
    const outcome = adoptionOutcome(this.judgements, this.p);
    this.sfx(outcome === 'fail' ? this.def.sounds?.bad : this.def.sounds?.good);
    const good = this.judgements.filter((j) => j.verdict === 'good').length;
    this.time.delayedCall(REVIEW_MS, () =>
      this.finish(outcome, good, false, { adoptions: this.judgements.map((j) => ({ catId: j.catId, verdict: j.verdict })) }),
    );
  }

  private traitName(key: string): string {
    const [group, value] = key.split('.') as [string, string];
    return content.adoption.traits[group]?.[value] ?? value;
  }

  private float(text: string): void {
    const label = this.add.text(320, 340, text, { ...textStyle(9, '#d9475d', true), stroke: '#fff4e0', strokeThickness: 3 }).setOrigin(0.5, 1).setDepth(100);
    this.tweens.add({ targets: label, y: label.y - 12, alpha: 0, delay: 600, duration: 500, onComplete: () => label.destroy() });
  }

  private sfx(id: string | undefined): void {
    if (id) services().audio.sfx(id);
  }
}
