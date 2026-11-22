// QA: robô que joga o jogo de verdade (com tela, pelo Playwright), dia após dia, e registra o que aparece.
// Parte de um save (o jogo novo com o prólogo ainda não está coberto), faz o dia de uma jogadora comum (pedidos da vila,
// compras do básico, cuidar dos gatos, atender os clientes), responde às telas que pedem resposta e tira um print de
// cada cena, pergunta ou novidade. O relógio corre mais depressa (só o relógio: regras e textos são os do jogo).
//
//   npx tsx scripts/qa/robo-jogadora.ts [--save scripts/qa/saves/inverno-dia9.json] [--ate 60] [--dias 5]
//                                       [--k 8] [--porta 5197] [--visivel]
//   --ate: dia absoluto em que parar (60 = Primavera 30, com 30 dias por estação). --dias: quantos dias jogar.
// Saída (fora do Git): test-results/qa/robo/<data-hora>/registro.json, resumo.txt e os prints.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { chromium, type Page } from '@playwright/test';
import { createServer } from 'vite';

const args = process.argv.slice(2);
const arg = (name: string, fallback: string): string => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? args[i + 1]! : fallback;
};
const SAVE = arg('save', 'scripts/qa/saves/inverno-dia9.json');
const PORT = Number(arg('porta', '5197'));
const K_IDLE = Number(arg('k', '8'));
const VISIBLE = args.includes('--visivel');

interface Peek { kind: string; text: string; options?: string[]; did?: string }
interface DayRecord {
  day: number;
  start: unknown;
  end: unknown;
  morning: Peek[];
  log: string[];
  events: string[];
  screens: Peek[];
  shots: string[];
  stuck: string[];
  realSeconds: number;
}

const stamp = new Date().toISOString().replace(/[:T]/g, '-').slice(0, 19);
const OUT = resolve('test-results/qa/robo', stamp);
mkdirSync(OUT, { recursive: true });

/** Chamada a uma rotina da página (window.__nome). */
const call = <T>(page: Page, expr: string): Promise<T> => page.evaluate(`(async () => (${expr}))()`) as Promise<T>;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main(): Promise<void> {
  // Sem HMR nem vigia de arquivos: editar o código durante a corrida não recarrega a página do robô.
  const server = await createServer({ server: { port: PORT, strictPort: true, hmr: false, watch: null }, logLevel: 'error' });
  await server.listen();
  const url = `http://localhost:${PORT}`;
  const browser = await chromium.launch({ headless: !VISIBLE });
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const pageErrors: string[] = [];
  let page!: Page;
  /** Abre (ou reabre, depois de uma queda) o jogo no save mais recente e carrega as rotinas. */
  const openGame = async (): Promise<void> => {
    page = await context.newPage();
    page.on('pageerror', (e) => pageErrors.push(String(e).slice(0, 300)));
    await page.goto(`${url}/?jogar`);
    await page.waitForFunction('window.__biscuitPaws && (window.__biscuitPaws.cafe || window.__biscuitPaws.world)', undefined, { timeout: 120_000 });
    await page.addScriptTag({ path: resolve('scripts/qa/robo/rotinas.js') });
    await page.addScriptTag({ path: resolve('scripts/qa/robo/rotinas-dia.js') });
    await page.waitForFunction('window.__qaReady && window.__qaDayReady');
    await call(page, '(__mute(), __patchClock(), __hookEvents())');
  };

  // O save e o som desligado entram antes de o jogo abrir (uma vez só: o jogo regrava o save sozinho depois).
  const save = readFileSync(SAVE, 'utf8');
  await context.addInitScript(
    ([data]) => {
      if (localStorage.getItem('qa-robo:pronto')) return;
      const P = 'biscuit-paws:';
      localStorage.setItem(P + 'settings', JSON.stringify({ version: 1, music: { on: false, volume: 0 }, ambient: { on: false, volume: 0 } }));
      for (const k of ['slot1', 'auto', 'daystart-slot1']) localStorage.setItem(P + k, data!);
      localStorage.setItem(P + 'auto.origin', 'slot1');
      localStorage.setItem(P + 'current-slot', 'slot1');
      localStorage.setItem('qa-robo:pronto', '1');
    },
    [save],
  );
  await openGame();

  const first = await call<{ day: number }>(page, '__summary()');
  const UNTIL = args.includes('--dias') ? first.day + Number(arg('dias', '5')) : Number(arg('ate', '60'));
  console.log(`Robô: do dia ${first.day} até o dia ${UNTIL}; saída em ${OUT}`);

  const records: DayRecord[] = [];
  let shotN = 0;
  const seenScreens = new Set<string>();
  const shot = async (rec: DayRecord, label: string): Promise<void> => {
    const name = `d${String(rec.day).padStart(3, '0')}-${String(++shotN).padStart(4, '0')}-${label.replace(/[^a-z0-9]+/gi, '-').slice(0, 40)}.png`;
    await page.screenshot({ path: resolve(OUT, name) });
    rec.shots.push(name);
  };
  /** Responde ao que estiver na frente (fala, pergunta, novidade...). Fotografa a primeira vez que cada texto aparece. */
  const clearScreens = async (rec: DayRecord, max = 40): Promise<void> => {
    for (let i = 0; i < max; i++) {
      const p = await call<Peek>(page, '__peek()');
      if (p.kind === 'livre' || p.kind === 'ocupado') return;
      const key = `${p.kind}:${p.text.slice(0, 80)}`;
      if (!seenScreens.has(key) && p.kind !== 'painel') {
        seenScreens.add(key);
        await shot(rec, p.kind);
      }
      const done = await call<Peek | null>(page, '__unblock()');
      if (done?.did === 'esperei') return; // painel que uma rotina está usando
      if (done) rec.screens.push(done);
    }
  };

  let eventsRead = 0;
  let logRead = 0;
  const crashes: string[] = [];
  let crashesInARow = 0;
  for (let day = first.day; day < UNTIL; day++) {
    try {
    const t0 = Date.now();
    const rec: DayRecord = { day, start: null, end: null, morning: [], log: [], events: [], screens: [], shots: [], stuck: [], realSeconds: 0 };
    records.push(rec);
    await sleep(2500);
    await clearScreens(rec);
    rec.morning = [...rec.screens];
    rec.start = await call(page, '__summary()');
    await shot(rec, 'manha');

    // O dia roda dentro da página; daqui só se acompanha, responde às telas e destrava.
    await page.evaluate(`window.__ending = false; window.__log = []; window.__playDay({ kIdle: ${K_IDLE}, kBusy: 3 }); 0`);
    logRead = 0;
    let lastSig = '';
    let sameFor = 0;
    for (let tick = 0; tick < 400; tick++) {
      await sleep(3000);
      const st = await call<{ running: boolean; sig: string; busy: boolean; time: number }>(
        page,
        '({ running: window.__dayRunning, sig: [__G().session.state.day, Math.floor(__G().session.state.time), __G().player.x | 0, __G().player.y | 0, window.__log.length, __G().session.state.location].join("|"), busy: __G().ui.isBusy(), time: __G().session.state.time })',
      );
      await clearScreens(rec, 12);
      if (!st.running) break;
      sameFor = st.sig === lastSig ? sameFor + 1 : 0;
      lastSig = st.sig;
      // 30 s reais sem nada mudar (hora, lugar, registro): travou. Fotografa, solta as teclas e dá um passo para o lado.
      if (sameFor >= 10) {
        await shot(rec, 'travou');
        const u = await call<unknown>(page, '__unstick()');
        rec.stuck.push(`${st.sig} -> ${JSON.stringify(u)}`);
        sameFor = 0;
      }
      if (rec.stuck.length >= 8) break; // não sai do lugar: encerra o dia assim mesmo
    }
    await page.evaluate('window.__serving = false; window.__ending = true; 0');
    await sleep(1500);
    await clearScreens(rec);
    rec.end = await call(page, '__summary()');
    await shot(rec, 'fim');

    // Vai para casa (espera os clientes saírem). Se o dia não virar, registra e tenta de novo uma vez.
    for (let attempt = 0; attempt < 3; attempt++) {
      const ended = call<{ st: { day: number } }>(page, '__endDay()');
      const guard = (async () => {
        for (let i = 0; i < 40; i++) {
          await sleep(3000);
          await clearScreens(rec, 6);
          const d = await call<number>(page, '__G().session.state.day');
          if (d > day) return;
        }
      })();
      await Promise.race([ended.then(() => undefined), guard]);
      const d = await call<number>(page, '__G().session.state.day');
      if (d > day) break;
      rec.stuck.push(`o dia ${day} não terminou (tentativa ${attempt + 1})`);
      await shot(rec, 'dia-nao-terminou');
      await call(page, '__unstick()');
    }
    const lines = await call<string[]>(page, 'window.__log');
    rec.log = lines.slice(logRead);
    const events = await call<{ day: number; min: number; name: string }[]>(page, 'window.__events');
    rec.events = events.slice(eventsRead).map((e) => `d${e.day} ${Math.floor(e.min / 60)}:${String(e.min % 60).padStart(2, '0')} ${e.name}`);
    eventsRead = events.length;
    rec.realSeconds = Math.round((Date.now() - t0) / 1000);
    writeFileSync(resolve(OUT, 'registro.json'), JSON.stringify({ save: SAVE, pageErrors, crashes, days: records }, null, 1));
    const end = rec.end as { money: number; cats: unknown[] };
    console.log(`dia ${day}: ${rec.realSeconds}s reais, moedas ${end.money}, gatos ${end.cats.length}, telas ${rec.screens.length}, travou ${rec.stuck.length}`);
    const now = await call<number>(page, '__G().session.state.day');
    if (now <= day) {
      console.log(`PAREI: o dia ${day} não terminou.`);
      break;
    }
    crashesInARow = 0;
    } catch (e) {
      // A página caiu (ou fechou): registra, reabre no save mais recente e refaz o dia de onde o save estiver.
      const msg = String(e).slice(0, 200);
      crashes.push(`dia ${day}: ${msg}`);
      console.log(`QUEDA no dia ${day}: ${msg}`);
      if (++crashesInARow >= 3) {
        console.log('PAREI: três quedas seguidas.');
        break;
      }
      await page.close().catch(() => undefined);
      await openGame();
      eventsRead = 0;
      day = (await call<number>(page, '__G().session.state.day')) - 1;
    }
  }

  // Resumo em texto: um bloco por dia, com o que apareceu de novo.
  const lines: string[] = [];
  for (const r of records) {
    const s = r.start as { money: number; goals: string[]; news: string[] } | null;
    const e = r.end as { money: number; rating: number | null; served: number | null; gaveUp: number | null; chores: string[] } | null;
    lines.push(`\n=== Dia ${r.day} (${r.realSeconds}s) moedas ${s?.money} -> ${e?.money}; nota ${e?.rating}; atendidos ${e?.served}, desistiram ${e?.gaveUp} ===`);
    if (s?.news.length) lines.push(`  jornal: ${s.news.join(' | ')}`);
    for (const x of r.screens) lines.push(`  [${x.kind}] ${x.text.slice(0, 260)}${x.did ? ` => ${x.did}` : ''}`);
    for (const x of r.events) lines.push(`  evento: ${x}`);
    for (const x of r.log) if (/ERRO|NÃO|SEM |não |clínica|ficha|resultado|ponto |pedi a fachada|\[/.test(x)) lines.push(`  rotina: ${x.slice(0, 300)}`);
    for (const x of r.stuck) lines.push(`  TRAVOU: ${x}`);
    if (e?.chores.length) lines.push(`  ficou por fazer: ${e.chores.join(', ')}`);
  }
  if (crashes.length) lines.push(`\nQuedas da página: ${crashes.join(' || ')}`);
  if (pageErrors.length) lines.push(`\nErros da página: ${[...new Set(pageErrors)].join(' || ')}`);
  writeFileSync(resolve(OUT, 'resumo.txt'), lines.join('\n'));
  console.log(`\nRegistro: ${resolve(OUT, 'registro.json')}\nResumo: ${resolve(OUT, 'resumo.txt')}`);
  await browser.close();
  await server.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
