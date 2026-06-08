/** @type {import('eslint').Linter.RulesRecord} */
export const sharedTypescriptRules = {
  '@typescript-eslint/no-explicit-any': 'warn',
  '@typescript-eslint/no-unused-vars': [
    'warn',
    { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
  ],
  'no-useless-assignment': 'warn',
  'no-empty': 'warn',
};
