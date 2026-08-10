import path from 'node:path'
import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import boundaries from 'eslint-plugin-boundaries'
import eslintConfigPrettier from 'eslint-config-prettier'
import { defineConfig, globalIgnores } from 'eslint/config'

// Файл лежит в src/config, но глобы files/ignores у флэт-конфига резолвятся
// относительно cwd процесса eslint (frontend/), а не относительно самого конфига —
// поэтому здесь достаточно обычных 'dist'/'**/*.{ts,tsx}' без '../'.
// А вот настройки плагинов (root-path, project) плагины резолвят сами, по-разному —
// чтобы не гадать, даём им абсолютные пути.
const srcDir = path.resolve(import.meta.dirname, '../')

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
        plugins: {
            boundaries,
        },
        languageOptions: {
            ecmaVersion: 2020,
            globals: globals.browser,
        },
        settings: {
            'import/resolver': {
                typescript: {
                    project: path.resolve(import.meta.dirname, 'tsconfig.app.json'),
                },
            },
            'boundaries/root-path': srcDir,
            'boundaries/elements': [
                { type: 'app', mode: 'folder', pattern: 'app' },
                {
                    type: 'pages',
                    mode: 'folder',
                    pattern: 'pages/*',
                    capture: ['page'],
                },
                {
                    type: 'features',
                    mode: 'folder',
                    pattern: 'features/*',
                    capture: ['feature'],
                },
                { type: 'kernel', mode: 'folder', pattern: 'kernel' },
                { type: 'shared', mode: 'folder', pattern: 'shared' },
            ],
        },
        rules: {
            'boundaries/dependencies': [
                'error',
                {
                    default: 'disallow',
                    rules: [
                        {
                            // app — композиционный корень, ему можно импортировать всё;
                            // остальные слои не получают доступ к app (нет в их allow-списках)
                            from: 'app',
                            allow: ['app', 'pages', 'features', 'kernel', 'shared'],
                        },
                        {
                            // страница может использовать свои же модули, фичи и нижние слои,
                            // но не модули другой страницы (кросс-импорт между pages запрещён)
                            from: 'pages',
                            allow: [['pages', { page: '${from.page}' }], 'features', 'kernel', 'shared'],
                        },
                        {
                            // фича может использовать себя же и нижние слои,
                            // но не другую фичу (кросс-импорт между features запрещён)
                            from: 'features',
                            allow: [['features', { feature: '${from.feature}' }], 'kernel', 'shared'],
                        },
                        {
                            // kernel ничего не принимает извне, кросс-импорт внутри слоя разрешён
                            from: 'kernel',
                            allow: ['kernel'],
                        },
                        {
                            // shared — чистая инфраструктура без бизнес-логики,
                            // не зависит ни от чего, кроме себя самой
                            from: 'shared',
                            allow: ['shared'],
                        },
                    ],
                },
            ],
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
