// npx tsx scripts/migrate-assets.ts            -> simulação (dry-run, padrão): só mostra o que faria
// npx tsx scripts/migrate-assets.ts --apply    -> move os arquivos e reescreve as referências
// npx tsx scripts/migrate-assets.ts --undo     -> desfaz usando assets/_migracao/log.json
// O mapa vem da tabela entre <!-- MAPA:INICIO --> e <!-- MAPA:FIM --> em docs/ASSET_REORGANIZATION.md.
import { execSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, renameSync, rmdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

type Move = { from: string; to: string; dir: boolean };
const APPLY = process.argv.includes('--apply');
const UNDO = process.argv.includes('--undo');
const LOG = 'assets/_migracao/log.json';
const SCAN_DIRS = ['data', 'src', 'scripts', 'tests'];
const SCAN_EXT = /\.(json|ts|css|html)$/;
const NAME_OK = /^[a-z0-9_]+(\.[a-z0-9]+)?$/;

function readMap(): Move[] {
  const md = readFileSync('docs/ASSET_REORGANIZATION.md', 'utf8');
  const block = md.split('<!-- MAPA:INICIO -->')[1]?.split('<!-- MAPA:FIM -->')[0];
  if (!block) throw new Error('Mapa não encontrado no documento.');
  const moves: Move[] = [];
  for (const line of block.split('\n')) {
    const cells = line.split('|').map((c) => c.trim());
    const [from, to] = [cells[1], cells[2]].map((c) => c?.match(/^`([^`]+)`/)?.[1]);
    if (!from || !to) continue; // cabeçalho ou linha sem destino ("sai da pasta do jogo")
    const dir = from.endsWith('/') || from.includes('/*.png');
    moves.push({ from: from.replace(/\/\*\.png.*$/, '/'), to: to.replace(/\/\*\.png$/, '/'), dir });
  }
  return moves;
}

function walk(d: string): string[] {
  if (!existsSync(d)) return [];
  return readdirSync(d).flatMap((n) => (statSync(join(d, n)).isDirectory() ? walk(join(d, n)) : [join(d, n).replace(/\\/g, '/')]));
}

/** Formas em que um caminho aparece no código: "public/assets/x" e "assets/x" (relativo a public/). */
function forms(p: string): string[] {
  return p.startsWith('public/') ? [p, p.slice('public/'.length)] : [p];
}

function validate(moves: Move[]): string[] {
  const errors: string[] = [];
  const targets = new Set<string>();
  for (const m of moves) {
    if (!existsSync(m.from.replace(/\/$/, ''))) errors.push(`origem não existe: ${m.from}`);
    if (!m.to.startsWith('assets/_originais_pacotes/') && existsSync(m.to.replace(/\/$/, ''))) errors.push(`destino já existe: ${m.to}`);
    if (targets.has(m.to)) errors.push(`dois arquivos para o mesmo destino: ${m.to}`);
    targets.add(m.to);
    const base = m.to.replace(/\/$/, '').split('/').pop()!;
    if (!m.dir && !NAME_OK.test(base)) errors.push(`nome fora do padrão: ${m.to}`);
  }
  return errors;
}

function rewrite(moves: Move[], write: boolean): { file: string; count: number }[] {
  // Caminhos mais longos primeiro, para uma pasta não engolir um arquivo dela.
  const pairs = moves
    .flatMap((m) => forms(m.from).map((f, i) => [f, forms(m.to)[i] ?? m.to] as const))
    .sort((a, b) => b[0].length - a[0].length);
  const report: { file: string; count: number }[] = [];
  for (const file of SCAN_DIRS.flatMap(walk).concat(['index.html']).filter((f) => SCAN_EXT.test(f) && existsSync(f))) {
    let text = readFileSync(file, 'utf8');
    let count = 0;
    for (const [a, b] of pairs) {
      // "assets/x" não pode casar dentro de "public/assets/x" (esse já foi trocado pelo par longo).
      const re = new RegExp(`(?<![\\w/-])${a.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'g');
      text = text.replace(re, () => (count++, b));
    }
    if (count) {
      report.push({ file, count });
      if (write) writeFileSync(file, text);
    }
  }
  return report;
}

/** Caminhos montados com template (`${OUT}/ui/...`) não são trocados automaticamente. */
function dynamicRefs(): string[] {
  return SCAN_DIRS.flatMap(walk)
    .filter((f) => f.endsWith('.ts') && readFileSync(f, 'utf8').includes('assets/'))
    .flatMap((f) => readFileSync(f, 'utf8').split('\n').map((l, i) => [f, i + 1, l] as const))
    .filter(([, , l]) => /\$\{[^}]+\}\/[^`]*\.(png|gif)/.test(l) || /=\s*'(public\/)?assets\/[^']*'/.test(l))
    .map(([f, n, l]) => `${f}:${n}  ${l.trim()}`);
}

/** Arquivos que o Windows não deixou mover (abertos em outro programa): copiados, original fica para apagar depois. */
const locked: string[] = [];

function move(from: string, to: string): void {
  const [src, dst] = [from.replace(/\/$/, ''), to.replace(/\/$/, '')];
  mkdirSync(dirname(dst), { recursive: true });
  try {
    renameSync(src, dst);
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== 'EPERM' || !statSync(src).isDirectory()) throw e;
    // Pasta com algum arquivo aberto: move arquivo por arquivo.
    for (const f of walk(src)) {
      const target = dst + f.slice(src.length);
      mkdirSync(dirname(target), { recursive: true });
      try {
        renameSync(f, target);
      } catch {
        copyFileSync(f, target);
        locked.push(f);
      }
    }
    for (const d of walkDirs(src).reverse()) if (readdirSync(d).length === 0) rmdirSync(d);
  }
}

function walkDirs(d: string): string[] {
  return [d, ...readdirSync(d).map((n) => join(d, n).replace(/\\/g, '/')).filter((p) => statSync(p).isDirectory()).flatMap(walkDirs)];
}

if (UNDO) {
  const log = JSON.parse(readFileSync(LOG, 'utf8')) as { moves: Move[] };
  for (const m of [...log.moves].reverse()) move(m.to, m.from);
  rewrite(log.moves.map((m) => ({ from: m.to, to: m.from, dir: m.dir })), true);
  console.log(`Desfeito: ${log.moves.length} movimentos. Rode npm run check && npm test.`);
  process.exit(0);
}

const moves = readMap();
const errors = validate(moves);
const refs = rewrite(moves, false);
console.log(`${APPLY ? 'APLICANDO' : 'SIMULAÇÃO (nada é alterado)'}: ${moves.length} movimentos`);
for (const m of moves) console.log(`  ${m.from}  ->  ${m.to}`);
console.log(`\nReferências a reescrever:`);
for (const r of refs) console.log(`  ${r.file}: ${r.count}`);
const dyn = dynamicRefs();
if (dyn.length) console.log(`\nAjustar à mão (caminho montado em template):\n  ${dyn.join('\n  ')}`);
if (errors.length) {
  console.error(`\nERROS (nada foi feito):\n  ${errors.join('\n  ')}`);
  process.exit(1);
}
if (!APPLY) process.exit(0);

const dirty = execSync('git status --porcelain -- data src scripts tests', { encoding: 'utf8' }).trim();
if (dirty) {
  console.error('Há mudanças não commitadas em data/src/scripts/tests. Faça commit antes, para poder comparar o diff da migração.');
  process.exit(1);
}
// Pacotes primeiro (os originais ficam intactos), depois os arquivos do jogo.
const ordered = [...moves].sort((a, b) => Number(b.to.startsWith('assets/_originais_pacotes/')) - Number(a.to.startsWith('assets/_originais_pacotes/')));
for (const m of ordered) move(m.from, m.to);
rewrite(moves, true);
mkdirSync(dirname(LOG), { recursive: true });
writeFileSync(LOG, JSON.stringify({ date: new Date().toISOString(), moves: ordered }, null, 2));
if (locked.length) console.log(`\nCopiados (o original estava aberto em outro programa; apagar depois):\n  ${locked.join('\n  ')}`);
console.log(`\nFeito. Log para desfazer: ${LOG}. Agora: npm run check && npm test && npm run test:e2e, e conferir um print.`);
