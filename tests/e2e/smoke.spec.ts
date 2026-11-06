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
  const start = await player(page);
  await hold(page, 'd', 500);
  const end = await player(page);
  expect(end.x).toBeGreaterThan(start.x + 20);
});

test('y-sort: atrás do balcão quando está acima, na frente quando está abaixo', async ({ page }, testInfo) => {
  await openGame(page);

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
