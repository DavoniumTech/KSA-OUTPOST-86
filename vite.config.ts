import { defineConfig } from 'vite';

const workersBuild = (globalThis as typeof globalThis & {
  process?: { env?: Record<string, string | undefined> };
}).process?.env?.WORKERS_CI === '1';

export default defineConfig(({ command }) => ({
  base: workersBuild ? '/' : command === 'build' ? '/KSA-OUTPOST-86/' : '/',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: false,
    target: 'es2022',
  },
  server: {
    host: '0.0.0.0',
  },
}));
