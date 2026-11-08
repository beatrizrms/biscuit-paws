// Abre o jogo (servidor de dev já rodando), visita cada mapa de data/maps e tira um print de cada um.
// Também lista imagens/arquivos que não carregaram e erros da página.
//   node .claude/skills/conferir-visual/conferir.mjs [pasta_saida] [map.id ...]
// Saída padrão: test-results/visual/ (fora do Git).
import { mkdirSync, readFileSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';

const { chromium } = createRequire(join(process.cwd(), 'package.json'))('@playwright/test');
const BASE = process.env.BASE_URL ?? 'http://localhost:5173';
const [outDir = 'test-results/visual', ...only] = process.argv.slice(2);
mkdirSync(outDir, { recursive: true });

const maps = readdirSync('data/maps')
  .filter((f) => f.endsWith('.json'))
  .map((f) => JSON.parse(readFileSync(join('data/maps', f), 'utf8')).id)
  .filter((id) => !only.length || only.includes(id));

try {
  await fetch(BASE);
} catch {
  console.error(`✗ o jogo não responde em ${BASE}. Rode "npm run dev" em segundo plano antes.`);
  process.exit(1);
}

const browser = await chromium.launch();
// 1280 x 720 = 2x a resolução interna, como no teste de fumaça.
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const failed = [];
const errors = [];
page.on('response', (r) => { if (r.status() >= 400) failed.push(`${r.status()} ${r.url()}`); });
page.on('requestfailed', (r) => failed.push(`falhou ${r.url()}`));
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

/** Passa cenas e falas abertas (como skipDialogue em tests/e2e/smoke.spec.ts), para o print mostrar o mapa. */
async function skipOverlays() {
  const open = () => page.evaluate(() => !!document.querySelector('.dialogue-layer.open, .cutscene.open, .item-reveal'));
  const scripting = () => page.evaluate(() => window.__biscuitPaws?.cafe.isScriptRunning?.() ?? false);
  for (let i = 0, quiet = 0; i < 400 && quiet < 5; i++) {
    if (await open()) {
      quiet = 0;
      await page.keyboard.press('Space');
    } else quiet = (await scripting()) ? 0 : quiet + 1;
    await page.waitForTimeout(40);
  }
}

// Contexto limpo = jogo novo; o gancho de depuração só existe no npm run dev.
await page.goto(`${BASE}/?jogar`);
await page.waitForFunction(() => window.__biscuitPaws?.cafe?.map, null, { timeout: 120_000 });
await page.screenshot({ path: join(outDir, '00-abertura.png') });
await skipOverlays();
await page.waitForTimeout(500);

for (const [i, id] of maps.entries()) {
  try {
    await page.evaluate((m) => window.__biscuitPaws.cafe.goTo(m), id);
    await page.waitForFunction((m) => window.__biscuitPaws.cafe.map.id === m, id, { timeout: 15_000 });
    await page.waitForTimeout(1200); // fade e animações iniciais
    await skipOverlays();
    const file = join(outDir, `${String(i + 1).padStart(2, '0')}-${id.replace(/^map\./, '')}.png`);
    await page.screenshot({ path: file });
    console.log(`✓ ${id} -> ${file}`);
  } catch (e) {
    errors.push(`${id}: ${e.message.split('\n')[0]}`);
    console.log(`✗ ${id}`);
  }
}
await browser.close();

console.log(failed.length ? `\nArquivos que não carregaram (${failed.length}):\n  ${[...new Set(failed)].join('\n  ')}` : '\nTodos os arquivos carregaram.');
console.log(errors.length ? `\nErros (${errors.length}):\n  ${[...new Set(errors)].join('\n  ')}` : 'Sem erros na página.');
process.exit(failed.length || errors.length ? 1 : 0);
