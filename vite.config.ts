import { spawn } from 'node:child_process';
import { defineConfig, type Plugin } from 'vitest/config';

/** No build de produção, tira as notas de desenvolvimento ("devNote") dos JSON de data/. */
function stripDevNotes(): Plugin {
  return {
    name: 'biscuit-paws:strip-dev-notes',
    apply: 'build',
    enforce: 'pre',
    transform(code, id) {
      if (!/[\/]data[\/].*\.json$/.test(id)) return null;
      const data = JSON.parse(code);
      const clean = JSON.stringify(data, (key, value) => (key === 'devNote' ? undefined : value));
      return { code: clean, map: null };
    },
  };
}

/**
 * No dev, regera data/tiles.json (fora do Git) quando os dados de tiles mudam com o servidor aberto: tilesets.json,
 * data/tilesets/*.json ou a folha do café. Sem isso, um mapa novo (ou um commit de outra sessão) aponta para tiles
 * que o catálogo velho não tem e o jogo para com "tile inexistente". O build-tiles só grava se mudou.
 */
function rebuildTilesOnChange(): Plugin {
  const watched = /[/\\]data[/\\](tilesets\.json|tilesets[/\\][^/\\]+\.json|tiles\.csv|tiles\.meta\.json|tiles\.worn\.json)$/;
  let timer: ReturnType<typeof setTimeout> | null = null;
  return {
    name: 'biscuit-paws:rebuild-tiles',
    apply: 'serve',
    configureServer(server) {
      const run = (file: string) => {
        if (!watched.test(file)) return;
        if (timer) clearTimeout(timer);
        timer = setTimeout(() => {
          spawn('npm', ['run', 'tiles'], { shell: true, stdio: 'inherit' });
        }, 200);
      };
      server.watcher.on('change', run);
      server.watcher.on('add', run);
    },
  };
}

export default defineConfig({
  plugins: [stripDevNotes(), rebuildTilesOnChange()],
  // host: true = também aceita conexões da rede local (abrir de outra máquina pelo IP deste PC).
  server: { port: 5173, strictPort: true, host: true },
  // O Phaser sozinho tem ~1,2 MB; num jogo isso é esperado.
  build: { chunkSizeWarningLimit: 2000 },
  test: { include: ['tests/core/**/*.test.ts'] },
});
