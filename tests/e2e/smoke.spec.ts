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
  // ?jogar pula a Home: continua o save mais recente ou começa um novo (contexto limpo: sempre novo).
  await page.goto('/?jogar&escala=1');
  await page.waitForFunction(() => (window as unknown as { __biscuitPaws?: DebugHook }).__biscuitPaws?.cafe?.map);
  expect(errors).toEqual([]);
}

/** Passa todas as cenas e falas abertas (a abertura da história bloqueia o movimento). */
async function skipDialogue(page: Page): Promise<void> {
  const overlay = () => page.evaluate(() => !!document.querySelector('.dialogue-layer.open, .cutscene.open, .item-reveal'));
  const scripting = () =>
    page.evaluate(() => (window as unknown as { __biscuitPaws?: { cafe: { isScriptRunning(): boolean } } }).__biscuitPaws?.cafe.isScriptRunning() ?? false);
  // Passa falas e cenas; durante um roteiro (a corretora andando), espera.
  // Só termina depois de alguns instantes seguidos sem nada aberto (uma fala pode abrir logo após um roteiro).
  for (let i = 0, quiet = 0; i < 400 && quiet < 5; i++) {
    if (await overlay()) {
      quiet = 0;
      await page.keyboard.press('Space');
    } else quiet = (await scripting()) ? 0 : quiet + 1;
    await page.waitForTimeout(40);
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
  // O Market (C) é compra online: abre também na rua (o roteiro da corretora termina dentro do café: volta para a rua).
  await page.evaluate(() => (window as unknown as { __biscuitPaws: DebugHook }).__biscuitPaws.cafe.goTo('map.street'));
  await page.keyboard.press('c');
  await expect(page.locator('section.phone-ui[data-app="market"]')).toHaveClass(/open/);
  await page.screenshot({ path: testInfo.outputPath('05b-market.png') });
  await page.keyboard.press('c');
  await expect(page.locator('section.phone-ui')).not.toHaveClass(/open/);
  await enterCafe(page);
  await cleanCafe(page);
  await adoptFirstCat(page);

  // Market (aba Pet): encomenda pelo correio (chega em 1h na porta do café).
  await page.keyboard.press('c');
  await page.locator('[data-tab="pet"]').click();
  await page.locator('[data-item="item.water_bowl"]').click();
  await expect(page.locator('.toast')).toContainText('Pedido feito');
  await expect(page.locator('.hud-money')).toContainText('142');
  await page.keyboard.press('c');
  await expect(page.locator('section.phone-ui[data-app="market"]')).not.toHaveClass(/open/);
  // O relógio passa 1h; ela pega a caixa na porta e leva para dentro.
  await page.evaluate(() => {
    const w = (window as unknown as { __biscuitPaws: { cafe: { session: { tickClock(s: number): void; enter(m: string): void; pickUpParcels(): unknown; content: { dayNight: { minutesPerSecond: number } } }; goTo(m: string): void } } }).__biscuitPaws.cafe;
    w.session.tickClock(61 / w.session.content.dayNight.minutesPerSecond);
    w.goTo('map.street');
    w.session.pickUpParcels();
    w.goTo('map.cafe_main');
  });
  await skipDialogue(page);
  // Abre a caixa no salão (E perto da pilha): o item vai para a mão.
  await teleport(page, 14, 5);
  await page.keyboard.press('e');
  await expect(page.locator('.hint')).toContainText('cancelar');
  await clickCell(page, 12, 9);
  await expect(page.locator('.hud-goals li.done')).toHaveCount(1);
  await page.screenshot({ path: testInfo.outputPath('06-caminha.png') });

  // Recarrega: sem abertura de novo, dinheiro e móvel continuam lá.
  await page.reload();
  await page.waitForFunction(() => (window as unknown as { __biscuitPaws?: DebugHook }).__biscuitPaws?.cafe?.map);
  await expect(page.locator('.dialogue-layer')).not.toHaveClass(/open/);
  await expect(page.locator('.hud-money')).toContainText('142');
  await expect(page.locator('.hud-goals li.done')).toHaveCount(1);

  // Botão direito recolhe e pega na mão; Esc cancela e o item volta para a bolsa.
  // Cada passo espera o jogo reagir antes do próximo (sem corrida entre teclas).
  await clickCell(page, 12, 9, 'right');
  await expect(page.locator('.hud-goals li.done')).toHaveCount(0);
  await expect(page.locator('.hint')).toContainText('cancelar'); // modo de posicionar
  await page.keyboard.press('Escape');
  await expect(page.locator('.hint')).toContainText('market'); // voltou a andar
  await page.keyboard.press('c');
  await expect(page.locator('section.phone-ui[data-app="market"]')).toHaveClass(/open/);
  await page.locator('[data-tab="pet"]').click();
  await expect(page.locator('[data-item="item.water_bowl"] .m-owned')).toBeVisible();
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
  await page.locator('[data-tab="build"]').click();
  await page.locator('[data-surface="surface.hall_floor"][data-finish="finish.wood_planks"]').click();
  await expect(page.locator('.hud-money')).toContainText('90');
  await expect(page.locator('.toast')).toHaveClass(/show/);
  await page.screenshot({ path: testInfo.outputPath('08-piso-novo.png') });

  await page.reload();
  await page.waitForFunction(() => (window as unknown as { __biscuitPaws?: DebugHook }).__biscuitPaws?.cafe?.map);
  await page.keyboard.press('c');
  await page.locator('[data-tab="build"]').click();
  const current = page.locator('[data-surface="surface.hall_floor"][data-finish="finish.wood_planks"]');
  await expect(current).toBeDisabled();
  await expect(current).toContainText('atual');
});

test('rua: anda até a porta da padaria, entra e sai sem ficar indo e voltando', async ({ page }, testInfo) => {
  await openGame(page);
  expect((await player(page)).map).toBe('map.street');
  await skipDialogue(page);
  // O roteiro da corretora termina dentro do café: volta para a rua, no ponto de partida.
  await page.evaluate(() => (window as unknown as { __biscuitPaws: DebugHook }).__biscuitPaws.cafe.goTo('map.street'));
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
  test.setTimeout(60_000); // limpar o café inteiro + a cena do miado passa dos 30 s
  await openGame(page);
  await skipDialogue(page);
  await enterCafe(page);
  await cleanCafe(page);
  // Antes do gato, o catálogo não mostra a caminha.
  // Espera abrir e fechar de verdade: sem isso o segundo "c" pode chegar antes do jogo ler o primeiro.
  const catalog = page.locator('section.phone-ui[data-app="market"]');
  await page.keyboard.press('c');
  await expect(catalog).toHaveClass(/open/);
  await expect(page.locator('[data-item="item.cat_bed"]')).toHaveCount(0);
  await page.keyboard.press('c');
  await expect(catalog).not.toHaveClass(/open/);

  // Vai até a porta de dentro e sobe: em vez de sair, vem a cena.
  await teleport(page, 14, 4);
  // Segura a seta até a cena abrir (tempo fixo falha com a máquina carregada: quadros lentos, ela anda menos).
  await page.keyboard.down('ArrowUp');
  await expect(page.locator('.cutscene')).toHaveClass(/open/, { timeout: 8000 });
  await page.keyboard.up('ArrowUp');
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

test('mercado: pega na prateleira (carrinho), paga no caixa (E) e sai andando para baixo', async ({ page }, testInfo) => {
  await openGame(page);
  await skipDialogue(page);
  await page.evaluate(() => (window as unknown as { __biscuitPaws: DebugHook }).__biscuitPaws.cafe.goTo('map.market'));
  expect((await player(page)).map).toBe('map.market');
  // Prateleira pet: põe 2 rações no carrinho; nada é cobrado ainda.
  await teleport(page, 9, 4);
  await page.keyboard.press('e');
  await expect(page.locator('.shop')).toHaveClass(/open/);
  const add = page.locator('[data-row="item.cat_food_basic"] [data-act="add"]');
  await add.click();
  await add.click();
  await expect(page.locator('[data-row="item.cat_food_basic"] .n')).toHaveText('2');
  await expect(page.locator('.cart-bar .total')).toContainText('2 itens · 30 moedas');
  await expect(page.locator('.hud-money')).toContainText('150');
  await expect(page.locator('.hud-cart')).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('16-mercado-prateleira.png') });
  await page.keyboard.press('e'); // E fecha
  await expect(page.locator('.shop')).not.toHaveClass(/open/);
  // Caixa: mostra o total e cobra.
  await teleport(page, 13, 11); // de frente para o balcão do caixa
  await page.keyboard.press('e');
  await expect(page.locator('.shop.checkout')).toHaveClass(/open/);
  await page.screenshot({ path: testInfo.outputPath('17-mercado-caixa.png') });
  await page.locator('.cart-bar .pay').click();
  await expect(page.locator('.hud-money')).toContainText('120');
  await expect(page.locator('.shop')).not.toHaveClass(/open/);
  await expect(page.locator('.hud-cart')).toBeHidden();
  await teleport(page, 10, 10);
  await hold(page, 'ArrowDown', 600);
  await expect.poll(async () => (await player(page)).map).toBe('map.street');
});

test('fim do prólogo: ração ativa na barra, E na tigela alimenta, coração, cartão final e dia 2', async ({ page }, testInfo) => {
  await openGame(page);
  await skipDialogue(page);
  await enterCafe(page);
  await cleanCafe(page);
  await adoptFirstCat(page);
  await page.evaluate(() => {
    const s = (window as unknown as { __biscuitPaws: { cafe: { session: { buy(id: string): unknown; place(id: string, at: [number, number]): unknown } } } }).__biscuitPaws.cafe.session;
    s.buy('item.water_bowl');
    s.place('item.water_bowl', [12, 7]);
    s.buy('item.cat_food_basic');
    s.buy('item.food_bowl');
    s.place('item.food_bowl', [13, 7]);
  });
  await skipDialogue(page);
  await expect(page.locator('.hud-goals')).toContainText('Hora de comer');

  await teleport(page, 13, 8);
  // Com a vassoura ativa, a tigela pede a ração; a ração entrou sozinha no espaço 2 da barra.
  await page.keyboard.press('e');
  await expect(page.locator('.toast')).toContainText('ração na mão');
  await page.keyboard.press('2');
  await page.keyboard.press('e');
  // A ração aparece na mão (animação) antes de encher a tigela.
  await page.waitForTimeout(250);
  await page.screenshot({ path: testInfo.outputPath('16b-racao-na-mao.png') });
  await expect(page.locator('.toast')).toContainText('♥');
  await expect(page.locator('.dialogue')).toContainText('come com vontade');
  // A fala termina e só então vem o cartão final (não abre por cima da fala).
  await expect(page.locator('.cutscene')).not.toHaveClass(/open/);
  for (let i = 0; i < 40 && !(await page.locator('.cutscene.open').count()); i++) {
    await page.keyboard.press('Space');
    await page.waitForTimeout(40);
  }
  await expect(page.locator('.cs-card')).toContainText('MENOS UM GATINHO');
  await page.screenshot({ path: testInfo.outputPath('17-cartao-final.png') });
  await skipDialogue(page);
  await expect(page.locator('.hud-money')).toContainText('Inverno 2 · qui');
  // Dia 2: no café, o "presente" do gato no chão (a caixa de areia vem com a caminha, depois de recolher).
  await enterCafe(page);
  await expect(page.locator('.hud-goals')).toContainText('Que cheiro é esse?');
  await page.screenshot({ path: testInfo.outputPath('18-dia-2.png') });
  await page.evaluate(() => {
    const s = (window as unknown as { __biscuitPaws: { cafe: { session: { selectHotbarItem(id: string): boolean; clean(id: string): unknown } } } }).__biscuitPaws.cafe.session;
    s.selectHotbarItem('item.broom');
    s.clean('dirt.cat_poop');
  });
  await skipDialogue(page);
  await expect(page.locator('.hud-goals')).toContainText('Um cantinho quente');
});

test('corretora: aparece na rua, leva para dentro e a chave aparece no centro da tela', async ({ page }, testInfo) => {
  test.setTimeout(90_000); // a cena inteira (andar, falas, entrar) leva mais que o padrão
  await openGame(page);
  // Passa só a cena do Natal e a fala da chegada.
  for (let i = 0; i < 120; i++) {
    const text = await page.evaluate(() => document.querySelector('.dialogue-layer.open .text')?.textContent ?? null);
    if (text?.includes('Eu vou mostrar')) break;
    await page.keyboard.press('Space');
    await page.waitForTimeout(40);
  }
  await page.keyboard.press('Space');
  await page.keyboard.press('Space');
  // A corretora fala com retrato.
  await expect(page.locator('.dialogue.with-portrait')).toBeVisible({ timeout: 10_000 });
  await expect(page.locator('.dialogue .speaker')).toHaveText('Corretora');
  await page.screenshot({ path: testInfo.outputPath('19-corretora.png') });
  // Segue até a chave no centro.
  for (let i = 0; i < 300 && !(await page.locator('.item-reveal.open').count()); i++) {
    if (await page.locator('.dialogue-layer.open').count()) await page.keyboard.press('Space');
    await page.waitForTimeout(60);
  }
  await expect(page.locator('.item-reveal')).toContainText('Chave da padaria');
  expect((await player(page)).map).toBe('map.cafe_main');
  await page.screenshot({ path: testInfo.outputPath('20-chave.png') });
  await skipDialogue(page);
  const key = await page.evaluate(() => (window as unknown as { __biscuitPaws: { cafe: { sessionState(): { inventory: Record<string, number> } } } }).__biscuitPaws.cafe.sessionState().inventory['item.key_bakery']);
  expect(key).toBe(1);
  await expect(page.locator('.hud-goals')).toContainText('Uma boa faxina');
});

test('atendimento: cardápio (M), cliente pede, prepara (E), entrega, louça suja e pia', async ({ page }) => {
  test.setTimeout(90_000);
  await openGame(page);
  await skipDialogue(page);
  // Atalho: tudo até as cadeiras, com balcão, cafeteira, mesa, cadeira, louça da Gabi e café.
  await page.evaluate(() => {
    type W = { session: { content: { story: { beats: { id: string }[] } }; state: Record<string, unknown> & { story: { completed: string[] }; flags: Record<string, boolean>; cats: Record<string, unknown>; money: number; time: number; cleaned: string[] }; buy(id: string): unknown; place(id: string, at: [number, number]): unknown; receiveItem(id: string): void }; goTo(m: string, at?: [number, number]): void };
    const w = (window as unknown as { __biscuitPaws: { cafe: W } }).__biscuitPaws.cafe;
    const s = w.session;
    const beats = s.content.story.beats;
    s.state.story.completed = beats.slice(0, beats.findIndex((b) => b.id === 'story.chairs') + 1).map((b) => b.id);
    Object.assign(s.state.flags, { 'prologue.done': true, 'has.cat': true, 'seen.scr.gabi_visit': true });
    s.state.cleaned = ['*'];
    s.state.money = 400;
    s.state.time = 9 * 60;
    for (const [id, at] of [['item.counter_single', [4, 5]], ['item.counter_single', [7, 5]], ['item.coffee_machine', [7, 5]], ['item.table_round', [10, 8]], ['item.chair_front', [11, 8]]] as const) {
      s.buy(id);
      s.place(id, [at[0], at[1]]);
    }
    s.receiveItem('item.dishes_set');
    s.buy('item.coffee_ground');
    s.buy('item.paper_filter');
    w.goTo('map.cafe_main', [6, 7]);
  });
  await skipDialogue(page);
  await expect(page.locator('.hud-goals')).toContainText('O primeiro cliente');
  await page.keyboard.press('m');
  await page.locator('[data-recipe="recipe.black_coffee"]').click();
  await page.keyboard.press('m');
  const advance = (m: number) =>
    page.evaluate((m) => {
      const s = (window as unknown as { __biscuitPaws: { cafe: { session: { tickClock(x: number): void; content: { dayNight: { minutesPerSecond: number } } } } } }).__biscuitPaws.cafe.session;
      for (let i = 0; i < m; i++) s.tickClock(1 / s.content.dayNight.minutesPerSecond);
    }, m);
  await advance(6);
  await expect(page.locator('.hud-goals')).toContainText('Atendimento: 1');
  await teleport(page, 7, 6);
  await page.keyboard.press('e');
  await expect(page.locator('.toast')).toContainText('Preparando');
  await advance(11);
  await page.keyboard.press('e');
  await expect(page.locator('.hud-goals')).toContainText('Nas mãos: Café preto');
  await teleport(page, 5, 6);
  await page.keyboard.press('e');
  await expect(page.locator('.toast')).toContainText('+12');
  await skipDialogue(page);
  await advance(22);
  await teleport(page, 4, 6);
  await page.keyboard.press('e');
  await expect(page.locator('.hud-goals')).toContainText('Xícara suja');
  await teleport(page, 1, 4);
  // Pia: um E deixa a louça, outro começa a lavar; leva uns minutos.
  await page.keyboard.press('e');
  await expect(page.locator('.toast')).toContainText('Louça na pia');
  await page.keyboard.press('e');
  await expect(page.locator('.toast')).toContainText('Lavando');
  await advance(5);
  await expect(page.locator('.hud-goals')).not.toContainText('Pia:');
});
