import { expect, test, type Page } from '@playwright/test';

// Teste de fumaça: abre o jogo, tira print, anda contra a parede e confere que não atravessou.
// Usa o gancho de depuração window.__biscuitPaws (só existe em `npm run dev`).

interface PlayerState {
  x: number;
  y: number;
  depth: number;
}

interface DebugHook {
  cafe: {
    map: { tileSize: number; id: string };
    goTo(mapId: string): void;
    playerState(): PlayerState & { map: string };
    teleportPlayer(col: number, row: number): void;
    session: {
      addMoney(delta: number, reason: string): void;
      buy(itemId: string): { ok: boolean };
      place(itemId: string, at: [number, number]): { ok: boolean };
      state: { flags: Record<string, boolean> };
    };
  };
}

const TILE = 32;
const FEET_HEIGHT = 10;
const WALL_BOTTOM = 3 * TILE; // paredes nas linhas 0 a 2
const COUNTER_BASE = 5 * TILE; // balcão na linha 4

async function openGame(page: Page): Promise<void> {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  await page.waitForFunction(() => (window as unknown as { __biscuitPaws?: DebugHook }).__biscuitPaws?.cafe?.map);
  expect(errors).toEqual([]);
}

/** Passa todas as cenas e falas abertas (a abertura da história bloqueia o movimento). */
async function skipDialogue(page: Page): Promise<void> {
  const busy = () =>
    page.evaluate(() => !!document.querySelector('.dialogue-layer.open, .cutscene.open'));
  for (let i = 0; i < 80 && (await busy()); i++) {
    await page.keyboard.press('Space');
    await page.waitForTimeout(30);
  }
  await expect(page.locator('.dialogue-layer')).not.toHaveClass(/open/);
  await expect(page.locator('.cutscene')).not.toHaveClass(/open/);
}

/** O jogo começa na rua: entra direto no café (como se tivesse passado pela porta) e passa a fala. */
async function enterCafe(page: Page): Promise<void> {
  await page.evaluate(() => (window as unknown as { __biscuitPaws: DebugHook }).__biscuitPaws.cafe.goTo('map.cafe_main'));
  await skipDialogue(page);
}

/** Faz a faxina toda de uma vez (sem andar) e passa a fala de "limpou". */
async function cleanCafe(page: Page): Promise<void> {
  await page.evaluate(() => {
    const s = (window as unknown as { __biscuitPaws: { cafe: { session: { visibleDirt(): { id: string; clearedBy?: string }[]; clean(id: string): unknown } } } }).__biscuitPaws.cafe.session;
    for (const d of s.visibleDirt().filter((x) => !x.clearedBy)) s.clean(d.id);
  });
  await skipDialogue(page);
}

/** Depois da faxina: o gatinho na porta (cena), a caixa de nome com a sugestão, e as falas. */
async function adoptFirstCat(page: Page): Promise<void> {
  await page.evaluate(() =>
    (window as unknown as { __biscuitPaws: { cafe: { session: { finishCutscene(id: string): void } } } }).__biscuitPaws.cafe.session.finishCutscene('cs.meow_door'),
  );
  await expect(page.locator('.naming-layer')).toHaveClass(/open/);
  await page.click('.naming .confirm');
  await skipDialogue(page);
}

/** Clica no centro de uma célula do mapa (o mapa de 512 x 352 fica centrado na tela de 640 x 360). */
async function clickCell(page: Page, col: number, row: number, button: 'left' | 'right' = 'left'): Promise<void> {
  const box = (await page.locator('canvas').boundingBox())!;
  const zoom = box.width / 640;
  await page.mouse.click(box.x + (col * TILE + TILE / 2 + 64) * zoom, box.y + (row * TILE + TILE / 2 + 4) * zoom, { button });
}

/** A loja começa sem balcão: monta um na linha 4 (colunas 0 a 7), como o desenho original. */
async function buildCounter(page: Page): Promise<void> {
  const ok = await page.evaluate(() => {
    const { session } = (window as unknown as { __biscuitPaws: DebugHook }).__biscuitPaws.cafe;
    session.addMoney(1000, 'test');
    const pieces = ['item.counter_left', ...Array(6).fill('item.counter_mid'), 'item.counter_right'];
    return pieces.every((id, col) => session.buy(id).ok && session.place(id, [col, 4]).ok);
  });
  expect(ok).toBe(true);
}

const player = (page: Page) =>
  page.evaluate(() => (window as unknown as { __biscuitPaws: DebugHook }).__biscuitPaws.cafe.playerState());

const teleport = (page: Page, col: number, row: number) =>
  page.evaluate(([c, r]) => (window as unknown as { __biscuitPaws: DebugHook }).__biscuitPaws.cafe.teleportPlayer(c!, r!), [
    col,
    row,
  ]);

async function hold(page: Page, key: string, ms: number): Promise<void> {
  await page.keyboard.down(key);
  await page.waitForTimeout(ms);
  await page.keyboard.up(key);
  await page.waitForTimeout(100);
}

test('no café, a personagem não atravessa a parede', async ({ page }, testInfo) => {
  await openGame(page);
  await skipDialogue(page);
  await enterCafe(page);
  await page.screenshot({ path: testInfo.outputPath('01-cafe.png') });

  // Coluna 8 é livre do spawn até a parede (passagem ao lado do balcão).
  const start = await player(page);
  await hold(page, 'ArrowUp', 4000); // 80 px/s * 4 s = 320 px: muito além da parede
  const end = await player(page);
  await page.screenshot({ path: testInfo.outputPath('02-contra-a-parede.png') });

  expect(end.y).toBeLessThan(start.y); // andou
  expect(end.x).toBeCloseTo(start.x); // em linha reta
  // Os pés (10 px de altura) param encostados na base da parede.
  expect(end.y - FEET_HEIGHT).toBeGreaterThanOrEqual(WALL_BOTTOM - 0.5);
  expect(end.y - FEET_HEIGHT).toBeLessThan(WALL_BOTTOM + 2);
});

test('WASD também anda', async ({ page }) => {
  await openGame(page);
  await skipDialogue(page);
  const start = await player(page);
  await hold(page, 'd', 500);
  const end = await player(page);
  expect(end.x).toBeGreaterThan(start.x + 20);
});

test('y-sort: atrás do balcão quando está acima, na frente quando está abaixo', async ({ page }, testInfo) => {
  await openGame(page);
  await skipDialogue(page);
  await enterCafe(page);
  await buildCounter(page);

  await teleport(page, 3, 3);
  await page.waitForTimeout(100);
  expect((await player(page)).depth).toBeLessThan(COUNTER_BASE);
  await page.screenshot({ path: testInfo.outputPath('03-atras-do-balcao.png') });

  await teleport(page, 3, 5);
  await page.waitForTimeout(100);
  await hold(page, 'ArrowUp', 1000); // encosta no balcão por baixo
  const front = await player(page);
  expect(front.depth).toBeGreaterThan(COUNTER_BASE);
  expect(front.y - FEET_HEIGHT).toBeGreaterThanOrEqual(COUNTER_BASE - 0.5); // não entrou no balcão
  await page.screenshot({ path: testInfo.outputPath('04-frente-do-balcao.png') });
});

test('jogo novo: abertura, compra, posiciona e o save guarda ao recarregar', async ({ page }, testInfo) => {
  await openGame(page);
  await expect(page.locator('.cutscene')).toHaveClass(/open/);
  await expect(page.locator('.cs-text')).toContainText('Natal');
  await expect(page.locator('.hud-money')).toContainText('150');
  await page.screenshot({ path: testInfo.outputPath('05-abertura.png') });
  await skipDialogue(page);
  // Na rua o catálogo não abre.
  await page.keyboard.press('c');
  await expect(page.locator('.catalog')).not.toHaveClass(/open/);
  await expect(page.locator('.toast')).toContainText('lá dentro');
  await enterCafe(page);
  await cleanCafe(page);
  await adoptFirstCat(page);

  await page.keyboard.press('c');
  await page.locator('[data-item="item.cat_bed"]').click();
  await clickCell(page, 12, 9);
  await expect(page.locator('.hud-money')).toContainText('125');
  await expect(page.locator('.hud-goals li.done')).toHaveCount(1);
  await page.screenshot({ path: testInfo.outputPath('06-caminha.png') });

  // Recarrega: sem abertura de novo, dinheiro e móvel continuam lá.
  await page.reload();
  await page.waitForFunction(() => (window as unknown as { __biscuitPaws?: DebugHook }).__biscuitPaws?.cafe?.map);
  await expect(page.locator('.dialogue-layer')).not.toHaveClass(/open/);
  await expect(page.locator('.hud-money')).toContainText('125');
  await expect(page.locator('.hud-goals li.done')).toHaveCount(1);

  // Botão direito recolhe e pega na mão; Esc cancela e o item volta para a bolsa.
  // Cada passo espera o jogo reagir antes do próximo (sem corrida entre teclas).
  await clickCell(page, 12, 9, 'right');
  await expect(page.locator('.hud-goals li.done')).toHaveCount(0);
  await expect(page.locator('.hint')).toContainText('cancelar'); // modo de posicionar
  await page.keyboard.press('Escape');
  await expect(page.locator('.hint')).toContainText('catálogo'); // voltou a andar
  await page.keyboard.press('c');
  await expect(page.locator('.catalog')).toHaveClass(/open/);
  await expect(page.locator('[data-item="item.cat_bed"] .owned')).toBeVisible();
});

test('modo debug (F9): painel, notas e save separado do jogo normal', async ({ page }, testInfo) => {
  const ready = () => page.waitForFunction(() => (window as unknown as { __biscuitPaws?: DebugHook }).__biscuitPaws?.cafe?.map);
  await openGame(page);
  await skipDialogue(page);
  await expect(page.locator('.debug-panel')).toHaveCount(0);

  await page.keyboard.press('F9');
  await page.waitForURL(/debug=1/);
  await ready();
  await expect(page.locator('.debug-panel')).toBeVisible();
  await page.getByRole('button', { name: 'Pular falas' }).click();
  await page.getByRole('button', { name: '+100 moedas' }).click();
  await expect(page.locator('.hud-money')).toContainText('250');
  await page.getByRole('button', { name: 'Grade' }).click();
  await page.getByRole('button', { name: 'Colisão' }).click();
  await page.screenshot({ path: testInfo.outputPath('07-debug.png') });

  // Desliga: volta ao save normal, que não ganhou as 100 moedas.
  await page.keyboard.press('F9');
  await page.waitForURL((url) => !url.search.includes('debug'));
  await ready();
  await expect(page.locator('.debug-panel')).toHaveCount(0);
  await expect(page.locator('.hud-money')).toContainText('150');
});

test('pintor: troca o piso do salão pelo catálogo e o save guarda', async ({ page }, testInfo) => {
  await openGame(page);
  await skipDialogue(page);
  await enterCafe(page);
  // O pintor só aparece depois da Dona Lurdes: libera direto pelo estado.
  await page.evaluate(() => {
    const { session } = (window as unknown as { __biscuitPaws: DebugHook }).__biscuitPaws.cafe;
    session.state.flags['painter.available'] = true;
  });
  await page.keyboard.press('c');
  await page.locator('[data-surface="surface.hall_floor"][data-finish="finish.wood_planks"]').click();
  await expect(page.locator('.hud-money')).toContainText('90');
  await expect(page.locator('.toast')).toHaveClass(/show/);
  await page.screenshot({ path: testInfo.outputPath('08-piso-novo.png') });

  await page.reload();
  await page.waitForFunction(() => (window as unknown as { __biscuitPaws?: DebugHook }).__biscuitPaws?.cafe?.map);
  await page.keyboard.press('c');
  const current = page.locator('[data-surface="surface.hall_floor"][data-finish="finish.wood_planks"]');
  await expect(current).toBeDisabled();
  await expect(current).toContainText('atual');
});

test('rua: anda até a porta da padaria, entra e sai sem ficar indo e voltando', async ({ page }, testInfo) => {
  await openGame(page);
  expect((await player(page)).map).toBe('map.street');
  await skipDialogue(page);
  await page.screenshot({ path: testInfo.outputPath('09-rua.png') });

  // Spawn na coluna 15; a porta do café fica na coluna 17 (andar para cima na calçada).
  await hold(page, 'ArrowRight', 800);
  await hold(page, 'ArrowUp', 600);
  await expect.poll(async () => (await player(page)).map).toBe('map.cafe_main');
  await skipDialogue(page);
  await page.screenshot({ path: testInfo.outputPath('10-dentro.png') });

  // Segura a seta para cima: sai pela porta de dentro e fica na rua (não entra de novo).
  await hold(page, 'ArrowUp', 2500);
  await expect.poll(async () => (await player(page)).map).toBe('map.street');
  await page.waitForTimeout(500);
  expect((await player(page)).map).toBe('map.street');
  await page.screenshot({ path: testInfo.outputPath('11-saiu.png') });
});

test('faxina: clicar na sujeira de perto limpa; de longe, pede para chegar perto', async ({ page }, testInfo) => {
  await openGame(page);
  await skipDialogue(page);
  await enterCafe(page);
  await page.screenshot({ path: testInfo.outputPath('12-cafe-sujo.png') });
  const cleaned = () =>
    page.evaluate(() => (window as unknown as { __biscuitPaws: { cafe: { sessionState(): { cleaned: string[] } } } }).__biscuitPaws.cafe.sessionState().cleaned);

  // Balde de goteira em (8, 5). Longe (linha 9): não limpa.
  await teleport(page, 8, 9);
  await clickCell(page, 8, 5);
  await expect(page.locator('.toast')).toContainText('mais perto');
  expect(await cleaned()).toEqual([]);

  // Perto (linha 6): limpa.
  await teleport(page, 8, 6);
  await clickCell(page, 8, 5);
  await expect.poll(cleaned).toEqual(['dirt.leak_bucket']);

  // Mancha na parede: só sai com reforma.
  await teleport(page, 4, 3);
  await clickCell(page, 4, 1);
  await expect(page.locator('.toast')).toContainText('reformando');
  await page.screenshot({ path: testInfo.outputPath('13-faxina.png') });
});

test('o miado: a porta mostra o gatinho, a caixa de nome aparece e ele fica no café', async ({ page }, testInfo) => {
  await openGame(page);
  await skipDialogue(page);
  await enterCafe(page);
  await cleanCafe(page);
  // Antes do gato, o catálogo não mostra a caminha.
  await page.keyboard.press('c');
  await expect(page.locator('[data-item="item.cat_bed"]')).toHaveCount(0);
  await page.keyboard.press('c');

  // Vai até a porta de dentro e sobe: em vez de sair, vem a cena.
  await teleport(page, 14, 4);
  await hold(page, 'ArrowUp', 700);
  await expect(page.locator('.cutscene')).toHaveClass(/open/);
  expect((await player(page)).map).toBe('map.cafe_main');
  await skipDialogue(page);

  // Caixa de nome com a sugestão; dá para digitar W, A, S, D sem andar.
  await expect(page.locator('.naming input')).toHaveValue('Botinhas');
  await page.screenshot({ path: testInfo.outputPath('14-nome.png') });
  const before = await player(page);
  await page.fill('.naming input', '');
  await page.locator('.naming input').pressSequentially('Wasabi');
  expect(await player(page)).toEqual(before);
  await page.click('.naming .confirm');
  await expect(page.locator('.dialogue')).toContainText('Wasabi');
  await skipDialogue(page);

  const state = await page.evaluate(() => (window as unknown as { __biscuitPaws: { cafe: { catCount(): number; sessionState(): { cats: Record<string, { name: string }> } } } }).__biscuitPaws.cafe);
  void state;
  const info = await page.evaluate(() => {
    const w = (window as unknown as { __biscuitPaws: { cafe: { catCount(): number; sessionState(): { cats: Record<string, { name: string }> } } } }).__biscuitPaws.cafe;
    return { n: w.catCount(), name: w.sessionState().cats['cat.first_stray']?.name };
  });
  expect(info).toEqual({ n: 1, name: 'Wasabi' });
  await page.keyboard.press('c');
  await expect(page.locator('[data-item="item.cat_bed"]')).toHaveCount(1);
  await page.screenshot({ path: testInfo.outputPath('15-gato-no-cafe.png') });
});
