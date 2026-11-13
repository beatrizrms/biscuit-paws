// Carros passando na rua (data/world.json: traffic): de vez em quando um carro, o ônibus ou o furgão do correio
// atravessa a rua, num sentido ou no outro, sem parar. Puro: a agenda do dia sai de um sorteio com semente.
import { createRng } from './rng';
import { parseClock } from './time';

export interface VehicleDef {
  id: string;
  /** Arte de lado, virada para a esquerda e para a direita. */
  left: string;
  right: string;
  /** Escala do desenho (a arte é de 64 px por tile: 0.5 = tamanho do mapa). */
  scale: number;
  /** Peso no sorteio (padrão 1). */
  weight?: number;
}

export interface TrafficDef {
  map: string;
  /** Janela do dia ("HH:MM"). */
  hours: [string, string];
  /** A cada everyMinutes, a chance de passar um veículo. */
  everyMinutes: number;
  chance: number;
  /** Para onde os veículos vão (padrão: os dois sentidos). ["left"]: todos da direita para a esquerda. */
  directions?: ('left' | 'right')[];
  vehicles: VehicleDef[];
}

export interface TrafficPass {
  vehicle: string;
  /** Minuto do dia em que entra na rua. */
  at: number;
  /** Para onde vai. */
  dir: 'left' | 'right';
}

/** A agenda de veículos do dia (a mesma o dia inteiro). */
export function trafficOfDay(def: TrafficDef, day: number): TrafficPass[] {
  const rng = createRng(day * 3571 + 101);
  const total = def.vehicles.reduce((s, v) => s + (v.weight ?? 1), 0);
  const dirs = def.directions?.length ? def.directions : (['left', 'right'] as const);
  const out: TrafficPass[] = [];
  for (let t = parseClock(def.hours[0]); t < parseClock(def.hours[1]); t += def.everyMinutes) {
    if (!rng.chance(def.chance)) continue;
    let roll = rng.next() * total;
    const vehicle = def.vehicles.find((v) => (roll -= v.weight ?? 1) < 0) ?? def.vehicles[def.vehicles.length - 1]!;
    out.push({ vehicle: vehicle.id, at: t + rng.int(0, def.everyMinutes - 1), dir: dirs[rng.int(0, dirs.length - 1)]! });
  }
  return out;
}

/** Quem entra na rua neste minuto (o jogo chama a cada minuto de jogo; cada passagem sai uma vez). */
export function trafficStarting(passes: readonly TrafficPass[], fromMinute: number, toMinute: number): TrafficPass[] {
  return passes.filter((p) => p.at >= fromMinute && p.at < toMinute);
}

export function validateTraffic(def: TrafficDef | undefined, maps: ReadonlySet<string>): string[] {
  if (!def) return [];
  const errors: string[] = [];
  if (!maps.has(def.map)) errors.push(`world: traffic com mapa inexistente "${def.map}"`);
  if (!def.hours.every((h) => /^\d{1,2}:\d{2}$/.test(h))) errors.push('world: traffic.hours com hora inválida');
  if (!(def.everyMinutes > 0) || !(def.chance >= 0 && def.chance <= 1)) errors.push('world: traffic.everyMinutes > 0 e chance entre 0 e 1');
  if (def.directions?.some((d) => d !== 'left' && d !== 'right')) errors.push('world: traffic.directions só aceita "left" e "right"');
  if (def.vehicles.length === 0) errors.push('world: traffic sem veículos');
  const ids = new Set<string>();
  for (const v of def.vehicles) {
    if (ids.has(v.id)) errors.push(`world: veículo repetido "${v.id}"`);
    ids.add(v.id);
    if (!(v.scale > 0)) errors.push(`world: veículo "${v.id}" com scale inválida`);
  }
  return errors;
}
