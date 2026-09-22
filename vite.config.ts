import { fileURLToPath, URL } from 'node:url';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { svelteTesting } from '@testing-library/svelte/vite';
import { defineConfig } from 'vitest/config';

const src = (path: string) => fileURLToPath(new URL(path, import.meta.url));

export default defineConfig({
  // Renseigné par la CI pour GitHub Pages (`/<nom-du-depot>/`), `/` en local.
  base: process.env['BASE_PATH'] ?? '/',
  plugins: [svelte(), svelteTesting()],
  resolve: {
    alias: [
      { find: /^@engine$/, replacement: src('./src/engine/index.ts') },
      { find: /^@engine\//, replacement: `${src('./src/engine')}/` },
      { find: /^@ui\//, replacement: `${src('./src/ui')}/` },
    ],
  },
  test: {
    include: ['src/**/*.test.ts', 'tests/**/*.test.ts'],
    // Node par défaut ; les tests de composants déclarent `@vitest-environment happy-dom`.
    environment: 'node',
  },
});
