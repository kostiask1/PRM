import js from '@eslint/js';
import globals from 'globals';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';

export default [
  { ignores: ['dist', 'node_modules', 'data'] },
  {
    files: ['**/*.{js,jsx}'],
    languageOptions: {
      ecmaVersion: 2020,
      globals: {
        ...globals.browser,
        ...globals.node,
        ...globals.serviceworker,
      },
      parserOptions: {
        ecmaVersion: 'latest',
        ecmaFeatures: { jsx: true },
        sourceType: 'module',
      },
    },
    settings: { react: { version: '18.3' } },
    plugins: {
      react,
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...js.configs.recommended.rules,
      ...react.configs.recommended.rules,
      ...react.configs['jsx-runtime'].rules,
      ...reactHooks.configs.recommended.rules,
      'react/jsx-no-target-blank': 'off',
      'react-refresh/only-export-components': [
        'warn',
        { allowConstantExport: true },
      ],
      'react/prop-types': 'off',
      'no-unused-vars': ['warn', { 
        'vars': 'all', 
        'args': 'after-used', 
        'ignoreRestSiblings': true,
        'argsIgnorePattern': '^_' 
      }],
      'no-console': ['warn', { allow: ['warn', 'error', 'info', 'log'] }],
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: [
                '**/entities/*/api/**',
                '**/entities/*/model/**',
                '**/entities/*/ui/**',
                '**/features/*/ui/**',
                '**/features/*/model/**',
                '**/widgets/*/ui/**',
                '**/pages/*/ui/**',
                '**/shared/api/httpClient*',
                '**/shared/model/*State*',
              ],
              message:
                'Import FSD slices through a public index.js or segment entry point.',
            },
            {
              group: [
                '**/utils/classNames*',
                '**/utils/campaignGraph*',
                '**/utils/deepSearch*',
                '**/utils/domNavigation*',
                '**/utils/download*',
                '**/utils/formatBytes*',
                '**/utils/id*',
                '**/utils/json*',
                '**/utils/mentionEditor*',
                '**/utils/mentionPicker*',
                '**/utils/navigation*',
                '**/utils/searchHighlight*',
                '**/utils/undoRedo*',
              ],
              message:
                'Import retired generic utilities from their documented shared public modules; legacy src/utils ownership is closed.',
            },
            {
              group: ['**/shared/model/mentionPickerSelection*'],
              message:
                'Import mention-selection orchestration through shared/model/index.js.',
            },
            {
              group: [
                '**/services/localization*',
                '**/services/uiSettings*',
                '**/services/entities*',
                '**/shared/config/localization*',
                '**/shared/config/theme*',
              ],
              message:
                'Import localization and theme configuration through shared/config/index.js.',
            },
            {
              group: ['**/hooks/useDebounce*'],
              message:
                'Import the generic debounce hook from shared/lib/useDebounce.js.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['server/**/*.js'],
    rules: {
      'no-restricted-modules': [
        'error',
        {
          name: './storage',
          message:
            'Import the owning backend domain or infrastructure module instead of the legacy storage facade.',
        },
        {
          name: '../storage',
          message:
            'Import the owning backend domain or infrastructure module instead of the legacy storage facade.',
        },
      ],
    },
  },
];
