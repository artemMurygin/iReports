import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import eslintConfigPrettier from 'eslint-config-prettier'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
    // `apps-script/` is a separate sub-project (its own package.json/tsconfig/node_modules) that
    // compiles to Apps Script's V8 runtime, where every file shares one global scope by design —
    // this workspace's React/FSD lint rules (and `no-unused-vars`, which can't see that
    // cross-file "unused" top-level functions are called via `google.script.run` or Apps Script's
    // own concatenation) don't apply there. See apps-script/README.md.
    globalIgnores(['dist', 'apps-script']),
    {
        files: ['**/*.{ts,tsx}'],
        extends: [
            js.configs.recommended,
            tseslint.configs.recommended,
            reactHooks.configs.flat.recommended,
            reactRefresh.configs.vite,
        ],
        languageOptions: {
            ecmaVersion: 2020,
            globals: globals.browser,
        },
    },
    {
        files: ['**/ui/**/*.{ts,tsx}'],
        rules: {
            'react-refresh/only-export-components': 'off',
        },
    },
    eslintConfigPrettier,
])
