import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import svelte from 'eslint-plugin-svelte';
import globals from 'globals';
import ts from 'typescript-eslint';
import svelteConfig from './svelte.config.js';

const forbiddenTimers = ['setTimeout', 'setInterval'].map((name) => ({
  name,
  message:
    'Le moteur ne déclenche rien avec les timers du navigateur : ' +
    'seul le scheduler à lookahead (clock/) programme des événements, sur l’horloge audio.',
}));

export default ts.config(
  { ignores: ['dist/', 'node_modules/'] },
  js.configs.recommended,
  ...ts.configs.strict,
  ...svelte.configs.recommended,
  prettier,
  ...svelte.configs.prettier,
  {
    languageOptions: { globals: { ...globals.browser } },
  },
  {
    files: ['**/*.svelte', '**/*.svelte.ts'],
    languageOptions: {
      parserOptions: { parser: ts.parser, extraFileExtensions: ['.svelte'], svelteConfig },
    },
  },
  {
    // Frontière moteur / interface : le moteur ne connaît ni Svelte ni src/ui.
    files: ['src/engine/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['svelte', 'svelte/*', '@ui/*', '**/ui/**'],
              message: 'Le moteur audio ne dépend pas de la couche d’interface.',
            },
          ],
        },
      ],
      'no-restricted-globals': ['error', ...forbiddenTimers],
    },
  },
  {
    // Seul le worker de timer a le droit de se réveiller périodiquement.
    files: ['src/engine/clock/timer.worker.ts'],
    rules: { 'no-restricted-globals': 'off' },
  },
);
