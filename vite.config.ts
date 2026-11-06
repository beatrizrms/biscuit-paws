import { defineConfig } from 'vitest/config';

export default defineConfig({
  server: { port: 5173, strictPort: true },
  // O Phaser sozinho tem ~1,2 MB; num jogo isso é esperado.
  build: { chunkSizeWarningLimit: 2000 },
  test: { include: ['tests/core/**/*.test.ts'] },
});
