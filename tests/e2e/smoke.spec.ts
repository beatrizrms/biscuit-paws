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
    map: { tileSize: number };
    playerState(): PlayerState;
    teleportPlayer(col: number, row: number): void;
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

/** Passa todas as falas abertas (a abertura da história bloqueia o movimento). */
async function skipDialogue(page: Page): Promise<void> {
  const layer = page.locator('.dialogue-layer');
  for (let i = 0; i < 40 && (await layer.evaluate((el) => el.classList.contains('open'))); i++) {
    await page.keyboard.press('Space');
    await page.waitForTimeout(30);
  }
  await expect(layer).not.toHaveClass(/open/);
}

/** Clica no centro de uma célula do mapa (o mapa de 512 x 352 fica centrado na tela de 640 x 360). */
async function clickCell(page: Page, col: number, row: number, button: 'left' | 'right' = 'left'): Promise<void> {
  const box = (await page.locator('canvas').boundingBox())!;
  const zoom = box.width / 640;
  await page.mouse.click(box.x + (col * TILE + TILE / 2 + 64) * zoom, box.y + (row * TILE + TILE / 2 + 4) * zoom, { button });
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

test('o café abre e a personagem não atravessa a parede', async ({ page }, testInfo) => {
  await openGame(page);
  await skipDialogue(page);
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
  await expect(page.locator('.dialogue')).toContainText('Dezembro');
  await expect(page.locator('.hud-money')).toContainText('150');
  await page.screenshot({ path: testInfo.outputPath('05-abertura.png') });
  await skipDialogue(page);

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
  await clickCell(page, 12, 9, 'right');
  await page.keyboard.press('Escape');
  await expect(page.locator('.hud-goals li.done')).toHaveCount(0);
  await page.keyboard.press('c');
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
