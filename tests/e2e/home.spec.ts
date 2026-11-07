// Home e menu: toque para começar, Continuar desabilitado sem save, novo jogo, pausa (salvar e voltar),
// save corrompido com restaurar backup, importar arquivo, opções de som.
import { expect, test, type Page } from '@playwright/test';

async function openHome(page: Page): Promise<string[]> {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  await page.locator('.menu-tap').click();
  await expect(page.locator('[data-act="new"]')).toBeVisible();
  return errors;
}

/** Passa as falas da abertura até o jogo ficar livre. */
async function settle(page: Page): Promise<void> {
  await page.waitForFunction(() => (window as unknown as { __biscuitPaws?: { world?: { map?: unknown } } }).__biscuitPaws?.world?.map);
  for (let i = 0, quiet = 0; i < 400 && quiet < 6; i++) {
    const busy = await page.evaluate(() => {
      const w = (window as unknown as { __biscuitPaws: { world: { ui: { isBusy(): boolean }; isScriptRunning(): boolean } } }).__biscuitPaws.world;
      return w.ui.isBusy() || w.isScriptRunning();
    });
    if (busy) {
      quiet = 0;
      await page.keyboard.press('Space');
    } else quiet++;
    await page.waitForTimeout(80);
  }
}

test('home: sem save, Continuar fica desabilitado; teclado navega', async ({ page }) => {
  const errors = await openHome(page);
  await expect(page.locator('[data-act="continue"]')).toBeDisabled();
  await expect(page.locator('.menu-title')).toHaveText('Biscuit Paws');
  // Setas e Enter: abre Opções e Esc volta.
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await expect(page.locator('.menu-panel.options')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('.menu-panel.options')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('home: novo jogo, pausa salva, volta ao menu e Continuar mostra o resumo', async ({ page }) => {
  test.setTimeout(90_000);
  await openHome(page);
  await page.locator('[data-act="new"]').click();
  await page.locator('.creator-name input').fill('Bia');
  await page.locator('.menu-creator [data-act="done"]').click();
  await settle(page);
  await page.keyboard.press('Escape');
  await expect(page.locator('.menu-panel.pause')).toBeVisible();
  await page.locator('.menu-pause [data-act="save"]').click();
  await expect(page.locator('.menu-pause .saved')).toContainText('Slot 1');
  await page.locator('.menu-pause [data-act="menu"]').click();
  await page.locator('.menu-confirm .yes').click();
  await page.locator('.menu-tap').click();
  const cont = page.locator('[data-act="continue"]');
  await expect(cont).toBeEnabled();
  await expect(cont).toContainText('Dia 1');
  await cont.click();
  await page.waitForFunction(() => (window as unknown as { __biscuitPaws?: { world?: { map?: unknown } } }).__biscuitPaws?.world?.map);
});

test('saves: corrompido não trava; restaurar backup; importar valida o arquivo', async ({ page }) => {
  await openHome(page);
  // Prepara: slot 2 com backup bom e o save atual quebrado.
  await page.evaluate(() => {
    const good = JSON.stringify({ schemaVersion: 1, savedAt: '2026-11-01T10:00:00.000Z', day: 4, money: 90, flags: {}, inventory: {}, placed: [], nextUid: 1, story: { completed: [] }, cats: {} });
    localStorage.setItem('biscuit-paws:slot2.bak', good);
    localStorage.setItem('biscuit-paws:slot2', '{ quebrado');
  });
  await page.locator('[data-act="load"]').click();
  const slot2 = page.locator('.menu-slot').nth(1);
  await expect(slot2).toHaveClass(/corrupt/);
  await slot2.locator('[data-action="restore"]').click();
  await page.locator('.menu-confirm .yes').click();
  await expect(slot2).toContainText('Dia 4');
  // Importar: arquivo inválido é recusado; válido entra no slot 3.
  const slot3 = page.locator('.menu-slot').nth(2);
  const chooser = page.waitForEvent('filechooser');
  await slot3.locator('[data-action="import"]').click();
  await (await chooser).setFiles({ name: 'foto.json', mimeType: 'application/json', buffer: Buffer.from('{"nao":"é save"}') });
  await expect(page.locator('.menu-toast')).toContainText('não é um save válido');
  await expect(slot3).toContainText('vazio');
  const chooser2 = page.waitForEvent('filechooser');
  await slot3.locator('[data-action="import"]').click();
  const valid = JSON.stringify({ schemaVersion: 1, savedAt: '2026-11-02T10:00:00.000Z', day: 9, money: 300, flags: {}, inventory: {}, placed: [], nextUid: 1, story: { completed: [] }, cats: {} });
  await (await chooser2).setFiles({ name: 'save.json', mimeType: 'application/json', buffer: Buffer.from(valid) });
  await expect(slot3).toContainText('Dia 9');
  // Apagar pede confirmação.
  await slot3.locator('[data-action="delete"]').click();
  await expect(page.locator('.menu-confirm')).toBeVisible();
  await page.locator('.menu-confirm .no').click();
  await expect(slot3).toContainText('Dia 9');
});

test('opções: som desligado e volume ficam gravados à parte do save', async ({ page }) => {
  await openHome(page);
  await page.locator('[data-act="options"]').click();
  const music = page.locator('.menu-option[data-ch="music"]');
  await music.locator('.toggle').click();
  await expect(music.locator('.toggle')).toHaveText('desligado');
  await page.locator('.menu-option[data-ch="ambient"] input').fill('30');
  await page.locator('.menu-panel.options .close').click();
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('biscuit-paws:settings') ?? '{}'));
  expect(saved.music.on).toBe(false);
  expect(saved.ambient.volume).toBeCloseTo(0.3);
  // Vale depois de recarregar (aplicado já na Home).
  await page.reload();
  await page.locator('.menu-tap').click();
  await page.locator('[data-act="options"]').click();
  await expect(page.locator('.menu-option[data-ch="music"] .toggle')).toHaveText('desligado');
});

test('criar personagem: nome obrigatório, teclado troca a opção, vestido esconde a parte de baixo', async ({ page }) => {
  const errors = await openHome(page);
  await page.locator('[data-act="new"]').click();
  await expect(page.locator('.menu-creator')).toBeVisible();
  // Sem nome não começa.
  await page.locator('.menu-creator [data-act="done"]').click();
  await expect(page.locator('.creator-error')).toContainText('nome');
  await page.locator('.creator-name input').fill('Lu');
  // Linha da roupa: setas para os lados até o vestido; a parte de baixo some.
  const top = page.locator('[data-cycle="top"]');
  await top.focus();
  for (let i = 0; i < 8 && (await top.textContent()) !== 'Vestido'; i++) await page.keyboard.press('ArrowRight');
  await expect(top).toHaveText('Vestido');
  await expect(page.locator('[data-cycle="bottom"]')).toHaveCount(0);
  await page.locator('.menu-creator [data-act="done"]').click();
  await page.waitForFunction(() => (window as unknown as { __biscuitPaws?: { world?: { map?: unknown } } }).__biscuitPaws?.world?.map);
  const player = await page.evaluate(() => (window as unknown as { __biscuitPaws: { world: { session: { state: { player: { name: string; appearance: { top: string } } } } } } }).__biscuitPaws.world.session.state.player);
  expect(player.name).toBe('Lu');
  expect(player.appearance.top).toBe('dress');
  expect(errors).toEqual([]);
});
