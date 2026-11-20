import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  server: { port: 5176, strictPort: true },
  preview: { port: 4176, strictPort: true },
});
