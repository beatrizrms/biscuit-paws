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

export default defineConfig({
  plugins: [stripDevNotes()],
  server: { port: 5173, strictPort: true },
  // O Phaser sozinho tem ~1,2 MB; num jogo isso é esperado.
  build: { chunkSizeWarningLimit: 2000 },
  test: { include: ['tests/core/**/*.test.ts'] },
});
