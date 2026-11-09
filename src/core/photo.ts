// Foto perfeita (fase 4h): um ou dois gatos do café andam pelo quintal e trocam de pose (andar, sentar, brincar,
// cochilar), cada um no seu tempo. Sentado, às vezes faz a pose fofa: uma janela curta com um sinal sutil. A
// protagonista mira com o visor (o mouse) e fotografa. A nota junta o momento (pose fofa vale tudo; as outras, pouco),
// o enquadramento (gato perto do centro do visor) e um bônus quando os dois gatos saem juntos. Poucas fotos por
// rodada; vale a melhor. Conteúdo em data/photo.json. Puro: sem Phaser, DOM ou window.
import type { Rng } from './rng';
import type { Outcome } from './minigame';

export type PoseId = 'walk' | 'sit' | 'play' | 'loaf' | 'cute';
export const POSES: readonly PoseId[] = ['walk', 'sit', 'play', 'loaf', 'cute'];

export interface PhotoData {
  schemaVersion: 1;
  /** Onde os gatos andam (px lógicos: x, y, largura, altura). */
  arena: [number, number, number, number];
  /** O visor (px lógicos): o gato conta como enquadrado dentro dele. */
  frame: { w: number; h: number };
  poses: Record<PoseId, {
    name: string;
    /** Animação do Cosy Cats (data/cat_sprites.json). */
    anim: string;
    /** Quanto a pose vale no momento (0 a 1). */
    moment: number;
    /** Chance de ser a próxima pose (a fofa só vem do sentar). */
    weight: number;
    /** Quanto dura (s, sorteado entre os dois). A fofa usa a janela da dificuldade. */
    duration: [number, number];
  }>;
  /** Chance de, ao fim do sentar, vir a pose fofa. */
  cuteChance: number;
  /** Pesos da nota (somam 100). */
  scoring: { moment: number; framing: number; pair: number };
}

/** minigames.json: photo.difficulties. */
export interface PhotoParams {
  cats: number;
  shots: number;
  /** Quanto dura a pose fofa (s). */
  cuteWindow: number;
  /** Velocidade de andar (px lógicos por s). */
  speed: number;
  okAt: number;
  greatAt: number;
}

export interface PhotoCat {
  id: string;
  x: number;
  y: number;
  pose: PoseId;
  /** Quanto falta para trocar de pose (s). */
  left: number;
  /** Para onde anda (com a pose walk). */
  to: { x: number; y: number };
  facing: 'down' | 'up' | 'left' | 'right';
}

export interface PhotoState {
  cats: PhotoCat[];
  shotsLeft: number;
  best: PhotoShot | null;
}

export interface PhotoShot {
  score: number;
  /** A pose do gato que valeu (o mais bem enquadrado). */
  pose: PoseId;
  /** Os gatos dentro do visor. */
  catIds: string[];
}

const rand = (rng: Rng, [a, b]: [number, number]) => a + rng.next() * (b - a);

function pointIn(data: PhotoData, rng: Rng): { x: number; y: number } {
  const [x, y, w, h] = data.arena;
  return { x: x + rng.next() * w, y: y + rng.next() * h };
}

export function newPhoto(data: PhotoData, p: PhotoParams, rng: Rng, catIds: readonly string[]): PhotoState {
  const cats = catIds.slice(0, p.cats).map((id) => {
    const at = pointIn(data, rng);
    return { id, ...at, pose: 'sit' as PoseId, left: rand(rng, data.poses.sit.duration), to: at, facing: 'down' as const };
  });
  return { cats, shotsLeft: p.shots, best: null };
}

/** A próxima pose: a fofa só sai do sentar (com cuteChance); as outras, pelo peso. */
function nextPose(data: PhotoData, rng: Rng, from: PoseId): PoseId {
  if (from === 'sit' && rng.next() < data.cuteChance) return 'cute';
  const pool = POSES.filter((p) => p !== 'cute' && p !== from && data.poses[p].weight > 0);
  const total = pool.reduce((n, p) => n + data.poses[p].weight, 0);
  let r = rng.next() * total;
  for (const p of pool) {
    r -= data.poses[p].weight;
    if (r <= 0) return p;
  }
  return pool[pool.length - 1] ?? 'sit';
}

/** Avança o tempo: cada gato anda (na pose walk) e troca de pose quando o tempo dela acaba. */
export function stepPhoto(data: PhotoData, p: PhotoParams, s: PhotoState, dt: number, rng: Rng): void {
  for (const c of s.cats) {
    if (c.pose === 'walk') {
      const dx = c.to.x - c.x;
      const dy = c.to.y - c.y;
      const dist = Math.hypot(dx, dy);
      const step = p.speed * dt;
      if (dist <= step) {
        c.x = c.to.x;
        c.y = c.to.y;
        c.left = 0; // chegou: troca de pose
      } else {
        c.x += (dx / dist) * step;
        c.y += (dy / dist) * step;
        c.facing = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up';
      }
    }
    c.left -= dt;
    if (c.left > 0) continue;
    c.pose = nextPose(data, rng, c.pose);
    c.left = c.pose === 'cute' ? p.cuteWindow : rand(rng, data.poses[c.pose].duration);
    if (c.pose === 'walk') c.to = pointIn(data, rng);
    else c.facing = 'down';
  }
}

/** A nota de uma foto com o visor centrado em (x, y). */
export function scoreShot(data: PhotoData, s: PhotoState, x: number, y: number): PhotoShot {
  const { w, h } = data.frame;
  const inFrame = s.cats.filter((c) => Math.abs(c.x - x) <= w / 2 && Math.abs(c.y - y) <= h / 2);
  if (inFrame.length === 0) return { score: 0, pose: 'walk', catIds: [] };
  // Enquadramento: 1 no centro, 0 na borda do visor (distância normalizada pelo meio do visor).
  const framing = (c: PhotoCat) => Math.max(0, 1 - Math.hypot((c.x - x) / (w / 2), (c.y - y) / (h / 2)));
  const star = [...inFrame].sort((a, b) => data.poses[b.pose].moment - data.poses[a.pose].moment || framing(b) - framing(a))[0]!;
  const sc = data.scoring;
  const pair = s.cats.length >= 2 && inFrame.length >= 2 ? 1 : 0;
  const score = Math.round(sc.moment * data.poses[star.pose].moment + sc.framing * framing(star) + sc.pair * pair);
  return { score, pose: star.pose, catIds: inFrame.map((c) => c.id) };
}

/** Tira a foto (se ainda tem filme): guarda a melhor. Devolve a foto, ou null sem fotos. */
export function shoot(data: PhotoData, s: PhotoState, x: number, y: number): PhotoShot | null {
  if (s.shotsLeft <= 0) return null;
  s.shotsLeft--;
  const shot = scoreShot(data, s, x, y);
  if (!s.best || shot.score > s.best.score) s.best = shot;
  return shot;
}

export function photoOutcome(p: PhotoParams, best: PhotoShot | null): Outcome {
  const score = best?.score ?? 0;
  return score >= p.greatAt ? 'great' : score >= p.okAt ? 'ok' : 'fail';
}

export function validatePhoto(data: PhotoData, anims: ReadonlySet<string>, difficulties?: Record<string, PhotoParams>): string[] {
  const errors: string[] = [];
  const err = (m: string) => errors.push(`photo: ${m}`);
  for (const id of POSES) {
    const pose = data.poses[id];
    if (!pose) {
      err(`falta a pose "${id}"`);
      continue;
    }
    if (!anims.has(pose.anim)) err(`pose "${id}": animação inexistente "${pose.anim}"`);
    if (!(pose.moment >= 0 && pose.moment <= 1)) err(`pose "${id}": moment precisa ser de 0 a 1`);
  }
  if (data.poses.cute && data.poses.cute.moment !== 1) err('a pose fofa precisa valer o momento inteiro (moment 1)');
  const sc = data.scoring;
  if (sc.moment + sc.framing + sc.pair !== 100) err('os pesos de scoring precisam somar 100');
  for (const [d, p] of Object.entries(difficulties ?? {})) {
    if (!(p.okAt < p.greatAt)) err(`${d}: okAt precisa ser menor que greatAt`);
    if (p.cats < 1 || p.cats > 2) err(`${d}: cats precisa ser 1 ou 2`);
    // Com um gato só não há bônus de dupla: o perfeito precisa caber no que dá para fazer.
    if (p.cats === 1 && p.greatAt > sc.moment + sc.framing) err(`${d}: greatAt ${p.greatAt} impossível com um gato`);
  }
  return errors;
}
