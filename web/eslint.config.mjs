import json from '@eslint/js';
import tseslint from 'typescript-eslint';
import svelte from 'eslint-plugin-svelte';
import prettier from 'eslint-config-prettier';
import globals from 'globals';
import svelteConfig from './svelte.config.js';

export default tseslint.config(
	json.configs.recommended,
	tseslint.configs.recommended,
	...svelte.configs.recommended,
	prettier,
	{
		ignores: [
			'build/',
			'.svelte-kit/',
			'dist/',
			'node_modules/',
			'*.config.js'
		]
	},
	{
		files: ['**/*.svelte'],
		languageOptions: {
			globals: globals.browser,
			parserOptions: {
				svelteConfig,
				parser: tseslint.parser,
				extraFileExtensions: ['.svelte']
			}
		}
	}
);
