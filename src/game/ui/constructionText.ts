// Textos das obras (Market e a ligação com o Tião): o nome da obra e os dias.
import type { ConstructionJob } from '../../core/construction';
import { content, uiText } from '../content';

/** "Reparo interno", "Piso do salão: Tacos de madeira", "Cor da fachada: Menta", "Abrir o acesso ao porão". */
export function workName(job: Pick<ConstructionJob, 'kind' | 'surfaceId' | 'finishId' | 'roomId'>): string {
  const c = content.construction;
  if (job.kind === 'room_open' || job.kind === 'room_clear' || job.kind === 'room_restore') {
    const room = content.rooms.rooms.find((r) => r.id === job.roomId);
    const work = job.kind === 'room_open' ? room?.unlock : job.kind === 'room_clear' ? room?.clear : room?.restore;
    return work?.label ?? room?.name ?? '';
  }
  if (job.kind === 'inside') return c.repairs.inside.name;
  if (job.kind === 'outside') return c.repairs.outside.name;
  const finish = content.finishes[job.finishId ?? '']?.name ?? '';
  if (job.kind === 'facade') return `${uiText.construction.facadeTitle}: ${finish}`;
  const surface = (content.map.surfaces ?? []).find((x) => x.id === job.surfaceId)?.name ?? '';
  return `${surface}: ${finish}`;
}

/** "1 dia", "3 dias". */
export function daysText(n: number): string {
  return n === 1 ? uiText.construction.oneDay : uiText.construction.days.replace('{n}', String(n));
}
