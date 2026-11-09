// Brincar com a varinha: o mouse é a ponta da varinha; o gato persegue com aceleração e curva suave (steering).
// A empolgação sobe quando a ponta muda de rumo e de ritmo; cai quando o movimento fica previsível (linha reta
// constante) ou rápido demais (ele desiste): cada vez que isso dura, o gato "enjoa" uma vez.
// Ponta parada ~0,5 s com o gato perto: ele se agacha e dá o bote; balançar de leve durante o agachar dá bônus.
// Puro: sem Phaser, DOM ou window. A cena chama stepWand a cada quadro com a posição da ponta.
import type { Outcome } from './minigame';

export interface WandParams {
  /** Duração da partida (s). */
  timeSec: number;
  /** Gato: velocidade máxima (px/s), aceleração máxima (px/s²) e o raio em que ele começa a frear perto da ponta. */
  catSpeed: number;
  catAccel: number;
  arriveRadius: number;
  /** Empolgação (0 a 100) por segundo com a ponta variando (escala com a variação, até variety). */
  gainPerSec: number;
  /** Variação de velocidade (px/s, entre a ponta e a média recente) que conta como "cheia". */
  variety: number;
  /** Abaixo disto (px/s) a ponta está parada; acima de tooFast, rápido demais. */
  stillSpeed: number;
  tooFast: number;
  /** Variação abaixo disto, andando, é "previsível". Quantos segundos previsível ou rápido demais até enjoar. */
  boringVariety: number;
  boredAfterSec: number;
  giveUpAfterSec: number;
  /** Quanto cai a cada enjoo, e quanto cai por segundo à toa (parada sem bote). */
  boredLoss: number;
  idleLossPerSec: number;
  /** Bote: ponta parada por pounceDelaySec com o gato a até pounceRange; agacha por crouchSec e salta. */
  pounceDelaySec: number;
  pounceRange: number;
  crouchSec: number;
  /** Ganho do bote e o bônus de balançar de leve (velocidade entre wiggleMin e wiggleMax) durante o agachar. */
  pounceGain: number;
  wiggleBonus: number;
  wiggleMin: number;
  wiggleMax: number;
  /** Fim do tempo: com pelo menos isto de empolgação, "ok". */
  okAt: number;
}

export const FULL_EXCITEMENT = 100;

type Vec = { x: number; y: number };

export type WandCatMode = 'chase' | 'crouch' | 'leap';

export interface WandState {
  tip: Vec;
  tipVel: Vec;
  /** Média recente da velocidade da ponta: a "previsão" do gato. Variar = fugir dela. */
  avgVel: Vec;
  cat: Vec;
  catVel: Vec;
  mode: WandCatMode;
  /** Tempo na pose atual (agachado, saltando) ou parada (ms). */
  modeMs: number;
  stillMs: number;
  boringMs: number;
  fastMs: number;
  excitement: number;
  /** Quantas vezes enjoou (Great = nenhuma). */
  bored: number;
  pounces: number;
  /** Balançou durante este agachar (o bônus vale uma vez por bote). */
  wiggled: boolean;
  wiggles: number;
  elapsed: number;
}

/** O que aconteceu neste passo (para a cena tocar som e mostrar balões). */
export interface WandEvents {
  bored?: 'boring' | 'too_fast';
  crouched?: boolean;
  wiggle?: boolean;
  pounced?: boolean;
}

const len = (v: Vec) => Math.hypot(v.x, v.y);

export function newWand(cat: Vec, tip: Vec): WandState {
  return {
    tip: { ...tip },
    tipVel: { x: 0, y: 0 },
    avgVel: { x: 0, y: 0 },
    cat: { ...cat },
    catVel: { x: 0, y: 0 },
    mode: 'chase',
    modeMs: 0,
    stillMs: 0,
    boringMs: 0,
    fastMs: 0,
    excitement: 0,
    bored: 0,
    pounces: 0,
    wiggled: false,
    wiggles: 0,
    elapsed: 0,
  };
}

/** Quanto a média da ponta acompanha o movimento: ~0,6 s de memória (o gato "aprende" o padrão nesse tempo). */
const AVG_TAU_SEC = 0.6;
/** Suavização da velocidade da ponta (o mouse chega em saltos). */
const TIP_TAU_SEC = 0.08;
/** O salto do bote: rápido, direto na ponta. */
const LEAP_SPEED = 260;

/** Um passo (dtMs) com a ponta em `tip`. */
export function stepWand(s: WandState, p: WandParams, tip: Vec, dtMs: number): WandEvents {
  const dt = Math.max(dtMs, 1) / 1000;
  const ev: WandEvents = {};
  s.elapsed += dtMs;
  s.modeMs += dtMs;

  // Ponta: velocidade suavizada (~0,08 s). O mouse não manda posição em todo quadro: sem isso, os quadros sem
  // evento contariam como 'parada' e o seguinte como um salto 'rápido demais'.
  const raw = { x: (tip.x - s.tip.x) / dt, y: (tip.y - s.tip.y) / dt };
  const kv = Math.min(1, dt / TIP_TAU_SEC);
  s.tipVel = { x: s.tipVel.x + (raw.x - s.tipVel.x) * kv, y: s.tipVel.y + (raw.y - s.tipVel.y) * kv };
  s.tip = { ...tip };
  // E a média mais longa: a 'previsão' do gato.
  const k = Math.min(1, dt / AVG_TAU_SEC);
  s.avgVel = { x: s.avgVel.x + (s.tipVel.x - s.avgVel.x) * k, y: s.avgVel.y + (s.tipVel.y - s.avgVel.y) * k };
  const speed = len(s.tipVel);
  const variety = len({ x: s.tipVel.x - s.avgVel.x, y: s.tipVel.y - s.avgVel.y });
  const toTip = { x: s.tip.x - s.cat.x, y: s.tip.y - s.cat.y };
  const dist = len(toTip);

  if (s.mode === 'crouch') {
    // Agachado: parado, de olho. Balançar de leve agora = bônus (uma vez por bote).
    s.catVel = { x: 0, y: 0 };
    if (!s.wiggled && speed >= p.wiggleMin && speed <= p.wiggleMax) {
      s.wiggled = true;
      s.wiggles++;
      s.excitement = Math.min(FULL_EXCITEMENT, s.excitement + p.wiggleBonus);
      ev.wiggle = true;
    }
    if (s.modeMs >= p.crouchSec * 1000) {
      s.mode = 'leap';
      s.modeMs = 0;
      ev.pounced = true;
      s.pounces++;
      s.excitement = Math.min(FULL_EXCITEMENT, s.excitement + p.pounceGain);
    }
    return ev;
  }

  if (s.mode === 'leap') {
    // Salto direto na ponta; chegou (ou passou o tempo), volta a perseguir.
    const step = LEAP_SPEED * dt;
    if (dist <= step || s.modeMs > 600) {
      s.cat = { ...s.tip };
      s.mode = 'chase';
      s.modeMs = 0;
      s.stillMs = 0;
    } else {
      s.cat = { x: s.cat.x + (toTip.x / dist) * step, y: s.cat.y + (toTip.y / dist) * step };
    }
    s.catVel = { x: 0, y: 0 };
    return ev;
  }

  // Perseguindo: steering "arrive" (quer ir até a ponta, freando perto; aceleração limitada = curvas suaves).
  const want = dist > 0 ? Math.min(p.catSpeed, (p.catSpeed * dist) / p.arriveRadius) : 0;
  const desired = dist > 0 ? { x: (toTip.x / dist) * want, y: (toTip.y / dist) * want } : { x: 0, y: 0 };
  let steer = { x: desired.x - s.catVel.x, y: desired.y - s.catVel.y };
  const steerLen = len(steer);
  const maxSteer = p.catAccel * dt;
  if (steerLen > maxSteer) steer = { x: (steer.x / steerLen) * maxSteer, y: (steer.y / steerLen) * maxSteer };
  s.catVel = { x: s.catVel.x + steer.x, y: s.catVel.y + steer.y };
  s.cat = { x: s.cat.x + s.catVel.x * dt, y: s.cat.y + s.catVel.y * dt };

  if (speed < p.stillSpeed) {
    // Parada: com o gato perto, ele se prepara para o bote; longe, a graça vai passando.
    s.stillMs += dtMs;
    s.boringMs = 0;
    s.fastMs = 0;
    if (s.stillMs >= p.pounceDelaySec * 1000 && dist <= p.pounceRange) {
      s.mode = 'crouch';
      s.modeMs = 0;
      s.wiggled = false;
      ev.crouched = true;
    } else s.excitement = Math.max(0, s.excitement - p.idleLossPerSec * dt);
    return ev;
  }
  s.stillMs = 0;

  if (speed > p.tooFast) {
    // Rápido demais: ele não acompanha e desiste.
    s.fastMs += dtMs;
    s.boringMs = 0;
    if (s.fastMs >= p.giveUpAfterSec * 1000) {
      s.fastMs = 0;
      s.bored++;
      s.excitement = Math.max(0, s.excitement - p.boredLoss);
      ev.bored = 'too_fast';
    }
    return ev;
  }
  s.fastMs = 0;

  if (variety < p.boringVariety) {
    // Previsível (mesmo rumo, mesmo ritmo): a graça acaba.
    s.boringMs += dtMs;
    if (s.boringMs >= p.boredAfterSec * 1000) {
      s.boringMs = 0;
      s.bored++;
      s.excitement = Math.max(0, s.excitement - p.boredLoss);
      ev.bored = 'boring';
    }
    return ev;
  }
  s.boringMs = 0;
  s.excitement = Math.min(FULL_EXCITEMENT, s.excitement + p.gainPerSec * Math.min(1, variety / p.variety) * dt);
  return ev;
}

/** Acabou? Barra cheia (great sem nenhum enjoo) ou o tempo (ok com okAt). null = continua. */
export function wandOutcome(s: WandState, p: WandParams, timeUp: boolean): Outcome | null {
  if (s.excitement >= FULL_EXCITEMENT) return s.bored === 0 ? 'great' : 'ok';
  if (!timeUp) return null;
  return s.excitement >= p.okAt ? 'ok' : 'fail';
}
