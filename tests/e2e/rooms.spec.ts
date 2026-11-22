// Cômodos do café: descobrir o porão, abrir pela obra do Tião (catálogo), passar sem fade, achar a chave,
// deixar o porão pronto (cama e mais um móvel), a cena que abre o quintal e dormir no café.
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
        state: { construction: { repaired: string[]; job: { endDay?: number } | null }; story: { completed: string[] }; money: number; cleaned: string[]; flags: Record<string, boolean>; time: number; day: number; inventory: Record<string, number>; business: string; service: { served: number } };
        content: { story: { beats: { id: string }[] } };
        roomState(id: string): string;
        doorState(id: string): string;
        visibleDirt(): { id: string; at: [number, number]; tags: string[] }[];
        clean(id: string, from: [number, number][]): { ok: boolean };
        restoreRoom(id: string): { ok: boolean };
        buy(id: string): unknown;
        place(id: string, at: [number, number]): unknown;
        doJobPoint(id: string): unknown;
        selectHotbarItem(id: string): boolean;
        endDay(where: string): void;
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

/** Passa as falas e cenas até aparecer uma pergunta com este botão, e responde com ele. */
async function answer(page: Page, button: string): Promise<void> {
  const b = page.getByRole('button', { name: button });
  for (let i = 0; i < 300 && !(await b.isVisible()); i++) {
    if (await page.locator('.dialogue-layer.open, .cutscene.open').count()) await page.keyboard.press('Space');
    await page.waitForTimeout(90);
  }
  await b.click();
  await settle(page);
}

test('cômodos (depois da inauguração): obra abre o porão, passagem contínua, porão pronto, a cena que abre o quintal e dormir no café', async ({ page }, testInfo) => {
  test.setTimeout(240_000); // a obra, o porão e a cena do jardim secreto (longa) passam de 2 minutos
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/?novo&escala=1');
  await page.waitForFunction(() => (window as unknown as Partial<Hook>).__biscuitPaws?.world?.map);
  await settle(page);
  // Café inaugurado e com movimento (40 clientes, dia 6): a Dona Neusa já ligou contando do porão.
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
    // O Tião já é conhecido e os dois reparos estão feitos (as obras dos cômodos são com ele).
    s.flags['painter.available'] = true;
    s.construction.repaired = ['inside', 'outside'];
    s.time = 600;
    w.goTo('map.cafe_main');
    w.session.buy('item.cushion_pink'); // reavalia a história
  });
  await settle(page);
  // A Dona Neusa já ligou (story.basement_call): com o café vazio, o "!" na parede acha a porta escondida.
  expect(await page.evaluate(() => (window as unknown as Hook).__biscuitPaws.world.session.doJobPoint('pt.basement_find'))).toEqual({ ok: true });
  await settle(page);
  expect(await page.evaluate(() => (window as unknown as Hook).__biscuitPaws.world.session.roomState('room.back_room'))).toBe('discovered');

  // Obra pelo catálogo (Construção): a ligação para o Tião, o orçamento (Enter aceita) e 1 dia de obra.
  await page.keyboard.press('c');
  await page.locator('[data-tab="build"]').click();
  const work = page.locator('.phone-ui [data-room="room.back_room"][data-work="open"]');
  await expect(work).toBeEnabled();
  await page.screenshot({ path: testInfo.outputPath('20-obras.png') });
  await work.click();
  await expect(page.locator('.cutscene')).toHaveClass(/open/);
  while (await page.locator('.cutscene.open').count()) await page.keyboard.press('Space');
  await expect(page.getByText('Fica 200 moedas')).toBeVisible();
  await page.waitForTimeout(300); // a pergunta só ouve o teclado depois de um instante
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => (window as unknown as Hook).__biscuitPaws.world.session.state.money)).toBe(1800);
  // Passa os dias da obra (dormindo em casa) e volta ao café.
  await page.evaluate(() => {
    const w = (window as unknown as Hook).__biscuitPaws.world;
    const end = w.session.state.construction.job!.endDay!;
    while (w.session.state.day <= end) w.session.endDay('home');
    w.session.state.time = 600;
    w.goTo('map.cafe_main');
  });
  // O Tião avisa que ficou pronto e pergunta se ela quer mais algum serviço: por enquanto, não.
  await answer(page, 'Por enquanto, não');
  expect(await page.evaluate(() => (window as unknown as Hook).__biscuitPaws.world.session.roomState('room.back_room'))).toBe('abandoned');
  // O quintal ainda não: vem bem depois.
  expect(await page.evaluate(() => (window as unknown as Hook).__biscuitPaws.world.session.doorState('door.backyard'))).toBe('hidden');

  // Passa do salão para o porão andando: mesmo mapa, sem fade.
  await page.evaluate(() => (window as unknown as Hook).__biscuitPaws.world.teleportPlayer(14, 7));
  await settle(page); // perto da passagem, ela comenta a porta aberta
  // Anda para a direita até o porão; as falas no caminho (a primeira vez lá dentro) passam com o Espaço.
  const col = () => page.evaluate(() => Math.floor((window as unknown as Hook).__biscuitPaws.world.player.x / 32));
  await page.keyboard.down('ArrowRight');
  for (let i = 0; i < 120 && (await col()) < 18; i++) {
    if (await page.locator('.dialogue-layer.open').count()) await page.keyboard.press('Space');
    await page.waitForTimeout(100);
  }
  await page.keyboard.up('ArrowRight');
  expect(await col()).toBeGreaterThanOrEqual(18);
  expect(await world(page)).toBe('map.cafe_main');
  await settle(page); // a fala da primeira vez no porão

  // Limpa (a chave estava embaixo do lençol); o porão fica pronto sozinho com a cama e mais um móvel.
  const placed = await page.evaluate(() => {
    const s = (window as unknown as Hook).__biscuitPaws.world.session;
    s.selectHotbarItem('item.broom'); // a sujeira só sai com a vassoura na mão
    for (const d of s.visibleDirt().filter((x) => x.tags.includes('back_room'))) s.clean(d.id, [d.at]);
    return [s.buy('item.bed'), s.place('item.bed', [20, 4]), s.buy('item.bedroom_trunk'), s.place('item.bedroom_trunk', [22, 8])];
  });
  expect(placed).toEqual([{ ok: true }, { ok: true }, { ok: true }, { ok: true }]);
  await settle(page);
  await expect.poll(() => page.evaluate(() => (window as unknown as Hook).__biscuitPaws.world.session.roomState('room.back_room')), { timeout: 10_000 }).toBe('restored');

  // 30 dias depois de abrir o porão, com a chave achada, vem a cena do jardim secreto (de dia, no café): a porta
  // do quintal aparece e já fica aberta.
  await page.evaluate(() => {
    const w = (window as unknown as Hook).__biscuitPaws.world;
    w.session.state.day += 31;
    w.session.state.time = 600;
    w.goTo('map.cafe_main');
    w.session.buy('item.cushion_pink'); // reavalia a história
  });
  // A cena é longa (a corretora, a Dona Neusa e o Tião, que acha a porta na parede de cima do salão e abre com a chave).
  const yardDoor = () => page.evaluate(() => (window as unknown as Hook).__biscuitPaws.world.session.doorState('door.backyard'));
  for (let i = 0; i < 4 && (await yardDoor()) !== 'open'; i++) await settle(page);
  await settle(page);
  expect(await yardDoor()).toBe('open');
  expect(await page.evaluate(() => (window as unknown as Hook).__biscuitPaws.world.session.roomState('room.backyard'))).toBe('abandoned');
  await page.evaluate(() => (window as unknown as Hook).__biscuitPaws.world.teleportPlayer(34, 8));
  await page.waitForTimeout(400);
  // A primeira olhada no quintal sujo: o susto, a ligação para o Tião e o orçamento da limpeza (agora não).
  await answer(page, 'Agora não');
  await page.screenshot({ path: testInfo.outputPath('21-quintal.png') });

  // Dormir no café (porão pronto, com a cama), à noite.
  await page.evaluate(() => {
    const w = (window as unknown as Hook).__biscuitPaws.world;
    w.session.state.time = 18 * 60;
    w.teleportPlayer(19, 5); // ao lado da cama
  });
  await settle(page);
  const day = await page.evaluate(() => (window as unknown as Hook).__biscuitPaws.world.session.state.day);
  await page.keyboard.press('e');
  await page.getByRole('button', { name: 'Dormir' }).click();
  await expect.poll(() => page.evaluate(() => (window as unknown as Hook).__biscuitPaws.world.session.state.day)).toBe(day + 1);
  expect(await world(page)).toBe('map.cafe_main');
  expect(errors).toEqual([]);
});
