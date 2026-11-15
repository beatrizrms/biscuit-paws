// Fila de momentos (src/game/MomentQueue.ts): um de cada vez, na ordem, cada um quando a condição dele vale.
import { describe, expect, it } from 'vitest';
import { MomentQueue } from '../../src/game/MomentQueue';

const flush = () => new Promise((r) => setTimeout(r, 0));

describe('fila de momentos', () => {
  it('um de cada vez, na ordem em que entraram; com a tela ocupada, ninguém começa', async () => {
    const q = new MomentQueue();
    const log: string[] = [];
    let release!: () => void;
    q.add({ key: 'a', ready: () => true, run: () => new Promise<void>((r) => { log.push('a'); release = r; }) });
    q.add({ key: 'b', ready: () => true, run: async () => void log.push('b') });
    q.add({ key: 'a', ready: () => true, run: async () => void log.push('a de novo') });
    q.tick(false);
    expect(log).toEqual([]);
    q.tick(true);
    q.tick(true);
    expect(log).toEqual(['a']);
    expect(q.has('a')).toBe(true);
    release();
    await flush();
    q.tick(true);
    await flush();
    expect(log).toEqual(['a', 'b']);
    expect(q.busy).toBe(false);
  });

  it('o que ainda não pode (fora do café) espera e não trava os outros', async () => {
    const q = new MomentQueue();
    const log: string[] = [];
    let inCafe = false;
    q.add({ key: 'vet', ready: () => inCafe, run: async () => void log.push('vet') });
    q.add({ key: 'outro', ready: () => true, run: async () => void log.push('outro') });
    q.tick(true);
    await flush();
    q.tick(true);
    await flush();
    expect(log).toEqual(['outro']);
    inCafe = true;
    q.tick(true);
    await flush();
    expect(log).toEqual(['outro', 'vet']);
  });
});
