import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'
import { sharedTypescriptRules } from '@4velo/eslint-config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
    },
    rules: {
      ...sharedTypescriptRules,
      'react-hooks/set-state-in-effect': 'off',
      'preserve-caught-error': 'off',
      'react-hooks/refs': 'off',
      'react-hooks/purity': 'off',
      // The admin app is not compiled with React Compiler yet. These compiler-only
      // diagnostics reject valid ref synchronization and stable state setters.
      // Re-enable them as a dedicated compiler migration, not as an incidental lint upgrade.
      'react-hooks/immutability': 'off',
      'react-hooks/preserve-manual-memoization': 'off',
    },
  },
])
