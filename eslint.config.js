import js from '@eslint/js';
import tseslint from '@typescript-eslint/eslint-plugin';
import tsparser from '@typescript-eslint/parser';
import importPlugin from 'eslint-plugin-import';

export default [
  js.configs.recommended,
  {
    files: ['src/**/*.ts'],
    languageOptions: {
      parser: tsparser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        project: './tsconfig.json'
      },
      globals: {
        console: 'readonly',
        window: 'readonly',
        document: 'readonly',
        performance: 'readonly',
        requestAnimationFrame: 'readonly',
        'jest/globals': true
      }
    },
    plugins: {
      '@typescript-eslint': tseslint,
      'import': importPlugin
    },
    rules: {
      // Règles de base pour la qualité du code
      'no-unused-vars': 'off', // Désactivé car @typescript-eslint/no-unused-vars est plus strict
      '@typescript-eslint/no-unused-vars': ['error', { 'argsIgnorePattern': '^_' }],
      'no-console': 'warn', // Les console.log sont acceptables en développement
      'prefer-const': 'error',
      'no-var': 'error',

      // Règles TypeScript spécifiques
      '@typescript-eslint/explicit-function-return-type': 'off', // Pas nécessaire pour les méthodes privées
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-inferrable-types': 'off', // Types explicites sont préférables mais pas obligatoires

      // Règles d'import
      'import/no-unresolved': 'off', // Les alias @/* peuvent ne pas être résolus
      'import/order': ['error', {
        'groups': ['builtin', 'external', 'internal', 'parent', 'sibling', 'index'],
        'newlines-between': 'always'
      }],

      // Règles pour éviter les facteurs magiques
      'no-magic-numbers': ['warn', {
        'ignore': [0, 1, -1], // Nombres simples acceptables
        'ignoreArrayIndexes': true,
        'ignoreDefaultValues': true,
        'ignoreEnums': true,
        'detectObjects': false
      }],

      // Règles de complexité
      'complexity': ['warn', 10], // Avertir si complexité cyclomatique > 10
      'max-lines-per-function': ['warn', 50], // Fonctions trop longues
      'max-params': ['warn', 4] // Trop de paramètres
    }
  },
  {
    ignores: [
      'dist/',
      'node_modules/',
      'archive/',
      '*.backup.*',
      'vite.config.ts',
      'tsconfig*.json',
      'tests/',
      '*.test.ts',
      '*.spec.ts'
    ]
  }
];