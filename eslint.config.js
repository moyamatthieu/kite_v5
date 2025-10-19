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

      // Règles pour éviter les facteurs magiques (pragmatique et professionnel)
      // Les constantes spécifiques (couleurs, dimensions, positions) sont acceptables
      // car elles sont documentées dans VISUAL_CONFIG ou ont un contexte clair
      'no-magic-numbers': ['warn', {
        'ignore': [
          // Nombres de base et opérations communes
          0, 1, -1, 2, 3,
          // Fractions et pourcentages courants
          0.5, 0.6, 0.8,
          // Angles standards
          90, 180, 360,
          // Nombres ronds en simulation/config
          5, 8, 10, 16, 20, 32, 50, 55, 60, 70, 100, 150, 200, 500, 1000,
          // Coefficients physiques standards
          0.1, 0.4, 0.98, 0.99, 1.5, 2.5,
          // Dimensions spécifiques (documentées dans VISUAL_CONFIG)
          0.003, 0.015, 0.035, 0.05,
          // Positions spécifiques de la caméra/pilote (optimisées manuellement)
          -12.33, -3.92, 0.45, 11.96, 13.37,
          // Couleurs hexadécimales (acceptables en config visuelle)
          0x00ff00, 0xff0000, 0xffffff, 0x87CEEB, 0x444444, 0x888888
        ],
        'ignoreArrayIndexes': true,
        'ignoreDefaultValues': true,
        'ignoreEnums': true,
        'detectObjects': false,
        'ignoreClassFieldInitialValues': true,
        'ignoreNumericLiteralTypes': true
      }],

      // Règles de complexité (pragmatiques pour simulation physique)
      'complexity': ['warn', 15], // Complexité cyclomatique max 15
      'max-lines-per-function': ['warn', 80], // Max 80 lignes par fonction  
      'max-params': ['warn', 4] // Max 4 paramètres (strict)
    }
  },
  {
    // Règles spécifiques pour les fichiers de configuration uniquement
    files: ['src/ecs/config/**/*.ts'],
    rules: {
      'no-magic-numbers': 'off' // Les fichiers de config peuvent contenir des constantes
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
      '*.spec.ts',
      'src/ecs/.legacy/**',
      'src/ecs/.backup-before-simplification/**',
      '**/*.old',
      '**/*.bak'
    ]
  }
];