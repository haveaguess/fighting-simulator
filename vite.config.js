import { defineConfig } from 'vite';

export default defineConfig({
  root: '.',
  publicDir: 'public',
  base: '/fighting-simulator/',
  server: { port: 3000 },
});
