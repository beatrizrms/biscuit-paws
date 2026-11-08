// Cômodos do café: descobrir o quartinho, abrir pela obra (catálogo), passar sem fade, achar a chave,
// abrir o quintal com E na porta, reformar e dormir no café.
import { expect, test, type Page } from '@playwright/test';

type Hook = {
  __biscuitPaws: {
    world: {
      map: { id: string };
      player: { x: number; y: number };
      changingMap: boolean;
      teleportPlayer(c: number, r: number): void;
      goTo(m: string): void;
      ui: { isBusy(): boolean };
      scripts: { isRunning(): boolean };
      session: {
        state: { story: { completed: string[] }; money: number; cleaned: string[]; flags: Record<string, boolean>; time: number; day: number; inventory: Record<string, number>; business: string; service: { served: number } };
        content: { story: { beats: { id: string }[] } };
        roomState(id: string): string;
        doorState(id: string): string;
        visibleDirt(): { id: string; at: [number, number]; tags: string[] }[];
        clean(id: string, from: [number, number][]): { ok: boolean };
        restoreRoom(id: string): { ok: boolean };
        buy(id: string): unknown;
      };
    };
  };
};
const world = (page: Page) => page.evaluate(() => (window as unknown as Hook).__biscuitPaws.world.map.id);

async function settle(page: Page): Promise<void> {
  for (let i = 0, quiet = 0; i < 300 && quiet < 6; i++) {
    const busy = await page.evaluate(() => {
      const w = (window as unknown as Hook).__biscuitPaws.world;
      return w.ui.isBusy() || w.scripts.isRunning() || w.changingMap;
    });
    if (busy) {
      quiet = 0;
      await page.keyboard.press('Space');
    } else quiet++;
    await page.waitForTimeout(90);
  }
}

test('cômodos (depois da inauguração): obra abre o quartinho, passagem contínua, reforma, quintal com a chave e dormir no café', async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/?novo&escala=1');
  await page.waitForFunction(() => (window as unknown as Partial<Hook>).__biscuitPaws?.world?.map);
  await settle(page);
  // Café inaugurado e com movimento (40 clientes, dia 6): a Dona Neusa contou do quartinho.
  await page.evaluate(() => {
    const w = (window as unknown as Hook).__biscuitPaws.world;
    const s = w.session.state;
    const beats = w.session.content.story.beats.map((b) => b.id);
    s.story.completed = beats.slice(0, beats.indexOf('story.inauguration') + 1).filter((b) => b !== 'story.back_room' && b !== 'story.backyard');
    s.business = 'inaugurated';
    s.service.served = 40;
    s.day = 6;
    s.money = 2000;
    s.cleaned = ['*'];
    s.flags['prologue.done'] = true;
    s.time = 600;
    w.goTo('map.cafe_main');
    w.session.buy('item.cushion_pink'); // reavalia a história
  });
  await settle(page);
  expect(await page.evaluate(() => (window as unknown as Hook).__biscuitPaws.world.session.roomState('room.back_room'))).toBe('discovered');

  // Obra pelo catálogo (Obras).
  await page.keyboard.press('c');
  const work = page.locator('.catalog [data-room="room.back_room"][data-work="open"]');
  await expect(work).toBeEnabled();
  await page.screenshot({ path: testInfo.outputPath('20-obras.png') });
  await work.click();
  await settle(page);
  expect(await page.evaluate(() => (window as unknown as Hook).__biscuitPaws.world.session.roomState('room.back_room'))).toBe('abandoned');
  // O quintal ainda não: vem bem depois.
  expect(await page.evaluate(() => (window as unknown as Hook).__biscuitPaws.world.session.doorState('door.backyard'))).toBe('hidden');

  // Passa do salão para o quartinho andando: mesmo mapa, sem fade.
  await page.evaluate(() => (window as unknown as Hook).__biscuitPaws.world.teleportPlayer(14, 7));
  await page.keyboard.down('ArrowRight');
  await expect.poll(() => page.evaluate(() => Math.floor((window as unknown as Hook).__biscuitPaws.world.player.x / 32)), { timeout: 8000 }).toBeGreaterThanOrEqual(18);
  await page.keyboard.up('ArrowRight');
  expect(await world(page)).toBe('map.cafe_main');

  // Limpa (a chave estava embaixo do lençol) e reforma o quartinho; com 100 clientes e o dia 12,
  // o gato leva até a porta com cadeado do quintal. E na porta, com a chave, abre.
  await page.evaluate(() => {
    const s = (window as unknown as Hook).__biscuitPaws.world.session;
    for (const d of s.visibleDirt().filter((x) => x.tags.includes('back_room'))) s.clean(d.id, [d.at]);
    s.state.service.served = 100;
    s.state.day = 12;
    s.restoreRoom('room.back_room');
  });
  await settle(page);
  expect(await page.evaluate(() => (window as unknown as Hook).__biscuitPaws.world.session.doorState('door.backyard'))).toBe('locked');
  await page.evaluate(() => (window as unknown as Hook).__biscuitPaws.world.teleportPlayer(24, 7));
  await page.keyboard.press('e');
  await settle(page);
  expect(await page.evaluate(() => (window as unknown as Hook).__biscuitPaws.world.session.roomState('room.backyard'))).toBe('abandoned');
  await page.evaluate(() => (window as unknown as Hook).__biscuitPaws.world.teleportPlayer(34, 8));
  await page.waitForTimeout(400);
  await page.screenshot({ path: testInfo.outputPath('21-quintal.png') });

  // Dormir no café (quartinho reformado), à noite.
  await page.evaluate(() => {
    const w = (window as unknown as Hook).__biscuitPaws.world;
    w.session.state.time = 18 * 60;
    w.teleportPlayer(19, 6);
  });
  await settle(page);
  const day = await page.evaluate(() => (window as unknown as Hook).__biscuitPaws.world.session.state.day);
  await page.keyboard.press('e');
  await page.getByRole('button', { name: 'Dormir' }).click();
  await expect.poll(() => page.evaluate(() => (window as unknown as Hook).__biscuitPaws.world.session.state.day)).toBe(day + 1);
  expect(await world(page)).toBe('map.cafe_main');
  expect(errors).toEqual([]);
});
