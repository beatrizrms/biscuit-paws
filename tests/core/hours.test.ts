import { describe, expect, it } from 'vitest';
import { validateMap, type MapDoor } from '../../src/core/map';
import { weekdayOf } from '../../src/core/schedule';
import { GameSession } from '../../src/core/session';
import { newGameState } from '../../src/core/state';
import { loadContent } from './content';

const content = loadContent();
const street = content.maps['map.street']!;
const door = (id: string) => street.doors!.find((d) => d.id === id)!;
/** Primeiro dia (a partir de 1) que cai neste dia da semana (0 = segunda). */
const dayOn = (weekday: number) => [1, 2, 3, 4, 5, 6, 7].find((d) => weekdayOf(d, content.seasons.startWeekday) === weekday)!;

function at(day: number, time: string) {
  const state = newGameState(500, 'map.street', 0);
  state.day = day;
  const [h, m] = time.split(':').map(Number);
  state.time = h! * 60 + m!;
  state.flags['clinic.open'] = true;
  const session = new GameSession(content, state);
  const events: { name: string; payload: unknown }[] = [];
  session.bus.onAny((name, payload) => events.push({ name, payload }));
  return { session, state, events };
}

describe('horário dos estabelecimentos', () => {
  it('mercado: todo dia das 07:00 às 20:00; fora disso a porta avisa quando abre', () => {
    const market = door('door.market');
    const monday = dayOn(0);
    expect(at(monday, '07:00').session.canUseDoor(market)).toBe(true);
    expect(at(monday, '19:59').session.canUseDoor(market)).toBe(true);
    const night = at(monday, '20:00');
    expect(night.session.canUseDoor(market)).toBe(false);
    night.session.doorLocked(market);
    expect(night.events.find((e) => e.name === 'door.closed')?.payload).toEqual({ doorId: 'door.market', name: 'Mercado', opensDay: monday + 1, opensAt: '07:00' });
    const dawn = at(monday, '06:30');
    dawn.session.doorLocked(market);
    expect(dawn.events.find((e) => e.name === 'door.closed')?.payload).toMatchObject({ opensDay: monday, opensAt: '07:00' });
  });

  it('clínica: fechada no domingo (abre segunda) e fora das 09:00 às 18:00', () => {
    const vet = door('door.vet');
    const sunday = dayOn(6);
    const s = at(sunday, '10:00');
    expect(s.session.canUseDoor(vet)).toBe(false);
    s.session.doorLocked(vet);
    expect(s.events.find((e) => e.name === 'door.closed')?.payload).toMatchObject({ name: 'Clínica', opensDay: sunday + 1, opensAt: '09:00' });
    expect(at(sunday + 1, '09:00').session.canUseDoor(vet)).toBe(true);
    expect(at(sunday + 1, '18:00').session.canUseDoor(vet)).toBe(false);
  });

  it('fechada, a cena da porta não roda; trancada pela história, vale a fala de trancada', () => {
    const vet = door('door.vet');
    const monday = dayOn(0);
    const closed = at(monday, '20:00');
    closed.state.story.completed.push('story.cat_falls_ill');
    expect(closed.session.doorIntercept(vet)).toBeUndefined();
    const open = at(monday, '10:00');
    open.state.story.completed.push('story.cat_falls_ill');
    expect(open.session.doorIntercept(vet)).toBe('scr.clinic_opening');
    // Clínica ainda em obra (sem a marca): a fala de trancada, não o horário.
    const works = at(dayOn(6), '10:00');
    delete works.state.flags['clinic.open'];
    works.session.doorLocked(vet);
    expect(works.events.map((e) => e.name)).toEqual(['dialogue.requested']);
  });

  it('a validação acusa horário quebrado', () => {
    const bad = { ...street, doors: [{ ...(street.doors![0] as MapDoor), hours: { name: 'X', days: [true], open: '20:00', close: '07:00' } }] };
    const errors = validateMap(bad, content.catalog).filter((e) => e.includes('hours'));
    expect(errors).toHaveLength(2);
  });

  it('plaquinha de horário: o do estabelecimento da porta; a do café mostra o do app Horário', () => {
    const sunday = dayOn(6);
    const vet = at(sunday, '10:00').session.placeHours('door.vet')!;
    expect(vet).toMatchObject({ name: 'Clínica', cafe: false, open: '09:00', close: '18:00', openNow: false, next: { day: sunday + 1, open: '09:00' } });
    expect(at(sunday + 1, '10:00').session.placeHours('door.market')).toMatchObject({ name: 'Mercado', openNow: true });
    const cafe = at(sunday, '10:00').session.placeHours('door.cafe')!;
    expect(cafe.cafe).toBe(true);
    expect(cafe.days).toEqual(content.service.schedule.default.days);
    expect(at(sunday, '10:00').session.placeHours('door.nada')).toBeNull();
    // As plaquinhas da rua apontam para portas com horário (ou a do café).
    const signs = (street.interactions ?? []).filter((i) => 'hours' in i.action);
    expect(signs.map((i) => (i.action as { hours: string }).hours).sort()).toEqual(['door.cafe', 'door.market', 'door.vet']);
  });
});
