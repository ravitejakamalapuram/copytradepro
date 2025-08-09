import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { globalIgnores } from 'eslint/config'

export default tseslint.config([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs['recommended-latest'],
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    rules: {
      // Allow any types in specific cases where typing is complex
      '@typescript-eslint/no-explicit-any': 'warn',
      // Allow unused vars with underscore prefix
      '@typescript-eslint/no-unused-vars': ['error', {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        ignoreRestSiblings: true
      }],
      // Allow empty object types for extending interfaces
      '@typescript-eslint/no-empty-object-type': 'warn',
      // Allow useless catch in some cases
      'no-useless-catch': 'warn',
      // Allow conditional assignment in specific cases
      'no-cond-assign': 'warn',
      // Relax react-refresh rules for utility files
      'react-refresh/only-export-components': ['warn', {
        allowConstantExport: true,
        allowExportNames: ['useAuth', 'useToast', 'PageTransition']
      }],
      // Relax react-hooks exhaustive deps for complex dependencies
      'react-hooks/exhaustive-deps': 'warn'
    },
  },
])
